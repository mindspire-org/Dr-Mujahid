import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { diagnosticApi } from '../../utils/api'
import { DiagnosticFormRegistry } from '../../components/diagnostic/registry'
import type { ReportRendererProps } from '../../components/diagnostic/registry'

type Order = { id: string; tokenNo?: string; createdAt?: string; patient: any; tests: string[]; referringConsultant?: string; items?: Array<{ testId: string; status: 'received'|'completed'; sampleTime?: string; reportingTime?: string }>; status?: 'received'|'completed' }
type Test = { id: string; name: string }

function resolveKey(name: string){
  const n = (name||'').toLowerCase()
  if (n.includes('ultrasound')) return 'Ultrasound'
  if (n.replace(/\s+/g,'') === 'ctscan') return 'CTScan'
  if (n.includes('echocardio')) return 'Echocardiography'
  if (n.includes('colonoscopy')) return 'Colonoscopy'
  if (n.includes('uppergi')) return 'UpperGiEndoscopy'
  if (n === 'stt' || n.includes('(stt)') || n.includes('stress tolerance')) return 'STT'
  if (n === 'npt' || n.includes('(npt)') || n.includes('nocturnal penile tumescence')) return 'NPT'
  if (n === 'pds' || n.includes('(pds)') || n.includes('penile doppler')) return 'PDS'
  return name
}

function formatDateTime(iso?: string) {
  const d = new Date(iso || new Date().toISOString());
  return d.toLocaleDateString() + ', ' + d.toLocaleTimeString()
}

export default function Diagnostic_ResultEntry(){
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const testsMap = useMemo(()=> Object.fromEntries(tests.map(t=>[t.id, t.name])), [tests])

  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  const [entryOpen, setEntryOpen] = useState(false)
  const [entryOrder, setEntryOrder] = useState<Order | null>(null)
  const [entryBusy, setEntryBusy] = useState(false)
  const [busyTestId, setBusyTestId] = useState<string | null>(null)
  const [entryItems, setEntryItems] = useState<Array<{ testId: string; testName: string; value: string; resultId: string | null }>>([])
  const resultsCacheRef = useRef<{ orderId: string; byTest: Record<string, any> } | null>(null)
  const [focusTestId, setFocusTestId] = useState<string | null>(null)
  const testSectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Filters & pagination (aligned with Sample Tracking)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'all'|'received'|'completed'>('completed')
  const [rows, setRows] = useState(20)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Load tests list (for name mapping)
  useEffect(()=>{ (async()=>{
    try {
      const tr = await diagnosticApi.listTests({ limit: 1000 }) as any
      setTests((tr?.items||tr||[]).map((t:any)=>({ id: String(t._id||t.id), name: t.name })))
    } catch { setTests([]) }
  })() }, [])

  // Load orders according to filters/pagination
  useEffect(()=>{ let mounted = true; (async()=>{
    try {
      // Do NOT filter by order.status for 'received'/'completed' here since those are tracked per-test (items[].status)
      const st = undefined
      const res = await diagnosticApi.listOrders({ q: q || undefined, from: from || undefined, to: to || undefined, status: st as any, page, limit: rows }) as any
      const items: Order[] = (res.items||[]).map((x:any)=>({
        id: String(x._id),
        tokenNo: x.tokenNo,
        createdAt: x.createdAt,
        patient: x.patient,
        tests: x.tests||[],
        referringConsultant: x.referringConsultant,
        items: (x.items||[]).map((it:any)=>({
          testId: String(it?.testId || ''),
          status: (String(it?.status || 'received').toLowerCase() === 'completed' ? 'completed' : 'received') as any,
          sampleTime: it?.sampleTime,
          reportingTime: it?.reportingTime,
        })),
        status: (String(x.status || 'received').toLowerCase() === 'completed' ? 'completed' : 'received') as any,
      }))
      if (mounted){ setOrders(items); setTotal(Number(res.total||items.length||0)); setTotalPages(Number(res.totalPages||1)) }
    } catch { if (mounted){ setOrders([]); setTotal(0); setTotalPages(1) } }
  })(); return ()=>{ mounted=false } }, [q, from, to, status, page, rows])

  async function openEntry(order: Order, focusTid?: string, mode: 'enter' | 'edit' = 'enter'){
    try {
      setFocusTestId(focusTid ? String(focusTid) : null)
      setEntryOrder(order)
      setEntryOpen(true)
      const focusId = focusTid ? String(focusTid) : ''
      if (!focusId) {
        setEntryItems([])
        return
      }

      if (mode === 'enter') {
        setEntryItems([
          {
            testId: focusId,
            testName: String(testsMap[String(focusId)] || ''),
            value: '',
            resultId: null,
          },
        ])
        return
      }

      const cacheOk = resultsCacheRef.current && resultsCacheRef.current.orderId === order.id
      if (!cacheOk){
        setEntryBusy(true)
        let results: any[] = []
        try {
          const r = await diagnosticApi.listResults({ orderId: order.id, limit: 1000 }) as any
          results = (r?.items || r || []) as any[]
        } catch { results = [] }

        const byTest: Record<string, any> = {}
        for (const rr of results){
          const tid = String((rr as any)?.testId || '')
          if (!tid) continue
          byTest[tid] = rr
        }
        resultsCacheRef.current = { orderId: order.id, byTest }
      }

      const r = resultsCacheRef.current?.byTest?.[focusId]
      const fd = r?.formData
      const v = typeof fd === 'string' ? fd : JSON.stringify(fd || '')
      setEntryItems([
        {
          testId: focusId,
          testName: String(testsMap[String(focusId)] || ''),
          value: r ? v : '',
          resultId: r ? String(r._id || '') : null,
        },
      ])
    } finally {
      setEntryBusy(false)
    }
  }

  useEffect(() => {
    if (!entryOpen) return
    if (!focusTestId) return
    const el = testSectionRefs.current[String(focusTestId)]
    if (el && typeof (el as any).scrollIntoView === 'function'){
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
    }
  }, [entryOpen, focusTestId, entryItems.length])

  async function finalizeOne(item: { testId: string; testName: string; value: string; resultId: string | null }){
    if (!entryOrder) return
    try {
      setBusyTestId(item.testId)
      const reportedAt = new Date().toISOString()
      const payload = {
        orderId: entryOrder.id,
        testId: item.testId,
        testName: item.testName || String(testsMap[item.testId] || ''),
        tokenNo: entryOrder.tokenNo,
        patient: entryOrder.patient,
        formData: item.value,
        status: 'final',
        reportedAt,
      }

      let finalizedId: string | null = null
      if (item.resultId){
        await diagnosticApi.updateResult(item.resultId, { formData: item.value, status: 'final', reportedAt })
        finalizedId = item.resultId
      } else {
        const created = await diagnosticApi.createResult(payload as any) as any
        finalizedId = String(created?._id || '') || null
      }

      try {
        // Keep the sample/test status as completed (do not change automatically to another status)
        await diagnosticApi.updateOrderItemTrack(entryOrder.id, item.testId, { status: 'completed', reportingTime: reportedAt })
      } catch {}

      setOrders(prev => prev.map(o => {
        if (o.id !== entryOrder.id) return o
        const items = Array.isArray(o.items) ? o.items.slice() : []
        const idx = items.findIndex(i=> i.testId===item.testId)
        if (idx>=0) items[idx] = { ...items[idx], status: 'completed', reportingTime: reportedAt }
        else items.push({ testId: item.testId, status: 'completed', reportingTime: reportedAt })
        return { ...o, items }
      }))

      setEntryItems(prev => prev.map(x => x.testId === item.testId ? { ...x, resultId: finalizedId || x.resultId } : x))
      if (finalizedId && resultsCacheRef.current && resultsCacheRef.current.orderId === entryOrder.id){
        resultsCacheRef.current.byTest[String(item.testId)] = { _id: finalizedId, testId: item.testId, formData: item.value }
      }

      showToast('success', 'Finalized')
      setEntryOpen(false)
      setEntryOrder(null)
      setEntryItems([])
      if (finalizedId) {
        const s = new URLSearchParams()
        s.set('resultId', String(finalizedId))
        navigate(`/diagnostic/report-generator?${s.toString()}`)
      }
    } catch {
      showToast('error', 'Failed')
    } finally {
      setBusyTestId(null)
    }
  }

  // Pagination helpers
  const pageCount = Math.max(1, totalPages)
  const curPage = Math.min(page, pageCount)
  const start = Math.min((curPage - 1) * rows + 1, total)
  const end = Math.min((curPage - 1) * rows + orders.length, total)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-2xl font-bold text-slate-900">Result Entry</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="min-w-[260px] flex-1">
            <input value={q} onChange={e=>{ setQ(e.target.value); setPage(1) }} placeholder="Search by token, patient, or test..." className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={e=>{ setFrom(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1" />
            <input type="date" value={to} onChange={e=>{ setTo(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1" />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={()=>{ setStatus('all'); setPage(1) }} className={`rounded-md px-3 py-1.5 border ${status==='all'?'bg-slate-900 text-white border-slate-900':'border-slate-300 text-slate-700'}`}>All</button>
            <button onClick={()=>{ setStatus('received'); setPage(1) }} className={`rounded-md px-3 py-1.5 border ${status==='received'?'bg-slate-900 text-white border-slate-900':'border-slate-300 text-slate-700'}`}>Received</button>
            <button onClick={()=>{ setStatus('completed'); setPage(1) }} className={`rounded-md px-3 py-1.5 border ${status==='completed'?'bg-slate-900 text-white border-slate-900':'border-slate-300 text-slate-700'}`}>Completed</button>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>Rows</span>
            <select value={rows} onChange={e=>{ setRows(Number(e.target.value)); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Token No</th>
              <th className="px-4 py-2">Test</th>
              <th className="px-4 py-2">MR No</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.reduce((acc: any[], o) => {
              const token = o.tokenNo || '-'
              const visibleTests = (o.tests||[]).filter((tid)=>{
                const item = (o.items||[]).find(i=> i.testId===tid)
                const istatus: 'received'|'completed' = (item?.status || 'received') as any
                if (status==='all') return true
                if (status==='completed') return istatus === 'completed'
                return istatus === status
              })
              visibleTests.forEach((tid, idx) => {
                const tname = testsMap[tid] || '—'
                const item = (o.items||[]).find(i=> i.testId===tid)
                const istatus: 'received'|'completed' = (item?.status || 'received') as any
                const isEntered = istatus === 'completed' && !!item?.reportingTime
                acc.push(
                  <tr key={`${o.id}-${tid}-${idx}`} className="border-b border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(o.createdAt||'')}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{o.patient?.fullName || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{token}</td>
                    <td className="px-4 py-2">{tname}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{o.patient?.mrn || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{o.patient?.phone || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {!isEntered ? (
                        <button onClick={()=> openEntry(o, String(tid), 'enter')} className="rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-700">Enter Result</button>
                      ) : (
                        <button onClick={()=> openEntry(o, String(tid), 'edit')} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                          <span className="mr-1 inline-block">✓</span>
                          Edit
                        </button>
                      )}
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
          <button disabled={curPage<=1} onClick={()=> setPage(p=> Math.max(1, p-1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Prev</button>
          <span>{curPage} / {pageCount}</span>
          <button disabled={curPage>=pageCount} onClick={()=> setPage(p=> p+1)} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>

      {entryOpen && entryOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4" onClick={()=>{ if (busyTestId) return; setEntryOpen(false) }}>
          <div className="w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <div className="text-base font-semibold text-slate-800">Result Entry</div>
                <div className="text-xs text-slate-500">
                  {entryOrder.patient?.fullName || '-'}
                  {' '}| Token: {entryOrder.tokenNo || '-'}
                </div>
              </div>
              <button onClick={()=>{ if (busyTestId) return; setEntryOpen(false) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Close</button>
            </div>

            <div className="max-h-[85vh] overflow-y-auto p-5">
              {entryBusy && (
                <div className="mb-4 text-sm text-slate-600">Loading...</div>
              )}

              {!entryBusy && entryItems.length === 0 && (
                <div className="text-sm text-slate-600">No tests found for this order.</div>
              )}

              <div className="space-y-6">
                {entryItems.map((it) => {
                  const name = it.testName || String(testsMap[it.testId] || '')
                  const key = resolveKey(name)
                  const FormComp = (DiagnosticFormRegistry as any)[key] as React.ComponentType<ReportRendererProps> | undefined
                  return (
                    <div key={it.testId} ref={(el)=>{ testSectionRefs.current[String(it.testId)] = el }} className="rounded-xl border border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="font-semibold text-slate-800">{name || 'Test'}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={()=> finalizeOne(it)}
                            disabled={!!busyTestId || entryBusy}
                            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                          >
                            {busyTestId === it.testId ? 'Saving...' : 'Finalize'}
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        {FormComp ? (
                          <FormComp
                            value={it.value}
                            onChange={(text)=> setEntryItems(prev => prev.map(x => x.testId === it.testId ? { ...x, value: text } : x))}
                          />
                        ) : (
                          <textarea
                            value={it.value}
                            onChange={e=>{
                              const v = e.target.value
                              setEntryItems(prev => prev.map(x => x.testId === it.testId ? { ...x, value: v } : x))
                            }}
                            className="min-h-[140px] w-full rounded-md border border-slate-300 px-3 py-2"
                            placeholder="Enter result"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
