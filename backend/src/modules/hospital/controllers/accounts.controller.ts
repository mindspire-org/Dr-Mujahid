import { Request, Response } from 'express'
import { HospitalAccount } from '../models/HospitalAccount'
import { LabPatient } from '../../lab/models/Patient'

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

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

export async function get(req: Request, res: Response){
  try {
    const patientId = String(req.params.patientId || '').trim()
    if (!patientId) return res.status(400).json({ error: 'patientId is required' })

    const p: any = await LabPatient.findById(patientId).lean()
    if (!p) return res.status(404).json({ error: 'Patient not found' })

    const acct = await ensureAccount(patientId, { mrn: p?.mrn, fullName: p?.fullName, phone: p?.phoneNormalized || p?.phone })
    return res.json({ account: { dues: acct.dues, advance: acct.advance } })
  } catch {
    return res.json({ account: { dues: 0, advance: 0 } })
  }
}
