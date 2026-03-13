import { Schema, model, models } from 'mongoose'

const HospitalAccessNodeSchema = new Schema({
  key: { type: String, required: true, unique: true, trim: true, index: true },
  portalKey: { type: String, required: true, trim: true, index: true },
  type: { type: String, required: true, enum: ['module', 'page'], index: true },
  label: { type: String, required: true, trim: true },
  path: { type: String, trim: true },
  parentKey: { type: String, trim: true, index: true },
  order: { type: Number, default: 0, index: true },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

export type HospitalAccessNodeDoc = {
  _id: string
  key: string
  portalKey: string
  type: 'module' | 'page'
  label: string
  path?: string
  parentKey?: string
  order: number
  active: boolean
  createdAt?: Date
  updatedAt?: Date
}

export const HospitalAccessNode = models.Hospital_AccessNode || model('Hospital_AccessNode', HospitalAccessNodeSchema)
