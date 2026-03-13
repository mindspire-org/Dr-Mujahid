import { Request, Response } from 'express'
import { HospitalExpense } from '../models/Expense'
import { createExpenseSchema, listExpenseSchema } from '../validators/expense'
import { FinanceJournal } from '../models/FinanceJournal'
import { HospitalStaff } from '../models/Staff'
import { HospitalDepartment } from '../models/Department'
import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'

export async function getById(req: Request, res: Response){
  const id = String(req.params.id)
  const row = await HospitalExpense.findById(id).lean()
  if (!row) return res.status(404).json({ error: 'Expense not found' })
  res.json({ expense: row })
}

export async function list(req: Request, res: Response){
  const q = listExpenseSchema.safeParse(req.query)
  const today = new Date().toISOString().slice(0,10)
  const from = q.success && q.data.from ? q.data.from : today
  const to = q.success && q.data.to ? q.data.to : today
  const status = q.success ? (q.data.status || 'all') : 'all'
  const kind = q.success ? (q.data as any).kind : undefined
  const staffId = q.success ? (q.data as any).staffId : undefined
  const salaryMonth = q.success ? (q.data as any).salaryMonth : undefined
  const category = q.success ? (q.data as any).category : undefined
  const filter: any = { dateIso: { $gte: from, $lte: to } }
  if (kind) filter.kind = kind
  if (staffId) filter.staffId = staffId
  if (salaryMonth) filter.salaryMonth = salaryMonth
  if (category) filter.category = category
  if (status && status !== 'all') {
    if (status === 'approved') {
      filter.$or = [
        { status: 'approved' },
        { status: { $exists: false } },
        { status: null },
        { status: '' },
      ]
    } else {
      filter.status = status
    }
  }
  const rows = await HospitalExpense.find(filter).sort({ dateIso: -1, createdAt: -1 }).lean()
  const total = rows.reduce((s, r: any) => s + (r.amount || 0), 0)
  res.json({ expenses: rows, total })
}

export async function create(req: Request, res: Response){
  const data = createExpenseSchema.parse(req.body)
  const actor = String((req as any).user?.username || (req as any).user?.name || '').trim() || undefined
  let receiverLabel = ''
  try {
    const staffId = String((data as any).staffId || '').trim()
    if (staffId) {
      const st: any = await HospitalStaff.findById(staffId).lean()
      if (st) receiverLabel = `${String(st.name || '').trim()}-${String(st.role || '').trim()}`
    }
  } catch {}

  const row = await HospitalExpense.create({
    ...data,
    receiverLabel: receiverLabel || undefined,
    status: 'draft',
    createdBy: actor,
  })
  res.status(201).json({ expense: row })
}

function isApprover(req: Request){
  const role = String((req as any).user?.role || '')
  return /^admin$/i.test(role) || /^finance$/i.test(role)
}

function resolveCreatedBy(req: Request){
  const direct = (req as any)?.user?.sub
  if (direct) return String(direct)
  try {
    const auth = String(req.headers['authorization'] || '')
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return undefined
    const payload: any = jwt.verify(token, env.JWT_SECRET)
    return payload?.sub ? String(payload.sub) : undefined
  } catch {
    return undefined
  }
}

async function computeAccountBalance(accountCode: string){
  const code = String(accountCode || '').trim().toUpperCase()
  if (!code) return 0
  const rows = await FinanceJournal.aggregate([
    { $unwind: '$lines' },
    { $match: { 'lines.account': code } },
    { $group: { _id: null, debit: { $sum: { $ifNull: ['$lines.debit', 0] } }, credit: { $sum: { $ifNull: ['$lines.credit', 0] } } } },
    { $project: { _id: 0, balance: { $subtract: ['$debit', '$credit'] } } },
  ])
  return Number(rows?.[0]?.balance || 0)
}

export async function submit(req: Request, res: Response){
  const id = String(req.params.id)
  const actor = String((req as any).user?.username || (req as any).user?.name || '').trim() || 'system'
  const row: any = await HospitalExpense.findById(id)
  if (!row) return res.status(404).json({ error: 'Expense not found' })
  const status = String(row.status || 'approved')
  if (status !== 'draft') return res.status(400).json({ error: `Only draft expenses can be submitted (current: ${status})` })
  row.status = 'submitted'
  row.submittedAt = new Date()
  row.submittedBy = actor
  await row.save()
  res.json({ expense: row })
}

export async function approve(req: Request, res: Response){
  if (!isApprover(req)) return res.status(403).json({ error: 'Forbidden: approver role required' })
  const id = String(req.params.id)
  const actor = String((req as any).user?.username || (req as any).user?.name || '').trim() || 'system'
  const createdBy = resolveCreatedBy(req)
  const row: any = await HospitalExpense.findById(id)
  if (!row) return res.status(404).json({ error: 'Expense not found' })
  const status = String(row.status || 'approved')
  if (status !== 'submitted' && status !== 'draft') return res.status(400).json({ error: `Only draft/submitted expenses can be approved (current: ${status})` })

  // If this expense was created as a payment request with a selected account,
  // post the finance journal only at approval time.
  try {
    const fromAccountCode = String(row.fromAccountCode || '').trim().toUpperCase()
    const alreadyPosted = String(row.journalId || '').trim()
    const amount = Math.abs(Number(row.amount || 0) || 0)
    if (fromAccountCode && !alreadyPosted && amount > 0) {
      let receiverLabel = ''
      let staffName = ''
      try {
        const staffId = String(row.staffId || '').trim()
        if (staffId) {
          const st: any = await HospitalStaff.findById(staffId).lean()
          if (st) {
            staffName = String(st.name || '').trim()
            receiverLabel = `${staffName}-${String(st.role || '').trim()}`
          }
        }
      } catch {}
      receiverLabel = receiverLabel || 'Expense'

      let departmentName = ''
      try {
        const deptId = String(row.departmentId || '').trim()
        if (deptId) {
          const d: any = await HospitalDepartment.findById(deptId).select('name').lean()
          if (d) departmentName = String(d.name || '').trim()
        }
      } catch {}

      const dateIso = String(row.dateIso || new Date().toISOString().slice(0,10)).slice(0,10)
      const memo = String(row.note || row.category || 'Expense')
      const tags: any = {
        receiver: receiverLabel,
        expenseId: String(row._id),
        category: String(row.category || '').trim(),
        supplierName: String((row as any).supplierName || '').trim() || undefined,
        invoiceNo: String((row as any).invoiceNo || '').trim() || undefined,
      }
      if (row.staffId) tags.staffId = String(row.staffId)
      if (staffName) tags.staffName = staffName
      if (departmentName) tags.departmentName = departmentName
      if (row.salaryMonth) tags.salaryMonth = String(row.salaryMonth)
      if (row.kind) tags.kind = String(row.kind)

      const j: any = await FinanceJournal.create({
        dateIso,
        createdBy,
        refType: 'EXPENSE_PAYMENT',
        refId: String(row._id),
        memo,
        lines: [
          { account: 'EXPENSE', debit: amount, tags },
          { account: fromAccountCode, credit: amount, tags },
        ],
      })

      row.journalId = String(j._id)
      row.paidAt = new Date()
      row.receiverLabel = receiverLabel
    }
  } catch {}

  row.status = 'approved'
  row.approvedAt = new Date()
  row.approvedBy = actor
  row.rejectedAt = undefined
  row.rejectedBy = undefined
  row.rejectionReason = undefined
  await row.save()
  res.json({ expense: row })
}

export async function reject(req: Request, res: Response){
  if (!isApprover(req)) return res.status(403).json({ error: 'Forbidden: approver role required' })
  const id = String(req.params.id)
  const actor = String((req as any).user?.username || (req as any).user?.name || '').trim() || 'system'
  const reason = String(req.body?.reason || '').trim()
  if (!reason) return res.status(400).json({ error: 'Rejection reason is required' })
  const row: any = await HospitalExpense.findById(id)
  if (!row) return res.status(404).json({ error: 'Expense not found' })
  const status = String(row.status || 'approved')
  if (status !== 'submitted' && status !== 'draft') return res.status(400).json({ error: `Only draft/submitted expenses can be rejected (current: ${status})` })
  row.status = 'rejected'
  row.rejectedAt = new Date()
  row.rejectedBy = actor
  row.rejectionReason = reason
  await row.save()
  res.json({ expense: row })
}

export async function remove(req: Request, res: Response){
  const id = req.params.id
  const actor = String((req as any).user?.username || (req as any).user?.name || '').trim() || ''
  const row: any = await HospitalExpense.findById(id)
  if (!row) return res.status(404).json({ error: 'Expense not found' })
  const status = String(row.status || 'approved')
  if (status !== 'draft' && status !== 'rejected') return res.status(400).json({ error: `Only draft/rejected expenses can be deleted (current: ${status})` })
  if (!isApprover(req) && actor && String(row.createdBy || '') !== actor) return res.status(403).json({ error: 'Forbidden' })
  await HospitalExpense.findByIdAndDelete(id)
  res.json({ ok: true })
}
