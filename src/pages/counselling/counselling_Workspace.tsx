import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import PrescriptionPrint from '../../components/doctor/PrescriptionPrint'

type CounsellingForm = {
  presentingConcerns?: string
  assessment?: string
  interventions?: string
  recommendations?: string
  riskLevel?: string
  followUpPlan?: string
  notes?: string
}

const emptyForm: CounsellingForm = {
  presentingConcerns: '',
  assessment: '',
  interventions: '',
  recommendations: '',
  riskLevel: '',
  followUpPlan: '',
  notes: '',
}

export default function Counselling_Workspace() {
  const navigate = useNavigate()
  const { encounterId = '' } = useParams() as any

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)

  const [patient, setPatient] = useState<any>(null)
  const [doctor, setDoctor] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [prescription, setPrescription] = useState<any>(null)

  const [form, setForm] = useState<CounsellingForm>(emptyForm)
  const [discount, setDiscount] = useState('')

  const printRef = useRef<HTMLDivElement | null>(null)

  const can = useMemo(() => {
    try {
      const raw = localStorage.getItem('counselling.session') || localStorage.getItem('hospital.session')
      const s = raw ? JSON.parse(raw) : null
      const perms = s?.permissions || {}
      const allowedRoutes = perms?.counselling
      const isAdmin = String(s?.role || '').toLowerCase() === 'admin'

      const hasPortal = Array.isArray(allowedRoutes) ? allowedRoutes.length > 0 : isAdmin
      const view = hasPortal

      // granular permissions requested by user
      const p = perms || {}
      const viewPerm = p['counselling.view'] !== false
      const editPerm = p['counselling.edit'] !== false
      const printPerm = p['counselling.print'] !== false

      return { view: view && viewPerm, edit: editPerm, print: printPerm }
    } catch {
      return { view: true, edit: true, print: true }
    }
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 2500)
  }

  const load = async () => {
    if (!encounterId) return
    setLoading(true)
    setErr('')
    try {
      const [presRes, settingsRes] = await Promise.all([
        hospitalApi.getPrescriptionByEncounter(String(encounterId)) as any,
        hospitalApi.getSettings().catch(() => null) as any,
      ])
      console.log('Prescription Response:', presRes)
      console.log('Settings Response:', settingsRes)

      const p = presRes?.prescription || null
      setPrescription(p)
      setSettings(settingsRes)

      const enc = p?.encounterId
      console.log('Encounter from prescription:', enc)
      const pat = enc?.patientId
      const doc = enc?.doctorId
      console.log('Patient from encounter:', pat)
      console.log('Doctor from encounter:', doc)
      setPatient(pat || null)
      setDoctor(doc || null)

      const c = p?.counselling && typeof p.counselling === 'object' ? p.counselling : null
      setForm({
        presentingConcerns: String(c?.presentingConcerns || ''),
        assessment: String(c?.assessment || ''),
        interventions: String(c?.interventions || ''),
        recommendations: String(c?.recommendations || ''),
        riskLevel: String(c?.riskLevel || ''),
        followUpPlan: String(c?.followUpPlan || ''),
        notes: String(c?.notes || c?.note || ''),
      })
      setDiscount(p?.counsellingDiscount != null ? String(p.counsellingDiscount) : '')
    } catch (e: any) {
      setErr(e?.message || 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [encounterId])

  const save = async () => {
    if (!encounterId) return
    if (!can.edit) { showToast('error', 'No permission to edit'); return }

    setSaving(true)
    setErr('')
    try {
      const payload: any = {
        counselling: {
          presentingConcerns: form.presentingConcerns || '',
          assessment: form.assessment || '',
          interventions: form.interventions || '',
          recommendations: form.recommendations || '',
          riskLevel: form.riskLevel || '',
          followUpPlan: form.followUpPlan || '',
          notes: form.notes || '',
          // compatibility with existing print rendering
          note: form.notes || '',
        },
        counsellingDiscount: discount ? Number(discount) : 0,
      }

      const res: any = await hospitalApi.upsertPrescriptionByEncounter(String(encounterId), payload)
      setPrescription(res?.prescription || res)

      // Also update appointment status to Completed and mark counselling as saved
      try {
        // Find appointment by encounterId and update status
        console.log('Looking for appointment with encounterId:', encounterId)
        const apptRes: any = await hospitalApi.listAppointments({ encounterId: String(encounterId) })
        console.log('Appointment search result:', apptRes)
        const appointments = apptRes?.appointments || apptRes?.items || []
        console.log('Found appointments:', appointments.length)
        if (appointments.length > 0) {
          const apptId = appointments[0]._id || appointments[0].id
          console.log('Updating appointment:', apptId)
          if (apptId) {
            const updateRes: any = await hospitalApi.updateAppointment(apptId, { 
              status: 'Completed',
              counsellingSaved: true 
            })
            console.log('Update result:', updateRes)
          }
        } else {
          console.log('No appointment found for this encounter')
        }
      } catch (e) {
        // Silently fail - appointment update is secondary
        console.log('Could not update appointment status:', e)
      }

      showToast('success', 'Saved')
    } catch (e: any) {
      setErr(e?.message || 'Failed to save')
      showToast('error', 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const doPrint = async () => {
    if (!can.print) { showToast('error', 'No permission to print'); return }
    try {
      window.print()
    } catch {
      showToast('error', 'Print failed')
    }
  }

  const printProps = useMemo(() => {
    const p = prescription || {}
    const enc = p?.encounterId || {}
    return {
      printId: 'counselling-print',
      doctor: enc?.doctorId,
      settings,
      patient: enc?.patientId,
      items: p?.medicine || p?.items || [],
      createdAt: p?.createdAt,
      labTests: p?.labTests,
      labNotes: p?.labNotes,
      diagnosticTests: p?.diagnosticTests,
      diagnosticNotes: p?.diagnosticNotes,
      counselling: {
        presentingConcerns: form.presentingConcerns,
        assessment: form.assessment,
        interventions: form.interventions,
        recommendations: form.recommendations,
        riskLevel: form.riskLevel,
        followUpPlan: form.followUpPlan,
        note: form.notes,
        notes: form.notes,
      },
      counsellingDiscount: discount ? Number(discount) : undefined,
    }
  }, [prescription, settings, form, discount])

  if (!can.view) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Counselling Workspace</h2>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {patient?.fullName ? `${patient.fullName} (${patient.mrn || ''})` : 'Session'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/counselling/appointments')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back
          </button>
          <button
            onClick={() => navigate(`/counselling/history?mrn=${encodeURIComponent(String(patient?.mrn || ''))}`)}
            disabled={!patient?.mrn}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            History
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || loading || !can.edit}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => void doPrint()}
            disabled={loading || !can.print}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800"
          >
            Print
          </button>
        </div>
      </div>

      {toast && (
        <div className={`rounded-md px-3 py-2 text-sm ${toast.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200'}`}>
          {toast.message}
        </div>
      )}

      {err && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">{err}</div>
      )}

      {/* Print-only styles to hide UI elements when printing */}
      <style>{`
        @media print {
          /* Hide all buttons and navigation in print view */
          button, .no-print, nav, header, .sidebar {
            display: none !important;
          }
          /* Show only the print content */
          .print-only {
            display: block !important;
          }
          /* Hide scrollbars */
          body, html {
            overflow: visible !important;
            height: auto !important;
          }
          /* Remove margins for clean print */
          @page {
            margin: 1cm;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 no-print">
        <div className="lg:col-span-2 space-y-3">
          <Section title="Presenting Concerns">
            <TextArea value={form.presentingConcerns || ''} onChange={(v) => setForm(s => ({ ...s, presentingConcerns: v }))} disabled={!can.edit} />
          </Section>
          <Section title="Counselling Assessment">
            <TextArea value={form.assessment || ''} onChange={(v) => setForm(s => ({ ...s, assessment: v }))} disabled={!can.edit} />
          </Section>
          <Section title="Interventions">
            <TextArea value={form.interventions || ''} onChange={(v) => setForm(s => ({ ...s, interventions: v }))} disabled={!can.edit} />
          </Section>
          <Section title="Recommendations">
            <TextArea value={form.recommendations || ''} onChange={(v) => setForm(s => ({ ...s, recommendations: v }))} disabled={!can.edit} />
          </Section>
          <Section title="Follow Up Plan">
            <TextArea value={form.followUpPlan || ''} onChange={(v) => setForm(s => ({ ...s, followUpPlan: v }))} disabled={!can.edit} />
          </Section>
          <Section title="Notes">
            <TextArea value={form.notes || ''} onChange={(v) => setForm(s => ({ ...s, notes: v }))} disabled={!can.edit} />
          </Section>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Session</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <div><span className="font-medium">MRN:</span> {patient?.mrn || '—'}</div>
              <div className="mt-1"><span className="font-medium">Patient:</span> {patient?.fullName || '—'}</div>
              <div className="mt-1"><span className="font-medium">Doctor:</span> {doctor?.name || '—'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Risk Level</div>
            <select
              value={form.riskLevel || ''}
              onChange={(e) => setForm(s => ({ ...s, riskLevel: e.target.value }))}
              disabled={!can.edit}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>

            <div className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Discount</div>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={!can.edit}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="hidden print-only">
        <div ref={printRef as any}>
          <PrescriptionPrint {...(printProps as any)} />
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function TextArea({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={4}
      className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
      placeholder="Type here…"
    />
  )
}
