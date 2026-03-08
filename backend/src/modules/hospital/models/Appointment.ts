import { Schema, model, models } from 'mongoose'

const AppointmentSchema = new Schema({
  appointmentType: { type: String, required: true, enum: ['OPD', 'Diagnostic', 'Therapy', 'Counselling'], index: true },

  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', index: true },
  patientMrn: { type: String },
  patientName: { type: String, required: true },
  patientPhone: { type: String },
  patientAge: { type: String },
  patientGender: { type: String },
  guardianRel: { type: String },
  guardianName: { type: String },
  cnic: { type: String },
  address: { type: String },

  departmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_Department', index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Hospital_Doctor', index: true },

  appointmentDate: { type: String, required: true, index: true },
  appointmentTime: { type: String },

  notes: { type: String },
  receptionistName: { type: String },
  status: { type: String, enum: ['Scheduled', 'Checked-In', 'Completed', 'Cancelled'], default: 'Scheduled' },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter' },
  counsellingSaved: { type: Boolean, default: false },
}, { timestamps: true })

AppointmentSchema.index({ appointmentDate: -1, createdAt: -1 })

export type HospitalAppointmentDoc = {
  _id: string
  appointmentType: 'OPD' | 'Diagnostic' | 'Therapy' | 'Counselling'

  patientId?: string
  patientMrn?: string
  patientName: string
  patientPhone?: string
  patientAge?: string
  patientGender?: string
  guardianRel?: string
  guardianName?: string
  cnic?: string
  address?: string

  departmentId?: string
  doctorId?: string

  appointmentDate: string
  appointmentTime?: string

  notes?: string
  receptionistName?: string
  status?: 'Scheduled' | 'Checked-In' | 'Completed' | 'Cancelled'
  encounterId?: string
}

export const HospitalAppointment = models.Hospital_Appointment || model('Hospital_Appointment', AppointmentSchema)
