import { Request, Response } from 'express'
import { DiagnosticAccount } from '../models/DiagnosticAccount'
import { LabPatient } from '../../lab/models/Patient'
import { DiagnosticOrder } from '../models/Order'
import { FinanceJournal } from '../../hospital/models/FinanceJournal'
import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

function getActor(req: Request){
  try {
    const auth = String(req.headers['authorization']||'')
    const token = auth.startsWith('Bearer ')? auth.slice(7) : ''
    if (!token) return {}
    const payload: any = jwt.verify(token, env.JWT_SECRET)
    return { actorId: String(payload?.sub||''), actorUsername: String(payload?.username||'') }
  } catch { return {} }
}

async function ensureAccount(patientId: string, snap?: { mrn?: string; fullName?: string; phone?: string }) {
  const nowIso = new Date().toISOString()
  const doc = await DiagnosticAccount.findOneAndUpdate(
    { patientId },
    {
      $setOnInsert: { patientId, dues: 0, advance: 0 },
      $set: {
        mrn: snap?.mrn,
        fullName: snap?.fullName,
        phone: snap?.phone,
        updatedAtIso: nowIso,
      },
    },
    { upsert: true, new: true }
  ).lean()

  return {
    doc,
    dues: clamp0((doc as any)?.dues),
    advance: clamp0((doc as any)?.advance),
  }
}

export async function payCreditPatient(req: Request, res: Response) {
  try {
    const patientId = String(req.params.patientId || '').trim()
    if (!patientId) return res.status(400).json({ error: 'patientId is required' })

    const actor = getActor(req) as any
    const createdBy = actor?.actorId ? String(actor.actorId) : undefined

    const amount = clamp0((req.body as any)?.amount)
    const currentDuesRaw = (req.body as any)?.currentDues
    const currentDues = (currentDuesRaw == null) ? undefined : clamp0(currentDuesRaw)
    const paymentMethod = String((req.body as any)?.paymentMethod || 'Cash')
    const receivedToAccountCode = String((req.body as any)?.receivedToAccountCode || '').trim().toUpperCase()
    const accountNumberIban = String((req.body as any)?.accountNumberIban || '').trim()
    const receptionistName = String((req.body as any)?.receptionistName || '').trim()
    const note = String((req.body as any)?.note || '').trim()

    if (amount <= 0) return res.status(400).json({ error: 'amount must be > 0' })
    if (!receivedToAccountCode) return res.status(400).json({ error: 'receivedToAccountCode is required' })
    if (paymentMethod.toLowerCase() === 'card' && !accountNumberIban) return res.status(400).json({ error: 'accountNumberIban is required for Card payments' })

    let p: any = null
    try { p = await LabPatient.findById(patientId).lean() } catch {}
    if (!p) {
      try {
        const a: any = await DiagnosticAccount.findOne({ patientId }).lean()
        if (a) {
          p = {
            _id: patientId,
            mrn: a?.mrn,
            fullName: a?.fullName,
            phoneNormalized: a?.phone,
            phone: a?.phone,
          }
        }
      } catch {}
    }
    if (!p) {
      try {
        const last: any = await DiagnosticOrder.findOne({ patientId }).sort({ createdAt: -1 }).select({ patient: 1 }).lean()
        const snap = last?.patient
        if (snap) {
          p = {
            _id: patientId,
            mrn: snap?.mrn,
            fullName: snap?.fullName,
            phoneNormalized: snap?.phone,
            phone: snap?.phone,
          }
        }
      } catch {}
    }
    if (!p) return res.status(404).json({ error: 'Patient not found' })

    const acct = await ensureAccount(patientId, { mrn: p?.mrn, fullName: p?.fullName, phone: p?.phoneNormalized || p?.phone })
    const duesBefore = (currentDues != null) ? currentDues : acct.dues
    const advanceBefore = acct.advance

    const duesPaid = Math.min(duesBefore, amount)
    const duesAfter = Math.max(0, duesBefore - duesPaid)
    const remaining = Math.max(0, amount - duesPaid)
    const advanceAdded = remaining
    const advanceAfter = Math.max(0, advanceBefore + advanceAdded)

    const nowIso = new Date().toISOString()
    await DiagnosticAccount.findOneAndUpdate(
      { patientId },
      {
        $setOnInsert: { patientId },
        $set: {
          mrn: p?.mrn,
          fullName: p?.fullName,
          phone: p?.phoneNormalized || p?.phone,
          dues: duesAfter,
          advance: advanceAfter,
          updatedAtIso: nowIso,
        },
      },
      { upsert: true }
    )

    // Finance journal: settle AR with received account
    try {
      await FinanceJournal.create({
        dateIso: nowIso.slice(0, 10),
        createdBy,
        refType: 'diag_credit_payment',
        refId: `${patientId}:${nowIso}`,
        memo: `Diagnostic Credit Payment${p?.mrn ? ` ${p.mrn}` : ''}${p?.fullName ? ` - ${p.fullName}` : ''}`.trim(),
        lines: [
          { account: receivedToAccountCode, debit: amount, tags: { paymentMethod, receptionistName, note, patientId, patientName: String(p?.fullName || '').trim(), mrn: String(p?.mrn || '').trim() } },
          { account: 'AR', credit: amount, tags: { patientId, patientName: String(p?.fullName || '').trim(), mrn: String(p?.mrn || '').trim() } },
        ],
      })
    } catch {}

    return res.status(201).json({
      receipt: {
        patientId,
        mrn: String(p?.mrn || ''),
        patientName: String(p?.fullName || ''),
        phone: String(p?.phoneNormalized || p?.phone || ''),
        createdAt: nowIso,
        amount,
        duesBefore,
        advanceBefore,
        duesPaid,
        advanceAdded,
        duesAfter,
        advanceAfter,
        paymentMethod,
        accountNumberIban: paymentMethod.toLowerCase() === 'card' ? accountNumberIban : '',
        receivedToAccountCode,
        receptionistName,
        note,
      },
      account: { dues: duesAfter, advance: advanceAfter },
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to record credit payment' })
  }
}

export async function listCreditPatients(req: Request, res: Response) {
  try {
    const q = String((req.query as any)?.q || '').trim()
    const page = Math.max(1, Number((req.query as any)?.page || 1))
    const limit = Math.min(200, Math.max(1, Number((req.query as any)?.limit || 20)))

    const rx = q ? new RegExp(q, 'i') : null
    const acctFilter: any = {
      $or: [
        { dues: { $gt: 0 } },
        { advance: { $gt: 0 } },
      ],
    }
    if (rx) {
      acctFilter.$and = [
        {
          $or: [
            { fullName: rx },
            { phone: rx },
            { mrn: rx },
          ],
        },
      ]
    }

    const [accts, unpaidPatientIds] = await Promise.all([
      DiagnosticAccount.find(acctFilter).sort({ updatedAt: -1 }).limit(2000).lean(),
      DiagnosticOrder.distinct('patientId', { paymentStatus: 'unpaid' }),
    ])

    const idSet = new Set<string>()
    for (const a of (accts as any[])) {
      const pid = String(a?.patientId || '').trim()
      if (pid) idSet.add(pid)
    }
    for (const id of (unpaidPatientIds as any[])) {
      const pid = String(id || '').trim()
      if (!pid || pid.toLowerCase() === 'null' || pid.toLowerCase() === 'undefined') continue
      idSet.add(pid)
    }

    const allIds = Array.from(idSet)
    if (!allIds.length) return res.json({ items: [], total: 0, page, totalPages: 1 })

    // Get latest order per patient for dialog payment details
    const recentOrders = await DiagnosticOrder.find({ patientId: { $in: allIds } })
      .sort({ createdAt: -1 })
      .select(
        'patientId createdAt tokenNo net subtotal discount paymentStatus receptionistName paymentMethod accountNumberIban receivedToAccountCode ' +
          'duesBefore advanceBefore payPreviousDues useAdvance advanceApplied amountReceived duesPaid paidForToday advanceAdded duesAfter advanceAfter'
      )
      .lean()

    const latestByPatient = new Map<string, any>()
    for (const o of (recentOrders as any[])) {
      const pid = String(o?.patientId || '')
      if (!pid) continue
      if (!latestByPatient.has(pid)) latestByPatient.set(pid, o)
    }

    // For patients that show only because of unpaid orders, ensure we still have name/phone/mrn.
    const acctByPatient = new Map<string, any>()
    for (const a of (accts as any[])) {
      const pid = String(a?.patientId || '')
      if (pid) acctByPatient.set(pid, a)
    }

    const patients = await LabPatient.find({ _id: { $in: allIds } })
      .select('mrn fullName phoneNormalized phone')
      .lean()
    const patientById = new Map<string, any>()
    for (const p of (patients as any[])) {
      const pid = String((p as any)?._id || '')
      if (pid) patientById.set(pid, p)
    }

    const unpaidSet = new Set<string>((unpaidPatientIds as any[]).map((x: any) => String(x || '')))

    // Build rows
    const rows = allIds.map((pid) => {
      const acct = acctByPatient.get(pid)
      const last = latestByPatient.get(pid)
      const p = patientById.get(pid)
      const mrn = String(acct?.mrn || p?.mrn || '')
      const fullName = String(acct?.fullName || p?.fullName || '')
      const phone = String(acct?.phone || p?.phoneNormalized || p?.phone || '')
      return {
        patientId: pid,
        mrn,
        fullName,
        phone,
        dues: clamp0(acct?.dues),
        advance: clamp0(acct?.advance),
        hasUnpaid: unpaidSet.has(pid),
        lastOrder: last || null,
        updatedAtIso: String(acct?.updatedAtIso || last?.createdAt || ''),
      }
    })

    // Remove invalid/unknown patient entries to avoid "-" placeholders in UI.
    // Also ensure we only return true credit/unpaid patients.
    const cleaned = rows.filter((r: any) => {
      const pidOk = !!String(r.patientId || '').trim()
      if (!pidOk) return false
      const hasIdentity = !!String(r.mrn || '').trim() || !!String(r.fullName || '').trim() || !!String(r.phone || '').trim()
      if (!hasIdentity) return false
      const hasBalance = clamp0(r.dues) > 0 || clamp0(r.advance) > 0
      return hasBalance || !!r.hasUnpaid
    })

    const filtered = rx
      ? cleaned.filter((r) => rx.test(r.fullName) || rx.test(r.phone) || rx.test(r.mrn))
      : cleaned

    filtered.sort((a: any, b: any) => String(b.updatedAtIso || '').localeCompare(String(a.updatedAtIso || '')))

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const pg = Math.min(page, totalPages)
    const items = filtered.slice((pg - 1) * limit, (pg - 1) * limit + limit)

    return res.json({ items, total, page: pg, totalPages })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list credit patients' })
  }
}

export async function get(req: Request, res: Response) {
  try {
    const patientId = String(req.params.patientId || '').trim()
    if (!patientId) return res.status(400).json({ error: 'patientId is required' })

    let snap: { mrn?: string; fullName?: string; phone?: string } = {}
    try {
      const p: any = await LabPatient.findById(patientId).lean()
      if (p) snap = { mrn: p?.mrn, fullName: p?.fullName, phone: p?.phoneNormalized || p?.phone }
    } catch {}

    const acct = await ensureAccount(patientId, snap)
    return res.json({ account: { dues: acct.dues, advance: acct.advance } })
  } catch {
    return res.json({ account: { dues: 0, advance: 0 } })
  }
}
