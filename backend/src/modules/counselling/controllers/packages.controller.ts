import { Request, Response } from 'express'
import { CounsellingPackage } from '../models/CounsellingPackage'

export const listPackages = async (req: Request, res: Response) => {
  try {
    const { status, month, q, page = 1, limit = 200 } = req.query
    const filter: any = {}
    if (status) filter.status = status
    if (month) filter.month = Number(month)
    if (q) filter.packageName = { $regex: String(q), $options: 'i' }

    const skip = (Number(page) - 1) * Number(limit)
    const [items, total] = await Promise.all([
      CounsellingPackage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      CounsellingPackage.countDocuments(filter),
    ])

    res.json({ items, total, page: Number(page), limit: Number(limit) })
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Internal Server Error' })
  }
}

export const getPackage = async (req: Request, res: Response) => {
  try {
    const item = await CounsellingPackage.findById(req.params.id).lean()
    if (!item) return res.status(404).json({ message: 'Package not found' })
    res.json(item)
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Internal Server Error' })
  }
}

export const createPackage = async (req: Request, res: Response) => {
  try {
    const { packageName, month, price, status } = req.body
    const item = await CounsellingPackage.create({ packageName, month, price, status })
    res.status(201).json(item)
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Internal Server Error' })
  }
}

export const updatePackage = async (req: Request, res: Response) => {
  try {
    const { packageName, month, price, status } = req.body
    const item = await CounsellingPackage.findByIdAndUpdate(
      req.params.id,
      { packageName, month, price, status },
      { new: true }
    ).lean()
    if (!item) return res.status(404).json({ message: 'Package not found' })
    res.json(item)
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Internal Server Error' })
  }
}

export const deletePackage = async (req: Request, res: Response) => {
  try {
    const item = await CounsellingPackage.findByIdAndDelete(req.params.id).lean()
    if (!item) return res.status(404).json({ message: 'Package not found' })
    res.json({ message: 'Package deleted' })
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Internal Server Error' })
  }
}
