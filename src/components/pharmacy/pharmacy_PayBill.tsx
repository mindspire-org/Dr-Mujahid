import { useEffect, useMemo, useRef, useState } from 'react'
import type { Customer } from './pharmacy_AddCustomer'
import { pharmacyApi } from '../../utils/api'

type Props = {
  open: boolean
  onClose: () => void
  customer: Customer | null
}

export default function Pharmacy_PayBill({ open, onClose, customer }: Props) {
  const [receipts, setReceipts] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [amount, setAmount] = useState<string>('')
  const [payBySale, setPayBySale] = useState<Record<string, string>>({})
  const [note, setNote] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToast({ type, message })
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3000)
  }

  const getSaleId = (p: any) => {
    const raw = (p && (p.saleId ?? p.sale ?? p.sale_id)) as any
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object') return String(raw._id || raw.id || '')
    return String(raw || '')
  }

  useEffect(() => {
    let mounted = true
    if (!open || !customer?.id) { setReceipts([]); setPayments([]); setExpanded({}); return }
    ;(async () => {
      try {
        setLoading(true)
        const [res, payRes] = await Promise.all([
          pharmacyApi.listSales({ customerId: customer.id, payment: 'Credit', limit: 200 }),
          pharmacyApi.listCustomerPayments(customer.id, { limit: 500 }),
        ])
        if (!mounted) return
        const items = res.items || []
        setReceipts(items)
        setPayments(payRes?.items || [])
        const init: Record<string, boolean> = {}
        for (const s of items) init[s._id] = false
        setExpanded(init)
        const pinit: Record<string, string> = {}
        for (const s of items) pinit[s._id] = ''
        setPayBySale(pinit)
      } catch {
        setReceipts([])
        setPayments([])
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [open, customer?.id])

  useEffect(() => {
    if (!open) return
    setAmount('')
    setPayBySale({})
    setNote('')
    setSaving(false)
  }, [open, customer?.id])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [])

  const paidMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of payments || []) {
      const sid = getSaleId(p)
      if (!sid) continue
      const prev = Number(m.get(sid) || 0)
      m.set(sid, Number((prev + Number(p.amount || 0)).toFixed(2)))
    }
    return m
  }, [payments])

  const anyPay = (() => {
    const general = Number(amount || 0)
    if (general > 0) return true
    for (const k of Object.keys(payBySale || {})) {
      if (Number(payBySale[k] || 0) > 0) return true
    }
    return false
  })()

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white p-0 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-800">Pay Bill</h3>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">×</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
          <div>
            <div className="mb-2 text-slate-700">Receipts {customer ? `· ${customer.name}` : ''}</div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="w-full overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    {['Bill No','Date','Total','Paid','Remaining','Pay this'].map(h => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">Loading...</td></tr>
                  )}
                  {!loading && receipts.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No credit receipts</td></tr>
                  )}
                  {!loading && receipts.map((s: any) => {
                    const paid = Number(paidMap.get(String(s._id)) || 0)
                    const remaining = Math.max(0, Number((Number(s.total || 0) - paid).toFixed(2)))
                    return (
                      <>
                        <tr key={s._id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <button type="button" onClick={()=> setExpanded(prev=> ({...prev, [s._id]: !prev[s._id]}))} className="rounded border border-slate-200 px-2 py-0.5 text-xs mr-2">
                              {expanded[s._id] ? 'Hide' : 'View'} items
                            </button>
                            {s.billNo}
                          </td>
                          <td className="px-3 py-2">{new Date(s.datetime).toLocaleDateString()}</td>
                          <td className="px-3 py-2">Rs {Number(s.total||0).toFixed(2)}</td>
                          <td className="px-3 py-2">Rs {paid.toFixed(2)}</td>
                          <td className="px-3 py-2">Rs {remaining.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={payBySale[String(s._id)] || ''}
                              onChange={e => {
                                const v = e.target.value
                                setPayBySale(prev => ({ ...prev, [String(s._id)]: v }))
                              }}
                              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                        {expanded[s._id] && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50 px-3 py-2">
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-slate-600">
                                      <th className="px-2 py-1">Item</th>
                                      <th className="px-2 py-1">Qty</th>
                                      <th className="px-2 py-1">Price</th>
                                      <th className="px-2 py-1">Line Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(s.lines||[]).map((l:any, idx:number)=> (
                                      <tr key={idx} className="border-t border-slate-200">
                                        <td className="px-2 py-1">{l.name}</td>
                                        <td className="px-2 py-1">{l.qty}</td>
                                        <td className="px-2 py-1">Rs {Number(l.unitPrice||0).toFixed(2)}</td>
                                        <td className="px-2 py-1">Rs {Number((l.unitPrice||0)*(l.qty||0)).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-slate-700">Payments</div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    {['Date','Bill','Amount','Note'].map(h => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {(payments || []).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">No payments</td></tr>
                  )}
                  {(payments || []).map((p: any) => (
                    <tr key={String(p._id)}>
                      <td className="px-3 py-2">{new Date(String(p.date || p.createdAt || '')).toLocaleString()}</td>
                      <td className="px-3 py-2">{p.saleId ? String(receipts.find(r => String(r._id) === String(p.saleId))?.billNo || p.saleId) : '-'}</td>
                      <td className="px-3 py-2">Rs {Number(p.amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">{String(p.note || '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-slate-700">Notes</label>
            <textarea value={note} onChange={e=> setNote(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Add notes (optional)" rows={3} />
          </div>
          <div>
            <label className="mb-1 block text-slate-700">Amount (General payment)</label>
            <input value={amount} onChange={e=> setAmount(e.target.value)} type="number" min={0} step={0.01} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Enter amount" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            className="btn disabled:opacity-60"
            disabled={saving || !customer?.id || !anyPay}
            onClick={async()=>{
              if (!customer?.id) return
              try {
                setSaving(true)
                const tasks: Promise<any>[] = []
                const optimistic: any[] = []
                const now = new Date().toISOString()
                for (const s of receipts) {
                  const sid = String(s._id)
                  const v = Number(payBySale[sid] || 0)
                  if (v > 0) {
                    tasks.push(pharmacyApi.recordCustomerPayment(customer.id, { amount: v, saleId: sid, note: note || undefined }))
                    optimistic.push({ _id: `tmp-${crypto.randomUUID()}`, customerId: customer.id, saleId: sid, amount: v, note: note || undefined, date: now, createdAt: now })
                  }
                }
                const general = Number(amount || 0)
                if (general > 0) {
                  tasks.push(pharmacyApi.recordCustomerPayment(customer.id, { amount: general, note: note || undefined }))
                  optimistic.push({ _id: `tmp-${crypto.randomUUID()}`, customerId: customer.id, amount: general, note: note || undefined, date: now, createdAt: now })
                }
                if (!tasks.length) { setSaving(false); return }
                await Promise.all(tasks)

                if (optimistic.length) {
                  setPayments(prev => [...optimistic, ...(prev || [])])
                }

                showToast('success', 'Payment recorded')
                try {
                  window.dispatchEvent(new CustomEvent('pharmacy:customer-payment', { detail: { customerId: customer.id } }))
                } catch {}

                const [res, payRes] = await Promise.all([
                  pharmacyApi.listSales({ customerId: customer.id, payment: 'Credit', limit: 200 }),
                  pharmacyApi.listCustomerPayments(customer.id, { limit: 500 }),
                ])
                const nextReceipts = res.items || []
                const nextPayments = payRes?.items || []
                setReceipts(nextReceipts)
                setPayments(nextPayments)
                setExpanded(() => {
                  const init: Record<string, boolean> = {}
                  for (const s of nextReceipts) init[String(s._id)] = false
                  return init
                })
                setPayBySale(() => {
                  const pinit: Record<string, string> = {}
                  for (const s of nextReceipts) pinit[String(s._id)] = ''
                  return pinit
                })
                setAmount('')
              } catch (e) {
                console.error(e)
                showToast('error', 'Failed to record payment')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
          <button onClick={onClose} className="btn-outline-navy">Cancel</button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60]">
          <div
            className={`rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ${toast.type === 'success'
              ? 'bg-emerald-600 text-white ring-emerald-700/40'
              : 'bg-rose-600 text-white ring-rose-700/40'
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}
