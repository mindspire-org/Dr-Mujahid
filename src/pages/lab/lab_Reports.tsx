import { useEffect, useState } from 'react'
import { labApi } from '../../utils/api'

export default function Lab_Reports() {
  const today = new Date()
  const lastWeek = new Date(today.getTime() - 6*24*60*60*1000)
  const iso = (d: Date)=> d.toISOString().slice(0,10)
  const [from, setFrom] = useState(iso(lastWeek))
  const [to, setTo] = useState(iso(today))
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>({})
  const [dailyRevenue, setDailyRevenue] = useState<Array<{ date: string; value: number }>>([])
  const [comparison, setComparison] = useState<Array<{ label: string; value: number }>>([])
  const [invStats, setInvStats] = useState<any>(null)

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      setLoading(true)
      try{
        const [res, inv]: any = await Promise.all([
          labApi.reportsSummary({ from, to }),
          labApi.inventorySummary({ limit: 1 }),
        ])
        if (!mounted) return
        setSummary(res || {})
        setDailyRevenue(res?.dailyRevenue || [])
        setComparison(res?.comparison || [])
        setInvStats(inv?.stats || null)
      }catch(e){ console.error(e); setSummary({}); setDailyRevenue([]); setComparison([]); setInvStats(null) }
      finally { setLoading(false) }
    })()
    return ()=>{ mounted = false }
  }, [tick])

  const maxRev = Math.max(...dailyRevenue.map(d => d.value), 1)
  const maxComp = Math.max(...comparison.map(d => d.value), 1)

  const apply = () => setTick(t => t + 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-slate-800">Lab Summary Report</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700">From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={apply} className="btn">Apply</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="Total Tests" value={loading? '…' : `${summary.totalTests||0}`} bg="bg-sky-50" border="border-sky-200" />
        <SummaryCard title="Total Purchase Amount" value={loading? '…' : `PKR ${(summary.totalPurchasesAmount||0).toLocaleString()}`} bg="bg-emerald-50" border="border-emerald-200" />
        <SummaryCard title="Total Expenses" value={loading? '…' : `PKR ${(summary.totalExpenses||0).toLocaleString()}`} bg="bg-rose-50" border="border-rose-200" />
        <SummaryCard title="Total Revenue" value={loading? '…' : `PKR ${(summary.totalRevenue||0).toLocaleString()}`} bg="bg-indigo-50" border="border-indigo-200" />
        <SummaryCard title="Pending Results" value={loading? '…' : `${summary.pendingResults||0}`} bg="bg-cyan-50" border="border-cyan-200" />
        <SummaryCard title="Stock Value" value={loading? '…' : `PKR ${(invStats?.stockSaleValue||0).toLocaleString()}`} bg="bg-amber-50" border="border-amber-200" />
        <SummaryCard title="Low Stock Items" value={loading? '…' : `${invStats?.lowStockCount||0}`} bg="bg-amber-50" border="border-amber-200" />
        <SummaryCard title="Expiring Soon" value={loading? '…' : `${invStats?.expiringSoonCount||0}`} bg="bg-amber-50" border="border-amber-200" />
        <SummaryCard title="Out of Stock" value={loading? '…' : `${invStats?.outOfStockCount||0}`} bg="bg-rose-50" border="border-rose-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 font-medium text-slate-800">Daily Revenue</div>
          <div className="h-48 w-full rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="flex h-full items-end gap-3">
              {dailyRevenue.map(d => (
                <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end">
                  <div
                    className="mx-auto w-6 rounded-t-md bg-sky-500"
                    style={{ height: `${Math.max(8, (d.value/maxRev)*100)}%` }}
                    title={`${d.date.slice(0,10)} — PKR ${d.value.toLocaleString()}`}
                  />
                  <div className="mt-2 text-center text-xs text-slate-600">{d.date.slice(0,10)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 font-medium text-slate-800">Comparison: Revenue, Expenses, Purchases</div>
          <div className="h-48 w-full rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="flex h-full items-end gap-6 justify-center">
              {comparison.map(d => (
                <div key={d.label} className="text-center h-full flex flex-col justify-end">
                  <div
                    className="mx-auto w-10 rounded-t-md bg-emerald-500"
                    style={{ height: `${Math.max(8, (d.value/maxComp)*100)}%` }}
                    title={`${d.label} — PKR ${d.value.toLocaleString()}`}
                  />
                  <div className="mt-2 text-xs text-slate-600">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, bg, border }: { title: string; value: string; bg: string; border: string }) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4`}>
      <div className="text-xs font-medium text-slate-600">{title}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}
