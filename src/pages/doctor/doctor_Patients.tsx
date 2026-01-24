import { useEffect, useMemo, useState } from 'react'
import { hospitalApi, labApi } from '../../utils/api'
import { useNavigate } from 'react-router-dom'
import { Eye, X } from 'lucide-react'
import { previewPrescriptionPdf } from '../../utils/prescriptionPdf'
import type { PrescriptionPdfTemplate } from '../../utils/prescriptionPdf'

type DoctorSession = { id: string; name: string; username: string }

type Token = {
  _id: string
  createdAt: string
  dateIso?: string
  tokenNo?: string
  patientName: string
  mrNo: string
  raw?: any
  encounterId?: string
  doctorId?: string
  doctorName?: string
  department?: string
  fee: number
  status: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
}

function TokenDetailsDialog({ open, onClose, row }: { open: boolean; onClose: ()=>void; row: Token | null }){
  if (!open || !row) return null
  const t = row.raw || {}
  const patient = t.patientId || {}
  const doctor = t.doctorId || {}
  const dept = t.departmentId || {}
  const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString() : new Date(row.createdAt).toLocaleString()

  const patientName = patient.fullName || t.patientName || row.patientName || '-'
  const mrn = patient.mrn || t.mrn || row.mrNo || '-'
  const phone = patient.phoneNormalized || t.phone || '-'
  const age = patient.age || t.age || '-'
  const gender = patient.gender || t.gender || '-'
  const guardianRel = patient.guardianRel || t.guardianRel || '-'
  const guardianName = patient.fatherName || t.guardianName || t.guardian || '-'
  const cnic = patient.cnicNormalized || t.cnic || '-'
  const address = patient.address || t.address || '-'

  const doctorName = doctor.name || row.doctorName || '-'
  const departmentName = dept.name || row.department || '-'

  const discount = Number(t.discount ?? t.pricing?.discount ?? 0)
  const payable = Number(t.payable ?? t.pricing?.finalFee ?? t.finalFee ?? row.fee ?? 0)
  const fee = Number(t.fee ?? t.pricing?.feeResolved ?? row.fee ?? 0)
  const paymentStatus = String(t.paymentStatus || 'paid')
  const isPaid = paymentStatus.toLowerCase() === 'paid'

  const receptionistName = String(t.receptionistName || '')
  const paymentMethod = String(t.paymentMethod || t.billingType || '')
  const accountNumberIban = String(t.accountNumberIban || '')

  const slotStart = t.slotStart || ''
  const slotEnd = t.slotEnd || ''
  const slotNo = t.slotNo != null ? String(t.slotNo) : ''
  const appointmentSlot = slotStart && slotEnd ? `${slotStart} - ${slotEnd}` : (slotNo ? `Slot #${slotNo}` : '-')

  const guardianCombined = `${guardianRel !== '-' ? guardianRel : ''}${guardianRel !== '-' && guardianName !== '-' ? ' ' : ''}${guardianName !== '-' ? guardianName : ''}`.trim() || '-'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Patient Details</h3>
            <div className="mt-0.5 text-xs text-slate-500">Token #{String(t.tokenNo || row.tokenNo || '-')} • {createdAt}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-800">Patient Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Patient Name" value={String(patientName)} />
              <Info label="MR Number" value={String(mrn)} />
              <Info label="Phone" value={String(phone)} />
              <Info label="Age" value={String(age)} />
              <Info label="Gender" value={String(gender)} />
              <Info label="Guardian" value={guardianCombined} />
              <Info label="CNIC" value={String(cnic)} />
              <Info label="Address" value={String(address)} full />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Doctor Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Doctor" value={String(doctorName)} />
              <Info label="Department" value={String(departmentName)} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Token Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Status" value={String(t.status || row.status || '')} />
              <Info label="Token No" value={String(t.tokenNo || row.tokenNo || '-')} />
              <Info label="Fee" value={`Rs. ${fee.toLocaleString()}`} />
              <Info label="Discount" value={`Rs. ${discount.toLocaleString()}`} />
              <Info label="Payable" value={`Rs. ${payable.toLocaleString()}`} />
              <Info label="Payment Status" value={paymentStatus.toUpperCase()} />
              <Info label="Payed to(Receptionist)" value={receptionistName || '-'} />
              {isPaid && <Info label="Payment Method" value={paymentMethod || '-'} />}
              {isPaid && paymentMethod === 'Card' && <Info label="Account Number/IBAN" value={accountNumberIban || '-'} />}
              <Info label="Appointment Slot" value={String(appointmentSlot)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }){
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} rounded-lg border border-slate-200 bg-slate-50 px-3 py-2`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800 break-words">{value || '-'}</div>
    </div>
  )
}

export default function Doctor_Patients() {
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [list, setList] = useState<Token[]>([])
  const [presEncounterIds, setPresEncounterIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const navigate = useNavigate()
  const [showDetails, setShowDetails] = useState(false)
  const [detailsRow, setDetailsRow] = useState<Token | null>(null)
  const [presMap, setPresMap] = useState<Record<string, string>>({})
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
        dateIso: t.dateIso,
        tokenNo: t.tokenNo,
        patientName: t.patientName || '-',
        mrNo: t.mrn || '-',
        raw: t,
        encounterId: String(t.encounterId || ''),
        doctorId: t.doctorId?._id || String(t.doctorId || ''),
        doctorName: t.doctorId?.name || '',
        department: t.departmentId?.name || '',
        fee: Number(t.fee || 0),
        status: t.status,
      }))
      const presIds: string[] = (presRes.prescriptions || []).map((p: any) => String(p.encounterId?._id || p.encounterId || ''))
      const map: Record<string, string> = {}
      ;(presRes.prescriptions || []).forEach((p: any) => {
        const encId = String(p.encounterId?._id || p.encounterId || '')
        const pid = String(p._id || p.id || '')
        if (encId && pid) map[encId] = pid
      })
      setList(items)
      setPresEncounterIds(presIds)
      setPresMap(map)
    } catch {
      // backend likely down; keep current list
    }
  }

  async function printPrescriptionByEncounter(encounterId?: string){
    try {
      const pid = encounterId ? presMap[String(encounterId)] : ''
      if (!pid) { alert('Prescription not found'); return }
      const [detail, settings] = await Promise.all([
        hospitalApi.getPrescription(pid) as any,
        hospitalApi.getSettings() as any,
      ])
      const pres = detail?.prescription
      let patient: any = { name: pres?.encounterId?.patientId?.fullName || '-', mrn: pres?.encounterId?.patientId?.mrn || '-' }
      try {
        if (patient?.mrn) {
          let p: any = null
          try {
            const resp: any = await labApi.getPatientByMrn(patient.mrn)
            p = resp?.patient || null
          } catch {}
          // Fallback: doctor portal may not have access to /lab routes; use hospital patient search (DB-backed)
          if (!p) {
            try {
              const resp: any = await hospitalApi.searchPatients({ mrn: String(patient.mrn), limit: 1 })
              const first = Array.isArray(resp?.patients) ? resp.patients[0] : null
              p = first || null
            } catch {}
          }
          if (p) {
            let ageTxt = ''
            try {
              if (p.age != null) ageTxt = String(p.age)
              else if (p.dob) { const dob = new Date(p.dob); if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now()-dob.getTime())/31557600000))) }
            } catch {}
            const gender = p.gender || p.sex || p.Gender || '-'
            const fatherName = p.fatherName || p.guardianName || p.guardian || p.father || p.father_name || '-'
            const phone = p.phoneNormalized || p.phone || p.phoneNumber || p.mobile || p.mobileNo || '-'
            const address = p.address || p.homeAddress || p.currentAddress || p.addressLine || '-'
            patient = { name: p.fullName || p.name || patient.name, mrn: p.mrn || p.mrNo || patient.mrn, gender, fatherName, phone, address, age: ageTxt }
          }
        }
      } catch {}

      // Try to enrich doctor info
      let doctor: any = { name: pres?.encounterId?.doctorId?.name || '-', specialization: '', qualification: '', departmentName: '', phone: '' }
      try {
        const drList: any = await hospitalApi.listDoctors()
        const doctors: any[] = drList?.doctors || []
        const drId = String(pres?.encounterId?.doctorId?._id || pres?.encounterId?.doctorId || '')
        const d = doctors.find(x => String(x._id || x.id) === drId)
        if (d) doctor = { name: d.name || doctor.name, specialization: d.specialization || '', qualification: d.qualification || '', departmentName: '', phone: d.phone || '' }
        try {
          const depRes: any = await hospitalApi.listDepartments()
          const depArray: any[] = (depRes?.departments || depRes || []) as any[]
          const deptName = d?.primaryDepartmentId ? (depArray.find((z: any)=> String(z._id||z.id) === String(d.primaryDepartmentId))?.name || '') : ''
          if (deptName) doctor.departmentName = deptName
        } catch {}
      } catch {}

      let tpl: PrescriptionPdfTemplate = 'default'
      try { const raw = localStorage.getItem(`doctor.rx.template.${doc?.id || 'anon'}`) as PrescriptionPdfTemplate | null; if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw } catch {}
      await previewPrescriptionPdf({
        doctor,
        settings,
        patient,
        items: pres?.items || [],
        vitals: pres?.vitals,
        primaryComplaint: pres?.primaryComplaint || pres?.complaints,
        primaryComplaintHistory: pres?.primaryComplaintHistory,
        familyHistory: pres?.familyHistory,
        allergyHistory: pres?.allergyHistory,
        treatmentHistory: pres?.treatmentHistory,
        history: pres?.history,
        examFindings: pres?.examFindings,
        diagnosis: pres?.diagnosis,
        advice: pres?.advice,
        labTests: pres?.labTests || [],
        labNotes: pres?.labNotes || '',
        diagnosticTests: pres?.diagnosticTests || [],
        diagnosticNotes: pres?.diagnosticNotes || '',
        therapyTests: pres?.therapyTests || [],
        therapyNotes: pres?.therapyNotes || '',
        createdAt: pres?.createdAt,
      }, tpl)
    } catch (e: any) {
      alert(e?.message || 'Failed to open prescription')
    }
  }

  const myQueue = useMemo(() => {
    const presSet = new Set(presEncounterIds.filter(Boolean))
    return (list || [])
      .filter(t => t.doctorId === doc?.id && t.status === 'queued' && (!t.encounterId || !presSet.has(String(t.encounterId))))
      .sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())
  }, [list, doc, presEncounterIds])

  const completed = useMemo(() => {
    const presSet = new Set(presEncounterIds.filter(Boolean))
    return (list || [])
      .filter(t => t.doctorId === doc?.id && t.status !== 'cancelled' && !!t.encounterId && presSet.has(String(t.encounterId)))
      .sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())
  }, [list, doc, presEncounterIds])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return myQueue
    return myQueue.filter(t => [t.patientName, t.mrNo]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q)))
  }, [myQueue, query])

  const visibleCompleted = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return completed
    return completed.filter(t => [t.patientName, t.mrNo]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q)))
  }, [completed, query])

  // Match Hospital portal token date logic (UTC yyyy-mm-dd)
  const todayLabel = useMemo(() => new Date().toISOString().slice(0,10), [])
  const yesterdayLabel = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0,10)
  }, [])

  const headingForDate = (iso: string) => {
    const key = String(iso || '').slice(0, 10)
    if (!key || key === 'Unknown') return 'Patients'
    if (hasDateRange) return key
    if (key === todayLabel) return `Today's Patients (${key})`
    if (key === yesterdayLabel) return `Yesterday Patients (${key})`
    return `Patients (${key})`
  }

  const getTokenDateIso = (t: Token) => String(t.dateIso || String(t.createdAt || '').slice(0,10) || '')

  const hasDateRange = Boolean(from || to)
  const dateRangeLabel = useMemo(() => {
    if (!hasDateRange) return ''
    const a = from || '...'
    const b = to || '...'
    return `${a} to ${b}`
  }, [from, to, hasDateRange])

  const groupByDate = (rows: Token[]) => {
    const map: Record<string, Token[]> = {}
    for (const r of rows) {
      const k = getTokenDateIso(r) || 'Unknown'
      if (hasDateRange && k && k !== 'Unknown') {
        if (from && k < from) continue
        if (to && k > to) continue
      }
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    // stable order inside each day
    for (const k of Object.keys(map)) {
      map[k].sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())
    }
    const keys = Object.keys(map).sort((a,b)=> (a>b?-1:a<b?1:0))
    return { keys, map }
  }

  const queuedGrouped = useMemo(() => groupByDate(visible), [visible])
  const completedGrouped = useMemo(() => groupByDate(visibleCompleted), [visibleCompleted])

  const queuedToday = useMemo(() => visible.filter(t => getTokenDateIso(t) === todayLabel), [visible, todayLabel])
  const queuedYesterday = useMemo(() => visible.filter(t => getTokenDateIso(t) === yesterdayLabel), [visible, yesterdayLabel])
  const completedToday = useMemo(() => visibleCompleted.filter(t => getTokenDateIso(t) === todayLabel), [visibleCompleted, todayLabel])
  const completedYesterday = useMemo(() => visibleCompleted.filter(t => getTokenDateIso(t) === yesterdayLabel), [visibleCompleted, yesterdayLabel])

  const renderRow = (t: Token, idx: number, allowActions: boolean) => (
    <div key={t._id} className="flex items-center justify-between px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{idx+1}</div>
        <div>
          <div className="font-medium">{t.patientName}</div>
          <div className="text-xs text-slate-500">MR: {t.mrNo} • {new Date(t.createdAt).toLocaleTimeString()}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {allowActions ? (
          <>
            <span className="rounded border border-slate-200 px-2 py-1 text-slate-700">Queued</span>
            <button
              type="button"
              className="rounded-md border border-slate-300 p-1 text-slate-700 hover:bg-slate-50"
              onClick={()=>{ setDetailsRow(t); setShowDetails(true) }}
              aria-label="View Details"
              title="View Details"
            >
              <Eye size={16} />
            </button>
            <button
              type="button"
              className="rounded-md border border-blue-800 px-2 py-1 text-blue-800 hover:bg-blue-50"
              onClick={()=>{
                const date = String(t.dateIso || String(t.createdAt||'').slice(0,10) || '')
                navigate('/doctor/prescription', { state: { tokenId: t._id, mrn: t.mrNo, encounterId: t.encounterId, date } })
              }}
            >Enter Prescription</button>
          </>
        ) : (
          <>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">Completed</span>
            <button
              type="button"
              className="rounded-md border border-slate-300 p-1 text-slate-700 hover:bg-slate-50"
              onClick={()=>{ setDetailsRow(t); setShowDetails(true) }}
              aria-label="View Details"
              title="View Details"
            >
              <Eye size={16} />
            </button>
            <button
              type="button"
              className="rounded-md border border-blue-800 px-2 py-1 text-blue-800 hover:bg-blue-50"
              onClick={()=>printPrescriptionByEncounter(t.encounterId)}
            >Prescription</button>
          </>
        )}
      </div>
    </div>
  )


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xl font-semibold text-slate-800">Queued Patients</div>
        </div>
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
        {hasDateRange ? (
          <>
            <div className="border-t border-slate-200" />
            <div className="px-4 py-3 text-xs font-semibold text-slate-700">Patients ({dateRangeLabel})</div>
            {queuedGrouped.keys.map((k) => (
              <div key={`q_${k}`}>
                <div className="border-t border-slate-200" />
                <div className="px-4 py-3 text-xs font-semibold text-slate-700">{headingForDate(k)}</div>
                <div className="divide-y divide-slate-200">
                  {(queuedGrouped.map[k] || []).map((t, idx) => renderRow(t, idx, true))}
                </div>
              </div>
            ))}
            {queuedGrouped.keys.length === 0 && (
              <>
                <div className="border-t border-slate-200" />
                <div className="px-4 py-6 text-center text-slate-500">No queued patients for selected range</div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="border-t border-slate-200" />
            <div className="px-4 py-3 text-xs font-semibold text-slate-700">Today's Patients ({todayLabel})</div>
            <div className="divide-y divide-slate-200">
              {queuedToday.map((t, idx) => renderRow(t, idx, true))}
              {queuedToday.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-500">No queued patients for today</div>
              )}
            </div>

            <div className="border-t border-slate-200" />
            <div className="px-4 py-3 text-xs font-semibold text-slate-700">Yesterday Patients ({yesterdayLabel})</div>
            <div className="divide-y divide-slate-200">
              {queuedYesterday.map((t, idx) => renderRow(t, idx, true))}
              {queuedYesterday.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-500">No queued patients for yesterday</div>
              )}
            </div>
          </>
        )}
      </div>

      {showDetails && (
        <TokenDetailsDialog
          open={showDetails}
          onClose={()=>{ setShowDetails(false); setDetailsRow(null) }}
          row={detailsRow}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">Completed Patients</div>
          <div className="mt-0.5 text-xs text-slate-500">Prescription submitted/finalized</div>
        </div>

        {hasDateRange ? (
          <>
            <div className="border-t border-slate-200" />
            <div className="px-4 py-3 text-xs font-semibold text-slate-700">Patients ({dateRangeLabel})</div>
            {completedGrouped.keys.map((k) => (
              <div key={`c_${k}`}>
                <div className="border-t border-slate-200" />
                <div className="px-4 py-3 text-xs font-semibold text-slate-700">{headingForDate(k)}</div>
                <div className="divide-y divide-slate-200">
                  {(completedGrouped.map[k] || []).map((t, idx) => renderRow(t, idx, false))}
                </div>
              </div>
            ))}
            {completedGrouped.keys.length === 0 && (
              <>
                <div className="border-t border-slate-200" />
                <div className="px-4 py-6 text-center text-slate-500">No completed patients for selected range</div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="px-4 py-3 text-xs font-semibold text-slate-700">Today's Patients ({todayLabel})</div>
            <div className="divide-y divide-slate-200">
              {completedToday.map((t, idx) => renderRow(t, idx, false))}
              {completedToday.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-500">No completed patients for today</div>
              )}
            </div>

            <div className="border-t border-slate-200" />
            <div className="px-4 py-3 text-xs font-semibold text-slate-700">Yesterday Patients ({yesterdayLabel})</div>
            <div className="divide-y divide-slate-200">
              {completedYesterday.map((t, idx) => renderRow(t, idx, false))}
              {completedYesterday.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-500">No completed patients for yesterday</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
