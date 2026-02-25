import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { notifyAdminTransaction } from '../services/finance_txn_notifications'

function todayIso() { return new Date().toISOString().slice(0, 10) }

async function computeAccountBalance(accountCode: string) {
  const res = await FinanceJournal.aggregate([
    { $unwind: '$lines' },
    { $match: { 'lines.account': accountCode } },
    { $group: { _id: null, debit: { $sum: { $ifNull: ['$lines.debit', 0] } }, credit: { $sum: { $ifNull: ['$lines.credit', 0] } } } },
    { $project: { _id: 0, balance: { $subtract: ['$debit', '$credit'] } } },
  ])
  return Number(res?.[0]?.balance || 0)
}

const transferSchema = z.object({
  fromAccountCode: z.string().min(1).transform(s => s.trim().toUpperCase()),
  toAccountCode: z.string().min(1).transform(s => s.trim().toUpperCase()),
  amount: z.number().positive(),
  dateIso: z.string().optional(),
  memo: z.string().optional(),
})

export async function transferAccount(req: Request, res: Response) {
  const { fromAccountCode, toAccountCode, amount, dateIso, memo } = transferSchema.parse({
    ...req.body,
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
  })

  const payload: any = (req as any).user
  const createdBy = payload?.sub ? String(payload.sub) : undefined
  const actorRole = String(payload?.role || '')

  if (fromAccountCode === toAccountCode) return res.status(400).json({ error: 'Sender and receiver cannot be same' })

  // Allow negative balance as requested
  // const fromBalance = await computeAccountBalance(fromAccountCode)
  // if (fromBalance < amount) return res.status(400).json({ error: 'Insufficient sender balance' })

  const j = await FinanceJournal.create({
    dateIso: dateIso || todayIso(),
    createdBy,
    refType: 'FINANCE_ACCOUNT_TRANSFER',
    refId: `${fromAccountCode}=>${toAccountCode}`,
    memo: memo || `Transfer ${fromAccountCode} to ${toAccountCode}`,
    lines: [
      { account: toAccountCode, debit: amount },
      { account: fromAccountCode, credit: amount },
    ],
  })

  const toBalance = await computeAccountBalance(toAccountCode)
  const fromBalanceAfter = await computeAccountBalance(fromAccountCode)

  try {
    if (createdBy) {
      await notifyAdminTransaction({
        actorUserId: createdBy,
        actorRole,
        fromAccountCode,
        toAccountCode,
        amount,
        refType: 'FINANCE_ACCOUNT_TRANSFER',
        txId: String((j as any)?.txId || ''),
        memo: memo || undefined,
      })
    }
  } catch { }

  return res.status(201).json({ ok: true, journalId: String(j._id), toBalance, fromBalance: fromBalanceAfter })
}
