import { z } from 'zod'

export const patientFindOrCreateSchema = z.object({
  fullName: z.string().min(1),
  guardianName: z.string().optional(),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  age: z.string().optional(),
  guardianRel: z.string().optional(),
  selectId: z.string().optional(),
})
