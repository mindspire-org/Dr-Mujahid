import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardPlus, ListChecks, FlaskConical, FileText, BarChart3, PieChart,
  Boxes, Truck, History, Undo2, RotateCcw, CalendarCheck, Users, Settings as Cog,
  CalendarDays, UserCog, ScrollText, Receipt, Droplets, PackageOpen, UserPlus, Wallet, Calculator, LogOut
} from 'lucide-react'
import { useState } from 'react'

type Item = { to: string; label: string; end?: boolean; icon: any }
const nav: Item[] = [
  { to: '/lab', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/lab/orders', label: 'Sample Intake', icon: ClipboardPlus },
  { to: '/lab/tracking', label: 'Sample Tracking', icon: ListChecks },
  { to: '/lab/tests', label: 'Test Catalog', icon: FlaskConical },
  { to: '/lab/results', label: 'Result Entry', icon: FileText },
  { to: '/lab/referrals', label: 'Referrals', icon: ListChecks },
  { to: '/lab/reports', label: 'Reports Generator', icon: BarChart3 },
  { to: '/lab/reports-summary', label: 'Reports', icon: PieChart },
  { to: '/lab/inventory', label: 'Inventory', icon: Boxes },
  { to: '/lab/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/lab/purchase-history', label: 'Purchase History', icon: History },
  { to: '/lab/supplier-returns', label: 'Supplier Returns', icon: Undo2 },
  { to: '/lab/return-history', label: 'Return History', icon: RotateCcw },
  // Blood Bank
  { to: '/lab/bb/donors', label: 'BB • Donors', icon: UserPlus },
  { to: '/lab/bb/inventory', label: 'BB • Inventory', icon: PackageOpen },
  { to: '/lab/bb/receivers', label: 'BB • Receivers', icon: Droplets }, 
  { to: '/lab/staff-attendance', label: 'Staff Attendance', icon: CalendarCheck },
  { to: '/lab/staff-management', label: 'Staff Management', icon: Users },
  { to: '/lab/staff-settings', label: 'Staff Settings', icon: Cog },
  { to: '/lab/staff-monthly', label: 'Staff Monthly', icon: CalendarDays },
  { to: '/lab/user-management', label: 'User Management', icon: UserCog },
  { to: '/lab/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/lab/expenses', label: 'Expenses', icon: Receipt },
  { to: '/lab/pay-in-out', label: 'Pay In / Out', icon: Wallet },
  { to: '/lab/manager-cash-count', label: 'Manager Cash Count', icon: Calculator },
  { to: '/lab/settings', label: 'Settings', icon: Cog },
]

export default function Lab_Sidebar({ collapsed = false, onExpand, collapseSignal: _collapseSignal }: { collapsed?: boolean; onExpand?: () => void; collapseSignal?: number }) {
  const navigate = useNavigate()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const logout = () => {
    try { localStorage.removeItem('lab.session') } catch {}
    navigate('/lab/login')
  }
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  return (
    <aside
      className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {nav.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium flex items-center ${collapsed?'justify-center gap-0':'gap-2'} ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
              end={item.end}
              onClick={() => {
                if (collapsed) onExpand?.()
              }}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
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
                onClick={() => {
                  setLogoutConfirmOpen(false)
                  logout()
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
