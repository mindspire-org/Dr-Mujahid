import { Request, Response } from 'express'
import { z } from 'zod'
import { LabTemplate } from '../models/LabTemplate'

const createTemplateSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  name: z.string().min(1, 'Template name is required'),
  tests: z.array(z.string()).default([]),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').optional(),
  tests: z.array(z.string()).optional(),
})

function handleError(res: Response, e: any) {
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.code === 11000) return res.status(409).json({ error: 'Template with this name already exists for this doctor' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

export async function list(req: Request, res: Response) {
  try {
    const { doctorId } = req.query as any
    if (!doctorId) return res.status(400).json({ error: 'doctorId query parameter is required' })

    const templates = await LabTemplate.find({ doctorId: String(doctorId) })
      .sort({ createdAt: -1 })
      .lean()

    res.json({ templates })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const data = createTemplateSchema.parse(req.body)
    const template = await LabTemplate.create({
      doctorId: data.doctorId,
      name: data.name,
      tests: data.tests,
    })
    res.status(201).json({ template: template.toObject() })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const { id } = req.params as any
    const template = await LabTemplate.findById(String(id)).lean()
    if (!template) return res.status(404).json({ error: 'Template not found' })
    res.json({ template })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { id } = req.params as any
    const data = updateTemplateSchema.parse(req.body)

    const set: any = {}
    if (data.name !== undefined) set.name = data.name
    if (data.tests !== undefined) set.tests = data.tests

    const template = await LabTemplate.findByIdAndUpdate(
      String(id),
      { $set: set },
      { new: true }
    ).lean()

    if (!template) return res.status(404).json({ error: 'Template not found' })
    res.json({ template })
  } catch (e) {
    return handleError(res, e)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const { id } = req.params as any
    const template = await LabTemplate.findByIdAndDelete(String(id))
    if (!template) return res.status(404).json({ error: 'Template not found' })
    res.json({ ok: true })
  } catch (e) {
    return handleError(res, e)
  }
}
