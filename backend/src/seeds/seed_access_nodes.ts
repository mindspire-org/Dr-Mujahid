import mongoose from 'mongoose';
import { HospitalAccessNode } from '../modules/hospital/models/AccessNode';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hms';

async function run() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const therapyLabNodes = [
            { key: 'therapy-lab-dashboard', portalKey: 'therapyLab', type: 'page', label: 'Dashboard', path: '/therapy-lab', order: 1, active: true },
            { key: 'therapy-lab-token-generator', portalKey: 'therapyLab', type: 'page', label: 'Token Generator', path: '/therapy-lab/token-generator', order: 2, active: true },
            { key: 'therapy-lab-today-tokens', portalKey: 'therapyLab', type: 'page', label: "Today's Tokens", path: '/therapy-lab/today-tokens', order: 3, active: true },
            { key: 'therapy-lab-token-history', portalKey: 'therapyLab', type: 'page', label: 'Token History', path: '/therapy-lab/token-history', order: 4, active: true },
            { key: 'therapy-lab-credit-patients', portalKey: 'therapyLab', type: 'page', label: 'Credit Patients', path: '/therapy-lab/credit-patients', order: 5, active: true },
            { key: 'therapy-lab-packages', portalKey: 'therapyLab', type: 'page', label: 'Packages', path: '/therapy-lab/packages', order: 6, active: true },
            { key: 'therapy-lab-appointments', portalKey: 'therapyLab', type: 'page', label: 'Appointments', path: '/therapy-lab/appointments', order: 7, active: true },
            { key: 'therapy-lab-lab-reports-entry', portalKey: 'therapyLab', type: 'page', label: 'Lab Reports Entry', path: '/therapy-lab/lab-reports-entry', order: 8, active: true },
            { key: 'therapy-lab-manage-petty-cash', portalKey: 'therapyLab', type: 'page', label: 'Manage Petty Cash', path: '/therapy-lab/manage-petty-cash', order: 9, active: true },
            { key: 'therapy-lab-manage-bank-balance', portalKey: 'therapyLab', type: 'page', label: 'Manage Bank Balance', path: '/therapy-lab/manage-bank-balance', order: 10, active: true },
            { key: 'therapy-lab-notifications', portalKey: 'therapyLab', type: 'page', label: 'Notifications', path: '/therapy-lab/notifications', order: 11, active: true }
        ];

        const therapyNodes = [
            { key: 'therapy-dashboard', portalKey: 'therapy', type: 'page', label: 'Dashboard', path: '/therapy-lab', order: 1, active: true },
            { key: 'therapy-token-generator', portalKey: 'therapy', type: 'page', label: 'Token Generator', path: '/therapy-lab/token-generator', order: 2, active: true },
            { key: 'therapy-today-tokens', portalKey: 'therapy', type: 'page', label: "Today's Tokens", path: '/therapy-lab/today-tokens', order: 3, active: true },
            { key: 'therapy-token-history', portalKey: 'therapy', type: 'page', label: 'Token History', path: '/therapy-lab/token-history', order: 4, active: true },
            { key: 'therapy-credit-patients', portalKey: 'therapy', type: 'page', label: 'Credit Patients', path: '/therapy-lab/credit-patients', order: 5, active: true },
            { key: 'therapy-appointments', portalKey: 'therapy', type: 'page', label: 'Appointments', path: '/therapy-lab/appointments', order: 6, active: true },
            { key: 'therapy-reception-token-gen', portalKey: 'therapy', type: 'page', label: 'Reception Token Generator', path: '/reception/therapy/token-generator', order: 7, active: true },
            { key: 'therapy-reception-today-tokens', portalKey: 'therapy', type: 'page', label: "Reception Today's Tokens", path: '/reception/therapy/today-tokens', order: 8, active: true },
            { key: 'therapy-reception-token-history', portalKey: 'therapy', type: 'page', label: 'Reception Token History', path: '/reception/therapy/token-history', order: 9, active: true },
            { key: 'therapy-reception-appointments', portalKey: 'therapy', type: 'page', label: 'Reception Appointments', path: '/reception/therapy/appointments', order: 10, active: true },
            { key: 'therapy-reception-credit-patients', portalKey: 'therapy', type: 'page', label: 'Reception Credit Patients', path: '/reception/therapy/credit-patients', order: 11, active: true },
        ];

        const counsellingNodes = [
            { key: 'counselling-dashboard', portalKey: 'counselling', type: 'page', label: 'Dashboard', path: '/counselling', order: 1, active: true },
            { key: 'counselling-token-gen', portalKey: 'counselling', type: 'page', label: 'Token Generator', path: '/counselling/token-generator', order: 2, active: true },
            { key: 'counselling-today-tokens', portalKey: 'counselling', type: 'page', label: "Today's Tokens", path: '/counselling/today-tokens', order: 3, active: true },
            { key: 'counselling-token-history', portalKey: 'counselling', type: 'page', label: 'Token History', path: '/counselling/token-history', order: 4, active: true },
            { key: 'counselling-appointments', portalKey: 'counselling', type: 'page', label: 'Appointments', path: '/counselling/appointments', order: 5, active: true },
            { key: 'counselling-credit-patients', portalKey: 'counselling', type: 'page', label: 'Credit Patients', path: '/counselling/credit-patients', order: 6, active: true },
            { key: 'counselling-packages', portalKey: 'counselling', type: 'page', label: 'Packages', path: '/counselling/packages', order: 7, active: true },
            { key: 'counselling-manage-petty-cash', portalKey: 'counselling', type: 'page', label: 'Manage Petty Cash', path: '/counselling/manage-petty-cash', order: 8, active: true },
            { key: 'counselling-manage-bank-balance', portalKey: 'counselling', type: 'page', label: 'Manage Bank Balance', path: '/counselling/manage-bank-balance', order: 9, active: true },
            { key: 'counselling-notifications', portalKey: 'counselling', type: 'page', label: 'Notifications', path: '/counselling/notifications', order: 10, active: true }
        ];

        const receptionNodes = [
            { key: 'reception-dashboard', portalKey: 'reception', type: 'page', label: 'Dashboard', path: '/reception', order: 1, active: true },
            { key: 'reception-token-generator', portalKey: 'reception', type: 'page', label: 'Token Generator', path: '/reception/token-generator', order: 2, active: true },
            { key: 'reception-today-tokens', portalKey: 'reception', type: 'page', label: "Today's Tokens", path: '/reception/today-tokens', order: 3, active: true },
            { key: 'reception-token-history', portalKey: 'reception', type: 'page', label: 'Token History', path: '/reception/token-history', order: 4, active: true },
            { key: 'reception-appointments', portalKey: 'reception', type: 'page', label: 'Appointments', path: '/reception/appointments', order: 5, active: true },
            { key: 'reception-search-patients', portalKey: 'reception', type: 'page', label: 'Patient History', path: '/reception/search-patients', order: 6, active: true },
            { key: 'reception-credit-patients', portalKey: 'reception', type: 'page', label: 'Credit Patients', path: '/reception/credit-patients', order: 7, active: true },
            { key: 'reception-lab-reports-entry', portalKey: 'reception', type: 'page', label: 'Lab Report Entry', path: '/reception/lab-reports-entry', order: 8, active: true },
            { key: 'reception-history-taking', portalKey: 'reception', type: 'page', label: 'History Taking', path: '/reception/history-taking', order: 9, active: true },
            { key: 'reception-manage-petty-cash', portalKey: 'reception', type: 'page', label: 'Manage Petty Cash', path: '/reception/manage-petty-cash', order: 10, active: true },
            { key: 'reception-manage-bank-balance', portalKey: 'reception', type: 'page', label: 'Manage Bank Balance', path: '/reception/manage-bank-balance', order: 11, active: true },
            { key: 'reception-notifications', portalKey: 'reception', type: 'page', label: 'Notifications', path: '/reception/notifications', order: 12, active: true },
            { key: 'reception-diagnostic-token-gen', portalKey: 'reception', type: 'page', label: 'Diagnostic Token Generator', path: '/reception/diagnostic/token-generator', order: 13, active: true },
            { key: 'reception-diagnostic-sample-tracking', portalKey: 'reception', type: 'page', label: 'Diagnostic Sample Tracking', path: '/reception/diagnostic/sample-tracking', order: 14, active: true },
            { key: 'reception-diagnostic-appointments', portalKey: 'reception', type: 'page', label: 'Diagnostic Appointments', path: '/reception/diagnostic/appointments', order: 15, active: true },
            { key: 'reception-diagnostic-credit-patients', portalKey: 'reception', type: 'page', label: 'Diagnostic Credit Patients', path: '/reception/diagnostic/credit-patients', order: 16, active: true },
            { key: 'reception-therapy-token-gen', portalKey: 'reception', type: 'page', label: 'Therapy Token Generator', path: '/reception/therapy/token-generator', order: 17, active: true },
            { key: 'reception-therapy-today-tokens', portalKey: 'reception', type: 'page', label: "Therapy Today's Tokens", path: '/reception/therapy/today-tokens', order: 18, active: true },
            { key: 'reception-therapy-token-history', portalKey: 'reception', type: 'page', label: 'Therapy Token History', path: '/reception/therapy/token-history', order: 19, active: true },
            { key: 'reception-therapy-appointments', portalKey: 'reception', type: 'page', label: 'Therapy Appointments', path: '/reception/therapy/appointments', order: 20, active: true },
            { key: 'reception-therapy-credit-patients', portalKey: 'reception', type: 'page', label: 'Therapy Credit Patients', path: '/reception/therapy/credit-patients', order: 21, active: true },
            { key: 'reception-counselling-token-gen', portalKey: 'reception', type: 'page', label: 'Counselling Token Generator', path: '/reception/counselling/token-generator', order: 22, active: true },
            { key: 'reception-counselling-today-tokens', portalKey: 'reception', type: 'page', label: "Counselling Today's Tokens", path: '/reception/counselling/today-tokens', order: 23, active: true },
            { key: 'reception-counselling-token-history', portalKey: 'reception', type: 'page', label: 'Counselling Token History', path: '/reception/counselling/token-history', order: 24, active: true },
            { key: 'reception-counselling-appointments', portalKey: 'reception', type: 'page', label: 'Counselling Appointments', path: '/reception/counselling/appointments', order: 25, active: true },
            { key: 'reception-counselling-credit-patients', portalKey: 'reception', type: 'page', label: 'Counselling Credit Patients', path: '/reception/counselling/credit-patients', order: 26, active: true }
        ];

        const diagnosticNodes = [
            { key: 'diagnostic-dashboard', portalKey: 'diagnostic', type: 'page', label: 'Dashboard', path: '/diagnostic', order: 1, active: true },
            { key: 'diagnostic-token-gen', portalKey: 'diagnostic', type: 'page', label: 'Token Generator', path: '/diagnostic/token-generator', order: 2, active: true },
            { key: 'diagnostic-sample-tracking', portalKey: 'diagnostic', type: 'page', label: 'Sample Management', path: '/diagnostic/sample-tracking', order: 3, active: true },
            { key: 'diagnostic-credit-patients', portalKey: 'diagnostic', type: 'page', label: 'Credit Patients', path: '/diagnostic/credit-patients', order: 4, active: true },
            { key: 'diagnostic-result-entry', portalKey: 'diagnostic', type: 'page', label: 'Result Entry', path: '/diagnostic/result-entry', order: 5, active: true },
            { key: 'diagnostic-report-gen', portalKey: 'diagnostic', type: 'page', label: 'Report Generator', path: '/diagnostic/report-generator', order: 6, active: true },
            { key: 'diagnostic-appointments', portalKey: 'diagnostic', type: 'page', label: 'Appointments', path: '/diagnostic/appointments', order: 7, active: true },
            { key: 'diagnostic-tests', portalKey: 'diagnostic', type: 'page', label: 'Tests Catalog', path: '/diagnostic/tests', order: 8, active: true },
            { key: 'diagnostic-manage-petty-cash', portalKey: 'diagnostic', type: 'page', label: 'Manage Petty Cash', path: '/diagnostic/manage-petty-cash', order: 9, active: true },
            { key: 'diagnostic-manage-bank-balance', portalKey: 'diagnostic', type: 'page', label: 'Manage Bank Balance', path: '/diagnostic/manage-bank-balance', order: 10, active: true },
            { key: 'diagnostic-notifications', portalKey: 'diagnostic', type: 'page', label: 'Notifications', path: '/diagnostic/notifications', order: 11, active: true },
            { key: 'diagnostic-referrals', portalKey: 'diagnostic', type: 'page', label: 'Referrals', path: '/diagnostic/referrals', order: 12, active: true },
            { key: 'diagnostic-audit-logs', portalKey: 'diagnostic', type: 'page', label: 'Audit Logs', path: '/diagnostic/audit-logs', order: 13, active: true },
            { key: 'diagnostic-settings', portalKey: 'diagnostic', type: 'page', label: 'Settings', path: '/diagnostic/settings', order: 14, active: true }
        ];

        const pharmacyNodes = [
            { key: 'pharmacy-dashboard', portalKey: 'pharmacy', type: 'page', label: 'Dashboard', path: '/pharmacy', order: 1, active: true },
            { key: 'pharmacy-pos', portalKey: 'pharmacy', type: 'page', label: 'POS / Dispense', path: '/pharmacy/pos', order: 2, active: true },
            { key: 'pharmacy-inventory', portalKey: 'pharmacy', type: 'page', label: 'Inventory', path: '/pharmacy/inventory', order: 3, active: true },
            { key: 'pharmacy-purchases', portalKey: 'pharmacy', type: 'page', label: 'Purchases', path: '/pharmacy/purchase-history', order: 4, active: true },
            { key: 'pharmacy-sales', portalKey: 'pharmacy', type: 'page', label: 'Sales History', path: '/pharmacy/sales-history', order: 5, active: true },
            { key: 'pharmacy-referrals', portalKey: 'pharmacy', type: 'page', label: 'Referrals', path: '/pharmacy/referrals', order: 6, active: true },
            { key: 'pharmacy-suppliers', portalKey: 'pharmacy', type: 'page', label: 'Suppliers', path: '/pharmacy/suppliers', order: 7, active: true },
            { key: 'pharmacy-customers', portalKey: 'pharmacy', type: 'page', label: 'Credit Customers', path: '/pharmacy/customers', order: 8, active: true },
            { key: 'pharmacy-companies', portalKey: 'pharmacy', type: 'page', label: 'Companies', path: '/pharmacy/companies', order: 9, active: true },
            { key: 'pharmacy-returns', portalKey: 'pharmacy', type: 'page', label: 'Returns', path: '/pharmacy/returns', order: 10, active: true },
            { key: 'pharmacy-expenses', portalKey: 'pharmacy', type: 'page', label: 'Expenses', path: '/pharmacy/expenses', order: 11, active: true },
            { key: 'pharmacy-pay-in-out', portalKey: 'pharmacy', type: 'page', label: 'Pay In / Out', path: '/pharmacy/pay-in-out', order: 12, active: true },
            { key: 'pharmacy-manage-petty-cash', portalKey: 'pharmacy', type: 'page', label: 'Manage Petty Cash', path: '/pharmacy/manage-petty-cash', order: 13, active: true },
            { key: 'pharmacy-manage-bank-balance', portalKey: 'pharmacy', type: 'page', label: 'Manage Bank Balance', path: '/pharmacy/manage-bank-balance', order: 14, active: true },
            { key: 'pharmacy-cash-count', portalKey: 'pharmacy', type: 'page', label: 'Cash Count', path: '/pharmacy/manager-cash-count', order: 15, active: true },
            { key: 'pharmacy-purchase-drafts', portalKey: 'pharmacy', type: 'page', label: 'Purchase Drafts', path: '/pharmacy/purchase-drafts', order: 16, active: true },
            { key: 'pharmacy-hold-sales', portalKey: 'pharmacy', type: 'page', label: 'Hold Sales', path: '/pharmacy/hold-sales', order: 17, active: true },
            { key: 'pharmacy-notifications', portalKey: 'pharmacy', type: 'page', label: 'Notifications', path: '/pharmacy/notifications', order: 18, active: true },
            { key: 'pharmacy-audit-logs', portalKey: 'pharmacy', type: 'page', label: 'Audit Logs', path: '/pharmacy/audit-logs', order: 19, active: true },
            { key: 'pharmacy-settings', portalKey: 'pharmacy', type: 'page', label: 'Settings', path: '/pharmacy/settings', order: 20, active: true }
        ];

        const doctorNodes = [
            { key: 'doctor-dashboard', portalKey: 'doctor', type: 'page', label: 'Dashboard', path: '/doctor', order: 1, active: true },
            { key: 'doctor-patients', portalKey: 'doctor', type: 'page', label: 'Patients', path: '/doctor/patients', order: 2, active: true },
            { key: 'doctor-patient-search', portalKey: 'doctor', type: 'page', label: 'Patient History', path: '/doctor/patient-search', order: 3, active: true },
            { key: 'doctor-prescription', portalKey: 'doctor', type: 'page', label: 'Prescription', path: '/doctor/prescription', order: 4, active: true },
            { key: 'doctor-prescription-history', portalKey: 'doctor', type: 'page', label: 'Prescription History', path: '/doctor/prescription-history', order: 5, active: true },
            { key: 'doctor-reports', portalKey: 'doctor', type: 'page', label: 'Reports', path: '/doctor/reports', order: 6, active: true },
            { key: 'doctor-manage-petty-cash', portalKey: 'doctor', type: 'page', label: 'Manage Petty Cash', path: '/doctor/manage-petty-cash', order: 7, active: true },
            { key: 'doctor-manage-bank-balance', portalKey: 'doctor', type: 'page', label: 'Manage Bank Balance', path: '/doctor/manage-bank-balance', order: 8, active: true },
            { key: 'doctor-notifications', portalKey: 'doctor', type: 'page', label: 'Notifications', path: '/doctor/notifications', order: 9, active: true },
            { key: 'doctor-settings', portalKey: 'doctor', type: 'page', label: 'Settings', path: '/doctor/settings', order: 10, active: true }
        ];

        const financeNodes = [
            { key: 'finance-hospital-dashboard', portalKey: 'finance', type: 'page', label: 'Hospital Dashboard', path: '/finance/hospital-dashboard', order: 1, active: true },
            { key: 'finance-staff-dashboard', portalKey: 'finance', type: 'page', label: 'Staff Dashboard', path: '/finance/staff-dashboard', order: 2, active: true },
            { key: 'finance-collection-report', portalKey: 'finance', type: 'page', label: 'Collection Report', path: '/finance/collection-report', order: 3, active: true },
            { key: 'finance-doctors', portalKey: 'finance', type: 'page', label: 'Doctor Finance', path: '/finance/doctors', order: 4, active: true },
            { key: 'finance-doctor-payouts', portalKey: 'finance', type: 'page', label: 'Doctor Payouts', path: '/finance/doctor-payouts', order: 5, active: true },
            { key: 'finance-pharmacy-reports', portalKey: 'finance', type: 'page', label: 'Pharmacy Reports', path: '/finance/pharmacy-reports', order: 6, active: true },
            { key: 'finance-diagnostic-dashboard', portalKey: 'finance', type: 'page', label: 'Diagnostics Dashboard', path: '/finance/diagnostics-dashboard', order: 7, active: true },
            { key: 'finance-bank-accounts', portalKey: 'finance', type: 'page', label: 'Bank Accounts', path: '/finance/bank-accounts', order: 8, active: true },
            { key: 'finance-manage-bank-balance', portalKey: 'finance', type: 'page', label: 'Manage Bank Balance', path: '/finance/opening-balances', order: 9, active: true },
            { key: 'finance-petty-cash-accounts', portalKey: 'finance', type: 'page', label: 'Petty Cash Accounts', path: '/finance/petty-cash', order: 10, active: true },
            { key: 'finance-manage-petty-cash', portalKey: 'finance', type: 'page', label: 'Manage Petty Cash', path: '/finance/manage-petty-cash', order: 11, active: true }
        ];

        const hospitalNodes = [
            { key: 'hospital-dashboard', portalKey: 'hospital', type: 'page', label: 'Dashboard', path: '/hospital', order: 1, active: true },
            { key: 'hospital-token-gen', portalKey: 'hospital', type: 'page', label: 'Token Generator', path: '/hospital/token-generator', order: 2, active: true },
            { key: 'hospital-appointments', portalKey: 'hospital', type: 'page', label: 'Appointments', path: '/hospital/appointments', order: 3, active: true },
            { key: 'hospital-today-tokens', portalKey: 'hospital', type: 'page', label: "Today's Tokens", path: '/hospital/today-tokens', order: 4, active: true },
            { key: 'hospital-token-history', portalKey: 'hospital', type: 'page', label: 'Token History', path: '/hospital/token-history', order: 5, active: true },
            { key: 'hospital-credit-patients', portalKey: 'hospital', type: 'page', label: 'Credit Patients', path: '/hospital/credit-patients', order: 6, active: true },
            { key: 'hospital-departments', portalKey: 'hospital', type: 'page', label: 'Departments', path: '/hospital/departments', order: 7, active: true },
            { key: 'hospital-patient-history', portalKey: 'hospital', type: 'page', label: 'Patient History', path: '/hospital/search-patients', order: 8, active: true },
            { key: 'hospital-history-taking', portalKey: 'hospital', type: 'page', label: 'History Taking', path: '/hospital/history-taking', order: 9, active: true },
            { key: 'hospital-lab-reports', portalKey: 'hospital', type: 'page', label: 'Lab Reports Entry', path: '/hospital/lab-reports-entry', order: 10, active: true },
            { key: 'hospital-manage-petty-cash', portalKey: 'hospital', type: 'page', label: 'Manage Petty Cash', path: '/hospital/finance/petty-cash-balance', order: 11, active: true },
            { key: 'hospital-manage-bank-balance', portalKey: 'hospital', type: 'page', label: 'Manage Bank Balance', path: '/hospital/finance/manage-bank-balance', order: 12, active: true },
            { key: 'hospital-notifications', portalKey: 'hospital', type: 'page', label: 'Notifications', path: '/hospital/notifications', order: 13, active: true },
            { key: 'hospital-user-management', portalKey: 'hospital', type: 'page', label: 'User Management', path: '/hospital/user-management', order: 14, active: true },
            { key: 'hospital-audit-log', portalKey: 'hospital', type: 'page', label: 'Audit Log', path: '/hospital/audit', order: 15, active: true },
            { key: 'hospital-settings', portalKey: 'hospital', type: 'page', label: 'Settings', path: '/hospital/settings', order: 16, active: true },
            { key: 'hospital-backup', portalKey: 'hospital', type: 'page', label: 'Backup', path: '/hospital/backup', order: 17, active: true },
            { key: 'hospital-staff-dashboard', portalKey: 'hospital', type: 'page', label: 'Staff Dashboard', path: '/hospital/staff-dashboard', order: 18, active: true },
            { key: 'hospital-staff-attendance', portalKey: 'hospital', type: 'page', label: 'Staff Attendance', path: '/hospital/staff-attendance', order: 19, active: true },
            { key: 'hospital-staff-monthly', portalKey: 'hospital', type: 'page', label: 'Staff Monthly', path: '/hospital/staff-monthly', order: 20, active: true },
            { key: 'hospital-staff-settings', portalKey: 'hospital', type: 'page', label: 'Staff Settings', path: '/hospital/staff-settings', order: 21, active: true },
            { key: 'hospital-staff-management', portalKey: 'hospital', type: 'page', label: 'Staff Management', path: '/hospital/staff-management', order: 22, active: true },
            { key: 'hospital-doctors', portalKey: 'hospital', type: 'page', label: 'Add Doctors', path: '/hospital/doctors', order: 23, active: true },
            { key: 'hospital-doctor-schedules', portalKey: 'hospital', type: 'page', label: 'Doctor Schedules', path: '/hospital/doctor-schedules', order: 24, active: true },
            { key: 'hospital-doctors-finance', portalKey: 'hospital', type: 'page', label: 'Doctors Finance', path: '/hospital/finance/doctors', order: 25, active: true },
            { key: 'hospital-doctor-payouts', portalKey: 'hospital', type: 'page', label: 'Doctor Payouts', path: '/hospital/finance/doctor-payouts', order: 26, active: true },
            { key: 'hospital-add-expense', portalKey: 'hospital', type: 'page', label: 'Add Expense', path: '/hospital/finance/add-expense', order: 27, active: true },
            { key: 'hospital-expense-history', portalKey: 'hospital', type: 'page', label: 'Expense History', path: '/hospital/finance/expenses', order: 28, active: true },
            { key: 'hospital-transactions', portalKey: 'hospital', type: 'page', label: 'Transactions', path: '/hospital/finance/transactions', order: 29, active: true }
        ];

        const allNodes = [
            ...therapyLabNodes,
            ...therapyNodes,
            ...counsellingNodes,
            ...receptionNodes,
            ...diagnosticNodes,
            ...pharmacyNodes,
            ...doctorNodes,
            ...financeNodes,
            ...hospitalNodes
        ];

        for (const n of allNodes) {
            await HospitalAccessNode.updateOne({ key: n.key }, n, { upsert: true });
            console.log(`Upserted: ${n.key}`);
        }

        console.log('Comprehensive seed completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
}

run();
