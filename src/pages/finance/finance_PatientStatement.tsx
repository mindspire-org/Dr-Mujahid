import { useMemo, useState, useEffect } from 'react'
import { hospitalApi } from '../../utils/api'
import { format } from 'date-fns'

type StatementEntry = {
  id: string
  date: string
  type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND'
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  metadata?: Record<string, any>
}

type PatientStatement = {
  patientId: string
  mrn: string
  patientName: string
  openingBalance: number
  closingBalance: number
  startDate: string
  endDate: string
  entries: StatementEntry[]
}

export default function Finance_PatientStatement() {
  const [mrn, setMrn] = useState('')
  const [from, setFrom] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return format(date, 'yyyy-MM-dd')
  })
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statement, setStatement] = useState<PatientStatement | null>(null)
  const [lastSearch, setLastSearch] = useState('')
  
  // Auto-submit when MRN is entered and valid
  useEffect(() => {
    if (mrn.trim().length >= 3 && mrn !== lastSearch) {
      handleSearch()
    }
  }, [mrn, from, to])
  
  const handleSearch = async () => {
    const mrnToSearch = mrn.trim()
    if (!mrnToSearch) return
    
    setLoading(true)
    setError('')
    setLastSearch(mrnToSearch)
    
    try {
      const response = await hospitalApi.getPatientStatement({
        mrn: mrnToSearch,
        from: from || undefined,
        to: to || undefined
      })
      
      // Transform the API response to match our PatientStatement type
      const statementData: PatientStatement = {
        patientId: response.patientId,
        mrn: response.mrn,
        patientName: response.patientName,
        openingBalance: parseFloat(response.openingBalance) || 0,
        closingBalance: parseFloat(response.closingBalance) || 0,
        startDate: response.startDate,
        endDate: response.endDate,
        entries: (response.entries || []).map((entry: any) => ({
          id: entry.id,
          date: entry.date,
          type: entry.type,
          reference: entry.reference || '',
          description: entry.description || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
          balance: parseFloat(entry.balance) || 0,
          metadata: entry.metadata
        }))
      }
      
      setStatement(statementData)
    } catch (err: any) {
      console.error('Failed to fetch patient statement:', err)
      setError(err?.message || 'Failed to load patient statement. Please try again.')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }

  const totals = useMemo(() => {
    if (!statement) return { debit: 0, credit: 0 }
    return statement.entries.reduce(
      (acc, entry) => ({
        debit: acc.debit + (entry.debit || 0),
        credit: acc.credit + (entry.credit || 0)
      }),
      { debit: 0, credit: 0 }
    )
  }, [statement])

  // Format currency values consistently
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  // Format date consistently
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  // Get the type display name
  const getTypeDisplay = (type: string) => {
    switch (type) {
      case 'INVOICE': return 'Invoice'
      case 'PAYMENT': return 'Payment'
      case 'ADJUSTMENT': return 'Adjustment'
      case 'REFUND': return 'Refund'
      default: return type
    }
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Patient Statement of Account</h1>
        <p className="text-sm text-slate-500">View and manage patient financial statements</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">MR Number</label>
            <input
              type="text"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Enter MRN"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={loading}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading || !mrn.trim()}
              className="btn w-full flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-rose-800">Error loading statement</h3>
              <div className="mt-2 text-sm text-rose-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {statement && (
        <div className="space-y-4">
          {/* Patient Information */}
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <h3 className="text-lg font-medium text-slate-900">{statement.patientName}</h3>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">MRN</dt>
                    <dd className="text-sm text-slate-900">{statement.mrn}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Statement Period</dt>
                    <dd className="text-sm text-slate-900">
                      {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-3 text-center">
                    <dt className="text-sm font-medium text-slate-500">Opening Balance</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-900">
                      {formatCurrency(statement.openingBalance)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-center">
                    <dt className="text-sm font-medium text-slate-500">Total Charges</dt>
                    <dd className="mt-1 text-lg font-semibold text-rose-600">
                      {formatCurrency(totals.debit)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-center">
                    <dt className="text-sm font-medium text-slate-500">Total Payments</dt>
                    <dd className="mt-1 text-lg font-semibold text-emerald-600">
                      {formatCurrency(totals.credit)}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Reference
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                      Debit
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                      Credit
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {formatDate(statement.startDate)}
                    </td>
                    <td colSpan={3} className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      Opening Balance
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                      {statement.openingBalance > 0 ? formatCurrency(statement.openingBalance) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                      {statement.openingBalance < 0 ? formatCurrency(Math.abs(statement.openingBalance)) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(statement.openingBalance)}
                    </td>
                  </tr>

                  {/* Statement Entries */}
                  {statement.entries.length > 0 ? (
                    statement.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                          {formatDate(entry.date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            entry.type === 'PAYMENT' 
                              ? 'bg-green-100 text-green-800' 
                              : entry.type === 'INVOICE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {getTypeDisplay(entry.type)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                          {entry.reference || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate" title={entry.description}>
                          {entry.description || '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-slate-900">
                          {formatCurrency(entry.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500">
                        No transactions found for the selected period
                      </td>
                    </tr>
                  )}

                  {/* Closing Balance Row */}
                  <tr className="bg-slate-50 font-medium">
                    <td colSpan={4} className="px-6 py-4 text-right text-sm text-slate-900">
                      Closing Balance
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                      {statement.closingBalance > 0 ? formatCurrency(statement.closingBalance) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                      {statement.closingBalance < 0 ? formatCurrency(Math.abs(statement.closingBalance)) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(statement.closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Summary */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:space-y-0">
            <div className="text-sm text-slate-600">
              <p>Statement generated on {format(new Date(), 'MMMM d, yyyy')}</p>
              <p className="mt-1">For any questions, please contact the billing department.</p>
            </div>
            <div className="text-right">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

