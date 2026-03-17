import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import SuggestField from '../../components/SuggestField'
import { hospitalApi } from '../../utils/api'

type Token = {
  id: string
  tokenNo: string
  createdAt: string
  patientName: string
  mrNo: string
  age?: string
  patientId?: string
  encounterId?: string
}

type PrevLabReportsEntry = {
  _id: string
  submittedAt?: string
  createdAt?: string
  hxBy?: string
  hxDate?: string
  labInformation?: any
  semenAnalysis?: any
  tests?: any[]
}

type LabTestRow = {
  testName: string
  normalValue: string
  result: string
  status: string
}

type SemenAnalysis = {
  date: string
  vol: string
  ph: string
  abs: string
  tsc: string
  cml: string
  mPct: string
  rL: string
  sl: string
  slg: string
  imt: string
  mor: string
  pus: string
  fr: string
  vt: string
}

const EMPTY_SEMEN_ANALYSIS: SemenAnalysis = {
  date: '',
  vol: '',
  ph: '',
  abs: '',
  tsc: '',
  cml: '',
  mPct: '',
  rL: '',
  sl: '',
  slg: '',
  imt: '',
  mor: '',
  pus: '',
  fr: '',
  vt: '',
}

const SEMEN_FIELDS: Array<{ key: keyof SemenAnalysis; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'vol', label: 'Vol' },
  { key: 'ph', label: 'Ph' },
  { key: 'abs', label: 'Abs' },
  { key: 'tsc', label: 'Tsc' },
  { key: 'cml', label: 'C/ml' },
  { key: 'mPct', label: 'M%' },
  { key: 'rL', label: 'R-L' },
  { key: 'sl', label: 'SL' },
  { key: 'slg', label: 'SLG' },
  { key: 'imt', label: 'IMT' },
  { key: 'mor', label: 'Mor' },
  { key: 'pus', label: 'Pus' },
  { key: 'fr', label: 'Fr' },
  { key: 'vt', label: 'Vt' },
]

type LabInformation = {
  labName: string
  mrNo: string
  date: string
}

const EMPTY_LAB_INFORMATION: LabInformation = {
  labName: '',
  mrNo: '',
  date: '',
}

const NORMAL_RANGES: Record<string, string> = {
  t: '265-1k',
  p: '1.3-14',
  fa: '4-30',
  zn: '50-150',
  d3: '>30',
  b12: '>150',
  cortisol: '3.7-19',
  lh: '2-12',
  fsh: '1-18',
  tsh: '0.4-4',
  t3: '0.8-2',
  t4: '5-14',
  estra: '7-42',
  u: '15-45',
  cr: '0.6-1.3',
}

function normalizeTestNameKey(raw: string): string {
  const v = (raw || '').trim()
  if (!v) return ''

  // Prefer part before parenthesis: "T(Testosterone)" -> "T"
  const beforeParen = v.split('(')[0].trim()
  const lower = beforeParen.toLowerCase()

  // Handle exact aliases
  if (lower === 't') return 't'
  if (lower === 'fa') return 'fa'
  if (lower === 'd3') return 'd3'
  if (lower === 'lh') return 'lh'
  if (lower === 'fsh') return 'fsh'
  if (lower === 'tsh') return 'tsh'
  if (lower === 't3') return 't3'
  if (lower === 't4') return 't4'
  if (lower === 'u') return 'u'
  if (lower === 'cr') return 'cr'
  if (lower === 'p') return 'p'
  if (lower === 'zn') return 'zn'
  if (lower === 'b12') return 'b12'

  // Named tests
  if (lower.includes('cortisol')) return 'cortisol'
  if (lower.includes('estra')) return 'estra'

  return lower
}

const TEST_SUGGESTIONS = [
  'T(Testosterone)',
  'FA (Folic Acid)',
  'D3 (Vitamin D3)',
  'Cortisol',
  'LH',
  'Ch (Cholesterol)',
  'HDL',
  'VL (VLDL)',
  'Estra (Estradiol)',
  'GGT',
  'ALT',
  'ALP',
  'SHBG',
  'Insulin',
  'VDRL',
  'P (Phosphorus)',
  'Zn (Zinc)',
  'B12',
  'HbA1c',
  'FSH',
  'TSH',
  'T3',
  'T4',
  'U. D/R (Urine Detailed Report)',
  'U (Urea)',
  'Cr (Creatinine)',
  'Semen C/S',
  'HIV-Ab',
  'Anti-HCV-Ab',
  'HBsAg',
  'HTPA',
  'TPHA',
]

const STATUS_SUGGESTIONS = [
  'Normal',
  'Abnormal',
  'Low',
  'High',
  'Critical',
]

const todayIso = new Date().toISOString().slice(0, 10)

export default function Hospital_LabReportsEntry() {
  const [searchParams] = useSearchParams()
  const [from, setFrom] = useState<string>(todayIso)
  const [to, setTo] = useState<string>(todayIso)
  const [tokens, setTokens] = useState<Token[]>([])
  const [labSavedTokenIds, setLabSavedTokenIds] = useState<string[]>([])
  const [patientKey, setPatientKey] = useState<string>('')
  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('hospital.session') || localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        return String(u?.username || u?.fullName || u?.name || '').trim()
      }
    } catch { }
    return ''
  }, [])

  const [hxBy, setHxBy] = useState<string>(currentUser)
  const [hxDate, setHxDate] = useState<string>(todayIso)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)

  const [prevEntries, setPrevEntries] = useState<PrevLabReportsEntry[]>([])
  const [prevEntryId, setPrevEntryId] = useState<string>('')

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  const resetAllFields = () => {
    setPatientKey('')
    setPrevEntryId('')
    setPrevEntries([])
    setHxBy(currentUser)
    setHxDate(todayIso)
    setLabInformation(EMPTY_LAB_INFORMATION)
    setSemenAnalysis(EMPTY_SEMEN_ANALYSIS)
    setTests([{ testName: '', normalValue: '', result: '', status: '' }])
  }

  const [tests, setTests] = useState<LabTestRow[]>([
    { testName: '', normalValue: '', result: '', status: '' },
  ])

  const [labInformation, setLabInformation] = useState<LabInformation>(EMPTY_LAB_INFORMATION)
  const [semenAnalysis, setSemenAnalysis] = useState<SemenAnalysis>(EMPTY_SEMEN_ANALYSIS)

  useEffect(() => {
    ; (async () => {
      try {
        const res: any = await hospitalApi.listTokens({ from: from || undefined, to: to || undefined })
        const items: Token[] = (res?.tokens || []).map((t: any) => ({
          id: String(t._id || t.id),
          tokenNo: String(t.tokenNo || ''),
          createdAt: String(t.createdAt || ''),
          patientName: String(t.patientId?.fullName || t.patientName || '-'),
          mrNo: String(t.patientId?.mrn || t.mrn || '-'),
          age: t.patientId?.age != null ? String(t.patientId.age) : (t.patientId?.patientAge != null ? String(t.patientId.patientAge) : undefined),
          patientId: t.patientId?._id != null ? String(t.patientId._id) : (t.patientId != null ? String(t.patientId) : undefined),
          encounterId: t.encounterId != null ? String(t.encounterId) : undefined,
        }))
        setTokens(items)
      } catch {
        setTokens([])
      }
    })()
  }, [from, to])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          if (String(from || '') !== todayIso || String(to || '') !== todayIso) { setLabSavedTokenIds([]); return }
          const mine = tokens.filter(t => !!t.encounterId)
          const checks = await Promise.all(
            mine.map(async (t) => {
              try {
                const res: any = await hospitalApi.getLabReportsEntry(String(t.encounterId))
                const doc = res?.labReportsEntry
                const has = !!(doc?._id) && (doc?.tests != null || doc?.labInformation != null || doc?.semenAnalysis != null || doc?.hxBy != null || doc?.hxDate != null)
                return has ? String(t.id) : ''
              } catch {
                return ''
              }
            })
          )
          const ids = checks.filter(Boolean)
          if (!cancelled) setLabSavedTokenIds(ids)
        } catch {
          if (!cancelled) setLabSavedTokenIds([])
        }
      })()
    return () => { cancelled = true }
  }, [tokens, from, to, todayIso])

  useEffect(() => {
    const tokenId = (searchParams.get('tokenId') || '').trim()
    if (!tokenId) return
    if (!tokens.length) return
    const exists = tokens.some(t => t.id === tokenId)
    if (!exists) return
    if (patientKey === tokenId) return
    setPatientKey(tokenId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, searchParams])

  const patients = useMemo(() => {
    const excludeSavedToday = String(from || '') === todayIso && String(to || '') === todayIso
    const savedSet = new Set(excludeSavedToday ? labSavedTokenIds.map(String) : [])
    const map = new Map<string, { key: string; label: string }>()
    for (const t of tokens) {
      const key = t.id
      if (!key) continue
      if (savedSet.has(String(key))) continue
      const label = `${t.tokenNo} - ${t.patientName} • ${t.mrNo}`
      if (!map.has(key)) map.set(key, { key, label })
    }
    return Array.from(map.values())
  }, [tokens, from, to, todayIso, labSavedTokenIds])

  const selectedToken = useMemo(() => tokens.find(t => t.id === patientKey) || null, [tokens, patientKey])
  const selectedEncounterId = selectedToken?.encounterId

  useEffect(() => {
    if (!patientKey) return
    const excludeSavedToday = String(from || '') === todayIso && String(to || '') === todayIso
    if (!excludeSavedToday) return
    if (!labSavedTokenIds.includes(String(patientKey))) return
    setPatientKey('')
    setPrevEntryId('')
    setPrevEntries([])
    setHxBy(currentUser)
    setHxDate(todayIso)
    setLabInformation(EMPTY_LAB_INFORMATION)
    setSemenAnalysis(EMPTY_SEMEN_ANALYSIS)
    setTests([{ testName: '', normalValue: '', result: '', status: '' }])
  }, [patientKey, labSavedTokenIds, from, to, todayIso])

  useEffect(() => {
    const encId = selectedEncounterId
    if (!encId) return
      ; (async () => {
        try {
          const res: any = await hospitalApi.getLabReportsEntry(encId)
          const doc = res?.labReportsEntry

          if (doc) {
            setHxBy(String(doc.hxBy || ''))
            setHxDate(String(doc.hxDate || todayIso))
            setLabInformation({ ...EMPTY_LAB_INFORMATION, ...(doc.labInformation || {}) })
            setSemenAnalysis({ ...EMPTY_SEMEN_ANALYSIS, ...(doc.semenAnalysis || {}) })
            const list = Array.isArray(doc.tests) ? doc.tests : []
            setTests(list.length ? (list as any) : [{ testName: '', normalValue: '', result: '', status: '' }])
          } else {
            setLabInformation(EMPTY_LAB_INFORMATION)
            setSemenAnalysis(EMPTY_SEMEN_ANALYSIS)
            setTests([{ testName: '', normalValue: '', result: '', status: '' }])
          }
        } catch {
          // keep current state
        }
      })()
  }, [selectedEncounterId])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setPrevEntries([])
          setPrevEntryId('')
          const pid = selectedToken?.patientId
          if (!pid) return
          const res: any = await hospitalApi.listLabReportsEntries({ patientId: pid, limit: 100 })
          const rows: PrevLabReportsEntry[] = (res?.labReportsEntries || []).map((r: any) => ({
            _id: String(r._id || r.id || ''),
            submittedAt: r.submittedAt ? String(r.submittedAt) : undefined,
            createdAt: r.createdAt ? String(r.createdAt) : undefined,
            hxBy: r.hxBy != null ? String(r.hxBy) : undefined,
            hxDate: r.hxDate != null ? String(r.hxDate) : undefined,
            labInformation: r.labInformation,
            semenAnalysis: r.semenAnalysis,
            tests: r.tests,
          })).filter((x: PrevLabReportsEntry) => !!x._id)
          if (!cancelled) setPrevEntries(rows)
        } catch {
          if (!cancelled) {
            setPrevEntries([])
            setPrevEntryId('')
          }
        }
      })()
    return () => { cancelled = true }
  }, [selectedToken?.patientId, selectedToken?.id])

  return (
    <div className="w-full px-2 sm:px-4">
      <div className="text-xl font-semibold text-slate-800">Lab Reports Entry</div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:flex sm:items-center sm:gap-2">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 sm:w-auto" />
            <span className="hidden text-slate-500 sm:inline">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 sm:w-auto" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => {
                const t = new Date().toISOString().slice(0, 10)
                setFrom(t)
                setTo(t)
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs hover:bg-slate-50 sm:w-auto sm:py-1"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs hover:bg-slate-50 sm:w-auto sm:py-1"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="hidden flex-1 sm:block" />

        <select
          value={prevEntryId}
          onChange={e => {
            const id = String(e.target.value || '')
            setPrevEntryId(id)
            const r = prevEntries.find((x: PrevLabReportsEntry) => x._id === id)
            if (!r) return
            setHxBy(String(r.hxBy || ''))
            setHxDate(String(r.hxDate || todayIso))
            setLabInformation({ ...EMPTY_LAB_INFORMATION, ...(r.labInformation || {}) })
            setSemenAnalysis({ ...EMPTY_SEMEN_ANALYSIS, ...(r.semenAnalysis || {}) })
            const list = Array.isArray(r.tests) ? r.tests : []
            setTests(list.length ? (list as any) : [{ testName: '', normalValue: '', result: '', status: '' }])
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs sm:w-auto"
          disabled={!selectedToken?.patientId || prevEntries.length === 0}
        >
          <option value="">Previous Entries</option>
          {prevEntries.map(r => {
            const when = r.submittedAt || r.createdAt || ''
            const label = when ? new Date(when).toLocaleString() : r._id
            return (
              <option key={r._id} value={r._id}>{label}</option>
            )
          })}
        </select>
      </div>

      <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Patient</label>
            <select
              value={patientKey}
              onChange={e => setPatientKey(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select patient</option>
              {patients.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-700">Reports Entered By</label>
            <div className="flex flex-wrap items-end gap-2">
              <input value={hxBy} disabled className="min-w-[180px] flex-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600" />
              <div>
                <label className="mb-1 block text-sm text-slate-700">Reports Entered at</label>
                <input type="date" value={hxDate} onChange={e => setHxDate(e.target.value)} className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">Lab Information</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-slate-700">Lab Name</label>
              <input
                value={labInformation.labName}
                onChange={e => setLabInformation(s => ({ ...s, labName: e.target.value }))}
                placeholder="Lab Name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">MR#</label>
              <input
                value={labInformation.mrNo}
                onChange={e => setLabInformation(s => ({ ...s, mrNo: e.target.value }))}
                placeholder="MR#"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Date</label>
              <input
                type="date"
                value={labInformation.date}
                onChange={e => setLabInformation(s => ({ ...s, date: e.target.value }))}
                placeholder="Date"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">Semen Analysis</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SEMEN_FIELDS.map(f => (
              <div key={String(f.key)}>
                <label className="mb-1 block text-sm text-slate-700">{f.label}</label>
                <input
                  type={f.key === 'date' ? 'date' : 'text'}
                  value={semenAnalysis[f.key]}
                  onChange={e => setSemenAnalysis(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.label}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-800">Lab Tests</div>
            <div />
          </div>

          <div className="mt-4 space-y-3">
            {tests.map((row, idx) => (
              <div key={idx}>
                <div className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm text-slate-700">Test Name</label>
                    <SuggestField
                      value={row.testName}
                      onChange={(v: string) =>
                        setTests(s =>
                          s.map((x, i) => {
                            if (i !== idx) return x
                            const prevKey = normalizeTestNameKey(x.testName)
                            const nextKey = normalizeTestNameKey(v)

                            const prevMapped = prevKey ? NORMAL_RANGES[prevKey] : undefined
                            const nextMapped = nextKey ? NORMAL_RANGES[nextKey] : undefined

                            const normalTrim = (x.normalValue || '').trim()
                            const canAutoOverwrite = !normalTrim || (!!prevMapped && normalTrim === prevMapped)
                            const nextNormal = (canAutoOverwrite && nextMapped) ? nextMapped : x.normalValue

                            return { ...x, testName: v, normalValue: nextNormal }
                          })
                        )
                      }
                      suggestions={TEST_SUGGESTIONS}
                      maxSuggestions={50}
                      placeholder="Select or type test name"
                      as="input"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Normal Value</label>
                    <input
                      value={row.normalValue}
                      onChange={e => setTests(s => s.map((x, i) => (i === idx ? { ...x, normalValue: e.target.value } : x)))}
                      placeholder="Auto-filled (editable)"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Result</label>
                    <input
                      value={row.result}
                      onChange={e => setTests(s => s.map((x, i) => (i === idx ? { ...x, result: e.target.value } : x)))}
                      placeholder="Enter result"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Flag/Status</label>
                    <SuggestField
                      value={row.status}
                      onChange={(v: string) => setTests(s => s.map((x, i) => (i === idx ? { ...x, status: v } : x)))}
                      suggestions={STATUS_SUGGESTIONS}
                      maxSuggestions={10}
                      placeholder="Select status"
                      as="input"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTests(s => [...s, { testName: '', normalValue: '', result: '', status: '' }])}
                    className="inline-flex items-center justify-center rounded-md border border-blue-800 px-2.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                    title="Add"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTests(s => (s.length === 1 ? s : s.filter((_, i) => i !== idx)))}
                    disabled={tests.length === 1}
                    className="inline-flex items-center justify-center rounded-md border border-rose-600 px-2.5 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    const missing: string[] = []
                    const encId = selectedEncounterId
                    if (!encId) missing.push('Patient')
                    if (!hxBy.trim()) missing.push('User not authenticated')
                    if (!hxDate.trim()) missing.push('Reports Entered at')

                    if (missing.length) {
                      showToast('error', `Please enter: ${missing.join(', ')}`)
                      return
                    }

                    // Extra narrowing for TypeScript
                    if (!encId) return

                    try {
                      setSaving(true)
                      await hospitalApi.upsertLabReportsEntry(encId, {
                        tokenId: selectedToken?.id,
                        hxBy,
                        hxDate,
                        labInformation,
                        semenAnalysis,
                        tests,
                      })
                      showToast('success', 'Submitted')
                      if (String(from || '') === todayIso && String(to || '') === todayIso && selectedToken?.id) {
                        setLabSavedTokenIds(s => (s.includes(String(selectedToken.id)) ? s : [...s, String(selectedToken.id)]))
                      }
                      resetAllFields()
                    } catch {
                      showToast('error', 'Failed to submit')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={
              toast.type === 'success'
                ? 'rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow'
                : 'rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow'
            }
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  )
}
