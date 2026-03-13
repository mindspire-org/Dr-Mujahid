import { Schema, model, models } from 'mongoose'

const ExpenseSchema = new Schema({
  dateIso: { type: String, required: true, index: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_Department' },
  category: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String },
  method: { type: String },
  ref: { type: String },
  supplierName: { type: String },
  invoiceNo: { type: String },
  kind: { type: String, index: true },
  staffId: { type: String, index: true },
  salaryMonth: { type: String, index: true }, // yyyy-mm
  paymentMode: { type: String },
  createdBy: { type: String },
  fromAccountCode: { type: String },
  journalId: { type: String },
  paidAt: { type: Date },
  receiverLabel: { type: String },
  status: { type: String, default: 'draft', index: true },
  submittedAt: { type: Date },
  submittedBy: { type: String },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  rejectedAt: { type: Date },
  rejectedBy: { type: String },
  rejectionReason: { type: String },
}, { timestamps: true })

export type HospitalExpenseDoc = {
  _id: string
  dateIso: string
  departmentId?: string
  category: string
  amount: number
  note?: string
  method?: string
  ref?: string
  supplierName?: string
  invoiceNo?: string
  kind?: string
  staffId?: string
  salaryMonth?: string
  paymentMode?: string
  createdBy?: string
  fromAccountCode?: string
  journalId?: string
  paidAt?: any
  receiverLabel?: string
  status?: 'draft'|'submitted'|'approved'|'rejected'
  submittedAt?: any
  submittedBy?: string
  approvedAt?: any
  approvedBy?: string
  rejectedAt?: any
  rejectedBy?: string
  rejectionReason?: string
}

export const HospitalExpense = models.Hospital_Expense || model('Hospital_Expense', ExpenseSchema)
