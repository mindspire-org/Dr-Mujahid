import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, BarChart3, LayoutDashboard, Users, Activity, Landmark, WalletCards, Banknote } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import { useEffect, useState } from 'react'
import PortalSwitcher from '../PortalSwitcher'

type Item = { to: string; label: string; icon: any; end?: boolean }
type Group = { label: string; items: Item[] }

export const financeSidebarGroups: Group[] = [
  {
    label: 'Hospital',
    items: [
      { to: '/finance/hospital-dashboard', label: 'Hospital Dashboard', icon: Activity },
      { to: '/finance/staff-dashboard', label: 'Staff Dashboard', icon: Users },
      { to: '/finance/collection-report', label: 'Collection Report', icon: BarChart3 },
      { to: '/finance/doctors', label: 'Doctor Finance', icon: WalletCards },
      { to: '/finance/doctor-payouts', label: 'Doctor Payouts', icon: Banknote },
    ],
  },
  {
    label: 'Pharmacy',
    items: [
      { to: '/finance/pharmacy-reports', label: 'Pharmacy Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Diagnostics',
    items: [
      { to: '/finance/diagnostics-dashboard', label: 'Diagnostics Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { to: '/finance/bank-accounts', label: 'Bank Accounts', icon: Banknote },
      { to: '/finance/opening-balances', label: 'Manage Bank Balance', icon: Landmark },
      { to: '/finance/petty-cash', label: 'Petty Cash Accounts', icon: WalletCards },
      { to: '/finance/manage-petty-cash', label: 'Manage Petty Cash', icon: Landmark },
    ],
  },
]

export default function Finance_Sidebar({ collapsed = false, onExpand, collapseSignal: _collapseSignal }: { collapsed?: boolean; onExpand?: () => void; collapseSignal?: number }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [allowed, setAllowed] = useState<string[] | null>(null)
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  const groups: Group[] = financeSidebarGroups
  async function logout() {
    try {
      const raw = localStorage.getItem('finance.session')
      const u = raw ? JSON.parse(raw) : null
      await hospitalApi.logoutHospitalUser(u?.username || 'finance')
    } catch { }
    try {
      const financeToken = localStorage.getItem('finance.token')
      localStorage.removeItem('finance.session')
      localStorage.removeItem('finance.token')

      if (financeToken && localStorage.getItem('token') === financeToken) {
        localStorage.removeItem('token')
      }
    } catch { }
    navigate('/finance/login')
  }

  const isAllowed = (to: string) => {
    if (!allowed) return false // Default to closed
    if (allowed.includes('*')) return true
    return allowed.includes(to)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('finance.session') || localStorage.getItem('hospital.session')
      if (!raw) {
        setAllowed([])
        return
      }
      const s = JSON.parse(raw)
      const role = String(s?.role || '')

      // Admin always has full access
      if (role.toLowerCase() === 'admin') {
        setAllowed(['*'])
        return
      }

      const perms = s?.permissions
      const a = perms?.finance

      if (Array.isArray(a)) {
        setAllowed(a)
      } else {
        // If no specific finance permissions define, check if the role implies full access?
        // The user said "i give permission... shows all". This implies "Finance" role usually sees all, unless restricted?
        // Better to be safe: if role is 'Finance' and no perms array is present, maybe allow all? 
        // BUT the user says they GAVE permission (implies perms array exists).
        // If perms array exists, it falls into the `if` block.
        // If it falls here, it means NO 'finance' permissions are set.
        // In that case, we should probably hide everything.
        setAllowed([])
      }
    } catch {
      setAllowed([])
    }
  }, [pathname])
  return (
    <aside
      className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {groups
          .map(g => ({ ...g, items: g.items.filter(it => isAllowed(it.to)) }))
          .filter(g => g.items.length > 0)
          .map((g) => (
            <div key={g.label} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  {g.label}
                </div>
              )}
              {g.items.map((it) => {
                const Icon = it.icon
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) =>
                      `rounded-md px-3 py-2 text-sm font-medium flex items-center ${collapsed ? 'justify-center gap-0' : 'gap-2'} ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
                    }
                    title={collapsed ? it.label : undefined}
                    onClick={() => {
                      if (collapsed) onExpand?.()
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {!collapsed && <span>{it.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}

        <div className="pt-2">
          <PortalSwitcher collapsed={collapsed} onExpand={onExpand} />
          <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-rose-600/80 hover:text-white"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

      </nav>

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLogoutConfirmOpen(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
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
