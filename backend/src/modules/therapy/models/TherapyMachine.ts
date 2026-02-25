import { Schema, model, models } from 'mongoose'

export type TherapyMachineStatus = 'active' | 'inactive'

const TherapyMachineSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    package: { type: Number, required: true, min: 5, max: 100 },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, collection: 'therapy_machine' }
)

export type TherapyMachineDoc = {
  _id: string
  name: string
  package: number
  price: number
  status: TherapyMachineStatus
  createdAt?: string
  updatedAt?: string
}

export const TherapyMachine = models.therapy_machine || model('therapy_machine', TherapyMachineSchema)
