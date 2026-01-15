import { Schema, model, models } from 'mongoose'

const HospitalUserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  fullName: { type: String },
  role: { type: String, enum: ['Admin','Staff','Reception','Doctor','Finance'], required: true, default: 'Staff', index: true },
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
  role: 'Admin' | 'Staff' | 'Reception' | 'Doctor' | 'Finance'
  phone?: string
  phoneNormalized?: string
  email?: string
  active: boolean
  passwordHash?: string
  createdAt?: Date
  updatedAt?: Date
}

export const HospitalUser = models.Hospital_User || model('Hospital_User', HospitalUserSchema)
