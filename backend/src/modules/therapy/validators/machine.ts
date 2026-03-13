import { z } from 'zod'

const packageValues = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
  55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const

export const therapyMachineCreateSchema = z.object({
  name: z.string().min(1),
  package: z.coerce.number().int().refine(v => (packageValues as readonly number[]).includes(v), 'Invalid package'),
  price: z.coerce.number().nonnegative(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

export const therapyMachineUpdateSchema = therapyMachineCreateSchema.partial()

export const therapyMachineQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  package: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
})
