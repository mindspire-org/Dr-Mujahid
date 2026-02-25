import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Bell } from 'lucide-react'
import { pharmacyApi } from '../../utils/api'
import { useEffect, useState } from 'react'
import Pharmacy_NotificationPopup from './pharmacy_NotificationPopup'

type Props = { onToggleSidebar?: () => void; collapsed?: boolean; onToggleTheme?: () => void; theme?: 'light'|'dark' }

export default function Pharmacy_Header({ onToggleSidebar, collapsed, onToggleTheme, theme }: Props) {
  const navigate = useNavigate()
  const DEFAULT_PHARMACY_NAME = "Men's Care Pharmacy"
  const [brand, setBrand] = useState<{ name?: string; logoDataUrl?: string }>(() => ({
    name: DEFAULT_PHARMACY_NAME,
    logoDataUrl: undefined,
  }))
  const [notificationCount, setNotificationCount] = useState(0)
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)
  const [displayName, setDisplayName] = useState<string>('Admin')
  const showThemeToggle = !!onToggleTheme && (theme === 'light' || theme === 'dark')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s: any = await pharmacyApi.getSettings()
        if (!mounted) return
        const name = String(s?.pharmacyName || '').trim()
        const logoDataUrl = String(s?.logoDataUrl || '').trim()
        setBrand({
          name: name || DEFAULT_PHARMACY_NAME,
          logoDataUrl: logoDataUrl || undefined,
        })
      } catch {
        if (!mounted) return
        setBrand({ name: DEFAULT_PHARMACY_NAME, logoDataUrl: undefined })
      }
    })()

    // Load display name from localStorage (best-effort)
    try {
      const raw = localStorage.getItem('pharmacy.user') || localStorage.getItem('hospital.session') || localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        setDisplayName(String(u?.username || u?.fullName || u?.name || '').trim() || '—')
      }
    } catch {}
    
    // Fetch notification count
    const fetchNotifications = async () => {
      try {
        const res: any = await pharmacyApi.getNotifications()
        if (mounted) setNotificationCount(Number(res?.unreadCount || 0))
      } catch {}
    }
    fetchNotifications()
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    
    return () => { 
      mounted = false
      clearInterval(interval)
    }
  }, [])
  
  async function handleLogout(){
    try {
      await pharmacyApi.logoutUser(displayName)
      await pharmacyApi.createAuditLog({
        actor: displayName || 'system',
        action: 'Logout',
        label: 'LOGOUT',
        method: 'POST',
        path: '/pharmacy/logout',
        at: new Date().toISOString(),
        detail: 'User logout',
      })
    } catch {}
    try { localStorage.removeItem('user'); localStorage.removeItem('pharmacy.user'); localStorage.removeItem('pharmacy.token') } catch {}
    navigate('/pharmacy/login')
  }
  return (
    <header
      className="sticky top-0 z-10 h-14 w-full border-b border-white/10 shadow-sm"
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)' }}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/pharmacy" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-violet-100 text-violet-600 shadow-inner">
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5'><path d='M4.5 12a5.5 5.5 0 0 1 9.9-3.3l.4.5 3 3a5.5 5.5 0 0 1-7.8 7.8l-3-3-.5-.4A5.48 5.48 0 0 1 4.5 12Zm4.9-3.6L7.1 10l6.9 6.9 2.3-2.3-6.9-6.9Z'/></svg>
              </div>
            )}
          </div>
          <div className="font-semibold text-white">{String(brand.name || '').trim() || DEFAULT_PHARMACY_NAME}</div>
          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Online</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setShowNotificationPopup(!showNotificationPopup)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/85 hover:bg-white/10 transition-all"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          <div className="hidden items-center gap-2 text-white/85 sm:flex">
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M6.75 3A2.75 2.75 0 0 0 4 5.75v12.5A2.75 2.75 0 0 0 6.75 21h10.5A2.75 2.75 0 0 0 20 18.25V5.75A2.75 2.75 0 0 0 17.25 3H6.75Zm0 1.5h10.5c.69 0 1.25.56 1.25 1.25v12.5c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25V5.75c0-.69.56-1.25 1.25-1.25Z'/></svg>
            <span>{new Date().toLocaleDateString()}</span>
            <span className="opacity-60">{new Date().toLocaleTimeString()}</span>
          </div>

          {showThemeToggle ? (
            <button
              type="button"
              onClick={() => onToggleTheme?.()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 sm:hidden"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              <span className="text-xs font-semibold">T</span>
            </button>
          ) : null}

          <div className="hidden sm:flex items-center rounded-full border border-white/15 bg-white/10 shadow-sm backdrop-blur overflow-hidden">
            {showThemeToggle ? (
              <button
                type="button"
                onClick={() => onToggleTheme?.()}
                className="inline-flex items-center gap-2 px-3 py-2 text-white hover:bg-white/10 transition"
                title="Toggle theme"
              >
                <span className="text-sm font-medium">Theme</span>
              </button>
            ) : null}

            {showThemeToggle ? <div className="h-6 w-px bg-white/15" /> : null}

            <div className="px-3 py-2 text-white capitalize">
              <span className="text-sm font-medium">{displayName}</span>
            </div>

            <div className="h-6 w-px bg-white/15" />

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 text-white hover:bg-rose-600/80 transition"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 sm:hidden"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notification Popup */}
      <Pharmacy_NotificationPopup
        open={showNotificationPopup}
        onClose={() => setShowNotificationPopup(false)}
        onViewAll={() => {
          setShowNotificationPopup(false)
          navigate('/pharmacy/notifications')
        }}
      />
    </header>
  )
}

