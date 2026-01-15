import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'

export function auth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any
    ;(req as any).user = payload
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
