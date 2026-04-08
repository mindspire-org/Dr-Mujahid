import { Request, Response } from 'express'
import { z } from 'zod'
import { FinanceJournal } from '../models/FinanceJournal'
import { HospitalUser } from '../models/User'

const querySchema = z.object({
  code: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export async function listAccountTransactions(req: Request, res: Response){
  const q = querySchema.parse(req.query)
  const code = String(q.code || '').trim().toUpperCase()
  const from = String(q.from || '1900-01-01')
  const to = String(q.to || '2100-01-01')
  const limit = Number(q.limit || 200)

  const rows: any[] = await FinanceJournal.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to }, 'lines.account': code } },
    { $addFields: { txId: { $ifNull: ['$txId', { $concat: ['TXN-', { $toString: '$_id' }] }] } } },
    { $project: { txId: 1, dateIso: 1, createdAt: 1, createdBy: 1, createdByUsername: 1, refType: 1, refId: 1, memo: 1, lines: 1 } },
    { $addFields: {
      myLine: {
        $first: {
          $filter: {
            input: '$lines',
            as: 'l',
            cond: { $eq: ['$$l.account', code] },
          },
        },
      },
      counterparties: {
        $map: {
          input: {
            $filter: {
              input: '$lines',
              as: 'l',
              cond: { $ne: ['$$l.account', code] },
            },
          },
          as: 'c',
          in: {
            account: '$$c.account',
            debit: { $ifNull: ['$$c.debit', 0] },
            credit: { $ifNull: ['$$c.credit', 0] },
          },
        },
      },
      // First non-empty tags.createdBy across all lines
      anyLineCreatedBy: {
        $reduce: {
          input: '$lines',
          initialValue: '',
          in: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$$value', ''] } }, 0] },
              '$$value',
              { $ifNull: ['$$this.tags.createdBy', ''] },
            ],
          },
        },
      },
    } },
    { $project: {
      _id: 1,
      txId: 1,
      dateIso: 1,
      createdAt: 1,
      createdBy: 1,
      createdByUsername: 1,
      refType: 1,
      refId: 1,
      memo: 1,
      account: code,
      debit: { $ifNull: ['$myLine.debit', 0] },
      credit: { $ifNull: ['$myLine.credit', 0] },
      receiver: '$myLine.tags.receiver',
      lineCreatedBy: {
        $cond: [
          { $gt: [{ $strLenCP: { $ifNull: ['$createdByUsername', ''] } }, 0] },
          '$createdByUsername',
          {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$myLine.tags.createdBy', ''] } }, 0] },
              '$myLine.tags.createdBy',
              { $ifNull: ['$anyLineCreatedBy', ''] },
            ],
          },
        ],
      },
      counterparties: 1,
    } },
    { $sort: { dateIso: -1, createdAt: -1, _id: -1 } },
    { $limit: limit },
  ])

  const createdByVals = Array.from(new Set(rows.map(r => {
    const cb = r?.createdBy ? String(r.createdBy) : ''
    const lcb = r?.lineCreatedBy ? String(r.lineCreatedBy) : ''
    return cb || lcb
  }).filter(Boolean)))
  const oidRe = /^[a-f0-9]{24}$/i
  const oidIds = createdByVals.filter(v => oidRe.test(v))
  const usernames = createdByVals.filter(v => !oidRe.test(v))

  const usersByKey: Record<string, { id: string; username: string; fullName?: string; role?: string }> = {}
  if (oidIds.length || usernames.length) {
    const users: any[] = await HospitalUser.find({
      $or: [
        ...(oidIds.length ? [{ _id: { $in: oidIds } }] : []),
        ...(usernames.length ? [{ username: { $in: usernames } }] : []),
      ],
    }).select({ username: 1, fullName: 1, role: 1 }).lean()

    for (const u of users) {
      const id = String(u._id)
      const username = String(u.username || '').trim()
      const fullName = u.fullName != null ? String(u.fullName) : undefined
      const role = u.role != null ? String(u.role) : undefined
      usersByKey[id] = { id, username, fullName, role }
      if (username) usersByKey[username] = { id, username, fullName, role }
    }
  }

  const entries = rows.map(r => ({
    id: String(r._id),
    txId: String(r.txId || `TXN-${String(r._id)}`),
    dateIso: String(r.dateIso || ''),
    createdAt: r.createdAt,
    createdBy: r.createdBy != null ? String(r.createdBy) : (r.lineCreatedBy != null ? String(r.lineCreatedBy) : undefined),
    user: (() => {
      const key = r?.createdBy != null ? String(r.createdBy) : (r?.lineCreatedBy != null ? String(r.lineCreatedBy) : '')
      if (!key) return undefined
      const u = usersByKey[key]
      if (!u) return { id: key, username: key }
      return { id: u.id, username: u.username, fullName: u.fullName, role: u.role }
    })(),
    refType: r.refType != null ? String(r.refType) : undefined,
    refId: r.refId != null ? String(r.refId) : undefined,
    memo: r.memo != null ? String(r.memo) : undefined,
    account: code,
    debit: Number(r.debit || 0),
    credit: Number(r.credit || 0),
    receiver: r.receiver != null ? String(r.receiver) : undefined,
    counterparties: Array.isArray(r.counterparties) ? r.counterparties.map((c: any) => ({
      account: String(c.account || ''),
      debit: Number(c.debit || 0),
      credit: Number(c.credit || 0),
    })) : [],
  }))

  res.json({ code, from, to, entries })
}
