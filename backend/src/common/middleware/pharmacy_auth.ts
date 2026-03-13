import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'

export function pharmacyAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = String(req.headers.authorization || '')
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any
    const scope = String(payload?.scope || '')
    if (scope === 'pharmacy') {
      ;(req as any).user = payload
      next()
      return
    }
    if (scope === 'hospital') {
      const role = String(payload?.role || '')
      const permissions = (payload?.permissions && typeof payload.permissions === 'object') ? payload.permissions : null
      const pharmacyPerm = permissions ? (permissions as any).pharmacy : null
      const canPharmacy = Array.isArray(pharmacyPerm) && pharmacyPerm.length > 0
      if (!canPharmacy && role !== 'Admin') return res.status(401).json({ message: 'Invalid token' })
      ;(req as any).user = payload
      next()
      return
    }
    return res.status(401).json({ message: 'Invalid token' })
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
