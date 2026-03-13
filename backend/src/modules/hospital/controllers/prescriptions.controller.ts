import { Request, Response } from 'express'
import { createPrescriptionSchema, updatePrescriptionSchema } from '../validators/prescription'
import { HospitalPrescription } from '../models/Prescription'
import { HospitalEncounter } from '../models/Encounter'
import { LabPatient } from '../../lab/models/Patient'

function normalizePrescriptionOut(p: any){
  if (!p) return p
  if (p.medicine === undefined && p.items !== undefined) p.medicine = p.items
  return p
}

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

async function getEncounter(encounterId: string){
  const enc = await HospitalEncounter.findById(encounterId)
  if (!enc) throw { status: 404, error: 'Encounter not found' }
  if (enc.type !== 'OPD') throw { status: 400, error: 'Only OPD encounters can have prescriptions' }
  return enc
}

export async function create(req: Request, res: Response){
  const data = createPrescriptionSchema.parse(req.body)
  const enc = await HospitalEncounter.findById(data.encounterId)
  if (!enc) return res.status(404).json({ error: 'Encounter not found' })
  if (enc.type !== 'OPD') return res.status(400).json({ error: 'Only OPD encounters can have prescriptions' })

  const medicine = (data as any).medicine || (data as any).items

  const pres = await HospitalPrescription.create({
    patientId: enc.patientId,
    encounterId: data.encounterId,
    historyTakingId: (data as any).historyTakingId,
    labReportsEntryId: (data as any).labReportsEntryId,
    medicine,
    labTests: data.labTests,
    labNotes: data.labNotes,
    diagnosticTests: data.diagnosticTests,
    diagnosticNotes: data.diagnosticNotes,
    therapyTests: data.therapyTests,
    therapyNotes: data.therapyNotes,
    diagnosticDiscount: (data as any).diagnosticDiscount,
    therapyDiscount: (data as any).therapyDiscount,
    counsellingDiscount: (data as any).counsellingDiscount,
    therapyPlan: (data as any).therapyPlan,
    therapyMachines: (data as any).therapyMachines,
    counselling: (data as any).counselling,
    primaryComplaint: data.primaryComplaint,
    primaryComplaintHistory: data.primaryComplaintHistory,
    familyHistory: data.familyHistory,
    treatmentHistory: data.treatmentHistory,
    allergyHistory: data.allergyHistory,
    history: data.history,
    examFindings: data.examFindings,
    diagnosis: data.diagnosis,
    advice: data.advice,
    vitals: (data as any).vitals,
    historyEdits: (data as any).historyEdits,
    createdBy: data.createdBy,
  })

  res.status(201).json({ prescription: normalizePrescriptionOut(pres.toObject ? pres.toObject() : pres) })
}

export async function getByEncounter(req: Request, res: Response){
  try {
    const { encounterId } = req.params as any
    const enc = await getEncounter(String(encounterId))
    const doc = await HospitalPrescription.findOne({ encounterId: enc._id }).lean()
    res.json({ prescription: normalizePrescriptionOut(doc) || null })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function upsertByEncounter(req: Request, res: Response){
  try {
    const { encounterId } = req.params as any
    const enc = await getEncounter(String(encounterId))
    const data = updatePrescriptionSchema.parse(req.body)
    const set: any = {
      patientId: enc.patientId,
      encounterId: enc._id,
    }

    if ((data as any).historyTakingId !== undefined) set.historyTakingId = (data as any).historyTakingId
    if ((data as any).labReportsEntryId !== undefined) set.labReportsEntryId = (data as any).labReportsEntryId

    const med = (data as any).medicine || (data as any).items
    if (med) set.medicine = med
    if (data.labTests !== undefined) set.labTests = data.labTests
    if (data.labNotes !== undefined) set.labNotes = data.labNotes
    if ((data as any).diagnosticTests !== undefined) set.diagnosticTests = (data as any).diagnosticTests
    if ((data as any).diagnosticNotes !== undefined) set.diagnosticNotes = (data as any).diagnosticNotes
    if ((data as any).therapyTests !== undefined) set.therapyTests = (data as any).therapyTests
    if ((data as any).therapyNotes !== undefined) set.therapyNotes = (data as any).therapyNotes
    if ((data as any).diagnosticDiscount !== undefined) set.diagnosticDiscount = (data as any).diagnosticDiscount
    if ((data as any).therapyDiscount !== undefined) set.therapyDiscount = (data as any).therapyDiscount
    if ((data as any).counsellingDiscount !== undefined) set.counsellingDiscount = (data as any).counsellingDiscount
    if ((data as any).therapyPlan !== undefined) set.therapyPlan = (data as any).therapyPlan
    if ((data as any).therapyMachines !== undefined) set.therapyMachines = (data as any).therapyMachines
    if ((data as any).counselling !== undefined) set.counselling = (data as any).counselling
    if ((data as any).primaryComplaint !== undefined) set.primaryComplaint = (data as any).primaryComplaint
    if ((data as any).primaryComplaintHistory !== undefined) set.primaryComplaintHistory = (data as any).primaryComplaintHistory
    if ((data as any).familyHistory !== undefined) set.familyHistory = (data as any).familyHistory
    if ((data as any).treatmentHistory !== undefined) set.treatmentHistory = (data as any).treatmentHistory
    if ((data as any).allergyHistory !== undefined) set.allergyHistory = (data as any).allergyHistory
    if (data.history !== undefined) set.history = data.history
    if (data.examFindings !== undefined) set.examFindings = data.examFindings
    if (data.diagnosis !== undefined) set.diagnosis = data.diagnosis
    if (data.advice !== undefined) set.advice = data.advice
    if ((data as any).vitals !== undefined) set.vitals = (data as any).vitals
    if ((data as any).historyEdits !== undefined) set.historyEdits = (data as any).historyEdits
    if ((data as any).createdBy !== undefined) set.createdBy = (data as any).createdBy

    const doc = await HospitalPrescription.findOneAndUpdate(
      { encounterId: enc._id },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate({ path: 'encounterId', select: 'doctorId patientId startAt', populate: [{ path: 'doctorId', select: 'name' }, { path: 'patientId', select: 'fullName mrn' }] })
      .lean()

    res.status(201).json({ prescription: normalizePrescriptionOut(doc) })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function list(req: Request, res: Response){
  const q = req.query as any
  const doctorId = q.doctorId ? String(q.doctorId) : ''
  const patientMrn = q.patientMrn ? String(q.patientMrn).trim() : ''
  const from = q.from ? new Date(String(q.from)) : null
  const to = q.to ? new Date(String(q.to)) : null
  if (to) to.setHours(23,59,59,999)
  const page = q.page ? Math.max(1, parseInt(String(q.page))) : 1
  const limit = q.limit ? Math.max(1, Math.min(200, parseInt(String(q.limit)))) : 50

  let encCrit: any = { type: 'OPD' }
  if (doctorId) encCrit.doctorId = doctorId
  if (patientMrn) {
    const pDoc = await LabPatient.findOne({ mrn: new RegExp(`^${patientMrn}$`, 'i') }).select('_id').lean()
    if (!pDoc) return res.json({ prescriptions: [], total: 0, page, limit })
    encCrit.patientId = (pDoc as any)._id
  }
  const encs = await HospitalEncounter.find(encCrit).select('_id').lean()
  const encIds = encs.map(e => e._id)

  const presCrit: any = {}
  if (encIds.length) presCrit.encounterId = { $in: encIds }
  if (from || to) {
    presCrit.createdAt = {}
    if (from) presCrit.createdAt.$gte = from
    if (to) presCrit.createdAt.$lte = to
  }

  const total = await HospitalPrescription.countDocuments(presCrit)
  const rows = await HospitalPrescription.find(presCrit)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate({ path: 'encounterId', select: 'doctorId patientId startAt', populate: [{ path: 'doctorId', select: 'name' }, { path: 'patientId', select: 'fullName mrn' }] })
    .lean()
  res.json({ prescriptions: (rows || []).map(normalizePrescriptionOut), total, page, limit })
}

export async function getById(req: Request, res: Response){
  const { id } = req.params as any
  const row = await HospitalPrescription.findById(String(id))
    .populate({ path: 'encounterId', select: 'doctorId patientId startAt', populate: [{ path: 'doctorId', select: 'name' }, { path: 'patientId', select: 'fullName mrn' }] })
    .lean()
  if (!row) return res.status(404).json({ error: 'Prescription not found' })
  res.json({ prescription: normalizePrescriptionOut(row) })
}

export async function getByHistoryTakingId(req: Request, res: Response){
  try {
    const { historyTakingId } = req.params as any
    const row = await HospitalPrescription.findOne({ historyTakingId: String(historyTakingId) })
      .populate({ path: 'encounterId', select: 'doctorId patientId startAt', populate: [{ path: 'doctorId', select: 'name' }, { path: 'patientId', select: 'fullName mrn' }] })
      .lean()
    res.json({ prescription: normalizePrescriptionOut(row) || null })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function update(req: Request, res: Response){
  const { id } = req.params as any
  const data = updatePrescriptionSchema.parse(req.body)
  const set: any = {}
  if ((data as any).historyTakingId !== undefined) set.historyTakingId = (data as any).historyTakingId
  if ((data as any).labReportsEntryId !== undefined) set.labReportsEntryId = (data as any).labReportsEntryId
  const med = (data as any).medicine || (data as any).items
  if (med) set.medicine = med
  if (data.labTests !== undefined) set.labTests = data.labTests
  if (data.labNotes !== undefined) set.labNotes = data.labNotes
  if ((data as any).diagnosticTests !== undefined) set.diagnosticTests = (data as any).diagnosticTests
  if ((data as any).diagnosticNotes !== undefined) set.diagnosticNotes = (data as any).diagnosticNotes
  if ((data as any).therapyTests !== undefined) set.therapyTests = (data as any).therapyTests
  if ((data as any).therapyNotes !== undefined) set.therapyNotes = (data as any).therapyNotes
  if ((data as any).diagnosticDiscount !== undefined) set.diagnosticDiscount = (data as any).diagnosticDiscount
  if ((data as any).therapyDiscount !== undefined) set.therapyDiscount = (data as any).therapyDiscount
  if ((data as any).counsellingDiscount !== undefined) set.counsellingDiscount = (data as any).counsellingDiscount
  if ((data as any).therapyPlan !== undefined) set.therapyPlan = (data as any).therapyPlan
  if ((data as any).therapyMachines !== undefined) set.therapyMachines = (data as any).therapyMachines
  if ((data as any).counselling !== undefined) set.counselling = (data as any).counselling
  if ((data as any).primaryComplaint !== undefined) set.primaryComplaint = (data as any).primaryComplaint
  if ((data as any).primaryComplaintHistory !== undefined) set.primaryComplaintHistory = (data as any).primaryComplaintHistory
  if ((data as any).familyHistory !== undefined) set.familyHistory = (data as any).familyHistory
  if ((data as any).treatmentHistory !== undefined) set.treatmentHistory = (data as any).treatmentHistory
  if ((data as any).allergyHistory !== undefined) set.allergyHistory = (data as any).allergyHistory
  if (data.history !== undefined) set.history = data.history
  if (data.examFindings !== undefined) set.examFindings = data.examFindings
  if (data.diagnosis !== undefined) set.diagnosis = data.diagnosis
  if (data.advice !== undefined) set.advice = data.advice
  if ((data as any).vitals !== undefined) set.vitals = (data as any).vitals
  if ((data as any).historyEdits !== undefined) set.historyEdits = (data as any).historyEdits
  if ((data as any).createdBy !== undefined) set.createdBy = (data as any).createdBy
  const row = await HospitalPrescription.findByIdAndUpdate(String(id), { $set: set }, { new: true })
    .populate({ path: 'encounterId', select: 'doctorId patientId startAt', populate: [{ path: 'doctorId', select: 'name' }, { path: 'patientId', select: 'fullName mrn' }] })
    .lean()
  if (!row) return res.status(404).json({ error: 'Prescription not found' })
  res.json({ prescription: normalizePrescriptionOut(row) })
}

export async function remove(req: Request, res: Response){
  const { id } = req.params as any
  const row = await HospitalPrescription.findByIdAndDelete(String(id))
  if (!row) return res.status(404).json({ error: 'Prescription not found' })
  res.json({ ok: true })
}
