import { z } from 'zod'

export const therapyPaymentCreateSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
  applyMode: z.enum(['duesFirst', 'advanceOnly', 'duesOnly']).optional().default('duesFirst'),
  note: z.string().optional(),
})

export const therapyPaymentQuerySchema = z.object({
  patientId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
})
