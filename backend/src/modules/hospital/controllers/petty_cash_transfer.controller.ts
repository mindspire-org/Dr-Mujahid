import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { PettyCashAccount } from '../models/PettyCashAccount'
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
  toPettyCode: z.string().min(1).transform(s => s.trim().toUpperCase()),
  fromAccountCode: z.string().min(1).transform(s => s.trim().toUpperCase()),
  amount: z.number().positive(),
  dateIso: z.string().optional(),
  memo: z.string().optional(),
})

export async function transferPettyCash(req: Request, res: Response) {
  const { toPettyCode, fromAccountCode, amount, dateIso, memo } = transferSchema.parse({
    ...req.body,
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
  })

  const payload: any = (req as any).user
  const createdBy = payload?.sub ? String(payload.sub) : undefined
  const actorRole = String(payload?.role || '')

  if (toPettyCode === fromAccountCode) return res.status(400).json({ error: 'Sender and receiver cannot be same' })

  const toPetty: any = await PettyCashAccount.findOne({ code: toPettyCode }).lean()
  if (!toPetty) return res.status(404).json({ error: 'Receiver petty cash account not found' })
  if (toPetty.status !== 'Active') return res.status(400).json({ error: 'Receiver petty cash account is not active' })

  const fromPetty: any = await PettyCashAccount.findOne({ code: fromAccountCode }).lean()
  if (!fromPetty) return res.status(404).json({ error: 'Sender petty cash account not found' })
  if (fromPetty.status !== 'Active') return res.status(400).json({ error: 'Sender petty cash account is not active' })

  // Allow negative balance as requested
  // const fromBalance = await computeAccountBalance(fromAccountCode)
  // if (fromBalance < amount) return res.status(400).json({ error: 'Insufficient sender balance' })

  const j = await FinanceJournal.create({
    dateIso: dateIso || todayIso(),
    createdBy,
    refType: 'PETTY_CASH_TRANSFER',
    refId: `${fromAccountCode}=>${toPettyCode}`,
    memo: memo || `Petty cash transfer ${fromAccountCode} to ${toPettyCode}`,
    lines: [
      { account: toPettyCode, debit: amount },
      { account: fromAccountCode, credit: amount },
    ],
  })

  const toBalance = await computeAccountBalance(toPettyCode)
  const fromBalanceAfter = await computeAccountBalance(fromAccountCode)

  try {
    if (createdBy) {
      await notifyAdminTransaction({
        actorUserId: createdBy,
        actorRole,
        fromAccountCode,
        toAccountCode: toPettyCode,
        amount,
        refType: 'PETTY_CASH_TRANSFER',
        txId: String((j as any)?.txId || ''),
        memo: memo || undefined,
      })
    }
  } catch { }

  return res.status(201).json({ ok: true, journalId: String(j._id), toBalance, fromBalance: fromBalanceAfter })
}
