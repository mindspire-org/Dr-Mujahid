import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type Appointment = {
  _id: string
  appointmentType: 'OPD' | 'Diagnostic' | 'Therapy' | 'Counselling'
  status?: 'Scheduled' | 'Checked-In' | 'Completed' | 'Cancelled'
  appointmentDate?: string
  appointmentTime?: string
  patientMrn?: string
  patientName?: string
  patient?: { fullName?: string; mrn?: string }
  encounterId?: string
  doctorId?: any
  departmentId?: any
}

const startOfTodayIso = () => {
  const d = new Date()
  // Use local date to avoid timezone issues
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Counselling_Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Appointment[]>([])

  const todayIso = startOfTodayIso()

  const load = async () => {
    setLoading(true)
    try {
      console.log('Fetching appointments for date:', todayIso)
      const res: any = await hospitalApi.listAppointments({
        from: todayIso,
        to: todayIso,
        appointmentType: 'Counselling',
      })
      console.log('API Response:', res)
      const items: any[] = res?.appointments || res?.items || res || []
      console.log('Appointments items:', items)
      setRows(items.map((x: any) => ({
        _id: String(x._id || x.id || ''),
        appointmentType: x.appointmentType,
        status: x.status,
        appointmentDate: x.appointmentDate,
        appointmentTime: x.appointmentTime,
        patientMrn: x.patientMrn || x.patientId?.mrn,
        patientName: x.patientName || x.patientId?.fullName,
        patient: x.patientId,
        encounterId: x.encounterId,
        doctorId: x.doctorId,
        departmentId: x.departmentId,
      })).filter(r => r._id))
    } catch (e) {
      console.error('Error loading appointments:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

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

      // Store encounterId back on appointment for future sessions
      try { await hospitalApi.updateAppointment(appointment._id, { encounterId: String(encounterId) }) } catch {}

      navigate(`/counselling/session/${encodeURIComponent(String(encounterId))}`)
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Failed to open session'))
    }
  }

  const stats = useMemo(() => {
    const todaySessions = rows.length
    const pendingSessions = rows.filter(r => (r.status || 'Scheduled') !== 'Completed' && (r.status || 'Scheduled') !== 'Cancelled').length
    const completedSessions = rows.filter(r => r.status === 'Completed').length
    const followUps = rows.filter(r => String((r as any)?.followUp || '').trim()).length
    return { todaySessions, pendingSessions, completedSessions, followUps }
  }, [rows])

  const cards = [
    { title: 'Today Sessions', value: stats.todaySessions, tone: 'from-emerald-500 to-teal-600' },
    { title: 'Pending Sessions', value: stats.pendingSessions, tone: 'from-amber-500 to-orange-600' },
    { title: 'Completed Sessions', value: stats.completedSessions, tone: 'from-sky-500 to-indigo-600' },
    { title: 'Follow Ups', value: stats.followUps, tone: 'from-violet-500 to-fuchsia-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Counselling Dashboard</h2>
          <div className="text-sm text-slate-600 dark:text-slate-300">Overview for today</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/counselling/appointments')}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            View Appointments
          </button>
          <button
            onClick={() => void load()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-600 dark:text-slate-300">{c.title}</div>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{c.value}</div>
              <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${c.tone} opacity-80`} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-0 overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Today Sessions</div>
          <div className="text-sm text-slate-500">{loading ? 'Loading…' : `${rows.length} records`}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">MRN</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map(r => (
                <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.appointmentTime || '—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{r.patientMrn || r.patient?.mrn || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.patientName || r.patient?.fullName || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' :
                      r.status === 'Cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    }`}>
                      {r.status || 'Scheduled'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleOpenSession(r)}
                      className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                      Open Session
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">{loading ? 'Loading…' : 'No counselling appointments for today'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
