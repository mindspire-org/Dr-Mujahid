import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'

const querySchema = z.object({
  mrn: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
})

export async function patientStatement(req: Request, res: Response){
  const q = querySchema.parse(req.query)
  const mrn = String(q.mrn).trim()
  const from = String(q.from || '1900-01-01')
  const to = String(q.to || '2100-01-01')

  const rows: any[] = await FinanceJournal.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to } } },
    { $addFields: { _idStr: { $toString: '$_id' } } },
    { $unwind: '$lines' },
    { $match: { 'lines.tags.mrn': mrn } },
    { $group: {
      _id: '$_idStr',
      dateIso: { $first: '$dateIso' },
      refType: { $first: '$refType' },
      refId: { $first: '$refId' },
      memo: { $first: '$memo' },
      // charges: revenue credits and AR debits are treated as charges
      charge: { $sum: { $add: [
        { $cond: [ { $in: ['$lines.account', ['OPD_REVENUE','IPD_REVENUE','PROCEDURE_REVENUE','PHARMACY_REVENUE','LAB_REVENUE','DIAGNOSTIC_REVENUE']] }, { $ifNull: ['$lines.credit', 0] }, 0 ] },
        { $cond: [ { $eq: ['$lines.account', 'AR'] }, { $ifNull: ['$lines.debit', 0] }, 0 ] },
      ] } },
      // payments: cash/bank debits reduce balance
      payment: { $sum: { $add: [
        { $cond: [ { $in: ['$lines.account', ['CASH','BANK','PETTY_CASH']] }, { $ifNull: ['$lines.debit', 0] }, 0 ] },
        { $cond: [ { $eq: ['$lines.account', 'AR'] }, { $ifNull: ['$lines.credit', 0] }, 0 ] },
      ] } },
    }},
    { $sort: { dateIso: 1, _id: 1 } },
  ])

  let balance = 0
  const entries = rows.map(r => {
    const charge = Number(r.charge || 0)
    const payment = Number(r.payment || 0)
    balance = balance + charge - payment
    return {
      id: String(r._id),
      dateIso: r.dateIso,
      refType: r.refType,
      refId: r.refId,
      memo: r.memo,
      charge,
      payment,
      balance,
    }
  })

  res.json({ mrn, from, to, entries, closingBalance: balance })
}
