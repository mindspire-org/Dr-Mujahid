import { Request, Response } from 'express'
import { CounsellingAppointment } from '../models/Appointment'
import { counsellingAppointmentCreateSchema, counsellingAppointmentQuerySchema, counsellingAppointmentUpdateSchema } from '../validators/appointment'
import { LabPatient } from '../../lab/models/Patient'
import { LabCounter } from '../../lab/models/Counter'
import { HospitalSettings } from '../../hospital/models/Settings'

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  console.error('[CounsellingAppointments]', e)
  return res.status(500).json({ error: 'Internal Server Error' })
}

function normDigits(s?: string){
  return (s || '').replace(/\D+/g, '')
}

async function nextMrn(){
  const key = 'lab_mrn_mr7553'
  const settings = await HospitalSettings.findOne().lean()
  const mrStart = settings?.mrStart || 1
  let existingCounter = await LabCounter.findById(key).lean()
  const currentSeq = (existingCounter as any)?.seq || 0
  const targetSeq = Math.max(0, mrStart - 1)
  if (!existingCounter) {
    await LabCounter.create({ _id: key, seq: targetSeq })
  } else if (currentSeq < targetSeq) {
    await LabCounter.findByIdAndUpdate(key, { $set: { seq: targetSeq } })
  }
  const c = await LabCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const seq = Number((c as any).seq || 1)
  return String(seq)
}

async function resolvePatient(data: any){
  // If patientId is provided, we update the existing patient
  if (data.patientId){
    const patient = await LabPatient.findById(data.patientId)
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

  // If patientMrn is provided, we find the existing patient
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

  // If neither patientId nor patientMrn is provided, we search by phone + name
  const phoneDigits = normDigits(data.patientPhone)
  const name = String(data.patientName || '').trim()
  if (phoneDigits && name){
    const existing = await LabPatient.findOne({ phoneNormalized: phoneDigits, fullName: name })
    if (existing) return existing
  }

  // DO NOT create a new patient here. Return null if not found.
  return null
}

export async function list(req: Request, res: Response){
  try {
    const parsed = counsellingAppointmentQuerySchema.safeParse(req.query)
    const q = parsed.success ? (parsed.data as any) : ({} as any)
    const from = String(q.from || '').trim()
    const to = String(q.to || '').trim()
    const paymentStatus = String(q.paymentStatus || '').trim()
    const search = String(q.q || '').trim().toLowerCase()

    const filter: any = {}
    if (from || to) {
      filter.appointmentDate = {}
      if (from) filter.appointmentDate.$gte = from
      if (to) filter.appointmentDate.$lte = to
    }
    if (paymentStatus) filter.paymentStatus = paymentStatus

    if (search) {
      filter.$or = [
        { patientName: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') } },
        { patientMrn: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') } },
        { patientPhone: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i') } },
      ]
    }

    const lim = Math.min(500, Number(q.limit || 100))
    const pg = Math.max(1, Number(q.page || 1))
    const skip = (pg - 1) * lim

    const [items, total] = await Promise.all([
      CounsellingAppointment.find(filter)
        .sort({ appointmentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      CounsellingAppointment.countDocuments(filter),
    ])

    const totalPages = Math.max(1, Math.ceil((total || 0) / lim))
    res.json({ items, total, page: pg, totalPages })
  } catch (e){
    return handleError(res, e)
  }
}

export async function getById(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const doc = await CounsellingAppointment.findById(id).lean()
    if (!doc) return res.status(404).json({ error: 'Appointment not found' })
    res.json({ appointment: doc })
  } catch (e){
    return handleError(res, e)
  }
}

export async function create(req: Request, res: Response){
  try {
    const data = counsellingAppointmentCreateSchema.parse(req.body)
    const patient = await resolvePatient(data)

    const paymentStatus = (data as any).paymentStatus || 'paid'
    const paymentMethod = paymentStatus === 'paid' ? (data as any).paymentMethod : undefined
    const accountNumberIban = paymentStatus === 'paid' && String(paymentMethod || '').toLowerCase() === 'card' ? (data as any).accountNumberIban : undefined
    const receivedToAccountCode = paymentStatus === 'paid' ? String((data as any).receivedToAccountCode || '').trim().toUpperCase() || undefined : undefined

    const doc = await CounsellingAppointment.create({
      ...data,
      patientId: patient?._id,
      patientMrn: patient?.mrn,
      patientName: String((patient as any)?.fullName || (data as any).patientName || '').trim(),
      patientPhone: (data as any).patientPhone || (patient as any)?.phoneNormalized,
      patientAge: (data as any).patientAge || (patient as any)?.age,
      patientGender: (data as any).patientGender || (patient as any)?.gender,
      guardianRel: (data as any).guardianRel || (patient as any)?.guardianRel,
      guardianName: (data as any).guardianName || (patient as any)?.fatherName,
      cnic: (data as any).cnic || (patient as any)?.cnicNormalized,
      address: (data as any).address || (patient as any)?.address,
      paymentStatus,
      paymentMethod,
      accountNumberIban,
      receivedToAccountCode,
      patientSnapshot: {
        mrn: patient?.mrn || undefined,
        fullName: String((patient as any)?.fullName || (data as any).patientName || ''),
        phone: (data as any).patientPhone || (patient as any)?.phoneNormalized,
        age: (data as any).patientAge || (patient as any)?.age,
        gender: (data as any).patientGender || (patient as any)?.gender,
        address: (data as any).address || (patient as any)?.address,
        guardianRelation: (data as any).guardianRel || (patient as any)?.guardianRel,
        guardianName: (data as any).guardianName || (patient as any)?.fatherName,
        cnic: (data as any).cnic || (patient as any)?.cnicNormalized,
      },
    })

    res.status(201).json({ appointment: doc })
  } catch (e){
    return handleError(res, e)
  }
}

export async function update(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const data = counsellingAppointmentUpdateSchema.parse(req.body)
    const patch: any = { ...data }

    if (data.patientId || data.patientMrn || data.patientName || data.patientPhone || data.patientAge || data.patientGender || data.guardianRel || data.guardianName || data.cnic || data.address){
      const patient = await resolvePatient(data)
      patch.patientId = patient?._id
      patch.patientMrn = patient?.mrn
      patch.patientName = String((patient as any)?.fullName || data.patientName || '').trim()
      patch.patientPhone = (data as any).patientPhone || (patient as any)?.phoneNormalized
      patch.patientAge = (data as any).patientAge || (patient as any)?.age
      patch.patientGender = (data as any).patientGender || (patient as any)?.gender
      patch.guardianRel = (data as any).guardianRel || (patient as any)?.guardianRel
      patch.guardianName = (data as any).guardianName || (patient as any)?.fatherName
      patch.cnic = (data as any).cnic || (patient as any)?.cnicNormalized
      patch.address = (data as any).address || (patient as any)?.address
      patch.patientSnapshot = {
        mrn: patient?.mrn,
        fullName: String((patient as any)?.fullName || ''),
        phone: patch.patientPhone,
        age: patch.patientAge,
        gender: patch.patientGender,
        address: patch.address,
        guardianRelation: patch.guardianRel,
        guardianName: patch.guardianName,
        cnic: patch.cnic,
      }
    }

    if (patch.paymentStatus){
      const ps = String(patch.paymentStatus)
      if (ps === 'unpaid'){
        patch.paymentMethod = undefined
        patch.accountNumberIban = undefined
        patch.receivedToAccountCode = undefined
      }
    }
    if (patch.receivedToAccountCode != null){
      patch.receivedToAccountCode = String(patch.receivedToAccountCode || '').trim().toUpperCase() || undefined
    }

    const doc = await CounsellingAppointment.findByIdAndUpdate(id, { $set: patch }, { new: true })
    if (!doc) return res.status(404).json({ error: 'Appointment not found' })
    res.json({ appointment: doc })
  } catch (e){
    return handleError(res, e)
  }
}

export async function remove(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const doc = await CounsellingAppointment.findByIdAndDelete(id)
    if (!doc) return res.status(404).json({ error: 'Appointment not found' })
    res.json({ ok: true })
  } catch (e){
    return handleError(res, e)
  }
}
