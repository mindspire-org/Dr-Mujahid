import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Pencil, Trash2, ClipboardPlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { therapyApi } from '../../utils/api'

type PaymentStatus = 'paid' | 'unpaid'
type PaymentMethod = 'Cash' | 'Card'

type Appointment = {
  _id: string
  patientId?: any
  patientMrn?: string
  patientName: string
  patientPhone?: string
  patientAge?: string
  patientGender?: string
  guardianRel?: string
  guardianName?: string
  cnic?: string
  address?: string

  appointmentDate: string
  appointmentTime?: string

  referringConsultant?: string
  notes?: string
  receptionistName?: string

  packages?: string[]
  subtotal?: number
  discount?: number
  net?: number
  paymentStatus?: PaymentStatus
  paymentMethod?: PaymentMethod
  accountNumberIban?: string
  receivedToAccountCode?: string

  corporateId?: any
  corporatePreAuthNo?: string
  corporateCoPayPercent?: number
  corporateCoverageCap?: number

  createdAt?: string
}

type Package = { id: string; name: string; price: number }

type AppointmentForm = {
  patientId: string
  patientName: string
  patientPhone: string
  patientAge: string
  patientGender: string
  guardianRel: string
  guardianName: string
  cnic: string
  address: string
  mrn: string

  appointmentDate: string
  appointmentTime: string

  referringConsultant: string
  notes: string
  receptionistName: string

  packages: string[]
  discount: string
  paymentStatus: PaymentStatus
  receivedToAccountCode: string
  paymentMethod: PaymentMethod
  accountNumberIban: string

  corporateId: string
  corporatePreAuthNo: string
  corporateCoPayPercent: string
  corporateCoverageCap: string
}

function emptyForm(): AppointmentForm {
  return {
    patientId: '',
    patientName: '',
    patientPhone: '',
    patientAge: '',
    patientGender: '',
    guardianRel: '',
    guardianName: '',
    cnic: '',
    address: '',
    mrn: '',

    appointmentDate: '',
    appointmentTime: '',

    referringConsultant: '',
    notes: '',
    receptionistName: '',

    packages: [],
    discount: '0',
    paymentStatus: 'paid',
    receivedToAccountCode: '',
    paymentMethod: 'Cash',
    accountNumberIban: '',

    corporateId: '',
    corporatePreAuthNo: '',
    corporateCoPayPercent: '',
    corporateCoverageCap: '',
  }
}

function mapToPayload(form: AppointmentForm, packages: Package[], corpPriceMap: Record<string, number>) {
  const getEffectivePrice = (id: string): number => {
    const base = Number((packages.find(p => p.id === id)?.price) || 0)
    const v = corpPriceMap[id]
    return v != null ? Number(v) : base
  }
  const selectedPackages = form.packages.map(id => packages.find(p => p.id === id)).filter(Boolean) as Package[]
  const subtotal = selectedPackages.reduce((s, p) => s + getEffectivePrice(p.id), 0)
  const discount = Number(form.discount) || 0
  const net = Math.max(0, subtotal - discount)

  return {
    patientId: form.patientId || undefined,
    patientName: form.patientName.trim(),
    patientPhone: form.patientPhone || undefined,
    patientAge: form.patientAge || undefined,
    patientGender: form.patientGender || undefined,
    guardianRel: form.guardianRel || undefined,
    guardianName: form.guardianName || undefined,
    cnic: form.cnic || undefined,
    address: form.address || undefined,

    appointmentDate: form.appointmentDate,
    appointmentTime: form.appointmentTime || undefined,

    referringConsultant: form.referringConsultant || undefined,
    notes: form.notes || undefined,
    receptionistName: form.receptionistName || undefined,

    packages: form.packages,
    subtotal,
    discount,
    net,

    paymentStatus: form.paymentStatus,
    receivedToAccountCode: form.paymentStatus === 'paid' ? (form.receivedToAccountCode || undefined) : undefined,
    paymentMethod: form.paymentStatus === 'paid' ? form.paymentMethod : undefined,
    accountNumberIban: form.paymentStatus === 'paid' && form.paymentMethod === 'Card' ? (form.accountNumberIban || undefined) : undefined,

    ...(form.corporateId ? { corporateId: form.corporateId } : {}),
    ...(form.corporatePreAuthNo ? { corporatePreAuthNo: form.corporatePreAuthNo } : {}),
    ...(form.corporateCoPayPercent ? { corporateCoPayPercent: Number(form.corporateCoPayPercent) } : {}),
    ...(form.corporateCoverageCap ? { corporateCoverageCap: Number(form.corporateCoverageCap) } : {}),
  }
}

function AppointmentDialog({
  open,
  mode,
  title,
  initial,
  packages,
  corpPriceMap,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit' | 'view'
  title: string
  initial: AppointmentForm
  packages: Package[]
  corpPriceMap: Record<string, number>
  onClose: () => void
  onSubmit?: (form: AppointmentForm) => void
}) {
  const [form, setForm] = useState<AppointmentForm>(initial)
  const readonly = mode === 'view'

  const [selectPatientOpen, setSelectPatientOpen] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<any[]>([])
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const phoneLookupTimerRef = useRef<any>(null)
  const phoneLookupSeqRef = useRef(0)
  const phoneRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [showPackageDropdown, setShowPackageDropdown] = useState(false)
  const packagePickerRef = useRef<HTMLDivElement | null>(null)

  const getEffectivePrice = (id: string): number => {
    const base = Number((packages.find(p => p.id === id)?.price) || 0)
    const v = corpPriceMap[id]
    return v != null ? Number(v) : base
  }

  const selectedPackages = useMemo(() => form.packages.map(id => packages.find(p => p.id === id)).filter(Boolean) as Package[], [form.packages, packages])
  const subtotal = useMemo(() => selectedPackages.reduce((s, p) => s + getEffectivePrice(p.id), 0), [selectedPackages, corpPriceMap, packages])
  const discountNum = Number(form.discount) || 0
  const net = Math.max(0, subtotal - discountNum)

  const filteredPackages = useMemo(() => {
    const q = query.trim().toLowerCase()
    return packages
      .filter(p => !form.packages.includes(p.id))
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [packages, query, form.packages])

  useEffect(() => {
    if (!open) return
    setForm(initial)
    setQuery('')
    setShowPackageDropdown(false)
    setPhoneMatches([])
    setSelectPatientOpen(false)
  }, [open, initial])

  useEffect(() => {
    return () => {
      if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current)
    }
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = packagePickerRef.current
      if (!el) return
      if (!el.contains(e.target as any)) setShowPackageDropdown(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPackageDropdown(false)
    }
    if (open) {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

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
      const r: any = await therapyApi.searchPatients({ phone: d, limit: 25 })
      if (seq !== phoneLookupSeqRef.current) return
      const list: any[] = Array.isArray(r?.patients) ? r.patients : (Array.isArray(r) ? r : [])
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 py-4 sm:px-4" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          if (readonly) return
          if (!form.patientName.trim()) { alert('Patient name is required'); return }
          if (!form.appointmentDate) { alert('Appointment date is required'); return }
          if (!form.packages.length) { alert('Please select at least one package'); return }
          onSubmit?.({ ...form, discount: String(form.discount || '0') })
        }}
        className="w-full max-w-5xl max-h-[96dvh] flex flex-col rounded-xl bg-white p-0 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Appointment Details</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Appointment Date</label>
                  <input type="date" value={form.appointmentDate} onChange={e => update('appointmentDate', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Appointment Time</label>
                  <input type="time" value={form.appointmentTime} onChange={e => update('appointmentTime', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Patient Details</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">MR Number</label>
                  <input
                    value={form.mrn || 'New Patient, MR not found'}
                    disabled
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">Patient Name</label>
                  <input value={form.patientName} onChange={e => update('patientName', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Phone</label>
                  <input value={form.patientPhone} onChange={e => { update('patientPhone', e.target.value); schedulePhoneLookup(e.target.value, { open: true }) }} disabled={readonly} ref={phoneRef} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Age</label>
                  <input value={form.patientAge} onChange={e => update('patientAge', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Gender</label>
                  <select value={form.patientGender} onChange={e => update('patientGender', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Guardian S/O or D/O</label>
                  <select value={form.guardianRel} onChange={e => update('guardianRel', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select</option>
                    <option value="S/O">S/O</option>
                    <option value="D/O">D/O</option>
                    <option value="O">O</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Guardian Name</label>
                  <input value={form.guardianName} onChange={e => update('guardianName', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">CNIC</label>
                  <input value={form.cnic} onChange={e => update('cnic', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm text-slate-700">Address</label>
                  <input value={form.address} onChange={e => update('address', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Packages Details</div>
              <div className="mt-3 space-y-2" ref={packagePickerRef}>
                <input
                  value={query}
                  onFocus={() => setShowPackageDropdown(true)}
                  onClick={() => setShowPackageDropdown(true)}
                  onChange={e => { setQuery(e.target.value); setShowPackageDropdown(true) }}
                  placeholder="Search package by name..."
                  disabled={readonly}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {!readonly && showPackageDropdown && filteredPackages.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                    {filteredPackages.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, packages: [...prev.packages, p.id] }))}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-600">PKR {getEffectivePrice(p.id).toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPackages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedPackages.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-sm">
                        {p.name}
                        {!readonly && (
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, packages: prev.packages.filter(x => x !== p.id) }))}
                            className="text-slate-500 hover:text-slate-700"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Billing Summary</div>
              <div className="mt-3 divide-y divide-slate-200 text-sm">
                {selectedPackages.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2">
                    <div>{p.name}</div>
                    <div>PKR {getEffectivePrice(p.id).toLocaleString()}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 font-semibold">
                  <div>Net Fee</div>
                  <div>PKR {net.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{readonly ? 'Close' : 'Cancel'}</button>
                {mode !== 'view' && (
                  <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">{mode === 'create' ? 'Create Appointment' : 'Save Changes'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function TherapyLab_Appointments() {
  const nav = useNavigate()
  const [packages, setPackages] = useState<Package[]>([])

  const [rows, setRows] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState<AppointmentForm>(() => emptyForm())
  const [viewRow, setViewRow] = useState<Appointment | null>(null)
  const [editRow, setEditRow] = useState<Appointment | null>(null)
  const [deleteRow, setDeleteRow] = useState<Appointment | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = (await therapyApi.listAppointments({ q, from, to, limit: 200 })) as any
      const items = (res?.items || res || []) as Appointment[]
      setRows(Array.isArray(items) ? items : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await therapyApi.listPackages({ limit: 1000 }) as any
          const arr = (res?.items || res || []).map((p: any) => ({ id: String(p._id || p.id), name: String(p.packageName || ''), price: Number(p.price || 0) }))
          if (mounted) setPackages(arr)
        } catch {
          if (mounted) setPackages([])
        }
      })()
    return () => { mounted = false }
  }, [])

  useEffect(() => { load() }, [])

  const packagesMap = useMemo(() => Object.fromEntries(packages.map(p => [p.id, p.name])), [packages])

  function formFromRow(r: Appointment): AppointmentForm {
    return {
      ...emptyForm(),
      patientId: r.patientId?._id ? String(r.patientId._id) : (r.patientId ? String(r.patientId) : ''),
      patientName: r.patientName || '',
      patientPhone: r.patientPhone || '',
      patientAge: r.patientAge || '',
      patientGender: r.patientGender || '',
      guardianRel: r.guardianRel || '',
      guardianName: r.guardianName || '',
      cnic: r.cnic || '',
      address: r.address || '',
      mrn: (r.patientId as any)?.mrn || '',
      appointmentDate: r.appointmentDate || '',
      appointmentTime: r.appointmentTime || '',
      referringConsultant: r.referringConsultant || '',
      notes: r.notes || '',
      receptionistName: r.receptionistName || '',
      packages: Array.isArray(r.packages) ? r.packages.map(String) : [],
      discount: String(r.discount ?? 0),
      paymentStatus: (r.paymentStatus || 'paid') as any,
      receivedToAccountCode: r.receivedToAccountCode || '',
      paymentMethod: (r.paymentMethod || 'Cash') as any,
      accountNumberIban: r.accountNumberIban || '',
      corporateId: r.corporateId ? String(r.corporateId) : '',
      corporatePreAuthNo: r.corporatePreAuthNo || '',
      corporateCoPayPercent: r.corporateCoPayPercent != null ? String(r.corporateCoPayPercent) : '',
      corporateCoverageCap: r.corporateCoverageCap != null ? String(r.corporateCoverageCap) : '',
    }
  }

  const resolvePackageNames = (ids?: string[]) => {
    const list = (ids || []).map(id => packagesMap[String(id)] || String(id))
    return list.join(', ')
  }

  const handleCreate = async (f: AppointmentForm) => {
    try {
      const payload = mapToPayload(f, packages, {})
      await therapyApi.createAppointment(payload)
      setCreateOpen(false)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to create appointment')
    }
  }

  const handleUpdate = async (f: AppointmentForm) => {
    if (!editRow?._id) return
    try {
      const payload = mapToPayload(f, packages, {})
      await therapyApi.updateAppointment(editRow._id, payload)
      setEditRow(null)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to update appointment')
    }
  }

  const handleDelete = async () => {
    if (!deleteRow?._id) return
    try {
      await therapyApi.deleteAppointment(deleteRow._id)
      setDeleteRow(null)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete appointment')
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Appointments (Therapy)</h2>
        <button
          onClick={() => {
            const f = emptyForm()
            setCreateInitial(f)
            setCreateOpen(true)
          }}
          className="w-full sm:w-auto rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 shadow-sm"
        >
          + New Appointment
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date Range</label>
              <div className="flex items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
                <span className="text-slate-400 text-xs">to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
              </div>
            </div>
            <div className="flex-1 min-w-[300px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quick Search</label>
              <div className="flex gap-2">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search patient or phone..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
                <button onClick={load} className="h-9 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 shadow-sm">Search</button>
              </div>
            </div>
            <div className="flex gap-2 min-w-[160px]">
              <button
                type="button"
                onClick={() => {
                  const t = new Date().toISOString().slice(0, 10)
                  setFrom(t)
                  setTo(t)
                }}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-[600px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Patient</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Packages</th>
                <th className="px-4 py-2 text-left">Net Fee</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading appointments...</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No appointments found.</td>
                </tr>
              )}
              {rows.map(r => (
                <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap">{r.appointmentDate || '-'}</td>
                  <td className="px-4 py-2 font-medium">{r.patientName || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.patientPhone || '-'}</td>
                  <td className="px-4 py-2">{resolvePackageNames(r.packages)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{Number(r.net || 0) ? `Rs. ${Number(r.net || 0).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${String(r.paymentStatus || 'paid') === 'paid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                      {String(r.paymentStatus || 'paid') === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          nav('/therapy-lab/token-generator', {
                            state: {
                              from: 'appointments',
                              appointmentId: r._id,
                              patient: {
                                mrn: r.patientMrn || (r.patientId as any)?.mrn,
                                fullName: r.patientName,
                                phone: r.patientPhone,
                                age: r.patientAge,
                                gender: r.patientGender,
                                guardianRelation: r.guardianRel,
                                fatherName: r.guardianName,
                                cnic: r.cnic,
                                address: r.address,
                              },
                              requestedPackages: (r.packages || []).map(id => packagesMap[String(id)] || String(id)),
                              referringConsultant: r.referringConsultant,
                            }
                          })
                        }}
                        title="Generate Token"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                      >
                        <ClipboardPlus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewRow(r)}
                        title="View Details"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRow(r)}
                        title="Edit Appointment"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteRow(r)}
                        title="Delete Appointment"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AppointmentDialog
        open={createOpen}
        mode="create"
        title="New Therapy Appointment"
        initial={createInitial}
        packages={packages}
        corpPriceMap={{}}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <AppointmentDialog
        open={!!editRow}
        mode="edit"
        title="Edit Therapy Appointment"
        initial={editRow ? formFromRow(editRow) : emptyForm()}
        packages={packages}
        corpPriceMap={{}}
        onClose={() => setEditRow(null)}
        onSubmit={handleUpdate}
      />

      <AppointmentDialog
        open={!!viewRow}
        mode="view"
        title="Therapy Appointment Details"
        initial={viewRow ? formFromRow(viewRow) : emptyForm()}
        packages={packages}
        corpPriceMap={{}}
        onClose={() => setViewRow(null)}
      />

      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteRow(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">Delete Appointment</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this appointment for <span className="font-semibold">{deleteRow.patientName}</span>? This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteRow(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleDelete} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
