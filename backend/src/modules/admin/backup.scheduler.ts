import { BackupSettings } from './models/BackupSettings'
import { env } from '../../config/env'
import { runBackupToDisk } from './backup.controller'

let timer: NodeJS.Timeout | null = null

const SETTINGS_KEY = 'default'

export function startBackupScheduler() {
  if (timer) return

  // Periodic scheduler. We don't use external cron deps in this project.
  timer = setInterval(() => {
    void tick()
  }, 30 * 1000)

  void tick()
}

export function stopBackupScheduler() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

async function tick() {
  try {
    const s = await BackupSettings.findOne({ key: SETTINGS_KEY }).lean()
    if (!s?.enabled) return

    const intervalMinutes = Math.max(1, Number(s.intervalMinutes || 60))

    const last = s.lastBackupAt ? new Date(s.lastBackupAt) : null
    const lastTime = last && !Number.isNaN(last.getTime()) ? last.getTime() : 0

    const due = Date.now() - lastTime >= intervalMinutes * 60 * 1000
    if (!due) return

    const outDir = String(s.folderPath || '').trim() || env.BACKUP_DIR
    const result = await runBackupToDisk(outDir)

    await BackupSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { lastBackupAt: new Date(result.ts), lastBackupFile: result.file } },
      { upsert: true },
    )
  } catch {
    // Intentionally swallow to keep server stable.
  }
}
