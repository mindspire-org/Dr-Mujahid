import { Schema, model, models } from 'mongoose'

const BankAccountSchema = new Schema({
  bankName: { type: String, required: true },
  accountTitle: { type: String, required: true },
  accountNumber: { type: String, required: true },
  branchName: { type: String },
  branchCode: { type: String },
  swift: { type: String },
  responsibleStaff: { type: String },
  status: { type: String, enum: ['Active','Inactive'], default: 'Active', index: true },
  financeAccountCode: { type: String },
}, { timestamps: true })

export type BankAccountDoc = {
  _id: string
  bankName: string
  accountTitle: string
  accountNumber: string
  branchName?: string
  branchCode?: string
  swift?: string
  responsibleStaff?: string
  status: 'Active'|'Inactive'
  financeAccountCode?: string
}

export const BankAccount = models.Hospital_Bank_Account || model('Hospital_Bank_Account', BankAccountSchema)
