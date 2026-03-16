import { useEffect, useRef, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Finance_BankAccounts(){
  const [list, setList] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [bankName, setBankName] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [swift, setSwift] = useState('')
  const [responsibleStaff, setResponsibleStaff] = useState('')
  const [status, setStatus] = useState<'Active'|'Inactive'>('Active')
  const [loading, setLoading] = useState(false)
  const [viewItem, setViewItem] = useState<any|null>(null)
  const [editItem, setEditItem] = useState<any|null>(null)
  const [editBankName, setEditBankName] = useState('')
  const [editAccountTitle, setEditAccountTitle] = useState('')
  const [editAccountNumber, setEditAccountNumber] = useState('')
  const [editBranchName, setEditBranchName] = useState('')
  const [editBranchCode, setEditBranchCode] = useState('')
  const [editSwift, setEditSwift] = useState('')
  const [editStatus, setEditStatus] = useState<'Active'|'Inactive'>('Active')
  const [editResponsibleStaff, setEditResponsibleStaff] = useState('')

  const [txnOpen, setTxnOpen] = useState(false)
  const [txnBank, setTxnBank] = useState<any|null>(null)
  const [txnFrom, setTxnFrom] = useState('')
  const [txnTo, setTxnTo] = useState('')
  const [txnRows, setTxnRows] = useState<any[]>([])
  const [txnLoading, setTxnLoading] = useState(false)

  const [deleteItem, setDeleteItem] = useState<any|null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  const openTransactions = async (bank: any) => {
    setTxnBank(bank)
    setTxnOpen(true)
    setTxnRows([])
    const finCode = String(bank?.financeAccountCode || `BANK_${String(bank?.accountNumber||'').slice(-4)}`.toUpperCase()).trim().toUpperCase()
    setTxnLoading(true)
    try {
      const res: any = await hospitalApi.listFinanceAccountTransactions({ code: finCode, from: txnFrom || undefined, to: txnTo || undefined, limit: 200 })
      setTxnRows(res?.entries || [])
    } catch (e: any) {
      alert(e?.message || 'Failed to load transactions')
    } finally {
      setTxnLoading(false)
    }
  }

  async function reload(){
    setLoading(true)
    try {
      const res: any = await hospitalApi.listBankAccounts()
      setList(res?.accounts || [])
    } finally { setLoading(false) }
  }
  async function reloadUsers(){
    try {
      const res: any = await hospitalApi.listHospitalUsers()
      setUsers(Array.isArray(res?.users) ? res.users : [])
    } catch {
      setUsers([])
    }
  }
  useEffect(()=>{ reload(); reloadUsers() }, [])

  async function create(){
    if (!bankName || !accountTitle || !accountNumber || !status) return alert('Please fill required fields')
    setLoading(true)
    try {
      await hospitalApi.createBankAccount({ bankName, accountTitle, accountNumber, branchName: branchName||undefined, branchCode: branchCode||undefined, swift: swift||undefined, responsibleStaff: responsibleStaff||undefined, status })
      setBankName(''); setAccountTitle(''); setAccountNumber(''); setBranchName(''); setBranchCode(''); setSwift(''); setResponsibleStaff(''); setStatus('Active')
      await reload()
      showToast('Bank account created')
    } catch(e: any){ alert(e?.message || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Bank Accounts</div>
        <div className="text-sm text-slate-500">Add bank accounts</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Bank Name</label>
            <input value={bankName} onChange={e=> setBankName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account Title</label>
            <input value={accountTitle} onChange={e=> setAccountTitle(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account#/IBAN</label>
            <input value={accountNumber} onChange={e=> setAccountNumber(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Branch Name</label>
            <input value={branchName} onChange={e=> setBranchName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Branch Code</label>
            <input value={branchCode} onChange={e=> setBranchCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Swift</label>
            <input value={swift} onChange={e=> setSwift(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Assigned User</label>
            <select value={responsibleStaff} onChange={e=> setResponsibleStaff(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">-- Select User --</option>
              {users.map((u:any)=>(
                <option key={String(u.id)} value={String(u.username||'')}>{`${String(u.username||'')}-${String(u.role||'')}`}</option>
              ))}
              {!!responsibleStaff && !users.some((u:any)=> String(u.username||'') === responsibleStaff) && (
                <option value={responsibleStaff}>{responsibleStaff}</option>
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select value={status} onChange={e=> setStatus(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn" disabled={loading} onClick={create}>Create Bank Account</button>
        </div>
      </div>

      {/* View Details Dialog */}
      {viewItem && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={()=> setViewItem(null)}></div>
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Bank Account Details</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> setViewItem(null)}>✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-500">Bank</div><div>{viewItem.bankName}</div></div>
              <div><div className="text-slate-500">Title</div><div>{viewItem.accountTitle}</div></div>
              <div><div className="text-slate-500">Account#/IBAN</div><div className="font-mono">{viewItem.accountNumber}</div></div>
              <div><div className="text-slate-500">Status</div><div>{viewItem.status}</div></div>
              {viewItem.branchName && (<div><div className="text-slate-500">Branch Name</div><div>{viewItem.branchName}</div></div>)}
              {viewItem.branchCode && (<div><div className="text-slate-500">Branch Code</div><div>{viewItem.branchCode}</div></div>)}
              {viewItem.swift && (<div><div className="text-slate-500">Swift</div><div>{viewItem.swift}</div></div>)}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn" onClick={()=> setViewItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editItem && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={()=> setEditItem(null)}></div>
          <div className="relative z-50 w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Edit Bank Account</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> setEditItem(null)}>✕</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bank Name</label>
                <input value={editBankName} onChange={e=> setEditBankName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Account Title</label>
                <input value={editAccountTitle} onChange={e=> setEditAccountTitle(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Account#/IBAN</label>
                <input value={editAccountNumber} disabled className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Branch Name</label>
                <input value={editBranchName} onChange={e=> setEditBranchName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Branch Code</label>
                <input value={editBranchCode} onChange={e=> setEditBranchCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Swift</label>
                <input value={editSwift} onChange={e=> setEditSwift(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select value={editStatus} onChange={e=> setEditStatus(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assigned User</label>
                <select value={editResponsibleStaff} onChange={e=> setEditResponsibleStaff(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="">-- Select User --</option>
                  {users.map((u:any)=>(
                    <option key={String(u.id)} value={String(u.username||'')}>{`${String(u.username||'')}-${String(u.role||'')}`}</option>
                  ))}
                  {!!editResponsibleStaff && !users.some((u:any)=> String(u.username||'') === editResponsibleStaff) && (
                    <option value={editResponsibleStaff}>{editResponsibleStaff}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={()=> setEditItem(null)}>Cancel</button>
              <button className="btn" onClick={async ()=>{
                try {
                  await hospitalApi.updateBankAccount(editItem.id, {
                    bankName: editBankName.trim() || undefined,
                    accountTitle: editAccountTitle.trim() || undefined,
                    branchName: editBranchName.trim() || undefined,
                    branchCode: editBranchCode.trim() || undefined,
                    swift: editSwift.trim() || undefined,
                    responsibleStaff: editResponsibleStaff.trim() || undefined,
                    status: editStatus,
                  })
                  setEditItem(null)
                  await reload()
                } catch(e:any){ alert(e?.message||'Failed to update') }
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold">Existing Bank Accounts</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-4">Bank</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Account#/IBAN</th>
                <th className="py-2 pr-4">Assigned User</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a:any)=> (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{a.bankName}</td>
                  <td className="py-2 pr-4">{a.accountTitle}</td>
                  <td className="py-2 pr-4 font-mono">{a.accountNumber}</td>
                  <td className="py-2 pr-4">{(() => {
                    const key = String(a?.responsibleStaff || '').trim()
                    if (!key) return '-'
                    const u = users.find((x:any) => String(x?.username || '').trim() === key)
                    const role = String(u?.role || '').trim()
                    return role ? `${key}-${role}` : key
                  })()}</td>
                  <td className="py-2 pr-4">{a.status}</td>
                  <td className="py-2 pr-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                        onClick={()=> setViewItem(a)}
                        aria-label="View"
                        title="View"
                      >
                        <span className="inline-flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View
                        </span>
                      </button>
                      <button
                        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                        onClick={()=> {
                          setEditItem(a);
                          setEditBankName(a.bankName||'');
                          setEditAccountTitle(a.accountTitle||'');
                          setEditAccountNumber(a.accountNumber||'');
                          setEditBranchName(a.branchName||'');
                          setEditBranchCode(a.branchCode||'');
                          setEditSwift(a.swift||'');
                          setEditStatus((a.status as any) || 'Active');
                          setEditResponsibleStaff(a.responsibleStaff||'');
                        }}
                        aria-label="Edit"
                        title="Edit"
                      >Edit</button>
                      <button
                        className="rounded border border-rose-300 text-rose-700 px-2 py-1 hover:bg-rose-50"
                        onClick={()=> setDeleteItem(a)}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleteItem && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={()=> { if (!deleteLoading) setDeleteItem(null) }}></div>
          <div className="relative z-50 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Confirm Delete</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> { if (!deleteLoading) setDeleteItem(null) }}>✕</button>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Delete this bank account? This cannot be undone.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" disabled={deleteLoading} onClick={()=> setDeleteItem(null)}>Cancel</button>
              <button
                className="rounded border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 text-sm hover:bg-rose-100 disabled:opacity-50"
                disabled={deleteLoading}
                onClick={async ()=>{
                  setDeleteLoading(true)
                  try {
                    await hospitalApi.deleteBankAccount(deleteItem.id)
                    setDeleteItem(null)
                    await reload()
                  } catch(e:any){ alert(e?.message||'Failed to delete') }
                  finally { setDeleteLoading(false) }
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {txnOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={()=> { setTxnOpen(false); setTxnBank(null) }}></div>
          <div className="relative z-50 w-full sm:max-w-5xl bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Bank Transactions</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> { setTxnOpen(false); setTxnBank(null) }}>✕</button>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {txnBank ? `${txnBank.bankName || ''} — ${txnBank.accountTitle || ''} (${txnBank.accountNumber || ''})` : ''}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
              <input type="date" value={txnFrom} onChange={e=> setTxnFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <input type="date" value={txnTo} onChange={e=> setTxnTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs" />
              <button className="btn w-full sm:w-auto" disabled={txnLoading || !txnBank} onClick={()=> { if (txnBank) void openTransactions(txnBank) }}>Reload</button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">Transaction ID</th>
                    <th className="py-2 pr-4">DateTime</th>
                    <th className="py-2 pr-4">Debit</th>
                    <th className="py-2 pr-4">Credit</th>
                    <th className="py-2 pr-4">Counterparty</th>
                    <th className="py-2 pr-4">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {txnRows.length === 0 ? (
                    <tr><td colSpan={6} className="py-3 text-slate-500">{txnLoading ? 'Loading...' : 'No transactions found.'}</td></tr>
                  ) : txnRows.map((t:any)=>{
                    const dt = t?.createdAt ? new Date(String(t.createdAt)) : null
                    const dLabel = String(t.dateIso||'')
                    const timeLabel = (!dt || Number.isNaN(dt.getTime())) ? '-' : dt.toLocaleTimeString()
                    const receiver = String((t as any)?.receiver || '').trim()
                    const cp = receiver ? receiver : (
                      Array.isArray(t.counterparties) && t.counterparties.length
                        ? t.counterparties.map((c:any)=> String(c.account||'')).join(', ')
                        : '-'
                    )
                    return (
                      <tr key={String(t.id)} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{String(t.txId||`TXN-${String(t.id)}`)}</td>
                        <td className="py-2 pr-4">
                          <div className="leading-tight">
                            <div>{dLabel}</div>
                            <div className="text-xs text-slate-500">{timeLabel}</div>
                          </div>
                        </td>
                        <td className="py-2 pr-4">{Number(t.debit||0) ? `Rs. ${new Intl.NumberFormat('en-PK').format(Number(t.debit||0))}` : '-'}</td>
                        <td className="py-2 pr-4">{Number(t.credit||0) ? `Rs. ${new Intl.NumberFormat('en-PK').format(Number(t.credit||0))}` : '-'}</td>
                        <td className="py-2 pr-4 font-mono">{cp}</td>
                        <td className="py-2 pr-4">{t.memo || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
