import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

export default function Diagnostic_Referrals() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isReception = pathname.startsWith('/reception')
  const [list, setList] = useState<any[]>([])
  const [status, setStatus] = useState<'pending' | 'completed' | 'cancelled' | 'all'>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cancelDialog, setCancelDialog] = useState<{ id: string; name: string } | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => { load() }, [status, page, limit, from, to])

  async function load() {
    try {
      const res: any = await hospitalApi.listReferrals({ type: 'diagnostic', status: status === 'all' ? undefined : status, from: from || undefined, to: to || undefined, page, limit })
      setList(res?.referrals || [])
      setTotal(Number(res?.total || 0))
    } catch { setList([]); setTotal(0) }
  }

  async function confirmCancel() {
    if (!cancelDialog) return
    setCancelling(true)
    try {
      await hospitalApi.updateReferralStatus(cancelDialog.id, 'cancelled')
      setCancelDialog(null)
      await load()
    } catch (e: any) { alert(e?.message || 'Failed to cancel') }
    finally { setCancelling(false) }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list || []).filter((r: any) => !s || `${r.encounterId?.patientId?.fullName || ''} ${r.encounterId?.patientId?.mrn || ''} ${r.encounterId?.doctorId?.name || ''} ${(r.tests || []).join(' ')}`.toLowerCase().includes(s))
  }, [list, q])

  return (
    <>
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="text-xl font-bold text-slate-900 text-center sm:text-left">Diagnostic Referrals</div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="w-full lg:max-w-md">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, MRN, doctor, tests..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 whitespace-nowrap">From</span>
                <input type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value) }} className="rounded-md border border-slate-300 px-2 py-1.5 focus:border-sky-500" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 whitespace-nowrap">To</span>
                <input type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value) }} className="rounded-md border border-slate-300 px-2 py-1.5 focus:border-sky-500" />
              </div>
              <div className="flex items-center gap-2">
                <select value={status} onChange={e => { setPage(1); setStatus(e.target.value as any) }} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500">
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All Status</option>
                </select>
                <select value={limit} onChange={e => { setPage(1); setLimit(parseInt(e.target.value) || 20) }} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
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
          {filtered.map((r: any) => (
            <div key={r._id} className="px-4 py-3 text-sm">
              <div className="font-medium">{r.encounterId?.patientId?.fullName || '-'} <span className="text-xs text-slate-500">{r.encounterId?.patientId?.mrn || ''}</span></div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{new Date(r.createdAt).toLocaleString()}</span>
                <span>•</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status === 'completed' ? 'Completed' : r.status === 'cancelled' ? 'Cancelled' : 'Pending'}</span>
                <span>•</span>
                <span>By: Dr. {r.encounterId?.doctorId?.name || '-'}</span>
              </div>
              {(r.tests || []).length > 0 && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Tests:</span> {(r.tests || []).join(', ')}</div>}
              {r.notes && <div className="mt-1 text-xs text-slate-700"><span className="font-semibold">Notes:</span> {r.notes}</div>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1 text-sm text-sky-700"
                  title="Process referral"
                  hidden={r.status === 'completed'}
                  onClick={async () => {
                    const p = r?.encounterId?.patientId || {}
                    const d = r?.encounterId?.doctorId || {}
                    // Resolve tests: use referral.tests if present, else fetch from prescription
                    let resolvedTests: string[] = Array.isArray(r?.tests) ? r.tests.filter(Boolean) : []
                    if (!resolvedTests.length && r?.prescriptionId) {
                      try {
                        const res: any = await hospitalApi.getReferral(String(r._id))
                        const ref = res?.referral
                        const direct: string[] = Array.isArray(ref?.tests) ? ref.tests.filter(Boolean) : []
                        if (direct.length) {
                          resolvedTests = direct
                        } else {
                          const pres = ref?.prescriptionId
                          const fromPres: string[] = Array.isArray(pres?.diagnosticTests) ? pres.diagnosticTests.filter(Boolean) : []
                          if (fromPres.length) resolvedTests = fromPres
                        }
                      } catch { }
                    }
                    navigate(isReception ? '/reception/diagnostic/token-generator' : '/diagnostic/token-generator', {
                      state: {
                        fromReferralId: r._id,
                        prescriptionId: r?.prescriptionId || undefined,
                        encounterId: r?.encounterId?._id || r?.encounterId,
                        patient: {
                          mrn: p.mrn,
                          fullName: p.fullName,
                          phone: p.phoneNormalized || p.phone,
                          gender: p.gender,
                          address: p.address,
                          fatherName: p.fatherName,
                          cnic: p.cnicNormalized || p.cnic,
                        },
                        referringConsultant: d?.name ? `Dr. ${d.name}` : undefined,
                        requestedTests: resolvedTests,
                        notes: r?.notes || '',
                      }
                    })
                  }}
                >Process</button>
                {r.status !== 'completed' && <button className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1 text-sm text-orange-700" onClick={() => setCancelDialog({ id: r._id, name: r.encounterId?.patientId?.fullName || 'this referral' })}>Cancel</button>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">No referrals</div>}
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <div className="text-slate-600">Page {page}</div>
          <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>
    </div>

    {/* Cancel Confirmation Dialog */}
    {cancelDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
          <div className="mb-1 text-base font-semibold text-slate-900">Cancel Referral</div>
          <p className="mb-5 text-sm text-slate-600">Are you sure you want to cancel the referral for <span className="font-medium text-slate-800">{cancelDialog.name}</span>? This will mark it as cancelled.</p>
          <div className="flex justify-end gap-2">
            <button className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setCancelDialog(null)} disabled={cancelling}>Keep</button>
            <button className="rounded-md bg-orange-600 px-4 py-1.5 text-sm text-white hover:bg-orange-700 disabled:opacity-60" onClick={confirmCancel} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Yes, Cancel'}</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
