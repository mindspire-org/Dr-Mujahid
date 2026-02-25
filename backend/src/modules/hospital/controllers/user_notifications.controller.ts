import { Request, Response } from 'express'
import { HospitalUserNotification } from '../models/UserNotification'

function handleError(res: Response, e: any) {
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

export async function list(req: Request, res: Response) {
  try {
    const userId = String((req as any)?.user?.sub || '')
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const rows = await HospitalUserNotification.find({ userId }).sort({ createdAt: -1 }).limit(200)
    res.json({ notifications: rows })
  } catch (e) { return handleError(res, e) }
}

export async function update(req: Request, res: Response) {
  try {
    const userId = String((req as any)?.user?.sub || '')
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.params as any
    const { read } = req.body as any

    const row: any = await HospitalUserNotification.findOneAndUpdate(
      { _id: String(id), userId },
      { $set: { read: !!read } },
      { new: true },
    )
    if (!row) return res.status(404).json({ error: 'Notification not found' })
    res.json({ notification: row })
  } catch (e) { return handleError(res, e) }
}

export async function markAllRead(req: Request, res: Response) {
  try {
    const userId = String((req as any)?.user?.sub || '')
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    await HospitalUserNotification.updateMany({ userId, read: false }, { $set: { read: true } })
    res.json({ ok: true })
  } catch (e) { return handleError(res, e) }
}
