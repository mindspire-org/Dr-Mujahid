import { useEffect, useMemo, useState } from 'react'
import { counsellingApi, hospitalApi } from '../../utils/api'
import { Eye, X } from 'lucide-react'
import Counselling_CreditPaymentSlip, { type CounsellingCreditPaymentSlipData } from '../../components/counselling/Counselling_CreditPaymentSlip'

type LastOrder = {
  _id?: string
  patientId?: string
  createdAt?: string
  tokenNo?: string
  subtotal?: number
  discount?: number
  net?: number
  paymentStatus?: 'paid' | 'unpaid'
  receptionistName?: string
  paymentMethod?: string
  accountNumberIban?: string
  receivedToAccountCode?: string

  duesBefore?: number
  advanceBefore?: number
  payPreviousDues?: boolean
  useAdvance?: boolean
  advanceApplied?: number
  amountReceived?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
}

type CreditPatientRow = {
  patientId: string
  mrn?: string
  fullName?: string
  phone?: string
  dues: number
  advance: number
  hasUnpaid: boolean
  updatedAtIso?: string
  lastOrder?: LastOrder | null
}

function clamp0(n: any) {
  const x = Number(n || 0)
  return Number.isFinite(x) ? Math.max(0, x) : 0
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800 break-words">{value}</div>
    </div>
  )
}

function PayDialog({ open, onClose, row, payToAccounts, onPaid }: { open: boolean; onClose: () => void; row: CreditPatientRow | null; payToAccounts: Array<{ code: string; label: string }>; onPaid: (slip: CounsellingCreditPaymentSlipData) => void }) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Insurance'>('Cash')
  const [accountNumberIban, setAccountNumberIban] = useState('')
  const [receivedToAccountCode, setReceivedToAccountCode] = useState('')
  const [receptionistName, setReceptionistName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !row) return
    setAmount(String(clamp0(row.dues)))
    setPaymentMethod('Cash')
    setAccountNumberIban('')
    setReceivedToAccountCode(localStorage.getItem('last_selected_pay_account') || '')
    setReceptionistName('')
    setNote('')
  }, [open, row?.patientId])

  const preview = useMemo(() => {
    const duesBefore = clamp0(row?.dues)
    const advBefore = clamp0(row?.advance)
    const amt = clamp0(amount)
    const duesPaid = Math.min(duesBefore, amt)
    const duesAfter = Math.max(0, duesBefore - duesPaid)
    const advAdded = Math.max(0, amt - duesPaid)
    const advAfter = advBefore + advAdded
    return { duesBefore, advBefore, amt, duesPaid, duesAfter, advAdded, advAfter }
  }, [amount, row?.dues, row?.advance])

  async function submit() {
    if (!row) return
    const amt = clamp0(amount)
    if (!amt) return
    if (!receivedToAccountCode) return
    try {
      setBusy(true)
      const res: any = await counsellingApi.payCreditPatient(row.patientId, {
        amount: amt,
        currentDues: clamp0(row.dues),
        paymentMethod,
        receivedToAccountCode,
        accountNumberIban: (paymentMethod === 'Card' || paymentMethod === 'Insurance') ? (accountNumberIban || undefined) : undefined,
        receptionistName: receptionistName || undefined,
        note: note || undefined,
      })
      const r = res?.receipt || {}
      onPaid({
        patientName: String(r.patientName || row.fullName || '-'),
        mrn: String(r.mrn || row.mrn || ''),
        phone: String(r.phone || row.phone || ''),
        createdAt: String(r.createdAt || new Date().toISOString()),
        amount: clamp0(r.amount),
        duesBefore: clamp0(r.duesBefore),
        advanceBefore: clamp0(r.advanceBefore),
        duesPaid: clamp0(r.duesPaid),
        advanceAdded: clamp0(r.advanceAdded),
        duesAfter: clamp0(r.duesAfter),
        advanceAfter: clamp0(r.advanceAfter),
        paymentMethod: (r.paymentMethod || paymentMethod) as any,
        accountNumberIban: String(r.accountNumberIban || ''),
        receivedToAccountCode: String(r.receivedToAccountCode || receivedToAccountCode),
        receptionistName: String(r.receptionistName || receptionistName || ''),
        note: String(r.note || note || ''),
      })
      onClose()
    } catch {
    } finally {
      setBusy(false)
    }
  }

  if (!open || !row) return null
  const selected = String(receivedToAccountCode || '').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Credit Payment</div>
            <div className="mt-0.5 text-sm text-slate-600">{row.fullName || '-'}{row.mrn ? ` • ${row.mrn}` : ''}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Total Dues</label>
              <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                PKR {clamp0(row.dues).toLocaleString()}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount to Pay</label>
              <input 
                type="number"
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Insurance">Insurance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payed to Account</label>
              <select value={selected} onChange={(e) => setReceivedToAccountCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                <option value="">Select account</option>
                {payToAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {(paymentMethod === 'Card' || paymentMethod === 'Insurance') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {paymentMethod === 'Card' ? 'Account#/IBAN' : 'Policy/Reference No'}
              </label>
              <input value={accountNumberIban} onChange={(e) => setAccountNumberIban(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Receptionist</label>
              <input value={receptionistName} onChange={(e) => setReceptionistName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800">Payment Breakdown</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-600">Prev. Dues</span><span className="font-medium">PKR {preview.duesBefore.toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Prev. Adv.</span><span className="font-medium">PKR {preview.advBefore.toLocaleString()}</span></div>
              <div className="flex items-center justify-between text-emerald-700 font-semibold"><span className="">Dues Paid</span><span>PKR {preview.duesPaid.toLocaleString()}</span></div>
              <div className="flex items-center justify-between text-blue-700 font-semibold"><span className="">Adv. Added</span><span>PKR {preview.advAdded.toLocaleString()}</span></div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200"><span className="text-slate-600">Dues After</span><span className="font-bold">PKR {preview.duesAfter.toLocaleString()}</span></div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200"><span className="text-slate-600">Adv. After</span><span className="font-bold">PKR {preview.advAfter.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button 
            disabled={busy || !clamp0(amount) || !receivedToAccountCode || ((paymentMethod === 'Card' || paymentMethod === 'Insurance') && !accountNumberIban)} 
            onClick={submit} 
            className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
          >
            {busy ? 'Processing...' : 'Confirm & Pay'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentDetailsDialog({ open, onClose, row }: { open: boolean; onClose: () => void; row: CreditPatientRow | null }) {
  const o = row?.lastOrder || null
  const payable = clamp0(o?.net)
  const paidForToday = clamp0(o?.paidForToday)
  const advanceApplied = clamp0(o?.advanceApplied)
  const isUnpaid = String(o?.paymentStatus || '').toLowerCase() === 'unpaid'
  const paid = isUnpaid ? 0 : Math.min(payable, paidForToday + advanceApplied)
  const remaining = Math.max(0, payable - paid)

  if (!open || !row) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-slate-50 shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">Payment Details</div>
            <div className="mt-0.5 text-sm text-slate-600">Updated account + latest order payment breakdown.</div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Patient" value={String(row.fullName || '-')} />
            <Info label="MRN" value={String(row.mrn || '-')} />
            <Info label="Phone" value={String(row.phone || '-')} />
            <Info label="Unpaid Orders" value={row.hasUnpaid ? 'YES' : 'NO'} />
            <Info label="Current Dues" value={`PKR ${clamp0(row.dues).toLocaleString()}`} />
            <Info label="Current Adv." value={`PKR ${clamp0(row.advance).toLocaleString()}`} />
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-800">Latest Order</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Info label="Token" value={String(o?.tokenNo || '-')} />
              <Info label="Date" value={o?.createdAt ? new Date(o.createdAt).toLocaleString() : '-'} />
              <Info label="Pay. Status" value={String(o?.paymentStatus || '-').toUpperCase()} />
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-800">Amounts</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Info label="Payable" value={`PKR ${payable.toLocaleString()}`} />
              <Info label="Paid" value={`PKR ${paid.toLocaleString()}`} />
              <Info label="Remaining" value={`PKR ${remaining.toLocaleString()}`} />
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-800">Billing Summary</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Prev. Dues" value={`PKR ${clamp0(o?.duesBefore).toLocaleString()}`} />
              <Info label="Prev. Adv." value={`PKR ${clamp0(o?.advanceBefore).toLocaleString()}`} />
              <Info label="Received Now" value={`PKR ${clamp0(o?.amountReceived).toLocaleString()}`} />
              <Info label="Adv. Used" value={`PKR ${clamp0(o?.advanceApplied).toLocaleString()}`} />
              <Info label="Dues After" value={`PKR ${clamp0(o?.duesAfter).toLocaleString()}`} />
              <Info label="Adv. After" value={`PKR ${clamp0(o?.advanceAfter).toLocaleString()}`} />
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-800">Payment Breakdown</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Pay Prev. Dues" value={o?.payPreviousDues ? 'YES' : 'NO'} />
              <Info label="Use Adv." value={o?.useAdvance ? 'YES' : 'NO'} />
              <Info label="Dues Paid" value={`PKR ${clamp0(o?.duesPaid).toLocaleString()}`} />
              <Info label="Paid For Today" value={`PKR ${clamp0(o?.paidForToday).toLocaleString()}`} />
              <Info label="Adv. Added" value={`PKR ${clamp0(o?.advanceAdded).toLocaleString()}`} />
              <Info label="Payed to" value={String(o?.receptionistName || '-')} />
              <Info label="Pay. Method" value={String(o?.paymentMethod || '-')} />
              <Info label="Account#/IBAN" value={String(o?.accountNumberIban || '-')} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function Counselling_CreditPatients() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(20)
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<CreditPatientRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogRow, setDialogRow] = useState<CreditPatientRow | null>(null)

  const [payOpen, setPayOpen] = useState(false)
  const [payRow, setPayRow] = useState<CreditPatientRow | null>(null)
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])

  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<CounsellingCreditPaymentSlipData | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [bankRes, pettyRes] = await Promise.all([
          hospitalApi.listBankAccounts(),
          hospitalApi.listPettyCashAccounts(),
        ]) as any
        
        let userPettyCode = ''
        const sessionRaw = localStorage.getItem('hospital.session')
        const currentUser = sessionRaw ? JSON.parse(sessionRaw)?.username : ''

        const opts: Array<{ code: string; label: string }> = []
        const seen = new Set<string>()
        const add = (code?: string, label?: string) => {
          const c = String(code || '').trim().toUpperCase()
          if (!c) return
          if (seen.has(c)) return
          seen.add(c)
          opts.push({ code: c, label: String(label || c) })
        }

        const petty: any[] = pettyRes?.accounts || []
        for (const p of petty) {
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code) continue
          const rs = String(p?.responsibleStaff || '').trim()
          if (rs && rs !== currentUser) continue
          if (String(p?.status || 'Active') !== 'Active') continue
          add(code, `${String(p?.name || code).trim()} (${code})`)
          if (rs === currentUser) userPettyCode = code
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
          if (userPettyCode) {
            localStorage.setItem('last_selected_pay_account', userPettyCode)
          }
        }
      } catch {
        if (mounted) setPayToAccounts([])
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res: any = await counsellingApi.listCreditPatients({ q: q || undefined, page, limit: rows })
        const arr: CreditPatientRow[] = (res?.items || []).map((x: any) => ({
          patientId: String(x.patientId || ''),
          mrn: x.mrn,
          fullName: x.fullName,
          phone: x.phone,
          dues: clamp0(x.dues),
          advance: clamp0(x.advance),
          hasUnpaid: !!x.hasUnpaid,
          updatedAtIso: x.updatedAtIso,
          lastOrder: x.lastOrder || null,
        }))
        if (!mounted) return
        setItems(arr)
        setTotal(Number(res?.total || arr.length || 0))
        setTotalPages(Number(res?.totalPages || 1))
      } catch {
        if (!mounted) return
        setItems([])
        setTotal(0)
        setTotalPages(1)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [q, page, rows])

  const pageCount = useMemo(() => Math.max(1, totalPages), [totalPages])
  const curPage = Math.min(page, pageCount)

  const start = Math.min((curPage - 1) * rows + 1, total)
  const end = Math.min((curPage - 1) * rows + items.length, total)

  const openDetails = (r: CreditPatientRow) => {
    setDialogRow(r)
    setDialogOpen(true)
  }

  const openPay = (r: CreditPatientRow) => {
    setPayRow(r)
    setPayOpen(true)
  }

  const refresh = async () => {
    try {
      setLoading(true)
      const res: any = await counsellingApi.listCreditPatients({ q: q || undefined, page, limit: rows })
      const arr: CreditPatientRow[] = (res?.items || []).map((x: any) => ({
        patientId: String(x.patientId || ''),
        mrn: x.mrn,
        fullName: x.fullName,
        phone: x.phone,
        dues: clamp0(x.dues),
        advance: clamp0(x.advance),
        hasUnpaid: !!x.hasUnpaid,
        updatedAtIso: x.updatedAtIso,
        lastOrder: x.lastOrder || null,
      }))
      setItems(arr)
      setTotal(Number(res?.total || arr.length || 0))
      setTotalPages(Number(res?.totalPages || 1))
    } catch {
      setItems([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Credit Patients</h2>
        <div className="text-sm text-slate-600">{loading ? 'Loading...' : `${total ? `${start}-${end} of ${total}` : '0 results'}`}</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search by name, MRN, phone..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500">Rows</label>
              <select value={rows} onChange={(e) => { setRows(Number(e.target.value) || 20); setPage(1) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50/50 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">MRN</th>
              <th className="px-4 py-3 font-semibold">Patient</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Dues</th>
              <th className="px-4 py-3 font-semibold">Adv.</th>
              <th className="px-4 py-3 font-semibold">Unpaid</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((r) => (
              <tr key={r.patientId}>
                <td className="px-3 py-2">{r.mrn || '-'}</td>
                <td className="px-3 py-2">{r.fullName || '-'}</td>
                <td className="px-3 py-2">{r.phone || '-'}</td>
                <td className="px-3 py-2">PKR {clamp0(r.dues).toLocaleString()}</td>
                <td className="px-3 py-2">PKR {clamp0(r.advance).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={r.hasUnpaid ? 'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700' : 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'}>
                    {r.hasUnpaid ? 'YES' : 'NO'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    {clamp0(r.dues) > 0 && (
                      <button
                        onClick={() => openPay(r)}
                        className="rounded-md border border-emerald-600 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        title="Pay Dues"
                      >
                        Pay
                      </button>
                    )}
                    <button
                      onClick={() => openDetails(r)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-1.5 text-slate-700 hover:bg-slate-50"
                      title="View Payment Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  {loading ? 'Loading...' : 'No credit patients'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          disabled={curPage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Prev
        </button>
        <div className="text-sm text-slate-600">Page {curPage} / {pageCount}</div>
        <button
          disabled={curPage >= pageCount}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <PaymentDetailsDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogRow(null) }}
        row={dialogRow}
      />

      <PayDialog
        open={payOpen}
        onClose={() => { setPayOpen(false); setPayRow(null) }}
        row={payRow}
        payToAccounts={payToAccounts}
        onPaid={(slip) => {
          setSlipData(slip)
          setSlipOpen(true)
          refresh()
        }}
      />

      {slipData && (
        <Counselling_CreditPaymentSlip
          open={slipOpen}
          onClose={() => { setSlipOpen(false); setSlipData(null) }}
          data={slipData}
          autoPrint
        />
      )}
    </div>
  )
}
