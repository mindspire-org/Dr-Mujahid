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
import { HospitalRole } from './modules/hospital/models/Role'
import { HospitalAccessNode } from './modules/hospital/models/AccessNode'
import { startBackupScheduler } from './modules/admin/backup.scheduler'

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

  startBackupScheduler()

  await Dispense.init()
  try {
    // Ensure the sales collection exists
    await Dispense.createCollection()
  } catch {}

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


  try {
    const defaults: Array<{ name: string; portals: Record<string, string[]> }> = [
      { name: 'Admin', portals: { hospital: ['*'], finance: ['*'], reception: ['*'], doctor: ['*'], therapyLab: ['*'] } },
      { name: 'Finance', portals: { finance: ['*'] } },
      { name: 'Reception', portals: { reception: ['*'] } },
      { name: 'Doctor', portals: { doctor: ['*'] } },
      { name: 'Therapy & Lab Reports Entry', portals: { therapyLab: ['*'] } },
      { name: 'Staff', portals: { therapyLab: ['*'] } },
    ]
    for (const r of defaults) {
      const exists = await HospitalRole.findOne({ name: r.name }).lean()
      if (!exists) await HospitalRole.create({ name: r.name, portals: r.portals })
    }
  } catch {}

  // Seed DB-driven access catalog (sidebar/modules/pages) - only inserts missing nodes
  try {
    const nodes: Array<{ key: string; portalKey: string; type: 'module' | 'page'; label: string; path?: string; parentKey?: string; order: number }> = [
      // Hospital
      { key: 'hospital.dashboard', portalKey: 'hospital', type: 'page', label: 'Dashboard', path: '/hospital', order: 1 },
      { key: 'hospital.token_generator', portalKey: 'hospital', type: 'page', label: 'Token Generator', path: '/hospital/token-generator', order: 2 },
      { key: 'hospital.appointments', portalKey: 'hospital', type: 'page', label: 'Appointments', path: '/hospital/appointments', order: 3 },
      { key: 'hospital.todays_tokens', portalKey: 'hospital', type: 'page', label: "Today's Tokens", path: '/hospital/today-tokens', order: 4 },
      { key: 'hospital.token_history', portalKey: 'hospital', type: 'page', label: 'Token History', path: '/hospital/token-history', order: 5 },
      { key: 'hospital.departments', portalKey: 'hospital', type: 'page', label: 'Departments', path: '/hospital/departments', order: 6 },

      { key: 'hospital.staff_management', portalKey: 'hospital', type: 'module', label: 'Staff Management', order: 20 },
      { key: 'hospital.staff_dashboard', portalKey: 'hospital', type: 'page', label: 'Staff Dashboard', path: '/hospital/staff-dashboard', parentKey: 'hospital.staff_management', order: 21 },
      { key: 'hospital.staff_attendance', portalKey: 'hospital', type: 'page', label: 'Staff Attendance', path: '/hospital/staff-attendance', parentKey: 'hospital.staff_management', order: 22 },
      { key: 'hospital.staff_monthly', portalKey: 'hospital', type: 'page', label: 'Staff Monthly', path: '/hospital/staff-monthly', parentKey: 'hospital.staff_management', order: 23 },
      { key: 'hospital.staff_settings', portalKey: 'hospital', type: 'page', label: 'Staff Settings', path: '/hospital/staff-settings', parentKey: 'hospital.staff_management', order: 24 },
      { key: 'hospital.staff_management_page', portalKey: 'hospital', type: 'page', label: 'Staff Management', path: '/hospital/staff-management', parentKey: 'hospital.staff_management', order: 25 },

      { key: 'hospital.doctor_management', portalKey: 'hospital', type: 'module', label: 'Doctor Management', order: 30 },
      { key: 'hospital.add_doctors', portalKey: 'hospital', type: 'page', label: 'Add Doctors', path: '/hospital/doctors', parentKey: 'hospital.doctor_management', order: 31 },
      { key: 'hospital.doctor_schedules', portalKey: 'hospital', type: 'page', label: 'Doctor Schedules', path: '/hospital/doctor-schedules', parentKey: 'hospital.doctor_management', order: 32 },
      { key: 'hospital.doctors_finance', portalKey: 'hospital', type: 'page', label: 'Doctors Finance', path: '/hospital/finance/doctors', parentKey: 'hospital.doctor_management', order: 33 },
      { key: 'hospital.doctor_payouts', portalKey: 'hospital', type: 'page', label: 'Doctor Payouts', path: '/hospital/finance/doctor-payouts', parentKey: 'hospital.doctor_management', order: 34 },

      { key: 'hospital.expense_management', portalKey: 'hospital', type: 'module', label: 'Expense Management', order: 40 },
      { key: 'hospital.add_expense', portalKey: 'hospital', type: 'page', label: 'Add Expense', path: '/hospital/finance/add-expense', parentKey: 'hospital.expense_management', order: 41 },
      { key: 'hospital.expense_history', portalKey: 'hospital', type: 'page', label: 'Expense History', path: '/hospital/finance/expenses', parentKey: 'hospital.expense_management', order: 42 },
      { key: 'hospital.transactions', portalKey: 'hospital', type: 'page', label: 'Transactions', path: '/hospital/finance/transactions', parentKey: 'hospital.expense_management', order: 43 },

      { key: 'hospital.patient_history', portalKey: 'hospital', type: 'page', label: 'Patient History', path: '/hospital/search-patients', order: 60 },
      { key: 'hospital.history_taking', portalKey: 'hospital', type: 'page', label: 'History Taking', path: '/hospital/history-taking', order: 61 },
      { key: 'hospital.lab_reports_entry', portalKey: 'hospital', type: 'page', label: 'Lab Reports Entry', path: '/hospital/lab-reports-entry', order: 62 },
      { key: 'hospital.petty_cash_management', portalKey: 'hospital', type: 'page', label: 'Petty Cash Mangement', path: '/hospital/finance/petty-cash-balance', order: 63 },
      { key: 'hospital.manage_bank_balance', portalKey: 'hospital', type: 'page', label: 'Manage Bank Balance', path: '/hospital/finance/manage-bank-balance', order: 63 },
      { key: 'hospital.user_management', portalKey: 'hospital', type: 'page', label: 'Users', path: '/hospital/user-management', order: 64 },
      { key: 'hospital.audit_log', portalKey: 'hospital', type: 'page', label: 'Audit log', path: '/hospital/audit', order: 65 },
      { key: 'hospital.settings', portalKey: 'hospital', type: 'page', label: 'Settings', path: '/hospital/settings', order: 66 },
      { key: 'hospital.backup', portalKey: 'hospital', type: 'page', label: 'Backup', path: '/hospital/backup', order: 67 },

      // Finance
      { key: 'finance.hospital', portalKey: 'finance', type: 'module', label: 'Hospital', order: 10 },
      { key: 'finance.hospital_dashboard', portalKey: 'finance', type: 'page', label: 'Hospital Dashboard', path: '/finance/hospital-dashboard', parentKey: 'finance.hospital', order: 11 },
      { key: 'finance.staff_dashboard', portalKey: 'finance', type: 'page', label: 'Staff Dashboard', path: '/finance/staff-dashboard', parentKey: 'finance.hospital', order: 12 },
      { key: 'finance.collection_report', portalKey: 'finance', type: 'page', label: 'Collection Report', path: '/finance/collection-report', parentKey: 'finance.hospital', order: 12 },
      { key: 'finance.doctor_finance', portalKey: 'finance', type: 'page', label: 'Doctor Finance', path: '/finance/doctors', parentKey: 'finance.hospital', order: 12 },
      { key: 'finance.doctor_payouts', portalKey: 'finance', type: 'page', label: 'Doctor Payouts', path: '/finance/doctor-payouts', parentKey: 'finance.hospital', order: 12 },
      { key: 'finance.patient_statement', portalKey: 'finance', type: 'page', label: 'Patient Statement', path: '/finance/patient-statement', parentKey: 'finance.hospital', order: 13 },
      { key: 'finance.pharmacy', portalKey: 'finance', type: 'module', label: 'Pharmacy', order: 20 },
      { key: 'finance.pharmacy_reports', portalKey: 'finance', type: 'page', label: 'Pharmacy Reports', path: '/finance/pharmacy-reports', parentKey: 'finance.pharmacy', order: 21 },
      { key: 'finance.laboratory', portalKey: 'finance', type: 'module', label: 'Laboratory', order: 30 },
      { key: 'finance.lab_reports', portalKey: 'finance', type: 'page', label: 'Lab Reports', path: '/finance/lab-reports', parentKey: 'finance.laboratory', order: 31 },
      { key: 'finance.diagnostics', portalKey: 'finance', type: 'module', label: 'Diagnostics', order: 40 },
      { key: 'finance.diagnostics_dashboard', portalKey: 'finance', type: 'page', label: 'Diagnostics Dashboard', path: '/finance/diagnostics-dashboard', parentKey: 'finance.diagnostics', order: 41 },
      { key: 'finance.accounts', portalKey: 'finance', type: 'module', label: 'Accounts', order: 50 },
      { key: 'finance.bank_accounts', portalKey: 'finance', type: 'page', label: 'Bank Accounts', path: '/finance/bank-accounts', parentKey: 'finance.accounts', order: 51 },
      { key: 'finance.manage_bank_balance', portalKey: 'finance', type: 'page', label: 'Manage Bank Balance', path: '/finance/opening-balances', parentKey: 'finance.accounts', order: 52 },
      { key: 'finance.petty_cash_accounts', portalKey: 'finance', type: 'page', label: 'Petty Cash Accounts', path: '/finance/petty-cash', parentKey: 'finance.accounts', order: 53 },
      { key: 'finance.manage_petty_cash', portalKey: 'finance', type: 'page', label: 'Manage Petty Cash', path: '/finance/manage-petty-cash', parentKey: 'finance.accounts', order: 54 },

      // Reception
      { key: 'reception.hospital', portalKey: 'reception', type: 'module', label: 'Hospital', order: 10 },
      { key: 'reception.token_generator', portalKey: 'reception', type: 'page', label: 'Token Generator', path: '/reception/token-generator', parentKey: 'reception.hospital', order: 11 },
      { key: 'reception.todays_tokens', portalKey: 'reception', type: 'page', label: "Today's Tokens", path: '/reception/today-tokens', parentKey: 'reception.hospital', order: 12 },
      { key: 'reception.token_history', portalKey: 'reception', type: 'page', label: 'Token History', path: '/reception/token-history', parentKey: 'reception.hospital', order: 12 },
      { key: 'reception.appointments', portalKey: 'reception', type: 'page', label: 'Appointments', path: '/reception/appointments', parentKey: 'reception.hospital', order: 12 },
      { key: 'reception.patient_history', portalKey: 'reception', type: 'page', label: 'Patient History', path: '/reception/search-patients', parentKey: 'reception.hospital', order: 13 },
      { key: 'reception.manage_petty_cash', portalKey: 'reception', type: 'page', label: 'Manage Petty Cash', path: '/reception/manage-petty-cash', parentKey: 'reception.hospital', order: 14 },
      { key: 'reception.manage_bank_balance', portalKey: 'reception', type: 'page', label: 'Manage Bank Balance', path: '/reception/manage-bank-balance', parentKey: 'reception.hospital', order: 14 },
      { key: 'reception.notifications', portalKey: 'reception', type: 'page', label: 'Notifications', path: '/reception/notifications', parentKey: 'reception.hospital', order: 14 },
      { key: 'reception.credit_patients', portalKey: 'reception', type: 'page', label: 'Credit Patients', path: '/reception/credit-patients', parentKey: 'reception.hospital', order: 14 },
      { key: 'reception.lab_reports_entry', portalKey: 'reception', type: 'page', label: 'Lab Report Entry', path: '/reception/lab-reports-entry', parentKey: 'reception.hospital', order: 14 },
      { key: 'reception.history_taking', portalKey: 'reception', type: 'page', label: 'History Taking', path: '/reception/history-taking', parentKey: 'reception.hospital', order: 14 },
      { key: 'reception.laboratory', portalKey: 'reception', type: 'module', label: 'Laboratory', order: 20 },
      { key: 'reception.lab_sample_intake', portalKey: 'reception', type: 'page', label: 'Lab Sample Intake', path: '/reception/lab/sample-intake', parentKey: 'reception.laboratory', order: 21 },
      { key: 'reception.lab_sample_tracking', portalKey: 'reception', type: 'page', label: 'Lab Sample Tracking', path: '/reception/lab/sample-tracking', parentKey: 'reception.laboratory', order: 22 },
      { key: 'reception.diagnostics', portalKey: 'reception', type: 'module', label: 'Diagnostics', order: 30 },
      { key: 'reception.diagnostic_token_generator', portalKey: 'reception', type: 'page', label: 'Diagnostic Token Generator', path: '/reception/diagnostic/token-generator', parentKey: 'reception.diagnostics', order: 31 },
      { key: 'reception.diagnostic_sample_tracking', portalKey: 'reception', type: 'page', label: 'Diagnostic Sample Tracking', path: '/reception/diagnostic/sample-tracking', parentKey: 'reception.diagnostics', order: 32 },
      { key: 'reception.diagnostic_appointments', portalKey: 'reception', type: 'page', label: 'Diagnostic Appointments', path: '/reception/diagnostic/appointments', parentKey: 'reception.diagnostics', order: 32 },
      { key: 'reception.diagnostic_credit_patients', portalKey: 'reception', type: 'page', label: 'Diagnostic Credit Patients', path: '/reception/diagnostic/credit-patients', parentKey: 'reception.diagnostics', order: 32 },
      { key: 'reception.others', portalKey: 'reception', type: 'module', label: 'Others', order: 40 },
      { key: 'reception.manager_cash_count', portalKey: 'reception', type: 'page', label: 'Manager Cash Count', path: '/reception/lab/manager-cash-count', parentKey: 'reception.others', order: 41 },

      // Therapy & Lab Reports Entry
      { key: 'therapyLab.token_generator', portalKey: 'therapyLab', type: 'page', label: 'Token Generator', path: '/therapy-lab/token-generator', order: 10 },
      { key: 'therapyLab.lab_reports_entry', portalKey: 'therapyLab', type: 'page', label: 'Lab Reports Entry', path: '/therapy-lab/lab-reports-entry', order: 20 },
      { key: 'therapyLab.packages', portalKey: 'therapyLab', type: 'page', label: 'Packages', path: '/therapy-lab/packages', order: 30 },
      { key: 'therapyLab.management', portalKey: 'therapyLab', type: 'page', label: 'Management', path: '/therapy-lab/management', order: 40 },
      { key: 'therapyLab.manage_petty_cash', portalKey: 'therapyLab', type: 'page', label: 'Manage Petty Cash', path: '/therapy-lab/manage-petty-cash', order: 50 },
      { key: 'therapyLab.manage_bank_balance', portalKey: 'therapyLab', type: 'page', label: 'Manage Bank Balance', path: '/therapy-lab/manage-bank-balance', order: 50 },

      // Doctor
      { key: 'doctor.dashboard', portalKey: 'doctor', type: 'page', label: 'Dashboard', path: '/doctor', order: 1 },
      { key: 'doctor.patients', portalKey: 'doctor', type: 'page', label: 'Patients', path: '/doctor/patients', order: 2 },
      { key: 'doctor.patient_history', portalKey: 'doctor', type: 'page', label: 'Patient History', path: '/doctor/patient-search', order: 3 },
      { key: 'doctor.prescription', portalKey: 'doctor', type: 'page', label: 'Prescription', path: '/doctor/prescription', order: 4 },
      { key: 'doctor.prescription_history', portalKey: 'doctor', type: 'page', label: 'Prescription History', path: '/doctor/prescription-history', order: 5 },
      { key: 'doctor.reports', portalKey: 'doctor', type: 'page', label: 'Reports', path: '/doctor/reports', order: 6 },
      { key: 'doctor.manage_petty_cash', portalKey: 'doctor', type: 'page', label: 'Manage Petty Cash', path: '/doctor/manage-petty-cash', order: 6 },
      { key: 'doctor.manage_bank_balance', portalKey: 'doctor', type: 'page', label: 'Manage Bank Balance', path: '/doctor/manage-bank-balance', order: 6 },
      { key: 'doctor.notifications', portalKey: 'doctor', type: 'page', label: 'Notifications', path: '/doctor/notifications', order: 7 },
      { key: 'doctor.settings', portalKey: 'doctor', type: 'page', label: 'Settings', path: '/doctor/settings', order: 8 },

      // Diagnostics
      { key: 'diagnostic.dashboard', portalKey: 'diagnostic', type: 'page', label: 'Dashboard', path: '/diagnostic', order: 1 },
      { key: 'diagnostic.token_generator', portalKey: 'diagnostic', type: 'page', label: 'Token Generator', path: '/diagnostic/token-generator', order: 2 },
      { key: 'diagnostic.manage_petty_cash', portalKey: 'diagnostic', type: 'page', label: 'Manage Petty Cash', path: '/diagnostic/manage-petty-cash', order: 3 },
      { key: 'diagnostic.manage_bank_balance', portalKey: 'diagnostic', type: 'page', label: 'Manage Bank Balance', path: '/diagnostic/manage-bank-balance', order: 3 },
      { key: 'diagnostic.tests', portalKey: 'diagnostic', type: 'page', label: 'Tests Catalog', path: '/diagnostic/tests', order: 3 },
      { key: 'diagnostic.sample_management', portalKey: 'diagnostic', type: 'page', label: 'Sample Management', path: '/diagnostic/sample-tracking', order: 4 },
      { key: 'diagnostic.credit_patients', portalKey: 'diagnostic', type: 'page', label: 'Credit Patients', path: '/diagnostic/credit-patients', order: 4 },
      { key: 'diagnostic.result_entry', portalKey: 'diagnostic', type: 'page', label: 'Result Entry', path: '/diagnostic/result-entry', order: 5 },
      { key: 'diagnostic.report_generator', portalKey: 'diagnostic', type: 'page', label: 'Report Generator', path: '/diagnostic/report-generator', order: 6 },
      { key: 'diagnostic.appointments', portalKey: 'diagnostic', type: 'page', label: 'Appointments', path: '/diagnostic/appointments', order: 6 },
      { key: 'diagnostic.referrals', portalKey: 'diagnostic', type: 'page', label: 'Referrals', path: '/diagnostic/referrals', order: 7 },
      { key: 'diagnostic.user_management', portalKey: 'diagnostic', type: 'page', label: 'User Management', path: '/diagnostic/user-management', order: 8 },
      { key: 'diagnostic.audit_logs', portalKey: 'diagnostic', type: 'page', label: 'Audit Logs', path: '/diagnostic/audit-logs', order: 9 },
      { key: 'diagnostic.notifications', portalKey: 'diagnostic', type: 'page', label: 'Notifications', path: '/diagnostic/notifications', order: 9 },
      { key: 'diagnostic.settings', portalKey: 'diagnostic', type: 'page', label: 'Settings', path: '/diagnostic/settings', order: 10 },

      // Pharmacy
      { key: 'pharmacy.dashboard', portalKey: 'pharmacy', type: 'page', label: 'Dashboard', path: '/pharmacy', order: 1 },
      { key: 'pharmacy.pos', portalKey: 'pharmacy', type: 'page', label: 'Point of Sale', path: '/pharmacy/pos', order: 2 },
      { key: 'pharmacy.manage_petty_cash', portalKey: 'pharmacy', type: 'page', label: 'Manage Petty Cash', path: '/pharmacy/manage-petty-cash', order: 3 },
      { key: 'pharmacy.manage_bank_balance', portalKey: 'pharmacy', type: 'page', label: 'Manage Bank Balance', path: '/pharmacy/manage-bank-balance', order: 3 },
      { key: 'pharmacy.inventory', portalKey: 'pharmacy', type: 'page', label: 'Inventory', path: '/pharmacy/inventory', order: 3 },
      { key: 'pharmacy.customers', portalKey: 'pharmacy', type: 'page', label: 'Customers', path: '/pharmacy/customers', order: 4 },
      { key: 'pharmacy.suppliers', portalKey: 'pharmacy', type: 'page', label: 'Suppliers', path: '/pharmacy/suppliers', order: 5 },
      { key: 'pharmacy.sales_history', portalKey: 'pharmacy', type: 'page', label: 'Sales History', path: '/pharmacy/sales-history', order: 6 },
      { key: 'pharmacy.purchase_history', portalKey: 'pharmacy', type: 'page', label: 'Purchase History', path: '/pharmacy/purchase-history', order: 7 },
      { key: 'pharmacy.return_history', portalKey: 'pharmacy', type: 'page', label: 'Return History', path: '/pharmacy/return-history', order: 8 },
      { key: 'pharmacy.staff_attendance', portalKey: 'pharmacy', type: 'page', label: 'Staff Attendance', path: '/pharmacy/staff-attendance', order: 9 },
      { key: 'pharmacy.staff_management', portalKey: 'pharmacy', type: 'page', label: 'Staff Management', path: '/pharmacy/staff-management', order: 10 },
      { key: 'pharmacy.staff_settings', portalKey: 'pharmacy', type: 'page', label: 'Staff Settings', path: '/pharmacy/staff-settings', order: 11 },
      { key: 'pharmacy.staff_monthly', portalKey: 'pharmacy', type: 'page', label: 'Staff Monthly', path: '/pharmacy/staff-monthly', order: 12 },
      { key: 'pharmacy.reports', portalKey: 'pharmacy', type: 'page', label: 'Reports', path: '/pharmacy/reports', order: 13 },
      { key: 'pharmacy.notifications', portalKey: 'pharmacy', type: 'page', label: 'Notifications', path: '/pharmacy/notifications', order: 14 },
      { key: 'pharmacy.guidelines', portalKey: 'pharmacy', type: 'page', label: 'Guidelines', path: '/pharmacy/guidelines', order: 15 },
      { key: 'pharmacy.customer_return', portalKey: 'pharmacy', type: 'page', label: 'Customer Return', path: '/pharmacy/returns', order: 16 },
      { key: 'pharmacy.supplier_return', portalKey: 'pharmacy', type: 'page', label: 'Supplier Return', path: '/pharmacy/supplier-returns', order: 17 },
      { key: 'pharmacy.prescriptions', portalKey: 'pharmacy', type: 'page', label: 'Prescription Intake', path: '/pharmacy/prescriptions', order: 18 },
      { key: 'pharmacy.referrals', portalKey: 'pharmacy', type: 'page', label: 'Referrals', path: '/pharmacy/referrals', order: 19 },
      { key: 'pharmacy.audit_logs', portalKey: 'pharmacy', type: 'page', label: 'Audit Logs', path: '/pharmacy/audit-logs', order: 20 },
      { key: 'pharmacy.expenses', portalKey: 'pharmacy', type: 'page', label: 'Expenses', path: '/pharmacy/expenses', order: 21 },
      { key: 'pharmacy.pay_in_out', portalKey: 'pharmacy', type: 'page', label: 'Pay In/Out', path: '/pharmacy/pay-in-out', order: 22 },
      { key: 'pharmacy.manager_cash_count', portalKey: 'pharmacy', type: 'page', label: 'Manager Cash Count', path: '/pharmacy/manager-cash-count', order: 23 },
      { key: 'pharmacy.settings', portalKey: 'pharmacy', type: 'page', label: 'Settings', path: '/pharmacy/settings', order: 24 },
      { key: 'pharmacy.sidebar_permissions', portalKey: 'pharmacy', type: 'page', label: 'Sidebar Permissions', path: '/pharmacy/sidebar-permissions', order: 25 },
      { key: 'pharmacy.user_management', portalKey: 'pharmacy', type: 'page', label: 'User Management', path: '/pharmacy/user-management', order: 26 },
    ]

    for (const n of nodes) {
      const exists = await HospitalAccessNode.findOne({ key: n.key }).lean()
      if (!exists) {
        await HospitalAccessNode.create({
          key: n.key,
          portalKey: n.portalKey,
          type: n.type,
          label: n.label,
          path: n.path,
          parentKey: n.parentKey,
          order: n.order,
          active: true,
        })
      }
    }
  } catch {}

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
