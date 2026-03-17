import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LogOut, ScrollText, Ticket, Package, ClipboardList, Wallet, Bell, X, History, CreditCard, LayoutDashboard } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import PortalSwitcher from '../../components/PortalSwitcher'

export const therapyLabSidebarNav = [
  { to: '/therapy-lab', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/therapy-lab/token-generator', label: 'Token Generator', icon: Ticket },
  { to: '/therapy-lab/today-tokens', label: "Today's Tokens", icon: Ticket },
  { to: '/therapy-lab/token-history', label: 'Token History', icon: History },
  { to: '/therapy-lab/credit-patients', label: 'Credit Patients', icon: CreditCard },
  { to: '/therapy-lab/packages', label: 'Packages', icon: Package },
  { to: '/therapy-lab/appointments', label: 'Appointments', icon: ClipboardList },
  { to: '/therapy-lab/lab-reports-entry', label: 'Lab Reports Entry', icon: ScrollText },
  { to: '/therapy-lab/manage-petty-cash', label: 'Manage Petty Cash', icon: Wallet },
  { to: '/therapy-lab/manage-bank-balance', label: 'Manage Bank Balance', icon: Wallet },
  { to: '/therapy-lab/notifications', label: 'Notifications', icon: Bell },
]

export default function TherapyLab_Sidebar({
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
      const raw = localStorage.getItem('therapyLab.session') || localStorage.getItem('hospital.session')
      const s = raw ? JSON.parse(raw) : null
      const perms = s?.permissions
      const a = perms?.therapyLab
      const b = perms?.therapy

      if (a === '*' || b === '*' || s?.role?.toLowerCase() === 'admin') {
        setAllowed(['*'])
        return
      }

      let combined: string[] = []
      if (Array.isArray(a)) combined = [...combined, ...a]
      if (Array.isArray(b)) combined = [...combined, ...b]

      setAllowed(combined.length > 0 ? combined : [])
    } catch {
      setAllowed([])
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

  const renderNav = ({ isCollapsed }: { isCollapsed: boolean }) => {
    return (
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1 hospital-sidebar-scroll">
        {therapyLabSidebarNav.filter(i => isAllowed(i.to)).map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/therapy-lab'}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
              }
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
