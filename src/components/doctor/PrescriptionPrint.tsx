type Props = {
  printId?: string
  doctor: { name?: string; specialization?: string; qualification?: string; departmentName?: string; phone?: string }
  settings: { name: string; address: string; phone: string; logoDataUrl?: string }
  patient: { name?: string; mrn?: string; gender?: string; fatherName?: string; age?: string; phone?: string; address?: string }
  items: Array<{ name: string; frequency?: string; duration?: string; dose?: string; instruction?: string; route?: string }>
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
  historyTaking?: {
    personalInfo?: any
    maritalStatus?: any
    coitus?: any
    health?: any
    sexualHistory?: any
    previousMedicalHistory?: any
  } | any
  labTests?: string[]
  labNotes?: string
  diagnosticTests?: string[]
  diagnosticNotes?: string
  diagnosticDiscount?: number
  therapyTests?: string[]
  therapyNotes?: string
  therapyDiscount?: number
  therapyPlan?: any
  therapyMachines?: any
  counselling?: any
  counsellingDiscount?: number
  primaryComplaint?: string
  primaryComplaintHistory?: string
  familyHistory?: string
  treatmentHistory?: string
  allergyHistory?: string
  history?: string
  examFindings?: string
  diagnosis?: string
  advice?: string
  createdAt?: string | Date
}

export default function PrescriptionPrint(props: Props) {
  const { printId = 'prescription-print', doctor, settings, patient, items, createdAt, labTests, labNotes, diagnosticTests, diagnosticNotes, vitals } = props
  const dt = createdAt ? new Date(createdAt) : new Date()

  const renderCounselling = () => {
    const c: any = props.counselling || null
    if (!c || typeof c !== 'object') return null
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
    if (!lines.length && !note) return null
    return (
      <div>
        <div className="text-xs font-semibold text-slate-700">Counselling</div>
        <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-sm">
          {lines.map((ln, idx) => (<div key={idx}>{ln}</div>))}
          {note && <div className="mt-1 text-xs text-slate-600">Note: {note}</div>}
          {props.counsellingDiscount != null && <div className="mt-1 text-xs text-slate-600">Discount: {props.counsellingDiscount}</div>}
        </div>
      </div>
    )
  }

  const bpText = (() => {
    const sys = vitals?.bloodPressureSys
    const dia = vitals?.bloodPressureDia
    if (sys != null && dia != null) return `${String(sys)}/${String(dia)} mmHg`
    if (sys != null) return `${String(sys)} mmHg`
    if (dia != null) return `${String(dia)} mmHg`
    return '-'
  })()
  const heightText = vitals?.heightCm != null ? `${String(vitals.heightCm)} feet` : '-'
  const weightText = vitals?.weightKg != null ? `${String(vitals.weightKg)} kg` : '-'

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
          const inner = collectLines(v, nextPrefix)
          out.push(...inner)
          continue
        }
        if (typeof v === 'object') {
          const inner = collectLines(v, nextPrefix)
          out.push(...inner)
          continue
        }
      }
      return out
    }
    return []
  }

  const renderBlock = (title: string, data: any) => {
    const lines = collectLines(data)
    if (!lines.length) return null
    return (
      <div>
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-sm">
          {lines.map((ln, idx) => (
            <div key={idx}>{ln}</div>
          ))}
        </div>
      </div>
    )
  }

  const renderTherapy = () => {
    const tests = Array.isArray(props.therapyTests) ? props.therapyTests.map(s => String(s || '').trim()).filter(Boolean) : []
    const note = String(props.therapyNotes || '').trim()
    const plan: any = props.therapyPlan || {}
    const machines: any = (() => {
      const raw: any = props.therapyMachines
      if (raw == null) return {}
      if (typeof raw === 'string') {
        try { return JSON.parse(raw) } catch { return {} }
      }
      return raw
    })()
    const customMachines: any = (() => {
      const raw: any = (machines as any)?.__custom
      if (raw == null) return null
      if (typeof raw === 'string') {
        try { return JSON.parse(raw) } catch { return null }
      }
      return raw
    })()
    const m = plan?.months != null && String(plan.months).trim() ? String(plan.months).trim() : ''
    const d = plan?.days != null && String(plan.days).trim() ? String(plan.days).trim() : ''
    const p = (plan?.packages ?? plan?.package) != null && String(plan.packages ?? plan.package).trim() ? String(plan.packages ?? plan.package).trim() : ''
    const planParts = [m ? `Months: ${m}` : '', d ? `Days: ${d}` : '', p ? `Packages: ${p}` : ''].filter(Boolean)
    const planLine = planParts.join(', ')

    const machineLabel = (key: string) => {
      const k = String(key || '').trim()
      if (!k) return ''
      if (k.toLowerCase() === 'chi') return 'Chi'
      if (k.toLowerCase() === 'eswt') return 'Eswt'
      if (k.toLowerCase() === 'ms') return 'Mcg Spg'
      if (k.toLowerCase() === 'mcgspg') return 'Mcg Spg'
      return k
    }
    const optionLabel = (key: string) => {
      const k = String(key || '').trim()
      if (!k) return ''
      if (k.toLowerCase() === 'pr') return 'PR'
      if (k.toLowerCase() === 'bk') return 'Bk'
      if (k.toLowerCase() === 'v1000') return 'V1000'
      if (k.toLowerCase() === 'v1500') return 'V1500'
      if (k.toLowerCase() === 'v2000') return 'V2000'
      if (k.toLowerCase() === 'dashbar') return '--|'
      if (k.toLowerCase() === 'equal') return '='
      return k
    }

    const machineLines: string[] = []
    try {
      for (const rawKey of Object.keys(machines || {})) {
        if (rawKey === '__custom') continue
        const v = (machines as any)[rawKey]
        if (!v || typeof v !== 'object') continue
        if (v.enabled !== true && v.Enabled !== true) continue
        const root = machineLabel(rawKey)
        if (!root) continue
        const opts: string[] = []
        for (const optKey of Object.keys(v)) {
          if (optKey === 'enabled' || optKey === 'Enabled') continue
          const optVal = (v as any)[optKey]
          if (optVal === true) {
            const opt = optionLabel(optKey)
            if (opt) opts.push(opt)
          } else if (typeof optVal === 'string' || typeof optVal === 'number') {
            const s = String(optVal).trim()
            if (s) opts.push(s)
          }
        }
        if (opts.length) machineLines.push(`${root}: ${opts.join(', ')}`)
        else machineLines.push(root)
      }
    } catch { }

    try {
      const defs = Array.isArray(customMachines?.defs) ? customMachines.defs : []
      const st = customMachines?.state && typeof customMachines.state === 'object' ? customMachines.state : {}
      for (const def of defs) {
        const id = String(def?.id || '').trim()
        if (!id) continue
        const name = String(def?.name || '').trim() || id
        const cur = (st as any)[id] || {}
        if (!cur || cur.enabled !== true) continue
        if (def?.kind === 'checkboxes') {
          const checks = cur?.checks && typeof cur.checks === 'object' ? cur.checks : {}
          const selected = Object.keys(checks).filter(k => (checks as any)[k] === true).map(k => String(k || '').trim()).filter(Boolean)
          if (selected.length) machineLines.push(`${name}: ${selected.join(', ')}`)
          else machineLines.push(name)
        } else if (def?.kind === 'fields') {
          const fields = cur?.fields && typeof cur.fields === 'object' ? cur.fields : {}
          const entries = Object.keys(fields)
            .map(k => {
              const v = (fields as any)[k]
              const sv = v != null ? String(v).trim() : ''
              const sk = String(k || '').trim()
              if (!sk || !sv) return ''
              return `${sk}: ${sv}`
            })
            .filter(Boolean)
          if (entries.length) machineLines.push(`${name}: ${entries.join(', ')}`)
          else machineLines.push(name)
        } else {
          machineLines.push(name)
        }
      }
    } catch { }

    const lines = [...tests, ...machineLines].map(x => String(x || '').trim()).filter(Boolean)
    if (!lines.length && !planLine && !note) return null
    return (
      <div>
        <div className="text-xs font-semibold text-slate-700">Therapy Orders</div>
        <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-sm">
          {lines.map((t, idx) => (<div key={idx}>• {t}</div>))}
        </div>
        {planLine && (
          <div className="mt-2">
            <div className="text-xs font-semibold text-slate-700">Therapy Plan</div>
            <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-sm">{planLine}</div>
          </div>
        )}
        {note && (
          <div className="mt-2 text-xs text-slate-600">
            Note: {note}
          </div>
        )}
        {props.therapyDiscount != null && (
          <div className="mt-1 text-xs text-slate-600">Discount: {props.therapyDiscount}</div>
        )}
      </div>
    )
  }

  const renderOrdersComma = (title: string, tests?: string[], notes?: string, discount?: number) => {
    const list = Array.isArray(tests) ? tests.map(s => String(s || '').trim()).filter(Boolean) : []
    const n = String(notes || '').trim()
    const hasDiscount = discount != null
    if (!list.length && !n && !hasDiscount) return null
    const joined = list.join(', ')
    return (
      <div>
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-sm">
          {joined || '-'}
          {n && <div className="mt-1 text-xs text-slate-600"><span className="font-semibold">Note:</span>{n}</div>}
          {hasDiscount && <div className="mt-1 text-xs text-slate-600">Discount: {discount}</div>}
        </div>
      </div>
    )
  }
  const rows = (items || []).map((m, i) => {
    const parts = String(m.frequency || '').split('/').map(s => s.trim()).filter(Boolean)
    let en = '-', ur = ''
    const cnt = parts.length
    if (cnt === 1) { en = 'Once a day'; ur = 'دن میں ایک بار' }
    else if (cnt === 2) { en = 'Twice a day'; ur = 'دن میں دو بار' }
    else if (cnt === 3) { en = 'Thrice a day'; ur = 'دن میں تین بار' }
    else if (cnt >= 4) { en = 'Four times a day'; ur = 'دن میں چار بار' }
    else if ((m.frequency || '').trim()) { en = String(m.frequency).trim() }
    const freq = ur ? `${en}\n${ur}` : en
    const d = String(m.duration || '').trim()
    const dm = d.match(/\d+/)
    const duration = dm ? `${d}\nدن ${dm[0]}` : (d || '-')
    const dose = (m as any).dose || (m as any).qty || '-'
    return { sr: i + 1, name: m.name || '-', freq, dose, duration, instruction: (m as any).instruction || '-', route: (m as any).route || '-' }
  })
  return (
    <div id={printId} className="hidden print:block">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 rounded-md bg-blue-800 px-4 py-3 text-white">
          <div className="grid grid-cols-12 items-start gap-4">
            <div className="col-span-5 self-start">
              {doctor?.specialization && (
                <div className="text-xs font-semibold opacity-95">Consultant {doctor.specialization}</div>
              )}
              <div className="text-lg font-extrabold leading-tight">Dr. {doctor?.name || '-'}</div>
              {doctor?.qualification && <div className="text-xs opacity-95">{doctor.qualification}</div>}
              {doctor?.departmentName && <div className="text-xs opacity-95">{doctor.departmentName}</div>}
              {doctor?.phone && <div className="text-xs opacity-95">{doctor.phone}</div>}
            </div>
            <div className="col-span-2 text-center self-start">
              {settings?.logoDataUrl && <img src={settings.logoDataUrl} alt="logo" className="mx-auto h-14 w-14 object-contain" />}
            </div>
            <div className="col-span-5 text-right self-start">
              <div className="text-xl font-extrabold leading-tight">{settings?.name || ''}</div>
              {settings?.phone && <div className="text-xs opacity-95">{settings.phone}</div>}
              <div className="text-xs opacity-95">{settings?.address || ''}</div>
            </div>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-x-6 gap-y-0 text-xs leading-none">
          <div><span className="font-semibold">Patient Name:</span> {patient?.name || '-'}</div>
          <div><span className="font-semibold">MR Number:</span> {patient?.mrn || '-'}</div>

          <div><span className="font-semibold">Age:</span> {patient?.age || '-'}</div>
          <div><span className="font-semibold">Date:</span> {dt.toLocaleDateString()}</div>

          <div><span className="font-semibold">Gender:</span> {patient?.gender || '-'}</div>
          <div><span className="font-semibold">Doctor:</span> Dr. {doctor?.name || '-'}</div>

          <div><span className="font-semibold">Phone:</span> {patient?.phone || '-'}</div>
          <div><span className="font-semibold">Department:</span> {doctor?.departmentName || '-'}</div>

          <div><span className="font-semibold">Address:</span> {patient?.address || '-'}</div>
          <div />
        </div>

        <div className="mb-3 h-px w-full bg-black" />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 space-y-3">
            <div className="text-sm font-semibold">Prescription</div>
            <div>
              <div className="text-xs font-semibold text-slate-700">Vitals</div>
              <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-sm">
                <div>BP: {bpText}</div>
                <div>Height: {heightText}</div>
                <div>Weight: {weightText}</div>
              </div>
            </div>
            {renderOrdersComma('Lab Orders', labTests, labNotes)}
            {renderOrdersComma('Diagnostic Orders', diagnosticTests, diagnosticNotes, props.diagnosticDiscount)}
            {renderCounselling()}
            {renderTherapy()}
          </div>

          <div className="col-span-7">
            <div className="mb-2 text-sm font-semibold">Medication</div>
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-10 border border-slate-300 px-2 py-1 text-left">Sr.</th>
                  <th className="border border-slate-300 px-2 py-1 text-left">Drug</th>
                  <th className="w-28 border border-slate-300 px-2 py-1">Frequency</th>
                  <th className="w-20 border border-slate-300 px-2 py-1">Dosage</th>
                  <th className="w-24 border border-slate-300 px-2 py-1">Duration</th>
                  <th className="w-28 border border-slate-300 px-2 py-1">Instruction</th>
                  <th className="w-20 border border-slate-300 px-2 py-1">Route</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1 align-top">{r.sr}</td>
                    <td className="border border-slate-300 px-2 py-1 align-top"><span className="font-medium">{r.name}</span></td>
                    <td className="border border-slate-300 px-2 py-1 whitespace-pre-line text-center align-top">{r.freq}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center align-top">{r.dose}</td>
                    <td className="border border-slate-300 px-2 py-1 whitespace-pre-line text-center align-top">{r.duration}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center align-top">{r.instruction}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center align-top">{r.route}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="border border-slate-300 px-2 py-3 text-center text-slate-500">No medicines</td></tr>
                )}
              </tbody>
            </table>

            <div className="mt-3 space-y-2">
              {renderBlock('Primary Complaint', props.primaryComplaint)}
              {renderBlock('History of Primary Complaint', props.primaryComplaintHistory)}
              {renderBlock('Family History', props.familyHistory)}
              {renderBlock('Allergy History', props.allergyHistory)}
              {renderBlock('Treatment History', props.treatmentHistory)}
              {renderBlock('History', props.history)}
              {renderBlock('Examination Findings', props.examFindings)}
              {renderBlock('Diagnosis', props.diagnosis)}
              {renderBlock('Advice', props.advice)}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          header, nav, aside, footer, .no-print, .app-header, .sidebar { display: none !important; }
          #${printId} { display: block !important; position: static !important; width: 100% !important; min-height: 100vh !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #ffffff !important; }
        }
      `}</style>
    </div>
  )
}
