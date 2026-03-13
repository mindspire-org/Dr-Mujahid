import { Schema, model, models } from 'mongoose'

const DiagnosticAccountSchema = new Schema({
  patientId: { type: String, required: true, index: true, unique: true },
  mrn: { type: String },
  fullName: { type: String },
  phone: { type: String },
  dues: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  updatedAtIso: { type: String },
}, { timestamps: true })

export type DiagnosticAccountDoc = {
  _id: string
  patientId: string
  mrn?: string
  fullName?: string
  phone?: string
  dues: number
  advance: number
  updatedAtIso?: string
}

export const DiagnosticAccount = models.Diagnostic_Account || model('Diagnostic_Account', DiagnosticAccountSchema)
