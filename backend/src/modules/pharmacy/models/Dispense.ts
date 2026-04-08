import { Schema, model, models } from 'mongoose'

const LineSchema = new Schema({
  medicineId: { type: String, required: true },
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  qty: { type: Number, required: true },
  costPerUnit: { type: Number, default: 0 },
  discountRs: { type: Number, default: 0 },
})

const DispenseSchema = new Schema({
  datetime: { type: String, required: true }, // ISO
  billNo: { type: String, required: true, index: true },
  customerId: { type: String },
  customer: { type: String, default: 'Walk-in' },
  mrn: { type: String },
  phone: { type: String },
  age: { type: String },
  gender: { type: String },
  guardianRel: { type: String },
  guardianName: { type: String },
  cnic: { type: String },
  address: { type: String },
  paymentStatus: { type: String, enum: ['paid', 'unpaid'], default: 'paid' },
  accountCode: { type: String },
  paymentMethodDetail: { type: String },
  amountReceivedNow: { type: Number, default: 0 },
  duesBefore: { type: Number, default: 0 },
  advanceBefore: { type: Number, default: 0 },
  advanceApplied: { type: Number, default: 0 },
  duesPaid: { type: Number, default: 0 },
  paidForToday: { type: Number, default: 0 },
  advanceAdded: { type: Number, default: 0 },
  duesAfter: { type: Number, default: 0 },
  advanceAfter: { type: Number, default: 0 },
  payment: { type: String, enum: ['Cash','Card','Credit'], default: 'Cash' },
  discountPct: { type: Number, default: 0 },
  lineDiscountTotal: { type: Number, default: 0 },
  taxPct: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
  total: { type: Number, required: true },
  lines: { type: [LineSchema], default: [] },
  profit: { type: Number, default: 0 },
  createdBy: { type: String },
}, { timestamps: true, collection: 'pharmacy_dispenses' })

export type DispenseDoc = {
  _id: string
  datetime: string
  billNo: string
  customerId?: string
  customer?: string
  mrn?: string
  phone?: string
  age?: string
  gender?: string
  guardianRel?: string
  guardianName?: string
  cnic?: string
  address?: string
  paymentStatus?: 'paid' | 'unpaid'
  accountCode?: string
  paymentMethodDetail?: string
  amountReceivedNow?: number
  duesBefore?: number
  advanceBefore?: number
  advanceApplied?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
  payment: 'Cash'|'Card'|'Credit'
  discountPct?: number
  lineDiscountTotal?: number
  taxPct?: number
  taxAmount?: number
  subtotal: number
  total: number
  profit?: number
  createdBy?: string
  lines: { medicineId: string; name: string; unitPrice: number; qty: number; costPerUnit?: number; discountRs?: number }[]
}

export const Dispense = models.Pharmacy_Dispense || model('Pharmacy_Dispense', DispenseSchema)


