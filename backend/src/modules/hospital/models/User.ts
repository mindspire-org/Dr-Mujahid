import { Schema, model, models } from 'mongoose'

const HospitalUserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  fullName: { type: String },
  role: { type: String, required: true, default: 'Staff', index: true },
  portals: { type: Schema.Types.Mixed },
  tokenVersion: { type: Number, default: 0 },
  pettyCashAccountCode: { type: String, trim: true, uppercase: true, index: true },
  phone: { type: String },
  phoneNormalized: { type: String, index: true },
  email: { type: String },
  active: { type: Boolean, default: true, index: true },
  passwordHash: { type: String },
}, { timestamps: true })

export type HospitalUserDoc = {
  _id: string
  username: string
  fullName?: string
  role: string
  portals?: Record<string, string[]>
  tokenVersion?: number
  pettyCashAccountCode?: string
  phone?: string
  phoneNormalized?: string
  email?: string
  active: boolean
  passwordHash?: string
  createdAt?: Date
  updatedAt?: Date
}

export const HospitalUser = models.Hospital_User || model('Hospital_User', HospitalUserSchema)
