import { useEffect, useMemo, useRef, useState } from 'react'
import Hospital_TokenSlip, { type TokenSlipData } from '../../components/hospital/Hospital_TokenSlip'
import { hospitalApi } from '../../utils/api'
import { Eye, X } from 'lucide-react'

interface TokenRow {
  _id: string
  date: string
  time: string
  tokenNo: string
  mrNo: string
  patient: string
  guardianRel?: string
  guardianName?: string
  cnic?: string
  age?: string
  gender?: string
  phone?: string
  doctor?: string
  department?: string
  fee: number
  discount?: number
  paymentStatus?: 'paid' | 'unpaid'
  receptionistName?: string
  paymentMethod?: string
  accountNumberIban?: string
  amountReceived?: number
  payPreviousDues?: boolean
  useAdvance?: boolean
  advanceApplied?: number
  duesBefore?: number
  advanceBefore?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
  status: 'queued' | 'in-progress' | 'completed' | 'returned' | 'cancelled'
  raw?: any
}

export default function Hospital_TokenHistory() {

  const [query, setQuery] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [department, setDepartment] = useState<string>('')
  const [doctor, setDoctor] = useState<string>('')
  const [departments, setDepartments] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [rows, setRows] = useState<TokenRow[]>([])
  const [showSlip, setShowSlip] = useState(false)
  const [slipData, setSlipData] = useState<TokenSlipData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsRow, setDetailsRow] = useState<TokenRow | null>(null)

  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])

  const payToLoadedRef = useRef(false)

  useEffect(() => { loadFilters() }, [])
  useEffect(() => { load() }, [from, to, department, doctor])

  useEffect(() => {
    if (payToLoadedRef.current) return
    payToLoadedRef.current = true
    let mounted = true
      ; (async () => {
        try {
          const [mineRes, bankRes, pettyRes] = await Promise.all([
            hospitalApi.myPettyCash(),
            hospitalApi.listBankAccounts(),
            hospitalApi.listPettyCashAccounts(),
          ]) as any

          const opts: Array<{ code: string; label: string }> = []
          const seen = new Set<string>()
          const add = (code?: string, label?: string) => {
            const c = String(code || '').trim().toUpperCase()
            if (!c) return
            if (seen.has(c)) return
            seen.add(c)
            opts.push({ code: c, label: String(label || c) })
          }

          const myCode = String(mineRes?.account?.code || '').trim().toUpperCase()
          if (myCode) {
            add(myCode, `${mineRes?.account?.name || 'My Petty Cash'} (${myCode})`)
          }

          const petty: any[] = pettyRes?.accounts || []
          for (const p of petty) {
            const code = String(p?.code || '').trim().toUpperCase()
            if (!code) continue
            const rs = String(p?.responsibleStaff || '').trim()
            if (rs) continue
            if (String(p?.status || 'Active') !== 'Active') continue
            add(code, `${String(p?.name || code).trim()} (${code})`)
          }

          const banks: any[] = bankRes?.accounts || []
          for (const b of banks) {
            const an = String(b?.accountNumber || '')
            const last4 = an ? an.slice(-4) : ''
            const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
            if (!code) continue
            const bankLabel = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}${last4 ? ` (${last4})` : ''}`.trim()
            add(code, bankLabel ? `${bankLabel} (${code})` : code)
          }

          if (mounted) setPayToAccounts(opts)
        } catch {
          if (mounted) setPayToAccounts([])
        }
      })()
    return () => { mounted = false }
  }, [])

  async function loadFilters() {
    try {
      const [deps, docs] = await Promise.all([
        hospitalApi.listDepartments() as any,
        hospitalApi.listDoctors() as any,
      ])
      setDepartments(deps.departments || [])
      setDoctors(docs.doctors || [])
    } catch { }
  }

  async function load() {
    const params: any = { from, to }
    if (department !== 'All') params.departmentId = department
    if (doctor !== 'All') params.doctorId = doctor
    const res = await hospitalApi.listTokens(params) as any
    const items: TokenRow[] = (res.tokens || []).map((t: any) => ({
      _id: t._id,
      date: t.dateIso,
      time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '',
      tokenNo: t.tokenNo,
      mrNo: t.patientId?.mrn || t.mrn || '-',
      patient: t.patientId?.fullName || t.patientName || '-',
      guardianRel: t.patientId?.guardianRel,
      guardianName: t.patientId?.fatherName,
      cnic: t.patientId?.cnicNormalized || t.patientId?.cnic,
      age: t.patientId?.age,
      gender: t.patientId?.gender,
      phone: t.patientId?.phoneNormalized,
      doctor: t.doctorId?.name || '-',
      department: t.departmentId?.name || '-',
      fee: Number(t.fee || 0),
      discount: Number(t.discount ?? t.pricing?.discount ?? 0),
      paymentStatus: (t.paymentStatus || 'paid') as any,
      receptionistName: t.receptionistName || '',
      paymentMethod: t.paymentMethod || '',
      accountNumberIban: t.accountNumberIban || '',
      amountReceived: t.amountReceived,
      payPreviousDues: t.payPreviousDues,
      useAdvance: t.useAdvance,
      advanceApplied: t.advanceApplied,
      duesBefore: t.duesBefore,
      advanceBefore: t.advanceBefore,
      duesPaid: t.duesPaid,
      paidForToday: t.paidForToday,
      advanceAdded: t.advanceAdded,
      duesAfter: t.duesAfter,
      advanceAfter: t.advanceAfter,
      status: t.status,
      raw: t,
    }))
    setRows(items.filter(r => r.status !== 'cancelled'))
    setPage(1)
  }

  const scoped = useMemo(() => {

    const start = new Date(from)
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)

    return rows.filter(r => {
      const d = new Date(r.date)
      if (d < start || d > end) return false
      if (department !== 'All' && r.department !== (departments.find(x => x._id === department)?.name || r.department)) return false
      if (doctor !== 'All' && r.doctor !== (doctors.find(x => x._id === doctor)?.name || r.doctor)) return false
      return true
    })
  }, [from, to, department, doctor, rows, departments, doctors, query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return scoped
    return scoped.filter(r => {
      const address = r.raw?.patientId?.address || r.raw?.address
      const status = r.status
      return [
        r.patient,
        r.mrNo,
        r.tokenNo,
        r.doctor,
        r.department,
        r.time,
        r.date,
        r.phone,
        r.age,
        r.gender,
        r.guardianRel,
        r.guardianName,
        r.cnic,
        address,
        r.paymentStatus,
        r.receptionistName,
        r.paymentMethod,
        r.accountNumberIban,
        status,
        r.discount,
      ]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    })
  }, [query, scoped])

  const totalTokens = scoped.length
  const totalRevenue = scoped.reduce((s, r) => s + (r.status === 'returned' ? 0 : r.fee), 0)
  const returnedPatients = scoped.filter(r => r.status === 'returned').length

  function printSlip(r: TokenRow) {
    const t = r.raw || {}
    const amount = Number(t.amount ?? (Number(t.fee || 0) + Number(t.discount || 0)))
    const discount = Number(t.discount ?? r.discount ?? 0)
    const payable = Number(t.fee ?? Math.max(amount - discount, 0))
    const slip: TokenSlipData = {
      tokenNo: r.tokenNo,
      departmentName: r.department || '-',
      doctorName: r.doctor || '-',
      patientName: r.patient || '-',
      phone: r.phone || '',
      mrn: r.mrNo || '',
      age: r.age,
      gender: r.gender,
      guardianRel: r.guardianRel,
      guardianName: r.guardianName,
      cnic: r.cnic,
      amount,
      discount,
      payable,
      paymentStatus: r.paymentStatus || (r.raw?.paymentStatus || 'paid'),
      receptionistName: r.receptionistName || (r.raw?.receptionistName || ''),
      receivedToAccountCode: String(t.receivedToAccountCode || '') || undefined,
      paymentMethod: r.paymentMethod || (r.raw?.paymentMethod || ''),
      accountNumberIban: r.accountNumberIban || (r.raw?.accountNumberIban || ''),
      createdAt: `${r.date}T${r.time}`,
      amountReceived: (t.amountReceived ?? r.amountReceived) as any,
      payPreviousDues: (t.payPreviousDues ?? r.payPreviousDues) as any,
      useAdvance: (t.useAdvance ?? r.useAdvance) as any,
      advanceApplied: (t.advanceApplied ?? r.advanceApplied) as any,
      duesBefore: (t.duesBefore ?? r.duesBefore) as any,
      advanceBefore: (t.advanceBefore ?? r.advanceBefore) as any,
      duesPaid: (t.duesPaid ?? r.duesPaid) as any,
      paidForToday: (t.paidForToday ?? r.paidForToday) as any,
      advanceAdded: (t.advanceAdded ?? r.advanceAdded) as any,
      duesAfter: (t.duesAfter ?? r.duesAfter) as any,
      advanceAfter: (t.advanceAfter ?? r.advanceAfter) as any,
    }
    setSlipData(slip)
    setShowSlip(true)
  }

  function openDetails(r: TokenRow) {
    setDetailsRow(r)
    setShowDetails(true)
  }

  const startIdx = (page - 1) * rowsPerPage
  const pageRows = filtered.slice(startIdx, startIdx + rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Token History <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{filtered.length}</span></h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1" />
          <span>to</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1" />
          <select value={department} onChange={e => { setDepartment(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1">
            <option value="All">All Departments</option>
            {departments.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <select value={doctor} onChange={e => { setDoctor(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1">
            <option value="All">All Doctors</option>
            {doctors.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <button className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">Export CSV</button>
        </div>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          placeholder="Search by name, token#, MR#, phone, doctor, department, age, gender, address, or time..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Date" value={from === to ? from : `${from} → ${to}`} tone="amber" />
        <StatCard title="Total Tokens" value={totalTokens} tone="green" />
        <StatCard title="Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} tone="violet" />
        <StatCard title="Returned" value={returnedPatients} tone="amber" />
      </div>

      <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <Th>DateTime</Th>
              <Th>Token #</Th>
              <Th>MR #</Th>
              <Th>Patient</Th>
              <Th>Age</Th>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th>Fee</Th>
              <Th>Payment Status</Th>
              <Th>Discount</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pageRows.map((r, idx) => (
              <tr key={idx} className={`text-slate-700 ${r.status === 'returned' ? 'bg-amber-50' : ''}`}>
                <Td>
                  <div className="leading-tight">
                    <div>{r.date}</div>
                    <div>{r.time}</div>
                  </div>
                </Td>
                <Td>{r.tokenNo}</Td>
                <Td>{r.mrNo}</Td>
                <Td className="font-medium">{r.patient}</Td>
                <Td>{r.age}</Td>
                <Td>{r.doctor}</Td>
                <Td>{r.department}</Td>
                <Td className="font-semibold text-emerald-600">Rs. {r.fee.toLocaleString()}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${String(r.paymentStatus || 'paid').toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {String(r.paymentStatus || 'paid').toUpperCase()}
                    </span>
                  </div>
                </Td>
                <Td>
                  Rs. {Number(r.discount ?? r.raw?.discount ?? r.raw?.pricing?.discount ?? 0).toLocaleString()}
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openDetails(r)}
                      title="View Details"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Eye size={18} />
                    </button>
                    <button onClick={() => printSlip(r)} className="text-sky-600 hover:underline">Print Slip</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select value={rowsPerPage} onChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1">
              {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
      {showSlip && slipData && (
        <Hospital_TokenSlip open={showSlip} onClose={() => setShowSlip(false)} data={slipData as TokenSlipData} autoPrint={false} />
      )}

      {showDetails && detailsRow && (
        <TokenDetailsDialog open={showDetails} onClose={() => setShowDetails(false)} row={detailsRow} payToAccounts={payToAccounts} />
      )}
    </div>
  )
}

function TokenDetailsDialog({ open, onClose, row, payToAccounts }: { open: boolean; onClose: () => void; row: TokenRow; payToAccounts: Array<{ code: string; label: string }> }) {
  if (!open) return null
  const t = row.raw || {}
  const patient = t.patientId || {}
  const doctor = t.doctorId || {}
  const dept = t.departmentId || {}
  const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString() : `${row.date} ${row.time}`

  const patientName = patient.fullName || t.patientName || row.patient || '-'
  const mrn = patient.mrn || t.mrn || row.mrNo || '-'
  const phone = patient.phoneNormalized || t.phone || row.phone || '-'
  const age = patient.age || t.age || row.age || '-'
  const gender = patient.gender || t.gender || row.gender || '-'
  const guardianRel = patient.guardianRel || t.guardianRel || '-'
  const guardianName = patient.fatherName || t.guardianName || t.guardian || '-'
  const cnic = patient.cnicNormalized || t.cnic || row.cnic || '-'
  const address = patient.address || t.address || '-'

  const doctorName = doctor.name || row.doctor || '-'
  const departmentName = dept.name || row.department || '-'

  const discount = Number(t.discount ?? t.pricing?.discount ?? 0)
  const payable = Number(t.payable ?? t.pricing?.finalFee ?? t.finalFee ?? row.fee ?? 0)
  const fee = Number(t.fee ?? t.pricing?.feeResolved ?? row.fee ?? 0)
  const paymentStatus = String(t.paymentStatus || row.paymentStatus || 'paid')
  const isPaid = paymentStatus.toLowerCase() === 'paid'

  const clamp0 = (n: any) => Math.max(0, Number(n || 0))
  const net = clamp0(payable)
  const isUnpaid = paymentStatus.toLowerCase() === 'unpaid'
  const computed = (() => {
    const duesBefore = clamp0(t.duesBefore ?? row.duesBefore)
    const advanceBefore = clamp0(t.advanceBefore ?? row.advanceBefore)
    const advanceApplied = clamp0(t.advanceApplied ?? row.advanceApplied)
    const amountReceived = isUnpaid ? 0 : clamp0(t.amountReceived ?? row.amountReceived)
    const duesPaid = clamp0(t.duesPaid ?? row.duesPaid)
    const paidForToday = clamp0(t.paidForToday ?? row.paidForToday)
    const advanceAdded = clamp0(t.advanceAdded ?? row.advanceAdded)
    const duesAfter = clamp0(t.duesAfter ?? row.duesAfter)
    const advanceAfter = clamp0(t.advanceAfter ?? row.advanceAfter)
    const paidToday = isUnpaid ? 0 : Math.min(net, paidForToday + advanceApplied)
    const remaining = Math.max(0, net - paidToday)
    return {
      duesBefore,
      advanceBefore,
      advanceApplied,
      amountReceived,
      duesPaid,
      paidForToday,
      advanceAdded,
      duesAfter,
      advanceAfter,
      paidToday,
      remaining,
      payPreviousDues: !!(t.payPreviousDues ?? row.payPreviousDues),
      useAdvance: !!(t.useAdvance ?? row.useAdvance),
    }
  })()

  const receptionistName = String(t.receptionistName || row.receptionistName || '')
  const receivedToAccountCode = String(t.receivedToAccountCode || '')
  const payedToName = (() => {
    const code = String(receivedToAccountCode || '').trim().toUpperCase()
    if (!code) return receptionistName || '-'
    const label = payToAccounts.find(x => x.code === code)?.label || ''
    if (label) return String(label).split('(')[0].trim() || label
    return receptionistName || code || '-'
  })()
  const paymentMethod = String(t.paymentMethod || row.paymentMethod || t.billingType || '')
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
            <h3 className="text-lg font-semibold text-slate-800">Token Details</h3>
            <div className="mt-0.5 text-xs text-slate-500">Token #{row.tokenNo} • {createdAt}</div>
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
              <Info label="Status" value={String(row.status)} />
              <Info label="Token No" value={String(row.tokenNo)} />
              <Info label="Fee" value={`Rs. ${fee.toLocaleString()}`} />
              <Info label="Discount" value={`Rs. ${discount.toLocaleString()}`} />
              <Info label="Payable" value={`Rs. ${payable.toLocaleString()}`} />
              <Info label="Paid" value={`Rs. ${computed.paidToday.toLocaleString()}`} />
              <Info label="Remaining" value={`Rs. ${computed.remaining.toLocaleString()}`} />
              <Info label="Adv. After" value={`Rs. ${computed.advanceAfter.toLocaleString()}`} />
              <Info label="Payment Status" value={paymentStatus.toUpperCase()} />
              <Info label="Payed to:" value={payedToName} />
              {isPaid && <Info label="Payment Method" value={paymentMethod || '-'} />}
              {isPaid && paymentMethod === 'Card' && <Info label="Account Number/IBAN" value={accountNumberIban || '-'} />}
              <Info label="Appointment Slot" value={String(appointmentSlot)} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Payment Summary</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Prev. Dues" value={`Rs. ${computed.duesBefore.toLocaleString()}`} />
              <Info label="Prev. Adv." value={`Rs. ${computed.advanceBefore.toLocaleString()}`} />
              <Info label="Received Now" value={`Rs. ${computed.amountReceived.toLocaleString()}`} />
              <Info label="Adv. Used" value={`Rs. ${computed.advanceApplied.toLocaleString()}`} />
              <Info label="Dues After" value={`Rs. ${computed.duesAfter.toLocaleString()}`} />
              <Info label="Adv. After" value={`Rs. ${computed.advanceAfter.toLocaleString()}`} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Payment Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {computed.payPreviousDues && <Info label="Pay Prev. Dues" value="YES" />}
              {computed.useAdvance && <Info label="Use Adv." value="YES" />}
              <Info label="Dues Paid" value={`Rs. ${computed.duesPaid.toLocaleString()}`} />
              <Info label="Paid For Today" value={`Rs. ${computed.paidForToday.toLocaleString()}`} />
              <Info label="Adv. Added" value={`Rs. ${computed.advanceAdded.toLocaleString()}`} />
            </div>
          </section>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-medium">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>
}

function StatCard({ title, value, tone }: { title: string; value: React.ReactNode; tone: 'blue' | 'green' | 'violet' | 'amber' }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-sm opacity-80">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="text-xs opacity-60">Real-time data</div>
    </div>
  )
}
