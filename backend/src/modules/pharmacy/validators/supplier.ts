import { z } from 'zod'

export const supplierCreateSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  totalOverdue: z.number().optional(),
  status: z.enum(['Active','Inactive']).default('Active'),
})

export const supplierUpdateSchema = supplierCreateSchema.partial()

export type SupplierCreate = z.infer<typeof supplierCreateSchema>
export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>
