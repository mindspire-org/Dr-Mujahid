import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type User = {
  id: string
  username: string
  role: 'Admin' | 'Staff' | 'Reception' | 'Doctor' | 'Finance'
}

const initialUsers: User[] = []

export default function Hospital_UserManagement() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [newUser, setNewUser] = useState<{ username: string; role: User['role']; password?: string }>({ username: '', role: 'Admin', password: '' })

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ username: string; role: User['role'] }>({ username: '', role: 'Admin' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const addUser = async () => {
    const username = newUser.username.trim()
    if (!username) return
    try {
      const res: any = await hospitalApi.createHospitalUser({ username, role: newUser.role, password: newUser.password || undefined })
      const u = res?.user
      if (u) setUsers(prev => [...prev, { id: String(u.id), username: u.username, role: u.role }])
      setNewUser({ username: '', role: 'Admin', password: '' })
    } catch (e: any) {
      alert(e?.message || 'Failed to add user')
    }
  }

  const openEdit = (u: User) => {
    setEditId(u.id)
    setEditForm({ username: u.username, role: u.role })
  }
  const saveEdit = async () => {
    if (!editId) return
    try {
      const body: any = { username: editForm.username.trim() || undefined, role: editForm.role }
      const res: any = await hospitalApi.updateHospitalUser(editId, body)
      const u = res?.user
      if (u) setUsers(prev => prev.map(x => x.id === editId ? { id: String(u.id), username: u.username, role: u.role } : x))
      setEditId(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to update user')
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await hospitalApi.deleteHospitalUser(deleteId) } catch {}
    setUsers(prev => prev.filter(u => u.id !== deleteId))
    setDeleteId(null)
  }

  useEffect(()=>{
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listHospitalUsers()
        const arr: any[] = Array.isArray(res?.users) ? res.users : []
        if (!cancelled) setUsers(arr.map(u=>({ id: String(u.id), username: u.username, role: u.role })))
      } catch {
        if (!cancelled) setUsers([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800">User Management</h2>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">All Users</div>

          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Username</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">{u.username}</td>
                    <td className="px-4 py-2">{u.role}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={()=>openEdit(u)} className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700">Edit</button>
                        <button onClick={()=>setDeleteId(u.id)} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 text-sm font-semibold text-slate-700">Add New User</div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={newUser.username}
              onChange={e=>setNewUser(v=>({ ...v, username: e.target.value }))}
              placeholder="admin"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
            <select
              value={newUser.role}
              onChange={e=>setNewUser(v=>({ ...v, role: e.target.value as User['role'] }))}
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            >
              <option>Admin</option>
              <option>Staff</option>
              <option>Reception</option>
              <option>Doctor</option>
              <option>Finance</option>
            </select>
            <input
              value={newUser.password}
              onChange={e=>setNewUser(v=>({ ...v, password: e.target.value }))}
              placeholder="password (optional)"
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
            <button onClick={addUser} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90">Add User</button>
          </div>
      </div>

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Edit User</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Username</label>
                <input value={editForm.username} onChange={e=>setEditForm(f=>({ ...f, username: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Role</label>
                <select value={editForm.role} onChange={e=>setEditForm(f=>({ ...f, role: e.target.value as User['role'] }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                  <option>Admin</option>
                  <option>Staff</option>
                  <option>Reception</option>
                  <option>Doctor</option>
                  <option>Finance</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={()=>setEditId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Delete User</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this user?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={()=>setDeleteId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
