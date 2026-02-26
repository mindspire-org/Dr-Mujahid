import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

function todayIso(){ return new Date().toISOString().slice(0,10) }

type Doctor = { id: string; name: string; primaryDepartmentId?: string; departmentIds?: string[]; opdBaseFee?: number; opdFollowupFee?: number }

type Schedule = {
  _id: string
  doctorId: string
  departmentId?: string
  dateIso: string
  startTime: string
  endTime: string
  slotMinutes: number
  fee?: number
  followupFee?: number
  notes?: string
}

export default function Hospital_DoctorSchedules(){
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; opdBaseFee?: number; opdFollowupFee?: number }>>([])
  const [doctorId, setDoctorId] = useState('')
  const [dateIso, setDateIso] = useState(todayIso())
  const [rows, setRows] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ departmentId: '', startTime: '09:00', endTime: '12:00', slotMinutes: '30', fee: '', followupFee: '', notes: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(()=> setToast(null), 1800)
  }

  useEffect(()=>{ (async()=>{
    try{
      const [docRes, depRes] = await Promise.all([ hospitalApi.listDoctors() as any, hospitalApi.listDepartments() as any ])
      setDoctors(((docRes?.doctors)||[]).map((d:any)=>({
        id: String(d._id),
        name: d.name,
        primaryDepartmentId: d.primaryDepartmentId ? String(d.primaryDepartmentId) : undefined,
        departmentIds: Array.isArray(d.departmentIds) ? d.departmentIds.map((x: any)=> String(x)) : undefined,
        opdBaseFee: d.opdBaseFee != null ? Number(d.opdBaseFee) : undefined,
        opdFollowupFee: d.opdFollowupFee != null ? Number(d.opdFollowupFee) : undefined,
      })))
      setDepartments(((depRes?.departments)||[]).map((d:any)=>({
        id: String(d._id),
        name: d.name,
        opdBaseFee: d.opdBaseFee != null ? Number(d.opdBaseFee) : undefined,
        opdFollowupFee: d.opdFollowupFee != null ? Number(d.opdFollowupFee) : undefined,
      })))
    }catch{}
  })() }, [])

  const filteredDoctors = ((): Doctor[] => {
    const depId = String(form.departmentId || '')
    if (!depId) return []
    return doctors.filter(d => {
      if (d.primaryDepartmentId && String(d.primaryDepartmentId) === depId) return true
      if (Array.isArray(d.departmentIds) && d.departmentIds.map(String).includes(depId)) return true
      return false
    })
  })()

  function onDepartmentChange(depId: string){
    setForm(f => ({ ...f, departmentId: depId }))
    const dep = departments.find(d => d.id === depId)

    // If current doctor doesn't belong to this department, clear it.
    if (doctorId) {
      const d = doctors.find(x => x.id === doctorId)
      const belongs = d && ((d.primaryDepartmentId && String(d.primaryDepartmentId) === depId) || (Array.isArray(d.departmentIds) && d.departmentIds.map(String).includes(depId)))
      if (!belongs) setDoctorId('')
    }

    // If no doctor selected, default fee to department fees
    if (!doctorId) {
      const fee = dep?.opdBaseFee != null ? String(dep.opdBaseFee) : ''
      const follow = dep?.opdFollowupFee != null ? String(dep.opdFollowupFee) : ''
      setForm(f => ({ ...f, fee, followupFee: follow }))
    }
  }

  function onDoctorChange(nextId: string){
    if (!form.departmentId){
      showToast('Select department first')
      return
    }
    setDoctorId(nextId)
    const doc = doctors.find(d => d.id === nextId)
    const dep = departments.find(d => d.id === String(form.departmentId))
    if (!doc) return
    const fee = doc.opdBaseFee != null ? String(doc.opdBaseFee) : (dep?.opdBaseFee != null ? String(dep.opdBaseFee) : '')
    const follow = doc.opdFollowupFee != null ? String(doc.opdFollowupFee) : (dep?.opdFollowupFee != null ? String(dep.opdFollowupFee) : '')
    setForm(f => ({ ...f, fee, followupFee: follow }))
  }

  useEffect(()=>{ load() }, [doctorId])

  async function load(){
    setLoading(true)
    try{
      const res = await hospitalApi.listDoctorSchedules(doctorId ? { doctorId } : undefined) as any
      const items: Schedule[] = (res?.schedules || [])
      items.sort((a: any, b: any) => {
        const d = String(a?.dateIso || '').localeCompare(String(b?.dateIso || ''))
        if (d !== 0) return d
        const s = String(a?.startTime || '').localeCompare(String(b?.startTime || ''))
        if (s !== 0) return s
        return String(a?._id || '').localeCompare(String(b?._id || ''))
      })
      setRows(items)
    }catch{ setRows([]) }
    setLoading(false)
  }

  const save = async (e: React.FormEvent)=>{
    e.preventDefault()
    if (!doctorId) { alert('Select doctor'); return }
    if (!dateIso) { alert('Select date'); return }
    const payload: any = {
      doctorId,
      departmentId: form.departmentId || undefined,
      dateIso,
      startTime: form.startTime,
      endTime: form.endTime,
      slotMinutes: Math.max(5, parseInt(form.slotMinutes||'15',10) || 15),
      fee: form.fee ? Number(form.fee) : undefined,
      followupFee: form.followupFee ? Number(form.followupFee) : undefined,
      notes: form.notes || undefined,
    }
    try{
      if (editId){
        await hospitalApi.updateDoctorSchedule(editId, payload)
        setEditId(null)
      } else {
        await hospitalApi.createDoctorSchedule(payload)
      }
      await load()
      setForm({ departmentId: form.departmentId, startTime: '09:00', endTime: '12:00', slotMinutes: '30', fee: '', followupFee: '', notes: '' })
    }catch(e:any){ alert(e?.message || 'Failed to save schedule') }
  }

  const remove = async (id: string)=>{
    if (!confirm('Delete this schedule?')) return
    try { await hospitalApi.deleteDoctorSchedule(id); await load() } catch(e:any){ alert(e?.message || 'Failed to delete') }
  }

  const onEdit = (s: Schedule)=>{
    setEditId(s._id)
    setDateIso(s.dateIso)
    setDoctorId(s.doctorId)
    setForm({ departmentId: String(s.departmentId||''), startTime: s.startTime, endTime: s.endTime, slotMinutes: String(s.slotMinutes||15), fee: s.fee!=null?String(s.fee):'', followupFee: s.followupFee!=null?String(s.followupFee):'', notes: s.notes||'' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-800">Doctor Schedules</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
            <select value={form.departmentId} onChange={e=>onDepartmentChange(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="">Select department</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Doctor</label>
            <select
              value={doctorId}
              onChange={e=>onDoctorChange(e.target.value)}
              onMouseDown={(e)=>{ if (!form.departmentId){ e.preventDefault(); showToast('Select department first') } }}
              onFocus={(e)=>{ if (!form.departmentId){ showToast('Select department first'); (e.target as HTMLSelectElement).blur() } }}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">{form.departmentId ? 'Select doctor' : 'Select department first'}</option>
              {filteredDoctors.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
            <input type="date" value={dateIso} onChange={e=>setDateIso(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Start Time</label>
            <input type="time" value={form.startTime} onChange={e=>setForm(f=>({ ...f, startTime: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">End Time</label>
            <input type="time" value={form.endTime} onChange={e=>setForm(f=>({ ...f, endTime: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Slot Minutes</label>
            <input type="number" value={form.slotMinutes} onChange={e=>setForm(f=>({ ...f, slotMinutes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fee (optional)</label>
            <input value={form.fee} onChange={e=>setForm(f=>({ ...f, fee: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Follow-up Fee (optional)</label>
            <input value={form.followupFee} onChange={e=>setForm(f=>({ ...f, followupFee: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
            <input value={form.notes} onChange={e=>setForm(f=>({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>
          <div className="md:col-span-6 flex items-center justify-end gap-2">
            {editId && <button type="button" onClick={()=>{ setEditId(null); setForm({ departmentId: form.departmentId, startTime: '09:00', endTime: '12:00', slotMinutes: '30', fee: '', followupFee: '', notes: '' }) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>}
            <button type="submit" className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white">{editId? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
          <div className="font-medium text-slate-800">{doctorId ? `Schedules (Doctor: ${doctors.find(d=>d.id===doctorId)?.name || doctorId})` : 'Schedules (All Doctors)'}</div>
          <div className="text-slate-600">{loading? 'Loading...' : `${rows.length} item(s)`}</div>
        </div>
        <table className="min-w-max w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Doctor</th>
              <th className="px-3 py-2 text-left">Dept</th>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Slot</th>
              <th className="px-3 py-2 text-left">Fees</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s._id} className="border-b border-slate-100">
                <td className="px-3 py-2">{s.dateIso || '-'}</td>
                <td className="px-3 py-2">{doctors.find(d=>d.id===s.doctorId)?.name || s.doctorId}</td>
                <td className="px-3 py-2">{departments.find(d=>d.id===s.departmentId)?.name || '-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.startTime} - {s.endTime}</td>
                <td className="px-3 py-2">{s.slotMinutes} min</td>
                <td className="px-3 py-2">{s.fee!=null? `Rs. ${s.fee}`:'-'}{s.followupFee!=null? ` / Follow-up: Rs. ${s.followupFee}`:''}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={()=>onEdit(s)} className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-700">Edit</button>
                    <button onClick={()=>remove(s._id)} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No schedules</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
