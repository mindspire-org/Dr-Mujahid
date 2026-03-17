import { z } from 'zod'

const paymentStatusEnum = z.enum(['paid','unpaid'])
const paymentMethodEnum = z.enum(['Cash','Card'])

export const therapyAppointmentCreateSchema = z.object({
  patientId: z.string().optional(),
  patientMrn: z.string().optional(),
  patientName: z.string().min(1),
  patientPhone: z.string().optional(),
  patientAge: z.string().optional(),
  patientGender: z.string().optional(),
  guardianRel: z.string().optional(),
  guardianName: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),

  appointmentDate: z.string().min(1),
  appointmentTime: z.string().optional(),

  referringConsultant: z.string().optional(),
  notes: z.string().optional(),
  receptionistName: z.string().optional(),

  packages: z.array(z.string().min(1)).optional().default([]),
  subtotal: z.coerce.number().nonnegative().optional().default(0),
  discount: z.coerce.number().nonnegative().optional().default(0),
  net: z.coerce.number().nonnegative().optional().default(0),
  paymentStatus: paymentStatusEnum.optional().default('paid'),
  paymentMethod: paymentMethodEnum.optional(),
  accountNumberIban: z.string().optional(),
  receivedToAccountCode: z.string().optional(),

  corporateId: z.string().optional(),
  corporatePreAuthNo: z.string().optional(),
  corporateCoPayPercent: z.coerce.number().min(0).max(100).optional(),
  corporateCoverageCap: z.coerce.number().min(0).optional(),
})

export const therapyAppointmentUpdateSchema = therapyAppointmentCreateSchema.partial().extend({
  patientName: z.string().min(1).optional(),
  appointmentDate: z.string().min(1).optional(),
})

export const therapyAppointmentQuerySchema = z.object({
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  paymentStatus: paymentStatusEnum.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
})
