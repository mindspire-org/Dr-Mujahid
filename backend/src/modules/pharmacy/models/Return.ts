import { Schema, model, models } from 'mongoose'

const LineSchema = new Schema({
  medicineId: { type: String },
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  amount: { type: Number, default: 0 },
})

const ReturnSchema = new Schema({
  type: { type: String, enum: ['Customer','Supplier'], required: true },
  datetime: { type: String, required: true },
  reference: { type: String, required: true },
  party: { type: String, required: true },
  items: { type: Number, required: true },
  total: { type: Number, required: true },
  lines: { type: [LineSchema], default: [] },
  accountCode: { type: String },
  createdByUsername: { type: String },
}, { timestamps: true })

export type ReturnDoc = {
  _id: string
  type: 'Customer'|'Supplier'
  datetime: string
  reference: string
  party: string
  items: number
  total: number
  lines: { medicineId:string; name:string; qty:number; amount:number }[]
}

export const Return = models.Pharmacy_Return || model('Pharmacy_Return', ReturnSchema)
