import { Request, Response } from 'express'
import { HospitalDoctorSchedule } from '../models/DoctorSchedule'
import { HospitalDoctor } from '../models/Doctor'
import { HospitalDepartment } from '../models/Department'
import { createDoctorScheduleSchema, updateDoctorScheduleSchema } from '../validators/doctor_schedule'

function toMin(hhmm: string){ const [h,m] = hhmm.split(':').map(x=>parseInt(x,10)||0); return h*60+m }
function fromMin(min: number){ const h = Math.floor(min/60).toString().padStart(2,'0'); const m = (min%60).toString().padStart(2,'0'); return `${h}:${m}` }

export async function create(req: Request, res: Response){
  try{
    const data = createDoctorScheduleSchema.parse(req.body)
    // Validate doctor and department existence
    const doc = await HospitalDoctor.findById(data.doctorId).lean()
    if (!doc) return res.status(400).json({ error: 'Invalid doctorId' })
    if (data.departmentId){
      const dep = await HospitalDepartment.findById(data.departmentId).lean()
      if (!dep) return res.status(400).json({ error: 'Invalid departmentId' })
    }
    // Validate timings
    const start = toMin(data.startTime)
    const end = toMin(data.endTime)
    if (!(start < end)) return res.status(400).json({ error: 'endTime must be after startTime' })
    const row = await HospitalDoctorSchedule.create({ ...data })
    res.status(201).json({ schedule: row })
  }catch(e: any){
    if (e?.code === 11000) return res.status(409).json({ error: 'Overlapping or duplicate schedule' })
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export async function list(req: Request, res: Response){
  try{
    const q = req.query as any
    const crit: any = {}
    if (q.doctorId) crit.doctorId = q.doctorId
    if (q.departmentId) crit.departmentId = q.departmentId
    if (q.date) crit.dateIso = q.date
    const rows = await HospitalDoctorSchedule.find(crit).sort({ dateIso: 1, startTime: 1 }).lean()
    res.json({ schedules: rows })
  }catch{ res.status(500).json({ error: 'Internal Server Error' }) }
}

export async function update(req: Request, res: Response){
  try{
    const id = String(req.params.id)
    const data = updateDoctorScheduleSchema.parse(req.body)
    if (data.startTime && data.endTime){
      const s = toMin(data.startTime), e = toMin(data.endTime)
      if (!(s<e)) return res.status(400).json({ error: 'endTime must be after startTime' })
    }
    const row = await HospitalDoctorSchedule.findByIdAndUpdate(id, { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Schedule not found' })
    res.json({ schedule: row })
  }catch(e: any){
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export async function remove(req: Request, res: Response){
  try{
    const id = String(req.params.id)
    const row = await HospitalDoctorSchedule.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ error: 'Schedule not found' })
    res.json({ ok: true })
  }catch{ res.status(500).json({ error: 'Internal Server Error' }) }
}

export function computeSlotIndex(startTime: string, endTime: string, slotMinutes: number, apptStart: string){
  const start = toMin(startTime), end = toMin(endTime), ap = toMin(apptStart)
  if (ap < start || ap >= end) return null
  const delta = ap - start
  if (delta % slotMinutes !== 0) return null
  return Math.floor(delta / slotMinutes) + 1
}

export function computeSlotStartEnd(startTime: string, slotMinutes: number, slotNo: number){
  const start = toMin(startTime) + (slotNo-1)*slotMinutes
  return { start: fromMin(start), end: fromMin(start + slotMinutes) }
}
