import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type DoctorSession = { id: string; name: string; username: string }

type Token = {
  _id: string
  createdAt: string
  patientName: string
  mrNo: string
  encounterId?: string
  doctorId?: string
  doctorName?: string
  department?: string
  fee: number
  status: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
}

export default function Doctor_Patients() {
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [list, setList] = useState<Token[]>([])
  const [presEncounterIds, setPresEncounterIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      const sess = raw ? JSON.parse(raw) : null
      setDoc(sess)
      // Compat: if legacy id (not 24-hex), try to resolve to backend _id by username/name
      const hex24 = /^[a-f\d]{24}$/i
      if (sess && !hex24.test(String(sess.id||''))) {
        ;(async () => {
          try {
            const res = await hospitalApi.listDoctors() as any
            const docs: any[] = res?.doctors || []
            const match = docs.find(d => String(d.username||'').toLowerCase() === String(sess.username||'').toLowerCase()) ||
                          docs.find(d => String(d.name||'').toLowerCase() === String(sess.name||'').toLowerCase())
            if (match) {
              const fixed = { ...sess, id: String(match._id || match.id) }
              try { localStorage.setItem('doctor.session', JSON.stringify(fixed)) } catch {}
              setDoc(fixed)
            }
          } catch {}
        })()
      }
    } catch {}
  }, [])

  useEffect(() => { load() }, [doc?.id, from, to])
  useEffect(() => {
    if (!doc?.id) return
    const id = setInterval(() => { load() }, 15000)
    return () => clearInterval(id)
  }, [doc?.id])

  // Refresh immediately when a prescription is saved elsewhere
  useEffect(() => {
    const handler = () => { load() }
    window.addEventListener('doctor:pres-saved', handler as any)
    return () => window.removeEventListener('doctor:pres-saved', handler as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  async function load(){
    try {
      if (!doc?.id) { setList([]); setPresEncounterIds([]); return }
      const params: any = { doctorId: doc.id }
      if (from) params.from = from
      if (to) params.to = to
      const [tokRes, presRes] = await Promise.all([
        hospitalApi.listTokens(params) as any,
        hospitalApi.listPrescriptions({ doctorId: doc.id, from, to }) as any,
      ])
      const items: Token[] = (tokRes.tokens || []).map((t: any) => ({
        _id: t._id,
        createdAt: t.createdAt,
        patientName: t.patientName || '-',
        mrNo: t.mrn || '-',
        encounterId: String(t.encounterId || ''),
        doctorId: t.doctorId?._id || String(t.doctorId || ''),
        doctorName: t.doctorId?.name || '',
        department: t.departmentId?.name || '',
        fee: Number(t.fee || 0),
        status: t.status,
      }))
      const presIds: string[] = (presRes.prescriptions || []).map((p: any) => String(p.encounterId?._id || p.encounterId || ''))
      setList(items)
      setPresEncounterIds(presIds)
    } catch {
      // backend likely down; keep current list
    }
  }

  const myQueue = useMemo(() => {
    const presSet = new Set(presEncounterIds.filter(Boolean))
    return (list || [])
      .filter(t => t.doctorId === doc?.id && (!t.encounterId || !presSet.has(String(t.encounterId))))
      .sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())
  }, [list, doc, presEncounterIds])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return myQueue
    return myQueue.filter(t => [t.patientName, t.mrNo]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q)))
  }, [myQueue, query])


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xl font-semibold text-slate-800">Queued Patients</div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e=>{ setFrom(e.target.value); }} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <span className="text-slate-500 text-sm">to</span>
          <input type="date" value={to} onChange={e=>{ setTo(e.target.value); }} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button
            type="button"
            onClick={()=>{ setFrom(''); setTo('') }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            title="Reset dates"
          >Reset</button>
          <button
            type="button"
            onClick={()=>{ const t = new Date().toISOString().slice(0,10); setFrom(t); setTo(t) }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >Today</button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-slate-800">First-Come First-Serve</div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Search by name or MR#"
            className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
        </div>
        <div className="divide-y divide-slate-200">
          {visible.map((t, idx) => (
            <div key={t._id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{idx+1}</div>
                <div>
                  <div className="font-medium">{t.patientName}</div>
                  <div className="text-xs text-slate-500">MR: {t.mrNo} • {new Date(t.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`rounded border px-2 py-1 ${t.status==='in-progress'?'border-amber-200 bg-amber-50 text-amber-700': t.status==='completed'?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 text-slate-600'}`}>{t.status.replace('-', ' ')}</span>
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50"
                  onClick={async ()=>{ try { await hospitalApi.updateTokenStatus(t._id, 'completed'); await load() } catch {} }}
                  title="Mark as Complete"
                >Complete</button>
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 text-amber-700"
                  onClick={async ()=>{ try { await hospitalApi.updateTokenStatus(t._id, t.status==='returned'?'queued':'returned'); await load() } catch {} }}
                  title="Return token"
                >{t.status==='returned'?'Unreturn':'Return'}</button>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500">No queued patients</div>
          )}
        </div>
      </div>
    </div>
  )
}
