import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { PettyCashAccount } from '../models/PettyCashAccount'
import { BankAccount } from '../models/BankAccount'
import { notifyAdminTransaction } from '../services/finance_txn_notifications'

function todayIso(){ return new Date().toISOString().slice(0,10) }

async function computeAccountBalance(accountCode: string){
  const res = await FinanceJournal.aggregate([
    { $unwind: '$lines' },
    { $match: { 'lines.account': accountCode } },
    { $group: { _id: null, debit: { $sum: { $ifNull: ['$lines.debit', 0] } }, credit: { $sum: { $ifNull: ['$lines.credit', 0] } } } },
    { $project: { _id: 0, balance: { $subtract: ['$debit', '$credit'] } } },
  ])
  return Number(res?.[0]?.balance || 0)
}

export async function pettyCashStatus(req: Request, res: Response){
  const code = String((req.query as any)?.code || '').trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'code is required' })
  const acct: any = await PettyCashAccount.findOne({ code }).lean()
  if (!acct) return res.status(404).json({ error: 'Petty cash account not found' })
  const balance = await computeAccountBalance(code)
  return res.json({ account: { code: acct.code, name: acct.name, department: acct.department, responsibleStaff: acct.responsibleStaff, status: acct.status }, balance })
}

const refillSchema = z.object({
  pettyCode: z.string().min(1).transform(s=> s.trim().toUpperCase()),
  bankId: z.string().min(1),
  amount: z.number().positive(),
  dateIso: z.string().optional(),
  memo: z.string().optional(),
})

export async function refillPettyCash(req: Request, res: Response){
  const { pettyCode, bankId, amount, dateIso, memo } = refillSchema.parse({
    ...req.body,
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
  })

  const payload: any = (req as any).user
  const createdBy = payload?.sub ? String(payload.sub) : undefined
  const actorRole = String(payload?.role || '')
  const petty: any = await PettyCashAccount.findOne({ code: pettyCode }).lean()
  if (!petty) return res.status(404).json({ error: 'Petty cash account not found' })
  if (petty.status !== 'Active') return res.status(400).json({ error: 'Petty cash account is not active' })

  const bank: any = await BankAccount.findById(bankId).lean()
  if (!bank) return res.status(404).json({ error: 'Bank account not found' })
  const bankFinCode = String(bank.financeAccountCode || `BANK_${String(bank.accountNumber||'').slice(-4)}`.toUpperCase())

  // Allow negative balance as requested
  // const bankBalance = await computeAccountBalance(bankFinCode)
  // if (bankBalance < amount) return res.status(400).json({ error: 'Insufficient bank balance' })

  const j = await FinanceJournal.create({
    dateIso: dateIso || todayIso(),
    createdBy,
    refType: 'PETTY_CASH_REFILL',
    refId: `${pettyCode}:${bank._id}`,
    memo: memo || `Petty cash refill from bank ${bank.accountTitle || bank.bankName}`,
    lines: [
      { account: pettyCode, debit: amount },
      { account: bankFinCode, credit: amount },
    ],
  })

  const pettyBalance = await computeAccountBalance(pettyCode)
  const bankBalanceAfter = await computeAccountBalance(bankFinCode)

  try {
    if (createdBy) {
      await notifyAdminTransaction({
        actorUserId: createdBy,
        actorRole,
        fromAccountCode: bankFinCode,
        toAccountCode: pettyCode,
        amount,
        refType: 'PETTY_CASH_REFILL',
        txId: String((j as any)?.txId || ''),
        memo: memo || undefined,
      })
    }
  } catch { }

  return res.status(201).json({ ok: true, journalId: String(j._id), pettyBalance, bankBalance: bankBalanceAfter })
}
