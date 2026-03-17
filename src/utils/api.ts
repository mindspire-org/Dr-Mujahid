const rawBase = (import.meta as any).env?.VITE_API_URL as string | undefined
const baseURL = rawBase
  ? (/^https?:/i.test(rawBase) ? rawBase : `http://127.0.0.1:4000${rawBase}`)
  : 'http://127.0.0.1:4000/api'

function getToken(path?: string) {
  try {
    if (path) {
      if (path.startsWith('/hospital')) {
        const hospitalToken = localStorage.getItem('hospital.token')
        if (hospitalToken) return hospitalToken

        // Allow doctor portal to call shared hospital endpoints using doctor token
        if (localStorage.getItem('doctor.session')) {
          const doctorToken = localStorage.getItem('doctor.token')
          if (doctorToken) return doctorToken
        }

        // Allow finance portal to call shared hospital endpoints using finance token
        if (localStorage.getItem('finance.session')) {
          const financeToken = localStorage.getItem('finance.token')
          if (financeToken) return financeToken
        }

        // Allow reception portal to call shared hospital endpoints using reception token
        if (localStorage.getItem('reception.session')) {
          const receptionToken = localStorage.getItem('reception.token')
          if (receptionToken) return receptionToken
        }

        return localStorage.getItem('token') || ''
      }
      if (path.startsWith('/doctor')) return localStorage.getItem('doctor.token') || localStorage.getItem('hospital.token') || localStorage.getItem('token') || ''
      if (path.startsWith('/diagnostic')) {
        const diagnosticToken = localStorage.getItem('diagnostic.token')
        if (diagnosticToken) return diagnosticToken

        // Allow doctor portal to access diagnostic endpoints using doctor token
        if (localStorage.getItem('doctor.session')) {
          const doctorToken = localStorage.getItem('doctor.token')
          if (doctorToken) return doctorToken
        }

        // Allow reception portal to access diagnostic endpoints using reception token
        if (localStorage.getItem('reception.session')) {
          const receptionToken = localStorage.getItem('reception.token')
          if (receptionToken) return receptionToken
        }

        // Allow hospital portal token for diagnostic endpoints (legacy/shared)
        const hospitalToken = localStorage.getItem('hospital.token')
        if (hospitalToken) return hospitalToken

        // Fallback legacy token key
        return localStorage.getItem('token') || ''
      }
      if (path.startsWith('/lab')) {
        const labToken = localStorage.getItem('lab.token')
        if (labToken) return labToken
        
        // Allow doctor portal to access lab endpoints using doctor token
        if (localStorage.getItem('doctor.session')) {
          const doctorToken = localStorage.getItem('doctor.token')
          if (doctorToken) return doctorToken
        }

        const hospitalToken = localStorage.getItem('hospital.token')
        if (hospitalToken) return hospitalToken

        return localStorage.getItem('aesthetic.token') || localStorage.getItem('token') || ''
      }
      if (path.startsWith('/aesthetic')) return localStorage.getItem('aesthetic.token') || localStorage.getItem('token') || ''
      if (path.startsWith('/pharmacy')) return localStorage.getItem('pharmacy.token') || localStorage.getItem('token') || ''
      if (path.startsWith('/therapy')) return localStorage.getItem('therapy.token') || localStorage.getItem('token') || ''
      if (path.startsWith('/finance')) return localStorage.getItem('finance.token') || localStorage.getItem('hospital.token') || localStorage.getItem('token') || ''
      if (path.startsWith('/reception')) return localStorage.getItem('reception.token') || localStorage.getItem('hospital.token') || localStorage.getItem('token') || ''
    }
    // Fallback legacy token key
    return localStorage.getItem('token') || ''
  } catch { return '' }
}

function getAdminKey() {
  try {
    const raw = localStorage.getItem('hospital_backup_settings')
    if (!raw) return ''
    const s = JSON.parse(raw)
    return s?.adminKey || ''
  } catch { return '' }
}

export const adminApi = {
  exportAll: async () => api('/admin/backup/export', { headers: { 'x-admin-key': getAdminKey() } }),
  getBackupSettings: async () => api('/admin/backup/settings', { headers: { 'x-admin-key': getAdminKey() } }),
  updateBackupSettings: async (data: { enabled: boolean; intervalMinutes: number; folderPath: string }) =>
    api('/admin/backup/settings', { method: 'PUT', body: JSON.stringify(data), headers: { 'x-admin-key': getAdminKey() } }),
  runBackupToDisk: async () => api('/admin/backup/run', { method: 'POST', headers: { 'x-admin-key': getAdminKey() } }),
  restoreAll: async (data: any) => api('/admin/backup/restore', { method: 'POST', body: JSON.stringify({ ...data, confirm: 'RESTORE' }), headers: { 'x-admin-key': getAdminKey() } }),
  purgeAll: async () => api('/admin/backup/purge', { method: 'POST', body: JSON.stringify({ confirm: 'PURGE' }), headers: { 'x-admin-key': getAdminKey() } }),
}

export const diagnosticApi = {
  // Tests (Catalog for Diagnostics)
  listTests: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/tests${s ? `?${s}` : ''}`)
  },

  // Appointments
  listAppointments: (params?: { from?: string; to?: string; paymentStatus?: 'paid' | 'unpaid'; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.paymentStatus) qs.set('paymentStatus', params.paymentStatus)
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/appointments${s ? `?${s}` : ''}`)
  },
  getAppointment: (id: string) => api(`/diagnostic/appointments/${encodeURIComponent(id)}`),
  createAppointment: (data: any) => api('/diagnostic/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: any) => api(`/diagnostic/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAppointment: (id: string) => api(`/diagnostic/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Cash Movements (Pay In/Out)
  listCashMovements: (params?: { from?: string; to?: string; type?: 'IN' | 'OUT'; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.type) qs.set('type', params.type)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/cash-movements${s ? `?${s}` : ''}`)
  },
  createCashMovement: (data: { date: string; type: 'IN' | 'OUT'; category?: string; amount: number; receiver?: string; handoverBy?: string; note?: string }) =>
    api('/lab/cash-movements', { method: 'POST', body: JSON.stringify(data) }),
  deleteCashMovement: (id: string) => api(`/lab/cash-movements/${id}`, { method: 'DELETE' }),
  cashMovementSummary: (params?: { from?: string; to?: string; type?: 'IN' | 'OUT' }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.type) qs.set('type', params.type)
    const s = qs.toString()
    return api(`/lab/cash-movements/summary${s ? `?${s}` : ''}`)
  },

  // Manager Cash Count
  listCashCounts: (params?: { from?: string; to?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/cash-counts${s ? `?${s}` : ''}`)
  },
  createCashCount: (data: { date: string; amount: number; receiver?: string; handoverBy?: string; note?: string }) =>
    api('/lab/cash-counts', { method: 'POST', body: JSON.stringify(data) }),
  deleteCashCount: (id: string) => api(`/lab/cash-counts/${id}`, { method: 'DELETE' }),
  cashCountSummary: (params?: { from?: string; to?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    const s = qs.toString()
    return api(`/lab/cash-counts/summary${s ? `?${s}` : ''}`)
  },


  createTest: (data: { name: string; price?: number }) => api('/diagnostic/tests', { method: 'POST', body: JSON.stringify(data) }),
  updateTest: (id: string, data: { name?: string; price?: number }) => api(`/diagnostic/tests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTest: (id: string) => api(`/diagnostic/tests/${id}`, { method: 'DELETE' }),

  // Orders (Samples)
  listOrders: (params?: { q?: string; status?: 'received' | 'completed' | 'returned'; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/orders${s ? `?${s}` : ''}`)
  },
  createOrder: (data: {
    patientId: string
    patient: { mrn?: string; fullName: string; phone?: string; age?: string; gender?: string; address?: string; guardianRelation?: string; guardianName?: string; cnic?: string }
    tests: string[]
    subtotal?: number
    discount?: number
    net?: number
    payPreviousDues?: boolean
    useAdvance?: boolean
    amountReceived?: number
    paymentStatus?: 'paid' | 'unpaid'
    receptionistName?: string
    paymentMethod?: 'Cash' | 'Card'
    accountNumberIban?: string
    receivedToAccountCode?: string
    referringConsultant?: string
    tokenNo?: string
    corporateId?: string
    corporatePreAuthNo?: string
    corporateCoPayPercent?: number
    corporateCoverageCap?: number
  }) =>
    api('/diagnostic/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: { tests?: string[]; patient?: { mrn?: string; fullName?: string; phone?: string; age?: string; gender?: string; address?: string; guardianRelation?: string; guardianName?: string; cnic?: string }; subtotal?: number; discount?: number; discountInput?: number; discountType?: 'PKR' | '%'; net?: number; amountReceived?: number; paidForToday?: number }) =>
    api(`/diagnostic/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrderTrack: (id: string, data: { sampleTime?: string; reportingTime?: string; status?: 'received' | 'completed' | 'returned'; referringConsultant?: string }) =>
    api(`/diagnostic/orders/${id}/track`, { method: 'PUT', body: JSON.stringify(data) }),
  payOrder: (id: string, data: { receptionistName?: string; paymentMethod: 'Cash' | 'Card'; accountNumberIban?: string; receivedToAccountCode?: string }) =>
    api(`/diagnostic/orders/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
  // Per-test item operations
  updateOrderItemTrack: (id: string, testId: string, data: { sampleTime?: string; reportingTime?: string; status?: 'received' | 'completed' | 'returned'; referringConsultant?: string }) =>
    api(`/diagnostic/orders/${id}/items/${encodeURIComponent(testId)}/track`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrderItem: (id: string, testId: string) =>
    api(`/diagnostic/orders/${id}/items/${encodeURIComponent(testId)}`, { method: 'DELETE' }),
  deleteOrder: (id: string) => api(`/diagnostic/orders/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => api('/diagnostic/settings'),
  updateSettings: (data: { diagnosticName?: string; phone?: string; address?: string; email?: string; reportFooter?: string; logoDataUrl?: string; department?: string; consultantName?: string; consultantDegrees?: string; consultantTitle?: string; consultants?: Array<{ name?: string; degrees?: string; title?: string }> }) =>
    api('/diagnostic/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Results
  listResults: (params?: { orderId?: string; testId?: string; status?: 'draft' | 'final'; q?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.orderId) qs.set('orderId', params.orderId)
    if (params?.testId) qs.set('testId', params.testId)
    if (params?.status) qs.set('status', params.status)
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/results${s ? `?${s}` : ''}`)
  },
  getResult: (id: string) => api(`/diagnostic/results/${id}`),
  createResult: (data: { orderId: string; testId: string; testName: string; tokenNo?: string; patient?: any; formData?: any; images?: string[]; status?: 'draft' | 'final'; reportedBy?: string; reportedAt?: string; templateVersion?: string; notes?: string }) =>
    api('/diagnostic/results', { method: 'POST', body: JSON.stringify(data) }),
  updateResult: (id: string, data: { formData?: any; images?: string[]; status?: 'draft' | 'final'; reportedBy?: string; reportedAt?: string; notes?: string; patient?: any }) =>
    api(`/diagnostic/results/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteResult: (id: string) => api(`/diagnostic/results/${id}`, { method: 'DELETE' }),
  // Audit Logs
  listAuditLogs: (params?: { search?: string; action?: string; subjectType?: string; subjectId?: string; actorUsername?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.action) qs.set('action', params.action)
    if (params?.subjectType) qs.set('subjectType', params.subjectType)
    if (params?.subjectId) qs.set('subjectId', params.subjectId)
    if (params?.actorUsername) qs.set('actorUsername', params.actorUsername)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/audit-logs${s ? `?${s}` : ''}`)
  },
  createAuditLog: (data: { action: string; subjectType?: string; subjectId?: string; message?: string; data?: any }) => api('/diagnostic/audit-logs', { method: 'POST', body: JSON.stringify(data) }),

  // Dashboard
  getDashboardSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/diagnostic/dashboard/summary${s ? `?${s}` : ''}`)
  },
  // Auth
  login: (username: string, password: string) => api('/diagnostic/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => api('/diagnostic/logout', { method: 'POST' }),

  // Users
  listUsers: () => api('/diagnostic/users'),
  createUser: (data: any) => api('/diagnostic/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => api(`/diagnostic/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => api(`/diagnostic/users/${id}`, { method: 'DELETE' }),

  // Patients (shared Lab_Patient; diagnostic-scoped access)
  searchPatients: (params?: { phone?: string; name?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.name) qs.set('name', params.name)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/patients/search${s ? `?${s}` : ''}`)
  },
  findOrCreatePatient: (data: { fullName: string; guardianName?: string; phone?: string; cnic?: string; gender?: string; address?: string; age?: string; guardianRel?: string; selectId?: string }) =>
    api('/diagnostic/patients/find-or-create', { method: 'POST', body: JSON.stringify(data) }),
  getPatientByMrn: (mrn: string) => {
    const qs = new URLSearchParams()
    qs.set('mrn', mrn)
    return api(`/diagnostic/patients/by-mrn?${qs.toString()}`)
  },
  updatePatient: (id: string, data: { fullName?: string; fatherName?: string; gender?: string; address?: string; phone?: string; cnic?: string; guardianRel?: string }) =>
    api(`/diagnostic/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Accounts (dues/advance)
  getAccount: (patientId: string) => api(`/diagnostic/accounts/${encodeURIComponent(patientId)}`),

  payCreditPatient: (patientId: string, data: { amount: number; currentDues?: number; paymentMethod: 'Cash' | 'Card'; receivedToAccountCode: string; accountNumberIban?: string; receptionistName?: string; note?: string }) =>
    api(`/diagnostic/accounts/${encodeURIComponent(patientId)}/pay`, { method: 'POST', body: JSON.stringify(data) }),

  // Credit Patients (dues/advance remaining OR unpaid orders)
  listCreditPatients: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/diagnostic/credit-patients${s ? `?${s}` : ''}`)
  },
}

export const corporateApi = {
  listCompanies: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/corporate/companies${s ? `?${s}` : ''}`)
  },
  createCompany: (data: { name: string; code?: string; contactName?: string; phone?: string; email?: string; address?: string; terms?: string; billingCycle?: string; active?: boolean }) =>
    api('/corporate/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: { name?: string; code?: string; contactName?: string; phone?: string; email?: string; address?: string; terms?: string; billingCycle?: string; active?: boolean }) =>
    api(`/corporate/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompany: (id: string) => api(`/corporate/companies/${id}`, { method: 'DELETE' }),
  listRateRules: (params?: { companyId?: string; scope?: 'OPD' | 'LAB' | 'DIAG' | 'IPD'; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.companyId) qs.set('companyId', params.companyId)
    if (params?.scope) qs.set('scope', params.scope)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/corporate/rate-rules${s ? `?${s}` : ''}`)
  },
  createRateRule: (data: { companyId: string; scope: 'OPD' | 'LAB' | 'DIAG' | 'IPD'; ruleType: 'default' | 'department' | 'doctor' | 'test' | 'testGroup' | 'procedure' | 'service' | 'bedCategory'; refId?: string; visitType?: 'new' | 'followup' | 'any'; mode: 'fixedPrice' | 'percentDiscount' | 'fixedDiscount'; value: number; priority?: number; effectiveFrom?: string; effectiveTo?: string; active?: boolean }) =>
    api('/corporate/rate-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRateRule: (id: string, data: Partial<{ companyId: string; scope: 'OPD' | 'LAB' | 'DIAG' | 'IPD'; ruleType: 'default' | 'department' | 'doctor' | 'test' | 'testGroup' | 'procedure' | 'service' | 'bedCategory'; refId?: string; visitType?: 'new' | 'followup' | 'any'; mode: 'fixedPrice' | 'percentDiscount' | 'fixedDiscount'; value: number; priority?: number; effectiveFrom?: string; effectiveTo?: string; active?: boolean }>) =>
    api(`/corporate/rate-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRateRule: (id: string) => api(`/corporate/rate-rules/${id}`, { method: 'DELETE' }),
  reportsOutstanding: (params?: { companyId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.companyId) qs.set('companyId', params.companyId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/corporate/reports/outstanding${s ? `?${s}` : ''}`)
  },
  reportsAging: (params?: { companyId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.companyId) qs.set('companyId', params.companyId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/corporate/reports/aging${s ? `?${s}` : ''}`)
  },
  // Transactions
  listTransactions: (params?: { companyId?: string; serviceType?: 'OPD' | 'LAB' | 'DIAG' | 'IPD'; refType?: 'opd_token' | 'lab_order' | 'diag_order' | 'ipd_billing_item'; refId?: string; status?: 'accrued' | 'claimed' | 'paid' | 'reversed' | 'rejected'; patientMrn?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.companyId) qs.set('companyId', params.companyId)
    if (params?.serviceType) qs.set('serviceType', params.serviceType)
    if (params?.refType) qs.set('refType', params.refType)
    if (params?.refId) qs.set('refId', params.refId)
    if (params?.status) qs.set('status', params.status)
    if (params?.patientMrn) qs.set('patientMrn', params.patientMrn)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/corporate/transactions${s ? `?${s}` : ''}`)
  },
  // Claims
  listClaims: (params?: { companyId?: string; status?: 'open' | 'locked' | 'exported' | 'partially-paid' | 'paid' | 'rejected'; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.companyId) qs.set('companyId', params.companyId)
    if (params?.status) qs.set('status', params.status)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/corporate/claims${s ? `?${s}` : ''}`)
  },
  getClaim: (id: string) => api(`/corporate/claims/${id}`),
  generateClaim: (data: { companyId: string; fromDate?: string; toDate?: string; patientMrn?: string; departmentId?: string; serviceType?: 'OPD' | 'LAB' | 'DIAG' | 'IPD'; refType?: 'opd_token' | 'lab_order' | 'diag_order' | 'ipd_billing_item' }) =>
    api('/corporate/claims/generate', { method: 'POST', body: JSON.stringify(data) }),
  lockClaim: (id: string) => api(`/corporate/claims/${id}/lock`, { method: 'POST' }),
  unlockClaim: (id: string) => api(`/corporate/claims/${id}/unlock`, { method: 'POST' }),
  // Some backends expose different routes for deletion. Try multiple patterns.
  deleteClaim: async (id: string) => {
    const attempts: Array<{ path: string; init?: RequestInit }> = [
      { path: `/corporate/claims/${id}`, init: { method: 'DELETE' } },
      { path: `/corporate/claims/${id}/delete`, init: { method: 'POST' } },
      { path: `/corporate/claims/delete`, init: { method: 'POST', body: JSON.stringify({ id }) } },
      { path: `/corporate/claim/${id}`, init: { method: 'DELETE' } },
      { path: `/corporate/claim/${id}/delete`, init: { method: 'POST' } },
      { path: `/corporate/claim/delete`, init: { method: 'POST', body: JSON.stringify({ id }) } },
      { path: `/corporate/claims/${id}`, init: { method: 'POST', headers: { 'X-HTTP-Method-Override': 'DELETE' } } },
      { path: `/corporate/claims/${id}/remove`, init: { method: 'POST' } },
      { path: `/corporate/claims/remove`, init: { method: 'POST', body: JSON.stringify({ id }) } },
    ]
    let lastErr: any
    for (const a of attempts) {
      try { return await api(a.path, a.init) } catch (e) { lastErr = e }
    }
    throw lastErr || new Error('Failed to delete claim')
  },
  exportClaimUrl: (id: string) => `${(import.meta as any).env?.VITE_API_URL || ((typeof window !== 'undefined' && (window.location?.protocol === 'file:' || /Electron/i.test(navigator.userAgent || ''))) ? 'http://127.0.0.1:4000/api' : 'http://127.0.0.1:4000/api')}/corporate/claims/${encodeURIComponent(id)}/export`,
  // Payments
  listPayments: (params?: { companyId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.companyId) qs.set('companyId', params.companyId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/corporate/payments${s ? `?${s}` : ''}`)
  },
  getPayment: (id: string) => api(`/corporate/payments/${id}`),
  createPayment: (data: { companyId: string; dateIso: string; amount: number; refNo?: string; notes?: string; allocations?: Array<{ transactionId: string; amount: number }> }) => api('/corporate/payments', { method: 'POST', body: JSON.stringify(data) }),
}

export async function api(path: string, init?: RequestInit) {
  const token = getToken(path)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as any || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = `${baseURL}${path}`
  let res: Response
  try {
    res = await fetch(url, { ...init, headers })
  } catch {
    throw new Error(`Failed to fetch: ${url}`)
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res.text()
}

export const pharmacyApi = {
  // Settings
  getSettings: () => api('/pharmacy/settings'),
  updateSettings: (data: any) => api('/pharmacy/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getSystemSettings: () => api('/pharmacy/system-settings'),
  updateSystemSettings: (data: any) => api('/pharmacy/system-settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Companies
  listCompanies: (params?: { q?: string; page?: number; limit?: number; distributorId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.distributorId) qs.set('distributorId', String(params.distributorId))
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/companies${s ? `?${s}` : ''}`)
  },
  createCompany: (data: any) => api('/pharmacy/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: any) => api(`/pharmacy/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompany: (id: string) => api(`/pharmacy/companies/${id}`, { method: 'DELETE' }),

  // Suppliers
  listSuppliers: (params?: string | { q?: string; page?: number; limit?: number }) => {
    if (typeof params === 'string') {
      return api(`/pharmacy/suppliers?q=${encodeURIComponent(params)}`)
    }
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/suppliers${s ? `?${s}` : ''}`)
  },
  createSupplier: (data: any) => api('/pharmacy/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) => api(`/pharmacy/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => api(`/pharmacy/suppliers/${id}`, { method: 'DELETE' }),
  recordSupplierPayment: (id: string, data: { amount: number; purchaseId?: string; method?: string; note?: string; date?: string }) => api(`/pharmacy/suppliers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  listSupplierPurchases: (id: string) => api(`/pharmacy/suppliers/${id}/purchases`),

  // Supplier-Company assignments
  listSupplierCompanies: (supplierId: string) => api(`/pharmacy/suppliers/${supplierId}/companies`),
  assignSupplierCompanies: (supplierId: string, data: { companyIds?: string[]; unassignIds?: string[] }) =>
    api(`/pharmacy/suppliers/${supplierId}/companies`, { method: 'POST', body: JSON.stringify(data) }),

  // Customers
  listCustomers: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/customers${s ? `?${s}` : ''}`)
  },
  createCustomer: (data: any) => api('/pharmacy/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) => api(`/pharmacy/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => api(`/pharmacy/customers/${id}`, { method: 'DELETE' }),
  recordCustomerPayment: (id: string, data: { amount: number; saleId?: string; method?: string; note?: string; date?: string }) =>
    api(`/pharmacy/customers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),

  listCustomerPayments: (id: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/customers/${id}/payments${s ? `?${s}` : ''}`)
  },

  // Expenses
  listExpenses: (params?: { from?: string; to?: string; minAmount?: number; search?: string; type?: string; page?: number; limit?: number; }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.minAmount != null) qs.set('minAmount', String(params.minAmount))
    if (params?.search) qs.set('search', params.search)
    if (params?.type) qs.set('type', params.type)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/expenses${s ? `?${s}` : ''}`)
  },
  createExpense: (data: any) => api('/pharmacy/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => api(`/pharmacy/expenses/${id}`, { method: 'DELETE' }),
  expensesSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/pharmacy/expenses/summary${s ? `?${s}` : ''}`)
  },

  // Cash Movements (Pay In/Out)
  listCashMovements: (params?: { from?: string; to?: string; type?: 'IN' | 'OUT'; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.type) qs.set('type', params.type)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/cash-movements${s ? `?${s}` : ''}`)
  },
  createCashMovement: (data: { date: string; type: 'IN' | 'OUT'; category?: string; amount: number; receiver?: string; handoverBy?: string; note?: string }) =>
    api('/pharmacy/cash-movements', { method: 'POST', body: JSON.stringify(data) }),
  deleteCashMovement: (id: string) => api(`/pharmacy/cash-movements/${id}`, { method: 'DELETE' }),
  cashMovementSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/pharmacy/cash-movements/summary${s ? `?${s}` : ''}`)
  },

  // Manager Cash Count
  listCashCounts: (params?: { from?: string; to?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/cash-counts${s ? `?${s}` : ''}`)
  },
  createCashCount: (data: { date: string; amount: number; receiver?: string; handoverBy?: string; note?: string }) =>
    api('/pharmacy/cash-counts', { method: 'POST', body: JSON.stringify(data) }),
  deleteCashCount: (id: string) => api(`/pharmacy/cash-counts/${id}`, { method: 'DELETE' }),
  cashCountSummary: (params?: { from?: string; to?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    const s = qs.toString()
    return api(`/pharmacy/cash-counts/summary${s ? `?${s}` : ''}`)
  },

  // Medicines (suggestions for POS / inventory) — backed by inventory search
  searchMedicines: async (q?: string, limit?: number) => {
    const qs = new URLSearchParams()
    if (q) qs.set('search', q)
    qs.set('limit', String(limit || 20))
    const res: any = await api(`/pharmacy/inventory${qs.toString() ? `?${qs}` : ''}`)
    const items: any[] = res?.items ?? res ?? []
    return { suggestions: items.map((it: any) => ({ id: String(it._id || it.key || it.name || ''), name: String(it.name || '') })) }
  },
  // Preload medicines list (for autocomplete warmup)
  getAllMedicines: async () => {
    const qs = new URLSearchParams(); qs.set('limit', '2000')
    const res: any = await api(`/pharmacy/inventory?${qs}`)
    const items: any[] = res?.items ?? res ?? []
    return { medicines: items.map((it: any) => ({ id: String(it._id || it.key || it.name || ''), name: String(it.name || '') })) }
  },
  createMedicine: (data: any) => api('/pharmacy/medicines', { method: 'POST', body: JSON.stringify(data) }),

  // Shifts
  listShifts: () => api('/pharmacy/shifts'),
  createShift: (data: any) => api('/pharmacy/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShift: (id: string, data: any) => api(`/pharmacy/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShift: (id: string) => api(`/pharmacy/shifts/${id}`, { method: 'DELETE' }),

  // Staff
  listStaff: (params?: { q?: string; shiftId?: string; page?: number; limit?: number } | string) => {
    if (typeof params === 'string') {
      return api(`/pharmacy/staff?q=${encodeURIComponent(params)}`)
    }
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.shiftId) qs.set('shiftId', params.shiftId)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/staff${s ? `?${s}` : ''}`)
  },
  createStaff: (data: any) => api('/pharmacy/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: string, data: any) => api(`/pharmacy/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id: string) => api(`/pharmacy/staff/${id}`, { method: 'DELETE' }),
  deleteSale: (id: string) => api(`/pharmacy/sales/${id}`, { method: 'DELETE' }),

  // Hold Sales (server-side held bills)
  listHoldSales: () => api('/pharmacy/hold-sales'),
  getHoldSale: (id: string) => api(`/pharmacy/hold-sales/${id}`),
  createHoldSale: (data: { billDiscountPct?: number; lines: Array<{ medicineId: string; name: string; unitPrice: number; qty: number; discountRs?: number }> }) =>
    api('/pharmacy/hold-sales', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoldSale: (id: string) => api(`/pharmacy/hold-sales/${id}`, { method: 'DELETE' }),

  // Attendance
  listAttendance: (params?: { date?: string; shiftId?: string; staffId?: string; from?: string; to?: string; page?: number; limit?: number; }) => {
    const qs = new URLSearchParams()
    if (params?.date) qs.set('date', params.date)
    if (params?.shiftId) qs.set('shiftId', params.shiftId)
    if (params?.staffId) qs.set('staffId', params.staffId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/attendance${s ? `?${s}` : ''}`)
  },
  upsertAttendance: (data: any) => api('/pharmacy/attendance', { method: 'POST', body: JSON.stringify(data) }),

  // Staff Earnings
  listStaffEarnings: (params?: { staffId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.staffId) qs.set('staffId', params.staffId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/staff-earnings${s ? `?${s}` : ''}`)
  },
  createStaffEarning: (data: { staffId: string; date: string; category: 'Bonus' | 'Award' | 'LumpSum' | 'RevenueShare'; amount?: number; rate?: number; base?: number; notes?: string }) =>
    api('/pharmacy/staff-earnings', { method: 'POST', body: JSON.stringify(data) }),
  updateStaffEarning: (id: string, data: Partial<{ date: string; category: 'Bonus' | 'Award' | 'LumpSum' | 'RevenueShare'; amount?: number; rate?: number; base?: number; notes?: string }>) =>
    api(`/pharmacy/staff-earnings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaffEarning: (id: string) => api(`/pharmacy/staff-earnings/${id}`, { method: 'DELETE' }),

  // Sales / POS
  listSales: (params?: { bill?: string; customer?: string; customerId?: string; payment?: 'Any' | 'Cash' | 'Card' | 'Credit'; medicine?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.bill) qs.set('bill', params.bill)
    if (params?.customer) qs.set('customer', params.customer)
    if (params?.customerId) qs.set('customerId', params.customerId)
    if (params?.payment) qs.set('payment', params.payment)
    if (params?.medicine) qs.set('medicine', params.medicine)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/sales${s ? `?${s}` : ''}`)
  },
  createSale: (data: any) => api('/pharmacy/sales', { method: 'POST', body: JSON.stringify(data) }),
  salesSummary: (params?: { payment?: 'Any' | 'Cash' | 'Card' | 'Credit'; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.payment) qs.set('payment', params.payment)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/pharmacy/sales/summary${s ? `?${s}` : ''}`)
  },
  salesSummaryCached: async (params?: { payment?: 'Any' | 'Cash' | 'Card' | 'Credit'; from?: string; to?: string }, opts?: { ttlMs?: number; forceRefresh?: boolean }) => {
    const key = `pharmacy.sales.summary.cached:${JSON.stringify(params || {})}`
    try {
      const raw = localStorage.getItem(key)
      if (raw && !opts?.forceRefresh) {
        const c = JSON.parse(raw)
        if (!opts?.ttlMs || (Date.now() - Number(c.at) < opts.ttlMs)) return c.data
      }
    } catch { }
    const qs = new URLSearchParams()
    if (params?.payment) qs.set('payment', params.payment)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    const data = await api(`/pharmacy/sales/summary${s ? `?${s}` : ''}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { }
    return data
  },
  listSalesCached: async (params?: { bill?: string; customer?: string; customerId?: string; payment?: 'Any' | 'Cash' | 'Card' | 'Credit'; medicine?: string; from?: string; to?: string; page?: number; limit?: number }, opts?: { ttlMs?: number; forceRefresh?: boolean }) => {
    const key = `pharmacy.sales.list.cached:${JSON.stringify(params || {})}`
    try {
      const raw = localStorage.getItem(key)
      if (raw && !opts?.forceRefresh) {
        const c = JSON.parse(raw)
        if (!opts?.ttlMs || (Date.now() - Number(c.at) < opts.ttlMs)) return c.data
      }
    } catch { }
    const qs = new URLSearchParams()
    if (params?.bill) qs.set('bill', params.bill)
    if (params?.customer) qs.set('customer', params.customer)
    if (params?.customerId) qs.set('customerId', params.customerId)
    if (params?.payment) qs.set('payment', params.payment)
    if (params?.medicine) qs.set('medicine', params.medicine)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    const data = await api(`/pharmacy/sales${s ? `?${s}` : ''}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { }
    return data
  },

  // Purchases
  listPurchases: (params?: { from?: string; to?: string; search?: string; company?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.company) qs.set('company', params.company)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/purchases${s ? `?${s}` : ''}`)
  },
  createPurchase: (data: any) => api('/pharmacy/purchases', { method: 'POST', body: JSON.stringify(data) }),
  deletePurchase: (id: string) => api(`/pharmacy/purchases/${id}`, { method: 'DELETE' }),
  purchasesSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/pharmacy/purchases/summary${s ? `?${s}` : ''}`)
  },
  purchasesSummaryCached: async (params?: { from?: string; to?: string }, opts?: { ttlMs?: number; forceRefresh?: boolean }) => {
    const key = `pharmacy.purchases.summary.cached:${JSON.stringify(params || {})}`
    try {
      const raw = localStorage.getItem(key)
      if (raw && !opts?.forceRefresh) {
        const c = JSON.parse(raw)
        if (!opts?.ttlMs || (Date.now() - Number(c.at) < opts.ttlMs)) return c.data
      }
    } catch { }
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    const data = await api(`/pharmacy/purchases/summary${s ? `?${s}` : ''}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { }
    return data
  },

  // Returns
  listReturns: (params?: { type?: 'Customer' | 'Supplier'; from?: string; to?: string; search?: string; party?: string; reference?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.party) qs.set('party', params.party)
    if (params?.reference) qs.set('reference', params.reference)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/returns${s ? `?${s}` : ''}`)
  },
  createReturn: (data: any) => api('/pharmacy/returns', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  listAuditLogs: (params?: { search?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.action) qs.set('action', params.action)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/audit-logs${s ? `?${s}` : ''}`)
  },
  createAuditLog: (data: any) => api('/pharmacy/audit-logs', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: (params?: { page?: number; limit?: number; severity?: 'info' | 'warning' | 'critical' | 'success'; read?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.severity) qs.set('severity', params.severity)
    if (params?.read != null) qs.set('read', String(params.read))
    const s = qs.toString()
    return api(`/pharmacy/notifications${s ? `?${s}` : ''}`)
  },
  markNotificationRead: (id: string) => api(`/pharmacy/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => api('/pharmacy/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => api(`/pharmacy/notifications/${id}`, { method: 'DELETE' }),
  generateNotifications: () => api('/pharmacy/notifications/generate', { method: 'POST' }),

  // Users
  listUsers: () => api('/pharmacy/users'),
  createUser: (data: any) => api('/pharmacy/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => api(`/pharmacy/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => api(`/pharmacy/users/${id}`, { method: 'DELETE' }),
  loginUser: (username: string, password: string) => api('/pharmacy/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logoutUser: (username?: string) => api('/pharmacy/users/logout', { method: 'POST', body: JSON.stringify({ username }) }),

  // Sidebar Roles & Permissions
  listSidebarRoles: () => api('/pharmacy/sidebar-roles'),
  createSidebarRole: (role: string, permissions?: Array<{ path: string; label: string; visible?: boolean; order?: number }>) =>
    api('/pharmacy/sidebar-roles', { method: 'POST', body: JSON.stringify({ role, permissions }) }),
  deleteSidebarRole: (role: string) => api(`/pharmacy/sidebar-roles/${encodeURIComponent(role)}`, { method: 'DELETE' }),
  listSidebarPermissions: (role?: string) => role
    ? api(`/pharmacy/sidebar-permissions?role=${encodeURIComponent(role)}`)
    : api('/pharmacy/sidebar-permissions'),
  updateSidebarPermissions: (role: string, data: { permissions: Array<{ path: string; label: string; visible: boolean; order: number }> }) =>
    api(`/pharmacy/sidebar-permissions/${encodeURIComponent(role)}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetSidebarPermissions: (role: string) =>
    api(`/pharmacy/sidebar-permissions/${encodeURIComponent(role)}/reset`, { method: 'POST' }),

  // Purchase Drafts (Pending Review)
  listPurchaseDrafts: (params?: { from?: string; to?: string; search?: string; company?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.company) qs.set('company', params.company)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/purchase-drafts${s ? `?${s}` : ''}`)
  },
  createPurchaseDraft: (data: any) => api('/pharmacy/purchase-drafts', { method: 'POST', body: JSON.stringify(data) }),
  getPurchaseDraft: (id: string) => api(`/pharmacy/purchase-drafts/${encodeURIComponent(id)}`),
  updatePurchaseDraft: (id: string, data: any) => api(`/pharmacy/purchase-drafts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  approvePurchaseDraft: (id: string) => api(`/pharmacy/purchase-drafts/${id}/approve`, { method: 'POST' }),
  deletePurchaseDraft: (id: string) => api(`/pharmacy/purchase-drafts/${id}`, { method: 'DELETE' }),
  deletePurchaseDraftLine: (draftId: string, lineId: string) => api(`/pharmacy/purchase-drafts/${draftId}/lines/${lineId}`, { method: 'DELETE' }),
  listPurchaseDraftLines: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/purchase-drafts/lines${s ? `?${s}` : ''}`)
  },

  // Inventory operations
  manualReceipt: (data: any) => api('/pharmacy/inventory/manual-receipt', { method: 'POST', body: JSON.stringify(data) }),
  adjustInventory: (data: any) => api('/pharmacy/inventory/adjust', { method: 'POST', body: JSON.stringify(data) }),
  listInventory: (params?: { search?: string; company?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.company) qs.set('company', params.company)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/inventory${s ? `?${s}` : ''}`)
  },
  listInventoryFiltered: (params?: { status?: 'low' | 'out' | 'expiring'; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/inventory/filter${s ? `?${s}` : ''}`)
  },
  inventorySummary: (params?: { search?: string; company?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.company) qs.set('company', params.company)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/pharmacy/inventory/summary${s ? `?${s}` : ''}`)
  },
  inventorySummaryCached: async (params?: { search?: string; company?: string; limit?: number }, opts?: { ttlMs?: number; forceRefresh?: boolean }) => {
    const key = `pharmacy.inventory.summary.cached:${JSON.stringify(params || {})}`
    try {
      const raw = localStorage.getItem(key)
      if (raw && !opts?.forceRefresh) {
        const c = JSON.parse(raw)
        if (!opts?.ttlMs || (Date.now() - Number(c.at) < opts.ttlMs)) return c.data
      }
    } catch { }
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.company) qs.set('company', params.company)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    const data = await api(`/pharmacy/inventory/summary${s ? `?${s}` : ''}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { }
    return data
  },
  listInventoryCached: async (params?: { search?: string; company?: string; page?: number; limit?: number }, opts?: { ttlMs?: number; forceRefresh?: boolean }) => {
    const key = `pharmacy.inventory.list.cached:${JSON.stringify(params || {})}`
    try {
      const raw = localStorage.getItem(key)
      if (raw && !opts?.forceRefresh) {
        const c = JSON.parse(raw)
        if (!opts?.ttlMs || (Date.now() - Number(c.at) < opts.ttlMs)) return c.data
      }
    } catch { }
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.company) qs.set('company', params.company)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    const data = await api(`/pharmacy/inventory${s ? `?${s}` : ''}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { }
    return data
  },
  listInventoryFilteredCached: async (params?: { status?: 'low' | 'out' | 'expiring'; search?: string; page?: number; limit?: number }, opts?: { ttlMs?: number; forceRefresh?: boolean }) => {
    const key = `pharmacy.inventory.filtered.cached:${JSON.stringify(params || {})}`
    try {
      const raw = localStorage.getItem(key)
      if (raw && !opts?.forceRefresh) {
        const c = JSON.parse(raw)
        if (!opts?.ttlMs || (Date.now() - Number(c.at) < opts.ttlMs)) return c.data
      }
    } catch { }
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    const data = await api(`/pharmacy/inventory/filter${s ? `?${s}` : ''}`)
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { }
    return data
  },
  inventoryItemDetails: (key: string) => api(`/pharmacy/inventory/${encodeURIComponent(key)}/details`),
  createInventoryItem: (data: { name: string; company?: string; genericName?: string; category?: string; unitsPerPack?: number; minStock?: number }) =>
    api('/pharmacy/inventory', { method: 'POST', body: JSON.stringify(data) }),
  deleteInventoryItem: (key: string) => api(`/pharmacy/inventory/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  updateInventoryItem: (key: string, data: any) => api(`/pharmacy/inventory/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export const aestheticApi = {
  // Settings
  getSettings: () => api('/aesthetic/settings'),
  updateSettings: (data: any) => api('/aesthetic/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getSystemSettings: () => api('/aesthetic/system-settings'),
  updateSystemSettings: (data: any) => api('/aesthetic/system-settings', { method: 'PUT', body: JSON.stringify(data) }),
  login: (username: string, password: string) => api('/aesthetic/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => api('/aesthetic/logout', { method: 'POST' }),

  // Suppliers
  listSuppliers: (params?: string | { q?: string; page?: number; limit?: number }) => {
    if (typeof params === 'string') {
      return api(`/aesthetic/suppliers?q=${encodeURIComponent(params)}`)
    }
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/suppliers${s ? `?${s}` : ''}`)
  },
  createSupplier: (data: any) => api('/aesthetic/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) => api(`/aesthetic/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => api(`/aesthetic/suppliers/${id}`, { method: 'DELETE' }),
  recordSupplierPayment: (id: string, data: { amount: number; purchaseId?: string; method?: string; note?: string; date?: string }) => api(`/aesthetic/suppliers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  listSupplierPurchases: (id: string) => api(`/aesthetic/suppliers/${id}/purchases`),

  // Expenses
  listExpenses: (params?: { from?: string; to?: string; minAmount?: number; search?: string; type?: string; page?: number; limit?: number; }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.minAmount != null) qs.set('minAmount', String(params.minAmount))
    if (params?.search) qs.set('search', params.search)
    if (params?.type) qs.set('type', params.type)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/expenses${s ? `?${s}` : ''}`)
  },
  createExpense: (data: any) => api('/aesthetic/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => api(`/aesthetic/expenses/${id}`, { method: 'DELETE' }),
  expensesSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/aesthetic/expenses/summary${s ? `?${s}` : ''}`)
  },

  // Purchases
  listPurchases: (params?: { from?: string; to?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/purchases${s ? `?${s}` : ''}`)
  },
  createPurchase: (data: any) => api('/aesthetic/purchases', { method: 'POST', body: JSON.stringify(data) }),
  deletePurchase: (id: string) => api(`/aesthetic/purchases/${id}`, { method: 'DELETE' }),
  purchasesSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/aesthetic/purchases/summary${s ? `?${s}` : ''}`)
  },

  // Returns (Supplier)
  listReturns: (params?: { type?: 'Customer' | 'Supplier'; from?: string; to?: string; search?: string; party?: string; reference?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.party) qs.set('party', params.party)
    if (params?.reference) qs.set('reference', params.reference)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/returns${s ? `?${s}` : ''}`)
  },
  createReturn: (data: any) => api('/aesthetic/returns', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  listAuditLogs: (params?: { search?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.action) qs.set('action', params.action)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/audit-logs${s ? `?${s}` : ''}`)
  },
  createAuditLog: (data: any) => api('/aesthetic/audit-logs', { method: 'POST', body: JSON.stringify(data) }),

  // Users
  listUsers: () => api('/aesthetic/users'),
  createUser: (data: any) => api('/aesthetic/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => api(`/aesthetic/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => api(`/aesthetic/users/${id}`, { method: 'DELETE' }),

  // Purchase Drafts (Pending Review)
  listPurchaseDrafts: (params?: { from?: string; to?: string; search?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/purchase-drafts${s ? `?${s}` : ''}`)
  },
  createPurchaseDraft: (data: any) => api('/aesthetic/purchase-drafts', { method: 'POST', body: JSON.stringify(data) }),
  approvePurchaseDraft: (id: string) => api(`/aesthetic/purchase-drafts/${id}/approve`, { method: 'POST' }),
  deletePurchaseDraft: (id: string) => api(`/aesthetic/purchase-drafts/${id}`, { method: 'DELETE' }),

  // Inventory
  listInventory: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/inventory${s ? `?${s}` : ''}`)
  },
  inventorySummary: (params?: { search?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/inventory/summary${s ? `?${s}` : ''}`)
  },
  deleteInventoryItem: (key: string) => api(`/aesthetic/inventory/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  updateInventoryItem: (key: string, data: any) => api(`/aesthetic/inventory/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Convenience helpers for UI suggestions
  searchMedicines: async (q?: string, limit?: number) => {
    const qs = new URLSearchParams()
    if (q) qs.set('search', q)
    qs.set('limit', String(limit || 20))
    const res: any = await api(`/aesthetic/inventory${qs.toString() ? `?${qs}` : ''}`)
    const items: any[] = res?.items ?? res ?? []
    return { suggestions: items.map((it: any) => ({ id: String(it._id || it.key || it.name || ''), name: String(it.name || '') })) }
  },
  getAllMedicines: async () => {
    const qs = new URLSearchParams(); qs.set('limit', '2000')
    const res: any = await api(`/aesthetic/inventory?${qs}`)
    const items: any[] = res?.items ?? res ?? []
    return { medicines: items.map((it: any) => ({ id: String(it._id || it.key || it.name || ''), name: String(it.name || '') })) }
  },

  // Notifications
  getNotifications: (params?: { page?: number; limit?: number; severity?: 'info' | 'warning' | 'critical' | 'success'; read?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.severity) qs.set('severity', params.severity)
    if (params?.read != null) qs.set('read', String(params.read))
    const s = qs.toString()
    return api(`/aesthetic/notifications${s ? `?${s}` : ''}`)
  },
  markNotificationRead: (id: string) => api(`/aesthetic/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => api('/aesthetic/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => api(`/aesthetic/notifications/${id}`, { method: 'DELETE' }),
  generateNotifications: () => api('/aesthetic/notifications/generate', { method: 'POST' }),

  // Sales (Aesthetic has no POS; backend returns zeros)
  listSales: (params?: { from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/sales${s ? `?${s}` : ''}`)
  },
  salesSummary: (params?: { payment?: 'Any' | 'Cash' | 'Card' | 'Credit'; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.payment) qs.set('payment', params.payment)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/aesthetic/sales/summary${s ? `?${s}` : ''}`)
  },

  // Consent Templates
  listConsentTemplates: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/consent-templates${s ? `?${s}` : ''}`)
  },
  createConsentTemplate: (data: { name: string; body: string; version?: number; active?: boolean; fields?: any[] }) =>
    api('/aesthetic/consent-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateConsentTemplate: (id: string, patch: Partial<{ name: string; body: string; version: number; active: boolean; fields: any[] }>) =>
    api(`/aesthetic/consent-templates/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteConsentTemplate: (id: string) => api(`/aesthetic/consent-templates/${id}`, { method: 'DELETE' }),

  // Consents
  listConsents: (params?: { templateId?: string; patientMrn?: string; labPatientId?: string; search?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.templateId) qs.set('templateId', params.templateId)
    if (params?.patientMrn) qs.set('patientMrn', params.patientMrn)
    if (params?.labPatientId) qs.set('labPatientId', params.labPatientId)
    if (params?.search) qs.set('search', params.search)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/consents${s ? `?${s}` : ''}`)
  },
  createConsent: (data: { templateId: string; templateName?: string; templateVersion?: number; patientMrn?: string; labPatientId?: string; patientName?: string; answers?: any; signatureDataUrl?: string; attachments?: string[]; signedAt: string; actor?: string }) =>
    api('/aesthetic/consents', { method: 'POST', body: JSON.stringify(data) }),

  // Procedure Catalog
  listProcedureCatalog: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/procedure-catalog${s ? `?${s}` : ''}`)
  },
  createProcedureCatalog: (data: { name: string; basePrice?: number; defaultDoctorId?: string; defaultConsentTemplateId?: string; package?: { sessionsCount?: number; intervalDays?: number }; active?: boolean }) =>
    api('/aesthetic/procedure-catalog', { method: 'POST', body: JSON.stringify(data) }),
  updateProcedureCatalog: (id: string, patch: Partial<{ name: string; basePrice: number; defaultDoctorId: string; defaultConsentTemplateId: string; package: { sessionsCount?: number; intervalDays?: number }; active: boolean }>) =>
    api(`/aesthetic/procedure-catalog/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteProcedureCatalog: (id: string) => api(`/aesthetic/procedure-catalog/${id}`, { method: 'DELETE' }),

  // Procedure Sessions
  listProcedureSessions: (params?: { search?: string; labPatientId?: string; patientMrn?: string; phone?: string; procedureId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.labPatientId) qs.set('labPatientId', params.labPatientId)
    if (params?.patientMrn) qs.set('patientMrn', params.patientMrn)
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.procedureId) qs.set('procedureId', params.procedureId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/procedure-sessions${s ? `?${s}` : ''}`)
  },
  createProcedureSession: (data: { labPatientId?: string; patientMrn?: string; patientName?: string; phone?: string; procedureId: string; procedureName?: string; date: string; sessionNo?: number; doctorId?: string; price?: number; discount?: number; paid?: number; status?: 'planned' | 'done' | 'cancelled'; nextVisitDate?: string; notes?: string; beforeImages?: string[]; afterImages?: string[]; consentIds?: string[] }) =>
    api('/aesthetic/procedure-sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateProcedureSession: (id: string, patch: Partial<{ labPatientId: string; patientMrn: string; patientName: string; phone: string; procedureId: string; procedureName: string; date: string; sessionNo: number; doctorId: string; price: number; discount: number; paid: number; status: 'planned' | 'done' | 'cancelled'; nextVisitDate: string; notes: string; beforeImages: string[]; afterImages: string[]; consentIds: string[] }>) =>
    api(`/aesthetic/procedure-sessions/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteProcedureSession: (id: string) => api(`/aesthetic/procedure-sessions/${id}`, { method: 'DELETE' }),

  // Procedure Session Payments & Next Visit
  addProcedureSessionPayment: (id: string, data: { amount: number; method?: string; dateIso?: string; note?: string }) =>
    api(`/aesthetic/procedure-sessions/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  getProcedureSessionPayments: (id: string) => api(`/aesthetic/procedure-sessions/${id}/payments`),
  setProcedureSessionNextVisit: (id: string, nextVisitDate: string) =>
    api(`/aesthetic/procedure-sessions/${id}/next-visit`, { method: 'PUT', body: JSON.stringify({ nextVisitDate }) }),

  // Tokens (OPD)
  listTokens: (params?: { from?: string; to?: string; doctorId?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/tokens${s ? `?${s}` : ''}`)
  },
  createToken: (data: { date?: string; patientName?: string; phone?: string; mrNumber?: string; age?: string; gender?: string; address?: string; guardianRelation?: string; guardianName?: string; cnic?: string; doctorId?: string; apptDate?: string; fee?: number; discount?: number; payable?: number; status?: 'queued' | 'in-progress' | 'completed' | 'returned' | 'cancelled'; procedureSessionId?: string; depositToday?: number; method?: string; note?: string }) =>
    api('/aesthetic/tokens', { method: 'POST', body: JSON.stringify(data) }),
  nextTokenNumber: (date?: string) => {
    const qs = new URLSearchParams(); if (date) qs.set('date', date)
    const s = qs.toString()
    return api(`/aesthetic/tokens/next-number${s ? `?${s}` : ''}`)
  },

  // Doctors (Aesthetic)
  listDoctors: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/aesthetic/doctors${s ? `?${s}` : ''}`)
  },
  createDoctor: (data: { name: string; specialty?: string; qualification?: string; phone?: string; fee?: number; shares?: number; active?: boolean }) =>
    api('/aesthetic/doctors', { method: 'POST', body: JSON.stringify(data) }),
  updateDoctor: (id: string, patch: Partial<{ name: string; specialty: string; qualification: string; phone: string; fee: number; shares: number; active: boolean }>) =>
    api(`/aesthetic/doctors/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteDoctor: (id: string) => api(`/aesthetic/doctors/${id}`, { method: 'DELETE' }),
}

export const labApi = {
  // Auth (if backend supports lab-specific auth)
  login: (username: string, password: string) => api('/lab/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  // Newer backends: Lab user collection auth lives under /lab/users/login
  loginUser: (username: string, password: string) => api('/lab/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logoutUser: () => api('/lab/users/logout', { method: 'POST' }),
  logout: () => api('/lab/logout', { method: 'POST' }),
  // Purchase Drafts (Pending Review)
  listPurchaseDrafts: (params?: { from?: string; to?: string; search?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/purchase-drafts${s ? `?${s}` : ''}`)
  },
  createPurchaseDraft: (data: any) => api('/lab/purchase-drafts', { method: 'POST', body: JSON.stringify(data) }),
  approvePurchaseDraft: (id: string) => api(`/lab/purchase-drafts/${id}/approve`, { method: 'POST' }),
  deletePurchaseDraft: (id: string) => api(`/lab/purchase-drafts/${id}`, { method: 'DELETE' }),

  // Inventory
  listInventory: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/inventory${s ? `?${s}` : ''}`)
  },
  inventorySummary: (params?: { search?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/inventory/summary${s ? `?${s}` : ''}`)
  },
  deleteInventoryItem: (key: string) => api(`/lab/inventory/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  updateInventoryItem: (key: string, data: any) => api(`/lab/inventory/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Purchases
  listPurchases: (params?: { from?: string; to?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/purchases${s ? `?${s}` : ''}`)
  },
  createPurchase: (data: any) => api('/lab/purchases', { method: 'POST', body: JSON.stringify(data) }),
  deletePurchase: (id: string) => api(`/lab/purchases/${id}`, { method: 'DELETE' }),

  // Returns
  listReturns: (params?: { type?: 'Customer' | 'Supplier'; from?: string; to?: string; search?: string; party?: string; reference?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.party) qs.set('party', params.party)
    if (params?.reference) qs.set('reference', params.reference)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/returns${s ? `?${s}` : ''}`)
  },
  createReturn: (data: any) => api('/lab/returns', { method: 'POST', body: JSON.stringify(data) }),
  undoReturn: (data: { reference: string; testId?: string; testName?: string; note?: string }) => api('/lab/returns/undo', { method: 'POST', body: JSON.stringify(data) }),

  // Suppliers
  listSuppliers: (params?: string | { q?: string; page?: number; limit?: number }) => {
    if (typeof params === 'string') {
      return api(`/lab/suppliers?q=${encodeURIComponent(params)}`)
    }
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/suppliers${s ? `?${s}` : ''}`)
  },
  createSupplier: (data: any) => api('/lab/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) => api(`/lab/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => api(`/lab/suppliers/${id}`, { method: 'DELETE' }),
  recordSupplierPayment: (id: string, data: { amount: number; purchaseId?: string; method?: string; note?: string; date?: string }) => api(`/lab/suppliers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  listSupplierPurchases: (id: string) => api(`/lab/suppliers/${id}/purchases`),

  // Shifts
  listShifts: () => api('/lab/shifts'),
  createShift: (data: any) => api('/lab/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShift: (id: string, data: any) => api(`/lab/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShift: (id: string) => api(`/lab/shifts/${id}`, { method: 'DELETE' }),

  // Staff
  listStaff: (params?: { q?: string; shiftId?: string; page?: number; limit?: number } | string) => {
    if (typeof params === 'string') {
      return api(`/lab/staff?q=${encodeURIComponent(params)}`)
    }
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.shiftId) qs.set('shiftId', params.shiftId)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/staff${s ? `?${s}` : ''}`)
  },
  createStaff: (data: any) => api('/lab/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: string, data: any) => api(`/lab/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id: string) => api(`/lab/staff/${id}`, { method: 'DELETE' }),

  // Attendance
  listAttendance: (params?: { date?: string; shiftId?: string; staffId?: string; from?: string; to?: string; page?: number; limit?: number; }) => {
    const qs = new URLSearchParams()
    if (params?.date) qs.set('date', params.date)
    if (params?.shiftId) qs.set('shiftId', params.shiftId)
    if (params?.staffId) qs.set('staffId', params.staffId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/attendance${s ? `?${s}` : ''}`)
  },
  upsertAttendance: (data: any) => api('/lab/attendance', { method: 'POST', body: JSON.stringify(data) }),

  // Expenses
  listExpenses: (params?: { from?: string; to?: string; minAmount?: number; search?: string; type?: string; page?: number; limit?: number; }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.minAmount != null) qs.set('minAmount', String(params.minAmount))
    if (params?.search) qs.set('search', params.search)
    if (params?.type) qs.set('type', params.type)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/expenses${s ? `?${s}` : ''}`)
  },
  createExpense: (data: any) => api('/lab/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => api(`/lab/expenses/${id}`, { method: 'DELETE' }),
  expensesSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/lab/expenses/summary${s ? `?${s}` : ''}`)
  },

  // Cash Movements (Pay In/Out)
  listCashMovements: (params?: { from?: string; to?: string; type?: 'IN' | 'OUT'; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.type) qs.set('type', params.type)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/cash-movements${s ? `?${s}` : ''}`)
  },
  createCashMovement: (data: { date: string; type: 'IN' | 'OUT'; category?: string; amount: number; receiver?: string; handoverBy?: string; note?: string }) =>
    api('/lab/cash-movements', { method: 'POST', body: JSON.stringify(data) }),
  deleteCashMovement: (id: string) => api(`/lab/cash-movements/${id}`, { method: 'DELETE' }),
  cashMovementSummary: (params?: { from?: string; to?: string; type?: 'IN' | 'OUT' }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.type) qs.set('type', params.type)
    const s = qs.toString()
    return api(`/lab/cash-movements/summary${s ? `?${s}` : ''}`)
  },

  // Manager Cash Count
  listCashCounts: (params?: { from?: string; to?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/cash-counts${s ? `?${s}` : ''}`)
  },
  createCashCount: (data: { date: string; amount: number; receiver?: string; handoverBy?: string; note?: string }) =>
    api('/lab/cash-counts', { method: 'POST', body: JSON.stringify(data) }),
  deleteCashCount: (id: string) => api(`/lab/cash-counts/${id}`, { method: 'DELETE' }),
  cashCountSummary: (params?: { from?: string; to?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.search) qs.set('search', params.search)
    const s = qs.toString()
    return api(`/lab/cash-counts/summary${s ? `?${s}` : ''}`)
  },

  // Users
  listUsers: () => api('/lab/users'),
  createUser: (data: any) => api('/lab/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => api(`/lab/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => api(`/lab/users/${id}`, { method: 'DELETE' }),

  // Audit Logs
  listAuditLogs: (params?: { search?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.action) qs.set('action', params.action)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/audit-logs${s ? `?${s}` : ''}`)
  },
  createAuditLog: (data: any) => api('/lab/audit-logs', { method: 'POST', body: JSON.stringify(data) }),

  // Settings
  getSettings: () => api('/lab/settings'),
  updateSettings: (data: any) => api('/lab/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getSystemSettings: () => api('/lab/system-settings'),
  updateSystemSettings: (data: any) => api('/lab/system-settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Patients
  findOrCreatePatient: (data: { fullName: string; guardianName?: string; phone?: string; cnic?: string; gender?: string; address?: string; age?: string; guardianRel?: string; selectId?: string }) =>
    api('/lab/patients/find-or-create', { method: 'POST', body: JSON.stringify(data) }),
  getPatientByMrn: (mrn: string) => api(`/lab/patients/by-mrn?mrn=${encodeURIComponent(mrn)}`),
  searchPatients: (params?: { phone?: string; name?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.name) qs.set('name', params.name)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/patients/search${s ? `?${s}` : ''}`)
  },
  updatePatient: (id: string, data: { fullName?: string; fatherName?: string; phone?: string; cnic?: string; gender?: string; address?: string }) =>
    api(`/lab/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Tests (Catalog)
  listTests: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/tests${s ? `?${s}` : ''}`)
  },
  createTest: (data: any) => api('/lab/tests', { method: 'POST', body: JSON.stringify(data) }),
  updateTest: (id: string, data: any) => api(`/lab/tests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTest: (id: string) => api(`/lab/tests/${id}`, { method: 'DELETE' }),

  // Orders (Sample Intake)
  listOrders: (params?: { q?: string; status?: 'received' | 'completed'; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/orders${s ? `?${s}` : ''}`)
  },
  createOrder: (data: any) => api('/lab/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderTrack: (id: string, data: { sampleTime?: string; reportingTime?: string; status?: 'received' | 'completed'; referringConsultant?: string }) =>
    api(`/lab/orders/${id}/track`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id: string) => api(`/lab/orders/${id}`, { method: 'DELETE' }),

  // Results
  listResults: (params?: { orderId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.orderId) qs.set('orderId', params.orderId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/results${s ? `?${s}` : ''}`)
  },
  createResult: (data: any) => api('/lab/results', { method: 'POST', body: JSON.stringify(data) }),
  updateResult: (id: string, data: any) => api(`/lab/results/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Dashboard
  dashboardSummary: () => api('/lab/dashboard/summary'),
  // Reports
  reportsSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/lab/reports/summary${s ? `?${s}` : ''}`)
  },

  // Blood Bank — Donors
  listBBDonors: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/bb/donors${s ? `?${s}` : ''}`)
  },
  createBBDonor: (data: any) => api('/lab/bb/donors', { method: 'POST', body: JSON.stringify(data) }),
  updateBBDonor: (id: string, data: any) => api(`/lab/bb/donors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBBDonor: (id: string) => api(`/lab/bb/donors/${id}`, { method: 'DELETE' }),

  // Blood Bank — Receivers
  listBBReceivers: (params?: { q?: string; status?: 'URGENT' | 'PENDING' | 'DISPENSED' | 'APPROVED'; type?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.type) qs.set('type', params.type)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/bb/receivers${s ? `?${s}` : ''}`)
  },
  createBBReceiver: (data: any) => api('/lab/bb/receivers', { method: 'POST', body: JSON.stringify(data) }),
  updateBBReceiver: (id: string, data: any) => api(`/lab/bb/receivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBBReceiver: (id: string) => api(`/lab/bb/receivers/${id}`, { method: 'DELETE' }),

  // Blood Bank — Inventory (Bags)
  listBBInventory: (params?: { q?: string; status?: 'Available' | 'Quarantined' | 'Used' | 'Expired'; type?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.type) qs.set('type', params.type)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/lab/bb/inventory${s ? `?${s}` : ''}`)
  },
  bbInventorySummary: () => api('/lab/bb/inventory/summary'),
  createBBBag: (data: any) => api('/lab/bb/inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateBBBag: (id: string, data: any) => api(`/lab/bb/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBBBag: (id: string) => api(`/lab/bb/inventory/${id}`, { method: 'DELETE' }),

  // Templates (for doctor prescription lab orders)
  listTemplates: (doctorId: string) => api(`/lab/templates?doctorId=${encodeURIComponent(doctorId)}`),
  createTemplate: (data: { doctorId: string; name: string; tests: string[] }) =>
    api('/lab/templates', { method: 'POST', body: JSON.stringify(data) }),
  getTemplate: (id: string) => api(`/lab/templates/${encodeURIComponent(id)}`),
  updateTemplate: (id: string, data: { name?: string; tests?: string[] }) =>
    api(`/lab/templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => api(`/lab/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const therapyApi = {
  listPackages: (params?: { status?: 'active' | 'inactive'; package?: number; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.package != null) qs.set('package', String(params.package))
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/packages${s ? `?${s}` : ''}`)
  },
  createPackage: (data: { packageName: string; package: number; price: number; status: 'active' | 'inactive'; machinePreset?: any | null }) =>
    api('/therapy/packages', { method: 'POST', body: JSON.stringify(data) }),
  getPackage: (id: string) => api(`/therapy/packages/${encodeURIComponent(id)}`),
  updatePackage: (id: string, patch: Partial<{ packageName: string; package: number; price: number; status: 'active' | 'inactive'; machinePreset?: any | null }>) =>
    api(`/therapy/packages/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deletePackage: (id: string) => api(`/therapy/packages/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Patients (shared Lab_Patient)
  searchPatients: (params?: { phone?: string; name?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.name) qs.set('name', params.name)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/patients/search${s ? `?${s}` : ''}`)
  },
  findOrCreatePatient: (data: {
    fullName: string
    guardianName?: string
    phone?: string
    cnic?: string
    gender?: string
    address?: string
    age?: string
    guardianRel?: string
    selectId?: string
  }) => api('/therapy/patients/find-or-create', { method: 'POST', body: JSON.stringify(data) }),
  getPatientByMrn: (mrn: string) => api(`/therapy/patients/by-mrn?mrn=${encodeURIComponent(mrn || '')}`),
  updatePatient: (id: string, patch: any) => api(`/therapy/patients/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) }),

  // Accounts
  listAccounts: (params?: { q?: string; hasDues?: boolean; hasAdvance?: boolean; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.hasDues != null) qs.set('hasDues', String(params.hasDues))
    if (params?.hasAdvance != null) qs.set('hasAdvance', String(params.hasAdvance))
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/accounts${s ? `?${s}` : ''}`)
  },
  getAccount: (patientId: string) => api(`/therapy/accounts/${encodeURIComponent(patientId)}`),

  // Visits
  listVisits: (params?: { patientId?: string; mrn?: string; phone?: string; name?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.patientId) qs.set('patientId', params.patientId)
    if (params?.mrn) qs.set('mrn', params.mrn)
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.name) qs.set('name', params.name)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/visits${s ? `?${s}` : ''}`)
  },
  createVisit: (data: {
    patientId: string
    patient: {
      mrn?: string
      fullName: string
      phone?: string
      age?: string
      gender?: string
      address?: string
      guardianRelation?: string
      guardianName?: string
      cnic?: string
    }
    packageId?: string
    packageName?: string
    tests: Array<{ id: string; name: string; price: number }>
    subtotal?: number
    discount?: number
    net?: number
    payPreviousDues?: boolean
    useAdvance?: boolean
    amountReceived?: number
    referringConsultant?: string
    fromReferralId?: string
  }) => api('/therapy/visits', { method: 'POST', body: JSON.stringify(data) }),
  getVisit: (id: string) => api(`/therapy/visits/${encodeURIComponent(id)}`),
  updateVisit: (id: string, patch: any) => api(`/therapy/visits/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) }),
  updateSessionStatus: (id: string, status: 'Queued' | 'Completed') => api(`/therapy/visits/${encodeURIComponent(id)}/session-status`, { method: 'PUT', body: JSON.stringify({ sessionStatus: status }) }),
  returnVisit: (id: string, reason: string) => api(`/therapy/visits/${encodeURIComponent(id)}/return`, { method: 'POST', body: JSON.stringify({ reason }) }),
  
  // Appointments
  listAppointments: (params?: { from?: string; to?: string; paymentStatus?: 'paid' | 'unpaid'; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.paymentStatus) qs.set('paymentStatus', params.paymentStatus)
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/appointments${s ? `?${s}` : ''}`)
  },
  getAppointment: (id: string) => api(`/therapy/appointments/${encodeURIComponent(id)}`),
  createAppointment: (data: any) => api('/therapy/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: any) => api(`/therapy/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAppointment: (id: string) => api(`/therapy/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getDashboardSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/therapy/dashboard/summary${s ? `?${s}` : ''}`).catch(() => ({
      orders: 0,
      revenue: 0,
      pending: 0,
      completed: 0,
      returned: 0
    }))
  },

  // Payments
  listPayments: (params?: { patientId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.patientId) qs.set('patientId', params.patientId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/payments${s ? `?${s}` : ''}`)
  },
  payCreditPatient: (patientId: string, data: { amount: number; currentDues?: number; paymentMethod: 'Cash' | 'Card' | 'Insurance'; receivedToAccountCode: string; accountNumberIban?: string; receptionistName?: string; note?: string }) =>
    api(`/therapy/accounts/${encodeURIComponent(patientId)}/pay`, { method: 'POST', body: JSON.stringify(data) }),

  // Credit Patients
  listCreditPatients: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/accounts/credit${s ? `?${s}` : ''}`)
  },

  // Appointments
  listAppointments: (params?: { from?: string; to?: string; paymentStatus?: 'paid' | 'unpaid'; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.paymentStatus) qs.set('paymentStatus', params.paymentStatus)
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/therapy/appointments${s ? `?${s}` : ''}`)
  },
  getAppointment: (id: string) => api(`/therapy/appointments/${encodeURIComponent(id)}`),
  createAppointment: (data: any) => api('/therapy/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: any) => api(`/therapy/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAppointment: (id: string) => api(`/therapy/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const counsellingApi = {
  // Tests (Catalog)
  listTests: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/counselling/tests${s ? `?${s}` : ''}`)
  },

  // Orders
  listOrders: (params?: { q?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/counselling/orders${s ? `?${s}` : ''}`)
  },
  createOrder: (data: any) => api('/counselling/orders', { method: 'POST', body: JSON.stringify(data) }),
  getOrder: (id: string) => api(`/counselling/orders/${id}`),

  // Patients
  searchPatients: (params?: { phone?: string; name?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.name) qs.set('name', params.name)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/counselling/patients/search${s ? `?${s}` : ''}`)
  },
  findOrCreatePatient: (data: any) => api('/counselling/patients/find-or-create', { method: 'POST', body: JSON.stringify(data) }),
  getPatientByMrn: (mrn: string) => api(`/counselling/patients/by-mrn?mrn=${encodeURIComponent(mrn)}`),
  updatePatient: (id: string, data: any) => api(`/counselling/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Accounts
  getAccount: (patientId: string) => api(`/counselling/accounts/${encodeURIComponent(patientId)}`),
  payCreditPatient: (patientId: string, data: any) => api(`/counselling/accounts/${encodeURIComponent(patientId)}/pay`, { method: 'POST', body: JSON.stringify(data) }),

  // Credit Patients
  listCreditPatients: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/counselling/credit-patients${s ? `?${s}` : ''}`)
  },

  // Settings
  getSettings: () => api('/counselling/settings'),
  updateSettings: (data: any) => api('/counselling/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Packages
  listPackages: (params?: { status?: string; package?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.package != null) qs.set('package', String(params.package))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/counselling/packages${s ? `?${s}` : ''}`)
  },
  getPackage: (id: string) => api(`/counselling/packages/${id}`),
  createPackage: (data: any) => api('/counselling/packages', { method: 'POST', body: JSON.stringify(data) }),
  updatePackage: (id: string, data: any) => api(`/counselling/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePackage: (id: string) => api(`/counselling/packages/${id}`, { method: 'DELETE' }),

  // Appointments
  listAppointments: (params?: { from?: string; to?: string; paymentStatus?: 'paid' | 'unpaid'; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.paymentStatus) qs.set('paymentStatus', params.paymentStatus)
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/counselling/appointments${s ? `?${s}` : ''}`)
  },
  getAppointment: (id: string) => api(`/counselling/appointments/${encodeURIComponent(id)}`),
  createAppointment: (data: any) => api('/counselling/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: any) => api(`/counselling/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAppointment: (id: string) => api(`/counselling/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  updateOrder: (id: string, data: any) => api(`/counselling/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateSessionStatus: (id: string, status: 'Queued' | 'Completed') => api(`/counselling/orders/${id}/session-status`, { method: 'PUT', body: JSON.stringify({ sessionStatus: status }) }),
  returnOrder: (id: string, reason: string) => api(`/counselling/orders/${id}/return`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getDashboardSummary: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/counselling/dashboard/summary${s ? `?${s}` : ''}`)
  },
}

export const hospitalApi = {
  // Settings
  getSettings: () => api('/hospital/settings'),
  updateSettings: (data: any) => api('/hospital/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Patient lookup
  getPatientByMrn: (mrn: string) => api(`/hospital/patients/by-mrn?mrn=${encodeURIComponent(mrn)}`),

  // Notifications (Hospital staff/user)
  listUserNotifications: () => api('/hospital/user-notifications'),
  updateUserNotification: (id: string, read: boolean) =>
    api(`/hospital/user-notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ read }) }),
  markAllUserNotificationsRead: () => api('/hospital/user-notifications/mark-all-read', { method: 'POST' }),

  // Appointments
  listAppointments: (params?: { from?: string; to?: string; appointmentType?: 'OPD' | 'Diagnostic' | 'Therapy' | 'Counselling'; status?: 'Scheduled' | 'Checked-In' | 'Completed' | 'Cancelled'; doctorId?: string; departmentId?: string; q?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.appointmentType) qs.set('appointmentType', params.appointmentType)
    if (params?.status) qs.set('status', params.status)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.departmentId) qs.set('departmentId', params.departmentId)
    if (params?.q) qs.set('q', params.q)
    const s = qs.toString()
    return api(`/hospital/appointments${s ? `?${s}` : ''}`)
  },
  getAppointment: (id: string) => api(`/hospital/appointments/${encodeURIComponent(id)}`),
  createAppointment: (data: any) => api('/hospital/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: any) => api(`/hospital/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAppointment: (id: string) => api(`/hospital/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // History Taking (OPD)
  getHistoryTaking: (encounterId: string) =>
    api(`/hospital/opd/encounters/${encodeURIComponent(encounterId)}/history-taking`),
  upsertHistoryTaking: (encounterId: string, data: { tokenId?: string; hxBy?: string; hxDate?: string; data?: any; submittedBy?: string }) =>
    api(`/hospital/opd/encounters/${encodeURIComponent(encounterId)}/history-taking`, { method: 'PUT', body: JSON.stringify(data) }),
  listHistoryTakings: (params: { patientId: string; limit?: number }) => {
    const qs = new URLSearchParams()
    qs.set('patientId', params.patientId)
    if (params.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/opd/history-takings?${s}`)
  },

  // Lab Reports Entry (OPD)
  getLabReportsEntry: (encounterId: string) =>
    api(`/hospital/opd/encounters/${encodeURIComponent(encounterId)}/lab-reports-entry`),
  upsertLabReportsEntry: (encounterId: string, data: { tokenId?: string; hxBy?: string; hxDate?: string; labInformation?: any; semenAnalysis?: any; tests?: any[]; submittedBy?: string }) =>
    api(`/hospital/opd/encounters/${encodeURIComponent(encounterId)}/lab-reports-entry`, { method: 'PUT', body: JSON.stringify(data) }),
  listLabReportsEntries: (params: { patientId: string; limit?: number }) => {
    const qs = new URLSearchParams()
    qs.set('patientId', params.patientId)
    if (params.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/opd/lab-reports-entries?${s}`)
  },

  // Patients lookup
  searchPatientsByPhone: (phone: string) => api(`/hospital/patients/search?phone=${encodeURIComponent(phone || '')}`),
  getPatientProfile: (mrn: string) => api(`/hospital/patients/profile?mrn=${encodeURIComponent(mrn || '')}`),
  searchPatients: (params?: { mrn?: string; name?: string; fatherName?: string; phone?: string; limit?: number; doctorId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.mrn) qs.set('mrn', params.mrn)
    if (params?.name) qs.set('name', params.name)
    if (params?.fatherName) qs.set('fatherName', params.fatherName)
    if (params?.phone) qs.set('phone', params.phone)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/patients/search${s ? `?${s}` : ''}`)
  },
  exportPatientsUrl: (params?: { mrn?: string; name?: string; fatherName?: string; phone?: string }) => {
    const qs = new URLSearchParams()
    if (params?.mrn) qs.set('mrn', params.mrn)
    if (params?.name) qs.set('name', params.name)
    if (params?.fatherName) qs.set('fatherName', params.fatherName)
    if (params?.phone) qs.set('phone', params.phone)
    const s = qs.toString()
    return `${baseURL}/hospital/patients/export${s ? `?${s}` : ''}`
  },
  importPatientsExcel: (formData: FormData) => {
    const token = getToken('/hospital/patients/import-excel')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${baseURL}/hospital/patients/import-excel`, { 
      method: 'POST', 
      body: formData, 
      headers 
    }).then(async res => {
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || res.statusText)
      }
      return res.json()
    })
  },
  previewPatientsExcel: (formData: FormData) => {
    const token = getToken('/hospital/patients/preview-excel')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${baseURL}/hospital/patients/preview-excel`, { 
      method: 'POST', 
      body: formData, 
      headers 
    }).then(async res => {
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || res.statusText)
      }
      return res.json()
    })
  },

  // Accounts (dues/advance)
  getAccount: (patientId: string) => api(`/hospital/accounts/${encodeURIComponent(patientId)}`),

  // Credit Patients
  listCreditPatients: (params?: { q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/credit-patients${s ? `?${s}` : ''}`)
  },
  payCreditPatient: (patientId: string, data: { amount: number; currentDues?: number; paymentMethod: 'Cash' | 'Card' | 'Insurance'; receivedToAccountCode: string; accountNumberIban?: string; receptionistName?: string; note?: string }) =>
    api(`/hospital/accounts/${encodeURIComponent(patientId)}/pay`, { method: 'POST', body: JSON.stringify(data) }),
  // Masters
  listDepartments: () => api('/hospital/departments'),
  createDepartment: (data: { name: string; description?: string; opdBaseFee: number; opdFollowupFee?: number; followupWindowDays?: number; doctorPrices?: Array<{ doctorId: string; price: number }> }) =>
    api('/hospital/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: { name: string; description?: string; opdBaseFee: number; opdFollowupFee?: number; followupWindowDays?: number; doctorPrices?: Array<{ doctorId: string; price: number }> }) =>
    api(`/hospital/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id: string) => api(`/hospital/departments/${id}`, { method: 'DELETE' }),

  listDoctors: () => api('/hospital/doctors'),
  getDoctor: (id: string) => api(`/hospital/doctors/${id}`),
  createDoctor: (data: { name: string; departmentIds?: string[]; primaryDepartmentId?: string; opdBaseFee?: number; opdFollowupFee?: number; followupWindowDays?: number; username?: string; password?: string; phone?: string; specialization?: string; qualification?: string; cnic?: string; shares?: number; active?: boolean }) =>
    api('/hospital/doctors', { method: 'POST', body: JSON.stringify(data) }),
  updateDoctor: (id: string, data: { name: string; departmentIds?: string[]; primaryDepartmentId?: string; opdBaseFee?: number; opdFollowupFee?: number; followupWindowDays?: number; username?: string; password?: string; phone?: string; specialization?: string; qualification?: string; cnic?: string; shares?: number; active?: boolean }) =>
    api(`/hospital/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDoctor: (id: string) => api(`/hospital/doctors/${id}`, { method: 'DELETE' }),

  // Doctor Schedules
  listDoctorSchedules: (params?: { doctorId?: string; departmentId?: string; date?: string }) => {
    const qs = new URLSearchParams()
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.departmentId) qs.set('departmentId', params.departmentId)
    if (params?.date) qs.set('date', params.date)
    const s = qs.toString()
    return api(`/hospital/doctor-schedules${s ? `?${s}` : ''}`)
  },
  createDoctorSchedule: (data: { doctorId: string; departmentId?: string; dateIso: string; startTime: string; endTime: string; slotMinutes?: number; fee?: number; followupFee?: number; notes?: string }) =>
    api('/hospital/doctor-schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateDoctorSchedule: (id: string, data: { departmentId?: string; dateIso?: string; startTime?: string; endTime?: string; slotMinutes?: number; fee?: number; followupFee?: number; notes?: string }) =>
    api(`/hospital/doctor-schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDoctorSchedule: (id: string) => api(`/hospital/doctor-schedules/${id}`, { method: 'DELETE' }),

  // Users (Hospital App Users)
  listHospitalUsers: () => api('/hospital/users'),
  getHospitalUser: (id: string) => api(`/hospital/users/${id}`),
  createHospitalUser: (data: { username: string; role: string; fullName?: string; phone?: string; email?: string; password?: string; portals?: Record<string, string[]>; pettyCashAccountCode?: string; active?: boolean }) =>
    api('/hospital/users', { method: 'POST', body: JSON.stringify(data) }),
  updateHospitalUser: (id: string, data: { username?: string; role?: string; fullName?: string; phone?: string; email?: string; password?: string; portals?: Record<string, string[]>; pettyCashAccountCode?: string; active?: boolean }) =>
    api(`/hospital/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetHospitalUserPassword: (id: string, password?: string) =>
    api(`/hospital/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  deleteHospitalUser: (id: string) => api(`/hospital/users/${id}`, { method: 'DELETE' }),
  loginHospitalUser: (username: string, password?: string, portal?: string) =>
    api('/hospital/users/login', { method: 'POST', body: JSON.stringify({ username, password, portal }) }),
  logoutHospitalUser: (username?: string) =>
    api('/hospital/users/logout', { method: 'POST', body: JSON.stringify({ username }) }),

  me: () => api('/hospital/auth/me'),

  // Roles (Hospital App Roles)
  listHospitalRoles: () => api('/hospital/roles'),
  createHospitalRole: (data: { name: string; portals?: Record<string, string[]> }) =>
    api('/hospital/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateHospitalRole: (id: string, data: { name?: string; portals?: Record<string, string[]> }) =>
    api(`/hospital/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHospitalRole: (id: string) => api(`/hospital/roles/${id}`, { method: 'DELETE' }),

  getHospitalAccessTree: () => api('/hospital/access/tree'),

  // OPD
  quoteOPDPrice: (params: { departmentId: string; doctorId?: string; visitType?: 'new' | 'followup'; corporateId?: string }) => {
    const qs = new URLSearchParams()
    qs.set('departmentId', params.departmentId)
    if (params.doctorId) qs.set('doctorId', params.doctorId)
    if (params.visitType) qs.set('visitType', params.visitType)
    if (params.corporateId) qs.set('corporateId', params.corporateId)
    return api(`/hospital/opd/quote-price?${qs.toString()}`)
  },
  createOPDEncounter: (data: { patientId: string; departmentId: string; doctorId?: string; visitType: 'new' | 'followup'; paymentRef?: string }) =>
    api('/hospital/opd/encounters', { method: 'POST', body: JSON.stringify(data) }),

  // Tokens
  createOpdToken: (data: { patientId?: string; mrn?: string; patientName?: string; phone?: string; gender?: string; guardianRel?: string; guardianName?: string; cnic?: string; address?: string; age?: string; departmentId: string; doctorId?: string; visitType?: 'new' | 'followup'; discount?: number; paymentStatus?: 'paid' | 'unpaid'; payPreviousDues?: boolean; useAdvance?: boolean; amountReceived?: number; receptionistName?: string; paymentMethod?: 'Cash' | 'Card' | 'Insurance'; accountNumberIban?: string; receivedToAccountCode?: string; paymentRef?: string; overrideFee?: number; scheduleId?: string; apptStart?: string; corporateId?: string; corporatePreAuthNo?: string; corporateCoPayPercent?: number; corporateCoverageCap?: number }) =>
    api('/hospital/tokens/opd', { method: 'POST', body: JSON.stringify(data) }),
  listTokens: (params?: { date?: string; from?: string; to?: string; status?: 'queued' | 'in-progress' | 'completed' | 'returned' | 'cancelled'; doctorId?: string; departmentId?: string; scheduleId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.date) qs.set('date', params.date)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.status) qs.set('status', params.status)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.departmentId) qs.set('departmentId', params.departmentId)
    if (params?.scheduleId) qs.set('scheduleId', params.scheduleId)
    const s = qs.toString()
    return api(`/hospital/tokens${s ? `?${s}` : ''}`)
  },
  updateToken: (id: string, data: { patientName?: string; phone?: string; gender?: string; guardianRel?: string; guardianName?: string; cnic?: string; address?: string; age?: string; departmentId?: string; doctorId?: string; amount?: number; discount?: number; paymentStatus?: 'paid' | 'unpaid'; receptionistName?: string; paymentMethod?: 'Cash' | 'Card' | 'Insurance'; accountNumberIban?: string }) =>
    api(`/hospital/tokens/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateTokenStatus: (id: string, status: 'queued' | 'in-progress' | 'completed' | 'returned' | 'cancelled') =>
    api(`/hospital/tokens/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  returnToken: (id: string, returnReason: string) =>
    api(`/hospital/tokens/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'returned', returnReason }) }),

  deleteToken: (id: string) =>
    api(`/hospital/tokens/${id}`, { method: 'DELETE' }),

  payToken: (id: string, data: { receptionistName?: string; paymentMethod: 'Cash' | 'Card' | 'Insurance'; accountNumberIban?: string; receivedToAccountCode?: string }) =>
    api(`/hospital/tokens/${id}/pay`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Staff
  listStaff: (params?: { q?: string; shiftId?: string; page?: number; limit?: number } | string) => {
    if (typeof params === 'string') {
      return api(`/hospital/staff?q=${encodeURIComponent(params)}`)
    }
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.shiftId) qs.set('shiftId', params.shiftId)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/staff${s ? `?${s}` : ''}`)
  },
  listShifts: () => api('/hospital/shifts'),
  createShift: (data: any) => api('/hospital/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShift: (id: string, data: any) => api(`/hospital/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShift: (id: string) => api(`/hospital/shifts/${id}`, { method: 'DELETE' }),
  listAttendance: (params?: { date?: string; from?: string; to?: string; shiftId?: string; staffId?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.date) qs.set('date', params.date)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.shiftId) qs.set('shiftId', params.shiftId)
    if (params?.staffId) qs.set('staffId', params.staffId)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/attendance${s ? `?${s}` : ''}`)
  },
  upsertAttendance: (data: any) => api('/hospital/attendance', { method: 'POST', body: JSON.stringify(data) }),
  // Staff Earnings (optional module)
  listStaffEarnings: (params?: { staffId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.staffId) qs.set('staffId', params.staffId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/staff-earnings${s ? `?${s}` : ''}`)
  },
  createStaffEarning: (data: { staffId: string; date: string; category: 'Bonus' | 'Award' | 'LumpSum' | 'RevenueShare'; amount?: number; rate?: number; base?: number; notes?: string }) =>
    api('/hospital/staff-earnings', { method: 'POST', body: JSON.stringify(data) }),
  updateStaffEarning: (id: string, data: Partial<{ date: string; category: 'Bonus' | 'Award' | 'LumpSum' | 'RevenueShare'; amount?: number; rate?: number; base?: number; notes?: string }>) =>
    api(`/hospital/staff-earnings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaffEarning: (id: string) => api(`/hospital/staff-earnings/${id}`, { method: 'DELETE' }),
  createStaff: (data: any) => api('/hospital/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: string, data: any) => api(`/hospital/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id: string) => api(`/hospital/staff/${id}`, { method: 'DELETE' }),

  // Expenses
  listExpenses: (params?: { from?: string; to?: string; status?: 'all' | 'draft' | 'submitted' | 'approved' | 'rejected'; kind?: string; staffId?: string; salaryMonth?: string; category?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.status) qs.set('status', params.status)
    if (params?.kind) qs.set('kind', params.kind)
    if (params?.staffId) qs.set('staffId', params.staffId)
    if (params?.salaryMonth) qs.set('salaryMonth', params.salaryMonth)
    if (params?.category) qs.set('category', params.category)
    const s = qs.toString()
    return api(`/hospital/expenses${s ? `?${s}` : ''}`)
  },
  getExpense: (id: string) => api(`/hospital/expenses/${encodeURIComponent(id)}`),
  createExpense: (data: { dateIso: string; departmentId?: string; category: string; amount: number; note?: string; method?: string; ref?: string; supplierName?: string; invoiceNo?: string; kind?: string; staffId?: string; salaryMonth?: string; paymentMode?: string; fromAccountCode?: string }) =>
    api('/hospital/expenses', { method: 'POST', body: JSON.stringify(data) }),
  submitExpense: (id: string) =>
    api(`/hospital/expenses/${id}/submit`, { method: 'PATCH' }),
  approveExpense: (id: string) =>
    api(`/hospital/expenses/${id}/approve`, { method: 'PATCH' }),
  rejectExpense: (id: string, reason: string) =>
    api(`/hospital/expenses/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  deleteExpense: (id: string) => api(`/hospital/expenses/${id}`, { method: 'DELETE' }),

  // Finance & Accounts
  listFinanceTransactions: (params?: { from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/finance/transactions${s ? `?${s}` : ''}`)
  },

  listCollectionReport: (params?: { department?: 'All' | 'OPD' | 'Diagnostics' | 'Pharmacy' | 'Therapy' | 'Counselling' | 'Finance'; reportType?: 'Detailed' | 'Closing Balances' | 'Opening Balances'; from?: string; to?: string; timeFrom?: string; timeTo?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.department) qs.set('department', params.department)
    if (params?.reportType) qs.set('reportType', params.reportType)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.timeFrom) qs.set('timeFrom', params.timeFrom)
    if (params?.timeTo) qs.set('timeTo', params.timeTo)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/finance/collection-report${s ? `?${s}` : ''}`)
  },

  listFinanceAccounts: (params?: { q?: string; category?: 'PettyCash' | 'Other'; active?: boolean; context?: string }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.category) qs.set('category', params.category)
    if (params?.active != null) qs.set('active', String(!!params.active))
    if (params?.context) qs.set('context', params.context)
    const s = qs.toString()
    return api(`/hospital/finance/accounts${s ? `?${s}` : ''}`)
  },
  createFinanceAccount: (data: { code: string; name: string; type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'; category?: 'PettyCash' | 'Other'; active?: boolean; department?: string; responsibleStaff?: string }) =>
    api('/hospital/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateFinanceAccount: (id: string, data: Partial<{ name: string; type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'; category: 'PettyCash' | 'Other'; active: boolean }>) =>
    api(`/hospital/finance/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFinanceAccount: (id: string) =>
    api(`/hospital/finance/accounts/${id}`, { method: 'DELETE' }),
  // Opening Balance
  postOpeningBalance: (data: { dateIso: string; account: string; amount: number; memo?: string }) =>
    api('/hospital/finance/opening-balance', { method: 'POST', body: JSON.stringify(data) }),
  // Bank Accounts
  listBankAccounts: (params?: { q?: string; status?: 'Active' | 'Inactive' }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    const s = qs.toString()
    return api(`/hospital/finance/bank-accounts${s ? `?${s}` : ''}`)
  },
  createBankAccount: (data: { bankName: string; accountTitle: string; accountNumber: string; branchName?: string; branchCode?: string; swift?: string; responsibleStaff?: string; openingBalance?: number; status?: 'Active' | 'Inactive' }) =>
    api('/hospital/finance/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateBankAccount: (id: string, data: Partial<{ bankName: string; accountTitle: string; branchName: string; branchCode: string; swift: string; responsibleStaff: string; status: 'Active' | 'Inactive' }>) =>
    api(`/hospital/finance/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBankAccount: (id: string) =>
    api(`/hospital/finance/bank-accounts/${id}`, { method: 'DELETE' }),
  // Petty Cash Accounts (dedicated collection)
  listPettyCashAccounts: (params?: { q?: string; status?: 'Active' | 'Inactive' }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.status) qs.set('status', params.status)
    const s = qs.toString()
    return api(`/hospital/finance/petty-cash-accounts${s ? `?${s}` : ''}`)
  },
  createPettyCashAccount: (data: { code: string; name: string; department?: string; responsibleStaff?: string; status?: 'Active' | 'Inactive' }) =>
    api('/hospital/finance/petty-cash-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updatePettyCashAccount: (id: string, data: Partial<{ name: string; department: string; responsibleStaff: string; status: 'Active' | 'Inactive' }>) =>
    api(`/hospital/finance/petty-cash-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePettyCashAccount: (id: string) =>
    api(`/hospital/finance/petty-cash-accounts/${id}`, { method: 'DELETE' }),
  getPettyCashStatus: (code: string) => {
    const qs = new URLSearchParams();
    if (code) qs.set('code', code);
    return api(`/hospital/finance/petty-cash/status?${qs.toString()}`)
  },
  refillPettyCash: (data: { pettyCode: string; bankId: string; amount: number; dateIso?: string; memo?: string }) =>
    api('/hospital/finance/petty-cash/refill', { method: 'POST', body: JSON.stringify(data) }),
  transferPettyCash: (data: { toPettyCode: string; fromAccountCode: string; amount: number; dateIso?: string; memo?: string }) =>
    api('/hospital/finance/petty-cash/transfer', { method: 'POST', body: JSON.stringify(data) }),
  myPettyCash: () => api('/hospital/finance/petty-cash/me'),
  pullFundsToMyPettyCash: (data: { fromAccountCode: string; amount: number; dateIso?: string; memo?: string }) =>
    api('/hospital/finance/petty-cash/pull', { method: 'POST', body: JSON.stringify(data) }),
  listMyPettyCashPullHistory: () => api('/hospital/finance/petty-cash/pull/history'),

  // Personal Bank (Hospital portal user view)
  myBankAccount: () => api('/hospital/finance/bank/me'),
  pullFundsToMyBank: (data: { fromAccountCode: string; amount: number; dateIso?: string; memo?: string }) =>
    api('/hospital/finance/bank/pull', { method: 'POST', body: JSON.stringify(data) }),
  listMyBankPullHistory: () => api('/hospital/finance/bank/pull/history'),

  getFinanceAccountBalance: (code: string) => {
    const qs = new URLSearchParams();
    if (code) qs.set('code', code);
    return api(`/hospital/finance/account-balance?${qs.toString()}`)
  },
  listOpeningBalanceEntries: (params?: { code?: string }) => {
    const qs = new URLSearchParams();
    if (params?.code) qs.set('code', params.code)
    const s = qs.toString()
    return api(`/hospital/finance/opening-balances${s ? `?${s}` : ''}`)
  },
  listPettyRefillEntries: (params?: { code?: string }) => {
    const qs = new URLSearchParams();
    if (params?.code) qs.set('code', params.code)
    const s = qs.toString()
    return api(`/hospital/finance/petty-cash/refills${s ? `?${s}` : ''}`)
  },

  listFinanceAccountTransactions: (params: { code: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    qs.set('code', params.code)
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    if (params.limit != null) qs.set('limit', String(params.limit))
    return api(`/hospital/finance/account-transactions?${qs.toString()}`)
  },
  transferFinanceAccount: (data: { fromAccountCode: string; toAccountCode: string; amount: number; dateIso?: string; memo?: string }) =>
    api('/hospital/finance/account-transfer', { method: 'POST', body: JSON.stringify(data) }),
  // Hospital Petty Cash Expenses (backend-driven)
  listPettyCashExpenses: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/hospital/finance/petty-cash/expenses${s ? `?${s}` : ''}`)
  },
  createPettyCashExpense: (data: { dateIso: string; type: string; amount: number; usedBy?: string }) =>
    api('/hospital/finance/petty-cash/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deletePettyCashExpense: (id: string) =>
    api(`/hospital/finance/petty-cash/expenses/${id}`, { method: 'DELETE' }),
  getPatientStatement: (params: { mrn: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    qs.set('mrn', params.mrn)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    return api(`/hospital/finance/patient-statement?${qs.toString()}`)
  },
  // List statements across patients (MRN optional) — requires backend support
  listPatientStatements: (params?: { from?: string; to?: string; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/finance/patient-statements${s ? `?${s}` : ''}`)
  },

  // Bed Management
  listFloors: () => api('/hospital/floors'),
  createFloor: (data: { name: string; number?: string }) => api('/hospital/floors', { method: 'POST', body: JSON.stringify(data) }),
  listRooms: (floorId?: string) => api(`/hospital/rooms${floorId ? `?floorId=${encodeURIComponent(floorId)}` : ''}`),
  createRoom: (data: { name: string; floorId: string }) => api('/hospital/rooms', { method: 'POST', body: JSON.stringify(data) }),
  listWards: (floorId?: string) => api(`/hospital/wards${floorId ? `?floorId=${encodeURIComponent(floorId)}` : ''}`),
  createWard: (data: { name: string; floorId: string }) => api('/hospital/wards', { method: 'POST', body: JSON.stringify(data) }),
  listBeds: (params?: { floorId?: string; locationType?: 'room' | 'ward'; locationId?: string; status?: 'available' | 'occupied' }) => {
    const qs = new URLSearchParams()
    if (params?.floorId) qs.set('floorId', params.floorId)
    if (params?.locationType) qs.set('locationType', params.locationType)
    if (params?.locationId) qs.set('locationId', params.locationId)
    if (params?.status) qs.set('status', params.status)
    const s = qs.toString()
    return api(`/hospital/beds${s ? `?${s}` : ''}`)
  },
  addBeds: (data: { floorId: string; locationType: 'room' | 'ward'; locationId: string; labels: string[]; charges?: number; category?: string }) =>
    api('/hospital/beds', { method: 'POST', body: JSON.stringify(data) }),
  updateBedStatus: (id: string, data: { status: 'available' | 'occupied'; encounterId?: string }) =>
    api(`/hospital/beds/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // IPD
  admitIPD: (data: { patientId: string; departmentId: string; doctorId?: string; wardId?: string; bedId?: string; deposit?: number }) =>
    api('/hospital/ipd/admissions', { method: 'POST', body: JSON.stringify(data) }),
  dischargeIPD: (id: string, data?: { dischargeSummary?: string; endAt?: string }) =>
    api(`/hospital/ipd/admissions/${id}/discharge`, { method: 'PATCH', body: JSON.stringify(data || {}) }),
  listIPDAdmissions: (params?: { status?: 'admitted' | 'discharged'; doctorId?: string; departmentId?: string; patientId?: string; from?: string; to?: string; q?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.departmentId) qs.set('departmentId', params.departmentId)
    if (params?.patientId) qs.set('patientId', params.patientId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.q) qs.set('q', params.q)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions${s ? `?${s}` : ''}`)
  },
  transferIPDBed: (id: string, data: { newBedId: string }) =>
    api(`/hospital/ipd/admissions/${id}/transfer-bed`, { method: 'PATCH', body: JSON.stringify(data) }),
  admitFromOpdToken: (data: { tokenId: string; bedId?: string; deposit?: number; departmentId?: string; doctorId?: string; markTokenCompleted?: boolean }) =>
    api('/hospital/ipd/admissions/from-token', { method: 'POST', body: JSON.stringify(data) }),

  // IPD Referrals
  listIpdReferrals: (params?: { status?: 'New' | 'Accepted' | 'Rejected' | 'Admitted'; q?: string; from?: string; to?: string; departmentId?: string; doctorId?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.departmentId) qs.set('departmentId', params.departmentId)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/referrals${s ? `?${s}` : ''}`)
  },
  createIpdReferral: (data: { patientId: string; referralDate?: string; referralTime?: string; reasonOfReferral?: string; provisionalDiagnosis?: string; vitals?: { bp?: string; pulse?: number; temperature?: number; rr?: number }; referredTo?: { departmentId?: string; doctorId?: string }; condition?: { stability?: 'Stable' | 'Unstable'; consciousness?: 'Conscious' | 'Unconscious' }; remarks?: string; signStamp?: string }) =>
    api('/hospital/ipd/referrals', { method: 'POST', body: JSON.stringify(data) }),
  getIpdReferralById: (id: string) => api(`/hospital/ipd/referrals/${id}`),
  updateIpdReferral: (id: string, data: any) => api(`/hospital/ipd/referrals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateIpdReferralStatus: (id: string, action: 'accept' | 'reject' | 'reopen', note?: string) =>
    api(`/hospital/ipd/referrals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ action, note }) }),
  admitFromReferral: (id: string, data: { departmentId: string; doctorId?: string; wardId?: string; bedId?: string; deposit?: number; tokenFee?: number }) =>
    api(`/hospital/ipd/referrals/${id}/admit`, { method: 'POST', body: JSON.stringify(data) }),

  // IPD: Admission detail
  getIPDAdmissionById: (id: string) => api(`/hospital/ipd/admissions/${id}`),

  // IPD: Discharge Documents
  getIpdDischargeSummary: (encounterId: string) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/discharge-summary`),
  upsertIpdDischargeSummary: (encounterId: string, data: { diagnosis?: string; courseInHospital?: string; procedures?: string[]; conditionAtDischarge?: string; medications?: string[]; advice?: string; followUpDate?: string; notes?: string; createdBy?: string }) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/discharge-summary`, { method: 'PUT', body: JSON.stringify(data) }),
  getIpdDeathCertificate: (encounterId: string) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/death-certificate`),
  upsertIpdDeathCertificate: (encounterId: string, data: {
    // Existing simple
    dateOfDeath?: string; timeOfDeath?: string; causeOfDeath?: string; placeOfDeath?: string; notes?: string; createdBy?: string;
    // New structured
    dcNo?: string; mrNumber?: string; relative?: string; ageSex?: string; address?: string;
    presentingComplaints?: string; diagnosis?: string; primaryCause?: string; secondaryCause?: string;
    receiverName?: string; receiverRelation?: string; receiverIdCard?: string; receiverDate?: string; receiverTime?: string;
    staffName?: string; staffSignDate?: string; staffSignTime?: string; doctorName?: string; doctorSignDate?: string; doctorSignTime?: string;
  }) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/death-certificate`, { method: 'PUT', body: JSON.stringify(data) }),
  // IPD Birth Certificate
  getIpdBirthCertificate: (encounterId: string) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/birth-certificate`),
  upsertIpdBirthCertificate: (encounterId: string, data: any) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/birth-certificate`, { method: 'PUT', body: JSON.stringify(data) }),
  // Birth Certificate (Standalone)
  createBirthCertificate: (data: any) =>
    api(`/hospital/ipd/forms/birth-certificates`, { method: 'POST', body: JSON.stringify(data) }),
  getBirthCertificateById: (id: string) =>
    api(`/hospital/ipd/forms/birth-certificates/${encodeURIComponent(id)}`),
  updateBirthCertificateById: (id: string, data: any) =>
    api(`/hospital/ipd/forms/birth-certificates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBirthCertificateById: (id: string) =>
    api(`/hospital/ipd/forms/birth-certificates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // IPD Received Death
  getIpdReceivedDeath: (encounterId: string) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/received-death`),
  upsertIpdReceivedDeath: (encounterId: string, data: {
    srNo?: string; patientCnic?: string; relative?: string; ageSex?: string;
    emergencyReportedDate?: string; emergencyReportedTime?: string;
    receiving?: { pulse?: string; bloodPressure?: string; respiratoryRate?: string; pupils?: string; cornealReflex?: string; ecg?: string };
    diagnosis?: string; attendantName?: string; attendantRelative?: string; attendantRelation?: string; attendantAddress?: string; attendantCnic?: string;
    deathDeclaredBy?: string; chargeNurseName?: string; doctorName?: string; createdBy?: string;
  }) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/received-death`, { method: 'PUT', body: JSON.stringify(data) }),
  // IPD Short Stay
  getIpdShortStay: (encounterId: string) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/short-stay`),
  upsertIpdShortStay: (encounterId: string, data: { admittedAt?: string; dischargedAt?: string; data?: any; notes?: string; createdBy?: string }) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/short-stay`, { method: 'PUT', body: JSON.stringify(data) }),
  getIpdFinalInvoice: (encounterId: string) =>
    api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/final-invoice`),

  // IPD Forms Lists (for standalone pages)
  listIpdReceivedDeaths: (params?: { q?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/forms/received-deaths${s ? `?${s}` : ''}`)
  },
  listIpdDeathCertificates: (params?: { q?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/forms/death-certificates${s ? `?${s}` : ''}`)
  },
  listIpdBirthCertificates: (params?: { q?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/forms/birth-certificates${s ? `?${s}` : ''}`)
  },
  listIpdShortStays: (params?: { q?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/forms/short-stays${s ? `?${s}` : ''}`)
  },
  listIpdDischargeSummaries: (params?: { q?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/forms/discharge-summaries${s ? `?${s}` : ''}`)
  },

  // IPD Forms Deletes (by encounter)
  deleteIpdReceivedDeath: (encounterId: string) => api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/received-death`, { method: 'DELETE' }),
  deleteIpdDeathCertificate: (encounterId: string) => api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/death-certificate`, { method: 'DELETE' }),
  deleteIpdBirthCertificate: (encounterId: string) => api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/birth-certificate`, { method: 'DELETE' }),
  deleteIpdShortStay: (encounterId: string) => api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/short-stay`, { method: 'DELETE' }),
  deleteIpdDischargeSummary: (encounterId: string) => api(`/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/discharge-summary`, { method: 'DELETE' }),

  // IPD Records: Vitals
  listIpdVitals: (encounterId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/vitals${s ? `?${s}` : ''}`)
  },
  createIpdVital: (encounterId: string, data: { recordedAt?: string; bp?: string; hr?: number; rr?: number; temp?: number; spo2?: number; height?: number; weight?: number; painScale?: number; recordedBy?: string; note?: string; shift?: 'morning' | 'evening' | 'night'; bsr?: number; intakeIV?: string; urine?: string; nurseSign?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/vitals`, { method: 'POST', body: JSON.stringify(data) }),

  // IPD Records: Notes
  listIpdNotes: (encounterId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/notes${s ? `?${s}` : ''}`)
  },
  createIpdNote: (encounterId: string, data: { noteType: 'nursing' | 'progress' | 'discharge'; text: string; attachments?: string[]; createdBy?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/notes`, { method: 'POST', body: JSON.stringify(data) }),

  // IPD Records: Clinical Notes (Unified)
  listIpdClinicalNotes: (encounterId: string, params?: { type?: 'preop' | 'operation' | 'postop' | 'consultant' | 'anes-pre' | 'anes-intra' | 'anes-recovery' | 'anes-post-recovery' | 'anes-adverse'; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/clinical-notes${s ? `?${s}` : ''}`)
  },
  createIpdClinicalNote: (encounterId: string, data: { type: 'preop' | 'operation' | 'postop' | 'consultant' | 'anes-pre' | 'anes-intra' | 'anes-recovery' | 'anes-post-recovery' | 'anes-adverse'; recordedAt?: string; createdBy?: string; createdByRole?: string; doctorName?: string; sign?: string; data: any }) =>
    api(`/hospital/ipd/admissions/${encounterId}/clinical-notes`, { method: 'POST', body: JSON.stringify(data) }),
  updateIpdClinicalNote: (id: string, data: any) =>
    api(`/hospital/ipd/clinical-notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIpdClinicalNote: (id: string) =>
    api(`/hospital/ipd/clinical-notes/${id}`, { method: 'DELETE' }),

  // IPD Records: Doctor Visits
  listIpdDoctorVisits: (encounterId: string, params?: { page?: number; limit?: number; category?: 'visit' | 'progress' }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.category) qs.set('category', params.category)
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/doctor-visits${s ? `?${s}` : ''}`)
  },
  createIpdDoctorVisit: (encounterId: string, data: { doctorId?: string; when?: string; category?: 'visit' | 'progress'; subjective?: string; objective?: string; assessment?: string; plan?: string; diagnosisCodes?: string[]; nextReviewAt?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/doctor-visits`, { method: 'POST', body: JSON.stringify(data) }),
  updateIpdDoctorVisit: (id: string, data: { doctorId?: string; when?: string; category?: 'visit' | 'progress'; subjective?: string; objective?: string; assessment?: string; plan?: string; diagnosisCodes?: string[]; nextReviewAt?: string; done?: boolean }) =>
    api(`/hospital/ipd/doctor-visits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIpdDoctorVisit: (id: string) =>
    api(`/hospital/ipd/doctor-visits/${id}`, { method: 'DELETE' }),

  // IPD Records: Medication Orders
  listIpdMedOrders: (encounterId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/med-orders${s ? `?${s}` : ''}`)
  },
  createIpdMedOrder: (encounterId: string, data: { drugId?: string; drugName?: string; dose?: string; route?: string; frequency?: string; duration?: string; startAt?: string; endAt?: string; prn?: boolean; status?: 'active' | 'stopped'; prescribedBy?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/med-orders`, { method: 'POST', body: JSON.stringify(data) }),

  // IPD Records: MAR (admins) - list/create are order-scoped
  listIpdMedAdmins: (orderId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/med-orders/${orderId}/admins${s ? `?${s}` : ''}`)
  },
  createIpdMedAdmin: (orderId: string, data: { givenAt?: string; doseGiven?: string; byUser?: string; status?: 'given' | 'missed' | 'held'; remarks?: string }) =>
    api(`/hospital/ipd/med-orders/${orderId}/admins`, { method: 'POST', body: JSON.stringify(data) }),

  // IPD Records: Lab Links
  listIpdLabLinks: (encounterId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/lab-links${s ? `?${s}` : ''}`)
  },
  createIpdLabLink: (encounterId: string, data: { externalLabOrderId?: string; testIds?: string[]; status?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/lab-links`, { method: 'POST', body: JSON.stringify(data) }),
  updateIpdLabLink: (id: string, data: { externalLabOrderId?: string; testIds?: string[]; status?: string }) =>
    api(`/hospital/ipd/lab-links/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIpdLabLink: (id: string) =>
    api(`/hospital/ipd/lab-links/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // IPD Records: Billing Items
  listIpdBillingItems: (encounterId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/billing/items${s ? `?${s}` : ''}`)
  },
  createIpdBillingItem: (encounterId: string, data: { type: 'bed' | 'procedure' | 'medication' | 'service'; description: string; qty?: number; unitPrice?: number; amount?: number; date?: string; refId?: string; billedBy?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/billing/items`, { method: 'POST', body: JSON.stringify(data) }),
  updateIpdBillingItem: (id: string, data: { type?: 'bed' | 'procedure' | 'medication' | 'service'; description?: string; qty?: number; unitPrice?: number; amount?: number; date?: string; refId?: string; billedBy?: string }) =>
    api(`/hospital/ipd/billing/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIpdBillingItem: (id: string) =>
    api(`/hospital/ipd/billing/items/${id}`, { method: 'DELETE' }),

  // IPD Records: Payments
  listIpdPayments: (encounterId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/ipd/admissions/${encounterId}/billing/payments${s ? `?${s}` : ''}`)
  },
  createIpdPayment: (encounterId: string, data: { amount: number; method?: string; refNo?: string; receivedBy?: string; receivedAt?: string; notes?: string }) =>
    api(`/hospital/ipd/admissions/${encounterId}/billing/payments`, { method: 'POST', body: JSON.stringify(data) }),
  updateIpdPayment: (id: string, data: { amount?: number; method?: string; refNo?: string; receivedBy?: string; receivedAt?: string; notes?: string }) =>
    api(`/hospital/ipd/billing/payments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIpdPayment: (id: string) =>
    api(`/hospital/ipd/billing/payments/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Prescriptions
  createPrescription: (data: { encounterId: string; historyTakingId?: string; labReportsEntryId?: string; medicine?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>; items?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>; labTests?: string[]; labNotes?: string; diagnosticTests?: string[]; diagnosticNotes?: string; diagnosticDiscount?: number; therapyTests?: string[]; therapyNotes?: string; therapyDiscount?: number; therapyPlan?: any; therapyMachines?: any; counselling?: any; counsellingDiscount?: number; primaryComplaint?: string; primaryComplaintHistory?: string; familyHistory?: string; treatmentHistory?: string; allergyHistory?: string; history?: string; examFindings?: string; diagnosis?: string; advice?: string; createdBy?: string; vitals?: { pulse?: number; temperatureC?: number; bloodPressureSys?: number; bloodPressureDia?: number; respiratoryRate?: number; bloodSugar?: number; weightKg?: number; heightCm?: number; bmi?: number; bsa?: number; spo2?: number }; historyEdits?: { personalInfo?: any; maritalStatus?: any; coitus?: any; health?: any; sexualHistory?: any; previousMedicalHistory?: any; arrivalReference?: any } }) =>
    api('/hospital/opd/prescriptions', { method: 'POST', body: JSON.stringify(data) }),
  getPrescriptionByEncounter: (encounterId: string) =>
    api(`/hospital/opd/encounters/${encodeURIComponent(encounterId)}/prescription`),
  upsertPrescriptionByEncounter: (encounterId: string, data: { historyTakingId?: string; labReportsEntryId?: string; medicine?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>; items?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>; labTests?: string[]; labNotes?: string; diagnosticTests?: string[]; diagnosticNotes?: string; diagnosticDiscount?: number; therapyTests?: string[]; therapyNotes?: string; therapyDiscount?: number; therapyPlan?: any; therapyMachines?: any; counselling?: any; counsellingDiscount?: number; primaryComplaint?: string; primaryComplaintHistory?: string; familyHistory?: string; treatmentHistory?: string; allergyHistory?: string; history?: string; examFindings?: string; diagnosis?: string; advice?: string; createdBy?: string; vitals?: { pulse?: number; temperatureC?: number; bloodPressureSys?: number; bloodPressureDia?: number; respiratoryRate?: number; bloodSugar?: number; weightKg?: number; heightCm?: number; bmi?: number; bsa?: number; spo2?: number }; historyEdits?: { personalInfo?: any; maritalStatus?: any; coitus?: any; health?: any; sexualHistory?: any; previousMedicalHistory?: any; arrivalReference?: any } }) =>
    api(`/hospital/opd/encounters/${encodeURIComponent(encounterId)}/prescription`, { method: 'PUT', body: JSON.stringify(data) }),
  listPrescriptions: (params?: { doctorId?: string; patientMrn?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.patientMrn) qs.set('patientMrn', params.patientMrn)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/opd/prescriptions${s ? `?${s}` : ''}`)
  },
  getPrescription: (id: string) => api(`/hospital/opd/prescriptions/${id}`),
  getPrescriptionByHistoryTakingId: (historyTakingId: string) =>
    api(`/hospital/opd/prescriptions/by-history-taking/${encodeURIComponent(historyTakingId)}`),
  updatePrescription: (id: string, data: { historyTakingId?: string; labReportsEntryId?: string; medicine?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>; items?: Array<{ name: string; dose?: string; frequency?: string; duration?: string; notes?: string }>; labTests?: string[]; labNotes?: string; diagnosticTests?: string[]; diagnosticNotes?: string; diagnosticDiscount?: number; therapyTests?: string[]; therapyNotes?: string; therapyDiscount?: number; therapyPlan?: any; therapyMachines?: any; counselling?: any; counsellingDiscount?: number; primaryComplaint?: string; primaryComplaintHistory?: string; familyHistory?: string; treatmentHistory?: string; allergyHistory?: string; history?: string; examFindings?: string; diagnosis?: string; advice?: string; createdBy?: string; vitals?: { pulse?: number; temperatureC?: number; bloodPressureSys?: number; bloodPressureDia?: number; respiratoryRate?: number; bloodSugar?: number; weightKg?: number; heightCm?: number; bmi?: number; bsa?: number; spo2?: number }; historyEdits?: { personalInfo?: any; maritalStatus?: any; coitus?: any; health?: any; sexualHistory?: any; previousMedicalHistory?: any; arrivalReference?: any } }) =>
    api(`/hospital/opd/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrescription: (id: string) => api(`/hospital/opd/prescriptions/${id}`, { method: 'DELETE' }),

  // Referrals (OPD)
  createReferral: (data: { type: 'lab' | 'pharmacy' | 'diagnostic'; encounterId: string; doctorId: string; prescriptionId?: string; tests?: string[]; notes?: string }) =>
    api('/hospital/opd/referrals', { method: 'POST', body: JSON.stringify(data) }),
  listReferrals: (params?: { type?: 'lab' | 'pharmacy' | 'diagnostic'; status?: 'pending' | 'completed' | 'cancelled'; doctorId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.status) qs.set('status', params.status)
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/opd/referrals${s ? `?${s}` : ''}`)
  },
  updateReferralStatus: (id: string, status: 'pending' | 'completed' | 'cancelled') =>
    api(`/hospital/opd/referrals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteReferral: (id: string) => api(`/hospital/opd/referrals/${id}`, { method: 'DELETE' }),

  // Notifications (Doctor portal)
  listNotifications: (doctorId: string) =>
    api(`/hospital/notifications?doctorId=${encodeURIComponent(doctorId)}`),
  updateNotification: (id: string, read: boolean) =>
    api(`/hospital/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ read }) }),
  // Audit Logs
  listHospitalAuditLogs: (params?: { search?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.action) qs.set('action', params.action)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/audit-logs${s ? `?${s}` : ''}`)
  },
  createHospitalAuditLog: (data: { actor?: string; action: string; label?: string; method?: string; path?: string; at: string; detail?: string }) =>
    api('/hospital/audit-logs', { method: 'POST', body: JSON.stringify(data) }),
}

export const financeApi = {
  manualDoctorEarning: (data: { doctorId: string; departmentId?: string; amount: number; revenueAccount?: 'OPD_REVENUE' | 'PROCEDURE_REVENUE' | 'IPD_REVENUE'; paidMethod?: 'Cash' | 'Bank' | 'AR'; memo?: string; sharePercent?: number; patientName?: string; mrn?: string }) =>
    api('/hospital/finance/manual-doctor-earning', { method: 'POST', body: JSON.stringify(data) }),
  doctorPayout: (data: { doctorId: string; amount: number; method?: 'Cash' | 'Bank'; memo?: string; fromAccountCode?: string }) =>
    api('/hospital/finance/doctor-payout', { method: 'POST', body: JSON.stringify(data) }),
  doctorBalance: (doctorId: string) =>
    api(`/hospital/finance/doctor/${encodeURIComponent(doctorId)}/balance`),
  doctorPayouts: (doctorId: string, limit?: number) =>
    api(`/hospital/finance/doctor/${encodeURIComponent(doctorId)}/payouts${limit ? `?limit=${limit}` : ''}`),
  listPayouts: (params?: { doctorId?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api(`/hospital/finance/payouts${s ? `?${s}` : ''}`)
  },
  doctorAccruals: (doctorId: string, from: string, to: string) =>
    api(`/hospital/finance/doctor/${encodeURIComponent(doctorId)}/accruals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  doctorEarnings: (params?: { doctorId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/hospital/finance/earnings${s ? `?${s}` : ''}`)
  },
  reverseJournal: (journalId: string, memo?: string) =>
    api(`/hospital/finance/journal/${encodeURIComponent(journalId)}/reverse`, { method: 'POST', body: JSON.stringify({ memo }) }),
}

export const aestheticFinanceApi = {
  manualDoctorEarning: (data: { doctorId: string; amount: number; revenueAccount?: 'OPD_REVENUE' | 'PROCEDURE_REVENUE' | 'IPD_REVENUE'; paidMethod?: 'Cash' | 'Bank' | 'AR'; memo?: string; patientName?: string; mrn?: string }) =>
    api('/aesthetic/finance/manual-doctor-earning', { method: 'POST', body: JSON.stringify(data) }),
  doctorPayout: (data: { doctorId: string; amount: number; method?: 'Cash' | 'Bank'; memo?: string }) =>
    api('/aesthetic/finance/doctor-payout', { method: 'POST', body: JSON.stringify(data) }),
  doctorBalance: (doctorId: string) =>
    api(`/aesthetic/finance/doctor/${encodeURIComponent(doctorId)}/balance`),
  doctorPayouts: (doctorId: string, limit?: number) =>
    api(`/aesthetic/finance/doctor/${encodeURIComponent(doctorId)}/payouts${limit ? `?limit=${limit}` : ''}`),
  doctorEarnings: (params?: { doctorId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.doctorId) qs.set('doctorId', params.doctorId)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const s = qs.toString()
    return api(`/aesthetic/finance/earnings${s ? `?${s}` : ''}`)
  },
  reverseJournal: (journalId: string, memo?: string) =>
    api(`/aesthetic/finance/journal/${encodeURIComponent(journalId)}/reverse`, { method: 'POST', body: JSON.stringify({ memo }) }),
  payablesSummary: () => api('/aesthetic/finance/payables-summary'),
  listRecentPayouts: (limit?: number) => api(`/aesthetic/finance/payouts${limit ? `?limit=${limit}` : ''}`),
}
