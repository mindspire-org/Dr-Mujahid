import { Router } from 'express'
import * as Packages from '../controllers/packages.controller'
import * as Patients from '../controllers/patients.controller'
import * as Accounts from '../controllers/accounts.controller'
import * as Visits from '../controllers/visits.controller'
import * as Payments from '../controllers/payments.controller'

const r = Router()

// Patients (shared Lab_Patient)
r.get('/patients/search', Patients.search)
r.post('/patients/find-or-create', Patients.findOrCreate)
r.get('/patients/by-mrn', Patients.getByMrn)
r.put('/patients/:id', Patients.update)

// Accounts (Dues/Advance)
r.get('/accounts', Accounts.list)
r.get('/accounts/:patientId', Accounts.getByPatientId)

// Visits (Therapy sessions)
r.get('/visits', Visits.list)
r.post('/visits', Visits.create)
r.get('/visits/:id', Visits.getById)
r.put('/visits/:id', Visits.update)

// Payments (settle dues / collect advance)
r.get('/payments', Payments.list)
r.post('/payments', Payments.create)

r.get('/packages', Packages.list)
r.post('/packages', Packages.create)
r.get('/packages/:id', Packages.getById)
r.put('/packages/:id', Packages.update)
r.delete('/packages/:id', Packages.remove)

export default r
