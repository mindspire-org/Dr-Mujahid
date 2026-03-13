import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

 type ExpenseTxn = {
  id: string
  datetime: string // ISO date or datetime
  type: 'Expense'
  category: 'Rent' | 'Utilities' | 'Supplies' | 'Salaries' | 'Maintenance' | 'Other'
  description: string
  amount: number
  method?: 'cash' | 'bank' | 'card'
  ref?: string
  module?: string
  department?: string
  staff?: string
  fromAccountCode?: string
  status?: 'draft'|'submitted'|'approved'|'rejected'
  rejectionReason?: string
}

// Fetch from backend only

function toCsv(rows: ExpenseTxn[]) {
  const headers = ['datetime','department','staff','category','description','method','ref','amount']
  const body = rows.map(r => [r.datetime, r.department ?? '', r.staff ?? '', r.category, r.description, r.method ?? '', r.ref ?? '', r.amount])
  return [headers, ...body].map(arr => arr.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Finance_ExpenseHistory() {
  const location = useLocation()
  const base = location.pathname.startsWith('/hospital/') ? '/hospital/finance' : '/finance'
  const [deptList, setDeptList] = useState<Array<{ id: string; name: string }>>([])
  const [all, setAll] = useState<ExpenseTxn[]>([])
  const [actionOpen, setActionOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve'|'reject'>('approve')
  const [actionExpenseId, setActionExpenseId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dept, setDept] = useState<'All' | string>('All')
  const [cat, setCat] = useState<'All' | ExpenseTxn['category']>('All')
  const [method, setMethod] = useState<'All' | NonNullable<ExpenseTxn['method']>>('All')
  const [status, setStatus] = useState<'All'|'draft'|'submitted'|'approved'|'rejected'>('All')
  const [q, setQ] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [tick, setTick] = useState(0)

  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const [toastKind, setToastKind] = useState<'success'|'error'>('success')
  const toastTimerRef = useRef<number | null>(null)

  const showToast = (msg: string, kind: 'success'|'error' = 'success') => {
    setToastMsg(msg)
    setToastKind(kind)
    setToastOpen(true)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false)
    }, 2500)
  }

  const role = useMemo(() => {
    try {
      const raw = base.startsWith('/hospital') ? localStorage.getItem('hospital.session') : localStorage.getItem('finance.session')
      const s = raw ? JSON.parse(raw) : null
      return String(s?.role || '')
    } catch { return '' }
  }, [base])
  const canApprove = /^admin$/i.test(role) || /^finance$/i.test(role)

  const toUserMessage = (err: any) => {
    const raw = (typeof err === 'string' ? err : (err?.message || err?.error || '')).toString()
    const trimmed = raw.trim()
    let msg = trimmed
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const j = JSON.parse(trimmed)
        if (j?.error) msg = String(j.error)
        else if (j?.message) msg = String(j.message)
      } catch {
        msg = trimmed
      }
    }

    const lower = msg.toLowerCase()
    if (lower.includes('insufficient') && lower.includes('balance')) {
      return 'Insufficient balance in the selected account. Please choose another account or refill it.'
    }
    if (lower.includes('forbidden')) {
      return 'You do not have permission to perform this action.'
    }
    if (!msg) return 'Something went wrong. Please try again.'
    return msg
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listExpenses({ from: from || '1900-01-01', to: to || '2100-01-01', status: status === 'All' ? 'all' : status })
        const list: Array<any> = Array.isArray(res?.expenses) ? res.expenses : []
        const depMap: Record<string,string> = Object.fromEntries((deptList||[]).map(d => [d.id, d.name]))
        const rows: ExpenseTxn[] = list.map(r => ({
          id: String(r._id || r.id),
          datetime: r.createdAt ? String(r.createdAt) : `${r.dateIso || ''}T00:00:00`,
          type: 'Expense',
          category: r.category as any,
          description: String(r.note || ''),
          amount: Number(r.amount) || 0,
          method: (r.method ? String(r.method) : undefined) as any,
          ref: r.ref ? String(r.ref) : undefined,
          module: 'Hospital',
          department: depMap[String(r.departmentId || '')] || String(r.departmentId || '') || '-',
          staff: r.receiverLabel ? String(r.receiverLabel) : '-',
          fromAccountCode: r.fromAccountCode ? String(r.fromAccountCode) : undefined,
          status: (r.status ? String(r.status) : 'approved') as any,
          rejectionReason: r.rejectionReason ? String(r.rejectionReason) : undefined,
        }))
        if (!cancelled) setAll(rows)
      } catch {
        if (!cancelled) setAll([])
      }
    })()
    return () => { cancelled = true }
  }, [from, to, tick, deptList, status])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listDepartments()
        const list: Array<{ id: string; name: string }> = (res?.departments || res || []).map((d: any) => ({ id: String(d._id || d.id), name: d.name }))
        if (!cancelled) setDeptList(list)
      } catch {
        if (!cancelled) setDeptList([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(new Date(to).getTime() + 24*60*60*1000 - 1) : null
    return all.filter(r => {
      if (fromDate && new Date(r.datetime) < fromDate) return false
      if (toDate && new Date(r.datetime) > toDate) return false
      if (dept !== 'All' && (r.department ?? '') !== dept) return false
      if (cat !== 'All' && r.category !== cat) return false
      if (method !== 'All' && (r.method ?? '') !== method) return false
      if (q) {
        const hay = `${r.description} ${r.ref ?? ''} ${r.department ?? ''} ${r.staff ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [all, from, to, dept, cat, method, q])

  const total = useMemo(() => filtered.reduce((sum, r) => sum + (r.amount || 0), 0), [filtered])
  const approvedTotal = useMemo(() => filtered.reduce((sum, r) => sum + ((r.status || 'approved') === 'approved' ? (r.amount || 0) : 0), 0), [filtered])

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const departmentNames = deptList.map(d => d.name)

  return (
    <div className="w-full px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">Expense History</div>
          <div className="text-sm text-slate-500">Department-wise expense records</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setTick(t=>t+1)} className="btn-outline-navy">Refresh</button>
          <button onClick={exportCsv} className="btn-outline-navy">Export CSV</button>
          <Link to={`${base}/add-expense`} className="btn">+ Add Expense</Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-8">
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Department</label>
            <select value={dept} onChange={e=>setDept(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-w-[180px]">
              <option>All</option>
              {departmentNames.map(d => (<option key={d}>{d}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Category</label>
            <select value={cat} onChange={e=>setCat(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option>Rent</option>
              <option>Utilities</option>
              <option>Supplies</option>
              <option>Salaries</option>
              <option>Maintenance</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Method</label>
            <select value={method} onChange={e=>setMethod(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option>cash</option>
              <option>bank</option>
              <option>card</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option value="draft">draft</option>
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="description, ref, dept" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Staff</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">From (Account)</th>
                <th className="px-4 py-2 font-medium">Ref</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.slice(0, rowsPerPage).map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">{new Date(r.datetime).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.department || '-'}</td>
                  <td className="px-4 py-2">{r.staff || '-'}</td>
                  <td className="px-4 py-2">{r.category}</td>
                  <td className="px-4 py-2">{r.description}</td>
                  <td className="px-4 py-2">{r.method || '-'}</td>
                  <td className="px-4 py-2 font-mono">{r.fromAccountCode || '-'}</td>
                  <td className="px-4 py-2">{r.ref || '-'}</td>
                  <td className="px-4 py-2">
                    <div className="leading-tight">
                      <div className="capitalize">{r.status || 'approved'}</div>
                      {r.status === 'rejected' && r.rejectionReason && (
                        <div className="text-xs text-rose-600">{r.rejectionReason}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">Rs {r.amount.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {(r.status === 'draft' || r.status === 'submitted') && canApprove && (
                        <>
                          <button
                            className="btn"
                            onClick={async()=>{
                              setActionError('')
                              setRejectReason('')
                              setActionExpenseId(String(r.id))
                              setActionType('approve')
                              setActionOpen(true)
                            }}
                          >Approve</button>
                          <button
                            className="btn-outline-navy"
                            onClick={async()=>{
                              setActionError('')
                              setRejectReason('')
                              setActionExpenseId(String(r.id))
                              setActionType('reject')
                              setActionOpen(true)
                            }}
                          >Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">No expenses</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div>Showing {Math.min(rowsPerPage, filtered.length)} of {filtered.length}</div>
          <div className="font-medium">{status === 'All' ? `Total (Approved): Rs ${approvedTotal.toFixed(2)}` : `Total: Rs ${total.toFixed(2)}`}</div>
        </div>
      </div>

      {actionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!actionLoading) setActionOpen(false) }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">{actionType === 'approve' ? 'Approve Expense' : 'Reject Expense'}</div>
              <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => { if (!actionLoading) setActionOpen(false) }} aria-label="Close">✕</button>
            </div>

            {actionType === 'reject' && (
              <div className="mt-3">
                <label className="mb-1 block text-sm text-slate-700">Rejection reason</label>
                <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} />
              </div>
            )}

            {actionError && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={actionLoading} onClick={() => setActionOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn"
                disabled={actionLoading || !actionExpenseId || (actionType === 'reject' && !rejectReason.trim())}
                onClick={async()=>{
                  if (!actionExpenseId) return
                  setActionLoading(true)
                  setActionError('')
                  try {
                    if (actionType === 'approve') {
                      await hospitalApi.approveExpense(actionExpenseId)
                      showToast('Expense approved successfully', 'success')
                    } else {
                      await hospitalApi.rejectExpense(actionExpenseId, rejectReason.trim())
                      showToast('Expense rejected successfully', 'success')
                    }
                    setActionOpen(false)
                    setTick(t=>t+1)
                  } catch (e: any) {
                    const msg = toUserMessage(e)
                    setActionError(msg)
                    showToast(msg, 'error')
                  } finally {
                    setActionLoading(false)
                  }
                }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {toastOpen && (
        <div className="fixed bottom-4 right-4 z-[60]">
          <div className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${toastKind === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
            {toastMsg}
          </div>
        </div>
      )}
    </div>
  )
}
