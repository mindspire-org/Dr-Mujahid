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
      const role = String(payload?.role || '')
      // Allow doctors to view results and orders (read-only access)
      const isReadRoute = (req.path === '/results' || req.path === '/orders') && req.method === 'GET'
      // Allow doctors to search/get patients (read-only access)
      const isPatientRoute = (req.path === '/patients/search' || req.path === '/patients/by-mrn') && req.method === 'GET'
      
      if (role === 'Doctor' && (isReadRoute || isPatientRoute)) {
        ;(req as any).user = payload
        next()
        return
      }
      
      // Check if this is a template route - allow all hospital users for templates
      const path = req.path || ''
      const isTemplateRoute = path.includes('/templates')
      
      if (isTemplateRoute) {
        ;(req as any).user = payload
        next()
        return
      }
      
      // For other lab routes, require lab or therapyLab permissions
      const permissions = (payload?.permissions && typeof payload.permissions === 'object') ? payload.permissions : null
      const labPerm = permissions ? (permissions as any).lab : null
      const therapyLabPerm = permissions ? (permissions as any).therapyLab : null
      const canLab = (Array.isArray(labPerm) && labPerm.length > 0) || (Array.isArray(therapyLabPerm) && therapyLabPerm.length > 0)
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
