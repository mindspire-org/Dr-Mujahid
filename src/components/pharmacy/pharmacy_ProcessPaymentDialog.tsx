import { useEffect, useState, useRef, useMemo } from 'react'
import { hospitalApi, pharmacyApi } from '../../utils/api'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (data: {
    method: 'cash'
    customer?: string
    mrn?: string
    phone?: string
    age?: string
    gender?: string
    guardianRel?: string
    guardianName?: string
    cnic?: string
    address?: string
    accountCode?: string
    paymentMethod?: string
    amountReceivedNow?: number
    payPreviousDues?: boolean
    useAdvance?: boolean
    duesBefore?: number
    advanceBefore?: number
    advanceApplied?: number
    duesPaid?: number
    paidForToday?: number
    advanceAdded?: number
    duesAfter?: number
    advanceAfter?: number
    paymentStatus?: 'paid' | 'unpaid'
  }) => void
  totals?: {
    subtotal: number
    lineDiscount: number
    billDiscount: number
    tax: number
    total: number
    taxRate?: number
    currency?: string
  }
  initialPatient?: { patientName?: string; mrn?: string; phone?: string; age?: string; gender?: string; guardianRel?: string; guardianName?: string; cnic?: string; address?: string }
}

export default function Pharmacy_ProcessPaymentDialog({ open, onClose, onConfirm, totals, initialPatient }: Props) {
  // Patient info
  const [patientForm, setPatientForm] = useState({ phone: '', patientName: '', mrn: '', age: '', gender: '', guardianRel: '', guardianName: '', cnic: '', address: '' })
  const [phoneMatches, setPhoneMatches] = useState<any[]>([])
  const [selectOpen, setSelectOpen] = useState(false)
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const phoneLookupTimerRef = useRef<any>(null)
  const phoneLookupSeqRef = useRef(0)
  const phoneRef = useRef<HTMLInputElement>(null)
  const dummyRef = useRef<HTMLInputElement>(null)

  // Payment section state
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  const [receivedToAccountCode, setReceivedToAccountCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid')

  // Billing summary state
  const [amountReceivedNow, setAmountReceivedNow] = useState('0')
  const [payPreviousDues, setPayPreviousDues] = useState(false)
  const [useAdvance, setUseAdvance] = useState(false)
  const [account, setAccount] = useState<{ dues: number; advance: number }>({ dues: 0, advance: 0 })
  const [accountLoading, setAccountLoading] = useState(false)

  const net = totals?.total ?? 0
  const currency = totals?.currency ?? 'PKR'

  // Load pay-to accounts
  useEffect(() => {
    if (!open) return
    let mounted = true
    ;(async () => {
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
          if (!c || seen.has(c)) return
          seen.add(c)
          opts.push({ code: c, label: String(label || c) })
        }
        const myCode = String(mineRes?.account?.code || '').trim().toUpperCase()
        if (myCode) add(myCode, `${mineRes?.account?.name || 'My Petty Cash'} (${myCode})`)
        for (const p of (pettyRes?.accounts || [])) {
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code || String(p?.responsibleStaff || '').trim()) continue
          if (String(p?.status || 'Active') !== 'Active') continue
          add(code, `${String(p?.name || code).trim()} (${code})`)
        }
        for (const b of (bankRes?.accounts || [])) {
          const an = String(b?.accountNumber || '')
          const last4 = an ? an.slice(-4) : ''
          const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
          if (!code) continue
          const bankLabel = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}${last4 ? ` (${last4})` : ''}`.trim()
          add(code, bankLabel ? `${bankLabel} (${code})` : code)
        }
        if (mounted) {
          setPayToAccounts(opts)
          setReceivedToAccountCode(prev => {
            if (prev) return prev
            if (myCode) return myCode
            try {
              const session = JSON.parse(localStorage.getItem('hospital.session') || '{}')
              const username = String(session?.username || '').trim().toLowerCase()
              const myBank = (bankRes?.accounts || []).find((b: any) => String(b?.responsibleStaff || '').trim().toLowerCase() === username)
              if (myBank) {
                const an = String(myBank?.accountNumber || '')
                const last4 = an ? an.slice(-4) : ''
                return String(myBank?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
              }
            } catch {}
            return ''
          })
        }
      } catch { if (mounted) setPayToAccounts([]) }
    })()
    return () => { mounted = false }
  }, [open])

  const paymentPreview = useMemo(() => {
    const duesBefore = Math.max(0, Number(account?.dues || 0))
    const advanceBefore = Math.max(0, Number(account?.advance || 0))
    const received = Math.max(0, Number(amountReceivedNow || 0))
    let netDueToday = net
    let advanceLeft = advanceBefore
    let advanceApplied = 0
    if (useAdvance) {
      advanceApplied = Math.min(advanceBefore, netDueToday)
      netDueToday = Math.max(0, netDueToday - advanceApplied)
      advanceLeft = Math.max(0, advanceBefore - advanceApplied)
    }
    let amt = received
    let duesPaid = 0
    let duesAfter = duesBefore
    if (payPreviousDues) {
      duesPaid = Math.min(duesAfter, amt)
      duesAfter = Math.max(0, duesAfter - duesPaid)
      amt -= duesPaid
    }
    const paidForToday = Math.min(netDueToday, amt)
    netDueToday = Math.max(0, netDueToday - paidForToday)
    amt -= paidForToday
    const advanceAdded = Math.max(0, amt)
    duesAfter = duesAfter + netDueToday
    const advanceAfter = advanceLeft + advanceAdded
    return { duesBefore, advanceBefore, advanceApplied, duesPaid, paidForToday, advanceAdded, duesAfter, advanceAfter }
  }, [account, amountReceivedNow, useAdvance, payPreviousDues, net])

  // Phone lookup
  async function runPhoneLookup(digits: string) {
    if (!digits) { setPhoneMatches([]); setPhoneLookupLoading(false); setSelectOpen(false); return }
    setPhoneLookupLoading(true)
    const seq = ++phoneLookupSeqRef.current
    try {
      const r: any = await hospitalApi.searchPatients({ phone: digits, limit: 25 })
      if (seq !== phoneLookupSeqRef.current) return
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      setPhoneMatches(list)
      setSelectOpen(list.length >= 1)
    } catch {
      if (seq !== phoneLookupSeqRef.current) return
      setPhoneMatches([])
      setSelectOpen(false)
    } finally {
      if (seq !== phoneLookupSeqRef.current) return
      setPhoneLookupLoading(false)
    }
  }

  function schedulePhoneLookup(rawPhone: string) {
    const digits = String(rawPhone || '').replace(/\D+/g, '')
    if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current)
    if (!digits || digits.length < 4) { setPhoneMatches([]); setSelectOpen(false); return }
    phoneLookupTimerRef.current = setTimeout(() => runPhoneLookup(digits), 350)
  }

  function applyPatient(p: any) {
    setPatientForm({
      phone: p.phoneNormalized || p.phone || '',
      patientName: p.fullName || '',
      mrn: p.mrn || '',
      age: p.age != null && p.age !== '' ? String(p.age) : '',
      gender: p.gender || '',
      guardianRel: p.guardianRel || '',
      guardianName: p.fatherName || p.guardianName || '',
      cnic: p.cnicNormalized || p.cnic || '',
      address: p.address || '',
    })
    setSelectOpen(false)
    setPhoneMatches([])
    // Load account dues/advance for this patient
    const key = p.mrn || p.phoneNormalized || p.phone || ''
    if (key) loadAccount(key)
  }

  async function loadAccount(key: string) {
    if (!key) { setAccount({ dues: 0, advance: 0 }); return }
    setAccountLoading(true)
    try {
      const res: any = await pharmacyApi.getPharmacyAccount(key)
      const a = res?.account
      setAccount({ dues: Math.max(0, Number(a?.dues || 0)), advance: Math.max(0, Number(a?.advance || 0)) })
    } catch {
      setAccount({ dues: 0, advance: 0 })
    } finally {
      setAccountLoading(false)
    }
  }

  // Reset on open
  useEffect(() => {
    if (!open) return
    setPatientForm({
      phone: initialPatient?.phone || '',
      patientName: initialPatient?.patientName || '',
      mrn: initialPatient?.mrn || '',
      age: initialPatient?.age || '',
      gender: initialPatient?.gender || '',
      guardianRel: initialPatient?.guardianRel || '',
      guardianName: initialPatient?.guardianName || '',
      cnic: initialPatient?.cnic || '',
      address: initialPatient?.address || '',
    })
    setPhoneMatches([])
    setSelectOpen(false)
    setPaymentStatus('paid')
    setPaymentMethod('Cash')
    setAmountReceivedNow(net > 0 ? String(net.toFixed(2)) : '0')
    setPayPreviousDues(false)
    setUseAdvance(false)
    setAccount({ dues: 0, advance: 0 })
    // If we have an MRN, always try to fetch full patient details
    // (covers cases where initialPatient only has mrn+name from older flow)
    if (initialPatient?.mrn) {
      const hasFullData = !!(initialPatient.phone || initialPatient.age || initialPatient.gender || initialPatient.cnic)
      if (!hasFullData) {
        ;(async () => {
          try {
            const r: any = await hospitalApi.searchPatients({ mrn: initialPatient.mrn, limit: 1 })
            const p = (r?.patients || [])[0]
            if (p && (p.fullName || p.phoneNormalized)) {
              applyPatient(p)
              // applyPatient already calls loadAccount
            } else {
              loadAccount(initialPatient.mrn!)
            }
          } catch {
            loadAccount(initialPatient.mrn!)
          }
        })()
      } else {
        loadAccount(initialPatient.mrn)
      }
    }
    const t = setTimeout(() => { try { phoneRef.current?.focus() } catch {} }, 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => { if (!open) return; setAmountReceivedNow(net > 0 ? String(net.toFixed(2)) : '0') }, [net])

  useEffect(() => {
    if (paymentStatus !== 'unpaid') return
    setAmountReceivedNow('0'); setPayPreviousDues(false); setUseAdvance(false)
  }, [paymentStatus])

  if (!open) return null

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const customer = patientForm.patientName.trim() || patientForm.phone.trim() || undefined
    onConfirm({
      method: 'cash', customer,
      mrn: patientForm.mrn.trim() || undefined,
      phone: patientForm.phone.trim() || undefined,
      age: patientForm.age.trim() || undefined,
      gender: patientForm.gender.trim() || undefined,
      guardianRel: patientForm.guardianRel.trim() || undefined,
      guardianName: patientForm.guardianName.trim() || undefined,
      cnic: patientForm.cnic.trim() || undefined,
      address: patientForm.address.trim() || undefined,
      accountCode: receivedToAccountCode || undefined,
      paymentMethod, paymentStatus,
      amountReceivedNow: Math.max(0, Number(amountReceivedNow || 0)),
      payPreviousDues, useAdvance,
      duesBefore: paymentPreview.duesBefore, advanceBefore: paymentPreview.advanceBefore,
      advanceApplied: paymentPreview.advanceApplied, duesPaid: paymentPreview.duesPaid,
      paidForToday: paymentPreview.paidForToday, advanceAdded: paymentPreview.advanceAdded,
      duesAfter: paymentPreview.duesAfter, advanceAfter: paymentPreview.advanceAfter,
    })
  }

  const inp = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
  const lbl = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:px-4" role="dialog" aria-modal="true">
      <form onSubmit={confirm} className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Process Payment</h3>
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
          <input ref={dummyRef} className="hidden" />

          {/* Patient Information */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Patient Information</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={lbl}>MR #</label>
                <input className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400" value={patientForm.mrn || 'auto'} disabled readOnly />
              </div>
              <div className="md:col-span-2 relative">
                <label className={lbl}>Phone</label>
                <input
                  ref={phoneRef}
                  className={inp}
                  placeholder="Enter 11-digit phone"
                  value={patientForm.phone}
                  onChange={e => { setPatientForm(p => ({ ...p, phone: e.target.value })); schedulePhoneLookup(e.target.value) }}
                  onBlur={() => setTimeout(() => setSelectOpen(false), 200)}
                />
                {phoneLookupLoading && <div className="mt-1 text-xs text-slate-500">Searching...</div>}
                {selectOpen && phoneMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {phoneMatches.slice(0, 10).map((p: any) => (
                      <button key={p._id} type="button" onMouseDown={() => applyPatient(p)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                        <span className="font-medium">{p.fullName}</span>
                        {p.mrn && <span className="ml-2 text-xs text-slate-500">MRN: {p.mrn}</span>}
                        {p.phoneNormalized && <span className="ml-2 text-xs text-slate-500">{p.phoneNormalized}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Patient Name</label>
                <input className={inp} placeholder="Full Name" value={patientForm.patientName} onChange={e => setPatientForm(p => ({ ...p, patientName: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Age</label>
                <input className={inp} placeholder="e.g., 25" value={patientForm.age} onChange={e => setPatientForm(p => ({ ...p, age: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Gender</label>
                <select className={inp} value={patientForm.gender} onChange={e => setPatientForm(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">Select gender</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Guardian</label>
                <select className={inp} value={patientForm.guardianRel} onChange={e => setPatientForm(p => ({ ...p, guardianRel: e.target.value }))}>
                  <option value="">S/O or D/O</option>
                  <option value="S/O">S/O</option><option value="D/O">D/O</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Guardian Name</label>
                <input className={inp} placeholder="Father/Guardian Name" value={patientForm.guardianName} onChange={e => setPatientForm(p => ({ ...p, guardianName: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>CNIC</label>
                <input className={inp} placeholder="13-digit CNIC" value={patientForm.cnic} onChange={e => setPatientForm(p => ({ ...p, cnic: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Address</label>
                <input className={inp} placeholder="Residential Address" value={patientForm.address} onChange={e => setPatientForm(p => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Payment Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100">Payment</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Payed to (Account)</label>
                <select value={receivedToAccountCode} onChange={e => setReceivedToAccountCode(e.target.value)} disabled={paymentStatus === 'unpaid'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                  <option value="">Select account</option>
                  {payToAccounts.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Payment Status</label>
                <div className="flex items-center gap-6 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={paymentStatus === 'paid'} onChange={() => setPaymentStatus('paid')} className="h-4 w-4" />
                    Paid
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={paymentStatus === 'unpaid'} onChange={() => setPaymentStatus('unpaid')} className="h-4 w-4" />
                    Unpaid
                  </label>
                </div>
              </div>
              {paymentStatus !== 'unpaid' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Payment Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Billing Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100">Billing Summary</div>
            <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <div className="flex items-center justify-between py-2">
                <div className="text-slate-600 dark:text-slate-400">Subtotal</div>
                <div className="font-medium dark:text-slate-200">{currency} {(totals?.subtotal ?? 0).toFixed(2)}</div>
              </div>
              {(totals?.lineDiscount ?? 0) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div className="text-slate-600 dark:text-slate-400">Line Discounts</div>
                  <div className="font-medium dark:text-slate-200">- {currency} {(totals?.lineDiscount ?? 0).toFixed(2)}</div>
                </div>
              )}
              {(totals?.billDiscount ?? 0) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div className="text-slate-600 dark:text-slate-400">Bill Discount</div>
                  <div className="font-medium dark:text-slate-200">- {currency} {(totals?.billDiscount ?? 0).toFixed(2)}</div>
                </div>
              )}
              {(totals?.tax ?? 0) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div className="text-slate-600 dark:text-slate-400">Sales Tax ({totals?.taxRate ?? 0}%)</div>
                  <div className="font-medium dark:text-slate-200">{currency} {(totals?.tax ?? 0).toFixed(2)}</div>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-300 dark:border-slate-600 pt-3 mt-1 py-2 font-bold text-lg text-slate-900 dark:text-slate-100">
                <div>Net Amount</div>
                <div>{currency} {net.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Payment</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Previous Dues</div>
                  <div className="mt-1 text-sm text-slate-900 dark:text-slate-200">{accountLoading ? 'Loading...' : `${currency} ${Number(account.dues).toLocaleString()}`}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Previous Advance</div>
                  <div className="mt-1 text-sm text-slate-900 dark:text-slate-200">{accountLoading ? 'Loading...' : `${currency} ${Number(account.advance).toLocaleString()}`}</div>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Amount Received Now</label>
                <input value={amountReceivedNow} onChange={e => setAmountReceivedNow(e.target.value)} disabled={paymentStatus === 'unpaid'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" placeholder="0" />
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={payPreviousDues} onChange={e => setPayPreviousDues(e.target.checked)} disabled={paymentStatus === 'unpaid'} className="h-4 w-4" />
                  Pay Previous Dues
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={useAdvance} onChange={e => setUseAdvance(e.target.checked)} disabled={paymentStatus === 'unpaid'} className="h-4 w-4" />
                  Use Advance
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Dues After</span>
                  <span className="font-medium dark:text-slate-200">{currency} {paymentPreview.duesAfter.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Advance After</span>
                  <span className="font-medium dark:text-slate-200">{currency} {paymentPreview.advanceAfter.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
          <button type="submit" className="btn">Confirm Payment</button>
        </div>
      </form>
    </div>
  )
}
