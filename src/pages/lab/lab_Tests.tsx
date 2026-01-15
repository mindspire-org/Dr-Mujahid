import { useEffect, useMemo, useRef, useState } from 'react'
import { DollarSign, Search, Edit2, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import Lab_AddTestModal from '../../components/lab/lab_AddTestModal'
import type { LabTestFormValues } from '../../components/lab/lab_AddTestModal'
import { labApi } from '../../utils/api'

type LabTest = {
  id: string
  name: string
  price: number
  parameter?: string
  unit?: string
  normalRangeMale?: string
  normalRangeFemale?: string
  normalRangePediatric?: string
  parameters?: Array<{ name: string; unit?: string; normalRangeMale?: string; normalRangeFemale?: string; normalRangePediatric?: string }>
  createdAt: string
}

type ImportRow = {
  name: string
  price: number
  parameter?: string
  unit?: string
  normalRangeMale?: string
  normalRangeFemale?: string
  normalRangePediatric?: string
  parameters?: Array<{ name: string; unit?: string; normalRangeMale?: string; normalRangeFemale?: string; normalRangePediatric?: string }>
  _error?: string
}

function formatPKR(n: number) {
  try { return n.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }) } catch { return `PKR ${n.toFixed(2)}` }
}

export default function Lab_Tests() {
  const [tests, setTests] = useState<LabTest[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importKind, setImportKind] = useState<'csv'>('csv')
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importBusy, setImportBusy] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; skipped: number; failed: number } | null>(null)
  const [importMsg, setImportMsg] = useState<string>('')

  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<LabTest | null>(null)

  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState(12)
  const [page, setPage] = useState(1)
  const [tick, setTick] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; kind: 'success'|'error' } | null>(null)

  const normalizeKey = (s: any) => String(s ?? '').trim().toLowerCase()
  const toNum = (v: any) => {
    const n = Number(String(v ?? '').replace(/[^0-9.\-]/g,''))
    return Number.isFinite(n) ? n : 0
  }

  const idxAny = (header: string[], keys: string[]) => {
    const norm = (v: any) => normalizeKey(v)
    for (const k of keys) {
      const i = header.findIndex(h => h === norm(k))
      if (i >= 0) return i
    }
    return -1
  }

  const splitCsvLine = (line: string) => {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; continue }
        inQ = !inQ
        continue
      }
      if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue }
      cur += ch
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  const parseCsv = (csvText: string): ImportRow[] => {
    const lines = String(csvText || '').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l => l.trim().length)
    if (!lines.length) return []
    const rows2d = lines.map(splitCsvLine)
    return parseSheetRows(rows2d)
  }

  const parseSheetRows = (rows: any[][]): ImportRow[] => {
    const norm = (v: any) => normalizeKey(v)
    const headerRow = Array.isArray(rows?.[0]) ? rows[0] : []
    const header = headerRow.map(h => norm(h))
    const hasHeader = header.some(h => ['name','test','testname','test name','price','rate','amount','parameter','param'].includes(h))

    const iName = hasHeader ? idxAny(header, ['name','test','testname','test name','test_name']) : 0
    const iPrice = hasHeader ? idxAny(header, ['price','rate','amount','charges','charge']) : 1
    const iParameter = hasHeader ? idxAny(header, ['parameter','param']) : -1
    const iUnit = hasHeader ? idxAny(header, ['unit']) : -1
    const iMale = hasHeader ? idxAny(header, ['normalrangemale','normal (male)','normal male','male range','male_range','male']) : -1
    const iFemale = hasHeader ? idxAny(header, ['normalrangefemale','normal (female)','normal female','female range','female_range','female']) : -1
    const iPed = hasHeader ? idxAny(header, ['normalrangepediatric','normal (pediatric)','normal pediatric','pediatric range','child range','child_range','pediatric','child']) : -1
    const iParams = hasHeader ? idxAny(header, ['parameters']) : -1

    const start = hasHeader ? 1 : 0

    const hasGroupedParam = hasHeader && iParameter >= 0
    if (hasGroupedParam) {
      const map = new Map<string, ImportRow>()
      let lastTest = ''
      for (let r = start; r < (rows?.length || 0); r++) {
        const row = rows[r] || []
        const rawTest = String(row[iName] ?? '').trim()
        const testName = rawTest || lastTest
        if (rawTest) lastTest = rawTest
        if (!testName) continue

        const key = normalizeKey(testName)
        let item = map.get(key)
        if (!item) {
          item = { name: testName, price: toNum(row[iPrice]), parameters: [] }
          map.set(key, item)
        } else if (!item.price) {
          const p = toNum(row[iPrice])
          if (p) item.price = p
        }

        const paramName = String(row[iParameter] ?? '').trim()
        if (paramName) {
          const unit = iUnit >= 0 ? String(row[iUnit] ?? '').trim() : ''
          const male = iMale >= 0 ? String(row[iMale] ?? '').trim() : ''
          const female = iFemale >= 0 ? String(row[iFemale] ?? '').trim() : ''
          const ped = iPed >= 0 ? String(row[iPed] ?? '').trim() : ''
          item.parameters = Array.isArray(item.parameters) ? item.parameters : []
          item.parameters.push({
            name: paramName,
            unit: unit || undefined,
            normalRangeMale: male || undefined,
            normalRangeFemale: female || undefined,
            normalRangePediatric: ped || undefined,
          })
        }

        if (iParams >= 0 && row[iParams] != null && String(row[iParams]).trim()) {
          try {
            const parsed = JSON.parse(String(row[iParams]))
            if (Array.isArray(parsed)) {
              item.parameters = Array.isArray(item.parameters) ? item.parameters : []
              item.parameters.push(...parsed)
            }
          } catch {}
        }
      }
      const out = Array.from(map.values()).map(x => ({ ...x, price: Number(x.price || 0) }))
      out.forEach(x => { if (!x.name) x._error = 'Missing name' })
      return out
    }

    const out: ImportRow[] = []
    for (let r = start; r < (rows?.length || 0); r++) {
      const row = rows[r] || []
      const name = String(row[iName] ?? '').trim()
      const price = toNum(row[iPrice])
      const item: ImportRow = {
        name,
        price,
        parameter: iParameter >= 0 ? String(row[iParameter] ?? '').trim() : undefined,
        unit: iUnit >= 0 ? String(row[iUnit] ?? '').trim() : undefined,
        normalRangeMale: iMale >= 0 ? String(row[iMale] ?? '').trim() : undefined,
        normalRangeFemale: iFemale >= 0 ? String(row[iFemale] ?? '').trim() : undefined,
        normalRangePediatric: iPed >= 0 ? String(row[iPed] ?? '').trim() : undefined,
      }
      if (iParams >= 0 && row[iParams] != null && String(row[iParams]).trim()) {
        try {
          const parsed = JSON.parse(String(row[iParams]))
          if (Array.isArray(parsed)) item.parameters = parsed
        } catch {}
      }
      if (!item.name) item._error = 'Missing name'
      out.push(item)
    }
    return out
  }

  const parseExcel = async (file: File): Promise<ImportRow[]> => {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const first = wb.SheetNames?.[0]
    if (!first) return []
    const sheet = wb.Sheets[first]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][]
    const parsed = parseSheetRows(rows)
    return parsed
  }

  const beginImportRows = (kind: 'csv', rows: ImportRow[]) => {
    setImportKind(kind)
    const cleaned = (rows || []).map(r => ({
      ...r,
      name: String(r.name || '').trim(),
      price: Number.isFinite(Number(r.price)) ? Number(r.price) : 0,
    }))
    setImportRows(cleaned)
    setImportProgress(null)
    setImportMsg('')
    setImportOpen(true)
  }

  const onPickFile = async (file?: File | null) => {
    if (!file) return
    const name = String(file.name || '')
    const ext = name.toLowerCase().split('.').pop() || ''
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const rows = await parseExcel(file)
        beginImportRows('csv', rows)
      } else {
        const txt = await file.text()
        const rows = parseCsv(txt)
        beginImportRows('csv', rows)
      }
    } catch (e: any) {
      setNotice({ text: e?.message || 'Failed to read file', kind: 'error' })
    } finally {
      try { if (fileInputRef.current) fileInputRef.current.value = '' } catch {}
    }
  }

  const performImport = async () => {
    if (importBusy) return
    const rows = importRows
    if (!rows.length) { setImportOpen(false); return }
    setImportBusy(true)
    try {
      const existing = new Set<string>()
      try {
        const all = await loadAllForExport(undefined).catch(()=>[])
        all.forEach(t => existing.add(normalizeKey(t.name)))
      } catch {}

      let done = 0, skipped = 0, failed = 0
      const totalN = rows.length
      setImportProgress({ done, total: totalN, skipped, failed })

      for (const r of rows) {
        done++
        const name = String(r.name || '').trim()
        if (!name || r._error) {
          failed++
          setImportProgress({ done, total: totalN, skipped, failed })
          continue
        }
        if (existing.has(normalizeKey(name))) {
          skipped++
          setImportProgress({ done, total: totalN, skipped, failed })
          continue
        }
        try {
          await labApi.createTest({
            name,
            price: Number(r.price || 0),
            parameter: r.parameter || undefined,
            unit: r.unit || undefined,
            normalRangeMale: r.normalRangeMale || undefined,
            normalRangeFemale: r.normalRangeFemale || undefined,
            normalRangePediatric: r.normalRangePediatric || undefined,
            parameters: r.parameters || [],
          })
          existing.add(normalizeKey(name))
        } catch {
          failed++
        }
        setImportProgress({ done, total: totalN, skipped, failed })
      }

      setNotice({ text: `Import done. Added ${Math.max(0, totalN - skipped - failed)} tests, skipped ${skipped}, failed ${failed}.`, kind: failed ? 'error' : 'success' })
      setTick(t=>t+1)
      setImportOpen(false)
    } finally {
      setImportBusy(false)
    }
  }

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try {
        const res = await labApi.listTests({ q: q || undefined, page, limit: pageSize })
        if (!mounted) return
        const list: LabTest[] = (res.items||[]).map((x:any)=>({
          id: x._id,
          name: x.name,
          price: Number(x.price||0),
          parameter: x.parameter,
          unit: x.unit,
          normalRangeMale: x.normalRangeMale,
          normalRangeFemale: x.normalRangeFemale,
          normalRangePediatric: x.normalRangePediatric,
          parameters: Array.isArray(x.parameters)? x.parameters : [],
          createdAt: x.createdAt || new Date().toISOString(),
        }))
        setTests(list)
        setTotal(Number(res.total||list.length||0))
        setTotalPages(Number(res.totalPages||1))
      } catch (e){ console.error(e); setTests([]); setTotal(0); setTotalPages(1) }
    })()
    return ()=>{ mounted = false }
  }, [q, page, pageSize, tick])

  const filtered = useMemo(() => tests, [tests])

  const pageCount = totalPages
  const currentPage = Math.min(page, pageCount)
  const start = Math.min((currentPage - 1) * pageSize + 1, total)
  const end = Math.min((currentPage - 1) * pageSize + filtered.length, total)
  const pageItems = filtered

  const onSave = async (values: LabTestFormValues) => {
    if (editing) {
      await labApi.updateTest(editing.id, {
        name: values.name,
        price: Number(values.price || 0),
        parameter: values.parameter,
        unit: values.unit,
        normalRangeMale: values.normalRangeMale,
        normalRangeFemale: values.normalRangeFemale,
        normalRangePediatric: values.normalRangePediatric,
        parameters: values.parameters || [],
      })
      setEditing(null)
    } else {
      await labApi.createTest({
        name: values.name,
        price: Number(values.price || 0),
        parameter: values.parameter,
        unit: values.unit,
        normalRangeMale: values.normalRangeMale,
        normalRangeFemale: values.normalRangeFemale,
        normalRangePediatric: values.normalRangePediatric,
        parameters: values.parameters || [],
      })
    }
    setOpenModal(false)
    setTick(t=>t+1)
  }

  const requestDelete = (id: string) => { setDeleteId(id); setDeleteOpen(true) }
  const performDelete = async () => {
    const id = deleteId; if (!id) { setDeleteOpen(false); return }
    try { await labApi.deleteTest(id); setTick(t=>t+1); setNotice({ text: 'Test deleted', kind: 'success' }) }
    catch(e){ console.error(e); setNotice({ text: 'Failed to delete test', kind: 'error' }) }
    finally { setDeleteOpen(false); setDeleteId(null); try { setTimeout(()=> setNotice(null), 2500) } catch {} }
  }

  const loadAllForExport = async (query?: string): Promise<LabTest[]> => {
    const limit = 200
    let p = 1
    const all: LabTest[] = []
    while (true) {
      try {
        const res: any = await labApi.listTests({ q: query || undefined, page: p, limit })
        const items = res?.items || []
        const mapped: LabTest[] = items.map((x: any) => ({
          id: x._id,
          name: x.name,
          price: Number(x.price || 0),
          parameter: x.parameter,
          unit: x.unit,
          normalRangeMale: x.normalRangeMale,
          normalRangeFemale: x.normalRangeFemale,
          normalRangePediatric: x.normalRangePediatric,
          parameters: Array.isArray(x.parameters) ? x.parameters : [],
          createdAt: x.createdAt || new Date().toISOString(),
        }))
        all.push(...mapped)
        const totalPages = Number(res?.totalPages || 1)
        if (p >= totalPages || items.length === 0) break
        p++
      } catch {
        break
      }
    }
    return all
  }

  const exportCSV = async () => {
    const escape = (v: any) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const data = await loadAllForExport(undefined).catch(()=> [])
    if (!data.length) {
      setNotice({ text: 'No tests available to export', kind: 'error' })
      try { setTimeout(()=> setNotice(null), 2500) } catch {}
      return
    }
    const header = ['Test Name','Price','Parameter','Unit','Normal (Male)','Normal (Female)','Normal (Pediatric)'].map(escape).join(',')
    const outLines: string[] = []
    data.forEach(t => {
      const params = Array.isArray(t.parameters) ? t.parameters : []
      if (params.length) {
        params.forEach((p, idx) => {
          outLines.push([
            idx === 0 ? t.name : '',
            idx === 0 ? (t.price ?? 0).toFixed(2) : '',
            p?.name || '',
            p?.unit || '',
            p?.normalRangeMale || t.normalRangeMale || '',
            p?.normalRangeFemale || t.normalRangeFemale || '',
            p?.normalRangePediatric || t.normalRangePediatric || '',
          ].map(escape).join(','))
        })
      } else {
        outLines.push([
          t.name,
          (t.price ?? 0).toFixed(2),
          t.parameter || '',
          t.unit || '',
          t.normalRangeMale || '',
          t.normalRangeFemale || '',
          t.normalRangePediatric || '',
        ].map(escape).join(','))
      }
    })
    const csv = header + '\n' + outLines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lab-tests-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`rounded-md border px-3 py-2 text-sm ${notice.kind==='success'? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.text}</div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input value={q} onChange={e=>{ setQ(e.target.value); setPage(1) }} placeholder="Search tests.." className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportCSV} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Download CSV</button>
            <button
              type="button"
              onClick={()=> fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" /> Import CSV/XLSX
            </button>
            <button onClick={()=>{ setEditing(null); setOpenModal(true) }} className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800">
              <Plus className="h-4 w-4" /> Add Test
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e)=> onPickFile(e.target.files?.[0] || null)}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pageItems.map(t => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.parameter || '—'}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="inline-flex items-center gap-2"><DollarSign className="h-4 w-4" /> {formatPKR(t.price)}</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={()=>{ setEditing(t); setOpenModal(true) }} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"><Edit2 className="h-4 w-4" /> Edit</button>
              <button onClick={()=> requestDelete(t.id)} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <div>{total === 0 ? '0' : `${start}-${end}`} of {total}</div>
        <div className="flex items-center gap-1">
          <button onClick={()=>setPage(1)} disabled={currentPage===1} className="rounded-md border border-slate-300 p-1 disabled:opacity-40 dark:border-slate-600"><ChevronsLeft className="h-4 w-4"/></button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="rounded-md border border-slate-300 p-1 disabled:opacity-40 dark:border-slate-600"><ChevronLeft className="h-4 w-4"/></button>
          <span className="px-2">Page {currentPage} / {pageCount}</span>
          <button onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={currentPage===pageCount} className="rounded-md border border-slate-300 p-1 disabled:opacity-40 dark:border-slate-600"><ChevronRight className="h-4 w-4"/></button>
          <button onClick={()=>setPage(pageCount)} disabled={currentPage===pageCount} className="rounded-md border border-slate-300 p-1 disabled:opacity-40 dark:border-slate-600"><ChevronsRight className="h-4 w-4"/></button>
        </div>
      </div>

      <Lab_AddTestModal
        open={openModal}
        onClose={() => { setOpenModal(false); setEditing(null) }}
        onSave={onSave}
        initial={editing ? {
          name: editing.name,
          price: String(editing.price ?? 0),
          parameter: editing.parameter,
          unit: editing.unit,
          normalRangeMale: editing.normalRangeMale,
          normalRangeFemale: editing.normalRangeFemale,
          normalRangePediatric: editing.normalRangePediatric,
          parameters: editing.parameters || [],
        } : undefined}
      />

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">Confirm Delete</div>
            <div className="px-5 py-4 text-sm text-slate-700">Delete this test?</div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={()=>{ setDeleteOpen(false); setDeleteId(null) }} className="btn-outline-navy">Cancel</button>
              <button onClick={performDelete} className="btn bg-rose-600 hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">Import {importKind.toUpperCase()}</div>
            <div className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
              {importMsg ? <div className="mb-2 text-slate-600 dark:text-slate-300">{importMsg}</div> : null}
              <div className="mb-2">Preview ({importRows.length} rows)</div>
              <div className="max-h-[45vh] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full table-fixed border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-700">Name</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-700">Price</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-700">Parameter</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-700">Unit</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-700">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 200).map((r, i) => {
                      const firstParam = Array.isArray(r.parameters) && r.parameters.length ? r.parameters[0] : null
                      const paramOut = r.parameter || firstParam?.name || ''
                      const unitOut = r.unit || firstParam?.unit || ''
                      return (
                      <tr key={i} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/40">
                        <td className="border-b border-slate-100 px-2 py-1 dark:border-slate-800">{r.name || ''}</td>
                        <td className="border-b border-slate-100 px-2 py-1 dark:border-slate-800">{Number(r.price||0).toFixed(2)}</td>
                        <td className="border-b border-slate-100 px-2 py-1 dark:border-slate-800">{paramOut}</td>
                        <td className="border-b border-slate-100 px-2 py-1 dark:border-slate-800">{unitOut}</td>
                        <td className="border-b border-slate-100 px-2 py-1 text-rose-600 dark:border-slate-800">{r._error || ''}</td>
                      </tr>
                      )
                    })}
                    {importRows.length > 200 && (
                      <tr><td colSpan={5} className="px-2 py-2 text-center text-slate-500">Showing first 200 rows</td></tr>
                    )}
                    {importRows.length === 0 && (
                      <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">No rows detected</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {importProgress && (
                <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  Progress: {importProgress.done}/{importProgress.total} | Skipped: {importProgress.skipped} | Failed: {importProgress.failed}
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                CSV expected headers: Name, Price, Parameter, Unit, NormalRangeMale, NormalRangeFemale, NormalRangePediatric, Parameters(JSON)
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
              <button onClick={()=>{ if (!importBusy) setImportOpen(false) }} className="btn-outline-navy">Cancel</button>
              <button disabled={importBusy || importRows.length===0} onClick={performImport} className="btn">{importBusy ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
