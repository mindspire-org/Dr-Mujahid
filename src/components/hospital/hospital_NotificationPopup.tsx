import { useEffect, useState } from 'react'
import { X, Bell, CheckCircle, Clock } from 'lucide-react'
import { hospitalApi } from '../../utils/api'

type Notification = {
  id: string
  title?: string
  message: string
  read?: boolean
  createdAt: string
}

type Props = {
  open: boolean
  onClose: () => void
  onViewAll: () => void
}

export default function Hospital_NotificationPopup({ open, onClose, onViewAll }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res: any = await hospitalApi.listUserNotifications()
      const list = Array.isArray(res?.notifications) ? res.notifications : []
      const mapped: Notification[] = list.map((n: any) => ({
        id: String(n?._id || n?.id || ''),
        title: n?.title != null ? String(n.title) : undefined,
        message: String(n?.message || ''),
        read: !!n?.read,
        createdAt: String(n?.createdAt || new Date().toISOString()),
      }))
      const unread = mapped.filter(n => !n.read)
      const toShow = unread.length > 0 ? unread.slice(0, 5) : mapped.slice(0, 5)
      setNotifications(toShow)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string, read: boolean) => {
    try {
      await hospitalApi.updateUserNotification(id, read)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read } : n)))
    } catch {}
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed right-4 top-16 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="mx-auto mb-2 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-400">No notifications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 ${
                    !n.read
                      ? 'bg-indigo-50 border-indigo-200 text-slate-900 ring-2 ring-indigo-400/40 dark:bg-indigo-900/15 dark:border-indigo-800 dark:text-slate-100'
                      : 'bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100'
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold truncate">{n.title || 'Notification'}</h4>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />}
                      </div>
                      <p className="mt-1 text-xs line-clamp-2 opacity-90">{n.message}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id, true)}
                          className="rounded p-1 hover:bg-white/50 dark:hover:bg-slate-800/50"
                          title="Mark as read"
                          type="button"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {n.read && (
                        <button
                          onClick={() => markAsRead(n.id, false)}
                          className="rounded p-1 hover:bg-white/50 dark:hover:bg-slate-800/50"
                          title="Mark as unread"
                          type="button"
                        >
                          <CheckCircle className="h-3.5 w-3.5 opacity-60" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-700">
          <button
            onClick={onViewAll}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-all"
            type="button"
          >
            View All Notifications
          </button>
        </div>
      </div>
    </>
  )
}

