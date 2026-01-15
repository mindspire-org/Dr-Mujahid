import { Plus, Minus } from 'lucide-react'

type Product = {
  id: string
  name: string
  genericName?: string
  unitPrice: number
}

type CartLine = {
  id: string
  productId: string
  qty: number
}

type Props = {
  cart: CartLine[]
  products: Product[]
  onInc: (id: string) => void
  onDec: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  onSetQty: (id: string, qty: number) => void
  onQtyEnter?: () => void
}

export default function Pharmacy_POSCart({ cart, products, onInc, onDec, onRemove, onClear, onSetQty, onQtyEnter }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="font-medium text-slate-800">Shopping Cart ({cart.length})</div>
        <button onClick={onClear} className="btn-outline-navy text-xs">Clear Cart</button>
      </div>
      <div className="divide-y divide-slate-200">
        {cart.length === 0 && <div className="p-4 text-sm text-slate-500">No items</div>}
        {cart.map(line => {
          const p = products.find(pp => pp.id === line.productId)
          return (
            <div key={line.id} className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <div className="font-medium text-slate-800 capitalize">{p?.name || line.productId}</div>
                {p?.genericName ? <div className="text-xs text-slate-500 capitalize">{p.genericName}</div> : null}
                <div className="text-xs text-slate-500">PKR {Number(p?.unitPrice || 0).toFixed(2)} each</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onDec(line.id)} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"><Minus className="h-4 w-4" /></button>
                <input
                  id={`pharmacy-pos-qty-${line.id}`}
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={e=>{
                    const v = parseInt(e.target.value || '1', 10)
                    onSetQty(line.id, isNaN(v)? 1 : v)
                  }}
                  onKeyDown={e=>{
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      try { (e.target as HTMLInputElement).blur() } catch {}
                      onQtyEnter?.()
                    }
                  }}
                  className="h-8 w-12 rounded-md border border-slate-300 text-center text-sm"
                />
                <button onClick={() => onInc(line.id)} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
                <button onClick={() => onRemove(line.id)} className="rounded-md border border-rose-200 p-1 text-rose-600 hover:bg-rose-50">×</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
