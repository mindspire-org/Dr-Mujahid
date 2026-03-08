import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import { Search, User, Calendar, ArrowRight } from 'lucide-react'

type PrescriptionRow = {
  _id: string
  createdAt?: string
  encounterId?: any
  counselling?: any
  counsellingDiscount?: number
  patient?: any
}

export default function Counselling_History() {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const mrn = String(sp.get('mrn') || '').trim()

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PrescriptionRow[]>([])
  const [searchMrn, setSearchMrn] = useState('')

  const load = async () => {
    if (!mrn) { setRows([]); return }
    setLoading(true)
    try {
      const res: any = await hospitalApi.listPrescriptions({ patientMrn: mrn, page: 1, limit: 200 })
      const items: any[] = res?.prescriptions || res?.items || res || []
      const filtered = items
        .filter((p: any) => p?.counselling && typeof p.counselling === 'object')
        .map((p: any) => ({
          _id: String(p._id || p.id || ''),
          createdAt: p.createdAt,
          encounterId: p.encounterId,
          counselling: p.counselling,
          counsellingDiscount: p.counsellingDiscount,
          patient: p.encounterId?.patientId,
        }))
        .filter((x: any) => x._id)

      setRows(filtered)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [mrn])

  const handleSearch = () => {
    if (!searchMrn.trim()) return
    setSp({ mrn: searchMrn.trim() })
  }

  const header = useMemo(() => {
    if (!mrn) return 'Counselling History'
    return `Counselling History — Patient: ${mrn}`
  }, [mrn])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{header}</h2>
          <div className="text-sm text-slate-600 dark:text-slate-300">View previous counselling sessions for a patient</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/counselling/appointments')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to Appointments
          </button>
          {mrn && (
            <button
              onClick={() => void load()}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Search Patient Box */}
      {!mrn && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Search className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Search Patient History</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Enter patient MRN to view their counselling history</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={searchMrn}
              onChange={(e) => setSearchMrn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter MRN (e.g., MR123)"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              onClick={handleSearch}
              disabled={!searchMrn.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Search
            </button>
          </div>
        </div>
      )}

      {/* How it works info */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </div>
          <div>
            <p className="font-medium">How Counselling Portal Works:</p>
            <ol className="mt-2 ml-4 list-decimal space-y-1">
              <li>Go to <strong>Appointments</strong> page to see scheduled counselling sessions</li>
              <li>Click <strong>Open Session</strong> to start a counselling session</li>
              <li>Fill the counselling form and click <strong>Save</strong></li>
              <li>View patient history anytime by searching their MRN here</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {mrn && (
        <div className="rounded-xl border border-slate-200 bg-white p-0 overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Patient: {mrn}</span>
            </div>
            <div className="text-sm text-slate-500">{loading ? 'Loading…' : `${rows.length} records`}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 font-medium"><Calendar className="inline h-4 w-4 mr-1" /> Date</th>
                  <th className="px-3 py-2 font-medium">Counselling Notes</th>
                  <th className="px-3 py-2 font-medium">Risk Level</th>
                  <th className="px-3 py-2 font-medium">Discount</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map(r => (
                  <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-3">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-3 py-3 max-w-md">
                      <div className="truncate" title={r.counselling?.notes || r.counselling?.note || ''}>
                        {String(r.counselling?.notes || r.counselling?.note || '').slice(0, 100) || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.counselling?.riskLevel === 'High' || r.counselling?.riskLevel === 'Critical' 
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                          : r.counselling?.riskLevel === 'Medium'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      }`}>
                        {r.counselling?.riskLevel || 'Low'}
                      </span>
                    </td>
                    <td className="px-3 py-3">{r.counsellingDiscount != null ? `PKR ${r.counsellingDiscount}` : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => {
                          const encId = String(r.encounterId?._id || r.encounterId || '')
                          if (encId) navigate(`/counselling/session/${encodeURIComponent(encId)}`)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center dark:bg-slate-800">
                          <Search className="h-6 w-6 text-slate-400" />
                        </div>
                        <p>No counselling history found for this patient</p>
                        <p className="text-xs">Counselling sessions will appear here after they are saved</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
