import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'node:path'
import { env } from './config/env'
import apiRouter from './routes'
import { errorHandler } from './common/middleware/error'

const app = express()

const corsOrigin = env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN
app.use(cors({ origin: corsOrigin as any, credentials: true }))

// Skip JSON body parsing for file upload routes (multer handles these)
app.use((req, res, next) => {
  if (req.path === '/api/hospital/patients/import-excel' || req.path === '/api/hospital/patients/preview-excel') {
    return next()
  }
  express.json({ limit: '100mb' })(req, res, next)
})
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }))

app.use('/api', apiRouter)

// Serve built frontend (root/dist) for all non-API routes
//const publicDir = path.join(__dirname, '..', '..', 'dist')
//app.use(express.static(publicDir))
//app.get('*', (req: Request, res: Response, next) => {
//  if (req.path.startsWith('/api')) return next()
//  try { return res.sendFile(path.join(publicDir, 'index.html')) } catch { return next() }
//})

app.use(errorHandler)

export default app
