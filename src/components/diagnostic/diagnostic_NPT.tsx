import React from 'react'

type Row = { parameter: string; referenceValue: string; result: string }

type FormData = { rows: Row[]; masterFlag: string; clinicalNote: string }

type Props = { value: string; onChange: (text: string) => void }

function safeParse(value: string): FormData | null {
  try {
    const v = JSON.parse(value)
    if (!v || typeof v !== 'object') return null
    const rows = Array.isArray((v as any).rows) ? (v as any).rows : null
    const clinicalNote = typeof (v as any).clinicalNote === 'string' ? (v as any).clinicalNote : ''
    const masterFlag = typeof (v as any).masterFlag === 'string' ? (v as any).masterFlag : ''
    const normRows: Row[] = Array.isArray(rows)
      ? rows.map((r: any) => ({
        parameter: String(r?.parameter || ''),
        referenceValue: String(r?.referenceValue || ''),
        result: String(r?.result || ''),
      }))
      : []
    return { rows: normRows, clinicalNote, masterFlag }
  } catch {
    return null
  }
}

const DEFAULT_ROWS: Row[] = [
  { parameter: '# Er', referenceValue: '>= 5', result: '' },
  { parameter: 'Vol', referenceValue: '>= 10 ml', result: '' },
  { parameter: 'Hrd', referenceValue: '>= 60%', result: '' },
  { parameter: 'Drn : Mx', referenceValue: '>= 10 min', result: '' },
  { parameter: 'Avg : Er', referenceValue: '>= 10 min', result: '' },
]

export default function Diagnostic_NPT({ value, onChange }: Props) {
  const prefillRef = React.useRef(false)
  const [rows, setRows] = React.useState<Row[]>(DEFAULT_ROWS)
  const [masterFlag, setMasterFlag] = React.useState('')
  const [clinicalNote, setClinicalNote] = React.useState('')

  React.useEffect(() => {
    if (prefillRef.current) return
    const parsed = safeParse(String(value || '').trim())
    if (parsed) {
      const map = new Map<string, Row>()
      for (const r of parsed.rows || []) map.set(String(r.parameter || ''), r)
      const merged = DEFAULT_ROWS.map(r => {
        const prev = map.get(r.parameter)
        return prev ? { ...r, result: prev.result || '' } : r
      })
      setRows(merged)
      setMasterFlag(parsed.masterFlag || '')
      setClinicalNote(parsed.clinicalNote || '')
    }
    prefillRef.current = true
  }, [value])

  const emit = React.useCallback((nextRows: Row[], nextFlag: string, nextNote: string) => {
    const payload: FormData = { rows: nextRows, masterFlag: nextFlag, clinicalNote: nextNote }
    onChange(JSON.stringify(payload))
  }, [onChange])

  React.useEffect(() => {
    emit(rows, masterFlag, clinicalNote)
  }, [rows, masterFlag, clinicalNote, emit])

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Parameter</th>
              <th className="px-3 py-2 text-left font-medium">Reference Value</th>
              <th className="px-3 py-2 text-left font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.parameter} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800 font-medium">{r.parameter}</td>
                <td className="px-3 py-2">
                  <input
                    value={r.referenceValue}
                    onChange={e => {
                      const v = e.target.value
                      setRows(prev => prev.map((x, i) => i === idx ? { ...x, referenceValue: v } : x))
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5"
                    placeholder="Reference value"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={r.result}
                    onChange={e => {
                      const v = e.target.value
                      setRows(prev => prev.map((x, i) => i === idx ? { ...x, result: v } : x))
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5"
                    placeholder="Enter result"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Master-level Flag */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Overall Flag</label>
        <select
          value={masterFlag}
          onChange={e => setMasterFlag(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Select</option>
          <option value="Normal">Normal</option>
          <option value="Mild">Mild</option>
          <option value="Moderate">Moderate</option>
          <option value="Severe">Severe</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Clinical Note</label>
        <textarea
          value={clinicalNote}
          onChange={e => setClinicalNote(e.target.value)}
          className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Clinical note"
        />
      </div>
    </div>
  )
}
