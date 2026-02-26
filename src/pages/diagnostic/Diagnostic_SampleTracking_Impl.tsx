import { useEffect, useMemo, useState } from 'react'
import { diagnosticApi, hospitalApi } from '../../utils/api'
import Diagnostic_TokenSlip from '../../components/diagnostic/Diagnostic_TokenSlip'
import Diagnostic_EditSampleDialog from '../../components/diagnostic/Diagnostic_EditSampleDialog'
import type { DiagnosticTokenSlipData } from '../../components/diagnostic/Diagnostic_TokenSlip'
import { Eye, Pencil, Printer, Trash2, X } from 'lucide-react'

type Order = {
  id: string
  createdAt: string
  patient: { mrn?: string; fullName: string; phone?: string; cnic?: string; guardianName?: string }
  tests: string[]
  // per-test tracking items
  items?: Array<{ testId: string; status: 'received' | 'completed'; sampleTime?: string; reportingTime?: string }>
  status: 'received' | 'completed'
  tokenNo?: string
  sampleTime?: string
  subtotal?: number
  discount?: number
  net?: number
  duesBefore?: number
  advanceBefore?: number
  payPreviousDues?: boolean
  useAdvance?: boolean
  advanceApplied?: number
  amountReceived?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
  paymentStatus?: 'paid' | 'unpaid'
  receptionistName?: string
  paymentMethod?: string
  accountNumberIban?: string
  receivedToAccountCode?: string
}

type Test = { id: string; name: string; price?: number }

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString()
}

function abbreviateTestName(name: string) {
  const raw = String(name || '').trim()
  if (!raw || raw === '—' || raw === '-') return raw || '—'
  // If already looks like an abbreviation/code (no spaces and short), keep it.
  if (!raw.includes(' ') && raw.length <= 6) return raw.toUpperCase()
  const stop = new Set(['and', 'of', 'the', 'for', 'with', 'in', 'to', 'a', 'an'])
  const parts = raw
    .split(/[^A-Za-z0-9]+/g)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !stop.has(s.toLowerCase()))
  const abbr = parts.map(p => p[0]).join('').toUpperCase()
  return abbr ? abbr.slice(0, 3) : raw.toUpperCase().slice(0, 3)
}

export default function Diagnostic_SampleTracking() {
  // tests map
  const [tests, setTests] = useState<Test[]>([])
  useEffect(() => {
    (async () => {
      try { const res = await diagnosticApi.listTests({ limit: 1000 }) as any; setTests((res?.items || res || []).map((t: any) => ({ id: String(t._id || t.id), name: t.name, price: Number(t.price || 0) }))) } catch { setTests([]) }
    })()
  }, [])
  const testsMap = useMemo(() => Object.fromEntries(tests.map(t => [t.id, t.name])), [tests])
  const testsPrice = useMemo(() => Object.fromEntries(tests.map(t => [t.id, Number(t.price || 0)])), [tests])

  // filters
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'all' | 'received' | 'completed'>('all')
  const [rows, setRows] = useState(20)
  const [page, setPage] = useState(1)

  // data
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [notice, setNotice] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)

  useEffect(() => {
    let mounted = true; (async () => {
      try {
        // Don't filter by order.status at the API level because completion is tracked per-test (items[].status)
        // and order.status becomes 'completed' only when all items are completed.
        const res = await diagnosticApi.listOrders({ q: q || undefined, from: from || undefined, to: to || undefined, status: undefined as any, page, limit: rows }) as any
        const items: Order[] = (res.items || []).map((x: any) => ({
          id: String(x._id),
          createdAt: x.createdAt || new Date().toISOString(),
          patient: x.patient || { fullName: '-', phone: '' },
          tests: x.tests || [],
          items: (x.items || []).map((it: any) => ({
            testId: String(it?.testId || ''),
            status: (String(it?.status || 'received').toLowerCase() === 'completed' ? 'completed' : 'received') as any,
            sampleTime: it?.sampleTime,
            reportingTime: it?.reportingTime,
          })),
          status: (String(x.status || 'received').toLowerCase() === 'completed' ? 'completed' : 'received') as any,
          tokenNo: x.tokenNo,
          sampleTime: x.sampleTime,
          subtotal: Number(x.subtotal || 0),
          discount: Number(x.discount || 0),
          net: Number(x.net || 0),
          duesBefore: (x.duesBefore != null) ? Number(x.duesBefore || 0) : undefined,
          advanceBefore: (x.advanceBefore != null) ? Number(x.advanceBefore || 0) : undefined,
          payPreviousDues: (x.payPreviousDues != null) ? !!x.payPreviousDues : undefined,
          useAdvance: (x.useAdvance != null) ? !!x.useAdvance : undefined,
          advanceApplied: (x.advanceApplied != null) ? Number(x.advanceApplied || 0) : undefined,
          amountReceived: (x.amountReceived != null) ? Number(x.amountReceived || 0) : undefined,
          duesPaid: (x.duesPaid != null) ? Number(x.duesPaid || 0) : undefined,
          paidForToday: (x.paidForToday != null) ? Number(x.paidForToday || 0) : undefined,
          advanceAdded: (x.advanceAdded != null) ? Number(x.advanceAdded || 0) : undefined,
          duesAfter: (x.duesAfter != null) ? Number(x.duesAfter || 0) : undefined,
          advanceAfter: (x.advanceAfter != null) ? Number(x.advanceAfter || 0) : undefined,
          paymentStatus: (x.paymentStatus || 'paid') as any,
          receptionistName: x.receptionistName || '',
          paymentMethod: x.paymentMethod || '',
          accountNumberIban: x.accountNumberIban || '',
          receivedToAccountCode: x.receivedToAccountCode || '',
        }))
        if (mounted) { setOrders(items); setTotal(Number(res.total || items.length || 0)); setTotalPages(Number(res.totalPages || 1)) }
      } catch (e) { if (mounted) { setOrders([]); setTotal(0); setTotalPages(1) } }
    })(); return () => { mounted = false }
  }, [q, from, to, status, page, rows])

  const pageCount = Math.max(1, totalPages)
  const curPage = Math.min(page, pageCount)
  const start = Math.min((curPage - 1) * rows + 1, total)
  const end = Math.min((curPage - 1) * rows + orders.length, total)

  // Per-test update handlers
  const setSampleTimeForItem = async (orderId: string, testId: string, t: string) => {
    try { await diagnosticApi.updateOrderItemTrack(orderId, testId, { sampleTime: t }) } catch { }
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const items = (o.items || [])
      const idx = items.findIndex(i => i.testId === testId)
      if (idx >= 0) { const copy = items.slice(); copy[idx] = { ...copy[idx], sampleTime: t }; return { ...o, items: copy } }
      return { ...o, items: [...(o.items || []), { testId, status: 'received', sampleTime: t }] }
    }))
  }
  const setStatusForItem = async (orderId: string, testId: string, s: 'received' | 'completed') => {
    try { await diagnosticApi.updateOrderItemTrack(orderId, testId, { status: s }) } catch { }
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const items = (o.items || [])
      const idx = items.findIndex(i => i.testId === testId)
      if (idx >= 0) { const copy = items.slice(); copy[idx] = { ...copy[idx], status: s }; return { ...o, items: copy } }
      return { ...o, items: [...(o.items || []), { testId, status: s }] }
    }))
  }
  const requestDeleteItem = async (orderId: string, testId: string) => {
    if (!confirm('Delete this test from the order?')) return
    try {
      const res = await diagnosticApi.deleteOrderItem(orderId, testId) as any
      if (res?.deletedOrder) {
        setOrders(prev => prev.filter(o => o.id !== orderId))
      } else if (res?.order) {
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          tests: (res.order.tests || []),
          items: (res.order.items || []),
          status: res.order.status || o.status,
        } : o))
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, tests: o.tests.filter(t => t !== testId), items: (o.items || []).filter(i => i.testId !== testId) } : o))
      }
      setNotice({ text: 'Test deleted', kind: 'success' })
    }
    catch { setNotice({ text: 'Failed to delete', kind: 'error' }) }
    finally { try { setTimeout(() => setNotice(null), 2500) } catch { } }
  }

  // Print Slip
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<DiagnosticTokenSlipData | null>(null)
  const [slipAutoPrint, setSlipAutoPrint] = useState(false)

  // Details dialog (Eye)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null)

  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const [bankRes, pettyRes] = await Promise.all([
            hospitalApi.listBankAccounts(),
            hospitalApi.listPettyCashAccounts(),
          ]) as any
          let mineRes: any = null
          try { mineRes = await hospitalApi.myPettyCash() as any } catch { mineRes = null }

          const opts: Array<{ code: string; label: string }> = []
          const seen = new Set<string>()
          const add = (code?: string, label?: string) => {
            const c = String(code || '').trim().toUpperCase()
            if (!c) return
            if (seen.has(c)) return
            seen.add(c)
            opts.push({ code: c, label: String(label || c) })
          }

          const myCode = String(mineRes?.account?.code || '').trim().toUpperCase()
          if (myCode) {
            add(myCode, `${mineRes?.account?.name || 'My Petty Cash'} (${myCode})`)
          }

          const petty: any[] = pettyRes?.accounts || []
          for (const p of petty) {
            const code = String(p?.code || '').trim().toUpperCase()
            if (!code) continue
            const rs = String(p?.responsibleStaff || '').trim()
            if (rs) continue
            if (String(p?.status || 'Active') !== 'Active') continue
            add(code, `${String(p?.name || code).trim()} (${code})`)
          }

          const banks: any[] = bankRes?.accounts || []
          for (const b of banks) {
            const an = String(b?.accountNumber || '')
            const last4 = an ? an.slice(-4) : ''
            const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
            if (!code) continue
            const bankLabel = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}${last4 ? ` (${last4})` : ''}`.trim()
            add(code, bankLabel ? `${bankLabel} (${code})` : code)
          }

          if (mounted) setPayToAccounts(opts)
        } catch {
          if (mounted) setPayToAccounts([])
        }
      })()
    return () => { mounted = false }
  }, [])
  // Edit Sample Dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<{ id: string; patient: any; tests: string[] } | null>(null)
  function openEdit(o: Order) { setEditOrder({ id: o.id, patient: o.patient, tests: o.tests }); setEditOpen(true) }
  function onEditSaved(updated: any) {
    const id = String(updated?._id || updated?.id || (editOrder && editOrder.id))
    if (!id) { setEditOpen(false); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, patient: updated.patient || o.patient, tests: updated.tests || o.tests, tokenNo: updated.tokenNo || o.tokenNo, createdAt: updated.createdAt || o.createdAt } : o))
    setEditOpen(false)
  }
  const buildSlipData = (o: Order) => {
    const rows = o.tests.map(tid => ({ name: testsMap[tid] || tid, price: Number(testsPrice[tid] || 0) }))
    const computedSubtotal = rows.reduce((s, r) => s + Number(r.price || 0), 0)
    const subtotal = (o.subtotal != null && !Number.isNaN(o.subtotal)) ? Number(o.subtotal) : computedSubtotal
    const discount = (o.discount != null && !Number.isNaN(o.discount)) ? Number(o.discount) : 0
    const payable = (o.net != null && !Number.isNaN(o.net)) ? Number(o.net) : Math.max(0, subtotal - discount)
    const data: DiagnosticTokenSlipData = {
      tokenNo: o.tokenNo || '-',
      patientName: o.patient.fullName,
      phone: o.patient.phone || '',
      age: (o as any)?.patient?.age ? String((o as any).patient.age) : undefined,
      gender: (o as any)?.patient?.gender ? String((o as any).patient.gender) : undefined,
      mrn: o.patient.mrn || undefined,
      guardianRel: undefined,
      guardianName: o.patient.guardianName || undefined,
      cnic: (o as any)?.patient?.cnic || o.patient.cnic || undefined,
      address: (o as any)?.patient?.address || undefined,
      tests: rows,
      subtotal,
      discount,
      payable,
      paymentStatus: o.paymentStatus,
      amountReceived: o.amountReceived,
      payPreviousDues: o.payPreviousDues,
      useAdvance: o.useAdvance,
      advanceApplied: o.advanceApplied,
      duesBefore: o.duesBefore,
      advanceBefore: o.advanceBefore,
      duesPaid: o.duesPaid,
      paidForToday: o.paidForToday,
      advanceAdded: o.advanceAdded,
      duesAfter: o.duesAfter,
      advanceAfter: o.advanceAfter,
      receptionistName: o.receptionistName,
      receivedToAccountCode: String(o.receivedToAccountCode || '') || undefined,
      paymentMethod: o.paymentMethod,
      accountNumberIban: o.accountNumberIban,
      createdAt: o.createdAt,
    }
    return data
  }


  const openSlip = (o: Order, autoPrint: boolean) => {
    setSlipAutoPrint(autoPrint)
    setSlipData(buildSlipData(o))
    setSlipOpen(true)
  }

  const openDetails = (o: Order) => {
    setDetailsOrder(o)
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="text-xl sm:text-2xl font-bold text-slate-900">Sample Management</div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-md">
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search by token, patient, or test..." className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 whitespace-nowrap">From</span>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1.5 focus:border-violet-500" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 whitespace-nowrap">To</span>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1.5 focus:border-violet-500" />
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
              <button onClick={() => setStatus('all')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${status === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>All</button>
              <button onClick={() => setStatus('received')} className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${status === 'received' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Received</button>
              <button onClick={() => setStatus('completed')} className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${status === 'completed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Completed</button>
            </div>
            <div className="flex items-center gap-2 text-sm ml-auto sm:ml-0">
              <span className="text-slate-500">Rows</span>
              <select value={rows} onChange={e => { setRows(Number(e.target.value)); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1.5 focus:border-violet-500">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
        {notice && (
          <div className={`mt-4 rounded-md border px-3 py-2.5 text-sm font-medium ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.text}</div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">DateTime</th>
              <th className="px-4 py-3 font-semibold">Patient</th>
              <th className="px-4 py-3 font-semibold">Token No</th>
              <th className="px-4 py-3 font-semibold">Test(s)</th>
              <th className="px-4 py-3 font-semibold">MR No</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Payment Status</th>
              <th className="px-4 py-3 font-semibold">Sample Time</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.reduce((acc: any[], o) => {
              const token = o.tokenNo || '-'
              o.tests.forEach((tid, idx) => {
                const tname = testsMap[tid] || '—'
                const tabbr = abbreviateTestName(tname)
                const item = (o.items || []).find(i => i.testId === tid)
                const rowStatus = (item?.status || o.status) as any
                const sampleTime = item?.sampleTime || o.sampleTime || ''
                acc.push(
                  <tr key={`${o.id}-${tid}-${idx}`} className="border-b border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="leading-tight">
                        <div>{formatDate(o.createdAt)}</div>
                        <div className="text-xs text-slate-500">{formatTime(o.createdAt)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{o.patient.fullName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{token}</td>
                    <td className="px-4 py-2 whitespace-nowrap" title={tname}>{tabbr}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{o.patient.mrn || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{o.patient.phone || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${String(o.paymentStatus || 'paid').toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                          {String(o.paymentStatus || 'paid').toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input type="time" value={sampleTime} onChange={e => setSampleTimeForItem(o.id, String(tid), e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <select value={rowStatus === 'completed' ? 'completed' : 'received'} onChange={e => setStatusForItem(o.id, String(tid), e.target.value as any)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                        <option value="received">received</option>
                        <option value="completed">completed</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetails(o)}
                          title="View details"
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openSlip(o, true)}
                          title="Print Slip"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Printer className="h-4 w-4" />
                          <span className="hidden sm:inline">Print Slip</span>
                        </button>
                        <button
                          onClick={() => openEdit(o)}
                          title="Edit sample"
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => requestDeleteItem(o.id, String(tid))}
                          title="Delete test"
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
              return acc
            }, [] as any[])}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No samples found</div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>{total === 0 ? '0' : `${start}-${end}`} of {total}</div>
        <div className="flex items-center gap-2">
          <button disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Prev</button>
          <span>{curPage} / {pageCount}</span>
          <button disabled={curPage >= pageCount} onClick={() => setPage(p => p + 1)} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>

      {slipOpen && slipData && (
        <Diagnostic_TokenSlip open={slipOpen} onClose={() => setSlipOpen(false)} data={slipData} autoPrint={slipAutoPrint} />
      )}
      {detailsOpen && detailsOrder && (
        <SampleDetailsDialog
          open={detailsOpen}
          onClose={() => { setDetailsOpen(false); setDetailsOrder(null) }}
          order={detailsOrder}
          testsMap={testsMap}
          testsPrice={testsPrice}
          payToAccounts={payToAccounts}
        />
      )}
      {editOpen && editOrder && (
        <Diagnostic_EditSampleDialog
          open={editOpen}
          onClose={() => { setEditOpen(false); setEditOrder(null) }}
          order={editOrder}
          onSaved={onEditSaved}
        />
      )}
    </div>
  )
}

function SampleDetailsDialog({ open, onClose, order, testsMap, testsPrice, payToAccounts }: {
  open: boolean
  onClose: () => void
  order: Order
  testsMap: Record<string, string>
  testsPrice: Record<string, number>
  payToAccounts: Array<{ code: string; label: string }>
}) {
  if (!open) return null

  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : ''
  const patient = order.patient || ({} as any)

  const patientName = String(patient.fullName || '-')
  const mrn = String(patient.mrn || '-')
  const phone = String(patient.phone || '-')
  const cnic = String(patient.cnic || '-')
  const guardian = String(patient.guardianName || '-')

  const tests = (order.tests || []).map(tid => ({ id: String(tid), name: testsMap[String(tid)] || String(tid), price: Number(testsPrice[String(tid)] || 0) }))
  const computedSubtotal = tests.reduce((s, t) => s + Number(t.price || 0), 0)
  const subtotal = (order.subtotal != null && !Number.isNaN(order.subtotal)) ? Number(order.subtotal) : computedSubtotal
  const discount = (order.discount != null && !Number.isNaN(order.discount)) ? Number(order.discount) : 0
  const payable = (order.net != null && !Number.isNaN(order.net)) ? Number(order.net) : Math.max(0, subtotal - discount)

  const paymentStatus = String(order.paymentStatus || 'paid')
  const isPaid = paymentStatus.toLowerCase() === 'paid'
  const receivedToAccountCode = String(order.receivedToAccountCode || '')
  const payedToName = (() => {
    const code = String(receivedToAccountCode || '').trim().toUpperCase()
    if (!code) return String(order.receptionistName || '-')
    const label = payToAccounts.find(x => x.code === code)?.label || ''
    if (label) return String(label).split('(')[0].trim() || label
    return String(order.receptionistName || code || '-')
  })()

  const amountReceived = Math.max(0, Number(order.amountReceived || 0))
  const paidForToday = Math.max(0, Number(order.paidForToday || 0))
  const advanceApplied = Math.max(0, Number(order.advanceApplied || 0))
  const paidToday = isPaid ? Math.min(payable, paidForToday + advanceApplied) : 0
  const remaining = Math.max(0, payable - paidToday)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-5 sm:px-4 sm:py-8" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-full overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Token Details</h3>
            <div className="mt-0.5 text-xs text-slate-500">Token #{order.tokenNo || '-'} • {createdAt}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-800">Patient Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Patient Name" value={patientName} />
              <Info label="MR Number" value={mrn} />
              <Info label="Phone" value={phone} />
              <Info label="Guardian" value={guardian} />
              <Info label="CNIC" value={cnic} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Test Details</h4>
            <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-200">
                {tests.length ? tests.map((t, i) => (
                  <div key={`${t.id}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="text-slate-800">{t.name}</div>
                    <div className="text-slate-700">PKR {Number(t.price || 0).toLocaleString()}</div>
                  </div>
                )) : (
                  <div className="px-3 py-2 text-sm text-slate-500">No tests</div>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Subtotal" value={`PKR ${subtotal.toLocaleString()}`} />
              <Info label="Discount" value={`PKR ${discount.toLocaleString()}`} />
              <Info label="Payable" value={`PKR ${payable.toLocaleString()}`} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Token Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Status" value={String(order.status || '-')} />
              <Info label="Token No" value={String(order.tokenNo || '-')} />
              <Info label="Sample Time" value={String(order.sampleTime || '-')} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Payment Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Payment Status" value={paymentStatus.toUpperCase()} />
              <Info label="Payed to" value={payedToName || '-'} />
              {isPaid && <Info label="Payment Method" value={String(order.paymentMethod || '-')} />}
              {isPaid && String(order.paymentMethod || '') === 'Card' && <Info label="Account Number/IBAN" value={String(order.accountNumberIban || '-')} />}
              <Info label="Received Now" value={`PKR ${amountReceived.toLocaleString()}`} />
              <Info label="Paid" value={`PKR ${paidToday.toLocaleString()}`} />
              <Info label="Remaining" value={`PKR ${remaining.toLocaleString()}`} />
              {order.advanceAfter != null && <Info label="Advance After" value={`PKR ${Math.max(0, Number(order.advanceAfter || 0)).toLocaleString()}`} />}
              {order.duesAfter != null && <Info label="Dues After" value={`PKR ${Math.max(0, Number(order.duesAfter || 0)).toLocaleString()}`} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} rounded-lg border border-slate-200 bg-slate-50 px-3 py-2`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800 break-words">{value || '-'}</div>
    </div>
  )
}
