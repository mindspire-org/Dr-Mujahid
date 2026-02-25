import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LogOut, ScrollText, Ticket, Package, ClipboardList, Wallet, Bell } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import PortalSwitcher from '../../components/PortalSwitcher'

export const therapyLabSidebarNav = [
  { to: '/therapy-lab/token-generator', label: 'Token Generator' },
  { to: '/therapy-lab/packages', label: 'Packages' },
  { to: '/therapy-lab/management', label: 'Management' },
  { to: '/therapy-lab/lab-reports-entry', label: 'Lab Reports Entry' },
  { to: '/therapy-lab/manage-petty-cash', label: 'Manage Petty Cash' },
  { to: '/therapy-lab/manage-bank-balance', label: 'Manage Bank Balance' },
  { to: '/therapy-lab/notifications', label: 'Notifications' },
]

export default function TherapyLab_Sidebar({ collapsed = false, onExpand }: { collapsed?: boolean; onExpand?: () => void }) {
  const navigate = useNavigate()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [allowed, setAllowed] = useState<string[] | null>(null)

  const isAllowed = (to: string) => {
    if (!allowed) return true
    if (allowed.includes('*')) return true
    return allowed.includes(to)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('therapyLab.session') || localStorage.getItem('hospital.session')
      const s = raw ? JSON.parse(raw) : null
      const perms = s?.permissions
      const a = perms?.therapyLab
      if (Array.isArray(a)) setAllowed(a)
      else setAllowed(null)
    } catch {
      setAllowed(null)
    }
  }, [])

  async function logout() {
    try {
      const raw = localStorage.getItem('hospital.session')
      const u = raw ? JSON.parse(raw) : null
      await hospitalApi.logoutHospitalUser(u?.username || '')
    } catch { }
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('hospital.session')
      localStorage.removeItem('hospital.token')
      localStorage.removeItem('therapyLab.session')
      localStorage.removeItem('therapyLab.token')

      const portals = ['doctor', 'reception', 'finance', 'diagnostic', 'lab', 'pharmacy', 'aesthetic', 'therapy', 'counselling']
      portals.forEach(p => {
        localStorage.removeItem(`${p}.session`)
        localStorage.removeItem(`${p}.token`)
        localStorage.removeItem(`${p}.user`)
      })
      localStorage.removeItem('pharma_user')
    } catch { }
    navigate('/therapy-lab/login')
  }

  return (
    <aside
      className="hidden md:flex md:w-64 md:flex-col md:border-r md:text-white min-h-0 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {isAllowed('/therapy-lab/token-generator') && (
          <NavLink
            to="/therapy-lab/token-generator"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <Ticket className="h-4 w-4 shrink-0" />
            <span className="truncate">Token Generator</span>
          </NavLink>
        )}

        {isAllowed('/therapy-lab/packages') && (
          <NavLink
            to="/therapy-lab/packages"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Packages</span>
          </NavLink>
        )}

        {isAllowed('/therapy-lab/management') && (
          <NavLink
            to="/therapy-lab/management"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="truncate">Management</span>
          </NavLink>
        )}

        {isAllowed('/therapy-lab/lab-reports-entry') && (
          <NavLink
            to="/therapy-lab/lab-reports-entry"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <ScrollText className="h-4 w-4 shrink-0" />
            <span className="truncate">Lab Reports Entry</span>
          </NavLink>
        )}

        {isAllowed('/therapy-lab/manage-petty-cash') && (
          <NavLink
            to="/therapy-lab/manage-petty-cash"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate">Manage Petty Cash</span>
          </NavLink>
        )}

        {isAllowed('/therapy-lab/manage-bank-balance') && (
          <NavLink
            to="/therapy-lab/manage-bank-balance"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate">Manage Bank Balance</span>
          </NavLink>
        )}

        {isAllowed('/therapy-lab/notifications') && (
          <NavLink
            to="/therapy-lab/notifications"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
            }
          >
            <Bell className="h-4 w-4 shrink-0" />
            <span className="truncate">Notifications</span>
          </NavLink>
        )}

        <div className="pt-2">
          <PortalSwitcher collapsed={collapsed} onExpand={onExpand} />
          <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-rose-600/80 hover:text-white"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLogoutConfirmOpen(false)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-base font-semibold text-slate-900">Confirm Logout</div>
              <div className="mt-1 text-sm text-slate-600">Are you sure you want to logout?</div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLogoutConfirmOpen(false)
                  await logout()
                }}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
