import { Schema, model, models } from 'mongoose'

const PatientSnapshotSchema = new Schema(
  {
    mrn: { type: String },
    fullName: { type: String, required: true },
    phone: { type: String },
    age: { type: String },
    gender: { type: String },
    address: { type: String },
    guardianRelation: { type: String },
    guardianName: { type: String },
    cnic: { type: String },
  },
  { _id: false }
)

const VisitTestSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false }
)

const TherapyVisitSchema = new Schema(
  {
    tokenNo: { type: String, index: true },
    patientId: { type: String, required: true, index: true },
    patient: { type: PatientSnapshotSchema, required: true },

    packageId: { type: String },
    packageName: { type: String },

    tests: { type: [VisitTestSchema], required: true },

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

    paymentStatus: { type: String, enum: ['paid', 'unpaid'], default: 'paid' },
    paymentMethod: { type: String, enum: ['Cash', 'Card'] },
    receivedToAccountCode: { type: String },

    referringConsultant: { type: String },
    fromReferralId: { type: String },

    status: { type: String, enum: ['active', 'cancelled', 'returned'], default: 'active' },
    sessionStatus: { type: String, enum: ['Queued', 'Completed'], default: 'Queued' },
    returnReason: { type: String },

    createdAtIso: { type: String },
    updatedAtIso: { type: String },
  },
  { timestamps: true, collection: 'therapy_visit' }
)

export type TherapyVisitDoc = {
  _id: string
  tokenNo?: string
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
  packageId?: string
  packageName?: string
  tests: Array<{ id: string; name: string; details?: any }>
  subtotal: number
  discount: number
  discountType: 'PKR' | '%'
  net: number
  duesBefore: number
  advanceBefore: number
  payPreviousDues: boolean
  useAdvance: boolean
  advanceApplied: number
  amountReceived: number
  duesPaid: number
  paidForToday: number
  advanceAdded: number
  duesAfter: number
  advanceAfter: number
  paymentStatus?: 'paid' | 'unpaid'
  paymentMethod?: 'Cash' | 'Card'
  receivedToAccountCode?: string
  referringConsultant?: string
  fromReferralId?: string
  status?: 'active' | 'cancelled' | 'returned'
  sessionStatus?: 'Queued' | 'Completed'
  returnReason?: string
  createdAtIso?: string
  updatedAtIso?: string
}

export const TherapyVisit = models.TherapyVisit || model('TherapyVisit', TherapyVisitSchema)
