import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Finance_OpeningBalances(){
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; category?: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [dateIso, setDateIso] = useState(()=> new Date().toISOString().slice(0,10))
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [openingEntries, setOpeningEntries] = useState<Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string }>>([])
  const [balancesByCode, setBalancesByCode] = useState<Record<string, number>>({})
  const [bankFilterCode, setBankFilterCode] = useState('')
  const [pettyRefills, setPettyRefills] = useState<Array<{ id: string; dateIso: string; pettyCode: string; bankId?: string; amount: number; memo?: string }>>([])
  const [bankPageSize, setBankPageSize] = useState<number>(20)
  const [bankPage, setBankPage] = useState<number>(1)
  const [bankFrom, setBankFrom] = useState<string>('')
  const [bankTo, setBankTo] = useState<string>('')
  const [viewTxn, setViewTxn] = useState<any|null>(null)

  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      setLoading(true)
      try {
        const [pettyRes, bankRes]: any = await Promise.all([
          hospitalApi.listPettyCashAccounts({ status: 'Active' }),
          hospitalApi.listBankAccounts({ status: 'Active' }),
        ])
        const petty = (pettyRes?.accounts || []).map((p:any)=> ({
          id: String(p.id||p._id||p.code),
          code: String(p.code||''),
          name: String(p.name||''),
          category: 'PettyCash',
        }))
        const bankRaw = (bankRes?.accounts || [])
        const bank = bankRaw.map((b:any)=>{
          const code = `BANK_${String(b.accountNumber||'').slice(-4).toUpperCase()}`
          return {
            id: String(b.id||b._id||b.accountNumber||code),
            code,
            name: `${b.bankName||''} - ${b.accountTitle||''}`.trim(),
            category: 'Bank',
          }
        })
        const list = [...petty, ...bank]
        if (!cancelled) { setAccounts(list); setBankAccounts(bankRaw) }
      } catch {
        if (!cancelled) { setAccounts([]); setBankAccounts([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return ()=>{ cancelled = true }
  }, [])

  // Load existing opening balance entries and current balances
  useEffect(()=>{
    let cancelled = false
    ;(async ()=>{
      try {
        const res: any = await hospitalApi.listOpeningBalanceEntries()
        const entries: Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string }> = (res?.entries || []).map((e:any)=> ({ id: String(e.id), dateIso: e.dateIso, account: e.account, amount: Number(e.amount||0), memo: e.memo }))
        if (!cancelled) setOpeningEntries(entries)
        // compute balances for distinct accounts
        const distinct = Array.from(new Set(entries.map(e=> e.account)))
        const map: Record<string, number> = {}
        for (const code of distinct){
          try {
            const bal: any = await hospitalApi.getFinanceAccountBalance(code)
            map[code] = Number(bal?.balance||0)
          } catch { map[code] = 0 }
        }
        if (!cancelled) setBalancesByCode(map)
        // also load petty cash refills to reflect as bank debits
        try {
          const r: any = await hospitalApi.listPettyRefillEntries()
          const rows = (r?.entries||[]).map((x:any)=> ({ id: String(x.id), dateIso: x.dateIso, pettyCode: String(x.pettyCode||''), bankId: x.bankId? String(x.bankId): undefined, amount: Number(x.amount||0), memo: x.memo }))
          if (!cancelled) setPettyRefills(rows)
        } catch { if (!cancelled) setPettyRefills([]) }
      } catch {
        if (!cancelled) { setOpeningEntries([]); setBalancesByCode({}) }
      }
    })()
    return ()=>{ cancelled = true }
  }, [accounts])

  useEffect(()=>{ setBankPage(1) }, [bankFilterCode, bankPageSize, bankFrom, bankTo])

  return (
    <div className="w-full px-6 py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Manage Bank Balance</div>
        <div className="text-sm text-slate-500">Post starting balances for bank accounts</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={dateIso} onChange={e=>setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account</label>
            <select value={account} onChange={e=>setAccount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={loading}>
              <option value="">Select account</option>
              {accounts.filter(a=> a.category==='Bank').map(a => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input value={amount||''} onChange={e=>setAmount(Number(e.target.value||0))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Memo (optional)</label>
            <input value={memo} onChange={e=>setMemo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Opening balance" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn"
            onClick={async()=>{
              if (!dateIso || !account || !(amount > 0)) return
              try {
                await hospitalApi.postOpeningBalance({ dateIso, account, amount, memo: memo||undefined })
                // Refresh balances for involved accounts
                try {
                  const targetCodes = new Set<string>()
                  targetCodes.add(account)
                  const updated: Record<string, number> = { ...balancesByCode }
                  for (const code of Array.from(targetCodes)){
                    try { const bal:any = await hospitalApi.getFinanceAccountBalance(code); updated[code] = Number(bal?.balance||0) } catch { updated[code]=0 }
                  }
                  setBalancesByCode(updated)
                } catch {}
                alert('Opening balance posted')
              } catch (e: any) {
                alert(e?.message || 'Failed')
              }
            }}
          >Post Opening Balance</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Bank Account Balance</div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={bankFrom} onChange={e=> setBankFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <input type="date" value={bankTo} onChange={e=> setBankTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={()=>{
                  const t = new Date().toISOString().slice(0,10)
                  setBankFrom(t)
                  setBankTo(t)
                }}
              >Today</button>
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={()=>{
                  setBankFrom('')
                  setBankTo('')
                  setBankFilterCode('')
                  setBankPageSize(20)
                  setBankPage(1)
                }}
              >Reset</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={bankFilterCode} onChange={e=> setBankFilterCode(e.target.value)} className="min-w-[220px] rounded-md border border-slate-300 px-2 py-1 text-xs">
                <option value="">All bank accounts</option>
                {accounts.filter(a=> a.category==='Bank').map(a=> (
                  <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
              <select value={bankPageSize} onChange={e=> setBankPageSize(Number(e.target.value||20))} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          {(() => {
            const openingBank = openingEntries.filter(e=> {
              const acc = accounts.find(a=> a.code===e.account)
              if (acc?.category!=='Bank') return false
              if (bankFilterCode && e.account!==bankFilterCode) return false
              if (bankFrom && String(e.dateIso||'') < bankFrom) return false
              if (bankTo && String(e.dateIso||'') > bankTo) return false
              return true
            })
            const refillBank = pettyRefills.map(r => {
              const b:any = bankAccounts.find(x=> String(x.id||x._id) === String(r.bankId||''))
              const bankCode = b ? String(b.financeAccountCode || `BANK_${String(b.accountNumber||'').slice(-4).toUpperCase()}`) : ''
              return { id: r.id, dateIso: r.dateIso, account: bankCode, amount: -Math.abs(Number(r.amount||0)), memo: r.memo }
            }).filter(e => e.account && (!bankFilterCode || e.account===bankFilterCode))
            return [...openingBank, ...refillBank].length === 0
          })() ? (
            <div className="mt-3 text-sm text-slate-500">No entry yet. Post an opening balance to view bank balances here.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Transfer to</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Send/Receive</th>
                    <th className="py-2 pr-4 text-right">Previous Balance</th>
                    <th className="py-2 pr-4 text-right">Current Balance</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const bankRows: any[] = []
                    // opening entries for bank accounts
                    const openingBank = openingEntries.filter(e=> {
                      const acc = accounts.find(a=> a.code===e.account)
                      if (acc?.category!=='Bank') return false
                      if (bankFilterCode && e.account!==bankFilterCode) return false
                      if (bankFrom && String(e.dateIso||'') < bankFrom) return false
                      if (bankTo && String(e.dateIso||'') > bankTo) return false
                      return true
                    })
                    // petty refills transformed as bank debits (negative amounts) using bank finance code
                    const refillBank = pettyRefills.map(r => {
                      const b:any = bankAccounts.find(x=> String(x.id||x._id) === String(r.bankId||''))
                      const bankCode = b ? String(b.financeAccountCode || `BANK_${String(b.accountNumber||'').slice(-4).toUpperCase()}`) : ''
                      const dest = accounts.find(a=> a.code===String(r.pettyCode||''))
                      return { id: r.id, dateIso: r.dateIso, account: bankCode, amount: -Math.abs(Number(r.amount||0)), memo: r.memo, transferTo: dest?.name || String(r.pettyCode||'') }
                    }).filter(e => {
                      if (!e.account) return false
                      if (bankFilterCode && e.account!==bankFilterCode) return false
                      if (bankFrom && String(e.dateIso||'') < bankFrom) return false
                      if (bankTo && String(e.dateIso||'') > bankTo) return false
                      return true
                    })
                    // combine
                    const bankEntries = [
                      ...openingBank,
                      ...refillBank,
                    ] as Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string; transferTo?: string }>
                    const byAccount: Record<string, any[]> = {}
                    for (const e of bankEntries){
                      if (!byAccount[e.account]) byAccount[e.account] = [] as any
                      byAccount[e.account].push(e)
                    }
                    const fmt = new Intl.NumberFormat('en-PK')
                    Object.keys(byAccount).forEach(code => {
                      const list = byAccount[code].slice().sort((a,b)=> a.dateIso.localeCompare(b.dateIso) || a.id.localeCompare(b.id))
                      let running = 0
                      const meta = accounts.find(a=> a.code===code)
                      for (let i=0;i<list.length;i++){
                        const e = list[i]
                        const previous = running
                        running = previous + Number(e.amount||0)
                        const statusLabel = running>previous ? 'Credit' : (running<previous ? 'Debit' : '—')
                        const statusCls = running>previous ? 'bg-green-100 text-green-700' : (running<previous ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')
                        const isSend = Number(e.amount||0) < 0
                        bankRows.unshift(
                          <tr key={`bank-${e.id}-${i}`} className="border-b last:border-0">
                            <td className="py-2 pr-4">{e.dateIso}</td>
                            <td className="py-2 pr-4 font-mono">{e.account}</td>
                            <td className="py-2 pr-4">{meta?.name || '-'}</td>
                            <td className="py-2 pr-4">{e.transferTo || '-'}</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right">
                              {isSend ? '-' : ''}Rs. {fmt.format(Math.abs(Number(e.amount||0)))}
                            </td>
                            <td className="py-2 pr-4 text-right">Rs. {fmt.format(previous)}</td>
                            <td className="py-2 pr-4 text-right">Rs. {fmt.format(running)}</td>
                            <td className="py-2 pr-4 text-right">
                              <button
                                type="button"
                                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                onClick={()=> setViewTxn({
                                  section: 'Bank',
                                  dateIso: e.dateIso,
                                  accountCode: e.account,
                                  accountName: meta?.name || '-',
                                  transferTo: e.transferTo || '-',
                                  transferFrom: e.transferTo ? (meta?.name || e.account) : '-',
                                  status: statusLabel,
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
                    const total = bankRows.length
                    const pageCount = Math.max(1, Math.ceil(total / Math.max(1, bankPageSize)))
                    const page = Math.min(Math.max(1, bankPage), pageCount)
                    const start = (page - 1) * bankPageSize
                    const end = start + bankPageSize
                    return (
                      <>
                        {bankRows.slice(start, end)}
                        <tr>
                          <td colSpan={9} className="pt-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <div>{total ? `${start+1}-${Math.min(end, total)} of ${total}` : '0'}</div>
                              <div className="flex gap-1">
                                <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page<=1} onClick={()=> setBankPage(p=> Math.max(1, p-1))}>Prev</button>
                                <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page>=pageCount} onClick={()=> setBankPage(p=> p+1)}>Next</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

