import { useEffect, useRef, useState } from 'react'
import { diagnosticApi, hospitalApi } from '../../utils/api'

export type DiagnosticTokenSlipData = {
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
  paymentStatus?: 'paid'|'unpaid'
  receptionistName?: string
  receivedToAccountCode?: string
  paymentMethod?: string
  accountNumberIban?: string
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
  tests: Array<{ name: string; price: number }>
  subtotal: number
  discount: number
  discountType?: 'PKR' | '%'
  payable: number
  createdAt?: string
}

function clamp0(n: any){
  const x = Number(n || 0)
  return Number.isFinite(x) ? Math.max(0, x) : 0
}

function getCurrentUser(){
  try {
    const s =
      localStorage.getItem('reception.session') ||
      localStorage.getItem('hospital.session') ||
      localStorage.getItem('diagnostic.user')
    if (s) return (JSON.parse(s)?.username || JSON.parse(s)?.name || '').toString()
  } catch {}
  return 'admin'
}

function normalizePayToLabel(label?: string) {
  const raw = String(label || '').trim()
  if (!raw) return ''
  const noCode = raw.replace(/\s*\([^)]*\)\s*$/g, '').trim()
  const left = noCode.split(' - ')[0]?.trim() || noCode
  return left
}

export default function Diagnostic_TokenSlip({ open, onClose, data, autoPrint = false, user }: { open: boolean; onClose: ()=>void; data: DiagnosticTokenSlipData; autoPrint?: boolean; user?: string }){
  const [settings, setSettings] = useState({ name: 'Diagnostic Center', phone: '', address: '', logoDataUrl: '', slipFooter: 'Powered by Hospital MIS' })
  const [payToNameMap, setPayToNameMap] = useState<Record<string, string>>({})
  const printedRef = useRef(false)

  useEffect(()=>{ printedRef.current = false }, [open])
  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try {
        const s = await diagnosticApi.getSettings() as any
        if (!mounted) return
        setSettings({
          name: s?.diagnosticName || 'Diagnostic Center',
          phone: s?.phone || '',
          address: s?.address || '',
          logoDataUrl: s?.logoDataUrl || '',
          slipFooter: s?.reportFooter || 'Powered by Hospital MIS',
        })
      } catch {
        try {
          const raw = localStorage.getItem('diagnostic.settings')
          if (!raw) return
          const cached = JSON.parse(raw)
          if (!mounted) return
          setSettings((p) => ({
            ...p,
            name: String(cached?.diagnosticName || p.name || 'Diagnostic Center'),
            logoDataUrl: String(cached?.logoDataUrl || p.logoDataUrl || ''),
          }))
        } catch {}
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  useEffect(()=>{
    let cancelled = false
    async function loadPayTo(){
      try {
        const [bankRes, pettyRes] = await Promise.all([
          hospitalApi.listBankAccounts(),
          hospitalApi.listPettyCashAccounts(),
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
        for (const p of petty){
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code) continue
          if (String(p?.status || 'Active') !== 'Active') continue
          add(code, normalizePayToLabel(String(p?.name || code).trim()))
        }

        const banks: any[] = bankRes?.accounts || []
        for (const b of banks){
          const an = String(b?.accountNumber || '')
          const last4 = an ? an.slice(-4) : ''
          const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
          if (!code) continue
          const bankNameOnly = String(b?.bankName || '').trim()
          const titleOnly = String(b?.accountTitle || '').trim()
          add(code, normalizePayToLabel(bankNameOnly || titleOnly || code))
        }

        if (!cancelled) setPayToNameMap(map)
      } catch {
        if (!cancelled) setPayToNameMap({})
      }
    }
    if (open) loadPayTo()
    return ()=>{ cancelled = true }
  }, [open])
  useEffect(()=>{ if (!open || !autoPrint || printedRef.current) return; const t = setTimeout(()=>{ window.print(); printedRef.current = true }, 300); return ()=>clearTimeout(t) }, [open, autoPrint])
  if (!open) return null
  const dt = data.createdAt ? new Date(data.createdAt) : new Date()
  const receivedCode = String(data.receivedToAccountCode || '').trim().toUpperCase()
  const payedToNameRaw = (receivedCode && payToNameMap[receivedCode]) ? payToNameMap[receivedCode] : (data.receptionistName || '')
  const payedToName = normalizePayToLabel(payedToNameRaw)

  const payable = Math.max(0, Number(data.payable || 0))

  const isUnpaid = String(data.paymentStatus || 'paid').toLowerCase() === 'unpaid'

  const computed = (() => {
    const duesBefore = clamp0(data.duesBefore)
    const advanceBefore = clamp0(data.advanceBefore)
    const payPreviousDues = isUnpaid ? false : !!data.payPreviousDues
    const useAdvance = isUnpaid ? false : !!data.useAdvance
    let amountReceived = isUnpaid ? 0 : clamp0(data.amountReceived)
    const net = clamp0(payable)

    if (data.duesAfter != null || data.advanceAfter != null || data.duesPaid != null || data.paidForToday != null || data.advanceAdded != null){
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 print:bg-white print:static">
      <div id="diagnostic-receipt" className="w-full max-w-[384px] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-md border border-slate-300 bg-white p-4 shadow print:shadow-none print:border-0 print:w-[300px] print:max-h-none print:overflow-visible">
        <div className="text-center">
          {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="logo" className="mx-auto mb-2 h-10 w-10 object-contain" />}
          <div className="text-lg font-extrabold leading-tight">{settings.name}</div>
          <div className="text-xs text-slate-600 print:text-black">{settings.address}</div>
          {settings.phone && <div className="text-xs text-slate-600 print:text-black">Mobile #: {settings.phone}</div>}
        </div>

        <hr className="my-2 border-dashed" />
        <div className="text-center text-sm font-semibold underline">Diagnostic Token</div>

        <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-slate-700">
          <div>User: {user || getCurrentUser()}</div>
          <div>{dt.toLocaleDateString()} {dt.toLocaleTimeString()}</div>
        </div>

        <hr className="my-2 border-dashed" />

        <div className="space-y-1 text-sm text-slate-800">
          <Row label="Patient Name:" value={data.patientName || '-'} />
          <Row label="Mobile #:" value={data.phone || '-'} boldValue />
          {data.mrn && <Row label="MR #:" value={data.mrn} />}
          {data.age && <Row label="Age:" value={data.age} />}
          {data.gender && <Row label="Sex:" value={data.gender} />}        
          {(data.guardianName || data.guardianRel) && <Row label="Guardian:" value={`${data.guardianRel ? data.guardianRel + ' ' : ''}${data.guardianName || ''}`.trim()} />}
          {data.cnic && <Row label="CNIC:" value={data.cnic} />}
          {data.address && <Row label="Address:" value={data.address} />}
        </div>

        <div className="my-3 rounded border border-slate-800 p-3 text-center text-xl font-extrabold tracking-widest">{data.tokenNo}</div>

        <div className="mb-2 text-sm font-semibold">Tests</div>
        <div className="mb-2 divide-y divide-slate-200 text-sm">
          {data.tests.map((t, i)=>(
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="test-item-name">{t.name}</div>
              <div>PKR {Number(t.price||0).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm text-slate-800">
          <Row label="Total Amount:" value={`PKR ${data.subtotal.toLocaleString()}`} />
          <Row label="Discount:" value={`${data.discountType === '%' ? data.discount + '% (PKR ' + Math.round(data.subtotal * (data.discount / 100)).toLocaleString() + ')' : 'PKR ' + Number(data.discount||0).toLocaleString()}`} />
          <Row label="Payable:" value={`PKR ${payable.toLocaleString()}`} boldValue />
          <Row label="Paid:" value={`PKR ${computed.paidToday.toLocaleString()}`} />
          <Row label="Remaining:" value={`PKR ${computed.remaining.toLocaleString()}`} />
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

        <div className="mt-3 flex items-center justify-end gap-2 print:hidden">
          <button onClick={()=>window.print()} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white">Print</button>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">Close</button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        #diagnostic-receipt { font-family: 'Poppins', Arial, sans-serif }
        @media print {
          @page { size: 58mm auto; margin: 0 }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
          body * { visibility: hidden !important }
          /* Print only the slip */
          #diagnostic-receipt, #diagnostic-receipt * { visibility: visible !important }
          /* Keep within printable width: include padding inside width */
          #diagnostic-receipt { position: absolute !important; left: 0; right: 0; top: 0; margin: 0 auto !important; padding: 10px 10px 0 10px !important; width: 300px !important; box-sizing: border-box !important; line-height: 1.45; overflow: visible !important; z-index: 2147483647; font-size: 14px !important }
          /* Force crisp black text for thermal */
          #diagnostic-receipt, #diagnostic-receipt * { color: #000 !important }
          /* Utility to hide elements marked as print:hidden */
          .print\\:hidden { display: none !important }
          /* Slightly upscale common text utility sizes for clarity on thermal */
          #diagnostic-receipt .text-xs{ font-size: 13px !important }
          #diagnostic-receipt .text-sm{ font-size: 14px !important }
          #diagnostic-receipt .text-lg{ font-size: 18px !important }
          #diagnostic-receipt .text-xl{ font-size: 20px !important }
          /* Ensure right column wraps instead of being cut off */
          #diagnostic-receipt .row-value{ max-width: 62% !important; word-break: break-word !important; white-space: normal !important; text-align: right !important }
          #diagnostic-receipt .test-item-name{ max-width: 64% !important; word-break: break-word !important; white-space: normal !important }
          hr { border-color: #000 !important }
        }
      `}</style>
    </div>
  )
}

function Row({ label, value, boldValue }: { label: string; value: string; boldValue?: boolean }){
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <div className="text-slate-700">{label}</div>
      <div className={`${boldValue ? 'font-semibold ' : ''}row-value min-w-0 break-words text-right`}>{value}</div>
    </div>
  )
}
