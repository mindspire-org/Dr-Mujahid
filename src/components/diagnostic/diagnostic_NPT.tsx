import React from 'react'

type Row = { parameter: string; result: string; flag: string }

type FormData = { rows: Row[]; clinicalNote: string }

type Props = { value: string; onChange: (text: string)=>void }

function safeParse(value: string): FormData | null {
  try {
    const v = JSON.parse(value)
    if (!v || typeof v !== 'object') return null
    const rows = Array.isArray((v as any).rows) ? (v as any).rows : null
    const clinicalNote = typeof (v as any).clinicalNote === 'string' ? (v as any).clinicalNote : ''
    const normRows: Row[] = Array.isArray(rows)
      ? rows.map((r: any) => ({
          parameter: String(r?.parameter || ''),
          result: String(r?.result || ''),
          flag: String(r?.flag || ''),
        }))
      : []
    return { rows: normRows, clinicalNote }
  } catch {
    return null
  }
}

const DEFAULT_ROWS: Row[] = [
  { parameter: '# Er', result: '', flag: '' },
  { parameter: 'Vol', result: '', flag: '' },
  { parameter: 'Hrd', result: '', flag: '' },
  { parameter: 'Drn : Mx', result: '', flag: '' },
  { parameter: 'Avg : Er', result: '', flag: '' },
]

export default function Diagnostic_NPT({ value, onChange }: Props){
  const prefillRef = React.useRef(false)
  const [rows, setRows] = React.useState<Row[]>(DEFAULT_ROWS)
  const [clinicalNote, setClinicalNote] = React.useState('')

  React.useEffect(() => {
    if (prefillRef.current) return
    const parsed = safeParse(String(value || '').trim())
    if (parsed){
      const map = new Map<string, Row>()
      for (const r of parsed.rows || []) map.set(String(r.parameter || ''), r)
      const merged = DEFAULT_ROWS.map(r => {
        const prev = map.get(r.parameter)
        return prev ? { ...r, result: prev.result || '', flag: prev.flag || '' } : r
      })
      setRows(merged)
      setClinicalNote(parsed.clinicalNote || '')
    }
    prefillRef.current = true
  }, [value])

  const emit = React.useCallback((nextRows: Row[], nextNote: string) => {
    const payload: FormData = { rows: nextRows, clinicalNote: nextNote }
    onChange(JSON.stringify(payload))
  }, [onChange])

  React.useEffect(() => {
    emit(rows, clinicalNote)
  }, [rows, clinicalNote, emit])

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Parameter</th>
              <th className="px-3 py-2 text-left font-medium">Result</th>
              <th className="px-3 py-2 text-left font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.parameter} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800">{r.parameter}</td>
                <td className="px-3 py-2">
                  <input
                    value={r.result}
                    onChange={e=>{
                      const v = e.target.value
                      setRows(prev => prev.map((x,i)=> i===idx ? { ...x, result: v } : x))
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5"
                    placeholder="Enter result"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={r.flag}
                    onChange={e=>{
                      const v = e.target.value
                      setRows(prev => prev.map((x,i)=> i===idx ? { ...x, flag: v } : x))
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5"
                  >
                    <option value="">Select</option>
                    <option value="Normal">Normal</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Clinical Note</label>
        <textarea
          value={clinicalNote}
          onChange={e=>setClinicalNote(e.target.value)}
          className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Clinical note"
        />
      </div>
    </div>
  )
}
