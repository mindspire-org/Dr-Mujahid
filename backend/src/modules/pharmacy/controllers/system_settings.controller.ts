import { Request, Response } from 'express'
import { Settings } from '../models/Settings'
import { systemSettingsUpdateSchema } from '../validators/system_settings'

export async function get(_req: Request, res: Response) {
  let s: any = await Settings.findOne().lean()
  if (!s) s = (await Settings.create({})).toObject()
  res.json({
    taxRate: s.taxRate ?? 0,
    discountRate: s.discountRate ?? 0,
    currency: s.currency ?? 'PKR',
    dateFormat: s.dateFormat ?? 'DD/MM/YYYY',
  })
}

export async function update(req: Request, res: Response) {
  const data = systemSettingsUpdateSchema.parse(req.body)
  const s: any = await Settings.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean()
  res.json({
    taxRate: s?.taxRate ?? 0,
    discountRate: s?.discountRate ?? 0,
    currency: s?.currency ?? 'PKR',
    dateFormat: s?.dateFormat ?? 'DD/MM/YYYY',
  })
}
