import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { BankAccount } from '../models/BankAccount'
import { PettyCashAccount } from '../models/PettyCashAccount'

const schema = z.object({
  dateIso: z.string().min(1),
  account: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().optional(),
})

export async function postOpeningBalance(req: Request, res: Response){
  const { dateIso, account, amount, memo } = schema.parse(req.body)

  const payload: any = (req as any).user
  const createdBy = payload?.sub ? String(payload.sub) : undefined

  const code = String(account||'').trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'Account not found' })

  const petty = await PettyCashAccount.findOne({ code }).lean()
  let bankMatch: any = null
  if (!petty){
    const bankRows: any[] = await BankAccount.find({}).select({ financeAccountCode: 1, accountNumber: 1 }).lean()
    const bankCodes = new Set<string>()
    for (const b of bankRows){
      if (b?.financeAccountCode) bankCodes.add(String(b.financeAccountCode).trim().toUpperCase())
      if (b?.accountNumber) bankCodes.add(`BANK_${String(b.accountNumber).slice(-4)}`.toUpperCase())
    }
    bankMatch = bankCodes.has(code)
  }

  if (!petty && !bankMatch) return res.status(404).json({ error: 'Account not found' })

  // Allow multiple opening balance entries for the same account/date. Each entry will be a separate journal.

  // Debit selected account, credit OPENING_EQUITY
  const j = await FinanceJournal.create({
    dateIso,
    createdBy,
    refType: 'OPENING_BALANCE',
    refId: account,
    memo: memo || `Opening balance for ${account}`,
    lines: [
      { account, debit: amount },
      { account: 'OPENING_EQUITY', debit: 0, credit: amount },
    ],
  })

  res.status(201).json({ id: String(j._id) })
}
