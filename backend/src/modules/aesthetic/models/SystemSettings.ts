import { Schema, model, models } from 'mongoose'

const SystemSettingsSchema = new Schema({
  taxRate: { type: Number, default: 0 },
  discountRate: { type: Number, default: 0 },
  currency: { type: String, default: 'PKR' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
}, { timestamps: true, collection: 'aesthetic_system_settings' })

export type AestheticSystemSettingsDoc = {
  _id: string
  taxRate?: number
  discountRate?: number
  currency?: string
  dateFormat?: 'DD/MM/YYYY'|'MM/DD/YYYY'|'YYYY-MM-DD'|string
}

export const AestheticSystemSettings = models.Aesthetic_SystemSettings || model('Aesthetic_SystemSettings', SystemSettingsSchema)
