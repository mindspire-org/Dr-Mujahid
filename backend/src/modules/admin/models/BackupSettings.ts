import mongoose, { Schema } from 'mongoose'

export type BackupSettingsDoc = {
  key: string
  enabled: boolean
  intervalMinutes: number
  folderPath: string
  lastBackupAt?: Date
  lastBackupFile?: string
  updatedAt?: Date
}

const BackupSettingsSchema = new Schema<BackupSettingsDoc>(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    intervalMinutes: { type: Number, default: 60 },
    folderPath: { type: String, default: '' },
    lastBackupAt: { type: Date },
    lastBackupFile: { type: String },
  },
  { timestamps: true },
)

export const BackupSettings =
  (mongoose.models.BackupSettings as mongoose.Model<BackupSettingsDoc>) ||
  mongoose.model<BackupSettingsDoc>('BackupSettings', BackupSettingsSchema)
