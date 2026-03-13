import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'

function formatPKR(n?: number) {
  return `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Number(n || 0))}`
}

export default function Finance_PettyCashRefill() {
  const [pettyList, setPettyList] = useState<any[]>([])
  const [bankList, setBankList] = useState<any[]>([])
  const [pettyCode, setPettyCode] = useState('')
  const [bankId, setBankId] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [dateIso, setDateIso] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)


  useEffect(() => {
    (async () => {
      try {
        const [p, b]: any = await Promise.all([
          hospitalApi.listPettyCashAccounts(),
          hospitalApi.listBankAccounts(),
        ])
        setPettyList(p?.accounts || [])
        setBankList(b?.accounts || [])
      } catch { }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!pettyCode) { setStatus(null); return }
      try {
        const res: any = await hospitalApi.getPettyCashStatus(pettyCode)
        setStatus(res || null)
      } catch { setStatus(null) }
    })()
  }, [pettyCode])

  const pettyAccountName = useMemo(() => {
    const a = pettyList.find(x => x.code === pettyCode)
    return a?.name || ''
  }, [pettyList, pettyCode])

  async function submit() {
    if (!pettyCode) return alert('Select petty cash account')
    if (!bankId) return alert('Select bank account')
    const amt = Number(amount || 0)
    if (!(amt > 0)) return alert('Enter a valid amount')
    setSubmitting(true)
    try {
      await hospitalApi.refillPettyCash({ pettyCode, bankId, amount: amt, dateIso, memo })
      alert('Refill recorded successfully')
      setAmount(0); setMemo('')
      // refresh status after refill
      try {
        const res: any = await hospitalApi.getPettyCashStatus(pettyCode); setStatus(res || null)
      } catch { }
    } catch (e: any) {
      alert(e?.message || 'Failed to refill petty cash')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Petty Cash Refill / Top-Up</div>
        <div className="text-sm text-slate-500">Transfer funds from a bank account to a petty cash account</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Petty Cash Account</label>
            <select value={pettyCode} onChange={e => setPettyCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select petty cash</option>
              {pettyList.map((p: any) => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Bank Account (Source)</label>
            <select value={bankId} onChange={e => setBankId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select bank</option>
              {bankList.map((b: any) => (
                <option key={b.id} value={b.id}>{b.bankName} — {b.accountTitle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Refill Date</label>
            <input type="date" value={dateIso} onChange={e => setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Refill Amount</label>
            <input value={amount || ''} onChange={e => setAmount(Number(e.target.value || 0))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Monthly petty cash top-up" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn" disabled={submitting} onClick={submit}>Submit</button>
        </div>
      </div>

      {/* Current Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold">Current Status</div>
        {!pettyCode && (<div className="mt-2 text-sm text-slate-500">Select a petty cash account to view status</div>)}
        {pettyCode && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <div className="text-slate-500">Petty Cash Account</div>
              <div>{pettyAccountName || pettyCode}</div>
            </div>
            <div>
              <div className="text-slate-500">Responsible</div>
              <div>{status?.account?.responsibleStaff || '-'}</div>
            </div>
            <div>
              <div className="text-slate-500">Current Balance</div>
              <div className="font-semibold">{formatPKR(status?.balance || 0)}</div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
