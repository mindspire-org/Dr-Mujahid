import app from './app'
import { connectDB } from './config/db'
import { env } from './config/env'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { createServer, type Server } from 'http'
import { PharmacyUser } from './modules/pharmacy/models/User'
import { Dispense } from './modules/pharmacy/models/Dispense'
import { AestheticUser } from './modules/aesthetic/models/User'
import { LabUser } from './modules/lab/models/User'
import { DiagnosticUser } from './modules/diagnostic/models/User'
import { HospitalUser } from './modules/hospital/models/User'

async function listenWithRetry(port: number, host: string, maxAttempts = 10, delayMs = 500): Promise<Server> {
  let attempt = 0
  while (attempt < maxAttempts) {
    attempt += 1
    const server = createServer(app)
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', () => resolve())
        server.once('error', (err: any) => reject(err))
        server.listen(port, host)
      })
      return server
    } catch (err: any) {
      try { server.close() } catch {}
      if (String(err?.code || '') === 'EADDRINUSE' && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }
      throw err
    }
  }
  throw new Error(`Failed to bind ${host}:${port}`)
}

async function main(){
  await connectDB()
  await Dispense.init()
  try {
    // Ensure the sales collection exists
    await Dispense.createCollection()
  } catch {}
  const admin = await PharmacyUser.findOne({ username: 'admin' }).lean()
  if (!admin) {
    const passwordHash = await bcrypt.hash('123', 10)
    await PharmacyUser.create({ username: 'admin', role: 'admin', passwordHash })
  }

  const pharmacyUser = await PharmacyUser.findOne({ username: 'pharma' }).lean()
  if (!pharmacyUser) {
    const passwordHash = await bcrypt.hash('123', 10)
    await PharmacyUser.create({ username: 'pharma', role: 'pharmacist', passwordHash })
  }

  const aestheticAdmin = await AestheticUser.findOne({ username: 'admin' }).lean()
  if (!aestheticAdmin) {
    const passwordHash = await bcrypt.hash('123', 10)
    await AestheticUser.create({ username: 'admin', role: 'admin', passwordHash })
  }

  const labUser = await LabUser.findOne({ username: 'lab' }).lean()
  if (!labUser) {
    const passwordHash = await bcrypt.hash('123', 10)
    await LabUser.create({ username: 'lab', role: 'admin', passwordHash })
  }

  const diagnosticUser = await DiagnosticUser.findOne({ username: 'diag' }).lean()
  if (!diagnosticUser) {
    const passwordHash = await bcrypt.hash('123', 10)
    await DiagnosticUser.create({ username: 'diag', role: 'admin', passwordHash })
  }

  const hospitalAdmin = await HospitalUser.findOne({ username: 'admin' }).lean()
  if (!hospitalAdmin) {
    const passwordHash = await bcrypt.hash('123', 10)
    await HospitalUser.create({ username: 'admin', role: 'Admin', passwordHash, active: true })
  }

  const hospitalFinance = await HospitalUser.findOne({ username: 'finan' }).lean()
  if (!hospitalFinance) {
    const passwordHash = await bcrypt.hash('123', 10)
    await HospitalUser.create({ username: 'finan', role: 'Finance', passwordHash, active: true })
  }

  const hospitalReception = await HospitalUser.findOne({ username: 'recep' }).lean()
  if (!hospitalReception) {
    const passwordHash = await bcrypt.hash('123', 10)
    await HospitalUser.create({ username: 'recep', role: 'Reception', passwordHash, active: true })
  }

  const server: Server = await listenWithRetry(env.PORT, '0.0.0.0')
  console.log(`Backend listening on http://localhost:${env.PORT}`)

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    try {
      server.close(() => {
        process.exit(0)
      })
      // Force-exit if close hangs (Windows watcher restarts can be abrupt)
      setTimeout(() => process.exit(0), 5000).unref()
    } catch {
      process.exit(0)
    }
    try { await mongoose.connection.close() } catch {}
  }

  process.on('SIGINT', () => { void shutdown('SIGINT') })
  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
}

main().catch(err => {
  console.error('Failed to start server', err)
  process.exit(1)
})
