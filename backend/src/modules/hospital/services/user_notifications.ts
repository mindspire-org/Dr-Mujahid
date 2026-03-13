import { HospitalUserNotification } from '../models/UserNotification'

export async function createUserNotification(params: {
  userId: string
  type?: string
  title?: string
  message: string
  payload?: any
}) {
  const { userId, type, title, message, payload } = params
  if (!userId) return null
  return HospitalUserNotification.create({
    userId,
    type: type || 'info',
    title,
    message,
    payload,
    read: false,
  })
}
