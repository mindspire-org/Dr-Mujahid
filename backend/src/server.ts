import app from './app'
import { connectDB } from './config/db'
import { env } from './config/env'
import bcrypt from 'bcryptjs'
import { PharmacyUser } from './modules/pharmacy/models/User'
import { Dispense } from './modules/pharmacy/models/Dispense'
import { AestheticUser } from './modules/aesthetic/models/User'
import { LabUser } from './modules/lab/models/User'
import { DiagnosticUser } from './modules/diagnostic/models/User'

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
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`)
  })
}

main().catch(err => {
  console.error('Failed to start server', err)
  process.exit(1)
})
