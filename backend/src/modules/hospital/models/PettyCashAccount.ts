import { Schema, model, models } from 'mongoose'

const PettyCashAccountSchema = new Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  department: { type: String },
  responsibleStaff: { type: String },
  status: { type: String, enum: ['Active','Inactive'], default: 'Active', index: true },
  financeAccountCode: { type: String, required: true, index: true },
}, { timestamps: true })

export type PettyCashAccountDoc = {
  _id: string
  code: string
  name: string
  department?: string
  responsibleStaff?: string
  status: 'Active'|'Inactive'
  financeAccountCode: string
}

export const PettyCashAccount = models.Hospital_Petty_Cash_Account || model('Hospital_Petty_Cash_Account', PettyCashAccountSchema)
