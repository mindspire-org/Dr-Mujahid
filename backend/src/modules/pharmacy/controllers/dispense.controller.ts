import { Request, Response } from 'express'
import { Dispense } from '../models/Dispense'
import { dispenseCreateSchema, salesQuerySchema } from '../validators/dispense'
import { InventoryItem } from '../models/InventoryItem'
import { AuditLog } from '../models/AuditLog'
import { Settings } from '../models/Settings'
import { PharmacyAccount } from '../models/PharmacyAccount'
import { FinanceJournal } from '../../hospital/models/FinanceJournal'
import mongoose from 'mongoose'

const clamp0 = (n: any) => Math.max(0, Number(n || 0))

async function ensureAccount(customerId: string, snap?: { mrn?: string; fullName?: string; phone?: string }) {
  const nowIso = new Date().toISOString()
  const doc = await PharmacyAccount.findOneAndUpdate(
    { customerId },
    {
      $setOnInsert: { customerId, dues: 0, advance: 0 },
      $set: { mrn: snap?.mrn, fullName: snap?.fullName, phone: snap?.phone, updatedAtIso: nowIso },
    },
    { upsert: true, new: true }
  ).lean()
  return { dues: clamp0((doc as any)?.dues), advance: clamp0((doc as any)?.advance) }
}

function parseDateForRange(input?: string, endOfDay?: boolean) {
  if (!input) return undefined
  const s = String(input)
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (dateOnly) {
    const [y, m, d] = s.split('-').map(n => Number(n))
    const dt = new Date(
      y,
      (m || 1) - 1,
      d || 1,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    )
    return isNaN(dt.getTime()) ? undefined : dt
  }
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return undefined
  if (endOfDay) {
    const hasTime = /T\d{2}:\d{2}/.test(s)
    if (!hasTime) dt.setHours(23, 59, 59, 999)
  }
  return dt
}

function todayKey(){
  const d = new Date()
  const y = String(d.getFullYear()).slice(2)
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}${m}${day}`
}

export async function create(req: Request, res: Response){
  const data = dispenseCreateSchema.parse(req.body)
  const datetime = new Date().toISOString()
  const key = todayKey()
  const countToday = await Dispense.countDocuments({ billNo: new RegExp(`^B-${key}-`) })
  const billNo = `B-${key}-${String(countToday+1).padStart(3,'0')}`
  const subtotal = data.lines.reduce((s: number, l: { unitPrice: number; qty: number })=> s + l.unitPrice*l.qty, 0)
  const lineDiscount = Number((data as any).lineDiscountTotal || 0)
  const billDiscount = ((Math.max(0, subtotal - lineDiscount)) * (data.discountPct || 0)) / 100
  let taxPct = 0
  try {
    const st: any = await Settings.findOne().lean()
    taxPct = Math.max(0, Math.min(100, Number(st?.taxRate || 0)))
  } catch {}
  const taxableBase = Math.max(0, subtotal - lineDiscount - billDiscount)
  const taxAmount = taxableBase * (taxPct / 100)
  const total = subtotal - lineDiscount - billDiscount + taxAmount
  const linesWithCost: any[] = []
  let profit = 0
  for (const line of data.lines){
    let item: any = null
    const id = String(line.medicineId || '').trim()
    const name = String(line.name || '').trim()
    if (id && mongoose.isValidObjectId(id)) item = await InventoryItem.findById(id).lean()
    if (!item && name) item = await InventoryItem.findOne({ key: name.toLowerCase() }).lean()
    if (!item && id) item = await InventoryItem.findOne({ lastMedicineId: id }).lean()
    const costPerUnit = Number(item?.avgCostPerUnit || item?.lastBuyPerUnitAfterTax || item?.lastBuyPerUnit || 0)
    linesWithCost.push({ ...line, costPerUnit, discountRs: Number((line as any)?.discountRs||0) })
    profit += (Number(line.unitPrice||0) - costPerUnit) * Number(line.qty||0)
  }
  // subtract discount from profit (discount reduces revenue)
  profit -= Number(lineDiscount || 0)
  profit -= Number(billDiscount || 0)
  // tax does not change profit here (it is collected and later paid to govt)
  const doc = await Dispense.create({
    datetime,
    billNo,
    customerId: (data as any).customerId || undefined,
    customer: data.customer || 'Walk-in',
    mrn: String((data as any).mrn || '').trim() || undefined,
    phone: String((data as any).phone || '').trim() || undefined,
    age: String((data as any).age || '').trim() || undefined,
    gender: String((data as any).gender || '').trim() || undefined,
    guardianRel: String((data as any).guardianRel || '').trim() || undefined,
    guardianName: String((data as any).guardianName || '').trim() || undefined,
    cnic: String((data as any).cnic || '').trim() || undefined,
    address: String((data as any).address || '').trim() || undefined,
    paymentStatus: (data as any).paymentStatus || 'paid',
    accountCode: String((data as any).accountCode || '').trim() || undefined,
    paymentMethodDetail: String((data as any).paymentMethodDetail || '').trim() || undefined,
    amountReceivedNow: Number((data as any).amountReceivedNow || 0),
    duesBefore: Number((data as any).duesBefore || 0),
    advanceBefore: Number((data as any).advanceBefore || 0),
    advanceApplied: Number((data as any).advanceApplied || 0),
    duesPaid: Number((data as any).duesPaid || 0),
    paidForToday: Number((data as any).paidForToday || 0),
    advanceAdded: Number((data as any).advanceAdded || 0),
    duesAfter: Number((data as any).duesAfter || 0),
    advanceAfter: Number((data as any).advanceAfter || 0),
    payment: data.payment,
    discountPct: data.discountPct || 0,
    lineDiscountTotal: lineDiscount,
    taxPct: Number(taxPct.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    lines: linesWithCost,
    profit: Number(profit.toFixed(2)),
    createdBy: String((data as any)?.createdBy || '').trim() || undefined,
  })

  for (const line of data.lines){
    try {
      const id = String(line.medicineId || '').trim()
      const name = String(line.name || '').trim()
      let item: any = null
      if (id && mongoose.isValidObjectId(id)){
        item = await InventoryItem.findById(id)
      }
      if (!item && name){
        const key = name.toLowerCase()
        item = await InventoryItem.findOne({ key })
      }
      if (!item && id){
        item = await InventoryItem.findOne({ lastMedicineId: id })
      }
      if (!item) continue
      const dec = Number(line.qty || 0)
      item.onHand = Math.max(0, Number(item.onHand || 0) - dec)
      if (line.unitPrice != null) {
        item.lastSalePerUnit = Number(line.unitPrice)
      }
      await item.save()
    } catch (e) {
    }
  }
  try {
    const actor = String((data as any)?.createdBy || (req as any).user?.name || (req as any).user?.email || 'system')
    await AuditLog.create({
      actor,
      action: 'Sale',
      label: 'SALE',
      method: 'POST',
      path: req.originalUrl,
      at: new Date().toISOString(),
      detail: `Bill ${doc.billNo} — ${doc.customer} — Rs ${Number(doc.total||0).toFixed(2)}`,
    })
  } catch {}

  // Update PharmacyAccount (dues/advance) — mirrors DiagnosticAccount update
  const customerId = String((data as any).customerId || '').trim()
  const mrn = String((data as any).mrn || '').trim()
  const fullName = String(data.customer || '').trim()
  const phone = String((data as any).phone || '').trim()
  const duesAfterVal = clamp0((data as any).duesAfter)
  const advanceAfterVal = clamp0((data as any).advanceAfter)
  // Use mrn as key if no customerId — always update if we have any identifier
  const accountKey = customerId || mrn || phone || (fullName && fullName !== 'Walk-in' ? fullName : '')
  if (accountKey) {
    try {
      await PharmacyAccount.findOneAndUpdate(
        { customerId: accountKey },
        {
          $setOnInsert: { customerId: accountKey },
          $set: {
            mrn: mrn || undefined,
            fullName: (fullName && fullName !== 'Walk-in') ? fullName : undefined,
            phone: phone || undefined,
            dues: duesAfterVal,
            advance: advanceAfterVal,
            updatedAtIso: new Date().toISOString(),
          },
        },
        { upsert: true }
      )
    } catch (e) {
      console.warn('PharmacyAccount update failed:', e)
    }
  }

  // Finance journal — mirrors diagnostic order journal
  // Split: amountReceivedNow → debit petty cash, remaining dues → debit AR
  try {
    const paymentStatus = String((data as any).paymentStatus || 'paid')
    const accountCode = String((data as any).accountCode || '').trim().toUpperCase()
    const paymentMethodDetail = String((data as any).paymentMethodDetail || '').toUpperCase()
    const paidMethod = paymentMethodDetail === 'CARD' ? 'Bank' : 'Cash'
    const cashAccount = accountCode || (paidMethod === 'Bank' ? 'BANK' : 'CASH')
    const totalAmt = Number(doc.total || 0)
    const amountReceived = paymentStatus === 'unpaid' ? 0 : clamp0((data as any).amountReceivedNow)
    const duesAfterAmt = clamp0((data as any).duesAfter)
    const createdByStr = String((data as any)?.createdBy || '').trim()
    const oidRe = /^[a-f0-9]{24}$/i
    const journalCreatedBy = oidRe.test(createdByStr) ? createdByStr : undefined
    const memo = `Pharmacy Sale ${doc.billNo}${fullName ? ` — ${fullName}` : ''}${createdByStr && !oidRe.test(createdByStr) ? ` (${createdByStr})` : ''}`.trim()

    if (totalAmt > 0) {
      const lines: Array<{ account: string; debit?: number; credit?: number }> = []

      // Credit revenue first (so it appears as the primary counterparty in petty cash view)
      lines.push({ account: 'PHARMACY_REVENUE', credit: totalAmt })
      // Cash received → debit petty/bank account
      if (amountReceived > 0 && cashAccount) {
        lines.push({
          account: cashAccount,
          debit: amountReceived,
          tags: {
            createdBy: createdByStr || undefined,
            refType: 'pharmacy_sale',
            patientName: String((data as any).customer || '').trim() || undefined,
            mrn: String((data as any).mrn || '').trim() || undefined,
          },
        })
      }
      // Remaining unpaid → debit AR
      if (duesAfterAmt > 0) {
        lines.push({ account: 'AR', debit: duesAfterAmt })
      }
      // If fully unpaid (no amount received) → debit AR for full amount
      if (amountReceived === 0 && duesAfterAmt === 0) {
        lines.push({ account: 'AR', debit: totalAmt })
      }

      await FinanceJournal.create({
        dateIso: new Date().toISOString().slice(0, 10),
        createdBy: journalCreatedBy,
        createdByUsername: createdByStr && !oidRe.test(createdByStr) ? createdByStr : undefined,
        refType: 'pharmacy_sale',
        refId: String((doc as any)._id),
        memo,
        lines,
      })
    }
  } catch (e) {
    console.warn('Finance journal failed for pharmacy sale', e)
  }

  res.status(201).json(doc)
}

export async function list(req: Request, res: Response){
  const parsed = salesQuerySchema.safeParse(req.query)
  const { bill, customer, customerId, payment, medicine, user, from, to, page, limit } = parsed.success ? parsed.data : {}
  const filter: any = {}
  if (bill) filter.billNo = new RegExp(bill, 'i')
  if (customer) filter.customer = new RegExp(customer, 'i')
  if (customerId) filter.customerId = customerId
  if (payment && payment !== 'Any') filter.payment = payment
  if (medicine) filter['lines.name'] = new RegExp(medicine, 'i')
  if (user) filter.createdBy = new RegExp(user, 'i')
  const mrnParam = String((req.query as any).mrn || '').trim()
  if (mrnParam) filter.mrn = new RegExp(`^${mrnParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  if (from || to){
    filter.datetime = {}
    const start = parseDateForRange(from, false)
    const end = parseDateForRange(to, true)
    if (start) filter.datetime.$gte = start.toISOString()
    if (end) filter.datetime.$lte = end.toISOString()
  }
  const effectiveLimit = Number(limit || 10)
  const currentPage = Math.max(1, Number(page || 1))
  const skip = (currentPage - 1) * effectiveLimit
  const total = await Dispense.countDocuments(filter)
  const items = await Dispense.find(filter).sort({ datetime: -1 }).skip(skip).limit(effectiveLimit).lean()
  const totalPages = Math.max(1, Math.ceil(total / effectiveLimit))
  res.json({ items, total, page: currentPage, totalPages })
}

export async function summary(req: Request, res: Response){
  const parsed = salesQuerySchema.safeParse(req.query)
  const { payment, from, to } = parsed.success ? parsed.data : {}
  const match: any = {}
  if (payment && payment !== 'Any') match.payment = payment
  if (from || to){
    match.datetime = {}
    const start = parseDateForRange(from, false)
    const end = parseDateForRange(to, true)
    if (start) match.datetime.$gte = start.toISOString()
    if (end) match.datetime.$lte = end.toISOString()
  }
  const agg = await Dispense.aggregate([
    { $match: match },
    { $group: { _id: null, totalAmount: { $sum: { $ifNull: ['$total', 0] } }, totalProfit: { $sum: { $ifNull: ['$profit', 0] } }, count: { $sum: 1 } } }
  ])
  const totalAmount = agg[0]?.totalAmount || 0
  const totalProfit = agg[0]?.totalProfit || 0
  const count = agg[0]?.count || 0
  res.json({ totalAmount: Number(totalAmount.toFixed(2)), totalProfit: Number(totalProfit.toFixed(2)), count })
}
