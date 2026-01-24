import { Request, Response } from 'express'
import { HospitalEncounter } from '../models/Encounter'
import { HospitalLabReportsEntry } from '../models/LabReportsEntry'
import { HospitalToken } from '../models/Token'
import { upsertLabReportsEntrySchema } from '../validators/lab_reports_entry'

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

async function getEncounter(encounterId: string){
  const enc = await HospitalEncounter.findById(encounterId)
  if (!enc) throw { status: 404, error: 'Encounter not found' }
  return enc
}

export async function getByEncounter(req: Request, res: Response){
  try {
    const { encounterId } = req.params as any
    const enc = await getEncounter(String(encounterId))
    const doc = await HospitalLabReportsEntry.findOne({ encounterId: enc._id }).lean()
    res.json({ labReportsEntry: doc || null })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function upsertByEncounter(req: Request, res: Response){
  try {
    const { encounterId } = req.params as any
    const enc = await getEncounter(String(encounterId))
    const data = upsertLabReportsEntrySchema.parse(req.body)

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
      hxDate: data.hxDate,
      labInformation: data.labInformation || {},
      semenAnalysis: data.semenAnalysis || {},
      tests: data.tests || [],
      submittedAt: new Date(),
      submittedBy: data.submittedBy,
    }

    const doc = await HospitalLabReportsEntry.findOneAndUpdate(
      { encounterId: enc._id },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.status(201).json({ labReportsEntry: doc })
  } catch (e) {
    return handleError(res, e)
  }
}
