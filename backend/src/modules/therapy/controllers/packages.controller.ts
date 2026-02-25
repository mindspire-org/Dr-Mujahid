import { Request, Response } from 'express'
import { TherapyPackage } from '../models/TherapyPackage'
import { therapyPackageCreateSchema, therapyPackageQuerySchema, therapyPackageUpdateSchema } from '../validators/package'

export async function list(req: Request, res: Response) {
  const parsed = therapyPackageQuerySchema.safeParse(req.query)
  const { status, package: pkg, page, limit } = parsed.success ? (parsed.data as any) : {}

  const filter: any = {}
  if (status) filter.status = status
  if (pkg != null && !Number.isNaN(Number(pkg))) filter.package = Number(pkg)

  const lim = Math.min(1000, Number(limit || 50))
  const pg = Math.max(1, Number(page || 1))
  const skip = (pg - 1) * lim

  const [items, total] = await Promise.all([
    TherapyPackage.find(filter).sort({ package: 1 }).skip(skip).limit(lim).lean(),
    TherapyPackage.countDocuments(filter),
  ])

  const totalPages = Math.max(1, Math.ceil((total || 0) / lim))
  res.json({ items, total, page: pg, totalPages })
}

export async function create(req: Request, res: Response) {
  try {
    const body: any = req.body || {}
    if ((body?.packageName == null || String(body.packageName).trim() === '') && body?.package != null) {
      body.packageName = `Package ${body.package}`
    }
    const data = therapyPackageCreateSchema.parse(body)
    const doc = await TherapyPackage.create(data)
    res.status(201).json(doc)
  } catch (e: any) {
    if (Array.isArray(e?.issues)) return res.status(400).json({ message: 'Validation error', issues: e.issues })
    if (e?.code === 11000) return res.status(409).json({ message: 'Package already exists' })
    throw e
  }
}

export async function getById(req: Request, res: Response) {
  const { id } = req.params
  const doc = await TherapyPackage.findById(id).lean()
  if (!doc) return res.status(404).json({ message: 'Package not found' })
  res.json(doc)
}

export async function update(req: Request, res: Response) {
  const { id } = req.params
  try {
    const patch = therapyPackageUpdateSchema.parse(req.body)
    const doc = await TherapyPackage.findByIdAndUpdate(id, patch, { new: true })
    if (!doc) return res.status(404).json({ message: 'Package not found' })
    res.json(doc)
  } catch (e: any) {
    if (Array.isArray(e?.issues)) return res.status(400).json({ message: 'Validation error', issues: e.issues })
    if (e?.code === 11000) return res.status(409).json({ message: 'Package already exists' })
    throw e
  }
}

export async function remove(req: Request, res: Response) {
  const { id } = req.params
  await TherapyPackage.findByIdAndDelete(id)
  res.json({ ok: true })
}
