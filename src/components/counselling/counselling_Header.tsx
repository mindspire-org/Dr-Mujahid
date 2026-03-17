import { Link, useNavigate } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Hospital_NotificationPopup from '../hospital/hospital_NotificationPopup'

type Props = { onToggleSidebar?: () => void; sidebarCollapsed?: boolean; onToggleTheme?: () => void; theme?: 'light'|'dark'; onOpenMobile?: () => void }

export default function Counselling_Header({ onToggleSidebar, sidebarCollapsed, onToggleTheme, theme, onOpenMobile }: Props) {
  const navigate = useNavigate()
  const DEFAULT_HOSPITAL_NAME = "Men's Care Clinic"
  const [displayName, setDisplayName] = useState<string>('—')
  const [notificationCount, setNotificationCount] = useState(0)
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)
  const [brand, setBrand] = useState<{ name?: string; logoDataUrl?: string }>(() => {
    try {
      const raw = localStorage.getItem('hospital.settings')
      const s = raw ? JSON.parse(raw) : null
      const name = String(s?.name || '').trim()
      return { name: name || DEFAULT_HOSPITAL_NAME, logoDataUrl: s?.logoDataUrl }
    } catch {
      return { name: DEFAULT_HOSPITAL_NAME, logoDataUrl: undefined }
    }
  })

  useEffect(() => {
    const onUpd = (e: any) => {
      const d = e?.detail || {}
      const name = String(d?.name || '').trim()
      setBrand({ name: name || DEFAULT_HOSPITAL_NAME, logoDataUrl: d?.logoDataUrl })
    }
    try { window.addEventListener('hospital:settings-updated', onUpd as any) } catch {}
    return () => { try { window.removeEventListener('hospital:settings-updated', onUpd as any) } catch {} }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('counselling.session') || localStorage.getItem('hospital.session') || localStorage.getItem('user') || '{}'
      const s = JSON.parse(raw)
      const name = String(s?.username || s?.fullName || s?.name || '').trim()
      setDisplayName(name || '—')
    } catch {
      setDisplayName('—')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const fetchNotifications = async () => {
      try {
        const res: any = await hospitalApi.listUserNotifications()
        const list = Array.isArray(res?.notifications) ? res.notifications : []
        const unread = list.filter((n: any) => !n?.read).length
        if (mounted) setNotificationCount(Number(unread || 0))
      } catch {}
    }
    void fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  function handleToggleTheme(){
    const next = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('hospital.theme', next) } catch {}
    try { localStorage.setItem('counselling.theme', next) } catch {}
    try { document.documentElement.classList.toggle('dark', next === 'dark') } catch {}
    try {
      const scope = document.querySelector('.hospital-scope')
      if (scope) scope.classList.toggle('dark', next === 'dark')
    } catch {}
    onToggleTheme?.()
  }

  return (
    <header
      className="sticky top-0 z-10 h-14 w-full border-b border-white/10 shadow-sm"
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)' }}
    >
      <div className="flex h-full items-center">
        <div className="hidden h-full w-16 items-center justify-center md:flex">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className="hidden h-8 w-px bg-white/15 md:block" />
        <div className="flex h-full flex-1 items-center gap-0 px-3 sm:px-5">
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/counselling" className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-violet-100 text-violet-600 shadow-inner">
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5'><path d='M4.5 12a5.5 5.5 0 0 1 9.9-3.3l.4.5 3 3a5.5 5.5 0 0 1-7.8 7.8l-3-3-.5-.4A5.48 5.48 0 0 1 4.5 12Zm4.9-3.6L7.1 10l6.9 6.9 2.3-2.3-6.9-6.9Z'/></svg>
              </div>
            )}
          </div>
          <div className="min-w-0 font-semibold text-white text-sm sm:text-base truncate">{String(brand.name || '').trim() || DEFAULT_HOSPITAL_NAME}</div>
          <span className="ml-2 hidden sm:inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Online</span>
          </Link>

          <div className="ml-auto flex items-center gap-3 text-sm">
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
          <button onClick={handleToggleTheme} className="hidden rounded-md border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 sm:flex items-center gap-2">
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M7.5 3h9A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5v-13A2.5 2.5 0 0 1 7.5 3Zm0 2A.5.5 0 0 0 7 5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-9Z'/></svg>
            {theme === 'dark' ? 'Dark: On' : 'Dark: Off'}
          </button>
          <div className="rounded-md border border-white/15 px-3 py-1.5 text-white">{displayName}</div>
          </div>
        </div>
      </div>

      <Hospital_NotificationPopup
        open={showNotificationPopup}
        onClose={() => setShowNotificationPopup(false)}
        onViewAll={() => {
          setShowNotificationPopup(false)
          navigate('/counselling/notifications')
        }}
      />
    </header>
  )
}
