import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { PettyCashAccount } from '../models/PettyCashAccount'
import { BankAccount } from '../models/BankAccount'
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

export async function myPettyCash(req: Request, res: Response) {
  const payload: any = (req as any).user
  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const username = String(u.username || '').trim().toLowerCase()
  if (!username) return res.json({ account: null, balance: 0 })

  const acct: any = await PettyCashAccount.findOne({ responsibleStaff: username, status: 'Active' }).lean()
  if (!acct) return res.json({ account: null, balance: 0 })

  const code = String(acct.code || '').trim().toUpperCase()
  if (!code) return res.json({ account: null, balance: 0 })

  const balance = await computeAccountBalance(code)
  return res.json({ account: { id: String(acct._id), code: acct.code, name: acct.name, status: acct.status }, balance })
}

const pullFundsSchema = z.object({
  fromAccountCode: z.string().min(1).transform(s => s.trim().toUpperCase()),
  amount: z.number().positive(),
  dateIso: z.string().optional(),
  memo: z.string().optional(),
})

export async function pullFundsToMyPetty(req: Request, res: Response) {
  const payload: any = (req as any).user
  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const createdBy = userId

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const username = String(u.username || '').trim().toLowerCase()
  if (!username) return res.status(400).json({ error: 'No petty cash account assigned' })

  const toPetty: any = await PettyCashAccount.findOne({ responsibleStaff: username, status: 'Active' }).lean()
  if (!toPetty) return res.status(400).json({ error: 'No petty cash account assigned' })

  const toCode = String(toPetty.code || '').trim().toUpperCase()
  if (!toCode) return res.status(400).json({ error: 'Receiver petty cash account not configured' })

  const { fromAccountCode, amount, dateIso, memo } = pullFundsSchema.parse({
    ...req.body,
    amount: req.body?.amount != null ? Number(req.body.amount) : undefined,
  })

  if (fromAccountCode === toCode) return res.status(400).json({ error: 'Sender and receiver cannot be the same' })

  // Validate sender exists as either petty cash or bank finance account code.
  console.log(`[DEBUG] pullFundsToMyPetty: fromAccountCode=${fromAccountCode}, amount=${amount}`)

  const fromPetty: any = await PettyCashAccount.findOne({ code: fromAccountCode }).lean()
  let bankMatchDoc: any = null

  if (!fromPetty) {
    // Try to find by financeAccountCode directly
    bankMatchDoc = await BankAccount.findOne({ financeAccountCode: fromAccountCode }).lean()

    // If not found, it might be a generated code BANK_LAST4_IDSUFFIX or BANK_LAST4
    if (!bankMatchDoc) {
      const allBanks: any[] = await BankAccount.find({}).lean()
      for (const b of allBanks) {
        const an = String(b.accountNumber || '')
        const last4 = an.slice(-4)
        const idSuffix = String(b._id || '').slice(-4).toUpperCase()
        const gen1 = `BANK_${last4}_${idSuffix}`.toUpperCase()
        const gen2 = `BANK_${last4}`.toUpperCase()

        if (fromAccountCode === gen1 || fromAccountCode === gen2) {
          bankMatchDoc = b
          break
        }
      }
    }
  }

  if (!fromPetty && !bankMatchDoc) {
    console.log(`[ERROR] Sender account not found for code: ${fromAccountCode}`)
    return res.status(404).json({ error: 'Sender account not found' })
  }
  if (fromPetty && fromPetty.status !== 'Active') return res.status(400).json({ error: 'Sender petty cash account is not active' })

  // Allow negative balance as requested by the user
  // const fromBalance = await computeAccountBalance(fromAccountCode)
  // if (fromBalance < amount) return res.status(400).json({ error: 'Insufficient sender balance' })

  const j = await FinanceJournal.create({
    dateIso: dateIso || todayIso(),
    createdBy,
    refType: 'PETTY_CASH_PULL',
    refId: `${fromAccountCode}=>${toCode}`,
    memo: memo || `Petty cash transfer to ${toCode}`,
    lines: [
      { account: toCode, debit: amount },
      { account: fromAccountCode, credit: amount },
    ],
  })

  const toBalance = await computeAccountBalance(toCode)
  const fromBalanceAfter = await computeAccountBalance(fromAccountCode)

  return res.status(201).json({ ok: true, journalId: String(j._id), toBalance, fromBalance: fromBalanceAfter })
}

export async function listMyPettyPulls(req: Request, res: Response) {
  const payload: any = (req as any).user
  const userId = String(payload?.sub || '')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const u: any = await HospitalUser.findById(userId).lean()
  if (!u || u.active === false) return res.status(401).json({ error: 'Unauthorized' })

  const username = String(u.username || '').trim().toLowerCase()
  if (!username) return res.json({ entries: [] })

  const petty: any = await PettyCashAccount.findOne({ responsibleStaff: username, status: 'Active' }).lean()
  if (!petty) return res.json({ entries: [] })

  const code = String(petty.code || '').trim().toUpperCase()
  if (!code) return res.json({ entries: [] })

  const rows: any[] = await FinanceJournal.aggregate([
    { $match: { refType: 'PETTY_CASH_PULL', $or: [{ 'lines.account': code }] } },
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
