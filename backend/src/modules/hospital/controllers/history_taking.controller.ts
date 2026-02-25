import { Request, Response } from 'express'
import { HospitalEncounter } from '../models/Encounter'
import { HospitalHistoryTaking } from '../models/HistoryTaking'
import { HospitalToken } from '../models/Token'
import { upsertHistoryTakingSchema } from '../validators/history_taking'

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

async function getEncounter(encounterId: string){
  const enc = await HospitalEncounter.findById(encounterId)
  if (!enc) throw { status: 404, error: 'Encounter not found' }
  // history taking is OPD workflow, but allow if caller passes any encounter
  return enc
}

export async function getByEncounter(req: Request, res: Response){
  try {
    const { encounterId } = req.params as any
    const enc = await getEncounter(String(encounterId))
    const doc = await HospitalHistoryTaking.findOne({ encounterId: enc._id }).lean()
    res.json({ historyTaking: doc || null })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function upsertByEncounter(req: Request, res: Response){
  try {
    const { encounterId } = req.params as any
    const enc = await getEncounter(String(encounterId))
    const data = upsertHistoryTakingSchema.parse(req.body)

    let tokenId: string | undefined = data.tokenId
    if (!tokenId) {
      const tok = await HospitalToken.findOne({ encounterId: enc._id }).select('_id').lean<{ _id: any }>()
      tokenId = tok?._id != null ? String(tok._id) : undefined
    }

    const set: any = {
      patientId: enc.patientId,
      encounterId: enc._id,
      tokenId: tokenId || undefined,
      hxBy: data.hxBy,
      hxDate: data.hxDate ?? data.data?.hxDate,
      data: data.data,
      submittedAt: new Date(),
      submittedBy: data.submittedBy,
    }

    const doc = await HospitalHistoryTaking.findOneAndUpdate(
      { encounterId: enc._id },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.status(201).json({ historyTaking: doc })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function listByPatient(req: Request, res: Response){
  try {
    const patientId = String((req.query as any)?.patientId || '')
    if (!patientId) return res.status(400).json({ error: 'patientId is required' })

    const limitRaw = (req.query as any)?.limit
    const limitNum = limitRaw != null ? parseInt(String(limitRaw), 10) : 50
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, limitNum)) : 50

    const rows = await HospitalHistoryTaking.find({ patientId })
      .sort({ submittedAt: -1, _id: -1 })
      .limit(limit)
      .lean()

    res.json({ historyTakings: rows || [] })
  } catch (e) {
    return handleError(res, e)
  }
}
