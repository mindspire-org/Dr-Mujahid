import { HospitalAccessNode } from '../models/AccessNode'

export type PermissionsByPortal = Record<string, string[]>

function isPathLike(v: string) {
  return String(v || '').trim().startsWith('/')
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr))
}

type NodeRow = {
  key: string
  portalKey: string
  type: 'module' | 'page'
  label: string
  path?: string
  parentKey?: string
  order?: number
  active?: boolean
}

function buildIndex(nodes: NodeRow[]) {
  const byKey = new Map<string, NodeRow>()
  const byPath = new Map<string, NodeRow>()
  const childrenByParentKey = new Map<string, NodeRow[]>()

  for (const n of nodes) {
    byKey.set(String(n.key), n)
    if (n.path) byPath.set(String(n.path), n)
    const pk = n.parentKey ? String(n.parentKey) : ''
    if (pk) {
      const cur = childrenByParentKey.get(pk) || []
      cur.push(n)
      childrenByParentKey.set(pk, cur)
    }
  }
  return { byKey, byPath, childrenByParentKey }
}

export async function loadAccessNodesForPortals(portalKeys: string[]) {
  const keys = uniq((portalKeys || []).map(k => String(k || '').trim()).filter(Boolean))
  if (keys.length === 0) return [] as NodeRow[]

  const rows = await HospitalAccessNode
    .find({ portalKey: { $in: keys } })
    .sort({ portalKey: 1, order: 1, label: 1 })
    .lean()

  return rows.map((r: any) => ({
    key: String(r.key || ''),
    portalKey: String(r.portalKey || ''),
    type: r.type,
    label: String(r.label || ''),
    path: r.path ? String(r.path) : undefined,
    parentKey: r.parentKey ? String(r.parentKey) : undefined,
    order: Number(r.order || 0),
    active: r.active !== false,
  }))
}

export function normalizePermissions(raw: PermissionsByPortal, nodes: NodeRow[]) {
  const permissionsPaths: PermissionsByPortal = {}
  const permissionKeys: PermissionsByPortal = {}

  const idx = buildIndex(nodes || [])

  for (const portalKey of Object.keys(raw || {})) {
    const arr = Array.isArray(raw[portalKey]) ? raw[portalKey].map(String) : []
    if (arr.length === 0) continue

    if (arr.includes('*')) {
      permissionsPaths[portalKey] = ['*']
      permissionKeys[portalKey] = ['*']
      continue
    }

    const allPaths = arr.every(isPathLike)

    if (allPaths) {
      const paths = uniq(arr.map(s => String(s || '').trim()).filter(Boolean))
      permissionsPaths[portalKey] = paths
      const keys: string[] = []
      for (const p of paths) {
        const n = idx.byPath.get(p)
        if (n?.key) keys.push(String(n.key))
      }
      if (keys.length > 0) permissionKeys[portalKey] = uniq(keys)
      continue
    }

    const expandedKeys: string[] = []
    for (const k of arr.map(s => String(s || '').trim()).filter(Boolean)) {
      const n = idx.byKey.get(k)
      if (n && n.type === 'module') {
        const children = idx.childrenByParentKey.get(k) || []
        for (const c of children) {
          if (c.type === 'page') expandedKeys.push(String(c.key))
        }
        continue
      }
      expandedKeys.push(k)
    }

    permissionKeys[portalKey] = uniq(expandedKeys)

    const paths: string[] = []
    for (const k of permissionKeys[portalKey]) {
      const n = idx.byKey.get(k)
      if (n?.type === 'page' && n?.path) paths.push(String(n.path))
    }

    if (paths.length > 0) permissionsPaths[portalKey] = uniq(paths)
  }

  return { permissionsPaths, permissionKeys }
}
