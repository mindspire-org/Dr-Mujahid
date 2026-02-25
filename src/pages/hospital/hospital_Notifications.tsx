import { useEffect, useState } from 'react'
import { Bell, CheckCircle, RefreshCcw, Clock } from 'lucide-react'
import { hospitalApi } from '../../utils/api'

type Notification = {
  id: string
  type?: string
  title?: string
  message: string
  read?: boolean
  createdAt: string
  payload?: any
}

export default function Hospital_Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res: any = await hospitalApi.listUserNotifications()
      const list = Array.isArray(res?.notifications) ? res.notifications : []
      setNotifications(list.map((n: any) => ({
        id: String(n._id || n.id),
        type: n.type ? String(n.type) : undefined,
        title: n.title != null ? String(n.title) : undefined,
        message: String(n.message || ''),
        read: !!n.read,
        createdAt: String(n.createdAt || new Date().toISOString()),
        payload: n.payload,
      })))
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const markAll = async () => {
    try {
      await hospitalApi.markAllUserNotificationsRead()
      await load()
    } catch {}
  }

  const markOne = async (id: string, read: boolean) => {
    try { await hospitalApi.updateUserNotification(id, read) } catch {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read } : n))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-bold">Notifications</h2>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="btn-outline-navy inline-flex items-center gap-1"><RefreshCcw className="h-4 w-4" /> Refresh</button>
          <button onClick={markAll} className="btn-outline-navy inline-flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Mark all read</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-200">
          {notifications.length === 0 && !loading && (
            <div className="p-6 text-sm text-slate-500">No notifications</div>
          )}
          {loading && (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          )}
          {notifications.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? 'bg-sky-50/50' : ''}`}>
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : 'bg-indigo-600'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-semibold text-slate-900">{n.title || 'Transaction Notification'}</div>
                  <div className="shrink-0 flex items-center gap-2">
                    {!n.read && <button onClick={() => markOne(n.id, true)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Mark read</button>}
                    {n.read && <button onClick={() => markOne(n.id, false)} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Mark unread</button>}
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-700">{n.message}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" />{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
