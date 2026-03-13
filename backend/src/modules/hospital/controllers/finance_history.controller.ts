import { Request, Response } from 'express'
import { FinanceJournal } from '../models/FinanceJournal'
import { BankAccount } from '../models/BankAccount'
import { HospitalUser } from '../models/User'

export async function listOpeningBalances(req: Request, res: Response){
  const code = String((req.query as any)?.code || '').trim().toUpperCase()
  const match: any = { refType: 'OPENING_BALANCE' }
  if (code) match['lines.account'] = code
  const rows = await FinanceJournal.aggregate([
    { $addFields: { txId: { $ifNull: ['$txId', { $concat: ['TXN-', { $toString: '$_id' }] }] } } },
    { $unwind: '$lines' },
    { $match: match },
    { $group: { _id: '$_id', txId: { $first: '$txId' }, dateIso: { $first: '$dateIso' }, createdAt: { $first: '$createdAt' }, createdBy: { $first: '$createdBy' }, memo: { $first: '$memo' }, account: { $first: '$lines.account' }, amount: { $sum: { $ifNull: ['$lines.debit', 0] } } } },
    { $sort: { dateIso: 1, _id: 1 } },
  ])

  const userIds = Array.from(new Set(rows.map((r: any) => r?.createdBy ? String(r.createdBy) : '').filter(Boolean)))
  const usersById: Record<string, { username: string; fullName?: string; role?: string }> = {}
  if (userIds.length) {
    const users: any[] = await HospitalUser.find({ _id: { $in: userIds } }).select({ username: 1, fullName: 1, role: 1 }).lean()
    for (const u of users) {
      usersById[String(u._id)] = { username: String(u.username || ''), fullName: u.fullName != null ? String(u.fullName) : undefined, role: u.role != null ? String(u.role) : undefined }
    }
  }

  res.json({
    entries: rows.map((r: any) => ({
      id: String(r._id),
      txId: String(r.txId || `TXN-${String(r._id)}`),
      dateIso: r.dateIso,
      createdAt: r.createdAt,
      createdBy: r.createdBy != null ? String(r.createdBy) : undefined,
      user: (() => {
        const id = r?.createdBy != null ? String(r.createdBy) : ''
        if (!id) return undefined
        const u = usersById[id]
        if (!u) return { id }
        return { id, username: u.username, fullName: u.fullName, role: u.role }
      })(),
      account: r.account,
      amount: r.amount,
      memo: r.memo,
    })),
  })
}

export async function listPettyRefills(req: Request, res: Response){
  const petty = String((req.query as any)?.code || '').trim().toUpperCase()
  const match: any = { refType: 'PETTY_CASH_REFILL' }
  if (petty) match['lines.account'] = petty
  const rows = await FinanceJournal.aggregate([
    { $addFields: { txId: { $ifNull: ['$txId', { $concat: ['TXN-', { $toString: '$_id' }] }] } } },
    { $unwind: '$lines' },
    { $match: match },
    // Only keep the debit line for petty cash as the refill amount
    { $match: { 'lines.debit': { $gt: 0 } } },
    { $project: { _id: 1, txId: 1, dateIso: 1, createdAt: 1, createdBy: 1, memo: 1, amount: '$lines.debit', pettyCode: '$lines.account', refId: '$refId' } },
    { $sort: { dateIso: 1, _id: 1 } },
  ])
  // Attach bank title if possible via refId (format pettyCode:bankId)
  const entries = [] as any[]
  const userIds = Array.from(new Set(rows.map((r: any) => r?.createdBy ? String(r.createdBy) : '').filter(Boolean)))
  const usersById: Record<string, { username: string; fullName?: string; role?: string }> = {}
  if (userIds.length) {
    const users: any[] = await HospitalUser.find({ _id: { $in: userIds } }).select({ username: 1, fullName: 1, role: 1 }).lean()
    for (const u of users) {
      usersById[String(u._id)] = { username: String(u.username || ''), fullName: u.fullName != null ? String(u.fullName) : undefined, role: u.role != null ? String(u.role) : undefined }
    }
  }
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
    entries.push({
      id: String(r._id),
      txId: String(r.txId || `TXN-${String(r._id)}`),
      dateIso: r.dateIso,
      createdAt: r.createdAt,
      createdBy: r.createdBy != null ? String(r.createdBy) : undefined,
      user: (() => {
        const id = r?.createdBy != null ? String(r.createdBy) : ''
        if (!id) return undefined
        const u = usersById[id]
        if (!u) return { id }
        return { id, username: u.username, fullName: u.fullName, role: u.role }
      })(),
      memo: r.memo,
      amount: r.amount,
      pettyCode: r.pettyCode,
      bankTitle,
      bankId,
    })
  }
  res.json({ entries })
}
