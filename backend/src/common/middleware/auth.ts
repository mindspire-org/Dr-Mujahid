import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { HospitalUser } from '../../modules/hospital/models/User'

export async function auth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any
    // Hospital tokens are DB-authoritative: invalidate if user was disabled or permissions changed.
    if (String(payload?.scope || '') === 'hospital') {
      const userId = String(payload?.sub || '')
      if (!userId) return res.status(401).json({ message: 'Unauthorized' })
      const u: any = await HospitalUser.findById(userId).select({ active: 1, tokenVersion: 1 }).lean()
      if (!u || u.active === false) return res.status(401).json({ message: 'Unauthorized' })
      const dbVer = Number(u.tokenVersion || 0)
      const tokVer = Number(payload?.tokenVersion || 0)
      if (dbVer !== tokVer) return res.status(401).json({ message: 'Unauthorized' })
    }

    ;(req as any).user = payload
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
