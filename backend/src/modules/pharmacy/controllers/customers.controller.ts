import { Request, Response } from 'express'
import { Customer } from '../models/Customer'
import { Dispense } from '../models/Dispense'
import { customerCreateSchema, customerUpdateSchema } from '../validators/customer'
import { AuditLog } from '../models/AuditLog'
import { CustomerPayment } from '../models/CustomerPayment'
import { ApiError } from '../../../common/errors/ApiError'
import { FinanceJournal } from '../../hospital/models/FinanceJournal'

export async function list(req: Request, res: Response) {
  const q = String(req.query.q || '').trim()
  const page = Math.max(1, Number((req.query.page as any) || 1))
  const limit = Math.max(1, Number((req.query.limit as any) || 10))
  const filter = q ? {
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { cnic: { $regex: q, $options: 'i' } },
      { mrNumber: { $regex: q, $options: 'i' } },
      { company: { $regex: q, $options: 'i' } },
    ]
  } : {}
  const skip = (page - 1) * limit
  const [rawItems, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ])
  const ids = rawItems.map(i => String((i as any)._id))
  let stats: { _id: string; totalSpent: number; salesCount: number; lastPurchaseAt: string }[] = []
  let creditStats: { _id: string; totalCreditAmount: number }[] = []
  let paymentStats: { _id: string; totalPaid: number }[] = []
  if (ids.length) {
    ;[stats, creditStats, paymentStats] = await Promise.all([
      Dispense.aggregate([
        { $match: { customerId: { $in: ids } } },
        { $group: { _id: '$customerId', totalSpent: { $sum: { $ifNull: ['$total', 0] } }, salesCount: { $sum: 1 }, lastPurchaseAt: { $max: '$datetime' } } },
      ]),
      Dispense.aggregate([
        { $match: { customerId: { $in: ids }, payment: 'Credit' } },
        { $group: { _id: '$customerId', totalCreditAmount: { $sum: { $ifNull: ['$total', 0] } } } },
      ]),
      CustomerPayment.aggregate([
        { $match: { customerId: { $in: ids } } },
        { $group: { _id: '$customerId', totalPaid: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),
    ]) as any
  }
  const map = new Map(stats.map(s => [String(s._id), s]))
  const creditMap = new Map(creditStats.map(s => [String(s._id), s]))
  const paidMap = new Map(paymentStats.map(s => [String(s._id), s]))
  const enriched = rawItems.map((i: any) => {
    const s = map.get(String(i._id))
    const c = creditMap.get(String(i._id))
    const p = paidMap.get(String(i._id))
    const totalSpentRaw = (s && typeof s.totalSpent === 'number') ? s.totalSpent : 0
    const totalSpent = Math.round(totalSpentRaw * 100) / 100
    const salesCount = (s && typeof s.salesCount === 'number') ? s.salesCount : 0
    const lastPurchaseAt = (s && typeof s.lastPurchaseAt === 'string') ? s.lastPurchaseAt : null

    const totalCreditRaw = (c && typeof (c as any).totalCreditAmount === 'number') ? Number((c as any).totalCreditAmount) : 0
    const totalCreditAmount = Math.round(totalCreditRaw * 100) / 100
    const totalPaidRaw = (p && typeof (p as any).totalPaid === 'number') ? Number((p as any).totalPaid) : 0
    const totalPaid = Math.round(totalPaidRaw * 100) / 100
    const totalRemaining = Math.max(0, Math.round((totalCreditAmount - totalPaid) * 100) / 100)

    return { ...i, totalSpent, salesCount, lastPurchaseAt, totalCreditAmount, totalPaid, totalRemaining }
  })
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 1)))
  res.json({ items: enriched, total, page, totalPages })
}

export async function create(req: Request, res: Response) {
  const data = customerCreateSchema.parse(req.body)
  const c = await Customer.create(data)
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await AuditLog.create({
      actor,
      action: 'Add Customer',
      label: 'ADD_CUSTOMER',
      method: 'POST',
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `${c.name || ''} — ${c.phone || ''}`,
    })
  } catch {}
  res.status(201).json(c)
}

export async function update(req: Request, res: Response) {
  const id = String(req.params.id || '')
  if (!id) return res.status(400).json({ error: 'ID required' })
  const data = customerUpdateSchema.parse(req.body)
  const updated = await Customer.findByIdAndUpdate(id, data, { new: true })
  if (!updated) return res.status(404).json({ error: 'Not found' })
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await AuditLog.create({
      actor,
      action: 'Edit Customer',
      label: 'EDIT_CUSTOMER',
      method: 'PUT',
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `${updated.name || ''} — ${updated.phone || ''}`,
    })
  } catch {}
  res.json(updated)
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id || '')
  if (!id) return res.status(400).json({ error: 'ID required' })
  const before: any = await Customer.findById(id).lean()
  await Customer.findByIdAndDelete(id)
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await AuditLog.create({
      actor,
      action: 'Delete Customer',
      label: 'DELETE_CUSTOMER',
      method: 'DELETE',
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `${before?.name || ''} — ${before?.phone || ''}`,
    })
  } catch {}
  res.json({ ok: true })
}

export async function listPayments(req: Request, res: Response) {
  const customerId = String(req.params.id || '')
  if (!customerId) throw new ApiError(400, 'Customer id required')
  const page = Math.max(1, Number((req.query.page as any) || 1))
  const limit = Math.max(1, Math.min(500, Number((req.query.limit as any) || 200)))
  const skip = (page - 1) * limit
  const [items, total] = await Promise.all([
    CustomerPayment.find({ customerId }).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    CustomerPayment.countDocuments({ customerId }),
  ])
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 1)))
  res.json({ items, total, page, totalPages })
}

export async function recordPayment(req: Request, res: Response) {
  const customerId = String(req.params.id || '')
  if (!customerId) throw new ApiError(400, 'Customer id required')
  const amount = Number(req.body?.amount ?? 0)
  const saleId = String(req.body?.saleId || '') || undefined
  const method = String(req.body?.method || '') || undefined
  const note = String(req.body?.note || '') || undefined
  const date = String(req.body?.date || '') || new Date().toISOString()
  if (!amount || amount <= 0) throw new ApiError(400, 'Invalid amount')
  const c = await Customer.findById(customerId)
  if (!c) throw new ApiError(404, 'Customer not found')

  const roundedAmount = Number(Number(amount).toFixed(2))

  if (saleId) {
    await CustomerPayment.create({ customerId, saleId, amount: roundedAmount, method, note, date })
  } else {
    let remainingToAllocate = roundedAmount
    const sales: any[] = await Dispense.find({ customerId, payment: 'Credit' }).sort({ datetime: 1 }).lean()
    const paidAgg: Array<{ _id?: string; total?: number }> = await CustomerPayment.aggregate([
      { $match: { customerId, saleId: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$saleId', total: { $sum: { $ifNull: ['$amount', 0] } } } },
    ])
    const paidMap = new Map(paidAgg.map(p => [String(p._id || ''), Number(p.total || 0)]))
    for (const s of sales) {
      if (remainingToAllocate <= 0) break
      const sid = String(s._id)
      const alreadyPaid = Number(paidMap.get(sid) || 0)
      const total = Number(s.total || 0)
      const remaining = Math.max(0, Number((total - alreadyPaid).toFixed(2)))
      if (remaining <= 0) continue
      const apply = Math.min(remaining, remainingToAllocate)
      await CustomerPayment.create({ customerId, saleId: sid, amount: Number(apply.toFixed(2)), method, note, date })
      remainingToAllocate = Number((remainingToAllocate - apply).toFixed(2))
    }
    if (remainingToAllocate > 0) {
      await CustomerPayment.create({ customerId, amount: Number(remainingToAllocate.toFixed(2)), method, note, date })
    }
  }
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || 'system'
    await AuditLog.create({
      actor,
      action: 'Customer Payment',
      label: 'CUSTOMER_PAYMENT',
      method: 'POST',
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `${c.name || ''} — Payment Rs ${Number(amount || 0).toFixed(2)}`,
    })
  } catch {}
  res.json({ ok: true })
}

export async function listCreditCustomers(req: Request, res: Response) {
  const q = String(req.query.q || '').trim()
  const page = Math.max(1, Number((req.query.page as any) || 1))
  const limit = Math.max(1, Math.min(200, Number((req.query.limit as any) || 20)))
  const skip = (page - 1) * limit

  const { PharmacyAccount } = await import('../models/PharmacyAccount')

  // Build search filter
  const searchFilter: any = q ? { $or: [{ fullName: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { mrn: new RegExp(q, 'i') }] } : {}

  // Primary source: PharmacyAccount (populated on every sale)
  // Also aggregate from Dispense for customers with duesAfter > 0 (covers legacy data)
  const dispenseAgg: Array<{ _id: string; dues: number; advance: number; fullName: string; phone: string; mrn: string; lastDatetime: string; customerId?: string }> = await Dispense.aggregate([
    {
      $match: {
        $or: [{ duesAfter: { $gt: 0 } }, { advanceAfter: { $gt: 0 } }],
        // Only include records with identifiable patient info
        $and: [{
          $or: [
            { mrn: { $exists: true, $nin: [null, ''] } },
            { phone: { $exists: true, $nin: [null, ''] } },
            { customer: { $exists: true, $nin: [null, '', 'Walk-in'] } },
          ],
        }],
      },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $and: [{ $ifNull: ['$mrn', false] }, { $ne: ['$mrn', ''] }] },
            '$mrn',
            {
              $cond: [
                { $and: [{ $ifNull: ['$customerId', false] }, { $ne: ['$customerId', ''] }] },
                '$customerId',
                { $ifNull: ['$phone', '$customer'] },
              ],
            },
          ],
        },
        dues: { $last: '$duesAfter' },
        advance: { $last: '$advanceAfter' },
        fullName: { $last: '$customer' },
        phone: { $last: '$phone' },
        mrn: { $last: '$mrn' },
        lastDatetime: { $max: '$datetime' },
        customerId: { $last: '$customerId' },
      },
    },
    { $match: { _id: { $nin: [null, '', 'Walk-in'] }, $or: [{ dues: { $gt: 0 } }, { advance: { $gt: 0 } }] } },
  ])

  // Merge PharmacyAccount + Dispense aggregation (PharmacyAccount takes precedence)
  const accountMap = new Map<string, any>()

  // Add from Dispense aggregation first (lower priority)
  for (const d of dispenseAgg) {
    const key = String(d.customerId || d._id || '')
    if (!key) continue
    // Skip walk-in entries with no real identity
    const name = String(d.fullName || '').trim()
    if (!name || name.toLowerCase() === 'walk-in') continue
    accountMap.set(key, {
      customerId: key,
      fullName: name,
      phone: d.phone || '',
      mrn: d.mrn || '',
      dues: Math.max(0, Number(d.dues || 0)),
      advance: Math.max(0, Number(d.advance || 0)),
      updatedAtIso: d.lastDatetime || '',
    })
  }

  // Overwrite with PharmacyAccount data (higher priority, more accurate)
  const acctFilter: any = { $or: [{ dues: { $gt: 0 } }, { advance: { $gt: 0 } }] }
  const allAccounts: any[] = await PharmacyAccount.find(acctFilter).lean()
  for (const a of allAccounts) {
    const key = String(a.customerId || '')
    if (!key) continue
    accountMap.set(key, {
      customerId: key,
      fullName: a.fullName || '',
      phone: a.phone || '',
      mrn: a.mrn || '',
      dues: Math.max(0, Number(a.dues || 0)),
      advance: Math.max(0, Number(a.advance || 0)),
      updatedAtIso: a.updatedAtIso || '',
    })
  }

  // Apply search filter
  let allItems = Array.from(accountMap.values())
  if (q) {
    const rx = new RegExp(q, 'i')
    allItems = allItems.filter(a => rx.test(a.fullName || '') || rx.test(a.phone || '') || rx.test(a.mrn || ''))
  }

  // Sort by updatedAtIso desc
  allItems.sort((a, b) => String(b.updatedAtIso || '').localeCompare(String(a.updatedAtIso || '')))

  const total = allItems.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageItems = allItems.slice(skip, skip + limit)

  // Fetch last sale for each
  const customerIds = pageItems.map(a => a.customerId).filter(Boolean)
  const lastSales: any[] = customerIds.length
    ? await Dispense.find({ $or: [{ customerId: { $in: customerIds } }, { mrn: { $in: customerIds } }] })
        .sort({ datetime: -1 })
        .select({ customerId: 1, mrn: 1, billNo: 1, datetime: 1, total: 1, payment: 1, paymentStatus: 1, duesBefore: 1, advanceBefore: 1, amountReceivedNow: 1, advanceApplied: 1, duesAfter: 1, advanceAfter: 1, payPreviousDues: 1, useAdvance: 1, duesPaid: 1, paidForToday: 1, advanceAdded: 1, paymentMethodDetail: 1, accountCode: 1 })
        .lean()
    : []

  const lastSaleMap = new Map<string, any>()
  for (const s of lastSales) {
    const cid = String(s.customerId || s.mrn || '')
    if (!lastSaleMap.has(cid)) lastSaleMap.set(cid, s)
  }

  const items = pageItems.map(a => ({
    customerId: a.customerId,
    name: a.fullName || '',
    phone: a.phone || '',
    mrn: a.mrn || '',
    dues: a.dues,
    advance: a.advance,
    hasUnpaid: a.dues > 0,
    updatedAtIso: a.updatedAtIso || '',
    lastSale: lastSaleMap.get(a.customerId) || null,
  }))

  res.json({ items, total, page, totalPages })
}

export async function payCreditCustomer(req: Request, res: Response) {
  const customerId = String(req.params.id || '')
  if (!customerId) throw new ApiError(400, 'Customer id required')

  const amount = Number(req.body?.amount ?? 0)
  const currentDues = Number(req.body?.currentDues ?? 0)
  const paymentMethod = String(req.body?.paymentMethod || 'Cash')
  const receivedToAccountCode = String(req.body?.receivedToAccountCode || '')
  const accountNumberIban = String(req.body?.accountNumberIban || '') || undefined
  const receptionistName = String(req.body?.receptionistName || '') || undefined
  const note = String(req.body?.note || '') || undefined
  // Read username exactly like POS: frontend passes createdBy from localStorage.pharmacy.user
  const bodyCreatedBy = String(req.body?.createdBy || '').trim()
  const jwtUsername = String((req as any).user?.username || (req as any).user?.name || '').trim()
  const actorUsername = bodyCreatedBy || jwtUsername

  if (!amount || amount <= 0) throw new ApiError(400, 'Invalid amount')
  if (!receivedToAccountCode) throw new ApiError(400, 'Account code required')

  // Resolve customer info — customerId may be a MongoDB ObjectId OR an MRN string
  const { PharmacyAccount } = await import('../models/PharmacyAccount')
  const mongoose = await import('mongoose')
  let customerName = ''
  let customerPhone = ''

  // Try Customer collection first (only if valid ObjectId)
  if (mongoose.default.isValidObjectId(customerId)) {
    try {
      const c = await Customer.findById(customerId).lean()
      if (c) { customerName = (c as any).name || ''; customerPhone = (c as any).phone || '' }
    } catch {}
  }

  // Fall back to PharmacyAccount
  if (!customerName) {
    try {
      const acct: any = await PharmacyAccount.findOne({ customerId }).lean()
      if (acct) { customerName = acct.fullName || ''; customerPhone = acct.phone || '' }
    } catch {}
  }

  // Fall back to last Dispense record
  if (!customerName) {
    try {
      const d: any = await Dispense.findOne({ $or: [{ customerId }, { mrn: customerId }] }).sort({ datetime: -1 }).lean()
      if (d) { customerName = d.customer || ''; customerPhone = d.phone || '' }
    } catch {}
  }

  // Resolve MRN for collection report
  let customerMrn = ''
  try {
    const acct: any = await PharmacyAccount.findOne({ customerId }).lean()
    if (acct) customerMrn = acct.mrn || ''
  } catch {}
  if (!customerMrn) {
    try {
      const d: any = await Dispense.findOne({ $or: [{ customerId }, { mrn: customerId }] }).sort({ datetime: -1 }).lean()
      if (d) customerMrn = d.mrn || ''
    } catch {}
  }

  // Compute actual dues from PharmacyAccount (most accurate)
  let duesBefore = currentDues
  try {
    const acct: any = await PharmacyAccount.findOne({ customerId }).lean()
    if (acct) duesBefore = Math.max(0, Number(acct.dues || 0))
  } catch {}

  const duesPaid = Math.min(duesBefore, amount)
  const advanceAdded = Math.max(0, amount - duesPaid)
  const duesAfter = Math.max(0, duesBefore - duesPaid)

  // Record payment
  await CustomerPayment.create({
    customerId,
    amount: Number(amount.toFixed(2)),
    method: paymentMethod,
    note,
    date: new Date().toISOString(),
  })

  // Finance journal: debit petty cash account, credit PHARM_CREDIT_REV
  // Mirrors diagnostic payCreditPatient journal entry
  try {
    const nowIso = new Date().toISOString()
    const oidRe = /^[a-f0-9]{24}$/i
    const actorId = String((req as any).user?.sub || (req as any).user?.id || (req as any).user?._id || '').trim()
    const journalCreatedBy = oidRe.test(actorId) ? actorId : undefined
    const memo = `Pharmacy Credit Payment${customerName ? ` — ${customerName}` : ''}${customerId ? ` (${customerId})` : ''}${actorUsername ? ` by ${actorUsername}` : ''}`.trim()

    await FinanceJournal.create({
      dateIso: nowIso.slice(0, 10),
      createdBy: journalCreatedBy,
      createdByUsername: actorUsername || undefined,
      refType: 'pharmacy_credit_payment',
      refId: `${customerId}:${nowIso}`,
      memo,
      lines: [
        {
          account: receivedToAccountCode,
          debit: amount,
          tags: {
            createdBy: actorUsername || undefined,
            refType: 'pharmacy_credit_payment',
            patientId: customerId,
            patientName: customerName,
            mrn: customerMrn || undefined,
            phone: customerPhone,
          },
        },
        {
          account: 'PHARM_CREDIT_REV',
          credit: amount,
          tags: {
            createdBy: actorUsername || undefined,
          },
        },
      ],
    })
  } catch (e) {
    console.warn('Finance journal failed for pharmacy credit payment', e)
  }

  // Update PharmacyAccount with new dues balance
  try {
    const { PharmacyAccount: PA } = await import('../models/PharmacyAccount')
    await PA.findOneAndUpdate(
      { customerId },
      {
        $setOnInsert: { customerId },
        $set: { dues: duesAfter, advance: advanceAdded, updatedAtIso: new Date().toISOString() },
      },
      { upsert: true }
    )
  } catch {}

  try {
    await AuditLog.create({
      actor: actorUsername || 'system',
      action: 'Credit Customer Payment',
      label: 'CREDIT_CUSTOMER_PAYMENT',
      method: 'POST',
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `${customerName} — Rs ${amount.toFixed(2)}`,
    })
  } catch {}

  res.json({
    ok: true,
    receipt: {
      customerName,
      phone: customerPhone,
      createdAt: new Date().toISOString(),
      amount,
      duesBefore,
      advanceBefore: 0,
      duesPaid,
      advanceAdded,
      duesAfter,
      advanceAfter: advanceAdded,
      paymentMethod,
      accountNumberIban,
      receivedToAccountCode,
      receptionistName,
      note,
    },
  })
}

export async function getAccount(req: Request, res: Response) {
  const key = String(req.params.key || '').trim()
  if (!key) return res.json({ account: { dues: 0, advance: 0 } })

  const { PharmacyAccount } = await import('../models/PharmacyAccount')

  // Look up by customerId, mrn, or phone
  const doc: any = await PharmacyAccount.findOne({
    $or: [{ customerId: key }, { mrn: key }, { phone: key }],
  }).lean()

  if (!doc) return res.json({ account: { dues: 0, advance: 0 } })

  res.json({
    account: {
      dues: Math.max(0, Number(doc.dues || 0)),
      advance: Math.max(0, Number(doc.advance || 0)),
      fullName: doc.fullName,
      phone: doc.phone,
      mrn: doc.mrn,
    },
  })
}
