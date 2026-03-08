import { Request, Response } from 'express'
import { HospitalAppointment } from '../models/Appointment'
import { createAppointmentSchema, updateAppointmentSchema } from '../validators/appointment'
import { LabPatient } from '../../lab/models/Patient'
import { LabCounter } from '../../lab/models/Counter'
import { HospitalSettings } from '../models/Settings'
import { HospitalEncounter } from '../models/Encounter'
import { HospitalPrescription } from '../models/Prescription'

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

function normDigits(s?: string){
  return (s || '').replace(/\D+/g, '')
}

async function nextMrn(): Promise<string> {
  // Get MR Number Format from settings (e.g., "7732")
  let startSerial = 7732
  try {
    const settings: any = await HospitalSettings.findOne().lean()
    const format = String(settings?.mrFormat || '').trim()
    if (format) {
      const parsed = parseInt(format, 10)
      if (!isNaN(parsed) && parsed > 0) startSerial = parsed
    }
  } catch { /* fallback to default */ }

  // Use a stable counter key and reset sequence when startSerial changes.
  const key = `mrn_counter`
  const existing: any = await LabCounter.findById(key).lean()
  const existingStart = Number(existing?.startSerial || 0)
  const shouldReset = !existing || !existingStart || existingStart !== startSerial

  const update: any = shouldReset
    ? { $set: { startSerial, seq: 1 } }
    : { $inc: { seq: 1 } }

  // Ensure uniqueness even if counter is out-of-sync with existing patients.
  for (let attempts = 0; attempts < 50; attempts++) {
    const c: any = await LabCounter.findByIdAndUpdate(
      key,
      attempts === 0 ? update : { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    const seq = Number(c?.seq || 1)
    const mrNumber = startSerial + seq - 1
    const candidate = `MR${mrNumber}`
    const exists = await LabPatient.exists({ mrn: candidate })
    if (!exists) return candidate
  }
  // Fallback
  const c: any = await LabCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const seq = Number(c?.seq || 1)
  return `MR${startSerial + seq - 1}`
}

async function resolvePatient(data: any){
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
    const encounterId = String(q.encounterId || '').trim()
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
    if (encounterId) filter.encounterId = encounterId

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
        { path: 'patientId', select: 'fullName mrn' },
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
    const patient = await resolvePatient(data)
    const doc = await HospitalAppointment.create({
      ...data,
      patientId: patient?._id,
      patientMrn: patient?.mrn,
      patientName: String((patient as any)?.fullName || data.patientName || '').trim(),
      patientPhone: data.patientPhone || (patient as any)?.phoneNormalized,
      patientAge: data.patientAge || (patient as any)?.age,
      patientGender: data.patientGender || (patient as any)?.gender,
      guardianRel: data.guardianRel || (patient as any)?.guardianRel,
      guardianName: data.guardianName || (patient as any)?.fatherName,
      cnic: data.cnic || (patient as any)?.cnicNormalized,
      address: data.address || (patient as any)?.address,
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

// Create an encounter for an appointment (used by counselling portal)
export async function createEncounter(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    const appointment = await HospitalAppointment.findById(id).populate('patientId', 'fullName mrn').populate('doctorId', 'name').lean() as any
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' })

    console.log('Creating encounter for appointment:', appointment)

    // If encounter already exists, return it with prescription
    if (appointment.encounterId) {
      const existing: any = await HospitalEncounter.findById(appointment.encounterId).lean()
      if (existing) {
        // Check if prescription exists, if not create one
        let prescription: any = await HospitalPrescription.findOne({ encounterId: existing._id }).lean()
        if (!prescription) {
          prescription = await HospitalPrescription.create({
            patientId: existing.patientId,
            encounterId: existing._id,
          })
        }
        return res.json({ encounter: existing, appointment, prescription })
      }
    }

    // Check if patientId exists
    if (!appointment.patientId) {
      return res.status(400).json({ error: 'Appointment has no patient linked' })
    }

    // Create new encounter
    const encounter = await HospitalEncounter.create({
      patientId: appointment.patientId?._id || appointment.patientId,
      doctorId: appointment.doctorId?._id || appointment.doctorId,
      departmentId: appointment.departmentId?._id || appointment.departmentId,
      type: 'OPD',
      status: 'Active',
      startAt: new Date().toISOString(),
    })

    console.log('Created encounter:', encounter)

    // Create prescription for this encounter
    const prescription = await HospitalPrescription.create({
      patientId: encounter.patientId,
      encounterId: encounter._id,
    })

    console.log('Created prescription:', prescription)

    // Update appointment with encounterId
    await HospitalAppointment.findByIdAndUpdate(id, { encounterId: encounter._id })

    // Populate and return
    const populatedEncounter = await HospitalEncounter.findById(encounter._id)
      .populate('patientId', 'fullName mrn')
      .populate('doctorId', 'name')
      .lean()

    res.json({ encounter: populatedEncounter, appointment: { ...appointment, encounterId: encounter._id }, prescription })
  } catch (e) {
    console.error('Error creating encounter:', e)
    return handleError(res, e)
  }
}
