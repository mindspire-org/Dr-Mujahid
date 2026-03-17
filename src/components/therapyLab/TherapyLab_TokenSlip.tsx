import { useEffect, useRef, useState } from 'react'

export type TherapyLabTokenSlipData = {
  tokenNo: string
  patientName: string
  phone?: string
  age?: string
  gender?: string
  mrn?: string
  guardianRel?: string
  guardianName?: string
  cnic?: string
  address?: string
  tests: Array<{ name: string; details?: any }>
  subtotal: number
  discount: number
  discountType?: 'PKR' | '%'
  payable: number
  amountReceived?: number
  payPreviousDues?: boolean
  useAdvance?: boolean
  advanceApplied?: number
  duesBefore?: number
  advanceBefore?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
  paymentStatus?: 'paid' | 'unpaid'
  receptionistName?: string
  receivedToAccountCode?: string
  paymentMethod?: string
  accountNumberIban?: string
  createdAt?: string
}

let settingsCache: any | null = null

function getCurrentUser() {
  try {
    const s = localStorage.getItem('therapyLab.session') || localStorage.getItem('hospital.session')
    if (s) return (JSON.parse(s)?.username || JSON.parse(s)?.name || '').toString()
  } catch {}
  return 'admin'
}

export default function TherapyLab_TokenSlip({
  open,
  onClose,
  data,
  autoPrint = false,
  user,
}: {
  open: boolean
  onClose: () => void
  data: TherapyLabTokenSlipData
  autoPrint?: boolean
  user?: string
}) {
  const [settings, setSettings] = useState({ name: 'Therapy & Lab', phone: '', address: '', logoDataUrl: '', slipFooter: 'Powered by Hospital MIS' })
  const [payToNameMap, setPayToNameMap] = useState<Record<string, string>>({})
  const printedRef = useRef(false)

  useEffect(() => {
    printedRef.current = false
  }, [open])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!settingsCache) {
          const raw = localStorage.getItem('hospital.settings')
          settingsCache = raw ? JSON.parse(raw) : null
        }
        if (!cancelled && settingsCache) {
          const s = settingsCache
          setSettings({
            name: String(s?.name || 'Therapy & Lab'),
            phone: String(s?.phone || ''),
            address: String(s?.address || ''),
            logoDataUrl: String(s?.logoDataUrl || ''),
            slipFooter: String(s?.slipFooter || 'Powered by Hospital MIS'),
          })
        }
      } catch {}
    }
    if (open) load()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    let cancelled = false
    async function loadPayTo() {
      try {
        const rawSess = localStorage.getItem('hospital.session')
        const hApi = (await import('../../utils/api')).hospitalApi
        const [bankRes, pettyRes] = await Promise.all([
          hApi.listBankAccounts(),
          hApi.listPettyCashAccounts(),
        ]) as any
        const map: Record<string, string> = {}
        const add = (code?: string, nameOnly?: string) => {
          const c = String(code || '').trim().toUpperCase()
          if (!c) return
          const nm = String(nameOnly || '').trim()
          if (!nm) return
          map[c] = nm
        }

        const petty: any[] = pettyRes?.accounts || []
        for (const p of petty) {
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code) continue
          if (String(p?.status || 'Active') !== 'Active') continue
          add(code, String(p?.name || code).trim())
        }

        const banks: any[] = bankRes?.accounts || []
        for (const b of banks) {
          const an = String(b?.accountNumber || '')
          const last4 = an ? an.slice(-4) : ''
          const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
          if (!code) continue
          const bankLabel = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}${last4 ? ` (${last4})` : ''}`.trim()
          add(code, bankLabel || code)
        }

        if (!cancelled) setPayToNameMap(map)
      } catch {
        if (!cancelled) setPayToNameMap({})
      }
    }
    if (open) loadPayTo()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open || !autoPrint || printedRef.current) return
    const t = setTimeout(() => {
      window.print()
      printedRef.current = true
    }, 300)
    return () => clearTimeout(t)
  }, [open, autoPrint, settings.name, settings.address, settings.phone, settings.logoDataUrl, settings.slipFooter])

  if (!open) return null
  const dt = data.createdAt ? new Date(data.createdAt) : new Date()
  const receivedCode = String(data.receivedToAccountCode || '').trim().toUpperCase()
  const payedToName = (receivedCode && payToNameMap[receivedCode]) ? payToNameMap[receivedCode] : (data.receptionistName || '')

  const clamp0 = (n: any) => Math.max(0, Number(n || 0))
  const payable = Math.max(0, Number(data.payable || 0))
  const isUnpaid = String(data.paymentStatus || 'paid').toLowerCase() === 'unpaid'

  const paidNowSimple = isUnpaid ? 0 : clamp0(data.amountReceived)
  const remainingSimple = Math.max(0, payable - paidNowSimple)

  const computed = (() => {
    const duesBefore = clamp0(data.duesBefore)
    const advanceBefore = clamp0(data.advanceBefore)
    const payPreviousDues = isUnpaid ? false : !!data.payPreviousDues
    const useAdvance = isUnpaid ? false : !!data.useAdvance
    let amountReceived = isUnpaid ? 0 : clamp0(data.amountReceived)
    const net = clamp0(payable)

    if (data.duesAfter != null || data.advanceAfter != null || data.duesPaid != null || data.paidForToday != null || data.advanceAdded != null) {
      const advanceApplied = clamp0(data.advanceApplied)
      const paidForToday = clamp0(data.paidForToday)
      const paidToday = isUnpaid ? 0 : Math.min(net, paidForToday + advanceApplied)
      return {
        duesBefore,
        advanceBefore,
        payPreviousDues,
        useAdvance,
        advanceApplied,
        amountReceived,
        duesPaid: clamp0(data.duesPaid),
        paidForToday,
        advanceAdded: clamp0(data.advanceAdded),
        duesAfter: clamp0(data.duesAfter),
        advanceAfter: clamp0(data.advanceAfter),
        paidToday,
        remaining: Math.max(0, net - paidToday),
      }
    }

    let advanceApplied = 0
    let duesPaid = 0
    let paidForToday = 0
    let advanceAdded = 0
    let duesAfter = duesBefore
    let advanceAfter = advanceBefore
    let amt = amountReceived

    if (payPreviousDues) {
      duesPaid = Math.min(duesAfter, amt)
      duesAfter = Math.max(0, duesAfter - duesPaid)
      amt -= duesPaid
    }

    if (useAdvance) {
      advanceApplied = Math.min(advanceAfter, Math.max(0, net - paidForToday))
      advanceAfter = Math.max(0, advanceAfter - advanceApplied)
      paidForToday += advanceApplied
    }

    const paidNow = Math.min(Math.max(0, net - paidForToday), amt)
    paidForToday += paidNow
    amt -= paidNow
    if (amt > 0) {
      advanceAdded = amt
      advanceAfter += advanceAdded
      amt = 0
    }

    const paidToday = isUnpaid ? 0 : Math.min(net, paidForToday)
    return {
      duesBefore,
      advanceBefore,
      payPreviousDues,
      useAdvance,
      advanceApplied,
      amountReceived,
      duesPaid,
      paidForToday,
      advanceAdded,
      duesAfter,
      advanceAfter,
      paidToday,
      remaining: Math.max(0, net - paidToday),
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 print:bg-white print:static">
      <div
        id="therapy-receipt"
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow print:shadow-none print:border-0 print:w-[300px]"
      >
        <div className="overflow-y-auto p-4 print:overflow-visible print:p-4">
          <div className="text-center">
            {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="logo" className="mx-auto mb-2 h-10 w-10 object-contain" />}
            <div className="text-lg font-extrabold leading-tight">{settings.name}</div>
            <div className="text-xs text-slate-600 print:text-black">{settings.address}</div>
            {settings.phone && <div className="text-xs text-slate-600 print:text-black">Mobile #: {settings.phone}</div>}
          </div>

          <hr className="my-2 border-dashed" />
          <div className="text-center text-sm font-semibold underline">Therapy Token</div>

          <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-slate-700">
            <div>User: {user || getCurrentUser()}</div>
            <div>
              {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
            </div>
          </div>

          <hr className="my-2 border-dashed" />

          <div className="space-y-1 text-sm text-slate-800">
            <Row label="Patient Name:" value={data.patientName || '-'} />
            <Row label="Mobile #:" value={data.phone || '-'} boldValue />
            {data.mrn && <Row label="MR #:" value={data.mrn} />}
            {data.age && <Row label="Age:" value={data.age} />}
            {data.gender && <Row label="Sex:" value={data.gender} />}
            {(data.guardianName || data.guardianRel) && (
              <Row label="Guardian:" value={`${data.guardianRel ? data.guardianRel + ' ' : ''}${data.guardianName || ''}`.trim()} />
            )}
            {data.cnic && <Row label="CNIC:" value={data.cnic} />}
            {data.address && <Row label="Address:" value={data.address} />}
          </div>

          <div className="my-3 rounded border border-slate-800 p-3 text-center text-xl font-extrabold tracking-widest">{data.tokenNo}</div>

          <div className="mb-2 text-sm font-semibold">Machines</div>
          <div className="mb-2 divide-y divide-slate-200 text-sm">
            {data.tests.map((t, i) => {
              const details = t.details || {}
              const selectedTypes: string[] = []
              
              // Handle fixed machine types
              Object.entries(details).forEach(([key, val]) => {
                if (val === true) selectedTypes.push(key.toUpperCase())
                else if (key === 'note' && val) selectedTypes.push(String(val))
              })

              // Handle custom machine types (checks/fields)
              if (details.checks) {
                Object.entries(details.checks).forEach(([key, val]) => {
                  if (val === true) selectedTypes.push(key)
                })
              }
              if (details.fields) {
                Object.entries(details.fields).forEach(([key, val]) => {
                  if (val) selectedTypes.push(`${key}: ${val}`)
                })
              }

              const typeStr = selectedTypes.length > 0 ? ` - ${selectedTypes.join(', ')}` : ''

              return (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="test-item-name">{t.name}{typeStr}</div>
                </div>
              )
            })}
          </div>

          <div className="space-y-1 text-sm text-slate-800">
            <Row label="Total Amount:" value={`PKR ${data.subtotal.toLocaleString()}`} />
            <Row 
              label="Discount:" 
              value={data.discountType === '%' 
                ? `${data.discount}% (PKR ${(data.subtotal * data.discount / 100).toLocaleString()})` 
                : `PKR ${Number(data.discount || 0).toLocaleString()}`
              } 
            />
            <Row label="Payable:" value={`PKR ${payable.toLocaleString()}`} boldValue />
            <Row label="Paid:" value={`PKR ${paidNowSimple.toLocaleString()}`} />
            <Row label="Remaining:" value={`PKR ${remainingSimple.toLocaleString()}`} />
            <Row label="Pay. Status:" value={String(data.paymentStatus || 'paid').toUpperCase()} />
            {payedToName && <Row label="Payed to:" value={payedToName} />}
            {data.paymentMethod && <Row label="Pay. Method:" value={data.paymentMethod} />}
            {data.accountNumberIban && <Row label="Account#/IBAN:" value={data.accountNumberIban} />}
          </div>

          {(!isUnpaid ||
            data.amountReceived != null ||
            data.duesBefore != null ||
            data.advanceBefore != null ||
            data.duesAfter != null ||
            data.advanceAfter != null ||
            data.advanceApplied != null) && (
            <>
              <hr className="my-2 border-dashed" />
              <div className="mb-1 text-sm font-semibold">Payment Summary</div>
              <div className="space-y-1 text-sm text-slate-800">
                <Row label="Prev. Dues:" value={`PKR ${computed.duesBefore.toLocaleString()}`} />
                <Row label="Prev. Adv.:" value={`PKR ${computed.advanceBefore.toLocaleString()}`} />
                {computed.useAdvance && computed.advanceApplied > 0 && <Row label="Adv. Used:" value={`PKR ${computed.advanceApplied.toLocaleString()}`} />}
                <Row label="Received Now:" value={`PKR ${computed.amountReceived.toLocaleString()}`} boldValue />
                <Row label="Dues After:" value={`PKR ${computed.duesAfter.toLocaleString()}`} />
                <Row label="Adv. After:" value={`PKR ${computed.advanceAfter.toLocaleString()}`} />
              </div>
            </>
          )}

          {(!isUnpaid ||
            data.payPreviousDues != null ||
            data.useAdvance != null ||
            data.duesPaid != null ||
            data.paidForToday != null ||
            data.advanceAdded != null) && (
            <>
              <hr className="my-2 border-dashed" />
              <div className="mb-1 text-sm font-semibold">Payment Details</div>
              <div className="space-y-1 text-sm text-slate-800">
                {computed.payPreviousDues && <Row label="Pay Prev. Dues:" value="YES" />}
                {computed.useAdvance && <Row label="Use Adv.:" value="YES" />}
                <Row label="Dues Paid:" value={`PKR ${computed.duesPaid.toLocaleString()}`} />
                <Row label="Paid For Today:" value={`PKR ${computed.paidForToday.toLocaleString()}`} />
                <Row label="Adv. Added:" value={`PKR ${computed.advanceAdded.toLocaleString()}`} />
              </div>
            </>
          )}

          <hr className="my-2 border-dashed" />
          <div className="text-center text-[11px] text-slate-600 print:text-black">{settings.slipFooter}</div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white p-3 print:hidden">
          <button onClick={() => window.print()} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white">
            Print
          </button>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        #therapy-receipt { font-family: 'Poppins', Arial, sans-serif }
        @media print {
          @page { size: 58mm auto; margin: 0 }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
          body * { visibility: hidden !important }
          #therapy-receipt, #therapy-receipt * { visibility: visible !important }
          #therapy-receipt { position: absolute !important; left: 0; right: 0; top: 0; margin: 0 auto !important; padding: 10px 10px 0 10px !important; width: 300px !important; box-sizing: border-box !important; line-height: 1.45; overflow: visible !important; z-index: 2147483647; font-size: 14px !important }
          #therapy-receipt, #therapy-receipt * { color: #000 !important }
          .print\\:hidden { display: none !important }
          #therapy-receipt .text-xs{ font-size: 13px !important }
          #therapy-receipt .text-sm{ font-size: 14px !important }
          #therapy-receipt .text-lg{ font-size: 18px !important }
          #therapy-receipt .text-xl{ font-size: 20px !important }
          #therapy-receipt .row-value{ word-break: break-word !important; white-space: normal !important; text-align: right !important; place-self: start end !important }
          #therapy-receipt .test-item-name{ max-width: 64% !important; word-break: break-word !important; white-space: normal !important }
          hr { border-color: #000 !important }
        }
      `}</style>
    </div>
  )
}

function Row({ label, value, boldValue }: { label: string; value: string; boldValue?: boolean }) {
  return (
    <div className="grid w-full grid-cols-[110px_1fr] gap-2">
      <div className="text-slate-700">{label}</div>
      <div className={`${boldValue ? 'font-semibold ' : ''}row-value min-w-0 break-words text-right justify-self-end`}>{value}</div>
    </div>
  )
}
