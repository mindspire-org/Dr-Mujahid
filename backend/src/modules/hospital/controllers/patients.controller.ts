import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'
import { LabOrder } from '../../lab/models/Order'
import { LabResult } from '../../lab/models/Result'
import { HospitalToken } from '../models/Token'
import { HospitalPrescription } from '../models/Prescription'
import { DiagnosticOrder } from '../../diagnostic/models/Order'
import { DiagnosticResult } from '../../diagnostic/models/Result'

function normalizePhone(p?: string){
  if (!p) return ''
  const digits = String(p).replace(/\D/g, '')
  // normalize to last 10 or 11 digits commonly used
  if (digits.length > 11) return digits.slice(-11)
  return digits
}

export async function search(req: Request, res: Response){
  const q = req.query as any
  const mrn = String(q.mrn || '').trim()
  const name = String(q.name || '').trim()
  const fatherName = String(q.fatherName || '').trim()
  const phone = normalizePhone(String(q.phone || ''))
  const doctorId = String(q.doctorId || '').trim()
  const limit = Math.max(1, Math.min(50, parseInt(String(q.limit || '10')) || 10))

  const criteria: any[] = []
  if (mrn) criteria.push({ mrn: { $regex: new RegExp(mrn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } })
  if (name) criteria.push({ fullName: { $regex: new RegExp(name, 'i') } })
  if (fatherName) criteria.push({ fatherName: { $regex: new RegExp(fatherName, 'i') } })
  if (phone) criteria.push({ phoneNormalized: { $regex: new RegExp(phone + '$') } })

  const filter: any = criteria.length ? { $and: criteria } : {}
  const pats: any[] = await LabPatient.find(filter).limit(limit).lean()

  // Compute visitCount based on Hospital tokens when available
  const tokenCrit: any = { patientId: { $ne: null }, status: { $ne: 'cancelled' } }
  if (doctorId) tokenCrit.doctorId = doctorId

  const countRows = await HospitalToken.aggregate([
    { $match: { ...tokenCrit, patientId: { $in: pats.map(p => p._id) } } },
    { $group: { _id: '$patientId', count: { $sum: 1 } } },
  ])
  const counts = new Map<string, number>(countRows.map((r: any) => [String(r._id), Number(r.count || 0)]))

  const withCounts = pats.map(p => ({ ...p, visitCount: counts.get(String(p._id)) || 0 }))
  res.json({ patients: withCounts })
}

export async function profile(req: Request, res: Response){
  try {
    const mrn = String((req.query as any).mrn || '').trim()
    if (!mrn) return res.status(400).json({ message: 'Validation failed', issues: [{ path: ['mrn'], message: 'mrn is required' }] })

    const patient = await LabPatient.findOne({ mrn }).lean()
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const patientId = String((patient as any)._id || '')

    const presRows: any[] = await HospitalPrescription.find({ patientId: (patient as any)._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({
        path: 'encounterId',
        select: 'doctorId patientId startAt',
        populate: [
          { path: 'doctorId', select: 'name' },
          { path: 'patientId', select: 'fullName mrn' },
        ],
      })
      .lean()
    const pres = presRows.map((p: any) => ({
      id: String(p._id || p.id),
      createdAt: p.createdAt,
      diagnosis: p.diagnosis,
      doctor: p.encounterId?.doctorId?.name || '-',
      items: p.items || [],
    }))

    const labOrders: any[] = await LabOrder.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean()
    const labOrderIds = labOrders.map(o => String(o._id || o.id)).filter(Boolean)
    const labResults: any[] = labOrderIds.length ? await LabResult.find({ orderId: { $in: labOrderIds } }).select('orderId').lean() : []
    const labHas = new Set(labResults.map(r => String(r.orderId)))
    const lab = labOrders
      .filter(o => labHas.has(String(o._id || o.id)))
      .map(o => ({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult: true }))

    const diagOrders: any[] = await DiagnosticOrder.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean()
    const diagOrderIds = diagOrders.map(o => String(o._id || o.id)).filter(Boolean)
    const diagResults: any[] = diagOrderIds.length
      ? await DiagnosticResult.find({ orderId: { $in: diagOrderIds }, status: 'final' }).select('orderId').lean()
      : []
    const diagHas = new Set(diagResults.map(r => String(r.orderId)))
    const diag = diagOrders
      .filter(o => diagHas.has(String(o._id || o.id)))
      .map(o => ({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult: true }))

    res.json({ patient, pres, lab, diag })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load patient profile' })
  }
}
