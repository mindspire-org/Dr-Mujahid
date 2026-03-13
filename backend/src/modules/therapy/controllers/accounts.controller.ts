import { Request, Response } from 'express'
import { TherapyAccount } from '../models/TherapyAccount'
import { therapyAccountQuerySchema } from '../validators/account'

export async function getByPatientId(req: Request, res: Response) {
  const patientId = String((req.params as any).patientId || '').trim()
  if (!patientId) return res.status(400).json({ message: 'Validation failed', issues: [{ path: ['patientId'], message: 'patientId is required' }] })
  const doc = await TherapyAccount.findOne({ patientId }).lean()
  res.json({ account: doc || { patientId, dues: 0, advance: 0 } })
}

export async function list(req: Request, res: Response) {
  const parsed = therapyAccountQuerySchema.safeParse(req.query)
  const q = parsed.success ? String((parsed.data as any).q || '').trim() : ''
  const hasDues = parsed.success ? (parsed.data as any).hasDues : undefined
  const hasAdvance = parsed.success ? (parsed.data as any).hasAdvance : undefined
  const page = parsed.success ? Number((parsed.data as any).page || 1) : 1
  const limit = parsed.success ? Number((parsed.data as any).limit || 50) : 50

  const filter: any = {}
  if (q) {
    const rx = new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
    filter.$or = [{ fullName: rx }, { mrn: rx }, { phone: rx }]
  }
  if (hasDues === true) filter.dues = { $gt: 0 }
  if (hasAdvance === true) filter.advance = { $gt: 0 }

  const lim = Math.min(1000, Math.max(1, limit))
  const pg = Math.max(1, page)
  const skip = (pg - 1) * lim

  const [items, total] = await Promise.all([
    TherapyAccount.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(lim).lean(),
    TherapyAccount.countDocuments(filter),
  ])
  const totalPages = Math.max(1, Math.ceil((total || 0) / lim))
  res.json({ items, total, page: pg, totalPages })
}
