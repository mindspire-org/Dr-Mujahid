import { Request, Response } from 'express'
import path from 'path'
import { BackupSettings } from './models/BackupSettings'
import { env } from '../../config/env'
import { runBackupToDisk } from './backup.controller'

const SETTINGS_KEY = 'default'

function normalizeFolderPath(p: any) {
  const raw = String(p || '').trim()
  if (!raw) return ''
  return path.resolve(raw)
}

export async function getBackupSettings(_req: Request, res: Response) {
  const s = await BackupSettings.findOne({ key: SETTINGS_KEY }).lean()
  const out = s || {
    key: SETTINGS_KEY,
    enabled: false,
    intervalMinutes: 60,
    folderPath: '',
    lastBackupAt: undefined,
    lastBackupFile: undefined,
  }
  res.json(out)
}

export async function updateBackupSettings(req: Request, res: Response) {
  const body = (req.body || {}) as any

  const enabled = Boolean(body.enabled)
  const intervalMinutesRaw = Number(body.intervalMinutes)
  const intervalMinutes = Number.isFinite(intervalMinutesRaw) ? Math.max(1, Math.floor(intervalMinutesRaw)) : 60
  const folderPath = normalizeFolderPath(body.folderPath)

  const updated = await BackupSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { enabled, intervalMinutes, folderPath } },
    { upsert: true, new: true },
  ).lean()

  res.json(updated)
}

export async function runBackupNowToDisk(_req: Request, res: Response) {
  const s = await BackupSettings.findOne({ key: SETTINGS_KEY }).lean()
  const outDir = s?.folderPath || env.BACKUP_DIR

  const result = await runBackupToDisk(outDir)

  await BackupSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { lastBackupAt: new Date(result.ts), lastBackupFile: result.file } },
    { upsert: true },
  )

  res.json({ ok: true, ...result })
}
