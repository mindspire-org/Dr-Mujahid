import { Request, Response } from 'express'
import { z } from 'zod'
import { BankAccount } from '../models/BankAccount'

const createSchema = z.object({
  bankName: z.string().min(1),
  accountTitle: z.string().min(1),
  accountNumber: z.string().min(1),
  branchName: z.string().optional(),
  branchCode: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  status: z.enum(['Active','Inactive']).optional(),
})

const updateSchema = z.object({
  bankName: z.string().min(1).optional(),
  accountTitle: z.string().min(1).optional(),
  branchName: z.string().optional(),
  branchCode: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  status: z.enum(['Active','Inactive']).optional(),
})

export async function list(req: Request, res: Response){
  const q = String((req.query as any)?.q || '').trim().toLowerCase()
  const status = String((req.query as any)?.status || '').trim()
  const filter: any = {}
  if (status === 'Active' || status === 'Inactive') filter.status = status
  const rows: any[] = await BankAccount.find(filter).sort({ bankName: 1, accountTitle: 1 }).lean()
  const items = rows.filter(r => !q || `${r.bankName||''} ${r.accountTitle||''} ${r.accountNumber||''}`.toLowerCase().includes(q))
    .map(r => ({
      id: String(r._id),
      bankName: r.bankName,
      accountTitle: r.accountTitle,
      accountNumber: r.accountNumber,
      branchName: r.branchName,
      branchCode: r.branchCode,
      iban: r.iban,
      swift: r.swift,
      status: r.status || 'Active',
    }))
  res.json({ accounts: items })
}

export async function update(req: Request, res: Response){
  const id = String(req.params.id)
  const data = updateSchema.parse(req.body)
  const patch: any = {}
  if (data.bankName != null) patch.bankName = data.bankName.trim()
  if (data.accountTitle != null) patch.accountTitle = data.accountTitle.trim()
  if (data.branchName != null) patch.branchName = data.branchName?.trim()
  if (data.branchCode != null) patch.branchCode = data.branchCode?.trim()
  if (data.iban != null) patch.iban = data.iban?.trim()
  if (data.swift != null) patch.swift = data.swift?.trim()
  if (data.status != null) patch.status = data.status
  const doc: any = await BankAccount.findByIdAndUpdate(id, patch, { new: true }).lean()
  if (!doc) return res.status(404).json({ error: 'Bank account not found' })
  res.json({ account: {
    id: String(doc._id),
    bankName: doc.bankName,
    accountTitle: doc.accountTitle,
    accountNumber: doc.accountNumber,
    branchName: doc.branchName,
    branchCode: doc.branchCode,
    iban: doc.iban,
    swift: doc.swift,
    status: doc.status || 'Active',
  } })
}

export async function remove(req: Request, res: Response){
  const id = String(req.params.id)
  const doc: any = await BankAccount.findByIdAndDelete(id).lean()
  if (!doc) return res.status(404).json({ error: 'Bank account not found' })
  res.json({ ok: true })
}

export async function create(req: Request, res: Response){
  const data = createSchema.parse(req.body)
  const exists = await BankAccount.findOne({ accountNumber: data.accountNumber }).lean()
  if (exists) return res.status(409).json({ error: 'Duplicate account number' })
  const doc: any = await BankAccount.create({
    bankName: data.bankName.trim(),
    accountTitle: data.accountTitle.trim(),
    accountNumber: data.accountNumber.trim(),
    branchName: data.branchName?.trim(),
    branchCode: data.branchCode?.trim(),
    iban: data.iban?.trim(),
    swift: data.swift?.trim(),
    status: data.status || 'Active',
  })
  res.status(201).json({ account: {
    id: String(doc._id),
    bankName: doc.bankName,
    accountTitle: doc.accountTitle,
    accountNumber: doc.accountNumber,
    branchName: doc.branchName,
    branchCode: doc.branchCode,
    iban: doc.iban,
    swift: doc.swift,
    status: doc.status || 'Active',
    financeAccountCode: doc.financeAccountCode,
  } })
}
