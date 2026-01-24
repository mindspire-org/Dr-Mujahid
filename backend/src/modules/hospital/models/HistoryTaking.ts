import { Schema, model, models } from 'mongoose'

const HistoryTakingSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', required: true, index: true },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter', required: true, index: true, unique: true },
  tokenId: { type: Schema.Types.ObjectId, ref: 'Hospital_Token', index: true },
  hxBy: { type: String },
  hxDate: { type: String },
  data: { type: Schema.Types.Mixed },
  submittedAt: { type: Date, default: Date.now, index: true },
  submittedBy: { type: String },
}, { timestamps: true })

HistoryTakingSchema.index({ patientId: 1, submittedAt: -1 })

export type HospitalHistoryTakingDoc = {
  _id: string
  patientId: string
  encounterId: string
  tokenId?: string
  hxBy?: string
  hxDate?: string
  data?: any
  submittedAt: Date
  submittedBy?: string
}

export const HospitalHistoryTaking = models.Hospital_HistoryTaking || model('Hospital_HistoryTaking', HistoryTakingSchema)
