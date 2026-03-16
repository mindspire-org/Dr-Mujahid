import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'
import { CounsellingOrder } from '../models/CounsellingOrder'
import { CounsellingAccount } from '../models/CounsellingAccount'
import { LabCounter } from '../../lab/models/Counter'
import { postCounsellingTokenJournal } from './finance_ledger'

async function nextTokenNo() {
  const d = new Date()
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const key = `counselling_token_${yyyymmdd}`
  const c = await LabCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true })
  const seq = String(c.seq).padStart(3, '0')
  return `C${yyyymmdd.slice(2)}-${seq}`
}

export const createOrder = async (req: Request, res: Response) => {
  try {
    const data = req.body
    const tokenNo = await nextTokenNo()
    const nowIso = new Date().toISOString()

    const order = await CounsellingOrder.create({
      ...data,
      tokenNo,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    })

    // Create Finance Journal entry
    try {
      await postCounsellingTokenJournal({
        orderId: String(order._id),
        dateIso: nowIso.slice(0, 10),
        net: Number(data.net || 0),
        amountReceived: Number(data.amountReceived || 0),
        patientId: data.patientId,
        patientName: data.patient?.fullName,
        mrn: data.patient?.mrn,
        tokenNo: tokenNo,
        paymentMethod: data.paymentMethod,
        receivedToAccountCode: data.receivedToAccountCode,
        createdBy: (req as any).user?._id || (req as any).user?.username,
      })
    } catch (journalErr) {
      console.error('Failed to create finance journal for counselling order:', journalErr)
    }

    // Update account dues if unpaid or has remaining balance
    // Simple implementation for now to fix the 404
    const net = Number(data.net || 0)
    const received = Number(data.amountReceived || 0)
    const diff = net - received

    if (diff !== 0) {
      await CounsellingAccount.findOneAndUpdate(
        { patientId: data.patientId },
        {
          $inc: { dues: diff > 0 ? diff : 0, advance: diff < 0 ? -diff : 0 },
          $set: { 
            mrn: data.patient?.mrn,
            fullName: data.patient?.fullName,
            phone: data.patient?.phone,
            updatedAtIso: nowIso 
          }
        },
        { upsert: true }
      )
    }

    res.status(201).json({ order, tokenNo })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const listOrders = async (req: Request, res: Response) => {
  try {
    const { q, status, from, to, page = 1, limit = 20 } = req.query
    const filter: any = {}
    if (status) filter.status = status
    if (from || to) {
      filter.createdAt = {}
      if (from) {
        const start = new Date(String(from))
        start.setUTCHours(0, 0, 0, 0)
        filter.createdAt.$gte = start
      }
      if (to) {
        const end = new Date(String(to))
        end.setUTCHours(23, 59, 59, 999)
        filter.createdAt.$lte = end
      }
    }
    if (q) {
      const rx = new RegExp(String(q), 'i')
      filter.$or = [{ 'patient.fullName': rx }, { 'patient.phone': rx }, { tokenNo: rx }, { 'patient.mrn': rx }]
    }
    const skip = (Number(page) - 1) * Number(limit)
    const [items, total] = await Promise.all([
      CounsellingOrder.find(filter)
        .populate('packages')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CounsellingOrder.countDocuments(filter),
    ])
    res.json({ tokens: items, total }) // Front-end expects 'tokens' key similar to hospital
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = req.body
    const order = await CounsellingOrder.findByIdAndUpdate(id, { $set: data }, { new: true }).lean()
    if (!order) return res.status(404).json({ message: 'Order not found' })
    res.json({ order })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const updateSessionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { sessionStatus } = req.body
    if (!['Queued', 'Completed'].includes(sessionStatus)) {
      return res.status(400).json({ message: 'Invalid session status' })
    }
    const order = await CounsellingOrder.findByIdAndUpdate(
      id,
      { $set: { sessionStatus } },
      { new: true }
    ).lean()
    if (!order) return res.status(404).json({ message: 'Order not found' })
    res.json({ order })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const returnOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const order = await CounsellingOrder.findByIdAndUpdate(
      id,
      { $set: { status: 'returned', returnReason: reason } },
      { new: true }
    ).lean()
    if (!order) return res.status(404).json({ message: 'Order not found' })
    res.json({ order })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query
    const filter: any = {}

    if (from || to) {
      filter.createdAt = {}
      if (from) {
        const start = new Date(String(from))
        start.setUTCHours(0, 0, 0, 0)
        filter.createdAt.$gte = start
      }
      if (to) {
        const end = new Date(String(to))
        end.setUTCHours(23, 59, 59, 999)
        filter.createdAt.$lte = end
      }
    }

    const [orders, pending, completed, returned] = await Promise.all([
      CounsellingOrder.countDocuments({ ...filter, status: { $ne: 'cancelled' } }),
      CounsellingOrder.countDocuments({ ...filter, status: 'active', sessionStatus: 'Queued' }),
      CounsellingOrder.countDocuments({ ...filter, status: 'active', sessionStatus: 'Completed' }),
      CounsellingOrder.countDocuments({ ...filter, status: 'returned' }),
    ])

    const revenueData = await CounsellingOrder.aggregate([
      { $match: { ...filter, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$net' } } }
    ])

    res.json({
      orders,
      pending,
      completed,
      returned,
      revenue: revenueData[0]?.total || 0
    })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}
