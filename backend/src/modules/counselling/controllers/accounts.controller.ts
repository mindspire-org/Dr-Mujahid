import { Request, Response } from 'express'
import { CounsellingAccount } from '../models/CounsellingAccount'

export const getAccount = async (req: Request, res: Response) => {
  try {
    const account = await CounsellingAccount.findOne({ patientId: req.params.patientId }).lean()
    res.json({ account: account || { dues: 0, advance: 0 } })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const listCreditPatients = async (req: Request, res: Response) => {
  try {
    const { q, page = 1, limit = 20 } = req.query
    const filter: any = { $or: [{ dues: { $gt: 0 } }, { advance: { $gt: 0 } }] }
    
    if (q) {
      const rx = new RegExp(String(q), 'i')
      filter.$and = [
        { $or: [{ fullName: rx }, { mrn: rx }, { phone: rx }] }
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [items, total] = await Promise.all([
      CounsellingAccount.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      CounsellingAccount.countDocuments(filter),
    ])

    res.json({ items, total })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}

export const payCreditPatient = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params
    const { amount, paymentMethod, receivedToAccountCode, receptionistName } = req.body
    const amt = Number(amount || 0)

    const account = await CounsellingAccount.findOne({ patientId })
    if (!account) return res.status(404).json({ message: 'Account not found' })

    // Simple logic: apply to dues first, then advance
    let remaining = amt
    let duesPaid = 0
    let advanceAdded = 0

    if (account.dues > 0) {
      duesPaid = Math.min(account.dues, remaining)
      account.dues -= duesPaid
      remaining -= duesPaid
    }

    if (remaining > 0) {
      advanceAdded = remaining
      account.advance += advanceAdded
    }

    account.updatedAtIso = new Date().toISOString()
    await account.save()

    res.json({ account, duesPaid, advanceAdded })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
}
