import { Request, Response } from 'express'
import { TherapyVisit } from '../models/TherapyVisit'
import { TherapyPackage } from '../models/TherapyPackage'

export async function getSummary(req: Request, res: Response) {
  try {
    const { from, to } = req.query
    const filter: any = {}

    if (from || to) {
      const f: any = {}
      if (from) {
        // Create date in local time for the start of the day
        const fromDate = new Date(String(from) + 'T00:00:00')
        f.$gte = fromDate.toISOString()
      }
      if (to) {
        // Create date in local time for the end of the day
        const toDate = new Date(String(to) + 'T23:59:59.999')
        f.$lte = toDate.toISOString()
      }
      // Check both createdAtIso and createdAt
      filter.$or = [
        { createdAtIso: f },
        { createdAt: f }
      ]
    }

    const [visits, packageCount] = await Promise.all([
      TherapyVisit.find(filter).lean(),
      TherapyPackage.countDocuments({ status: 'active' })
    ])

    const summary = {
      visits: visits.length,
      revenue: visits.reduce((acc, v) => acc + (Number(v.net) || 0), 0),
      pending: visits.filter(v => !v.sessionStatus || v.sessionStatus === 'Queued').length,
      completed: visits.filter(v => v.sessionStatus === 'Completed').length,
      returned: visits.filter(v => v.status === 'returned').length,
      totalPackages: packageCount
    }

    res.json(summary)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}
