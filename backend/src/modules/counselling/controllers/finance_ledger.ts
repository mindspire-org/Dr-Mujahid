import { Types } from 'mongoose'
import { FinanceJournal, JournalLine } from '../../hospital/models/FinanceJournal'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function toOid(id?: string) {
  try { return id ? new Types.ObjectId(id) : undefined } catch { return undefined }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export async function postCounsellingTokenJournal(args: {
  orderId: string;
  dateIso: string;
  net: number;
  amountReceived: number;
  patientId?: string;
  patientName?: string;
  mrn?: string;
  tokenNo?: string;
  paymentMethod?: 'Cash' | 'Card';
  receivedToAccountCode?: string;
  createdBy?: string;
}) {
  // Idempotency: avoid duplicate posting for same order
  const existing = await FinanceJournal.findOne({ refType: 'counselling_token', refId: args.orderId }).lean()
  if (existing) return existing as any

  const net = round2(args.net || 0)
  const received = round2(args.amountReceived || 0)
  const receivedTo = String(args.receivedToAccountCode || '').trim().toUpperCase()
  
  // Account mapping
  const debitAccount = receivedTo || (args.paymentMethod === 'Card' ? 'BANK' : 'CASH')
  
  const tagsBase: any = {}
  if (args.orderId) tagsBase.orderId = toOid(args.orderId)
  if (args.patientId) tagsBase.patientId = toOid(args.patientId)
  if (args.patientName) tagsBase.patientName = args.patientName
  if (args.mrn) tagsBase.mrn = args.mrn
  if (args.createdBy) tagsBase.createdBy = args.createdBy

  const lines: JournalLine[] = []

  // If payment received, debit the account (CASH/BANK/PettyCash) and credit REVENUE or AR
  if (received > 0) {
    lines.push({ account: debitAccount, debit: received, tags: { ...tagsBase } })
    lines.push({ account: 'COUNSELLING_REVENUE', credit: received, tags: { ...tagsBase } })
  }

  // If there's a remaining balance (unpaid), it goes to AR (Accounts Receivable)
  const balance = round2(net - received)
  if (balance > 0) {
    lines.push({ account: 'AR_COUNSELLING', debit: balance, tags: { ...tagsBase } })
    lines.push({ account: 'COUNSELLING_REVENUE', credit: balance, tags: { ...tagsBase } })
  }

  if (lines.length === 0) return null

  const memo = `Counselling Token ${args.tokenNo ? ('#' + args.tokenNo) : ''}`.trim()
  return await FinanceJournal.create({
    dateIso: args.dateIso || todayIso(),
    createdBy: args.createdBy,
    refType: 'counselling_token',
    refId: args.orderId,
    memo,
    lines
  })
}
