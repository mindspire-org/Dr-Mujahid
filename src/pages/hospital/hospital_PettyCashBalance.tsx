import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type CashExpense = {
  id: string
  date: string
  type: string
  amount: number
  usedBy: string
}

export default function Hospital_PettyCashBalance(){
  const [date] = useState<string>(()=> new Date().toISOString().slice(0,10))
  const [expenses, setExpenses] = useState<CashExpense[]>([])
  const [expType, setExpType] = useState('')
  const [expAmount, setExpAmount] = useState<number|''>('')
  const [expDate, setExpDate] = useState<string>(()=> new Date().toISOString().slice(0,10))
  const [expUsedBy, setExpUsedBy] = useState('')
  const [exactBalance, setExactBalance] = useState<number|null>(null)
  const [loadingExact, setLoadingExact] = useState(false)
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  async function reloadExpenses(){
    setLoadingExpenses(true)
    try {
      const res: any = await hospitalApi.listPettyCashExpenses()
      const items: any[] = res?.items || []
      setExpenses(items.map((x:any)=> ({
        id: String(x.id||x._id),
        date: String(x.dateIso||x.date||'').slice(0,10),
        type: String(x.type||''),
        amount: Number(x.amount||0),
        usedBy: String(x.usedBy||''),
      })))
    } catch {
      setExpenses([])
    } finally {
      setLoadingExpenses(false)
    }
  }

  useEffect(()=>{ reloadExpenses() }, [])

  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      setLoadingExact(true)
      try {
        const res: any = await hospitalApi.listPettyCashAccounts({ status: 'Active' })
        const list: any[] = res?.accounts || []
        let total = 0
        for (const a of list){
          const code = String(a.code||'').trim().toUpperCase()
          if (!code) continue
          try {
            const b: any = await hospitalApi.getFinanceAccountBalance(code)
            total += Number(b?.balance || 0)
          } catch {}
        }
        if (!cancelled) setExactBalance(total)
      } catch {
        if (!cancelled) setExactBalance(null)
      } finally {
        if (!cancelled) setLoadingExact(false)
      }
    })()
    return ()=>{ cancelled = true }
  }, [])

  // Balances are computed from openingMaster and expenses

  function addExpense(){
    if (!expDate) return alert('Please select expense date')
    if (!expType.trim()) return alert('Please enter expense type')
    const amt = Number(expAmount||0)
    if (!(amt>0)) return alert('Enter a valid amount')
    const usedBy = expUsedBy.trim()
    ;(async ()=>{
      try {
        await hospitalApi.createPettyCashExpense({ dateIso: expDate, type: expType.trim(), amount: amt, usedBy: usedBy || undefined })
        await reloadExpenses()
        // reset type/amount/person, keep date
        setExpType(''); setExpAmount(''); setExpUsedBy('')
      } catch(e:any){
        alert(e?.message || 'Failed to add expense')
      }
    })()
  }

  const todaysExpenses = useMemo(()=> expenses.filter(e=> e.date===date), [expenses, date])
  const todaysExpenseTotal = useMemo(()=> todaysExpenses.reduce((s,e)=> s + (e.amount||0), 0), [todaysExpenses])
  const expensesUptoDateTotal = useMemo(()=>
    expenses.filter(e=> e.date<=date).reduce((s,e)=> s + (e.amount||0), 0)
  ,[expenses, date])
  const overallExpenseTotal = useMemo(()=> expenses.reduce((s,e)=> s + (e.amount||0), 0), [expenses])

  const todayBalance = useMemo(()=>{
    const base = Number(exactBalance||0)
    return base - expensesUptoDateTotal
  }, [exactBalance, expensesUptoDateTotal])

  const displayBalance = todayBalance

  return (
    <div className="w-full px-6 py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Petty Cash Mangement</div>
        <div className="text-sm text-slate-500">Daily petty cash tracking and expenses</div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Petty Cash Balance</div>
          <div className="mt-1 text-2xl font-semibold">Rs. {new Intl.NumberFormat('en-PK').format(displayBalance||0)}</div>
          <div className="mt-1 text-xs text-slate-500">As of {date}</div>
          {loadingExact && (
            <div className="mt-1 text-xs text-slate-400">Updating…</div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Petty Cash Expense (Overall)</div>
          <div className="mt-1 text-2xl font-semibold text-rose-600">Rs. {new Intl.NumberFormat('en-PK').format(overallExpenseTotal||0)}</div>
          <div className="mt-1 text-xs text-slate-500">All recorded</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Petty Cash Expense (Today)</div>
          <div className="mt-1 text-2xl font-semibold text-rose-600">Rs. {new Intl.NumberFormat('en-PK').format(todaysExpenseTotal||0)}</div>
          <div className="mt-1 text-xs text-slate-500">For {date}</div>
        </div>
      </div>

      

      {/* Expense Entry */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <div className="text-lg font-semibold">Record Petty Cash Expense</div>
          <div className="text-sm text-slate-500">Multiple small expenses happen daily. System keeps: Expense type, Amount, Date, Person who used cash.</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={expDate} onChange={e=> setExpDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Expense Type</label>
            <input value={expType} onChange={e=> setExpType(e.target.value)} placeholder="e.g. Stationery, Courier, Tea" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input value={expAmount} onChange={e=> setExpAmount((e.target.value===''?'':Number(e.target.value)) as any)} placeholder="0" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Person Used Cash</label>
            <input value={expUsedBy} onChange={e=> setExpUsedBy(e.target.value)} placeholder="e.g. Reception, Nursing" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn" onClick={addExpense}>Add Expense</button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold">Expenses</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Expense Type</th>
                <th className="py-2 pr-4">Person</th>
                <th className="py-2 pr-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(loadingExpenses && expenses.length===0) && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">Loading…</td></tr>
              )}
              {(!loadingExpenses && expenses.length===0) && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">No expenses recorded</td></tr>
              )}
              {expenses.map((e)=> (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{e.date}</td>
                  <td className="py-2 pr-4">{e.type}</td>
                  <td className="py-2 pr-4">{e.usedBy || '-'}</td>
                  <td className="py-2 pr-4 text-right">Rs. {new Intl.NumberFormat('en-PK').format(e.amount||0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      
    </div>
  )
}
