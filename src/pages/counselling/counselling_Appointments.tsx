import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type Filter = 'today' | 'upcoming' | 'in-progress' | 'completed'

type Appointment = {
  _id: string
  status?: 'Scheduled' | 'Checked-In' | 'Completed' | 'Cancelled'
  appointmentDate?: string
  appointmentTime?: string
  patientMrn?: string
  patientName?: string
  patient?: { fullName?: string; mrn?: string }
  encounterId?: string
  counsellingSaved?: boolean
  doctorId?: any
  departmentId?: any
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

export default function Counselling_Appointments() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('today')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Appointment[]>([])

  const dateRange = useMemo(() => {
    const now = new Date()
    const from = new Date(now)
    const to = new Date(now)

    if (filter === 'today') {
      // today only
    } else if (filter === 'upcoming') {
      from.setDate(from.getDate() + 1) // Start from tomorrow
      to.setDate(to.getDate() + 14)  // Up to 14 days ahead
    } else if (filter === 'in-progress') {
      // in-progress shows today's checked-in appointments
    } else if (filter === 'completed') {
      from.setDate(from.getDate() - 14) // Last 14 days
    }

    return { from: isoDate(from), to: isoDate(to) }
  }, [filter])

  const load = async () => {
    setLoading(true)
    try {
      // Build status filter based on tab
      let statusFilter: 'Scheduled' | 'Checked-In' | 'Completed' | 'Cancelled' | undefined
      if (filter === 'completed') {
        statusFilter = 'Completed'
      } else if (filter === 'upcoming') {
        statusFilter = 'Scheduled' // Upcoming only shows Scheduled
      } else if (filter === 'in-progress') {
        statusFilter = 'Checked-In' // In Progress shows Checked-In
      }
      // 'today' shows all (Scheduled, Checked-In, etc.)
      
      const res: any = await hospitalApi.listAppointments({
        from: dateRange.from,
        to: dateRange.to,
        appointmentType: 'Counselling',
        status: statusFilter,
      })
      const items: any[] = res?.appointments || res?.items || res || []
      setRows(items.map((x: any) => ({
        _id: String(x._id || x.id || ''),
        status: x.status,
        appointmentDate: x.appointmentDate,
        appointmentTime: x.appointmentTime,
        patientMrn: x.patientMrn || x.patientId?.mrn,
        patientName: x.patientName || x.patientId?.fullName,
        patient: x.patientId,
        encounterId: x.encounterId,
        counsellingSaved: x.counsellingSaved || false,
        doctorId: x.doctorId,
        departmentId: x.departmentId,
      })).filter(r => r._id))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [filter])

  const handleOpenSession = async (appointment: Appointment) => {
    if (!appointment._id) return
    
    try {
      // If encounter already exists, navigate directly
      if (appointment.encounterId) {
        navigate(`/counselling/session/${encodeURIComponent(appointment.encounterId)}`)
        return
      }
      
      // Create OPD encounter (compatible with prescription/history-taking APIs)
      const patientId = (appointment as any)?.patient?._id || (appointment as any)?.patientId?._id || (appointment as any)?.patientId
      const departmentId = appointment.departmentId?._id || appointment.departmentId
      const doctorId = appointment.doctorId?._id || appointment.doctorId
      if (!patientId || !departmentId) {
        alert('Missing patient/department for this appointment')
        return
      }

      const encRes: any = await hospitalApi.createOPDEncounter({
        patientId: String(patientId),
        departmentId: String(departmentId),
        doctorId: doctorId ? String(doctorId) : undefined,
        visitType: 'new',
      })
      const encounterId = encRes?.encounter?._id || encRes?._id
      if (!encounterId) {
        alert('Failed to create OPD encounter')
        return
      }

      // Store encounterId and update status to 'Checked-In' (In Progress)
      try { 
        await hospitalApi.updateAppointment(appointment._id, { 
          encounterId: String(encounterId),
          status: 'Checked-In'
        }) 
      } catch {}

      navigate(`/counselling/session/${encodeURIComponent(String(encounterId))}`)
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Failed to open session'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Counselling Appointments</h2>
          <div className="text-sm text-slate-600 dark:text-slate-300">Appointments where type is Counselling</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            <button onClick={() => setFilter('today')} className={`px-3 py-2 text-sm ${filter === 'today' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>Today</button>
            <button onClick={() => setFilter('upcoming')} className={`px-3 py-2 text-sm ${filter === 'upcoming' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>Upcoming</button>
            <button onClick={() => setFilter('in-progress')} className={`px-3 py-2 text-sm ${filter === 'in-progress' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>In Progress</button>
            <button onClick={() => setFilter('completed')} className={`px-3 py-2 text-sm ${filter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>Completed</button>
          </div>

          <button
            onClick={() => void load()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-0 overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Appointments</div>
          <div className="text-sm text-slate-500">{loading ? 'Loading…' : `${rows.length} records`}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <tr>
                <th className="px-3 py-2 font-medium">Date/Time</th>
                <th className="px-3 py-2 font-medium">MRN</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map(r => (
                <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    <div className="font-medium">{r.appointmentDate || '—'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{r.appointmentTime || ''}</div>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{r.patientMrn || r.patient?.mrn || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.patientName || r.patient?.fullName || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' :
                      r.status === 'Checked-In' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' :
                      r.status === 'Cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    }`}>
                      {r.status === 'Checked-In' ? 'In Progress' : (r.status || 'Scheduled')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.counsellingSaved ? (
                        <>
                          <button
                            onClick={() => navigate(`/counselling/session/${encodeURIComponent(r.encounterId!)}`)}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => window.open(`/counselling/session/${encodeURIComponent(r.encounterId!)}/print`, '_blank')}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Print
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenSession(r)}
                          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                        >
                          Open Session
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">{loading ? 'Loading…' : 'No appointments found'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
