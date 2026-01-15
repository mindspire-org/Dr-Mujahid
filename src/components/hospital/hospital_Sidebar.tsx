import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  PlusCircle,
  Ticket,
  History,
  Building2,
  Activity,
  Bed,
  Users,
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
  { to: '/hospital/today-tokens', label: "Today's Tokens", icon: Ticket },
  { to: '/hospital/token-history', label: 'Token History', icon: History },
  { to: '/hospital/departments', label: 'Departments', icon: Building2 },
]

const navBottom: NavItem[] = [
  { to: '/hospital/search-patients', label: 'Patient Profiling', icon: Search },
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

export default function Hospital_Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  const toggle = (label: string) => setOpen(prev => ({ ...prev, [label]: !prev[label] }))
  const isGroupActive = (items: NavItem[]) => items.some(i => pathname.startsWith(i.to))
  return (
    <aside
      className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white`}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <div className="h-16 px-4 flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <div className="font-semibold">{collapsed ? 'SB' : 'SideBar'}</div>
        {!collapsed && <div className="ml-auto text-xs opacity-80">admin</div>}
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {[...navTop].map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
              end={item.end}
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
                onClick={() => toggle(group.label)}
                className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${isOpen ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
                title={group.label}
              >
                <div className="flex items-center gap-3">
                  <GIcon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{group.label}</span>}
                </div>
                {!collapsed && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
              </button>
              {isOpen && (
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `ml-6 flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
                        end={item.end}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    )
                  })}
                </div>
              )}
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
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}

      </nav>
      <div className="p-3">
        <button
          onClick={async () => {
            try {
              const raw = localStorage.getItem('hospital.session')
              const u = raw ? JSON.parse(raw) : null
              await hospitalApi.logoutHospitalUser(u?.username||'')
            } catch {}
            try { localStorage.removeItem('hospital.session') } catch {}
            navigate('/hospital/login')
          }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
