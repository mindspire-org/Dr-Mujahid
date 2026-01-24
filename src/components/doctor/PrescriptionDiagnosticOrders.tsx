import { forwardRef, useImperativeHandle, useState } from 'react'
import SuggestField from '../SuggestField'

type Props = {
  initialTestsText?: string
  initialNotes?: string
  suggestionsTests?: string[]
  suggestionsNotes?: string[]
}

type Data = {
  tests?: string[]
  notes?: string
}

type Display = {
  testsText: string
  notes: string
}

export default forwardRef(function PrescriptionDiagnosticOrders({ initialTestsText = '', initialNotes = '', suggestionsTests = [], suggestionsNotes = [] }: Props, ref) {
  const [testsText, setTestsText] = useState<string>(initialTestsText)
  const [notes, setNotes] = useState<string>(initialNotes)
  const [testsInput, setTestsInput] = useState<string>('')

  const checkboxCardLabelCls = (checked: boolean) =>
    `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-800`

  const quickTests = [
    'Stress Tolerance Test (STT)',
    'Nocturnal Penile Tumescence (NPT)',
    'Penile Doppler Study (PDS)',
  ] as const

  const parseListText = (text: string) =>
    String(text || '')
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean)

  const toggleQuickTest = (name: string) => {
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

  useImperativeHandle(ref, () => ({
    getData(): Data {
      const tests = String(testsText||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean)
      return {
        tests: tests.length ? tests : undefined,
        notes: notes?.trim() ? notes.trim() : undefined,
      }
    },
    getDisplay(): Display { return { testsText, notes } },
    setDisplay(next: Partial<Display>){
      if (next.testsText !== undefined) { setTestsText(next.testsText||''); setTestsInput('') }
      if (next.notes !== undefined) setNotes(next.notes||'')
    },
  }))

  return (
    <div>
      <div className="mb-1 block text-sm font-semibold text-slate-700">Diagnostic Orders</div>
      <div className="space-y-4">
        <div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickTests.map(t => {
              const checked = parseListText(testsText).includes(t)
              return (
                <label key={t} className={checkboxCardLabelCls(checked)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={()=>toggleQuickTest(t)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {t}
                </label>
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
                list="diagnostic-tests-suggestions"
              />
              <datalist id="diagnostic-tests-suggestions">
                {(suggestionsTests || []).map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-700">Diagnostic Notes</label>
          <SuggestField rows={2} value={notes} onChange={v=>setNotes(v)} suggestions={suggestionsNotes} />
        </div>
      </div>
    </div>
  )
})
