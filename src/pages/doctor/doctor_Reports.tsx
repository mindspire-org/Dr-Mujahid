import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { diagnosticApi, labApi, hospitalApi } from '../../utils/api'
import { previewLabReportPdf } from '../../utils/printLabReport'
import { printEchocardiographyReport } from '../../components/diagnostic/diagnostic_Echocardiography'
import { printUltrasoundReport } from '../../components/diagnostic/diagnostic_UltrasoundGeneric'
import { printCTScanReport } from '../../components/diagnostic/diagnostic_CTScan'
import { printColonoscopyReport } from '../../components/diagnostic/diagnostic_Colonoscopy'
import { printUpperGIEndoscopyReport } from '../../components/diagnostic/diagnostic_UpperGIEndoscopy'

function resolveDiagKey(name: string) {
  const n = (name || '').toLowerCase()
  if (n.includes('ultrasound')) return 'Ultrasound'
  if (n.replace(/\s+/g, '') === 'ctscan') return 'CTScan'
  if (n.includes('echocardio')) return 'Echocardiography'
  if (n.includes('colonoscopy')) return 'Colonoscopy'
  if (n.includes('uppergi')) return 'UpperGiEndoscopy'
  return name
}

type DoctorSession = { id: string; name: string; username: string }

type DiagResult = { id: string; orderId?: string; testId?: string; testName: string; tokenNo?: string; createdAt?: string; reportedAt?: string; status: 'draft' | 'final'; patient?: any; formData?: string }

type LabResultRec = { id: string; orderId: string; rows: any[]; interpretation?: string; createdAt: string }

type LabOrder = { id: string; createdAt: string; tokenNo?: string; patient?: any; tests?: string[]; sampleTime?: string; reportingTime?: string; referringConsultant?: string }

type PrescRec = {
  id: string
  createdAt?: string
  encounter?: any
  therapyTests?: string[]
  therapyNotes?: string
  medicine?: Array<{ name?: string; frequency?: string; duration?: string; dose?: string; instruction?: string; route?: string }>
}

export default function Doctor_Reports() {
  const location = useLocation()
  const today = new Date()
  const lastWeek = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const [doc, setDoc] = useState<DoctorSession | null>(null)

  // Filters
  const [from, setFrom] = useState(iso(lastWeek))
  const [to, setTo] = useState(iso(today))
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'lab' | 'diagnostic' | 'prescription'>('all')
  const [diagStatus, setDiagStatus] = useState<'all' | 'draft' | 'final'>('final')
  const [rows, setRows] = useState(20)
  const [diagPage, setDiagPage] = useState(1)
  const [labPage, setLabPage] = useState(1)
  const [presPage, setPresPage] = useState(1)
  const [myOnly, setMyOnly] = useState(false)
  const [mrnFilter, setMrnFilter] = useState('')

  // Load doctor session (and ensure id is the Mongo _id when possible)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      const sess = raw ? JSON.parse(raw) : null
      setDoc(sess)
      const hex24 = /^[a-f\d]{24}$/i
      if (sess && !hex24.test(String(sess.id || ''))) {
        ; (async () => {
          try {
            const res = await hospitalApi.listDoctors() as any
            const docs: any[] = res?.doctors || []
            const match = docs.find(d => String(d.username || '').toLowerCase() === String(sess.username || '').toLowerCase()) ||
              docs.find(d => String(d.name || '').toLowerCase() === String(sess.name || '').toLowerCase())
            if (match) {
              const fixed = { ...sess, id: String(match._id || match.id) }
              try { localStorage.setItem('doctor.session', JSON.stringify(fixed)) } catch { }
              setDoc(fixed)
            }
          } catch { }
        })()
      }
    } catch { }
  }, [])

  // Initialize filters from query params (mrn, my, type)
  useEffect(() => {
    try {
      const qs = new URLSearchParams(location.search)
      const mrn = qs.get('mrn') || ''
      const tp = (qs.get('type') || '').toLowerCase()
      const my = qs.get('my')
      if (mrn) setMrnFilter(mrn)
      if (tp === 'lab' || tp === 'diagnostic' || tp === 'prescription' || tp === 'all') setType(tp as any)
      if (my === '1' || my === 'true') setMyOnly(true)
    } catch { }
    // run once for initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // My Referrals MRN sets (for filtering)
  const [diagMrnSet, setDiagMrnSet] = useState<Set<string>>(new Set())
  const [labMrnSet, setLabMrnSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!myOnly || !doc?.id) { if (mounted) { setDiagMrnSet(new Set()); setLabMrnSet(new Set()) }; return }
        try {
          const [diagRefs, labRefs]: any = await Promise.all([
            hospitalApi.listReferrals({ type: 'diagnostic', doctorId: doc.id, from: from || undefined, to: to || undefined, page: 1, limit: 500 }),
            hospitalApi.listReferrals({ type: 'lab', doctorId: doc.id, from: from || undefined, to: to || undefined, page: 1, limit: 500 }),
          ])
          const dSet = new Set<string>()
          const lSet = new Set<string>()
            ; (diagRefs?.referrals || []).forEach((r: any) => { const mrn = String(r?.encounterId?.patientId?.mrn || '').trim(); if (mrn) dSet.add(mrn) })
            ; (labRefs?.referrals || []).forEach((r: any) => { const mrn = String(r?.encounterId?.patientId?.mrn || '').trim(); if (mrn) lSet.add(mrn) })
          if (mounted) { setDiagMrnSet(dSet); setLabMrnSet(lSet) }
        } catch { if (mounted) { setDiagMrnSet(new Set()); setLabMrnSet(new Set()) } }
      })()
    return () => { mounted = false }
  }, [myOnly, doc?.id, from, to])

  // Diagnostic results
  const [diagItems, setDiagItems] = useState<DiagResult[]>([])
  const [diagTotal, setDiagTotal] = useState(0)
  const [diagTotalPages, setDiagTotalPages] = useState(1)
  const diagReq = useRef(0)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const my = ++diagReq.current
          const res: any = await diagnosticApi.listResults({
            q: q || undefined,
            status: diagStatus === 'all' ? undefined : diagStatus,
            from: from || undefined,
            to: to || undefined,
            page: diagPage,
            limit: rows,
          })
          if (!mounted || my !== diagReq.current) return
          const arr: DiagResult[] = (res?.items || []).map((x: any) => ({
            id: String(x._id || x.id),
            orderId: x.orderId ? String(x.orderId) : undefined,
            testId: x.testId ? String(x.testId) : undefined,
            testName: String(x.testName || ''),
            tokenNo: x.tokenNo,
            createdAt: x.createdAt,
            reportedAt: x.reportedAt,
            status: x.status || 'draft',
            patient: x.patient,
            formData: typeof x.formData === 'string' ? x.formData : JSON.stringify(x.formData || ''),
          }))
          setDiagItems(arr)
          setDiagTotal(Number(res?.total || arr.length || 0))
          setDiagTotalPages(Number(res?.totalPages || 1))
        } catch {
          setDiagItems([]); setDiagTotal(0); setDiagTotalPages(1)
        }
      })()
    return () => { mounted = false }
  }, [q, from, to, diagStatus, diagPage, rows])

  // Lab results + orders map
  const [labResults, setLabResults] = useState<LabResultRec[]>([])
  const [labOrders, setLabOrders] = useState<LabOrder[]>([])
  const [labTotal, setLabTotal] = useState(0)
  const [labTotalPages, setLabTotalPages] = useState(1)
  const labReq = useRef(0)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const my = ++labReq.current
          // Results page
          const res: any = await labApi.listResults({ from: from || undefined, to: to || undefined, page: labPage, limit: rows })
          if (!mounted || my !== labReq.current) return
          const rlist: LabResultRec[] = (res?.items || []).map((x: any) => ({ id: String(x._id || x.id), orderId: String(x.orderId || ''), rows: x.rows || [], interpretation: x.interpretation, createdAt: x.createdAt || new Date().toISOString() }))
          setLabResults(rlist)
          setLabTotal(Number(res?.total || rlist.length || 0))
          setLabTotalPages(Number(res?.totalPages || 1))
          // Load orders window
          const ordRes: any = await labApi.listOrders({ q: mrnFilter || undefined, from: from || undefined, to: to || undefined, limit: 500 })
          const olist: LabOrder[] = (ordRes?.items || []).map((o: any) => ({ id: String(o._id || o.id), createdAt: o.createdAt || new Date().toISOString(), tokenNo: o.tokenNo, patient: o.patient || {}, tests: o.tests || [], sampleTime: o.sampleTime, reportingTime: o.reportingTime, referringConsultant: o.referringConsultant }))
          if (mounted) setLabOrders(olist)
        } catch {
          if (mounted) { setLabResults([]); setLabOrders([]); setLabTotal(0); setLabTotalPages(1) }
        }
      })()
    return () => { mounted = false }
  }, [from, to, labPage, rows, mrnFilter])

  const ordersMap = useMemo(() => Object.fromEntries((labOrders || []).map(o => [o.id, o])), [labOrders])

  const [presItems, setPresItems] = useState<PrescRec[]>([])
  const [presTotal, setPresTotal] = useState(0)
  const [presTotalPages, setPresTotalPages] = useState(1)
  const presReq = useRef(0)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const my = ++presReq.current
          const res: any = await hospitalApi.listPrescriptions({
            doctorId: myOnly ? (doc?.id || undefined) : undefined,
            patientMrn: mrnFilter || undefined,
            from: from || undefined,
            to: to || undefined,
            page: presPage,
            limit: rows,
          })
          if (!mounted || my !== presReq.current) return
          const arr: PrescRec[] = (res?.prescriptions || []).map((p: any) => ({
            id: String(p._id || p.id),
            createdAt: p.createdAt,
            encounter: p.encounterId,
            therapyTests: Array.isArray(p.therapyTests) ? p.therapyTests : [],
            therapyNotes: p.therapyNotes,
            medicine: Array.isArray(p.medicine || p.items) ? (p.medicine || p.items) : [],
          }))
          setPresItems(arr)
          setPresTotal(Number(res?.total || arr.length || 0))
          setPresTotalPages(Math.max(1, Math.ceil(Number(res?.total || arr.length || 0) / rows)))
        } catch {
          if (mounted) { setPresItems([]); setPresTotal(0); setPresTotalPages(1) }
        }
      })()
    return () => { mounted = false }
  }, [doc?.id, from, to, presPage, rows, myOnly, mrnFilter])

  // Filters
  const diagFiltered = useMemo(() => {
    const mineStr = doc?.name ? `Dr. ${doc.name}` : ''
    const term = q.trim().toLowerCase()
    const mrn = mrnFilter.trim().toLowerCase()
    return (diagItems || []).filter(r => {
      if (myOnly) {
        const hasConsult = String(r?.patient?.referringConsultant || '') === mineStr
        const inRefs = r?.patient?.mrn ? diagMrnSet.has(String(r.patient.mrn)) : false
        if (!hasConsult && !inRefs) return false
      }
      if (mrn && String(r?.patient?.mrn || '').toLowerCase() !== mrn) return false
      if (!term) return true
      return (
        (r.patient?.fullName || '').toLowerCase().includes(term) ||
        String(r.patient?.mrn || '').toLowerCase().includes(term) ||
        (r.tokenNo || '').toLowerCase().includes(term) ||
        (r.testName || '').toLowerCase().includes(term)
      )
    })
  }, [diagItems, myOnly, diagMrnSet, doc?.name, q, mrnFilter])

  const labFiltered = useMemo(() => {
    const mineStr = doc?.name ? `Dr. ${doc.name}` : ''
    const term = q.trim().toLowerCase()
    const mrn = mrnFilter.trim().toLowerCase()
    return (labResults || []).filter(r => {
      const ord = ordersMap[r.orderId]
      if (!ord) return false
      if (myOnly) {
        const hasConsult = String(ord?.referringConsultant || '') === mineStr
        const inRefs = ord?.patient?.mrn ? labMrnSet.has(String(ord.patient.mrn)) : false
        if (!hasConsult && !inRefs) return false
      }
      if (mrn && String(ord?.patient?.mrn || '').toLowerCase() !== mrn) return false
      if (!term) return true
      return (
        String(ord?.patient?.fullName || '').toLowerCase().includes(term) ||
        String(ord?.patient?.mrn || '').toLowerCase().includes(term) ||
        String(ord?.tokenNo || '').toLowerCase().includes(term)
      )
    })
  }, [labResults, ordersMap, myOnly, labMrnSet, doc?.name, q, mrnFilter])

  const presFiltered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const mrn = mrnFilter.trim().toLowerCase()
    return (presItems || []).filter(p => {
      const patName = String(p.encounter?.patientId?.fullName || '').toLowerCase()
      const patMrn = String(p.encounter?.patientId?.mrn || '').toLowerCase()
      if (mrn && patMrn !== mrn) return false
      if (!term) return true
      const medsText = (p.medicine || []).map(m => `${m?.name || ''} ${m?.frequency || ''} ${m?.duration || ''} ${m?.dose || ''}`).join(' ').toLowerCase()
      const therapyText = `${(p.therapyTests || []).join(' ')} ${String(p.therapyNotes || '')}`.toLowerCase()
      return patName.includes(term) || patMrn.includes(term) || medsText.includes(term) || therapyText.includes(term)
    })
  }, [presItems, q, mrnFilter])

  // Printing actions
  async function onPrintDiag(r: DiagResult) {
    const key = resolveDiagKey(r.testName)
    const payload = { tokenNo: r.tokenNo, createdAt: r.createdAt, reportedAt: r.reportedAt || r.createdAt, patient: r.patient as any, value: r.formData || '', referringConsultant: (r as any)?.patient?.referringConsultant }
    if (key === 'Echocardiography') { await printEchocardiographyReport(payload as any); return }
    if (key === 'Ultrasound') { await printUltrasoundReport(payload as any); return }
    if (key === 'CTScan') { await printCTScanReport(payload as any); return }
    if (key === 'Colonoscopy') { await printColonoscopyReport(payload as any); return }
    if (key === 'UpperGiEndoscopy') { await printUpperGIEndoscopyReport(payload as any); return }
    alert('Unknown diagnostic template for this test')
  }

  async function onPrintLab(rec: LabResultRec) {
    const ord = ordersMap[rec.orderId]; if (!ord) return
    try {
      await previewLabReportPdf({
        tokenNo: ord.tokenNo || '-',
        createdAt: ord.createdAt,
        sampleTime: ord.sampleTime,
        reportingTime: ord.reportingTime,
        patient: {
          fullName: ord.patient?.fullName,
          phone: ord.patient?.phone,
          mrn: ord.patient?.mrn,
          age: ord.patient?.age,
          gender: ord.patient?.gender,
          address: ord.patient?.address,
        },
        rows: (rec.rows || []).map((row: any) => ({
          test: row.test,
          normal: row.normal,
          unit: row.unit,
          value: row.value,
          prevValue: (row as any).prevValue,
          flag: row.flag,
          comment: row.comment,
        })),
        interpretation: rec.interpretation,
        referringConsultant: ord.referringConsultant,
      })
    } catch (e) { }
  }

  const diagPageCount = Math.max(1, diagTotalPages)
  const diagCurPage = Math.min(diagPage, diagPageCount)
  const diagStart = Math.min((diagCurPage - 1) * rows + 1, diagTotal)
  const diagEnd = Math.min((diagCurPage - 1) * rows + diagFiltered.length, diagTotal)

  const labPageCount = Math.max(1, labTotalPages)
  const labCurPage = Math.min(labPage, labPageCount)
  const labStart = Math.min((labCurPage - 1) * rows + 1, labTotal)
  const labEnd = Math.min((labCurPage - 1) * rows + labFiltered.length, labTotal)

  const presPageCount = Math.max(1, presTotalPages)
  const presCurPage = Math.min(presPage, presPageCount)
  const presStart = Math.min((presCurPage - 1) * rows + 1, presTotal)
  const presEnd = Math.min((presCurPage - 1) * rows + presFiltered.length, presTotal)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">Doctor Reports</div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm">
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end">
          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Search</label>
              <input value={q} onChange={e => { setQ(e.target.value); setDiagPage(1); setLabPage(1) }} placeholder="Name, Token, Test..." className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:text-slate-200" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Patient MRN</label>
              <input value={mrnFilter} onChange={e => { setMrnFilter(e.target.value); setDiagPage(1); setLabPage(1) }} placeholder="MRN" className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:text-slate-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">From</label>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setDiagPage(1); setLabPage(1) }} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm outline-none focus:border-sky-500 dark:text-slate-200" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">To</label>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setDiagPage(1); setLabPage(1) }} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm outline-none focus:border-sky-500 dark:text-slate-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm outline-none focus:border-sky-500 dark:text-slate-200">
                <option value="all">All Types</option>
                <option value="diagnostic">Diagnostic</option>
                <option value="lab">Lab</option>
                <option value="prescription">Prescription</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rows</label>
              <select value={rows} onChange={e => { setRows(parseInt(e.target.value) || 20); setDiagPage(1); setLabPage(1) }} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm outline-none focus:border-sky-500 dark:text-slate-200">
                <option value={10}>10 Rows</option>
                <option value={20}>20 Rows</option>
                <option value={50}>50 Rows</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 h-9 sm:h-10">
              <input id="myref" type="checkbox" checked={myOnly} onChange={e => { setMyOnly(e.target.checked); setDiagPage(1); setLabPage(1) }} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500" />
              <label htmlFor="myref" className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">My Referrals</label>
            </div>
            {type !== 'lab' && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Diag Status</label>
                <select value={diagStatus} onChange={e => { setDiagStatus(e.target.value as any); setDiagPage(1) }} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm outline-none focus:border-sky-500 dark:text-slate-200">
                  <option value="all">All Status</option>
                  <option value="final">Final Only</option>
                  <option value="draft">Drafts</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {(type === 'diagnostic' || type === 'all') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-100">Diagnostic Results</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{diagTotal ? `${diagStart}-${diagEnd} of ${diagTotal}` : ''}</div>
          </div>
          <div className="overflow-x-auto hospital-sidebar-scroll">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-left text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">MRN</th>
                  <th className="px-4 py-3 font-semibold">Token</th>
                  <th className="px-4 py-3 font-semibold">Test</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {diagFiltered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{new Date(r.createdAt || '').toLocaleString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{r.patient?.fullName || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{r.patient?.mrn || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{r.tokenNo || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{r.testName || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onPrintDiag(r)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">PDF</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {diagFiltered.length === 0 && <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No diagnostic results</div>}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <button className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 disabled:opacity-50 dark:text-slate-300" disabled={diagCurPage <= 1} onClick={() => setDiagPage(p => Math.max(1, p - 1))}>Prev</button>
            <div className="text-slate-600 dark:text-slate-400">Page {diagCurPage} / {diagPageCount}</div>
            <button className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 disabled:opacity-50 dark:text-slate-300" disabled={diagCurPage >= diagPageCount} onClick={() => setDiagPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {(type === 'lab' || type === 'all') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-100">Lab Results</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{labTotal ? `${labStart}-${labEnd} of ${labTotal}` : ''}</div>
          </div>
          <div className="overflow-x-auto hospital-sidebar-scroll">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-left text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">MRN</th>
                  <th className="px-4 py-3 font-semibold">Token</th>
                  <th className="px-4 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labFiltered.map(r => {
                  const o = ordersMap[r.orderId]
                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{new Date(r.createdAt || o?.createdAt || '').toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{o?.patient?.fullName || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{o?.patient?.mrn || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{o?.tokenNo || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <button onClick={() => onPrintLab(r)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">PDF</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {labFiltered.length === 0 && <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No lab results</div>}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <button className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 disabled:opacity-50 dark:text-slate-300" disabled={labCurPage <= 1} onClick={() => setLabPage(p => Math.max(1, p - 1))}>Prev</button>
            <div className="text-slate-600 dark:text-slate-400">Page {labCurPage} / {labPageCount}</div>
            <button className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 disabled:opacity-50 dark:text-slate-300" disabled={labCurPage >= labPageCount} onClick={() => setLabPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {(type === 'prescription' || type === 'all') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-100">Prescriptions</div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{presTotal ? `${presStart}-${presEnd} of ${presTotal}` : ''}</div>
          </div>
          <div className="overflow-x-auto hospital-sidebar-scroll">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-left text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">MRN</th>
                  <th className="px-4 py-3 font-semibold">Therapy</th>
                  <th className="px-4 py-3 font-semibold">Medicines</th>
                </tr>
              </thead>
              <tbody>
                {presFiltered.map(p => {
                  const patientName = p.encounter?.patientId?.fullName || '-'
                  const patientMrn = p.encounter?.patientId?.mrn || '-'
                  const therapyText = [
                    ...(Array.isArray(p.therapyTests) ? p.therapyTests : []),
                    String(p.therapyNotes || '').trim(),
                  ].filter(Boolean).join(' | ')
                  const medsText = (p.medicine || [])
                    .map(m => `${m?.name || '-'}${m?.frequency ? ` • ${m.frequency}` : ''}${m?.duration ? ` • ${m.duration}` : ''}${m?.dose ? ` • ${m.dose}` : ''}`)
                    .join(' | ')
                  return (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{new Date(p.createdAt || '').toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{patientName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{patientMrn}</td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{therapyText || '-'}</td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{medsText || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {presFiltered.length === 0 && <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No prescriptions</div>}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <button className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 disabled:opacity-50 dark:text-slate-300" disabled={presCurPage <= 1} onClick={() => setPresPage(p => Math.max(1, p - 1))}>Prev</button>
            <div className="text-slate-600 dark:text-slate-400">Page {presCurPage} / {presPageCount}</div>
            <button className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 disabled:opacity-50 dark:text-slate-300" disabled={presCurPage >= presPageCount} onClick={() => setPresPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
