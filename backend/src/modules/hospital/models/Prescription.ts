import { Schema, model, models } from 'mongoose'

const PrescriptionSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', required: true, index: true },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter', required: true, index: true },
  historyTakingId: { type: Schema.Types.ObjectId, ref: 'Hospital_HistoryTaking', index: true },
  labReportsEntryId: { type: Schema.Types.ObjectId, ref: 'Hospital_LabReportsEntry', index: true },
  medicine: [{
    name: { type: String, required: true },
    dose: { type: String },
    frequency: { type: String },
    duration: { type: String },
    notes: { type: String },
  }],
  items: [{
    name: { type: String, required: true },
    dose: { type: String },
    frequency: { type: String },
    duration: { type: String },
    notes: { type: String },
  }],
  labTests: [{ type: String }],
  labNotes: { type: String },
  diagnosticTests: [{ type: String }],
  diagnosticNotes: { type: String },
  therapyTests: [{ type: String }],
  therapyNotes: { type: String },
  therapyPlan: { type: Schema.Types.Mixed, default: {} },
  therapyMachines: { type: Schema.Types.Mixed, default: {} },
  counselling: { type: Schema.Types.Mixed, default: {} },
  diagnosticDiscount: { type: Number, default: 0 },
  therapyDiscount: { type: Number, default: 0 },
  counsellingDiscount: { type: Number, default: 0 },
  primaryComplaint: { type: String },
  primaryComplaintHistory: { type: String },
  familyHistory: { type: String },
  treatmentHistory: { type: String },
  allergyHistory: { type: String },
  history: { type: String },
  examFindings: { type: String },
  diagnosis: { type: String },
  advice: { type: String },
  vitals: {
    pulse: { type: Number },
    temperatureC: { type: Number },
    bloodPressureSys: { type: Number },
    bloodPressureDia: { type: Number },
    respiratoryRate: { type: Number },
    bloodSugar: { type: Number },
    weightKg: { type: Number },
    heightCm: { type: Number },
    bmi: { type: Number },
    bsa: { type: Number },
    spo2: { type: Number },
  },
  // Stores doctor's edits on history fields (delta only, no duplication)
  historyEdits: {
    personalInfo: { type: Schema.Types.Mixed, default: null },
    maritalStatus: { type: Schema.Types.Mixed, default: null },
    coitus: { type: Schema.Types.Mixed, default: null },
    health: { type: Schema.Types.Mixed, default: null },
    sexualHistory: { type: Schema.Types.Mixed, default: null },
    previousMedicalHistory: { type: Schema.Types.Mixed, default: null },
    arrivalReference: { type: Schema.Types.Mixed, default: null },
  },
  createdBy: { type: String },
}, { timestamps: true })

export type HospitalPrescriptionDoc = {
  _id: string
  patientId: string
  encounterId: string
  historyTakingId?: string
  labReportsEntryId?: string
  medicine: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>
  items?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>
  labTests?: string[]
  labNotes?: string
  diagnosticTests?: string[]
  diagnosticNotes?: string
  therapyTests?: string[]
  therapyNotes?: string
  therapyPlan?: any
  therapyMachines?: any
  counselling?: any
  diagnosticDiscount?: number
  therapyDiscount?: number
  counsellingDiscount?: number
  primaryComplaint?: string
  primaryComplaintHistory?: string
  familyHistory?: string
  treatmentHistory?: string
  allergyHistory?: string
  history?: string
  examFindings?: string
  diagnosis?: string
  advice?: string
  vitals?: {
    pulse?: number
    temperatureC?: number
    bloodPressureSys?: number
    bloodPressureDia?: number
    respiratoryRate?: number
    bloodSugar?: number
    weightKg?: number
    heightCm?: number
    bmi?: number
    bsa?: number
    spo2?: number
  }
  historyEdits?: {
    personalInfo?: any
    maritalStatus?: any
    coitus?: any
    health?: any
    sexualHistory?: any
    previousMedicalHistory?: any
    arrivalReference?: any
  }
  createdBy?: string
}

export const HospitalPrescription = models.Hospital_Prescription || model('Hospital_Prescription', PrescriptionSchema)
