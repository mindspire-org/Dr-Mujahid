import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Ticket, ListChecks, Search, Wallet, LayoutDashboard, FileText, ScrollText, CalendarDays, Bell } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import { useEffect, useState } from 'react'
import PortalSwitcher from '../PortalSwitcher'

type Item = { to: string; label: string; icon: any; end?: boolean }
type Group = { label: string; items: Item[] }

export const receptionSidebarGroups: Group[] = [
  {
    label: 'Hospital',
    items: [
      { to: '/reception', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/reception/token-generator', label: 'Token Generator', icon: Ticket },
      { to: "/reception/today-tokens", label: "Today's Tokens", icon: ListChecks },
      { to: '/reception/token-history', label: 'Token History', icon: FileText },
      { to: '/reception/appointments', label: 'Appointments', icon: CalendarDays },
      { to: '/reception/search-patients', label: 'Patient History', icon: Search },
      { to: '/reception/credit-patients', label: 'Credit Patients', icon: Wallet },
      { to: '/reception/lab-reports-entry', label: 'Lab Report Entry', icon: FileText },
      { to: '/reception/history-taking', label: 'History Taking', icon: ScrollText },
      { to: '/reception/manage-petty-cash', label: 'Manage Petty Cash', icon: Wallet },
      { to: '/reception/manage-bank-balance', label: 'Manage Bank Balance', icon: Wallet },
      { to: '/reception/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Diagnostics',
    items: [
      { to: '/reception/diagnostic/token-generator', label: 'Diagnostic Token Generator', icon: Ticket },
      { to: '/reception/diagnostic/sample-tracking', label: 'Diagnostic Sample Tracking', icon: ListChecks },
      { to: '/reception/diagnostic/appointments', label: 'Diagnostic Appointments', icon: CalendarDays },
      { to: '/reception/diagnostic/credit-patients', label: 'Diagnostic Credit Patients', icon: Wallet },
    ],
  },
]

export default function Reception_Sidebar({
  collapsed = false,
  onExpand,
  collapseSignal: _collapseSignal,
  mobileOpen = false,
  onCloseMobile,
}: {
  collapsed?: boolean
  onExpand?: () => void
  collapseSignal?: number
  mobileOpen?: boolean
  onCloseMobile?: () => void
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [allowed, setAllowed] = useState<string[] | null>(null)
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  const groups: Group[] = receptionSidebarGroups
  async function logout() {
    try {
      const raw = localStorage.getItem('reception.session')
      const u = raw ? JSON.parse(raw) : null
      await hospitalApi.logoutHospitalUser(u?.username || 'reception')
    } catch { }
    try {
      const receptionToken = localStorage.getItem('reception.token')
      localStorage.removeItem('reception.session')
      localStorage.removeItem('reception.token')

      if (receptionToken && localStorage.getItem('token') === receptionToken) {
        localStorage.removeItem('token')
      }
    } catch { }
    navigate('/reception/login')
  }

  const isAllowed = (to: string) => {
    if (!allowed) return false
    if (allowed.includes('*')) return true
    return allowed.includes(to)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('reception.session') || localStorage.getItem('hospital.session')
      if (!raw) {
        setAllowed([])
        return
      }
      const s = JSON.parse(raw)
      const role = String(s?.role || '')

      if (role.toLowerCase() === 'admin') {
        setAllowed(['*'])
        return
      }

      const perms = s?.permissions
      const a = perms?.reception
      if (Array.isArray(a)) setAllowed(a)
      else setAllowed([])
    } catch {
      setAllowed([])
    }
  }, [pathname])

  const renderNav = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
      {groups
        .map(g => ({ ...g, items: g.items.filter(it => isAllowed(it.to)) }))
        .filter(g => g.items.length > 0)
        .map((g) => (
          <div key={g.label} className="space-y-1">
            {!isCollapsed && (
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
                    `rounded-md px-3 py-2 text-sm font-medium flex items-center ${isCollapsed ? 'justify-center gap-0' : 'gap-2'} ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
                  }
                  title={isCollapsed ? it.label : undefined}
                  onClick={() => {
                    if (isCollapsed) onExpand?.()
                    onCloseMobile?.()
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {!isCollapsed && <span>{it.label}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}

      <div className="pt-2">
        <PortalSwitcher collapsed={isCollapsed} onExpand={onExpand} />
        <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        <button
          onClick={() => {
            onCloseMobile?.()
            setLogoutConfirmOpen(true)
          }}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-rose-600/80 hover:text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </nav>
  )

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => onCloseMobile?.()}
          aria-hidden="true"
        />
      )}

      {mobileOpen && (
        <aside
          className="fixed inset-y-0 left-0 z-50 w-64 transform md:hidden transition-transform duration-200 ease-in-out translate-x-0"
          style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Reception navigation"
        >
          <div className="flex h-full flex-col text-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-sm font-semibold text-white">Menu</div>
              <button
                type="button"
                onClick={() => onCloseMobile?.()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10"
                aria-label="Close sidebar"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {renderNav({ isCollapsed: false })}
          </div>
        </aside>
      )}

      <aside
        className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
        style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
      >
        {renderNav({ isCollapsed: collapsed })}
      </aside>

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
    </>
  )
}
