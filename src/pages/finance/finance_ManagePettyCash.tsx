import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Finance_ManagePettyCash(){
  const [pettyAccounts, setPettyAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [pettyCode, setPettyCode] = useState('')
  const [bankSourceId, setBankSourceId] = useState('')
  const [bankBalance, setBankBalance] = useState<number|null>(null)
  const [loadingBankBal, setLoadingBankBal] = useState(false)
  const [dateIso, setDateIso] = useState(()=> new Date().toISOString().slice(0,10))
  const [amount, setAmount] = useState<number>(0)
  const [memo, setMemo] = useState('')

  const [openingEntries, setOpeningEntries] = useState<Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string }>>([])
  const [pettyRefills, setPettyRefills] = useState<Array<{ id: string; dateIso: string; pettyCode: string; bankId?: string; amount: number; memo?: string }>>([])

  const [pettyFilterCode, setPettyFilterCode] = useState('')
  const [pettyPageSize, setPettyPageSize] = useState<number>(20)
  const [pettyPage, setPettyPage] = useState<number>(1)
  const [pettyFrom, setPettyFrom] = useState<string>('')
  const [pettyTo, setPettyTo] = useState<string>('')
  const [viewTxn, setViewTxn] = useState<any|null>(null)

  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try {
        const [pettyRes, bankRes]: any = await Promise.all([
          hospitalApi.listPettyCashAccounts({ status: 'Active' }),
          hospitalApi.listBankAccounts({ status: 'Active' }),
        ])
        const petty = (pettyRes?.accounts || []).map((p:any)=> ({
          id: String(p.id||p._id||p.code),
          code: String(p.code||''),
          name: String(p.name||''),
        }))
        const bankRaw = (bankRes?.accounts || [])
        if (!cancelled){
          setPettyAccounts(petty)
          setBankAccounts(bankRaw)
        }
      } catch {
        if (!cancelled){ setPettyAccounts([]); setBankAccounts([]) }
      }
    })()
    return ()=>{ cancelled = true }
  }, [])

  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try {
        const res: any = await hospitalApi.listOpeningBalanceEntries()
        const entries: Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string }> = (res?.entries || []).map((e:any)=> ({ id: String(e.id), dateIso: e.dateIso, account: e.account, amount: Number(e.amount||0), memo: e.memo }))
        if (!cancelled) setOpeningEntries(entries)
      } catch {
        if (!cancelled) setOpeningEntries([])
      }
      try {
        const r: any = await hospitalApi.listPettyRefillEntries()
        const rows = (r?.entries||[]).map((x:any)=> ({ id: String(x.id), dateIso: x.dateIso, pettyCode: String(x.pettyCode||''), bankId: x.bankId? String(x.bankId): undefined, amount: Number(x.amount||0), memo: x.memo }))
        if (!cancelled) setPettyRefills(rows)
      } catch {
        if (!cancelled) setPettyRefills([])
      }
    })()
    return ()=>{ cancelled = true }
  }, [pettyAccounts])

  useEffect(()=>{ setPettyPage(1) }, [pettyFilterCode, pettyPageSize, pettyFrom, pettyTo])

  useEffect(()=>{
    (async ()=>{
      const b: any = bankAccounts.find((x:any)=> String(x.id||x._id) === bankSourceId)
      if (!b){ setBankBalance(null); return }
      setLoadingBankBal(true)
      try {
        const finCode = String(b.financeAccountCode || `BANK_${String(b.accountNumber||'').slice(-4).toUpperCase()}`)
        const res: any = await hospitalApi.getFinanceAccountBalance(finCode)
        setBankBalance(Number(res?.balance||0))
      } catch {
        setBankBalance(0)
      } finally {
        setLoadingBankBal(false)
      }
    })()
  }, [bankSourceId, bankAccounts])

  async function reloadRefills(){
    try {
      const r: any = await hospitalApi.listPettyRefillEntries()
      const rows = (r?.entries||[]).map((x:any)=> ({ id: String(x.id), dateIso: x.dateIso, pettyCode: String(x.pettyCode||''), bankId: x.bankId? String(x.bankId): undefined, amount: Number(x.amount||0), memo: x.memo }))
      setPettyRefills(rows)
    } catch {}
  }

  return (
    <div className="w-full px-6 py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Manage Petty Cash</div>
        <div className="text-sm text-slate-500">Transfer funds from bank to petty cash and view balances</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={dateIso} onChange={e=>setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Petty Cash Account</label>
            <select value={pettyCode} onChange={e=>setPettyCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select petty cash</option>
              {pettyAccounts.map(a => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Bank Account (source of funds)</label>
            <select value={bankSourceId} onChange={e=> setBankSourceId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select bank account</option>
              {bankAccounts.map((b:any)=> (
                <option key={String(b.id||b._id)} value={String(b.id||b._id)}>
                  {`${b.bankName||''} — ${b.accountTitle||''}`.trim()}
                </option>
              ))}
            </select>
            {bankSourceId && (
              <div className="mt-2 text-sm">
                <span className="text-slate-600">Current Bank Balance: </span>
                <span className="font-medium">Rs. {new Intl.NumberFormat('en-PK').format(Number(bankBalance||0))}</span>
                {(!loadingBankBal && Number(bankBalance||0) <= 0) && (
                  <span className="ml-2 text-red-600">Selected bank account has no balance.</span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input value={amount||''} onChange={e=>setAmount(Number(e.target.value||0))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Memo (optional)</label>
            <input value={memo} onChange={e=>setMemo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Transfer" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn"
            onClick={async()=>{
              if (!dateIso || !pettyCode || !(amount > 0) || !bankSourceId) return
              if (!loadingBankBal && Number(bankBalance||0) <= 0) return alert('Selected bank account has no balance')
              if (Number(amount||0) > Number(bankBalance||0)) return alert('Entered amount exceeds selected bank account balance')
              try {
                await hospitalApi.refillPettyCash({ pettyCode, bankId: bankSourceId, amount: Number(amount||0), dateIso, memo })
                await reloadRefills()
                setPettyFilterCode(pettyCode)
                alert('Petty cash funded from bank')
              } catch(e:any){
                alert(e?.message || 'Failed')
              }
            }}
          >Transfer</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Petty Cash Balance</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={pettyFrom} onChange={e=> setPettyFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
            <input type="date" value={pettyTo} onChange={e=> setPettyTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={()=>{
                const t = new Date().toISOString().slice(0,10)
                setPettyFrom(t)
                setPettyTo(t)
              }}
            >Today</button>
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={()=>{
                setPettyFrom('')
                setPettyTo('')
                setPettyFilterCode('')
                setPettyPageSize(20)
                setPettyPage(1)
              }}
            >Reset</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pettyFilterCode} onChange={e=> setPettyFilterCode(e.target.value)} className="min-w-[220px] rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value="">All petty cash</option>
              {pettyAccounts.map(a=> (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
            <select value={pettyPageSize} onChange={e=> setPettyPageSize(Number(e.target.value||20))} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {(() => {
          const openingPetty = openingEntries.filter(e=> {
            if (!pettyAccounts.some(a=> a.code===e.account)) return false
            if (pettyFilterCode && e.account!==pettyFilterCode) return false
            if (pettyFrom && String(e.dateIso||'') < pettyFrom) return false
            if (pettyTo && String(e.dateIso||'') > pettyTo) return false
            return true
          })
          const refillPetty = pettyRefills.map(r => {
            const b:any = bankAccounts.find(x=> String(x.id||x._id) === String(r.bankId||''))
            const fromName = b ? `${b.bankName||''} - ${b.accountTitle||''}`.trim() : ''
            return { id: r.id, dateIso: r.dateIso, account: r.pettyCode, amount: Math.abs(Number(r.amount||0)), memo: r.memo, transferFrom: fromName || String(r.bankId||'') }
          }).filter(e => {
            if (pettyFilterCode && e.account!==pettyFilterCode) return false
            if (pettyFrom && String(e.dateIso||'') < pettyFrom) return false
            if (pettyTo && String(e.dateIso||'') > pettyTo) return false
            return true
          })
          const entries = [...openingPetty, ...refillPetty]
          if (entries.length === 0){
            return <div className="mt-3 text-sm text-slate-500">No entry yet.</div>
          }

          const byAccount: Record<string, any[]> = {}
          for (const e of entries){
            if (!byAccount[e.account]) byAccount[e.account] = []
            byAccount[e.account].push(e)
          }

          const rows: any[] = []
          const fmt = new Intl.NumberFormat('en-PK')
          Object.keys(byAccount).forEach(code => {
            const list = byAccount[code].slice().sort((a,b)=> a.dateIso.localeCompare(b.dateIso) || a.id.localeCompare(b.id))
            let running = 0
            const meta = pettyAccounts.find(a=> a.code===code)
            for (let i=0;i<list.length;i++){
              const e = list[i]
              const previous = running
              running = previous + Number(e.amount||0)
              rows.unshift(
                <tr key={`petty-${e.id}-${i}`} className="border-b last:border-0">
                  <td className="py-2 pr-4">{e.dateIso}</td>
                  <td className="py-2 pr-4 font-mono">{e.account}</td>
                  <td className="py-2 pr-4">{meta?.name || '-'}</td>
                  <td className="py-2 pr-4">{e.transferFrom || '-'}</td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(Math.abs(Number(e.amount||0)))}</td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(previous)}</td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(running)}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={()=> setViewTxn({
                        section: 'Petty',
                        dateIso: e.dateIso,
                        accountCode: e.account,
                        accountName: meta?.name || '-',
                        transferTo: e.transferFrom ? (meta?.name || e.account) : '-',
                        transferFrom: e.transferFrom || '-',
                        status: 'Credit',
                        amount: Number(e.amount||0),
                        previous,
                        current: running,
                        memo: e.memo || '-',
                      })}
                      aria-label="View"
                      title="View"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </td>
                </tr>
              )
            }
          })

          const total = rows.length
          const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pettyPageSize)))
          const page = Math.min(Math.max(1, pettyPage), pageCount)
          const start = (page - 1) * pettyPageSize
          const end = start + pettyPageSize

          return (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Transfer from</th>
                    <th className="py-2 pr-4 text-right">Receive/Used</th>
                    <th className="py-2 pr-4 text-right">Previous Balance</th>
                    <th className="py-2 pr-4 text-right">Current Balance</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(start, end)}
                  <tr>
                    <td colSpan={8} className="pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div>{total ? `${start+1}-${Math.min(end, total)} of ${total}` : '0'}</div>
                        <div className="flex gap-1">
                          <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page<=1} onClick={()=> setPettyPage(p=> Math.max(1, p-1))}>Prev</button>
                          <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page>=pageCount} onClick={()=> setPettyPage(p=> p+1)}>Next</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      {viewTxn && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={()=> setViewTxn(null)}></div>
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Transaction Details</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> setViewTxn(null)}>✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-500">Section</div><div>{viewTxn.section || '-'}</div></div>
              <div><div className="text-slate-500">Date</div><div>{viewTxn.dateIso || '-'}</div></div>
              <div><div className="text-slate-500">Account</div><div className="font-mono">{viewTxn.accountCode || '-'}</div></div>
              <div><div className="text-slate-500">Name</div><div>{viewTxn.accountName || '-'}</div></div>
              <div><div className="text-slate-500">Status</div><div>{viewTxn.status || '-'}</div></div>
              <div><div className="text-slate-500">Amount</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.amount||0))}`}</div></div>
              <div><div className="text-slate-500">Previous Balance</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.previous||0))}`}</div></div>
              <div><div className="text-slate-500">Current Balance</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.current||0))}`}</div></div>
              <div><div className="text-slate-500">Transfer From</div><div>{viewTxn.transferFrom || '-'}</div></div>
              <div><div className="text-slate-500">Transfer To</div><div>{viewTxn.transferTo || '-'}</div></div>
              <div className="sm:col-span-2"><div className="text-slate-500">Memo</div><div className="break-words">{viewTxn.memo || '-'}</div></div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn" onClick={()=> setViewTxn(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
