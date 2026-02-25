import { Schema, model, models } from 'mongoose'

const CustomerPaymentSchema = new Schema({
  customerId: { type: String, required: true, index: true },
  saleId: { type: String },
  amount: { type: Number, required: true },
  method: { type: String },
  note: { type: String },
  date: { type: String },
}, { timestamps: true, collection: 'pharmacy_customer_payments' })

export type CustomerPaymentDoc = {
  _id: string
  customerId: string
  saleId?: string
  amount: number
  method?: string
  note?: string
  date?: string
}

export const CustomerPayment = models.Pharmacy_CustomerPayment || model('Pharmacy_CustomerPayment', CustomerPaymentSchema)
