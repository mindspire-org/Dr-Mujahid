import { Schema, model, models } from 'mongoose'

const HospitalAccountSchema = new Schema({
  patientId: { type: String, required: true, index: true, unique: true },
  mrn: { type: String },
  fullName: { type: String },
  phone: { type: String },
  dues: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  updatedAtIso: { type: String },
}, { timestamps: true })

export type HospitalAccountDoc = {
  _id: string
  patientId: string
  mrn?: string
  fullName?: string
  phone?: string
  dues: number
  advance: number
  updatedAtIso?: string
}

export const HospitalAccount = models.Hospital_Account || model('Hospital_Account', HospitalAccountSchema)
