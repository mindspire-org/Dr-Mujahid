import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'

export function diagnosticAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = String(req.headers.authorization || '')
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any
    const scope = String(payload?.scope || '')
    if (scope === 'diagnostic') {
      ;(req as any).user = payload
      next()
      return
    }
    if (scope === 'hospital') {
      const role = String(payload?.role || '')
      // Allow doctors to view results and orders (read-only access)
      const isReadRoute = (req.path === '/results' || req.path === '/orders') && req.method === 'GET'
      if (role === 'Doctor' && isReadRoute) {
        ;(req as any).user = payload
        next()
        return
      }

      const permissions = (payload?.permissions && typeof payload.permissions === 'object') ? payload.permissions : null
      const diagPerm = permissions ? (permissions as any).diagnostic : null
      const canDiag = Array.isArray(diagPerm) && diagPerm.length > 0
      const receptionPerm = permissions ? (permissions as any).reception : null
      const canReception = Array.isArray(receptionPerm) && receptionPerm.length > 0
      if (!canDiag && !canReception && role !== 'Admin' && role !== 'Reception') return res.status(401).json({ message: 'Invalid token' })
      ;(req as any).user = payload
      next()
      return
    }
    return res.status(401).json({ message: 'Invalid token' })
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
