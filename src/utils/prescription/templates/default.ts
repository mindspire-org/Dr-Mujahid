import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PrescriptionPdfData } from '../../prescriptionPdf'

export async function buildRxDefault(data: PrescriptionPdfData){
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  // Header bar: Doctor (left), Logo (center), Hospital info (right)
  const headerH = 22
  pdf.setFillColor(30, 64, 175)
  pdf.rect(0, 0, pageWidth, headerH, 'F')
  pdf.setTextColor(255,255,255)

  const hosName = String(data.settings?.name || '')
  const hosPhone = String(data.settings?.phone || '')
  const hosAddr = String(data.settings?.address || '')

  let logo = data.settings?.logoDataUrl
  if (logo) {
    try {
      if (!logo.startsWith('data:')) {
        try {
          const u = logo.startsWith('http') ? logo : `${location.origin}${logo.startsWith('/')?'':'/'}${logo}`
          const resp = await fetch(u)
          const blob = await resp.blob()
          logo = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result||'')); fr.readAsDataURL(blob) })
        } catch {}
      }
      logo = await new Promise<string>((resolve) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const S = 96
            canvas.width = S; canvas.height = S
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0,0,S,S)
              ctx.drawImage(img, 0, 0, S, S)
            }
            resolve(canvas.toDataURL('image/jpeg', 0.72))
          } catch { resolve(logo!) }
        }
        img.onerror = () => resolve(logo!)
        img.src = logo!
      })
    } catch {}
  }

  // Left: Doctor (values only)
  const docX = 14
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  const docLine1 = `Dr. ${data.doctor?.name || '-'}`
  pdf.text(docLine1, docX, 8)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  let docY = 12
  if (data.doctor?.qualification) { pdf.text(String(data.doctor.qualification), docX, docY); docY += 4 }
  if (data.doctor?.departmentName) { pdf.text(String(data.doctor.departmentName), docX, docY); docY += 4 }
  if (data.doctor?.phone) { pdf.text(String(data.doctor.phone), docX, docY) }

  // Center: Logo
  if (logo) {
    try {
      const imgW = 12, imgH = 12
      pdf.addImage(logo, 'JPEG', (pageWidth/2)-(imgW/2), 5, imgW, imgH)
    } catch {}
  }

  // Right: Hospital info (values only)
  const hosX = pageWidth - 14
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  if (hosName) pdf.text(hosName, hosX, 8, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (hosPhone) pdf.text(hosPhone, hosX, 12, { align: 'right' })
  if (hosAddr) pdf.text(hosAddr, hosX, 16, { align: 'right' })

  pdf.setTextColor(0,0,0)
  let y = headerH + 8

  // Patient block
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
  pdf.setFontSize(9)
  pdf.text(`Patient: ${data.patient?.name || '-'}`, 14, y)
  pdf.text(`MR: ${data.patient?.mrn || '-'}`, pageWidth/2, y)
  pdf.text(`Gender: ${data.patient?.gender || '-'}`, pageWidth-14, y, { align: 'right' })
  y += 5
  pdf.text(`Father Name: ${data.patient?.fatherName || '-'}`, 14, y)
  pdf.text(`Age: ${data.patient?.age || '-'}`, pageWidth/2, y)
  pdf.text(`Phone: ${data.patient?.phone || '-'}`, pageWidth-14, y, { align: 'right' })
  y += 5
  pdf.text(`Address: ${data.patient?.address || '-'}`, 14, y)
  y += 5
  pdf.text(`Date: ${createdAt.toLocaleString()}`, 14, y)
  y += 5

  // Divider after patient info
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.4)
  pdf.line(14, y, pageWidth - 14, y)
  y += 6
  // Sections in simple blocks matching target layout
  const section = (label: string, value?: string) => {
    const v = String(value || '').trim()
    const out = v || 'N/A'
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(label, 14, y)
    y += 4
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(out, pageWidth - 28)
    pdf.text(lines, 14, y)
    y += Math.max(6, lines.length * 4 + 2)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Prescription', 14, y)
  y += 6

  // Vitals (table) above Medical History
  try {
    const v = data.vitals
    const hasVitals = v && Object.values(v).some(x => x != null && !(typeof x === 'number' && isNaN(x as any)))
    if (hasVitals){
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Vitals', 14, y)
      y += 4
      const labels: string[] = []
      const values: string[] = []
      const add = (label: string, present: boolean, value: string) => { if (present) { labels.push(label); values.push(value) } }
      add('Pulse', v?.pulse != null, `${v?.pulse}`)
      add('Temp (°C)', v?.temperatureC != null, `${v?.temperatureC}`)
      add('BP (mmHg)', (v?.bloodPressureSys != null || v?.bloodPressureDia != null), `${v?.bloodPressureSys ?? '-'} / ${v?.bloodPressureDia ?? '-'}`)
      add('RR (/min)', v?.respiratoryRate != null, `${v?.respiratoryRate}`)
      add('SpO2 (%)', v?.spo2 != null, `${v?.spo2}`)
      add('Sugar (mg/dL)', v?.bloodSugar != null, `${v?.bloodSugar}`)
      add('Weight (kg)', v?.weightKg != null, `${v?.weightKg}`)
      add('Height (cm)', v?.heightCm != null, `${v?.heightCm}`)
      add('BMI', v?.bmi != null, `${v?.bmi}`)
      add('BSA (m2)', v?.bsa != null, `${v?.bsa}`)
      if (labels.length){
        autoTable(pdf, {
          startY: y,
          margin: { left: 14, right: 14 },
          head: [ labels ],
          body: [ values ],
          styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
          headStyles: { fillColor: [248,250,252], textColor: [15,23,42], fontStyle: 'bold' },
        })
        try { y = Math.max(y, ((pdf as any).lastAutoTable?.finalY || y) + 6) } catch {}
      }
    }
  } catch {}

  section('Complaint', data.primaryComplaint)
  section('History of Primary Complaint', data.primaryComplaintHistory)
  section('Family History', data.familyHistory)
  section('Allergy History', data.allergyHistory)
  section('Treatment History', data.treatmentHistory)
  section('Medical History', data.history)
  section('Examination Findings', data.examFindings)
  section('Diagnosis', data.diagnosis)
  section('Advice', data.advice)
  const ordersSection = (label: string, tests?: string[], notes?: string) => {
    const t = Array.isArray(tests) ? tests.map(s => String(s || '').trim()).filter(Boolean) : []
    const n = String(notes || '').trim()
    const testsOut = t.length ? t.join(', ') : 'N/A'
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(label, 14, y)
    y += 4
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const lines = pdf.splitTextToSize(testsOut, pageWidth - 28)
    pdf.text(lines, 14, y)
    y += Math.max(6, lines.length * 4 + 2)
    if (n) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(71, 85, 105)
      const lines = pdf.splitTextToSize(`Note: ${n}`, pageWidth - 28)
      pdf.text(lines, 14, y)
      y += Math.max(6, lines.length * 4 + 2)
      pdf.setTextColor(0,0,0)
    }
  }
  ordersSection('Lab Tests', data.labTests, data.labNotes)
  ordersSection('Diagnostic Tests', data.diagnosticTests, data.diagnosticNotes)
  ordersSection('Therapy', (data as any).therapyTests as any, (data as any).therapyNotes)

  // Medication table
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Medication', 14, y)
  y += 4

  const freqText = (s?: string) => {
    const raw = String(s || '').trim()
    if (!raw) return '-'
    if (raw.includes('/')) {
      const cnt = raw.split('/').map(t => t.trim()).filter(Boolean).length
      if (cnt === 1) return 'Once a day'
      if (cnt === 2) return 'Twice a day'
      if (cnt === 3) return 'Thrice a day'
      if (cnt >= 4) return 'Four times a day'
    }
    return raw
  }
  const durText = (s?: string) => {
    const d = String(s || '').trim()
    if (!d) return '-'
    return d
  }
  const bodyRows = (data.items || []).map((m: any, idx: number) => {
    const notes = String(m?.notes || '').trim()
    const instrDirect = String(m?.instruction || '').trim()
    const routeDirect = String(m?.route || '').trim()
    let instr = instrDirect
    let route = routeDirect
    if (!instr) {
      try { const mi = notes.match(/Instruction:\s*([^;]+)/i); if (mi && mi[1]) instr = mi[1].trim() } catch {}
    }
    if (!route) {
      try { const mr = notes.match(/Route:\s*([^;]+)/i); if (mr && mr[1]) route = mr[1].trim() } catch {}
    }
    return [
      String(idx + 1),
      String(m.name || '-'),
      freqText(m.frequency),
      String(m.dose || '-'),
      durText(m.duration),
      String(instr || '-'),
      String(route || '-')
    ]
  })

  autoTable(pdf, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 10 },
    head: [[ 'Sr.', 'Drug', 'Frequency', 'Dosage', 'Duration', 'Instruction', 'Route' ]],
    body: bodyRows,
    styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [0,0,0], textColor: [255,255,255], fontStyle: 'bold' },
  })

  return pdf
}
