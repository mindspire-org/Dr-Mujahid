import { z } from 'zod'

export const dispenseLineSchema = z.object({
  medicineId: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  qty: z.coerce.number().int().positive(),
  discountRs: z.coerce.number().nonnegative().default(0).optional(),
})

export const dispenseCreateSchema = z.object({
  customer: z.string().optional(),
  customerId: z.string().optional(),
  mrn: z.string().optional(),
  phone: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  guardianRel: z.string().optional(),
  guardianName: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  paymentStatus: z.enum(['paid', 'unpaid']).default('paid').optional(),
  accountCode: z.string().optional(),
  paymentMethodDetail: z.string().optional(),
  amountReceivedNow: z.coerce.number().nonnegative().default(0).optional(),
  duesBefore: z.coerce.number().default(0).optional(),
  advanceBefore: z.coerce.number().default(0).optional(),
  advanceApplied: z.coerce.number().default(0).optional(),
  duesPaid: z.coerce.number().default(0).optional(),
  paidForToday: z.coerce.number().default(0).optional(),
  advanceAdded: z.coerce.number().default(0).optional(),
  duesAfter: z.coerce.number().default(0).optional(),
  advanceAfter: z.coerce.number().default(0).optional(),
  payment: z.enum(['Cash','Card','Credit']).default('Cash'),
  discountPct: z.coerce.number().nonnegative().default(0),
  lineDiscountTotal: z.coerce.number().nonnegative().default(0).optional(),
  lines: z.array(dispenseLineSchema).min(1),
  createdBy: z.string().optional(),
})

export const salesQuerySchema = z.object({
  bill: z.string().optional(),
  customer: z.string().optional(),
  customerId: z.string().optional(),
  payment: z.enum(['Any','Cash','Card','Credit']).default('Any').optional(),
  medicine: z.string().optional(),
  user: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
})
