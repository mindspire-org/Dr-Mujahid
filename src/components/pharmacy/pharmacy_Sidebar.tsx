import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  Boxes,
  Users,
  Truck,
  ShoppingCart,
  Settings,
  Wallet,
  Bell,
  FileText,
  Building2,
  RefreshCw,
  Receipt,
  Calculator,
  ClipboardList,
  PauseCircle,
  History,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { pharmacyApi } from '../../utils/api'
import PortalSwitcher from '../PortalSwitcher'

const nav = [
  { to: '/pharmacy', label: 'Dashboard', end: true, Icon: LayoutDashboard },
  { to: '/pharmacy/pos', label: 'POS / Dispense', Icon: CreditCard },
  { to: '/pharmacy/inventory', label: 'Inventory', Icon: Boxes },
  { to: '/pharmacy/purchase-history', label: 'Purchases', Icon: ShoppingCart },
  { to: '/pharmacy/sales-history', label: 'Sales History', Icon: FileText },
  { to: '/pharmacy/referrals', label: 'Referrals', Icon: ClipboardList },
  { to: '/pharmacy/suppliers', label: 'Suppliers', Icon: Truck },
  { to: '/pharmacy/customers', label: 'Credit Customers', Icon: Users },
  { to: '/pharmacy/companies', label: 'Companies', Icon: Building2 },
  { to: '/pharmacy/returns', label: 'Returns', Icon: RefreshCw },
  { to: '/pharmacy/expenses', label: 'Expenses', Icon: Receipt },
  { to: '/pharmacy/pay-in-out', label: 'Pay In / Out', Icon: Wallet },
  { to: '/pharmacy/manage-petty-cash', label: 'Manage Petty Cash', Icon: Wallet },
  { to: '/pharmacy/manage-bank-balance', label: 'Manage Bank Balance', Icon: Wallet },
  { to: '/pharmacy/manager-cash-count', label: 'Cash Count', Icon: Calculator },
  { to: '/pharmacy/purchase-drafts', label: 'Purchase Drafts', Icon: ClipboardList },
  { to: '/pharmacy/hold-sales', label: 'Hold Sales', Icon: PauseCircle },
  { to: '/pharmacy/notifications', label: 'Notifications', Icon: Bell },
  { to: '/pharmacy/audit-logs', label: 'Audit Logs', Icon: History },
  { to: '/pharmacy/settings', label: 'Settings', Icon: Settings },
]

export const pharmacySidebarNav = nav

type Props = { collapsed?: boolean; onExpand?: () => void; mobileOpen?: boolean; onCloseMobile?: () => void }

export default function Pharmacy_Sidebar({ collapsed = false, onExpand, mobileOpen = false, onCloseMobile }: Props) {
  const navigate = useNavigate()
  const [username, setUsername] = useState<string>('')
  const [items, setItems] = useState(nav)
  async function handleLogout() {
    try { await pharmacyApi.logoutUser(username || undefined) } catch { }
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('hospital.session')
      localStorage.removeItem('hospital.token')
      localStorage.removeItem('pharmacy.token')
      localStorage.removeItem('pharmacy.user')
      localStorage.removeItem('pharma_user')

      const portals = ['doctor', 'reception', 'finance', 'diagnostic', 'lab', 'aesthetic', 'therapy', 'therapyLab', 'counselling']
      portals.forEach(p => {
        localStorage.removeItem(`${p}.session`)
        localStorage.removeItem(`${p}.token`)
        localStorage.removeItem(`${p}.user`)
      })
    } catch { }
    navigate('/pharmacy/login')
  }

  useEffect(() => {
    // Determine username from localStorage
    try {
      const raw = localStorage.getItem('pharmacy.user') || localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        if (u?.username) setUsername(String(u.username))
      }
    } catch { }
  }, [])

  useEffect(() => {
    // Centralized permissions: from hospital.session -> permissions.pharmacy
    // Same logic pattern as diagnostic sidebar.
    const normalizePath = (p: string) => {
      const v = String(p || '').trim()
      if (!v) return v
      if (v.length > 1 && v.endsWith('/')) return v.slice(0, -1)
      return v
    }

    const readAllowed = (): string[] | null => {
      try {
        const raw = localStorage.getItem('hospital.session')
        if (!raw) return null
        const s = JSON.parse(raw)
        const role = String(s?.role || '')
        if (role === 'Admin') return ['*']
        const perms = s?.permissions
        const arr = perms?.pharmacy
        return Array.isArray(arr) ? arr.map(String) : null
      } catch {
        return null
      }
    }

    const allowed = readAllowed()
    const canSee = (to: string) => {
      if (!allowed) return true
      if (allowed.includes('*')) return true
      const t = normalizePath(to)
      return allowed.map(normalizePath).includes(t)
    }

    setItems(nav.filter(it => canSee(it.to)))
  }, [])

  const renderNav = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
      {items.map(item => {
        const Icon = item.Icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
              }`
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
      <div className="pt-2">
        <PortalSwitcher collapsed={isCollapsed} onExpand={onExpand} />
        <div className="mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        <button
          type="button"
          onClick={() => {
            onCloseMobile?.()
            void handleLogout()
          }}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-rose-600/80 hover:text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          Logout
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
          aria-label="Pharmacy navigation"
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
        className={`hidden md:flex ${collapsed ? 'md:w-16' : 'md:w-64'} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
        style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
      >
        {renderNav({ isCollapsed: collapsed })}
      </aside>
    </>
  )
}
