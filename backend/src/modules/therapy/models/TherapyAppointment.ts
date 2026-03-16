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

const TherapyAppointmentSchema = new Schema({
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

  packages: { type: [String], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  net: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['paid','unpaid'], default: 'paid', index: true },
  paymentMethod: { type: String },
  accountNumberIban: { type: String },
  receivedToAccountCode: { type: String },

  corporateId: { type: Schema.Types.ObjectId, ref: 'Corporate_Company' },
  corporatePreAuthNo: { type: String },
  corporateCoPayPercent: { type: Number },
  corporateCoverageCap: { type: Number },

  patientSnapshot: { type: PatientSnapshotSchema },
}, { timestamps: true, collection: 'therapy_appointment' })

TherapyAppointmentSchema.index({ appointmentDate: -1, createdAt: -1 })

export const TherapyAppointment = models.TherapyAppointment || model('TherapyAppointment', TherapyAppointmentSchema)
