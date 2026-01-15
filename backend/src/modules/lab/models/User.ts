import { Schema, model, models } from 'mongoose'

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin','technician','reception'], default: 'technician' },
  passwordHash: { type: String, required: true },
}, { timestamps: true })

export type LabUserDoc = {
  _id: string
  username: string
  role: 'admin'|'technician'|'reception'
  passwordHash: string
}

export const LabUser = models.Lab_User || model('Lab_User', UserSchema)
