import { Schema, model, models } from 'mongoose'

export type CounsellingPackageStatus = 'active' | 'inactive'

const CounsellingPackageSchema = new Schema(
  {
    packageName: { type: String, required: true, trim: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, collection: 'counselling_package' }
)

export type CounsellingPackageDoc = {
  _id: string
  packageName: string
  month: number
  price: number
  status: CounsellingPackageStatus
  createdAt?: string
  updatedAt?: string
}

export const CounsellingPackage = models.counselling_package || model('counselling_package', CounsellingPackageSchema)
