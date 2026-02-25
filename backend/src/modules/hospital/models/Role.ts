import { Schema, model, models } from 'mongoose'

const HospitalRoleSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true, index: true },
  portals: { type: Map, of: [String], default: {} },
}, { timestamps: true })

export type HospitalRoleDoc = {
  _id: string
  name: string
  portals?: Record<string, string[]>
  createdAt?: Date
  updatedAt?: Date
}

export const HospitalRole = models.Hospital_Role || model('Hospital_Role', HospitalRoleSchema)
