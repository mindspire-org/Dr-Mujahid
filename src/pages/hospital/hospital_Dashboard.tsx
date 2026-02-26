import { useEffect, useMemo, useState } from 'react'
import { DollarSign, Users, Activity, RefreshCw, Clock, Filter, RotateCcw, BarChart3 } from 'lucide-react'
import { hospitalApi, financeApi } from '../../utils/api'

function iso(d: Date) { return d.toISOString().slice(0, 10) }
function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); return x }
function money(x: any) { const n = Number(x || 0); return isFinite(n) ? n : 0 }
// (Removed salaries range calc util per request)

// Daily grouped bars removed; simplified to two-bars component below.

function TwoBars({ revenue, expense }: { revenue: number; expense: number }) {
  const w = 320
  const h = 160
  const pad = 24
  const max = Math.max(1, revenue, expense)
  const bw = (w - pad * 2 - 16) / 2
  const base = h - pad
  const rh = (revenue / max) * (h - pad * 2)
  const eh = (expense / max) * (h - pad * 2)
  const rx = pad
  const ex = pad + bw + 16
  const fmt = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <rect x={rx} y={base - rh} width={bw} height={rh} fill="#10b981" rx={3}>
        <title>{fmt(revenue)}</title>
      </rect>
      <rect x={ex} y={base - eh} width={bw} height={eh} fill="#ef4444" rx={3}>
        <title>{fmt(expense)}</title>
      </rect>
    </svg>
  )
}

export default function Hospital_Dashboard() {
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>('—')
  const [fromDate, setFromDate] = useState<string>(iso(startOfMonth(new Date())))
  const [toDate, setToDate] = useState<string>(iso(new Date()))
  const [stats, setStats] = useState({
    tokens: 0,
    present: 0,
    late: 0,
  })
  const [tokens, setTokens] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [doctorEarnRows, setDoctorEarnRows] = useState<any[]>([])
  const [doctorPayoutsTotal, setDoctorPayoutsTotal] = useState<number>(0)
  const REFRESH_MS = 15000

  useEffect(() => { load() }, [fromDate, toDate])

  async function load() {
    setLoading(true)
    try {
      const [tokensRes, expensesRes, staffRes, attRes, shiftsRes] = await Promise.all([
        hospitalApi.listTokens({ from: fromDate, to: toDate }) as any,
        hospitalApi.listExpenses({ from: fromDate, to: toDate }) as any,
        hospitalApi.listStaff() as any,
        hospitalApi.listAttendance({ from: fromDate, to: toDate, limit: 5000 }) as any,
        hospitalApi.listShifts() as any,
        hospitalApi.listDoctors() as any,
      ])
      const tokensArr: any[] = tokensRes?.tokens || tokensRes?.items || tokensRes || []
      const expensesArr: any[] = expensesRes?.expenses || expensesRes?.items || expensesRes || []
      let staffArr: any[] = staffRes?.staff || staffRes?.items || staffRes || []
      let attendance: any[] = attRes?.items || []
      let shifts: any[] = (shiftsRes?.items || shiftsRes || [])

      setTokens(tokensArr)
      setExpenses(expensesArr)
      setDoctorEarnRows([])

      // Doctor payouts sum (DB-backed list)
      try {
        const resp: any = await financeApi.listPayouts({ from: fromDate, to: toDate, limit: 5000 })
        const total = ((resp?.payouts || []) as any[]).reduce((s, p) => s + money(p.amount), 0)
        setDoctorPayoutsTotal(total)
      } catch { setDoctorPayoutsTotal(0) }

      const todayStr = toDate
      const dateOf = (x: any) => String(x?.date || x?.dateIso || x?.createdAt || '').slice(0, 10)
      const presentToday = attendance.filter(a => dateOf(a) === todayStr && (String(a.status || '').toLowerCase() === 'present' || !!a.clockIn)).length
      const shiftMap: Record<string, any> = {}
      for (const sh of shifts) { shiftMap[String(sh._id || sh.id)] = sh }
      const staffMap: Record<string, any> = {}
      for (const st of staffArr) { staffMap[String(st._id || st.id)] = st }
      function toMin(hm?: string) { if (!hm) return null; const [h, m] = String(hm).split(':').map((n: any) => parseInt(n || '0')); return isFinite(h) ? (h * 60 + (m || 0)) : null }
      let lateToday = 0
      for (const a of attendance) {
        if (dateOf(a) !== todayStr || String(a.status || '').toLowerCase() !== 'present' || !a.clockIn) continue
        const sid = String(a.shiftId || staffMap[a.staffId]?.shiftId || '')
        const sh = shiftMap[sid]
        const smin = toMin(sh?.start), inMin = toMin(a.clockIn)
        if (smin != null && inMin != null && inMin > smin) lateToday++
      }

      setStats({ tokens: tokensArr.length, present: presentToday, late: lateToday })
      setUpdatedAt(new Date().toLocaleString())
    } finally { setLoading(false) }
  }

  // Department map no longer needed after removing dept-wise widget
  const tokensPaid = useMemo(() => tokens.filter(t => {
    const st = String(t?.status || '').toLowerCase()
    return st !== 'returned' && st !== 'cancelled'
  }), [tokens])
  const opdRevenue = useMemo(() => tokensPaid.reduce((s, t) => {
    // Newer tokens store `fee` as the payable amount (discount already applied).
    // Prefer explicit net/payable when available.
    return s + money(t.net ?? t.payable ?? t.fee)
  }, 0), [tokensPaid])
  const expensesTotal = useMemo(() => expenses.reduce((s, e) => s + money(e.amount), 0), [expenses])
  const doctorPayouts = useMemo(() => (doctorEarnRows || []).filter((r: any) => {
    const t = String(r.type || '').toLowerCase()
    return t === 'payout' || money(r.amount) < 0
  }).reduce((s: any, r: any) => s + Math.abs(money(r.amount)), 0), [doctorEarnRows])
  const doctorPayoutsCard = useMemo(() => doctorPayoutsTotal > 0 ? doctorPayoutsTotal : doctorPayouts, [doctorPayoutsTotal, doctorPayouts])
  // Salaries widget removed per request

  const totalRevenue = useMemo(() => opdRevenue, [opdRevenue])

  // Removed per request: day-wise arrays for grouped bars

  const cards = [
    { title: 'Tokens', value: String(stats.tokens), tone: 'bg-emerald-50 border-emerald-200', icon: Activity },
    { title: 'OPD Revenue', value: `Rs ${opdRevenue.toFixed(0)}`, tone: 'bg-green-50 border-green-200', icon: DollarSign },
    { title: 'Total Revenue', value: `Rs ${totalRevenue.toFixed(0)}`, tone: 'bg-green-50 border-green-200', icon: DollarSign },
    { title: 'Expenses', value: `Rs ${expensesTotal.toFixed(0)}`, tone: 'bg-rose-50 border-rose-200', icon: DollarSign },
    { title: 'Doctor Payouts', value: `Rs ${doctorPayoutsCard.toFixed(0)}`, tone: 'bg-amber-50 border-amber-200', icon: DollarSign },
    { title: 'Staff Present (Today)', value: String(stats.present), tone: 'bg-yellow-50 border-yellow-200', icon: Users },
    { title: 'Late Staff (Today)', value: String(stats.late), tone: 'bg-slate-50 border-slate-200', icon: Clock },
  ]

  // Auto-refresh for real-time chart and widgets
  useEffect(() => {
    const id = setInterval(async () => {
      await load()
    }, Math.max(3000, REFRESH_MS))
    return () => clearInterval(id)
  }, [fromDate, toDate])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div className="space-y-6">


      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-800 font-semibold"><Filter className="h-4 w-4" /> Filters</div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-sm"><span className="w-16 text-slate-600">From</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm"><span className="w-16 text-slate-600">To</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input" />
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => { setFromDate(iso(startOfMonth(new Date()))); setToDate(iso(new Date())) }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" /> Reset</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ title, value, tone, icon: Icon }) => (
          <div key={title} className={`rounded-xl border ${tone} p-4`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm ">{title}</div>
                <div className="mt-1 text-xl font-semibold ">{value}</div>
              </div>
              <div className="rounded-md bg-white/60 p-2 shadow-sm">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-800 font-semibold"><BarChart3 className="h-4 w-4" /> Revenue vs Expenses</div>
          <div className="overflow-x-auto">
            <TwoBars revenue={totalRevenue} expense={expensesTotal} />
          </div>
          <div className="mt-2 text-xs text-slate-600">Green: Revenue, Red: Expenses</div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 text-xs text-slate-500">
        <Clock className="h-4 w-4" />
        <span>Last updated: {updatedAt}</span>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
    </div>
  )
}
