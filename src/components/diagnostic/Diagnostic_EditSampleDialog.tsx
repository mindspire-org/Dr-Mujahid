import { useEffect, useMemo, useState } from 'react'
import { diagnosticApi } from '../../utils/api'

export type EditSamplePayload = {
  tests?: string[]
  patient?: {
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
  subtotal?: number
  discount?: number
  discountInput?: number
  discountType?: 'PKR' | '%'
  net?: number
  amountReceived?: number
  paidForToday?: number
}

export default function Diagnostic_EditSampleDialog({
  open,
  onClose,
  order,
  onSaved,
}: {
  open: boolean
  onClose: ()=>void
  order: { id: string; patient: any; tests: string[] }
  onSaved: (updated: any)=>void
}){
  const [loading, setLoading] = useState(false)
  const [tests, setTests] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [selected, setSelected] = useState<string[]>(order.tests || [])

  const [fullName, setFullName] = useState(order.patient?.fullName || '')
  const [phone, setPhone] = useState(order.patient?.phone || '')
  const [mrn, setMrn] = useState(order.patient?.mrn || '')
  const [cnic, setCnic] = useState(order.patient?.cnic || '')
  const [guardianName, setGuardianName] = useState(order.patient?.guardianName || '')
  const [address, setAddress] = useState(order.patient?.address || '')
  const [discountInput, setDiscountInput] = useState<number>((order as any)?.discountInput || (order as any)?.discount || 0)
  const [discountType, setDiscountType] = useState<'PKR' | '%'>((order as any)?.discountType || 'PKR')

  useEffect(()=>{ (async()=>{
    try { const res = await diagnosticApi.listTests({ limit: 1000 }) as any; setTests((res?.items||res||[]).map((t:any)=>({ id: String(t._id||t.id), name: t.name, price: Number(t.price||0) })))} catch { setTests([]) }
  })() }, [])

  useEffect(()=>{ setSelected(order.tests||[]) }, [order.id])

  useEffect(()=>{
    const savedType = (order as any)?.discountType || 'PKR'
    setDiscountType(savedType)
    // For PKR: use stored discount amount directly
    // For %: use stored discountInput (original percentage) or recalculate from discount/subtotal
    if (savedType === '%') {
      const savedInput = (order as any)?.discountInput
      if (savedInput != null && savedInput !== 0) {
        setDiscountInput(savedInput)
      } else {
        // Recalculate percentage from stored discount amount and subtotal
        const savedDiscount = (order as any)?.discount || 0
        const savedSubtotal = (order as any)?.subtotal || 0
        if (savedSubtotal > 0) {
          setDiscountInput(Math.round((savedDiscount / savedSubtotal) * 100))
        } else {
          setDiscountInput(0)
        }
      }
    } else {
      setDiscountInput((order as any)?.discount || 0)
    }
  }, [order.id])

  const priceMap = useMemo(()=> Object.fromEntries(tests.map(t=>[t.id, Number(t.price||0)])), [tests])
  const subtotal = useMemo(()=> selected.reduce((s,id)=> s + Number(priceMap[id]||0), 0), [selected, priceMap])
  const discountAmount = useMemo(()=> {
    if (discountType === '%') {
      return Math.round(subtotal * (Number(discountInput||0) / 100))
    }
    return Math.max(0, Number(discountInput||0))
  }, [subtotal, discountInput, discountType])
  const net = Math.max(0, subtotal - discountAmount)

  async function save(){
    if (loading) return
    setLoading(true)
    try {
      const payload: EditSamplePayload = {
        tests: selected,
        patient: {
          mrn: mrn || undefined,
          fullName: fullName || undefined,
          phone: phone || undefined,
          address: address || undefined,
          guardianName: guardianName || undefined,
          cnic: cnic || undefined,
        },
        subtotal,
        discount: discountAmount,
        discountInput: discountInput,
        discountType,
        net,
        amountReceived: net,
        paidForToday: net,
      }
      const updated = await diagnosticApi.updateOrder(order.id, payload)
      onSaved(updated)
      onClose()
    } catch (e) {
      alert('Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-lg font-semibold text-slate-800">Edit Sample</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-600">Patient Name</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Phone</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">MR Number</label>
            <input value={mrn} disabled readOnly className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">CNIC</label>
            <input value={cnic} onChange={e=>setCnic(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-600">Guardian Name</label>
            <input value={guardianName} onChange={e=>setGuardianName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-600">Address</label>
            <input value={address} onChange={e=>setAddress(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold text-slate-800">Tests</div>
          <div className="flex flex-wrap gap-2">
            {tests.map(t => {
              const active = selected.includes(t.id)
              return (
                <button key={t.id} onClick={()=> setSelected(prev => active ? prev.filter(x=>x!==t.id) : [...prev, t.id])} className={`rounded-md border px-2 py-1 text-xs ${active? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {t.name} · PKR {t.price.toLocaleString()}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-slate-600">Subtotal</div>
            <div className="text-lg font-semibold">PKR {subtotal.toLocaleString()}</div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-slate-600">Discount</div>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={discountInput} onChange={e=> setDiscountInput(Number(e.target.value||0))} className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right" />
              <select value={discountType} onChange={e=> setDiscountType(e.target.value as 'PKR' | '%')} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                <option value="PKR">PKR</option>
                <option value="%">%</option>
              </select>
            </div>
            {discountType === '%' && (
              <div className="text-xs text-slate-500 mt-1">PKR {discountAmount.toLocaleString()}</div>
            )}
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-slate-600">Net</div>
            <div className="text-lg font-semibold">PKR {net.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={save} disabled={loading || selected.length===0 || !fullName} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{loading? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}
