import { Request, Response } from 'express'
import { z } from 'zod'
import { HospitalPettyExpense } from '../models/HospitalPettyExpense'

const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export async function list(req: Request, res: Response){
  const { from, to } = listSchema.parse(req.query)
  const filter: any = {}
  if (from || to){
    filter.dateIso = {}
    if (from) filter.dateIso.$gte = from
    if (to) filter.dateIso.$lte = to
  }
  const rows: any[] = await HospitalPettyExpense.find(filter).sort({ dateIso: -1, _id: -1 }).lean()
  res.json({ items: rows.map(r => ({ id: String(r._id), dateIso: r.dateIso, type: r.type, amount: Number(r.amount||0), usedBy: r.usedBy })) })
}

const createSchema = z.object({
  dateIso: z.string().min(1),
  type: z.string().min(1),
  amount: z.number().positive(),
  usedBy: z.string().optional(),
})

export async function create(req: Request, res: Response){
  const data = createSchema.parse({
    ...req.body,
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
  })
  const doc: any = await HospitalPettyExpense.create({
    dateIso: String(data.dateIso).slice(0,10),
    type: data.type.trim(),
    amount: Number(data.amount||0),
    usedBy: data.usedBy?.trim(),
  })
  res.status(201).json({ item: { id: String(doc._id), dateIso: doc.dateIso, type: doc.type, amount: Number(doc.amount||0), usedBy: doc.usedBy } })
}

export async function remove(req: Request, res: Response){
  const id = String(req.params.id)
  const doc: any = await HospitalPettyExpense.findByIdAndDelete(id).lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
}
