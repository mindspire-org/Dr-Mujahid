import { Request, Response } from 'express'
import { z } from 'zod'
import { PettyCashAccount } from '../models/PettyCashAccount'
import { HospitalUser } from '../models/User'

const createSchema = z.object({
  code: z.string().min(1).transform(s=> s.trim().toUpperCase()),
  name: z.string().min(1),
  department: z.string().optional(),
  responsibleStaff: z.string().optional(),
  status: z.enum(['Active','Inactive']).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().optional(),
  responsibleStaff: z.string().optional(),
  status: z.enum(['Active','Inactive']).optional(),
})

export async function list(req: Request, res: Response){
  const q = String((req.query as any)?.q || '').trim().toLowerCase()
  const status = String((req.query as any)?.status || '').trim()
  const filter: any = {}
  if (status === 'Active' || status === 'Inactive') filter.status = status
  const rows: any[] = await PettyCashAccount.find(filter).sort({ code: 1 }).lean()
  const items = rows
    .filter(r => !q || `${r.code||''} ${r.name||''}`.toLowerCase().includes(q))
    .map(r => ({ id: String(r._id), code: r.code, name: r.name, department: r.department, responsibleStaff: r.responsibleStaff, status: r.status || 'Active' }))
  res.json({ accounts: items })
}

export async function create(req: Request, res: Response){
  const data = createSchema.parse(req.body)
  const exists = await PettyCashAccount.findOne({ code: data.code }).lean()
  if (exists) return res.status(409).json({ error: 'Duplicate petty cash code' })
  const doc: any = await PettyCashAccount.create({
    code: data.code,
    name: data.name.trim(),
    department: data.department?.trim(),
    responsibleStaff: data.responsibleStaff?.trim(),
    status: data.status || 'Active',
    financeAccountCode: data.code,
  })

  const rs = String(data.responsibleStaff || '').trim()
  if (rs) {
    try {
      const username = rs.toLowerCase()
      await HospitalUser.updateOne({ username }, { $set: { pettyCashAccountCode: doc.code } }).exec()
    } catch {}
  }
  res.status(201).json({ account: { id: String(doc._id), code: doc.code, name: doc.name, department: doc.department, responsibleStaff: doc.responsibleStaff, status: doc.status || 'Active' } })
}

export async function update(req: Request, res: Response){
  const id = String(req.params.id)
  const data = updateSchema.parse(req.body)
  const patch: any = {}
  if (data.name != null) patch.name = data.name.trim()
  if (data.department != null) patch.department = data.department?.trim()
  if (data.responsibleStaff != null) patch.responsibleStaff = data.responsibleStaff?.trim()
  if (data.status != null) patch.status = data.status
  const doc: any = await PettyCashAccount.findByIdAndUpdate(id, patch, { new: true }).lean()
  if (!doc) return res.status(404).json({ error: 'Petty cash account not found' })

  if (data.responsibleStaff != null) {
    const rs = String(data.responsibleStaff || '').trim()
    if (rs) {
      try {
        const username = rs.toLowerCase()
        await HospitalUser.updateOne({ username }, { $set: { pettyCashAccountCode: doc.code } }).exec()
      } catch {}
    }
  }
  res.json({ account: { id: String(doc._id), code: doc.code, name: doc.name, department: doc.department, responsibleStaff: doc.responsibleStaff, status: doc.status || 'Active' } })
}

export async function remove(req: Request, res: Response){
  const id = String(req.params.id)
  const doc: any = await PettyCashAccount.findByIdAndDelete(id).lean()
  if (!doc) return res.status(404).json({ error: 'Petty cash account not found' })
  res.json({ ok: true })
}
