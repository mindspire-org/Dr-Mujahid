import { useEffect, useState, useRef } from 'react'
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
import { Eye, X, BookmarkPlus, Download } from 'lucide-react'
import { mergeHistoryWithEdits, type HistorySection, isFieldEditedByDoctor } from '../../utils/historyEdits'

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
  const [details, setDetails] = useState<Record<string, { patient?: any; pres?: any[]; lab?: any[]; diag?: any[]; ipd?: any[]; history?: any[]; labEntries?: any[]; loading?: boolean }>>({})
  const [busy, setBusy] = useState<{ pres?: string; lab?: string; diag?: string }>({})
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false)
  const [patientDetailsRow, setPatientDetailsRow] = useState<any | null>(null)
  
  // Import Excel states
  const [importPreviewOpen, setImportPreviewOpen] = useState(false)
  const [importPreviewData, setImportPreviewData] = useState<any[]>([])
  const [importPreviewFile, setImportPreviewFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

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
        } catch { }
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
  useEffect(() => {
    try {
      const st: any = (location as any)?.state
      if (st?.searchSnapshot) {
        const snap = st.searchSnapshot
        if (snap?.form) setForm(snap.form)
        if (Array.isArray(snap?.patients)) setPatients(snap.patients)
        if (snap?.expanded) setExpanded(snap.expanded)
        if (snap?.details) setDetails(snap.details)
        try { sessionStorage.setItem('hospital.searchPatients.v1', JSON.stringify(snap)) } catch { }
        navigate('.', { replace: true, state: null })
      }
    } catch { }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Persist and restore search state so going back from IPD Profile keeps results
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('hospital.searchPatients.v1')
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved?.form) setForm(saved.form)
      if (Array.isArray(saved?.patients)) setPatients(saved.patients)
      if (saved?.expanded) setExpanded(saved.expanded)
      if (saved?.details) setDetails(saved.details)
    } catch { }
  }, [])
  useEffect(() => {
    try {
      // Sanitize patients so JSON.stringify never fails on circular/complex objects
      const patientsLite = Array.isArray(patients)
        ? patients.map((p: any) => ({
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
    } catch { }
  }, [form, patients, expanded, details])

  async function onPrescriptionPdf(presId: string, mrn: string) {
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
      } catch { }

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
          const deptName = d?.primaryDepartmentId ? (depArray.find((z: any) => String(z._id || z.id) === String(d.primaryDepartmentId))?.name || '') : ''
          if (deptName) doctor.departmentName = deptName
        } catch { }
      } catch { }

      let p: any = null
      try {
        const labPat: any = await labApi.getPatientByMrn(mrn)
        p = labPat?.patient || null
      } catch { }
      if (!p) {
        try {
          const prof: any = await hospitalApi.getPatientProfile(mrn)
          p = prof?.patient || null
        } catch { }
      }
      if (!p) {
        try {
          const resp: any = await hospitalApi.searchPatients({ mrn, limit: 1 })
          p = Array.isArray(resp?.patients) ? resp.patients[0] : null
        } catch { }
      }
      let ageTxt = ''
      try {
        if (p?.age != null && String(p.age).trim()) ageTxt = String(p.age).trim()
        else if (p?.dob) {
          const dob = new Date(p.dob)
          if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now() - dob.getTime()) / 31557600000)))
        }
      } catch { }
      const patient = { name: p?.fullName || pres?.encounterId?.patientId?.fullName || '-', mrn: p?.mrn || p?.mrNo || pres?.encounterId?.patientId?.mrn || mrn, gender: p?.gender || p?.sex || '-', fatherName: p?.fatherName || p?.guardianName || '-', age: ageTxt || '-', phone: p?.phoneNormalized || p?.phone || '-', address: p?.address || '-' }

      let tpl: PrescriptionPdfTemplate = 'default'
      try {
        const docId = String(pres?.encounterId?.doctorId?._id || pres?.encounterId?.doctorId || '')
        const raw = localStorage.getItem(`doctor.rx.template.${docId || 'anon'}`) as PrescriptionPdfTemplate | null
        if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw
      } catch { }

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
        diagnosticDiscount: pres?.diagnosticDiscount,
        therapyDiscount: pres?.therapyDiscount,
        counsellingDiscount: pres?.counsellingDiscount,
        createdAt: pres?.createdAt,
      }, tpl)
    } catch (e: any) {
      alert(e?.message || 'Failed to generate prescription PDF')
    } finally {
      setBusy(prev => ({ ...prev, pres: undefined }))
    }
  }

  function resolveDiagKey(name: string) {
    const n = (name || '').toLowerCase()
    if (n.includes('ultrasound')) return 'Ultrasound'
    if (n.replace(/\s+/g, '') === 'ctscan') return 'CTScan'
    if (n.includes('echocardio')) return 'Echocardiography'
    if (n.includes('colonoscopy')) return 'Colonoscopy'
    if (n.includes('uppergi')) return 'UpperGiEndoscopy'
    return name
  }

  async function onDiagnosticPrint(orderId: string, mrn: string) {
    try {
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
      const payload = { tokenNo: ord.tokenNo, createdAt: ord.createdAt, reportedAt: res.reportedAt || new Date().toISOString(), patient: ord.patient || {}, value: typeof res.formData === 'string' ? res.formData : JSON.stringify(res.formData || ''), referringConsultant: ord.referringConsultant }
      if (key === 'Echocardiography') { await printEchocardiographyReport(payload as any); return }
      if (key === 'Ultrasound') { await printUltrasoundReport(payload as any); return }
      if (key === 'CTScan') { await printCTScanReport(payload as any); return }
      if (key === 'Colonoscopy') { await printColonoscopyReport(payload as any); return }
      if (key === 'UpperGiEndoscopy') { await printUpperGIEndoscopyReport(payload as any); return }
      alert('Unknown diagnostic template for this test')
    } catch (e: any) {
      alert(e?.message || 'Failed to open diagnostic report')
    } finally {
      setBusy(prev => ({ ...prev, diag: undefined }))
    }
  }

  async function onLabPdf(orderId: string, mrn: string) {
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
    try { sessionStorage.removeItem('hospital.searchPatients.v1') } catch { }
  }

  const [showPrevHistoriesDlg, setShowPrevHistoriesDlg] = useState(false)
  const [showPrevLabEntriesDlg, setShowPrevLabEntriesDlg] = useState(false)
  const [prevLabEntryViewId, setPrevLabEntryViewId] = useState('')
  const [prevHistoryViewId, setPrevHistoryViewId] = useState('')
  const [prevHistoryViewPrescription, setPrevHistoryViewPrescription] = useState<any>(null)

  // Fetch prescription for history view to get historyEdits
  useEffect(() => {
    if (!prevHistoryViewId) {
      setPrevHistoryViewPrescription(null)
      return
    }
    // Find the patient MRN for the selected history
    let patientMrn = ''
    for (const mrn in details) {
      if (details[mrn].history?.find((h: any) => String(h._id || h.id) === prevHistoryViewId)) {
        patientMrn = mrn
        break
      }
    }
    if (!patientMrn) return

    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listPrescriptions({ 
          patientMrn, 
          historyTakingId: prevHistoryViewId,
          limit: 1 
        })
        if (cancelled) return
        const pres = res?.prescriptions?.[0] || null
        setPrevHistoryViewPrescription(pres)
      } catch {
        if (!cancelled) setPrevHistoryViewPrescription(null)
      }
    })()
    return () => { cancelled = true }
  }, [prevHistoryViewId, details])

  const onImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // First, preview the data
      const res: any = await hospitalApi.previewPatientsExcel(formData)
      const rows = res?.rows || []
      
      if (!rows.length) {
        alert('No valid patient records found in the Excel file.')
        e.target.value = ''
        return
      }
      
      setImportPreviewData(rows)
      setImportPreviewFile(file)
      setImportPreviewOpen(true)
    } catch (err: any) {
      alert(err?.message || 'Failed to parse Excel file. Please check the format.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const onConfirmImport = async () => {
    if (!importPreviewFile) return
    
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importPreviewFile)
      
      const res: any = await hospitalApi.importPatientsExcel(formData)
      const imported = res?.imported || 0
      const failed = res?.failed || 0
      const errors = res?.errors || []
      
      setImportPreviewOpen(false)
      setImportPreviewData([])
      setImportPreviewFile(null)
      
      if (failed > 0 && errors.length > 0) {
        alert(`Import complete: ${imported} imported, ${failed} failed.\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`)
      } else {
        alert(`Successfully imported ${imported} patients!`)
      }
      
      // Refresh search if we have active filters
      if (form.mrNo || form.name || form.fatherName || form.phone) {
        onSearch({ preventDefault: () => {} } as React.FormEvent)
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to import patients. Please check the file format.')
    } finally {
      setImporting(false)
    }
  }

  async function loadDetails(mrn: string) {
    setDetails(prev => ({ ...prev, [mrn]: { ...(prev[mrn] || {}), loading: true } }))
    try {
      // Prefer single backend-driven endpoint for both portals (more consistent + fewer calls)
      try {
        const res: any = await hospitalApi.getPatientProfile(mrn)
        const pres: any[] = (res?.pres || []).map((p: any) => ({ id: p.id || p._id, createdAt: p.createdAt, diagnosis: p.diagnosis, doctor: p.doctor || '-', items: p.medicine || p.items || [] }))
        const lab: any[] = (res?.lab || [])
        const diag: any[] = (res?.diag || [])
        const patient = res?.patient || null
        
        // Fetch history-taking and lab reports entries for the patient
        let history: any[] = []
        let labEntries: any[] = []
        try {
          if (patient?._id || patient?.id) {
            const patientId = String(patient._id || patient.id)
            const [historyRes, labEntriesRes] = await Promise.all([
              hospitalApi.listHistoryTakings({ patientId, limit: 50 }) as any,
              hospitalApi.listLabReportsEntries({ patientId, limit: 50 }) as any
            ])
            history = historyRes?.historyTakings || historyRes?.items || []
            labEntries = labEntriesRes?.labReportsEntries || labEntriesRes?.items || []
          }
        } catch { }
        
        setDetails(prev => ({ ...prev, [mrn]: { patient, pres, lab, diag, ipd: [], history, labEntries, loading: false } }))
        return
      } catch { }

      let patient: any = null
      try {
        const resp: any = await labApi.getPatientByMrn(mrn)
        patient = resp?.patient || null
      } catch { }
      
      // Fetch history-taking and lab reports entries
      let history: any[] = []
      let labEntries: any[] = []
      try {
        if (patient?._id || patient?.id) {
          const patientId = String(patient._id || patient.id)
          const [historyRes, labEntriesRes] = await Promise.all([
            hospitalApi.listHistoryTakings({ patientId, limit: 50 }) as any,
            hospitalApi.listLabReportsEntries({ patientId, limit: 50 }) as any
          ])
          history = historyRes?.historyTakings || historyRes?.items || []
          labEntries = labEntriesRes?.labReportsEntries || labEntriesRes?.items || []
        }
      } catch { }
      
      const [presRes, ordersRes, diagOrdersRes] = await Promise.all([
        hospitalApi.listPrescriptions({ patientMrn: mrn, page: 1, limit: 50 }) as any,
        labApi.listOrders({ q: mrn, limit: 50 }) as any,
        diagnosticApi.listOrders({ q: mrn, limit: 50 }) as any,
      ])
      const pres: any[] = (presRes?.prescriptions || []).map((p: any) => ({ id: p._id || p.id, createdAt: p.createdAt, diagnosis: p.diagnosis, doctor: p.encounterId?.doctorId?.name || '-', items: p.medicine || p.items || [] }))
      const orders: any[] = (ordersRes?.items || [])
      const lab: any[] = []
      for (const o of orders) {
        let hasResult = false
        try {
          const r = await labApi.listResults({ orderId: String(o._id || o.id), limit: 1 }) as any
          hasResult = Array.isArray(r?.items) && r.items.length > 0
        } catch { }
        lab.push({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult })
      }
      const dorders: any[] = (diagOrdersRes?.items || [])
      const diag: any[] = []
      for (const o of dorders) {
        let hasResult = false
        try {
          const r = await diagnosticApi.listResults({ orderId: String(o._id || o.id), status: 'final', limit: 1 }) as any
          hasResult = Array.isArray(r?.items) && r.items.length > 0
        } catch { }
        diag.push({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult })
      }
      setDetails(prev => ({ ...prev, [mrn]: { patient, pres, lab, diag, ipd: [], history, labEntries, loading: false } }))
    } catch {
      setDetails(prev => ({ ...prev, [mrn]: { patient: null, pres: [], lab: [], diag: [], ipd: [], history: [], labEntries: [], loading: false } }))
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800">Patient Profile Mangement</h2>

      <form onSubmit={onSearch} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">MR Number</label>
            <input value={form.mrNo} onChange={e => update('mrNo', e.target.value)} placeholder="MR123456" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Full or partial name" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Father Name</label>
            <input value={form.fatherName} onChange={e => update('fatherName', e.target.value)} placeholder="Guardian's name" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
            <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="03001234567" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50" disabled={loading}>{loading ? 'Searching...' : 'Search Patients'}</button>
          <button type="button" onClick={onClear} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Clear Filters</button>
          <button
            type="button"
            onClick={async () => {
              try {
                const url = hospitalApi.exportPatientsUrl(form)
                const token = localStorage.getItem('hospital.token') || localStorage.getItem('token')
                const finalUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url
                
                // Fetch the file to handle the download in the current tab
                const response = await fetch(finalUrl, {
                  headers: {
                    'Accept': 'text/csv'
                  }
                })
                
                if (!response.ok) {
                  const text = await response.text()
                  throw new Error(text || 'Export failed')
                }
                
                const blob = await response.blob()
                if (blob.size === 0) throw new Error('Received empty file from server')
                
                const downloadUrl = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = downloadUrl
                a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                
                // Cleanup
                setTimeout(() => {
                  window.URL.revokeObjectURL(downloadUrl)
                  document.body.removeChild(a)
                }, 100)
              } catch (err: any) {
                console.error('Export error:', err)
                alert(err?.message || 'Failed to export patients')
              }
            }}
            className="flex items-center gap-2 rounded-md border border-blue-800 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            <Download size={16} />
            Export Patients
          </button>
          <button type="button" onClick={() => document.getElementById('patient-import-file')?.click()} className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">Import Excel</button>
          <input id="patient-import-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImportExcel} />
        </div>
      </form>

      {patients.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
            <div className="font-medium text-slate-800">Results</div>
            <div className="text-slate-600">{patients.length} patient{patients.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="divide-y divide-slate-200">
            {patients.map((p, idx) => (
              <div key={String(p._id || idx)} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.fullName || '-'} <span className="text-xs text-slate-500">{p.mrn || '-'}</span></div>
                  <div className="text-xs text-slate-600">{p.phoneNormalized || ''}</div>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">Father Name: {p.fatherName || '-'}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    onClick={() => {
                      const mrn = String(p.mrn || '')
                      setExpanded(prev => ({ ...prev, [mrn]: !prev[mrn] }))
                      if (!details[mrn]) loadDetails(mrn)
                    }}
                  >{expanded[String(p.mrn || '')] ? 'Hide Data' : 'View Data'}</button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 p-1 text-slate-700 hover:bg-slate-50"
                    onClick={() => { setPatientDetailsRow(p); setPatientDetailsOpen(true) }}
                    aria-label="View Details"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                </div>
                {expanded[String(p.mrn || '')] && (
                  (() => {
                    const isDoctorPortal = String(location?.pathname || '').startsWith('/doctor')
                    const mrnKey = String(p.mrn || '')
                    const d = details[mrnKey] || {}



                    if (isDoctorPortal) {
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
                    const labAll: any[] = Array.isArray(d.lab) ? (d.lab.filter((lr: any) => !!lr?.hasResult)) : []
                    const diagAll: any[] = Array.isArray(d.diag) ? (d.diag.filter((dr: any) => !!dr?.hasResult)) : []
                    const historyAll: any[] = Array.isArray(d.history) ? d.history : []
                    const labEntriesAll: any[] = Array.isArray(d.labEntries) ? d.labEntries : []
                    const visitKeys = Array.from(new Set([
                      ...presAll.map((x: any) => toDay(x.createdAt)),
                      ...labAll.map((x: any) => toDay(x.createdAt)),
                      ...diagAll.map((x: any) => toDay(x.createdAt)),
                      ...historyAll.map((x: any) => toDay(x.createdAt || x.hxDate)),
                      ...labEntriesAll.map((x: any) => toDay(x.createdAt || x.entryDate)),
                    ].filter((x: any) => x != null && String(x).trim() !== '')))
                      .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))

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
                      const medEmpty = (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                          <div className="text-[10px] font-bold text-slate-900">MEDICAL CARD / HISTORY</div>
                          <div className="mt-2 text-slate-600">No medical history found</div>
                        </div>
                      )

                      return (
                        <div className="mt-3 space-y-3">
                          {(d.loading) && <div className="p-3 text-xs text-slate-500">Loading...</div>}
                          {(!d.loading) && (
                            <>
                              {visitKeys.length === 0 && (
                                <div className="rounded-lg border border-blue-800 bg-white p-3">
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {presEmpty}
                                    {labEmpty}
                                    {diagEmpty}
                                    {medEmpty}
                                  </div>
                                </div>
                              )}
                              {visitKeys.map((vk: string) => {
                                const presFor = presAll.filter((x: any) => toDay(x.createdAt) === vk)
                                const labFor = labAll.filter((x: any) => toDay(x.createdAt) === vk)
                                const diagFor = diagAll.filter((x: any) => toDay(x.createdAt) === vk)
                                const historyFor = historyAll.filter((x: any) => toDay(x.createdAt || x.hxDate) === vk)
                                const labEntriesFor = labEntriesAll.filter((x: any) => toDay(x.createdAt || x.entryDate) === vk)

                                return (
                                  <div key={`visit_${vk}`} className="rounded-lg border border-blue-800 bg-white p-3">
                                    <div className="mb-2 text-xs font-semibold text-slate-800">Visit: {vk}</div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                                                onClick={() => onPrescriptionPdf(String(pr.id), String(p.mrn || ''))}
                                                disabled={busy.pres === String(pr.id)}
                                              >{busy.pres === String(pr.id) ? 'Generating...' : 'Prescription PDF'}</button>
                                            </div>
                                          </div>
                                        )) : presEmpty}
                                      </div>

                                      <div className="space-y-3">
                                        {labEntriesFor.length ? labEntriesFor.map((le: any) => (
                                          <div key={`labentry_${String(le._id || le.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="text-[10px] font-bold text-slate-900">LAB REPORT</div>
                                            <div className="mt-1 font-semibold text-slate-800">{new Date(le.createdAt || le.entryDate).toLocaleString()}</div>
                                            <div className="mt-0.5 text-slate-600">By: {le.hxBy || le.submittedBy || '-'}</div>
                                            <div className="mt-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPrevLabEntryViewId(String(le._id || le.id))
                                                  setShowPrevLabEntriesDlg(true)
                                                }}
                                                className="flex w-full items-center justify-center gap-1 rounded-md border border-blue-800 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                                              >
                                                View Lab Entries <Eye size={14} />
                                              </button>
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
                                                <button onClick={() => onDiagnosticPrint(String(dr.id), String(p.mrn || ''))} className="rounded-md border border-slate-300 px-2 py-1 text-xs" disabled={busy.diag === String(dr.id)}>{busy.diag === String(dr.id) ? 'Opening...' : 'Open Report'}</button>
                                              </div>
                                            </div>
                                          </div>
                                        )) : diagEmpty}
                                      </div>

                                      <div className="space-y-3">
                                        {historyFor.length ? historyFor.map((hx: any) => (
                                          <div key={`hx_${String(hx._id || hx.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="text-[10px] font-bold text-slate-900">MEDICAL CARD / HISTORY</div>
                                            <div className="mt-1 font-semibold text-slate-800">{new Date(hx.submittedAt || hx.createdAt || hx.hxDate).toLocaleString()}</div>
                                            <div className="mt-0.5 text-slate-600">By: {hx.hxBy || '-'}</div>
                                            <div className="mt-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPrevHistoryViewId(String(hx._id || hx.id))
                                                  setShowPrevHistoriesDlg(true)
                                                }}
                                                className="flex w-full items-center justify-center gap-1 rounded-md border border-blue-800 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                                              >
                                                View History <Eye size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        )) : medEmpty}
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
                    const labAll: any[] = Array.isArray(d.lab) ? (d.lab.filter((lr: any) => !!lr?.hasResult)) : []
                    const diagAll: any[] = Array.isArray(d.diag) ? (d.diag.filter((dr: any) => !!dr?.hasResult)) : []
                    const historyAll: any[] = Array.isArray(d.history) ? d.history : []
                    const labEntriesAll: any[] = Array.isArray(d.labEntries) ? d.labEntries : []
                    const visitKeys = Array.from(new Set([
                      ...presAll.map((x: any) => toDay(x.createdAt)),
                      ...labAll.map((x: any) => toDay(x.createdAt)),
                      ...diagAll.map((x: any) => toDay(x.createdAt)),
                      ...historyAll.map((x: any) => toDay(x.createdAt || x.hxDate)),
                      ...labEntriesAll.map((x: any) => toDay(x.createdAt || x.entryDate)),
                    ].filter((x: any) => x != null && String(x).trim() !== '')))
                      .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))

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
                    const medEmpty = (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <div className="text-[10px] font-bold text-slate-900">MEDICAL CARD / HISTORY</div>
                        <div className="mt-2 text-slate-600">No medical history found</div>
                      </div>
                    )

                    return (
                      <div className="mt-3 space-y-3">
                        {(details[String(p.mrn || '')]?.loading) && <div className="p-3 text-xs text-slate-500">Loading...</div>}
                        {(!details[String(p.mrn || '')]?.loading) && (
                          <>
                            {visitKeys.length === 0 && (
                              <div className="rounded-lg border border-blue-800 bg-white p-3">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  {presEmpty}
                                  {labEmpty}
                                  {diagEmpty}
                                  {medEmpty}
                                </div>
                              </div>
                            )}
                            {visitKeys.map((vk: string) => {
                              const presFor = presAll.filter((x: any) => toDay(x.createdAt) === vk)
                              const labFor = labAll.filter((x: any) => toDay(x.createdAt) === vk)
                              const diagFor = diagAll.filter((x: any) => toDay(x.createdAt) === vk)
                              const historyFor = historyAll.filter((x: any) => toDay(x.createdAt || x.hxDate) === vk)
                              const labEntriesFor = labEntriesAll.filter((x: any) => toDay(x.createdAt || x.entryDate) === vk)

                              return (
                                <div key={`visit_${vk}`} className="rounded-lg border border-blue-800 bg-white p-3">
                                  <div className="mb-2 text-xs font-semibold text-slate-800">Visit: {vk}</div>
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                                              onClick={() => onPrescriptionPdf(String(pr.id), String(p.mrn || ''))}
                                              disabled={busy.pres === String(pr.id)}
                                            >{busy.pres === String(pr.id) ? 'Generating...' : 'Prescription PDF'}</button>
                                          </div>
                                        </div>
                                      )) : presEmpty}
                                    </div>

                                      <div className="space-y-3">
                                        {labEntriesFor.length ? labEntriesFor.map((le: any) => (
                                          <div key={`labentry_${String(le._id || le.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="text-[10px] font-bold text-slate-900">LAB REPORT</div>
                                            <div className="mt-1 font-semibold text-slate-800">{new Date(le.createdAt || le.entryDate).toLocaleString()}</div>
                                            <div className="mt-0.5 text-slate-600">By: {le.hxBy || le.submittedBy || '-'}</div>
                                            <div className="mt-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPrevLabEntryViewId(String(le._id || le.id))
                                                  setShowPrevLabEntriesDlg(true)
                                                }}
                                                className="flex w-full items-center justify-center gap-1 rounded-md border border-blue-800 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                                              >
                                                View Lab Entries <Eye size={14} />
                                              </button>
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
                                              <button onClick={() => onDiagnosticPrint(String(dr.id), String(p.mrn || ''))} className="rounded-md border border-slate-300 px-2 py-1 text-xs" disabled={busy.diag === String(dr.id)}>{busy.diag === String(dr.id) ? 'Opening...' : 'Open Report'}</button>
                                            </div>
                                          </div>
                                        </div>
                                      )) : diagEmpty}
                                    </div>

                                    <div className="space-y-3">
                                      {historyFor.length ? historyFor.map((hx: any) => (
                                        <div key={`hx_${String(hx._id || hx.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                          <div className="text-[10px] font-bold text-slate-900">MEDICAL CARD / HISTORY</div>
                                          <div className="mt-1 font-semibold text-slate-800">{new Date(hx.submittedAt || hx.createdAt || hx.hxDate).toLocaleString()}</div>
                                          <div className="mt-0.5 text-slate-600">By: {hx.hxBy || '-'}</div>
                                          <div className="mt-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPrevHistoryViewId(String(hx._id || hx.id))
                                                setShowPrevHistoriesDlg(true)
                                              }}
                                              className="flex w-full items-center justify-center gap-1 rounded-md border border-blue-800 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                                            >
                                              View History <Eye size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      )) : medEmpty}
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

      {showPrevLabEntriesDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={() => setShowPrevLabEntriesDlg(false)}>
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <div className="text-base font-semibold text-slate-900">Previous Lab Entries</div>
              <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setShowPrevLabEntriesDlg(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
              {(() => {
                // Find selected lab entry in details
                let selected: any = null
                let patientMrn = ''
                for (const mrn in details) {
                  const found = details[mrn].labEntries?.find((le: any) => String(le._id || le.id) === prevLabEntryViewId)
                  if (found) {
                    selected = found
                    patientMrn = mrn
                    break
                  }
                }

                const toLabel = (key: string) =>
                  String(key || '')
                    .replace(/_/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/\s+/g, ' ')
                    .trim()

                const formatValue = (v: any): string => {
                  if (v == null) return ''
                  if (typeof v === 'string') return v.trim()
                  if (typeof v === 'number') return isFinite(v) ? String(v) : ''
                  if (typeof v === 'boolean') return v ? 'Yes' : ''
                  if (Array.isArray(v)) {
                    const parts = v.map((x) => {
                      if (x == null) return ''
                      if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return formatValue(x)
                      if (typeof x === 'object') {
                        const pick = (o: any, key: string) => {
                          const vv = o?.[key]
                          return typeof vv === 'string' ? vv.trim() : (typeof vv === 'number' && isFinite(vv) ? String(vv) : '')
                        }
                        const label = pick(x, 'label') || pick(x, 'name') || pick(x, 'title') || pick(x, 'type') || pick(x, 'status') || pick(x, 'value') || pick(x, 'description')
                        if (label) return label
                        const inner = formatValue(x)
                        return inner
                      }
                      try { return String(x).trim() } catch { return '' }
                    }).filter(Boolean)
                    return parts.join(', ')
                  }
                  if (typeof v === 'object') {
                    const keys = Object.keys(v || {})
                    const boolKeys: string[] = []
                    const parts: string[] = []
                    for (const k of keys) {
                      const vv = (v as any)[k]
                      if (typeof vv === 'boolean') {
                        if (vv) boolKeys.push(toLabel(k))
                        continue
                      }
                      if (vv == null) continue
                      if (typeof vv === 'string') { const t = vv.trim(); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                      if (typeof vv === 'number') { if (isFinite(vv)) parts.push(`${toLabel(k)}: ${vv}`); continue }
                      if (Array.isArray(vv)) { const t = formatValue(vv); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                      if (typeof vv === 'object') {
                        const inner = formatValue(vv)
                        if (inner) parts.push(`${toLabel(k)}: ${inner}`)
                        continue
                      }
                      try { const t = String(vv).trim(); if (t) parts.push(`${toLabel(k)}: ${t}`) } catch { }
                    }
                    const merged: string[] = []
                    if (boolKeys.length) merged.push(boolKeys.join(', '))
                    if (parts.length) merged.push(parts.join(' • '))
                    return merged.join(' • ')
                  }
                  try { return String(v).trim() } catch { return '' }
                }

                const renderPairs = (obj: any) => {
                  if (!obj || typeof obj !== 'object') return null
                  const keys = Object.keys(obj || {})
                  const rows = keys
                    .map(k => ({ k, v: obj[k] }))
                    .map(it => ({ ...it, txt: formatValue(it.v) }))
                    .filter(it => !!it.txt)
                  if (!rows.length) return null
                  return (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {rows.map(({ k, txt }) => (
                        <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">{toLabel(k)}</div>
                          <div className="mt-0.5 text-sm font-semibold text-slate-900">{txt}</div>
                        </div>
                      ))}
                    </div>
                  )
                }

                const tests = Array.isArray(selected?.tests) ? selected.tests : []
                const labInformation = selected?.labInformation || {}
                const semenAnalysis = selected?.semenAnalysis || {}

                return (
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{details[patientMrn]?.patient?.fullName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {patientMrn})</span></div>
                        <div className="mt-1 text-xs text-slate-600">Entered By: {String(selected?.hxBy || '-')} • Entered On: {String(selected?.hxDate || selected?.entryDate || '-') || '-'}</div>
                      </div>
                      <button type="button" className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50" onClick={() => setShowPrevLabEntriesDlg(false)}>Close</button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {renderPairs(labInformation) && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-sm font-semibold text-slate-800">Lab Information</div>
                          {renderPairs(labInformation)}
                        </div>
                      )}

                      {renderPairs(semenAnalysis) && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-sm font-semibold text-slate-800">Semen Analysis</div>
                          {renderPairs(semenAnalysis)}
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-800">Tests</div>
                        {tests.length === 0 ? (
                          <div className="mt-2 text-sm text-slate-600">No tests</div>
                        ) : (
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-left text-xs text-slate-600">
                                  <th className="border border-slate-200 px-3 py-2">Test</th>
                                  <th className="border border-slate-200 px-3 py-2">Normal</th>
                                  <th className="border border-slate-200 px-3 py-2">Result</th>
                                  <th className="border border-slate-200 px-3 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tests.map((t: any, i: number) => (
                                  <tr key={i} className="text-slate-800">
                                    <td className="border border-slate-200 px-3 py-2">{String(t?.testName || '')}</td>
                                    <td className="border border-slate-200 px-3 py-2">{String(t?.normalValue || '')}</td>
                                    <td className="border border-slate-200 px-3 py-2">{String(t?.result || '')}</td>
                                    <td className="border border-slate-200 px-3 py-2">{String(t?.status || '')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {patientDetailsOpen && (
        <PatientDetailsDialog
          open={patientDetailsOpen}
          onClose={() => { setPatientDetailsOpen(false); setPatientDetailsRow(null) }}
          patient={patientDetailsRow}
        />
      )}

      {showPrevHistoriesDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={() => setShowPrevHistoriesDlg(false)}>
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                <div className="text-base font-semibold text-slate-900">Previous Histories</div>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-900"></span>
                    <span className="text-slate-600">History Taker</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                    <span className="text-blue-600">Doctor Edited</span>
                  </div>
                </div>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setShowPrevHistoriesDlg(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
              {(() => {
                // Find selected history in details
                let selected: any = null
                let patientMrn = ''
                for (const mrn in details) {
                  const found = details[mrn].history?.find((h: any) => String(h._id || h.id) === prevHistoryViewId)
                  if (found) {
                    selected = found
                    patientMrn = mrn
                    break
                  }
                }
                
                const originalData = (selected as any)?.data || {}
                
                // Merge with doctor's edits if available
                const historyEdits = prevHistoryViewPrescription?.historyEdits || {}
                const sectionsList: HistorySection[] = [
                  'personalInfo', 'maritalStatus', 'coitus', 'health', 
                  'sexualHistory', 'previousMedicalHistory', 'arrivalReference'
                ]
                const mergedData: any = {}
                const allEditedPaths = new Set<string>()
                for (const section of sectionsList) {
                  const { data, editedPaths } = mergeHistoryWithEdits(
                    originalData[section],
                    historyEdits[section],
                    section
                  )
                  mergedData[section] = data
                  editedPaths.forEach(p => allEditedPaths.add(`${section}.${p}`))
                }
                
                const sections: Array<{ title: string; key: HistorySection; value: any }> = [
                  { title: 'Personal Information', key: 'personalInfo', value: mergedData?.personalInfo },
                  { title: 'Marital Status', key: 'maritalStatus', value: mergedData?.maritalStatus },
                  { title: 'Coitus', key: 'coitus', value: mergedData?.coitus },
                  { title: 'Health', key: 'health', value: mergedData?.health },
                  { title: 'Sexual History', key: 'sexualHistory', value: mergedData?.sexualHistory },
                  { title: 'Previous Medical History', key: 'previousMedicalHistory', value: mergedData?.previousMedicalHistory },
                  { title: 'Arrival Reference', key: 'arrivalReference', value: mergedData?.arrivalReference },
                ]

                const toLabel = (key: string) =>
                  String(key || '')
                    .replace(/_/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/\s+/g, ' ')
                    .trim()

                const formatValue = (v: any): string => {
                  if (v == null) return ''
                  if (typeof v === 'string') return v.trim()
                  if (typeof v === 'number') return isFinite(v) ? String(v) : ''
                  if (typeof v === 'boolean') return v ? 'Yes' : ''
                  if (Array.isArray(v)) {
                    const parts = v.map((x) => {
                      if (x == null) return ''
                      if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return formatValue(x)
                      if (typeof x === 'object') {
                        const pick = (o: any, key: string) => {
                          const vv = o?.[key]
                          return typeof vv === 'string' ? vv.trim() : (typeof vv === 'number' && isFinite(vv) ? String(vv) : '')
                        }
                        const label = pick(x, 'label') || pick(x, 'name') || pick(x, 'title') || pick(x, 'type') || pick(x, 'status') || pick(x, 'value') || pick(x, 'description')
                        if (label) return label
                        const inner = formatValue(x)
                        return inner
                      }
                      try { return String(x).trim() } catch { return '' }
                    }).filter(Boolean)
                    return parts.join(', ')
                  }
                  if (typeof v === 'object') {
                    const keys = Object.keys(v || {})
                    const boolKeys: string[] = []
                    const parts: string[] = []
                    for (const k of keys) {
                      const vv = (v as any)[k]
                      if (typeof vv === 'boolean') {
                        if (vv) boolKeys.push(toLabel(k))
                        continue
                      }
                      if (vv == null) continue
                      if (typeof vv === 'string') { const t = vv.trim(); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                      if (typeof vv === 'number') { if (isFinite(vv)) parts.push(`${toLabel(k)}: ${vv}`); continue }
                      if (Array.isArray(vv)) { const t = formatValue(vv); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                      if (typeof vv === 'object') {
                        const inner = formatValue(vv)
                        if (inner) parts.push(`${toLabel(k)}: ${inner}`)
                        continue
                      }
                      try { const t = String(vv).trim(); if (t) parts.push(`${toLabel(k)}: ${t}`) } catch { }
                    }
                    const merged: string[] = []
                    if (boolKeys.length) merged.push(boolKeys.join(', '))
                    if (parts.length) merged.push(parts.join(' • '))
                    return merged.join(' • ')
                  }
                  try { return String(v).trim() } catch { return '' }
                }

                const isEditedExact = (fullPath: string): boolean => {
                  if (!allEditedPaths) return false
                  return allEditedPaths.has(fullPath)
                }

                const isEditedPath = (fullPath: string): boolean => {
                  if (!allEditedPaths) return false
                  if (allEditedPaths.has(fullPath)) return true
                  for (const p of allEditedPaths) {
                    if (p.startsWith(fullPath + '.')) return true
                    if (fullPath.startsWith(p + '.')) return true
                  }
                  return false
                }

                const renderArrayPrimitiveChips = (arr: any[], fullPath: string) => {
                  const parts = arr
                    .map(v => (v == null ? '' : String(v).trim()))
                    .filter(Boolean)
                  if (!parts.length) return null
                  return (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {parts.map((t) => {
                        const edited = isEditedExact(`${fullPath}.${t}`) || isEditedExact(fullPath)
                        return (
                          <span
                            key={t}
                            className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${edited ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                            title={edited ? 'Edited by doctor' : 'Entered by history taker'}
                          >
                            {t}
                          </span>
                        )
                      })}
                    </div>
                  )
                }

                const renderArrayOfObjects = (arr: any[], path: string) => {
                  if (!Array.isArray(arr) || !arr.length) return null
                  return (
                    <div className="mt-2 space-y-3">
                      {arr.map((item, idx) => {
                        const itemPath = `${path}.${idx}`
                        const itemKeys = Object.keys(item || {}).filter(ik => ik !== '_id' && ik !== 'id')
                        if (!itemKeys.length) return null
                        return (
                          <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {toLabel(path.split('.').pop() || '')} #{idx + 1}
                            </div>
                            <div className="space-y-2">
                              {itemKeys.map(ik => {
                                const leafPath = `${itemPath}.${ik}`
                                const val = item[ik]
                                if (val == null) return null
                                
                                if (typeof val === 'object' && !Array.isArray(val)) {
                                  return (
                                    <div key={ik} className="rounded-md border border-slate-100 bg-slate-50 p-2">
                                      <div className="text-[10px] font-medium text-slate-500">{toLabel(ik)}</div>
                                      {renderObjectValue(val, leafPath)}
                                    </div>
                                  )
                                }

                                const txt = formatValue(val)
                                if (!txt) return null
                                const edited = isEditedExact(leafPath)
                                return (
                                  <div key={ik} className={`rounded-md border border-slate-100 p-2 ${edited ? 'bg-blue-50' : 'bg-slate-50'}`}>
                                    <div className="text-[10px] text-slate-500">{toLabel(ik)}</div>
                                    <div className={`mt-0.5 text-xs font-semibold ${edited ? 'text-blue-600' : 'text-slate-900'}`}>
                                      {txt}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                const renderObjectValue = (val: any, path: string) => {
                  if (!val || typeof val !== 'object' || Array.isArray(val)) return null
                  const keys2 = Object.keys(val || {})
                  const boolItems: Array<{ key: string; label: string; edited: boolean }> = []
                  const parts2: Array<{ key: string; text: string; edited: boolean }> = []
                  
                  const collectLeaves = (v: any, currentPath: string, prefixLabel: string = '') => {
                    if (v == null) return
                    if (typeof v === 'boolean') {
                      if (v) boolItems.push({ key: currentPath, label: prefixLabel.trim(), edited: isEditedExact(currentPath) })
                    } else if (typeof v === 'object' && !Array.isArray(v)) {
                      Object.keys(v).forEach(k => {
                        collectLeaves(v[k], `${currentPath}.${k}`, `${prefixLabel} ${toLabel(k)}`)
                      })
                    } else {
                      const t = formatValue(v)
                      if (t) parts2.push({ key: currentPath, text: `${prefixLabel.trim()}: ${t}`, edited: isEditedExact(currentPath) })
                    }
                  }

                  for (const kk of keys2) {
                    collectLeaves((val as any)[kk], `${path}.${kk}`, toLabel(kk))
                  }
                  if (!boolItems.length && !parts2.length) return null
                  return (
                    <div className="mt-0.5">
                      {!!boolItems.length && (
                        <div className="flex flex-wrap gap-2">
                          {boolItems.map((b) => (
                            <span
                              key={b.key}
                              className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${b.edited ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                              title={b.edited ? 'Edited by doctor' : 'Entered by history taker'}
                            >
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {!!parts2.length && (
                        <div className="mt-1 text-sm font-semibold">
                          {parts2.map((p, idx) => (
                            <span key={p.key}>
                              {idx > 0 ? <span className="text-slate-400"> • </span> : null}
                              <span className={p.edited ? 'text-blue-600' : 'text-slate-900'}>{p.text}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }

                const renderPairs = (obj: any, basePath?: string) => {
                  if (!obj || typeof obj !== 'object') return null
                  const keys = Object.keys(obj || {})
                  const rows = keys
                    .map(k => ({ k, v: (obj as any)[k] }))
                    .map(it => ({ ...it, txt: formatValue(it.v) }))
                    .filter(it => !!it.txt)
                  if (!rows.length) return null
                  return (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {rows.map(({ k, txt }) => {
                        const fullPath = basePath ? `${basePath}.${k}` : k
                        const v = (obj as any)[k]
                        const isEdited = isEditedExact(fullPath)
                        const isArray = Array.isArray(v)
                        const isPrimitiveArray = isArray && (v as any[]).every(x => x == null || typeof x !== 'object')
                        const isObjectValue = !isArray && v != null && typeof v === 'object'
                        const isArrayOfObjects = isArray && !isPrimitiveArray

                        return (
                          <div key={k} className={`rounded-lg border border-slate-200 p-3 ${isEdited ? 'bg-blue-50' : 'bg-slate-50'}`}>
                            <div className="text-xs text-slate-500">{toLabel(k)}</div>
                            {isPrimitiveArray ? (
                              renderArrayPrimitiveChips(v as any[], fullPath)
                            ) : isArrayOfObjects ? (
                              renderArrayOfObjects(v as any[], fullPath)
                            ) : isObjectValue ? (
                              renderObjectValue(v, fullPath)
                            ) : (
                              <div className={`mt-0.5 text-sm font-semibold ${isEdited ? 'text-blue-600' : 'text-slate-900'}`}>
                                {txt}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                return (
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{details[patientMrn]?.patient?.fullName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {patientMrn})</span></div>
                        <div className="mt-1 text-xs text-slate-600">Hx By: {String(selected?.hxBy || '-') || '-'} • Hx Date: {String(selected?.hxDate || selected?.submittedAt || '-') || '-'}</div>
                      </div>
                      <button type="button" className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50" onClick={() => setShowPrevHistoriesDlg(false)}>Close</button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {sections.map(s => {
                        const content = renderPairs(s.value, s.key)
                        if (!content) return null
                        return (
                          <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                            {content}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {importPreviewOpen && (
        <ImportPreviewDialog
          open={importPreviewOpen}
          onClose={() => { setImportPreviewOpen(false); setImportPreviewData([]); setImportPreviewFile(null) }}
          data={importPreviewData}
          onConfirm={onConfirmImport}
          importing={importing}
        />
      )}
    </div>
  )
}

function PatientDetailsDialog({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: any }) {
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

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} rounded-lg border border-slate-200 bg-slate-50 px-3 py-2`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800 break-words">{value || '-'}</div>
    </div>
  )
}

function ImportPreviewDialog({ open, onClose, data, onConfirm, importing }: { open: boolean; onClose: () => void; data: any[]; onConfirm: () => void; importing: boolean }) {
  if (!open) return null
  
  const previewRows = data.slice(0, 100) // Show first 100 rows
  const totalRows = data.length
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-4">
      <div className="w-full max-w-7xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Import Patients from Excel</h3>
            <div className="text-sm text-slate-500">{totalRows.toLocaleString()} records found</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">#</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">MR Number</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Phone</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Age</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Gender</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Last Visit</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Doctor</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {previewRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{idx}</td>
                  <td className="px-3 py-2 text-slate-800">{row.mrn || '0'}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{row.fullName || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.age || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.gender || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.lastVisit || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.doctor || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalRows > 100 && (
            <div className="px-4 py-2 text-center text-sm text-slate-500">
              ... and {totalRows - 100} more records
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <div className="text-sm text-slate-500">
            Expected columns: <span className="font-medium">MR Number, Name, Phone, Age, Gender, Last Visit, Doctor, Address, Father Name</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button 
              onClick={onConfirm} 
              disabled={importing}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${totalRows.toLocaleString()} Patients`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
