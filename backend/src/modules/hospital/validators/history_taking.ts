import { z } from 'zod'

export const upsertHistoryTakingSchema = z.object({
  tokenId: z.string().optional(),
  hxBy: z.string().optional(),
  hxDate: z.string().optional(),
  data: z.any().optional(),
  submittedBy: z.string().optional(),
})
