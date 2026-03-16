import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'
import { LabCounter } from '../../lab/models/Counter'
import { HospitalSettings, HospitalSettingsDoc } from '../../hospital/models/Settings'
import { patientFindOrCreateSchema } from '../../lab/validators/patient'

function normDigits(s?: string){ return (s||'').replace(/\D+/g,'') }
function normLower(s?: string){ return (s||'').trim().toLowerCase().replace(/\s+/g,' ') }

async function nextMrn(){
  const key = 'lab_mrn_mr7553'
  
  // Get settings to check for custom starting number
  const settings = await HospitalSettings.findOne().lean() as HospitalSettingsDoc | null
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

export async function getByMrn(req: Request, res: Response){
  const mrn = String((req.query as any).mrn || '').trim()
  if (!mrn) return res.status(400).json({ message: 'Validation failed', issues: [{ path: ['mrn'], message: 'mrn is required' }] })
  const pat = await LabPatient.findOne({ mrn }).lean()
  if (!pat) return res.status(404).json({ error: 'Patient not found' })
  res.json({ patient: pat })
}

export async function search(req: Request, res: Response){
  const phone = normDigits(String((req.query as any).phone || ''))
  const name = normLower(String((req.query as any).name || ''))
  const limit = Math.max(1, Math.min(50, Number((req.query as any).limit || 10)))
  const filter: any = {}
  if (phone) filter.phoneNormalized = new RegExp(phone)
  if (name) filter.fullName = new RegExp(name, 'i')
  if (!phone && !name) return res.json({ patients: [] })
  const pats = await LabPatient.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
  res.json({ patients: pats })
}

export async function update(req: Request, res: Response){
  const { id } = req.params
  const body = (req.body || {}) as any
  const patch: any = {}
  if (typeof body.fullName === 'string') patch.fullName = body.fullName
  if (typeof body.fatherName === 'string') patch.fatherName = body.fatherName
  if (typeof body.gender === 'string') patch.gender = body.gender
  if (typeof body.address === 'string') patch.address = body.address
  if (typeof body.phone === 'string') patch.phoneNormalized = normDigits(body.phone)
  if (typeof body.cnic === 'string') patch.cnicNormalized = normDigits(body.cnic)
  if (typeof body.guardianRel === 'string') patch.guardianRel = body.guardianRel
  const doc = await LabPatient.findByIdAndUpdate(id, { $set: patch }, { new: true })
  if (!doc) return res.status(404).json({ error: 'Patient not found' })
  res.json({ patient: doc })
}

export async function findOrCreate(req: Request, res: Response){
  const data = patientFindOrCreateSchema.parse(req.body)
  const cnicN = normDigits((data as any).cnic)
  const phoneN = normDigits((data as any).phone)
  const nameN = normLower((data as any).fullName)
  const fatherN = normLower((data as any).guardianName)

  if ((data as any).selectId){
    const pat = await LabPatient.findById(String((data as any).selectId)).lean()
    if (!pat) return res.status(404).json({ error: 'Patient not found' })
    return res.json({ patient: pat })
  }

  if (cnicN){
    const pat = await LabPatient.findOne({ cnicNormalized: cnicN }).lean()
    if (pat) return res.json({ patient: pat })
  }

  if (nameN && fatherN){
    const rxName = new RegExp(`^${nameN.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}$`, 'i')
    const rxFath = new RegExp(`^${fatherN.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}$`, 'i')
    const matches = await LabPatient.find({ fullName: rxName, fatherName: rxFath }).lean()
    if (matches.length === 1){
      const m = matches[0] as any
      const patch: any = {}
      if (phoneN && m.phoneNormalized !== phoneN) patch.phoneNormalized = phoneN
      if (cnicN && m.cnicNormalized !== cnicN) patch.cnicNormalized = cnicN
      if (Object.keys(patch).length){
        const upd = await LabPatient.findByIdAndUpdate(m._id, { $set: patch }, { new: true })
        return res.json({ patient: upd || m })
      }
      return res.json({ patient: m })
    } else if (matches.length > 1){
      const brief = matches.map((m:any)=>({ _id: m._id, mrn: m.mrn, fullName: m.fullName, fatherName: m.fatherName, phone: m.phoneNormalized, cnic: m.cnicNormalized }))
      return res.json({ matches: brief, needSelection: true })
    }
  }

  if (phoneN){
    const phoneMatches = await LabPatient.find({ phoneNormalized: phoneN }).lean()
    if (phoneMatches.length === 1){
      const pm = phoneMatches[0] as any
      const pmName = normLower(pm.fullName)
      const pmFather = normLower(pm.fatherName as any)
      const nameMatches = !!nameN && pmName === nameN
      const fatherMatches = !fatherN || pmFather === fatherN
      if (nameMatches && fatherMatches){
        return res.json({ patient: pm })
      }
    } else if (phoneMatches.length > 1){
      const exact = phoneMatches.find((pm:any) => normLower(pm.fullName) === nameN && (!fatherN || normLower(pm.fatherName as any) === fatherN))
      if (exact) return res.json({ patient: exact })
    }
  }

  const mrn = await nextMrn()
  const nowIso = new Date().toISOString()
  const pat = await LabPatient.create({
    mrn,
    fullName: (data as any).fullName,
    fatherName: (data as any).guardianName,
    phoneNormalized: phoneN || undefined,
    cnicNormalized: cnicN || undefined,
    gender: (data as any).gender,
    age: (data as any).age,
    guardianRel: (data as any).guardianRel,
    address: (data as any).address,
    createdAtIso: nowIso,
  })
  res.status(201).json({ patient: pat })
}
