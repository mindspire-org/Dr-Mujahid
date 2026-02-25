import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type Row = {
  pettyCashOwner: string
  date: string
  time: string
  customerSupplier: string
  customerSupplierNo: string
  invoiceNo: string
  department: string
  transactionType: string
  transBy: string
  transactionNo: string
  credit: number
  debit: number
  balance: number
}

function toCsv(rows: Row[]) {
  const headers = [
    'pettyCashOwner',
    'date',
    'time',
    'customerSupplier',
    'customerSupplierNo',
    'invoiceNo',
    'department',
    'transactionType',
    'transBy',
    'transactionNo',
    'credit',
    'debit',
    'balance',
  ]
  const body = rows.map(r => [
    r.pettyCashOwner,
    r.date,
    r.time,
    r.customerSupplier,
    r.customerSupplierNo,
    r.invoiceNo,
    r.department,
    r.transactionType,
    r.transBy,
    r.transactionNo,
    r.credit,
    r.debit,
    r.balance,
  ])
  return [headers, ...body].map(arr => arr.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Finance_CollectionReport() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [from, setFrom] = useState<string>('2026-01-01')
  const [to, setTo] = useState<string>(today)
  const [timeFrom, setTimeFrom] = useState<string>('')
  const [timeTo, setTimeTo] = useState<string>('')
  const [q, setQ] = useState<string>('')
  const [department, setDepartment] = useState<'All' | 'OPD' | 'Diagnostics' | 'Pharmacy' | 'Therapy' | 'Counselling' | 'Finance'>('All')
  const [reportType, setReportType] = useState<'Detailed' | 'Closing Balances' | 'Opening Balances'>('Detailed')
  const [rowsPerPage, setRowsPerPage] = useState<number>(50)
  const [tick, setTick] = useState(0)
  const [all, setAll] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listCollectionReport({ department, reportType, from, to, timeFrom, timeTo, limit: 5000 })
        const items: Row[] = Array.isArray(res?.items) ? res.items : []
        if (!cancelled) setAll(items)
      } catch {
        if (!cancelled) setAll([])
      }
    })()
    return () => { cancelled = true }
  }, [from, to, timeFrom, timeTo, department, reportType, tick])

  const filtered = useMemo(() => {
    if (!q) return all
    const needle = q.toLowerCase()
    return all.filter(r => {
      const hay = `${r.pettyCashOwner} ${r.date} ${r.time} ${r.customerSupplier} ${r.customerSupplierNo} ${r.invoiceNo} ${r.department} ${r.transactionType} ${r.transBy} ${r.transactionNo}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [all, q])

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `collection_report_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">Collection Report</div>
          <div className="text-sm text-slate-500">Petty cash collections, payments, and balances</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTick(t => t + 1)} className="btn-outline-navy">Refresh</button>
          <button onClick={exportCsv} className="btn-outline-navy">Export CSV</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-7">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option>OPD</option>
              <option>Diagnostics</option>
              <option>Pharmacy</option>
              <option>Therapy</option>
              <option>Counselling</option>
              <option>Finance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Detailed</option>
              <option>Opening Balances</option>
              <option>Closing Balances</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From Time</label>
            <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To Time</label>
            <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Rows</label>
            <select value={rowsPerPage} onChange={e => setRowsPerPage(parseInt(e.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid items-end gap-3 md:grid-cols-7">
          <div className="md:col-span-4">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="owner, customer, invoice, txn..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-3" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800">Report</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">Petty Cash Owner</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Customer/Supplier</th>
                <th className="px-4 py-2 font-medium">Customer#/Supplier#</th>
                <th className="px-4 py-2 font-medium">Invoice#</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Transaction Type</th>
                <th className="px-4 py-2 font-medium">Trans. By</th>
                <th className="px-4 py-2 font-medium">Transaction#</th>
                <th className="px-4 py-2 font-medium text-right">Credit(Received)</th>
                <th className="px-4 py-2 font-medium text-right">Debit(Paid)</th>
                <th className="px-4 py-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.slice(0, rowsPerPage).map((r, idx) => (
                <tr key={`${r.transactionNo}-${idx}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">{r.pettyCashOwner}</td>
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2">{r.time}</td>
                  <td className="px-4 py-2">{r.customerSupplier}</td>
                  <td className="px-4 py-2">{r.customerSupplierNo}</td>
                  <td className="px-4 py-2">{r.invoiceNo}</td>
                  <td className="px-4 py-2">{r.department}</td>
                  <td className="px-4 py-2">{r.transactionType}</td>
                  <td className="px-4 py-2">{r.transBy}</td>
                  <td className="px-4 py-2 font-mono">{r.transactionNo}</td>
                  <td className="px-4 py-2 text-right">{Number(r.credit || 0) ? `Rs ${Number(r.credit).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-2 text-right">{Number(r.debit || 0) ? `Rs ${Number(r.debit).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-2 text-right">Rs {Number(r.balance || 0).toFixed(2)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">No report rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div>Showing {Math.min(rowsPerPage, filtered.length)} of {filtered.length}</div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">Prev</button>
            <button className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
