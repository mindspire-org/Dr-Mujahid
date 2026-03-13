import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ListChecks, FlaskConical, FileText, BarChart3, ScrollText, LogOut, Settings as Cog, Ticket, Wallet, CalendarDays, Users, Bell } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import { useState } from 'react'
import PortalSwitcher from '../PortalSwitcher'

type Item = { to: string; label: string; end?: boolean; icon: any }
export const diagnosticSidebarNav: Item[] = [
  { to: '/diagnostic', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/diagnostic/token-generator', label: 'Token Generator', icon: Ticket },
  { to: '/diagnostic/sample-tracking', label: 'Sample Management', icon: ListChecks },
  { to: '/diagnostic/credit-patients', label: 'Credit Patients', icon: Users },
  { to: '/diagnostic/result-entry', label: 'Result Entry', icon: FileText },
  { to: '/diagnostic/report-generator', label: 'Report Generator', icon: BarChart3 },
  { to: '/diagnostic/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/diagnostic/tests', label: 'Tests Catalog', icon: FlaskConical },
  { to: '/diagnostic/manage-petty-cash', label: 'Manage Petty Cash', icon: Wallet },
  { to: '/diagnostic/manage-bank-balance', label: 'Manage Bank Balance', icon: Wallet },
  { to: '/diagnostic/notifications', label: 'Notifications', icon: Bell },
  { to: '/diagnostic/referrals', label: 'Referrals', icon: ListChecks },
  { to: '/diagnostic/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/diagnostic/settings', label: 'Settings', icon: Cog },
]

export default function Diagnostic_Sidebar({
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const allowed = (() => {
    try {
      const raw = localStorage.getItem('hospital.session')
      if (!raw) return null
      const s = JSON.parse(raw)
      const role = String(s?.role || '')
      if (role.toLowerCase() === 'admin') return ['*'] as string[]
      const perms = s?.permissions
      const arr = perms?.diagnostic
      return Array.isArray(arr) ? arr.map(String) : null
    } catch {
      return null
    }
  })()

  const normalizePath = (p: string) => {
    const v = String(p || '').trim()
    if (!v) return v
    if (v.length > 1 && v.endsWith('/')) return v.slice(0, -1)
    return v
  }

  const canSee = (to: string) => {
    if (!allowed) return true
    if (allowed.includes('*')) return true
    const t = normalizePath(to)
    return allowed.map(normalizePath).includes(t)
  }

  const items = diagnosticSidebarNav.filter(it => canSee(it.to))
  const width = collapsed ? 'md:w-16' : 'md:w-64'

  const renderNav = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
      {items.map(item => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium flex items-center ${isCollapsed ? 'justify-center gap-0' : 'gap-2'} ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
            end={item.end}
            onClick={() => {
              if (isCollapsed) onExpand?.()
              onCloseMobile?.()
            }}
          >
            <Icon className="h-4 w-4" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        )
      })}

      <div className="pt-2">
        <PortalSwitcher collapsed={isCollapsed} onExpand={onExpand} />
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

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => onCloseMobile?.()}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:hidden md:w-auto md:static md:z-auto md:translate-x-0 transform transition-transform duration-200 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
      >
        <div className="flex h-full flex-col text-white">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <div className="text-sm font-semibold">Diagnostic Menu</div>
            <button
              type="button"
              onClick={() => onCloseMobile?.()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10"
              aria-label="Close sidebar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          {renderNav({ isCollapsed: false })}
        </div>
      </aside>

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
                  try {
                    const raw = localStorage.getItem('hospital.session')
                    const s = raw ? JSON.parse(raw) : null
                    await hospitalApi.logoutHospitalUser(s?.username || '')
                  } catch { }
                  try {
                    localStorage.removeItem('token')
                    localStorage.removeItem('hospital.session')
                    localStorage.removeItem('hospital.token')
                    localStorage.removeItem('diagnostic.session')
                    localStorage.removeItem('diagnostic.token')
                    localStorage.removeItem('diagnostic.user')

                    const portals = ['doctor', 'reception', 'finance', 'lab', 'pharmacy', 'aesthetic', 'therapy', 'therapyLab', 'counselling']
                    portals.forEach(p => {
                      localStorage.removeItem(`${p}.session`)
                      localStorage.removeItem(`${p}.token`)
                      localStorage.removeItem(`${p}.user`)
                    })
                    localStorage.removeItem('pharma_user')
                  } catch { }
                  navigate('/diagnostic/login')
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
