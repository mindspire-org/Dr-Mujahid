import { Schema, model, models } from 'mongoose'

export type TherapyPackageStatus = 'active' | 'inactive'

const TherapyPackageSchema = new Schema(
  {
    packageName: { type: String, required: true, trim: true },
    package: { type: Number, required: true, min: 5, max: 100, unique: true },
    price: { type: Number, required: true, min: 0 },
    machinePreset: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, collection: 'therapy_package' }
)

export type TherapyPackageDoc = {
  _id: string
  packageName: string
  package: number
  price: number
  machinePreset?: any
  status: TherapyPackageStatus
  createdAt?: string
  updatedAt?: string
}

export const TherapyPackage = models.therapy_package || model('therapy_package', TherapyPackageSchema)
