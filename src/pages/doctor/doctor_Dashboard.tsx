import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type DoctorSession = { id: string; name: string; username: string }

type Token = { _id: string; createdAt: string; mrn?: string; patientName?: string; encounterId?: any; doctorId?: any; status?: string }
type PresRow = { id: string; patientName: string; mrNo?: string; diagnosis?: string; createdAt: string }

type Notification = { id: string; doctorId: string; message: string; createdAt: string; read?: boolean }

const apiBaseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api'

export default function Doctor_Dashboard() {
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  useEffect(() => {
    try { const raw = localStorage.getItem('doctor.session'); setDoc(raw ? JSON.parse(raw) : null) } catch { setDoc(null) }
  }, [])
  useEffect(() => {
    try {
      const sess = doc
      if (!sess) return
        ; (async () => {
          try {
            const res = await hospitalApi.listDoctors() as any
            const docs: any[] = res?.doctors || []
            const match = docs.find(d => String(d._id || d.id) === String(sess.id || '')) ||
              docs.find(d => String(d.username || '').toLowerCase() === String(sess.username || '').toLowerCase()) ||
              docs.find(d => String(d.name || '').toLowerCase() === String(sess.name || '').toLowerCase())
            if (match) {
              const nextId = String(match._id || match.id)
              const nextName = String(match.name || sess.name || '')
              if (String(sess.id || '') !== nextId || String(sess.name || '') !== nextName) {
                const next = { ...sess, id: nextId, name: nextName }
                try { localStorage.setItem('doctor.session', JSON.stringify(next)) } catch { }
                setDoc(next)
              }
            }
          } catch { }
        })()
    } catch { }
  }, [doc])

  const [queuedCount, setQueuedCount] = useState(0)
  const [prescCount, setPrescCount] = useState(0)
  const [labRefCount, setLabRefCount] = useState(0)
  const [phRefCount, setPhRefCount] = useState(0)
  const [diagRefCount, setDiagRefCount] = useState(0)
  const [queue, setQueue] = useState<Token[]>([])
  const [recentPres, setRecentPres] = useState<PresRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const esRef = useRef<EventSource | null>(null)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  useEffect(() => { load() }, [doc?.id, from, to])
  useEffect(() => {
    if (!doc?.id) return
    let stopped = false
      ; (async () => {
        try {
          const res = await hospitalApi.listNotifications(doc.id) as any
          const arr: Notification[] = (res?.notifications || []).map((n: any) => ({ id: String(n._id), doctorId: String(n.doctorId), message: n.message, createdAt: n.createdAt, read: !!n.read }))
          setUnreadCount(arr.filter(n => !n.read).length)
        } catch { setUnreadCount(0) }
      })()
    const url = `${apiBaseURL}/hospital/notifications/stream?doctorId=${encodeURIComponent(doc.id)}`
    const es = new EventSource(url)
    esRef.current = es
    // Connection events handled silently
    es.addEventListener('doctor-notification', () => {
      setUnreadCount(c => c + 1)
    })
    return () => { if (stopped) return; es.close(); esRef.current = null; stopped = true }
  }, [doc?.id])
  useEffect(() => {
    const onUpdated = async () => {
      if (!doc?.id) return
      try {
        const res = await hospitalApi.listNotifications(doc.id) as any
        const arr: Notification[] = (res?.notifications || []).map((n: any) => ({ id: String(n._id), doctorId: String(n.doctorId), message: n.message, createdAt: n.createdAt, read: !!n.read }))
        setUnreadCount(arr.filter(n => !n.read).length)
      } catch { setUnreadCount(0) }
    }
    window.addEventListener('doctor:notifications-updated', onUpdated as any)
    return () => window.removeEventListener('doctor:notifications-updated', onUpdated as any)
  }, [doc?.id])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('doctor:pres-saved', h as any)
    return () => window.removeEventListener('doctor:pres-saved', h as any)
  }, [doc?.id])
  async function load() {
    if (!doc?.id) { setQueuedCount(0); setPrescCount(0); setLabRefCount(0); setPhRefCount(0); setDiagRefCount(0); setQueue([]); setRecentPres([]); return }
    try {
      const tokParams: any = { doctorId: doc.id }
      const presParams: any = { doctorId: doc.id }
      const labParams: any = { type: 'lab', doctorId: doc.id, page: 1, limit: 200 }
      const phParams: any = { type: 'pharmacy', doctorId: doc.id, page: 1, limit: 200 }
      const diagParams: any = { type: 'diagnostic', doctorId: doc.id, page: 1, limit: 200 }
      if (from) { tokParams.from = from; presParams.from = from; labParams.from = from; phParams.from = from }
      if (to) { tokParams.to = to; presParams.to = to; labParams.to = to; phParams.to = to }
      if (from) diagParams.from = from; if (to) diagParams.to = to
      const [tokResRange, presRes, labRefs, phRefs, diagRefs] = await Promise.all([
        hospitalApi.listTokens(tokParams) as any,
        hospitalApi.listPrescriptions(presParams) as any,
        hospitalApi.listReferrals(labParams) as any,
        hospitalApi.listReferrals(phParams) as any,
        hospitalApi.listReferrals(diagParams) as any,
      ])
      const tokRows: Token[] = tokResRange?.tokens || []
      const presIds: string[] = (presRes?.prescriptions || []).map((r: any) => String(r.encounterId?._id || r.encounterId || ''))
      const presSet = new Set(presIds.filter(Boolean))
      const myRange = tokRows // backend already filtered by doctorId when provided
      const myQueuedFiltered = myRange.filter(t => {
        const encId = String((t as any).encounterId?._id || (t as any).encounterId || '')
        return !encId || !presSet.has(encId)
      })
      setQueuedCount(myQueuedFiltered.length)
      setQueue(myQueuedFiltered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(0, 8))
      const presRows: PresRow[] = (presRes?.prescriptions || []).map((r: any) => ({
        id: String(r._id || r.id),
        patientName: r.encounterId?.patientId?.fullName || '-',
        mrNo: r.encounterId?.patientId?.mrn || '-',
        diagnosis: r.diagnosis,
        createdAt: r.createdAt,
      }))
      setPrescCount(presRows.length)
      setRecentPres(presRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8))
      setLabRefCount((labRefs?.referrals || []).length)
      setPhRefCount((phRefs?.referrals || []).length)
      setDiagRefCount((diagRefs?.referrals || []).length)
    } catch {
      setQueuedCount(0); setPrescCount(0); setLabRefCount(0); setPhRefCount(0); setDiagRefCount(0); setQueue([]); setRecentPres([])
    }
  }

  const myNotifs = useMemo(() => unreadCount, [unreadCount])
  const rangeLabel = useMemo(() => {
    if (from || to) return `${from || '...'} to ${to || '...'}`
    return 'All time'
  }, [from, to])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-sky-100 to-violet-100 p-4 sm:p-5">
        <div className="text-xs sm:text-sm text-slate-600">Welcome</div>
        <div className="mt-1 text-lg sm:text-xl font-bold text-slate-800">Dr. {doc?.name || 'Doctor'}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/doctor/prescription" className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700">+ New Prescription</Link>
          <Link to="/doctor/prescription-history" className="rounded-md border border-slate-300 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white/80">History</Link>
          <Link to="/doctor/patients" className="rounded-md border border-slate-300 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white/80">Patients</Link>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs sm:text-sm">From</span>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value) }} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs sm:text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs sm:text-sm">To</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value) }} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs sm:text-sm" />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setFrom(''); setTo('') }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50"
            title="Reset dates"
          >Reset</button>
          <button
            type="button"
            onClick={() => { const t = new Date().toISOString().slice(0, 10); setFrom(t); setTo(t) }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50"
          >Today</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Queued Patients" value={queuedCount} tone="sky" />
        <Stat title="Prescriptions" value={prescCount} tone="violet" />
        <Stat title="Referrals" value={labRefCount + phRefCount + diagRefCount} tone="emerald" />
        <Stat title="Unread Notifications" value={myNotifs} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">Queue</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{rangeLabel}</div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto hospital-sidebar-scroll">
            {queue.map(q => (
              <div key={q._id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{q.patientName || '-'} <span className="text-xs text-slate-500">{q.mrn || ''}</span></div>
                  <div className="text-xs text-slate-600">{new Date(q.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">Status: {q.status || 'pending'}</div>
              </div>
            ))}
            {queue.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No patients in queue</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">Recent Prescriptions</div>
            <Link to="/doctor/prescription-history" className="text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto hospital-sidebar-scroll">
            {recentPres.map(r => (
              <div key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.patientName} <span className="text-xs text-slate-500">{r.mrNo || ''}</span></div>
                  <div className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">{r.diagnosis || '-'}</div>
              </div>
            ))}
            {recentPres.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No prescriptions</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-800">Referrals</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-blue-700">
            <div className="text-[11px] font-medium uppercase tracking-wider opacity-70 text-blue-600">Lab</div>
            <div className="text-2xl font-bold">{labRefCount}</div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-emerald-700">
            <div className="text-[11px] font-medium uppercase tracking-wider opacity-70 text-emerald-600">Pharmacy</div>
            <div className="text-2xl font-bold">{phRefCount}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-violet-700">
            <div className="text-[11px] font-medium uppercase tracking-wider opacity-70 text-violet-600">Diagnostic</div>
            <div className="text-2xl font-bold">{diagRefCount}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ title, value, tone }: { title: string; value: any; tone: 'sky' | 'violet' | 'amber' | 'emerald' }) {
  const tones: any = {
    sky: 'bg-sky-100 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
    violet: 'bg-violet-100 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
    amber: 'bg-amber-100 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
  }
  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all hover:scale-[1.02] ${tones[tone]}`}>
      <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider opacity-80">{title}</div>
      <div className="mt-1.5 text-xl sm:text-2xl font-bold">{value}</div>
    </div>
  )
}
