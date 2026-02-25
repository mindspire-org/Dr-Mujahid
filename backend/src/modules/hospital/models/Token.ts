import { Schema, model, models } from 'mongoose'

const TokenSchema = new Schema({
  dateIso: { type: String, index: true },
  tokenNo: { type: String, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', index: true },
  mrn: { type: String },
  patientName: { type: String },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_Department', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Hospital_Doctor' },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter' },
  corporateId: { type: Schema.Types.ObjectId, ref: 'Corporate_Company' },
  amount: { type: Number },
  fee: { type: Number },
  discount: { type: Number },
  receptionistName: { type: String },
  paymentMethod: { type: String },
  paymentRef: { type: String },
  accountNumberIban: { type: String },
  receivedToAccountCode: { type: String },
  paymentStatus: { type: String, enum: ['paid','unpaid'], default: 'paid', index: true },

  // Dues/Advance breakdown (mirrors DiagnosticOrder fields)
  duesBefore: { type: Number },
  advanceBefore: { type: Number },
  payPreviousDues: { type: Boolean },
  useAdvance: { type: Boolean },
  advanceApplied: { type: Number },
  amountReceived: { type: Number },
  duesPaid: { type: Number },
  paidForToday: { type: Number },
  advanceAdded: { type: Number },
  duesAfter: { type: Number },
  advanceAfter: { type: Number },
  status: { type: String, enum: ['queued','in-progress','completed','returned','cancelled'], default: 'queued', index: true },
  returnReason: { type: String },
  // Scheduling fields (optional)
  scheduleId: { type: Schema.Types.ObjectId, ref: 'Hospital_DoctorSchedule', index: true },
  slotNo: { type: Number },
  slotStart: { type: String }, // HH:mm
  slotEnd: { type: String },   // HH:mm
}, { timestamps: true })

export type HospitalTokenDoc = {
  _id: string
  dateIso: string
  tokenNo: string
  patientId?: string
  mrn?: string
  patientName?: string
  departmentId: string
  doctorId?: string
  encounterId?: string
  corporateId?: string
  amount?: number
  fee?: number
  discount?: number
  receptionistName?: string
  paymentMethod?: string
  paymentRef?: string
  accountNumberIban?: string
  receivedToAccountCode?: string
  paymentStatus?: 'paid'|'unpaid'
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
  status: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
  scheduleId?: string
  slotNo?: number
  slotStart?: string
  slotEnd?: string
}

export const HospitalToken = models.Hospital_Token || model('Hospital_Token', TokenSchema)
