import { Request, Response } from 'express'
import { HospitalStaff } from '../models/Staff'
import { upsertStaffSchema } from '../validators/staff'

export async function list(_req: Request, res: Response){
  const req = _req as any
  const q = String(req.query.q || '').trim()
  const shiftId = String(req.query.shiftId || '').trim()
  const page = Math.max(1, Number(req.query.page || 1))
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)))
  const skip = (page - 1) * limit

  const filter: any = {}
  if (shiftId) filter.shiftId = shiftId
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { role: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ]
  }

  const [items, total] = await Promise.all([
    HospitalStaff.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    HospitalStaff.countDocuments(filter),
  ])
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 1)))
  res.json({ items, staff: items, total, page, totalPages })
}

export async function create(req: Request, res: Response){
  const data = upsertStaffSchema.parse(req.body)
  const row = await HospitalStaff.create(data)
  res.status(201).json({ staff: row })
}

export async function update(req: Request, res: Response){
  const data = upsertStaffSchema.parse(req.body)
  const row = await HospitalStaff.findByIdAndUpdate(req.params.id, data, { new: true })
  if (!row) return res.status(404).json({ error: 'Staff not found' })
  res.json({ staff: row })
}

export async function remove(req: Request, res: Response){
  const row = await HospitalStaff.findByIdAndDelete(req.params.id)
  if (!row) return res.status(404).json({ error: 'Staff not found' })
  res.json({ ok: true })
}
