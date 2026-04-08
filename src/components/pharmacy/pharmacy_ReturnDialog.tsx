import { useEffect, useMemo, useState } from 'react'
import { pharmacyApi, hospitalApi } from '../../utils/api'

type SaleLine = { medicineId?: string; name: string; unitPrice: number; qty: number }
type Sale = {
  billNo: string
  datetime: string
  customer?: string
  payment: 'Cash' | 'Card' | 'Credit'
  discountPct?: number
  lines: SaleLine[]
  accountCode?: string  // from the original sale
}

type Props = {
  open: boolean
  onClose: () => void
  sale: Sale | null
  onSubmitted: (payload: { sale: any; returnDoc: any }) => void
}

export default function Pharmacy_ReturnDialog({ open, onClose, sale, onSubmitted }: Props) {
  const [qtys, setQtys] = useState<Record<number, string>>({})
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [busy, setBusy] = useState(false)

  const discountPct = Number(sale?.discountPct || 0)
  const discMultiplier = (100 - discountPct) / 100

  // Load pay-to accounts and pre-select the one from the original sale
  useEffect(() => {
    if (!open) return
    setQtys({})
    setBusy(false)
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
          // Pre-select the account from the original sale
          const saleAccount = String(sale?.accountCode || '').trim().toUpperCase()
          setSelectedAccount(saleAccount || myCode || '')
        }
      } catch {
        if (mounted) setPayToAccounts([])
      }
    })()
    return () => { mounted = false }
  }, [open, sale?.billNo])

  const calc = useMemo(() => {
    if (!sale) return { lines: [], subtotal: 0, total: 0 }
    const lines = sale.lines.map((l, idx) => {
      const rq = Math.max(0, Math.min(parseInt(qtys[idx] || '0') || 0, Number(l.qty || 0)))
      const amt = Number(l.unitPrice || 0) * rq * discMultiplier
      return { idx, name: l.name, unitPrice: Number(l.unitPrice || 0), soldQty: Number(l.qty || 0), returnQty: rq, amount: Math.round(amt * 100) / 100, medicineId: l.medicineId }
    })
    const subtotal = lines.reduce((s, x) => s + x.amount, 0)
    return { lines, subtotal: Math.round(subtotal * 100) / 100, total: Math.round(subtotal * 100) / 100 }
  }, [sale, qtys, discMultiplier])

  async function submit() {
    if (!sale) return
    const retLines = calc.lines.filter(x => x.returnQty > 0).map(x => {
      const base: any = { name: x.name, qty: x.returnQty, amount: x.amount }
      if (x.medicineId) base.medicineId = x.medicineId
      return base
    })
    if (!retLines.length) { onClose(); return }

    // Read username same way as POS
    let createdBy = ''
    try { const raw = localStorage.getItem('pharmacy.user'); if (raw) { const u = JSON.parse(raw); if (u?.username) createdBy = String(u.username) } } catch {}
    if (!createdBy) { try { createdBy = localStorage.getItem('pharma_user') || '' } catch {} }
    if (!createdBy) { try { const s = localStorage.getItem('hospital.session'); if (s) { const u = JSON.parse(s); if (u?.username) createdBy = String(u.username) } } catch {} }

    setBusy(true)
    try {
      const body: any = {
        type: 'Customer',
        datetime: new Date().toISOString(),
        reference: sale.billNo,
        party: sale.customer || 'Walk-in',
        lines: retLines,
        accountCode: selectedAccount || undefined,
        createdBy: createdBy || undefined,
      }
      const res = await pharmacyApi.createReturn(body)
      const retDoc = res?.return || res
      onSubmitted({ sale: res?.sale || null, returnDoc: retDoc })
      try { window.dispatchEvent(new CustomEvent('pharmacy:return', { detail: { reference: sale.billNo } })) } catch {}
    } finally {
      setBusy(false)
    }
  }

  if (!open || !sale) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="font-medium">Return Items — {sale.billNo}</div>
          <div className="flex items-center gap-2">
            <button onClick={submit} disabled={busy} className="btn disabled:opacity-50">{busy ? 'Saving...' : 'Save'}</button>
            <button onClick={onClose} className="btn-outline-navy">Close</button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-4 space-y-4">
          <div className="text-sm text-slate-700">Customer: {sale.customer || 'Walk-in'} · Payment: {sale.payment} · Discount: {discountPct}%</div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Sold Qty</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Return Qty</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {calc.lines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2">{l.soldQty}</td>
                    <td className="px-3 py-2">{l.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <input value={qtys[idx] || ''} onChange={e => setQtys(p => ({ ...p, [idx]: e.target.value.replace(/[^0-9]/g, '') }))} className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="0" />
                    </td>
                    <td className="px-3 py-2 text-right">Rs {l.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-3 py-2 font-medium" colSpan={4}>Total</td>
                  <td className="px-3 py-2 text-right font-semibold">Rs {calc.total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Account receiver — pre-selected from original sale, mirrors hospital return dialog */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">Return Account</div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Account (Receiver of Debit)</label>
              <input
                value={(() => {
                  if (!selectedAccount) return '-'
                  const found = payToAccounts.find(a => a.code === selectedAccount)
                  return found ? found.label : selectedAccount
                })()}
                readOnly
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
              <p className="mt-1 text-xs text-slate-500">Account from the original sale. A debit transaction (pharmacy_return) will be posted to this account.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
