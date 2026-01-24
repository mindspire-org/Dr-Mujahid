import { Request, Response } from 'express'
import { FinanceJournal } from '../models/FinanceJournal'

export async function getAccountBalance(req: Request, res: Response){
  const code = String((req.query as any)?.code || '').trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'code is required' })
  const rows = await FinanceJournal.aggregate([
    { $unwind: '$lines' },
    { $match: { 'lines.account': code } },
    { $group: { _id: null, debit: { $sum: { $ifNull: ['$lines.debit', 0] } }, credit: { $sum: { $ifNull: ['$lines.credit', 0] } } } },
    { $project: { _id: 0, balance: { $subtract: ['$debit', '$credit'] } } },
  ])
  const balance = Number(rows?.[0]?.balance || 0)
  return res.json({ code, balance })
}
