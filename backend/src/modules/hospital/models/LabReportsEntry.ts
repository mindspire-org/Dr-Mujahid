import { Schema, model, models } from 'mongoose'

const LabReportsEntrySchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', required: true, index: true },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter', required: true, index: true, unique: true },
  tokenId: { type: Schema.Types.ObjectId, ref: 'Hospital_Token', index: true },
  hxBy: { type: String },
  hxDate: { type: String },
  labInformation: { type: Schema.Types.Mixed, default: {} },
  semenAnalysis: { type: Schema.Types.Mixed, default: {} },
  tests: { type: [Schema.Types.Mixed], default: [] },
  submittedAt: { type: Date, default: Date.now, index: true },
  submittedBy: { type: String },
}, { timestamps: true })

LabReportsEntrySchema.index({ patientId: 1, submittedAt: -1 })

export type HospitalLabReportsEntryDoc = {
  _id: string
  patientId: string
  encounterId: string
  tokenId?: string
  hxBy?: string
  hxDate?: string
  labInformation?: any
  semenAnalysis?: any
  tests?: any[]
  submittedAt: Date
  submittedBy?: string
}

export const HospitalLabReportsEntry = models.Hospital_LabReportsEntry || model('Hospital_LabReportsEntry', LabReportsEntrySchema)
