import { useEffect, useState } from 'react'
import Pharmacy_StaffEarningsDialog from '../../components/pharmacy/pharmacy_StaffEarningsDialog'
import { pharmacyApi } from '../../utils/api'

export default function Pharmacy_StaffEarnings(){
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0,7))
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([])
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      setLoading(true)
      try{
        const res: any = await pharmacyApi.listStaff({ page: 1, limit: 1000 })
        if (!mounted) return
        const items = (res?.items ?? res ?? []) as any[]
        const mapped = items.map(s => ({ id: String(s._id), name: String(s.name || '') })).filter(s => s.id && s.name)
        setStaff(mapped)
      } catch(e){
        console.error(e)
        setStaff([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  const openFor = (s: { id: string; name: string }) => {
    setSelected(s)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-xl font-bold text-slate-800">Staff Earnings</div>
        <div>
          <label className="mb-1 block text-sm text-slate-700">Month</label>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {staff.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">
                  <button type="button" onClick={()=>openFor(s)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700">Manage Earnings</button>
                </td>
              </tr>
            ))}
            {staff.length===0 && (
              <tr><td colSpan={2} className="px-4 py-10 text-center text-slate-500">{loading ? 'Loading...' : 'No staff records'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Pharmacy_StaffEarningsDialog
          open={open}
          onClose={()=>{ setOpen(false); setSelected(null) }}
          staff={selected}
          month={month}
        />
      )}
    </div>
  )
}
