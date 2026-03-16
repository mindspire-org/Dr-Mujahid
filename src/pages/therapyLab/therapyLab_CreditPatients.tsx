import { useEffect, useMemo, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { therapyApi, hospitalApi } from '../../utils/api'
import Hospital_CreditPaymentSlip, { type HospitalCreditPaymentSlipData } from '../../components/hospital/Hospital_CreditPaymentSlip'

type LastToken = {
  _id?: string
  patientId?: string
  createdAt?: string
  tokenNo?: string
  fee?: number
  amount?: number
  discount?: number
  paymentStatus?: 'paid'|'unpaid'
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
  lastToken?: LastToken | null
}

function clamp0(n: any){
  const x = Number(n || 0)
  return Number.isFinite(x) ? Math.max(0, x) : 0
}

function Info({ label, value }: { label: string; value: string }){
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800 break-words">{value}</div>
    </div>
  )
}

function PayDialog({ open, onClose, row, payToAccounts, onPaid }: { open: boolean; onClose: ()=>void; row: CreditPatientRow | null; payToAccounts: Array<{ code: string; label: string }>; onPaid: (slip: HospitalCreditPaymentSlipData)=>void }){
  const [currentDues, setCurrentDues] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash'|'Card'|'Insurance'>('Cash')
  const [accountNumberIban, setAccountNumberIban] = useState('')
  const [receivedToAccountCode, setReceivedToAccountCode] = useState('')
  const [receptionistName, setReceptionistName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(()=>{
    if (!open || !row) return
    setCurrentDues(String(clamp0(row.dues)))
    setAmount(String(clamp0(row.dues)))
    setPaymentMethod('Cash')
    setAccountNumberIban('')
    setReceivedToAccountCode('')
    setReceptionistName('')
    setNote('')
  }, [open, row?.patientId])

  const preview = useMemo(()=>{
    const duesBefore = clamp0(currentDues)
    const advBefore = clamp0(row?.advance)
    const amt = clamp0(amount)
    const duesPaid = Math.min(duesBefore, amt)
    const duesAfter = Math.max(0, duesBefore - duesPaid)
    const advAdded = Math.max(0, amt - duesPaid)
    const advAfter = advBefore + advAdded
    return { duesBefore, advBefore, amt, duesPaid, duesAfter, advAdded, advAfter }
  }, [currentDues, amount, row?.advance])

  async function submit(){
    if (!row) return
    const amt = clamp0(amount)
    if (!amt) return
    if (!receivedToAccountCode) return
    try {
      setBusy(true)
      const res: any = await therapyApi.payCreditPatient(row.patientId, {
        amount: amt,
        currentDues: clamp0(currentDues),
        paymentMethod,
        receivedToAccountCode,
        accountNumberIban: paymentMethod === 'Card' ? (accountNumberIban || undefined) : undefined,
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
        paymentMethod: (String(r.paymentMethod || paymentMethod) === 'Card' ? 'Card' : (String(r.paymentMethod || paymentMethod) === 'Insurance' ? 'Insurance' : 'Cash')) as any,
        accountNumberIban: String(r.accountNumberIban || ''),
        receivedToAccountCode: String(r.receivedToAccountCode || receivedToAccountCode),
        receptionistName: String(r.receptionistName || receptionistName || ''),
        note: String(r.note || note || ''),
      })
      onClose()
    } catch (e: any) {
      alert(e?.message || 'Failed to pay')
    } finally {
      setBusy(false)
    }
  }

  if (!open || !row) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="text-base font-semibold text-slate-800">Pay Credit Patient</div>
          <button onClick={onClose} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50">Close</button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Patient" value={String(row.fullName || '-')}/>
            <Info label="MRN" value={String(row.mrn || '-')}/>
            <Info label="Phone" value={String(row.phone || '-')}/>
            <Info label="Advance" value={`Rs. ${clamp0(row.advance).toLocaleString()}`}/>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Current Dues</label>
              <input value={currentDues} onChange={e=>setCurrentDues(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
              <input value={amount} onChange={e=>setAmount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Dues After" value={`Rs. ${preview.duesAfter.toLocaleString()}`} />
            <Info label="Adv. After" value={`Rs. ${preview.advAfter.toLocaleString()}`} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Payed to (Account)</label>
            <select
              value={receivedToAccountCode}
              onChange={e=>{
                const code = e.target.value
                const label = payToAccounts.find(x => x.code === code)?.label || ''
                setReceivedToAccountCode(code)
                if (label) setReceptionistName(label)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Select account</option>
              {payToAccounts.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
              <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Insurance">Insurance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Receptionist Name</label>
              <input value={receptionistName} onChange={e=>setReceptionistName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Optional" />
            </div>
          </div>

          {paymentMethod === 'Card' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Account Number/IBAN</label>
              <input value={accountNumberIban} onChange={e=>setAccountNumberIban(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Enter account number or IBAN" />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" rows={3} placeholder="Optional" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Paying...' : 'Pay'}</button>
        </div>
      </div>
    </div>
  )
}

function DetailsDialog({ open, onClose, row }: { open: boolean; onClose: ()=>void; row: CreditPatientRow | null }){
  if (!open || !row) return null
  const last = row.lastToken || null
  const clamp = clamp0
  const net = clamp(last?.fee)
  const isUnpaid = String(last?.paymentStatus || '').toLowerCase() === 'unpaid'
  const paidToday = isUnpaid ? 0 : Math.min(net, clamp(last?.paidForToday) + clamp(last?.advanceApplied))
  const remaining = Math.max(0, net - paidToday)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Credit Patient Details</h3>
            <div className="mt-0.5 text-xs text-slate-500">{row.fullName || '-'} • MRN {row.mrn || '-'}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-800">Patient</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Patient Name" value={String(row.fullName || '-')} />
              <Info label="MRN" value={String(row.mrn || '-')} />
              <Info label="Phone" value={String(row.phone || '-')} />
              <Info label="Prev. Dues" value={`Rs. ${clamp(row.dues).toLocaleString()}`} />
              <Info label="Prev. Adv." value={`Rs. ${clamp(row.advance).toLocaleString()}`} />
              <Info label="Has Unpaid" value={row.hasUnpaid ? 'YES' : 'NO'} />
            </div>
          </section>

          {last && (
            <>
              <section>
                <h4 className="text-sm font-semibold text-slate-800">Latest Token</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Info label="Token No" value={String(last.tokenNo || '-')} />
                  <Info label="Date" value={last.createdAt ? new Date(last.createdAt).toLocaleString() : '-'} />
                  <Info label="Payable" value={`Rs. ${net.toLocaleString()}`} />
                  <Info label="Paid" value={`Rs. ${paidToday.toLocaleString()}`} />
                  <Info label="Remaining" value={`Rs. ${remaining.toLocaleString()}`} />
                  <Info label="Adv. After" value={`Rs. ${clamp(last.advanceAfter).toLocaleString()}`} />
                  <Info label="Payment Status" value={String(last.paymentStatus || '-').toUpperCase()} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-800">Payment Summary</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Info label="Prev. Dues" value={`Rs. ${clamp(last.duesBefore).toLocaleString()}`} />
                  <Info label="Prev. Adv." value={`Rs. ${clamp(last.advanceBefore).toLocaleString()}`} />
                  <Info label="Received Now" value={`Rs. ${clamp(last.amountReceived).toLocaleString()}`} />
                  <Info label="Adv. Used" value={`Rs. ${clamp(last.advanceApplied).toLocaleString()}`} />
                  <Info label="Dues After" value={`Rs. ${clamp(last.duesAfter).toLocaleString()}`} />
                  <Info label="Adv. After" value={`Rs. ${clamp(last.advanceAfter).toLocaleString()}`} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-800">Payment Details</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {!!last.payPreviousDues && <Info label="Pay Prev. Dues" value="YES" />}
                  {!!last.useAdvance && <Info label="Use Adv." value="YES" />}
                  <Info label="Dues Paid" value={`Rs. ${clamp(last.duesPaid).toLocaleString()}`} />
                  <Info label="Paid For Today" value={`Rs. ${clamp(last.paidForToday).toLocaleString()}`} />
                  <Info label="Adv. Added" value={`Rs. ${clamp(last.advanceAdded).toLocaleString()}`} />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TherapyLab_CreditPatients(){
  const [items, setItems] = useState<CreditPatientRow[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsRow, setDetailsRow] = useState<CreditPatientRow | null>(null)

  const [payOpen, setPayOpen] = useState(false)
  const [payRow, setPayRow] = useState<CreditPatientRow | null>(null)

  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<HospitalCreditPaymentSlipData | null>(null)

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try {
        const [bankRes, pettyRes] = await Promise.all([
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

        if (mounted) setPayToAccounts(opts)
      } catch {
        if (mounted) setPayToAccounts([])
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  async function load(){
    try {
      setLoading(true)
      const res: any = await therapyApi.listAccounts({ q, page, limit, hasDues: true })
      setItems(res?.items || [])
      setTotalPages(Math.max(1, Number(res?.totalPages || 1)))
    } catch {
      setItems([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [page, limit])

  const filtered = useMemo(()=>{
    const qq = q.trim().toLowerCase()
    if (!qq) return items
    return items.filter(r => [r.fullName, r.phone, r.mrn].filter(Boolean).some(v => String(v).toLowerCase().includes(qq)))
  }, [items, q])

  function openDetails(r: CreditPatientRow){
    setDetailsRow(r)
    setDetailsOpen(true)
  }

  function openPay(r: CreditPatientRow){
    setPayRow(r)
    setPayOpen(true)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Credit Patients <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{filtered.length}</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1) }} placeholder="Search by name, MRN, phone..." className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={()=>{ setPage(1); load() }} className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white">Search</button>
        </div>
      </div>

      <div className="mt-4 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-2 font-medium">MRN</th>
              <th className="px-4 py-2 font-medium">Patient</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Dues</th>
              <th className="px-4 py-2 font-medium">Advance</th>
              <th className="px-4 py-2 font-medium">Unpaid</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
            ) : filtered.length ? (
              filtered.map(r => (
                <tr key={r.patientId} className="text-slate-700">
                  <td className="px-4 py-2">{r.mrn || '-'}</td>
                  <td className="px-4 py-2 font-medium">{r.fullName || '-'}</td>
                  <td className="px-4 py-2">{r.phone || '-'}</td>
                  <td className="px-4 py-2 font-semibold text-rose-700">Rs. {clamp0(r.dues).toLocaleString()}</td>
                  <td className="px-4 py-2 font-semibold text-emerald-700">Rs. {clamp0(r.advance).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.hasUnpaid ? 'YES' : 'NO'}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>openDetails(r)} title="View" className="text-slate-700 hover:text-slate-900"><Eye size={18} /></button>
                      {clamp0(r.dues) > 0 && (
                        <button onClick={()=>openPay(r)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100">Pay</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No credit patients</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <select value={limit} onChange={e=>{ setLimit(parseInt(e.target.value)); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1">
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

      <DetailsDialog open={detailsOpen} onClose={()=>setDetailsOpen(false)} row={detailsRow} />

      <PayDialog
        open={payOpen}
        onClose={()=>{ setPayOpen(false); setPayRow(null) }}
        row={payRow}
        payToAccounts={payToAccounts}
        onPaid={(slip)=>{
          setSlipData(slip)
          setSlipOpen(true)
          setTimeout(()=>load(), 0)
        }}
      />

      {slipOpen && slipData && (
        <Hospital_CreditPaymentSlip 
          open={slipOpen} 
          onClose={()=>{ setSlipOpen(false); setSlipData(null); }} 
          data={slipData} 
          autoPrint={true} 
        />
      )}
    </div>
  )
}
