import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceAccount } from '../models/FinanceAccount'

const createSchema = z.object({
  code: z.string().min(1).transform(s => s.trim().toUpperCase()),
  name: z.string().min(1).transform(s => s.trim()),
  type: z.enum(['Asset','Liability','Equity','Income','Expense']),
  category: z.enum(['PettyCash','Other']).default('Other'),
  active: z.boolean().optional(),
  department: z.string().optional(),
  responsibleStaff: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['Asset','Liability','Equity','Income','Expense']).optional(),
  category: z.enum(['PettyCash','Other']).optional(),
  active: z.boolean().optional(),
  department: z.string().optional(),
  responsibleStaff: z.string().optional(),
})

export async function listAccounts(req: Request, res: Response){
  const q = String((req.query as any)?.q || '').trim().toLowerCase()
  const category = String((req.query as any)?.category || '').trim()
  const activeParam = String((req.query as any)?.active || '').trim().toLowerCase()
  const context = String((req.query as any)?.context || '').trim().toLowerCase()
  const filter: any = {}
  if (category) filter.category = category
  if (activeParam === 'true' || activeParam === '1') filter.active = { $ne: false }
  const rows: any[] = await FinanceAccount.find(filter).sort({ code: 1 }).lean()

  // If called for Opening Balances, restrict to PettyCash and FinanceAccounts that are linked to existing BankAccounts
  let allowedCodes: Set<string> | null = null
  if (context === 'opening-balance'){
    const { BankAccount } = await import('../models/BankAccount')
    const bankRows: any[] = await BankAccount.find({}).select({ financeAccountCode: 1, accountNumber: 1 }).lean()
    const codes = new Set<string>()
    for (const b of bankRows){
      if (b?.financeAccountCode) codes.add(String(b.financeAccountCode))
      else if (b?.accountNumber) codes.add(`BANK_${String(b.accountNumber).slice(-4)}`.toUpperCase())
    }
    allowedCodes = codes
  }
  const items = rows
    .filter(a => !q || `${a.code||''} ${a.name||''}`.toLowerCase().includes(q))
    .filter(a => {
      if (context !== 'opening-balance') return true
      // Allow PettyCash accounts or those whose code is present in bank accounts
      return (a.category === 'PettyCash') || (allowedCodes?.has(String(a.code)) === true)
    })
    .map(a => ({ id: String(a._id), code: a.code, name: a.name, type: a.type, category: a.category || 'Other', active: a.active !== false }))
  res.json({ accounts: items })
}

export async function createAccount(req: Request, res: Response){
  const data = createSchema.parse(req.body)
  const exists = await FinanceAccount.findOne({ code: data.code }).lean()
  if (exists) return res.status(409).json({ error: 'Account code already exists' })
  const doc: any = await FinanceAccount.create({
    code: data.code,
    name: data.name,
    type: data.type,
    category: data.category,
    active: data.active ?? true,
    department: data.department,
    responsibleStaff: data.responsibleStaff,
  })
  res.status(201).json({ account: { id: String(doc._id), code: doc.code, name: doc.name, type: doc.type, category: doc.category || 'Other', active: doc.active !== false } })
}

export async function updateAccount(req: Request, res: Response){
  const id = String(req.params.id)
  const data = updateSchema.parse(req.body)
  const patch: any = {}
  if (data.name != null) patch.name = String(data.name).trim()
  if (data.type != null) patch.type = data.type
  if (data.category != null) patch.category = data.category
  if (data.active != null) patch.active = data.active
  if (data.department != null) patch.department = data.department
  if (data.responsibleStaff != null) patch.responsibleStaff = data.responsibleStaff
  const doc: any = await FinanceAccount.findByIdAndUpdate(id, patch, { new: true }).lean()
  if (!doc) return res.status(404).json({ error: 'Account not found' })
  res.json({ account: { id: String(doc._id), code: doc.code, name: doc.name, type: doc.type, category: doc.category || 'Other', active: doc.active !== false } })
}

export async function removeAccount(req: Request, res: Response){
  const id = String(req.params.id)
  const doc: any = await FinanceAccount.findByIdAndDelete(id).lean()
  if (!doc) return res.status(404).json({ error: 'Account not found' })
  res.json({ ok: true })
}
