import { Schema, model, models } from 'mongoose'

const PharmacyAccountSchema = new Schema({
  customerId: { type: String, index: true },
  mrn: { type: String },
  fullName: { type: String },
  phone: { type: String },
  dues: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  updatedAtIso: { type: String },
}, { timestamps: true, collection: 'pharmacy_accounts' })

export type PharmacyAccountDoc = {
  _id: string
  customerId?: string
  mrn?: string
  fullName?: string
  phone?: string
  dues: number
  advance: number
  updatedAtIso?: string
}

export const PharmacyAccount = models.Pharmacy_Account || model('Pharmacy_Account', PharmacyAccountSchema)
