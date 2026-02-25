import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pharmacyApi } from '../../utils/api'

export default function Pharmacy_HoldSales(){
  const navigate = useNavigate()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const res: any = await pharmacyApi.listHoldSales()
      setItems(res?.items ?? res ?? [])
    } catch (e) {
      console.error(e)
      setErr('Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    try {
      await pharmacyApi.deleteHoldSale(id)
      await load()
    } catch (e) {
      console.error(e)
      alert('Failed to delete')
    }
  }

  const restoreToPOS = async (id: string) => {
    try {
      const doc: any = await pharmacyApi.getHoldSale(id)
      try { sessionStorage.setItem('pharmacy.hold-sale.restore', JSON.stringify(doc || {})) } catch {}
      try { await pharmacyApi.deleteHoldSale(id) } catch {}
      navigate('/pharmacy/pos')
    } catch (e) {
      console.error(e)
      alert('Failed to restore')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold text-slate-800">Hold Sales</div>
        <button type="button" onClick={load} className="btn-outline-navy disabled:opacity-60" disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
      </div>

      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="w-full overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">By</th>
              <th className="px-4 py-2 font-medium">Medicine</th>
              <th className="px-4 py-2 font-medium">Qty (each)</th>
              <th className="px-4 py-2 font-medium">Lines</th>
              <th className="px-4 py-2 font-medium">Discount</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {(items || []).map((it: any) => (
              (() => {
                const meds = (it?.lines || []).map((l: any) => String(l?.name || '')).filter(Boolean)
                const qtyEach = (it?.lines || []).map((l: any) => String(l?.qty ?? '')).filter(Boolean)
                return (
              <tr key={String(it._id)} className="hover:bg-slate-50/50">
                <td className="px-4 py-2">{String(it.createdAtIso || it.createdAt || '').slice(0,19).replace('T',' ') || '-'}</td>
                <td className="px-4 py-2">{String(it.createdBy || '-') }</td>
                <td className="px-4 py-2">{meds.join(', ') || '-'}</td>
                <td className="px-4 py-2">{qtyEach.join(', ') || '-'}</td>
                <td className="px-4 py-2">{Array.isArray(it.lines) ? it.lines.length : 0}</td>
                <td className="px-4 py-2">{Number(it.billDiscountPct || 0)}%</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>restoreToPOS(String(it._id))} className="rounded-md bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-700">Restore to POS</button>
                    <button type="button" onClick={()=>remove(String(it._id))} className="rounded-md bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">Delete</button>
                  </div>
                </td>
              </tr>
                )
              })()
            ))}
            {(items || []).length===0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">{loading ? 'Loading...' : 'No held bills'}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="text-xs text-slate-500">Note: Restoring sends the held bill back to POS.</div>
    </div>
  )
}
