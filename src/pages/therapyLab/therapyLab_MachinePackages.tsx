import { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import { therapyApi } from '../../utils/api'

type PackageStatus = 'active' | 'inactive'

type TherapyPackage = {
  _id: string
  packageName?: string
  package: number
  price: number
  machinePreset?: any
  status: PackageStatus
  createdAt?: string
  updatedAt?: string
}

const PACKAGE_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
  55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const

const getEmptyTherapyMachines = () => ({
  chi: { enabled: false, pr: false, bk: false },
  eswt: { enabled: false, v1000: false, v1500: false, v2000: false },
  ms: { enabled: false, pr: false, bk: false },
  mam: { enabled: false, m: false },
  us: { enabled: false, pr: false, bk: false },
  mcgSpg: { enabled: false, dashBar: false, equal: false },
  mproCryo: { enabled: false, m: false, c: false },
  ximen: { enabled: false, note: '' },
})

const therapyMachineLabel = (key: string) => {
  if (key === 'chi') return 'CHi (R 2.5 Sp6, D 420 UB)'
  if (key === 'eswt') return 'ESWT (Repair)'
  if (key === 'ms') return 'M/S (R 2.5 UB P)'
  if (key === 'mam') return 'MAM (CHCN)'
  if (key === 'us') return 'U/S (R 2.5 UB P)'
  if (key === 'mcgSpg') return 'MCG SPG'
  if (key === 'mproCryo') return 'Mpro Cryo'
  if (key === 'ximen') return 'XIMEN'
  return key
}

const checkboxCardLabelCls = (checked: boolean) =>
  `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-800`

function formatMoney(n: number) {
  try {
    return Number(n || 0).toLocaleString()
  } catch {
    return String(n || 0)
  }
}

export default function TherapyLab_Packages() {
  const [items, setItems] = useState<TherapyPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const [statusFilter, setStatusFilter] = useState<'all' | PackageStatus>('all')
  const [packageFilter, setPackageFilter] = useState<'all' | number>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit' | 'view'>('add')
  const [active, setActive] = useState<TherapyPackage | null>(null)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<TherapyPackage | null>(null)

  const [form, setForm] = useState({
    packageName: '',
    package: '' as any,
    price: '',
    status: 'active' as PackageStatus,
  })

  const [therapyMachines, setTherapyMachines] = useState(getEmptyTherapyMachines())
  const [hiddenTherapyMachines, setHiddenTherapyMachines] = useState<string[]>([])
  const [customTherapyMachines, setCustomTherapyMachines] = useState<
    Array<
      | { id: string; name: string; kind: 'checkboxes'; options: string[] }
      | { id: string; name: string; kind: 'fields'; fields: string[] }
    >
  >([])
  const [customTherapyMachineState, setCustomTherapyMachineState] = useState<
    Record<string, { enabled: boolean; checks?: Record<string, boolean>; fields?: Record<string, string> }>
  >({})
  const [therapyMachineRemoveDialog, setTherapyMachineRemoveDialog] = useState<null | { kind: 'fixed' | 'custom'; key: string; label: string }>(null)
  const [isTherapyMachineRestoreDialogOpen, setIsTherapyMachineRestoreDialogOpen] = useState(false)
  const [therapyMachineAddName, setTherapyMachineAddName] = useState('')
  const [therapyMachineAddKind, setTherapyMachineAddKind] = useState<'checkboxes' | 'fields'>('checkboxes')
  const [therapyMachineAddOptions, setTherapyMachineAddOptions] = useState<string[]>([''])
  const [therapyMachineAddFields, setTherapyMachineAddFields] = useState<string[]>([''])

  const applyMachinePreset = (preset: any) => {
    if (!preset || typeof preset !== 'object') return

    if (preset.therapyMachines && typeof preset.therapyMachines === 'object') {
      const base: any = getEmptyTherapyMachines()
      const src: any = preset.therapyMachines
      const next: any = { ...base }
      for (const k of Object.keys(base)) {
        if (src[k] && typeof src[k] === 'object') next[k] = { ...base[k], ...src[k] }
      }
      setTherapyMachines(next)
    }

    const presetDefs: any[] = Array.isArray(preset.customTherapyMachines) ? preset.customTherapyMachines : []
    const presetState: any = preset.customTherapyMachineState && typeof preset.customTherapyMachineState === 'object' ? preset.customTherapyMachineState : {}
    if (presetDefs.length || Object.keys(presetState || {}).length) {
      const defsById = new Map<string, any>()
      for (const d of customTherapyMachines) defsById.set(String((d as any).id), d)
      for (const d of presetDefs) {
        const id = String((d as any)?.id || '')
        if (id && !defsById.has(id)) defsById.set(id, d)
      }
      const nextDefs = Array.from(defsById.values())
      const nextState = { ...customTherapyMachineState, ...(presetState as any) }
      saveCustomTherapyMachines(nextDefs as any, nextState as any)
    }
  }

  useEffect(() => {
    const key = 'therapyLab.therapyMachines.hidden'
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHiddenTherapyMachines(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setHiddenTherapyMachines([])
    } catch {
      setHiddenTherapyMachines([])
    }
  }, [])

  useEffect(() => {
    const key = 'therapyLab.therapyMachines.custom'
    try {
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : null
      const defs = Array.isArray(data?.defs) ? data.defs : []
      const st = data?.state && typeof data.state === 'object' ? data.state : {}
      setCustomTherapyMachines(defs)
      setCustomTherapyMachineState(st)
    } catch {
      setCustomTherapyMachines([])
      setCustomTherapyMachineState({})
    }
  }, [])

  const hiddenTherapyMachinesSet = useMemo(
    () => new Set(hiddenTherapyMachines.map((s) => String(s || '').trim()).filter(Boolean)),
    [hiddenTherapyMachines]
  )

  const saveHiddenTherapyMachines = (next: string[]) => {
    const uniq = Array.from(new Set(next.map((s) => String(s || '').trim()).filter(Boolean)))
    setHiddenTherapyMachines(uniq)
    const key = 'therapyLab.therapyMachines.hidden'
    try {
      localStorage.setItem(key, JSON.stringify(uniq))
    } catch {}
  }

  const saveCustomTherapyMachines = (
    defs: Array<
      | { id: string; name: string; kind: 'checkboxes'; options: string[] }
      | { id: string; name: string; kind: 'fields'; fields: string[] }
    >,
    state: Record<string, { enabled: boolean; checks?: Record<string, boolean>; fields?: Record<string, string> }>
  ) => {
    setCustomTherapyMachines(defs)
    setCustomTherapyMachineState(state)
    const key = 'therapyLab.therapyMachines.custom'
    try {
      localStorage.setItem(key, JSON.stringify({ defs, state }))
    } catch {}
  }

  const params = useMemo(() => {
    return {
      status: statusFilter === 'all' ? undefined : statusFilter,
      package: packageFilter === 'all' ? undefined : packageFilter,
      limit: 200,
    }
  }, [statusFilter, packageFilter])

  const fetchList = async () => {
    setLoading(true)
    setError('')
    try {
      const res: any = await therapyApi.listPackages(params as any)
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
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const res: any = await therapyApi.listPackages(params as any)
        const list: any[] = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
        if (!cancelled) setItems(list as any)
      } catch (e: any) {
        if (!cancelled) {
          setItems([])
          setError(e?.message || 'Failed to load packages')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [params])

  const resetForm = () => {
    setForm({ packageName: '', package: '' as any, price: '', status: 'active' })
  }

  const openAdd = () => {
    setMode('add')
    setActive(null)
    resetForm()
    setModalOpen(true)
  }

  const openView = (m: TherapyPackage) => {
    setMode('view')
    setModalOpen(true)
    setError('')
    ;(async () => {
      try {
        setLoading(true)
        const doc: any = await therapyApi.getPackage(m._id)
        setActive(doc)
        if (doc?.machinePreset) applyMachinePreset(doc.machinePreset)
        setForm({
          packageName: String(doc?.packageName || ''),
          package: String(doc?.package) as any,
          price: String(doc?.price ?? ''),
          status: (doc?.status || 'active') as PackageStatus,
        })
      } catch (e: any) {
        setError(e?.message || 'Failed to load package')
        setModalOpen(false)
      } finally {
        setLoading(false)
      }
    })()
  }

  const openEdit = (m: TherapyPackage) => {
    setMode('edit')
    setModalOpen(true)
    setError('')
    ;(async () => {
      try {
        setLoading(true)
        const doc: any = await therapyApi.getPackage(m._id)
        setActive(doc)
        if (doc?.machinePreset) applyMachinePreset(doc.machinePreset)
        setForm({
          packageName: String(doc?.packageName || ''),
          package: String(doc?.package) as any,
          price: String(doc?.price ?? ''),
          status: (doc?.status || 'active') as PackageStatus,
        })
      } catch (e: any) {
        setError(e?.message || 'Failed to load package')
        setModalOpen(false)
      } finally {
        setLoading(false)
      }
    })()
  }

  const askDelete = (m: TherapyPackage) => {
    setError('')
    ;(async () => {
      try {
        setLoading(true)
        const doc: any = await therapyApi.getPackage(m._id)
        setToDelete(doc)
        setConfirmDeleteOpen(true)
      } catch (e: any) {
        setError(e?.message || 'Failed to load package')
      } finally {
        setLoading(false)
      }
    })()
  }

  const submit = async () => {
    const packageName = String((form as any).packageName || '').trim()
    const pkg = Number(form.package)
    const price = Number(form.price)
    const status = form.status
    if (!packageName) {
      setError('Package Name is required')
      return
    }
    if (!PACKAGE_OPTIONS.includes(pkg as any)) {
      setError('Package is required')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Price is required')
      return
    }

    setError('')
    try {
      setLoading(true)
      if (mode === 'edit' && active?._id) {
        const machinePreset = {
          therapyMachines,
          customTherapyMachines,
          customTherapyMachineState,
        }
        await therapyApi.updatePackage(active._id, { packageName, package: pkg, price, status, machinePreset })
      } else {
        const machinePreset = {
          therapyMachines,
          customTherapyMachines,
          customTherapyMachineState,
        }
        await therapyApi.createPackage({ packageName, package: pkg, price, status, machinePreset })
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
      await therapyApi.deletePackage(toDelete._id)
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
            <div className="text-xs text-slate-500">Manage package pricing and status</div>
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
              value={packageFilter}
              onChange={(e) => {
                const v = e.target.value
                setPackageFilter(v === 'all' ? 'all' : Number(v))
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-44"
            >
              <option value="all">All Packages</option>
              {PACKAGE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
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
                  Package: <span className="font-medium text-slate-800">{m.package}</span>
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
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-w-2xl lg:max-w-3xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
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

            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-3 sm:p-5">
              {mode !== 'view' && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-base font-semibold text-slate-800">
                    <div>Select Machine</div>
                    <button
                      type="button"
                      onClick={() => setIsTherapyMachineRestoreDialogOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                      title="Add"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                  <div className="grid gap-2">
                    {!hiddenTherapyMachinesSet.has('chi') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).chi.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).chi.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  chi: e.target.checked ? { ...s.chi, enabled: true } : { enabled: false, pr: false, bk: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">CHi (R 2.5 Sp6, D 420 UB)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'chi', label: 'CHi (R 2.5 Sp6, D 420 UB)' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).chi.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).chi.pr} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, chi: { ...s.chi, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              PR
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).chi.bk} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, chi: { ...s.chi, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              BK
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('eswt') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).eswt.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).eswt.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  eswt: e.target.checked ? { ...s.eswt, enabled: true } : { enabled: false, v1000: false, v1500: false, v2000: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">ESWT (Repair)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'eswt', label: 'ESWT (Repair)' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).eswt.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).eswt.v1000} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, eswt: { ...s.eswt, v1000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              1000
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).eswt.v1500} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, eswt: { ...s.eswt, v1500: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              1500
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).eswt.v2000} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, eswt: { ...s.eswt, v2000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              2000
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('ms') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).ms.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).ms.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  ms: e.target.checked ? { ...s.ms, enabled: true } : { enabled: false, pr: false, bk: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">M/S (R 2.5 UB P)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'ms', label: 'M/S (R 2.5 UB P)' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).ms.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).ms.pr} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, ms: { ...s.ms, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              PR
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).ms.bk} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, ms: { ...s.ms, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              BK
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('mam') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).mam.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).mam.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  mam: e.target.checked ? { ...s.mam, enabled: true } : { enabled: false, m: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">MAM (CHCN)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'mam', label: 'MAM (CHCN)' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).mam.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).mam.m} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mam: { ...s.mam, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              M
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('us') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).us.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).us.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  us: e.target.checked ? { ...s.us, enabled: true } : { enabled: false, pr: false, bk: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">U/S (R 2.5 UB P)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'us', label: 'U/S (R 2.5 UB P)' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).us.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).us.pr} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, us: { ...s.us, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              PR
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).us.bk} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, us: { ...s.us, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              BK
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('mcgSpg') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).mcgSpg.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).mcgSpg.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  mcgSpg: e.target.checked ? { ...s.mcgSpg, enabled: true } : { enabled: false, dashBar: false, equal: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">MCG SPG</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'mcgSpg', label: 'MCG SPG' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).mcgSpg.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).mcgSpg.dashBar} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mcgSpg: { ...s.mcgSpg, dashBar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              --|
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).mcgSpg.equal} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mcgSpg: { ...s.mcgSpg, equal: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              =
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('mproCryo') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).mproCryo.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).mproCryo.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  mproCryo: e.target.checked ? { ...s.mproCryo, enabled: true } : { enabled: false, m: false, c: false },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">Mpro Cryo</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'mproCryo', label: 'Mpro Cryo' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).mproCryo.enabled && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).mproCryo.m} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mproCryo: { ...s.mproCryo, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              M
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={(therapyMachines as any).mproCryo.c} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mproCryo: { ...s.mproCryo, c: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                              C
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {!hiddenTherapyMachinesSet.has('ximen') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls((therapyMachines as any).ximen.enabled)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={(therapyMachines as any).ximen.enabled}
                              onChange={(e) =>
                                setTherapyMachines((s: any) => ({
                                  ...s,
                                  ximen: e.target.checked ? { ...s.ximen, enabled: true } : { enabled: false, note: '' },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">XIMEN</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'ximen', label: 'XIMEN' })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {(therapyMachines as any).ximen.enabled && (
                          <div className="ml-7">
                            <input
                              value={(therapyMachines as any).ximen.note}
                              onChange={(e) => setTherapyMachines((s: any) => ({ ...s, ximen: { ...s.ximen, note: e.target.value } }))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              placeholder="Enter"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {customTherapyMachines.map((m) => {
                      const st = customTherapyMachineState[m.id] || { enabled: false }
                      const checked = !!st.enabled
                      return (
                        <div key={m.id}>
                          <div className="flex items-center gap-2">
                            <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const enabled = e.target.checked
                                  setCustomTherapyMachineState((s) => {
                                    const next = { ...s }
                                    const cur = next[m.id] || {}
                                    next[m.id] = { ...cur, enabled }
                                    saveCustomTherapyMachines(customTherapyMachines, next)
                                    return next
                                  })
                                }}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              <span className="flex-1">{m.name}</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setTherapyMachineRemoveDialog({ kind: 'custom', key: m.id, label: m.name })}
                              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {checked && m.kind === 'checkboxes' && (
                            <div className="ml-7 flex flex-wrap items-center gap-6">
                              {(m.options || []).filter(Boolean).map((opt) => {
                                const isChecked = !!st.checks?.[opt]
                                return (
                                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const v = e.target.checked
                                        setCustomTherapyMachineState((s) => {
                                          const next = { ...s }
                                          const cur = next[m.id] || { enabled: true }
                                          const checks = { ...(cur.checks || {}) }
                                          checks[opt] = v
                                          next[m.id] = { ...cur, enabled: true, checks }
                                          saveCustomTherapyMachines(customTherapyMachines, next)
                                          return next
                                        })
                                      }}
                                      className="h-4 w-4 rounded border-slate-300"
                                    />
                                    {opt}
                                  </label>
                                )
                              })}
                            </div>
                          )}

                          {checked && m.kind === 'fields' && (
                            <div className="ml-7 grid gap-2">
                              {(m.fields || []).filter(Boolean).map((fld) => {
                                const val = st.fields?.[fld] || ''
                                return (
                                  <div key={fld}>
                                    <label className="mb-1 block text-sm text-slate-700">{fld}</label>
                                    <input
                                      value={val}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setCustomTherapyMachineState((s) => {
                                          const next = { ...s }
                                          const cur = next[m.id] || { enabled: true }
                                          const fields = { ...(cur.fields || {}) }
                                          fields[fld] = v
                                          next[m.id] = { ...cur, enabled: true, fields }
                                          saveCustomTherapyMachines(customTherapyMachines, next)
                                          return next
                                        })
                                      }}
                                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                      placeholder="Enter"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Package Name</label>
                <input
                  value={(form as any).packageName}
                  onChange={(e) => setForm((p: any) => ({ ...p, packageName: e.target.value }))}
                  disabled={mode === 'view'}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Enter package name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Package</label>
                <input
                  value={form.package}
                  onChange={(e) => setForm((p) => ({ ...p, package: e.target.value }))}
                  disabled={mode === 'view'}
                  list="therapy-packages"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Select package"
                />
                <datalist id="therapy-packages">
                  {PACKAGE_OPTIONS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Price</label>
                <input
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  disabled={mode === 'view'}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as PackageStatus }))}
                  disabled={mode === 'view'}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {mode !== 'view' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading}
                  className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {therapyMachineRemoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Remove Machine</div>
              <button
                type="button"
                onClick={() => setTherapyMachineRemoveDialog(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div className="text-sm text-slate-700">
              Are you sure you want to remove <span className="font-semibold">{therapyMachineRemoveDialog.label}</span>?
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTherapyMachineRemoveDialog(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = therapyMachineRemoveDialog
                  if (!d) return
                  if (d.kind === 'custom') {
                    const nextDefs = customTherapyMachines.filter((x) => x.id !== d.key)
                    const nextState = { ...customTherapyMachineState }
                    delete (nextState as any)[d.key]
                    saveCustomTherapyMachines(nextDefs, nextState)
                  } else {
                    saveHiddenTherapyMachines([...hiddenTherapyMachines, d.key])
                    setTherapyMachines((s: any) => ({ ...s, [d.key]: (getEmptyTherapyMachines() as any)[d.key] }))
                  }
                  setTherapyMachineRemoveDialog(null)
                }}
                className="rounded-md border border-rose-600 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {isTherapyMachineRestoreDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Add Machine</div>
              <button
                type="button"
                onClick={() => setIsTherapyMachineRestoreDialogOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Machine Name</label>
                <input
                  value={therapyMachineAddName}
                  onChange={(e) => setTherapyMachineAddName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Enter machine name"
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-800">Type</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTherapyMachineAddKind('checkboxes')}
                    className={`rounded-md border px-3 py-2 text-sm ${therapyMachineAddKind === 'checkboxes' ? 'border-blue-800 text-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                  >
                    Checkboxes
                  </button>
                  <button
                    type="button"
                    onClick={() => setTherapyMachineAddKind('fields')}
                    className={`rounded-md border px-3 py-2 text-sm ${therapyMachineAddKind === 'fields' ? 'border-blue-800 text-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                  >
                    Fields
                  </button>
                </div>
              </div>

              {therapyMachineAddKind === 'checkboxes' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">Checkbox Options</div>
                    <button
                      type="button"
                      onClick={() => setTherapyMachineAddOptions((s) => [...s, ''])}
                      className="inline-flex items-center justify-center rounded-md border border-blue-800 px-2.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                      title="Add"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {therapyMachineAddOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={opt}
                          onChange={(e) => setTherapyMachineAddOptions((s) => s.map((x, i) => (i === idx ? e.target.value : x)))}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Option name"
                        />
                        <button
                          type="button"
                          onClick={() => setTherapyMachineAddOptions((s) => (s.length <= 1 ? [''] : s.filter((_, i) => i !== idx)))}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {therapyMachineAddKind === 'fields' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">Fields</div>
                    <button
                      type="button"
                      onClick={() => setTherapyMachineAddFields((s) => [...s, ''])}
                      className="inline-flex items-center justify-center rounded-md border border-blue-800 px-2.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                      title="Add"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {therapyMachineAddFields.map((fld, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={fld}
                          onChange={(e) => setTherapyMachineAddFields((s) => s.map((x, i) => (i === idx ? e.target.value : x)))}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Field name"
                        />
                        <button
                          type="button"
                          onClick={() => setTherapyMachineAddFields((s) => (s.length <= 1 ? [''] : s.filter((_, i) => i !== idx)))}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hiddenTherapyMachines.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">Restore Hidden Machines</div>
                  <div className="space-y-2">
                    {hiddenTherapyMachines.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          saveHiddenTherapyMachines(hiddenTherapyMachines.filter((x) => x !== k))
                          setIsTherapyMachineRestoreDialogOpen(false)
                        }}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {therapyMachineLabel(k)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTherapyMachineRestoreDialogOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = String(therapyMachineAddName || '').trim()
                  if (!name) return
                  const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`

                  if (therapyMachineAddKind === 'checkboxes') {
                    const options = Array.from(new Set(therapyMachineAddOptions.map((s) => String(s || '').trim()).filter(Boolean)))
                    const def = { id, name, kind: 'checkboxes' as const, options }
                    const nextDefs = [...customTherapyMachines, def]
                    const nextState = { ...customTherapyMachineState, [id]: { enabled: true, checks: {} as Record<string, boolean> } }
                    saveCustomTherapyMachines(nextDefs, nextState)
                  } else {
                    const fields = Array.from(new Set(therapyMachineAddFields.map((s) => String(s || '').trim()).filter(Boolean)))
                    const def = { id, name, kind: 'fields' as const, fields }
                    const nextDefs = [...customTherapyMachines, def]
                    const nextState = { ...customTherapyMachineState, [id]: { enabled: true, fields: {} as Record<string, string> } }
                    saveCustomTherapyMachines(nextDefs, nextState)
                  }

                  setTherapyMachineAddName('')
                  setTherapyMachineAddKind('checkboxes')
                  setTherapyMachineAddOptions([''])
                  setTherapyMachineAddFields([''])
                  setIsTherapyMachineRestoreDialogOpen(false)
                }}
                className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDeleteOpen(false)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-base font-semibold text-slate-900">Confirm Delete</div>
              <div className="mt-1 text-sm text-slate-600">Delete package "{toDelete.packageName || toDelete.package}"?</div>
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
