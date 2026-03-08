import { Request, Response } from 'express'
import { createOpdTokenSchema, payTokenSchema, updateTokenSchema } from '../validators/token'
import { HospitalDepartment } from '../models/Department'
import { HospitalDoctor } from '../models/Doctor'
import { HospitalEncounter } from '../models/Encounter'
import { HospitalToken } from '../models/Token'
import { HospitalCounter } from '../models/Counter'
import { HospitalDoctorSchedule } from '../models/DoctorSchedule'
import { LabPatient } from '../../lab/models/Patient'
import { CorporateCompany } from '../../corporate/models/Company'
import { LabCounter } from '../../lab/models/Counter'
import { HospitalAuditLog } from '../models/AuditLog'
import { postOpdTokenJournal, reverseJournalByRef, reverseOpdTokenAsReturn } from './finance_ledger'
import { resolveOPDPrice } from '../../corporate/utils/price'
import { CorporateTransaction } from '../../corporate/models/Transaction'
import { FinanceJournal } from '../models/FinanceJournal'
import { HospitalAccount } from '../models/HospitalAccount'
import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'

function resolveOPDFee({ department, doctor, visitType }: any){
  const isFollowup = visitType === 'followup'
  // 1) Department-level per-doctor mapping overrides if present
  if (doctor && Array.isArray(department.doctorPrices)){
    const match = department.doctorPrices.find((p: any) => String(p.doctorId) === String(doctor._id))
    if (match && match.price != null) return { fee: match.price, source: 'department-mapping' }
  }
  if (doctor){
    if (isFollowup && doctor.opdFollowupFee != null) return { fee: doctor.opdFollowupFee, source: 'followup-doctor' }
    if (doctor.opdBaseFee != null) return { fee: doctor.opdBaseFee, source: 'doctor' }
  }
  if (isFollowup && department.opdFollowupFee != null) return { fee: department.opdFollowupFee, source: 'followup-department' }
  return { fee: department.opdBaseFee, source: 'department' }
}

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

function resolveCreatedBy(req: Request){
  const direct = (req as any)?.user?.sub
  if (direct) return String(direct)
  try {
    const auth = String(req.headers['authorization']||'')
    const token = auth.startsWith('Bearer ')? auth.slice(7) : ''
    if (!token) return undefined
    const payload: any = jwt.verify(token, env.JWT_SECRET)
    return payload?.sub ? String(payload.sub) : undefined
  } catch { return undefined }
}

async function ensureAccount(patientId: string, snap?: { mrn?: string; fullName?: string; phone?: string }){
  const nowIso = new Date().toISOString()
  const doc = await HospitalAccount.findOneAndUpdate(
    { patientId },
    {
      $setOnInsert: { patientId, dues: 0, advance: 0 },
      $set: {
        mrn: snap?.mrn,
        fullName: snap?.fullName,
        phone: snap?.phone,
        updatedAtIso: nowIso,
      },
    },
    { upsert: true, new: true }
  ).lean()
  return { doc, dues: clamp0((doc as any)?.dues), advance: clamp0((doc as any)?.advance) }
}

async function nextTokenNo(){
  const dateIso = new Date().toISOString().slice(0,10)
  const key = `opd_token_${dateIso}`
  const c = await HospitalCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const seq = String(c.seq || 1).padStart(3,'0')
  return { tokenNo: seq, dateIso }
}

function toMin(hhmm: string){ const [h,m] = (hhmm||'').split(':').map(x=>parseInt(x,10)||0); return h*60+m }
function fromMin(min: number){ const h = Math.floor(min/60).toString().padStart(2,'0'); const m = (min%60).toString().padStart(2,'0'); return `${h}:${m}` }
function computeSlotIndex(startTime: string, endTime: string, slotMinutes: number, apptStart: string){
  const start = toMin(startTime), end = toMin(endTime), ap = toMin(apptStart)
  if (ap < start || ap >= end) return null
  const delta = ap - start
  if (delta % (slotMinutes||15) !== 0) return null
  return Math.floor(delta / (slotMinutes||15)) + 1
}
function computeSlotStartEnd(startTime: string, slotMinutes: number, slotNo: number){
  const start = toMin(startTime) + (slotNo-1)*(slotMinutes||15)
  return { start: fromMin(start), end: fromMin(start + (slotMinutes||15)) }
}

import { HospitalSettings } from '../models/Settings'

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
  // This ensures that updating settings.mrFormat immediately reflects on newly generated MRNs.
  const key = `mrn_counter`
  const existing: any = await LabCounter.findById(key).lean()
  const existingStart = Number(existing?.startSerial || 0)
  const shouldReset = !existing || !existingStart || existingStart !== startSerial

  const update: any = shouldReset
    ? { $set: { startSerial, seq: 1 } }
    : { $inc: { seq: 1 } }

  // Ensure uniqueness even if counter is out-of-sync with existing patients.
  // We'll attempt a few increments until we find a free MRN.
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
  // Fallback: should be extremely rare.
  const c: any = await LabCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const seq = Number(c?.seq || 1)
  return `MR${startSerial + seq - 1}`
}

export async function createOpd(req: Request, res: Response){
  const data = createOpdTokenSchema.parse(req.body)
  const createdBy = resolveCreatedBy(req)
  if ((data as any).corporateId){
    const comp = await CorporateCompany.findById(String((data as any).corporateId)).lean()
    if (!comp) return res.status(400).json({ error: 'Invalid corporateId' })
    if ((comp as any).active === false) return res.status(400).json({ error: 'Corporate company inactive' })
  }

  // Resolve patient
  let patient = null as any
  const normDigits = (s?: string) => (s||'').replace(/\D+/g,'')
  if (data.patientId){
    patient = await LabPatient.findById(data.patientId)
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    // Patch demographics if provided
    const patch: any = {}
    if (data.patientName) patch.fullName = data.patientName
    if (data.guardianName) patch.fatherName = data.guardianName
    if (data.guardianRel) patch.guardianRel = data.guardianRel
    if (data.gender) patch.gender = data.gender
    if (data.address) patch.address = data.address
    if (data.age) patch.age = data.age
    if ((data as any).phone) patch.phoneNormalized = normDigits((data as any).phone)
    if ((data as any).cnic) patch.cnicNormalized = normDigits((data as any).cnic)
    if (Object.keys(patch).length){ patient = await LabPatient.findByIdAndUpdate(data.patientId, { $set: patch }, { new: true }) }
  } else if (data.mrn){
    patient = await LabPatient.findOne({ mrn: data.mrn })
    if (!patient) return res.status(404).json({ error: 'Patient not found' })
    // Patch demographics if provided
    const patch: any = {}
    if (data.patientName) patch.fullName = data.patientName
    if (data.guardianName) patch.fatherName = data.guardianName
    if (data.guardianRel) patch.guardianRel = data.guardianRel
    if (data.gender) patch.gender = data.gender
    if (data.address) patch.address = data.address
    if (data.age) patch.age = data.age
    if ((data as any).phone) patch.phoneNormalized = normDigits((data as any).phone)
    if ((data as any).cnic) patch.cnicNormalized = normDigits((data as any).cnic)
    if (Object.keys(patch).length){ patient = await LabPatient.findByIdAndUpdate(patient._id, { $set: patch }, { new: true }) }
  } else {
    if (!data.patientName) return res.status(400).json({ error: 'patientName or patientId/mrn required' })
    const mrn = await nextMrn()
    patient = await LabPatient.create({
      mrn,
      fullName: data.patientName,
      fatherName: data.guardianName,
      guardianRel: (data as any).guardianRel,
      phoneNormalized: normDigits((data as any).phone) || undefined,
      cnicNormalized: normDigits((data as any).cnic) || undefined,
      gender: (data as any).gender,
      age: (data as any).age,
      address: (data as any).address,
      createdAtIso: new Date().toISOString(),
    })
  }

  // Department & doctor
  const department = await HospitalDepartment.findById(data.departmentId).lean()
  if (!department) return res.status(400).json({ error: 'Invalid departmentId' })
  let doctor: any = null
  if (data.doctorId){
    doctor = await HospitalDoctor.findById(data.doctorId).lean()
    if (!doctor) return res.status(400).json({ error: 'Invalid doctorId' })
  }

  // Price resolution with optional override (may be overridden by schedule later)
  const baseFeeInfo = resolveOPDFee({ department, doctor, visitType: data.visitType })
  const hasOverride = (data as any).overrideFee != null
  const overrideFee = hasOverride ? Number((data as any).overrideFee) : undefined
  let feeSource = baseFeeInfo.source
  let resolvedFee = baseFeeInfo.fee

  // Create OPD Encounter
  const enc = await HospitalEncounter.create({
    patientId: patient._id,
    type: 'OPD',
    status: 'in-progress',
    departmentId: data.departmentId,
    doctorId: data.doctorId,
    corporateId: (data as any).corporateId || undefined,
    corporatePreAuthNo: (data as any).corporatePreAuthNo,
    corporateCoPayPercent: (data as any).corporateCoPayPercent,
    corporateCoverageCap: (data as any).corporateCoverageCap,
    startAt: new Date(),
    visitType: data.visitType,
    consultationFeeResolved: 0, // placeholder, set below once fee finalized
    feeSource: '',
    paymentRef: data.paymentRef,
  })

  // Determine scheduling and token numbering
  let dateIso = new Date().toISOString().slice(0,10)
  let tokenNo = ''
  let scheduleId: any = null
  let slotNo: number | undefined
  let slotStart: string | undefined
  let slotEnd: string | undefined

  if ((data as any).scheduleId){
    const sched: any = await HospitalDoctorSchedule.findById((data as any).scheduleId).lean()
    if (!sched) return res.status(400).json({ error: 'Invalid scheduleId' })
    if (data.doctorId && String(sched.doctorId) !== String(data.doctorId)) return res.status(400).json({ error: 'Schedule does not belong to selected doctor' })
    scheduleId = sched._id
    dateIso = String(sched.dateIso)
    const slotMinutes = Number(sched.slotMinutes || 15)
    const apptStart = (data as any).apptStart as string | undefined
    if (apptStart){
      const idx = computeSlotIndex(sched.startTime, sched.endTime, slotMinutes, apptStart)
      if (!idx) return res.status(400).json({ error: 'apptStart outside schedule or not aligned to slot' })
      // ensure slot free
      const clash = await HospitalToken.findOne({ scheduleId: sched._id, slotNo: idx }).lean()
      if (clash) return res.status(409).json({ error: 'Selected slot already booked' })
      slotNo = idx
      const se = computeSlotStartEnd(sched.startTime, slotMinutes, idx)
      slotStart = se.start
      slotEnd = se.end
    } else {
      // auto assign next free slot
      const totalSlots = Math.floor((toMin(sched.endTime) - toMin(sched.startTime)) / slotMinutes)
      const taken = await HospitalToken.find({ scheduleId: sched._id }).select('slotNo').lean()
      const used = new Set<number>((taken||[]).map((t:any)=> Number(t.slotNo||0)))
      let idx = 0
      for (let i=1;i<=totalSlots;i++){ if (!used.has(i)){ idx = i; break } }
      if (!idx) return res.status(409).json({ error: 'No free slot available in this schedule' })
      slotNo = idx
      const se = computeSlotStartEnd(sched.startTime, slotMinutes, idx)
      slotStart = se.start
      slotEnd = se.end
    }
    // fee from schedule if provided
    // NOTE: schedule fee should not override explicit doctor/department fee configuration.
    // Only use schedule.fee when base fee is missing/zero.
    if (!hasOverride && !(Number.isFinite(resolvedFee) && Number(resolvedFee) > 0)){
      if (data.visitType === 'followup' && (sched as any).followupFee != null){ resolvedFee = Number((sched as any).followupFee); feeSource = 'schedule-followup' }
      else if ((sched as any).fee != null){ resolvedFee = Number((sched as any).fee); feeSource = 'schedule' }
    }
    tokenNo = String(slotNo)
  } else {
    // No schedule provided: fallback to global sequential token
    const next = await nextTokenNo()
    tokenNo = next.tokenNo
    dateIso = next.dateIso
  }

  const finalFee = hasOverride ? Math.max(0, Number(overrideFee)) : Math.max(0, resolvedFee - (data.discount || 0))

  // Dues/Advance accounting (mirrors Diagnostic module)
  const patientIdStr = String((patient as any)?._id || '')
  const acct = await ensureAccount(patientIdStr, { mrn: String((patient as any)?.mrn || ''), fullName: String((patient as any)?.fullName || ''), phone: String((patient as any)?.phoneNormalized || '') })
  const duesBefore = acct.dues
  const advanceBefore = acct.advance

  const paymentStatus = ((data as any).paymentStatus || 'paid') as any
  const payable = clamp0(finalFee)
  const useAdvance = paymentStatus === 'unpaid' ? false : !!(data as any).useAdvance
  const payPreviousDues = paymentStatus === 'unpaid' ? false : !!(data as any).payPreviousDues

  let advanceApplied = 0
  let netDueToday = payable
  let advanceLeft = advanceBefore
  if (useAdvance){
    advanceApplied = Math.min(advanceBefore, netDueToday)
    netDueToday = Math.max(0, netDueToday - advanceApplied)
    advanceLeft = Math.max(0, advanceBefore - advanceApplied)
  }

  const amountReceivedNow = paymentStatus === 'unpaid' ? 0 : clamp0((data as any).amountReceived)
  let amt = amountReceivedNow
  let duesPaid = 0
  let paidForToday = 0
  let advanceAdded = 0
  let duesAfter = duesBefore

  if (payPreviousDues){
    duesPaid = Math.min(duesAfter, amt)
    duesAfter = Math.max(0, duesAfter - duesPaid)
    amt -= duesPaid
  }

  paidForToday = Math.min(netDueToday, amt)
  netDueToday = Math.max(0, netDueToday - paidForToday)
  amt -= paidForToday

  advanceAdded = clamp0(amt)
  duesAfter = duesAfter + netDueToday
  const advanceAfter = advanceLeft + advanceAdded

  // Corporate pricing (does not change patient fee in this phase; only records ledger)
  let corporatePricing: { price: number; appliedRuleId?: string } | null = null
  const corporateId = (data as any).corporateId ? String((data as any).corporateId) : ''
  if (corporateId){
    try {
      const corp = await resolveOPDPrice({ companyId: corporateId, departmentId: String(data.departmentId), doctorId: data.doctorId || undefined, visitType: data.visitType as any, defaultPrice: finalFee })
      corporatePricing = { price: Number(corp.price||0), appliedRuleId: String(corp.appliedRuleId||'') }
    } catch {}
  }

  const tok = await HospitalToken.create({
    dateIso,
    tokenNo,
    patientId: patient._id,
    mrn: patient.mrn,
    patientName: patient.fullName,
    departmentId: data.departmentId,
    doctorId: data.doctorId,
    encounterId: enc._id,
    corporateId: corporateId || undefined,
    amount: hasOverride ? finalFee : resolvedFee,
    fee: finalFee,
    discount: (data as any).discount,
    receptionistName: (data as any).receptionistName,
    paymentMethod: (data as any).paymentMethod,
    paymentRef: (data as any).paymentRef,
    accountNumberIban: (data as any).accountNumberIban,
    receivedToAccountCode: (data as any).receivedToAccountCode,
    paymentStatus,
    duesBefore,
    advanceBefore,
    payPreviousDues,
    useAdvance,
    advanceApplied,
    amountReceived: amountReceivedNow,
    duesPaid,
    paidForToday,
    advanceAdded,
    duesAfter,
    advanceAfter,
    status: 'queued',
    scheduleId,
    slotNo,
    slotStart,
    slotEnd,
  })

  // Update patient account balances
  try {
    await HospitalAccount.findOneAndUpdate(
      { patientId: patientIdStr },
      {
        $setOnInsert: { patientId: patientIdStr },
        $set: {
          mrn: String((patient as any)?.mrn || ''),
          fullName: String((patient as any)?.fullName || ''),
          phone: String((patient as any)?.phoneNormalized || ''),
          dues: duesAfter,
          advance: advanceAfter,
          updatedAtIso: new Date().toISOString(),
        },
      },
      { upsert: true }
    )
  } catch {}

  // Update encounter fee resolution now that finalFee is known
  try { await HospitalEncounter.findByIdAndUpdate(enc._id, { $set: { consultationFeeResolved: finalFee, feeSource } }) } catch {}

  // Finance: post OPD revenue and doctor share accrual
  try {
    const paymentStatus = ((data as any).paymentStatus || 'paid') as any
    const pm = String((data as any).paymentMethod || '')
    const paidMethod = paymentStatus === 'unpaid'
      ? 'AR'
      : (pm === 'Card' ? 'Bank' : 'Cash')
    await postOpdTokenJournal({
      tokenId: String((tok as any)._id),
      dateIso,
      fee: finalFee,
      doctorId: data.doctorId,
      departmentId: data.departmentId,
      patientId: String((patient as any)?._id || ''),
      patientName: String((patient as any)?.fullName || ''),
      mrn: String((patient as any)?.mrn || ''),
      tokenNo,
      paidMethod: paidMethod as any,
      receivedToAccountCode: (data as any).receivedToAccountCode,
      createdBy,
    })
  } catch (e) {
    // do not fail token creation if finance posting has an error
    console.warn('Finance posting failed for OPD token', e)
  }

  // Audit: token_generate
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'token_generate',
      label: 'TOKEN_GENERATE',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `Token #${tokenNo} — MRN ${patient.mrn} — Dept ${(department as any)?.name || data.departmentId} — Doctor ${doctor?.name || 'N/A'} — Fee ${finalFee}`,
    })
  } catch {}

  // Corporate: create transaction ledger line (OPD)
  if (corporateId && corporatePricing){
    try {
      const baseCorp = Number(corporatePricing.price||0)
      const encDoc: any = enc
      const coPayPct = Math.max(0, Math.min(100, Number(encDoc?.corporateCoPayPercent || (data as any)?.corporateCoPayPercent || 0)))
      const coPayAmt = Math.max(0, baseCorp * (coPayPct/100))
      let net = Math.max(0, baseCorp - coPayAmt)
      const cap = Number(encDoc?.corporateCoverageCap || (data as any)?.corporateCoverageCap || 0) || 0
      if (cap > 0){
        try {
          const existing = await CorporateTransaction.find({ encounterId: enc._id }).select('netToCorporate').lean()
          const used = (existing || []).reduce((s: number, t: any)=> s + Number(t?.netToCorporate||0), 0)
          const remaining = Math.max(0, cap - used)
          net = Math.max(0, Math.min(net, remaining))
        } catch {}
      }
      await CorporateTransaction.create({
        companyId: corporateId,
        patientMrn: String((patient as any)?.mrn || ''),
        patientName: String((patient as any)?.fullName || ''),
        serviceType: 'OPD',
        refType: 'opd_token',
        refId: String((tok as any)?._id || ''),
        encounterId: enc._id as any,
        dateIso,
        departmentId: String(data.departmentId),
        doctorId: data.doctorId ? String(data.doctorId) : undefined,
        description: 'OPD Consultation',
        qty: 1,
        unitPrice: Number(finalFee||0),
        corpUnitPrice: baseCorp,
        coPay: coPayAmt,
        netToCorporate: net,
        corpRuleId: corporatePricing.appliedRuleId || '',
        status: 'accrued',
      })
    } catch (e) {
      console.warn('Failed to create corporate transaction for OPD token', e)
    }
  }

  res.status(201).json({ token: tok, encounter: enc, pricing: { feeResolved: hasOverride ? finalFee : resolvedFee, discount: data.discount || 0, finalFee, feeSource: hasOverride ? 'override' : feeSource }, corporate: corporatePricing || undefined })
}

export async function list(req: Request, res: Response){
  const q = req.query as any
  const date = q.date ? String(q.date) : ''
  const from = q.from ? String(q.from) : ''
  const to = q.to ? String(q.to) : ''
  const status = q.status ? String(q.status) : ''
  const doctorId = q.doctorId ? String(q.doctorId) : ''
  const scheduleId = q.scheduleId ? String(q.scheduleId) : ''
  const departmentId = q.departmentId ? String(q.departmentId) : ''
  const crit: any = {}
  if (date) {
    crit.dateIso = date
  } else if (from || to) {
    crit.dateIso = {}
    if (from) crit.dateIso.$gte = from
    if (to) crit.dateIso.$lte = to
  }
  if (status) crit.status = status
  if (doctorId) crit.doctorId = doctorId
  if (departmentId) crit.departmentId = departmentId
  if (scheduleId) crit.scheduleId = scheduleId
  const rows = await HospitalToken.find(crit)
    .sort({ createdAt: 1 })
    .populate('doctorId', 'name')
    .populate('departmentId', 'name')
    .populate('patientId', 'mrn fullName fatherName gender age guardianRel phoneNormalized cnicNormalized address')
    .lean()
  res.json({ tokens: rows })
}

export async function update(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'Invalid token id' })

    const data = updateTokenSchema.parse(req.body)
    const tok: any = await HospitalToken.findById(id)
    if (!tok) return res.status(404).json({ error: 'Token not found' })

    // Update patient demographics (if token has a linked patient)
    try {
      if (tok.patientId){
        const normDigits = (s?: string) => (s||'').replace(/\D+/g,'')
        const patch: any = {}
        if (data.patientName != null) patch.fullName = data.patientName
        if (data.guardianName != null) patch.fatherName = data.guardianName
        if (data.guardianRel != null) patch.guardianRel = data.guardianRel
        if (data.gender != null) patch.gender = data.gender
        if (data.address != null) patch.address = data.address
        if (data.age != null) patch.age = data.age
        if (data.phone != null) patch.phoneNormalized = normDigits(data.phone)
        if (data.cnic != null) patch.cnicNormalized = normDigits(data.cnic)
        if (Object.keys(patch).length){
          await LabPatient.findByIdAndUpdate(tok.patientId, { $set: patch })
        }
      }
    } catch {}

    // Fee math
    const prevAmount = Number(tok.amount ?? (Number(tok.fee||0) + Number(tok.discount||0)))
    const prevDiscount = Number(tok.discount || 0)
    const nextAmount = data.amount != null ? Number(data.amount) : prevAmount
    const nextDiscount = data.discount != null ? Number(data.discount) : prevDiscount
    const nextFee = Math.max(0, nextAmount - nextDiscount)

    const set: any = {}
    if (data.patientName != null) set.patientName = data.patientName
    if (data.departmentId != null) set.departmentId = data.departmentId
    if (data.doctorId != null) set.doctorId = data.doctorId

    if (data.amount != null || data.discount != null){
      set.amount = nextAmount
      set.discount = nextDiscount
      set.fee = nextFee
    }

    if (data.paymentStatus != null) set.paymentStatus = data.paymentStatus
    if (data.receptionistName != null) set.receptionistName = data.receptionistName
    if (data.paymentMethod != null) set.paymentMethod = data.paymentMethod
    if (data.accountNumberIban != null) set.accountNumberIban = data.accountNumberIban

    const updated = await HospitalToken.findByIdAndUpdate(id, { $set: set }, { new: true })

    // Keep encounter aligned (best-effort)
    try {
      const encSet: any = {}
      if (data.departmentId != null) encSet.departmentId = data.departmentId
      if (data.doctorId != null) encSet.doctorId = data.doctorId
      if (data.amount != null || data.discount != null) encSet.consultationFeeResolved = nextFee
      if (Object.keys(encSet).length && tok.encounterId) await HospitalEncounter.findByIdAndUpdate(tok.encounterId, { $set: encSet })
    } catch {}

    try {
      const actor = (req as any).user?.name || (req as any).user?.email || 'system'
      await HospitalAuditLog.create({
        actor,
        action: 'token_edit',
        label: 'TOKEN_EDIT',
        method: req.method,
        path: req.originalUrl,
        at: new Date().toISOString(),
        detail: `Token #${String(updated?.tokenNo || id)} — Updated`,
      })
    } catch {}

    res.json({ token: updated })
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export async function updateStatus(req: Request, res: Response){
  const id = req.params.id
  const status = String((req.body as any).status || '')
  if (!['queued','in-progress','completed','returned','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const set: any = { status }
  if (status === 'returned') {
    const rr = String((req.body as any).returnReason || '').trim()
    if (rr) set.returnReason = rr
  }
  const tok = await HospitalToken.findByIdAndUpdate(id, { $set: set }, { new: true })
  if (!tok) return res.status(404).json({ error: 'Token not found' })
  // Finance: reverse accruals if token is returned or cancelled
  if (status === 'returned' || status === 'cancelled'){
    try {
      if (status === 'returned') {
        const reason = String((req.body as any)?.returnReason || '').trim()
        await reverseOpdTokenAsReturn(String(id), resolveCreatedBy(req), reason ? `OPD Return #${String((tok as any).tokenNo || '')} — ${reason}` : `OPD Return #${String((tok as any).tokenNo || '')}`)
      } else {
        await reverseJournalByRef('opd_token', String(id), `Auto reversal for token ${status}`)
      }
    } catch (e) { console.warn('Finance reversal failed', e) }
    // Corporate: create reversal lines for OPD corporate transactions
    try {
      const existing: any[] = await CorporateTransaction.find({ refType: 'opd_token', refId: String(id), status: { $ne: 'reversed' } }).lean()
      for (const tx of existing){
        // Mark original as reversed
        try { await CorporateTransaction.findByIdAndUpdate(String(tx._id), { $set: { status: 'reversed' } }) } catch {}
        // Create negative reversal (accrued) for next claim cycle
        try {
          await CorporateTransaction.create({
            companyId: tx.companyId,
            patientMrn: tx.patientMrn,
            patientName: tx.patientName,
            serviceType: tx.serviceType,
            refType: tx.refType,
            refId: tx.refId,
            encounterId: (tok as any)?.encounterId || undefined,
            dateIso: (tok as any)?.dateIso || new Date().toISOString().slice(0,10),
            departmentId: tx.departmentId,
            doctorId: tx.doctorId,
            description: `Reversal: ${tx.description || 'OPD Consultation'}`,
            qty: tx.qty,
            unitPrice: -Math.abs(Number(tx.unitPrice||0)),
            corpUnitPrice: -Math.abs(Number(tx.corpUnitPrice||0)),
            coPay: -Math.abs(Number(tx.coPay||0)),
            netToCorporate: -Math.abs(Number(tx.netToCorporate||0)),
            corpRuleId: tx.corpRuleId,
            status: 'accrued',
            reversalOf: String(tx._id),
          })
        } catch (e) { console.warn('Failed to create corporate reversal for OPD token', e) }
      }
    } catch (e) { console.warn('Corporate reversal lookup failed', e) }
  }
  // Audit: status change mapping
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    const mapping: any = {
      returned: { action: 'token_return', label: 'TOKEN_RETURN' },
      cancelled: { action: 'token_delete', label: 'TOKEN_DELETE' },
    }
    const meta = mapping[status] || { action: 'token_status_update', label: 'TOKEN_STATUS' }
    const reason = status === 'returned' ? String((tok as any).returnReason || '') : ''
    await HospitalAuditLog.create({
      actor,
      action: meta.action,
      label: meta.label,
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `Token #${(tok as any).tokenNo || id} — Status ${status}${reason ? ` — Reason: ${reason}` : ''}`,
    })
  } catch {}
  res.json({ token: tok })
}

export async function remove(req: Request, res: Response){
  try {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'Invalid token id' })

    const tok: any = await HospitalToken.findById(id)
    if (!tok) return res.status(404).json({ error: 'Token not found' })

    try { await reverseJournalByRef('opd_token', String(id), 'Permanent delete of token') } catch (e) { console.warn('Finance reversal failed', e) }
    try {
      const existing: any[] = await CorporateTransaction.find({ refType: 'opd_token', refId: String(id), status: { $ne: 'reversed' } }).lean()
      for (const tx of existing){
        try { await CorporateTransaction.findByIdAndUpdate(String(tx._id), { $set: { status: 'reversed' } }) } catch {}
        try {
          await CorporateTransaction.create({
            companyId: tx.companyId,
            patientMrn: tx.patientMrn,
            patientName: tx.patientName,
            serviceType: tx.serviceType,
            refType: tx.refType,
            refId: tx.refId,
            encounterId: tok?.encounterId || undefined,
            dateIso: tok?.dateIso || new Date().toISOString().slice(0,10),
            departmentId: tx.departmentId,
            doctorId: tx.doctorId,
            description: `Reversal: ${tx.description || 'OPD Consultation'}`,
            qty: tx.qty,
            unitPrice: -Math.abs(Number(tx.unitPrice||0)),
            corpUnitPrice: -Math.abs(Number(tx.corpUnitPrice||0)),
            coPay: -Math.abs(Number(tx.coPay||0)),
            netToCorporate: -Math.abs(Number(tx.netToCorporate||0)),
            corpRuleId: tx.corpRuleId,
            status: 'accrued',
            reversalOf: String(tx._id),
          })
        } catch (e) { console.warn('Failed to create corporate reversal for OPD token', e) }
      }
    } catch (e) { console.warn('Corporate reversal lookup failed', e) }

    try {
      const actor = (req as any).user?.name || (req as any).user?.email || 'system'
      await HospitalAuditLog.create({
        actor,
        action: 'token_delete',
        label: 'TOKEN_DELETE',
        method: req.method,
        path: req.originalUrl,
        at: new Date().toISOString(),
        detail: `Token #${String(tok?.tokenNo || id)} — Permanently deleted`,
      })
    } catch {}

    await HospitalToken.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export async function pay(req: Request, res: Response){
  try {
    const id = String(req.params.id)
    const data = payTokenSchema.parse(req.body)

    const before: any = await HospitalToken.findById(id).lean()
    if (!before) return res.status(404).json({ error: 'Token not found' })

    const set: any = {
      paymentStatus: 'paid',
      paymentMethod: data.paymentMethod,
    }
    if (data.receptionistName) set.receptionistName = data.receptionistName
    if (data.paymentMethod === 'Card') set.accountNumberIban = data.accountNumberIban || ''
    else set.accountNumberIban = ''

    if ((data as any).receivedToAccountCode != null) {
      set.receivedToAccountCode = String((data as any).receivedToAccountCode || '').trim().toUpperCase()
    }

    const tok = await HospitalToken.findByIdAndUpdate(id, { $set: set }, { new: true })
    if (!tok) return res.status(404).json({ error: 'Token not found' })

    // If token was unpaid, it already added fee into dues at creation time.
    // On paying, reduce dues and store a payment breakdown snapshot (best-effort).
    try {
      const wasUnpaid = String(before?.paymentStatus || '').toLowerCase() === 'unpaid'
      if (wasUnpaid) {
        const patientId = String((before as any)?.patientId || '')
        const fee = clamp0((before as any)?.fee)
        if (patientId && fee > 0) {
          const acct = await ensureAccount(patientId)
          const duesBefore = acct.dues
          const advanceBefore = acct.advance
          const duesPaid = Math.min(duesBefore, fee)
          const duesAfter = Math.max(0, duesBefore - duesPaid)
          const advAdded = Math.max(0, fee - duesPaid)
          const advAfter = Math.max(0, advanceBefore + advAdded)

          await HospitalAccount.findOneAndUpdate(
            { patientId },
            { $set: { dues: duesAfter, advance: advAfter, updatedAtIso: new Date().toISOString() } },
            { upsert: true }
          )

          await HospitalToken.findByIdAndUpdate(id, {
            $set: {
              duesBefore,
              advanceBefore,
              payPreviousDues: true,
              useAdvance: false,
              advanceApplied: 0,
              amountReceived: fee,
              duesPaid,
              paidForToday: 0,
              advanceAdded: advAdded,
              duesAfter,
              advanceAfter: advAfter,
            },
          })
        }
      }
    } catch {}

    // Finance: if token was previously unpaid (AR) and is now being paid, move balance from AR to selected received account.
    try {
      const wasUnpaid = String(before?.paymentStatus || '').toLowerCase() === 'unpaid'
      if (wasUnpaid) {
        const existing = await FinanceJournal.findOne({ refType: 'opd_token_payment', refId: String((tok as any)._id) }).lean()
        if (!existing) {
          const receivedTo = String((tok as any).receivedToAccountCode || (data as any).receivedToAccountCode || '').trim().toUpperCase()
          const settlementAccount = receivedTo || ((data.paymentMethod === 'Card') ? 'BANK' : 'CASH')
          const amt = Number((tok as any).fee || 0)
          if (settlementAccount && amt > 0) {
            await FinanceJournal.create({
              dateIso: new Date().toISOString().slice(0,10),
              createdBy: resolveCreatedBy(req),
              refType: 'opd_token_payment',
              refId: String((tok as any)._id),
              memo: `OPD Token Payment #${String((tok as any).tokenNo || '')}`.trim(),
              lines: [
                { account: settlementAccount, debit: amt, tags: { tokenId: tok._id, patientId: tok.patientId, patientName: tok.patientName, mrn: tok.mrn, paymentMethod: data.paymentMethod } },
                { account: 'AR', credit: amt, tags: { tokenId: tok._id, patientId: tok.patientId } },
              ],
            })
          }
        }
      }
    } catch (e) {
      console.warn('Finance settlement failed for token pay', e)
    }

    try {
      const actor = (req as any).user?.name || (req as any).user?.email || 'system'
      await HospitalAuditLog.create({
        actor,
        action: 'token_payment_paid',
        label: 'TOKEN_PAYMENT_PAID',
        method: req.method,
        path: req.originalUrl,
        at: new Date().toISOString(),
        detail: `Token #${(tok as any).tokenNo || id} — PaymentStatus paid — Method ${data.paymentMethod}`,
      })
    } catch {}

    res.json({ token: tok })
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
