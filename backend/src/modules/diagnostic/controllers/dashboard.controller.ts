import { Request, Response } from 'express'
import { DiagnosticOrder } from '../models/Order'

function todayBounds(){
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function parseStart(s: string){
  // If client sends YYYY-MM-DD, interpret as local start of day (avoid UTC shift)
  return s.includes('T') ? new Date(s) : new Date(`${s}T00:00:00`)
}

function parseEnd(s: string){
  // If client sends YYYY-MM-DD, interpret as local end of day (avoid UTC shift)
  return s.includes('T') ? new Date(s) : new Date(`${s}T23:59:59.999`)
}

export async function summary(req: Request, res: Response){
  const from = String((req.query as any)?.from || '') || undefined
  const to = String((req.query as any)?.to || '') || undefined

  // IMPORTANT: Keep date filtering aligned with orders.controller.list
  // (avoid timezone-shift issues with YYYY-MM-DD parsing)
  const match: any = {}
  if (from || to) {
    match.createdAt = {}
    if (from) match.createdAt.$gte = parseStart(from)
    if (to) match.createdAt.$lte = parseEnd(to)
  } else {
    const { start, end } = todayBounds()
    match.createdAt = { $gte: start, $lte: end }
  }

  const [ordersAgg, itemsAgg] = await Promise.all([
    DiagnosticOrder.aggregate([
      { $match: match },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$net' } } },
    ]),
    DiagnosticOrder.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $group: { _id: '$items.status', count: { $sum: 1 } } },
    ]),
  ])

  const orders = Number(ordersAgg?.[0]?.orders || 0)
  const revenue = Number(ordersAgg?.[0]?.revenue || 0)

  const map = new Map<string, number>((itemsAgg || []).map((x: any) => [String(x?._id || ''), Number(x?.count || 0)]))
  const pending = Number(map.get('received') || 0)
  const completed = Number(map.get('completed') || 0)
  const returned = Number(map.get('returned') || 0)

  res.json({
    orders,
    revenue,
    pending,
    completed,
    returned,
    from,
    to,
    at: new Date().toISOString(),
  })
}
