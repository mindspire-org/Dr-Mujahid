import { Schema, model, models } from 'mongoose'

const UserNotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Hospital_User', index: true, required: true },
  type: { type: String, default: 'info' },
  title: { type: String },
  message: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  read: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: true } })

UserNotificationSchema.index({ userId: 1, createdAt: -1 })

export type HospitalUserNotificationDoc = {
  _id: string
  userId: string
  type?: string
  title?: string
  message: string
  payload?: any
  read?: boolean
  createdAt: Date
  updatedAt: Date
}

export const HospitalUserNotification = models.Hospital_User_Notification || model('Hospital_User_Notification', UserNotificationSchema)
