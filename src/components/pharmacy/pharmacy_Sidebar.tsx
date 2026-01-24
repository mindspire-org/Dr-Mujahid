import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  Boxes,
  Users,
  Truck,
  ReceiptText,
  ShoppingCart,
  RotateCcw,
  CalendarCheck,
  UserCog,
  Settings,
  CalendarDays,
  BarChart3,
  BookText,
  FileClock,
  Wallet,
  Users2,
  ClipboardCheck,
  Bell,
  LogOut,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { pharmacyApi } from '../../utils/api'

const nav = [
  { to: '/pharmacy', label: 'Dashboard', end: true, Icon: LayoutDashboard },
  { to: '/pharmacy/pos', label: 'Point of Sale', Icon: CreditCard },
  { to: '/pharmacy/inventory', label: 'Inventory', Icon: Boxes },
  { to: '/pharmacy/customers', label: 'Customers', Icon: Users },
  { to: '/pharmacy/suppliers', label: 'Suppliers', Icon: Truck },
  { to: '/pharmacy/sales-history', label: 'Sales History', Icon: ReceiptText },
  { to: '/pharmacy/purchase-history', label: 'Purchase History', Icon: ShoppingCart },
  { to: '/pharmacy/return-history', label: 'Return History', Icon: RotateCcw },
  { to: '/pharmacy/staff-attendance', label: 'Staff Attendance', Icon: CalendarCheck },
  { to: '/pharmacy/staff-management', label: 'Staff Management', Icon: UserCog },
  { to: '/pharmacy/staff-settings', label: 'Staff Settings', Icon: Settings },
  { to: '/pharmacy/staff-monthly', label: 'Staff Monthly', Icon: CalendarDays },
  { to: '/pharmacy/reports', label: 'Reports', Icon: BarChart3 },
  { to: '/pharmacy/notifications', label: 'Notifications', Icon: Bell },
  { to: '/pharmacy/guidelines', label: 'Guidelines', Icon: BookText },
  { to: '/pharmacy/returns', label: 'Customer Return', Icon: RotateCcw },
  { to: '/pharmacy/supplier-returns', label: 'Supplier Return', Icon: RotateCcw },
  { to: '/pharmacy/prescriptions', label: 'Prescription Intake', Icon: ClipboardCheck },
  { to: '/pharmacy/referrals', label: 'Referrals', Icon: FileClock },
  { to: '/pharmacy/audit-logs', label: 'Audit Logs', Icon: FileClock },
  { to: '/pharmacy/expenses', label: 'Expenses', Icon: Wallet },
  { to: '/pharmacy/pay-in-out', label: 'Pay In/Out', Icon: Wallet },
  { to: '/pharmacy/manager-cash-count', label: 'Manager Cash Count', Icon: Wallet },
  { to: '/pharmacy/settings', label: 'Settings', Icon: Settings },
  { to: '/pharmacy/sidebar-permissions', label: 'Sidebar Permissions', Icon: Settings },
  { to: '/pharmacy/user-management', label: 'User Management', Icon: Users2 },
]

export const pharmacySidebarNav = nav

type Props = { collapsed?: boolean; onExpand?: () => void; collapseSignal?: number }

export default function Pharmacy_Sidebar({ collapsed = false, onExpand, collapseSignal: _collapseSignal }: Props) {
  const navigate = useNavigate()
  const [role, setRole] = useState<string>('admin')
  const [username, setUsername] = useState<string>('')
  const [items, setItems] = useState(nav)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  async function handleLogout(){
    try { await pharmacyApi.logoutUser(username || undefined) } catch {}
    try {
      localStorage.removeItem('pharmacy.user')
      localStorage.removeItem('pharma_user')
      localStorage.removeItem('pharmacy.token')
    } catch {}
    navigate('/pharmacy/login')
  }

  useEffect(() => {
    // Determine role from localStorage
    try {
      const raw = localStorage.getItem('pharmacy.user') || localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        if (u?.role) setRole(String(u.role).toLowerCase())
        if (u?.username) setUsername(String(u.username))
      }
    } catch {}
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res: any = await pharmacyApi.listSidebarPermissions(role)
        const doc = Array.isArray(res) ? res[0] : res
        const map = new Map<string, any>()
        const perms = (doc?.permissions || []) as Array<{ path: string; visible?: boolean; order?: number }>
        for (const p of perms) map.set(p.path, p)
        const isAdmin = String(role || '').toLowerCase() === 'admin'
        const computed = nav
          .filter(item => {
            if (item.to === '/pharmacy/sidebar-permissions' && !isAdmin) return false
            const perm = map.get(item.to)
            return perm ? perm.visible !== false : true
          })
          .sort((a, b) => {
            const oa = map.get(a.to)?.order ?? Number.MAX_SAFE_INTEGER
            const ob = map.get(b.to)?.order ?? Number.MAX_SAFE_INTEGER
            if (oa !== ob) return oa - ob
            const ia = nav.findIndex(n => n.to === a.to)
            const ib = nav.findIndex(n => n.to === b.to)
            return ia - ib
          })
        if (mounted) setItems(computed)
      } catch {
        if (mounted) setItems(nav)
      }
    })()
    return () => { mounted = false }
  }, [role])
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  return (
    <aside
      className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}>
      <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {items.map(item => {
          const Icon = item.Icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
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
                  await handleLogout()
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
