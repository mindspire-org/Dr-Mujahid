import { Router } from 'express'
import * as packagesController from '../controllers/packages.controller'
import * as ordersController from '../controllers/orders.controller'
import * as patientsController from '../controllers/patients.controller'
import * as accountsController from '../controllers/accounts.controller'
import * as appointmentsController from '../controllers/appointments.controller'

const router = Router()

// Packages
router.get('/packages', packagesController.listPackages)
router.get('/packages/:id', packagesController.getPackage)
router.post('/packages', packagesController.createPackage)
router.put('/packages/:id', packagesController.updatePackage)
router.delete('/packages/:id', packagesController.deletePackage)

// Orders
router.get('/orders', ordersController.listOrders)
router.post('/orders', ordersController.createOrder)
router.put('/orders/:id', ordersController.updateOrder)
router.post('/orders/:id/return', ordersController.returnOrder)

// Status update
router.put('/orders/:id/session-status', ordersController.updateSessionStatus)

// Dashboard
router.get('/dashboard/summary', ordersController.getDashboardSummary)

// Patients
router.get('/patients/search', patientsController.searchPatients)
router.post('/patients/find-or-create', patientsController.findOrCreatePatient)
router.get('/patients/by-mrn', patientsController.getPatientByMrn)
router.put('/patients/:id', patientsController.updatePatient)

// Appointments
router.get('/appointments', appointmentsController.list)
router.post('/appointments', appointmentsController.create)
router.get('/appointments/:id', appointmentsController.getById)
router.put('/appointments/:id', appointmentsController.update)
router.delete('/appointments/:id', appointmentsController.remove)

// Accounts
router.get('/accounts/:patientId', accountsController.getAccount)
router.get('/credit-patients', accountsController.listCreditPatients)
router.post('/accounts/:patientId/pay', accountsController.payCreditPatient)

export default router
