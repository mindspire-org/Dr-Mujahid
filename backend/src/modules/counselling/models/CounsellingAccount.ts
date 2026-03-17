import { Schema, model, models } from 'mongoose'

const CounsellingAccountSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'lab_patient', required: true, unique: true },
    mrn: String,
    fullName: String,
    phone: String,
    dues: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    updatedAtIso: String,
  },
  { timestamps: true, collection: 'counselling_account' }
)

export const CounsellingAccount = models.counselling_account || model('counselling_account', CounsellingAccountSchema)
