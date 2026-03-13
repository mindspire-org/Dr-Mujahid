import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Pencil, ReceiptText, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type AppointmentType = 'OPD' | 'Diagnostic' | 'Therapy' | 'Counselling'

type Appointment = {
  _id: string
  appointmentType: AppointmentType

  patientId?: string
  patientMrn?: string
  patientName: string
  patientPhone?: string
  patientAge?: string
  patientGender?: string
  guardianRel?: string
  guardianName?: string
  cnic?: string
  address?: string

  departmentId?: any
  doctorId?: any

  appointmentDate: string
  appointmentTime?: string

  feeResolved?: number

  notes?: string
  receptionistName?: string

  createdAt?: string
}

type AppointmentForm = {
  appointmentType: AppointmentType
  patientName: string
  patientPhone: string
  patientAge: string
  patientGender: string
  guardianRel: string
  guardianName: string
  cnic: string
  address: string
  mrn: string

  departmentId: string
  doctorId: string

  appointmentDate: string
  appointmentTime: string

  notes: string
  receptionistName: string
}

function emptyForm(): AppointmentForm {
  return {
    appointmentType: 'OPD',
    patientName: '',
    patientPhone: '',
    patientAge: '',
    patientGender: '',
    guardianRel: '',
    guardianName: '',
    cnic: '',
    address: '',
    mrn: '',
    departmentId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: '',
    receptionistName: '',
  }
}

function mapToPayload(form: AppointmentForm) {
  return {
    appointmentType: form.appointmentType,

    patientName: form.patientName.trim(),
    patientPhone: form.patientPhone || undefined,
    patientAge: form.patientAge || undefined,
    patientGender: form.patientGender || undefined,
    guardianRel: form.guardianRel || undefined,
    guardianName: form.guardianName || undefined,
    cnic: form.cnic || undefined,
    address: form.address || undefined,

    departmentId: form.departmentId || undefined,
    doctorId: form.doctorId || undefined,

    appointmentDate: form.appointmentDate,
    appointmentTime: form.appointmentTime || undefined,

    notes: form.notes || undefined,
    receptionistName: form.receptionistName || undefined,
  }
}

function AppointmentDialog({
  open,
  mode,
  title,
  initial,
  departments,
  doctors,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit' | 'view'
  title: string
  initial: AppointmentForm
  departments: Array<{ id: string; name: string }>
  doctors: Array<{ id: string; name: string; primaryDepartmentId?: string; departmentIds?: string[] }>
  onClose: () => void
  onSubmit?: (form: AppointmentForm) => void
}) {
  const [form, setForm] = useState<AppointmentForm>(initial)

  // Phone lookup state
  const [selectPatientOpen, setSelectPatientOpen] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<any[]>([])
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const phoneLookupTimerRef = useRef<any>(null)
  const phoneLookupSeqRef = useRef(0)
  const phoneRef = useRef<HTMLInputElement>(null)

  const filteredDoctors = useMemo(() => {
    if (!form.departmentId) return doctors
    return doctors.filter(d => {
      const dep = String(form.departmentId)
      if (d.primaryDepartmentId && String(d.primaryDepartmentId) === dep) return true
      if (Array.isArray(d.departmentIds) && d.departmentIds.map(String).includes(dep)) return true
      return false
    })
  }, [doctors, form.departmentId])

  useEffect(() => {
    if (!open) return
    setForm(initial)
    setPhoneMatches([])
    setSelectPatientOpen(false)
  }, [open, initial])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current)
    }
  }, [])

  if (!open) return null

  const readonly = mode === 'view'

  const update = (k: keyof AppointmentForm, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function runPhoneLookup(digits: string, { open }: { open: boolean }) {
    const d = String(digits || '').replace(/\D+/g, '')
    if (!d || d.length < 10) {
      setPhoneMatches([])
      setPhoneLookupLoading(false)
      if (open) setSelectPatientOpen(false)
      return
    }
    setPhoneLookupLoading(true)
    const seq = ++phoneLookupSeqRef.current
    try {
      const r: any = await hospitalApi.searchPatients({ phone: d, limit: 25 })
      if (seq !== phoneLookupSeqRef.current) return
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      setPhoneMatches(list)
      if (open) setSelectPatientOpen(list.length >= 1)
    } catch {
      if (seq !== phoneLookupSeqRef.current) return
      setPhoneMatches([])
      if (open) setSelectPatientOpen(false)
    } finally {
      if (seq !== phoneLookupSeqRef.current) return
      setPhoneLookupLoading(false)
    }
  }

  function schedulePhoneLookup(rawPhone: string, { open }: { open: boolean }) {
    const digits = String(rawPhone || '').replace(/\D+/g, '')
    if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current)
    if (!digits || digits.length < 10) {
      setPhoneMatches([])
      setPhoneLookupLoading(false)
      if (open) setSelectPatientOpen(false)
      return
    }
    phoneLookupTimerRef.current = setTimeout(() => {
      runPhoneLookup(digits, { open })
    }, 250)
  }

  function applyPatientToForm(p: any) {
    setForm(prev => ({
      ...prev,
      patientName: p.fullName || prev.patientName,
      patientPhone: p.phoneNormalized || p.phone || prev.patientPhone,
      patientAge: p.age != null ? String(p.age) : prev.patientAge,
      patientGender: p.gender || prev.patientGender,
      guardianRel: p.guardianRel || prev.guardianRel,
      guardianName: p.fatherName || prev.guardianName,
      cnic: p.cnicNormalized || p.cnic || prev.cnic,
      address: p.address || prev.address,
      mrn: p.mrn || '',
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          if (readonly) return
          if (!form.patientName.trim()) { alert('Patient name is required'); return }
          if (!form.appointmentDate) { alert('Appointment date is required'); return }
          onSubmit?.(form)
        }}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white p-0 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Appointment Detail</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Appointment Date</label>
                  <input
                    type="date"
                    value={form.appointmentDate}
                    onChange={e => update('appointmentDate', e.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Appointment Time</label>
                  <input
                    type="time"
                    value={form.appointmentTime}
                    onChange={e => update('appointmentTime', e.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Patient Information</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">MR Number</label>
                  <input
                    value={form.mrn || 'New Patient, MR not found'}
                    disabled
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Patient Name</label>
                  <input
                    value={form.patientName}
                    onChange={e => update('patientName', e.target.value)}
                    disabled={readonly}
                    placeholder="Patient name"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Phone</label>
                  <input
                    value={form.patientPhone}
                    onChange={e => { update('patientPhone', e.target.value); schedulePhoneLookup(e.target.value, { open: true }) }}
                    disabled={readonly}
                    placeholder="Phone"
                    ref={phoneRef}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Age</label>
                  <input
                    value={form.patientAge}
                    onChange={e => update('patientAge', e.target.value)}
                    disabled={readonly}
                    placeholder="Age"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Gender</label>
                  <input
                    value={form.patientGender}
                    onChange={e => update('patientGender', e.target.value)}
                    disabled={readonly}
                    placeholder="Gender"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Guardian Relation</label>
                  <input
                    value={form.guardianRel}
                    onChange={e => update('guardianRel', e.target.value)}
                    disabled={readonly}
                    placeholder="e.g. Father"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Guardian Name</label>
                  <input
                    value={form.guardianName}
                    onChange={e => update('guardianName', e.target.value)}
                    disabled={readonly}
                    placeholder="Guardian name"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">CNIC</label>
                  <input
                    value={form.cnic}
                    onChange={e => update('cnic', e.target.value)}
                    disabled={readonly}
                    placeholder="CNIC"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-sm text-slate-700">Address</label>
                  <input
                    value={form.address}
                    onChange={e => update('address', e.target.value)}
                    disabled={readonly}
                    placeholder="Address"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Doctor Information</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Department</label>
                  <select
                    value={form.departmentId}
                    onChange={e => {
                      update('departmentId', e.target.value)
                      update('doctorId', '')
                    }}
                    disabled={readonly}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Doctor</label>
                  <select
                    value={form.doctorId}
                    onChange={e => update('doctorId', e.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select doctor</option>
                    {filteredDoctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Notes</div>
              <div className="mt-4">
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  disabled={readonly}
                  placeholder="Notes / complaint / instructions"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={onClose} className="btn-outline-navy">
                  {readonly ? 'Close' : 'Cancel'}
                </button>
                {mode !== 'view' && (
                  <button type="submit" className="btn">
                    {mode === 'create' ? 'Create Appointment' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Patient Selection Modal */}
        {selectPatientOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div className="text-base font-semibold text-slate-800">Select Patient</div>
                <button
                  onClick={() => { setSelectPatientOpen(false); setPhoneMatches([]); }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4">
                <div className="mb-3 text-sm text-slate-600">
                  {phoneLookupLoading
                    ? `Searching registered patients...`
                    : (phoneMatches.length > 0
                        ? `Found ${phoneMatches.length} patients on this phone number. Select one to autofill.`
                        : `No registered patients found.`)
                  }
                </div>

                {!phoneLookupLoading && phoneMatches.length === 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    You can continue by entering a new patient.
                  </div>
                )}

                {phoneMatches.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {phoneMatches.map((p, idx) => (
                      <button
                        key={p._id || p.mrn || idx}
                        type="button"
                        onClick={() => {
                          applyPatientToForm(p)
                          setSelectPatientOpen(false)
                          setPhoneMatches([])
                        }}
                        className="w-full rounded-lg border border-slate-200 p-4 text-left hover:border-violet-300 hover:bg-violet-50"
                      >
                        <div className="text-sm font-semibold text-slate-800">{p.fullName || 'Unnamed'}</div>
                        <div className="mt-1 text-xs text-slate-600">MRN: {p.mrn || '-'}</div>
                        <div className="mt-1 text-xs text-slate-600">Phone: {p.phoneNormalized || form.patientPhone}</div>
                        {(p.age != null || p.gender) && (
                          <div className="mt-1 text-xs text-slate-600">
                            {p.age != null ? `Age: ${p.age}` : ''}{p.age != null && p.gender ? ' • ' : ''}{p.gender ? `Gender: ${p.gender}` : ''}
                          </div>
                        )}
                        {p.address && <div className="mt-1 line-clamp-2 text-xs text-slate-600">Address: {p.address}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
                <button
                  type="button"
                  onClick={() => { setSelectPatientOpen(false); setPhoneMatches([]); }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  Enter New Patient
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default function Hospital_Appointments() {
  const nav = useNavigate()
  const location = useLocation()
  const [rows, setRows] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; primaryDepartmentId?: string; departmentIds?: string[] }>>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState<AppointmentForm>(() => emptyForm())
  const [viewRow, setViewRow] = useState<Appointment | null>(null)
  const [editRow, setEditRow] = useState<Appointment | null>(null)
  const [deleteRow, setDeleteRow] = useState<Appointment | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [depRes, docRes] = await Promise.all([hospitalApi.listDepartments(), hospitalApi.listDoctors()])
        const depArray: any[] = ((depRes as any)?.departments || (depRes as any) || []) as any[]
        setDepartments(depArray.map((x: any) => ({ id: String(x._id || x.id), name: String(x.name || '') })))

        const docsArray: any[] = ((docRes as any)?.doctors || (docRes as any) || []) as any[]
        setDoctors(
          docsArray.map((x: any) => ({
            id: String(x._id || x.id),
            name: String(x.name || ''),
            primaryDepartmentId: x.primaryDepartmentId ? String(x.primaryDepartmentId) : undefined,
            departmentIds: Array.isArray(x.departmentIds) ? x.departmentIds.map((d: any) => String(d)) : undefined,
          }))
        )
      } catch {
        setDepartments([])
        setDoctors([])
      }
    })()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res: any = await hospitalApi.listAppointments({ from: from || undefined, to: to || undefined, q: q || undefined })
      setRows((res?.appointments || []) as Appointment[])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r => {
      const docName = r.doctorId?.name ? String(r.doctorId.name) : ''
      const depName = r.departmentId?.name ? String(r.departmentId.name) : ''
      return [r.patientName, r.patientPhone, docName, depName, r.appointmentDate, r.appointmentTime]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(s))
    })
  }, [q, rows])

  const resolveFee = (r: Appointment) => {
    if (r.feeResolved != null) return Number(r.feeResolved)
    const docFee = r.doctorId?.opdBaseFee
    const depFee = r.departmentId?.opdBaseFee
    const fee = (docFee != null ? Number(docFee) : (depFee != null ? Number(depFee) : null))
    return Number.isFinite(fee as any) ? (fee as number) : null
  }

  function formFromRow(r: Appointment): AppointmentForm {
    return {
      appointmentType: r.appointmentType,
      patientName: r.patientName || '',
      patientPhone: r.patientPhone || '',
      patientAge: r.patientAge || '',
      patientGender: r.patientGender || '',
      guardianRel: r.guardianRel || '',
      guardianName: r.guardianName || '',
      cnic: r.cnic || '',
      address: r.address || '',
      mrn: r.patientMrn || '',
      departmentId: r.departmentId?._id ? String(r.departmentId._id) : (r.departmentId ? String(r.departmentId) : ''),
      doctorId: r.doctorId?._id ? String(r.doctorId._id) : (r.doctorId ? String(r.doctorId) : ''),
      appointmentDate: r.appointmentDate || '',
      appointmentTime: r.appointmentTime || '',
      notes: r.notes || '',
      receptionistName: r.receptionistName || '',
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Appointments</h2>
        <button
          onClick={() => {
            setCreateInitial(emptyForm())
            setCreateOpen(true)
          }}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          + New Appointment
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <span className="text-slate-500 text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button
            type="button"
            onClick={() => {
              const t = new Date().toISOString().slice(0, 10)
              setFrom(t)
              setTo(t)
            }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom('')
              setTo('')
              setQ('')
              load()
            }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Reset
          </button>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search patient / doctor"
            className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button onClick={load} className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Search
          </button>
        </div>
      </div>

      <div className="mt-4 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Patient</th>
              <th className="px-4 py-2 text-left">Doctor</th>
              <th className="px-4 py-2 text-left">Fee</th>
              <th className="px-4 py-2 text-left">Department</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {filtered.map(r => (
              <tr key={r._id}>
                <td className="px-4 py-2">{r.appointmentDate || '-'}</td>
                <td className="px-4 py-2">{r.appointmentTime || '-'}</td>
                <td className="px-4 py-2">{r.appointmentType}</td>
                <td className="px-4 py-2 font-medium">{r.patientName || '-'}</td>
                <td className="px-4 py-2">{r.doctorId?.name || '-'}</td>
                <td className="px-4 py-2">{resolveFee(r) != null ? `Rs. ${Number(resolveFee(r)).toLocaleString()}` : '-'}</td>
                <td className="px-4 py-2">{r.departmentId?.name || '-'}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Booked
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const inReception = String(location?.pathname || '').startsWith('/reception')
                        nav(inReception ? '/reception/token-generator' : '/hospital/token-generator', {
                          state: {
                            from: 'appointments',
                            appointmentId: r._id,
                            patient: {
                              name: r.patientName,
                              phone: r.patientPhone,
                              age: r.patientAge,
                              gender: r.patientGender,
                              guardianRel: r.guardianRel,
                              guardianName: r.guardianName,
                              cnic: r.cnic,
                              address: r.address,
                            },
                            doctorId: r.doctorId?._id ? String(r.doctorId._id) : (r.doctorId ? String(r.doctorId) : ''),
                            departmentId: r.departmentId?._id ? String(r.departmentId._id) : (r.departmentId ? String(r.departmentId) : ''),
                          },
                        })
                      }}
                      className="rounded-md border border-emerald-300 p-2 text-emerald-700 hover:bg-emerald-50"
                      title="Generate Token"
                    >
                      <ReceiptText className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewRow(r)}
                      className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditRow(r)}
                      className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteRow(r)}
                      className="rounded-md border border-rose-300 p-2 text-rose-700 hover:bg-rose-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={9}>
                  {loading ? 'Loading...' : 'No appointments'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <AppointmentDialog
          open={createOpen}
          mode="create"
          title="New Appointment"
          initial={createInitial}
          departments={departments}
          doctors={doctors}
          onClose={() => setCreateOpen(false)}
          onSubmit={async form => {
            try {
              await hospitalApi.createAppointment(mapToPayload(form))
              setCreateOpen(false)
              await load()
            } catch {
              alert('Failed to create appointment')
            }
          }}
        />
      )}

      {viewRow != null && (
        <AppointmentDialog
          open={viewRow != null}
          mode="view"
          title="Appointment Details"
          initial={viewRow ? formFromRow(viewRow) : emptyForm()}
          departments={departments}
          doctors={doctors}
          onClose={() => setViewRow(null)}
        />
      )}

      {editRow != null && (
        <AppointmentDialog
          open={editRow != null}
          mode="edit"
          title="Edit Appointment"
          initial={editRow ? formFromRow(editRow) : emptyForm()}
          departments={departments}
          doctors={doctors}
          onClose={() => setEditRow(null)}
          onSubmit={async form => {
            if (!editRow) return
            try {
              await hospitalApi.updateAppointment(editRow._id, mapToPayload(form))
              setEditRow(null)
              await load()
            } catch {
              alert('Failed to update appointment')
            }
          }}
        />
      )}

      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteRow(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-base font-semibold text-slate-900">Delete Appointment</div>
              <div className="mt-1 text-sm text-slate-600">Are you sure you want to delete this appointment?</div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button type="button" onClick={() => setDeleteRow(null)} className="btn-outline-navy">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteRow._id
                  setDeleteRow(null)
                  try {
                    await hospitalApi.deleteAppointment(id)
                  } catch {}
                  await load()
                }}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
