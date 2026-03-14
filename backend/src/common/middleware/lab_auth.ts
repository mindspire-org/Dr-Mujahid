import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'

export function labAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = String(req.headers.authorization || '')
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any
    const scope = String(payload?.scope || '')
    if (scope === 'lab') {
      ;(req as any).user = payload
      next()
      return
    }
    if (scope === 'hospital') {
      // Check if this is a template route - allow all hospital users for templates
      const path = req.path || ''
      const isTemplateRoute = path.includes('/templates')
      
      if (isTemplateRoute) {
        ;(req as any).user = payload
        next()
        return
      }
      
      // For other lab routes, require lab permissions
      const role = String(payload?.role || '')
      const permissions = (payload?.permissions && typeof payload.permissions === 'object') ? payload.permissions : null
      const labPerm = permissions ? (permissions as any).lab : null
      const canLab = Array.isArray(labPerm) && labPerm.length > 0
      if (!canLab && role !== 'Admin') return res.status(401).json({ message: 'Invalid token' })
      ;(req as any).user = payload
      next()
      return
    }

    return res.status(401).json({ message: 'Invalid token' })
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
