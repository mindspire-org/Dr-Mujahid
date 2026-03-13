import { z } from 'zod'

export const settingsUpdateSchema = z.object({
  pharmacyName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().optional(),
  billingFooter: z.string().optional(),
  logoDataUrl: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  currency: z.string().min(1).max(10).optional(),
  dateFormat: z.enum(['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD']).optional(),
})

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>
