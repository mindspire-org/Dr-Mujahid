import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Hospital_NotificationPopup from '../../components/hospital/hospital_NotificationPopup'

type Props = { title?: string }

export default function TherapyLab_Header({ title = 'Therapy & Lab Reports Entry' }: Props) {
  const navigate = useNavigate()
  const DEFAULT_HOSPITAL_NAME = "Men's Care Clinic"
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
    try {
      window.addEventListener('hospital:settings-updated', onUpd as any)
    } catch {}
    return () => {
      try {
        window.removeEventListener('hospital:settings-updated', onUpd as any)
      } catch {}
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

  return (
    <header
      className="sticky top-0 z-10 h-14 w-full border-b border-white/10 shadow-sm"
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)' }}
    >
      <div className="flex h-full items-center px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-violet-100 text-violet-600 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M4.5 12a5.5 5.5 0 0 1 9.9-3.3l.4.5 3 3a5.5 5.5 0 0 1-7.8 7.8l-3-3-.5-.4A5.48 5.48 0 0 1 4.5 12Zm4.9-3.6L7.1 10l6.9 6.9 2.3-2.3-6.9-6.9Z" />
                </svg>
              </div>
            )}
          </div>
          <div className="text-white">
            <div className="text-sm font-semibold leading-tight">{String(brand.name || '').trim() || DEFAULT_HOSPITAL_NAME}</div>
            <div className="text-xs text-white/70 leading-tight">{title}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
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
          <div className="text-xs text-white/70">
            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <Hospital_NotificationPopup
        open={showNotificationPopup}
        onClose={() => setShowNotificationPopup(false)}
        onViewAll={() => {
          setShowNotificationPopup(false)
          navigate('/therapy-lab/notifications')
        }}
      />
    </header>
  )
}
