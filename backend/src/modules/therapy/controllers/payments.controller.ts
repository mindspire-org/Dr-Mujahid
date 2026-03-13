import { Request, Response } from 'express'
import { TherapyAccount } from '../models/TherapyAccount'
import { TherapyPayment } from '../models/TherapyPayment'
import { therapyPaymentCreateSchema, therapyPaymentQuerySchema } from '../validators/payment'

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

async function loadAccount(patientId: string) {
  const doc = await TherapyAccount.findOne({ patientId }).lean()
  return {
    doc,
    dues: clamp0((doc as any)?.dues),
    advance: clamp0((doc as any)?.advance),
  }
}

export async function list(req: Request, res: Response) {
  const parsed = therapyPaymentQuerySchema.safeParse(req.query)
  const { patientId, from, to, page, limit } = parsed.success ? (parsed.data as any) : {}

  const filter: any = {}
  if (patientId) filter.patientId = String(patientId)
  if (from || to) {
    const f: any = {}
    if (from) f.$gte = new Date(String(from)).toISOString()
    if (to) f.$lte = new Date(String(to)).toISOString()
    filter.createdAtIso = f
  }

  const lim = Math.min(1000, Number(limit || 50))
  const pg = Math.max(1, Number(page || 1))
  const skip = (pg - 1) * lim

  const [items, total] = await Promise.all([
    TherapyPayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    TherapyPayment.countDocuments(filter),
  ])

  const totalPages = Math.max(1, Math.ceil((total || 0) / lim))
  res.json({ items, total, page: pg, totalPages })
}

export async function create(req: Request, res: Response) {
  let data: any
  try {
    data = therapyPaymentCreateSchema.parse(req.body)
  } catch (e: any) {
    if (Array.isArray(e?.issues)) return res.status(400).json({ message: 'Validation error', issues: e.issues })
    throw e
  }
  const patientId = String(data.patientId)
  const nowIso = new Date().toISOString()

  const acct = await loadAccount(patientId)
  let dues = acct.dues
  let advance = acct.advance

  let remaining = clamp0(data.amount)
  let duesPaid = 0
  let advanceAdded = 0

  const mode = (data.applyMode || 'duesFirst') as any

  if (mode === 'advanceOnly') {
    advanceAdded = remaining
    remaining = 0
  } else {
    // duesFirst / duesOnly behave the same for general payments (no visit)
    duesPaid = Math.min(dues, remaining)
    dues = Math.max(0, dues - duesPaid)
    remaining -= duesPaid

    advanceAdded = remaining
    advance += advanceAdded
    remaining = 0
  }

  const pay = await TherapyPayment.create({
    patientId,
    visitId: data.visitId || undefined,
    applyMode: mode,
    amount: clamp0(data.amount),
    duesPaid,
    paidForToday: 0,
    advanceAdded,
    note: data.note,
    createdAtIso: nowIso,
  })

  await TherapyAccount.findOneAndUpdate(
    { patientId },
    {
      $setOnInsert: { patientId, dues: 0, advance: 0 },
      $set: { dues, advance, updatedAtIso: nowIso },
    },
    { upsert: true }
  )

  const after = await TherapyAccount.findOne({ patientId }).lean()
  res.status(201).json({ payment: pay, account: after })
}
