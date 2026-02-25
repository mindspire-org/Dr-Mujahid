import { z } from 'zod'

export const systemSettingsUpdateSchema = z.object({
  taxRate: z.number().min(0).max(100).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  currency: z.string().min(1).max(10).optional(),
  dateFormat: z.enum(['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD']).optional(),
})

export type SystemSettingsUpdate = z.infer<typeof systemSettingsUpdateSchema>
