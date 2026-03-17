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
        f.$gte = new Date(String(from) + 'T00:00:00')
      }
      if (to) {
        f.$lte = new Date(String(to) + 'T23:59:59.999')
      }
      filter.$or = [
        { createdAtIso: { $gte: from ? String(from) + 'T00:00:00' : undefined, $lte: to ? String(to) + 'T23:59:59.999' : undefined } },
        { createdAt: f }
      ]
      // Clean up undefined from $or
      if (filter.$or[0].createdAtIso.$gte === undefined) delete filter.$or[0].createdAtIso.$gte
      if (filter.$or[0].createdAtIso.$lte === undefined) delete filter.$or[0].createdAtIso.$lte
    }

    console.log('Therapy Dashboard Filter:', JSON.stringify(filter, null, 2))
    const [visits, packageCount] = await Promise.all([
      TherapyVisit.find(filter).lean(),
      TherapyPackage.countDocuments({ status: 'active' })
    ])
    console.log('Therapy Dashboard Visits Found:', visits.length)

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
