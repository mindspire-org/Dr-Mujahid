import { useEffect, useMemo, useState } from 'react'
import { pharmacyApi } from '../../utils/api'

export default function Pharmacy_PurchaseDrafts(){
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [err, setErr] = useState<string>('')

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const res: any = await pharmacyApi.listPurchaseDrafts({
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        company: company || undefined,
        limit: 200,
      })
      setItems(res?.items ?? res ?? [])
    } catch (e: any) {
      setItems([])
      setErr('Failed to load')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    return (items || []).map((d: any) => {
      const l = (d?.lines && d.lines[0]) || null
      return {
        id: String(d?._id || ''),
        date: String(d?.date || d?.createdAtIso || ''),
        invoice: String(d?.invoice || '-'),
        supplier: String(d?.supplierName || '-'),
        company: String(d?.companyName || d?.company || ''),
        firstItem: l ? String(l?.name || '-') : '-',
        linesCount: Array.isArray(d?.lines) ? d.lines.length : 0,
        total: Number(d?.totalAmount || d?.totals?.net || 0),
        status: String(d?.status || 'Pending'),
      }
    })
  }, [items])

  const approve = async (id: string) => {
    if (!id) return
    try {
      await pharmacyApi.approvePurchaseDraft(id)
      await load()
    } catch (e) {
      console.error(e)
      alert('Failed to approve')
    }
  }

  const remove = async (id: string) => {
    if (!id) return
    try {
      await pharmacyApi.deletePurchaseDraft(id)
      await load()
    } catch (e) {
      console.error(e)
      alert('Failed to delete')
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xl font-bold text-slate-800">Purchase Drafts</div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="invoice, supplier, item" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Company</label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="optional" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-3">
          <button type="button" onClick={load} className="btn disabled:opacity-60" disabled={loading}>{loading ? 'Loading...' : 'Apply'}</button>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Invoice</th>
              <th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-4 py-2 font-medium">First Item</th>
              <th className="px-4 py-2 font-medium">Lines</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-2">{r.date ? String(r.date).slice(0,10) : '-'}</td>
                <td className="px-4 py-2">{r.invoice}</td>
                <td className="px-4 py-2">{r.supplier}</td>
                <td className="px-4 py-2">{r.firstItem}</td>
                <td className="px-4 py-2">{r.linesCount}</td>
                <td className="px-4 py-2">PKR {Number(r.total||0).toLocaleString()}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>approve(r.id)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Approve</button>
                    <button type="button" onClick={()=>remove(r.id)} className="rounded-md bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">{loading ? 'Loading...' : 'No drafts'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
