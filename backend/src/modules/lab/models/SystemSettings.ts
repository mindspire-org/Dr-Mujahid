import { Schema, model, models } from 'mongoose'

const SystemSettingsSchema = new Schema({
  currency: { type: String, default: 'PKR' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
}, { timestamps: true, collection: 'lab_system_settings' })

export type LabSystemSettingsDoc = {
  _id: string
  currency?: string
  dateFormat?: 'DD/MM/YYYY'|'MM/DD/YYYY'|'YYYY-MM-DD'|string
}

export const LabSystemSettings = models.Lab_SystemSettings || model('Lab_SystemSettings', SystemSettingsSchema)
