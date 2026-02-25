import { Request, Response } from 'express'
import { z } from 'zod'
import { HospitalAccessNode } from '../models/AccessNode'

const createSchema = z.object({
  key: z.string().min(1),
  portalKey: z.string().min(1),
  type: z.enum(['module', 'page']),
  label: z.string().min(1),
  path: z.string().optional(),
  parentKey: z.string().optional(),
  order: z.number().optional(),
  active: z.boolean().optional(),
})

const updateSchema = z.object({
  key: z.string().min(1).optional(),
  portalKey: z.string().min(1).optional(),
  type: z.enum(['module', 'page']).optional(),
  label: z.string().min(1).optional(),
  path: z.string().optional(),
  parentKey: z.string().optional(),
  order: z.number().optional(),
  active: z.boolean().optional(),
})

export async function list(_req: Request, res: Response) {
  const rows = await HospitalAccessNode.find({}).sort({ portalKey: 1, order: 1, label: 1 }).lean()
  const nodes = rows.map((r: any) => ({
    id: String(r._id),
    key: String(r.key || ''),
    portalKey: String(r.portalKey || ''),
    type: r.type,
    label: String(r.label || ''),
    path: r.path ? String(r.path) : undefined,
    parentKey: r.parentKey ? String(r.parentKey) : undefined,
    order: Number(r.order || 0),
    active: r.active !== false,
  }))
  res.json({ nodes })
}

export async function create(req: Request, res: Response) {
  const data = createSchema.parse(req.body)
  const key = data.key.trim()
  const exists = await HospitalAccessNode.findOne({ key }).lean()
  if (exists) return res.status(409).json({ error: 'Key already exists' })

  if (data.type === 'page') {
    const path = String(data.path || '').trim()
    if (!path) return res.status(400).json({ error: 'Path is required for page nodes' })
  }

  const doc: any = await HospitalAccessNode.create({
    key,
    portalKey: data.portalKey.trim(),
    type: data.type,
    label: data.label.trim(),
    path: data.path ? String(data.path).trim() : undefined,
    parentKey: data.parentKey ? String(data.parentKey).trim() : undefined,
    order: data.order ?? 0,
    active: data.active ?? true,
  })

  res.status(201).json({
    node: {
      id: String(doc._id),
      key: String(doc.key || ''),
      portalKey: String(doc.portalKey || ''),
      type: doc.type,
      label: String(doc.label || ''),
      path: doc.path ? String(doc.path) : undefined,
      parentKey: doc.parentKey ? String(doc.parentKey) : undefined,
      order: Number(doc.order || 0),
      active: doc.active !== false,
    },
  })
}

export async function update(req: Request, res: Response) {
  const id = String(req.params.id)
  const data = updateSchema.parse(req.body)

  const existing: any = await HospitalAccessNode.findById(id)
  if (!existing) return res.status(404).json({ error: 'Node not found' })

  if (data.key != null) {
    const nextKey = data.key.trim()
    if (!nextKey) return res.status(400).json({ error: 'Key is required' })
    const dup = await HospitalAccessNode.findOne({ key: nextKey, _id: { $ne: id } }).lean()
    if (dup) return res.status(409).json({ error: 'Key already exists' })
    existing.key = nextKey
  }

  if (data.portalKey != null) existing.portalKey = data.portalKey.trim()
  if (data.type != null) existing.type = data.type
  if (data.label != null) existing.label = data.label.trim()
  if (data.path !== undefined) existing.path = data.path ? String(data.path).trim() : undefined
  if (data.parentKey !== undefined) existing.parentKey = data.parentKey ? String(data.parentKey).trim() : undefined
  if (data.order != null) existing.order = data.order
  if (data.active != null) existing.active = data.active

  if (String(existing.type) === 'page') {
    const path = String(existing.path || '').trim()
    if (!path) return res.status(400).json({ error: 'Path is required for page nodes' })
  }

  await existing.save()

  res.json({
    node: {
      id: String(existing._id),
      key: String(existing.key || ''),
      portalKey: String(existing.portalKey || ''),
      type: existing.type,
      label: String(existing.label || ''),
      path: existing.path ? String(existing.path) : undefined,
      parentKey: existing.parentKey ? String(existing.parentKey) : undefined,
      order: Number(existing.order || 0),
      active: existing.active !== false,
    },
  })
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id)
  const doc: any = await HospitalAccessNode.findById(id).lean()
  if (!doc) return res.status(404).json({ error: 'Node not found' })

  await HospitalAccessNode.findByIdAndDelete(id)
  res.json({ ok: true })
}

export async function tree(_req: Request, res: Response) {
  const rows = await HospitalAccessNode.find({ active: { $ne: false } }).sort({ portalKey: 1, order: 1, label: 1 }).lean()
  const nodes = rows.map((r: any) => ({
    id: String(r._id),
    key: String(r.key || ''),
    portalKey: String(r.portalKey || ''),
    type: r.type,
    label: String(r.label || ''),
    path: r.path ? String(r.path) : undefined,
    parentKey: r.parentKey ? String(r.parentKey) : undefined,
    order: Number(r.order || 0),
  }))

  const modulesByPortal = new Map<string, any[]>()
  const pagesByPortal = new Map<string, any[]>()
  const moduleIndex = new Map<string, any>()

  for (const n of nodes) {
    if (n.type === 'module') {
      const list = modulesByPortal.get(n.portalKey) || []
      const m = { ...n, pages: [] as any[] }
      list.push(m)
      modulesByPortal.set(n.portalKey, list)
      moduleIndex.set(n.key, m)
      continue
    }

    const list = pagesByPortal.get(n.portalKey) || []
    list.push({ ...n })
    pagesByPortal.set(n.portalKey, list)
  }

  // Attach pages to modules if parentKey matches
  for (const [portalKey, pages] of pagesByPortal.entries()) {
    for (const p of pages) {
      if (p.parentKey && moduleIndex.has(p.parentKey)) {
        moduleIndex.get(p.parentKey).pages.push(p)
      }
    }
    // keep only pages without parentKey in top-level
    pagesByPortal.set(portalKey, pages.filter(p => !p.parentKey))
  }

  const portals = Array.from(new Set(nodes.map(n => n.portalKey))).sort((a, b) => a.localeCompare(b))
  const tree = portals.map(portalKey => ({
    portalKey,
    modules: (modulesByPortal.get(portalKey) || []).sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label)),
    pages: (pagesByPortal.get(portalKey) || []).sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label)),
  }))

  // Sort pages inside modules
  for (const p of tree) {
    for (const m of p.modules) {
      m.pages.sort((a: any, b: any) => (a.order - b.order) || a.label.localeCompare(b.label))
    }
  }

  res.json({ tree })
}
