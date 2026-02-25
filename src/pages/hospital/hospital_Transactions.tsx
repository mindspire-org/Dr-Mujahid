import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

 type Txn = {
  id: string
  datetime: string // ISO
  type: 'OPD' | 'IPD' | 'Charge' | 'Expense'
  description: string
  staff?: string
  transBy?: string
  supplierName?: string
  invoiceNo?: string
  fee?: number
  discount?: number
  amount: number
  method?: 'cash' | 'bank' | 'card'
  ref?: string
  module?: string
}

function toCsv(rows: Txn[]) {
  const headers = ['id','datetime','type','module','staff','description','fee','discount','amount','method','ref']
  const body = rows.map(r => [
    r.id,
    r.datetime,
    r.type,
    r.module ?? '',
    r.staff ?? '',
    r.description,
    r.fee ?? '',
    r.discount ?? '',
    r.amount,
    r.method ?? '',
    r.ref ?? '',
  ])
  return [headers, ...body].map(arr => arr.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Finance_Transactions() {
  const location = useLocation()
  const base = location.pathname.startsWith('/hospital/') ? '/hospital/finance' : '/finance'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [ttype, setTtype] = useState<'All' | Txn['type']>('All')
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [tick, setTick] = useState(0)
  const [all, setAll] = useState<Txn[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listFinanceTransactions({ from: from || '1900-01-01', to: to || '2100-01-01', limit: 5000 })
        const combined: Txn[] = (res?.items || []).map((x: any) => ({
          id: String(x.id || x._id),
          datetime: String(x.datetime || x.createdAt || ''),
          type: x.type,
          description: String(x.description || ''),
          staff: x.staff ? String(x.staff) : undefined,
          fee: x.fee != null ? Number(x.fee) : undefined,
          discount: x.discount != null ? Number(x.discount) : undefined,
          amount: Number(x.amount || 0),
          method: x.method,
          ref: x.ref,
          module: x.module,
        }))
        if (!cancelled) setAll(combined)
      } catch {
        if (!cancelled) setAll([])
      }
    })()
    return () => { cancelled = true }
  }, [from, to, tick])
  const filtered = useMemo(() => {
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null
    return all.filter(r => {
      if (ttype !== 'All' && r.type !== ttype) return false
      if (fromDate && new Date(r.datetime) < fromDate) return false
      if (toDate && new Date(r.datetime) > new Date(new Date(to).getTime() + 24*60*60*1000 - 1)) return false
      if (q) {
        const hay = `${r.description} ${r.staff ?? ''} ${r.transBy ?? ''} ${r.supplierName ?? ''} ${r.invoiceNo ?? ''} ${r.ref ?? ''} ${r.module ?? ''} ${r.fee ?? ''} ${r.discount ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [all, from, to, q, ttype])

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">Transactions</div>
          <div className="text-sm text-slate-500">OPD, IPD, Charges, and Expenses</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setTick(t=>t+1)} className="btn-outline-navy">Refresh</button>
          <button onClick={exportCsv} className="btn-outline-navy">Export CSV</button>
          <Link to={`${base}/add-expense`} className="btn">+ Add Expense</Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-7">
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Type</label>
            <select value={ttype} onChange={e=>setTtype(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option>OPD</option>
              <option>IPD</option>
              <option>Charge</option>
              <option>Expense</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="description, ref, module" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Rows</label>
            <select value={rowsPerPage} onChange={e=>setRowsPerPage(parseInt(e.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800">Results</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">Date/Time</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Module</th>
                <th className="px-4 py-2 font-medium">Staff</th>
                <th className="px-4 py-2 font-medium">Transacted By</th>
                <th className="px-4 py-2 font-medium">Supplier Name</th>
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Fee</th>
                <th className="px-4 py-2 font-medium">Discount</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Ref</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.slice(0, rowsPerPage).map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">{new Date(r.datetime).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.type}</td>
                  <td className="px-4 py-2">{r.module || '-'}</td>
                  <td className="px-4 py-2">{r.staff || '-'}</td>
                  <td className="px-4 py-2">{r.transBy || '-'}</td>
                  <td className="px-4 py-2">{r.supplierName || '-'}</td>
                  <td className="px-4 py-2">{r.invoiceNo || '-'}</td>
                  <td className="px-4 py-2">{r.description}</td>
                  <td className="px-4 py-2">{r.type === 'OPD' ? `Rs ${Number(r.fee || 0).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-2">{r.type === 'OPD' ? `Rs ${Number(r.discount || 0).toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-2">{r.method || '-'}</td>
                  <td className="px-4 py-2">{r.ref || '-'}</td>
                  <td className="px-4 py-2">Rs {r.amount.toFixed(2)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">No transactions</td>
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
