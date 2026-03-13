import { Request, Response } from 'express'
import { Customer } from '../models/Customer'
import { Dispense } from '../models/Dispense'
import { customerCreateSchema, customerUpdateSchema } from '../validators/customer'
import { AuditLog } from '../models/AuditLog'
import { CustomerPayment } from '../models/CustomerPayment'
import { ApiError } from '../../../common/errors/ApiError'

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
