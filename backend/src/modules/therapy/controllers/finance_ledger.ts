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

export async function postTherapyTokenJournal(args: {
  visitId: string;
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
  console.log('postTherapyTokenJournal called with:', JSON.stringify(args, null, 2));
  
  // Idempotency: avoid duplicate posting for same visit
  const existing = await FinanceJournal.findOne({ refType: 'therapy_token', refId: args.visitId }).lean()
  if (existing) {
    console.log('Existing journal found for therapy_token:', (existing as any)._id);
    return existing as any
  }

  const net = round2(args.net || 0)
  const received = round2(args.amountReceived || 0)
  const receivedTo = String(args.receivedToAccountCode || '').trim().toUpperCase()
  
  // Account mapping
  const debitAccount = receivedTo || (args.paymentMethod === 'Card' ? 'BANK' : 'CASH')
  console.log('Debit Account resolved to:', debitAccount);
  
  const tagsBase: any = {}
  if (args.visitId) tagsBase.visitId = toOid(args.visitId)
  if (args.patientId) tagsBase.patientId = toOid(args.patientId)
  if (args.patientName) tagsBase.patientName = args.patientName
  if (args.mrn) tagsBase.mrn = args.mrn
  if (args.createdBy) tagsBase.createdBy = args.createdBy

  const lines: JournalLine[] = []

  // If payment received, debit the account (CASH/BANK/PettyCash) and credit REVENUE
  if (received > 0) {
    lines.push({ account: debitAccount, debit: received, tags: { ...tagsBase } })
    lines.push({ account: 'THERAPY_REVENUE', credit: received, tags: { ...tagsBase } })
  }

  // If there's a remaining balance (unpaid), it goes to AR (Accounts Receivable)
  const balance = round2(net - received)
  if (balance > 0) {
    lines.push({ account: 'AR_THERAPY', debit: balance, tags: { ...tagsBase } })
    lines.push({ account: 'THERAPY_REVENUE', credit: balance, tags: { ...tagsBase } })
  }

  if (lines.length === 0) {
    console.log('No journal lines to create (net and received are 0)');
    return null
  }

  console.log('Creating journal with lines:', JSON.stringify(lines, null, 2));

  const memo = `Therapy Token ${args.tokenNo ? ('#' + args.tokenNo) : ''}`.trim()
  const journal = await FinanceJournal.create({
    dateIso: args.dateIso || todayIso(),
    createdBy: args.createdBy,
    refType: 'therapy_token',
    refId: args.visitId,
    memo,
    lines
  })
  
  console.log('Journal created successfully in DB:', journal._id);
  return journal
}
