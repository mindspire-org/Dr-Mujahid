import { diagnosticApi } from './api'

export type ReportRow = { test: string; normal?: string; unit?: string; value?: string; prevValue?: string; flag?: 'normal' | 'abnormal' | 'critical'; comment?: string }

function fmtDateTime(iso?: string) {
  if (!iso) return '-'
  if (/^\d{1,2}:\d{2}$/.test(String(iso))) {
    try {
      const [hh, mm] = String(iso).split(':').map(Number)
      const d = new Date()
      d.setHours(hh, mm, 0, 0)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return String(iso)
    }
  }
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return String(iso)
    return d.toLocaleDateString() + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return String(iso)
  }
}

async function ensurePngDataUrl(src: string): Promise<string> {
  try {
    if (/^data:image\/(png|jpeg)/i.test(src)) return src
    return await new Promise<string>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width || 200
          canvas.height = img.naturalHeight || img.height || 200
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0)
          const out = canvas.toDataURL('image/png')
          resolve(out || src)
        } catch { resolve(src) }
      }
      img.onerror = () => resolve(src)
      img.src = src
    })
  } catch { return src }
}

export async function previewDiagnosticReportPdf(input: {
  tokenNo: string
  createdAt: string
  sampleTime?: string
  reportingTime?: string
  patient: { fullName: string; phone?: string; mrn?: string; age?: string; gender?: string; address?: string }
  rows: ReportRow[]
  interpretation?: string
  flagStatus?: string
  printedBy?: string
  referringConsultant?: string
  profileLabel?: string
  layout?: {
    hideSampleNoLabNo?: boolean
    hideCollectionDateTime?: boolean
    table?: {
      hideNormal?: boolean
      hideUnit?: boolean
      hideFlag?: boolean
      hideComment?: boolean
      commentHeader?: string
      customTable?: {
        head: any[][]
        body: any[][]
        columnStyles?: Record<number, any>
      }
    }
  }
}) {
  const s: any = await diagnosticApi.getSettings().catch(() => ({}))
  const name = s?.diagnosticName || 'Diagnostics'
  const address = s?.address || '-'
  const phone = s?.phone || ''
  const email = s?.email || ''
  const department = s?.department || 'Department'
  const logo = s?.logoDataUrl || ''
  const primaryConsultant = { name: s?.consultantName || '', degrees: s?.consultantDegrees || '', title: s?.consultantTitle || '' }
  const extraConsultants: Array<{ name?: string; degrees?: string; title?: string }> = Array.isArray(s?.consultants) ? s.consultants : []
  const consultantsList = [primaryConsultant, ...extraConsultants]
    .filter(c => (c?.name || '').trim() || (c?.degrees || '').trim() || (c?.title || '').trim())
    .slice(0, 3)

  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default as any

  const doc = new jsPDF('p', 'pt', 'a4')
  doc.setFont('helvetica', 'normal')
  let y = 40

  if (logo) {
    try {
      const normalized = await ensurePngDataUrl(logo)
      doc.addImage(normalized, 'PNG' as any, 40, y - 32, 70, 70, undefined, 'FAST')
    } catch { }
  }
  doc.setFontSize(16)
  doc.text(String(name), 297.5, y, { align: 'center' }); y += 16
  doc.setFontSize(10)
  doc.text(String(address), 297.5, y, { align: 'center' }); y += 12
  doc.text(`Ph: ${phone || ''}${email ? ' • ' + email : ''}`, 297.5, y, { align: 'center' }); y += 16
  doc.setDrawColor(15); doc.line(40, y, 555, y); y += 10
  doc.setFontSize(11)
  doc.text(String(department), 297.5, y, { align: 'center' }); y += 16

  doc.setFontSize(10)
  const L = 40, R = 300
  const dt = (iso?: string) => fmtDateTime(iso)
  const drawKV = (label: string, value: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, yy)
    const w = doc.getTextWidth(label + ' ')
    doc.setFont('helvetica', 'normal');
    doc.text(value, x + w, yy)
  }
  drawKV('Medical Record No :', String(input.patient.mrn || '-'), L, y)
  if (!input.layout?.hideSampleNoLabNo) {
    drawKV('Sample No / Lab No :', String(input.tokenNo), R, y)
  }
  y += 14
  drawKV('Patient Name :', String(input.patient.fullName), L, y)
  drawKV('Age / Gender :', `${input.patient.age || ''} / ${input.patient.gender || ''}`, R, y); y += 14
  if (!input.layout?.hideCollectionDateTime) {
    drawKV('Collection DatTime:', String(dt(input.sampleTime || input.createdAt)), L, y)
  }
  drawKV('Report DateTime:', String(dt(input.reportingTime || input.createdAt)), R, y); y += 14
  drawKV('Contact No :', String(input.patient.phone || '-'), L, y)
  drawKV('Referring Consultant :', String(input.referringConsultant || '-'), R, y); y += 14
  drawKV('Address :', String(input.patient.address || '-'), L, y); y += 8

  const label = String(input.profileLabel || '').trim()
  if (label) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(label, 297.5, y + 14, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    y += 18
  }

  const tableCfg = input.layout?.table
  const custom = tableCfg?.customTable
  const allowNormal = !tableCfg?.hideNormal
  const allowUnit = !tableCfg?.hideUnit
  const allowFlag = !tableCfg?.hideFlag
  const allowComment = !tableCfg?.hideComment

  const hasPrev = (input.rows || []).some(r => (r.prevValue || '').trim().length > 0)
  const hasNormal = allowNormal && (input.rows || []).some(r => (r.normal || '').trim().length > 0)
  const hasUnit = allowUnit && (input.rows || []).some(r => (r.unit || '').trim().length > 0)
  const hasFlag = allowFlag && (input.rows || []).some(r => (r.flag || '').length > 0)
  const hasComment = allowComment && (input.rows || []).some(r => (r.comment || '').trim().length > 0)

  const commentHeader = String(tableCfg?.commentHeader || 'Comment')
  const firstColHeader = String((tableCfg as any)?.firstColHeader || 'Test')
  const headRow: string[] = [firstColHeader]
  if (hasNormal) headRow.push('Normal Value')
  if (hasUnit) headRow.push('Unit')
  if (hasPrev) headRow.push('Previous')
  headRow.push('Result')
  if (hasFlag) headRow.push('Flag')
  if (hasComment) headRow.push(commentHeader)

  const head = custom?.head || [headRow]
  const body = custom?.body || (input.rows || []).map(r => {
    const row: string[] = [r.test || '']
    if (hasNormal) row.push(r.normal || '')
    if (hasUnit) row.push(r.unit || '')
    if (hasPrev) row.push(r.prevValue || '')
    row.push(r.value || '')
    if (hasFlag) row.push(r.flag || '')
    if (hasComment) row.push(r.comment || '')
    return row
  })

  const drawFooter = () => {
    const pageHeight = (doc.internal.pageSize as any).getHeight ? (doc.internal.pageSize as any).getHeight() : (doc.internal.pageSize as any).height
    let baseY = pageHeight - 90
    doc.setFontSize(10)
    const footerText = String(s?.reportFooter || '').trim()
    if (footerText) {
      doc.text(footerText, 297.5, baseY, { align: 'center' })
    }
    doc.setDrawColor(51, 65, 85); doc.line(40, baseY + 8, 555, baseY + 8)
    if (consultantsList.length) {
      const cols = consultantsList.length
      const colW = (555 - 40) / cols
      consultantsList.forEach((c, i) => {
        const x = 40 + i * colW + 4
        let yy = baseY + 26
        doc.setFontSize(11)
        if ((c.name || '').trim()) { doc.text(String(c.name), x, yy); yy += 12 }
        doc.setFontSize(10)
        if ((c.degrees || '').trim()) { doc.text(String(c.degrees), x, yy); yy += 12 }
        if ((c.title || '').trim()) { doc.setFont('helvetica', 'bold'); doc.text(String(c.title), x, yy); doc.setFont('helvetica', 'normal'); }
      })
    }
  }

  const columnStyles: Record<number, any> = custom?.columnStyles ? { ...custom.columnStyles } : {}
  let idxPrev = -1
  let idxFlag = -1
  if (!custom) {
    idxPrev = hasPrev ? headRow.indexOf('Previous') : -1
    idxFlag = hasFlag ? headRow.indexOf('Flag') : -1
    if (idxPrev >= 0) columnStyles[idxPrev] = { fontStyle: 'bold' }
    if (idxFlag >= 0) columnStyles[idxFlag] = { fontStyle: 'bold' }
  }

  autoTable(doc, {
    startY: y + 12,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 4, lineWidth: 0.5 },
    headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], halign: 'left', fontStyle: 'bold' },
    tableLineColor: [15, 23, 42],
    tableLineWidth: 0.5,
    theme: 'grid',
    columnStyles,
    didParseCell: (hookData: any) => {
      if (hookData.section === 'body' && (hookData.column.index === idxPrev || hookData.column.index === idxFlag)) {
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { bottom: 120 },
  })

  const hasFlagStatus = (input.flagStatus || '').trim().length > 0
  if (hasFlagStatus) {
    autoTable(doc, {
      startY: (((doc as any).lastAutoTable?.finalY) || (y + 12)) + 12,
      body: [
        [{ content: 'Flag/Status:', styles: { fontStyle: 'bold' } }],
        [{ content: String(input.flagStatus || '') }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 0, halign: 'left' },
      margin: { left: 40, right: 40, bottom: 120 },
    })
  }

  const hasInterpretation = (input.interpretation || '').trim().length > 0
  if (hasInterpretation) {
    autoTable(doc, {
      startY: (((doc as any).lastAutoTable?.finalY) || (y + 12)) + 12,
      body: [
        [{ content: 'Clinical Interpretation:', styles: { fontStyle: 'bold' } }],
        [{ content: String(input.interpretation || '') }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 0, halign: 'left' },
      margin: { left: 40, right: 40, bottom: 120 },
    })
  }

  const pageCount1 = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount1; i++) { (doc as any).setPage(i); drawFooter() }

  doc.output('dataurlnewwindow')
}
