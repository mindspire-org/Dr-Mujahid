import { useEffect, useRef, useState } from 'react'
import { counsellingApi, hospitalApi } from '../../utils/api'

export type CounsellingCreditPaymentSlipData = {
  patientName: string
  mrn?: string
  phone?: string
  createdAt: string
  amount: number
  duesBefore: number
  advanceBefore: number
  duesPaid: number
  advanceAdded: number
  duesAfter: number
  advanceAfter: number
  paymentMethod: 'Cash'|'Card'|'Insurance'
  accountNumberIban?: string
  receivedToAccountCode: string
  receptionistName?: string
  note?: string
}

function getCurrentUser(){
  try {
    const s =
      localStorage.getItem('counselling.session') ||
      localStorage.getItem('hospital.session')
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

export default function Counselling_CreditPaymentSlip({ open, onClose, data, autoPrint = false, user }: { open: boolean; onClose: ()=>void; data: CounsellingCreditPaymentSlipData; autoPrint?: boolean; user?: string }){
  const [settings, setSettings] = useState({ name: 'Counselling Center', phone: '', address: '', logoDataUrl: '', slipFooter: 'Powered by HealthSpire' })
  const [payToNameMap, setPayToNameMap] = useState<Record<string, string>>({})
  const printedRef = useRef(false)

  useEffect(()=>{ printedRef.current = false }, [open])

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try {
        const s = await counsellingApi.getSettings() as any
        if (!mounted) return
        setSettings({
          name: s?.counsellingName || s?.hospitalName || s?.name || 'Counselling Center',
          phone: s?.phone || '',
          address: s?.address || '',
          logoDataUrl: s?.logoDataUrl || '',
          slipFooter: s?.reportFooter || s?.slipFooter || 'Powered by HealthSpire',
        })
      } catch {}
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

  useEffect(()=>{
    if (!open || !autoPrint || printedRef.current) return
    const t = setTimeout(()=>{ window.print(); printedRef.current = true }, 300)
    return ()=>clearTimeout(t)
  }, [open, autoPrint])

  if (!open) return null

  const dt = data.createdAt ? new Date(data.createdAt) : new Date()
  const receivedCode = String(data.receivedToAccountCode || '').trim().toUpperCase()
  const payedToNameRaw = (receivedCode && payToNameMap[receivedCode]) ? payToNameMap[receivedCode] : (data.receptionistName || '')
  const payedToName = normalizePayToLabel(payedToNameRaw)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 print:bg-white print:static">
      <div id="counselling-credit-slip" className="w-full max-w-[384px] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-md border border-slate-300 bg-white p-4 shadow print:shadow-none print:border-0 print:w-[300px] print:max-h-none print:overflow-visible">
        <div className="text-center">
          {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="logo" className="mx-auto mb-2 h-10 w-10 object-contain" />}
          <div className="text-lg font-extrabold leading-tight">{settings.name}</div>
          <div className="text-xs text-slate-600 print:text-black">{settings.address}</div>
          {settings.phone && <div className="text-xs text-slate-600 print:text-black">Mobile #: {settings.phone}</div>}
        </div>

        <hr className="my-2 border-dashed" />
        <div className="text-center text-sm font-semibold underline">Credit Payment Receipt</div>

        <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-slate-700">
          <div>User: {user || getCurrentUser()}</div>
          <div>{dt.toLocaleDateString()} {dt.toLocaleTimeString()}</div>
        </div>

        <hr className="my-2 border-dashed" />

        <div className="space-y-1 text-sm text-slate-800">
          <Row label="Patient:" value={data.patientName || '-'} boldValue />
          {data.mrn && <Row label="MRN:" value={data.mrn} />}
          {data.phone && <Row label="Phone:" value={data.phone} />}
        </div>

        <hr className="my-2 border-dashed" />
        <div className="space-y-1 text-sm text-slate-800">
          <Row label="Amount:" value={`PKR ${Number(data.amount||0).toLocaleString()}`} boldValue />
          <Row label="Prev. Dues:" value={`PKR ${Number(data.duesBefore||0).toLocaleString()}`} />
          <Row label="Prev. Adv.:" value={`PKR ${Number(data.advanceBefore||0).toLocaleString()}`} />
          <Row label="Dues Paid:" value={`PKR ${Number(data.duesPaid||0).toLocaleString()}`} />
          <Row label="Adv. Added:" value={`PKR ${Number(data.advanceAdded||0).toLocaleString()}`} />
          <Row label="Dues After:" value={`PKR ${Number(data.duesAfter||0).toLocaleString()}`} />
          <Row label="Adv. After:" value={`PKR ${Number(data.advanceAfter||0).toLocaleString()}`} />
        </div>

        <hr className="my-2 border-dashed" />
        <div className="space-y-1 text-sm text-slate-800">
          {payedToName && <Row label="Payed to:" value={payedToName} />}
          <Row label="Pay. Method:" value={data.paymentMethod} />
          {data.paymentMethod === 'Card' && data.accountNumberIban && <Row label="Account#/IBAN:" value={data.accountNumberIban} />}
          {data.note && <Row label="Note:" value={data.note} />}
        </div>

        <hr className="my-2 border-dashed" />
        <div className="text-center text-[11px] text-slate-600 print:text-black">{settings.slipFooter}</div>

        <div className="mt-3 flex items-center justify-end gap-2 print:hidden">
          <button onClick={()=>window.print()} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white">Print</button>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">Close</button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        #counselling-credit-slip { font-family: 'Poppins', Arial, sans-serif }
        @media print {
          @page { size: 58mm auto; margin: 0 }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
          body * { visibility: hidden !important }
          #counselling-credit-slip, #counselling-credit-slip * { visibility: visible !important }
          #counselling-credit-slip { position: absolute !important; left: 0; right: 0; top: 0; margin: 0 auto !important; padding: 10px 10px 0 10px !important; width: 300px !important; box-sizing: border-box !important; line-height: 1.45; overflow: visible !important; z-index: 2147483647; font-size: 14px !important }
          #counselling-credit-slip, #counselling-credit-slip * { color: #000 !important }
          .print\\:hidden { display: none !important }
          #counselling-credit-slip .text-xs{ font-size: 13px !important }
          #counselling-credit-slip .text-sm{ font-size: 14px !important }
          #counselling-credit-slip .text-lg{ font-size: 18px !important }
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
      <div className={`${boldValue ? 'font-semibold ' : ''}min-w-0 break-words text-right`}>{value}</div>
    </div>
  )
}
