import { Schema, model, models } from 'mongoose'

const SystemSettingsSchema = new Schema({
  taxRate: { type: Number, default: 0 },
  discountRate: { type: Number, default: 0 },
  currency: { type: String, default: 'PKR' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
}, { timestamps: true })

export type SystemSettingsDoc = {
  _id: string
  taxRate?: number
  discountRate?: number
  currency?: string
  dateFormat?: 'DD/MM/YYYY'|'MM/DD/YYYY'|'YYYY-MM-DD'|string
}

export const SystemSettings = models.Pharmacy_SystemSettings || model('Pharmacy_SystemSettings', SystemSettingsSchema)
