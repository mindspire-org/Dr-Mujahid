import { z } from 'zod'

const packageValues = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
  55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const

export const therapyPackageCreateSchema = z.object({
  packageName: z.string().trim().min(1),
  package: z.coerce.number().int().refine(v => (packageValues as readonly number[]).includes(v), 'Invalid package'),
  price: z.coerce.number().nonnegative(),
  machinePreset: z.any().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

export const therapyPackageUpdateSchema = therapyPackageCreateSchema.partial()

export const therapyPackageQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  package: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
})
