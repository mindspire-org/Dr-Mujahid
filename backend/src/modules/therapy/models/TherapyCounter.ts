import { Schema, model, models } from 'mongoose'

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export type TherapyCounterDoc = { _id: string; seq: number }

export const TherapyCounter = models.Therapy_Counter || model('Therapy_Counter', CounterSchema)
