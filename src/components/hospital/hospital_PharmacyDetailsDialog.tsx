import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { pharmacyApi } from '../../utils/api'

interface Props {
  open: boolean
  onClose: () => void
  mrn: string
  patientName: string
}

export default function HospitalPharmacyDetailsDialog({ open, onClose, mrn, patientName }: Props) {
  const [tab, setTab] = useState<'purchases' | 'returns'>('purchases')
  const [sales, setSales] = useState<any[]>([])
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !mrn) return
    setLoading(true)
    setSales([])
    setReturns([])
    ;(async () => {
      try {
        // Step 1: fetch all sales for this patient by MRN
        const salesRes: any = await (pharmacyApi.listSalesByMrn(mrn) as Promise<any>).catch(() => ({ items: [] }))
        const fetchedSales: any[] = salesRes?.items || []
        setSales(fetchedSales)

        // Step 2: collect all bill numbers from those sales
        const billNos: string[] = fetchedSales.map((s: any) => String(s.billNo || '')).filter(Boolean)

        // Step 3: fetch returns whose reference matches any of those bill numbers
        // The Return.reference field is always the original billNo for customer returns
        if (billNos.length === 0) {
          setReturns([])
          return
        }
        const returnResults = await Promise.all(
          billNos.map(bill =>
            (pharmacyApi.listReturnsByMrnOrName(bill) as Promise<any>).catch(() => ({ items: [] }))
          )
        )
        const allReturns: any[] = returnResults.flatMap((r: any) => r?.items || [])
        // Deduplicate by _id
        const seen = new Set<string>()
        const unique = allReturns.filter((r: any) => {
          const id = String(r._id || '')
          if (seen.has(id)) return false
          seen.add(id)
          return true
        })
        setReturns(unique)
      } finally {
        setLoading(false)
      }
    })()
  }, [open, mrn])

  if (!open) return null

  const fmt = (v: any) => {
    try { return new Date(v).toLocaleString() } catch { return '-' }
  }
  const rs = (n: any) => `Rs ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
          <div>
            <div className="text-base font-semibold text-slate-900">Pharmacy History</div>
            <div className="mt-0.5 text-xs text-slate-500">{patientName} &bull; MR: {mrn}</div>
          </div>
          <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setTab('purchases')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'purchases' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Purchases {sales.length > 0 && <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">{sales.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('returns')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'returns' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Returns {returns.length > 0 && <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">{returns.length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading && <div className="py-8 text-center text-sm text-slate-500">Loading...</div>}

          {!loading && tab === 'purchases' && (
            sales.length === 0
              ? <div className="py-8 text-center text-sm text-slate-500">No pharmacy purchases found for this patient.</div>
              : <div className="space-y-4">
                  {sales.map((sale: any, i: number) => (
                    <div key={String(sale._id || i)} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Bill: {sale.billNo || '-'}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{fmt(sale.datetime)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">{rs(sale.total)}</div>
                          <div className={`mt-0.5 text-xs font-medium ${sale.payment === 'Credit' ? 'text-amber-600' : 'text-emerald-600'}`}>{sale.payment || '-'}</div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
                        <div><span className="text-slate-400">Subtotal:</span> {rs(sale.subtotal)}</div>
                        {Number(sale.discountPct || 0) > 0 && <div><span className="text-slate-400">Discount:</span> {sale.discountPct}%</div>}
                        {Number(sale.taxAmount || 0) > 0 && <div><span className="text-slate-400">Tax:</span> {rs(sale.taxAmount)}</div>}
                        <div><span className="text-slate-400">Status:</span> <span className={sale.paymentStatus === 'unpaid' ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>{sale.paymentStatus || 'paid'}</span></div>
                        {Number(sale.duesAfter || 0) > 0 && <div><span className="text-slate-400">Dues:</span> <span className="text-red-600 font-medium">{rs(sale.duesAfter)}</span></div>}
                        {sale.createdBy && <div><span className="text-slate-400">By:</span> {sale.createdBy}</div>}
                      </div>

                      {Array.isArray(sale.lines) && sale.lines.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-left text-slate-500">
                                <th className="border border-slate-200 px-2 py-1.5">Medicine</th>
                                <th className="border border-slate-200 px-2 py-1.5 text-right">Qty</th>
                                <th className="border border-slate-200 px-2 py-1.5 text-right">Unit Price</th>
                                <th className="border border-slate-200 px-2 py-1.5 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sale.lines.map((line: any, li: number) => (
                                <tr key={li} className="text-slate-700">
                                  <td className="border border-slate-200 px-2 py-1.5">{line.name || '-'}</td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-right">{line.qty}</td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-right">{rs(line.unitPrice)}</td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-right">{rs(Number(line.unitPrice || 0) * Number(line.qty || 0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
          )}

          {!loading && tab === 'returns' && (
            returns.length === 0
              ? <div className="py-8 text-center text-sm text-slate-500">No pharmacy returns found for this patient.</div>
              : <div className="space-y-4">
                  {returns.map((ret: any, i: number) => (
                    <div key={String(ret._id || i)} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Ref: {ret.reference || '-'}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{fmt(ret.datetime)}</div>
                          <div className="mt-0.5 text-xs text-slate-500">Party: {ret.party || '-'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">{rs(ret.total)}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{ret.items} item{ret.items !== 1 ? 's' : ''}</div>
                        </div>
                      </div>

                      {Array.isArray(ret.lines) && ret.lines.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-left text-slate-500">
                                <th className="border border-slate-200 px-2 py-1.5">Medicine</th>
                                <th className="border border-slate-200 px-2 py-1.5 text-right">Qty</th>
                                <th className="border border-slate-200 px-2 py-1.5 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ret.lines.map((line: any, li: number) => (
                                <tr key={li} className="text-slate-700">
                                  <td className="border border-slate-200 px-2 py-1.5">{line.name || '-'}</td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-right">{line.qty}</td>
                                  <td className="border border-slate-200 px-2 py-1.5 text-right">{rs(line.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
          )}
        </div>
      </div>
    </div>
  )
}
