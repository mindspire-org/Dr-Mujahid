import { Request, Response } from 'express'
import { TherapyMachine } from '../models/TherapyMachine'
import { therapyMachineCreateSchema, therapyMachineQuerySchema, therapyMachineUpdateSchema } from '../validators/machine'

export async function list(req: Request, res: Response) {
  const parsed = therapyMachineQuerySchema.safeParse(req.query)
  const { q, status, package: pkg, page, limit } = parsed.success ? (parsed.data as any) : {}

  const filter: any = {}
  if (q) {
    const rx = new RegExp(String(q), 'i')
    filter.$or = [{ name: rx }]
  }
  if (status) filter.status = status
  if (pkg != null && !Number.isNaN(Number(pkg))) filter.package = Number(pkg)

  const lim = Math.min(1000, Number(limit || 50))
  const pg = Math.max(1, Number(page || 1))
  const skip = (pg - 1) * lim

  const [items, total] = await Promise.all([
    TherapyMachine.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    TherapyMachine.countDocuments(filter),
  ])
  const totalPages = Math.max(1, Math.ceil((total || 0) / lim))

  res.json({ items, total, page: pg, totalPages })
}

export async function create(req: Request, res: Response) {
  const data = therapyMachineCreateSchema.parse(req.body)
  const doc = await TherapyMachine.create(data)
  res.status(201).json(doc)
}

export async function getById(req: Request, res: Response) {
  const { id } = req.params
  const doc = await TherapyMachine.findById(id).lean()
  if (!doc) return res.status(404).json({ message: 'Machine not found' })
  res.json(doc)
}

export async function update(req: Request, res: Response) {
  const { id } = req.params
  const patch = therapyMachineUpdateSchema.parse(req.body)
  const doc = await TherapyMachine.findByIdAndUpdate(id, patch, { new: true })
  if (!doc) return res.status(404).json({ message: 'Machine not found' })
  res.json(doc)
}

export async function remove(req: Request, res: Response) {
  const { id } = req.params
  await TherapyMachine.findByIdAndDelete(id)
  res.json({ ok: true })
}
