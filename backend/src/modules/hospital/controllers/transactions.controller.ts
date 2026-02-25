import { Request, Response } from 'express'
import { z } from 'zod'
import { HospitalToken } from '../models/Token'
import { HospitalExpense } from '../models/Expense'
import { HospitalIpdBillingItem } from '../models/IpdBillingItem'
import { HospitalIpdPayment } from '../models/IpdPayment'
import { FinanceJournal } from '../models/FinanceJournal'
import { HospitalDoctor } from '../models/Doctor'

type Txn = {
  id: string
  datetime: string
  type: 'OPD' | 'IPD' | 'Charge' | 'Expense'
  description: string
  staff?: string
  transBy?: string
  supplierName?: string
  invoiceNo?: string
  fee?: number
  discount?: number
  amount: number
  method?: 'cash' | 'bank' | 'card'
  ref?: string
  module?: string
}

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
})

function safeIso(x: any) {
  try {
    const d = x instanceof Date ? x : new Date(x)
    if (isNaN(d as any)) return ''
    return d.toISOString()
  } catch {
    return ''
  }
}

function normalizeMethod(x?: string): Txn['method'] {
  const raw = String(x || '').toLowerCase().trim()
  if (raw === 'cash') return 'cash'
  if (raw === 'bank') return 'bank'
  if (raw === 'card') return 'card'
  return undefined
}

export async function list(req: Request, res: Response) {
  const q = querySchema.safeParse(req.query)
  const from = (q.success ? q.data.from : undefined) || '1900-01-01'
  const to = (q.success ? q.data.to : undefined) || '2100-01-01'
  const limit = (q.success ? q.data.limit : undefined) || 2000

  const fromDt = new Date(from + 'T00:00:00.000Z')
  const toDt = new Date(to + 'T23:59:59.999Z')

  const [tokens, expenses, billingItems, ipdPayments, payoutJournals, expensePayJournals] = await Promise.all([
    HospitalToken.find({ dateIso: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } })
      .sort({ dateIso: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    // Only approved expenses should show in Transactions (draft/submitted are pending approval)
    HospitalExpense.find({ dateIso: { $gte: from, $lte: to }, $or: [ { status: 'approved' }, { status: { $exists: false } }, { status: null }, { status: '' } ] })
      .sort({ dateIso: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    HospitalIpdBillingItem.find({ date: { $gte: fromDt, $lte: toDt } })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    HospitalIpdPayment.find({ receivedAt: { $gte: fromDt, $lte: toDt } })
      .sort({ receivedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    FinanceJournal.find({ refType: 'doctor_payout', dateIso: { $gte: from, $lte: to } })
      .sort({ dateIso: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    // Expense payments posted at approval time (e.g., Staff Salary) should appear as transactions
    FinanceJournal.find({ refType: 'EXPENSE_PAYMENT', dateIso: { $gte: from, $lte: to } })
      .sort({ dateIso: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
  ])

  // Exclude reversed doctor payouts
  const payoutIds = payoutJournals.map((j: any) => String(j._id))
  const payoutRevs = payoutIds.length
    ? await FinanceJournal.find({ refType: { $regex: /_reversal$/ }, refId: { $in: payoutIds } }).select({ refId: 1 }).lean()
    : []
  const reversed = new Set((payoutRevs || []).map((r: any) => String(r.refId || '')))
  const payoutRows = payoutJournals.filter((j: any) => !reversed.has(String(j._id)))

  const payoutDoctorIds = Array.from(new Set(payoutRows.map((j: any) => String(j.refId || '')).filter(Boolean)))
  const payoutDoctors = payoutDoctorIds.length
    ? await HospitalDoctor.find({ _id: { $in: payoutDoctorIds } }).select({ name: 1 }).lean()
    : []
  const doctorById = new Map<string, string>(payoutDoctors.map((d: any) => [String(d._id), String(d.name || '')]))

  const txns: Txn[] = []

  for (const t of tokens as any[]) {
    const dt = t.createdAt ? safeIso(t.createdAt) : `${String(t.dateIso || '').slice(0, 10)}T00:00:00.000Z`
    const fallback = Number(t.amount || 0) - Number(t.discount || 0)
    const raw = t.net ?? t.payable ?? t.fee ?? fallback
    const amount = Number(raw) || 0
    const fee = Number(t.amount ?? t.pricing?.feeResolved ?? t.feeResolved ?? t.consultationFee ?? 0) || 0
    const discount = Number(t.discount ?? t.pricing?.discount ?? 0) || 0
    txns.push({
      id: String(t._id || t.id),
      datetime: dt,
      type: 'OPD',
      description: `OPD Token${t.tokenNo ? ' #' + t.tokenNo : ''}${t.patientName ? ' — ' + t.patientName : ''}`,
      fee,
      discount,
      amount,
      method: normalizeMethod(t.paymentMethod),
      ref: t.paymentRef ? String(t.paymentRef) : undefined,
      module: 'OPD',
    })
  }

  for (const e of expenses as any[]) {
    // Avoid double-counting: if an approved expense has a posted journalId, we show the journal transaction instead.
    if (e.journalId) continue
    const dt = e.createdAt ? safeIso(e.createdAt) : `${String(e.dateIso || '').slice(0, 10)}T00:00:00.000Z`
    txns.push({
      id: String(e._id || e.id),
      datetime: dt,
      type: 'Expense',
      description: String(e.note || e.category || 'Expense'),
      staff: e.receiverLabel ? String(e.receiverLabel) : undefined,
      transBy: e.createdBy ? String(e.createdBy) : undefined,
      supplierName: e.supplierName ? String(e.supplierName) : undefined,
      invoiceNo: e.invoiceNo ? String(e.invoiceNo) : undefined,
      amount: -Math.abs(Number(e.amount || 0) || 0),
      method: normalizeMethod(e.method),
      ref: e.ref ? String(e.ref) : undefined,
      module: 'Hospital',
    })
  }

  for (const j of expensePayJournals as any[]) {
    const receiver = (() => {
      try {
        const lines = Array.isArray(j.lines) ? j.lines : []
        for (const l of lines) {
          const r = l?.tags?.receiver
          if (r) return String(r)
        }
      } catch {}
      return ''
    })()

    const supplierName = (() => {
      try {
        const lines = Array.isArray(j.lines) ? j.lines : []
        for (const l of lines) {
          const v = l?.tags?.supplierName
          if (v) return String(v)
        }
      } catch {}
      return ''
    })()

    const invoiceNo = (() => {
      try {
        const lines = Array.isArray(j.lines) ? j.lines : []
        for (const l of lines) {
          const v = l?.tags?.invoiceNo
          if (v) return String(v)
        }
      } catch {}
      return ''
    })()

    const creditLine = (Array.isArray(j.lines) ? j.lines : []).find((l: any) => Number(l?.credit || 0) > 0)
    const amount = creditLine ? Number(creditLine.credit || 0) : 0

    txns.push({
      id: String(j._id),
      datetime: `${String(j.dateIso || '').slice(0, 10)}T00:00:00.000Z`,
      type: 'Expense',
      description: receiver ? `Salary — ${receiver}` : String(j.memo || 'Expense payment'),
      staff: receiver || undefined,
      transBy: j.createdBy ? String(j.createdBy) : undefined,
      supplierName: supplierName || undefined,
      invoiceNo: invoiceNo || undefined,
      amount: -Math.abs(Number(amount || 0) || 0),
      method: normalizeMethod('bank'),
      ref: String(j.refId || ''),
      module: 'Finance',
    })
  }

  for (const b of billingItems as any[]) {
    txns.push({
      id: String(b._id || b.id),
      datetime: safeIso(b.date || b.createdAt),
      type: 'Charge',
      description: String(b.description || 'IPD charge'),
      amount: Number(b.amount || 0) || 0,
      ref: b.encounterId ? String(b.encounterId) : undefined,
      module: 'IPD',
    })
  }

  for (const p of ipdPayments as any[]) {
    txns.push({
      id: String(p._id || p.id),
      datetime: safeIso(p.receivedAt || p.createdAt),
      type: 'IPD',
      description: 'IPD payment',
      amount: Number(p.amount || 0) || 0,
      method: normalizeMethod(p.method),
      ref: p.refNo ? String(p.refNo) : (p.encounterId ? String(p.encounterId) : undefined),
      module: 'IPD',
    })
  }

  for (const j of payoutRows as any[]) {
    const docName = doctorById.get(String(j.refId || '')) || ''
    const cash = (j.lines || [])
      .filter((l: any) => l.account === 'CASH' || l.account === 'BANK')
      .reduce((s: number, l: any) => s + (l.credit || 0), 0)
    const amount = cash || (j.lines || [])
      .filter((l: any) => l.account === 'DOCTOR_PAYABLE')
      .reduce((s: number, l: any) => s + (l.debit || 0), 0)

    txns.push({
      id: String(j._id),
      datetime: `${String(j.dateIso || '').slice(0, 10)}T00:00:00.000Z`,
      type: 'Expense',
      description: `Doctor payout${docName ? ' — ' + docName : ''}`,
      transBy: j.createdBy ? String(j.createdBy) : undefined,
      amount: -Math.abs(Number(amount || 0) || 0),
      method: normalizeMethod((j.lines || []).some((l: any) => l.account === 'BANK') ? 'bank' : 'cash'),
      ref: String(j.refId || ''),
      module: 'Finance',
    })
  }

  const items = txns
    .filter(x => x && x.id && x.datetime)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, limit)

  res.json({ items })
}
