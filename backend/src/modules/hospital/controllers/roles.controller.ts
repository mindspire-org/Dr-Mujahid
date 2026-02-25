import { Request, Response } from 'express'
import { z } from 'zod'
import { HospitalRole } from '../models/Role'
import { HospitalUser } from '../models/User'
import { loadAccessNodesForPortals, normalizePermissions } from '../services/permissions'

const portalsSchema = z.record(z.string(), z.array(z.string())).optional()

const createSchema = z.object({
  name: z.string().min(1),
  portals: portalsSchema,
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  portals: portalsSchema,
})

function toPlainPortals(v: any): Record<string, string[]> {
  if (!v) return {}
  if (v instanceof Map) return Object.fromEntries(v.entries()) as any
  if (typeof v === 'object') return v as any
  return {}
}

export async function list(req: Request, res: Response) {
  const rows = await HospitalRole.find({}).sort({ name: 1 }).lean()

  const allPortalKeys = Array.from(
    new Set(
      rows
        .flatMap((r: any) => Object.keys(toPlainPortals(r.portals)))
        .map(k => String(k || '').trim())
        .filter(Boolean)
    )
  )
  const nodes = await loadAccessNodesForPortals(allPortalKeys)

  const roles = rows.map((r: any) => {
    const raw = toPlainPortals(r.portals)
    const normalized = normalizePermissions(raw, nodes)
    return {
      id: String(r._id),
      name: String(r.name || ''),
      portals: normalized.permissionKeys,
    }
  })
  res.json({ roles })
}

export async function create(req: Request, res: Response) {
  const data = createSchema.parse(req.body)
  const name = data.name.trim()
  const exists = await HospitalRole.findOne({ name }).lean()
  if (exists) return res.status(409).json({ error: 'Role already exists' })

  const rawPortals = toPlainPortals(data.portals || {})
  const portalKeys = Object.keys(rawPortals)
  const nodes = await loadAccessNodesForPortals(portalKeys)
  const normalized = normalizePermissions(rawPortals, nodes)

  const doc: any = await HospitalRole.create({
    name,
    portals: normalized.permissionKeys,
  })

  res.status(201).json({
    role: {
      id: String(doc._id),
      name: doc.name,
      portals: normalized.permissionKeys,
    },
  })
}

export async function update(req: Request, res: Response) {
  const id = String(req.params.id)
  const data = updateSchema.parse(req.body)

  const existing: any = await HospitalRole.findById(id)
  if (!existing) return res.status(404).json({ error: 'Role not found' })

  const oldName = String(existing.name || '')

  if (data.name != null) {
    const nextName = data.name.trim()
    if (!nextName) return res.status(400).json({ error: 'Role name required' })
    const dup = await HospitalRole.findOne({ name: nextName, _id: { $ne: id } }).lean()
    if (dup) return res.status(409).json({ error: 'Role already exists' })
    existing.name = nextName
  }

  if (data.portals != null) {
    const raw = toPlainPortals(data.portals)
    const nodes = await loadAccessNodesForPortals(Object.keys(raw))
    const normalized = normalizePermissions(raw, nodes)
    existing.portals = normalized.permissionKeys
  }

  await existing.save()

  const newName = String(existing.name || '')
  if (oldName && newName && oldName !== newName) {
    try {
      await HospitalUser.updateMany({ role: oldName }, { $set: { role: newName } })
    } catch {}
  }

  res.json({
    role: {
      id: String(existing._id),
      name: existing.name,
      portals: toPlainPortals(existing.portals),
    },
  })
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id)
  const role: any = await HospitalRole.findById(id).lean()
  if (!role) return res.status(404).json({ error: 'Role not found' })

  const name = String(role.name || '')
  const used = await HospitalUser.countDocuments({ role: name })
  if (used > 0) return res.status(409).json({ error: 'Role is assigned to users' })

  await HospitalRole.findByIdAndDelete(id)
  res.json({ ok: true })
}
