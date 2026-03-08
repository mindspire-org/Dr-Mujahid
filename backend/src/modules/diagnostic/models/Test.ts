import { Schema, model, models } from 'mongoose'

const DiagnosticTestSchema = new Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, default: 0 },
  department: { type: String },
  purchasePrice: { type: Number, default: 0 },
  qtyPerPack: { type: Number, default: 1 },
}, { timestamps: true })

export type DiagnosticTestDoc = {
  _id: string
  name: string
  price: number
  department?: string
  purchasePrice?: number
  qtyPerPack?: number
}

export const DiagnosticTest = models.Diagnostic_Test || model('Diagnostic_Test', DiagnosticTestSchema)
