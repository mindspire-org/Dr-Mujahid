import { Schema, model, models } from 'mongoose'

const SettingsSchema = new Schema({
  pharmacyName: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  email: { type: String, default: '' },
  billingFooter: { type: String, default: '' },
  logoDataUrl: { type: String, default: '' },
  // System settings (shared/common preferences)
  taxRate: { type: Number, default: 0 },
  discountRate: { type: Number, default: 0 },
  currency: { type: String, default: 'PKR' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
}, { timestamps: true })

export type SettingsDoc = {
  _id: string
  pharmacyName: string
  phone: string
  address: string
  email: string
  billingFooter: string
  logoDataUrl?: string
  taxRate?: number
  discountRate?: number
  currency?: string
  dateFormat?: string
}

export const Settings = models.Pharmacy_Settings || model('Pharmacy_Settings', SettingsSchema)
