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

  // Patient info band across the page (below header), two columns
  const bandY = headerH + 6
  let bandH = 28
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(9)
  let ty = bandY + 5
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
  r('Date:', createdAt.toLocaleDateString(), -12)
  r('Doctor:', (data.doctor?.name ? `Dr. ${data.doctor.name}` : undefined), -8)
  r('Department:', data.doctor?.departmentName, -4)

  // Draw the band border sized to content
  pdf.setDrawColor(203,213,225)
  bandH = Math.max(bandH, (maxBandY - bandY) + 5)
  pdf.roundedRect(leftX, bandY, pageWidth - leftX*2, bandH, 2, 2)

  // Divider after patient info
  try {
    pdf.setDrawColor(0,0,0)
    pdf.setLineWidth(0.4)
    const divY = bandY + bandH + 3
    pdf.line(leftX, divY, pageWidth - leftX, divY)
  } catch {}

  // Layout below band
  const leftY = bandY + bandH + 8

  // Reduce Rx box width and align it to the right side
  const rxW = (pageWidth - leftX * 2) * 0.75
  const rxX = pageWidth - 12 - rxW
  const rxY = leftY
  // Reserve ~25% blank area on the right inside Rx box
  const rxRightBlankW = rxW * 0.25

  // Left side content area (empty space to the left of Rx box)
  const sideX = leftX
  const sideY = leftY
  const sideW = Math.max(10, rxX - leftX - 4)
  let sy = sideY + 8
  try {
    pdf.setTextColor(0,0,0)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text('Vitals', sideX + 2, sy)
    sy += 6

    const vitals: any = (data as any).vitals || {}
    const bpText = (() => {
      const sys = vitals.bloodPressureSys ?? vitals.sys ?? vitals.SYS ?? vitals.bpSys
      const dia = vitals.bloodPressureDia ?? vitals.dia ?? vitals.DIA ?? vitals.bpDia
      if (sys != null && dia != null) return `${String(sys)}/${String(dia)}`
      if (sys != null) return String(sys)
      if (dia != null) return String(dia)
      return vitals.bp ?? vitals.BP
    })()
    const heightText = vitals.heightCm ?? vitals.height
    const weightText = vitals.weightKg ?? vitals.weight
    const vLine = (label: string, value: any) => {
      pdf.setFont('helvetica','bold')
      pdf.setFontSize(9)
      pdf.text(`${label}:`, sideX + 2, sy)
      pdf.setFont('helvetica','normal')
      pdf.text(String(value ?? '-'), sideX + 22, sy)
      sy += 5
    }
    const bpWithUnit = (bpText != null && String(bpText).trim() && !String(bpText).includes('mmHg')) ? `${bpText} mmHg` : (bpText || '-')
    vLine('BP', bpWithUnit)
    vLine('Height', (heightText != null && String(heightText).trim() ? `${heightText} feet` : '-'))
    vLine('Weight', (weightText != null && String(weightText).trim() ? `${weightText} kg` : '-'))

    sy += 4
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text('Lab Orders', sideX + 2, sy)
    sy += 6

    const tests = Array.isArray(data.labTests) ? data.labTests.map(t => String(t || '').trim()).filter(Boolean) : []
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    for (const t of tests) {
      const wrapped = pdf.splitTextToSize(`• ${t}`, Math.max(20, sideW - 4))
      pdf.text(wrapped, sideX + 2, sy)
      sy += wrapped.length * 4 + 1
      if (sy > pageHeight - 30) break
    }

    const labNote = String((data as any).labNotes || '').trim()
    if (labNote && sy <= pageHeight - 30) {
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Note:', sideX + 2, sy)
      const noteW = (pdf as any).getTextWidth ? (pdf as any).getTextWidth('Note:') : 18
      pdf.setFont('helvetica', 'normal')
      const wrapped = pdf.splitTextToSize(String(labNote), Math.max(20, sideW - 4) - (noteW + 1))
      pdf.text(wrapped, sideX + 2 + noteW + 1, sy)
      sy += wrapped.length * 4 + 1
    }

    sy += 4
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text('Diagnostic Orders', sideX + 2, sy)
    sy += 6

    const diagTests = Array.isArray(data.diagnosticTests)
      ? data.diagnosticTests.map(t => String(t || '').trim()).filter(Boolean)
      : []
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    for (const t of diagTests) {
      const wrapped = pdf.splitTextToSize(`• ${t}`, Math.max(20, sideW - 4))
      pdf.text(wrapped, sideX + 2, sy)
      sy += wrapped.length * 4 + 1
      if (sy > pageHeight - 30) break
    }

    const diagNote = String((data as any).diagnosticNotes || '').trim()
    if (diagNote && sy <= pageHeight - 30) {
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Note:', sideX + 2, sy)
      const noteW = (pdf as any).getTextWidth ? (pdf as any).getTextWidth('Note:') : 18
      pdf.setFont('helvetica', 'normal')
      const wrapped = pdf.splitTextToSize(String(diagNote), Math.max(20, sideW - 4) - (noteW + 1))
      pdf.text(wrapped, sideX + 2 + noteW + 1, sy)
      sy += wrapped.length * 4 + 1
    }

    const diagDiscount = (data as any).diagnosticDiscount
    if (diagDiscount != null && sy <= pageHeight - 30) {
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Discount:', sideX + 2, sy)
      const discW = (pdf as any).getTextWidth ? (pdf as any).getTextWidth('Discount:') : 22
      pdf.setFont('helvetica', 'normal')
      const wrapped = pdf.splitTextToSize(String(diagDiscount), Math.max(20, sideW - 4) - (discW + 1))
      pdf.text(wrapped, sideX + 2 + discW + 1, sy)
      sy += wrapped.length * 4 + 1
    }
  } catch {}

  // Big Rx mark and prep to draw Rx box border later
  pdf.setDrawColor(203,213,225)
  pdf.setLineWidth(0.4)
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(17)
  pdf.setTextColor(30, 64, 175)
  pdf.text('Rx.', rxX + 4, rxY + 9)
  pdf.setTextColor(0,0,0)

  // Rx content starts with inner padding to avoid overlapping the 'R'
  const contentX = rxX + 16
  const contentRight = rxX + rxW - 12 - rxRightBlankW
  const rxInnerRight = rxX + rxW - 12
  let y = rxY + 14
  pdf.setFont('helvetica','normal')
  pdf.setFontSize(9)

  const toLabel = (k: string) => {
    const s = String(k || '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
  }
  const isEmpty = (v: any) => {
    if (v == null) return true
    if (typeof v === 'string') return v.trim() === ''
    if (typeof v === 'number') return !isFinite(v)
    if (typeof v === 'boolean') return v === false
    if (Array.isArray(v)) return v.length === 0
    if (typeof v === 'object') return Object.keys(v).length === 0
    return false
  }
  const collectLines = (obj: any, prefix = ''): string[] => {
    if (obj == null) return []
    if (typeof obj === 'string' || typeof obj === 'number') {
      const v = String(obj).trim()
      if (!v) return []
      return prefix ? [`${prefix}: ${v}`] : [v]
    }
    if (typeof obj === 'boolean') {
      if (!obj) return []
      return prefix ? [prefix] : ['Yes']
    }
    if (Array.isArray(obj)) {
      const out: string[] = []
      for (let i = 0; i < obj.length; i++) {
        const it = obj[i]
        if (it == null) continue
        if (typeof it === 'string' || typeof it === 'number') {
          const v = String(it).trim()
          if (v) out.push(prefix ? `${prefix}: ${v}` : v)
          continue
        }
        if (typeof it === 'boolean') {
          if (it) out.push(prefix ? `${prefix}: Yes` : 'Yes')
          continue
        }
        if (typeof it === 'object') {
          const lines = collectLines(it, prefix ? `${prefix} #${i + 1}` : `#${i + 1}`)
          out.push(...lines)
        }
      }
      return out
    }
    if (typeof obj === 'object') {
      const out: string[] = []
      for (const key of Object.keys(obj)) {
        const v = (obj as any)[key]
        if (isEmpty(v)) continue
        const label = toLabel(key)
        const nextPrefix = prefix ? `${prefix} - ${label}` : label
        if (typeof v === 'string' || typeof v === 'number') {
          const sv = String(v).trim()
          if (sv) out.push(`${nextPrefix}: ${sv}`)
          continue
        }
        if (typeof v === 'boolean') {
          if (v) out.push(nextPrefix)
          continue
        }
        if (Array.isArray(v)) {
          out.push(...collectLines(v, nextPrefix))
          continue
        }
        if (typeof v === 'object') {
          out.push(...collectLines(v, nextPrefix))
          continue
        }
      }
      return out
    }
    return []
  }
  const wrapW = Math.max(20, contentRight - contentX)
  const block = (title: string, dataObj: any) => {
    const lines = collectLines(dataObj)
    if (!lines.length) return
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(9)
    pdf.text(title, contentX, y)
    y += 4
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(9)
    for (const ln of lines) {
      const wrapped = pdf.splitTextToSize(String(ln), wrapW)
      pdf.text(wrapped, contentX, y)
      y += wrapped.length * 4
    }
    y += 2
  }

  const therapyBlock = () => {
    const tests = Array.isArray((data as any).therapyTests) ? (data as any).therapyTests.map((t: any) => String(t || '').trim()).filter(Boolean) : []
    const plan: any = (data as any).therapyPlan || {}
    const machines: any = (data as any).therapyMachines || {}
    const note = String((data as any).therapyNotes || '').trim()
    const discount = (data as any).therapyDiscount

    const flattenMachines = (obj: any): string[] => {
      if (!obj || typeof obj !== 'object') return []
      const out: string[] = []
      for (const k of Object.keys(obj)) {
        if (k === '__custom') continue
        const v = obj[k]
        if (!v || typeof v !== 'object') continue
        if (v.enabled !== true && v.Enabled !== true) continue
        const opts: string[] = []
        for (const optKey of Object.keys(v)) {
          if (optKey === 'enabled' || optKey === 'Enabled') continue
          const optVal = v[optKey]
          if (optVal === true) {
            const optLabel = (optKey: string) => {
              const kk = String(k || '').toLowerCase()
              const ok = String(optKey || '').toLowerCase()
              if (kk === 'mcgspg' || kk === 'ms') {
                if (ok === 'dashbar') return '--|'
                if (ok === 'equal') return '='
              }
              return optKey
            }
            opts.push(String(optLabel(optKey) || '').trim())
          } else if (typeof optVal === 'string' || typeof optVal === 'number') {
            const s = String(optVal).trim()
            if (s) opts.push(s)
          }
        }
        if (opts.length) out.push(`${k}: ${opts.join(', ')}`)
        else out.push(String(k))
      }

      try {
        const custom: any = (obj as any)?.__custom
        const defs = Array.isArray(custom?.defs) ? custom.defs : []
        const st = custom?.state && typeof custom.state === 'object' ? custom.state : {}
        for (const def of defs) {
          const id = String(def?.id || '').trim()
          if (!id) continue
          const name = String(def?.name || '').trim() || id
          const cur = (st as any)[id] || {}
          if (!cur || cur.enabled !== true) continue
          if (def?.kind === 'checkboxes') {
            const checks = cur?.checks && typeof cur.checks === 'object' ? cur.checks : {}
            const selected = Object.keys(checks).filter(x => (checks as any)[x] === true).map(x => String(x || '').trim()).filter(Boolean)
            if (selected.length) out.push(`${name}: ${selected.join(', ')}`)
            else out.push(name)
          } else if (def?.kind === 'fields') {
            const fields = cur?.fields && typeof cur.fields === 'object' ? cur.fields : {}
            const entries = Object.keys(fields)
              .map(x => {
                const v = (fields as any)[x]
                const sv = v != null ? String(v).trim() : ''
                const sk = String(x || '').trim()
                if (!sk || !sv) return ''
                return `${sk}: ${sv}`
              })
              .filter(Boolean)
            if (entries.length) out.push(`${name}: ${entries.join(', ')}`)
            else out.push(name)
          } else {
            out.push(name)
          }
        }
      } catch { }

      return out
    }

    const lines = [...tests, ...flattenMachines(machines)].map(s => String(s || '').trim()).filter(Boolean)
    const months = plan?.months != null && String(plan.months).trim() ? String(plan.months).trim() : ''
    const days = plan?.days != null && String(plan.days).trim() ? String(plan.days).trim() : ''
    const packages = (plan?.packages ?? plan?.package) != null && String(plan.packages ?? plan.package).trim() ? String(plan.packages ?? plan.package).trim() : ''
    const planLine = [months ? `Months: ${months}` : '', days ? `Days: ${days}` : '', packages ? `Packages: ${packages}` : ''].filter(Boolean).join(', ')

    if (!lines.length && !planLine && !note) return
    block('Therapy Orders', lines.length ? lines.map(x => `• ${x}`).join('\n') : undefined)
    if (planLine) block('Therapy Plan', planLine)
    if (note) block('Note', note)
    if (discount != null) block('Discount', String(discount))
  }

  pdf.setFont('helvetica','bold')
  pdf.setFontSize(11)
  pdf.text('Prescription', contentX, y)
  y += 6
  therapyBlock()
  ;(() => {
    const c: any = (data as any).counselling
    if (!c || typeof c !== 'object') return
    const lines: string[] = []
    const lccOn = !!c.lcc
    const lccMonth = c.lccMonth != null ? String(c.lccMonth).trim() : ''
    if (lccOn) {
      lines.push('Lcc')
      if (lccMonth) lines.push(`Month: ${lccMonth}`)
    }
    const pkg: any = c.package || c.packages || {}
    const pkgNames: string[] = []
    const pkgMonths: string[] = []
    const addPkg = (enabled: any, name: string, monthVal: any) => {
      if (!enabled) return
      pkgNames.push(name)
      const m = monthVal != null ? String(monthVal).trim() : ''
      if (m) pkgMonths.push(m)
    }
    addPkg(pkg?.d4, 'D4', pkg?.d4Month)
    addPkg(pkg?.r4, 'R4', pkg?.r4Month)
    if (pkgNames.length) lines.push(`Package - ${pkgNames.join(', ')}`)
    if (pkgMonths.length) lines.push(`Month: ${pkgMonths.join(', ')}`)
    const note = c.note != null ? String(c.note).trim() : ''
    if (note) lines.push(`Note: ${note}`)
    const disc = (data as any).counsellingDiscount
    if (disc != null) lines.push(`Discount: ${disc}`)
    if (lines.length) block('Counselling', lines.join('\n'))
  })()

  const medRows = (data.items || []).map((m: any, idx: number) => {
    const notes = String(m?.notes || '')
    const mRoute = notes.match(/Route:\s*([^;]+)/i)
    const mInstr = notes.match(/Instruction:\s*([^;]+)/i)
    const route = m?.route != null && String(m.route).trim() ? String(m.route) : (mRoute?.[1]?.trim() || '-')
    const instruction = m?.instruction != null && String(m.instruction).trim() ? String(m.instruction) : (mInstr?.[1]?.trim() || '-')
    return [ String(idx+1), String(m.name||'-'), String(m.frequency||'-'), String(m.dose||'-'), String(m.duration||'-'), String(instruction||'-'), String(route||'-') ]
  })
  pdf.setFont('helvetica','bold')
  pdf.text('Medication', contentX, y)
  y += 4
  autoTable(pdf, {
    startY: y,
    margin: { left: contentX, right: pageWidth - rxInnerRight },
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
