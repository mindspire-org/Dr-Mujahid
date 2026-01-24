import { Request, Response } from 'express'
import { FinanceJournal } from '../models/FinanceJournal'
import { BankAccount } from '../models/BankAccount'

export async function listOpeningBalances(req: Request, res: Response){
  const code = String((req.query as any)?.code || '').trim().toUpperCase()
  const match: any = { refType: 'OPENING_BALANCE' }
  if (code) match['lines.account'] = code
  const rows = await FinanceJournal.aggregate([
    { $unwind: '$lines' },
    { $match: match },
    { $group: { _id: '$_id', dateIso: { $first: '$dateIso' }, memo: { $first: '$memo' }, account: { $first: '$lines.account' }, amount: { $sum: { $ifNull: ['$lines.debit', 0] } } } },
    { $sort: { dateIso: 1, _id: 1 } },
  ])
  res.json({ entries: rows.map(r => ({ id: String(r._id), dateIso: r.dateIso, account: r.account, amount: r.amount, memo: r.memo })) })
}

export async function listPettyRefills(req: Request, res: Response){
  const petty = String((req.query as any)?.code || '').trim().toUpperCase()
  const match: any = { refType: 'PETTY_CASH_REFILL' }
  if (petty) match['lines.account'] = petty
  const rows = await FinanceJournal.aggregate([
    { $unwind: '$lines' },
    { $match: match },
    // Only keep the debit line for petty cash as the refill amount
    { $match: { 'lines.debit': { $gt: 0 } } },
    { $project: { _id: 1, dateIso: 1, memo: 1, amount: '$lines.debit', pettyCode: '$lines.account', refId: '$refId' } },
    { $sort: { dateIso: 1, _id: 1 } },
  ])
  // Attach bank title if possible via refId (format pettyCode:bankId)
  const entries = [] as any[]
  for (const r of rows){
    let bankTitle: string|undefined
    let bankId: string|undefined
    if (r?.refId && String(r.refId).includes(':')){
      const bankId = String(r.refId).split(':')[1]
      try {
        const b: any = await BankAccount.findById(bankId).lean()
        if (b) bankTitle = `${b.bankName || ''} - ${b.accountTitle || ''}`.trim()
      } catch {}
    }
    // echo bankId as separate field when available
    if (r?.refId && String(r.refId).includes(':')){
      bankId = String(r.refId).split(':')[1]
    }
    entries.push({ id: String(r._id), dateIso: r.dateIso, memo: r.memo, amount: r.amount, pettyCode: r.pettyCode, bankTitle, bankId })
  }
  res.json({ entries })
}
