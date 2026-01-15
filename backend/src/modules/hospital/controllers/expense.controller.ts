import { Request, Response } from 'express'
import { HospitalExpense } from '../models/Expense'
import { createExpenseSchema, listExpenseSchema } from '../validators/expense'

export async function list(req: Request, res: Response){
  const q = listExpenseSchema.safeParse(req.query)
  const today = new Date().toISOString().slice(0,10)
  const from = q.success && q.data.from ? q.data.from : today
  const to = q.success && q.data.to ? q.data.to : today
  const rows = await HospitalExpense.find({ dateIso: { $gte: from, $lte: to } }).sort({ dateIso: -1, createdAt: -1 }).lean()
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0)
  res.json({ expenses: rows, total })
}

export async function create(req: Request, res: Response){
  const data = createExpenseSchema.parse(req.body)
  const row = await HospitalExpense.create(data)
  res.status(201).json({ expense: row })
}

export async function remove(req: Request, res: Response){
  const id = req.params.id
  const row = await HospitalExpense.findByIdAndDelete(id)
  if (!row) return res.status(404).json({ error: 'Expense not found' })
  res.json({ ok: true })
}
