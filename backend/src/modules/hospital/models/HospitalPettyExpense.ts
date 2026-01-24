import { Schema, model, models } from 'mongoose'

const HospitalPettyExpenseSchema = new Schema({
  dateIso: { type: String, required: true, index: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  usedBy: { type: String },
}, { timestamps: true, collection: 'hospital_petty_expense' })

export type HospitalPettyExpenseDoc = {
  _id: string
  dateIso: string
  type: string
  amount: number
  usedBy?: string
}

export const HospitalPettyExpense = models.Hospital_Petty_Expense || model('Hospital_Petty_Expense', HospitalPettyExpenseSchema)
