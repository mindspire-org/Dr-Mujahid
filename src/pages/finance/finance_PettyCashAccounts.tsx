import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

export default function Finance_PettyCashAccounts(){
  const [list, setList] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [responsibleStaff, setResponsibleStaff] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewItem, setViewItem] = useState<any|null>(null)
  const [editItem, setEditItem] = useState<any|null>(null)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<'Active'|'Inactive'>('Active')
  const [editDepartment, setEditDepartment] = useState('')
  const [editResponsibleStaff, setEditResponsibleStaff] = useState('')

  const [deleteItem, setDeleteItem] = useState<any|null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function reload(){
    setLoading(true)
    try {
      const res: any = await hospitalApi.listPettyCashAccounts()
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
    if (!code || !name) return alert('Code and Name are required')
    setLoading(true)
    try {
      await hospitalApi.createPettyCashAccount({ code, name, department: department||undefined, responsibleStaff: responsibleStaff||undefined, status: 'Active' })
      setCode(''); setName(''); setDepartment(''); setResponsibleStaff('')
      await reload()
      alert('Petty cash account created')
    } catch(e: any){ alert(e?.message || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-6 space-y-4">
      <div>
        <div className="text-2xl font-bold text-slate-800">Petty Cash Accounts</div>
        <div className="text-sm text-slate-500">Create petty cash accounts for departments and responsible staff</div>
      </div>

      {/* View Details Dialog */}
      {viewItem && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={()=> setViewItem(null)}></div>
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Account Details</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> setViewItem(null)}>✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-500">Code</div><div className="font-mono">{viewItem.code}</div></div>
              <div><div className="text-slate-500">Name</div><div>{viewItem.name}</div></div>
              {viewItem.department && (<div><div className="text-slate-500">Department</div><div>{viewItem.department}</div></div>)}
              {viewItem.responsibleStaff && (<div><div className="text-slate-500">Responsible Staff</div><div>{viewItem.responsibleStaff}</div></div>)}
              <div><div className="text-slate-500">Status</div><div>{viewItem.status || 'Active'}</div></div>
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
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 m-0 sm:m-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Edit Account</div>
              <button className="rounded p-1 hover:bg-slate-100" onClick={()=> setEditItem(null)}>✕</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
                <input value={editItem.code} disabled className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input value={editName} onChange={(e)=> setEditName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                <input value={editDepartment} onChange={(e)=> setEditDepartment(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Responsible Staff</label>
                <select value={editResponsibleStaff} onChange={(e)=> setEditResponsibleStaff(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="">-- Select User --</option>
                  {users.map((u:any)=>(
                    <option key={String(u.id)} value={String(u.username||'')}>{`${String(u.username||'')}-${String(u.role||'')}`}</option>
                  ))}
                  {!!editResponsibleStaff && !users.some((u:any)=> String(u.username||'') === editResponsibleStaff) && (
                    <option value={editResponsibleStaff}>{editResponsibleStaff}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select value={editStatus} onChange={(e)=> setEditStatus(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={()=> setEditItem(null)}>Cancel</button>
              <button className="btn" onClick={async ()=>{
                try {
                  await hospitalApi.updatePettyCashAccount(editItem.id, { name: editName.trim(), department: editDepartment.trim(), responsibleStaff: editResponsibleStaff.trim(), status: editStatus })
                  setEditItem(null)
                  await reload()
                } catch(e:any){ alert(e?.message||'Failed to update') }
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account Code</label>
            <input value={code} onChange={e=> setCode(e.target.value.toUpperCase())} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. PETTY_OPD" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account Name</label>
            <input value={name} onChange={e=> setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Petty Cash - OPD" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
            <input value={department} onChange={e=> setDepartment(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. OPD" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Responsible Staff</label>
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
        </div>
        <div className="flex justify-end">
          <button className="btn" disabled={loading} onClick={create}>Create Petty Cash</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold">Existing Petty Cash Accounts</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Responsible</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a:any)=> (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{a.code}</td>
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 pr-4">{a.department || '-'}</td>
                  <td className="py-2 pr-4">{(() => {
                    const key = String(a?.responsibleStaff || '').trim()
                    if (!key) return '-'
                    const u = users.find((x:any) => String(x?.username || '').trim() === key)
                    const role = String(u?.role || '').trim()
                    return role ? `${key}-${role}` : key
                  })()}</td>
                  <td className="py-2 pr-4">{a.status || 'Active'}</td>
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
                        onClick={()=> { setEditItem(a); setEditName(a.name||''); setEditDepartment(a.department||''); setEditResponsibleStaff(a.responsibleStaff||''); setEditStatus((a.status || 'Active') as any) }}
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
              Delete this account? This cannot be undone.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" disabled={deleteLoading} onClick={()=> setDeleteItem(null)}>Cancel</button>
              <button
                className="rounded border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 text-sm hover:bg-rose-100 disabled:opacity-50"
                disabled={deleteLoading}
                onClick={async ()=>{
                  setDeleteLoading(true)
                  try {
                    await hospitalApi.deletePettyCashAccount(deleteItem.id)
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
    </div>
  )
}
