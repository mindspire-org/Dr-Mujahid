import { z } from 'zod'

export const upsertLabReportsEntrySchema = z.object({
  tokenId: z.string().optional(),
  hxBy: z.string().optional(),
  hxDate: z.string().optional(),
  labInformation: z.any().optional(),
  semenAnalysis: z.any().optional(),
  tests: z.array(z.any()).optional(),
  submittedBy: z.string().optional(),
})
