import { useEffect, useMemo, useState } from 'react'
import { counsellingApi } from '../../utils/api'
import { DollarSign, Activity, CheckCircle, RotateCcw, Clock, Package, Bell } from 'lucide-react'

export default function Counselling_Dashboard() {
  const [tokensToday, setTokensToday] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [returnedCount, setReturnedCount] = useState(0)
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [totalPackages, setTotalPackages] = useState(0)
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [weeklyLabels, setWeeklyLabels] = useState<string[]>([])
  const [weeklyTotals, setWeeklyTotals] = useState<number[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const todayStr = useMemo(() => {
    return new Date().toISOString().slice(0, 10)
  }, [])

  const effFrom = from || todayStr
  const effTo = to || todayStr
  const isFiltered = !!(from || to)

  const from8w = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - (7 * 7))
    const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [summary, packagesPage, weeklyOrders] = await Promise.all([
          counsellingApi.getDashboardSummary({ from: effFrom, to: effTo }) as any,
          counsellingApi.listPackages({ limit: 1 }) as any,
          counsellingApi.listOrders({ from: from8w, to: todayStr, limit: 1000 }) as any,
        ])
        if (!mounted) return
        setTokensToday(Number(summary?.orders || 0))
        setTotalPackages(Number(packagesPage?.total || 0))
        setRevenueTotal(Number(summary?.revenue || 0))
        setPendingCount(Number(summary?.pending || 0))
        setCompletedCount(Number(summary?.completed || 0))
        setReturnedCount(Number(summary?.returned || 0))

        const weeklyArr = Array.isArray(weeklyOrders?.tokens) ? weeklyOrders.tokens : []
        const sorted = [...weeklyArr].sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        setRecentSales(sorted.slice(0, 5))

        const makeWeekStart = (d: Date) => {
          const dd = new Date(d); const day = dd.getDay();
          dd.setDate(dd.getDate() - day)
          dd.setHours(0, 0, 0, 0)
          return dd
        }
        const end = new Date()
        const buckets: { label: string; start: Date; total: number }[] = []
        for (let i = 7; i >= 0; i--) {
          const cur = new Date(end); cur.setDate(cur.getDate() - (i * 7))
          const start = makeWeekStart(cur)
          const month = start.toLocaleString(undefined, { month: 'short' })
          const label = `Wk ${month} ${String(start.getDate()).padStart(2, '0')}`
          buckets.push({ label, start, total: 0 })
        }
        for (const o of weeklyArr) {
          const dt = o?.createdAt ? new Date(o.createdAt) : null
          if (!dt) continue
          const w = makeWeekStart(dt)
          for (const b of buckets) {
            if (b.start.getFullYear() === w.getFullYear() && b.start.getMonth() === w.getMonth() && b.start.getDate() === w.getDate()) {
              b.total += Number(o?.net || 0)
              break
            }
          }
        }
        setWeeklyLabels(buckets.map(b => b.label))
        setWeeklyTotals(buckets.map(b => b.total))
      } catch {
        if (!mounted) return
        setTokensToday(0); setRevenueTotal(0); setPendingCount(0); setCompletedCount(0); setReturnedCount(0); setTotalPackages(0); setRecentSales([]); setWeeklyLabels([]); setWeeklyTotals([])
      }
    })()
    return () => { mounted = false }
  }, [effFrom, effTo, from8w, todayStr])

  const cards = [
    { title: 'Total Revenue', value: `Rs ${Number(revenueTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, tone: 'border-green-200 ', bg: 'bg-green-50 ', icon: DollarSign },
    { title: isFiltered ? 'Tokens (range)' : "Today's Tokens", value: String(tokensToday), tone: 'border-emerald-200', bg: 'bg-emerald-50', icon: Activity },
    { title: 'Completed', value: String(completedCount), tone: 'border-violet-200', bg: 'bg-violet-50', icon: CheckCircle },
    { title: 'Returned', value: String(returnedCount), tone: 'border-rose-200', bg: 'bg-rose-50 ', icon: RotateCcw },
    { title: 'Queued', value: String(pendingCount), tone: 'border-sky-200', bg: 'bg-sky-50 ', icon: Clock },
    { title: 'Total Packages', value: String(totalPackages), tone: 'border-amber-200', bg: 'bg-amber-50', icon: Package },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 ">Counselling Dashboard</h2>

      <div className="rounded-xl border border-slate-200 bg-white0 p-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-slate-600 ">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-600">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
            </div>
          </div>
          <button onClick={() => { setFrom(''); setTo('') }} className="sm:ml-auto w-full sm:w-auto rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 text-slate-700">Reset</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, value, tone, bg, icon: Icon }) => (
          <div key={title} className={`rounded-xl border ${tone} p-4 ${bg}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-600 truncate">{title}</div>
                <div className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-900 truncate">{value}</div>
              </div>
              <div className="flex-shrink-0 ml-2 rounded-md bg-white/70 p-2 text-slate-700 shadow-sm">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2 ">
          <div className="mb-2 text-sm font-medium text-slate-700 ">Weekly Sales</div>
          <MiniBars data={weeklyTotals} labels={weeklyLabels} color="#0ea5e9" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700"><Bell className="h-4 w-4" /> Recent Tokens</div>
          <ul className="space-y-2 text-sm">
            {recentSales.map((o: any, idx: number) => (
              <li key={String(o?._id || idx)} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 ">
                <div>
                  <div className="font-medium text-slate-800">{formatDate(o?.createdAt)}</div>
                  <div className="text-xs text-slate-500">{o?.tokenNo} • {o?.patient?.fullName}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-right font-semibold text-slate-900 ">Rs {Number(o?.net || 0).toFixed(2)}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.sessionStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {o.sessionStatus || 'Queued'}
                  </span>
                </div>
              </li>
            ))}
            {recentSales.length === 0 && <li className="text-slate-500 dark:text-slate-400">No recent tokens</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function MiniBars({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const maxVal = Math.max(0, ...data)
  if (!maxVal) return (<div className="flex h-36 items-center justify-center text-sm text-slate-500">No data</div>)
  return (
    <div className="h-36">
      <div className="flex h-full items-end gap-2">
        {data.map((v, i) => {
          const h = Math.max(2, Math.round((v / (maxVal || 1)) * 100))
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="relative h-28 w-full rounded bg-slate-100">
                <div className="absolute bottom-0 left-0 right-0 rounded-b" style={{ height: `${h}%`, backgroundColor: color }} />
              </div>
              <div className="mt-1 text-[10px] text-slate-500">{labels[i]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

