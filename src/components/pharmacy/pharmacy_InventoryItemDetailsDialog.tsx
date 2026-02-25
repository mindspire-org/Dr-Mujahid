import { useEffect, useState } from 'react'
import { pharmacyApi } from '../../utils/api'

type Props = {
  open: boolean
  onClose: ()=>void
  itemKey: string
}

export default function Pharmacy_InventoryItemDetailsDialog({ open, onClose, itemKey }: Props){
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [data, setData] = useState<any>(null)

  useEffect(()=>{
    let mounted = true
    if (!open || !itemKey){ setData(null); setErr(''); return }
    ;(async()=>{
      setLoading(true)
      setErr('')
      try {
        const res: any = await (pharmacyApi as any).inventoryItemDetails(itemKey)
        if (!mounted) return
        setData(res)
      } catch (e) {
        console.error(e)
        if (!mounted) return
        setErr('Failed to load details')
        setData(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  }, [open, itemKey])

  if (!open) return null

  const item = data?.item || null
  const purchase = data?.purchase || null
  const line = data?.line || null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-800">Item Details</div>
            <div className="text-xs text-slate-500">{item?.name || itemKey}</div>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">×</button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          {loading && (
            <div className="text-sm text-slate-500">Loading...</div>
          )}
          {!loading && err && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
          )}

          {!loading && !err && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-800">Inventory Snapshot</div>
                  <div className="grid gap-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Medicine</span><span className="font-medium">{item?.name || '-'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Generic</span><span>{item?.genericName || '-'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Category</span><span>{item?.category || '-'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">On Hand</span><span>{Number(item?.onHand || 0)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Units/Pack</span><span>{Number(item?.unitsPerPack || 1)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Last Expiry</span><span>{String(item?.lastExpiry || '-').slice(0,10)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Min Stock</span><span>{item?.minStock ?? '-'}</span></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-800">Last Invoice (Saved Form Data)</div>
                  {purchase ? (
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Invoice</span><span className="font-medium">{purchase.invoice || '-'}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Date</span><span>{String(purchase.date || '-').slice(0,10)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Supplier</span><span>{purchase.supplierName || '-'}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Company</span><span>{purchase.companyName || '-'}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Total</span><span>PKR {Number(purchase.totalAmount || purchase?.totals?.net || 0).toLocaleString()}</span></div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No invoice details found for this item yet.</div>
                  )}
                </div>
              </div>

              {line && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-800">Line Details (from that invoice)</div>
                  <div className="grid gap-3 md:grid-cols-3 text-sm">
                    <div><div className="text-xs text-slate-500">Packs</div><div className="font-medium text-slate-800">{line.packs ?? '-'}</div></div>
                    <div><div className="text-xs text-slate-500">Total Items</div><div className="font-medium text-slate-800">{line.totalItems ?? '-'}</div></div>
                    <div><div className="text-xs text-slate-500">Units/Pack</div><div className="font-medium text-slate-800">{line.unitsPerPack ?? '-'}</div></div>
                    <div><div className="text-xs text-slate-500">Buy / Pack</div><div className="font-medium text-slate-800">PKR {Number(line.buyPerPack || 0).toLocaleString()}</div></div>
                    <div><div className="text-xs text-slate-500">Buy / Unit</div><div className="font-medium text-slate-800">PKR {Number(line.buyPerUnit || 0).toLocaleString()}</div></div>
                    <div><div className="text-xs text-slate-500">Sale / Pack</div><div className="font-medium text-slate-800">PKR {Number(line.salePerPack || 0).toLocaleString()}</div></div>
                    <div><div className="text-xs text-slate-500">Expiry</div><div className="font-medium text-slate-800">{String(line.expiry || '-').slice(0,10)}</div></div>
                    <div><div className="text-xs text-slate-500">Category</div><div className="font-medium text-slate-800">{line.category || '-'}</div></div>
                    <div><div className="text-xs text-slate-500">Min Stock</div><div className="font-medium text-slate-800">{line.minStock ?? '-'}</div></div>
                  </div>
                </div>
              )}

              {purchase?.totals && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-800">Invoice Totals</div>
                  <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Gross</span><span>PKR {Number(purchase.totals.gross || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Discount</span><span>PKR {Number(purchase.totals.discount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Taxable</span><span>PKR {Number(purchase.totals.taxable || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Line Taxes</span><span>PKR {Number(purchase.totals.lineTaxes || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Invoice Taxes</span><span>PKR {Number(purchase.totals.invoiceTaxes || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Net</span><span className="font-semibold">PKR {Number(purchase.totals.net || 0).toLocaleString()}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="btn-outline-navy">Close</button>
        </div>
      </div>
    </div>
  )
}
