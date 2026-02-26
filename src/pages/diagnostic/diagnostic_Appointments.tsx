import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Pencil, Trash2, ClipboardPlus, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { diagnosticApi } from '../../utils/api'

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

  tests?: string[]
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

type Test = { id: string; name: string; price: number }

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

  appointmentDate: string
  appointmentTime: string

  referringConsultant: string
  notes: string
  receptionistName: string

  tests: string[]
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

    appointmentDate: '',
    appointmentTime: '',

    referringConsultant: '',
    notes: '',
    receptionistName: '',

    tests: [],
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

function mapToPayload(form: AppointmentForm, tests: Test[], corpPriceMap: Record<string, number>) {
  const getEffectivePrice = (id: string): number => {
    const base = Number((tests.find(t => t.id === id)?.price) || 0)
    const v = corpPriceMap[id]
    return v != null ? Number(v) : base
  }
  const selectedTests = form.tests.map(id => tests.find(t => t.id === id)).filter(Boolean) as Test[]
  const subtotal = selectedTests.reduce((s, t) => s + getEffectivePrice(t.id), 0)
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

    tests: form.tests,
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
  tests,
  corpPriceMap,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit' | 'view'
  title: string
  initial: AppointmentForm
  tests: Test[]
  corpPriceMap: Record<string, number>
  onClose: () => void
  onSubmit?: (form: AppointmentForm) => void
}) {
  const [form, setForm] = useState<AppointmentForm>(initial)
  const readonly = mode === 'view'

  const [query, setQuery] = useState('')
  const [showTestDropdown, setShowTestDropdown] = useState(false)
  const testPickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(initial)
    setQuery('')
    setShowTestDropdown(false)
  }, [open, initial])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = testPickerRef.current
      if (!el) return
      if (!el.contains(e.target as any)) setShowTestDropdown(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowTestDropdown(false)
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

  const getEffectivePrice = (id: string): number => {
    const base = Number((tests.find(t => t.id === id)?.price) || 0)
    const v = corpPriceMap[id]
    return v != null ? Number(v) : base
  }

  const selectedTests = useMemo(() => form.tests.map(id => tests.find(t => t.id === id)).filter(Boolean) as Test[], [form.tests, tests])
  const subtotal = useMemo(() => selectedTests.reduce((s, t) => s + getEffectivePrice(t.id), 0), [selectedTests, corpPriceMap])
  const discountNum = Number(form.discount) || 0
  const net = Math.max(0, subtotal - discountNum)

  const filteredTests = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tests
      .filter(t => !form.tests.includes(t.id))
      .filter(t => !q || t.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [tests, query, form.tests])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 py-4 sm:px-4" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          if (readonly) return
          if (!form.patientName.trim()) { alert('Patient name is required'); return }
          if (!form.appointmentDate) { alert('Appointment date is required'); return }
          if (!form.tests.length) { alert('Please select at least one test'); return }
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
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Appointment Date</label>
                  <input type="date" value={form.appointmentDate} onChange={e => update('appointmentDate', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Appointment Time</label>
                  <input type="time" value={form.appointmentTime} onChange={e => update('appointmentTime', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Referring Consultant</label>
                  <input value={form.referringConsultant} onChange={e => update('referringConsultant', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Patient Details</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">Patient Name</label>
                  <input value={form.patientName} onChange={e => update('patientName', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Phone</label>
                  <input value={form.patientPhone} onChange={e => update('patientPhone', e.target.value)} disabled={readonly} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Tests Details</div>
              <div className="mt-3 space-y-2" ref={testPickerRef}>
                <input
                  value={query}
                  onFocus={() => setShowTestDropdown(true)}
                  onClick={() => setShowTestDropdown(true)}
                  onChange={e => { setQuery(e.target.value); setShowTestDropdown(true) }}
                  placeholder="Search test by name..."
                  disabled={readonly}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
                {!readonly && showTestDropdown && filteredTests.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                    {filteredTests.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, tests: [...prev.tests, t.id] }))}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-800">{t.name}</div>
                        <div className="text-xs text-slate-600">PKR {getEffectivePrice(t.id).toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedTests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTests.map(t => (
                      <span key={t.id} className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-sm">
                        {t.name}
                        {!readonly && (
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, tests: prev.tests.filter(x => x !== t.id) }))}
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
                {selectedTests.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2">
                    <div>{t.name}</div>
                    <div>PKR {getEffectivePrice(t.id).toLocaleString()}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 font-semibold">
                  <div>Net Fee</div>
                  <div>PKR {net.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={onClose} className="btn-outline-navy">{readonly ? 'Close' : 'Cancel'}</button>
                {mode !== 'view' && (
                  <button type="submit" className="btn">{mode === 'create' ? 'Create Appointment' : 'Save Changes'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function Diagnostic_Appointments() {
  const nav = useNavigate()
  const location = useLocation()

  const [tests, setTests] = useState<Test[]>([])
  const [testsLoading, setTestsLoading] = useState(false)

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
      const res = (await diagnosticApi.listAppointments({ q, from, to, limit: 200 })) as any
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
        if (mounted) { setTestsLoading(true) }
        try {
          const res = await diagnosticApi.listTests({ limit: 1000 }) as any
          const arr = (res?.items || res || []).map((t: any) => ({ id: String(t._id || t.id), name: String(t.name || ''), price: Number(t.price || 0) }))
          if (mounted) setTests(arr)
        } catch {
          if (mounted) setTests([])
        } finally {
          if (mounted) setTestsLoading(false)
        }
      })()
    return () => { mounted = false }
  }, [])

  useEffect(() => { load() }, [])

  const testsMap = useMemo(() => Object.fromEntries(tests.map(t => [t.id, t.name])), [tests])

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
      appointmentDate: r.appointmentDate || '',
      appointmentTime: r.appointmentTime || '',
      referringConsultant: r.referringConsultant || '',
      notes: r.notes || '',
      receptionistName: r.receptionistName || '',
      tests: Array.isArray(r.tests) ? r.tests.map(String) : [],
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

  const resolveTestNames = (ids?: string[]) => {
    const list = (ids || []).map(id => testsMap[String(id)] || String(id))
    return list.join(', ')
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Appointments (Diagnostics)</h2>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date Range</label>
              <div className="flex items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
                <span className="text-slate-400 text-xs">to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
              </div>
            </div>
            <div className="flex gap-2">
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
            <div className="sm:col-span-2 lg:col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quick Search</label>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search patient or phone..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
              </div>
              <button onClick={load} className="h-9 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 shadow-sm">Search</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-0 overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-[600px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Patient</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Tests</th>
                <th className="px-4 py-2 text-left">Net Fee</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {rows.map(r => (
                <tr key={r._id}>
                  <td className="px-4 py-2">{r.appointmentDate || '-'}</td>
                  <td className="px-4 py-2 font-medium">{r.patientName || '-'}</td>
                  <td className="px-4 py-2">{r.patientPhone || '-'}</td>
                  <td className="px-4 py-2">{resolveTestNames(r.tests)}</td>
                  <td className="px-4 py-2">{Number(r.net || 0) ? `Rs. ${Number(r.net || 0).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${String(r.paymentStatus || 'paid') === 'paid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                      {String(r.paymentStatus || 'paid') === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const f = formFromRow(r)
                          const inReception = String(location?.pathname || '').startsWith('/reception')
                          nav(inReception ? '/reception/diagnostic/token-generator' : '/diagnostic/token-generator', {
                            state: {
                              from: 'appointments',
                              appointmentId: r._id,
                              patient: {
                                fullName: r.patientName,
                                phone: r.patientPhone,
                                age: r.patientAge,
                                gender: r.patientGender,
                                guardianRelation: r.guardianRel,
                                fatherName: r.guardianName,
                                cnic: r.cnic,
                                address: r.address,
                              },
                              requestedTests: (r.tests || []).map(id => testsMap[String(id)] || String(id)),
                              referringConsultant: r.referringConsultant,
                              corporateId: f.corporateId || undefined,
                              corporatePreAuthNo: f.corporatePreAuthNo || undefined,
                              corporateCoPayPercent: f.corporateCoPayPercent ? Number(f.corporateCoPayPercent) : undefined,
                              corporateCoverageCap: f.corporateCoverageCap ? Number(f.corporateCoverageCap) : undefined,
                            },
                          })
                        }}
                        className="rounded-md border border-emerald-300 p-2 text-emerald-700 hover:bg-emerald-50"
                        title="Create Diagnostic Order"
                      >
                        <ClipboardPlus className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setViewRow(r)} className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditRow(r)} className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setDeleteRow(r)} className="rounded-md border border-rose-300 p-2 text-rose-700 hover:bg-rose-50" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                    {loading ? 'Loading...' : 'No appointments'}
                  </td>
                </tr>
              )}
            </tbody>
          </table >
        </div >
      </div >

      {createOpen && (
        <AppointmentDialog
          open={createOpen}
          mode="create"
          title="New Appointment"
          initial={createInitial}
          tests={tests}
          corpPriceMap={{}}
          onClose={() => setCreateOpen(false)}
          onSubmit={async form => {
            try {
              await diagnosticApi.createAppointment(mapToPayload(form, tests, {}))
              setCreateOpen(false)
              await load()
            } catch {
              alert('Failed to create appointment')
            }
          }}
        />
      )}

      {
        viewRow != null && (
          <AppointmentDialog
            open={viewRow != null}
            mode="view"
            title="Appointment Details"
            initial={viewRow ? formFromRow(viewRow) : emptyForm()}
            tests={tests}
            corpPriceMap={{}}
            onClose={() => setViewRow(null)}
          />
        )
      }

      {
        editRow != null && (
          <AppointmentDialog
            open={editRow != null}
            mode="edit"
            title="Edit Appointment"
            initial={editRow ? formFromRow(editRow) : emptyForm()}
            tests={tests}
            corpPriceMap={{}}
            onClose={() => setEditRow(null)}
            onSubmit={async form => {
              if (!editRow) return
              try {
                await diagnosticApi.updateAppointment(editRow._id, mapToPayload(form, tests, {}))
                setEditRow(null)
                await load()
              } catch {
                alert('Failed to update appointment')
              }
            }}
          />
        )
      }

      {
        deleteRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteRow(null)}>
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={e => e.stopPropagation()}>
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-base font-semibold text-slate-900">Delete Appointment</div>
                <div className="mt-1 text-sm text-slate-600">Are you sure you want to delete this appointment?</div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4">
                <button type="button" onClick={() => setDeleteRow(null)} className="btn-outline-navy">Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = deleteRow._id
                    setDeleteRow(null)
                    try { await diagnosticApi.deleteAppointment(id) } catch { }
                    await load()
                  }}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        testsLoading && (
          <div className="mt-3 text-xs text-slate-500">Loading tests…</div>
        )
      }
    </div>
  )
}
