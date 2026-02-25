import { useCallback, useEffect, useMemo, useState } from 'react'
import { therapyApi } from '../../utils/api'
import TherapyLab_TokenSlip from '../../components/therapyLab/TherapyLab_TokenSlip'
import type { TherapyLabTokenSlipData } from '../../components/therapyLab/TherapyLab_TokenSlip'

type Visit = {
  _id: string
  tokenNo?: string
  patientId: string
  patient: {
    mrn?: string
    fullName?: string
    phone?: string
    age?: string
    gender?: string
    address?: string
    guardianRelation?: string
    guardianName?: string
    cnic?: string
  }
  packageId?: string
  packageName?: string
  tests: Array<{ id: string; name: string; price?: number }>
  subtotal: number
  discount: number
  net: number
  duesBefore: number
  advanceBefore: number
  payPreviousDues: boolean
  useAdvance: boolean
  advanceApplied: number
  amountReceived: number
  duesPaid: number
  paidForToday: number
  advanceAdded: number
  duesAfter: number
  advanceAfter: number
  createdAtIso?: string
}

export default function TherapyLab_Management() {
  const [q, setQ] = useState('')
  const [onlyDues, setOnlyDues] = useState(false)
  const [onlyAdvance, setOnlyAdvance] = useState(false)

  const [visits, setVisits] = useState<Visit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [visitsError, setVisitsError] = useState('')

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentVisitId, setPaymentVisitId] = useState<string | null>(null)
  const [paymentPatientId, setPaymentPatientId] = useState<string | null>(null)
  const [paymentAccount, setPaymentAccount] = useState<{ dues: number; advance: number } | null>(null)
  const [paymentAccountLoading, setPaymentAccountLoading] = useState(false)
  const [payAmount, setPayAmount] = useState('0')
  const [payMode, setPayMode] = useState<'duesFirst' | 'advanceOnly' | 'duesOnly'>('duesFirst')
  const [payNote, setPayNote] = useState('')
  const [paySaving, setPaySaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editVisit, setEditVisit] = useState<Visit | null>(null)
  const [editPackageName, setEditPackageName] = useState('')
  const [editPatient, setEditPatient] = useState<Visit['patient'] | null>(null)
  const [editTests, setEditTests] = useState<Visit['tests']>([])

  const [viewOpen, setViewOpen] = useState(false)
  const [viewVisit, setViewVisit] = useState<Visit | null>(null)

  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<TherapyLabTokenSlipData | null>(null)

  const canSearch = useMemo(() => (q || '').trim().length > 0, [q])

  const loadVisits = useCallback(async () => {
    try {
      setVisitsLoading(true)
      setVisitsError('')

      const raw = q.trim()
      const digitsOnly = raw.replace(/\D+/g, '')
      const isMrn = /^MR/i.test(raw)

      const res: any = await therapyApi.listVisits({
        mrn: isMrn ? raw : undefined,
        phone: !isMrn && digitsOnly.length >= 7 ? digitsOnly : undefined,
        name: !isMrn && !(digitsOnly.length >= 7) && raw ? raw : undefined,
        limit: 500,
      } as any)

      const items: any[] = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
      let next: any[] = items
      if (onlyDues) next = next.filter((v: any) => Number(v?.duesAfter || 0) > 0)
      if (onlyAdvance) next = next.filter((v: any) => Number(v?.advanceAfter || 0) > 0)
      setVisits(next as any)
    } catch (e: any) {
      setVisits([])
      setVisitsError(e?.message || 'Failed to load visits')
    } finally {
      setVisitsLoading(false)
    }
  }, [onlyAdvance, onlyDues, q])

  useEffect(() => {
    loadVisits()
  }, [loadVisits])

  const refreshPaymentAccount = useCallback(async (patientId: string) => {
    try {
      setPaymentAccountLoading(true)
      const res: any = await therapyApi.getAccount(String(patientId))
      const a: any = res?.account || null
      const dues = Math.max(0, Number(a?.dues || 0))
      const advance = Math.max(0, Number(a?.advance || 0))
      setPaymentAccount({ dues, advance })
    } catch {
      setPaymentAccount({ dues: 0, advance: 0 })
    } finally {
      setPaymentAccountLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!paymentOpen || !paymentPatientId) return
    refreshPaymentAccount(paymentPatientId)
  }, [paymentOpen, paymentPatientId, refreshPaymentAccount])

  function openPayment(opts: { visitId?: string | null; patientId?: string | null }) {
    setPaymentVisitId(opts.visitId || null)
    setPaymentPatientId(opts.patientId || null)
    setPaymentAccount(null)
    setPaymentOpen(true)
    setPayAmount('0')
    setPayMode('duesFirst')
    setPayNote('')
  }

  function openEdit(v: Visit) {
    setEditVisit(v)
    setEditPackageName(String(v.packageName || ''))
    setEditPatient({ ...(v.patient || {}) })
    setEditTests(
      (v.tests || []).map((t: any) => ({ id: String(t.id || ''), name: String(t.name || ''), price: Number(t.price || 0) })) as any
    )
    setEditOpen(true)
  }

  function openView(v: Visit) {
    setViewVisit(v)
    setViewOpen(true)
  }

  function openPaymentRemainingDues(v: Visit) {
    const duesAfterVisit = Math.max(0, Number(v.duesAfter || 0))
    setPaymentVisitId(v._id)
    setPaymentPatientId(v.patientId)
    setPaymentAccount(null)
    setPaymentOpen(true)
    setPayAmount(String(duesAfterVisit || 0))
    setPayMode('duesOnly')
    setPayNote('Remaining dues')
  }

  function openSlipFromVisit(v: Visit) {
    const slipRows = (v.tests || []).map((t) => ({ name: String(t.name || ''), price: Number(t.price || 0) }))
    const data: TherapyLabTokenSlipData = {
      tokenNo: String(v.tokenNo || ''),
      patientName: String(v.patient?.fullName || ''),
      phone: String(v.patient?.phone || ''),
      age: v.patient?.age || undefined,
      gender: v.patient?.gender || undefined,
      mrn: v.patient?.mrn || undefined,
      guardianRel: v.patient?.guardianRelation || undefined,
      guardianName: v.patient?.guardianName || undefined,
      cnic: v.patient?.cnic || undefined,
      address: v.patient?.address || undefined,
      tests: slipRows,
      subtotal: Number(v.subtotal || 0),
      discount: Number(v.discount || 0),
      payable: Number(v.net || 0),
      amountReceived: Number(v.amountReceived || 0),
      payPreviousDues: !!v.payPreviousDues,
      useAdvance: !!v.useAdvance,
      advanceApplied: Number(v.advanceApplied || 0),
      duesBefore: Number(v.duesBefore || 0),
      advanceBefore: Number(v.advanceBefore || 0),
      duesPaid: Number(v.duesPaid || 0),
      paidForToday: Number(v.paidForToday || 0),
      advanceAdded: Number(v.advanceAdded || 0),
      duesAfter: Number(v.duesAfter || 0),
      advanceAfter: Number(v.advanceAfter || 0),
      createdAt: v.createdAtIso || undefined,
    }
    setSlipData(data)
    setSlipOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Therapy Management</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search (MRN / Name / Phone)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="e.g. MR7553... / Ali / 03..." />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={onlyDues} onChange={(e) => setOnlyDues(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Has Dues
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={onlyAdvance} onChange={(e) => setOnlyAdvance(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Has Advance
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={loadVisits}
            disabled={visitsLoading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canSearch) return
              loadVisits()
            }}
            disabled={!canSearch || visitsLoading}
            className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Search
          </button>
        </div>

        {visitsError && <div className="mt-3 text-sm text-rose-600">{visitsError}</div>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Token</th>
                <th className="py-2 pr-3">MRN</th>
                <th className="py-2 pr-3">Patient</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Machine</th>
                <th className="py-2 pr-3">Net</th>
                <th className="py-2 pr-3">Received</th>
                <th className="py-2 pr-3">Dues</th>
                <th className="py-2 pr-3">Advance</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visitsLoading ? (
                <tr>
                  <td colSpan={11} className="py-3 text-slate-600">Loading...</td>
                </tr>
              ) : visits.length ? (
                visits.map((v) => (
                  <tr key={v._id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{v.createdAtIso ? new Date(v.createdAtIso).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{v.tokenNo || '-'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{v.patient?.mrn || '-'}</td>
                    <td className="py-2 pr-3">{v.patient?.fullName || '-'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{v.patient?.phone || '-'}</td>
                    <td className="py-2 pr-3">
                      {Array.isArray(v.tests) && v.tests.length ? (
                        <select
                          defaultValue={String(v.tests[0]?.name || '')}
                          className="w-full min-w-[180px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          {v.tests.map((t, idx) => (
                            <option key={`${t.id}-${idx}`} value={String(t.name || '')}>
                              {String(t.name || '-')}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">PKR {Number(v.net || 0).toLocaleString()}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">PKR {Number(v.amountReceived || 0).toLocaleString()}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">PKR {Number(v.duesAfter || 0).toLocaleString()}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">PKR {Number(v.advanceAfter || 0).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openView(v)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => openSlipFromVisit(v)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                        >
                          Print Slip
                        </button>
                        <button
                          type="button"
                          onClick={() => openView(v)}
                          title="View details"
                          className="rounded-md border border-slate-300 p-2 text-xs hover:bg-slate-50"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(v)}
                          title="Edit"
                          className="rounded-md border border-slate-300 p-2 text-xs hover:bg-slate-50"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => openPayment({ visitId: v._id, patientId: v.patientId })}
                          title="Add payment"
                          className="rounded-md border border-slate-300 p-2 text-xs hover:bg-slate-50"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => openPaymentRemainingDues(v)}
                          title="Add remaining dues payment"
                          className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 hover:bg-emerald-100"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-3 text-slate-600">No visits</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewOpen && viewVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Visit Details</div>
              <button
                type="button"
                onClick={() => setViewOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[80vh] overflow-auto p-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800">Patient Detail</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                    <div><span className="text-slate-500">Name:</span> {String(viewVisit.patient?.fullName || '-')}</div>
                    <div><span className="text-slate-500">MRN:</span> {String(viewVisit.patient?.mrn || '-')}</div>
                    <div><span className="text-slate-500">Phone:</span> {String(viewVisit.patient?.phone || '-')}</div>
                    <div><span className="text-slate-500">Age/Gender:</span> {String(viewVisit.patient?.age || '-')}{viewVisit.patient?.gender ? ` / ${String(viewVisit.patient.gender)}` : ''}</div>
                    <div><span className="text-slate-500">CNIC:</span> {String(viewVisit.patient?.cnic || '-')}</div>
                    <div><span className="text-slate-500">Guardian:</span> {String(viewVisit.patient?.guardianRelation || '-')}{viewVisit.patient?.guardianName ? ` ${String(viewVisit.patient.guardianName)}` : ''}</div>
                    <div><span className="text-slate-500">Address:</span> {String(viewVisit.patient?.address || '-')}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800">Token Detail</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                    <div><span className="text-slate-500">Token:</span> {String(viewVisit.tokenNo || '-')}</div>
                    <div><span className="text-slate-500">Date:</span> {viewVisit.createdAtIso ? new Date(viewVisit.createdAtIso).toLocaleString() : '-'}</div>
                    <div><span className="text-slate-500">Visit ID:</span> {String(viewVisit._id || '-')}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800">Therapy Detail</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                    <div><span className="text-slate-500">Package:</span> {String(viewVisit.packageName || '-')}</div>
                    <div>
                      <div className="text-slate-500">Machines:</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(viewVisit.tests || []).length ? (
                          (viewVisit.tests || []).map((t, idx) => (
                            <span key={`${t.id}-${idx}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                              {String(t.name || '-')}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </div>
                    <div><span className="text-slate-500">Subtotal:</span> PKR {Number(viewVisit.subtotal || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Discount:</span> PKR {Number(viewVisit.discount || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Net:</span> PKR {Number(viewVisit.net || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800">Payment Detail</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                    <div><span className="text-slate-500">Amount Received:</span> PKR {Number(viewVisit.amountReceived || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Pay Previous Dues:</span> {viewVisit.payPreviousDues ? 'Yes' : 'No'}</div>
                    <div><span className="text-slate-500">Use Advance:</span> {viewVisit.useAdvance ? 'Yes' : 'No'}</div>
                    <div><span className="text-slate-500">Dues Before:</span> PKR {Number(viewVisit.duesBefore || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Advance Before:</span> PKR {Number(viewVisit.advanceBefore || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Advance Applied:</span> PKR {Number(viewVisit.advanceApplied || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Dues Paid:</span> PKR {Number(viewVisit.duesPaid || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Paid For Today:</span> PKR {Number(viewVisit.paidForToday || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Advance Added:</span> PKR {Number(viewVisit.advanceAdded || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Dues After:</span> PKR {Number(viewVisit.duesAfter || 0).toLocaleString()}</div>
                    <div><span className="text-slate-500">Advance After:</span> PKR {Number(viewVisit.advanceAfter || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => openSlipFromVisit(viewVisit)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Print Slip
              </button>
              <button
                type="button"
                onClick={() => openPaymentRemainingDues(viewVisit)}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Add Payment
              </button>
              <button
                type="button"
                onClick={() => openEdit(viewVisit)}
                className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentOpen && paymentPatientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Add Payment</div>
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-3">
              {paymentVisitId && <div className="text-xs text-slate-600">Linked to visit: {paymentVisitId}</div>}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
                  <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="0" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Apply Mode</label>
                  <select value={payMode} onChange={(e) => setPayMode(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="duesFirst">Dues First</option>
                    <option value="duesOnly">Dues Only</option>
                    <option value="advanceOnly">Advance Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Note</label>
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Optional" />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Current Dues:{' '}
                <span className="font-semibold">
                  {paymentAccountLoading ? 'Loading...' : `PKR ${Number(paymentAccount?.dues || 0).toLocaleString()}`}
                </span>
                {'  '}|{'  '}
                Current Advance:{' '}
                <span className="font-semibold">
                  {paymentAccountLoading ? 'Loading...' : `PKR ${Number(paymentAccount?.advance || 0).toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setPaySaving(true)
                    const amt = Math.max(0, Number(payAmount || 0))
                    if (!amt) return
                    await therapyApi.recordPayment({
                      patientId: String(paymentPatientId),
                      visitId: paymentVisitId || undefined,
                      amount: amt,
                      applyMode: payMode,
                      note: payNote || undefined,
                    })
                    setPaymentOpen(false)
                    await loadVisits()
                  } finally {
                    setPaySaving(false)
                  }
                }}
                disabled={paySaving}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editVisit && editPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Edit Visit</div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Token</label>
                  <input value={String(editVisit.tokenNo || '')} readOnly className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Package Name</label>
                  <input value={editPackageName} onChange={(e) => setEditPackageName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Patient Name</label>
                  <input
                    value={String(editPatient.fullName || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, fullName: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                  <input
                    value={String(editPatient.phone || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, phone: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Age</label>
                  <input
                    value={String(editPatient.age || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, age: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Gender</label>
                  <input
                    value={String(editPatient.gender || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, gender: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">CNIC</label>
                  <input
                    value={String(editPatient.cnic || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, cnic: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Guardian Relation</label>
                  <input
                    value={String(editPatient.guardianRelation || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, guardianRelation: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Guardian Name</label>
                  <input
                    value={String(editPatient.guardianName || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, guardianName: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Address</label>
                  <input
                    value={String(editPatient.address || '')}
                    onChange={(e) => setEditPatient((p) => (p ? { ...p, address: e.target.value } : p))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Machines</div>
                  <button
                    type="button"
                    onClick={() => setEditTests((xs) => [...xs, { id: String(Date.now()), name: '', price: 0 } as any])}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {editTests.map((t: any, idx: number) => (
                    <div key={`${t.id}-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_160px_90px]">
                      <input
                        value={String(t.name || '')}
                        onChange={(e) =>
                          setEditTests((xs) => xs.map((x: any, i: number) => (i === idx ? { ...x, name: e.target.value } : x)))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        placeholder="Machine name"
                      />
                      <input
                        value={String(t.price ?? 0)}
                        onChange={(e) =>
                          setEditTests((xs) =>
                            xs.map((x: any, i: number) => (i === idx ? { ...x, price: Number(e.target.value || 0) } : x))
                          )
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        placeholder="Price"
                      />
                      <button
                        type="button"
                        onClick={() => setEditTests((xs) => xs.filter((_, i) => i !== idx))}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={async () => {
                  try {
                    setEditSaving(true)
                    const patch: any = {
                      packageName: editPackageName || undefined,
                      patient: editPatient,
                      tests: (editTests || []).map((t: any, i: number) => ({
                        id: String(t.id || i),
                        name: String(t.name || ''),
                        price: Number(t.price || 0),
                      })),
                    }
                    await therapyApi.updateVisit(String(editVisit._id), patch)
                    setEditOpen(false)
                    await loadVisits()
                  } finally {
                    setEditSaving(false)
                  }
                }}
                className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {slipOpen && slipData && <TherapyLab_TokenSlip open={slipOpen} onClose={() => setSlipOpen(false)} data={slipData} autoPrint />}
    </div>
  )
}
