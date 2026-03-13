import { useEffect, useRef, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import { Eye, EyeOff, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { hospitalSidebarGroups, hospitalSidebarNavBottom, hospitalSidebarNavTop } from '../../components/hospital/hospital_Sidebar'
import { doctorSidebarNav } from '../../components/doctor/doctor_Sidebar'
import { receptionSidebarGroups } from '../../components/reception/reception_Sidebar'
import { diagnosticSidebarNav } from '../../components/diagnostic/diagnostic_Sidebar'
import { pharmacySidebarNav } from '../../components/pharmacy/pharmacy_Sidebar'
import { financeSidebarGroups } from '../../components/finance/finance_Sidebar'
import { therapyLabSidebarNav } from '../therapyLab/therapyLab_Sidebar'

type User = {
  id: string
  username: string
  role: string
}

type Role = {
  id: string
  name: string
  portals: Record<string, string[]>
}

type AccessTreePage = {
  id: string
  key: string
  portalKey: string
  type: 'page'
  label: string
  path?: string
  parentKey?: string
  order?: number
}

type AccessTreeModule = {
  id: string
  key: string
  portalKey: string
  type: 'module'
  label: string
  order?: number
  pages: AccessTreePage[]
}

type AccessTreePortal = {
  portalKey: string
  modules: AccessTreeModule[]
  pages: AccessTreePage[]
}

type SidebarPage = { key: string; label: string }

const initialUsers: User[] = []

export default function Hospital_UserManagement() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [roles, setRoles] = useState<Role[]>([])
  const [newUser, setNewUser] = useState<{ username: string; role: string; password?: string }>({ username: '', role: 'Admin', password: '' })

  const [accessTree, setAccessTree] = useState<AccessTreePortal[]>([])

  const [toastMsg, setToastMsg] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const toastTimerRef = useRef<number | null>(null)

  const [roleNew, setRoleNew] = useState<{ name: string }>({ name: '' })
  const [roleEditId, setRoleEditId] = useState<string | null>(null)
  const [roleEditForm, setRoleEditForm] = useState<{ name: string }>({ name: '' })
  const [roleDeleteId, setRoleDeleteId] = useState<string | null>(null)

  const [permUserId, setPermUserId] = useState<string>('')
  const [permDraft, setPermDraft] = useState<Record<string, string[]>>({})
  const [permSaving, setPermSaving] = useState(false)
  const [portalDialogKey, setPortalDialogKey] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ username: string; role: string }>({ username: '', role: 'Admin' })
  const [editPassword, setEditPassword] = useState<string>('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [viewBusy, setViewBusy] = useState(false)
  const [editPasswordVisible, setEditPasswordVisible] = useState(false)

  const getRoleName = (id: string | null) => {
    if (!id) return ''
    const r = roles.find(x => x.id === id)
    return r?.name || ''
  }

  const isPortalEnabled = (portalKey: string) => {
    return !!(permDraft && Object.prototype.hasOwnProperty.call(permDraft, portalKey))
  }
  const isPortalAll = (portalKey: string) => {
    const v = permDraft?.[portalKey]
    return Array.isArray(v) && v.includes('*')
  }
  const isRouteEnabled = (portalKey: string, to: string) => {
    const v = permDraft?.[portalKey]
    if (!Array.isArray(v) || v.length === 0) return false
    if (v.includes('*')) return true
    return v.includes(to)
  }
  const togglePortal = (portalKey: string, enabled: boolean) => {
    setPermDraft(prev => {
      const next = { ...(prev || {}) }
      if (!enabled) {
        delete next[portalKey]
        return next
      }
      if (Object.prototype.hasOwnProperty.call(next, portalKey)) return next
      next[portalKey] = ['*']
      return next
    })
  }
  const togglePortalAll = (portalKey: string, enabled: boolean) => {
    setPermDraft(prev => {
      const next = { ...(prev || {}) }
      if (!enabled) {
        next[portalKey] = []
        return next
      }
      next[portalKey] = ['*']
      return next
    })
  }
  const toggleRoute = (portalKey: string, to: string, enabled: boolean) => {
    setPermDraft(prev => {
      const next = { ...(prev || {}) }
      const cur = Array.isArray(next[portalKey]) ? [...next[portalKey]] : []
      const wasAll = cur.includes('*')
      if (wasAll) {
        next[portalKey] = enabled ? ['*'] : ['*']
        return next
      }
      const has = cur.includes(to)
      let out = cur
      if (enabled && !has) out = [...cur, to]
      if (!enabled && has) out = cur.filter(x => x !== to)
      next[portalKey] = out
      return next
    })
  }

  const openPortalDialog = (portalKey: string) => {
    setPortalDialogKey(portalKey)
  }

  const closePortalDialog = () => {
    setPortalDialogKey(null)
  }

  const portalDialog = accessTree.find(p => p.portalKey === portalDialogKey) || null

  const normalizePath = (p: string) => {
    const v = String(p || '').trim()
    if (!v) return v
    if (v.length > 1 && v.endsWith('/')) return v.slice(0, -1)
    return v
  }

  const getPortalSidebarPages = (portalKey: string): { pages: SidebarPage[]; groups: { label: string; pages: SidebarPage[] }[] } => {
    const mk = (to: string, label: string): SidebarPage => ({ key: normalizePath(to), label: String(label || to) })

    if (portalKey === 'hospital') {
      const top = (hospitalSidebarNavTop || []).map(it => mk(it.to, it.label))
      const bottom = (hospitalSidebarNavBottom || []).map(it => mk(it.to, it.label))
      const gs = (hospitalSidebarGroups || []).map(g => ({ label: g.label, pages: (g.items || []).map(it => mk(it.to, it.label)) }))
      const extraGroups = [
        ...(top.length > 0 ? [{ label: 'General', pages: top }] : []),
        ...gs,
        ...(bottom.length > 0 ? [{ label: 'System', pages: bottom }] : []),
      ]
      return { pages: [...top, ...bottom, ...gs.flatMap(g => g.pages)], groups: extraGroups }
    }

    if (portalKey === 'doctor') {
      return { pages: (doctorSidebarNav || []).map(it => mk(it.to, it.label)), groups: [] }
    }

    if (portalKey === 'reception') {
      const gs = (receptionSidebarGroups || []).map(g => ({ label: g.label, pages: (g.items || []).map(it => mk(it.to, it.label)) }))
      return { pages: gs.flatMap(g => g.pages), groups: gs }
    }

    if (portalKey === 'diagnostic') {
      return { pages: (diagnosticSidebarNav || []).map(it => mk(it.to, it.label)), groups: [] }
    }

    if (portalKey === 'pharmacy') {
      const arr = (pharmacySidebarNav || []).map((it: any) => mk(it.to, it.label))
      return { pages: arr, groups: [] }
    }

    if (portalKey === 'finance') {
      const gs = (financeSidebarGroups || []).map(g => ({ label: g.label, pages: (g.items || []).map(it => mk(it.to, it.label)) }))
      return { pages: gs.flatMap(g => g.pages), groups: gs }
    }

    if (portalKey === 'therapyLab') {
      const arr = (therapyLabSidebarNav || []).map(it => mk((it as any).to, (it as any).label))
      return { pages: arr, groups: [] }
    }

    return { pages: [], groups: [] }
  }

  const portalHasAnyEnabledPage = (portalKey: string, portal: AccessTreePortal | null) => {
    const v = permDraft?.[portalKey]
    if (Array.isArray(v) && v.includes('*')) return true
    if (!Array.isArray(v) || v.length === 0) return false
    if (!portal) return v.some(x => String(x || '').trim() && x !== '*')

    const sidebar = getPortalSidebarPages(portalKey)
    const tokens = new Set<string>((sidebar.pages || []).map(p => normalizePath(p.key)))
    if (tokens.size === 0) {
      for (const p of (portal.pages || [])) {
        tokens.add(normalizePath(String(p.key || '')))
        if (p.path) tokens.add(normalizePath(String(p.path || '')))
      }
      for (const m of (portal.modules || [])) {
        for (const p of (m.pages || [])) {
          tokens.add(normalizePath(String(p.key || '')))
          if (p.path) tokens.add(normalizePath(String(p.path || '')))
        }
      }
    }
    for (const t of v) {
      if (tokens.has(normalizePath(String(t || '')))) return true
    }
    return false
  }

  const loadRoles = async () => {
    const res: any = await hospitalApi.listHospitalRoles()
    const arr: any[] = Array.isArray(res?.roles) ? res.roles : []
    const rs: Role[] = arr.map((r: any) => ({ id: String(r.id), name: String(r.name || ''), portals: (r.portals && typeof r.portals === 'object') ? r.portals : {} }))
    setRoles(rs)
    if (!newUser.role && rs.length > 0) setNewUser(v => ({ ...v, role: rs[0].name }))
    return rs
  }

  const loadPermissionsForUser = async (userId: string, rolesSnapshot?: Role[], accessTreeSnapshot?: AccessTreePortal[]) => {
    try {
      const res: any = await hospitalApi.getHospitalUser(userId)
      const u = res?.user
      const portals = (u?.portals && typeof u.portals === 'object') ? u.portals : null
      if (portals && Object.keys(portals).length > 0) {
        // DB stores access-node keys; UI toggles are path-based (sidebar routes)
        const byPortalKeyToPath = new Map<string, Map<string, string>>()
        const tree = Array.isArray(accessTreeSnapshot) ? accessTreeSnapshot : accessTree
        for (const p of (tree || [])) {
          const m = new Map<string, string>()
          for (const it of (p.pages || [])) {
            if (it?.key && it?.path) m.set(String(it.key), String(it.path))
          }
          for (const mod of (p.modules || [])) {
            for (const it of (mod.pages || [])) {
              if (it?.key && it?.path) m.set(String(it.key), String(it.path))
            }
          }
          byPortalKeyToPath.set(String(p.portalKey), m)
        }

        const mapped: Record<string, string[]> = {}
        for (const portalKey of Object.keys(portals)) {
          const arr = Array.isArray((portals as any)[portalKey]) ? (portals as any)[portalKey].map(String) : []
          if (arr.length === 0) continue
          if (arr.includes('*')) {
            mapped[portalKey] = ['*']
            continue
          }
          // If entries look like paths already, keep as-is
          const allPaths = arr.every((v: any) => String(v || '').trim().startsWith('/'))
          if (allPaths) {
            mapped[portalKey] = arr
            continue
          }

          const idx = byPortalKeyToPath.get(String(portalKey))
          const out: string[] = []
          for (const k of arr) {
            const pth = idx?.get(String(k))
            if (pth) out.push(pth)
          }
          if (out.length > 0) mapped[portalKey] = out
        }

        setPermDraft(mapped)
        return
      }

      const rn = String(u?.role || '')
      const rs = Array.isArray(rolesSnapshot) ? rolesSnapshot : roles
      const r = rs.find(x => x.name === rn)
      setPermDraft(r?.portals || {})
    } catch {
      const rs = Array.isArray(rolesSnapshot) ? rolesSnapshot : roles
      setPermDraft(rs?.[0]?.portals || {})
    }
  }

  const loadUsers = async () => {
    const res: any = await hospitalApi.listHospitalUsers()
    const arr: any[] = Array.isArray(res?.users) ? res.users : []
    const us = arr.map(u => ({ id: String(u.id), username: u.username, role: String(u.role || '') }))
    setUsers(us)
    return us
  }

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

  const addRole = async () => {
    const name = roleNew.name.trim()
    if (!name) return
    try {
      const res: any = await hospitalApi.createHospitalRole({ name, portals: {} })
      const r = res?.role
      if (r) {
        const nr: Role = { id: String(r.id), name: String(r.name || ''), portals: (r.portals && typeof r.portals === 'object') ? r.portals : {} }
        setRoles(prev => [...prev, nr].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setRoleNew({ name: '' })
    } catch (e: any) {
      alert(e?.message || 'Failed to add role')
    }
  }

  const openEditRole = (r: Role) => {
    setRoleEditId(r.id)
    setRoleEditForm({ name: r.name })
  }
  const saveRoleEdit = async () => {
    if (!roleEditId) return
    try {
      const res: any = await hospitalApi.updateHospitalRole(roleEditId, { name: roleEditForm.name.trim() })
      const r = res?.role
      if (r) {
        setRoles(prev => prev.map(x => x.id === roleEditId ? { id: String(r.id), name: String(r.name || ''), portals: (r.portals && typeof r.portals === 'object') ? r.portals : {} } : x).sort((a, b) => a.name.localeCompare(b.name)))
      }
      setRoleEditId(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to update role')
    }
  }

  const confirmDeleteRole = async () => {
    if (!roleDeleteId) return
    try { await hospitalApi.deleteHospitalRole(roleDeleteId) } catch (e: any) { alert(e?.message || 'Failed to delete role'); return }
    setRoles(prev => prev.filter(r => r.id !== roleDeleteId))
    setRoleDeleteId(null)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false)
    }, 2500)
  }

  const savePermissions = async () => {
    if (!permUserId) return
    setPermSaving(true)
    try {
      const cleaned: Record<string, string[]> = {}
      for (const k of Object.keys(permDraft || {})) {
        const arr = permDraft[k]
        if (Array.isArray(arr) && arr.length > 0) cleaned[k] = arr
      }
      await hospitalApi.updateHospitalUser(permUserId, { portals: cleaned })
      setPermDraft(cleaned)
      showToast('Permissions saved')
    } catch (e: any) {
      alert(e?.message || 'Failed to save permissions')
    } finally {
      setPermSaving(false)
    }
  }

  const openEdit = (u: User) => {
    setEditId(u.id)
    setEditForm({ username: u.username, role: u.role })
    setEditPassword('')
    setEditPasswordVisible(false)
      ; (async () => {
        try {
          const res: any = await hospitalApi.getHospitalUser(u.id)
          const uu = res?.user
          if (uu) {
            setEditForm({ username: String(uu.username || u.username), role: String(uu.role || u.role) })
          }
        } catch { }
      })()
  }
  const saveEdit = async () => {
    if (!editId) return
    try {
      const body: any = { username: editForm.username.trim() || undefined, role: editForm.role }
      const p = String(editPassword || '').trim()
      if (p) body.password = p
      const res: any = await hospitalApi.updateHospitalUser(editId, body)
      const u = res?.user
      if (u) setUsers(prev => prev.map(x => x.id === editId ? { id: String(u.id), username: u.username, role: u.role } : x))
      setEditId(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to update user')
    }
  }

  const generateForEdit = async () => {
    if (!editId) return
    setViewBusy(true)
    try {
      const res: any = await hospitalApi.resetHospitalUserPassword(editId)
      const pwd = String(res?.password || '')
      setEditPassword(pwd)
      if (pwd) setEditPasswordVisible(true)
    } catch (e: any) {
      alert(e?.message || 'Failed to generate password')
    } finally {
      setViewBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await hospitalApi.deleteHospitalUser(deleteId) } catch { }
    setUsers(prev => prev.filter(u => u.id !== deleteId))
    setDeleteId(null)
  }

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const treeRes: any = await hospitalApi.getHospitalAccessTree()
          const t: any[] = Array.isArray(treeRes?.tree) ? treeRes.tree : []
          if (!cancelled) setAccessTree(t as any)

          const rs = await loadRoles()
          const us = await loadUsers()
          if (!cancelled && us.length > 0) {
            setPermUserId(us[0].id)
            await loadPermissionsForUser(us[0].id, rs, t as any)
          }
        } catch {
          if (!cancelled) setAccessTree([])
        }
      })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800">User Management</h2>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Roles</div>

        <div className="mt-3 w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {roles.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditRole(r)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleDeleteId(r.id)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-1.5 text-rose-700 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={2}>No roles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 text-sm font-semibold text-slate-700">Add New Role</div>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={roleNew.name}
            onChange={e => setRoleNew({ name: e.target.value })}
            placeholder="Finance Manager"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 md:col-span-3"
          />
          <button onClick={addRole} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90">Add Role</button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">All Users</div>

        <div className="mt-3 w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
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
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(u.id)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-1.5 text-rose-700 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
            onChange={e => setNewUser(v => ({ ...v, username: e.target.value }))}
            placeholder="admin"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
          <select
            value={newUser.role}
            onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
          </select>
          <input
            value={newUser.password}
            onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}
            placeholder="password (optional)"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
          <button onClick={addUser} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90">Add User</button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Permissions</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Select User</label>
            <select
              value={permUserId}
              onChange={e => {
                const id = e.target.value
                setPermUserId(id)
                void loadPermissionsForUser(id)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username}-{u.role}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-end justify-end">
            <button
              onClick={savePermissions}
              disabled={!permUserId || permSaving}
              className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60"
            >
              {permSaving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {accessTree.map(p => (
            <div key={p.portalKey} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="text-sm font-semibold text-slate-800">{p.portalKey}</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPortalEnabled(p.portalKey)}
                      onClick={() => {
                        const next = !isPortalEnabled(p.portalKey)
                        togglePortal(p.portalKey, next)
                        if (next) openPortalDialog(p.portalKey)
                      }}
                      className={`${isPortalEnabled(p.portalKey) ? 'bg-violet-700' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full transition`}
                      title={isPortalEnabled(p.portalKey) ? 'Disable' : 'Enable'}
                    >
                      <span className={`${isPortalEnabled(p.portalKey) ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
                    </button>
                    <div className="text-sm text-slate-700">{isPortalEnabled(p.portalKey) ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  {isPortalEnabled(p.portalKey) && (
                    <button
                      type="button"
                      onClick={() => openPortalDialog(p.portalKey)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {portalDialogKey && portalDialog && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 p-2 sm:items-center sm:p-4">
          <div className="flex w-full max-w-md flex-col sm:max-w-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h3 className="min-w-0 truncate text-base font-semibold text-slate-800">{portalDialog.portalKey} Pages</h3>
              <button
                type="button"
                onClick={closePortalDialog}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">All Pages</div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPortalAll(portalDialog.portalKey)}
                    onClick={() => togglePortalAll(portalDialog.portalKey, !isPortalAll(portalDialog.portalKey))}
                    className={`${isPortalAll(portalDialog.portalKey) ? 'bg-violet-700' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full transition`}
                    title={isPortalAll(portalDialog.portalKey) ? 'Disable All' : 'Enable All'}
                  >
                    <span className={`${isPortalAll(portalDialog.portalKey) ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">If enabled, the user can access every page in this portal.</div>
              </div>

              {(() => {
                const sidebar = getPortalSidebarPages(portalDialog.portalKey)
                if ((sidebar.groups || []).length > 0) {
                  return (
                    <div className="mt-4">
                      {(sidebar.groups || []).map(g => (
                        <div key={g.label} className="mt-4 first:mt-0">
                          <div className="mb-2 text-sm font-semibold text-slate-800">{g.label}</div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {(g.pages || []).map(it => (
                              <div key={it.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-slate-800">{it.label}</div>
                                  <div className="truncate text-xs text-slate-500">{it.key}</div>
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isRouteEnabled(portalDialog.portalKey, it.key)}
                                  disabled={isPortalAll(portalDialog.portalKey)}
                                  onClick={() => toggleRoute(portalDialog.portalKey, it.key, !isRouteEnabled(portalDialog.portalKey, it.key))}
                                  className={`${isRouteEnabled(portalDialog.portalKey, it.key) ? 'bg-violet-700' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-60`}
                                  title={isRouteEnabled(portalDialog.portalKey, it.key) ? 'Disable' : 'Enable'}
                                >
                                  <span className={`${isRouteEnabled(portalDialog.portalKey, it.key) ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }

                if ((sidebar.pages || []).length > 0) {
                  return (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold text-slate-800">Pages</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(sidebar.pages || []).map(it => (
                          <div key={it.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-800">{it.label}</div>
                              <div className="truncate text-xs text-slate-500">{it.key}</div>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isRouteEnabled(portalDialog.portalKey, it.key)}
                              disabled={isPortalAll(portalDialog.portalKey)}
                              onClick={() => toggleRoute(portalDialog.portalKey, it.key, !isRouteEnabled(portalDialog.portalKey, it.key))}
                              className={`${isRouteEnabled(portalDialog.portalKey, it.key) ? 'bg-violet-700' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-60`}
                              title={isRouteEnabled(portalDialog.portalKey, it.key) ? 'Disable' : 'Enable'}
                            >
                              <span className={`${isRouteEnabled(portalDialog.portalKey, it.key) ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    No sidebar pages found for this portal.
                  </div>
                )
              })()}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
              <button
                type="button"
                onClick={closePortalDialog}
                disabled={!portalHasAnyEnabledPage(portalDialog.portalKey, portalDialog)}
                className="w-full rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60 sm:w-auto"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {roleEditId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Edit Role</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Role Name</label>
                <input value={roleEditForm.name} onChange={e => setRoleEditForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRoleEditId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveRoleEdit} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800">Save</button>
            </div>
          </div>
        </div>
      )}

      {roleDeleteId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Delete Role</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete role <span className="font-medium">{getRoleName(roleDeleteId)}</span>?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRoleDeleteId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDeleteRole} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Edit User</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Username</label>
                <input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                  {roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Password</label>
                <div className="flex gap-2">
                  <input
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    type={editPasswordVisible ? 'text' : 'password'}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  />
                  <button
                    type="button"
                    onClick={() => setEditPasswordVisible(v => !v)}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50"
                    title={editPasswordVisible ? 'Hide Password' : 'Show Password'}
                  >
                    {editPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={generateForEdit}
                    disabled={viewBusy}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    title="Generate"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
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
              <button onClick={() => setDeleteId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
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
