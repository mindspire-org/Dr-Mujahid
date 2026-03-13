import { useEffect, useState } from 'react'
import { previewPrescriptionPdf } from '../../utils/prescriptionPdf'
import type { PrescriptionPdfTemplate } from '../../utils/prescriptionPdf'

export default function Doctor_Settings(){
  type DoctorSession = { id: string; name?: string; username?: string }
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [tpl, setTpl] = useState<PrescriptionPdfTemplate>('default')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      const sess = raw ? JSON.parse(raw) : null
      setDoc(sess)
      const k = `doctor.rx.template.${sess?.id || 'anon'}`
      const v = localStorage.getItem(k) as PrescriptionPdfTemplate | null
      if (v === 'default' || v === 'rx-vitals-left') setTpl(v)
    } catch {}
  }, [])

  const save = () => {
    try {
      const k = `doctor.rx.template.${doc?.id || 'anon'}`
      localStorage.setItem(k, tpl)
      setSaved(true)
      setTimeout(()=>setSaved(false), 1500)
    } catch {}
  }

  const previewSample = async () => {
    // Minimal sample preview just to visualize layout
    await previewPrescriptionPdf({
      doctor: { name: doc?.name || 'Doctor', qualification: 'MBBS, FCPS', departmentName: 'OPD', phone: '' },
      settings: { name: 'Hospital', address: 'Address Hospital Address City, Country', phone: '0300-0000000', logoDataUrl: '' },
      patient: { name: 'John Doe', mrn: 'MR0001', gender: 'M', age: '30', phone: '0300-1234567', address: 'Street, City' },
      vitals: { pulse: 76, temperatureC: 36.9, bloodPressureSys: 120, bloodPressureDia: 80, respiratoryRate: 18, spo2: 98 },
      items: [
        { name: 'Tab. Paracetamol 500mg', frequency: 'morning / night', duration: '5 days', dose: '1 tablet', instruction: 'After meals', route: 'Oral' },
        { name: 'Cap. Omeprazole 20mg', frequency: 'once a day', duration: '7 days', dose: '1 capsule', instruction: 'Before breakfast', route: 'Oral' },
      ],
      labTests: ['CBC', 'LFT'],
      labNotes: 'Fasting',
      diagnosticTests: ['Ultrasound Abdomen'],
      diagnosticNotes: 'ASAP',
      createdAt: new Date(),
    }, tpl)
  }

  return (
    <div className="w-full px-2 sm:px-4">
      <div className="text-xl font-semibold text-slate-800">Doctor Settings</div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Prescription Print Template</label>
            <select value={tpl} onChange={(e)=>setTpl(e.target.value as PrescriptionPdfTemplate)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="default">Standard</option>
              <option value="rx-vitals-left">Vitals Left (Rx Box)</option>
            </select>
            <div className="mt-1 text-xs text-slate-500">This choice is saved per-doctor and used by Print in Prescription and Prescription History pages.</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={save} className="btn">Save</button>
          <button type="button" onClick={previewSample} className="btn-outline-navy">Preview Sample</button>
          {saved && <div className="text-sm text-emerald-600">Saved</div>}
        </div>
      </div>
    </div>
  )
}
