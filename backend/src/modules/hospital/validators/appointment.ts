import { z } from 'zod'

export const appointmentTypeEnum = z.enum(['OPD', 'Diagnostic', 'Therapy', 'Counselling'])

export const createAppointmentSchema = z.object({
  appointmentType: appointmentTypeEnum,

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

  departmentId: z.string().optional(),
  doctorId: z.string().optional(),

  appointmentDate: z.string().min(1),
  appointmentTime: z.string().optional(),

  notes: z.string().optional(),
  receptionistName: z.string().optional(),
  status: z.enum(['Scheduled', 'Checked-In', 'Completed', 'Cancelled']).optional(),
  encounterId: z.string().optional(),
})

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  appointmentType: appointmentTypeEnum.optional(),
  patientName: z.string().min(1).optional(),
  appointmentDate: z.string().min(1).optional(),
  status: z.enum(['Scheduled', 'Checked-In', 'Completed', 'Cancelled']).optional(),
  encounterId: z.string().optional(),
  counsellingSaved: z.boolean().optional(),
})
