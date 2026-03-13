import { useEffect, useMemo, useRef, useState } from 'react'
import { logAudit } from '../../utils/hospital_audit'
import { adminApi } from '../../utils/api'

const LAST_BACKUP_KEY = 'hospital_last_backup'
const AUTO_SETTINGS_KEY = 'hospital_backup_settings'

type AutoSettings = {
  enabled: boolean
  minutes: number
  folderPath: string
  adminKey?: string
}

export default function Hospital_Backup() {
  const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem(LAST_BACKUP_KEY))
  const [settings, setSettings] = useState<AutoSettings>(() => {
    try {
      const raw = localStorage.getItem(AUTO_SETTINGS_KEY)
      return raw ? JSON.parse(raw) : { enabled: false, minutes: 60, folderPath: '', adminKey: '' }
    } catch {
      return { enabled: false, minutes: 60, folderPath: '', adminKey: '' }
    }
  })
  const [banner, setBanner] = useState('')
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const nextBackup = useMemo(() => {
    if (!settings.enabled || !lastBackup) return 'Not scheduled'
    const last = new Date(lastBackup)
    if (Number.isNaN(last.getTime())) return 'Not scheduled'
    const next = new Date(last.getTime() + settings.minutes * 60 * 1000)
    return next.toLocaleString()
  }, [settings.enabled, settings.minutes, lastBackup])

  // Load settings from backend (DB-authoritative)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadingSettings(true)
      try {
        const s = await adminApi.getBackupSettings() as any
        if (!mounted) return
        setSettings(prev => ({
          ...prev,
          enabled: Boolean(s?.enabled),
          minutes: Number(s?.intervalMinutes ?? s?.minutes ?? prev.minutes) || prev.minutes,
          folderPath: String(s?.folderPath || ''),
        }))
        const last = s?.lastBackupAt || s?.lastBackup || null
        if (last) {
          const ts = new Date(last).toISOString()
          localStorage.setItem(LAST_BACKUP_KEY, ts)
          setLastBackup(ts)
        }
      } catch {
        // Keep local fallback values.
      } finally {
        if (mounted) setLoadingSettings(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const showBanner = (msg: string) => {
    setBanner(msg)
    setTimeout(() => setBanner(''), 2000)
  }

  const doBackup = async (isAuto = false) => {
    try {
      if (!isAuto) setRunningBackup(true)

      // Always export a downloadable JSON for the user
      const payload = await adminApi.exportAll() as any
      const ts = String(payload?._meta?.ts || new Date().toISOString())
      const stamp = ts.replace(/[:T]/g, '-').slice(0, 19)
      const dbName = String(payload?._meta?.db || 'hospital_dev')
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `backup-${dbName}-${stamp}.json`
      a.click()
      URL.revokeObjectURL(a.href)

      // Additionally, if auto backup is enabled, also trigger server-side disk backup
      if (settings.enabled) {
        try {
          await adminApi.runBackupToDisk()
        } catch {}
      }

      localStorage.setItem(LAST_BACKUP_KEY, ts)
      setLastBackup(ts)
      if (!isAuto) showBanner('Backup created')
      logAudit('user_edit', isAuto ? 'auto backup created' : 'backup created')
    } catch (e:any) {
      showBanner('Backup failed')
    } finally {
      if (!isAuto) setRunningBackup(false)
    }
  }

  const triggerRestore = () => fileInputRef.current?.click()

  const onRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setRestoring(true)
      const text = await file.text()
      const data = JSON.parse(text)
      await adminApi.restoreAll(data)
      showBanner('Backup restored')
      logAudit('user_edit', 'backup restored (DB)')
    } catch (err:any) {
      showBanner('Invalid backup file or restore failed')
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  const deleteAll = async () => {
    try {
      setPurging(true)
      await adminApi.purgeAll()
      setLastBackup(null)
      showBanner('All data cleared (DB)')
      logAudit('user_delete', 'purge all data (DB)')
      setTimeout(() => { try { window.location.reload() } catch {} }, 600)
    } catch(e:any){
      showBanner('Delete failed')
    } finally {
      setPurging(false)
    }
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSavingSettings(true)

      // Persist admin key locally only
      localStorage.setItem(AUTO_SETTINGS_KEY, JSON.stringify({ ...settings, adminKey: settings.adminKey || '' }))

      // Persist operational settings to DB
      await adminApi.updateBackupSettings({
        enabled: Boolean(settings.enabled),
        intervalMinutes: Math.max(1, Number(settings.minutes || 0)),
        folderPath: String(settings.folderPath || ''),
      })

      showBanner('Settings saved')
    } catch {
      showBanner('Save failed')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xl font-semibold text-slate-800">Backup & Security</div>
        <p className="mt-1 text-sm text-slate-600">Manage your application data. It's recommended to create backups regularly.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button disabled={runningBackup || loadingSettings} onClick={() => doBackup(false)} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Backup Now</button>
          <button disabled={restoring || loadingSettings} onClick={triggerRestore} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Restore from Backup</button>
          <button disabled={purging || loadingSettings} onClick={()=>setPurgeDialogOpen(true)} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">Delete All Data</button>
          <input ref={fileInputRef} onChange={onRestoreFile} type="file" accept="application/json" className="hidden" />
        </div>

        <div className="mt-2 text-xs text-slate-600">
          Last Backup: <span className="font-medium">{lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}</span>
          <span className="mx-2">•</span>
          Next Backup: <span className="font-medium">{nextBackup}</span>
        </div>

        <form onSubmit={saveSettings} className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">Auto Backup</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({ ...s, enabled: e.target.checked }))} />
                Enable Auto Backup
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Interval (minutes)</label>
              <input value={settings.minutes} onChange={e=>setSettings(s=>({ ...s, minutes: Number(e.target.value)||0 }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Backup Folder Path</label>
              <input value={settings.folderPath} onChange={e=>setSettings(s=>({ ...s, folderPath: e.target.value }))} placeholder="e.g. C:\\HospitalBackups" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              <p className="mt-1 text-xs text-slate-500">Used by the server for scheduled disk backups.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Key (for server admin endpoints)</label>
              <input value={settings.adminKey||''} onChange={e=>setSettings(s=>({ ...s, adminKey: e.target.value }))} placeholder="Set to match backend ADMIN_KEY" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              <p className="mt-1 text-xs text-slate-500">Stored locally and sent as header x-admin-key.</p>
            </div>
          </div>

          <div className="mt-4">
            <button disabled={savingSettings || loadingSettings} type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">Save Settings</button>
            {banner && <span className="ml-3 text-sm text-emerald-600">{banner}</span>}
          </div>
        </form>
      </div>

      {purgeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onClick={()=>{ if (purging) return; setPurgeDialogOpen(false) }}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Delete All Data</div>
              <button onClick={()=>{ if (purging) return; setPurgeDialogOpen(false) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Close</button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm text-slate-700">
              <div>This will permanently delete ALL data from the database across all modules.</div>
              <div className="font-medium text-slate-900">Users and Roles will NOT be deleted.</div>
              <div className="text-rose-700">This action cannot be undone.</div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={()=>{ if (purging) return; setPurgeDialogOpen(false) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
              <button
                disabled={purging}
                onClick={async()=>{ if (purging) return; setPurgeDialogOpen(false); await deleteAll() }}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {purging ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
