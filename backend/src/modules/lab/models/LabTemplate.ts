import { Schema, model, models } from 'mongoose'

const LabTemplateSchema = new Schema({
  doctorId: { type: Schema.Types.ObjectId, ref: 'Hospital_User', required: true },
  name: { type: String, required: true },
  tests: { type: [String], default: [] },
}, { timestamps: true })

// Compound index to ensure unique template names per doctor
LabTemplateSchema.index({ doctorId: 1, name: 1 }, { unique: true })

export type LabTemplateDoc = {
  _id: string
  doctorId: string
  name: string
  tests: string[]
  createdAt?: Date
  updatedAt?: Date
}

export const LabTemplate = models.Lab_Template || model('Lab_Template', LabTemplateSchema)
