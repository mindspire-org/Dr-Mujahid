import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PrescriptionPdfData } from '../../prescriptionPdf'

export async function buildRxDefault(data: PrescriptionPdfData){
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
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
  const leftX = 14
  const rightX = pageWidth / 2
  const colGap = 2
  const lineH = 5
  const startY = y
  const left = [
    `Patient Name: ${data.patient?.name || '-'}`,
    `Age: ${data.patient?.age || '-'}`,
    `Gender: ${data.patient?.gender || '-'}`,
    `Phone: ${data.patient?.phone || '-'}`,
    `Address: ${data.patient?.address || '-'}`,
  ]
  const right = [
    `MR Number: ${data.patient?.mrn || '-'}`,
    `Date: ${createdAt.toLocaleDateString()}`,
    `Doctor: ${data.doctor?.name ? `Dr. ${data.doctor.name}` : '-'}`,
    `Department: ${data.doctor?.departmentName || '-'}`,
    '',
  ]
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const yy = startY + i * lineH
    if (left[i]) pdf.text(String(left[i]), leftX, yy)
    if (right[i]) pdf.text(String(right[i]), rightX + colGap, yy)
  }
  y = startY + Math.max(left.length, right.length) * lineH

  // Divider after patient info
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  pdf.line(14, y, pageWidth - 14, y)
  y += 6

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
  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 14) return
    pdf.addPage()
    y = 14
  }
  const block = (title: string, dataObj: any) => {
    const lines = collectLines(dataObj)
    if (!lines.length) return
    ensureSpace(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(title, 14, y)
    y += 4
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    for (const ln of lines) {
      const wrapped = pdf.splitTextToSize(String(ln), pageWidth - 28)
      ensureSpace(Math.max(6, wrapped.length * 4 + 2))
      pdf.text(wrapped, 14, y)
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

  const ordersComma = (title: string, tests?: string[], notes?: string, discount?: number) => {
    const list = Array.isArray(tests) ? tests.map(t => String(t || '').trim()).filter(Boolean) : []
    const n = String(notes || '').trim()
    const hasDiscount = discount != null
    if (!list.length && !n && !hasDiscount) return
    const obj: any = {}
    if (list.length) obj.tests = list.join(', ')
    if (n) obj.note = n
    if (hasDiscount) obj.discount = discount
    block(title, obj)
  }

  ensureSpace(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Prescription', 14, y)
  y += 6

  ordersComma('Lab Orders', data.labTests, data.labNotes)
  ordersComma('Diagnostic Orders', data.diagnosticTests, data.diagnosticNotes, (data as any).diagnosticDiscount)
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
  const bodyRows = ((data.items || []) as any[]).map((m: any, idx: number) => {
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
