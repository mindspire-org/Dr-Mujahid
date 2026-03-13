import { useEffect, useMemo, useRef, useState } from 'react'
import { hospitalApi, labApi } from '../../utils/api'
import PrescriptionPrint from '../../components/doctor/PrescriptionPrint'
import { downloadPrescriptionPdf, previewPrescriptionPdf } from '../../utils/prescriptionPdf'
import type { PrescriptionPdfTemplate } from '../../utils/prescriptionPdf'
import PrescriptionVitals from '../../components/doctor/PrescriptionVitals'
import PrescriptionDiagnosticOrders from '../../components/doctor/PrescriptionDiagnosticOrders'
import { useNavigate } from 'react-router-dom'

type DoctorSession = { id: string; name: string; username: string }

type Prescription = {
  id: string
  doctorId: string
  encounterId: string
  patientName: string
  mrNo?: string
  diagnosis?: string
  primaryComplaint?: string
  primaryComplaintHistory?: string
  familyHistory?: string
  allergyHistory?: string
  treatmentHistory?: string
  history?: string
  examFindings?: string
  advice?: string
  medicines?: string
  createdAt: string
}

export default function Doctor_PrescriptionHistory() {
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [list, setList] = useState<Prescription[]>([])
  const [q, setQ] = useState('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [printData, setPrintData] = useState<any | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editActiveTab, setEditActiveTab] = useState<'details' | 'vitals' | 'labs' | 'therapy' | 'diagnostics' | 'meds'>('details')
  const [editingId, setEditingId] = useState<string>('')
  const [editForm, setEditForm] = useState<{ primaryComplaint?: string; primaryComplaintHistory?: string; familyHistory?: string; allergyHistory?: string; treatmentHistory?: string; history?: string; examFindings?: string; diagnosis?: string; advice?: string; labTestsText?: string; labNotes?: string; therapyTestsText?: string; therapyNotes?: string; items: Array<{ name: string; frequency?: string; duration?: string; dose?: string; route?: string; instruction?: string; notes?: string }> }>({ items: [], labTestsText: '', labNotes: '', therapyTestsText: '', therapyNotes: '' })
  const vitalsEditRef = useRef<any>(null)
  const diagEditRef = useRef<any>(null)
  const [editVitalsDisplay, setEditVitalsDisplay] = useState<any>({})
  const [editDiagDisplay, setEditDiagDisplay] = useState<{ testsText?: string; notes?: string }>({})
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; type?: 'lab' | 'pharmacy' | 'diagnostic' | 'delete'; target?: Prescription | null }>({ open: false })
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const [refFlags, setRefFlags] = useState<Record<string, { ph?: boolean; lab?: boolean; diag?: boolean }>>({})
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

  useEffect(() => { load() }, [doc?.id, from, to, page, limit])
  useEffect(() => {
    const h = () => { load() }
    window.addEventListener('doctor:pres-saved', h as any)
    return () => window.removeEventListener('doctor:pres-saved', h as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  async function load() {
    try {
      if (!doc?.id) { setList([]); return }
      const res = await hospitalApi.listPrescriptions({ doctorId: doc.id, from: from || undefined, to: to || undefined, page, limit }) as any
      const rows: any[] = res?.prescriptions || []
      const items: Prescription[] = rows.map((r: any) => ({
        id: String(r._id || r.id),
        doctorId: String(r.encounterId?.doctorId?._id || r.encounterId?.doctorId || ''),
        encounterId: String(r.encounterId?._id || r.encounterId || ''),
        patientName: r.encounterId?.patientId?.fullName || '-',
        mrNo: r.encounterId?.patientId?.mrn || '-',
        diagnosis: r.diagnosis,
        primaryComplaint: r.primaryComplaint || r.complaints,
        primaryComplaintHistory: r.primaryComplaintHistory,
        familyHistory: r.familyHistory,
        allergyHistory: r.allergyHistory,
        treatmentHistory: r.treatmentHistory,
        history: r.history,
        examFindings: r.examFindings,
        advice: r.advice,
        medicines: ((r.medicine || r.items) || []).map((it: any) => `${it.name}${it.frequency ? ` • ${it.frequency}` : ''}${it.duration ? ` • ${it.duration}` : ''}${it.dose ? ` • ${it.dose}` : ''}`).join('\n'),
        createdAt: r.createdAt,
      }))
      setList(items)
      setTotal(Number(res?.total || items.length))
      // load referral flags for visible range
      try {
        const [ph, lb, dg] = await Promise.all([
          hospitalApi.listReferrals({ type: 'pharmacy', doctorId: doc.id, from: from || undefined, to: to || undefined, page: 1, limit: 200 }) as any,
          hospitalApi.listReferrals({ type: 'lab', doctorId: doc.id, from: from || undefined, to: to || undefined, page: 1, limit: 200 }) as any,
          hospitalApi.listReferrals({ type: 'diagnostic', doctorId: doc.id, from: from || undefined, to: to || undefined, page: 1, limit: 200 }) as any,
        ])
        const map: Record<string, { ph?: boolean; lab?: boolean; diag?: boolean }> = {}
          ; (ph?.referrals || []).forEach((r: any) => { const pid = String(r.prescriptionId || ''); if (!pid) return; map[pid] = { ...(map[pid] || {}), ph: true } })
          ; (lb?.referrals || []).forEach((r: any) => { const pid = String(r.prescriptionId || ''); if (!pid) return; map[pid] = { ...(map[pid] || {}), lab: true } })
          ; (dg?.referrals || []).forEach((r: any) => { const pid = String(r.prescriptionId || ''); if (!pid) return; map[pid] = { ...(map[pid] || {}), diag: true } })
        setRefFlags(map)
      } catch { }
    } catch {
      setList([])
      setTotal(0)
    }
  }

  const mine = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list || []).filter(p => p.doctorId === doc?.id && (!s || `${p.patientName} ${p.mrNo || ''} ${p.diagnosis || ''}`.toLowerCase().includes(s)))
  }, [list, doc, q])

  async function handlePrint(id: string) {
    const data: any = await fetchPrintData(id)
    setPrintData(data)
    let tpl: PrescriptionPdfTemplate = 'default'
    try { const raw = localStorage.getItem(`doctor.rx.template.${doc?.id || 'anon'}`) as PrescriptionPdfTemplate | null; if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw } catch { }
    await previewPrescriptionPdf({
      doctor: data.doctor || {},
      settings: data.settings || {},
      patient: data.patient || {},
      items: data.items || [],
      historyTaking: data.historyTaking,
      vitals: data.vitals,
      primaryComplaint: data.primaryComplaint,
      primaryComplaintHistory: data.primaryComplaintHistory,
      familyHistory: data.familyHistory,
      allergyHistory: data.allergyHistory,
      treatmentHistory: data.treatmentHistory,
      history: data.history,
      examFindings: data.examFindings,
      diagnosis: data.diagnosis,
      advice: data.advice,
      labTests: data.labTests || [],
      labNotes: data.labNotes || '',
      diagnosticTests: data.diagnosticTests || [],
      diagnosticNotes: data.diagnosticNotes || '',
      diagnosticDiscount: data.diagnosticDiscount,
      therapyTests: data.therapyTests || [],
      therapyNotes: data.therapyNotes || '',
      therapyDiscount: data.therapyDiscount,
      therapyPlan: data.therapyPlan,
      therapyMachines: data.therapyMachines,
      counselling: data.counselling,
      counsellingDiscount: data.counsellingDiscount,
      createdAt: data.createdAt,
    }, tpl)
  }

  async function handleDownload(id: string) {
    const data: any = await fetchPrintData(id)
    let tpl: PrescriptionPdfTemplate = 'default'
    try { const raw = localStorage.getItem(`doctor.rx.template.${doc?.id || 'anon'}`) as PrescriptionPdfTemplate | null; if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw } catch { }
    await downloadPrescriptionPdf({
      doctor: data.doctor || {},
      settings: data.settings || {},
      patient: data.patient || {},
      items: data.items || [],
      historyTaking: data.historyTaking,
      vitals: data.vitals,
      primaryComplaint: data.primaryComplaint,
      primaryComplaintHistory: data.primaryComplaintHistory,
      familyHistory: data.familyHistory,
      treatmentHistory: data.treatmentHistory,
      history: data.history,
      examFindings: data.examFindings,
      diagnosis: data.diagnosis,
      advice: data.advice,
      labTests: data.labTests || [],
      labNotes: data.labNotes || '',
      diagnosticTests: data.diagnosticTests || [],
      diagnosticNotes: data.diagnosticNotes || '',
      diagnosticDiscount: data.diagnosticDiscount,
      therapyTests: data.therapyTests || [],
      therapyNotes: data.therapyNotes || '',
      therapyDiscount: data.therapyDiscount,
      therapyPlan: data.therapyPlan,
      therapyMachines: data.therapyMachines,
      counselling: data.counselling,
      counsellingDiscount: data.counsellingDiscount,
      createdAt: data.createdAt,
    }, `prescription-${id}.pdf`, tpl)
  }

  async function referToPharmacy(p: Prescription) {
    try {
      if (!doc?.id) { setToast({ msg: 'Session missing', kind: 'error' }); return }
      await hospitalApi.createReferral({ type: 'pharmacy', encounterId: p.encounterId, doctorId: doc.id, prescriptionId: p.id })
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch { }
      setToast({ msg: 'Pharmacy referral created', kind: 'success' })
      setRefFlags(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), ph: true } }))
    } catch (e: any) {
      setToast({ msg: e?.message || 'Failed to refer to pharmacy', kind: 'error' })
    }
  }

  async function referToLab(p: Prescription) {
    try {
      if (!doc?.id) { setToast({ msg: 'Session missing', kind: 'error' }); return }
      let tests: string[] | undefined
      let notes: string | undefined
      try {
        const res: any = await hospitalApi.getPrescription(p.id)
        const pres = res?.prescription
        if (pres?.labTests?.length) tests = pres.labTests as string[]
        if (pres?.labNotes) notes = String(pres.labNotes)
      } catch { }
      await hospitalApi.createReferral({ type: 'lab', encounterId: p.encounterId, doctorId: doc.id, prescriptionId: p.id, tests, notes })
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch { }
      setToast({ msg: 'Lab referral created', kind: 'success' })
      setRefFlags(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), lab: true } }))
    } catch (e: any) {
      setToast({ msg: e?.message || 'Failed to create lab referral', kind: 'error' })
    }
  }

  async function referToDiagnostic(p: Prescription) {
    try {
      if (!doc?.id) { setToast({ msg: 'Session missing', kind: 'error' }); return }
      let tests: string[] | undefined
      let notes: string | undefined
      try {
        const res: any = await hospitalApi.getPrescription(p.id)
        const pres = res?.prescription
        if (pres?.diagnosticTests?.length) tests = pres.diagnosticTests as string[]
        if (pres?.diagnosticNotes) notes = String(pres.diagnosticNotes)
      } catch { }
      await hospitalApi.createReferral({ type: 'diagnostic', encounterId: p.encounterId, doctorId: doc.id, prescriptionId: p.id, tests, notes })
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch { }
      setToast({ msg: 'Diagnostic referral created', kind: 'success' })
      setRefFlags(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), diag: true } }))
    } catch (e: any) {
      setToast({ msg: e?.message || 'Failed to create diagnostic referral', kind: 'error' })
    }
  }

  function openConfirm(type: 'lab' | 'pharmacy' | 'diagnostic' | 'delete', p: Prescription) {
    if (type === 'pharmacy' && (refFlags[p.id]?.ph)) { setToast({ msg: 'Already referred to pharmacy', kind: 'success' }); return }
    if (type === 'lab' && (refFlags[p.id]?.lab)) { setToast({ msg: 'Already referred to lab', kind: 'success' }); return }
    if (type === 'diagnostic' && (refFlags[p.id]?.diag)) { setToast({ msg: 'Already referred to diagnostic', kind: 'success' }); return }
    setConfirmDlg({ open: true, type, target: p })
  }

  async function confirmReferral() {
    const p = confirmDlg.target
    if (!confirmDlg.open || !confirmDlg.type || !p) { setConfirmDlg({ open: false }); return }
    const t = confirmDlg.type
    setConfirmDlg({ open: false })
    if (t === 'pharmacy') await referToPharmacy(p)
    if (t === 'lab') await referToLab(p)
    if (t === 'diagnostic') await referToDiagnostic(p)
    if (t === 'delete') await deletePres(p.id)
  }

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 2000)
      return () => clearTimeout(id)
    }
  }, [toast])

  // @ts-ignore
  async function openEditor(id: string) {
    try {
      const res: any = await hospitalApi.getPrescription(id)
      const p = res?.prescription
      setEditingId(id)
      // parse route/instruction from notes for each item
      const src = (p?.medicine || p?.items || [])
      const items = (src || []).map((m: any) => {
        const nt = String(m?.notes || '')
        const mRoute = nt.match(/Route:\s*([^;]+)/i)
        const mInstr = nt.match(/Instruction:\s*([^;]+)/i)
        return { name: m.name || '', frequency: m.frequency || '', duration: m.duration || '', dose: m.dose || '', route: mRoute?.[1]?.trim() || '', instruction: mInstr?.[1]?.trim() || '', notes: m.notes || '' }
      })
      setEditForm({
        primaryComplaint: p?.primaryComplaint || '',
        primaryComplaintHistory: p?.primaryComplaintHistory || '',
        familyHistory: p?.familyHistory || '',
        allergyHistory: p?.allergyHistory || '',
        treatmentHistory: p?.treatmentHistory || '',
        history: p?.history || '',
        examFindings: p?.examFindings || '',
        diagnosis: p?.diagnosis || '',
        advice: p?.advice || '',
        labTestsText: Array.isArray(p?.labTests) && p.labTests.length ? (p.labTests as string[]).join(', ') : '',
        labNotes: p?.labNotes || '',
        therapyTestsText: Array.isArray(p?.therapyTests) && p.therapyTests.length ? (p.therapyTests as string[]).join(', ') : '',
        therapyNotes: p?.therapyNotes || '',
        items,
      })
      // seed vitals/diagnostics display for tabs
      try {
        const v = p?.vitals || {}
        setEditVitalsDisplay({
          pulse: v.pulse != null ? String(v.pulse) : '',
          temperature: v.temperatureC != null ? String(v.temperatureC) : '',
          bloodPressureSys: v.bloodPressureSys != null ? String(v.bloodPressureSys) : '',
          bloodPressureDia: v.bloodPressureDia != null ? String(v.bloodPressureDia) : '',
          respiratoryRate: v.respiratoryRate != null ? String(v.respiratoryRate) : '',
          bloodSugar: v.bloodSugar != null ? String(v.bloodSugar) : '',
          weightKg: v.weightKg != null ? String(v.weightKg) : '',
          height: v.heightCm != null ? String(v.heightCm) : '',
          spo2: v.spo2 != null ? String(v.spo2) : '',
        })
      } catch { }
      try {
        const tests = Array.isArray(p?.diagnosticTests) ? (p.diagnosticTests as string[]).join(', ') : ''
        setEditDiagDisplay({ testsText: tests, notes: p?.diagnosticNotes || '' })
      } catch { }
      setEditActiveTab('details')
      setEditOpen(true)
    } catch (e: any) {
      alert(e?.message || 'Failed to load prescription')
    }
  }

  const setItem = (i: number, key: 'name' | 'frequency' | 'duration' | 'dose' | 'notes' | 'route' | 'instruction', val: string) => {
    setEditForm(f => {
      const next = [...f.items]
      next[i] = { ...next[i], [key]: val }
      return { ...f, items: next }
    })
  }
  const addItemAfter = (i: number) => setEditForm(f => ({ ...f, items: [...f.items.slice(0, i + 1), { name: '', frequency: '', duration: '', dose: '', notes: '' }, ...f.items.slice(i + 1)] }))
  const removeItemAt = (i: number) => setEditForm(f => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }))

  function goEditTab(tab: 'details' | 'vitals' | 'labs' | 'therapy' | 'diagnostics' | 'meds') {
    if (editActiveTab === 'vitals') {
      try { const disp = vitalsEditRef.current?.getDisplay?.(); if (disp) setEditVitalsDisplay(disp) } catch { }
    }
    if (editActiveTab === 'diagnostics') {
      try { const dd = diagEditRef.current?.getDisplay?.(); if (dd) setEditDiagDisplay(dd) } catch { }
    }
    setEditActiveTab(tab)
  }

  async function saveEdit() {
    const payload: any = {
      primaryComplaint: editForm.primaryComplaint || undefined,
      primaryComplaintHistory: editForm.primaryComplaintHistory || undefined,
      familyHistory: editForm.familyHistory || undefined,
      allergyHistory: editForm.allergyHistory || undefined,
      treatmentHistory: editForm.treatmentHistory || undefined,
      history: editForm.history || undefined,
      examFindings: editForm.examFindings || undefined,
      diagnosis: editForm.diagnosis || undefined,
      advice: editForm.advice || undefined,
      medicine: (editForm.items || []).filter(it => (it.name || '').trim()).map(it => ({ name: String(it.name).trim(), frequency: it.frequency || undefined, duration: it.duration || undefined, dose: it.dose || undefined, notes: (it.route || it.instruction) ? [it.route ? `Route: ${it.route}` : null, it.instruction ? `Instruction: ${it.instruction}` : null].filter(Boolean).join('; ') : (it.notes || undefined) })),
    }
    if (editForm.labTestsText !== undefined) {
      const tests = String(editForm.labTestsText || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)
      payload.labTests = tests.length ? tests : []
    }
    if (editForm.labNotes !== undefined) payload.labNotes = editForm.labNotes || undefined
    if (editForm.therapyTestsText !== undefined) {
      const tests = String(editForm.therapyTestsText || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)
      payload.therapyTests = tests.length ? tests : []
    }
    if (editForm.therapyNotes !== undefined) payload.therapyNotes = editForm.therapyNotes || undefined
    // diagnostics from tab
    try {
      let dRaw: any = {}
      try { dRaw = diagEditRef.current?.getData?.() || {} } catch { }
      if (Array.isArray(dRaw.tests) && dRaw.tests.length) payload.diagnosticTests = dRaw.tests
      else if ((editDiagDisplay.testsText || '').trim()) payload.diagnosticTests = String(editDiagDisplay.testsText).split(/\n|,/).map(s => s.trim()).filter(Boolean)
      if (dRaw.notes && String(dRaw.notes).trim()) payload.diagnosticNotes = dRaw.notes
      else if ((editDiagDisplay.notes || '').trim()) payload.diagnosticNotes = editDiagDisplay.notes
    } catch { }
    if (!payload.medicine || payload.medicine.length === 0) { alert('Add at least one medicine'); return }
    try {
      // vitals from tab
      try {
        let vRaw: any
        try { vRaw = vitalsEditRef.current?.getNormalized?.() } catch { }
        const hasVitals = vRaw && Object.values(vRaw).some((x: any) => x != null && !(typeof x === 'number' && isNaN(x)))
        let vitals: any = undefined
        if (hasVitals) vitals = vRaw
        else if ((editVitalsDisplay) && Object.values(editVitalsDisplay).some(Boolean)) {
          const d: any = editVitalsDisplay
          const n = (x?: any) => { const v = parseFloat(String(x || '').trim()); return isFinite(v) ? v : undefined }
          vitals = {
            pulse: n(d.pulse),
            temperatureC: n(d.temperature),
            bloodPressureSys: n(d.bloodPressureSys),
            bloodPressureDia: n(d.bloodPressureDia),
            respiratoryRate: n(d.respiratoryRate),
            bloodSugar: n(d.bloodSugar),
            weightKg: n(d.weightKg),
            heightCm: n(d.height),
            spo2: n(d.spo2),
          }
        }
        if (vitals) payload.vitals = vitals
      } catch { }
      await hospitalApi.updatePrescription(editingId, payload)
      setEditOpen(false)
      await load()
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch { }
    } catch (e: any) {
      alert(e?.message || 'Failed to update prescription')
    }
  }

  async function deletePres(id: string) {
    try {
      await hospitalApi.deletePrescription(id)
      await load()
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch { }
      setToast({ msg: 'Prescription deleted', kind: 'success' })
    } catch (e: any) {
      setToast({ msg: e?.message || 'Failed to delete prescription', kind: 'error' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-print space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg sm:text-xl font-semibold text-slate-800">Prescription History</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value) }} className="w-full sm:w-auto rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500" />
              <span className="text-slate-500 text-sm">to</span>
              <input type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value) }} className="w-full sm:w-auto rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500" />
            </div>
            <div className="flex items-center gap-2">
              <select value={limit} onChange={e => { setPage(1); setLimit(parseInt(e.target.value) || 20) }} className="rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-navy-500 bg-white">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <div className="relative flex-1 sm:flex-none">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="w-full sm:w-64 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500" />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
            <div className="font-medium text-slate-800">Results</div>
            <div className="text-slate-600">{total ? `${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total}` : ''}</div>
          </div>
          <div className="divide-y divide-slate-200">
            {mine.map(p => (
              <div key={p.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{p.patientName} <span className="text-xs text-slate-500">{p.mrNo || ''}</span></div>
                <div className="text-xs text-slate-600">{new Date(p.createdAt).toLocaleString()} • {p.diagnosis || '-'}</div>
                {p.primaryComplaint && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Primary Complaint:</span> {p.primaryComplaint}</div>}
                {p.primaryComplaintHistory && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">History of Primary Complaint:</span> {p.primaryComplaintHistory}</div>}
                {p.familyHistory && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Family History:</span> {p.familyHistory}</div>}
                {p.allergyHistory && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Allergy History:</span> {p.allergyHistory}</div>}
                {p.treatmentHistory && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Treatment History:</span> {p.treatmentHistory}</div>}
                {p.history && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">History:</span> {p.history}</div>}
                {p.examFindings && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Findings:</span> {p.examFindings}</div>}
                {p.advice && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Advice:</span> {p.advice}</div>}
                {p.medicines && <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{p.medicines}</pre>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button className="btn-outline-navy" onClick={() => handlePrint(p.id)}>Print</button>
                  <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" onClick={() => handleDownload(p.id)}>Download</button>
                  {(() => {
                    const done = !!refFlags[p.id]?.ph; return (
                      <button
                        className={`rounded-md px-3 py-1 text-sm ${done ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}
                        disabled={done}
                        title={done ? 'Already referred to pharmacy' : ''}
                        onClick={() => openConfirm('pharmacy', p)}
                      >Refer to Pharmacy</button>
                    )
                  })()}
                  {(() => {
                    const done = !!refFlags[p.id]?.diag; return (
                      <button
                        className={`rounded-md px-3 py-1 text-sm ${done ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border border-slate-300'}`}
                        disabled={done}
                        title={done ? 'Already referred to diagnostic' : ''}
                        onClick={() => openConfirm('diagnostic', p)}
                      >Refer to Diagnostic</button>
                    )
                  })()}
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                    onClick={() => navigate('/doctor/prescription', { state: { prescriptionId: p.id, encounterId: p.encounterId } })}
                  >
                    Edit
                  </button>
                  <button className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700" onClick={() => openConfirm('delete', p)}>Delete</button>
                </div>
              </div>
            ))}
            {mine.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">No prescriptions</div>}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
            <div className="text-slate-600">Page {page}</div>
            <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {printData && (
        <PrescriptionPrint
          printId="prescription-print-history"
          doctor={printData.doctor || {}}
          settings={printData.settings || { name: '', address: '', phone: '' }}
          patient={printData.patient || {}}
          items={printData.items || []}
          vitals={printData.vitals}
          historyTaking={printData.historyTaking}
          primaryComplaint={printData.primaryComplaint}
          primaryComplaintHistory={printData.primaryComplaintHistory}
          familyHistory={printData.familyHistory}
          allergyHistory={printData.allergyHistory}
          treatmentHistory={printData.treatmentHistory}
          history={printData.history}
          examFindings={printData.examFindings}
          diagnosis={printData.diagnosis}
          advice={printData.advice}
          labTests={printData.labTests || []}
          labNotes={printData.labNotes || ''}
          diagnosticTests={printData.diagnosticTests || []}
          diagnosticNotes={printData.diagnosticNotes || ''}
          diagnosticDiscount={printData.diagnosticDiscount}
          therapyTests={printData.therapyTests || []}
          therapyNotes={printData.therapyNotes || ''}
          therapyDiscount={printData.therapyDiscount}
          therapyPlan={printData.therapyPlan}
          therapyMachines={printData.therapyMachines}
          counselling={printData.counselling}
          counsellingDiscount={printData.counsellingDiscount}
          createdAt={printData.createdAt}
        />
      )}
      {/* Confirm referral modal */}
      {confirmDlg.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-4">
            <div className="mb-3 text-lg font-semibold text-slate-800">{confirmDlg.type === 'delete' ? 'Delete Prescription' : 'Confirm Referral'}</div>
            <div className="text-sm text-slate-700">
              {confirmDlg.type === 'delete' ? 'Are you sure you want to delete this prescription? This action cannot be undone.' : `Create a ${confirmDlg.type === 'pharmacy' ? 'Pharmacy' : confirmDlg.type === 'lab' ? 'Lab' : 'Diagnostic'} referral for this prescription?`}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDlg({ open: false })} className="btn-outline-navy">Cancel</button>
              <button onClick={confirmReferral} className="btn">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-[60]">
          <div className={`rounded-md px-3 py-2 text-sm shadow ${toast.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{toast.msg}</div>
        </div>
      )}
      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-2 py-4 sm:px-4">
          <div className="w-full max-w-4xl max-h-[96dvh] flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <h3 className="text-lg font-semibold text-slate-800">Edit Prescription</h3>
              <button onClick={() => setEditOpen(false)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="border-b border-slate-200">
                <nav className="-mb-px flex flex-wrap gap-2 pb-2">
                  <button type="button" onClick={() => goEditTab('details')} className={`px-3 py-2 text-sm ${editActiveTab === 'details' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Details</button>
                  <button type="button" onClick={() => goEditTab('vitals')} className={`px-3 py-2 text-sm ${editActiveTab === 'vitals' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Vitals</button>
                  <button type="button" onClick={() => goEditTab('labs')} className={`px-3 py-2 text-sm ${editActiveTab === 'labs' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Lab Orders</button>
                  <button type="button" onClick={() => goEditTab('therapy')} className={`px-3 py-2 text-sm ${editActiveTab === 'therapy' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Therapy Orders</button>
                  <button type="button" onClick={() => goEditTab('diagnostics')} className={`px-3 py-2 text-sm ${editActiveTab === 'diagnostics' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Diagnostic Orders</button>
                  <button type="button" onClick={() => goEditTab('meds')} className={`px-3 py-2 text-sm ${editActiveTab === 'meds' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Medicines</button>
                </nav>
              </div>
              <div className="mt-4">
                {/* ... tab content ... (the actual content will be preserved as it was inside the view range) */}
                {editActiveTab === 'details' && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Primary Complaint</label>
                      <textarea rows={2} value={editForm.primaryComplaint || ''} onChange={e => setEditForm(f => ({ ...f, primaryComplaint: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Risk Factors / Medical History</label>
                      <textarea rows={2} value={editForm.history || ''} onChange={e => setEditForm(f => ({ ...f, history: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">History of Primary Complaint</label>
                        <textarea rows={2} value={editForm.primaryComplaintHistory || ''} onChange={e => setEditForm(f => ({ ...f, primaryComplaintHistory: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Family History</label>
                        <textarea rows={2} value={editForm.familyHistory || ''} onChange={e => setEditForm(f => ({ ...f, familyHistory: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Allergy History</label>
                      <textarea rows={2} value={editForm.allergyHistory || ''} onChange={e => setEditForm(f => ({ ...f, allergyHistory: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Treatment History</label>
                      <textarea rows={2} value={editForm.treatmentHistory || ''} onChange={e => setEditForm(f => ({ ...f, treatmentHistory: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Examination Findings</label>
                        <textarea rows={2} value={editForm.examFindings || ''} onChange={e => setEditForm(f => ({ ...f, examFindings: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Diagnosis / Disease</label>
                        <input value={editForm.diagnosis || ''} onChange={e => setEditForm(f => ({ ...f, diagnosis: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Advice/Referral</label>
                      <textarea rows={2} value={editForm.advice || ''} onChange={e => setEditForm(f => ({ ...f, advice: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
                {editActiveTab === 'vitals' && (
                  <div>
                    <PrescriptionVitals ref={vitalsEditRef} initial={editVitalsDisplay} />
                  </div>
                )}
                {editActiveTab === 'labs' && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Lab Tests (comma or one per line)</label>
                      <textarea rows={3} value={editForm.labTestsText || ''} onChange={e => setEditForm(f => ({ ...f, labTestsText: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="CBC, LFT, KFT" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Lab Notes</label>
                      <textarea rows={2} value={editForm.labNotes || ''} onChange={e => setEditForm(f => ({ ...f, labNotes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
                {editActiveTab === 'therapy' && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Therapy Orders (comma or one per line)</label>
                      <textarea rows={3} value={editForm.therapyTestsText || ''} onChange={e => setEditForm(f => ({ ...f, therapyTestsText: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Physiotherapy, Exercise" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Therapy Notes</label>
                      <textarea rows={2} value={editForm.therapyNotes || ''} onChange={e => setEditForm(f => ({ ...f, therapyNotes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
                {editActiveTab === 'diagnostics' && (
                  <div>
                    <PrescriptionDiagnosticOrders ref={diagEditRef} doctorId={doc?.id} initialTestsText={editDiagDisplay.testsText} initialNotes={editDiagDisplay.notes} />
                  </div>
                )}
                {editActiveTab === 'meds' && (
                  <div>
                    <div className="mb-1 block text-sm text-slate-700">Medicines</div>
                    <div className="rounded-xl border border-slate-200">
                      <div className="hidden sm:grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                        <div className="col-span-4">Medicine</div>
                        <div className="col-span-2">Frequency</div>
                        <div className="col-span-2">Duration</div>
                        <div className="col-span-1">Dosage</div>
                        <div className="col-span-1">Route</div>
                        <div className="col-span-1">Instruction</div>
                        <div className="col-span-1"></div>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {editForm.items.map((m, idx) => (
                          <div key={idx} className="px-3 py-2">
                            <div className="grid grid-cols-12 items-center gap-2">
                              <input className="col-span-12 sm:col-span-4 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Medicine name" value={m.name || ''} onChange={e => setItem(idx, 'name', e.target.value)} />
                              <input className="col-span-6 sm:col-span-2 rounded-md border border-slate-300 px-2 py-2 text-sm" placeholder="Frequency" value={m.frequency || ''} onChange={e => setItem(idx, 'frequency', e.target.value)} />
                              <input className="col-span-6 sm:col-span-2 rounded-md border border-slate-300 px-2 py-2 text-sm" placeholder="Duration" value={m.duration || ''} onChange={e => setItem(idx, 'duration', e.target.value)} />
                              <input className="col-span-6 sm:col-span-1 rounded-md border border-slate-300 px-2 py-2 text-sm" placeholder="Dosage" value={m.dose || ''} onChange={e => setItem(idx, 'dose', e.target.value)} />
                              <input className="col-span-6 sm:col-span-1 rounded-md border border-slate-300 px-2 py-2 text-sm" placeholder="Route" value={m.route || ''} onChange={e => setItem(idx, 'route', e.target.value)} />
                              <input className="col-span-6 sm:col-span-1 rounded-md border border-slate-300 px-2 py-2 text-sm" placeholder="Instruction" value={m.instruction || ''} onChange={e => setItem(idx, 'instruction', e.target.value)} />
                              <div className="col-span-12 sm:col-span-1 flex items-center justify-end">
                                <button type="button" onClick={() => removeItemAt(idx)} className="text-rose-600" title="Remove">🗑️</button>
                              </div>
                            </div>
                            <div className="mt-2 flex justify-end">
                              <button type="button" onClick={() => addItemAfter(idx)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">+ Add</button>
                            </div>
                          </div>
                        ))}
                        {editForm.items.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-500">No medicines <button type="button" onClick={() => setEditForm(f => ({ ...f, items: [{ name: '', frequency: '', duration: '', dose: '', route: '', instruction: '', notes: '' }] }))} className="underline">Add one</button></div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setEditOpen(false)} className="btn-outline-navy">Cancel</button>
                <button onClick={saveEdit} className="btn">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function fetchPrintData(id: string) {
  const [detail, settings] = await Promise.all([
    hospitalApi.getPrescription(id) as any,
    hospitalApi.getSettings() as any,
  ])
  const pres = detail?.prescription
  const encounterId = String(pres?.encounterId?._id || pres?.encounterId || '')
  let historyTaking: any = null
  try {
    if (encounterId) {
      const ht: any = await hospitalApi.getHistoryTaking(encounterId)
      historyTaking = ht?.historyTaking?.data || null
    }
  } catch { }
  const vitalsFromHistoryTaking = (() => {
    const d: any = historyTaking || null
    if (!d) return undefined
    const p = d.personalInfo || d.personal_info || d.personal || d.patient || d
    const num = (x: any) => {
      if (x == null) return undefined
      const v = parseFloat(String(x).trim())
      return isFinite(v) ? v : undefined
    }
    const bpRaw = p?.bp ?? p?.BP ?? p?.bloodPressure ?? p?.blood_pressure
    let sys: number | undefined
    let dia: number | undefined
    if (typeof bpRaw === 'string') {
      const s = String(bpRaw).trim()
      if (s.includes('/')) {
        const m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
        if (m) { sys = num(m[1]); dia = num(m[2]) }
      } else {
        // Sometimes BP is stored as a single number like "120" (systolic only)
        sys = num(s)
      }
    } else if (bpRaw && typeof bpRaw === 'object') {
      sys = num(bpRaw.sys ?? bpRaw.systolic ?? bpRaw.bloodPressureSys)
      dia = num(bpRaw.dia ?? bpRaw.diastolic ?? bpRaw.bloodPressureDia)
    }
    const heightCm = num(p?.heightCm ?? p?.height_cm ?? p?.height)
    const weightKg = num(p?.weightKg ?? p?.weight_kg ?? p?.weight)
    if (sys == null && dia == null && heightCm == null && weightKg == null) return undefined
    return {
      bloodPressureSys: sys,
      bloodPressureDia: dia,
      heightCm,
      weightKg,
    }
  })()
  const vitals = pres?.vitals || vitalsFromHistoryTaking
  let patient: any = { name: pres?.encounterId?.patientId?.fullName || '-', mrn: pres?.encounterId?.patientId?.mrn || '-' }
  try {
    if (patient?.mrn) {
      let p: any = null
      try {
        const resp: any = await labApi.getPatientByMrn(patient.mrn)
        p = resp?.patient || null
      } catch { }
      // Fallback: doctor portal may not have access to /lab routes; use hospital patient search (DB-backed)
      if (!p) {
        try {
          const resp: any = await hospitalApi.searchPatients({ mrn: String(patient.mrn), limit: 1 })
          const first = Array.isArray(resp?.patients) ? resp.patients[0] : null
          p = first || null
        } catch { }
      }
      if (p) {
        let ageTxt = ''
        try {
          if (p.age != null) ageTxt = String(p.age)
          else if (p.dob) { const dob = new Date(p.dob); if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now() - dob.getTime()) / 31557600000))) }
        } catch { }
        const gender = p.gender || p.sex || p.Gender || '-'
        const fatherName = p.fatherName || p.guardianName || p.guardian || p.father || p.father_name || '-'
        const phone = p.phoneNormalized || p.phone || p.phoneNumber || p.mobile || p.mobileNo || '-'
        const address = p.address || p.homeAddress || p.currentAddress || p.addressLine || '-'
        patient = { name: p.fullName || p.name || patient.name, mrn: p.mrn || p.mrNo || patient.mrn, gender, fatherName, phone, address, age: ageTxt }
      }
    }
  } catch { }
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
      const deptName = d?.primaryDepartmentId ? (depArray.find((z: any) => String(z._id || z.id) === String(d.primaryDepartmentId))?.name || '') : ''
      if (deptName) doctor.departmentName = deptName
    } catch { }
  } catch { }
  return { settings, doctor, patient, historyTaking, items: pres?.medicine || pres?.items || [], vitals, labTests: pres?.labTests || [], labNotes: pres?.labNotes, diagnosticTests: pres?.diagnosticTests || [], diagnosticNotes: pres?.diagnosticNotes, diagnosticDiscount: pres?.diagnosticDiscount, therapyTests: pres?.therapyTests || [], therapyNotes: pres?.therapyNotes || '', therapyDiscount: pres?.therapyDiscount, therapyPlan: pres?.therapyPlan, therapyMachines: pres?.therapyMachines, counselling: pres?.counselling, counsellingDiscount: pres?.counsellingDiscount, createdAt: pres?.createdAt }
}

// helper for fetching data used by both print and download
