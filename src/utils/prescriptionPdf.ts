import { buildRxDefault } from './prescription/templates/default'
import { buildRxVitalsLeft } from './prescription/templates/rxVitalsLeft'

export type PrescriptionPdfData = {
  doctor?: { name?: string; qualification?: string; departmentName?: string; phone?: string }
  settings?: { name?: string; address?: string; phone?: string; logoDataUrl?: string }
  patient?: { name?: string; mrn?: string; gender?: string; fatherName?: string; age?: string; phone?: string; address?: string }
  items?: Array<{ name?: string; frequency?: string; duration?: string; dose?: string; instruction?: string; route?: string }>
  historyTaking?: {
    personalInfo?: any
    maritalStatus?: any
    coitus?: any
    health?: any
    sexualHistory?: any
    previousMedicalHistory?: any
  }
  primaryComplaint?: string
  primaryComplaintHistory?: string
  familyHistory?: string
  allergyHistory?: string
  treatmentHistory?: string
  history?: string
  examFindings?: string
  diagnosis?: string
  advice?: string
  vitals?: {
    pulse?: number
    temperatureC?: number
    bloodPressureSys?: number
    bloodPressureDia?: number
    respiratoryRate?: number
    bloodSugar?: number
    weightKg?: number
    heightCm?: number
    bmi?: number
    bsa?: number
    spo2?: number
  }
  labTests?: string[]
  labNotes?: string
  diagnosticTests?: string[]
  diagnosticNotes?: string
  diagnosticDiscount?: string
  therapyTests?: string[]
  therapyNotes?: string
  therapyDiscount?: string
  therapyPlan?: any
  therapyMachines?: any
  counselling?: any
  counsellingDiscount?: string
  createdAt?: string | Date
}

export type PrescriptionPdfTemplate = 'default' | 'rx-vitals-left'

export async function downloadPrescriptionPdf(data: PrescriptionPdfData, fileName: string, template: PrescriptionPdfTemplate = 'default'){
  const pdf = template === 'rx-vitals-left' ? await buildRxVitalsLeft(data) : await buildRxDefault(data)
  pdf.save(fileName)
}

export async function previewPrescriptionPdf(data: PrescriptionPdfData, template: PrescriptionPdfTemplate = 'default'){
  const pdf = template === 'rx-vitals-left' ? await buildRxVitalsLeft(data) : await buildRxDefault(data)
  const blob = (pdf as any).output('blob') as Blob
  const url = URL.createObjectURL(blob)

  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '9999'
  overlay.style.background = 'rgba(0,0,0,0.5)'
  overlay.className = 'no-print'

  const panel = document.createElement('div')
  panel.style.position = 'absolute'
  panel.style.left = '50%'
  panel.style.top = '50%'
  panel.style.transform = 'translate(-50%, -50%)'
  panel.style.width = 'min(1000px, 95vw)'
  panel.style.height = 'min(90vh, 900px)'
  panel.style.background = '#ffffff'
  panel.style.borderRadius = '12px'
  panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)'
  panel.style.display = 'flex'
  panel.style.flexDirection = 'column'

  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.alignItems = 'center'
  header.style.justifyContent = 'space-between'
  header.style.padding = '8px 12px'
  header.style.borderBottom = '1px solid #e5e7eb'
  const title = document.createElement('div')
  title.textContent = 'Prescription Preview'
  title.style.fontWeight = '600'
  title.style.color = '#0f172a'
  header.appendChild(title)
  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.gap = '8px'
  const btnPrint = document.createElement('button')
  btnPrint.textContent = 'Print'
  btnPrint.style.padding = '6px 10px'
  btnPrint.style.borderRadius = '6px'
  btnPrint.style.background = '#1f2937'
  btnPrint.style.color = '#fff'
  btnPrint.style.border = '1px solid #1f2937'
  const btnClose = document.createElement('button')
  btnClose.textContent = 'Close'
  btnClose.style.padding = '6px 10px'
  btnClose.style.borderRadius = '6px'
  btnClose.style.border = '1px solid #cbd5e1'
  btnClose.style.background = '#fff'
  btnClose.style.color = '#0f172a'
  actions.appendChild(btnPrint)
  actions.appendChild(btnClose)
  header.appendChild(actions)

  const frame = document.createElement('iframe')
  frame.src = url
  frame.style.flex = '1'
  frame.style.width = '100%'
  frame.style.height = '100%'
  frame.style.border = '0'

  function cleanup(){
    try { URL.revokeObjectURL(url) } catch {}
    try { document.removeEventListener('keydown', onKey) } catch {}
    try { overlay.remove() } catch {}
  }
  function onKey(e: KeyboardEvent){
    if (e.key === 'Escape') { e.preventDefault(); cleanup() }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); cleanup() }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); try { frame.contentWindow?.focus(); frame.contentWindow?.print() } catch {} }
  }
  btnClose.onclick = () => cleanup()
  btnPrint.onclick = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print() } catch {} }
  document.addEventListener('keydown', onKey)

  panel.appendChild(header)
  panel.appendChild(frame)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
}
