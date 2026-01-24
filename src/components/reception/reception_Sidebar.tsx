import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Ticket, ListChecks, Calculator, Search } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import { useState } from 'react'

type Item = { to: string; label: string; icon: any; end?: boolean }
type Group = { label: string; items: Item[] }

export default function Reception_Sidebar({ collapsed = false, onExpand, collapseSignal: _collapseSignal }: { collapsed?: boolean; onExpand?: () => void; collapseSignal?: number }){
  const navigate = useNavigate()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const width = collapsed ? 'md:w-16' : 'md:w-64'
  const groups: Group[] = [
    {
      label: 'Hospital',
      items: [
        { to: '/reception/token-generator', label: 'Token Generator', icon: Ticket },
        { to: "/reception/today-tokens", label: "Today's Tokens", icon: ListChecks },
        { to: '/reception/search-patients', label: 'Patient History', icon: Search },
      ],
    },
    {
      label: 'Laboratory',
      items: [
        { to: '/reception/lab/sample-intake', label: 'Lab Sample Intake', icon: Ticket },
        { to: '/reception/lab/sample-tracking', label: 'Lab Sample Tracking', icon: ListChecks },
      ],
    },
    {
      label: 'Diagnostics',
      items: [
        { to: '/reception/diagnostic/token-generator', label: 'Diagnostic Token Generator', icon: Ticket },
        { to: '/reception/diagnostic/sample-tracking', label: 'Diagnostic Sample Tracking', icon: ListChecks },
      ],
    },
    {
      label: 'Others',
      items: [
        { to: '/reception/lab/manager-cash-count', label: 'Manager Cash Count', icon: Calculator },
      ],
    },
  ]
  async function logout(){
    try {
      const raw = localStorage.getItem('reception.session')
      const u = raw ? JSON.parse(raw) : null
      await hospitalApi.logoutHospitalUser(u?.username||'reception')
    } catch {}
    try { localStorage.removeItem('reception.session') } catch {}
    navigate('/reception/login')
  }
  return (
    <aside
      className={`hidden md:flex ${width} md:flex-col md:border-r md:text-white min-h-0 overflow-hidden transition-[width] duration-200 ease-in-out`}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)', borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <nav className="hospital-sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {groups.map((g) => (
          <div key={g.label} className="space-y-1">
            {!collapsed && (
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
                    `rounded-md px-3 py-2 text-sm font-medium flex items-center ${collapsed ? 'justify-center gap-0' : 'gap-2'} ${isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`
                  }
                  title={collapsed ? it.label : undefined}
                  onClick={() => {
                    if (collapsed) onExpand?.()
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed && <span>{it.label}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}

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
