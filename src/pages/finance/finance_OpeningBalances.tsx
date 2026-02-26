import { useEffect, useRef, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Finance_OpeningBalances() {
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; category?: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [account, setAccount] = useState('')
  const [senderAccount, setSenderAccount] = useState('')
  const [senderBalance, setSenderBalance] = useState<number | null>(null)
  const [loadingSenderBal, setLoadingSenderBal] = useState(false)
  const [amount, setAmount] = useState<number>(0)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [, setOpeningEntries] = useState<Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string }>>([])
  const [balancesByCode, setBalancesByCode] = useState<Record<string, number>>({})
  const [bankFilterCode, setBankFilterCode] = useState('')
  const [, setPettyRefills] = useState<Array<{ id: string; dateIso: string; pettyCode: string; bankId?: string; amount: number; memo?: string }>>([])
  const [bankLedger, setBankLedger] = useState<any[]>([])
  const [bankLedgerLoading, setBankLedgerLoading] = useState(false)
  const [bankPageSize, setBankPageSize] = useState<number>(20)
  const [bankPage, setBankPage] = useState<number>(1)
  const [bankFrom, setBankFrom] = useState<string>('')
  const [bankTo, setBankTo] = useState<string>('')
  const [viewTxn, setViewTxn] = useState<any | null>(null)

  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false)
    }, 2500)
  }

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        setLoading(true)
        try {
          const [pettyRes, bankRes]: any = await Promise.all([
            hospitalApi.listPettyCashAccounts({ status: 'Active' }),
            hospitalApi.listBankAccounts(),
          ])
          const petty = (pettyRes?.accounts || []).map((p: any) => ({
            id: String(p.id || p._id || p.code),
            code: String(p.code || ''),
            name: String(p.name || ''),
            category: 'PettyCash',
          }))
          const bankRaw = (bankRes?.accounts || [])
          const bank = bankRaw.map((b: any) => {
            const code = String(b?.financeAccountCode || `BANK_${String(b?.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
            if (!code) return null
            return {
              id: String(b.id || b._id || code),
              code,
              name: `${b.bankName || ''} - ${b.accountTitle || ''}`.trim(),
              category: 'Bank',
            }
          }).filter(Boolean)
          const list = [...petty, ...(bank as any[])]
          if (!cancelled) { setAccounts(list); setBankAccounts(bankRaw) }
        } catch {
          if (!cancelled) { setAccounts([]); setBankAccounts([]) }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [])

  // Load existing opening balance entries and current balances
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res: any = await hospitalApi.listOpeningBalanceEntries()
          const entries: Array<{ id: string; dateIso: string; account: string; amount: number; memo?: string }> = (res?.entries || []).map((e: any) => ({ id: String(e.id), dateIso: e.dateIso, account: e.account, amount: Number(e.amount || 0), memo: e.memo }))
          if (!cancelled) setOpeningEntries(entries)
          // compute balances for distinct accounts
          const distinct = Array.from(new Set(entries.map(e => e.account)))
          const map: Record<string, number> = {}
          for (const code of distinct) {
            try {
              const bal: any = await hospitalApi.getFinanceAccountBalance(code)
              map[code] = Number(bal?.balance || 0)
            } catch { map[code] = 0 }
          }
          if (!cancelled) setBalancesByCode(map)
          // also load petty cash refills to reflect as bank debits
          try {
            const r: any = await hospitalApi.listPettyRefillEntries()
            const rows = (r?.entries || []).map((x: any) => ({ id: String(x.id), dateIso: x.dateIso, pettyCode: String(x.pettyCode || ''), bankId: x.bankId ? String(x.bankId) : undefined, amount: Number(x.amount || 0), memo: x.memo }))
            if (!cancelled) setPettyRefills(rows)
          } catch { if (!cancelled) setPettyRefills([]) }
        } catch {
          if (!cancelled) { setOpeningEntries([]); setBalancesByCode({}) }
        }
      })()
    return () => { cancelled = true }
  }, [accounts])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        const code = String(bankFilterCode || '').trim().toUpperCase()
        if (!code) { setBankLedger([]); return }
        setBankLedgerLoading(true)
        try {
          const res: any = await hospitalApi.listFinanceAccountTransactions({
            code,
            from: bankFrom || undefined,
            to: bankTo || undefined,
            limit: 500,
          })
          if (!cancelled) setBankLedger(res?.entries || [])
        } catch {
          if (!cancelled) setBankLedger([])
        } finally {
          if (!cancelled) setBankLedgerLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [bankFilterCode, bankFrom, bankTo])

  useEffect(() => { setBankPage(1) }, [bankFilterCode, bankPageSize, bankFrom, bankTo])

  useEffect(() => {
    (async () => {
      const code = String(senderAccount || '').trim().toUpperCase()
      if (!code) { setSenderBalance(null); return }
      setLoadingSenderBal(true)
      try {
        const res: any = await hospitalApi.getFinanceAccountBalance(code)
        setSenderBalance(Number(res?.balance || 0))
      } catch {
        setSenderBalance(0)
      } finally {
        setLoadingSenderBal(false)
      }
    })()
  }, [senderAccount])

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Manage Bank Balance</div>
        <div className="text-sm text-slate-500">Post starting balances for bank accounts</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={dateIso} onChange={e => setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account (Receiver)</label>
            <select value={account} onChange={e => setAccount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={loading}>
              <option value="">Select account</option>
              {accounts.filter(a => a.category === 'Bank').map(a => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Account (Sender)</label>
            <select value={senderAccount} onChange={e => setSenderAccount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={loading}>
              <option value="">Select account</option>
              {accounts.map(a => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
            {senderAccount && (
              <div className="mt-2 text-sm">
                <span className="text-slate-600">Current Sender Balance: </span>
                <span className="font-medium">Rs. {new Intl.NumberFormat('en-PK').format(Number(senderBalance || 0))}</span>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input value={amount || ''} onChange={e => setAmount(Number(e.target.value || 0))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Memo (optional)</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Opening balance" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn"
            disabled={
              loading ||
              loadingSenderBal ||
              !dateIso ||
              !account ||
              !senderAccount ||
              !(amount > 0)
            }
            onClick={async () => {
              if (!dateIso) return showToast('Please select date')
              if (!account) return showToast('Please select Account (Receiver)')
              if (!senderAccount) return showToast('Please select Account (Sender)')
              if (!(amount > 0)) return showToast('Please enter amount')
              if (loadingSenderBal) return showToast('Please wait, loading sender balance...')
              try {
                await hospitalApi.transferFinanceAccount({ fromAccountCode: senderAccount, toAccountCode: account, amount, dateIso, memo: memo || undefined })
                // Refresh balances for involved accounts
                try {
                  const targetCodes = new Set<string>()
                  targetCodes.add(account)
                  targetCodes.add(senderAccount)
                  const updated: Record<string, number> = { ...balancesByCode }
                  for (const code of Array.from(targetCodes)) {
                    try { const bal: any = await hospitalApi.getFinanceAccountBalance(code); updated[code] = Number(bal?.balance || 0) } catch { updated[code] = 0 }
                  }
                  setBalancesByCode(updated)
                } catch { }
                showToast('Transfer completed')

                // Reset fields (keep date as-is)
                setAccount('')
                setSenderAccount('')
                setSenderBalance(null)
                setAmount(0)
                setMemo('')
              } catch (e: any) {
                showToast(e?.message || 'Failed')
              }
            }}
          >Transfer</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Bank Account Transactions</div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={bankFrom} onChange={e => setBankFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <input type="date" value={bankTo} onChange={e => setBankTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={() => {
                  const t = new Date().toISOString().slice(0, 10)
                  setBankFrom(t)
                  setBankTo(t)
                }}
              >Today</button>
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={() => {
                  setBankFrom('')
                  setBankTo('')
                  setBankFilterCode('')
                  setBankPageSize(20)
                  setBankPage(1)
                }}
              >Reset</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={bankFilterCode} onChange={e => setBankFilterCode(e.target.value)} className="min-w-[220px] rounded-md border border-slate-300 px-2 py-1 text-xs">
                <option value="">All bank accounts</option>
                {accounts.filter(a => a.category === 'Bank').map(a => (
                  <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
              <select value={bankPageSize} onChange={e => setBankPageSize(Number(e.target.value || 20))} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          {(() => {
            if (!bankFilterCode) return true
            return bankLedger.length === 0
          })() ? (
            <div className="mt-3 text-sm text-slate-500">
              {!bankFilterCode
                ? 'Select a bank account to view transactions.'
                : (bankLedgerLoading ? 'Loading...' : 'No transactions found for this bank account in selected range.')}
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">Transaction ID</th>
                    <th className="py-2 pr-4">DateTime</th>
                    <th className="py-2 pr-4">Account ID(Receiver)</th>
                    <th className="py-2 pr-4">Account ID(Sender)</th>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Received/Sent</th>
                    <th className="py-2 pr-4 text-right">Current Balance</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const bankRows: any[] = []

                    const resolveAccountTitle = (code: string) => {
                      const c = String(code || '').trim().toUpperCase()
                      if (!c) return '-'
                      const acc = accounts.find(a => String(a.code || '').trim().toUpperCase() === c)
                      if (acc?.name) return String(acc.name)
                      const b = bankAccounts.find((x: any) => String(x.financeAccountCode || `BANK_${String(x.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase() === c)
                      if (b) return `${b.bankName || ''} - ${b.accountTitle || ''}`.trim()
                      return '-'
                    }

                    if (bankFilterCode) {
                      const fmt = new Intl.NumberFormat('en-PK')
                      const code = String(bankFilterCode || '').trim().toUpperCase()
                      let running = 0
                      const list = (bankLedger || []).slice().sort((a: any, b: any) =>
                        String(a.dateIso || '').localeCompare(String(b.dateIso || '')) ||
                        String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
                        String(a.id || '').localeCompare(String(b.id || ''))
                      )
                      const renderedRows: any[] = []
                      for (let i = 0; i < list.length; i++) {
                        const t: any = list[i]
                        const delta = Number(t.debit || 0) - Number(t.credit || 0)
                        running = running + delta
                        const statusLabel = delta > 0 ? 'Credit' : (delta < 0 ? 'Debit' : '—')
                        const statusCls = delta > 0 ? 'bg-green-100 text-green-700' : (delta < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')
                        const cpCodes = Array.isArray(t.counterparties) && t.counterparties.length
                          ? t.counterparties.map((c: any) => String(c.account || '')).filter(Boolean)
                          : []
                        const cpCode = cpCodes[0] || '-'

                        const receiverCode = delta < 0 ? cpCode : code
                        const senderCode = delta > 0 ? cpCode : code

                        renderedRows.push(
                          <tr key={`bank-ledger-${String(t.id)}-${i}`} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono">{String(t.txId || `TXN-${String(t.id)}`)}</td>
                            <td className="py-2 pr-4">
                              <div className="leading-tight">
                                <div>{String(t.dateIso || '') || '-'}</div>
                                <div className="text-xs text-slate-500">{(() => {
                                  const timeDt = t?.createdAt ? new Date(String(t.createdAt)) : null
                                  const timeLabel = (!timeDt || Number.isNaN(timeDt.getTime())) ? '-' : timeDt.toLocaleTimeString()
                                  return timeLabel
                                })()}</div>
                              </div>
                            </td>
                            <td className="py-2 pr-4 font-mono">{receiverCode || '-'}</td>
                            <td className="py-2 pr-4">{senderCode || '-'}</td>
                            <td className="py-2 pr-4">{(() => {
                              const u = t?.user
                              const name = String(u?.fullName || u?.username || t?.createdBy || '-').trim() || '-'
                              const role = String(u?.role || '').trim()
                              return role ? `${name}-${role}` : name
                            })()}</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right">Rs. {fmt.format(delta)}</td>
                            <td className="py-2 pr-4 text-right">Rs. {fmt.format(running)}</td>
                            <td className="py-2 pr-4 text-right">
                              <button
                                type="button"
                                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                onClick={() => setViewTxn({
                                  section: 'Bank',
                                  transactionId: String(t.txId || `TXN-${String(t.id)}`),
                                  dateIso: t.dateIso,
                                  createdAt: t.createdAt,
                                  accountCode: receiverCode,
                                  accountName: resolveAccountTitle(receiverCode),
                                  senderAccount: senderCode,
                                  senderAccountNameCode: cpCode,
                                  status: statusLabel,
                                  amount: delta,
                                  current: running,
                                  memo: t.memo || '-',
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

                      // Show newest-to-oldest (running balance still computed oldest-to-newest)
                      bankRows.push(...renderedRows.reverse())

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
                                <div>{total ? `${start + 1}-${Math.min(end, total)} of ${total}` : '0'}</div>
                                <div className="flex gap-1">
                                  <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page <= 1} onClick={() => setBankPage(p => Math.max(1, p - 1))}>Prev</button>
                                  <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page >= pageCount} onClick={() => setBankPage(p => p + 1)}>Next</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </>
                      )
                    }
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
                              <div>{total ? `${start + 1}-${Math.min(end, total)} of ${total}` : '0'}</div>
                              <div className="flex gap-1">
                                <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page <= 1} onClick={() => setBankPage(p => Math.max(1, p - 1))}>Prev</button>
                                <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page >= pageCount} onClick={() => setBankPage(p => p + 1)}>Next</button>
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
          <div className="fixed inset-0 bg-black/40" onClick={() => setViewTxn(null)}></div>
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Transaction Details</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={() => setViewTxn(null)}>✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-500">Section</div><div>{viewTxn.section || '-'}</div></div>
              <div><div className="text-slate-500">Transaction ID</div><div className="font-mono">{viewTxn.transactionId || '-'}</div></div>
              <div><div className="text-slate-500">DateTime</div><div className="leading-tight">{(() => {
                const dateDt = new Date(`${String(viewTxn.dateIso || '').slice(0, 10)}T00:00:00.000Z`)
                const dateLabel = Number.isNaN(dateDt.getTime()) ? String(viewTxn.dateIso || '') : dateDt.toLocaleDateString()
                const timeDt = viewTxn.createdAt ? new Date(String(viewTxn.createdAt)) : null
                const timeLabel = (!timeDt || Number.isNaN(timeDt.getTime())) ? '-' : timeDt.toLocaleTimeString()
                return (
                  <div>
                    <div>{dateLabel || '-'}</div>
                    <div className="text-xs text-slate-500">{timeLabel || '-'}</div>
                  </div>
                )
              })()}</div></div>
              <div><div className="text-slate-500">Account ID(Receiver)</div><div className="font-mono">{viewTxn.accountCode || '-'}</div></div>
              <div><div className="text-slate-500">Account Title(Receiver)</div><div>{viewTxn.accountName || '-'}</div></div>
              <div><div className="text-slate-500">Status</div><div>{viewTxn.status || '-'}</div></div>
              <div><div className="text-slate-500">Amount</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.amount || 0))}`}</div></div>
              <div><div className="text-slate-500">Current Balance</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.current || 0))}`}</div></div>
              <div><div className="text-slate-500">Account ID(Sender)</div><div>{viewTxn.senderAccount || '-'}</div></div>
              <div><div className="text-slate-500">Account Name(Sender)</div><div>{(() => {
                const code = String(viewTxn.senderAccountNameCode || viewTxn.senderAccount || '').trim().toUpperCase()
                if (!code) return '-'
                const b = bankAccounts.find((x: any) => String(x.financeAccountCode || `BANK_${String(x.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase() === code)
                if (b) return `${b.bankName || ''}-${b.accountTitle || ''}`.trim()
                const a = accounts.find(x => String(x.code || '').trim().toUpperCase() === code)
                if (a) return String(a.name || '-')
                return '-'
              })()}</div></div>
              <div className="sm:col-span-2"><div className="text-slate-500">Memo</div><div className="break-words">{viewTxn.memo || '-'}</div></div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn" onClick={() => setViewTxn(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toastOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toastMsg}
          </div>
        </div>
      )}

    </div>
  )
}

