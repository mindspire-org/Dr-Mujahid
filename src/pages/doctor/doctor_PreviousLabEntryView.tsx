import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

export default function Doctor_PreviousLabEntryView(){
  const navigate = useNavigate()
  const { id } = useParams() as any
  const location = useLocation() as any
  const [loading, setLoading] = useState(false)
  const [row, setRow] = useState<any>(location?.state?.entry || null)
  const [patient] = useState<any>(location?.state?.patient || null)

  const title = useMemo(() => {
    const nm = patient?.name ? String(patient.name) : 'Patient'
    const mrn = patient?.mrn ? String(patient.mrn) : ''
    return mrn ? `${nm} (MR: ${mrn})` : nm
  }, [patient])

  useEffect(() => {
    if (row || !id) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const patientId = new URLSearchParams(location?.search || '').get('patientId') || ''
        if (patientId) {
          try {
            const rr: any = await hospitalApi.listLabReportsEntries({ patientId, limit: 200 })
            const found = (rr?.labReportsEntries || []).find((x: any) => String(x?._id || x?.id || '') === String(id))
            if (!cancelled && found) setRow(found)
          } catch {}
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, row, location?.search])

  const data = row || {}

  return (
    <div className="w-full px-2 sm:px-4">
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">Previous Lab Entry</div>
          <div className="text-sm text-slate-600">{title}</div>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
        >
          Back
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        {loading && <div className="text-sm text-slate-700">Loading...</div>}
        {!loading && !row && <div className="text-sm text-slate-700">Not found.</div>}

        {!!row && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Entered By</div>
                <div className="text-sm font-semibold text-slate-900">{String(data?.hxBy || '-')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Entered On</div>
                <div className="text-sm font-semibold text-slate-900">{String(data?.hxDate || '-')}</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-800">Raw Data</div>
              <pre className="mt-2 max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{JSON.stringify(data || {}, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
