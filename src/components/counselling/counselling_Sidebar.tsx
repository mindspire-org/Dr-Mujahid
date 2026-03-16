import { NavLink, useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  LogOut,
  X,
  PlusCircle,
  Users,
  Package,
  History,
  Ticket,
  Wallet,
  Bell,
} from 'lucide-react'
import PortalSwitcher from '../PortalSwitcher'

type NavItem = { to: string; label: string; end?: boolean; icon: LucideIcon }

export const counsellingSidebarNavTop: NavItem[] = [
  { to: '/counselling', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/counselling/today-tokens', label: "Today's Tokens", icon: Ticket },
  { to: '/counselling/token-history', label: 'Token History', icon: History },
  { to: '/counselling/token-generator', label: 'Token Generator', icon: PlusCircle },
  { to: '/counselling/packages', label: 'Packages', icon: Package },
  { to: '/counselling/appointments', label: 'Appointments', icon: History },
  { to: '/counselling/credit-patients', label: 'Credit Patients', icon: Users },
  { to: '/counselling/manage-petty-cash', label: 'Manage Petty Cash', icon: Wallet },
  { to: '/counselling/manage-bank-balance', label: 'Manage Bank Balance', icon: Wallet },
  { to: '/counselling/notifications', label: 'Notifications', icon: Bell },
]

export default function Counselling_Sidebar({
  collapsed = false,
  onExpand,
  collapseSignal,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed?: boolean
  onExpand?: () => void
  collapseSignal?: number
  mobileOpen?: boolean
  onCloseMobile?: () => void
}) {
  const navigate = useNavigate()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [allowed, setAllowed] = useState<string[] | null>(null)
  const width = collapsed ? 'md:w-16' : 'md:w-64'

  const isAllowed = (to: string) => {
    if (!allowed) return true
    if (allowed.includes('*')) return true
    return allowed.includes(to)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hospital.session')
      const s = raw ? JSON.parse(raw) : null
      const perms = s?.permissions
      const a = perms?.counselling
      if (Array.isArray(a)) setAllowed(a)
      else setAllowed(null)
    } catch {
      setAllowed(null)
    }
  }, [])

  useEffect(() => {
    // No submenus to reset in Counselling_Sidebar
  }, [collapseSignal])

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

      const portals = [
        'doctor', 'reception', 'finance', 'diagnostic', 'lab',
        'pharmacy', 'aesthetic', 'therapy', 'therapyLab', 'counselling'
      ]
      portals.forEach(p => {
        localStorage.removeItem(`${p}.session`)
        localStorage.removeItem(`${p}.token`)
        localStorage.removeItem(`${p}.user`)
      })
      localStorage.removeItem('pharma_user')
    } catch { }
    navigate('/counselling/login')
  }

  const renderNav = ({ isCollapsed }: { isCollapsed: boolean }) => {
    return (
      <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {counsellingSidebarNavTop.filter(i => isAllowed(i.to)).map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
              }
              end={item.end}
              onClick={() => {
                if (isCollapsed) onExpand?.()
                onCloseMobile?.()
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}

        {/* Counselling currently has no groups/submenus, but structure is here for consistency with hospital portal */}

        <div className="pt-2">
          <PortalSwitcher
            collapsed={isCollapsed}
            onExpand={() => {
              onExpand?.()
            }}
          />
          <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <button
            onClick={() => setLogoutConfirmOpen(true)}
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
  }

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
          style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
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
                <X className="h-5 w-5" />
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
