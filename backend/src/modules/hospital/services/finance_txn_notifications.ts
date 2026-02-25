import { HospitalUser } from '../models/User'
import { PettyCashAccount } from '../models/PettyCashAccount'
import { BankAccount } from '../models/BankAccount'
import { FinanceAccount } from '../models/FinanceAccount'
import { createUserNotification } from './user_notifications'

function fmtUserLabel(actor: { fullName?: string; username?: string; role?: string } | null | undefined) {
  const name = String(actor?.fullName || actor?.username || '').trim()
  const role = String(actor?.role || '').trim()
  if (!name) return role ? `-${role}` : ''
  return role ? `${name}-${role}` : name
}

async function resolveUserIdByUsername(username: string) {
  const key = String(username || '').trim().toLowerCase()
  if (!key) return ''
  const u: any = await HospitalUser.findOne({ username: key }).select({ _id: 1 }).lean()
  return u?._id ? String(u._id) : ''
}

async function resolveResponsibleUsernameForAccountCode(accountCode: string) {
  const code = String(accountCode || '').trim().toUpperCase()
  if (!code) return ''

  // Petty cash accounts use code as their finance account code.
  const petty: any = await PettyCashAccount.findOne({ code }).select({ responsibleStaff: 1 }).lean()
  if (petty?.responsibleStaff) return String(petty.responsibleStaff)

  // Bank accounts have financeAccountCode (preferred) or derived BANK_xxxx.
  const bank: any = await BankAccount.findOne({ financeAccountCode: code }).select({ responsibleStaff: 1, accountNumber: 1 }).lean()
  if (bank?.responsibleStaff) return String(bank.responsibleStaff)

  // Fallback: finance accounts table
  const fa: any = await FinanceAccount.findOne({ code }).select({ responsibleStaff: 1 }).lean()
  if (fa?.responsibleStaff) return String(fa.responsibleStaff)

  return ''
}

export async function notifyAdminTransaction(params: {
  actorUserId: string
  actorRole?: string
  fromAccountCode: string
  toAccountCode: string
  amount: number
  refType: string
  txId?: string
  memo?: string
}) {
  const actorRole = String(params.actorRole || '')
  if (actorRole !== 'Admin') return

  const actorId = String(params.actorUserId || '')
  if (!actorId) return

  const actor: any = await HospitalUser.findById(actorId).select({ username: 1, fullName: 1, role: 1 }).lean()
  const actorLabel = fmtUserLabel(actor)

  const fromCode = String(params.fromAccountCode || '').trim().toUpperCase()
  const toCode = String(params.toAccountCode || '').trim().toUpperCase()
  if (!fromCode || !toCode) return

  const [fromUsername, toUsername] = await Promise.all([
    resolveResponsibleUsernameForAccountCode(fromCode),
    resolveResponsibleUsernameForAccountCode(toCode),
  ])

  const [fromUserId, toUserId] = await Promise.all([
    resolveUserIdByUsername(fromUsername),
    resolveUserIdByUsername(toUsername),
  ])

  const amt = Number(params.amount || 0)
  const txId = String(params.txId || '')
  const memo = String(params.memo || '')

  const basePayload = {
    refType: params.refType,
    txId: txId || undefined,
    fromAccountCode: fromCode,
    toAccountCode: toCode,
    amount: amt,
    memo: memo || undefined,
    actor: actor ? { id: actorId, username: actor.username, fullName: actor.fullName, role: actor.role } : { id: actorId },
  }

  const title = 'Admin Transaction'

  // Receiver notification
  if (toUserId) {
    await createUserNotification({
      userId: toUserId,
      type: 'finance',
      title,
      message: `You received Rs. ${amt} in ${toCode} from ${fromCode} by ${actorLabel || 'Admin'}.`,
      payload: { ...basePayload, side: 'receiver' },
    })
  }

  // Sender notification
  if (fromUserId && fromUserId !== toUserId) {
    await createUserNotification({
      userId: fromUserId,
      type: 'finance',
      title,
      message: `Rs. ${amt} was sent from ${fromCode} to ${toCode} by ${actorLabel || 'Admin'}.`,
      payload: { ...basePayload, side: 'sender' },
    })
  }
}
