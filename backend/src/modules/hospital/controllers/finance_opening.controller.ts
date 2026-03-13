import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'

const schema = z.object({
  dateIso: z.string().min(1),
  account: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().optional(),
})

export async function postOpeningBalance(req: Request, res: Response){
  const data = schema.parse(req.body)
  const dateIso = String(data.dateIso).slice(0,10)
  const account = String(data.account).trim().toUpperCase()
  const amount = Number(data.amount || 0)

  // prevent duplicates for same account+date
  const existing = await FinanceJournal.findOne({ refType: 'opening_balance', refId: `${account}:${dateIso}` }).lean()
  if (existing) return res.status(409).json({ error: 'Opening balance already posted for this account/date' })

  const j = await FinanceJournal.create({
    dateIso,
    refType: 'opening_balance',
    refId: `${account}:${dateIso}`,
    memo: data.memo || `Opening balance for ${account}`,
    lines: [
      { account, debit: amount, credit: 0, tags: { account, opening: true } },
      { account: 'OPENING_EQUITY', debit: 0, credit: amount, tags: { account, opening: true } },
    ]
  })

  res.status(201).json({ journal: j })
}
