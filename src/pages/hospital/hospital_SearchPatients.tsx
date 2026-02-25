import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { hospitalApi, labApi, diagnosticApi } from '../../utils/api'
import { previewPrescriptionPdf } from '../../utils/prescriptionPdf'
import type { PrescriptionPdfTemplate } from '../../utils/prescriptionPdf'
import { printUltrasoundReport } from '../../components/diagnostic/diagnostic_UltrasoundGeneric'
import { printCTScanReport } from '../../components/diagnostic/diagnostic_CTScan'
import { printEchocardiographyReport } from '../../components/diagnostic/diagnostic_Echocardiography'
import { printColonoscopyReport } from '../../components/diagnostic/diagnostic_Colonoscopy'
import { printUpperGIEndoscopyReport } from '../../components/diagnostic/diagnostic_UpperGIEndoscopy'
import { previewLabReportPdf } from '../../utils/printLabReport'
import { Eye, X } from 'lucide-react'

export default function Hospital_SearchPatients() {
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    mrNo: '',
    name: '',
    fatherName: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [details, setDetails] = useState<Record<string, { patient?: any; pres?: any[]; lab?: any[]; diag?: any[]; ipd?: any[]; loading?: boolean }>>({})
  const [busy, setBusy] = useState<{ pres?: string; lab?: string; diag?: string }>({})
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false)
  const [patientDetailsRow, setPatientDetailsRow] = useState<any | null>(null)

  const update = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setPatients([])
    setExpanded({})
    setDetails({})
    try {
      const isDoctorPortal = String(location?.pathname || '').startsWith('/doctor')
      let doctorId: string | undefined
      if (isDoctorPortal) {
        try {
          const raw = localStorage.getItem('doctor.session')
          const sess = raw ? JSON.parse(raw) : null
          doctorId = sess?.id ? String(sess.id) : undefined
        } catch {}
      }
      const res: any = await hospitalApi.searchPatients({ mrn: form.mrNo || undefined, name: form.name || undefined, fatherName: form.fatherName || undefined, phone: form.phone || undefined, limit: 10, doctorId })
      const rows: any[] = Array.isArray(res?.patients) ? res.patients : []
      setPatients(rows)
    } catch {
      setPatients([])
    } finally {
      setLoading(false)
    }

  }

  // If we were navigated back with a snapshot in location.state, restore from it and clear the transient state
  useEffect(()=>{
    try{
      const st: any = (location as any)?.state
      if (st?.searchSnapshot){
        const snap = st.searchSnapshot
        if (snap?.form) setForm(snap.form)
        if (Array.isArray(snap?.patients)) setPatients(snap.patients)
        if (snap?.expanded) setExpanded(snap.expanded)
        if (snap?.details) setDetails(snap.details)
        try{ sessionStorage.setItem('hospital.searchPatients.v1', JSON.stringify(snap)) } catch {}
        navigate('.', { replace: true, state: null })
      }
    } catch {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  

  // Persist and restore search state so going back from IPD Profile keeps results
  useEffect(()=>{
    try{
      const raw = sessionStorage.getItem('hospital.searchPatients.v1')
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved?.form) setForm(saved.form)
      if (Array.isArray(saved?.patients)) setPatients(saved.patients)
      if (saved?.expanded) setExpanded(saved.expanded)
      if (saved?.details) setDetails(saved.details)
    } catch {}
  }, [])
  useEffect(()=>{
    try{
      // Sanitize patients so JSON.stringify never fails on circular/complex objects
      const patientsLite = Array.isArray(patients)
        ? patients.map((p:any) => ({
            _id: p?._id || p?.id,
            id: p?.id,
            fullName: p?.fullName,
            mrn: p?.mrn,
            fatherName: p?.fatherName,
            phoneNormalized: p?.phoneNormalized,
          }))
        : []
      const payload = { form, patients: patientsLite, expanded, details }
      sessionStorage.setItem('hospital.searchPatients.v1', JSON.stringify(payload))
    } catch {}
  }, [form, patients, expanded, details])
  
  async function onPrescriptionPdf(presId: string, mrn: string){
    try {
      setBusy(prev => ({ ...prev, pres: presId }))
      const [detail, settings] = await Promise.all([
        hospitalApi.getPrescription(presId) as any,
        hospitalApi.getSettings() as any,
      ])
      const pres = detail?.prescription

      // Read history taking from DB (staff module) for this encounter
      let historyTaking: any = null
      const encounterId = String(pres?.encounterId?._id || pres?.encounterId || '')
      try {
        if (encounterId) {
          const ht: any = await hospitalApi.getHistoryTaking(encounterId)
          historyTaking = ht?.historyTaking?.data || null
        }
      } catch {}

      // Fallback vitals from history taking (matches prescription history)
      const vitalsFromHistoryTaking = (() => {
        const d: any = historyTaking || null
        if (!d) return undefined
        const p2 = d.personalInfo || d.personal_info || d.personal || d.patient || d
        const num = (x: any) => {
          if (x == null) return undefined
          const v = parseFloat(String(x).trim())
          return isFinite(v) ? v : undefined
        }
        const bpRaw = p2?.bp ?? p2?.BP ?? p2?.bloodPressure ?? p2?.blood_pressure
        let sys: number | undefined
        let dia: number | undefined
        if (typeof bpRaw === 'string') {
          const s = String(bpRaw).trim()
          if (s.includes('/')) {
            const m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
            if (m) { sys = num(m[1]); dia = num(m[2]) }
          } else {
            sys = num(s)
          }
        } else if (bpRaw && typeof bpRaw === 'object') {
          sys = num(bpRaw.sys ?? bpRaw.systolic ?? bpRaw.bloodPressureSys)
          dia = num(bpRaw.dia ?? bpRaw.diastolic ?? bpRaw.bloodPressureDia)
        }
        const heightCm = num(p2?.heightCm ?? p2?.height_cm ?? p2?.height)
        const weightKg = num(p2?.weightKg ?? p2?.weight_kg ?? p2?.weight)
        if (sys == null && dia == null && heightCm == null && weightKg == null) return undefined
        return {
          bloodPressureSys: sys,
          bloodPressureDia: dia,
          heightCm,
          weightKg,
        }
      })()
      const vitals = pres?.vitals || vitalsFromHistoryTaking

      // Try to enrich doctor info (same behavior as prescription history)
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

      let p: any = null
      try {
        const labPat: any = await labApi.getPatientByMrn(mrn)
        p = labPat?.patient || null
      } catch {}
      if (!p) {
        try {
          const prof: any = await hospitalApi.getPatientProfile(mrn)
          p = prof?.patient || null
        } catch {}
      }
      if (!p) {
        try {
          const resp: any = await hospitalApi.searchPatients({ mrn, limit: 1 })
          p = Array.isArray(resp?.patients) ? resp.patients[0] : null
        } catch {}
      }
      let ageTxt = ''
      try {
        if (p?.age != null && String(p.age).trim()) ageTxt = String(p.age).trim()
        else if (p?.dob) {
          const dob = new Date(p.dob)
          if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now()-dob.getTime())/31557600000)))
        }
      } catch {}
      const patient = { name: p?.fullName || pres?.encounterId?.patientId?.fullName || '-', mrn: p?.mrn || p?.mrNo || pres?.encounterId?.patientId?.mrn || mrn, gender: p?.gender || p?.sex || '-', fatherName: p?.fatherName || p?.guardianName || '-', age: ageTxt || '-', phone: p?.phoneNormalized || p?.phone || '-', address: p?.address || '-' }

      let tpl: PrescriptionPdfTemplate = 'default'
      try {
        const docId = String(pres?.encounterId?.doctorId?._id || pres?.encounterId?.doctorId || '')
        const raw = localStorage.getItem(`doctor.rx.template.${docId || 'anon'}`) as PrescriptionPdfTemplate | null
        if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw
      } catch {}

      await previewPrescriptionPdf({
        doctor,
        settings,
        patient,
        items: pres?.medicine || pres?.items || [],
        historyTaking,
        vitals,
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
        therapyPlan: pres?.therapyPlan,
        therapyMachines: pres?.therapyMachines,
        counselling: pres?.counselling,
        createdAt: pres?.createdAt,
      }, tpl)
    } catch (e: any) {
      alert(e?.message || 'Failed to generate prescription PDF')
    } finally {
      setBusy(prev => ({ ...prev, pres: undefined }))
    }
  }

  function resolveDiagKey(name: string){
    const n = (name||'').toLowerCase()
    if (n.includes('ultrasound')) return 'Ultrasound'
    if (n.replace(/\s+/g,'') === 'ctscan') return 'CTScan'
    if (n.includes('echocardio')) return 'Echocardiography'
    if (n.includes('colonoscopy')) return 'Colonoscopy'
    if (n.includes('uppergi')) return 'UpperGiEndoscopy'
    return name
  }

  async function onDiagnosticPrint(orderId: string, mrn: string){
    try{
      setBusy(prev => ({ ...prev, diag: orderId }))
      const [ordersRes, resultsRes] = await Promise.all([
        diagnosticApi.listOrders({ q: mrn, limit: 500 }) as any,
        diagnosticApi.listResults({ orderId, status: 'final', limit: 1 }) as any,
      ])
      const ord: any = (ordersRes?.items || []).find((x: any) => String(x._id || x.id) === String(orderId))
      if (!ord) throw new Error('Order not found')
      const res = Array.isArray(resultsRes?.items) && resultsRes.items.length ? resultsRes.items[0] : null
      if (!res) throw new Error('No finalized report')
      const testName = String(res.testName || '')
      const key = resolveDiagKey(testName)
      const payload = { tokenNo: ord.tokenNo, createdAt: ord.createdAt, reportedAt: res.reportedAt || new Date().toISOString(), patient: ord.patient||{}, value: typeof res.formData==='string'? res.formData : JSON.stringify(res.formData||''), referringConsultant: ord.referringConsultant }
      if (key === 'Echocardiography'){ await printEchocardiographyReport(payload as any); return }
      if (key === 'Ultrasound'){ await printUltrasoundReport(payload as any); return }
      if (key === 'CTScan'){ await printCTScanReport(payload as any); return }
      if (key === 'Colonoscopy'){ await printColonoscopyReport(payload as any); return }
      if (key === 'UpperGiEndoscopy'){ await printUpperGIEndoscopyReport(payload as any); return }
      alert('Unknown diagnostic template for this test')
    } catch(e: any){
      alert(e?.message || 'Failed to open diagnostic report')
    } finally {
      setBusy(prev => ({ ...prev, diag: undefined }))
    }
  }

  async function onLabPdf(orderId: string, mrn: string){
    try {
      setBusy(prev => ({ ...prev, lab: orderId }))
      // Find the order to get patient/times
      const list: any = await labApi.listOrders({ q: mrn, limit: 500 })
      const ord: any = (list?.items || []).find((x: any) => String(x._id || x.id) === String(orderId))
      if (!ord) throw new Error('Order not found')
      const res: any = await labApi.listResults({ orderId, limit: 1 })
      const rec = Array.isArray(res?.items) && res.items.length ? res.items[0] : null
      if (!rec) throw new Error('No report available')
      previewLabReportPdf({
        tokenNo: ord.tokenNo,
        createdAt: ord.createdAt,
        sampleTime: ord.sampleTime,
        reportingTime: ord.reportingTime,
        patient: { fullName: ord.patient?.fullName, phone: ord.patient?.phone, mrn: ord.patient?.mrn, age: ord.patient?.age, gender: ord.patient?.gender, address: ord.patient?.address },
        rows: rec.rows || [],
        interpretation: rec.interpretation || '',
        referringConsultant: ord.referringConsultant,
      })
    } catch (e: any) {
      alert(e?.message || 'Failed to open lab report PDF')
    } finally {
      setBusy(prev => ({ ...prev, lab: undefined }))
    }
  }
  const onClear = () => {
    setForm({ mrNo: '', name: '', fatherName: '', phone: '' })
    setPatients([])
    setExpanded({})
    setDetails({})
    try{ sessionStorage.removeItem('hospital.searchPatients.v1') } catch {}
  }

  async function loadDetails(mrn: string){
    setDetails(prev => ({ ...prev, [mrn]: { ...(prev[mrn]||{}), loading: true } }))
    try {
      // Prefer single backend-driven endpoint for both portals (more consistent + fewer calls)
      try {
        const res: any = await hospitalApi.getPatientProfile(mrn)
        const pres: any[] = (res?.pres || []).map((p: any) => ({ id: p.id || p._id, createdAt: p.createdAt, diagnosis: p.diagnosis, doctor: p.doctor || '-', items: p.medicine || p.items || [] }))
        const lab: any[] = (res?.lab || [])
        const diag: any[] = (res?.diag || [])
        const patient = res?.patient || null
        setDetails(prev => ({ ...prev, [mrn]: { patient, pres, lab, diag, ipd: [], loading: false } }))
        return
      } catch {}

      let patient: any = null
      try {
        const resp: any = await labApi.getPatientByMrn(mrn)
        patient = resp?.patient || null
      } catch {}
      const [presRes, ordersRes, diagOrdersRes] = await Promise.all([
        hospitalApi.listPrescriptions({ patientMrn: mrn, page: 1, limit: 50 }) as any,
        labApi.listOrders({ q: mrn, limit: 50 }) as any,
        diagnosticApi.listOrders({ q: mrn, limit: 50 }) as any,
      ])
      const pres: any[] = (presRes?.prescriptions || []).map((p: any) => ({ id: p._id || p.id, createdAt: p.createdAt, diagnosis: p.diagnosis, doctor: p.encounterId?.doctorId?.name || '-', items: p.medicine || p.items || [] }))
      const orders: any[] = (ordersRes?.items || [])
      const lab: any[] = []
      for (const o of orders){
        let hasResult = false
        try {
          const r = await labApi.listResults({ orderId: String(o._id || o.id), limit: 1 }) as any
          hasResult = Array.isArray(r?.items) && r.items.length > 0
        } catch {}
        lab.push({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult })
      }
      const dorders: any[] = (diagOrdersRes?.items || [])
      const diag: any[] = []
      for (const o of dorders){
        let hasResult = false
        try {
          const r = await diagnosticApi.listResults({ orderId: String(o._id || o.id), status: 'final', limit: 1 }) as any
          hasResult = Array.isArray(r?.items) && r.items.length > 0
        } catch {}
        diag.push({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult })
      }
      setDetails(prev => ({ ...prev, [mrn]: { patient, pres, lab, diag, ipd: [], loading: false } }))
    } catch {
      setDetails(prev => ({ ...prev, [mrn]: { patient: null, pres: [], lab: [], diag: [], ipd: [], loading: false } }))
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800">Patient Profile Mangement</h2>

      <form onSubmit={onSearch} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">MR Number</label>
            <input value={form.mrNo} onChange={e=>update('mrNo', e.target.value)} placeholder="MR123456" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
            <input value={form.name} onChange={e=>update('name', e.target.value)} placeholder="Full or partial name" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Father Name</label>
            <input value={form.fatherName} onChange={e=>update('fatherName', e.target.value)} placeholder="Guardian's name" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
            <input value={form.phone} onChange={e=>update('phone', e.target.value)} placeholder="03001234567" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50" disabled={loading}>{loading?'Searching...':'Search Patients'}</button>
          <button type="button" onClick={onClear} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Clear Filters</button>
        </div>
      </form>

      {patients.length>0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
            <div className="font-medium text-slate-800">Results</div>
            <div className="text-slate-600">{patients.length} patient{patients.length!==1?'s':''}</div>
          </div>
          <div className="divide-y divide-slate-200">
            {patients.map((p, idx) => (
              <div key={String(p._id||idx)} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.fullName || '-'} <span className="text-xs text-slate-500">{p.mrn || '-'}</span></div>
                  <div className="text-xs text-slate-600">{p.phoneNormalized || ''}</div>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">Father Name: {p.fatherName || '-'}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    onClick={()=>{
                      const mrn = String(p.mrn||'')
                      setExpanded(prev => ({ ...prev, [mrn]: !prev[mrn] }))
                      if (!details[mrn]) loadDetails(mrn)
                    }}
                  >{expanded[String(p.mrn||'')] ? 'Hide Data' : 'View Data'}</button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 p-1 text-slate-700 hover:bg-slate-50"
                    onClick={()=>{ setPatientDetailsRow(p); setPatientDetailsOpen(true) }}
                    aria-label="View Details"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                </div>
                {expanded[String(p.mrn||'')] && (
                  (()=>{
                    const isDoctorPortal = String(location?.pathname || '').startsWith('/doctor')
                    const mrnKey = String(p.mrn||'')
                    const d = details[mrnKey] || {}

                    const pdet = d.patient || null
                    const patientCard = pdet ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <div className="text-[10px] font-bold text-slate-900">PATIENT DETAILS</div>
                        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div><span className="font-semibold">Name:</span> {pdet.fullName || '-'}</div>
                          <div><span className="font-semibold">MR:</span> {pdet.mrn || mrnKey || '-'}</div>
                          <div><span className="font-semibold">Phone:</span> {pdet.phoneNormalized || '-'}</div>
                          <div><span className="font-semibold">CNIC:</span> {pdet.cnicNormalized || pdet.cnic || '-'}</div>
                          <div><span className="font-semibold">Gender:</span> {pdet.gender || '-'}</div>
                          <div><span className="font-semibold">Age:</span> {pdet.age || '-'}</div>
                          <div className="sm:col-span-2"><span className="font-semibold">Address:</span> {pdet.address || '-'}</div>
                        </div>
                      </div>
                    ) : null

                    if (isDoctorPortal){
                      const toDay = (v: any) => {
                        try {
                          const dt = new Date(v)
                          if (isNaN(dt.getTime())) return 'Unknown'
                          const y = dt.getFullYear()
                          const m = String(dt.getMonth() + 1).padStart(2, '0')
                          const d2 = String(dt.getDate()).padStart(2, '0')
                          return `${y}-${m}-${d2}`
                        } catch {
                          return 'Unknown'
                        }
                      }
                      const presAll: any[] = Array.isArray(d.pres) ? d.pres : []
                      const labAll: any[] = Array.isArray(d.lab) ? (d.lab.filter((lr: any)=>!!lr?.hasResult)) : []
                      const diagAll: any[] = Array.isArray(d.diag) ? (d.diag.filter((dr: any)=>!!dr?.hasResult)) : []
                      const visitKeys = Array.from(new Set([
                        ...presAll.map((x:any)=>toDay(x.createdAt)),
                        ...labAll.map((x:any)=>toDay(x.createdAt)),
                        ...diagAll.map((x:any)=>toDay(x.createdAt)),
                      ].filter((x: any) => x != null && String(x).trim() !== '')))
                        .sort((a,b)=> (a>b?-1:a<b?1:0))

                      const presEmpty = (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                          <div className="text-[10px] font-bold text-slate-900">PRESCRIPTION</div>
                          <div className="mt-2 text-slate-600">No prescriptions found</div>
                        </div>
                      )
                      const labEmpty = (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                          <div className="text-[10px] font-bold text-slate-900">LAB REPORT</div>
                          <div className="mt-2 text-slate-600">No lab reports found</div>
                        </div>
                      )
                      const diagEmpty = (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                          <div className="text-[10px] font-bold text-slate-900">DIAGNOSTIC REPORT</div>
                          <div className="mt-2 text-slate-600">No diagnostic reports found</div>
                        </div>
                      )

                      return (
                        <div className="mt-3 space-y-3">
                          {(d.loading) && <div className="p-3 text-xs text-slate-500">Loading...</div>}
                          {(!d.loading) && (
                            <>
                              {visitKeys.length===0 && (
                                <div className="rounded-lg border border-blue-800 bg-white p-3">
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {presEmpty}
                                    {labEmpty}
                                    {diagEmpty}
                                  </div>
                                </div>
                              )}
                              {visitKeys.map((vk: string) => {
                                const presFor = presAll.filter((x:any)=>toDay(x.createdAt)===vk)
                                const labFor = labAll.filter((x:any)=>toDay(x.createdAt)===vk)
                                const diagFor = diagAll.filter((x:any)=>toDay(x.createdAt)===vk)

                                return (
                                  <div key={`visit_${vk}`} className="rounded-lg border border-blue-800 bg-white p-3">
                                    <div className="mb-2 text-xs font-semibold text-slate-800">Visit: {vk}</div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                      <div className="space-y-3">
                                        {presFor.length ? presFor.map((pr: any) => (
                                          <div key={`pres_${String(pr.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="text-[10px] font-bold text-slate-900">PRESCRIPTION</div>
                                            <div className="mt-1 font-semibold text-slate-800">{new Date(pr.createdAt).toLocaleString()}</div>
                                            <div className="mt-0.5 text-slate-600">Doctor: {pr.doctor || '-'}</div>
                                            <div className="mt-2 text-slate-700"><span className="font-semibold">Diagnosis / Disease:</span> {pr.diagnosis || '-'}</div>
                                            <div className="mt-2">
                                              <button
                                                className="rounded-md border border-blue-800 px-2 py-1 text-xs text-blue-800 hover:bg-blue-50"
                                                onClick={()=>onPrescriptionPdf(String(pr.id), String(p.mrn||''))}
                                                disabled={busy.pres===String(pr.id)}
                                              >{busy.pres===String(pr.id)?'Generating...':'Prescription PDF'}</button>
                                            </div>
                                          </div>
                                        )) : presEmpty}
                                      </div>

                                      <div className="space-y-3">
                                        {labFor.length ? labFor.map((lr: any) => (
                                          <div key={`lab_${String(lr.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="text-[10px] font-bold text-slate-900">LAB REPORT</div>
                                            <div className="mt-1 font-semibold text-slate-800">{new Date(lr.createdAt).toLocaleString()}</div>
                                            <div className="mt-0.5 text-slate-600">Token: {lr.tokenNo || '-'}</div>
                                            <div className="mt-2 flex items-center justify-between gap-2">
                                              <div className="text-slate-700">Status: {lr.status || '-'}</div>
                                              <div className="flex items-center gap-2">
                                                <>
                                                  <Link to={`/lab/results?orderId=${encodeURIComponent(lr.id)}&token=${encodeURIComponent(lr.tokenNo||'')}`} className="text-sky-700 hover:underline">Open Report</Link>
                                                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={()=>onLabPdf(String(lr.id), String(p.mrn||''))} disabled={busy.lab===String(lr.id)}>{busy.lab===String(lr.id)?'Opening...':'Lab Report PDF'}</button>
                                                </>
                                              </div>
                                            </div>
                                          </div>
                                        )) : labEmpty}
                                      </div>

                                      <div className="space-y-3">
                                        {diagFor.length ? diagFor.map((dr: any) => (
                                          <div key={`diag_${String(dr.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="text-[10px] font-bold text-slate-900">DIAGNOSTIC REPORT</div>
                                            <div className="mt-1 font-semibold text-slate-800">{new Date(dr.createdAt).toLocaleString()}</div>
                                            <div className="mt-0.5 text-slate-600">Token: {dr.tokenNo || '-'}</div>
                                            <div className="mt-2 flex items-center justify-between gap-2">
                                              <div className="text-slate-700">Status: {dr.status || '-'}</div>
                                              <div className="flex items-center gap-2">
                                                <button onClick={()=>onDiagnosticPrint(String(dr.id), String(p.mrn||''))} className="rounded-md border border-slate-300 px-2 py-1 text-xs" disabled={busy.diag===String(dr.id)}>{busy.diag===String(dr.id)?'Opening...':'Open Report'}</button>
                                              </div>
                                            </div>
                                          </div>
                                        )) : diagEmpty}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )
                    }

                    // Hospital portal layout: match doctor portal "Visit" grouping UI
                    const toDay = (v: any) => {
                      try {
                        const dt = new Date(v)
                        if (isNaN(dt.getTime())) return 'Unknown'
                        const y = dt.getFullYear()
                        const m = String(dt.getMonth() + 1).padStart(2, '0')
                        const d2 = String(dt.getDate()).padStart(2, '0')
                        return `${y}-${m}-${d2}`
                      } catch {
                        return 'Unknown'
                      }
                    }

                    const presAll: any[] = Array.isArray(d.pres) ? d.pres : []
                    const labAll: any[] = Array.isArray(d.lab) ? (d.lab.filter((lr: any)=>!!lr?.hasResult)) : []
                    const diagAll: any[] = Array.isArray(d.diag) ? (d.diag.filter((dr: any)=>!!dr?.hasResult)) : []
                    const visitKeys = Array.from(new Set([
                      ...presAll.map((x:any)=>toDay(x.createdAt)),
                      ...labAll.map((x:any)=>toDay(x.createdAt)),
                      ...diagAll.map((x:any)=>toDay(x.createdAt)),
                    ].filter((x: any) => x != null && String(x).trim() !== '')))
                      .sort((a,b)=> (a>b?-1:a<b?1:0))

                    const presEmpty = (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <div className="text-[10px] font-bold text-slate-900">PRESCRIPTION</div>
                        <div className="mt-2 text-slate-600">No prescriptions found</div>
                      </div>
                    )
                    const labEmpty = (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <div className="text-[10px] font-bold text-slate-900">LAB REPORT</div>
                        <div className="mt-2 text-slate-600">No lab reports found</div>
                      </div>
                    )
                    const diagEmpty = (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <div className="text-[10px] font-bold text-slate-900">DIAGNOSTIC REPORT</div>
                        <div className="mt-2 text-slate-600">No diagnostic reports found</div>
                      </div>
                    )

                    return (
                      <div className="mt-3 space-y-3">
                        {(details[String(p.mrn||'')]?.loading) && <div className="p-3 text-xs text-slate-500">Loading...</div>}
                        {(!details[String(p.mrn||'')]?.loading) && (
                          <>
                            {visitKeys.length===0 && (
                              <div className="rounded-lg border border-blue-800 bg-white p-3">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  {presEmpty}
                                  {labEmpty}
                                  {diagEmpty}
                                </div>
                              </div>
                            )}
                            {visitKeys.map((vk: string) => {
                              const presFor = presAll.filter((x:any)=>toDay(x.createdAt)===vk)
                              const labFor = labAll.filter((x:any)=>toDay(x.createdAt)===vk)
                              const diagFor = diagAll.filter((x:any)=>toDay(x.createdAt)===vk)

                              return (
                                <div key={`visit_${vk}`} className="rounded-lg border border-blue-800 bg-white p-3">
                                  <div className="mb-2 text-xs font-semibold text-slate-800">Visit: {vk}</div>
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="space-y-3">
                                      {presFor.length ? presFor.map((pr: any) => (
                                        <div key={`pres_${String(pr.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                          <div className="text-[10px] font-bold text-slate-900">PRESCRIPTION</div>
                                          <div className="mt-1 font-semibold text-slate-800">{new Date(pr.createdAt).toLocaleString()}</div>
                                          <div className="mt-0.5 text-slate-600">Doctor: {pr.doctor || '-'}</div>
                                          <div className="mt-2 text-slate-700"><span className="font-semibold">Diagnosis / Disease:</span> {pr.diagnosis || '-'}</div>
                                          <div className="mt-2">
                                            <button
                                              className="rounded-md border border-blue-800 px-2 py-1 text-xs text-blue-800 hover:bg-blue-50"
                                              onClick={()=>onPrescriptionPdf(String(pr.id), String(p.mrn||''))}
                                              disabled={busy.pres===String(pr.id)}
                                            >{busy.pres===String(pr.id)?'Generating...':'Prescription PDF'}</button>
                                          </div>
                                        </div>
                                      )) : presEmpty}
                                    </div>

                                    <div className="space-y-3">
                                      {labFor.length ? labFor.map((lr: any) => (
                                        <div key={`lab_${String(lr.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                          <div className="text-[10px] font-bold text-slate-900">LAB REPORT</div>
                                          <div className="mt-1 font-semibold text-slate-800">{new Date(lr.createdAt).toLocaleString()}</div>
                                          <div className="mt-0.5 text-slate-600">Token: {lr.tokenNo || '-'}</div>
                                          <div className="mt-2 flex items-center justify-between gap-2">
                                            <div className="text-slate-700">Status: {lr.status || '-'}</div>
                                            <div className="flex items-center gap-2">
                                              <>
                                                <Link to={`/lab/results?orderId=${encodeURIComponent(lr.id)}&token=${encodeURIComponent(lr.tokenNo||'')}`} className="text-sky-700 hover:underline">Open Report</Link>
                                                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={()=>onLabPdf(String(lr.id), String(p.mrn||''))} disabled={busy.lab===String(lr.id)}>{busy.lab===String(lr.id)?'Opening...':'Lab Report PDF'}</button>
                                              </>
                                            </div>
                                          </div>
                                        </div>
                                      )) : labEmpty}
                                    </div>

                                    <div className="space-y-3">
                                      {diagFor.length ? diagFor.map((dr: any) => (
                                        <div key={`diag_${String(dr.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                          <div className="text-[10px] font-bold text-slate-900">DIAGNOSTIC REPORT</div>
                                          <div className="mt-1 font-semibold text-slate-800">{new Date(dr.createdAt).toLocaleString()}</div>
                                          <div className="mt-0.5 text-slate-600">Token: {dr.tokenNo || '-'}</div>
                                          <div className="mt-2 flex items-center justify-between gap-2">
                                            <div className="text-slate-700">Status: {dr.status || '-'}</div>
                                            <div className="flex items-center gap-2">
                                              <button onClick={()=>onDiagnosticPrint(String(dr.id), String(p.mrn||''))} className="rounded-md border border-slate-300 px-2 py-1 text-xs" disabled={busy.diag===String(dr.id)}>{busy.diag===String(dr.id)?'Opening...':'Open Report'}</button>
                                            </div>
                                          </div>
                                        </div>
                                      )) : diagEmpty}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )
                  })()
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {patientDetailsOpen && (
        <PatientDetailsDialog
          open={patientDetailsOpen}
          onClose={()=>{ setPatientDetailsOpen(false); setPatientDetailsRow(null) }}
          patient={patientDetailsRow}
        />
      )}
    </div>
  )
}

function PatientDetailsDialog({ open, onClose, patient }: { open: boolean; onClose: ()=>void; patient: any }){
  if (!open) return null
  const p = patient || {}
  const fullName = String(p.fullName || '-')
  const mrn = String(p.mrn || '-')
  const visitCount = p.visitCount != null ? String(p.visitCount) : '-'
  const phone = String(p.phoneNormalized || p.phone || '-')
  const fatherName = String(p.fatherName || '-')
  const guardianRel = String(p.guardianRel || '-')
  const age = String(p.age || '-')
  const gender = String(p.gender || '-')
  const cnic = String(p.cnicNormalized || '-')
  const address = String(p.address || '-')
  const guardianCombined = `${guardianRel !== '-' ? guardianRel : ''}${guardianRel !== '-' && fatherName !== '-' ? ' ' : ''}${fatherName !== '-' ? fatherName : ''}`.trim() || '-'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Patient Details</h3>
            <div className="mt-0.5 text-xs text-slate-500">{fullName} • {mrn}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Number of visits" value={visitCount} full />
            <Info label="Patient Name" value={fullName} />
            <Info label="MR Number" value={mrn} />
            <Info label="Phone" value={phone} />
            <Info label="Gender" value={gender} />
            <Info label="Age" value={age} />
            <Info label="Guardian" value={guardianCombined} />
            <Info label="CNIC" value={cnic} />
            <Info label="Address" value={address} full />
          </div>
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
