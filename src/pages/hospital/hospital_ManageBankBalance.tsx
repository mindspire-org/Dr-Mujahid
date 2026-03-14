import { useEffect, useMemo, useRef, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Hospital_ManageBankBalance() {
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [pettyAccounts, setPettyAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])

  const [bankCode, setBankCode] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [senderAccountCode, setSenderAccountCode] = useState(() => {
    try { return String(localStorage.getItem('hospital.bank.senderAccountCode') || '') } catch { return '' }
  })
  const [senderBalance, setSenderBalance] = useState<number | null>(null)
  const [loadingSenderBal, setLoadingSenderBal] = useState(false)
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState<number>(0)
  const [memo, setMemo] = useState('')

  const [openingEntries, setOpeningEntries] = useState<Array<{ id: string; txId?: string; dateIso: string; createdAt?: string; account: string; amount: number; memo?: string }>>([])
  const [pullHistory, setPullHistory] = useState<Array<{ id: string; txId?: string; dateIso: string; createdAt?: string; memo?: string; debit: number; credit: number; refId?: string }>>([])

  const [bankFilterCode, setBankFilterCode] = useState('')
  const [bankPageSize, setBankPageSize] = useState<number>(20)
  const [bankPage, setBankPage] = useState<number>(1)
  const [bankFrom, setBankFrom] = useState<string>('')
  const [bankTo, setBankTo] = useState<string>('')
  const [viewTxn, setViewTxn] = useState<any | null>(null)

  const [ledgerRows, setLedgerRows] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const [successDialog, setSuccessDialog] = useState<{ open: boolean; sender?: string; receiver?: string; amount?: number }>({ open: false })

  const loadLedger = async (code: string, from?: string, to?: string) => {
    const acct = String(code || '').trim().toUpperCase()
    if (!acct) { setLedgerRows([]); return }
    setLedgerLoading(true)
    try {
      const res: any = await hospitalApi.listFinanceAccountTransactions({ code: acct, from, to, limit: 200 })
      setLedgerRows(res?.entries || [])
    } catch {
      setLedgerRows([])
    } finally {
      setLedgerLoading(false)
    }
  }

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
        try {
          const mine: any = await hospitalApi.myBankAccount()
          const [bankRes, pettyRes]: any = await Promise.all([
            hospitalApi.listBankAccounts({ status: 'Active' }),
            hospitalApi.listPettyCashAccounts({ status: 'Active' }),
          ])
          const bankRaw = (bankRes?.accounts || [])
          const petty = (pettyRes?.accounts || []).map((p: any) => ({
            id: String(p.id || p._id || p.code),
            code: String(p.code || ''),
            name: String(p.name || ''),
          }))
          if (!cancelled) {
            setBankAccounts(bankRaw)
            setPettyAccounts(petty)
            const code = String(mine?.account?.financeAccountCode || '').trim().toUpperCase()
            const name = `${mine?.account?.bankName || ''} — ${mine?.account?.accountTitle || ''}`.trim()
            setBankCode(code)
            setBankAccountName(name || code)
            setBankFilterCode(code)

            if (code) {
              try {
                const key = `hospital.bankAssignedToastShown:${code}`
                const shown = sessionStorage.getItem(key)
                if (!shown) {
                  sessionStorage.setItem(key, '1')
                  showToast(`Bank account assigned: ${code}`)
                }
              } catch { }
            }
          }
        } catch {
          if (!cancelled) { setBankAccounts([]); setPettyAccounts([]) }
        }
      })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res: any = await hospitalApi.listOpeningBalanceEntries()
          const entries: Array<{ id: string; txId?: string; dateIso: string; createdAt?: string; account: string; amount: number; memo?: string }> = (res?.entries || []).map((e: any) => ({ id: String(e.id), txId: e.txId ? String(e.txId) : undefined, dateIso: e.dateIso, createdAt: e.createdAt, account: e.account, amount: Number(e.amount || 0), memo: e.memo }))
          if (!cancelled) setOpeningEntries(entries)
        } catch {
          if (!cancelled) setOpeningEntries([])
        }
        try {
          const r: any = await hospitalApi.listMyBankPullHistory()
          const rows = (r?.entries || []).map((x: any) => ({ id: String(x.id), txId: x.txId ? String(x.txId) : undefined, dateIso: x.dateIso, createdAt: x.createdAt, memo: x.memo, debit: Number(x.debit || 0), credit: Number(x.credit || 0), refId: x.refId }))
          if (!cancelled) setPullHistory(rows)
        } catch {
          if (!cancelled) setPullHistory([])
        }
      })()
    return () => { cancelled = true }
  }, [bankAccounts])

  useEffect(() => {
    try { localStorage.setItem('hospital.bank.senderAccountCode', String(senderAccountCode || '')) } catch { }
  }, [senderAccountCode])

  useEffect(() => {
    setBankFrom(dateIso)
    setBankTo(dateIso)
  }, [dateIso])

  useEffect(() => {
    if (!bankFilterCode) { setLedgerRows([]); return }
    void loadLedger(bankFilterCode, bankFrom || undefined, bankTo || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankFilterCode, bankFrom, bankTo])

  useEffect(() => { setBankPage(1) }, [bankFilterCode, bankPageSize, bankFrom, bankTo])

  useEffect(() => {
    (async () => {
      const code = String(senderAccountCode || '').trim().toUpperCase()
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
  }, [senderAccountCode])

  async function reloadPullHistory() {
    try {
      const r: any = await hospitalApi.listMyBankPullHistory()
      const rows = (r?.entries || []).map((x: any) => ({ id: String(x.id), txId: x.txId ? String(x.txId) : undefined, dateIso: x.dateIso, createdAt: x.createdAt, memo: x.memo, debit: Number(x.debit || 0), credit: Number(x.credit || 0), refId: x.refId }))
      setPullHistory(rows)
    } catch { }
  }

  const entries = useMemo(() => {
    const acct = String(bankFilterCode || '').trim().toUpperCase()
    if (acct) {
      return (ledgerRows || []).map((t: any) => {
        const delta = Number(t?.debit || 0) - Number(t?.credit || 0)
        const cp = Array.isArray(t?.counterparties) ? t.counterparties : []
        const cpCodes = cp.map((c: any) => String(c?.account || '').trim().toUpperCase()).filter(Boolean)
        const counterpartyCode = cpCodes[0] || undefined
        return {
          id: String(t?.id || ''),
          txId: String(t?.txId || ''),
          dateIso: String(t?.dateIso || ''),
          createdAt: t?.createdAt,
          createdBy: t?.createdBy,
          user: t?.user,
          account: acct,
          amount: delta,
          memo: t?.memo,
          transferFrom: delta < 0 ? acct : counterpartyCode,
          transferTo: delta < 0 ? counterpartyCode : acct,
        }
      })
    }

    const openingBank = openingEntries.filter(e => {
      if (bankFrom && String(e.dateIso || '') < bankFrom) return false
      if (bankTo && String(e.dateIso || '') > bankTo) return false
      return true
    })
    const pulls = pullHistory.map(h => {
      const net = Number(h.debit || 0) - Number(h.credit || 0)
      const ref = String(h.refId || '')
      const fromCode = ref.includes('=>') ? ref.split('=>')[0] : ''
      const toCode = ref.includes('=>') ? ref.split('=>')[1] : ''
      return { id: h.id, txId: h.txId, dateIso: h.dateIso, createdAt: h.createdAt, account: bankCode, amount: net, memo: h.memo, refId: h.refId, transferFrom: fromCode || undefined, transferTo: toCode || undefined }
    }).filter(e => {
      if (bankFrom && String(e.dateIso || '') < bankFrom) return false
      if (bankTo && String(e.dateIso || '') > bankTo) return false
      return true
    })
    return [...openingBank, ...pulls]
  }, [openingEntries, pullHistory, bankFrom, bankTo, bankCode, bankFilterCode, ledgerRows])

  const { totalDebit, totalCredit, bankBalance } = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const e of entries as any[]) {
      const amt = Number((e as any)?.amount || 0)
      if (amt >= 0) debit += amt
      else credit += Math.abs(amt)
    }
    return { totalDebit: debit, totalCredit: credit, bankBalance: debit - credit }
  }, [entries])

  const compactAmount = (value: number) => {
    const num = Number(value || 0)
    const abs = Math.abs(num)
    const sign = num < 0 ? '-' : ''
    if (abs >= 1_000_000) {
      const n = abs / 1_000_000
      const dec = abs >= 10_000_000 ? 0 : 1
      return `${sign}${n.toFixed(dec).replace(/\.0$/, '')}M`
    }
    if (abs >= 100_000) {
      const n = abs / 1_000
      const dec = abs >= 1_000_000 ? 0 : 1
      return `${sign}${n.toFixed(dec).replace(/\.0$/, '')}k`
    }
    return new Intl.NumberFormat('en-PK').format(num)
  }

  return (
    <div className="w-full px-3 py-4 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Manage Bank Balance</div>
        <div className="text-sm text-slate-500">Transfer funds to your bank account and view balances</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Bank Balance</div>
          <div className="mt-1 text-2xl font-semibold">Rs. {compactAmount(Number(bankBalance || 0))}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Total Credit</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">Rs. {compactAmount(Number(totalDebit || 0))}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Total Debit</div>
          <div className="mt-1 text-2xl font-semibold text-rose-600">Rs. {compactAmount(Number(totalCredit || 0))}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={dateIso} onChange={e => setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Bank Account (Receiver)</label>
            <select value={bankCode} disabled className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <option value={bankCode}>{bankCode ? `${bankCode} — ${bankAccountName}` : 'No bank account assigned'}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Sender Accounts</label>
            <select value={senderAccountCode} onChange={e => setSenderAccountCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select sender account</option>
              {bankAccounts
                .filter((b: any) => {
                  const finCode = String(b.financeAccountCode || `BANK_${String(b.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
                  return finCode && finCode !== String(bankCode || '').trim().toUpperCase()
                })
                .map((b: any) => {
                  const finCode = String(b.financeAccountCode || `BANK_${String(b.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
                  const label = `${b.bankName || ''} — ${b.accountTitle || ''}`.trim()
                  return (
                    <option key={`BANK:${String(b.id || b._id)}`} value={finCode}>
                      {`[BANK] ${finCode} — ${label}`.trim()}
                    </option>
                  )
                })}
              {pettyAccounts.map(a => (
                <option key={`PETTY:${a.id}`} value={a.code}>
                  {`[PETTY] ${a.code} — ${a.name}`}
                </option>
              ))}
            </select>
            {senderAccountCode && (
              <div className="mt-2 text-sm">
                <span className="text-slate-600">Current Sender Balance: </span>
                <span className="font-medium">
                  {loadingSenderBal ? 'Loading...' : `Rs. ${new Intl.NumberFormat('en-PK').format(Number(senderBalance || 0))}`}
                </span>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input value={amount || ''} onChange={e => setAmount(Number(e.target.value || 0))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Memo (optional)</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Transfer" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn"
            onClick={async () => {
              if (!dateIso || !bankCode || !(amount > 0) || !senderAccountCode) return
              try {
                await hospitalApi.pullFundsToMyBank({ fromAccountCode: senderAccountCode, amount: Number(amount || 0), dateIso, memo })
                await reloadPullHistory()
                if (bankCode) {
                  await loadLedger(bankCode, bankFrom || undefined, bankTo || undefined)
                }
                setBankFilterCode(bankCode)

                const sender = bankAccounts.find((b: any) => {
                  const finCode = String(b.financeAccountCode || `BANK_${String(b.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
                  return finCode === senderAccountCode
                })
                const senderName = sender ? `${sender.bankName || ''} — ${sender.accountTitle || ''}`.trim() : senderAccountCode
                const receiver = bankAccounts.find((b: any) => String(b.financeAccountCode || '').trim().toUpperCase() === bankCode)
                const receiverName = receiver ? `${receiver.bankName || ''} — ${receiver.accountTitle || ''}`.trim() : bankCode

                setSuccessDialog({
                  open: true,
                  sender: `${senderAccountCode}${senderName ? ` — ${senderName}` : ''}`,
                  receiver: `${bankCode}${receiverName ? ` — ${receiverName}` : ''}`,
                  amount: Number(amount || 0)
                })

                setSenderAccountCode('')
                setAmount(0)
                setMemo('')
              } catch (e: any) {
                alert(e?.message || 'Failed')
              }
            }}
          >Receive</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-semibold">Bank Transactions</div>
          {ledgerLoading && <div className="text-xs text-slate-500 animate-pulse">Loading Ledger...</div>}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input type="date" value={bankFrom} onChange={e => setBankFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <input type="date" value={bankTo} onChange={e => setBankTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  setBankFilterCode(bankCode)
                  setBankPageSize(20)
                  setBankPage(1)
                }}
              >Reset</button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <select value={bankPageSize} onChange={e => setBankPageSize(Number(e.target.value || 20))} className="w-full sm:w-auto rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {(() => {
          if (entries.length === 0) {
            return <div className="mt-3 text-sm text-slate-500">No entry yet.</div>
          }

          const txnIdById: Record<string, string> = {}
          for (const e of entries) {
            const id = String((e as any)?.id || '')
            const txId = String((e as any)?.txId || '')
            txnIdById[id] = txId || `TXN-${id}`
          }

          const byAccount: Record<string, any[]> = {}
          for (const e of entries) {
            if (!byAccount[e.account]) byAccount[e.account] = []
            byAccount[e.account].push(e)
          }

          const rows: any[] = []
          const fmt = new Intl.NumberFormat('en-PK')
          Object.keys(byAccount).forEach(code => {
            const list = byAccount[code].slice().sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.id.localeCompare(b.id))
            let running = 0
            for (let i = 0; i < list.length; i++) {
              const e = list[i]
              running = running + Number(e.amount || 0)
              const dateDt = new Date(`${String(e.dateIso || '').slice(0, 10)}T00:00:00.000Z`)
              const dateLabel = Number.isNaN(dateDt.getTime()) ? String(e.dateIso || '') : dateDt.toLocaleDateString()
              const timeDt = (e as any)?.createdAt ? new Date(String((e as any)?.createdAt)) : null
              const timeLabel = (!timeDt || Number.isNaN(timeDt.getTime())) ? '-' : timeDt.toLocaleTimeString()
              const txnId = txnIdById[String((e as any)?.id || '')] || String((e as any)?.id || '-')
              const delta = Number(e.amount || 0)
              const statusLabel = delta > 0 ? 'Credit' : (delta < 0 ? 'Debit' : '—')
              const statusCls = delta > 0 ? 'bg-green-100 text-green-700' : (delta < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')
              const receiverCode = String((e as any)?.transferTo || e.account || '')
              rows.unshift(
                <tr key={`bank-${e.id}-${i}`} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{txnId}</td>
                  <td className="py-2 pr-4">
                    <div className="leading-tight">
                      <div>{dateLabel || '-'}</div>
                      <div className="text-xs text-slate-500">{timeLabel || '-'}</div>
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono">{receiverCode || '-'}</td>
                  <td className="py-2 pr-4">{e.transferFrom || '-'}</td>
                  <td className="py-2 pr-4">{(() => {
                    const u = (e as any)?.user
                    const name = String(u?.fullName || u?.username || (e as any)?.createdBy || '-').trim() || '-'
                    const role = String(u?.role || '').trim()
                    return role ? `${name}-${role}` : name
                  })()}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(Number(e.amount || 0))}</td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(running)}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => setViewTxn({
                        section: 'Bank',
                        transactionId: txnId,
                        dateIso: e.dateIso,
                        createdAt: (e as any)?.createdAt,
                        accountCode: e.account,
                        accountName: '-',
                        senderAccount: e.transferFrom || '-',
                        status: statusLabel,
                        amount: Number(e.amount || 0),
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
          const pageCount = Math.max(1, Math.ceil(total / Math.max(1, bankPageSize)))
          const page = Math.min(Math.max(1, bankPage), pageCount)
          const start = (page - 1) * bankPageSize
          const end = start + bankPageSize

          return (
            <div className="mt-3 w-full overflow-x-auto">
              <table className="min-w-max w-full text-sm">
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
                  {rows.slice(start, end)}
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
                </tbody>
              </table>
            </div>
          )
        })()}
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
              <div><div className="text-slate-500">Account ID</div><div className="font-mono">{viewTxn.accountCode || '-'}</div></div>
              <div><div className="text-slate-500">Status</div><div>{viewTxn.status || '-'}</div></div>
              <div><div className="text-slate-500">Amount</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.amount || 0))}`}</div></div>
              <div><div className="text-slate-500">Current Balance</div><div>{`Rs. ${new Intl.NumberFormat('en-PK').format(Number(viewTxn.current || 0))}`}</div></div>
              <div><div className="text-slate-500">Account(Sender)</div><div>{viewTxn.senderAccount || '-'}</div></div>
              <div className="sm:col-span-2"><div className="text-slate-500">Memo</div><div className="break-words">{viewTxn.memo || '-'}</div></div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn" onClick={() => setViewTxn(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {successDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSuccessDialog({ open: false })}></div>
          <div className="relative z-50 w-full max-w-md bg-white rounded-2xl shadow-xl p-6 m-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Transfer Successful</h3>
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">From:</span>
                <span className="font-medium text-slate-700">{successDialog.sender}</span>
              </div>
              <div className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">To:</span>
                <span className="font-medium text-slate-700">{successDialog.receiver}</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Amount transferred:</span>
                  <span className="font-semibold text-green-600">Rs. {new Intl.NumberFormat('en-PK').format(Number(successDialog.amount || 0))}</span>
                </div>
              </div>
            </div>
            <button
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              onClick={() => setSuccessDialog({ open: false })}
            >
              OK
            </button>
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
