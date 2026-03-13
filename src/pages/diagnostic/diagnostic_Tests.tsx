import { useEffect, useState } from 'react'
import { diagnosticApi } from '../../utils/api'
import SuggestField from '../../components/SuggestField'

type Test = { id: string; name: string; price: number }

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
      const arr = (res?.items || res || []).map((x: any) => ({ id: String(x._id || x.id), name: x.name, price: Number(x.price || 0) }))
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

  const openAdd = () => { setEditId(null); setFormName(''); setFormPrice(''); setShowModal(true) }
  const openEdit = (id: string) => {
    const it = items.find(i => i.id === id); if (!it) return
    setEditId(id); setFormName(it.name); setFormPrice(String(it.price || 0)); setShowModal(true)
  }
  const saveModal = async () => {
    if (!formName || !formPrice) return
    const priceNum = Number(formPrice) || 0
    try {
      if (editId) {
        await diagnosticApi.updateTest(editId, { name: formName, price: priceNum })
      } else {
        await diagnosticApi.createTest({ name: formName, price: priceNum })
      }
      await load()
    } catch { }
    setShowModal(false)
  }
  const remove = async (id: string) => { try { await diagnosticApi.deleteTest(id); await load() } catch { } }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-800">Tests</h2>
        <button onClick={openAdd} className="w-full sm:w-auto rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy/90">+ Add Test</button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-0 overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-[600px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-medium">Test Name</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map(it => (
                <tr key={it.id}>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2">PKR {Number(it.price || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button onClick={() => openEdit(it.id)} className="rounded-md border border-slate-300 px-2 py-1 text-violet-700 hover:bg-violet-50">Edit</button>
                    <button onClick={() => remove(it.id)} className="rounded-md border border-slate-300 px-2 py-1 text-rose-700 hover:bg-rose-50">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">{loading ? 'Loading...' : 'No tests yet'}</td></tr>
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
                <p className="text-sm text-slate-600">Select a test and set its price.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 space-y-3">
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
                <label className="mb-1 block text-sm text-slate-700">Price</label>
                <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="Price" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={saveModal} disabled={!formName || !formPrice} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
