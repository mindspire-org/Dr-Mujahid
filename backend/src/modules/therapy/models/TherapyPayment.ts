import { Schema, model, models } from 'mongoose'

const TherapyPaymentSchema = new Schema(
  {
    patientId: { type: String, required: true, index: true },
    visitId: { type: String, index: true },
    applyMode: { type: String, enum: ['duesFirst', 'advanceOnly', 'duesOnly'], default: 'duesFirst' },
    amount: { type: Number, required: true, min: 0 },
    duesPaid: { type: Number, default: 0 },
    paidForToday: { type: Number, default: 0 },
    advanceAdded: { type: Number, default: 0 },
    note: { type: String },
    createdAtIso: { type: String },
  },
  { timestamps: true, collection: 'therapy_payment' }
)

export type TherapyPaymentDoc = {
  _id: string
  patientId: string
  visitId?: string
  applyMode?: 'duesFirst' | 'advanceOnly' | 'duesOnly'
  amount: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  note?: string
  createdAtIso?: string
}

export const TherapyPayment = models.Therapy_Payment || model('Therapy_Payment', TherapyPaymentSchema)
