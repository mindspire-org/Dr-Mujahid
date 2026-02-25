function resolveKey(name: string) {
  const n = (name || '').toLowerCase()
  if (n.includes('ultrasound')) return 'Ultrasound'
  if (n.replace(/\s+/g, '') === 'ctscan') return 'CTScan'
  if (n.includes('echocardio')) return 'Echocardiography'
  if (n.includes('colonoscopy')) return 'Colonoscopy'
  if (n.includes('uppergi')) return 'UpperGiEndoscopy'
  if (n === 'stt' || n.includes('(stt)') || n.includes('stress tolerance')) return 'STT'
  if (n === 'npt' || n.includes('(npt)') || n.includes('nocturnal penile tumescence')) return 'NPT'
  if (n === 'pds' || n.includes('(pds)') || n.includes('penile doppler')) return 'PDS'
  return name
}
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { diagnosticApi } from '../../utils/api'
import { previewDiagnosticReportPdf } from '../../utils/printDiagnosticReport'
import type { ReportRow } from '../../utils/printDiagnosticReport'

type Result = { id: string; tokenNo?: string; testName: string; patient?: any; status: 'draft' | 'final'; reportedAt?: string; formData?: any; images?: string[]; createdAt?: string; orderId?: string; testId?: string }

function normalizeFormDataText(formData: any): string {
  if (formData == null) return ''
  if (typeof formData === 'string') return formData
  try { return JSON.stringify(formData) } catch { return String(formData) }
}

function parseSttFormData(text: string): { rows: Array<{ parameter: string; normalRange: string; result: string; flag: string }>; clinicalNote: string } | null {
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object') return null
    const rows = Array.isArray((v as any).rows) ? (v as any).rows : []
    const clinicalNote = typeof (v as any).clinicalNote === 'string' ? (v as any).clinicalNote : ''
    return {
      rows: rows.map((r: any) => ({
        parameter: String(r?.parameter || ''),
        normalRange: String(r?.normalRange || ''),
        result: String(r?.result || ''),
        flag: String(r?.flag || ''),
      })),
      clinicalNote,
    }
  } catch {
    return null
  }
}

function parseNptFormData(text: string): { rows: Array<{ parameter: string; referenceValue: string; result: string }>; masterFlag: string; clinicalNote: string } | null {
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object') return null
    const rows = Array.isArray((v as any).rows) ? (v as any).rows : []
    const clinicalNote = typeof (v as any).clinicalNote === 'string' ? (v as any).clinicalNote : ''
    const masterFlag = typeof (v as any).masterFlag === 'string' ? (v as any).masterFlag : ''
    return {
      rows: rows.map((r: any) => ({
        parameter: String(r?.parameter || ''),
        referenceValue: String(r?.referenceValue || ''),
        result: String(r?.result || ''),
      })),
      masterFlag,
      clinicalNote,
    }
  } catch {
    return null
  }
}

function parsePdsFormData(text: string): { rows: Array<{ d: string; sys1: string; sys2: string; dys1: string; dys2: string; dDeg: string; walk: string; inj: string; t: string; status: string }>; clinicalNote: string } | null {
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object') return null
    const rows = Array.isArray((v as any).rows) ? (v as any).rows : []
    const clinicalNote = typeof (v as any).clinicalNote === 'string' ? (v as any).clinicalNote : ''
    return {
      rows: rows.map((r: any) => ({
        d: String(r?.d || ''),
        sys1: String(r?.sys1 || ''),
        sys2: String(r?.sys2 || ''),
        dys1: String(r?.dys1 || ''),
        dys2: String(r?.dys2 || ''),
        dDeg: String(r?.dDeg || ''),
        walk: String(r?.walk || ''),
        inj: String(r?.inj || ''),
        t: String(r?.t || ''),
        status: String(r?.status || ''),
      })),
      clinicalNote,
    }
  } catch {
    return null
  }
}

export default function Diagnostic_ReportGenerator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'all' | 'draft' | 'final'>('all')
  const [rows, setRows] = useState(20)
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<Result[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [highlightId, setHighlightId] = useState<string>('')

  useEffect(() => {
    let mounted = true; (async () => {
      try {
        const res = await diagnosticApi.listResults({ q: q || undefined, from: from || undefined, to: to || undefined, status: status === 'all' ? undefined : status, page, limit: rows }) as any
        const arr: Result[] = (res.items || []).map((x: any) => ({
          id: String(x._id),
          tokenNo: x.tokenNo,
          testName: x.testName,
          patient: x.patient,
          status: x.status || 'draft',
          reportedAt: x.reportedAt,
          formData: x.formData,
          images: Array.isArray(x.images) ? x.images : (Array.isArray(x.formData?.images) ? x.formData.images : undefined),
          createdAt: x.createdAt,
          orderId: String(x.orderId || ''),
          testId: String(x.testId || ''),
        }))
        if (mounted) { setItems(arr); setTotal(Number(res.total || arr.length || 0)); setTotalPages(Number(res.totalPages || 1)) }
      } catch { if (mounted) { setItems([]); setTotal(0); setTotalPages(1) } }
    })(); return () => { mounted = false }
  }, [q, from, to, status, page, rows])

  // Support deep-linking: /diagnostic/report-generator?resultId=...
  useEffect(() => {
    let mounted = true; (async () => {
      const rid = searchParams.get('resultId') || ''
      if (!rid) { if (mounted) setHighlightId(''); return }
      try {
        const r: any = await diagnosticApi.getResult(rid)
        if (!mounted || !r) return
        setHighlightId(String(rid))
        const injected: Result = {
          id: String(r._id || rid),
          tokenNo: r.tokenNo,
          testName: r.testName,
          patient: r.patient,
          status: r.status || 'draft',
          reportedAt: r.reportedAt,
          formData: r.formData,
          images: Array.isArray(r.images) ? r.images : (Array.isArray(r.formData?.images) ? r.formData.images : undefined),
          createdAt: r.createdAt,
          orderId: String(r.orderId || ''),
          testId: String(r.testId || ''),
        }
        setItems(prev => prev.some(x => x.id === injected.id) ? prev : [injected, ...prev])
      } catch { if (mounted) setHighlightId('') }
    })(); return () => { mounted = false }
  }, [searchParams])

  const pageCount = Math.max(1, totalPages)
  const curPage = Math.min(page, pageCount)
  const start = Math.min((curPage - 1) * rows + 1, total)
  const end = Math.min((curPage - 1) * rows + items.length, total)

  async function printItem(r: Result) {
    const key = resolveKey(r.testName)
    const text = normalizeFormDataText(r.formData)
    let rows: ReportRow[] = []
    let interpretation = ''
    let flagStatus = ''
    let layout: any = undefined

    if (key === 'STT') {
      const parsed = parseSttFormData(text)
      if (parsed) {
        rows = (parsed.rows || []).map(x => ({
          test: x.parameter,
          normal: x.normalRange,
          unit: '',
          value: x.result,
          flag: (String(x.flag || '').toLowerCase() === 'high' || String(x.flag || '').toLowerCase() === 'low') ? 'abnormal' : (String(x.flag || '').toLowerCase() === 'normal' ? 'normal' : undefined),
          comment: String(x.flag || '').trim() || undefined,
        }))
        interpretation = parsed.clinicalNote || ''
      } else {
        rows = [{ test: r.testName, normal: '', unit: '', value: '' }]
        interpretation = text
      }
      layout = {
        table: {
          firstColHeader: 'Parameter',
          hideUnit: true,
          hideFlag: true,
          commentHeader: 'Flag',
        },
      }
    } else if (key === 'NPT') {
      const parsed = parseNptFormData(text)
      if (parsed) {
        rows = (parsed.rows || []).map(x => ({
          test: x.parameter,
          normal: String(x.referenceValue || '').replace(/[≥≤≠]/g, s => s === '≥' ? '>=' : s === '≤' ? '<=' : '!='),
          unit: '',
          value: x.result,
        }))
        flagStatus = String(parsed.masterFlag || '').trim()
        interpretation = parsed.clinicalNote || ''
      } else {
        rows = [{ test: r.testName, normal: '', unit: '', value: '' }]
        interpretation = text
      }
      layout = {
        table: {
          firstColHeader: 'Parameter',
          hideUnit: true,
          hideFlag: true,
        },
      }
    } else if (key === 'PDS') {
      const parsed = parsePdsFormData(text)
      if (parsed) {
        rows = [{ test: r.testName, normal: '', unit: '', value: '' }]
        interpretation = parsed.clinicalNote || ''
        const head: any[][] = [
          [
            { content: 'B + B\nD', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Sys', colSpan: 2 },
            { content: 'Dys', colSpan: 2 },
            { content: 'D°', rowSpan: 2 },
            { content: 'Walk', rowSpan: 2 },
            { content: 'Inj', rowSpan: 2 },
            { content: 'T', rowSpan: 2 },
            { content: 'Status', rowSpan: 2 },
          ],
          [
            { content: 'Sys' },
            { content: 'Sys' },
            { content: 'Dys' },
            { content: 'Dys' },
          ],
        ]
        const body: any[][] = (parsed.rows || []).map(x => [
          x.d,
          x.sys1,
          x.sys2,
          x.dys1,
          x.dys2,
          x.dDeg,
          x.walk,
          x.inj,
          x.t,
          x.status,
        ])

        layout = {
          table: {
            customTable: {
              head,
              body,
            },
          },
        }
      } else {
        rows = [{ test: r.testName, normal: '', unit: '', value: '' }]
        interpretation = text
      }
    } else {
      // For narrative-style diagnostics, keep lab-style layout but place the full text in Interpretation.
      rows = [{ test: r.testName, normal: '', unit: '', value: '' }]
      interpretation = text
    }

    await previewDiagnosticReportPdf({
      tokenNo: r.tokenNo || '-',
      createdAt: r.createdAt || r.reportedAt || new Date().toISOString(),
      sampleTime: r.createdAt || undefined,
      reportingTime: r.reportedAt || r.createdAt || undefined,
      patient: {
        fullName: r.patient?.fullName || '-',
        phone: r.patient?.phone || '',
        mrn: r.patient?.mrn || '',
        age: r.patient?.age || '',
        gender: r.patient?.gender || '',
        address: r.patient?.address || '',
      },
      rows,
      interpretation,
      flagStatus: flagStatus || undefined,
      referringConsultant: (r as any)?.patient?.referringConsultant,
      profileLabel: r.testName,
      layout,
    })
  }

  function editItem(r: Result) {
    const search = new URLSearchParams()
    search.set('resultId', r.id)
    if (r.orderId) search.set('orderId', String(r.orderId))
    if (r.testId) search.set('testId', String(r.testId))
    navigate(`/diagnostic/result-entry?${search.toString()}`)
  }

  async function deleteItem(r: Result) {
    if (!confirm('Delete this result?')) return
    try {
      await diagnosticApi.deleteResult(r.id)
      setItems(prev => prev.filter(x => x.id !== r.id))
    } catch { }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Report Generator</h2>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div className="min-w-[260px] flex-1">
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search by token, patient, or test..." className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1" />
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1" />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setStatus('all')} className={`rounded-md px-3 py-1.5 border ${status === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}>All</button>
            <button onClick={() => setStatus('draft')} className={`rounded-md px-3 py-1.5 border ${status === 'draft' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}>Draft</button>
            <button onClick={() => setStatus('final')} className={`rounded-md px-3 py-1.5 border ${status === 'final' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}>Final</button>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>Rows</span>
            <select value={rows} onChange={e => { setRows(Number(e.target.value)); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-1">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Token</th>
              <th className="px-4 py-2">Test</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className={`border-b border-slate-100 ${highlightId && r.id === highlightId ? 'bg-violet-50' : ''}`}>
                <td className="px-4 py-2 whitespace-nowrap">{new Date(r.createdAt || '').toLocaleDateString()} {new Date(r.createdAt || '').toLocaleTimeString()}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.patient?.fullName || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.tokenNo || '-'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.testName}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{r.status}</span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button onClick={() => printItem(r)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50">PDF</button>
                    <button onClick={() => editItem(r)} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-700">Edit</button>
                    <button onClick={() => deleteItem(r)} className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No results</div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>{total === 0 ? '0' : `${start}-${end}`} of {total}</div>
        <div className="flex items-center gap-2">
          <button disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Prev</button>
          <span>{curPage} / {pageCount}</span>
          <button disabled={curPage >= pageCount} onClick={() => setPage(p => p + 1)} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>

    </div>
  )
}
