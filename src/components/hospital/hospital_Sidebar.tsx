import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  PlusCircle,
  Ticket,
  History,
  Building2,
  LogOut,
  Calendar,
  UserCog,
  Settings,
  CalendarDays,
  Search,
  Stethoscope,
  ScrollText,
  Database,
  ReceiptText,
  CreditCard,
  Wallet,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

type NavItem = { to: string; label: string; end?: boolean; icon: LucideIcon }

const navTop: NavItem[] = [
  { to: '/hospital', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/hospital/token-generator', label: 'Token Generator', icon: PlusCircle },
  { to: '/hospital/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/hospital/today-tokens', label: "Today's Tokens", icon: Ticket },
  { to: '/hospital/token-history', label: 'Token History', icon: History },
  { to: '/hospital/departments', label: 'Departments', icon: Building2 },
]

const navBottom: NavItem[] = [
  { to: '/hospital/search-patients', label: 'Patient History', icon: Search },
  { to: '/hospital/history-taking', label: 'History Taking', icon: ScrollText },
  { to: '/hospital/lab-reports-entry', label: 'Lab Reports Entry', icon: ScrollText },
  { to: '/hospital/finance/petty-cash-balance', label: 'Petty Cash Mangement', icon: Wallet },
  { to: '/hospital/user-management', label: 'Users', icon: UserCog },
  { to: '/hospital/audit', label: 'Audit log', icon: ScrollText },
  { to: '/hospital/settings', label: 'Settings', icon: Settings },
  { to: '/hospital/backup', label: 'Backup', icon: Database },
]

const groups: { label: string; icon: LucideIcon; items: NavItem[] }[] = [
  {
    label: 'Staff Management',
    icon: UserCog,
    items: [
      { to: '/hospital/staff-dashboard', label: 'Staff Dashboard', icon: LayoutDashboard },
      { to: '/hospital/staff-attendance', label: 'Staff Attendance', icon: Calendar },
      { to: '/hospital/staff-monthly', label: 'Staff Monthly', icon: CalendarDays },
      { to: '/hospital/staff-settings', label: 'Staff Settings', icon: Settings },
      { to: '/hospital/staff-management', label: 'Staff Management', icon: UserCog },
    ],
  },
  {
    label: 'Doctor Management',
    icon: Stethoscope,
    items: [
      { to: '/hospital/doctors', label: 'Add Doctors', icon: Stethoscope },
      { to: '/hospital/doctor-schedules', label: 'Doctor Schedules', icon: CalendarDays },
      { to: '/hospital/finance/doctors', label: 'Doctors Finance', icon: Wallet },
      { to: '/hospital/finance/doctor-payouts', label: 'Doctor Payouts', icon: CreditCard },
    ],
  },
  {
    label: 'Expense Management',
    icon: ReceiptText,
    items: [
      { to: '/hospital/finance/add-expense', label: 'Add Expense', icon: ReceiptText },
      { to: '/hospital/finance/expenses', label: 'Expense History', icon: ReceiptText },
      { to: '/hospital/finance/transactions', label: 'Transactions', icon: CreditCard },
    ],
  },
]

export default function Hospital_Sidebar({ collapsed = false, onExpand, collapseSignal }: { collapsed?: boolean; onExpand?: () => void; collapseSignal?: number }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  const toggle = (label: string) => setOpen(prev => ({ ...prev, [label]: !prev[label] }))
  const isGroupActive = (items: NavItem[]) => items.some(i => pathname.startsWith(i.to))

  useEffect(() => {
    if (collapseSignal == null) return
    setOpen({})
  }, [collapseSignal])

  async function logout(){
    try {
      const raw = localStorage.getItem('hospital.session')
      const u = raw ? JSON.parse(raw) : null
      await hospitalApi.logoutHospitalUser(u?.username||'')
    } catch {}
    try { localStorage.removeItem('hospital.session') } catch {}
    navigate('/hospital/login')
  }

  return (
    <aside
      className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {[...navTop].map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
              end={item.end}
              onClick={() => {
                if (collapsed) onExpand?.()
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}

        {/* Management groups */}
        {groups.map(group => {
          const GIcon = group.icon
          const isOpen = open[group.label] ?? isGroupActive(group.items)
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => {
                  if (collapsed) {
                    onExpand?.()
                    setOpen(prev => ({ ...prev, [group.label]: true }))
                    return
                  }
                  toggle(group.label)
                }}
                className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${isOpen ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
                title={group.label}
              >
                <div className="flex items-center gap-3">
                  <GIcon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{group.label}</span>}
                </div>
                {!collapsed && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
              </button>
              <div
                className={`ml-2 overflow-hidden transition-all duration-200 ease-in-out ${!collapsed && isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} ${!collapsed && isOpen ? 'mt-1' : 'mt-0'}`}
              >
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `ml-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
                        end={item.end}
                        onClick={() => {
                          if (collapsed) onExpand?.()
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {[...navBottom].map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
              end={item.end}
              onClick={() => {
                if (collapsed) onExpand?.()
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}

        <div className="pt-2">
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
