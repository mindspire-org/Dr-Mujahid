import { Request, Response } from 'express'
import { HospitalUser } from '../models/User'
import { HospitalRole } from '../models/Role'
import { loadAccessNodesForPortals, normalizePermissions } from '../services/permissions'

export async function me(req: Request, res: Response) {
  const payload: any = (req as any).user
  const scope = String(payload?.scope || '')
  if (scope !== 'hospital') return res.status(401).json({ error: 'Unauthorized' })

  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const roleName = String(u.role || '')

  let rawPermissions: any = {}
  const userPortals = (u?.portals && typeof u.portals === 'object') ? u.portals : null
  const hasUserOverride = userPortals && Object.keys(userPortals).length > 0
  if (hasUserOverride) {
    rawPermissions = userPortals
  } else {
    try {
      const r: any = await HospitalRole.findOne({ name: roleName }).lean()
      rawPermissions = (r?.portals && typeof r.portals === 'object') ? r.portals : {}
    } catch {
      rawPermissions = {}
    }
  }

  const portalKeys = Object.keys(rawPermissions || {}).map(k => String(k || '').trim()).filter(Boolean)
  const nodes = await loadAccessNodesForPortals(portalKeys)
  const normalized = normalizePermissions(rawPermissions || {}, nodes)

  res.json({
    user: {
      id: String(u._id),
      username: String(u.username || ''),
      role: roleName,
      pettyCashAccountCode: String(u.pettyCashAccountCode || ''),
      permissions: normalized.permissionsPaths,
      permissionKeys: normalized.permissionKeys,
    },
    access: {
      nodes,
    },
  })
}
