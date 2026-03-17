import { Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../../../config/env'
import { HospitalUser } from '../models/User'
import { HospitalAuditLog } from '../models/AuditLog'
import { HospitalRole } from '../models/Role'
import { loadAccessNodesForPortals, normalizePermissions } from '../services/permissions'

const createSchema = z.object({
  username: z.string().min(1),
  role: z.string().min(1).default('Staff'),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  portals: z.record(z.array(z.string())).optional(),
  pettyCashAccountCode: z.string().optional(),
  active: z.boolean().optional(),
})

const updateSchema = z.object({
  username: z.string().optional(),
  role: z.string().min(1).optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  portals: z.record(z.array(z.string())).optional(),
  pettyCashAccountCode: z.string().optional(),
  active: z.boolean().optional(),
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().optional(),
})

const resetPasswordSchema = z.object({
  password: z.string().min(1).optional(),
})

function generatePassword(len = 10) {
  const raw = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  return raw.slice(0, Math.max(8, Math.min(24, len)))
}

export async function list(req: Request, res: Response) {
  const rows = await HospitalUser.find({}).sort({ createdAt: -1 }).lean()
  const users = rows.map((u: any) => ({ id: String(u._id), username: u.username, role: u.role, fullName: u.fullName || '', phone: u.phone || '', email: u.email || '', active: !!u.active, pettyCashAccountCode: String(u.pettyCashAccountCode || '') }))
  res.json({ users })
}

export async function getOne(req: Request, res: Response) {
  const id = String(req.params.id)
  const u: any = await HospitalUser.findById(id).lean()
  if (!u) return res.status(404).json({ error: 'User not found' })
  res.json({ user: { id: String(u._id), username: u.username, role: u.role, fullName: u.fullName || '', phone: u.phone || '', email: u.email || '', active: !!u.active, pettyCashAccountCode: String(u.pettyCashAccountCode || ''), portals: (u.portals && typeof u.portals === 'object') ? u.portals : {} } })
}

export async function create(req: Request, res: Response) {
  const data = createSchema.parse(req.body)
  const username = data.username.trim().toLowerCase()
  const existing = await HospitalUser.findOne({ username }).lean()
  if (existing) return res.status(409).json({ error: 'Username already exists' })
  const passwordHash = await bcrypt.hash(data.password || '123', 10)

  let normalizedPortals: any = undefined
  try {
    const raw = (data.portals && typeof data.portals === 'object') ? data.portals : null
    if (raw && Object.keys(raw).length > 0) {
      const nodes = await loadAccessNodesForPortals(Object.keys(raw))
      const normalized = normalizePermissions(raw, nodes)
      normalizedPortals = normalized.permissionKeys
    }
  } catch { }

  const doc: any = await HospitalUser.create({
    username,
    role: data.role,
    fullName: data.fullName,
    phone: data.phone,
    email: data.email,
    active: data.active ?? true,
    passwordHash,
    portals: normalizedPortals,
    pettyCashAccountCode: data.pettyCashAccountCode ? String(data.pettyCashAccountCode).trim().toUpperCase() : undefined,
    phoneNormalized: data.phone ? data.phone.replace(/\D+/g, '') : undefined,
  })
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'user_add',
      label: 'USER_ADD',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `User ${doc.username} (${doc._id}) role ${doc.role}`,
    })
  } catch { }
  res.status(201).json({ user: { id: String(doc._id), username: doc.username, role: doc.role, fullName: doc.fullName || '', phone: doc.phone || '', email: doc.email || '', active: !!doc.active } })
}

export async function update(req: Request, res: Response) {
  const id = String(req.params.id)
  const data = updateSchema.parse(req.body)
  const patch: any = {}
  const touchedSecurityFields: string[] = []
  if (data.username) patch.username = data.username.trim().toLowerCase()
  if (data.role) { patch.role = data.role; touchedSecurityFields.push('role') }
  if (data.fullName != null) patch.fullName = data.fullName
  if (data.phone != null) { patch.phone = data.phone; patch.phoneNormalized = data.phone ? data.phone.replace(/\D+/g, '') : undefined }
  if (data.email != null) patch.email = data.email
  if (data.active != null) { patch.active = data.active; touchedSecurityFields.push('active') }
  if (data.password) { patch.passwordHash = await bcrypt.hash(data.password, 10); touchedSecurityFields.push('password') }
  if (data.portals != null) {
    try {
      const raw = (data.portals && typeof data.portals === 'object') ? data.portals : {}
      const keys = Object.keys(raw)
      if (keys.length > 0) {
        const nodes = await loadAccessNodesForPortals(keys)
        const normalized = normalizePermissions(raw, nodes)
        patch.portals = normalized.permissionKeys
      } else {
        patch.portals = {}
      }
      touchedSecurityFields.push('portals')
    } catch {
      patch.portals = (data.portals && typeof data.portals === 'object') ? data.portals : {}
      touchedSecurityFields.push('portals')
    }
  }
  if (data.pettyCashAccountCode != null) patch.pettyCashAccountCode = data.pettyCashAccountCode ? String(data.pettyCashAccountCode).trim().toUpperCase() : ''

  if (touchedSecurityFields.length > 0) {
    patch.$inc = { tokenVersion: 1 }
  }
  const u: any = await HospitalUser.findByIdAndUpdate(id, patch, { new: true })
  if (!u) return res.status(404).json({ error: 'User not found' })
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'user_edit',
      label: 'USER_EDIT',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `User ${u.username} (${u._id}) updated`,
    })
  } catch { }
  res.json({ user: { id: String(u._id), username: u.username, role: u.role, fullName: u.fullName || '', phone: u.phone || '', email: u.email || '', active: !!u.active } })
}

export async function resetPassword(req: Request, res: Response) {
  const id = String(req.params.id)
  const data = resetPasswordSchema.parse(req.body || {})
  const nextPassword = (data.password && String(data.password).trim()) ? String(data.password).trim() : generatePassword(10)

  const passwordHash = await bcrypt.hash(nextPassword, 10)
  const u: any = await HospitalUser.findByIdAndUpdate(id, { $set: { passwordHash } }, { new: true }).lean()
  if (!u) return res.status(404).json({ error: 'User not found' })

  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'user_password_reset',
      label: 'USER_PASSWORD_RESET',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `Password reset for ${u.username} (${u._id})`,
    })
  } catch { }

  res.json({
    user: { id: String(u._id), username: u.username, role: u.role, fullName: u.fullName || '', phone: u.phone || '', email: u.email || '', active: !!u.active },
    password: nextPassword,
  })
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id)
  const u = await HospitalUser.findByIdAndDelete(id)
  if (!u) return res.status(404).json({ error: 'User not found' })
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'user_delete',
      label: 'USER_DELETE',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `User ${u.username} (${u._id}) deleted`,
    })
  } catch { }
  res.json({ ok: true })
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body)
  const username = data.username.trim().toLowerCase()
  const u: any = await HospitalUser.findOne({ username })
  if (!u || u.active === false) return res.status(401).json({ error: 'Invalid credentials' })
  const pass = data.password || ''
  const stored = String(u.passwordHash || '')
  const isBcrypt = stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')
  const ok = isBcrypt
    ? await bcrypt.compare(pass, stored)
    : ((stored && pass && stored === pass) || (!stored && pass === '123') || (!pass && stored === '123'))
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  if (!isBcrypt) {
    try {
      u.passwordHash = await bcrypt.hash(pass || stored || '123', 10)
      await u.save()
    } catch { }
  }
  try {
    const actor = u.fullName || u.username || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'login',
      label: 'LOGIN',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `User ${u.username} logged in`,
    })
  } catch { }

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
    } catch { }
  }

  // Check if user has permission for the requested portal (if scope/portal is specified)
  const requestedPortal = req.body.portal || 'hospital' // default to hospital for backward compatibility
  if (requestedPortal && requestedPortal !== 'any') {
    const hasPortalAccess = Object.prototype.hasOwnProperty.call(rawPermissions, requestedPortal)
    if (!hasPortalAccess) {
      return res.status(403).json({ error: `You do not have permission to access the ${requestedPortal} portal.` })
    }
  }

  // Normalize permissions against the DB-driven access catalog.
  // During migration:
  // - `permissions` remains route-based so existing frontends keep working.
  // - `permissionKeys` enables fully backend-driven sidebars / editors.
  const portalKeys = Object.keys(rawPermissions || {}).map(k => String(k || '').trim()).filter(Boolean)
  const nodes = await loadAccessNodesForPortals(portalKeys)
  const normalized = normalizePermissions(rawPermissions || {}, nodes)
  const permissions = normalized.permissionsPaths
  const permissionKeys = normalized.permissionKeys

  const tokenVersion = Number((u as any).tokenVersion || 0)
  const token = jwt.sign({ sub: String(u._id), username: u.username, role: roleName, scope: 'hospital', permissions, permissionKeys, tokenVersion }, env.JWT_SECRET, { expiresIn: '1d' })
  res.json({ token, user: { id: String(u._id), username: u.username, role: roleName, permissions, permissionKeys } })
}

export async function logout(req: Request, res: Response) {
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || (req.body?.username) || 'system'
    await HospitalAuditLog.create({
      actor,
      action: 'logout',
      label: 'LOGOUT',
      method: req.method,
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `User logout`,
    })
  } catch { }
  res.json({ ok: true })
}
