import { useEffect, useState, useRef } from 'react'
import type { Customer } from './pharmacy_AddCustomer'
import { pharmacyApi } from '../../utils/api'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (data: { method: 'cash' | 'credit'; discountPct: number; customer?: string; customerId?: string }) => void
}

export default function Pharmacy_ProcessPaymentDialog({ open, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<'cash' | 'credit'>('cash')
  const [discountPct, setDiscountPct] = useState<number>(0)
  const [form, setForm] = useState<{ name: string; phone: string; address: string; cnic: string; mrNumber: string }>({ name: '', phone: '', address: '', cnic: '', mrNumber: '' })
  const [suggestions, setSuggestions] = useState<Customer[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const discountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const q = (form.cnic || '').trim() || (form.mrNumber || '').trim() || (form.phone || '').trim()
    if (!q || q.length < 3) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const res: any = await pharmacyApi.listCustomers({ q })
        const items: Customer[] = (res.items || []).map((it: any) => ({
          id: it._id || '',
          name: it.name || '',
          company: it.company || '',
          phone: it.phone || '',
          address: it.address || '',
          cnic: it.cnic || '',
          mrNumber: it.mrNumber || '',
        }))
        setSuggestions(items)
        if (items.length === 1) {
          const c = items[0]
          setForm({ name: c.name || '', phone: c.phone || '', address: c.address || '', cnic: c.cnic || '', mrNumber: c.mrNumber || '' })
          setSelectedId(c.id)
        }
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [form.cnic, form.mrNumber, form.phone, open])

  useEffect(() => {
    if (!open) return
    setMethod('cash')
    setDiscountPct(0)
    setForm({ name: '', phone: '', address: '', cnic: '', mrNumber: '' })
    setSuggestions([])
    setSelectedId('')
    const t = setTimeout(() => {
      try {
        discountRef.current?.focus()
        discountRef.current?.select()
      } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const customer = method === 'credit' ? (form.name || form.phone || form.cnic || form.mrNumber || undefined) : undefined
    const customerId = method === 'credit' ? (selectedId || undefined) : undefined
    onConfirm({ method, discountPct: Number(discountPct) || 0, customer, customerId })
  }

  const pick = (c: Customer) => {
    setForm({ name: c.name || '', phone: c.phone || '', address: c.address || '', cnic: c.cnic || '', mrNumber: c.mrNumber || '' })
    setSuggestions([])
    setSelectedId(c.id)
  }

  const showCredit = method === 'credit'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={confirm} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">Process Payment</h3>
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={()=> setMethod('cash')} className={`flex-1 rounded-md border px-3 py-2 text-center text-sm ${method==='cash' ? 'border-navy bg-navy text-white' : 'border-slate-300'}`}>Cash</button>
            <button type="button" onClick={()=> setMethod('credit')} className={`flex-1 rounded-md border px-3 py-2 text-center text-sm ${method==='credit' ? 'border-navy bg-navy text-white' : 'border-slate-300'}`}>Credit</button>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-700">Discount (%)</label>
            <input ref={discountRef} value={discountPct} onChange={e=> setDiscountPct(parseFloat(e.target.value)||0)} type="number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          {showCredit ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Customer Name</label>
                <input value={form.name} onChange={e=> setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Phone Number</label>
                <input value={form.phone} onChange={e=> setForm({ ...form, phone: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Address</label>
                <textarea rows={3} value={form.address} onChange={e=> setForm({ ...form, address: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">CNIC</label>
                <input value={form.cnic} onChange={e=> setForm({ ...form, cnic: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">MR #</label>
                <input value={form.mrNumber} onChange={e=> setForm({ ...form, mrNumber: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              {suggestions.length > 1 && (
                <div className="rounded-md border border-slate-200 bg-slate-50">
                  {suggestions.slice(0,5).map(c => (
                    <button type="button" key={c.id} onClick={()=> pick(c)} className="block w-full px-3 py-2 text-left text-sm hover:bg-white">
                      {c.name} {c.phone? `· ${c.phone}`:''} {c.cnic? `· ${c.cnic}`:''} {c.mrNumber? `· ${c.mrNumber}`:''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm text-slate-700">Customer Name (optional)</label>
              <input value={form.name} onChange={e=> setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
          <button type="submit" className="btn">Confirm Payment</button>
        </div>
      </form>
    </div>
  )
}
