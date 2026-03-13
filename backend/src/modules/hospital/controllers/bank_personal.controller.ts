import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { BankAccount } from '../models/BankAccount'
import { PettyCashAccount } from '../models/PettyCashAccount'
import { HospitalUser } from '../models/User'

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

function resolveFinanceAccountCode(b: any) {
  const existing = String(b?.financeAccountCode || '').trim().toUpperCase()
  if (existing) return existing
  const an = String(b?.accountNumber || '')
  const last4 = an ? an.slice(-4) : ''
  const idSuffix = String(b?._id || '').slice(-4).toUpperCase()
  return last4 ? `BANK_${last4}_${idSuffix}`.toUpperCase() : ''
}

export async function myBankAccount(req: Request, res: Response) {
  const payload: any = (req as any).user
  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const username = String(u.username || '').trim().toLowerCase()
  if (!username) return res.json({ account: null, balance: 0 })

  const acct: any = await BankAccount.findOne({ responsibleStaff: username, status: 'Active' }).lean()
  if (!acct) return res.json({ account: null, balance: 0 })

  const code = resolveFinanceAccountCode(acct)
  if (!code) return res.json({ account: null, balance: 0 })

  const balance = await computeAccountBalance(code)
  return res.json({
    account: {
      id: String(acct._id),
      bankName: acct.bankName,
      accountTitle: acct.accountTitle,
      accountNumber: acct.accountNumber,
      status: acct.status || 'Active',
      financeAccountCode: code,
    },
    balance,
  })
}

const pullFundsSchema = z.object({
  fromAccountCode: z.string().min(1).transform(s => s.trim().toUpperCase()),
  amount: z.number().positive(),
  dateIso: z.string().optional(),
  memo: z.string().optional(),
})

export async function pullFundsToMyBank(req: Request, res: Response) {
  const payload: any = (req as any).user
  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const createdBy = userId

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const username = String(u.username || '').trim().toLowerCase()
  if (!username) return res.status(400).json({ error: 'No bank account assigned' })

  const bank: any = await BankAccount.findOne({ responsibleStaff: username, status: 'Active' }).lean()
  if (!bank) return res.status(400).json({ error: 'No bank account assigned' })

  const toCode = resolveFinanceAccountCode(bank)
  if (!toCode) return res.status(400).json({ error: 'Receiver bank account not configured' })

  const { fromAccountCode, amount, dateIso, memo } = pullFundsSchema.parse({
    ...req.body,
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
  })

  if (fromAccountCode === toCode) return res.status(400).json({ error: 'Sender and receiver cannot be the same' })

  const fromPetty: any = await PettyCashAccount.findOne({ code: fromAccountCode }).lean()
  let fromBank: any = null
  if (!fromPetty) {
    fromBank = await BankAccount.findOne({ financeAccountCode: fromAccountCode }).lean()
    if (!fromBank) {
      const allBanks: any[] = await BankAccount.find({}).lean()
      for (const b of allBanks) {
        const an = String(b.accountNumber || '')
        const last4 = an.slice(-4)
        const idSuffix = String(b._id || '').slice(-4).toUpperCase()
        const gen1 = `BANK_${last4}_${idSuffix}`.toUpperCase()
        const gen2 = `BANK_${last4}`.toUpperCase()
        if (fromAccountCode === gen1 || fromAccountCode === gen2) {
          fromBank = b
          break
        }
      }
    }
  }

  if (!fromPetty && !fromBank) return res.status(404).json({ error: 'Sender account not found' })
  if (fromPetty && fromPetty.status !== 'Active') return res.status(400).json({ error: 'Sender petty cash account is not active' })
  if (fromBank && String(fromBank.status || 'Active') !== 'Active') return res.status(400).json({ error: 'Sender bank account is not active' })

  const j = await FinanceJournal.create({
    dateIso: dateIso || todayIso(),
    createdBy,
    refType: 'BANK_PULL',
    refId: `${fromAccountCode}=>${toCode}`,
    memo: memo || `Bank transfer to ${toCode}`,
    lines: [
      { account: toCode, debit: amount },
      { account: fromAccountCode, credit: amount },
    ],
  })

  const toBalance = await computeAccountBalance(toCode)
  const fromBalanceAfter = await computeAccountBalance(fromAccountCode)

  return res.status(201).json({ ok: true, journalId: String(j._id), toBalance, fromBalance: fromBalanceAfter })
}

export async function listMyBankPulls(req: Request, res: Response) {
  const payload: any = (req as any).user
  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const username = String(u.username || '').trim().toLowerCase()
  if (!username) return res.json({ entries: [] })

  const bank: any = await BankAccount.findOne({ responsibleStaff: username, status: 'Active' }).lean()
  if (!bank) return res.json({ entries: [] })

  const code = resolveFinanceAccountCode(bank)
  if (!code) return res.json({ entries: [] })

  const rows: any[] = await FinanceJournal.aggregate([
    { $match: { refType: 'BANK_PULL', $or: [{ 'lines.account': code }] } },
    { $addFields: { txId: { $ifNull: ['$txId', { $concat: ['TXN-', { $toString: '$_id' }] }] } } },
    { $unwind: '$lines' },
    { $match: { 'lines.account': code } },
    { $project: { _id: 1, txId: 1, dateIso: 1, createdAt: 1, memo: 1, debit: { $ifNull: ['$lines.debit', 0] }, credit: { $ifNull: ['$lines.credit', 0] }, refId: 1 } },
    { $sort: { dateIso: -1, _id: -1 } },
  ])

  const entries = rows.map(r => ({
    id: String(r._id),
    txId: String(r.txId || `TXN-${String(r._id)}`),
    dateIso: r.dateIso,
    createdAt: r.createdAt,
    memo: r.memo,
    debit: Number(r.debit || 0),
    credit: Number(r.credit || 0),
    refId: r.refId,
  }))

  res.json({ entries })
}
