import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import SuggestField from '../SuggestField'

type Props = {
  initialTestsText?: string
  initialNotes?: string
  initialDiscount?: string
  suggestionsNotes?: string[]
  doctorId?: string
}

type Data = {
  tests?: string[]
  notes?: string
  discount?: string
}

type Display = {
  testsText: string
  notes: string
  discount: string
}

export default forwardRef(function PrescriptionDiagnosticOrders({ initialTestsText = '', initialNotes = '', initialDiscount = '0', suggestionsNotes = [], doctorId }: Props, ref) {
  const [testsText, setTestsText] = useState<string>(initialTestsText)
  const [notes, setNotes] = useState<string>(initialNotes)
  const [testsInput, setTestsInput] = useState<string>('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addDraft, setAddDraft] = useState('')
  const [hiddenQuickTests, setHiddenQuickTests] = useState<string[]>([])
  const [customTests, setCustomTests] = useState<string[]>([])
  const [removeDialog, setRemoveDialog] = useState<null | { kind: 'quick' | 'custom'; name: string }>(null)

  // Discount state
  const [discount, setDiscount] = useState(initialDiscount || '0')

  // Helpers and constants defined early to avoid initialization errors
  const parseListText = (text: string) =>
    String(text || '')
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean)

  const checkboxCardLabelCls = (checked: boolean) =>
    `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-800`

  const quickTests = [
    'Stress Tolerance Test (STT)',
    'Nocturnal Penile Tumescence (NPT)',
    'Penile Doppler Study (PDS)',
  ] as const

  const doctorKey = (doctorId || 'anon').trim() || 'anon'

  useEffect(() => {
    const key = `doctor.diagnosticOrders.hiddenQuickTests.${doctorKey}`
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHiddenQuickTests(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setHiddenQuickTests([])
    } catch {
      setHiddenQuickTests([])
    }
  }, [doctorKey])

  useEffect(() => {
    const key = `doctor.diagnosticOrders.customTests.${doctorKey}`
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setCustomTests(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setCustomTests([])
    } catch {
      setCustomTests([])
    }
  }, [doctorKey])

  const hiddenQuickTestsSet = useMemo(() => new Set(hiddenQuickTests.map(s => String(s || '').trim()).filter(Boolean)), [hiddenQuickTests])

  const saveHiddenQuickTests = (next: string[]) => {
    const uniq = Array.from(new Set(next.map(s => String(s || '').trim()).filter(Boolean)))
    setHiddenQuickTests(uniq)
    const key = `doctor.diagnosticOrders.hiddenQuickTests.${doctorKey}`
    try { localStorage.setItem(key, JSON.stringify(uniq)) } catch { }
  }

  const saveCustomTests = (next: string[]) => {
    const uniq = Array.from(new Set(next.map(s => String(s || '').trim()).filter(Boolean)))
    setCustomTests(uniq)
    const key = `doctor.diagnosticOrders.customTests.${doctorKey}`
    try { localStorage.setItem(key, JSON.stringify(uniq)) } catch { }
  }

  const toggleQuickTest = (name: string) => {
    setTestsText(prev => {
      const current = parseListText(prev)
      const set = new Set(current)
      if (set.has(name)) set.delete(name)
      else set.add(name)
      return Array.from(set).join('\n')
    })
  }

  const toggleCustomTest = (name: string) => {
    setTestsText(prev => {
      const current = parseListText(prev)
      const set = new Set(current)
      if (set.has(name)) set.delete(name)
      else set.add(name)
      return Array.from(set).join('\n')
    })
  }

  const addTestChip = (vRaw: string) => {
    const v = String(vRaw || '').trim()
    if (!v) return

    if (!(quickTests as readonly string[]).includes(v)) {
      saveCustomTests([...customTests, v])
    }

    setTestsText(prev => {
      const current = parseListText(prev)
      if (current.includes(v)) return prev
      return [...current, v].join('\n')
    })
  }

  const removeTestChip = (vRaw: string) => {
    const v = String(vRaw || '').trim()
    if (!v) return
    setTestsText(prev => {
      const current = parseListText(prev)
      const next = current.filter(x => x !== v)
      return next.join('\n')
    })
  }

  useEffect(() => {
    const selectedCustom = parseListText(testsText).filter(t => !(quickTests as readonly string[]).includes(t))
    if (selectedCustom.length) {
      saveCustomTests([...customTests, ...selectedCustom])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testsText])

  useImperativeHandle(ref, () => ({
    getData(): Data {
      const tests = String(testsText || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)
      return {
        tests: tests.length ? tests : undefined,
        notes: notes?.trim() ? notes.trim() : undefined,
        discount: discount,
      }
    },
    getDisplay(): Display { return { testsText, notes, discount } },
    setDisplay(next: Partial<Display>) {
      if (next.testsText !== undefined) { setTestsText(next.testsText || ''); setTestsInput('') }
      if (next.notes !== undefined) setNotes(next.notes || '')
      if (next.discount !== undefined) setDiscount(next.discount || '0')
    },
  }))

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
        <div>Diagnostic Orders</div>
        <button
          type="button"
          onClick={() => {
            setAddDraft('')
            setIsAddDialogOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          title="Add Test"
        >
          <Plus className="h-4 w-4" />
          Add Test
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickTests.filter(t => !hiddenQuickTestsSet.has(String(t || ''))).map(t => {
              const checked = parseListText(testsText).includes(t)
              return (
                <div key={t} className="flex items-center gap-2">
                  <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleQuickTest(t)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="flex-1">{t}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setRemoveDialog({ kind: 'quick', name: t })}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}

            {customTests
              .filter(t => !(quickTests as readonly string[]).includes(t))
              .map(t => {
                const checked = parseListText(testsText).includes(t)
                return (
                  <div key={`custom-${t}`} className="flex items-center gap-2">
                    <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCustomTest(t)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="flex-1">{t}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setRemoveDialog({ kind: 'custom', name: t })}
                      className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-700">Diagnostic Tests (comma or one per line)</label>
          <div className="rounded-md border border-slate-300 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {parseListText(testsText).map((k) => (
                <span key={k} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {k}
                  <button
                    type="button"
                    onClick={() => removeTestChip(k)}
                    className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300"
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                value={testsInput}
                onChange={e => setTestsInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = testsInput.trim()
                    if (!v) return
                    addTestChip(v)
                    setTestsInput('')
                  }
                }}
                className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                placeholder="Type test and press Enter"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-700">Diagnostic Notes</label>
          <SuggestField rows={2} value={notes} onChange={v => setNotes(v)} suggestions={suggestionsNotes} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">Discount</label>
          <input
            value={discount}
            onChange={e => setDiscount(e.target.value)}
            placeholder="Enter discount"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isAddDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Add Diagnostic Test</div>
              <button
                type="button"
                onClick={() => setIsAddDialogOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Diagnostic Test</label>
              <input
                value={addDraft}
                onChange={e => setAddDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = addDraft.trim()
                    if (!v) return
                    addTestChip(v)
                    setIsAddDialogOpen(false)
                    setAddDraft('')
                  }
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Type diagnostic test"
                autoFocus
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddDialogOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = addDraft.trim()
                  if (!v) return
                  addTestChip(v)
                  setIsAddDialogOpen(false)
                  setAddDraft('')
                }}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {removeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Remove Diagnostic Test</div>
              <button
                type="button"
                onClick={() => setRemoveDialog(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>

            <div className="text-sm text-slate-700">
              Are you sure you want to remove <span className="font-semibold">{removeDialog.name}</span>?
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveDialog(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = removeDialog
                  if (!d) return
                  if (d.kind === 'custom') {
                    saveCustomTests(customTests.filter(x => x !== d.name))
                    removeTestChip(d.name)
                  } else {
                    saveHiddenQuickTests([...hiddenQuickTests, d.name])
                    setTestsText(prev => {
                      const current = parseListText(prev)
                      const next = current.filter(x => x !== d.name)
                      return next.join('\n')
                    })
                  }
                  setRemoveDialog(null)
                }}
                className="rounded-md border border-rose-600 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
