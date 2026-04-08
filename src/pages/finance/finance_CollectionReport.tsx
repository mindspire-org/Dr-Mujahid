import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type Row = {
  pettyCashOwner: string
  date: string
  time: string
  customerSupplier: string
  customerSupplierNo: string
  invoiceNo: string
  transactionType: string
  transBy: string
  transactionNo: string
  credit: number
  debit: number
  balance: number
}

function fmtMoney(v: number) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function toCsvLines(lines: Array<Array<string | number>>) {
  return lines
    .map(arr => arr.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

const CSV_HEADERS = [
  'pettyCashOwner',
  'date',
  'time',
  'customerSupplier',
  'customerSupplierNo',
  'invoiceNo',
  'transactionType',
  'transBy',
  'transactionNo',
  'credit',
  'debit',
  'balance',
]

function rowToCsv(r: Row): Array<string | number> {
  return [
    r.pettyCashOwner,
    r.date,
    r.time,
    r.customerSupplier,
    r.customerSupplierNo,
    r.invoiceNo,
    r.transactionType,
    r.transBy,
    r.transactionNo,
    r.credit,
    r.debit,
    r.balance,
  ]
}

export default function Finance_CollectionReport() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [from, setFrom] = useState<string>('2026-01-01')
  const [to, setTo] = useState<string>(today)
  const [timeFrom, setTimeFrom] = useState<string>('')
  const [timeTo, setTimeTo] = useState<string>('')
  const [q, setQ] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'Customer' | 'Invoice' | 'Date' | 'Item'>('Customer')
  const [department, setDepartment] = useState<'All' | 'OPD' | 'Diagnostics' | 'Pharmacy' | 'Therapy' | 'Counselling' | 'Finance'>('All')
  const [reportType, setReportType] = useState<'Detailed' | 'Closing Balances' | 'Opening Balances'>('Detailed')
  const [rowsPerPage, setRowsPerPage] = useState<number>(50)
  const [page, setPage] = useState<number>(0)
  const [tick, setTick] = useState(0)
  const [all, setAll] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listCollectionReport({ department, reportType, from, to, timeFrom, timeTo, limit: 5000 })
        const items: Row[] = Array.isArray(res?.items) ? res.items : []
        if (!cancelled) setAll(items)
      } catch {
        if (!cancelled) setAll([])
      }
    })()
    return () => { cancelled = true }
  }, [from, to, timeFrom, timeTo, department, reportType, tick])

  useEffect(() => {
    setPage(0)
  }, [from, to, timeFrom, timeTo, department, reportType, q, rowsPerPage, groupBy])

  const filtered = useMemo(() => {
    if (!q) return all
    const needle = q.toLowerCase()
    return all.filter(r => {
      const hay = (
        groupBy === 'Customer'
          ? `${r.customerSupplier} ${r.customerSupplierNo}`
          : (groupBy === 'Invoice'
            ? `${r.invoiceNo}`
            : (groupBy === 'Date'
              ? `${r.date} ${r.time}`
              : `${r.transactionType} ${r.transactionNo}`
            )
          )
      ).toLowerCase()
      return hay.includes(needle)
    })
  }, [all, q, groupBy])

  const detailedRowsWithOpeningClosing = useMemo(() => {
    if (reportType !== 'Detailed') return filtered
    const byOwner = new Map<string, Row[]>()
    for (const r of filtered) {
      const key = String(r.pettyCashOwner || '').trim() || '-'
      const arr = byOwner.get(key) || []
      arr.push(r)
      byOwner.set(key, arr)
    }

    const owners = Array.from(byOwner.keys()).sort((a, b) => a.localeCompare(b))
    const out: Row[] = []
    const openingTime = timeFrom && /^\d{2}:\d{2}$/.test(timeFrom) ? timeFrom : '0:00'
    const closingTime = timeTo && /^\d{2}:\d{2}$/.test(timeTo) ? timeTo : '23:59'

    for (const owner of owners) {
      const rows = byOwner.get(owner) || []
      if (!rows.length) continue

      const first = rows[0]
      const openingDate = first.date
      const firstBalance = Number(first.balance || 0)
      const opening = firstBalance - Number(first.credit || 0) + Number(first.debit || 0)

      out.push({
        pettyCashOwner: owner,
        date: openingDate,
        time: openingTime,
        customerSupplier: '-',
        customerSupplierNo: '-',
        invoiceNo: '-',
        transactionType: 'Opening Balance',
        transBy: '-',
        transactionNo: '-',
        credit: 0,
        debit: 0,
        balance: opening,
      })

      out.push(...rows)

      const last = rows[rows.length - 1]
      const closingDate = last.date
      out.push({
        pettyCashOwner: owner,
        date: closingDate,
        time: closingTime,
        customerSupplier: '-',
        customerSupplierNo: '-',
        invoiceNo: '-',
        transactionType: 'Closing Balance',
        transBy: '-',
        transactionNo: '-',
        credit: 0,
        debit: 0,
        balance: Number(last.balance || 0),
      })
    }

    return out
  }, [filtered, reportType, from, to, timeFrom, timeTo])

  const detailedGroups = useMemo(() => {
    if (reportType !== 'Detailed') return [] as Array<{ owner: string; rows: Row[] }>
    const byOwner = new Map<string, Row[]>()
    for (const r of filtered) {
      const key = String(r.pettyCashOwner || '').trim() || '-'
      const arr = byOwner.get(key) || []
      arr.push(r)
      byOwner.set(key, arr)
    }

    const owners = Array.from(byOwner.keys()).sort((a, b) => a.localeCompare(b))
    const openingTime = timeFrom && /^\d{2}:\d{2}$/.test(timeFrom) ? timeFrom : '0:00'
    const closingTime = timeTo && /^\d{2}:\d{2}$/.test(timeTo) ? timeTo : '23:59'
    const groups: Array<{ owner: string; rows: Row[] }> = []

    for (const owner of owners) {
      const rows = byOwner.get(owner) || []
      if (!rows.length) continue

      const first = rows[0]
      const openingDate = first.date
      const firstBalance = Number(first.balance || 0)
      const opening = firstBalance - Number(first.credit || 0) + Number(first.debit || 0)

      const openingRow: Row = {
        pettyCashOwner: owner,
        date: openingDate,
        time: openingTime,
        customerSupplier: '-',
        customerSupplierNo: '-',
        invoiceNo: '-',
        transactionType: 'Opening Balance',
        transBy: '-',
        transactionNo: '-',
        credit: 0,
        debit: 0,
        balance: opening,
      }

      const last = rows[rows.length - 1]
      const closingDate = last.date
      const closingRow: Row = {
        pettyCashOwner: owner,
        date: closingDate,
        time: closingTime,
        customerSupplier: '-',
        customerSupplierNo: '-',
        invoiceNo: '-',
        transactionType: 'Closing Balance',
        transBy: '-',
        transactionNo: '-',
        credit: 0,
        debit: 0,
        balance: Number(last.balance || 0),
      }

      groups.push({ owner, rows: [openingRow, ...rows, closingRow] })
    }

    return groups
  }, [filtered, reportType, timeFrom, timeTo])

  const detailedPagedNodes = useMemo(() => {
    if (reportType !== 'Detailed') return { nodes: [] as any[], total: 0, showing: 0, pages: 1 }

    const blocks = detailedGroups.map((g, gi) => {
      const head = (
        <tr key={`hdr-${g.owner}-${gi}`} className="bg-slate-50 text-slate-700">
          <th className="px-4 py-2 font-medium">Petty Cash Owner</th>
          <th className="px-4 py-2 font-medium">Date</th>
          <th className="px-4 py-2 font-medium">Time</th>
          <th className="px-4 py-2 font-medium">Customer/Supplier</th>
          <th className="px-4 py-2 font-medium">Customer#/Supplier#</th>
          <th className="px-4 py-2 font-medium">Invoice#</th>
          <th className="px-4 py-2 font-medium">Transaction Type</th>
          <th className="px-4 py-2 font-medium">Trans. By</th>
          <th className="px-4 py-2 font-medium">Transaction#</th>
          <th className="px-4 py-2 font-medium text-right">Credit(Received)</th>
          <th className="px-4 py-2 font-medium text-right">Debit(Paid)</th>
          <th className="px-4 py-2 font-medium text-right">Balance</th>
        </tr>
      )

      const body = g.rows.map((r, idx) => {
        const isOpening = r.transactionType === 'Opening Balance'
        const isClosing = r.transactionType === 'Closing Balance'
        const isSummary = isOpening || isClosing
        return (
          <tr
            key={`${g.owner}-${r.transactionType}-${r.transactionNo}-${idx}`}
            className={
              isClosing
                ? 'bg-yellow-50'
                : (isOpening ? 'bg-slate-50/60' : 'hover:bg-slate-50/50')
            }
          >
            <td className={isSummary ? 'px-4 py-2 font-semibold' : 'px-4 py-2'}>{r.pettyCashOwner}</td>
            <td className="px-4 py-2">{r.date}</td>
            <td className="px-4 py-2">{r.time}</td>
            <td className="px-4 py-2">{r.customerSupplier}</td>
            <td className="px-4 py-2">{r.customerSupplierNo}</td>
            <td className="px-4 py-2">{r.invoiceNo}</td>
            <td className={isSummary ? 'px-4 py-2 font-semibold' : 'px-4 py-2'}>{r.transactionType}</td>
            <td className="px-4 py-2">{r.transBy}</td>
            <td className="px-4 py-2 font-mono">{r.transactionNo}</td>
            <td className="px-4 py-2 text-right">{Number(r.credit || 0) ? fmtMoney(Number(r.credit)) : '-'}</td>
            <td className="px-4 py-2 text-right">{Number(r.debit || 0) ? fmtMoney(Number(r.debit)) : '-'}</td>
            <td className={isSummary ? 'px-4 py-2 text-right font-semibold' : 'px-4 py-2 text-right'}>{fmtMoney(Number(r.balance || 0))}</td>
          </tr>
        )
      })

      const needsSeparator = gi < detailedGroups.length - 1
      const sep = needsSeparator
        ? (
          <tr key={`sep-${g.owner}-${gi}`} className="bg-white">
            <td colSpan={12} className="px-4 py-2" />
          </tr>
        )
        : null

      const nodes = sep ? [head, ...body, sep] : [head, ...body]
      return { len: nodes.length, nodes }
    })

    const total = blocks.reduce((s, b) => s + b.len, 0)
    const pages: Array<any[]> = []
    let cur: any[] = []
    let curLen = 0
    const limit = Math.max(1, rowsPerPage)
    for (const b of blocks) {
      if (curLen > 0 && curLen + b.len > limit) {
        pages.push(cur)
        cur = []
        curLen = 0
      }
      cur.push(...b.nodes)
      curLen += b.len
      if (curLen >= limit) {
        pages.push(cur)
        cur = []
        curLen = 0
      }
    }
    if (curLen > 0) pages.push(cur)
    const pagesCount = pages.length || 1
    const safePage = Math.max(0, Math.min(page, pagesCount - 1))
    const nodes = pages[safePage] || []
    return { nodes, total, showing: nodes.length, pages: pagesCount, safePage }
  }, [detailedGroups, reportType, page, rowsPerPage])

  const exportCsv = () => {
    let csv = ''
    if (reportType === 'Detailed') {
      const lines: Array<Array<string | number>> = []
      for (let i = 0; i < detailedGroups.length; i++) {
        if (i > 0) lines.push(Array(CSV_HEADERS.length).fill(''))
        lines.push(CSV_HEADERS)
        for (const r of detailedGroups[i].rows) lines.push(rowToCsv(r))
      }
      csv = toCsvLines(lines)
    } else {
      const lines: Array<Array<string | number>> = [CSV_HEADERS, ...detailedRowsWithOpeningClosing.map(rowToCsv)]
      csv = toCsvLines(lines)
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `collection_report_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 sm:py-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-2xl font-bold text-slate-800">Collection Report</div>
          <div className="text-sm text-slate-500">Petty cash collections, payments, and balances</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setTick(t => t + 1)} className="btn-outline-navy">Refresh</button>
          <button onClick={exportCsv} className="btn-outline-navy">Export CSV</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option>OPD</option>
              <option>Diagnostics</option>
              <option>Pharmacy</option>
              <option>Therapy</option>
              <option>Counselling</option>
              <option>Finance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Detailed</option>
              <option>Opening Balances</option>
              <option>Closing Balances</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From Time</label>
            <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To Time</label>
            <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Rows</label>
            <select value={rowsPerPage} onChange={e => setRowsPerPage(parseInt(e.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Group by</label>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Customer</option>
              <option>Invoice</option>
              <option>Date</option>
              <option>Item</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="owner, customer, invoice, txn..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="hidden lg:block lg:col-span-3" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800">Report</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            {reportType !== 'Detailed' && (
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-2 font-medium">Petty Cash Owner</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Customer/Supplier</th>
                  <th className="px-4 py-2 font-medium">Customer#/Supplier#</th>
                  <th className="px-4 py-2 font-medium">Invoice#</th>
                  <th className="px-4 py-2 font-medium">Transaction Type</th>
                  <th className="px-4 py-2 font-medium">Trans. By</th>
                  <th className="px-4 py-2 font-medium">Transaction#</th>
                  <th className="px-4 py-2 font-medium text-right">Credit(Received)</th>
                  <th className="px-4 py-2 font-medium text-right">Debit(Paid)</th>
                  <th className="px-4 py-2 font-medium text-right">Balance</th>
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {reportType === 'Detailed'
                ? detailedPagedNodes.nodes
                : detailedRowsWithOpeningClosing.slice(0, rowsPerPage).map((r, idx) => (
                  <tr key={`${r.transactionNo}-${idx}`} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2">{r.pettyCashOwner}</td>
                    <td className="px-4 py-2">{r.date}</td>
                    <td className="px-4 py-2">{r.time}</td>
                    <td className="px-4 py-2">{r.customerSupplier}</td>
                    <td className="px-4 py-2">{r.customerSupplierNo}</td>
                    <td className="px-4 py-2">{r.invoiceNo}</td>
                    <td className="px-4 py-2">{r.transactionType}</td>
                    <td className="px-4 py-2">{r.transBy}</td>
                    <td className="px-4 py-2 font-mono">{r.transactionNo}</td>
                    <td className="px-4 py-2 text-right">{Number(r.credit || 0) ? fmtMoney(Number(r.credit)) : '-'}</td>
                    <td className="px-4 py-2 text-right">{Number(r.debit || 0) ? fmtMoney(Number(r.debit)) : '-'}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(Number(r.balance || 0))}</td>
                  </tr>
                ))}
              {detailedRowsWithOpeningClosing.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">No report rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div>
            Showing {reportType === 'Detailed' ? detailedPagedNodes.showing : Math.min(rowsPerPage, detailedRowsWithOpeningClosing.length)} of {reportType === 'Detailed' ? detailedPagedNodes.total : detailedRowsWithOpeningClosing.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={reportType !== 'Detailed' ? true : (detailedPagedNodes.safePage || 0) <= 0}
              className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={reportType !== 'Detailed' ? true : (detailedPagedNodes.safePage || 0) >= (detailedPagedNodes.pages - 1)}
              className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
