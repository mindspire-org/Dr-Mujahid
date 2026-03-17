import { Request, Response } from 'express'
import { TherapyAccount } from '../models/TherapyAccount'
import { TherapyVisit } from '../models/TherapyVisit'
import { LabPatient } from '../../lab/models/Patient'
import { FinanceJournal } from '../../hospital/models/FinanceJournal'
import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

function resolveCreatedBy(req: Request) {
    const direct = (req as any)?.user?.sub
    if (direct) return String(direct)
    try {
        const auth = String(req.headers['authorization'] || '')
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (!token) return undefined
        const payload: any = jwt.verify(token, env.JWT_SECRET)
        return payload?.sub ? String(payload.sub) : undefined
    } catch {
        return undefined
    }
}

export async function listCreditPatients(req: Request, res: Response) {
    try {
        const q = String((req.query as any)?.q || '').trim()
        const page = Math.max(1, Number((req.query as any)?.page || 1))
        const limit = Math.min(200, Math.max(1, Number((req.query as any)?.limit || 20)))

        const rx = q ? new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') : null
        const acctFilter: any = { $or: [{ dues: { $gt: 0 } }, { advance: { $gt: 0 } }] }
        if (rx) {
            acctFilter.$and = [{ $or: [{ fullName: rx }, { phone: rx }, { mrn: rx }] }]
        }

        const [accts, unpaidPatientIds] = await Promise.all([
            TherapyAccount.find(acctFilter).sort({ updatedAt: -1 }).limit(2000).lean(),
            TherapyVisit.distinct('patientId', { paymentStatus: 'unpaid' }),
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

        // Fetch recent visits for these patients
        const recent = await TherapyVisit.find({ patientId: { $in: allIds } })
            .sort({ createdAt: -1 })
            .select(
                'patientId createdAt tokenNo net amountReceived discount paymentStatus receivedToAccountCode ' +
                'duesBefore advanceBefore payPreviousDues useAdvance advanceApplied duesPaid paidForToday advanceAdded duesAfter advanceAfter'
            )
            .lean()

        const latestByPatient = new Map<string, any>()
        for (const o of (recent as any[])) {
            const pid = String(o?.patientId || '')
            if (!pid) continue
            if (!latestByPatient.has(pid)) latestByPatient.set(pid, o)
        }

        const acctByPatient = new Map<string, any>()
        for (const a of (accts as any[])) {
            const pid = String(a?.patientId || '')
            if (pid) acctByPatient.set(pid, a)
        }

        const patients = await LabPatient.find({ _id: { $in: allIds } }).select('mrn fullName phoneNormalized phone').lean()
        const patientById = new Map<string, any>()
        for (const p of (patients as any[])) {
            const pid = String((p as any)?._id || '')
            if (pid) patientById.set(pid, p)
        }

        const unpaidSet = new Set<string>((unpaidPatientIds as any[]).map((x: any) => String(x || '')))

        const rows = allIds.map((pid) => {
            const acct = acctByPatient.get(pid)
            const last = latestByPatient.get(pid)
            const p = patientById.get(pid)
            const mrn = String(acct?.mrn || p?.mrn || '')
            const fullName = String(acct?.fullName || p?.fullName || '')
            const phone = String(acct?.phone || p?.phoneNormalized || p?.phone || '')

            // Adapt field names for frontend compatibility if necessary
            // TherapyVisit uses 'net' instead of hospital's 'fee'
            if (last) {
                last.fee = last.net;
                last.amount = last.amountReceived;
            }

            return {
                patientId: pid,
                mrn,
                fullName,
                phone,
                dues: clamp0(acct?.dues),
                advance: clamp0(acct?.advance),
                hasUnpaid: unpaidSet.has(pid),
                lastToken: last || null,
                updatedAtIso: String(acct?.updatedAtIso || last?.createdAt || ''),
            }
        })

        const cleaned = rows.filter((r: any) => {
            const pidOk = !!String(r.patientId || '').trim()
            if (!pidOk) return false
            const hasIdentity = !!String(r.mrn || '').trim() || !!String(r.fullName || '').trim() || !!String(r.phone || '').trim()
            if (!hasIdentity) return false
            const hasBalance = clamp0(r.dues) > 0 || clamp0(r.advance) > 0
            return hasBalance || !!r.hasUnpaid
        })

        const filtered = rx ? cleaned.filter((r: any) => rx.test(r.fullName) || rx.test(r.phone) || rx.test(r.mrn)) : cleaned
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

export async function payCreditPatient(req: Request, res: Response) {
    try {
        const patientId = String(req.params.patientId || '').trim()
        if (!patientId) return res.status(400).json({ error: 'patientId is required' })

        const createdBy = resolveCreatedBy(req)

        const body: any = req.body || {}
        const amount = clamp0(body.amount)
        const currentDues = body.currentDues != null ? clamp0(body.currentDues) : null
        const paymentMethod = String(body.paymentMethod || 'Cash')
        const receivedToAccountCode = String(body.receivedToAccountCode || '').trim().toUpperCase()
        const accountNumberIban = String(body.accountNumberIban || '')
        const receptionistName = String(body.receptionistName || '')
        const note = String(body.note || '')

        if (!amount) return res.status(400).json({ error: 'amount is required' })
        if (!receivedToAccountCode) return res.status(400).json({ error: 'receivedToAccountCode is required' })

        const p: any = await LabPatient.findById(patientId).lean()
        if (!p) return res.status(404).json({ error: 'Patient not found' })

        const acct: any = await TherapyAccount.findOneAndUpdate(
            { patientId },
            {
                $setOnInsert: { patientId, dues: 0, advance: 0 },
                $set: {
                    mrn: String(p?.mrn || ''),
                    fullName: String(p?.fullName || ''),
                    phone: String(p?.phoneNormalized || p?.phone || ''),
                },
            },
            { upsert: true, new: true }
        )

        let duesBefore = clamp0(acct?.dues)
        const advanceBefore = clamp0(acct?.advance)
        if (currentDues != null) duesBefore = currentDues

        const duesPaid = Math.min(duesBefore, amount)
        const duesAfter = Math.max(0, duesBefore - duesPaid)
        const advanceAdded = Math.max(0, amount - duesPaid)
        const advanceAfter = advanceBefore + advanceAdded

        await TherapyAccount.findOneAndUpdate(
            { patientId },
            { $set: { dues: duesAfter, advance: advanceAfter, updatedAtIso: new Date().toISOString() } },
            { upsert: true }
        )

        // Finance: debit settlement (received account), credit AR_THERAPY
        try {
            await FinanceJournal.create({
                dateIso: new Date().toISOString().slice(0, 10),
                createdBy,
                refType: 'Therp_Credit_Rev',
                refId: patientId,
                memo: `Therapy Credit Patient Payment — ${String(p?.fullName || '').trim()}`.trim(),
                lines: [
                    { account: receivedToAccountCode, debit: amount, tags: { patientName: String(p?.fullName || '').trim(), mrn: String(p?.mrn || '').trim(), patientId } },
                    { account: 'AR_THERAPY', credit: amount, tags: { patientName: String(p?.fullName || '').trim(), mrn: String(p?.mrn || '').trim(), patientId } },
                ],
            })
        } catch { }

        return res.json({
            receipt: {
                patientId,
                patientName: String(p?.fullName || ''),
                mrn: String(p?.mrn || ''),
                phone: String(p?.phoneNormalized || p?.phone || ''),
                createdAt: new Date().toISOString(),
                amount,
                duesBefore,
                advanceBefore,
                duesPaid,
                advanceAdded,
                duesAfter,
                advanceAfter,
                paymentMethod: paymentMethod === 'Card' ? 'Card' : (paymentMethod === 'Insurance' ? 'Insurance' : 'Cash'),
                accountNumberIban: paymentMethod === 'Card' ? accountNumberIban : '',
                receivedToAccountCode,
                receptionistName,
                note,
            },
        })
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'Failed to pay credit patient' })
    }
}
