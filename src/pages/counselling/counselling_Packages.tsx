import { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { counsellingApi } from '../../utils/api'

type PackageStatus = 'active' | 'inactive'

type CounsellingPackage = {
  _id: string
  packageName: string
  month: number
  price: number
  status: PackageStatus
  createdAt?: string
  updatedAt?: string
}

const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

function formatMoney(n: number) {
  try {
    return Number(n || 0).toLocaleString()
  } catch {
    return String(n || 0)
  }
}

export default function Counselling_Packages() {
  const [items, setItems] = useState<CounsellingPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const [statusFilter, setStatusFilter] = useState<'all' | PackageStatus>('all')
  const [monthFilter, setMonthFilter] = useState<'all' | number>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit' | 'view'>('add')
  const [active, setActive] = useState<CounsellingPackage | null>(null)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<CounsellingPackage | null>(null)

  const [form, setForm] = useState({
    packageName: '',
    month: 1,
    price: '',
    status: 'active' as PackageStatus,
  })

  const params = useMemo(() => {
    return {
      status: statusFilter === 'all' ? undefined : statusFilter,
      package: monthFilter === 'all' ? undefined : monthFilter, // backend uses 'package' for the numeric value, we'll map month to it
      limit: 200,
    }
  }, [statusFilter, monthFilter])

  const fetchList = async () => {
    setLoading(true)
    setError('')
    try {
      const res: any = await counsellingApi.listPackages(params as any)
      const list: any[] = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
      setItems(list as any)
    } catch (e: any) {
      setItems([])
      setError(e?.message || 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [params])

  const resetForm = () => {
    setForm({ packageName: '', month: 1, price: '', status: 'active' })
  }

  const openAdd = () => {
    setMode('add')
    setActive(null)
    resetForm()
    setModalOpen(true)
  }

  const openView = (m: CounsellingPackage) => {
    setMode('view')
    setActive(m)
    setForm({
      packageName: m.packageName || '',
      month: m.month || 1,
      price: String(m.price ?? ''),
      status: m.status || 'active',
    })
    setModalOpen(true)
  }

  const openEdit = (m: CounsellingPackage) => {
    setMode('edit')
    setActive(m)
    setForm({
      packageName: m.packageName || '',
      month: m.month || 1,
      price: String(m.price ?? ''),
      status: m.status || 'active',
    })
    setModalOpen(true)
  }

  const askDelete = (m: CounsellingPackage) => {
    setToDelete(m)
    setConfirmDeleteOpen(true)
  }

  const submit = async () => {
    const packageName = form.packageName.trim()
    const month = Number(form.month)
    const price = Number(form.price)
    const status = form.status

    if (!packageName) {
      setError('Package Name is required')
      return
    }
    if (!month) {
      setError('Month is required')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Valid price is required')
      return
    }

    setError('')
    try {
      setLoading(true)
      const payload = { packageName, month, price, status }
      if (mode === 'edit' && active?._id) {
        await counsellingApi.updatePackage(active._id, payload)
      } else {
        await counsellingApi.createPackage(payload)
      }
      setModalOpen(false)
      await fetchList()
    } catch (e: any) {
      setError(e?.message || 'Failed to save package')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete?._id) return
    setError('')
    try {
      setLoading(true)
      await counsellingApi.deletePackage(toDelete._id)
      setConfirmDeleteOpen(false)
      setToDelete(null)
      await fetchList()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete package')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">Packages</div>
            <div className="text-xs text-slate-500">Manage counselling package pricing and status</div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-40"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={monthFilter}
              onChange={(e) => {
                const v = e.target.value
                setMonthFilter(v === 'all' ? 'all' : Number(v))
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-44"
            >
              <option value="all">All Months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} Month{m > 1 ? 's' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={openAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 sm:w-auto"
              type="button"
            >
              <Plus className="h-4 w-4" />
              <span>Add Package</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && items.length === 0 && (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading...</div>
        )}

        {!loading && items.length === 0 && (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No packages found.</div>
        )}

        {items.map((m) => (
          <div key={m._id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-900">{m.packageName || '-'}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Month: <span className="font-medium text-slate-800">{m.month}</span>
                </div>
                <div className="text-sm text-slate-600">
                  Price: <span className="font-medium text-slate-800">PKR {formatMoney(m.price)}</span>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}
              >
                {m.status}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => askDelete(m)}
                className="inline-flex items-center justify-center rounded-md border border-rose-300 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openView(m)}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openEdit(m)}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4" onClick={() => setModalOpen(false)}>
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
              <div className="text-base font-semibold text-slate-900">
                {mode === 'add' ? 'Add Package' : mode === 'edit' ? 'Edit Package' : 'Package Details'}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Package Name</label>
                  <input
                    type="text"
                    disabled={mode === 'view'}
                    value={form.packageName}
                    onChange={(e) => setForm({ ...form, packageName: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
                    placeholder="e.g. Standard Monthly"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Month</label>
                  <select
                    disabled={mode === 'view'}
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} Month{m > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Price (PKR)</label>
                  <input
                    type="number"
                    disabled={mode === 'view'}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
                    placeholder="e.g. 5000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <div className="flex items-center gap-6 rounded-md border border-slate-200 bg-slate-50/50 p-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        disabled={mode === 'view'}
                        checked={form.status === 'active'}
                        onChange={() => setForm({ ...form, status: 'active' })}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        disabled={mode === 'view'}
                        checked={form.status === 'inactive'}
                        onChange={() => setForm({ ...form, status: 'inactive' })}
                        className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                      />
                      Inactive
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {mode !== 'view' && (
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : mode === 'add' ? 'Add Package' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDeleteOpen(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-base font-semibold text-slate-900">Confirm Delete</div>
              <div className="mt-1 text-sm text-slate-600">Are you sure you want to delete "{toDelete?.packageName}"? This action cannot be undone.</div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={loading}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
