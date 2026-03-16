import { Schema, model, models } from 'mongoose'

const CounsellingOrderSchema = new Schema(
  {
    tokenNo: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'lab_patient', required: true },
    patient: {
      mrn: String,
      fullName: String,
      phone: String,
      age: String,
      gender: String,
      address: String,
      guardianRelation: String,
      guardianName: String,
      cnic: String,
    },
    packages: [{ type: Schema.Types.ObjectId, ref: 'counselling_package' }],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['PKR', '%'], default: 'PKR' },
    net: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['paid', 'unpaid'], default: 'paid' },
    amountReceived: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['Cash', 'Card'] },
    receivedToAccountCode: String,
    accountNumberIban: String,
    referringConsultant: String,
    corporateId: { type: Schema.Types.ObjectId, ref: 'corporate_company' },
    status: { type: String, enum: ['active', 'cancelled', 'returned'], default: 'active' },
    sessionStatus: { type: String, enum: ['Queued', 'Completed'], default: 'Queued' },
    returnReason: String,
    createdAtIso: { type: String },
    updatedAtIso: { type: String },
  },
  { timestamps: true, collection: 'counselling_order' }
)

export const CounsellingOrder = models.counselling_orders || model('counselling_orders', CounsellingOrderSchema)
