import { useEffect, useMemo, useState } from 'react'
import Hospital_TokenSlip, { type TokenSlipData } from '../../components/hospital/Hospital_TokenSlip'
import { hospitalApi } from '../../utils/api'
import { CheckCircle, Eye, X } from 'lucide-react'

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
  paymentStatus?: 'paid'|'unpaid'
  receptionistName?: string
  paymentMethod?: string
  accountNumberIban?: string
  status: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
  raw?: any
}

export default function Hospital_TokenHistory() {
  const [query, setQuery] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const today = new Date().toISOString().slice(0,10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [department, setDepartment] = useState<string>('All')
  const [doctor, setDoctor] = useState<string>('All')
  const [departments, setDepartments] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [rows, setRows] = useState<TokenRow[]>([])
  const [showSlip, setShowSlip] = useState(false)
  const [slipData, setSlipData] = useState<TokenSlipData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsRow, setDetailsRow] = useState<TokenRow | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payRow, setPayRow] = useState<TokenRow | null>(null)
  const [payForm, setPayForm] = useState<{ receptionistName: string; paymentMethod: 'Cash'|'Card'|'Insurance'; accountNumberIban: string }>({ receptionistName: '', paymentMethod: 'Cash', accountNumberIban: '' })
  const [payBusy, setPayBusy] = useState(false)

  useEffect(() => { loadFilters() }, [])
  useEffect(() => { load() }, [from, to, department, doctor])

  async function loadFilters(){
    try {
      const [deps, docs] = await Promise.all([
        hospitalApi.listDepartments() as any,
        hospitalApi.listDoctors() as any,
      ])
      setDepartments(deps.departments || [])
      setDoctors(docs.doctors || [])
    } catch {}
  }

  async function load(){
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
      paymentStatus: (t.paymentStatus || 'paid') as any,
      receptionistName: t.receptionistName || '',
      paymentMethod: t.paymentMethod || '',
      accountNumberIban: t.accountNumberIban || '',
      status: t.status,
      raw: t,
    }))
    setRows(items.filter(r => r.status !== 'cancelled'))
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const start = new Date(from)
    const end = new Date(to)
    end.setHours(23,59,59,999)

    return rows.filter(r => {
      const d = new Date(r.date)
      if (d < start || d > end) return false
      if (department !== 'All' && r.department !== (departments.find(x=>x._id===department)?.name || r.department)) return false
      if (doctor !== 'All' && r.doctor !== (doctors.find(x=>x._id===doctor)?.name || r.doctor)) return false
      if (!q) return true
      return [r.patient, r.mrNo, r.tokenNo, r.doctor, r.department, r.time]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    })
  }, [query, from, to, department, doctor, rows, departments, doctors])

  const totalTokens = filtered.length
  const totalRevenue = filtered.reduce((s, r) => s + r.fee, 0)
  const returnedPatients = filtered.filter(r=>r.status==='returned').length

  function printSlip(r: TokenRow){
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
      amount: r.fee,
      discount: 0,
      payable: r.fee,
      paymentStatus: r.paymentStatus || (r.raw?.paymentStatus || 'paid'),
      receptionistName: r.receptionistName || (r.raw?.receptionistName || ''),
      paymentMethod: r.paymentMethod || (r.raw?.paymentMethod || ''),
      accountNumberIban: r.accountNumberIban || (r.raw?.accountNumberIban || ''),
      createdAt: `${r.date}T${r.time}`,
    }
    setSlipData(slip)
    setShowSlip(true)
  }

  function openDetails(r: TokenRow){
    setDetailsRow(r)
    setShowDetails(true)
  }

  function openPay(r: TokenRow){
    setPayRow(r)
    const t = r.raw || {}
    const method = (t.paymentMethod || r.paymentMethod || 'Cash') as any
    setPayForm({
      receptionistName: String(t.receptionistName || r.receptionistName || ''),
      paymentMethod: (['Cash','Card','Insurance'].includes(String(method)) ? method : 'Cash'),
      accountNumberIban: String(t.accountNumberIban || r.accountNumberIban || ''),
    })
    setPayOpen(true)
  }

  async function submitPay(){
    if (!payRow) return
    try {
      setPayBusy(true)
      await hospitalApi.payToken(payRow._id, {
        receptionistName: payForm.receptionistName || undefined,
        paymentMethod: payForm.paymentMethod,
        accountNumberIban: payForm.paymentMethod === 'Card' ? (payForm.accountNumberIban || undefined) : undefined,
      })
      setPayOpen(false)
      setPayRow(null)
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to mark token as paid')
    } finally {
      setPayBusy(false)
    }
  }

  const startIdx = (page - 1) * rowsPerPage
  const pageRows = filtered.slice(startIdx, startIdx + rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Token History <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{filtered.length}</span></h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={from} onChange={e=>{setFrom(e.target.value); setPage(1)}} className="rounded-md border border-slate-300 px-2 py-1" />
          <span>to</span>
          <input type="date" value={to} onChange={e=>{setTo(e.target.value); setPage(1)}} className="rounded-md border border-slate-300 px-2 py-1" />
          <select value={department} onChange={e=>{setDepartment(e.target.value); setPage(1)}} className="rounded-md border border-slate-300 px-2 py-1">
            <option value="All">All Departments</option>
            {departments.map((d:any)=> <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <select value={doctor} onChange={e=>{setDoctor(e.target.value); setPage(1)}} className="rounded-md border border-slate-300 px-2 py-1">
            <option value="All">All Doctors</option>
            {doctors.map((d:any)=> <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <button className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">Export CSV</button>
        </div>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e)=>{setQuery(e.target.value); setPage(1)}}
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

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Token #</Th>
              <Th>MR #</Th>
              <Th>Patient</Th>
              <Th>Age</Th>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th>Fee</Th>
              <Th>Payment Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pageRows.map((r, idx) => (
              <tr key={idx} className="text-slate-700">
                <Td>{r.date}</Td>
                <Td>{r.time}</Td>
                <Td>{r.tokenNo}</Td>
                <Td>{r.mrNo}</Td>
                <Td className="font-medium">{r.patient}</Td>
                <Td>{r.age}</Td>
                <Td>{r.doctor}</Td>
                <Td>{r.department}</Td>
                <Td className="font-semibold text-emerald-600">Rs. {r.fee.toLocaleString()}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${String(r.paymentStatus||'paid').toLowerCase()==='paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {String(r.paymentStatus || 'paid').toUpperCase()}
                    </span>
                    {String(r.paymentStatus||'paid').toLowerCase()==='unpaid' && (
                      <button
                        type="button"
                        onClick={()=>openPay(r)}
                        title="Mark as Paid"
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={()=>openDetails(r)}
                      title="View Details"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Eye size={18} />
                    </button>
                    <button onClick={()=>printSlip(r)} className="text-sky-600 hover:underline">Print Slip</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select value={rowsPerPage} onChange={e=>{setRowsPerPage(parseInt(e.target.value)); setPage(1)}} className="rounded-md border border-slate-300 px-2 py-1">
              {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">Prev</button>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
      {showSlip && slipData && (
        <Hospital_TokenSlip open={showSlip} onClose={()=>setShowSlip(false)} data={slipData as TokenSlipData} autoPrint={false} />
      )}

      {showDetails && detailsRow && (
        <TokenDetailsDialog open={showDetails} onClose={()=>setShowDetails(false)} row={detailsRow} />
      )}

      {payOpen && payRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Pay Token</div>
              <button
                onClick={()=>{ if (payBusy) return; setPayOpen(false); setPayRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
              <div className="text-sm text-slate-600">Token #{payRow.tokenNo} • {payRow.patient}</div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payed to (Receptionist)</label>
                <input
                  value={payForm.receptionistName}
                  onChange={e=>setPayForm(p=>({ ...p, receptionistName: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="Enter receptionist name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payement Method</label>
                <select
                  value={payForm.paymentMethod}
                  onChange={e=>setPayForm(p=>({ ...p, paymentMethod: e.target.value as any }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Insurance">Insurance</option>
                </select>
              </div>

              {payForm.paymentMethod === 'Card' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Account Number/IBAN</label>
                  <input
                    value={payForm.accountNumberIban}
                    onChange={e=>setPayForm(p=>({ ...p, accountNumberIban: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    placeholder="Enter account number or IBAN"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={()=>{ if (payBusy) return; setPayOpen(false); setPayRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitPay}
                disabled={payBusy}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {payBusy ? 'Paying...' : 'Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TokenDetailsDialog({ open, onClose, row }: { open: boolean; onClose: ()=>void; row: TokenRow }){
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

  const receptionistName = String(t.receptionistName || row.receptionistName || '')
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-medium">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>
}

function StatCard({ title, value, tone }: { title: string; value: React.ReactNode; tone: 'blue'|'green'|'violet'|'amber' }) {
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
