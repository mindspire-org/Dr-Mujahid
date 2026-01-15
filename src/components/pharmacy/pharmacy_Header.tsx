import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Sun, Bell } from 'lucide-react'
import { pharmacyApi } from '../../utils/api'
import { useEffect, useState } from 'react'
import Pharmacy_NotificationPopup from './pharmacy_NotificationPopup'

type Props = { onToggleSidebar?: () => void; onToggleTheme?: () => void; theme?: 'light'|'dark' }

export default function Pharmacy_Header({ onToggleSidebar, onToggleTheme, theme }: Props) {
  const navigate = useNavigate()
  const [pharmacyName, setPharmacyName] = useState('Pharmacy')
  const [notificationCount, setNotificationCount] = useState(0)
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const ls = localStorage.getItem('pharmacy.theme') || localStorage.getItem('theme')
      return document.documentElement.classList.contains('dark') || ls === 'dark'
    } catch { return false }
  })
  const [displayName, setDisplayName] = useState<string>('Admin')

  const toggleDarkMode = () => {
    if (onToggleTheme) {
      onToggleTheme()
      return
    }
    setIsDarkMode(prev => {
      const next = !prev
      try {
        const root = document.documentElement
        if (next) {
          root.classList.add('dark')
          localStorage.setItem('pharmacy.theme','dark'); localStorage.setItem('theme','dark')
        } else {
          root.classList.remove('dark')
          localStorage.setItem('pharmacy.theme','light'); localStorage.setItem('theme','light')
        }
      } catch {}
      return next
    })
  }
  const dark = typeof theme === 'string' ? theme === 'dark' : isDarkMode

  useEffect(() => {
    let mounted = true
    pharmacyApi.getSettings().then(s => {
      if (mounted) setPharmacyName(s.pharmacyName || 'Pharmacy')
    }).catch(() => {})

    // Load display name from localStorage (best-effort)
    try {
      const raw = localStorage.getItem('user') || localStorage.getItem('pharmacy.user')
      if (raw) {
        const u = JSON.parse(raw)
        setDisplayName(u?.username || u?.name || u?.role || 'Admin')
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
    <header className="sticky top-0 z-10 h-16 w-full border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/pharmacy" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5'><path d='M4.5 12a5.5 5.5 0 0 1 9.9-3.3l.4.5 3 3a5.5 5.5 0 0 1-7.8 7.8l-3-3-.5-.4A5.48 5.48 0 0 1 4.5 12Zm4.9-3.6L7.1 10l6.9 6.9 2.3-2.3-6.9-6.9Z'/></svg>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{pharmacyName}</div>
            <div className="text-sm font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">HealthSpire</div>
          </div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 sm:hidden">{pharmacyName}</div>
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Online</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {/* Notification Bell */}
          <button
            onClick={() => setShowNotificationPopup(!showNotificationPopup)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-all dark:text-slate-200 dark:hover:bg-slate-800"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          <div className="hidden items-center gap-2 text-slate-600 sm:flex dark:text-slate-300">
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M6.75 3A2.75 2.75 0 0 0 4 5.75v12.5A2.75 2.75 0 0 0 6.75 21h10.5A2.75 2.75 0 0 0 20 18.25V5.75A2.75 2.75 0 0 0 17.25 3H6.75Zm0 1.5h10.5c.69 0 1.25.56 1.25 1.25v12.5c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25V5.75c0-.69.56-1.25 1.25-1.25Z'/></svg>
            <span>{new Date().toLocaleDateString()}</span>
            <span className="opacity-60">{new Date().toLocaleTimeString()}</span>
          </div>

          <button
            onClick={toggleDarkMode}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 sm:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="hidden sm:flex items-center rounded-full border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/70 dark:ring-1 dark:ring-slate-500/40 overflow-hidden">
            <button
              onClick={toggleDarkMode}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 transition dark:text-slate-300 dark:hover:bg-slate-800"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="text-sm font-medium">{dark ? "Light" : "Dark"}</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

            <div className="px-3 py-2 text-slate-700 capitalize dark:text-slate-300">
              <span className="text-sm font-medium">{displayName}</span>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 sm:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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

