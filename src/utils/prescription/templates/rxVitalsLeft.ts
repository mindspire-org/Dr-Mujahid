import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PrescriptionPdfData } from '../../prescriptionPdf'

export async function buildRxVitalsLeft(data: PrescriptionPdfData){
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  // Blue header bar: Doctor (left), Logo (center), Hospital info (right)
  const headerY = 0
  const headerH = 22
  pdf.setFillColor(30, 64, 175)
  pdf.rect(0, headerY, pageWidth, headerH, 'F')
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
  const docX = 12
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(12)
  pdf.text(`Dr. ${data.doctor?.name || '-'}`, docX, 8)
  pdf.setFont('helvetica','normal')
  pdf.setFontSize(9)
  let docY = 12
  if (data.doctor?.qualification) { pdf.text(String(data.doctor.qualification), docX, docY); docY += 4 }
  if (data.doctor?.departmentName) { pdf.text(String(data.doctor.departmentName), docX, docY); docY += 4 }
  if (data.doctor?.phone) { pdf.text(String(data.doctor.phone), docX, docY) }

  // Center: Logo
  if (logo) {
    try {
      const imgW = 12, imgH = 12
      pdf.addImage(logo, 'JPEG', (pageWidth/2) - (imgW/2), 5, imgW, imgH)
    } catch {}
  }

  // Right: Hospital info (values only)
  const hosX = pageWidth - 12
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(12)
  if (hosName) pdf.text(hosName, hosX, 8, { align: 'right' })
  pdf.setFont('helvetica','normal')
  pdf.setFontSize(9)
  if (hosPhone) pdf.text(hosPhone, hosX, 12, { align: 'right' })
  if (hosAddr) pdf.text(hosAddr, hosX, 16, { align: 'right' })

  pdf.setTextColor(0,0,0)

  const leftX = 12
  const gap = 0

  // Patient info band across the page (below header), two columns
  const bandY = headerH + 6
  let bandH = 34
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(9)
  let ty = bandY + 6
  let maxBandY = ty
  const colSplit = leftX + (pageWidth - leftX*2) / 2
  const l = (label: string, value?: string) => {
    pdf.setFont('helvetica','bold'); pdf.text(label, leftX + 3, ty)
    pdf.setFont('helvetica','normal'); pdf.text(String(value||'-'), leftX + 28, ty)
    ty += 4
    if (ty > maxBandY) maxBandY = ty
  }
  const r = (label: string, value?: string, dy = 0) => {
    const y = ty + dy
    pdf.setFont('helvetica','bold'); pdf.text(label, colSplit + 3, y)
    pdf.setFont('helvetica','normal'); pdf.text(String(value||'-'), colSplit + 28, y)
    if (y > maxBandY) maxBandY = y
  }
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
  l('Patient Name:', data.patient?.name)
  l('Age:', data.patient?.age)
  l('Gender:', data.patient?.gender)
  l('Phone:', data.patient?.phone)
  l('Address:', data.patient?.address)
  r('MR Number:', data.patient?.mrn, -16)
  r('Token #:', (data as any).tokenNo || undefined, -12)
  r('Date:', createdAt.toLocaleDateString(), -8)
  r('Doctor:', (data.doctor?.name ? `Dr. ${data.doctor.name}` : undefined), -4)
  r('Department:', data.doctor?.departmentName, 0)

  // Draw the band border sized to content
  pdf.setDrawColor(203,213,225)
  bandH = Math.max(bandH, (maxBandY - bandY) + 6)
  pdf.roundedRect(leftX, bandY, pageWidth - leftX*2, bandH, 2, 2)

  // Layout below band
  const leftY = bandY + bandH + 6
  // Draw LEFT panel first; measure widest line to place Rx box tight to it
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(10)
  pdf.text('VITAL SIGNS', leftX, leftY + 4)
  let vy = leftY + 8
  pdf.setFont('helvetica','normal')
  pdf.setFontSize(9)
  const vit = data.vitals || {}
  const dashed = (s?: string) => (s && s.trim()) ? s : '— — —'
  let leftTextMaxW = 0
  const recordWidth = (tx: string) => { try { const w = pdf.getTextWidth(tx); if (w > leftTextMaxW) leftTextMaxW = w } catch {} }
  // measure header width as well
  recordWidth('VITAL SIGNS')
  const putV = (label: string, present: boolean, value: string) => {
    if (!present) return
    const line = `${label}: ${value}`
    recordWidth(line)
    pdf.text(line, leftX, vy)
    vy += 5
  }
  putV('BP', (vit.bloodPressureSys != null || vit.bloodPressureDia != null), `${vit.bloodPressureSys ?? '—'} / ${vit.bloodPressureDia ?? '—'}`)
  putV('Pulse', true, dashed(vit.pulse!=null?String(vit.pulse):''))
  putV('Temp', true, dashed(vit.temperatureC!=null?String(vit.temperatureC):''))
  putV('Wt', true, dashed(vit.weightKg!=null?String(vit.weightKg):''))
  // optional extended vitals
  putV('RR (/min)', vit.respiratoryRate != null, String(vit.respiratoryRate))
  putV('SpO2 (%)', vit.spo2 != null, String(vit.spo2))
  putV('Sugar (mg/dL)', vit.bloodSugar != null, String(vit.bloodSugar))
  putV('Height (cm)', vit.heightCm != null, String(vit.heightCm))
  putV('BMI', vit.bmi != null, String(vit.bmi))
  putV('BSA (m2)', vit.bsa != null, String(vit.bsa))

  // Replace Investigation checklist with Lab Tests and Diagnostic Tests lists (only if provided)
  vy += 2
  const notesWrapW = 70
  const renderList = (label: string, items?: string[], notes?: string) => {
    const list = Array.isArray(items) ? items.map(t => String(t || '').trim()).filter(Boolean) : []
    const n = String(notes || '').trim()
    pdf.setFont('helvetica','bold')
    pdf.text(label, leftX, vy)
    recordWidth(label)
    vy += 4
    pdf.setFont('helvetica','normal')
    const listOut = list.length ? list : ['N/A']
    listOut.forEach(t => {
      const line = `- ${t}`
      recordWidth(line)
      pdf.text(line, leftX, vy)
      vy += 4
    })
    if (n) {
      pdf.setTextColor(71, 85, 105)
      const lines = pdf.splitTextToSize(`Note: ${n}`, notesWrapW)
      lines.forEach((ln: string) => {
        const line = String(ln)
        recordWidth(line)
        pdf.text(line, leftX, vy)
        vy += 4
      })
      pdf.setTextColor(0,0,0)
    }
  }
  renderList('LAB TESTS', data.labTests, data.labNotes)
  renderList('DIAGNOSTIC TESTS', data.diagnosticTests, data.diagnosticNotes)
  renderList('THERAPY ORDERS', (data as any).therapyTests, (data as any).therapyNotes)

  // After left panel is printed, compute Rx box start tightly after left content (clamped)
  const minLeftW = 18
  const maxLeftW = 32
  const pad = 6
  const leftW = Math.ceil(Math.max(minLeftW, Math.min(maxLeftW, leftTextMaxW + pad)))
  const rxX = leftX + leftW + gap
  const rxY = leftY
  const rxW = pageWidth - rxX - 12

  // Big Rx mark and prep to draw Rx box border later
  pdf.setDrawColor(203,213,225)
  pdf.setLineWidth(0.4)
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(20)
  pdf.setTextColor(30, 64, 175)
  pdf.text('R', rxX + 6, rxY + 16)
  pdf.setTextColor(0,0,0)

  // Rx content starts with inner padding to avoid overlapping the 'R'
  const contentX = rxX + 16
  let y = rxY + 14
  pdf.setFont('helvetica','normal')
  pdf.setFontSize(9)

  // Clinical details (from Details tab) inside the Rx box, above Medication
  const wrapRx = (txt: string) => pdf.splitTextToSize(txt, rxW - ((contentX - rxX) + 12))
  const section = (label: string, value?: string) => {
    const v = String(value || '').trim()
    const out = v || 'N/A'
    pdf.setFont('helvetica','bold')
    pdf.text(label, contentX, y)
    y += 4
    pdf.setFont('helvetica','normal')
    const lines = wrapRx(out)
    pdf.text(lines, contentX, y)
    y += Math.max(6, lines.length * 4.2 + 2)
  }
  section('Primary Complaint', data.primaryComplaint)
  section('History of Primary Complaint', data.primaryComplaintHistory)
  section('Allergy History', data.allergyHistory)
  section('Examination Findings', data.examFindings)
  section('Family History', data.familyHistory)
  section('Treatment History', data.treatmentHistory)
  section('Medical History', (data as any).history)
  section('Diagnosis', data.diagnosis)
  section('Advice', data.advice)
  y += 2

  const medRows = (data.items || []).map((m: any, idx: number) => {
    return [ String(idx+1), String(m.name||'-'), String(m.frequency||'-'), String(m.dose||'-'), String(m.duration||'-'), String(m.instruction||'-'), String(m.route||'-') ]
  })
  pdf.setFont('helvetica','bold')
  pdf.text('Medication', contentX, y)
  y += 4
  autoTable(pdf, {
    startY: y,
    margin: { left: contentX, right: 12 },
    head: [[ 'Sr.', 'Drug', 'Frequency', 'Dosage', 'Duration', 'Instruction', 'Route' ]],
    body: medRows,
    styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [0,0,0], textColor: [255,255,255], fontStyle: 'bold' },
  })
  try { y = Math.max(y, ((pdf as any).lastAutoTable?.finalY || y) + 4) } catch {}

  // Now draw the Rx box border sized to actual content to minimize empty space
  const rxContentBottom = y + 6
  const rxBoxHeight = Math.max(24, rxContentBottom - rxY)
  pdf.setDrawColor(203,213,225)
  pdf.setLineWidth(0.4)
  pdf.roundedRect(rxX, rxY, rxW, rxBoxHeight, 2, 2)

  // Lab/Diagnostic lists are rendered on the left panel only (per design). Nothing here.

  pdf.setDrawColor(229, 231, 235)
  pdf.line(12, pageHeight - 24, pageWidth - 12, pageHeight - 24)
  pdf.setFont('helvetica','normal')
  pdf.setFontSize(9)
  pdf.text('Doctor Signature', 12, pageHeight - 18)
  pdf.line(40, pageHeight - 19, 100, pageHeight - 19)
  if (data.doctor?.name) pdf.text(`Dr. ${data.doctor.name}`, 40, pageHeight - 14)

  pdf.setTextColor(190, 18, 60)
  pdf.setFont('helvetica','bold')
  pdf.text('NOT VALID FOR COURT', pageWidth/2, pageHeight - 10, { align: 'center' })
  pdf.setTextColor(0,0,0)

  
  return pdf
}
