import { useEffect, useMemo, useRef, useState } from 'react'
import { therapyApi, hospitalApi } from '../../utils/api'
import TherapyLab_TokenSlip from '../../components/therapyLab/TherapyLab_TokenSlip'
import type { TherapyLabTokenSlipData } from '../../components/therapyLab/TherapyLab_TokenSlip'
import { ChevronDown, CornerUpLeft, Eye, Pencil, Ticket, X } from 'lucide-react'

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
  tests: any[]
  fee: number
  discount?: number
  discountType?: 'PKR' | '%'
  paymentStatus?: 'paid' | 'unpaid'
  receptionistName?: string
  paymentMethod?: string
  accountNumberIban?: string
  receivedToAccountCode?: string
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
  status: 'active' | 'returned' | 'cancelled'
  sessionStatus: 'Queued' | 'Completed'
  returnReason?: string
  raw?: any
}

export default function TherapyLab_TodayTokens() {
  const [rows, setRows] = useState<TokenRow[]>([])
  const [liveDues, setLiveDues] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [showSlip, setShowSlip] = useState(false)
  const [slipData, setSlipData] = useState<TherapyLabTokenSlipData | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsRow, setDetailsRow] = useState<TokenRow | null>(null)

  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  const payToLoadedRef = useRef(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnRow, setReturnRow] = useState<TokenRow | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnBusy, setReturnBusy] = useState(false)

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
    amount: '',
    discount: '',
    discountType: 'PKR' as 'PKR' | '%',
    paymentStatus: 'paid' as 'paid' | 'unpaid',
    receptionistName: '',
    paymentMethod: 'Cash' as 'Cash' | 'Card',
    accountNumberIban: '',
  })

  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null)
  const [packagesMenuOpen, setPackagesMenuOpen] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = () => {
      setStatusMenuOpen(null)
      setPackagesMenuOpen(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    load()
  }, [])

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

          if (mounted) {
            setPayToAccounts(opts)
          }
        } catch {
          if (mounted) setPayToAccounts([])
        }
      })()
    return () => { mounted = false }
  }, [])

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const res = await therapyApi.listVisits({ from: today, to: today }) as any
    const rawItems = res.items || res.visits || []
    const items: TokenRow[] = rawItems.map((t: any) => ({
      _id: t._id,
      date: t.createdAtIso ? t.createdAtIso.slice(0, 10) : (t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-CA') : today),
      time: t.createdAtIso ? new Date(t.createdAtIso).toLocaleTimeString() : (t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : ''),
      tokenNo: t.tokenNo,
      mrNo: t.patient?.mrn || '-',
      patient: t.patient?.fullName || '-',
      age: t.patient?.age,
      gender: t.patient?.gender,
      phone: t.patient?.phone,
      tests: t.tests || [],
      fee: Number(t.net || t.subtotal || 0),
      discount: Number(t.discount || 0),
      discountType: (t.discountType || 'PKR') as 'PKR' | '%',
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
      status: t.status || 'active',
      sessionStatus: t.sessionStatus || 'Queued',
      returnReason: t.returnReason || '',
      raw: t,
    }))
    const filtered = items.filter(r => r.status !== 'cancelled')
    setRows(filtered)

    // Fetch live account dues for each unique patient
    const uniquePatientIds = Array.from(new Set(
      filtered.map(r => String(r.raw?.patientId || '')).filter(Boolean)
    ))
    if (uniquePatientIds.length) {
      const results = await Promise.allSettled(
        uniquePatientIds.map(pid => therapyApi.getAccount(pid) as Promise<any>)
      )
      const map: Record<string, number> = {}
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          const a = res.value?.account
          map[uniquePatientIds[i]] = Math.max(0, Number(a?.dues || 0))
        }
      })
      setLiveDues(map)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const address = r.raw?.patient?.address || r.raw?.address
      return [
        r.date,
        r.patient,
        r.mrNo,
        r.tokenNo,
        r.phone,
        r.age,
        r.gender,
        address,
        r.time,
        r.paymentStatus,
        r.status,
      ]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    })
  }, [query, rows])

  const totalPatients = rows.length
  const totalTokens = rows.length
  const totalRevenue = rows.reduce((s, r) => s + (r.status === 'returned' ? 0 : r.fee), 0)
  const todayCompleted = rows.filter(r => r.sessionStatus === 'Completed').length
  const returnedPatients = rows.filter(r => r.status === 'returned').length

  const start = (page - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  async function updateStatus(id: string, newStatus: 'Queued' | 'Completed') {
    try {
      setActioningId(id)
      await therapyApi.updateSessionStatus(id, newStatus)
      await load()
      setStatusMenuOpen(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to update status')
    } finally {
      setActioningId(null)
    }
  }

  function openReturn(r: TokenRow) {
    setReturnRow(r)
    setReturnReason('')
    setReturnOpen(true)
  }

  async function submitReturn() {
    if (!returnRow) return
    const reason = returnReason.trim()
    if (!reason) return alert('Please provide a reason')
    try {
      setReturnBusy(true)
      await therapyApi.returnVisit(returnRow._id, reason)
      setReturnOpen(false)
      setReturnRow(null)
      setReturnReason('')
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to return token')
    } finally {
      setReturnBusy(false)
    }
  }

  function openEdit(r: TokenRow) {
    const t = r.raw || {}
    const patient = t.patient || {}

    setEditRow(r)
    setEditForm({
      patientName: patient.fullName || r.patient || '',
      phone: patient.phone || r.phone || '',
      age: patient.age || r.age || '',
      gender: patient.gender || r.gender || '',
      guardianRel: patient.guardianRelation || '',
      guardianName: patient.guardianName || '',
      cnic: patient.cnic || '',
      address: patient.address || '',
      amount: String(t.subtotal || 0),
      discount: String(t.discount || 0),
      discountType: (t.discountType || 'PKR') as 'PKR' | '%',
      paymentStatus: (t.paymentStatus === 'unpaid' ? 'unpaid' : 'paid'),
      receptionistName: t.receptionistName || '',
      paymentMethod: (t.paymentMethod === 'Card' ? 'Card' : 'Cash'),
      accountNumberIban: t.accountNumberIban || '',
    })
    setEditOpen(true)
  }

  async function submitEdit() {
    if (!editRow) return
    try {
      setEditBusy(true)
      setActioningId(editRow._id)
      const cleanNum = (s: string) => {
        const x = String(s || '').trim().replace(/[^0-9.]/g, '')
        if (!x) return 0
        const n = parseFloat(x)
        return isFinite(n) ? n : 0
      }

      const subtotal = cleanNum(editForm.amount)
      const discount = cleanNum(editForm.discount)
      const net = editForm.discountType === '%' ? subtotal * (1 - discount / 100) : subtotal - discount

      const payload: any = {
        patient: {
          ...editRow.raw?.patient,
          fullName: editForm.patientName,
          phone: editForm.phone,
          age: editForm.age,
          gender: editForm.gender,
          guardianRelation: editForm.guardianRel,
          guardianName: editForm.guardianName,
          cnic: editForm.cnic,
          address: editForm.address,
        },
        subtotal,
        discount,
        discountType: editForm.discountType,
        net,
        paymentStatus: editForm.paymentStatus,
        receptionistName: editForm.receptionistName || undefined,
        paymentMethod: editForm.paymentStatus === 'paid' ? editForm.paymentMethod : undefined,
        accountNumberIban: editForm.paymentStatus === 'paid' && editForm.paymentMethod === 'Card' ? (editForm.accountNumberIban || undefined) : undefined,
      }
      await therapyApi.updateVisit(editRow._id, payload)
      setEditOpen(false)
      setEditRow(null)
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to update visit')
    } finally {
      setEditBusy(false)
      setActioningId(null)
    }
  }

  function printSlip(r: TokenRow) {
    const t = r.raw || {}
    const slip: TherapyLabTokenSlipData = {
      tokenNo: r.tokenNo,
      patientName: r.patient || '-',
      phone: r.phone || '',
      mrn: r.mrNo || '',
      age: r.age,
      gender: r.gender,
      guardianRel: t.patient?.guardianRelation,
      guardianName: t.patient?.guardianName,
      cnic: t.patient?.cnic,
      address: t.patient?.address,
      tests: (t.tests || []).map((p: any) => ({ name: p.name, details: p.details })),
      subtotal: t.subtotal || 0,
      discount: t.discount || 0,
      discountType: t.discountType || 'PKR',
      payable: t.net || 0,
      amountReceived: t.amountReceived || 0,
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
      receptionistName: t.receptionistName,
      receivedToAccountCode: t.receivedToAccountCode,
      paymentMethod: t.paymentMethod,
      accountNumberIban: t.accountNumberIban,
      createdAt: t.createdAt,
    }
    setSlipData(slip)
    setShowSlip(true)
  }

  function openDetails(r: TokenRow) {
    setDetailsRow(r)
    setShowDetails(true)
  }

  const exportCSV = () => {
    const cols = ['Time', 'Token #', 'MR #', 'Patient', 'Age', 'Fee', 'Payment Status', 'Discount', 'Returned']
    const lines = [cols.join(',')]
    for (const r of filtered) {
      lines.push([
        r.time,
        r.tokenNo,
        r.mrNo,
        r.patient,
        r.age ?? '',
        r.fee,
        (r.paymentStatus || 'paid').toUpperCase(),
        r.discount || 0,
        r.status === 'returned' ? 'Yes' : 'No',
      ].map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : String(v)).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `therapy-tokens-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Today's Tokens <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{filtered.length}</span></h2>
        <button onClick={exportCSV} className="w-full sm:w-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Export CSV</button>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, token#, MR#, phone, age, gender..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Today's Patients" value={totalPatients} tone="blue" />
        <StatCard title="Tokens Generated" value={totalTokens} tone="green" />
        <StatCard title="Today's Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} tone="violet" />
        <StatCard title="Today's Completed" value={todayCompleted} tone="green" />
        <StatCard title="Returned Patients" value={returnedPatients} tone="amber" />
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
              <Th>Packages</Th>
              <Th>Fee</Th>
              <Th>Payment Status</Th>
              <Th>Status</Th>
              <Th>Dues</Th>
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
                <Td>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPackagesMenuOpen(packagesMenuOpen === r._id ? null : r._id)
                      }}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <div className="max-w-[150px] truncate">
                        {r.tests.map(p => p.name).join(', ') || '-'}
                      </div>
                      <ChevronDown size={14} />
                    </button>
                    {packagesMenuOpen === r._id && (
                      <div
                        className="absolute left-0 z-50 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100">Selected Machines</div>
                        {r.tests.length > 0 ? (
                          r.tests.map((p, i) => {
                            const details = p.details || {}
                            const selectedTypes: string[] = []

                            // Handle fixed machine types
                            Object.entries(details).forEach(([key, val]) => {
                              if (val === true) selectedTypes.push(key.toUpperCase())
                              else if (key === 'note' && val) selectedTypes.push(String(val))
                            })

                            // Handle custom machine types (checks/fields)
                            if (details.checks) {
                              Object.entries(details.checks).forEach(([key, val]) => {
                                if (val === true) selectedTypes.push(key)
                              })
                            }
                            if (details.fields) {
                              Object.entries(details.fields).forEach(([key, val]) => {
                                if (val) selectedTypes.push(`${key}: ${val}`)
                              })
                            }

                            return (
                              <div key={i} className="px-4 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="font-medium text-slate-900">{p.name}</div>
                                  {selectedTypes.length > 0 && (
                                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider text-right">
                                      {selectedTypes.join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-400 italic">No packages selected</div>
                        )}
                      </div>
                    )}
                  </div>
                </Td>
                <Td className="font-semibold text-emerald-600">Rs. {r.fee.toLocaleString()}</Td>
                <Td>
                  <span className={`rounded px-2 py-0.5 text-xs ${String(r.paymentStatus || 'paid').toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                    {String(r.paymentStatus || 'paid').toUpperCase()}
                  </span>
                </Td>
                <Td>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setStatusMenuOpen(statusMenuOpen === r._id ? null : r._id)
                      }}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${r.sessionStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                    >
                      {r.sessionStatus}
                      <ChevronDown size={14} />
                    </button>
                    {statusMenuOpen === r._id && (
                      <div
                        className="absolute left-0 z-50 mt-1 w-32 rounded-md border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(['Queued', 'Completed'] as const).map((s) => (
                          <button
                            key={s}
                            disabled={actioningId === r._id}
                            onClick={() => updateStatus(r._id, s)}
                            className={`block w-full px-4 py-2 text-left text-xs hover:bg-slate-50 ${r.sessionStatus === s ? 'font-bold text-slate-900' : 'text-slate-600'
                              }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Td>
                <Td className="font-bold text-red-600">
                  Rs. {(liveDues[String(r.raw?.patientId || '')] ?? 0).toLocaleString()}
                </Td>
                <Td>
                  {r.discountType === '%' ? (() => {
                    const subtotal = r.raw?.subtotal || (r.fee / (1 - (r.discount || 0) / 100));
                    const discountAmount = Math.round(subtotal * ((r.discount || 0) / 100));
                    return `${r.discount || 0}% (PKR ${discountAmount.toLocaleString()})`;
                  })() : `Rs. ${Number(r.discount || 0).toLocaleString()}`}
                </Td>
                <Td>
                  <button onClick={() => printSlip(r)} className="text-sky-600 hover:text-sky-800 flex items-center gap-1 font-medium">
                    <Ticket size={16} />
                    <span>Print</span>
                  </button>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(r)} title="Edit" className="text-slate-600 hover:text-slate-900"><Pencil size={18} /></button>
                    <button onClick={() => openDetails(r)} title="View Details" className="text-slate-600 hover:text-slate-900"><Eye size={18} /></button>
                    <button
                      disabled={actioningId === r._id || r.status === 'returned'}
                      onClick={() => openReturn(r)}
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
        <TherapyLab_TokenSlip
          open={showSlip}
          onClose={() => setShowSlip(false)}
          data={slipData}
          autoPrint={false}
        />
      )}

      {showDetails && detailsRow && (
        <TokenDetailsDialog open={showDetails} onClose={() => setShowDetails(false)} row={detailsRow} payToAccounts={payToAccounts} />
      )}

      {returnOpen && returnRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Return Token</div>
              <button
                onClick={() => { if (returnBusy) return; setReturnOpen(false); setReturnRow(null) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              <div className="mb-4 text-sm text-slate-600">
                Are you sure you want to return token <span className="font-bold text-slate-900">#{returnRow.tokenNo}</span> for <span className="font-bold text-slate-900">{returnRow.patient}</span>?
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason of Return *</label>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="e.g. Patient changed mind, Wrong package selected etc."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  rows={3}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={returnBusy}
                  onClick={() => { setReturnOpen(false); setReturnRow(null) }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={returnBusy || !returnReason.trim()}
                  onClick={submitReturn}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {returnBusy ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Edit Token</div>
              <button onClick={() => { if (editBusy) return; setEditOpen(false); setEditRow(null) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Close</button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-6">
              <div className="text-sm text-slate-600">Token #{editRow.tokenNo} • {editRow.patient}</div>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 text-sm font-semibold text-slate-800">Patient Details</div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
                  <input value={editForm.patientName} onChange={e => setEditForm(p => ({ ...p, patientName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
                  <input value={editForm.age} onChange={e => setEditForm(p => ({ ...p, age: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                  <select value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Rel</label>
                  <select value={editForm.guardianRel} onChange={e => setEditForm(p => ({ ...p, guardianRel: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                    <option value="">S/O or D/O</option>
                    <option value="S/O">S/O</option>
                    <option value="D/O">D/O</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Name</label>
                  <input value={editForm.guardianName} onChange={e => setEditForm(p => ({ ...p, guardianName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">CNIC</label>
                  <input value={editForm.cnic} onChange={e => setEditForm(p => ({ ...p, cnic: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                  <textarea value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 text-sm font-semibold text-slate-800">Billing / Payment</div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Subtotal Amount</label>
                  <input value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Discount</label>
                    <input value={editForm.discount} onChange={e => setEditForm(p => ({ ...p, discount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                    <select value={editForm.discountType} onChange={e => setEditForm(p => ({ ...p, discountType: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                      <option value="PKR">PKR</option>
                      <option value="%">%</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Payment Status</label>
                  <select value={editForm.paymentStatus} onChange={e => setEditForm(p => ({ ...p, paymentStatus: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                    <option value="paid">PAID</option>
                    <option value="unpaid">UNPAID</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Receptionist Name</label>
                  <input value={editForm.receptionistName} onChange={e => setEditForm(p => ({ ...p, receptionistName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
                  <select value={editForm.paymentMethod} onChange={e => setEditForm(p => ({ ...p, paymentMethod: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" disabled={editForm.paymentStatus !== 'paid'}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Account Number/IBAN</label>
                  <input value={editForm.accountNumberIban} onChange={e => setEditForm(p => ({ ...p, accountNumberIban: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" disabled={editForm.paymentStatus !== 'paid' || editForm.paymentMethod !== 'Card'} />
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={() => { if (editBusy) return; setEditOpen(false); setEditRow(null) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={submitEdit} disabled={editBusy} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{editBusy ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TokenDetailsDialog({ open, onClose, row, payToAccounts }: { open: boolean; onClose: () => void; row: TokenRow; payToAccounts: Array<{ code: string; label: string }> }) {
  if (!open) return null
  const t = row.raw || {}
  const patient = t.patient || {}
  const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString() : `${row.date} ${row.time}`

  const patientName = patient.fullName || row.patient || '-'
  const mrn = patient.mrn || row.mrNo || '-'
  const phone = patient.phone || row.phone || '-'
  const age = patient.age || row.age || '-'
  const gender = patient.gender || row.gender || '-'
  const guardianRel = patient.guardianRelation || '-'
  const guardianName = patient.guardianName || '-'
  const cnic = patient.cnic || '-'
  const address = patient.address || '-'

  const subtotal = Number(t.subtotal || 0)
  const discVal = Number(row.discount || 0)
  const discountAmount = row.discountType === '%' ? Math.round(subtotal * (discVal / 100)) : discVal
  const payable = Number(t.net || 0)
  const paymentStatus = String(t.paymentStatus || row.paymentStatus || 'paid')
  const isPaid = paymentStatus.toLowerCase() === 'paid'

  const clamp0 = (n: any) => Math.max(0, Number(n || 0))
  const isUnpaid = paymentStatus.toLowerCase() === 'unpaid'
  const computed = (() => {
    const duesBefore = clamp0(t.duesBefore || 0)
    const advanceBefore = clamp0(t.advanceBefore || 0)
    const advanceApplied = clamp0(t.advanceApplied || 0)
    const amountReceived = isUnpaid ? 0 : clamp0(t.amountReceived || 0)
    const duesPaid = clamp0(t.duesPaid || 0)
    const paidForToday = clamp0(t.paidForToday || 0)
    const advanceAdded = clamp0(t.advanceAdded || 0)
    const duesAfter = clamp0(t.duesAfter || 0)
    const advanceAfter = clamp0(t.advanceAfter || 0)
    const paidToday = isUnpaid ? 0 : Math.min(payable, paidForToday + advanceApplied)
    const remaining = Math.max(0, payable - paidToday)
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
      payPreviousDues: !!t.payPreviousDues,
      useAdvance: !!t.useAdvance,
    }
  })()

  const receptionistName = String(t.receptionistName || '')
  const receivedToAccountCode = String(t.receivedToAccountCode || '')
  const payedToName = (() => {
    const code = String(receivedToAccountCode || '').trim().toUpperCase()
    if (!code) return receptionistName || '-'
    const label = payToAccounts.find(x => x.code === code)?.label || ''
    if (label) return String(label).split('(')[0].trim() || label
    return receptionistName || code || '-'
  })()
  const paymentMethod = String(t.paymentMethod || '')
  const accountNumberIban = String(t.accountNumberIban || '')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Token Details</h3>
            <div className="mt-0.5 text-xs text-slate-500">Token #{row.tokenNo} • {createdAt}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"><X size={18} /></button>
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
              <Info label="Guardian" value={`${guardianRel} ${guardianName}`} />
              <Info label="CNIC" value={String(cnic)} />
              <Info label="Address" value={String(address)} full />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-800">Token Details</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Status" value={String(row.status)} />
              <Info label="Token No" value={String(row.tokenNo)} />
              <Info label="Subtotal" value={`Rs. ${subtotal.toLocaleString()}`} />
              <Info label="Discount" value={row.discountType === '%' ? `${row.discount || 0}% (PKR ${(discountAmount || 0).toLocaleString()})` : `Rs. ${(discountAmount || 0).toLocaleString()}`} />
              <Info label="Payable" value={`Rs. ${payable.toLocaleString()}`} />
              <Info label="Paid" value={`Rs. ${computed.paidToday.toLocaleString()}`} />
              <Info label="Remaining" value={`Rs. ${computed.remaining.toLocaleString()}`} />
              <Info label="Payment Status" value={paymentStatus.toUpperCase()} />
              <Info label="Payed to:" value={payedToName} />
              {isPaid && <Info label="Payment Method" value={paymentMethod || '-'} />}
              {isPaid && paymentMethod === 'Card' && <Info label="Account Number/IBAN" value={accountNumberIban || '-'} />}
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
