import { Request, Response } from 'express'
import { HospitalFloor } from '../models/Floor'
import { HospitalRoom } from '../models/Room'
import { HospitalWard } from '../models/Ward'
import { HospitalBed } from '../models/Bed'
import { createBedsSchema, createFloorSchema, createRoomSchema, createWardSchema, updateBedStatusSchema } from '../validators/bed_mgmt'

export async function listFloors(_req: Request, res: Response){
  const rows = await HospitalFloor.find().sort({ name: 1 }).lean()
  res.json({ floors: rows })
}
export async function createFloor(req: Request, res: Response){
  const data = createFloorSchema.parse(req.body)
  const row = await HospitalFloor.create(data)
  res.status(201).json({ floor: row })
}

export async function listRooms(req: Request, res: Response){
  const floorId = String((req.query as any).floorId || '')
  const criteria: any = floorId ? { floorId } : {}
  const rows = await HospitalRoom.find(criteria).sort({ name: 1 }).lean()
  res.json({ rooms: rows })
}
export async function createRoom(req: Request, res: Response){
  const data = createRoomSchema.parse(req.body)
  const row = await HospitalRoom.create(data)
  res.status(201).json({ room: row })
}

export async function listWards(req: Request, res: Response){
  const floorId = String((req.query as any).floorId || '')
  const criteria: any = floorId ? { floorId } : {}
  const rows = await HospitalWard.find(criteria).sort({ name: 1 }).lean()
  res.json({ wards: rows })
}
export async function createWard(req: Request, res: Response){
  const data = createWardSchema.parse(req.body)
  const row = await HospitalWard.create(data)
  res.status(201).json({ ward: row })
}

export async function listBeds(req: Request, res: Response){
  const q = req.query as any
  const criteria: any = {}
  if (q.floorId) criteria.floorId = q.floorId
  if (q.locationType) criteria.locationType = q.locationType
  if (q.locationId) criteria.locationId = q.locationId
  if (q.status) criteria.status = q.status
  const rows = await HospitalBed.find(criteria)
    .sort({ label: 1 })
    .populate({
      path: 'occupiedByEncounterId',
      select: 'patientId status type',
      populate: { path: 'patientId', select: 'fullName mrn' },
    })
    .lean()
  const items = rows.map((b: any) => {
    const enc = b.occupiedByEncounterId
    const p = enc?.patientId
    const statusNormalized = (b.status === 'occupied' && (!enc || enc.status !== 'admitted' || enc.type !== 'IPD')) ? 'available' : b.status
    return {
      ...b,
      status: statusNormalized,
      occupantName: p?.fullName,
      occupantMrn: p?.mrn,
      occupantEncounterId: enc?._id,
    }
  })
  res.json({ beds: items })
}

export async function addBeds(req: Request, res: Response){
  const data = createBedsSchema.parse(req.body)
  const docs = data.labels.map(l => ({
    label: l,
    floorId: data.floorId,
    locationType: data.locationType,
    locationId: data.locationId,
    status: 'available',
    charges: data.charges,
    category: data.category,
  }))
  const inserted = await HospitalBed.insertMany(docs)
  res.status(201).json({ beds: inserted })
}

export async function updateBedStatus(req: Request, res: Response){
  const data = updateBedStatusSchema.parse(req.body)
  const id = req.params.id
  const bed = await HospitalBed.findById(id)
  if (!bed) return res.status(404).json({ error: 'Bed not found' })
  bed.status = data.status
  if (data.status === 'occupied') bed.occupiedByEncounterId = data.encounterId as any
  if (data.status === 'available') bed.occupiedByEncounterId = undefined as any
  await bed.save()
  res.json({ bed })
}
