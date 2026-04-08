import { useEffect, useRef, useState } from 'react'
import { pharmacyApi, hospitalApi } from '../../utils/api'

type Line = { name: string; qty: number; price: number }

type Props = {
  open: boolean
  onClose: () => void
  receiptNo: string
  method: 'cash' | 'credit'
  lines: Line[]
  discountPct?: number
  lineDiscountRs?: number
  customer?: string
  autoPrint?: boolean
  taxPct?: number
  currency?: string
  // Payment details (from process payment dialog)
  accountCode?: string
  paymentMethod?: string
  amountReceivedNow?: number
  createdAt?: string
  payPreviousDues?: boolean
  useAdvance?: boolean
  duesBefore?: number
  advanceBefore?: number
  advanceApplied?: number
  duesPaid?: number
  paidForToday?: number
  advanceAdded?: number
  duesAfter?: number
  advanceAfter?: number
  paymentStatus?: 'paid' | 'unpaid'
}

function clamp0(n: any) {
  const x = Number(n || 0)
  return Number.isFinite(x) ? Math.max(0, x) : 0
}

function getCurrentUser() {
  try {
    const s = localStorage.getItem('pharmacy.user') || localStorage.getItem('hospital.session')
    if (s) return (JSON.parse(s)?.username || JSON.parse(s)?.name || '').toString()
  } catch {}
  return 'admin'
}

function normalizePayToLabel(label?: string) {
  const raw = String(label || '').trim()
  if (!raw) return ''
  const noCode = raw.replace(/\s*\([^)]*\)\s*$/g, '').trim()
  return noCode.split(' - ')[0]?.trim() || noCode
}

export default function Pharmacy_POSReceiptDialog({
  open, onClose, receiptNo, method, lines,
  discountPct = 0, lineDiscountRs = 0, customer,
  autoPrint, taxPct: taxPctOverride, currency: currencyOverride,
  accountCode, paymentMethod, amountReceivedNow, createdAt,
  payPreviousDues, useAdvance, duesBefore = 0, advanceBefore = 0,
  advanceApplied = 0, duesPaid = 0, paidForToday = 0, advanceAdded = 0,
  duesAfter = 0, advanceAfter = 0, paymentStatus = 'paid',
}: Props) {
  const [info, setInfo] = useState({ name: 'PHARMACY', phone: '', address: '', footer: 'Thank you for your purchase!', logo: '' })
  const [sys, setSys] = useState<{ taxRate: number; currency: string }>({ taxRate: 0, currency: 'PKR' })
  const [payToNameMap, setPayToNameMap] = useState<Record<string, string>>({})
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const printedRef = useRef(false)

  useEffect(() => { printedRef.current = false }, [open])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [s, sys] = await Promise.all([pharmacyApi.getSettings(), (pharmacyApi as any).getSystemSettings()])
        if (!mounted) return
        setInfo({
          name: (s as any).pharmacyName || 'PHARMACY',
          phone: (s as any).phone || '',
          address: (s as any).address || '',
          footer: (s as any).billingFooter || 'Thank you for your purchase!',
          logo: (s as any).logoDataUrl || '',
        })
        if (sys) setSys({ taxRate: Number(sys.taxRate || 0), currency: String(sys.currency || 'PKR') })
      } catch {}
      finally { if (mounted) setSettingsLoaded(true) }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const [bankRes, pettyRes] = await Promise.all([
          hospitalApi.listBankAccounts(),
          hospitalApi.listPettyCashAccounts(),
        ]) as any
        const map: Record<string, string> = {}
        const add = (code?: string, name?: string) => {
          const c = String(code || '').trim().toUpperCase()
          if (!c || !name) return
          map[c] = String(name).trim()
        }
        for (const p of (pettyRes?.accounts || [])) {
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code || String(p?.status || 'Active') !== 'Active') continue
          add(code, normalizePayToLabel(String(p?.name || code).trim()))
        }
        for (const b of (bankRes?.accounts || [])) {
          const an = String(b?.accountNumber || '')
          const last4 = an ? an.slice(-4) : ''
          const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
          if (!code) continue
          add(code, normalizePayToLabel(String(b?.bankName || '').trim() || String(b?.accountTitle || '').trim() || code))
        }
        if (!cancelled) setPayToNameMap(map)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open || !autoPrint || !settingsLoaded || printedRef.current) return
    const t = setTimeout(() => { window.print(); printedRef.current = true }, 100)
    return () => clearTimeout(t)
  }, [open, autoPrint, settingsLoaded])

  if (!open) return null

  const taxPct = Math.max(0, Math.min(100, Number((taxPctOverride ?? sys.taxRate) || 0)))
  const currency = String(currencyOverride || sys.currency || 'PKR')
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const lineDisc = clamp0(lineDiscountRs)
  const billDisc = Math.max(0, ((subtotal - lineDisc) * (discountPct || 0)) / 100)
  const tax = (subtotal - lineDisc - billDisc) * (taxPct / 100)
  const total = subtotal - lineDisc - billDisc + tax

  const customerLabel = String(customer || '').trim() || 'Walk-in'
  const dt = createdAt ? new Date(createdAt) : new Date()

  const receivedCode = String(accountCode || '').trim().toUpperCase()
  const payedToName = normalizePayToLabel((receivedCode && payToNameMap[receivedCode]) ? payToNameMap[receivedCode] : '')

  const received = clamp0(amountReceivedNow)
  const remaining = Math.max(0, total - received)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        #pharmacy-receipt { font-family: 'Poppins', Arial, sans-serif }
        @media print {
          @page { size: 58mm auto; margin: 0 }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
          body * { visibility: hidden !important }
          #pharmacy-receipt, #pharmacy-receipt * { visibility: visible !important }
          #pharmacy-receipt { position: absolute !important; left: 0; right: 0; top: 0; margin: 0 auto !important; padding: 10px 10px 0 10px !important; width: 300px !important; box-sizing: border-box !important; line-height: 1.45; overflow: visible !important; z-index: 2147483647; font-size: 14px !important }
          #pharmacy-receipt, #pharmacy-receipt * { color: #000 !important }
          .no-print { display: none !important }
          #pharmacy-receipt .text-xs { font-size: 13px !important }
          #pharmacy-receipt .text-sm { font-size: 14px !important }
          #pharmacy-receipt .text-lg { font-size: 18px !important }
          #pharmacy-receipt .row-value { max-width: 62% !important; word-break: break-word !important; white-space: normal !important; text-align: right !important }
          #pharmacy-receipt .item-name { max-width: 64% !important; word-break: break-word !important; white-space: normal !important }
          hr { border-color: #000 !important }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 print:static print:p-0 print:bg-white" role="dialog" aria-modal="true">
        <div className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl print:shadow-none print:border-0 print:max-w-none">

          {/* Screen-only header */}
          <div className="no-print flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="font-medium text-slate-900">Receipt {receiptNo}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="btn-outline-navy">Print (Ctrl+P)</button>
              <button onClick={onClose} className="btn-outline-navy">Close (Ctrl+D)</button>
            </div>
          </div>

          <div className="overflow-y-auto bg-white p-4 print:p-0 print:overflow-visible">
            <div id="pharmacy-receipt" className="mx-auto w-[300px] bg-white">

              {/* Header */}
              <div className="text-center">
                {info.logo && <img src={info.logo} alt="logo" className="mx-auto mb-2 h-10 w-10 object-contain" />}
                <div className="text-lg font-extrabold leading-tight">{info.name}</div>
                {info.address && <div className="text-xs text-slate-600 print:text-black">{info.address}</div>}
                {info.phone && <div className="text-xs text-slate-600 print:text-black">Mobile #: {info.phone}</div>}
              </div>

              <hr className="my-2 border-dashed" />
              <div className="text-center text-sm font-semibold underline">Retail Invoice</div>

              <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-slate-700">
                <div>User: {getCurrentUser()}</div>
                <div>{dt.toLocaleDateString()} {dt.toLocaleTimeString()}</div>
              </div>

              <hr className="my-2 border-dashed" />

              {/* Customer info */}
              <div className="space-y-1 text-sm text-slate-800">
                <Row label="Customer:" value={customerLabel} />
                <Row label="Bill No:" value={receiptNo} boldValue />
                <Row label="Pay. Mode:" value={paymentMethod || method} />
              </div>

              {/* Items */}
              <div className="my-3 border-t border-dashed pt-2 text-sm">
                <div className="grid grid-cols-6 font-semibold text-slate-800">
                  <div className="col-span-3">Item</div>
                  <div className="text-center">Qty</div>
                  <div className="col-span-2 text-right">Amt</div>
                </div>
                <div className="mt-1 space-y-1">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-6">
                      <div className="item-name col-span-3 truncate">{l.name}</div>
                      <div className="text-center">{l.qty}</div>
                      <div className="col-span-2 text-right font-variant-numeric">{(l.price * l.qty).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm text-slate-800 border-t border-dashed pt-2">
                <Row label="Sub Total:" value={`${currency} ${subtotal.toFixed(2)}`} />
                {lineDisc > 0 && <Row label="Line Discounts:" value={`- ${currency} ${lineDisc.toFixed(2)}`} />}
                <Row label={`Bill Discount (${discountPct}%):`} value={`- ${currency} ${billDisc.toFixed(2)}`} />
                {taxPct > 0 && <Row label={`GST (${taxPct}%):`} value={`${currency} ${tax.toFixed(2)}`} />}
                <Row label="TOTAL:" value={`${currency} ${total.toFixed(2)}`} boldValue />
                <Row label="Paid:" value={`${currency} ${received.toFixed(2)}`} />
                <Row label="Remaining:" value={`${currency} ${remaining.toFixed(2)}`} />
                <Row label="Pay. Status:" value={paymentStatus.toUpperCase()} />
                {payedToName && <Row label="Payed to:" value={payedToName} />}
                {paymentMethod && <Row label="Pay. Method:" value={paymentMethod} />}
              </div>

              {/* Payment Summary — mirrors diagnostic slip */}
              {(paymentStatus !== 'unpaid' || duesBefore > 0 || advanceBefore > 0 || duesAfter > 0 || advanceAfter > 0) && (
                <>
                  <hr className="my-2 border-dashed" />
                  <div className="mb-1 text-sm font-semibold">Payment Summary</div>
                  <div className="space-y-1 text-sm text-slate-800">
                    <Row label="Prev. Dues:" value={`${currency} ${clamp0(duesBefore).toLocaleString()}`} />
                    <Row label="Prev. Adv.:" value={`${currency} ${clamp0(advanceBefore).toLocaleString()}`} />
                    {useAdvance && clamp0(advanceApplied) > 0 && <Row label="Adv. Used:" value={`${currency} ${clamp0(advanceApplied).toLocaleString()}`} />}
                    <Row label="Received Now:" value={`${currency} ${received.toLocaleString()}`} boldValue />
                    <Row label="Dues After:" value={`${currency} ${clamp0(duesAfter).toLocaleString()}`} />
                    <Row label="Adv. After:" value={`${currency} ${clamp0(advanceAfter).toLocaleString()}`} />
                  </div>
                </>
              )}

              {/* Payment Details — mirrors diagnostic slip */}
              {(paymentStatus !== 'unpaid' || payPreviousDues || useAdvance || duesPaid > 0 || paidForToday > 0 || advanceAdded > 0) && (
                <>
                  <hr className="my-2 border-dashed" />
                  <div className="mb-1 text-sm font-semibold">Payment Details</div>
                  <div className="space-y-1 text-sm text-slate-800">
                    {payPreviousDues && <Row label="Pay Prev. Dues:" value="YES" />}
                    {useAdvance && <Row label="Use Adv.:" value="YES" />}
                    <Row label="Dues Paid:" value={`${currency} ${clamp0(duesPaid).toLocaleString()}`} />
                    <Row label="Paid For Today:" value={`${currency} ${clamp0(paidForToday).toLocaleString()}`} />
                    <Row label="Adv. Added:" value={`${currency} ${clamp0(advanceAdded).toLocaleString()}`} />
                  </div>
                </>
              )}

              <hr className="my-2 border-dashed" />
              <div className="text-center text-[11px] text-slate-600 print:text-black">{info.footer}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, boldValue }: { label: string; value: string; boldValue?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-1">
      <div className="text-slate-700">{label}</div>
      <div className={`${boldValue ? 'font-semibold ' : ''}row-value min-w-0 break-words text-right`}>{value}</div>
    </div>
  )
}
