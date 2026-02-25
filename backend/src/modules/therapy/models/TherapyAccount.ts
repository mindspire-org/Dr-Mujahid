import { Schema, model, models } from 'mongoose'

const TherapyAccountSchema = new Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    mrn: { type: String },
    fullName: { type: String },
    phone: { type: String },
    dues: { type: Number, default: 0, min: 0 },
    advance: { type: Number, default: 0, min: 0 },
    updatedAtIso: { type: String },
  },
  { timestamps: true, collection: 'therapy_account' }
)

export type TherapyAccountDoc = {
  _id: string
  patientId: string
  mrn?: string
  fullName?: string
  phone?: string
  dues: number
  advance: number
  updatedAtIso?: string
}

export const TherapyAccount = models.Therapy_Account || model('Therapy_Account', TherapyAccountSchema)
