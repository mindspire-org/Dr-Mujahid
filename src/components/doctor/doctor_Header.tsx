import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { hospitalApi } from '../../utils/api'
import Hospital_NotificationPopup from '../hospital/hospital_NotificationPopup'
import { useNavigate } from 'react-router-dom'

type DoctorSession = { id: string; name: string; username: string }

type Props = { onToggleSidebar?: () => void; collapsed?: boolean; onToggleTheme?: () => void; theme?: 'light' | 'dark' }

export default function Doctor_Header({ onToggleSidebar, collapsed, onToggleTheme, theme }: Props) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [displayUser, setDisplayUser] = useState<string>('—')
  const [notificationCount, setNotificationCount] = useState(0)
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      setDoc(raw ? JSON.parse(raw) : null)
    } catch { setDoc(null) }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session') || localStorage.getItem('hospital.session') || '{}'
      const s = JSON.parse(raw)
      const name = String(s?.username || s?.fullName || s?.name || '').trim()
      setDisplayUser(name || '—')
    } catch {
      setDisplayUser('—')
    }
  }, [])
  useEffect(() => {
    try {
      const sess = doc
      if (!sess) return
      let stopped = false
        ; (async () => {
          try {
            const res = await hospitalApi.listDoctors() as any
            if (stopped) return
            const docs: any[] = res?.doctors || []
            const match = docs.find(d => String(d._id || d.id) === String(sess.id || '')) ||
              docs.find(d => String(d.username || '').toLowerCase() === String(sess.username || '').toLowerCase()) ||
              docs.find(d => String(d.name || '').toLowerCase() === String(sess.name || '').toLowerCase())
            if (match) {
              const nextId = String(match._id || match.id)
              const nextName = String(match.name || sess.name || '')
              if (String(sess.id || '') !== nextId || String(sess.name || '') !== nextName) {
                const next = { ...sess, id: nextId, name: nextName }
                try { localStorage.setItem('doctor.session', JSON.stringify(next)) } catch { }
                setDoc(next)
              }
            }
          } catch { }
        })()
      return () => { stopped = true }
    } catch { }
  }, [doc])
  function handleToggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('doctor.theme', next) } catch { }
    try { document.documentElement.classList.toggle('dark', next === 'dark') } catch { }
    try { const scope = document.querySelector('.doctor-scope'); if (scope) scope.classList.toggle('dark', next === 'dark') } catch { }
    onToggleTheme?.()
  }

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
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className="hidden h-8 w-px bg-white/15 md:block" />

        <div className="flex h-full flex-1 items-center gap-0 px-3 sm:px-5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-3 font-semibold text-white truncate max-w-[150px] sm:max-w-none">Dr. {doc?.name || '—'}</div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm">
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
            <div className="hidden items-center gap-2 text-white/85 lg:flex">
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M6.75 3A2.75 2.75 0 0 0 4 5.75v12.5A2.75 2.75 0 0 0 6.75 21h10.5A2.75 2.75 0 0 0 20 18.25V5.75A2.75 2.75 0 0 0 17.25 3H6.75Zm0 1.5h10.5c.69 0 1.25.56 1.25 1.25v12.5c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25V5.75c0-.69.56-1.25 1.25-1.25Z' /></svg>
              <span className="whitespace-nowrap">{new Date().toLocaleDateString()}</span>
              <span className="opacity-60 whitespace-nowrap">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button onClick={handleToggleTheme} className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 sm:gap-2">
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4'><path d='M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 5.106a.75.75 0 0 0-1.061 0l-1.59 1.591a.75.75 0 1 0 1.06 1.06l1.591-1.59a.75.75 0 0 0 0-1.061ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM18.894 18.894a.75.75 0 0 1 0 1.061l-1.591 1.59a.75.75 0 1 1-1.06-1.06l1.59-1.591a.75.75 0 0 1 1.061 0ZM12 21.75a.75.75 0 0 1-.75-.75v-2.25a.75.75 0 0 1 1.5 0V21a.75.75 0 0 1-.75.75ZM5.106 18.894a.75.75 0 0 0 0 1.061l1.59 1.591a.75.75 0 1 0 1.061-1.06l-1.591-1.591a.75.75 0 0 0-1.06 0ZM2.25 12a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75ZM5.106 5.106a.75.75 0 0 1 1.06 0l1.591 1.59a.75.75 0 0 1-1.06 1.061l-1.591-1.59a.75.75 0 0 1 0-1.061Z' /></svg>
              <span className="hidden sm:inline-block whitespace-nowrap">{theme === 'dark' ? 'Dark: On' : 'Dark: Off'}</span>
            </button>
            <div className="max-w-[70px] sm:max-w-[120px] truncate rounded-md border border-white/15 px-3 py-1.5 text-white bg-white/5 font-medium">{displayUser}</div>
          </div>
        </div>
      </div>

      <Hospital_NotificationPopup
        open={showNotificationPopup}
        onClose={() => setShowNotificationPopup(false)}
        onViewAll={() => {
          setShowNotificationPopup(false)
          navigate('/doctor/notifications')
        }}
      />
    </header>
  )
}
