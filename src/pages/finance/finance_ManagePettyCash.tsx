import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Finance_ManagePettyCash() {
  const [pettyAccounts, setPettyAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [pettyCode, setPettyCode] = useState('')
  const [senderAccountKey, setSenderAccountKey] = useState('')
  const [senderBalance, setSenderBalance] = useState<number | null>(null)
  const [loadingSenderBal, setLoadingSenderBal] = useState(false)
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState<number>(0)
  const [memo, setMemo] = useState('')

  const [openingEntries, setOpeningEntries] = useState<Array<{ id: string; txId?: string; dateIso: string; createdAt?: string; account: string; amount: number; memo?: string }>>([])
  const [pettyRefills, setPettyRefills] = useState<Array<{ id: string; txId?: string; dateIso: string; createdAt?: string; pettyCode: string; bankId?: string; amount: number; memo?: string }>>([])

  const [pettyFilterCode, setPettyFilterCode] = useState('')
  const [pettyPageSize, setPettyPageSize] = useState<number>(20)
  const [pettyPage, setPettyPage] = useState<number>(1)
  const [pettyFrom, setPettyFrom] = useState<string>('')
  const [pettyTo, setPettyTo] = useState<string>('')
  const [viewTxn, setViewTxn] = useState<any | null>(null)
  const [successDialog, setSuccessDialog] = useState<{ show: boolean; senderName: string; receiverName: string; amount: number; senderCode: string; receiverCode: string } | null>(null)

  const [ledgerRows, setLedgerRows] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

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

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const [pettyRes, bankRes]: any = await Promise.all([
            hospitalApi.listPettyCashAccounts(),
            hospitalApi.listBankAccounts({ status: 'Active' }),
          ])
          let mineRes: any = null
          try { mineRes = await hospitalApi.myPettyCash() as any } catch { mineRes = null }
          const petty = (pettyRes?.accounts || []).map((p: any) => ({
            id: String(p.id || p._id || p.code),
            code: String(p.code || ''),
            name: String(p.name || ''),
          }))
          const bankRaw = (bankRes?.accounts || [])
          if (!cancelled) {
            setPettyAccounts(petty)
            setBankAccounts(bankRaw)
            const myCode = String(mineRes?.account?.code || '').trim().toUpperCase()
            setPettyFilterCode(prev => prev || myCode || '')
          }
        } catch {
          if (!cancelled) { setPettyAccounts([]); setBankAccounts([]) }
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
          const r: any = await hospitalApi.listPettyRefillEntries()
          const rows = (r?.entries || []).map((x: any) => ({ id: String(x.id), txId: x.txId ? String(x.txId) : undefined, dateIso: x.dateIso, createdAt: x.createdAt, pettyCode: String(x.pettyCode || ''), bankId: x.bankId ? String(x.bankId) : undefined, amount: Number(x.amount || 0), memo: x.memo }))
          if (!cancelled) setPettyRefills(rows)
        } catch {
          if (!cancelled) setPettyRefills([])
        }
      })()
    return () => { cancelled = true }
  }, [pettyAccounts])

  useEffect(() => { setPettyPage(1) }, [pettyFilterCode, pettyPageSize, pettyFrom, pettyTo])

  useEffect(() => {
    if (!pettyFilterCode) { setLedgerRows([]); return }
    void loadLedger(pettyFilterCode, pettyFrom || undefined, pettyTo || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pettyFilterCode, pettyFrom, pettyTo])

  useEffect(() => {
    (async () => {
      const key = String(senderAccountKey || '')
      if (!key) { setSenderBalance(null); return }
      setLoadingSenderBal(true)
      try {
        let finCode = ''
        if (key.startsWith('BANK:')) {
          const id = key.slice('BANK:'.length)
          const b: any = bankAccounts.find((x: any) => String(x.id || x._id) === id)
          finCode = String(b?.financeAccountCode || `BANK_${String(b?.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
        } else if (key.startsWith('PETTY:')) {
          finCode = key.slice('PETTY:'.length).trim().toUpperCase()
        }
        if (!finCode) { setSenderBalance(0); return }
        const res: any = await hospitalApi.getFinanceAccountBalance(finCode)
        setSenderBalance(Number(res?.balance || 0))
      } catch {
        setSenderBalance(0)
      } finally {
        setLoadingSenderBal(false)
      }
    })()
  }, [senderAccountKey, bankAccounts])

  async function reloadRefills() {
    try {
      const r: any = await hospitalApi.listPettyRefillEntries()
      const rows = (r?.entries || []).map((x: any) => ({ id: String(x.id), txId: x.txId ? String(x.txId) : undefined, dateIso: x.dateIso, createdAt: x.createdAt, pettyCode: String(x.pettyCode || ''), bankId: x.bankId ? String(x.bankId) : undefined, amount: Number(x.amount || 0), memo: x.memo }))
      setPettyRefills(rows)
    } catch { }
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Manage Petty Cash</div>
        <div className="text-sm text-slate-500">Transfer funds from bank to petty cash and view balances</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input type="date" value={dateIso} onChange={e => setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Petty Cash Account (Receiver)</label>
            <select value={pettyCode} onChange={e => setPettyCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select petty cash</option>
              {pettyAccounts.map(a => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Account (Sender)</label>
            <select value={senderAccountKey} onChange={e => setSenderAccountKey(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select sender account</option>
              {bankAccounts.map((b: any) => {
                const id = String(b.id || b._id)
                const finCode = String(b.financeAccountCode || `BANK_${String(b.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
                const label = `${b.bankName || ''} — ${b.accountTitle || ''}`.trim()
                return (
                  <option key={`BANK:${id}`} value={`BANK:${id}`}>
                    {`[BANK] ${finCode} — ${label}`.trim()}
                  </option>
                )
              })}
              {pettyAccounts.map(a => (
                <option key={`PETTY:${a.id}`} value={`PETTY:${a.code}`}>
                  {`[PETTY] ${a.code} — ${a.name}`}
                </option>
              ))}
            </select>
            {senderAccountKey && (
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
              if (!dateIso || !pettyCode || !(amount > 0) || !senderAccountKey) return
              try {
                if (String(senderAccountKey).startsWith('BANK:')) {
                  const bankId = String(senderAccountKey).slice('BANK:'.length)
                  await hospitalApi.refillPettyCash({ pettyCode, bankId, amount: Number(amount || 0), dateIso, memo })
                } else if (String(senderAccountKey).startsWith('PETTY:')) {
                  const fromAccountCode = String(senderAccountKey).slice('PETTY:'.length).trim().toUpperCase()
                  await hospitalApi.transferPettyCash({ toPettyCode: pettyCode, fromAccountCode, amount: Number(amount || 0), dateIso, memo })
                }
                await reloadRefills()
                if (pettyCode) {
                  await loadLedger(pettyCode, pettyFrom || undefined, pettyTo || undefined)
                }
                const receiverName = pettyAccounts.find(a => a.code === pettyCode)?.name || pettyCode
              const senderName = senderAccountKey.startsWith('PETTY:') 
                ? (pettyAccounts.find(a => a.code === senderAccountKey.slice('PETTY:'.length).trim().toUpperCase())?.name || senderAccountKey.slice('PETTY:'.length))
                : (bankAccounts.find((b: any) => String(b.id || b._id) === senderAccountKey.slice('BANK:'.length))?.accountTitle || senderAccountKey)
              const senderCode = senderAccountKey.startsWith('PETTY:') 
                ? senderAccountKey.slice('PETTY:'.length).trim().toUpperCase()
                : 'BANK'
              
              setSuccessDialog({
                show: true,
                senderName,
                receiverName,
                amount: Number(amount || 0),
                senderCode,
                receiverCode: pettyCode
              })
              } catch (e: any) {
                alert(e?.message || 'Failed')
              }
            }}
          >Transfer</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Petty Cash Transactions</div>
          <button
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            disabled={!pettyFilterCode || ledgerLoading}
            onClick={() => void loadLedger(pettyFilterCode, pettyFrom || undefined, pettyTo || undefined)}
          >Reload</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={pettyFrom} onChange={e => setPettyFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
            <input type="date" value={pettyTo} onChange={e => setPettyTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={() => {
                const t = new Date().toISOString().slice(0, 10)
                setPettyFrom(t)
                setPettyTo(t)
              }}
            >Today</button>
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={() => {
                setPettyFrom('')
                setPettyTo('')
                setPettyFilterCode('')
                setPettyPageSize(20)
                setPettyPage(1)
              }}
            >Reset</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pettyFilterCode} onChange={e => setPettyFilterCode(e.target.value)} className="min-w-[220px] rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value="">All petty cash</option>
              {pettyAccounts.map(a => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
            <select value={pettyPageSize} onChange={e => setPettyPageSize(Number(e.target.value || 20))} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {(() => {
          if (pettyFilterCode) {
            if (ledgerRows.length === 0) {
              return <div className="mt-3 text-sm text-slate-500">{ledgerLoading ? 'Loading...' : 'No transactions found.'}</div>
            }
            const fmt = new Intl.NumberFormat('en-PK')

            const resolveAccountTitle = (code: string) => {
              const c = String(code || '').trim().toUpperCase()
              if (!c) return '-'
              const b = bankAccounts.find((x: any) => String(x.financeAccountCode || `BANK_${String(x.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase() === c)
              if (b) return `${b.bankName || ''} - ${b.accountTitle || ''}`.trim()
              const p = pettyAccounts.find(x => String(x.code || '').trim().toUpperCase() === c)
              if (p) return String(p.name || '-')
              return '-'
            }

            const getCounterpartyCodes = (t: any) => {
              const cps = Array.isArray(t?.counterparties) ? t.counterparties : []
              const codes = cps.map((c: any) => String(c?.account || '').trim()).filter(Boolean)
              return codes
            }

            const sorted = ledgerRows.slice().sort((a: any, b: any) => {
              const da = String(a?.dateIso || '')
              const db = String(b?.dateIso || '')
              if (da !== db) return da.localeCompare(db)
              const ca = String(a?.createdAt || '')
              const cb = String(b?.createdAt || '')
              if (ca !== cb) return ca.localeCompare(cb)
              return String(a?.id || '').localeCompare(String(b?.id || ''))
            })

            let running = 0
            const rows: any[] = []
            for (const t of sorted) {
              const dt = t?.createdAt ? new Date(String(t.createdAt)) : null
              const dLabel = String(t.dateIso || '')
              const timeLabel = (!dt || Number.isNaN(dt.getTime())) ? '-' : dt.toLocaleTimeString()
              // For the selected account: debit increases balance, credit decreases balance
              const delta = Number(t.debit || 0) - Number(t.credit || 0)
              running = running + delta
              const statusLabel = delta > 0 ? 'Credit' : (delta < 0 ? 'Debit' : '—')
              const statusCls = delta > 0 ? 'bg-green-100 text-green-700' : (delta < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')
              const cpCodes = getCounterpartyCodes(t)
              const cp = cpCodes.length ? cpCodes.join(', ') : '-'

              const receiverCode = delta < 0 ? (cpCodes[0] || '-') : pettyFilterCode
              const senderCode = delta > 0 ? (cpCodes[0] || '-') : pettyFilterCode

              rows.unshift(
                <tr key={String(t.id)} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{String(t.txId || `TXN-${String(t.id)}`)}</td>
                  <td className="py-2 pr-4">
                    <div className="leading-tight">
                      <div>{dLabel}</div>
                      <div className="text-xs text-slate-500">{timeLabel}</div>
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
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusCls}`}>{statusLabel}</span>
                  </td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(Number(delta || 0))}</td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(running)}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => setViewTxn({
                        section: 'Petty',
                        transactionId: String(t.txId || `TXN-${String(t.id)}`),
                        dateIso: t.dateIso,
                        createdAt: t.createdAt,
                        accountCode: receiverCode,
                        accountName: resolveAccountTitle(receiverCode),
                        senderAccount: senderCode,
                        senderAccountNameCode: cpCodes[0] || '',
                        status: statusLabel,
                        amount: delta,
                        current: running,
                        memo: t.memo || '-',
                        counterparties: cp,
                      })}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </td>
                </tr>
              )
            }
            return (
              <div className="mt-3 overflow-x-auto">
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
                  <tbody>{rows}</tbody>
                </table>
              </div>
            )
          }

          const openingPetty = openingEntries.filter(e => {
            if (!pettyAccounts.some(a => a.code === e.account)) return false
            if (pettyFilterCode && e.account !== pettyFilterCode) return false
            if (pettyFrom && String(e.dateIso || '') < pettyFrom) return false
            if (pettyTo && String(e.dateIso || '') > pettyTo) return false
            return true
          })
          const refillPetty = pettyRefills.map(r => {
            const b: any = bankAccounts.find(x => String(x.id || x._id) === String(r.bankId || ''))
            const fromCode = b
              ? String(b.financeAccountCode || `BANK_${String(b.accountNumber || '').slice(-4)}`.toUpperCase()).trim().toUpperCase()
              : String(r.bankId || '').trim().toUpperCase()
            return { id: r.id, dateIso: r.dateIso, createdAt: (r as any).createdAt, account: r.pettyCode, amount: Math.abs(Number(r.amount || 0)), memo: r.memo, transferFrom: fromCode }
          }).filter(e => {
            if (pettyFilterCode && e.account !== pettyFilterCode) return false
            if (pettyFrom && String(e.dateIso || '') < pettyFrom) return false
            if (pettyTo && String(e.dateIso || '') > pettyTo) return false
            return true
          })
          const entries = [...openingPetty, ...refillPetty]
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
            const meta = pettyAccounts.find(a => a.code === code)
            for (let i = 0; i < list.length; i++) {
              const e = list[i]
              running = running + Number(e.amount || 0)
              const dateDt = new Date(`${String(e.dateIso || '').slice(0, 10)}T00:00:00.000Z`)
              const dateLabel = Number.isNaN(dateDt.getTime()) ? String(e.dateIso || '') : dateDt.toLocaleDateString()
              const timeDt = (e as any)?.createdAt ? new Date(String((e as any)?.createdAt)) : null
              const timeLabel = (!timeDt || Number.isNaN(timeDt.getTime())) ? '-' : timeDt.toLocaleTimeString()
              const txnId = txnIdById[String((e as any)?.id || '')] || String((e as any)?.id || '-')
              const receiverCode = String(e.account || '-')
              const senderCode = String(e.transferFrom || '-')
              rows.unshift(
                <tr key={`petty-${e.id}-${i}`} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{txnId}</td>
                  <td className="py-2 pr-4">
                    <div className="leading-tight">
                      <div>{dateLabel || '-'}</div>
                      <div className="text-xs text-slate-500">{timeLabel || '-'}</div>
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono">{receiverCode || '-'}</td>
                  <td className="py-2 pr-4">{senderCode || '-'}</td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Credit</span>
                  </td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(Number(e.amount || 0))}</td>
                  <td className="py-2 pr-4 text-right">Rs. {fmt.format(running)}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => setViewTxn({
                        section: 'Petty',
                        transactionId: txnId,
                        dateIso: e.dateIso,
                        createdAt: (e as any)?.createdAt,
                        accountCode: receiverCode,
                        accountName: meta?.name || '-',
                        senderAccount: senderCode,
                        senderAccountNameCode: senderCode,
                        status: 'Credit',
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
          const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pettyPageSize)))
          const page = Math.min(Math.max(1, pettyPage), pageCount)
          const start = (page - 1) * pettyPageSize
          const end = start + pettyPageSize

          return (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-max w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">Transaction ID</th>
                    <th className="py-2 pr-4">DateTime</th>
                    <th className="py-2 pr-4">Account ID(Receiver)</th>
                    <th className="py-2 pr-4">Account ID(Sender)</th>
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
                          <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page <= 1} onClick={() => setPettyPage(p => Math.max(1, p - 1))}>Prev</button>
                          <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" disabled={page >= pageCount} onClick={() => setPettyPage(p => p + 1)}>Next</button>
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
                const p = pettyAccounts.find(x => String(x.code || '').trim().toUpperCase() === code)
                if (p) return String(p.name || '-')
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

      {successDialog && successDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-semibold text-slate-800">Transfer Successful</h3>
            <div className="mb-4 rounded-lg bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{successDialog.senderName}</div>
                  <div className="text-xs text-slate-500">{successDialog.senderCode}</div>
                </div>
                <div className="text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-800">{successDialog.receiverName}</div>
                  <div className="text-xs text-slate-500">{successDialog.receiverCode}</div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Amount Transferred:</span>
                  <span className="text-lg font-bold text-green-600">Rs. {new Intl.NumberFormat('en-PK').format(successDialog.amount)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSuccessDialog(null)}
              className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
