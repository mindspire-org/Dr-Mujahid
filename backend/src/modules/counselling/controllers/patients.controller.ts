import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'
import { LabCounter } from '../../lab/models/Counter'
import { HospitalSettings } from '../../hospital/models/Settings'
import { patientFindOrCreateSchema } from '../validators/patient'

function normDigits(s?: string) {
  return (s || '').replace(/\D+/g, '')
}
function normLower(s?: string) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

async function nextMrn() {
  const key = 'lab_mrn_mr7553'

  // Get settings to check for custom starting number
  const settings = await HospitalSettings.findOne().lean() as any
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

export const searchPatients = async (req: Request, res: Response) => {
  try {
    const phone = normDigits(String((req.query as any).phone || ''))
    const name = normLower(String((req.query as any).name || ''))
    const limit = Math.max(1, Math.min(50, Number((req.query as any).limit || 10)))
    const filter: any = {}
    if (phone) filter.phoneNormalized = new RegExp(phone)
    if (name) filter.fullName = new RegExp(name, 'i')
    if (!phone && !name) return res.json({ patients: [] })
    const patients = await LabPatient.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    res.json({ patients })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const findOrCreatePatient = async (req: Request, res: Response) => {
  try {
    const data = patientFindOrCreateSchema.parse(req.body)
    const phoneN = normDigits(data.phone)
    const nameN = normLower(data.fullName)
    const fatherN = normLower(data.guardianName)

    if (data.selectId) {
      const pat = await LabPatient.findById(data.selectId).lean()
      return res.json({ patient: pat })
    }

    if (phoneN) {
      const existing = await LabPatient.findOne({ phoneNormalized: phoneN, fullName: new RegExp(`^${nameN}$`, 'i') }).lean()
      if (existing) return res.json({ patient: existing })
    }

    if (nameN && fatherN) {
      const rxName = new RegExp(`^${nameN.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
      const rxFath = new RegExp(`^${fatherN.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
      const matches = await LabPatient.find({ fullName: rxName, fatherName: rxFath }).lean()
      if (matches.length === 1) {
        return res.json({ patient: matches[0] })
      }
    }

    const mrn = await nextMrn()
    const patient = await LabPatient.create({
      ...data,
      mrn,
      fatherName: data.guardianName,
      phoneNormalized: phoneN || undefined,
      cnicNormalized: normDigits(data.cnic) || undefined,
      createdAtIso: new Date().toISOString()
    })
    res.json({ patient })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const getPatientByMrn = async (req: Request, res: Response) => {
    try {
        const patient = await LabPatient.findOne({ mrn: req.query.mrn }).lean()
        res.json({ patient })
    } catch (e: any) {
        res.status(500).json({ message: e.message })
    }
}

export const updatePatient = async (req: Request, res: Response) => {
    try {
        const body = req.body || {}
        const patch: any = { ...body }
        if (body.phone) patch.phoneNormalized = normDigits(body.phone)
        if (body.cnic) patch.cnicNormalized = normDigits(body.cnic)
        if (body.guardianName) patch.fatherName = body.guardianName
        
        const patient = await LabPatient.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true }).lean()
        res.json({ patient })
    } catch (e: any) {
        res.status(500).json({ message: e.message })
    }
}
