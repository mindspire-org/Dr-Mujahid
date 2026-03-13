import { z } from 'zod'

export const therapyAccountQuerySchema = z.object({
  q: z.string().optional(),
  hasDues: z.coerce.boolean().optional(),
  hasAdvance: z.coerce.boolean().optional(),
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
})
