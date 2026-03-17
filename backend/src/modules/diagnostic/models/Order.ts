import { Schema, model, models } from 'mongoose'

const PatientSnapshotSchema = new Schema({
  mrn: { type: String },
  fullName: { type: String, required: true },
  phone: { type: String },
  age: { type: String },
  gender: { type: String },
  address: { type: String },
  guardianRelation: { type: String },
  guardianName: { type: String },
  cnic: { type: String },
}, { _id: false })

const OrderSchema = new Schema({
  patientId: { type: String, required: true },
  patient: { type: PatientSnapshotSchema, required: true },
  corporateId: { type: Schema.Types.ObjectId, ref: 'Corporate_Company' },
  tests: { type: [String], required: true },
  items: [{
    testId: { type: String, required: true },
    status: { type: String, enum: ['received','completed','returned'], default: 'received' },
    sampleTime: { type: String },
    reportingTime: { type: String },
  }],
  returnedTests: { type: [String], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['PKR', '%'], default: 'PKR' },
  net: { type: Number, default: 0 },
  duesBefore: { type: Number, default: 0 },
  advanceBefore: { type: Number, default: 0 },
  payPreviousDues: { type: Boolean, default: false },
  useAdvance: { type: Boolean, default: false },
  advanceApplied: { type: Number, default: 0 },
  amountReceived: { type: Number, default: 0 },
  duesPaid: { type: Number, default: 0 },
  paidForToday: { type: Number, default: 0 },
  advanceAdded: { type: Number, default: 0 },
  duesAfter: { type: Number, default: 0 },
  advanceAfter: { type: Number, default: 0 },
  receptionistName: { type: String },
  paymentMethod: { type: String },
  accountNumberIban: { type: String },
  receivedToAccountCode: { type: String },
  paymentStatus: { type: String, enum: ['paid','unpaid'], default: 'paid', index: true },
  tokenNo: { type: String },
  status: { type: String, enum: ['received','completed','returned'], default: 'received' },
  sampleTime: { type: String },
  reportingTime: { type: String },
  referringConsultant: { type: String },
}, { timestamps: true })

export type DiagnosticOrderDoc = {
  _id: string
  patientId: string
  patient: {
    mrn?: string
    fullName: string
    phone?: string
    age?: string
    gender?: string
    address?: string
    guardianRelation?: string
    guardianName?: string
    cnic?: string
  }
  corporateId?: string
  tests: string[]
  items?: Array<{ testId: string; status: 'received'|'completed'|'returned'; sampleTime?: string; reportingTime?: string }>
  returnedTests?: string[]
  subtotal: number
  discount: number
  discountType?: 'PKR' | '%'
  net: number
  duesBefore?: number
  advanceBefore?: number
  payPreviousDues?: boolean
  useAdvance?: boolean
  advanceApplied?: number
  amountReceived?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
  receptionistName?: string
  paymentMethod?: string
  accountNumberIban?: string
  receivedToAccountCode?: string
  paymentStatus?: 'paid'|'unpaid'
  tokenNo?: string
  status: 'received'|'completed'|'returned'
  sampleTime?: string
  reportingTime?: string
  referringConsultant?: string
}

export const DiagnosticOrder = models.Diagnostic_Order || model('Diagnostic_Order', OrderSchema)
