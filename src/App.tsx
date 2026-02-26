import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Hospital_Login from './pages/hospital/hospital_Login'
import TherapyLab_Login from './pages/therapyLab/therapyLab_Login'
import TherapyLab_Layout from './pages/therapyLab/therapyLab_Layout'
import Hospital_Layout from './pages/hospital/hospital_Layout'
import TherapyLab_TokenGenerator from './pages/therapyLab/therapyLab_TokenGenerator'
import TherapyLab_Packages from './pages/therapyLab/therapyLab_MachinePackages'
import TherapyLab_Management from './pages/therapyLab/therapyLab_Management'
import ErrorBoundary from './components/ErrorBoundary'
import Hospital_BedManagement from './pages/hospital/hospital_BedManagement'
import Hospital_TokenGenerator from './pages/hospital/hospital_TokenGenerator'
import Hospital_TodayTokens from './pages/hospital/hospital_TodayTokens'
import Hospital_TokenHistory from './pages/hospital/hospital_TokenHistory'
import Hospital_Departments from './pages/hospital/hospital_Departments'
import Hospital_SearchPatients from './pages/hospital/hospital_SearchPatients'
import Hospital_UserManagement from './pages/hospital/hospital_UserManagement'
import Hospital_AuditLogs from './pages/hospital/hospital_AuditLogs'
import Hospital_Settings from './pages/hospital/hospital_Settings'
import Hospital_Backup from './pages/hospital/hospital_Backup'
import Hospital_Doctors from './pages/hospital/hospital_Doctors'
import Hospital_PatientList from './pages/hospital/hospital_PatientList.tsx'
import Hospital_PatientProfile from './pages/hospital/hospital_PatientProfile.tsx'
import Hospital_DischargeWizard from './pages/hospital/hospital_DischargeWizard.tsx'
import Hospital_Discharged from './pages/hospital/hospital_Discharged.tsx'
import Hospital_StaffAttendance from './pages/hospital/hospital_StaffAttendance.tsx'
import Hospital_StaffManagement from './pages/hospital/hospital_StaffManagement.tsx'
import Hospital_StaffSettings from './pages/hospital/hospital_StaffSettings.tsx'
import Hospital_StaffMonthly from './pages/hospital/hospital_StaffMonthly.tsx'
import Hospital_StaffDashboard from './pages/hospital/hospital_StaffDashboard.tsx'
import Hospital_Dashboard from './pages/hospital/hospital_Dashboard.tsx'
import Hospital_DoctorFinance from './pages/hospital/hospital_DoctorFinance.tsx'
import Hospital_IpdPrintReport from './pages/hospital/hospital_IpdPrintReport.tsx'
import Hospital_IPDReferrals from './pages/hospital/hospital_IPDReferrals.tsx'
import Hospital_DoctorSchedules from './pages/hospital/hospital_DoctorSchedules'
import Hospital_HistoryTaking from './pages/hospital/hospital_HistoryTaking'
import Hospital_LabReportsEntry from './pages/hospital/hospital_LabReportsEntry'
import Hospital_Appointments from './pages/hospital/hospital_Appointments'
import Hospital_ReceivedDeathList from './pages/hospital/forms/Hospital_ReceivedDeathList.tsx'
import Hospital_DeathCertificateList from './pages/hospital/forms/Hospital_DeathCertificateList.tsx'
import Hospital_BirthCertificateList from './pages/hospital/forms/Hospital_BirthCertificateList.tsx'
import Hospital_ShortStayList from './pages/hospital/forms/Hospital_ShortStayList.tsx'
import Hospital_DischargeSummaryList from './pages/hospital/forms/Hospital_DischargeSummaryList.tsx'
import Hospital_ReceivedDeathDetail from './pages/hospital/forms/Hospital_ReceivedDeathDetail.tsx'
import Hospital_DeathCertificateDetail from './pages/hospital/forms/Hospital_DeathCertificateDetail.tsx'
import Hospital_BirthCertificateDetail from './pages/hospital/forms/Hospital_BirthCertificateDetail.tsx'
import Hospital_ShortStayDetail from './pages/hospital/forms/Hospital_ShortStayDetail.tsx'
import Hospital_DischargeSummaryDetail from './pages/hospital/forms/Hospital_DischargeSummaryDetail.tsx'
import Hospital_InvoiceList from './pages/hospital/forms/Hospital_InvoiceList.tsx'
import IpdInvoiceSlip from './components/hospital/hospital_IpdInvoiceslip'
import Hospital_IpdBilling from './pages/hospital/hospital_IpdBilling'
import Hospital_CorporateDashboard from './pages/hospital/corporate/hospital_CorporateDashboard'
import Hospital_CorporateCompanies from './pages/hospital/corporate/hospital_CorporateCompanies'
import Hospital_CorporateRateRules from './pages/hospital/corporate/hospital_CorporateRateRules'
import Hospital_CorporateTransactions from './pages/hospital/corporate/hospital_CorporateTransactions'
import Hospital_CorporateClaims from './pages/hospital/corporate/hospital_CorporateClaims'
import Hospital_CorporatePayments from './pages/hospital/corporate/hospital_CorporatePayments'
import Hospital_CorporateReports from './pages/hospital/corporate/hospital_CorporateReports'
import Hospital_CreditPatients from './pages/hospital/hospital_CreditPatients'

import Doctor_Layout from './pages/doctor/doctor_Layout'
import Doctor_Login from './pages/doctor/doctor_Login'
import Doctor_Dashboard from './pages/doctor/doctor_Dashboard'
import Doctor_Patients from './pages/doctor/doctor_Patients'
import Doctor_Prescription from './pages/doctor/doctor_Prescription'
import Doctor_PrescriptionHistory from './pages/doctor/doctor_PrescriptionHistory'
import Doctor_Reports from './pages/doctor/doctor_Reports'
import Doctor_Settings from './pages/doctor/doctor_Settings'
import Doctor_PreviousHistoryView from './pages/doctor/doctor_PreviousHistoryView'
import Doctor_PreviousLabEntryView from './pages/doctor/doctor_PreviousLabEntryView'

import Lab_Login from './pages/lab/lab_Login'
import Lab_Layout from './pages/lab/lab_Layout'
import Lab_Dashboard from './pages/lab/lab_Dashboard'
import Lab_Tests from './pages/lab/lab_Tests'
import Lab_Orders from './pages/lab/lab_SampleIntake'
import Lab_Tracking from './pages/lab/lab_Tracking'
import Lab_Results from './pages/lab/lab_Results'
import Lab_ReportGenerator from './pages/lab/lab_ReportGenerator'
import Lab_Settings from './pages/lab/lab_Settings'
import Lab_Inventory from './pages/lab/lab_Inventory'
import Lab_Suppliers from './pages/lab/lab_Suppliers.tsx'
import Lab_SupplierReturns from './pages/lab/lab_SupplierReturns.tsx'
import Lab_PurchaseHistory from './pages/lab/lab_PurchaseHistory.tsx'
import Lab_ReturnHistory from './pages/lab/lab_ReturnHistory.tsx'
import Lab_UserManagement from './pages/lab/lab_UserManagement'
import Lab_Expenses from './pages/lab/lab_Expenses'
import Lab_AuditLogs from './pages/lab/lab_AuditLogs'
import Lab_Reports from './pages/lab/lab_Reports'
import Lab_StaffAttendance from './pages/lab/lab_StaffAttendance'
import Lab_StaffManagement from './pages/lab/lab_StaffManagement'
import Lab_StaffSettings from './pages/lab/lab_StaffSettings'
import Lab_StaffMonthly from './pages/lab/lab_StaffMonthly'
import Lab_Referrals from './pages/lab/lab_Referrals'
import Lab_PayInOut from './pages/lab/lab_PayInOut'
import Lab_ManagerCashCount from './pages/lab/lab_ManagerCashCount'
import Lab_BB_Donors from './pages/lab/bloodbank/Lab_BB_Donors'
import Lab_BB_Inventory from './pages/lab/bloodbank/Lab_BB_Inventory'
import Lab_BB_Receivers from './pages/lab/bloodbank/Lab_BB_Receivers'
// Removed BB Labels and Settings pages (deleted)
import Finance from './pages/Finance'
import Finance_AddExpense from './pages/hospital/hospital_AddExpense.tsx'
import Finance_Transactions from './pages/hospital/hospital_Transactions.tsx'
import Finance_ExpenseHistory from './pages/hospital/hospital_ExpenseHistory.tsx'
import Finance_Login from './pages/finance/finance_Login.tsx'
import Finance_Layout from './pages/finance/finance_Layout.tsx'
import Finance_PatientStatement from './pages/finance/finance_PatientStatement'
import Finance_OpeningBalances from './pages/finance/finance_OpeningBalances'
import Finance_ManagePettyCash from './pages/finance/finance_ManagePettyCash'
import Finance_PettyCashAccounts from './pages/finance/finance_PettyCashAccounts'
import Finance_BankAccounts from './pages/finance/finance_BankAccounts'
import Finance_CollectionReport from './pages/finance/finance_CollectionReport'
import Hospital_DoctorPayouts from './pages/hospital/hospital_DoctorPayouts'
import Hospital_PettyCashBalance from './pages/hospital/hospital_PettyCashBalance'
import Hospital_Notifications from './pages/hospital/hospital_Notifications'
import Hospital_ManageBankBalance from './pages/hospital/hospital_ManageBankBalance'
import Pharmacy_Login from './pages/pharmacy/pharmacy_Login'
import Pharmacy_Layout from './pages/pharmacy/pharmacy_Layout'
import Pharmacy_Dashboard from './pages/pharmacy/pharmacy_Dashboard'
import Pharmacy_POS from './pages/pharmacy/pharmacy_POS'
import Pharmacy_Prescriptions from './pages/pharmacy/pharmacy_Prescriptions'
import Pharmacy_PrescriptionIntake from './pages/pharmacy/pharmacy_PrescriptionIntake'
import Pharmacy_Referrals from './pages/pharmacy/pharmacy_Referrals'
import Pharmacy_Inventory from './pages/pharmacy/pharmacy_Inventory'
import Pharmacy_AddInvoicePage from './components/pharmacy/pharmacy_AddInvoicePage'
import Pharmacy_Customers from './pages/pharmacy/pharmacy_Customers'
import Pharmacy_Suppliers from './pages/pharmacy/pharmacy_Suppliers'
import Pharmacy_Companies from './pages/pharmacy/pharmacy_Companies'
import Pharmacy_Settings from './pages/pharmacy/pharmacy_Settings'
import Pharmacy_PayInOut from './pages/pharmacy/pharmacy_PayInOut'
import Pharmacy_ManagerCashCount from './pages/pharmacy/pharmacy_ManagerCashCount'
import Pharmacy_SalesHistory from './pages/pharmacy/pharmacy_SalesHistory'
import Pharmacy_PurchaseHistory from './pages/pharmacy/pharmacy_PurchaseHistory'
import Pharmacy_ReturnHistory from './pages/pharmacy/pharmacy_ReturnHistory'
import Pharmacy_Reports from './pages/pharmacy/pharmacy_Reports'
import Pharmacy_Notifications from './pages/pharmacy/pharmacy_Notifications'
import Pharmacy_AuditLogs from './pages/pharmacy/pharmacy_AuditLogs'
import Pharmacy_Expenses from './pages/pharmacy/pharmacy_Expenses'
import Pharmacy_CustomerReturns from './pages/pharmacy/pharmacy_CustomerReturns'
import Pharmacy_SupplierReturns from './pages/pharmacy/pharmacy_SupplierReturns'
import Pharmacy_Guidelines from './pages/pharmacy/pharmacy_Guidelines'
import Pharmacy_StaffSettings from './pages/pharmacy/pharmacy_StaffSettings'
import Pharmacy_StaffMonthly from './pages/pharmacy/pharmacy_StaffMonthly'
import Pharmacy_SidebarPermissions from './pages/pharmacy/pharmacy_SidebarPermissions'
import Pharmacy_PurchaseDrafts from './pages/pharmacy/pharmacy_PurchaseDrafts'
import Pharmacy_HoldSales from './pages/pharmacy/pharmacy_HoldSales'
import Diagnostic_Login from './pages/diagnostic/diagnostic_Login'
import Diagnostic_Layout from './pages/diagnostic/diagnostic_Layout'
import Diagnostic_Dashboard from './pages/diagnostic/diagnostic_Dashboard'
import Diagnostic_TokenGenerator from './pages/diagnostic/diagnostic_TokenGenerator'
import Diagnostic_Tests from './pages/diagnostic/diagnostic_Tests'
import Diagnostic_SampleTracking from './pages/diagnostic/Diagnostic_SampleTracking_Impl'
import Diagnostic_ResultEntry from './pages/diagnostic/diagnostic_ResultEntry'
import Diagnostic_ReportGenerator from './pages/diagnostic/diagnostic_ReportGenerator'
import Diagnostic_AuditLogs from './pages/diagnostic/diagnostic_AuditLogs'
import Diagnostic_Settings from './pages/diagnostic/diagnostic_Settings'
import Diagnostic_Referrals from './pages/diagnostic/diagnostic_Referrals'
import Diagnostic_Appointments from './pages/diagnostic/diagnostic_Appointments'
import Diagnostic_CreditPatients from './pages/diagnostic/diagnostic_CreditPatients'
import Reception_Login from './pages/reception/reception_Login.tsx'
import Reception_Layout from './pages/reception/reception_Layout.tsx'
import Reception_Dashboard from './pages/reception/reception_Dashboard.tsx'
import Reception_IPDBilling from './pages/reception/reception_IPDBilling'
import Reception_IPDTransactions from './pages/reception/reception_IPDTransactions'
import Aesthetic_Login from './pages/aesthetic/aesthetic_Login'
import Aesthetic_Layout from './pages/aesthetic/aesthetic_Layout'
import Aesthetic_Dashboard from './pages/aesthetic/aesthetic_Dashboard'
import Aesthetic_TokenGeneratorPage from './pages/aesthetic/aesthetic_TokenGenerator'
import Aesthetic_TokenHistoryPage from './pages/aesthetic/aesthetic_TokenHistory'
import Aesthetic_ReportsPage from './pages/aesthetic/aesthetic_Reports'
import Aesthetic_InventoryPage from './pages/aesthetic/aesthetic_Inventory'
import Aesthetic_AddInvoicePage from './components/aesthetic/aesthetic_AddInvoicePage'
import Aesthetic_ReturnHistory from './pages/aesthetic/aesthetic_ReturnHistory'
import Aesthetic_SuppliersPage from './pages/aesthetic/aesthetic_Suppliers'
import Aesthetic_Patients from './pages/aesthetic/aesthetic_Patients'
import Aesthetic_PatientProfile from './pages/aesthetic/aesthetic_PatientProfile'
import Aesthetic_ExpensesPage from './pages/aesthetic/aesthetic_Expenses'
import Aesthetic_DoctorManagementPage from './pages/aesthetic/aesthetic_DoctorManagement'
import Aesthetic_AuditLogsPage from './pages/aesthetic/aesthetic_AuditLogs'
import Aesthetic_UserManagementPage from './pages/aesthetic/aesthetic_UserManagement'
import Aesthetic_Notifications from './pages/aesthetic/aesthetic_Notifications'
import Aesthetic_SupplierReturns from './pages/aesthetic/aesthetic_SupplierReturns'
import Aesthetic_PurchaseHistory from './pages/aesthetic/aesthetic_PurchaseHistory'
import Aesthetic_Settings from './pages/aesthetic/aesthetic_Settings'
import Aesthetic_ConsentTemplates from './pages/aesthetic/aesthetic_ConsentTemplates'
import Aesthetic_ProcedureCatalog from './pages/aesthetic/aesthetic_ProcedureCatalog'
import Aesthetic_DoctorFinance from './pages/aesthetic/aesthetic_DoctorFinance'
import Aesthetic_DoctorPayouts from './pages/aesthetic/aesthetic_DoctorPayouts'

import Counselling_Login from './pages/counselling/counselling_Login'

import { hospitalApi } from './utils/api'

export default function App() {
  useEffect(() => {
    const DEFAULT_TITLE = 'MindSpire HMS'
    const DEFAULT_ICON = '/hospital_icon.ico'

    const applyBranding = (raw: any) => {
      const name = String(raw?.name || '').trim() || DEFAULT_TITLE
      try { document.title = name } catch { }

      const href = String(raw?.logoDataUrl || '').trim() || DEFAULT_ICON
      try {
        const head = document.head
        if (!head) return
        let link = head.querySelector("link[rel~='icon']") as HTMLLinkElement | null
        if (!link) {
          link = document.createElement('link')
          link.rel = 'icon'
          head.appendChild(link)
        }
        link.href = href
      } catch { }
    }

    const loadFromCache = () => {
      try {
        const raw = localStorage.getItem('hospital.settings')
        if (!raw) return
        applyBranding(JSON.parse(raw))
      } catch { }
    }

    loadFromCache()

    const onUpdated = (ev: any) => {
      applyBranding(ev?.detail)
    }
    try { window.addEventListener('hospital:settings-updated', onUpdated as any) } catch { }

    ;(async () => {
      try {
        const s: any = await hospitalApi.getSettings()
        if (s) applyBranding(s)
      } catch { }
    })()

    return () => {
      try { window.removeEventListener('hospital:settings-updated', onUpdated as any) } catch { }
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/hospital/login" element={<Hospital_Login />} />
      <Route path="/therapy-lab/login" element={<TherapyLab_Login />} />
      <Route path="/counselling/login" element={<Counselling_Login />} />
      <Route path="/therapy-lab" element={<TherapyLab_Layout />}>
        <Route index element={<Navigate to="lab-reports-entry" replace />} />
        <Route path="lab-reports-entry" element={<Hospital_LabReportsEntry />} />
        <Route path="manage-petty-cash" element={<Hospital_PettyCashBalance />} />
        <Route path="manage-bank-balance" element={<Hospital_ManageBankBalance />} />
        <Route path="notifications" element={<Hospital_Notifications />} />
        <Route
          path="token-generator"
          element={
            <ErrorBoundary
              title="Therapy Token Generator crashed"
              localStorageKeysToClear={[
                'therapyLab.therapyMachines.custom',
                'therapyLab.therapyMachines.hidden',
              ]}
            >
              <TherapyLab_TokenGenerator />
            </ErrorBoundary>
          }
        />
        <Route path="packages" element={<TherapyLab_Packages />} />
        <Route path="management" element={<TherapyLab_Management />} />
      </Route>
      <Route path="/aesthetic/login" element={<Aesthetic_Login />} />
      <Route path="/hospital" element={<Hospital_Layout />}>
        <Route index element={<Hospital_Dashboard />} />
        <Route path="today-tokens" element={<Hospital_TodayTokens />} />
        <Route path="token-history" element={<Hospital_TokenHistory />} />
        <Route path="token-generator" element={<Hospital_TokenGenerator />} />
        <Route path="credit-patients" element={<Hospital_CreditPatients />} />
        <Route path="appointments" element={<Hospital_Appointments />} />
        <Route path="departments" element={<Hospital_Departments />} />
        <Route path="bed-management" element={<Hospital_BedManagement />} />
        <Route path="history-taking" element={<Hospital_HistoryTaking />} />
        <Route path="lab-reports-entry" element={<Hospital_LabReportsEntry />} />
        <Route path="patient-list" element={<Hospital_PatientList />} />
        <Route path="patient/:id" element={<Hospital_PatientProfile />} />
        <Route path="patient/:id/print" element={<Hospital_IpdPrintReport />} />
        <Route path="ipd-referrals" element={<Hospital_IPDReferrals />} />
        <Route path="discharge/:id" element={<Hospital_DischargeWizard />} />
        <Route path="discharged" element={<Hospital_Discharged />} />
        <Route path="staff-attendance" element={<Hospital_StaffAttendance />} />
        <Route path="staff-dashboard" element={<Hospital_StaffDashboard />} />
        <Route path="staff-management" element={<Hospital_StaffManagement />} />
        <Route path="staff-settings" element={<Hospital_StaffSettings />} />
        <Route path="staff-monthly" element={<Hospital_StaffMonthly />} />
        <Route path="finance/add-expense" element={<Finance_AddExpense />} />
        <Route path="finance/transactions" element={<Finance_Transactions />} />
        <Route path="finance/expenses" element={<Finance_ExpenseHistory />} />
        <Route path="finance/petty-cash-balance" element={<Hospital_PettyCashBalance />} />
        <Route path="finance/manage-bank-balance" element={<Hospital_ManageBankBalance />} />
        <Route path="finance/doctors" element={<Hospital_DoctorFinance />} />
        <Route path="finance/doctor-payouts" element={<Hospital_DoctorPayouts />} />
        <Route path="search-patients" element={<Hospital_SearchPatients />} />
        <Route path="doctors" element={<Hospital_Doctors />} />
        <Route path="doctor-schedules" element={<Hospital_DoctorSchedules />} />
        <Route path="forms/received-deaths" element={<Hospital_ReceivedDeathList />} />
        <Route path="forms/death-certificates" element={<Hospital_DeathCertificateList />} />
        <Route path="forms/birth-certificates" element={<Hospital_BirthCertificateList />} />
        <Route path="forms/short-stays" element={<Hospital_ShortStayList />} />
        <Route path="forms/discharge-summaries" element={<Hospital_DischargeSummaryList />} />
        <Route path="forms/invoices" element={<Hospital_InvoiceList />} />
        <Route path="ipd/admissions/:id/forms/received-death" element={<Hospital_ReceivedDeathDetail />} />
        <Route path="ipd/admissions/:id/forms/death-certificate" element={<Hospital_DeathCertificateDetail />} />
        <Route path="ipd/admissions/:id/forms/birth-certificate" element={<Hospital_BirthCertificateDetail />} />
        <Route path="ipd/admissions/:id/forms/short-stay" element={<Hospital_ShortStayDetail />} />
        <Route path="ipd/admissions/:id/forms/discharge-summary" element={<Hospital_DischargeSummaryDetail />} />
        <Route path="ipd/admissions/:id/invoice" element={<IpdInvoiceSlip />} />
        <Route path="ipd/admissions/:id/billing" element={<Hospital_IpdBilling />} />
        <Route path="user-management" element={<Hospital_UserManagement />} />
        <Route path="audit" element={<Hospital_AuditLogs />} />
        <Route path="notifications" element={<Hospital_Notifications />} />
        <Route path="settings" element={<Hospital_Settings />} />
        <Route path="backup" element={<Hospital_Backup />} />
        {/* Corporate Panel */}
        <Route path="corporate" element={<Hospital_CorporateDashboard />} />
        <Route path="corporate/companies" element={<Hospital_CorporateCompanies />} />
        <Route path="corporate/rate-rules" element={<Hospital_CorporateRateRules />} />
        <Route path="corporate/transactions" element={<Hospital_CorporateTransactions />} />
        <Route path="corporate/claims" element={<Hospital_CorporateClaims />} />
        <Route path="corporate/payments" element={<Hospital_CorporatePayments />} />
        <Route path="corporate/reports" element={<Hospital_CorporateReports />} />
      </Route>
      <Route path="/aesthetic" element={<Aesthetic_Layout />}>
        <Route index element={<Aesthetic_Dashboard />} />
        <Route path="token-generator" element={<Aesthetic_TokenGeneratorPage />} />
        <Route path="token-history" element={<Aesthetic_TokenHistoryPage />} />
        <Route path="reports" element={<Aesthetic_ReportsPage />} />
        <Route path="inventory" element={<Aesthetic_InventoryPage />} />
        <Route path="inventory/add-invoice" element={<Aesthetic_AddInvoicePage />} />
        <Route path="patients" element={<Aesthetic_Patients />} />
        <Route path="patients/mrn/:mrn" element={<Aesthetic_PatientProfile />} />
        <Route path="return-history" element={<Aesthetic_ReturnHistory />} />
        <Route path="suppliers" element={<Aesthetic_SuppliersPage />} />
        <Route path="supplier-returns" element={<Aesthetic_SupplierReturns />} />
        <Route path="purchase-history" element={<Aesthetic_PurchaseHistory />} />
        <Route path="notifications" element={<Aesthetic_Notifications />} />
        <Route path="expenses" element={<Aesthetic_ExpensesPage />} />
        <Route path="doctor-management" element={<Aesthetic_DoctorManagementPage />} />
        <Route path="doctor-finance" element={<Aesthetic_DoctorFinance />} />
        <Route path="doctor-payouts" element={<Aesthetic_DoctorPayouts />} />
        <Route path="audit-logs" element={<Aesthetic_AuditLogsPage />} />
        <Route path="user-management" element={<Aesthetic_UserManagementPage />} />
        <Route path="procedure-catalog" element={<Aesthetic_ProcedureCatalog />} />
        <Route path="consent-templates" element={<Aesthetic_ConsentTemplates />} />
        <Route path="settings" element={<Aesthetic_Settings />} />
      </Route>
      <Route path="/diagnostic/login" element={<Diagnostic_Login />} />
      <Route path="/diagnostic" element={<Diagnostic_Layout />}>
        <Route index element={<Diagnostic_Dashboard />} />
        <Route path="token-generator" element={<Diagnostic_TokenGenerator />} />
        <Route path="manage-petty-cash" element={<Hospital_PettyCashBalance />} />
        <Route path="manage-bank-balance" element={<Hospital_ManageBankBalance />} />
        <Route path="notifications" element={<Hospital_Notifications />} />
        <Route path="tests" element={<Diagnostic_Tests />} />
        <Route path="sample-tracking" element={<Diagnostic_SampleTracking />} />
        <Route path="credit-patients" element={<Diagnostic_CreditPatients />} />
        <Route path="result-entry" element={<Diagnostic_ResultEntry />} />
        <Route path="report-generator" element={<Diagnostic_ReportGenerator />} />
        <Route path="appointments" element={<Diagnostic_Appointments />} />
        <Route path="referrals" element={<Diagnostic_Referrals />} />
        <Route path="user-management" element={<Navigate to="/hospital/user-management" replace />} />
        <Route path="audit-logs" element={<Diagnostic_AuditLogs />} />
        <Route path="settings" element={<Diagnostic_Settings />} />
      </Route>
      <Route path="/doctor/login" element={<Doctor_Login />} />
      <Route path="/doctor" element={<Doctor_Layout />}>
        <Route index element={<Doctor_Dashboard />} />
        <Route path="patients" element={<Doctor_Patients />} />
        <Route path="patient-search" element={<Hospital_SearchPatients />} />
        <Route path="prescription" element={<Doctor_Prescription />} />
        <Route path="previous-history/:id" element={<Doctor_PreviousHistoryView />} />
        <Route path="previous-lab-entry/:id" element={<Doctor_PreviousLabEntryView />} />
        <Route path="prescriptions" element={<Doctor_PrescriptionHistory />} />
        <Route path="prescription-history" element={<Doctor_PrescriptionHistory />} />
        <Route path="reports" element={<Doctor_Reports />} />
        <Route path="manage-petty-cash" element={<Hospital_PettyCashBalance />} />
        <Route path="manage-bank-balance" element={<Hospital_ManageBankBalance />} />
        <Route path="notifications" element={<Hospital_Notifications />} />
        <Route path="settings" element={<Doctor_Settings />} />
      </Route>
      <Route path="/lab/login" element={<Lab_Login />} />
      <Route path="/lab" element={<Lab_Layout />}>
        <Route index element={<Lab_Dashboard />} />
        <Route path="orders" element={<Lab_Orders />} />
        <Route path="tracking" element={<Lab_Tracking />} />
        <Route path="tests" element={<Lab_Tests />} />
        <Route path="results" element={<Lab_Results />} />
        <Route path="referrals" element={<Lab_Referrals />} />
        <Route path="reports" element={<Lab_ReportGenerator />} />
        <Route path="reports-summary" element={<Lab_Reports />} />
        <Route path="inventory" element={<Lab_Inventory />} />
        <Route path="suppliers" element={<Lab_Suppliers />} />
        <Route path="supplier-returns" element={<Lab_SupplierReturns />} />
        <Route path="return-history" element={<Lab_ReturnHistory />} />
        <Route path="purchase-history" element={<Lab_PurchaseHistory />} />
        <Route path="user-management" element={<Lab_UserManagement />} />
        <Route path="staff-attendance" element={<Lab_StaffAttendance />} />
        <Route path="staff-management" element={<Lab_StaffManagement />} />
        <Route path="staff-settings" element={<Lab_StaffSettings />} />
        <Route path="staff-monthly" element={<Lab_StaffMonthly />} />
        <Route path="expenses" element={<Lab_Expenses />} />
        <Route path="audit-logs" element={<Lab_AuditLogs />} />
        <Route path="pay-in-out" element={<Lab_PayInOut />} />
        <Route path="manager-cash-count" element={<Lab_ManagerCashCount />} />
        <Route path="settings" element={<Lab_Settings />} />
        {/* Blood Bank */}
        <Route path="bb/donors" element={<Lab_BB_Donors />} />
        <Route path="bb/inventory" element={<Lab_BB_Inventory />} />
        <Route path="bb/receivers" element={<Lab_BB_Receivers />} />
        {/* BB reports-labels and settings routes removed */}
      </Route>
      <Route path="/pharmacy/login" element={<Pharmacy_Login />} />
      <Route path="/pharmacy" element={<Pharmacy_Layout />}>
        <Route index element={<Pharmacy_Dashboard />} />
        <Route path="pos" element={<Pharmacy_POS />} />
        <Route path="manage-petty-cash" element={<Hospital_PettyCashBalance />} />
        <Route path="manage-bank-balance" element={<Hospital_ManageBankBalance />} />
        <Route path="prescriptions" element={<Pharmacy_Prescriptions />} />
        <Route path="referrals" element={<Pharmacy_Referrals />} />
        <Route path="prescriptions/:id" element={<Pharmacy_PrescriptionIntake />} />
        <Route path="inventory" element={<Pharmacy_Inventory />} />
        <Route path="inventory/add-invoice" element={<Pharmacy_AddInvoicePage />} />
        <Route path="inventory/edit-invoice/:id" element={<Pharmacy_AddInvoicePage />} />
        <Route path="customers" element={<Pharmacy_Customers />} />
        <Route path="suppliers" element={<Pharmacy_Suppliers />} />
        <Route path="companies" element={<Pharmacy_Companies />} />
        <Route path="sales-history" element={<Pharmacy_SalesHistory />} />
        <Route path="purchase-history" element={<Pharmacy_PurchaseHistory />} />
        <Route path="return-history" element={<Pharmacy_ReturnHistory />} />
        <Route path="reports" element={<Pharmacy_Reports />} />
        <Route path="notifications" element={<Pharmacy_Notifications />} />
        <Route path="supplier-returns" element={<Pharmacy_SupplierReturns />} />
        <Route path="customer-returns" element={<Pharmacy_CustomerReturns />} />
        <Route path="staff-settings" element={<Pharmacy_StaffSettings />} />
        <Route path="staff-monthly" element={<Pharmacy_StaffMonthly />} />
        <Route path="purchase-drafts" element={<Pharmacy_PurchaseDrafts />} />
        <Route path="hold-sales" element={<Pharmacy_HoldSales />} />
        <Route path="guidelines" element={<Pharmacy_Guidelines />} />
        <Route path="settings" element={<Pharmacy_Settings />} />
        <Route path="sidebar-permissions" element={<Pharmacy_SidebarPermissions />} />
        <Route path="user-management" element={<Navigate to="/hospital/user-management" replace />} />
        <Route path="audit-logs" element={<Pharmacy_AuditLogs />} />
        <Route path="expenses" element={<Pharmacy_Expenses />} />
        <Route path="pay-in-out" element={<Pharmacy_PayInOut />} />
        <Route path="manager-cash-count" element={<Pharmacy_ManagerCashCount />} />
        <Route path="returns" element={<Pharmacy_CustomerReturns />} />
      </Route>
      <Route path="/finance/login" element={<Finance_Login />} />
      <Route path="/finance" element={<Finance_Layout />}>
        <Route index element={<Finance />} />
        <Route path="patient-statement" element={<Finance_PatientStatement />} />
        <Route path="opening-balances" element={<Finance_OpeningBalances />} />
        <Route path="manage-petty-cash" element={<Finance_ManagePettyCash />} />
        <Route path="petty-cash" element={<Finance_PettyCashAccounts />} />
        <Route path="bank-accounts" element={<Finance_BankAccounts />} />
        <Route path="collection-report" element={<Finance_CollectionReport />} />
        <Route path="notifications" element={<Hospital_Notifications />} />
        <Route path="add-expense" element={<Finance_AddExpense />} />
        <Route path="transactions" element={<Finance_Transactions />} />
        <Route path="expenses" element={<Finance_ExpenseHistory />} />
        <Route path="doctors" element={<Hospital_DoctorFinance />} />
        <Route path="doctor-payouts" element={<Hospital_DoctorPayouts />} />
        <Route path="pharmacy-reports" element={<Pharmacy_Reports />} />
        <Route path="lab-reports" element={<Lab_Reports />} />
        <Route path="diagnostics-dashboard" element={<Diagnostic_Dashboard />} />
        <Route path="staff-dashboard" element={<Hospital_StaffDashboard />} />
        <Route path="hospital-dashboard" element={<Hospital_Dashboard />} />
        <Route path="manage-bank-balance" element={<Hospital_ManageBankBalance />} />
      </Route>
      <Route path="/reception/login" element={<Reception_Login />} />
      <Route path="/reception" element={<Reception_Layout />}>
        <Route index element={<Reception_Dashboard />} />
        <Route path="token-generator" element={<Hospital_TokenGenerator />} />
        <Route path="today-tokens" element={<Hospital_TodayTokens />} />
        <Route path="token-history" element={<Hospital_TokenHistory />} />
        <Route path="credit-patients" element={<Hospital_CreditPatients />} />
        <Route path="diagnostic/credit-patients" element={<Diagnostic_CreditPatients />} />
        <Route path="appointments" element={<Hospital_Appointments />} />
        <Route path="search-patients" element={<Hospital_SearchPatients />} />
        <Route path="lab-reports-entry" element={<Hospital_LabReportsEntry />} />
        <Route path="history-taking" element={<Hospital_HistoryTaking />} />
        <Route path="manage-petty-cash" element={<Hospital_PettyCashBalance />} />
        <Route path="manage-bank-balance" element={<Hospital_ManageBankBalance />} />
        <Route path="notifications" element={<Hospital_Notifications />} />
        <Route path="ipd-billing" element={<Reception_IPDBilling />} />
        <Route path="ipd-transactions" element={<Reception_IPDTransactions />} />
        <Route path="diagnostic/token-generator" element={<Diagnostic_TokenGenerator />} />
        <Route path="diagnostic/sample-tracking" element={<Diagnostic_SampleTracking />} />
        <Route path="diagnostic/appointments" element={<Diagnostic_Appointments />} />
      </Route>
    </Routes>
  )
}




