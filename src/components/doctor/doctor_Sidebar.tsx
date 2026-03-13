import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import { LayoutDashboard, Users, Stethoscope, ScrollText, Bell, Search, FileText, Settings as SettingsIcon, LogOut, Landmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import PortalSwitcher from '../PortalSwitcher'

type NavItem = { to: string; label: string; end?: boolean; icon: any }

export const doctorSidebarNav: NavItem[] = [
  { to: '/doctor', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/doctor/patients', label: 'Patients', icon: Users },
  { to: '/doctor/patient-search', label: 'Patient History', icon: Search },
  { to: '/doctor/prescription', label: 'Prescription', icon: Stethoscope },
  { to: '/doctor/prescription-history', label: 'Prescription History', icon: ScrollText },
  { to: '/doctor/reports', label: 'Reports', icon: FileText },
  { to: '/doctor/manage-petty-cash', label: 'Manage Petty Cash', icon: Landmark },
  { to: '/doctor/manage-bank-balance', label: 'Manage Bank Balance', icon: Landmark },
  { to: '/doctor/notifications', label: 'Notifications', icon: Bell },
  { to: '/doctor/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Doctor_Sidebar({
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

  const isAllowed = (to: string) => {
    if (!allowed) return false
    if (allowed.includes('*')) return true
    return allowed.includes(to)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session') || localStorage.getItem('hospital.session')
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
      const a = perms?.doctor
      if (Array.isArray(a)) setAllowed(a)
      else setAllowed([])
    } catch {
      setAllowed([])
    }
  }, [pathname])
  const logout = async () => {
    try {
      const raw = localStorage.getItem('doctor.session')
      const u = raw ? JSON.parse(raw) : null
      await hospitalApi.logoutHospitalUser(u?.username || 'doctor')
    } catch { }
    try {
      const doctorToken = localStorage.getItem('doctor.token')
      localStorage.removeItem('doctor.session')
      localStorage.removeItem('doctor.token')
      // Keep legacy token key only if it was written by doctor login
      if (doctorToken && localStorage.getItem('token') === doctorToken) {
        localStorage.removeItem('token')
      }
    } catch { }
    navigate('/doctor/login')
  }

  const renderNav = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
      {doctorSidebarNav.filter(i => isAllowed(i.to)).map(item => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
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

      <div className="pt-2">
        <PortalSwitcher collapsed={isCollapsed} onExpand={onExpand} />
        <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2.5 sm:py-2 text-sm font-medium transition-colors duration-150 hover:bg-rose-600/80 hover:text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="truncate">Logout</span>}
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
            <div className="text-sm font-semibold">Doctor Menu</div>
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
        className={`hidden md:flex ${collapsed ? 'md:w-16' : 'md:w-64'} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
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
