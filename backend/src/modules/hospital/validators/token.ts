import { z } from 'zod'

export const createOpdTokenSchema = z.object({
  // identify patient either by id or mrn or name
  patientId: z.string().optional(),
  mrn: z.string().optional(),
  patientName: z.string().optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  guardianRel: z.string().optional(),
  guardianName: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  age: z.string().optional(),
  departmentId: z.string().min(1),
  doctorId: z.string().optional(),
  visitType: z.enum(['new','followup']).default('new'),
  discount: z.number().min(0).optional(),
  paymentStatus: z.enum(['paid','unpaid']).default('paid'),
  payPreviousDues: z.coerce.boolean().optional(),
  useAdvance: z.coerce.boolean().optional(),
  amountReceived: z.coerce.number().min(0).optional(),
  receptionistName: z.string().optional(),
  paymentMethod: z.enum(['Cash','Card','Insurance']).optional(),
  accountNumberIban: z.string().optional(),
  receivedToAccountCode: z.string().optional(),
  paymentRef: z.string().optional(),
  corporateId: z.string().optional(),
  corporatePreAuthNo: z.string().optional(),
  corporateCoPayPercent: z.number().min(0).max(100).optional(),
  corporateCoverageCap: z.number().min(0).optional(),
  // Optional override for resolved OPD fee (used when admitting to IPD from token)
  overrideFee: z.number().min(0).optional(),
  // Scheduling (optional): either provide scheduleId and desired slot start HH:mm, or leave empty to auto-assign next free slot
  scheduleId: z.string().optional(),
  apptStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:mm
})

export const listTokensSchema = z.object({
  date: z.string().optional(),
  status: z.enum(['queued','in-progress','completed','returned','cancelled']).optional(),
})

export const payTokenSchema = z.object({
  receptionistName: z.string().min(1).optional(),
  paymentMethod: z.enum(['Cash','Card','Insurance']),
  accountNumberIban: z.string().optional(),
  receivedToAccountCode: z.string().optional(),
})

export const updateTokenSchema = z.object({
  // Patient (optional)
  patientName: z.string().optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  guardianRel: z.string().optional(),
  guardianName: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  age: z.string().optional(),

  // Assignment
  departmentId: z.string().optional(),
  doctorId: z.string().optional(),

  // Billing
  amount: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  paymentStatus: z.enum(['paid','unpaid']).optional(),
  receptionistName: z.string().optional(),
  paymentMethod: z.enum(['Cash','Card','Insurance']).optional(),
  accountNumberIban: z.string().optional(),
})
