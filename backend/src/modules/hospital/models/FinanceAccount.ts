import { Schema, model, models } from 'mongoose'

const AccountSchema = new Schema({
  code: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Asset','Liability','Equity','Income','Expense'], required: true },
  category: { type: String, enum: ['PettyCash','Other'], default: 'Other', index: true },
  active: { type: Boolean, default: true },
  department: { type: String },
  responsibleStaff: { type: String },
}, { timestamps: true })

export type AccountDoc = {
  _id: string
  code: string
  name: string
  type: 'Asset'|'Liability'|'Equity'|'Income'|'Expense'
  category?: 'PettyCash'|'Other'
  active: boolean
  department?: string
  responsibleStaff?: string
}

export const FinanceAccount = models.Hospital_Finance_Account || model('Hospital_Finance_Account', AccountSchema)
