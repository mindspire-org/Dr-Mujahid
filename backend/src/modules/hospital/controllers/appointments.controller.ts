import { Request, Response } from 'express'
import { HospitalAppointment } from '../models/Appointment'
import { createAppointmentSchema, updateAppointmentSchema } from '../validators/appointment'
import { LabPatient } from '../../lab/models/Patient'
import { LabCounter } from '../../lab/models/Counter'
import { HospitalSettings } from '../models/Settings'

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

function normDigits(s?: string){
  return (s || '').replace(/\D+/g, '')
}

async function nextMrn(){
  const key = 'lab_mrn_mr7553'
  
  // Get settings to check for custom starting number
  const settings = await HospitalSettings.findOne().lean()
  const mrStart = settings?.mrStart || 1
  
  // Check current counter value
  let existingCounter = await LabCounter.findById(key).lean()
  const currentSeq = (existingCounter as any)?.seq || 0
  
  // If no counter exists OR current seq is less than mrStart-1, reset to mrStart-1
  const targetSeq = Math.max(0, mrStart - 1)
  if (!existingCounter) {
    // Initialize counter to mrStart - 1, so first increment gives mrStart
    await LabCounter.create({ _id: key, seq: targetSeq })
  } else if (currentSeq < targetSeq) {
    // Reset counter to mrStart - 1 if current is lower
    await LabCounter.findByIdAndUpdate(key, { $set: { seq: targetSeq } })
  }
  
  const c = await LabCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const seq = Number((c as any).seq || 1)
  return String(seq)
}

async function resolvePatient(data: any, createIfMissing: boolean = true){
  // Prefer explicit patientId.
  if (data.patientId){
    const patient = await LabPatient.findById(data.patientId)
    if (!patient) throw { status: 404, error: 'Patient not found' }
    const patch: any = {}
    if (data.patientName) patch.fullName = data.patientName
    if (data.guardianName) patch.fatherName = data.guardianName
    if (data.guardianRel) patch.guardianRel = data.guardianRel
    if (data.gender || data.patientGender) patch.gender = data.patientGender || data.gender
    if (data.address) patch.address = data.address
    if (data.age || data.patientAge) patch.age = data.patientAge || data.age
    if (data.patientPhone) patch.phoneNormalized = normDigits(data.patientPhone)
    if (data.cnic) patch.cnicNormalized = normDigits(data.cnic)
    if (Object.keys(patch).length){
      const updated = await LabPatient.findByIdAndUpdate(patient._id, { $set: patch }, { new: true })
      return updated || patient
    }
    return patient
  }

  // If MRN provided, link to that existing patient
  if (data.patientMrn){
    const patient = await LabPatient.findOne({ mrn: data.patientMrn })
    if (!patient) throw { status: 404, error: 'Patient not found' }
    const patch: any = {}
    if (data.patientName) patch.fullName = data.patientName
    if (data.guardianName) patch.fatherName = data.guardianName
    if (data.guardianRel) patch.guardianRel = data.guardianRel
    if (data.patientGender) patch.gender = data.patientGender
    if (data.address) patch.address = data.address
    if (data.patientAge) patch.age = data.patientAge
    if (data.patientPhone) patch.phoneNormalized = normDigits(data.patientPhone)
    if (data.cnic) patch.cnicNormalized = normDigits(data.cnic)
    if (Object.keys(patch).length){
      const updated = await LabPatient.findByIdAndUpdate(patient._id, { $set: patch }, { new: true })
      return updated || patient
    }
    return patient
  }

  // Otherwise, create or match by phone + name (avoid duplicate MRNs)
  const phoneDigits = normDigits(data.patientPhone)
  const name = String(data.patientName || '').trim()
  if (phoneDigits && name){
    const existing = await LabPatient.findOne({ phoneNormalized: phoneDigits, fullName: name })
    if (existing) return existing
  }

  if (!name) throw { status: 400, error: 'patientName required' }

  if (!createIfMissing) return null

  const mrn = await nextMrn()
  const patient = await LabPatient.create({
    mrn,
    fullName: name,
    fatherName: data.guardianName,
    guardianRel: data.guardianRel,
    phoneNormalized: phoneDigits || undefined,
    cnicNormalized: normDigits(data.cnic) || undefined,
    gender: data.patientGender,
    age: data.patientAge,
    address: data.address,
    createdAtIso: new Date().toISOString(),
  })
  return patient
}

export async function list(req: Request, res: Response){
  try {
    const q = req.query as any
    const from = String(q.from || '').trim()
    const to = String(q.to || '').trim()
    const appointmentType = String(q.appointmentType || '').trim()
    const doctorId = String(q.doctorId || '').trim()
    const departmentId = String(q.departmentId || '').trim()
    const search = String(q.q || '').trim().toLowerCase()

    const filter: any = {}
    if (from || to) {
      filter.appointmentDate = {}
      if (from) filter.appointmentDate.$gte = from
      if (to) filter.appointmentDate.$lte = to
    }
    if (appointmentType) filter.appointmentType = appointmentType
    if (doctorId) filter.doctorId = doctorId
    if (departmentId) filter.departmentId = departmentId

    if (search) {
      filter.$or = [
        { patientName: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') } },
        { patientMrn: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') } },
        { patientPhone: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') } },
      ]
    }

    const rows = await HospitalAppointment.find(filter)
      .sort({ appointmentDate: -1, createdAt: -1 })
      .populate([
        { path: 'doctorId', select: 'name opdBaseFee opdFollowupFee' },
        { path: 'departmentId', select: 'name opdBaseFee opdFollowupFee doctorPrices' },
      ])
      .lean()

    const withFee = (rows || []).map((r: any) => {
      const dep: any = r.departmentId
      const doc: any = r.doctorId
      let fee: number | null = null
      if (dep && doc && Array.isArray(dep.doctorPrices)){
        const match = dep.doctorPrices.find((p: any) => String(p.doctorId) === String(doc._id))
        if (match && match.price != null) fee = Number(match.price)
      }
      if (fee == null && doc && doc.opdBaseFee != null) fee = Number(doc.opdBaseFee)
      if (fee == null && dep && dep.opdBaseFee != null) fee = Number(dep.opdBaseFee)
      return { ...r, feeResolved: Number.isFinite(fee as any) ? fee : undefined }
    })

    res.json({ appointments: withFee })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function getById(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const doc = await HospitalAppointment.findById(id)
      .populate([
        { path: 'doctorId', select: 'name opdBaseFee opdFollowupFee' },
        { path: 'departmentId', select: 'name opdBaseFee opdFollowupFee' },
      ])
      .lean()
    if (!doc) return res.status(404).json({ error: 'Appointment not found' })
    res.json({ appointment: doc })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function create(req: Request, res: Response){
  try {
    const data = createAppointmentSchema.parse(req.body)
    const patient = await resolvePatient(data, false)
    const doc = await HospitalAppointment.create({
      ...data,
      patientId: patient?._id || undefined,
      patientMrn: patient?.mrn || undefined,
      patientName: String(patient?.fullName || data.patientName || '').trim(),
      patientPhone: data.patientPhone || patient?.phoneNormalized,
      patientAge: data.patientAge || patient?.age,
      patientGender: data.patientGender || patient?.gender,
      guardianRel: data.guardianRel || patient?.guardianRel,
      guardianName: data.guardianName || patient?.fatherName,
      cnic: data.cnic || patient?.cnicNormalized,
      address: data.address || patient?.address,
    })
    res.status(201).json({ appointment: doc })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function update(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const data = updateAppointmentSchema.parse(req.body)
    const patch: any = { ...data }

    // If patient fields are changed, re-resolve patient and keep MRN linkage consistent.
    if (data.patientId || data.patientMrn || data.patientName || data.patientPhone || data.patientAge || data.patientGender || data.guardianRel || data.guardianName || data.cnic || data.address){
      const patient = await resolvePatient(data)
      patch.patientId = patient?._id
      patch.patientMrn = patient?.mrn
      patch.patientName = String((patient as any)?.fullName || data.patientName || '').trim()
      patch.patientPhone = data.patientPhone || (patient as any)?.phoneNormalized
      patch.patientAge = data.patientAge || (patient as any)?.age
      patch.patientGender = data.patientGender || (patient as any)?.gender
      patch.guardianRel = data.guardianRel || (patient as any)?.guardianRel
      patch.guardianName = data.guardianName || (patient as any)?.fatherName
      patch.cnic = data.cnic || (patient as any)?.cnicNormalized
      patch.address = data.address || (patient as any)?.address
    }

    const doc = await HospitalAppointment.findByIdAndUpdate(id, { $set: patch }, { new: true })
    if (!doc) return res.status(404).json({ error: 'Appointment not found' })
    res.json({ appointment: doc })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function remove(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const doc = await HospitalAppointment.findByIdAndDelete(id)
    if (!doc) return res.status(404).json({ error: 'Appointment not found' })
    res.json({ ok: true })
  } catch (e) {
    return handleError(res, e)
  }
}
