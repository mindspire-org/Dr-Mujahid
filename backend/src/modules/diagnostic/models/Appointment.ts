import { Schema, model, models } from 'mongoose'

const PatientSnapshotSchema = new Schema({
  mrn: { type: String },
  fullName: { type: String, required: true },
  phone: { type: String },
  age: { type: String },
  gender: { type: String },
  address: { type: String },
  guardianRelation: { type: String },
  guardianName: { type: String },
  cnic: { type: String },
}, { _id: false })

const AppointmentSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', index: true },
  patientMrn: { type: String, index: true },
  patientName: { type: String, required: true },
  patientPhone: { type: String },
  patientAge: { type: String },
  patientGender: { type: String },
  guardianRel: { type: String },
  guardianName: { type: String },
  cnic: { type: String },
  address: { type: String },

  appointmentDate: { type: String, required: true, index: true },
  appointmentTime: { type: String },

  referringConsultant: { type: String },
  notes: { type: String },
  receptionistName: { type: String },

  // Tests + Billing (match diagnostic order create payload)
  tests: { type: [String], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  net: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['paid','unpaid'], default: 'paid', index: true },
  paymentMethod: { type: String },
  accountNumberIban: { type: String },
  receivedToAccountCode: { type: String },

  // Corporate billing fields (store for later conversion to order)
  corporateId: { type: Schema.Types.ObjectId, ref: 'Corporate_Company' },
  corporatePreAuthNo: { type: String },
  corporateCoPayPercent: { type: Number },
  corporateCoverageCap: { type: Number },

  // Optional: store snapshot for convenience
  patientSnapshot: { type: PatientSnapshotSchema },
}, { timestamps: true })

AppointmentSchema.index({ appointmentDate: -1, createdAt: -1 })

export type DiagnosticAppointmentDoc = {
  _id: string
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

  appointmentDate: string
  appointmentTime?: string

  referringConsultant?: string
  notes?: string
  receptionistName?: string

  tests?: string[]
  subtotal?: number
  discount?: number
  net?: number
  paymentStatus?: 'paid'|'unpaid'
  paymentMethod?: string
  accountNumberIban?: string
  receivedToAccountCode?: string

  corporateId?: string
  corporatePreAuthNo?: string
  corporateCoPayPercent?: number
  corporateCoverageCap?: number

  patientSnapshot?: any
}

export const DiagnosticAppointment = models.Diagnostic_Appointment || model('Diagnostic_Appointment', AppointmentSchema)
