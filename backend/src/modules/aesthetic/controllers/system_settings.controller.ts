import { Request, Response } from 'express'
import { AestheticSystemSettings } from '../models/SystemSettings'
import { systemSettingsUpdateSchema } from '../validators/system_settings'

export async function get(_req: Request, res: Response) {
  let s = await AestheticSystemSettings.findOne().lean()
  if (!s) s = (await AestheticSystemSettings.create({})).toObject()
  res.json(s)
}

export async function update(req: Request, res: Response) {
  const data = systemSettingsUpdateSchema.parse(req.body)
  const s = await AestheticSystemSettings.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true })
  res.json(s)
}
