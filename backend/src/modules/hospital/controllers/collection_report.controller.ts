import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { PettyCashAccount } from '../models/PettyCashAccount'
import { BankAccount } from '../models/BankAccount'
import { HospitalUser } from '../models/User'
import { HospitalToken } from '../models/Token'
import { DiagnosticOrder } from '../../diagnostic/models/Order'
import { DiagnosticUser } from '../../diagnostic/models/User'

type Row = {
  pettyCashOwner: string
  date: string
  time: string
  customerSupplier: string
  customerSupplierNo: string
  invoiceNo: string
  department: string
  transactionType: string
  transBy: string
  transactionNo: string
  credit: number
  debit: number
  balance: number
}

const querySchema = z.object({
  department: z.enum(['All', 'OPD', 'Diagnostics', 'Pharmacy', 'Therapy', 'Counselling', 'Finance']).optional(),
  reportType: z.enum(['Detailed', 'Closing Balances', 'Opening Balances']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  timeFrom: z.string().optional(),
  timeTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
})

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function safeTimeLabel(x: any) {
  try {
    const d = x instanceof Date ? x : new Date(x)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleTimeString()
  } catch {
    return '-'
  }
}

function safeDateLabel(dateIso: string) {
  try {
    const d = new Date(`${String(dateIso || '').slice(0, 10)}T00:00:00.000Z`)
    if (Number.isNaN(d.getTime())) return String(dateIso || '')
    return d.toLocaleDateString()
  } catch {
    return String(dateIso || '')
  }
}

function normDept(x?: string) {
  const raw = String(x || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.includes('opd')) return 'OPD'
  if (raw.includes('diagn')) return 'Diagnostics'
  if (raw.includes('pharm')) return 'Pharmacy'
  if (raw.includes('therap')) return 'Therapy'
  if (raw.includes('couns')) return 'Counselling'
  return String(x || '').trim()
}

function inferDepartment(j: any, pettyDept?: string) {
  const fromAcct = normDept(pettyDept)
  if (fromAcct) return fromAcct
  const rt = String(j?.refType || '').toLowerCase()
  if (rt === 'opd_token') return 'OPD'
  if (rt.startsWith('diag_')) return 'Diagnostics'
  if (rt.startsWith('pharm') || rt.includes('pharmacy')) return 'Pharmacy'
  if (rt.startsWith('therapy') || rt.includes('therapy')) return 'Therapy'
  if (rt.startsWith('counselling') || rt.includes('counselling')) return 'Counselling'
  return ''
}

function inferInvoiceNo(j: any) {
  const memo = String(j?.memo || '')
  const rt = String(j?.refType || '')
  if (rt === 'opd_token') {
    const m = memo.match(/#\s*([0-9]+)/)
    if (m) return String(m[1])
  }
  if (j?.refId) return String(j.refId)
  return ''
}

function findTagValueFromLines(j: any, key: string) {
  try {
    const lines: any[] = Array.isArray(j?.lines)
      ? j.lines
      : (Array.isArray(j?.allLines) ? j.allLines : [])
    for (const l of lines) {
      const v = l?.tags ? l.tags[key] : undefined
      const s = String(v ?? '').trim()
      if (s) return s
    }
  } catch { }
  return ''
}

function inferCustomerSupplier(line: any, j: any) {
  const tags = line?.tags || {}
  const name = String(tags?.patientName || tags?.customerName || tags?.supplierName || tags?.receiver || '').trim()
  if (name) return name

  const memo = String(j?.memo || '').trim()
  const rt = String(j?.refType || '').toLowerCase()
  if (rt === 'opd_token') {
    const parts = memo.split('—')
    if (parts.length > 1) return String(parts.slice(1).join('—')).trim()
  }
  return ''
}

function inferCustomerSupplierNo(line: any) {
  const tags = line?.tags || {}
  const id = String(tags?.mrn || tags?.customerNo || tags?.supplierNo || '').trim()
  return id
}

function inferStaffNameForSalary(line: any) {
  const tags = line?.tags || {}
  const staffName = String(tags?.staffName || '').trim()
  if (staffName) return staffName
  const receiver = String(tags?.receiver || '').trim()
  if (receiver) return String(receiver.split('-')[0] || '').trim()
  return ''
}

function inferDepartmentNameForSalary(line: any) {
  const tags = line?.tags || {}
  const dept = String(tags?.departmentName || '').trim()
  return dept
}

function inferCounterparty(line: any, j: any) {
  const tags = line?.tags || {}
  const patientName = String(tags?.patientName || tags?.customerName || '').trim()
  const supplierName = String(tags?.supplierName || tags?.receiver || '').trim()
  const memo = String(j?.memo || '').trim()
  const rt = String(j?.refType || '').toLowerCase()

  if (patientName) return { kind: 'customer' as const, name: patientName }
  if (String(tags?.mrn || '').trim()) return { kind: 'customer' as const, name: '' }

  if (supplierName) return { kind: 'supplier' as const, name: supplierName }
  if (String(tags?.staffId || '').trim()) return { kind: 'supplier' as const, name: supplierName || 'Staff' }

  if (rt === 'hospital_credit_patient_payment' || rt === 'therp_credit_rev' || rt === 'couns_credit_rev' || rt === 'pharmacy_credit_payment') {
    const parts = memo.split('—')
    const nm = parts.length > 1 ? String(parts.slice(1).join('—')).trim() : ''
    // strip trailing " (customerId) by actorUsername" suffix
    const clean = nm.replace(/\s*\([^)]+\).*$/, '').trim()
    return { kind: 'customer' as const, name: clean }
  }

  return { kind: 'unknown' as const, name: '' }
}

function inferDepartmentFromJournal(j: any, pettyDept?: string) {
  const rt = String(j?.refType || '').toLowerCase()
  if (rt === 'finance_account_transfer') return 'Finance'
  if (rt === 'petty_cash_transfer') return 'Finance'

  const fromAcct = normDept(pettyDept)
  if (fromAcct) return fromAcct
  if (rt === 'opd_token' || rt.includes('hospital_credit_patient_payment')) return 'OPD'
  if (rt === 'therp_credit_rev') return 'Therapy'
  if (rt === 'couns_credit_rev') return 'Counselling'
  if (rt.startsWith('diag_')) return 'Diagnostics'

  const lines: any[] = Array.isArray(j?.lines) ? j.lines : (Array.isArray(j?.allLines) ? j.allLines : [])
  const hasCredit = (acct: string) => lines.some(l => String(l?.account || '').trim().toUpperCase() === acct && Number(l?.credit || 0) > 0)
  if (hasCredit('OPD_REVENUE')) return 'OPD'
  if (hasCredit('DIAGNOSTIC_REVENUE')) return 'Diagnostics'
  if (hasCredit('PHARMACY_REVENUE')) return 'Pharmacy'
  if (hasCredit('THERAPY_REVENUE')) return 'Therapy'
  if (hasCredit('COUNSELLING_REVENUE')) return 'Counselling'
  return ''
}

function inferTransactionType(j: any) {
  const rt = String(j?.refType || '').toLowerCase()
  const memo = String(j?.memo || '').toLowerCase()
  const lines: any[] = Array.isArray(j?.lines) ? j.lines : (Array.isArray(j?.allLines) ? j.allLines : [])
  const hasAcct = (acct: string) => lines.some(l => String(l?.account || '').trim().toUpperCase() === acct)
  const hasCredit = (acct: string) => lines.some(l => String(l?.account || '').trim().toUpperCase() === acct && Number(l?.credit || 0) > 0)
  const hasArCredit = lines.some(l => String(l?.account || '').trim().toUpperCase() === 'AR' && Number(l?.credit || 0) > 0)

  if (rt === 'finance_account_transfer' || rt === 'petty_cash_transfer' || rt === 'petty_cash_refill' || rt === 'petty_cash_pull') return 'Transfer'

  if (rt === 'opd_token') return 'OPD_Rev'
  if (rt === 'opd_return') return 'OPD_Return'
  if (rt === 'hospital_credit_patient_payment') return 'OPD_Credit_Rev'
  if (rt === 'therp_credit_rev') return 'Therp_Credit_Rev'
  if (rt === 'couns_credit_rev') return 'Couns_Credit_Rev'

  if (rt === 'diag_order' || rt === 'diag_order_payment') return hasArCredit ? 'Diag_Credit_Rev' : 'Diagnostics_Rev'
  if (rt === 'diag_credit_payment') return 'Diag_Credit_Rev'

  if (rt === 'doctor_payout') return 'Doc_Payout'

  if (rt === 'pharmacy_sale') return 'Pharmacy_Rev'
  if (rt === 'pharmacy_return') return 'Pharmacy_Return'
  if (rt === 'pharmacy_credit_payment') return 'Pharm_Credit_Rev'

  if (rt === 'expense_payment') {
    const tags = (lines.find(l => l?.tags)?.tags) || {}
    const kind = String(tags?.kind || '').toLowerCase()
    if (kind.includes('salary') || memo.includes('salary') || String(tags?.salaryMonth || '').trim()) return 'Salary'
    const cat = String(tags?.category || tags?.expenseCategory || '').trim()
    if (cat) return `Expense-${cat}`
    return 'Expense'
  }

  // Generic inference based on credited revenue accounts
  if (hasCredit('OPD_REVENUE')) return hasArCredit ? 'OPD_Credit_Rev' : 'OPD_Rev'
  if (hasCredit('DIAGNOSTIC_REVENUE')) return hasArCredit ? 'Diag_Credit_Rev' : 'Diagnostics_Rev'
  if (hasCredit('PHARMACY_REVENUE') || hasAcct('PHARMACY_REVENUE')) return 'Pharmacy_Rev'
  if (hasCredit('THERAPY_REVENUE') || hasAcct('THERAPY_REVENUE')) return 'Therapy_Rev'
  if (hasCredit('COUNSELLING_REVENUE') || hasAcct('COUNSELLING_REVENUE')) return 'Counselling_Rev'

  return 'Transfer'
}

function inferFromToAccounts(lines: any[], currentAccount: string) {
  const cur = String(currentAccount || '').trim().toUpperCase()
  const debits = lines
    .map(l => ({ a: String(l?.account || '').trim().toUpperCase(), v: Number(l?.debit || 0) || 0 }))
    .filter(x => x.a && x.v > 0)
  const credits = lines
    .map(l => ({ a: String(l?.account || '').trim().toUpperCase(), v: Number(l?.credit || 0) || 0 }))
    .filter(x => x.a && x.v > 0)

  const curDebit = debits.some(x => x.a === cur)
  const curCredit = credits.some(x => x.a === cur)

  // Typical transfer: one credit (sender), one debit (receiver)
  if (curDebit && !curCredit) {
    const from = credits.find(x => x.a !== cur)?.a || credits[0]?.a || ''
    return { from, to: cur }
  }
  if (curCredit && !curDebit) {
    const to = debits.find(x => x.a !== cur)?.a || debits[0]?.a || ''
    return { from: cur, to }
  }

  // Fallback: pick first credit and first debit
  const from = credits[0]?.a || ''
  const to = debits[0]?.a || ''
  return { from, to }
}

function accountLabel(code: string, pettyByCode: Map<string, any>) {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return ''
  const petty = pettyByCode.get(c)
  if (petty) return String(petty.name || petty.code || c)
  return c
}

function bankAccountCode(b: any) {
  const existing = String(b?.financeAccountCode || '').trim().toUpperCase()
  if (existing) return existing
  const an = String(b?.accountNumber || '')
  const last4 = an ? an.slice(-4) : ''
  const idSuffix = String(b?._id || '').slice(-4).toUpperCase()
  return last4 ? `BANK_${last4}_${idSuffix}` : ''
}

async function computeOpeningBalancesByAccount(codes: string[], from: string) {
  if (!codes.length) return new Map<string, number>()
  const rows: any[] = await FinanceJournal.aggregate([
    { $match: { dateIso: { $lt: from }, 'lines.account': { $in: codes } } },
    { $unwind: '$lines' },
    { $match: { 'lines.account': { $in: codes } } },
    {
      $group: {
        _id: '$lines.account',
        debit: { $sum: { $ifNull: ['$lines.debit', 0] } },
        credit: { $sum: { $ifNull: ['$lines.credit', 0] } },
      },
    },
    { $project: { _id: 1, bal: { $subtract: ['$debit', '$credit'] } } },
  ])
  return new Map<string, number>(rows.map(r => [String(r._id || ''), Number(r.bal || 0)]))
}

export async function collectionReport(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query)
  const department = (parsed.success ? parsed.data.department : undefined) || 'All'
  const reportType = (parsed.success ? parsed.data.reportType : undefined) || 'Detailed'
  const from = (parsed.success ? parsed.data.from : undefined) || todayIso()
  const to = (parsed.success ? parsed.data.to : undefined) || todayIso()
  const timeFrom = (parsed.success ? parsed.data.timeFrom : undefined) || ''
  const timeTo = (parsed.success ? parsed.data.timeTo : undefined) || ''
  const limit = (parsed.success ? parsed.data.limit : undefined) || 5000

  const timeRe = /^\d{2}:\d{2}$/
  const tf = timeRe.test(timeFrom) ? timeFrom : ''
  const tt = timeRe.test(timeTo) ? timeTo : ''
  const tfMin = tf ? Number(tf.slice(0, 2)) * 60 + Number(tf.slice(3, 5)) : null
  const ttMin = tt ? Number(tt.slice(0, 2)) * 60 + Number(tt.slice(3, 5)) : null

  const [pettyAccountsAll, bankAccountsAll] = await Promise.all([
    PettyCashAccount.find({}).select({ code: 1, name: 1, department: 1, responsibleStaff: 1 }).lean(),
    BankAccount.find({}).select({ bankName: 1, accountTitle: 1, accountNumber: 1, financeAccountCode: 1, status: 1 }).lean(),
  ])

  const pettyCodes = (pettyAccountsAll as any[]).map((p: any) => String(p.code || '').trim().toUpperCase()).filter(Boolean)
  const bankCodes = (bankAccountsAll as any[]).map((b: any) => bankAccountCode(b)).map(s => String(s || '').trim().toUpperCase()).filter(Boolean)
  const accountCodes = Array.from(new Set([...pettyCodes, ...bankCodes]))

  const accountByCode = new Map<string, any>()
  for (const p of (pettyAccountsAll as any[])) {
    const c = String(p?.code || '').trim().toUpperCase()
    if (!c) continue
    accountByCode.set(c, { kind: 'petty', code: c, name: String(p?.name || c), department: p?.department })
  }
  for (const b of (bankAccountsAll as any[])) {
    const c = String(bankAccountCode(b) || '').trim().toUpperCase()
    if (!c) continue
    const label = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}`.trim()
    accountByCode.set(c, { kind: 'bank', code: c, name: label || c })
  }

  if (!accountCodes.length) return res.json({ reportType, from, to, department, items: [] })

  const openingByCode = await computeOpeningBalancesByAccount(accountCodes, from)

  if (reportType === 'Opening Balances') {
    const rowsAll: Row[] = accountCodes.map(code => {
      const acct = accountByCode.get(code)
      const opening = openingByCode.get(code) || 0
      const dept = inferDepartmentFromJournal({ refType: 'opening_balances' }, acct?.department)
      return {
        pettyCashOwner: acct ? String(acct.name || code) : code,
        date: safeDateLabel(from),
        time: '-',
        customerSupplier: '-',
        customerSupplierNo: '-',
        invoiceNo: '-',
        department: dept || '-',
        transactionType: 'Opening Balance',
        transBy: '-',
        transactionNo: code,
        credit: 0,
        debit: 0,
        balance: opening,
      }
    })

    const rows = department === 'All' ? rowsAll : rowsAll.filter(r => r.department === department)

    return res.json({ reportType, from, to, department, items: rows })
  }

  if (reportType === 'Closing Balances') {
    const closingAgg = await FinanceJournal.aggregate([
      { $match: { dateIso: { $lte: to }, 'lines.account': { $in: accountCodes } } },
      { $unwind: '$lines' },
      { $match: { 'lines.account': { $in: accountCodes } } },
      { $group: { _id: '$lines.account', debit: { $sum: { $ifNull: ['$lines.debit', 0] } }, credit: { $sum: { $ifNull: ['$lines.credit', 0] } } } },
    ])
    const closingBy = new Map<string, number>(closingAgg.map((r: any) => [String(r._id || ''), Number(r.debit || 0) - Number(r.credit || 0)]))

    const rowsAll: Row[] = accountCodes.map(code => {
      const acct = accountByCode.get(code)
      const opening = openingByCode.get(code) || 0
      const closing = closingBy.get(code) || 0
      const movement = closing - opening
      const dept = inferDepartmentFromJournal({ refType: 'closing_balances' }, acct?.department)
      return {
        pettyCashOwner: acct ? String(acct.name || code) : code,
        date: safeDateLabel(to),
        time: '-',
        customerSupplier: '-',
        customerSupplierNo: '-',
        invoiceNo: '-',
        department: dept || '-',
        transactionType: 'Closing Balance',
        transBy: '-',
        transactionNo: code,
        credit: movement > 0 ? movement : 0,
        debit: movement < 0 ? Math.abs(movement) : 0,
        balance: closing,
      }
    })

    const rows = department === 'All' ? rowsAll : rowsAll.filter(r => r.department === department)

    return res.json({ reportType, from, to, department, items: rows })
  }

  const raw: any[] = await FinanceJournal.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to }, 'lines.account': { $in: accountCodes } } },
    { $addFields: { txId: { $ifNull: ['$txId', { $concat: ['TXN-', { $toString: '$_id' }] }] } } },
    { $addFields: { allLines: '$lines' } },
    { $unwind: '$lines' },
    { $match: { 'lines.account': { $in: accountCodes }, $or: [{ 'lines.debit': { $gt: 0 } }, { 'lines.credit': { $gt: 0 } }] } },
    { $project: { _id: 1, txId: 1, dateIso: 1, createdAt: 1, createdBy: 1, createdByUsername: 1, refType: 1, refId: 1, memo: 1, line: '$lines', allLines: 1 } },
    { $sort: { dateIso: 1, createdAt: 1, _id: 1 } },
    { $limit: limit },
  ])

  const diagOrderIds = Array.from(new Set(
    raw
      .filter(r => {
        const rt = String(r?.refType || '').toLowerCase()
        return rt === 'diag_order' || rt === 'diag_order_payment'
      })
      .map(r => String(r?.refId || '').trim())
      .filter(Boolean)
  ))
  const opdTokenIds = Array.from(new Set(
    raw
      .filter(r => String(r?.refType || '').toLowerCase() === 'opd_token')
      .map(r => String(r?.refId || '').trim())
      .filter(Boolean)
  ))

  const [diagOrders, opdTokens] = await Promise.all([
    diagOrderIds.length
      ? DiagnosticOrder.find({ _id: { $in: diagOrderIds } }).select({ patient: 1 }).lean()
      : [],
    opdTokenIds.length
      ? HospitalToken.find({ _id: { $in: opdTokenIds } }).select({ patientName: 1, mrn: 1 }).lean()
      : [],
  ])
  const diagById = new Map<string, { patientName?: string; mrn?: string }>(
    (diagOrders as any[]).map(o => [
      String((o as any)?._id || ''),
      {
        patientName: (o as any)?.patient?.fullName != null ? String((o as any).patient.fullName) : undefined,
        mrn: (o as any)?.patient?.mrn != null ? String((o as any).patient.mrn) : undefined,
      },
    ])
  )
  const tokenById = new Map<string, { patientName?: string; mrn?: string }>(
    (opdTokens as any[]).map(t => [
      String((t as any)?._id || ''),
      {
        patientName: (t as any)?.patientName != null ? String((t as any).patientName) : undefined,
        mrn: (t as any)?.mrn != null ? String((t as any).mrn) : undefined,
      },
    ])
  )

  const userIdsAll = Array.from(new Set(raw.map(r => r?.createdBy ? String(r.createdBy) : '').filter(Boolean)))
  const oidRe = /^[a-f0-9]{24}$/i
  const userIds = userIdsAll.filter(id => oidRe.test(id))
  const users: any[] = userIds.length
    ? await HospitalUser.find({ _id: { $in: userIds } }).select({ username: 1, fullName: 1, role: 1 }).lean()
    : []
  const userById = new Map<string, any>(users.map((u: any) => [String(u._id), u]))

  const diagUsers: any[] = userIds.length
    ? await DiagnosticUser.find({ _id: { $in: userIds } }).select({ username: 1, role: 1 }).lean()
    : []
  const diagUserById = new Map<string, any>(diagUsers.map((u: any) => [String(u._id), u]))

  const byPetty: Record<string, Row[]> = {}

  for (const r of raw) {
    const line = r?.line || {}
    const code = String(line?.account || '').trim().toUpperCase()
    const acct = accountByCode.get(code)

    // Attach full lines on the row object for inference helpers
    const jForInfer = { ...r, lines: Array.isArray(r?.allLines) ? r.allLines : undefined }

    const debit = Number(line?.debit || 0) || 0
    const credit = Number(line?.credit || 0) || 0
    const txnType = debit > 0 ? 'Collection' : (credit > 0 ? 'Payment' : '')

    const u = r?.createdBy ? userById.get(String(r.createdBy)) : null
    const du = !u && r?.createdBy ? diagUserById.get(String(r.createdBy)) : null
    const rawCreatedBy = r?.createdByUsername ? String(r.createdByUsername) : (r?.createdBy ? String(r.createdBy) : '')
    const transBy = u
      ? `${String(u.fullName || u.username || '').trim()}-${String(u.role || '').trim()}`.replace(/-$/, '')
      : (du
        ? `${String(du.username || '').trim()}-${String(du.role || '').trim()}`.replace(/-$/, '')
        : rawCreatedBy)

    const dateIso = String(r?.dateIso || '')
    const date = safeDateLabel(dateIso)
    const time = safeTimeLabel(r?.createdAt)

    const cp = inferCounterparty(line, jForInfer)
    const rawName = cp.name || inferCustomerSupplier(line, jForInfer)
    let cust = cp.kind === 'customer'
      ? (rawName ? `C-${rawName}` : 'C-')
      : (cp.kind === 'supplier' ? (rawName ? `S-${rawName}` : 'S-') : (rawName || ''))

    // If not a patient/supplier transaction, show both sender/receiver accounts
    if (!cust || cp.kind === 'unknown') {
      const linesForParties: any[] = Array.isArray(jForInfer?.lines) ? jForInfer.lines : (Array.isArray((jForInfer as any)?.allLines) ? (jForInfer as any).allLines : [])
      const { from, to } = inferFromToAccounts(linesForParties, code)
      const fromLbl = accountLabel(from, accountByCode as any)
      const toLbl = accountLabel(to, accountByCode as any)
      if (fromLbl || toLbl) cust = `From: ${fromLbl || '-'}  To: ${toLbl || '-'}`
    }
    const custNo = inferCustomerSupplierNo(line)

    if (tfMin != null || ttMin != null) {
      const d = r?.createdAt ? new Date(r.createdAt) : null
      if (d && !Number.isNaN(d.getTime())) {
        const m = d.getUTCHours() * 60 + d.getUTCMinutes()
        if (tfMin != null && m < tfMin) continue
        if (ttMin != null && m > ttMin) continue
      }
    }

    let invoiceNo = inferInvoiceNo(r)

    const inferredTxnType = inferTransactionType(jForInfer) || txnType || '-'
    const rtLower = String(r?.refType || '').toLowerCase()

    // For Expense-* (especially Expense-Supplies) show the exact invoice saved with the transaction.
    if (String(inferredTxnType).toLowerCase().startsWith('expense-') || inferredTxnType === 'Expense') {
      const exact = findTagValueFromLines(jForInfer, 'invoiceNo')
      if (exact) invoiceNo = exact
    }
    const snap = rtLower === 'opd_token'
      ? tokenById.get(String(r?.refId || ''))
      : ((rtLower === 'diag_order' || rtLower === 'diag_order_payment') ? diagById.get(String(r?.refId || '')) : undefined)

    if (inferredTxnType === 'Salary') {
      const nm = inferStaffNameForSalary(line)
      if (nm) cust = nm
    }

    if ((inferredTxnType === 'Diagnostics_Rev' || inferredTxnType === 'Diag_Credit_Rev' || inferredTxnType === 'OPD_Rev' || inferredTxnType === 'OPD_Credit_Rev') && snap) {
      if (snap.patientName && (!cust || cust === '-' || cust === 'C-' || cp.kind === 'unknown')) cust = `C-${String(snap.patientName).trim()}`
    }
    const custNoFromSnap = snap?.mrn ? String(snap.mrn).trim() : ''

    if (inferredTxnType === 'Transfer') {
      cust = ''
    }

    if (
      inferredTxnType === 'Diagnostics_Rev' ||
      inferredTxnType === 'Diag_Credit_Rev' ||
      inferredTxnType === 'OPD_Rev' ||
      inferredTxnType === 'OPD_Credit_Rev' ||
      inferredTxnType === 'Therapy_Rev' ||
      inferredTxnType === 'Counselling_Rev' ||
      inferredTxnType === 'Therp_Credit_Rev' ||
      inferredTxnType === 'Couns_Credit_Rev' ||
      inferredTxnType === 'Pharmacy_Rev' ||
      inferredTxnType === 'Pharmacy_Return' ||
      inferredTxnType === 'Pharm_Credit_Rev'
    ) {
      invoiceNo = ''
    }

    if (inferredTxnType === 'OPD_Return') {
      invoiceNo = ''
    }

    if (inferredTxnType === 'Salary') {
      invoiceNo = ''
    }

    let dept = inferDepartmentFromJournal(jForInfer, acct?.department) || inferDepartment(jForInfer, acct?.department)
    if (inferredTxnType === 'Diagnostics_Rev' || inferredTxnType === 'Diag_Credit_Rev') dept = 'Diagnostics'
    if (inferredTxnType === 'OPD_Rev' || inferredTxnType === 'OPD_Credit_Rev') dept = 'OPD'
    if (inferredTxnType === 'Therapy_Rev' || inferredTxnType === 'Therp_Credit_Rev') dept = 'Therapy'
    if (inferredTxnType === 'Counselling_Rev' || inferredTxnType === 'Couns_Credit_Rev') dept = 'Counselling'
    if (inferredTxnType === 'OPD_Return') dept = 'OPD'
    if (inferredTxnType === 'Pharmacy_Rev' || inferredTxnType === 'Pharmacy_Return' || inferredTxnType === 'Pharm_Credit_Rev') dept = 'Pharmacy'
    if (inferredTxnType === 'Doc_Payout' || inferredTxnType === 'Expense' || String(inferredTxnType).startsWith('Expense-')) dept = 'OPD'
    if (inferredTxnType === 'Salary') {
      const salaryDept = inferDepartmentNameForSalary(line)
      if (salaryDept) {
        dept = salaryDept
      } else {
        const raw = String(dept || '').trim()
        if (raw.includes('-')) dept = String(raw.split('-')[0] || '').trim()
      }
    }
    if (department !== 'All' && dept !== department) continue

    const row: Row = {
      pettyCashOwner: acct ? String(acct.name || code) : code,
      date,
      time,
      customerSupplier: (inferredTxnType === 'Transfer' || inferredTxnType === 'Doc_Payout') ? '-' : (cust || '-'),
      customerSupplierNo: custNo || custNoFromSnap || '-',
      invoiceNo: (inferredTxnType === 'Transfer' || inferredTxnType === 'Doc_Payout' || !invoiceNo) ? '-' : invoiceNo,
      department: dept || '-',
      transactionType: inferredTxnType,
      transBy: (inferredTxnType === 'Doc_Payout' ? (transBy || (r?.createdBy ? String(r.createdBy) : '')) : transBy) || '-',
      transactionNo: String(r?.txId || `TXN-${String(r?._id || '')}`),
      credit: debit > 0 ? debit : 0,
      debit: credit > 0 ? credit : 0,
      balance: 0,
    }

    if (!byPetty[code]) byPetty[code] = []
    byPetty[code].push(row)
  }

  const items: Row[] = []
  const codes = Object.keys(byPetty).sort()
  for (const code of codes) {
    const rows = byPetty[code]
    let running = Number(openingByCode.get(code) || 0)
    for (const row of rows) {
      running = running + Number(row.credit || 0) - Number(row.debit || 0)
      row.balance = running
      items.push(row)
    }
  }

  // Keep stable sort (date then time then transaction id) for easier UI + CSV
  items.sort((a, b) => {
    const da = String(a.date || '')
    const db = String(b.date || '')
    if (da !== db) return da.localeCompare(db)
    const ta = String(a.time || '')
    const tb = String(b.time || '')
    if (ta !== tb) return ta.localeCompare(tb)
    return String(a.transactionNo || '').localeCompare(String(b.transactionNo || ''))
  })

  return res.json({ reportType, from, to, department, items })
}
