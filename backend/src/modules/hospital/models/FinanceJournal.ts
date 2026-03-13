import { Schema, model, models } from 'mongoose'

const JournalLineSchema = new Schema({
  account: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  tags: { type: Schema.Types.Mixed },
}, { _id: false })

const JournalSchema = new Schema({
  txId: { type: String, index: true, unique: true, sparse: true },
  dateIso: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Hospital_User', index: true },
  refType: { type: String },
  refId: { type: String },
  memo: { type: String },
  lines: { type: [JournalLineSchema], default: [] },
}, { timestamps: true })

JournalSchema.pre('validate', function(next) {
  try {
    const self: any = this
    if (!self.txId) self.txId = `TXN-${String(self._id)}`
  } catch {}
  next()
})

export type JournalLine = {
  account: string
  debit?: number
  credit?: number
  tags?: any
}

export type JournalDoc = {
  _id: string
  txId?: string
  dateIso: string
  refType?: string
  refId?: string
  memo?: string
  lines: JournalLine[]
}

export const FinanceJournal = models.Hospital_Finance_Journal || model('Hospital_Finance_Journal', JournalSchema)
