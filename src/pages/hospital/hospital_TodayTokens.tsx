import { useEffect, useMemo, useRef, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Hospital_TokenSlip, { type TokenSlipData } from '../../components/hospital/Hospital_TokenSlip'
import { CornerUpLeft, Eye, Pencil, X } from 'lucide-react'

interface TokenRow {
  _id: string
  date: string
  time: string
  tokenNo: string
  mrNo: string
  patient: string
  age?: string
  gender?: string
  phone?: string
  doctor?: string
  department?: string
  fee: number
  discount?: number
  paymentStatus?: 'paid'|'unpaid'
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
  status: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
  raw?: any
}

export default function Hospital_TodayTokens() {
  const [rows, setRows] = useState<TokenRow[]>([])
  const [query, setQuery] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [showSlip, setShowSlip] = useState(false)
  const [slipData, setSlipData] = useState<TokenSlipData | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsRow, setDetailsRow] = useState<TokenRow | null>(null)

  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  const payToLoadedRef = useRef(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnRow, setReturnRow] = useState<TokenRow | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnBusy, setReturnBusy] = useState(false)

  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; primaryDepartmentId?: string; departmentIds?: string[] }>>([])

  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<TokenRow | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editForm, setEditForm] = useState({
    patientName: '',
    phone: '',
    age: '',
    gender: '',
    guardianRel: '',
    guardianName: '',
    cnic: '',
    address: '',
    departmentId: '',
    doctorId: '',
    amount: '',
    discount: '',
    paymentStatus: 'paid' as 'paid'|'unpaid',
    receptionistName: '',
    paymentMethod: 'Cash' as 'Cash'|'Card'|'Insurance',
    accountNumberIban: '',
  })


  useEffect(() => { load() }, [])

  useEffect(() => {
    let cancelled = false
    async function loadMasters(){
      try {
        const dRes = await hospitalApi.listDepartments() as any
        const deps = (dRes.departments || dRes || []).map((d: any)=>({ id: String(d._id||d.id), name: String(d.name||'') }))
        const docRes = await hospitalApi.listDoctors() as any
        const docs = (docRes.doctors || docRes || []).map((r: any)=>({
          id: String(r._id||r.id),
          name: String(r.name||''),
          primaryDepartmentId: r.primaryDepartmentId ? String(r.primaryDepartmentId) : undefined,
          departmentIds: Array.isArray(r.departmentIds) ? r.departmentIds.map((x: any)=> String(x)) : undefined,
        }))
        if (!cancelled){ setDepartments(deps); setDoctors(docs) }
      } catch {}
    }
    loadMasters()
    return ()=>{ cancelled = true }
  }, [])

  useEffect(()=>{
    if (payToLoadedRef.current) return
    payToLoadedRef.current = true
    let mounted = true
    ;(async()=>{
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
        for (const p of petty){
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code) continue
          const rs = String(p?.responsibleStaff || '').trim()
          if (rs) continue
          if (String(p?.status || 'Active') !== 'Active') continue
          add(code, `${String(p?.name || code).trim()} (${code})`)
        }

        const banks: any[] = bankRes?.accounts || []
        for (const b of banks){
          const an = String(b?.accountNumber || '')
          const last4 = an ? an.slice(-4) : ''
          const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
          if (!code) continue
          const bankLabel = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}${last4 ? ` (${last4})` : ''}`.trim()
          add(code, bankLabel ? `${bankLabel} (${code})` : code)
        }

        if (mounted) {
          setPayToAccounts(opts)
        }
      } catch {
        if (mounted) setPayToAccounts([])
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  async function load(){
    const today = new Date().toISOString().slice(0,10)
    const res = await hospitalApi.listTokens({ date: today }) as any
    const items: TokenRow[] = (res.tokens || []).map((t: any) => ({
      _id: t._id,
      date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : today,
      time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '',
      tokenNo: t.tokenNo,
      mrNo: t.patientId?.mrn || t.mrn || '-',
      patient: t.patientId?.fullName || t.patientName || '-',
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
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const address = r.raw?.patientId?.address || r.raw?.address
      return [
        r.date,
        r.patient,
        r.mrNo,
        r.tokenNo,
        r.phone,
        r.age,
        r.gender,
        address,
        r.doctor,
        r.department,
        r.time,
        r.paymentStatus,
        r.receptionistName,
        r.paymentMethod,
        r.accountNumberIban,
        r.status,
        r.discount,
      ]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    })
  }, [query, rows])

  const totalPatients = rows.length
  const totalTokens = rows.length
  const totalRevenue = rows.reduce((s, r) => s + (r.status === 'returned' ? 0 : r.fee), 0)
  const returnedPatients = rows.filter(r => r.status === 'returned').length

  const start = (page - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  function openReturn(r: TokenRow){
    setReturnRow(r)
    setReturnReason(String(r.raw?.returnReason || ''))
    setReturnOpen(true)
  }

  function openEdit(r: TokenRow){
    const t = r.raw || {}
    const patient = t.patientId || {}

    const patientName = String(patient.fullName || t.patientName || r.patient || '')
    const phone = String(patient.phoneNormalized || t.phone || r.phone || '')
    const age = String(patient.age || t.age || r.age || '')
    const gender = String(patient.gender || t.gender || r.gender || '')
    const guardianRel = String(patient.guardianRel || t.guardianRel || '')
    const guardianName = String(patient.fatherName || t.guardianName || '')
    const cnic = String(patient.cnicNormalized || t.cnic || '')
    const address = String(patient.address || t.address || '')

    const departmentId = String(t.departmentId?._id || t.departmentId || '')
    const doctorId = String(t.doctorId?._id || t.doctorId || '')

    const rawAmount = t.amount ?? (Number(t.fee || 0) + Number(t.discount || 0))
    const amount = Number.isFinite(Number(rawAmount)) ? String(rawAmount) : ''
    const discount = String(t.discount ?? 0)
    const paymentStatus = (String(t.paymentStatus || r.paymentStatus || 'paid') as any)
    const receptionistName = String(t.receptionistName || r.receptionistName || '')
    const method = String(t.paymentMethod || r.paymentMethod || 'Cash')
    const paymentMethod = ((['Cash','Card','Insurance'].includes(method) ? method : 'Cash') as any)
    const accountNumberIban = String(t.accountNumberIban || r.accountNumberIban || '')

    setEditRow(r)
    setEditForm({
      patientName,
      phone,
      age,
      gender,
      guardianRel,
      guardianName,
      cnic,
      address,
      departmentId,
      doctorId,
      amount,
      discount,
      paymentStatus: (paymentStatus === 'unpaid' ? 'unpaid' : 'paid'),
      receptionistName,
      paymentMethod,
      accountNumberIban,
    })
    setEditOpen(true)
  }

  async function submitEdit(){
    if (!editRow) return
    try {
      setEditBusy(true)
      setActioningId(editRow._id)
      const cleanNum = (s: string) => {
        const x = String(s || '').trim().replace(/[^0-9.]/g, '')
        if (!x) return undefined
        const n = parseFloat(x)
        return isFinite(n) ? n : undefined
      }
      const payload: any = {
        patientName: editForm.patientName || undefined,
        phone: editForm.phone || undefined,
        age: editForm.age || undefined,
        gender: editForm.gender || undefined,
        guardianRel: editForm.guardianRel || undefined,
        guardianName: editForm.guardianName || undefined,
        cnic: editForm.cnic || undefined,
        address: editForm.address || undefined,
        departmentId: editForm.departmentId || undefined,
        doctorId: editForm.doctorId || undefined,
        amount: cleanNum(editForm.amount),
        discount: cleanNum(editForm.discount) ?? 0,
        paymentStatus: editForm.paymentStatus,
        receptionistName: editForm.receptionistName || undefined,
        paymentMethod: editForm.paymentStatus === 'paid' ? editForm.paymentMethod : undefined,
        accountNumberIban: editForm.paymentStatus === 'paid' && editForm.paymentMethod === 'Card' ? (editForm.accountNumberIban || undefined) : undefined,
      }
      await hospitalApi.updateToken(editRow._id, payload)
      setEditOpen(false)
      setEditRow(null)
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to update token')
    } finally {
      setEditBusy(false)
      setActioningId(null)
    }
  }

  async function submitReturn(){
    if (!returnRow) return
    const reason = String(returnReason || '').trim()
    if (!reason) {
      alert('Reason of Return is required')
      return
    }
    try {
      setReturnBusy(true)
      setActioningId(returnRow._id)
      await hospitalApi.returnToken(returnRow._id, reason)
      setReturnOpen(false)
      setReturnRow(null)
      setReturnReason('')
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to return token')
    } finally {
      setReturnBusy(false)
      setActioningId(null)
    }
  }

  function printSlip(r: TokenRow){
    const t = r.raw || {}
    const amount = Number(t.amount ?? (Number(t.fee||0) + Number(t.discount||0)) ?? r.fee ?? 0)
    const discount = Number(t.discount ?? 0)
    const payable = Number(t.fee ?? Math.max(amount - discount, 0))
    const receivedToAccountCode = String(t.receivedToAccountCode || '')
    const slip: TokenSlipData = {
      tokenNo: r.tokenNo,
      departmentName: r.department || '-',
      doctorName: r.doctor || '-',
      patientName: r.patient || '-',
      phone: r.phone || '',
      mrn: r.mrNo || '',
      age: r.age,
      gender: r.gender,
      amount,
      discount,
      payable,
      paymentStatus: r.paymentStatus || (r.raw?.paymentStatus || 'paid'),
      receptionistName: r.receptionistName || (r.raw?.receptionistName || ''),
      receivedToAccountCode: receivedToAccountCode || undefined,
      paymentMethod: r.paymentMethod || (r.raw?.paymentMethod || ''),
      accountNumberIban: r.accountNumberIban || (r.raw?.accountNumberIban || ''),
      createdAt: new Date().toISOString(),
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

  function openDetails(r: TokenRow){
    setDetailsRow(r)
    setShowDetails(true)
  }

  

  // No index mapping needed when actions use row ids

  const filteredDoctors = (depId: string) => {
    const did = String(depId || '')
    if (!did) return doctors
    return doctors.filter(d => {
      if (d.primaryDepartmentId && String(d.primaryDepartmentId) === did) return true
      if (Array.isArray(d.departmentIds) && d.departmentIds.map(String).includes(did)) return true
      return false
    })
  }

  const exportCSV = () => {
    const cols = ['Time','Token #','MR #','Patient','Age','Doctor','Department','Fee','Payment Status','Discount','Returned']
    const lines = [cols.join(',')]
    for (const r of filtered) {
      lines.push([
        r.time,
        r.tokenNo,
        r.mrNo,
        r.patient,
        r.age ?? '',
        r.doctor ?? '',
        r.department ?? '',
        r.fee,
        (r.paymentStatus || 'paid').toUpperCase(),
        Number(r.discount ?? r.raw?.discount ?? r.raw?.pricing?.discount ?? 0) || 0,
        r.status === 'returned' ? 'Yes' : 'No',
      ].map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : String(v)).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `todays-tokens-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Today's Tokens <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{filtered.length}</span></h2>
        <button onClick={exportCSV} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Export CSV</button>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="Search by name, token#, MR#, phone, doctor, department, age, gender, address, or time..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Patients" value={totalPatients} tone="blue" />
        <StatCard title="Tokens Generated" value={totalTokens} tone="green" />
        <StatCard title="Today's Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} tone="violet" />
        <StatCard title="Returned Patients" value={returnedPatients} tone="amber" />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
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
              <Th>Print</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pageRows.map((r) => (
              <tr key={r._id} className={`text-slate-700 ${r.status === 'returned' ? 'bg-amber-50' : ''}`}>
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
                <Td>{r.doctor || '-'}</Td>
                <Td>{r.department || '-'}</Td>
                <Td className="font-semibold text-emerald-600">Rs. {r.fee.toLocaleString()}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${String(r.paymentStatus||'paid').toLowerCase()==='paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {String(r.paymentStatus || 'paid').toUpperCase()}
                    </span>
                  </div>
                </Td>
                <Td>
                  Rs. {Number(r.discount ?? r.raw?.discount ?? r.raw?.pricing?.discount ?? 0).toLocaleString()}
                </Td>
                <Td><button onClick={()=>printSlip(r)} className="text-sky-600 hover:underline">Print Slip</button></Td>
                <Td>
                  <div className="flex gap-2">
                    {/* Removed Admit to IPD action button per request */}
                    
                    {/* Removed Complete action button per request */}
                    
                    <button
                      onClick={()=>openEdit(r)}
                      title="Edit"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={()=>openDetails(r)}
                      title="View Details"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      disabled={actioningId===r._id || r.status === 'returned'}
                      onClick={()=>openReturn(r)}
                      title={r.status === 'returned' ? 'Already Returned' : 'Return'}
                      className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
                    >
                      <CornerUpLeft size={18} />
                    </button>
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
        <Hospital_TokenSlip open={showSlip} onClose={()=>setShowSlip(false)} data={slipData} autoPrint={false} />
      )}

      {showDetails && detailsRow && (
        <TokenDetailsDialog open={showDetails} onClose={()=>setShowDetails(false)} row={detailsRow} payToAccounts={payToAccounts} />
      )}

      {editOpen && editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Edit Token</div>
              <button
                onClick={()=>{ if (editBusy) return; setEditOpen(false); setEditRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-6">
              <div className="text-sm text-slate-600">Token #{editRow.tokenNo} • {editRow.patient}</div>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 text-sm font-semibold text-slate-800">Patient Details</div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
                  <input value={editForm.patientName} onChange={e=>setEditForm(p=>({ ...p, patientName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <input value={editForm.phone} onChange={e=>setEditForm(p=>({ ...p, phone: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
                  <input value={editForm.age} onChange={e=>setEditForm(p=>({ ...p, age: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                  <select value={editForm.gender} onChange={e=>setEditForm(p=>({ ...p, gender: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Rel</label>
                  <select value={editForm.guardianRel} onChange={e=>setEditForm(p=>({ ...p, guardianRel: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                    <option value="">S/O or D/O</option>
                    <option value="S/O">S/O</option>
                    <option value="D/O">D/O</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Name</label>
                  <input value={editForm.guardianName} onChange={e=>setEditForm(p=>({ ...p, guardianName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">CNIC</label>
                  <input value={editForm.cnic} onChange={e=>setEditForm(p=>({ ...p, cnic: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                  <textarea value={editForm.address} onChange={e=>setEditForm(p=>({ ...p, address: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 text-sm font-semibold text-slate-800">Doctor / Department</div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                  <select value={editForm.departmentId} onChange={e=>setEditForm(p=>({ ...p, departmentId: e.target.value, doctorId: p.doctorId }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                    <option value="">Select department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Doctor</label>
                  <select value={editForm.doctorId} onChange={e=>setEditForm(p=>({ ...p, doctorId: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                    <option value="">Select doctor</option>
                    {filteredDoctors(editForm.departmentId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 text-sm font-semibold text-slate-800">Billing / Payment</div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Total Amount</label>
                  <input value={editForm.amount} onChange={e=>setEditForm(p=>({ ...p, amount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Discount</label>
                  <input value={editForm.discount} onChange={e=>setEditForm(p=>({ ...p, discount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Payment Status</label>
                  <select value={editForm.paymentStatus} onChange={e=>setEditForm(p=>({ ...p, paymentStatus: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                    <option value="paid">PAID</option>
                    <option value="unpaid">UNPAID</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Payed to (Receptionist)</label>
                  <input value={editForm.receptionistName} onChange={e=>setEditForm(p=>({ ...p, receptionistName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
                  <select value={editForm.paymentMethod} onChange={e=>setEditForm(p=>({ ...p, paymentMethod: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" disabled={editForm.paymentStatus !== 'paid'}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Insurance">Insurance</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Account Number/IBAN</label>
                  <input value={editForm.accountNumberIban} onChange={e=>setEditForm(p=>({ ...p, accountNumberIban: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" disabled={editForm.paymentStatus !== 'paid' || editForm.paymentMethod !== 'Card'} />
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={()=>{ if (editBusy) return; setEditOpen(false); setEditRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={editBusy}
                className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {editBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {returnOpen && returnRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Return Token</div>
              <button
                onClick={()=>{ if (returnBusy) return; setReturnOpen(false); setReturnRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3">
              <div className="text-sm text-slate-600">Token #{returnRow.tokenNo} • {returnRow.patient}</div>
              <div className="space-y-3 px-5 py-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Account</label>
                  <input
                    value={(() => {
                      const code = String(returnRow?.raw?.receivedToAccountCode || '').trim().toUpperCase()
                      if (!code) return '-'
                      const label = payToAccounts.find(x => x.code === code)?.label || ''
                      return label ? `${label}` : code
                    })()}
                    readOnly
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason of Return</label>
                  <textarea
                    value={returnReason}
                    onChange={e=>setReturnReason(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    placeholder="Enter reason"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={()=>{ if (returnBusy) return; setReturnOpen(false); setReturnRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitReturn}
                disabled={returnBusy}
                className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {returnBusy ? 'Saving...' : 'Save'}
              </button>

            </div>
          </div>
        </div>
      )}

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
    blue: 'bg-blue-100 text-blue-700 border-blue-100',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-100',
    violet: 'bg-violet-100 text-violet-700 border-violet-100',
    amber: 'bg-amber-100 text-amber-700 border-amber-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-sm  opacity-100">{title}</div>
      <div className="mt-1 text-xl font-semibold  ">{value}</div>
      <div className="text-xs ">Real-time data</div>
    </div>
  )
}

function TokenDetailsDialog({ open, onClose, row, payToAccounts }: { open: boolean; onClose: ()=>void; row: TokenRow; payToAccounts: Array<{ code: string; label: string }> }){
  if (!open) return null
  const t = row.raw || {}
  const patient = t.patientId || {}
  const doctor = t.doctorId || {}
  const dept = t.departmentId || {}
  const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString() : row.time

  const patientName = patient.fullName || t.patientName || row.patient || '-'
  const mrn = patient.mrn || t.mrn || row.mrNo || '-'
  const phone = patient.phoneNormalized || t.phone || row.phone || '-'
  const age = patient.age || t.age || row.age || '-'
  const gender = patient.gender || t.gender || row.gender || '-'
  const guardianRel = patient.guardianRel || t.guardianRel || '-'
  const guardianName = patient.fatherName || t.guardianName || t.guardian || '-'
  const cnic = patient.cnicNormalized || t.cnic || '-'
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
  const payedToName = (()=>{
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

function Info({ label, value, full }: { label: string; value: string; full?: boolean }){
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} rounded-lg border border-slate-200 bg-slate-50 px-3 py-2`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800 break-words">{value || '-'}</div>
    </div>
  )
}
