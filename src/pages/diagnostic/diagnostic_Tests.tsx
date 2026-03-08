import { useEffect, useMemo, useRef, useState } from 'react'
import { diagnosticApi } from '../../utils/api'
import SuggestField from '../../components/SuggestField'
import * as XLSX from 'xlsx'

// Simple Confirm Dialog component
function ConfirmDialog({ open, title, message, confirmText, onCancel, onConfirm, importing }: { 
  open: boolean; 
  title?: string; 
  message?: string; 
  confirmText?: string;
  importing?: boolean;
  onCancel: () => void; 
  onConfirm: () => void;
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">{title || 'Confirm'}</div>
        <div className="px-5 py-4 text-sm text-slate-700">{message || 'Are you sure?'}</div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={importing}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={importing}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

type Test = { 
  id: string; 
  name: string; 
  price: number;
  department?: string;
  purchasePrice?: number;
  qtyPerPack?: number;
}

const OPTIONS = [
  'Stress Tolerance Test (STT)',
  'Nocturnal Penile Tumescence (NPT)',
  'Penile Doppler Study (PDS)',
]

export default function Diagnostic_Tests() {
  const [items, setItems] = useState<Test[]>([])
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try {
      const res = await diagnosticApi.listTests({ limit: 1000 }) as any
      const arr = (res?.items || res || []).map((x: any) => ({ 
        id: String(x._id || x.id), 
        name: x.name, 
        price: Number(x.price || 0),
        department: x.department || '',
        purchasePrice: Number(x.purchasePrice || 0),
        qtyPerPack: Number(x.qtyPerPack || 1),
      }))
      setItems(arr)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formDepartment, setFormDepartment] = useState('')
  const [formPurchasePrice, setFormPurchasePrice] = useState('')
  const [formQtyPerPack, setFormQtyPerPack] = useState('')

  // Import/Export state
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = useState(false)
  const [importConfirm, setImportConfirm] = useState<null | { count: number; items: any[] }>(null)

  const optionsForDialog = (() => {
    const existing = new Set(items.map(i => String(i.name || '').trim().toLowerCase()))
    // When editing, allow current name to remain selectable.
    const current = editId ? String(formName || '').trim().toLowerCase() : ''
    return OPTIONS.filter(o => {
      const key = String(o || '').trim().toLowerCase()
      if (!key) return false
      if (editId && key === current) return true
      return !existing.has(key)
    })
  })()

  const openAdd = () => { 
    setEditId(null); 
    setFormName(''); 
    setFormPrice(''); 
    setFormDepartment('');
    setFormPurchasePrice('');
    setFormQtyPerPack('');
    setShowModal(true) 
  }
  const openEdit = (id: string) => {
    const it = items.find(i => i.id === id); if (!it) return
    setEditId(id); 
    setFormName(it.name); 
    setFormPrice(String(it.price || 0)); 
    setFormDepartment(it.department || '');
    setFormPurchasePrice(String(it.purchasePrice || 0));
    setFormQtyPerPack(String(it.qtyPerPack || 1));
    setShowModal(true)
  }
  const saveModal = async () => {
    if (!formName || !formPrice) return
    const payload = {
      name: formName,
      price: Number(formPrice) || 0,
      department: formDepartment || undefined,
      purchasePrice: Number(formPurchasePrice) || 0,
      qtyPerPack: Number(formQtyPerPack) || 1,
    }
    try {
      if (editId) {
        await diagnosticApi.updateTest(editId, payload)
      } else {
        await diagnosticApi.createTest(payload)
      }
      await load()
    } catch { }
    setShowModal(false)
  }
  const remove = async (id: string) => { try { await diagnosticApi.deleteTest(id); await load() } catch { } }

  // Export to Excel
  const exportRows = useMemo(() => {
    return items.map(it => ({
      'Department': it.department || 'Diagnostic',
      'Item Description': it.name,
      'Purchase Price': it.purchasePrice || 0,
      'Sales Price/Unit': it.price,
      'Qty per Pack': it.qtyPerPack || 1,
    }))
  }, [items])

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tests')
    XLSX.writeFile(wb, `diagnostic-tests-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // Import from Excel
  const normHeader = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  const pick = (row: any, keys: string[]) => {
    for (const k of keys) {
      const v = row[k]
      if (v != null && String(v).trim() !== '') return v
    }
    return ''
  }

  const onImportFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[]
      if (!raw.length) return

      // Normalize column names
      const rows = raw.map(r => {
        const out: any = {}
        Object.keys(r || {}).forEach(k => { out[normHeader(k)] = r[k] })
        return out
      })

      const toCreate = rows
        .map(r => {
          const name = String(pick(r, ['item description', 'test name', 'name', 'description']) || '').trim()
          if (!name) return null
          const department = String(pick(r, ['department', 'dept', 'category']) || 'Diagnostic').trim()
          const purchasePrice = Number(pick(r, ['purchase price', 'cost price', 'purchase', 'cost']) || 0)
          const salesPrice = Number(pick(r, ['sales price/unit', 'sales price', 'price', 'unit price', 'selling price']) || 0)
          const qtyPerPack = Number(pick(r, ['qty per pack', 'quantity per pack', 'qty', 'pack qty']) || 1)
          return { name, department, purchasePrice, price: salesPrice, qtyPerPack }
        })
        .filter(Boolean) as any[]

      if (!toCreate.length) {
        alert('No valid test records found in the file.')
        return
      }

      setImportConfirm({ count: toCreate.length, items: toCreate })
    } catch (e) {
      console.error(e)
      alert('Failed to import file')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!importConfirm?.items.length) {
      setImportConfirm(null)
      return
    }
    setImporting(true)
    try {
      for (const t of importConfirm.items) {
        await diagnosticApi.createTest({
          name: t.name,
          department: t.department,
          purchasePrice: t.purchasePrice,
          price: t.price,
          qtyPerPack: t.qtyPerPack,
        })
      }
      await load()
    } catch (e) {
      console.error(e)
      alert('Failed to import some tests')
    } finally {
      setImporting(false)
      setImportConfirm(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-800">Tests Catalog</h2>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
            }}
          />
          <button 
            onClick={() => importInputRef.current?.click()} 
            disabled={importing} 
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <button 
            onClick={exportExcel} 
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export Excel
          </button>
          <button onClick={openAdd} className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800">+ Add Test</button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-0 overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Test Name</th>
                <th className="px-3 py-2 font-medium">Purchase Price</th>
                <th className="px-3 py-2 font-medium">Sales Price</th>
                <th className="px-3 py-2 font-medium">Qty/Pack</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map(it => (
                <tr key={it.id}>
                  <td className="px-3 py-2">{it.department || 'Diagnostic'}</td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2">PKR {Number(it.purchasePrice || 0).toLocaleString()}</td>
                  <td className="px-3 py-2">PKR {Number(it.price || 0).toLocaleString()}</td>
                  <td className="px-3 py-2">{it.qtyPerPack || 1}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button onClick={() => openEdit(it.id)} className="rounded-md border border-slate-300 px-2 py-1 text-violet-700 hover:bg-violet-50">Edit</button>
                    <button onClick={() => remove(it.id)} className="rounded-md border border-slate-300 px-2 py-1 text-rose-700 hover:bg-rose-50">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">{loading ? 'Loading...' : 'No tests yet'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-2 sm:p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">{editId ? 'Edit Test' : 'Add Test'}</h3>
                <p className="text-sm text-slate-600">Enter test details and pricing.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Department</label>
                <input 
                  value={formDepartment} 
                  onChange={e => setFormDepartment(e.target.value)} 
                  placeholder="e.g., Diagnostic"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" 
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Test Name</label>
                <SuggestField
                  value={formName}
                  onChange={setFormName}
                  suggestions={optionsForDialog}
                  placeholder="Start typing to search"
                  as="input"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Purchase Price (Cost)</label>
                <input type="number" value={formPurchasePrice} onChange={e => setFormPurchasePrice(e.target.value)} placeholder="Purchase price" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Sales Price</label>
                <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="Sales price" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Qty per Pack</label>
                <input type="number" value={formQtyPerPack} onChange={e => setFormQtyPerPack(e.target.value)} placeholder="Quantity per pack" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveModal} disabled={!formName || !formPrice} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!importConfirm}
        title="Import Tests"
        message={importConfirm ? `Import ${importConfirm.count} tests from Excel?` : ''}
        confirmText={importing ? 'Importing…' : 'Import'}
        importing={importing}
        onCancel={() => setImportConfirm(null)}
        onConfirm={() => { void confirmImport() }}
      />
    </div>
  )
}
