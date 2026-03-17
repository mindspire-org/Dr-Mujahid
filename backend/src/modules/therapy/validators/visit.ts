import { z } from 'zod'

const patientSnapshotSchema = z.object({
  mrn: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  guardianRelation: z.string().optional(),
  guardianName: z.string().optional(),
  cnic: z.string().optional(),
})

const visitTestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  details: z.any().optional(),
})

export const therapyVisitCreateSchema = z.object({
  patientId: z.string().min(1),
  patient: patientSnapshotSchema,

  packageId: z.string().optional(),
  packageName: z.string().optional(),

  tests: z.array(visitTestSchema).min(1),

  subtotal: z.coerce.number().nonnegative().optional().default(0),
  discount: z.coerce.number().nonnegative().optional().default(0),
  discountType: z.enum(['PKR', '%']).optional().default('PKR'),
  net: z.coerce.number().nonnegative().optional().default(0),

  payPreviousDues: z.coerce.boolean().optional().default(false),
  useAdvance: z.coerce.boolean().optional().default(false),
  amountReceived: z.coerce.number().nonnegative().optional().default(0),

  paymentStatus: z.enum(['paid', 'unpaid']).optional().default('paid'),
  paymentMethod: z.enum(['Cash', 'Card']).optional(),
  receivedToAccountCode: z.string().optional(),

  referringConsultant: z.string().optional(),
  fromReferralId: z.string().optional(),
})

export const therapyVisitUpdateSchema = therapyVisitCreateSchema.partial().extend({
  patientId: z.string().optional(),
  patient: patientSnapshotSchema.optional(),
  tests: z.array(visitTestSchema).optional(),
})

export const therapyVisitQuerySchema = z.object({
  patientId: z.string().optional(),
  mrn: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
})
