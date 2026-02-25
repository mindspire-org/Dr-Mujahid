import { useEffect, useState } from 'react'
import { pharmacyApi } from '../../utils/api'

type PurchaseRow = {
  id: string
  date: string
  medicine: string
  supplier: string
  unitsPerPack: number
  totalItems: number
  buyPerPack: number
  buyPerUnit: number
  totalAmount: number
  salePerPack: number
  salePerUnit: number
  invoice: string
  expiry: string
}

type Props = {
  open: boolean
  onClose: () => void
  row?: PurchaseRow | null
}

export default function Pharmacy_PurchaseSlipDialog({ open, onClose, row }: Props) {
  const [settings, setSettings] = useState<any>(null)

  useEffect(()=>{
    if (!open) return
    pharmacyApi.getSettings().then(setSettings).catch(()=>{})
  }, [open])

  if (!open || !row) return null
  const packs = row.unitsPerPack ? Math.floor((row.totalItems || 0) / row.unitsPerPack) : 0
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        #pharmacy-purchase-slip { font-family: 'Poppins', Arial, sans-serif }
        .tabular-nums { font-variant-numeric: tabular-nums }
        #pharmacy-purchase-slip .amount { text-align: right; padding-right: 6px; font-variant-numeric: tabular-nums; white-space: nowrap }
        #pharmacy-purchase-slip .amount-h { text-align: right; padding-right: 4px; white-space: nowrap }
        @media print {
          @page { size: 58mm auto; margin: 0 }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
          body { margin: 0 !important; padding: 0 !important }
          body * { visibility: hidden !important }
          #pharmacy-purchase-slip, #pharmacy-purchase-slip * { visibility: visible !important }
          #pharmacy-purchase-slip { position: absolute !important; left: 0; right: 0; top: 0; margin: 0 auto !important; padding: 10px 10px 0 10px !important; width: 300px !important; box-sizing: border-box !important; line-height: 1.45; z-index: 2147483647; font-size: 14px !important }
          .no-print { display: none !important }
          .only-print { display: block !important }
          #pharmacy-purchase-slip, #pharmacy-purchase-slip * { color: #000 !important }
        }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 print:static print:p-0 print:bg-white">
        <div className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 print:shadow-none print:ring-0 print:rounded-none print:max-w-none print:border-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 print:hidden no-print">
          <h3 className="text-lg font-semibold text-slate-800">Purchase Invoice {row.invoice}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-800 print:p-0 print:overflow-visible">
          <div id="pharmacy-purchase-slip" className="mx-auto w-[300px] rounded-md bg-white print:w-[300px]">
            <div className="mb-4 flex flex-col items-center text-center">
              {settings?.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo" className="mb-2 h-12 w-12 object-contain" />
              ) : null}
              <div className="text-lg font-extrabold tracking-wide">{(settings?.pharmacyName || 'Pharmacy').toUpperCase()}</div>
              {settings?.address ? <div className="text-xs text-slate-600">{settings.address}</div> : null}
              {(settings?.phone || settings?.email) && (
                <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {settings?.phone ? <div>PHONE : {settings.phone}</div> : null}
                  {settings?.email ? <div>EMAIL : {settings.email}</div> : null}
                </div>
              )}
            </div>

            <div className="mb-3 text-center text-base font-semibold">Purchase Bill</div>

            <div className="mb-3 grid gap-2 sm:grid-cols-2 text-sm">
              <div><span className="text-slate-500">Date :</span> {row.date}</div>
              <div><span className="text-slate-500">Supplier :</span> {row.supplier}</div>
              <div><span className="text-slate-500">Invoice # :</span> {row.invoice}</div>
              <div><span className="text-slate-500">Expiry :</span> {row.expiry}</div>
            </div>

            <div className="mt-4 overflow-x-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <colgroup>
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead className="bg-slate-50 text-slate-700 print:bg-transparent">
                  <tr>
                    <th className="px-2 py-1 font-medium">Item</th>
                    <th className="px-1 py-1 font-medium text-center">Pk</th>
                    <th className="px-1 py-1 font-medium text-center">U/Pk</th>
                    <th className="px-1 py-1 font-medium text-right">B/Pk</th>
                    <th className="px-1 py-1 font-medium text-right">B/U</th>
                    <th className="px-1 py-1 font-medium amount-h">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-2 py-1 truncate">{row.medicine}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{packs}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{row.unitsPerPack}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{row.buyPerPack.toFixed(2)}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{row.buyPerUnit.toFixed(2)}</td>
                    <td className="px-1 py-1 amount">{row.totalAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end text-sm">
              <div className="w-64 space-y-1">
                <div className="flex items-center justify-between"><span className="text-slate-600">Total Amount</span><span className="font-semibold">Rs {row.totalAmount.toFixed(2)}</span></div>
              </div>
            </div>

            {settings?.billingFooter ? (
              <div className="mt-6 text-center text-sm text-slate-700">{settings.billingFooter}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 print:hidden no-print">
          <button onClick={onClose} className="btn-outline-navy">Close</button>
          <button onClick={() => window.print()} className="btn">Print</button>
        </div>
      </div>
    </div>
    </>
  )
}
