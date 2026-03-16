import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'
import { TherapyAccount } from '../models/TherapyAccount'
import { TherapyCounter } from '../models/TherapyCounter'
import { TherapyPayment } from '../models/TherapyPayment'
import { TherapyVisit } from '../models/TherapyVisit'
import { therapyVisitCreateSchema, therapyVisitQuerySchema, therapyVisitUpdateSchema } from '../validators/visit'
import { postTherapyTokenJournal } from './finance_ledger'

function normDigits(s?: string) {
  return (s || '').replace(/\D+/g, '')
}

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

async function nextTokenNo() {
  const key = 'therapy_token_no'
  const c = await TherapyCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const seq = Number((c as any).seq || 1)
  return String(seq)
}

async function ensureAccount(patientId: string, snap: { mrn?: string; fullName?: string; phone?: string }) {
  const nowIso = new Date().toISOString()
  const doc = await TherapyAccount.findOneAndUpdate(
    { patientId },
    {
      $setOnInsert: { patientId, dues: 0, advance: 0 },
      $set: {
        mrn: snap.mrn,
        fullName: snap.fullName,
        phone: snap.phone,
        updatedAtIso: nowIso,
      },
    },
    { upsert: true, new: true }
  ).lean()
  return {
    doc,
    dues: clamp0((doc as any)?.dues),
    advance: clamp0((doc as any)?.advance),
  }
}

export async function list(req: Request, res: Response) {
  const parsed = therapyVisitQuerySchema.safeParse(req.query)
  const { patientId, mrn, phone, name, from, to, page, limit } = parsed.success ? (parsed.data as any) : {}

  const filter: any = {}
  if (patientId) filter.patientId = String(patientId)
  if (mrn) filter['patient.mrn'] = String(mrn)
  if (phone) filter['patient.phone'] = new RegExp(normDigits(String(phone)))
  if (name) filter['patient.fullName'] = new RegExp(String(name).trim(), 'i')
    if (from || to) {
      const f: any = {}
      if (from) {
        const fromDate = new Date(String(from))
        fromDate.setUTCHours(0, 0, 0, 0)
        f.$gte = fromDate.toISOString()
      }
      if (to) {
        const toDate = new Date(String(to))
        toDate.setUTCHours(23, 59, 59, 999)
        f.$lte = toDate.toISOString()
      }
      // Check both createdAtIso and createdAt
      filter.$and = filter.$and || []
      filter.$and.push({
        $or: [
          { createdAtIso: f },
          { createdAt: f }
        ]
      })
    }

  const lim = Math.min(1000, Number(limit || 50))
  const pg = Math.max(1, Number(page || 1))
  const skip = (pg - 1) * lim

  const [items, total] = await Promise.all([
    TherapyVisit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    TherapyVisit.countDocuments(filter),
  ])
  const totalPages = Math.max(1, Math.ceil((total || 0) / lim))
  res.json({ items, total, page: pg, totalPages })
}

export async function getById(req: Request, res: Response) {
  const { id } = req.params
  const doc = await TherapyVisit.findById(id).lean()
  if (!doc) return res.status(404).json({ message: 'Visit not found' })
  res.json(doc)
}

export async function create(req: Request, res: Response) {
  let data: any
  try {
    data = therapyVisitCreateSchema.parse(req.body)
  } catch (e: any) {
    if (Array.isArray(e?.issues)) return res.status(400).json({ message: 'Validation error', issues: e.issues })
    throw e
  }

  const patientId = String(data.patientId)
  const patientSnap: any = data.patient

  // Ensure patient exists (for safety; helps management page)
  if (patientId) {
    const exists = await LabPatient.findById(patientId).lean()
    if (!exists) {
      // do not create here (patient creation should happen via /therapy/patients/find-or-create)
      return res.status(400).json({ message: 'Validation failed', issues: [{ path: ['patientId'], message: 'Patient not found' }] })
    }
  }

  const acct = await ensureAccount(patientId, { mrn: patientSnap?.mrn, fullName: patientSnap?.fullName, phone: patientSnap?.phone })

  const duesBefore = acct.dues
  const advanceBefore = acct.advance

  const subtotal = clamp0(data.subtotal)
  const discount = clamp0(data.discount)
  const net = clamp0(data.net != null ? data.net : Math.max(0, subtotal - discount))

  const useAdvance = !!data.useAdvance
  const payPreviousDues = !!data.payPreviousDues

  let advanceApplied = 0
  let netDueToday = net
  let advanceLeft = advanceBefore

  if (useAdvance) {
    advanceApplied = Math.min(advanceBefore, netDueToday)
    netDueToday = Math.max(0, netDueToday - advanceApplied)
    advanceLeft = Math.max(0, advanceBefore - advanceApplied)
  }

  let amountReceived = clamp0(data.amountReceived)

  let duesPaid = 0
  let paidForToday = 0
  let advanceAdded = 0

  let duesAfter = duesBefore
  if (payPreviousDues) {
    duesPaid = Math.min(duesAfter, amountReceived)
    duesAfter = Math.max(0, duesAfter - duesPaid)
    amountReceived -= duesPaid
  }

  paidForToday = Math.min(netDueToday, amountReceived)
  netDueToday = Math.max(0, netDueToday - paidForToday)
  amountReceived -= paidForToday

  advanceAdded = clamp0(amountReceived)

  duesAfter = duesAfter + netDueToday
  const advanceAfter = advanceLeft + advanceAdded

  const nowIso = new Date().toISOString()
  const tokenNo = await nextTokenNo()

  const visitData: any = {
    tokenNo,
    patientId,
    patient: patientSnap,

    packageId: data.packageId || undefined,
    packageName: data.packageName || undefined,

    tests: data.tests,
    subtotal,
    discount,
    discountType: data.discountType || 'PKR',
    net,

    duesBefore,
    advanceBefore,
    payPreviousDues,
    useAdvance,
    advanceApplied,
    amountReceived: clamp0(data.amountReceived),
    duesPaid,
    paidForToday,
    advanceAdded,
    duesAfter,
    advanceAfter,

    referringConsultant: data.referringConsultant || undefined,
    fromReferralId: data.fromReferralId || undefined,

    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  }

  // Debug log to verify what's being saved
  console.log('Creating Therapy Visit:', JSON.stringify(visitData, null, 2))

  const visit = await TherapyVisit.create(visitData)

  // Create Finance Journal entry
  console.log('Attempting to create Finance Journal for visit:', visit._id);
  console.log('Transaction Data:', {
    net,
    amountReceived: clamp0(data.amountReceived),
    paymentMethod: data.paymentMethod,
    receivedToAccountCode: data.receivedToAccountCode,
    user: (req as any).user?._id || (req as any).user?.username
  });

  try {
    const journal = await postTherapyTokenJournal({
      visitId: String(visit._id),
      dateIso: nowIso.slice(0, 10),
      net: net,
      amountReceived: clamp0(data.amountReceived),
      patientId: patientId,
      patientName: patientSnap?.fullName,
      mrn: patientSnap?.mrn,
      tokenNo: tokenNo,
      paymentMethod: data.paymentMethod,
      receivedToAccountCode: data.receivedToAccountCode,
      createdBy: (req as any).user?._id || (req as any).user?.username,
    })
    console.log('Finance Journal created successfully:', journal?._id || 'No journal returned');
  } catch (journalErr) {
    console.error('Failed to create finance journal for therapy visit:', journalErr)
  }

  await TherapyAccount.findOneAndUpdate(
    { patientId },
    {
      $setOnInsert: { patientId },
      $set: {
        mrn: patientSnap?.mrn,
        fullName: patientSnap?.fullName,
        phone: patientSnap?.phone,
        dues: duesAfter,
        advance: advanceAfter,
        updatedAtIso: nowIso,
      },
    },
    { upsert: true }
  )

  let payment: any = null
  if (clamp0(data.amountReceived) > 0) {
    payment = await TherapyPayment.create({
      patientId,
      visitId: String((visit as any)._id),
      applyMode: payPreviousDues ? 'duesFirst' : 'duesOnly',
      amount: clamp0(data.amountReceived),
      duesPaid,
      paidForToday,
      advanceAdded,
      note: undefined,
      createdAtIso: nowIso,
    })
  }

  const after = await TherapyAccount.findOne({ patientId }).lean()
  res.status(201).json({ visit, payment, account: after })
}

export async function update(req: Request, res: Response) {
  const { id } = req.params
  let patch: any
  try {
    patch = therapyVisitUpdateSchema.parse(req.body)
  } catch (e: any) {
    if (Array.isArray(e?.issues)) return res.status(400).json({ message: 'Validation error', issues: e.issues })
    throw e
  }

  // For now we allow updating non-ledger fields only (no financial recomputation)
  const allowed: any = {}
  if (patch.patient && typeof patch.patient === 'object') allowed.patient = patch.patient
  if (typeof patch.packageId === 'string') allowed.packageId = patch.packageId
  if (typeof patch.packageName === 'string') allowed.packageName = patch.packageName
  if (Array.isArray(patch.tests)) allowed.tests = patch.tests
  if (typeof patch.referringConsultant === 'string') allowed.referringConsultant = patch.referringConsultant
  if (typeof patch.fromReferralId === 'string') allowed.fromReferralId = patch.fromReferralId

  allowed.updatedAtIso = new Date().toISOString()

  const doc = await TherapyVisit.findByIdAndUpdate(id, { $set: allowed }, { new: true })
  if (!doc) return res.status(404).json({ message: 'Visit not found' })
  res.json({ visit: doc })
}

export async function updateSessionStatus(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { sessionStatus } = req.body
    if (!['Queued', 'Completed'].includes(sessionStatus)) {
      return res.status(400).json({ message: 'Invalid session status' })
    }
    const visit = await TherapyVisit.findByIdAndUpdate(
      id,
      { $set: { sessionStatus } },
      { new: true }
    ).lean()
    if (!visit) return res.status(404).json({ message: 'Visit not found' })
    res.json({ visit })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export async function returnVisit(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { reason } = req.body
    if (!reason) {
      return res.status(400).json({ message: 'Return reason is required' })
    }
    const visit = await TherapyVisit.findByIdAndUpdate(
      id,
      { $set: { status: 'returned', returnReason: reason } },
      { new: true }
    ).lean()
    if (!visit) return res.status(404).json({ message: 'Visit not found' })
    res.json({ visit })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}
