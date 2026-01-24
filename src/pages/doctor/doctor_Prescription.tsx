import { useEffect, useMemo, useRef, useState } from 'react'
import { hospitalApi, labApi, pharmacyApi } from '../../utils/api'
import { previewPrescriptionPdf } from '../../utils/prescriptionPdf'
import type { PrescriptionPdfTemplate } from '../../utils/prescriptionPdf'
import Doctor_IpdReferralForm from '../../components/doctor/Doctor_IpdReferralForm'
import { previewIpdReferralPdf } from '../../utils/ipdReferralPdf'
import PrescriptionPrint from '../../components/doctor/PrescriptionPrint'
import SuggestField from '../../components/SuggestField'
import PrescriptionDiagnosticOrders from '../../components/doctor/PrescriptionDiagnosticOrders'
import { useLocation } from 'react-router-dom'

type DoctorSession = { id: string; name: string; username: string }

type Token = {
  id: string
  createdAt: string
  patientName: string
  mrNo: string
  encounterId: string
  doctorId?: string
  doctorName?: string
  status?: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
}

type MedicineRow = {
  name: string
  morning?: string
  noon?: string
  evening?: string
  night?: string
  days?: string
  qty?: string
  route?: string
  instruction?: string
  durationUnit?: 'day(s)'|'week(s)'|'month(s)'
  durationText?: string
  freqText?: string
}

//

export default function Doctor_Prescription() {
  const location = useLocation()
  const today = new Date().toISOString().slice(0, 10)
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [presEncounterIds, setPresEncounterIds] = useState<string[]>([])
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [prefillTokenId, setPrefillTokenId] = useState<string>('')
  const [hxBy, setHxBy] = useState<string>('')
  const [hxDate, setHxDate] = useState<string>(today)
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }
  const [historySaving, setHistorySaving] = useState(false)
  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    mrNo: '',
    age: '',
    pt: '',
    mamUpto: '',
    mamPn: '',
    height: '',
    weight: '',
    bp: '',
    currentAddress: '',
    permanentAddress: '',
    visitStay: '',
    contact1: '',
    contact2: '',
    sleepHrs: '',
    walkExercise: '',
    education: '',
    jobHours: '',
    natureOfWork: '',
    relax: false,
    stressful: false,
  })
  const emptyMarriage = {
    years: '',
    months: '',
    divorce: '',
    separation: '',
    reas: '',
    ageOfWife: '',
    educationOfWife: '',
    marriageType: {
      loveMarriage: false,
      arrangeMarriage: false,
      like: false,
    },
    mutualSatisfaction: '' as '' | 'Satisfactory' | 'Non-Satisfactory',
    mutualCooperation: '' as '' | 'Cooperative' | 'Non Cooperative',
    childStatus: '' as '' | 'No Plan' | 'Trying',
    childStatus2: {
      minors: false,
      pregnant: false,
      abortion: false,
      male: '',
      female: '',
    },
  }
  const [maritalStatus, setMaritalStatus] = useState({
    status: '' as '' | 'Married' | 'To Go' | 'Single',
    marriages: [emptyMarriage],
  })
  const [coitus, setCoitus] = useState({
    intercourse: '' as '' | 'Successful' | 'Faild',
    partnerLiving: '' as '' | 'Together' | 'Out of Town',
    visitHomeMonths: '',
    visitHomeDays: '',
    frequencyType: '' as '' | 'Weekly' | 'Monthly',
    frequencyNumber: '',
    since: '',
    previousFrequency: '',
  })
  const [health, setHealth] = useState({
    conditions: {
      ihd: false,
      epiL: false,
      giPu: false,
      ky: false,
      liv: false,
      hrd: false,
      thy: false,
      accident: false,
      surgery: false,
      obesity: false,
      penileTruma: false,
      otherChecked: false,
      otherText: '',
    },
    diabetes: { me: false, father: false, mother: false, since: '', medicineTaking: '' },
    hypertension: { me: false, father: false, mother: false, since: '', medicineTaking: '' },
    drugHistory: { wine: false, weed: false, tobacco: false, gutka: false, naswar: false, pan: false, other: '', quit: '' },
    smoking: {
      status: '' as '' | 'Yes' | 'No',
      since: '',
      quantityUnit: '' as '' | 'Packs' | 'Units',
      quantityNumber: '',
      quit: '',
    },
  })
  const [sexualHistory, setSexualHistory] = useState({
    erection: {
      percentage: '',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month',
      prePeni: false,
      postPeni: false,
      ej: '' as '' | 'Yes' | 'No',
      med: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pe: {
      preJustValue: '',
      preJustUnit: '' as '' | 'Sec' | 'JK' | 'Min',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month',
      other: '',
    },
    pFluid: {
      foreplay: false,
      phonixSex: false,
      onThoughts: false,
      pornAddiction: false,
      other: '',
      status: '' as '' | 'No issue' | 'ER↓' | 'Weakness',
    },
    ud: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pSize: {
      status: '' as '' | 'Small' | 'Shrink' | 'Bent',
      bentSide: '' as '' | 'Left' | 'Right',
      boeing: '' as '' | 'Yes' | 'No',
    },
    inf: {
      sexuality: {
        status: '' as '' | 'OK' | 'Disturbed',
      },
      diagnosis: {
        azos: false,
        oligo: false,
        terato: false,
        astheno: false,
      },
      problems: {
        magi: false,
        cystitis: false,
        balanitis: false,
      },
      others: '',
    },
    oeMuscle: {
      status: '' as '' | 'OK' | 'Semi' | 'FL',
    },
    oe: {
      disease: {
        peyronie: false,
        calcification: false,
      },
      testes: {
        status: '' as '' | 'Atrophic' | 'Normal',
      },
      epidCst: {
        side: '' as '' | 'Right' | 'Left',
      },
      varicocele: {
        side: '' as '' | 'Right' | 'Left',
        rightGrades: { g1: false, g2: false, g3: false, g4: false },
        leftGrades: { g1: false, g2: false, g3: false, g4: false },
      },
    },
    uss: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    npt: {
      status: '' as '' | 'OK' | 'NIL' | 'RARE',
      erectionPercentage: '',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month',
      other: '',
    },
    desire: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    nightfall: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    experiences: {
      preMarriage: {
        gf: false,
        male: false,
        pros: false,
        mb: false,
        multipleOrOnce: '' as '' | 'Once' | 'Multiple',
        other: '',
      },
      postMarriage: {
        gf: false,
        male: false,
        pros: false,
        mb: false,
        multipleOrOnce: '' as '' | 'Once' | 'Multiple',
        other: '',
      },
    },
  })
  const [previousMedicalHistory, setPreviousMedicalHistory] = useState({
    exConsultation: '',
    exRx: '',
    cause: '',
  })
  const [arrivalReference, setArrivalReference] = useState({
    referredBy: {
      status: '' as '' | 'Doctor' | 'Friend',
      other: '',
    },
    adsSocialMedia: {
      youtube: false,
      google: false,
      facebook: false,
      instagram: false,
      other: '',
    },
    keywords: [] as string[],
    keywordsInput: '',
    appearOnKeyword: {
      drAslamNaveed: false,
      drMujahidFarooq: false,
      mensCareClinic: false,
      olaDoc: false,
      marham: false,
    },
  })

  const getEmptyTherapyPlan = () => ({
    months: '',
    days: '',
    packages: '',
  })

  const getEmptyTherapyMachines = () => ({
    chi: { enabled: false, pr: false, bk: false },
    eswt: { enabled: false, v1000: false, v1500: false, v2000: false },
    ms: { enabled: false, pr: false, bk: false },
    mam: { enabled: false, m: false },
    us: { enabled: false, pr: false, bk: false },
    mcgSpg: { enabled: false, dashBar: false, equal: false },
    mproCryo: { enabled: false, m: false, c: false },
    ximen: { enabled: false, note: '' },
  })

  const [therapyPlan, setTherapyPlan] = useState(getEmptyTherapyPlan())
  const [therapyMachines, setTherapyMachines] = useState(getEmptyTherapyMachines())

  const [counselling, setCounselling] = useState({
    lcc: '' as '' | 'Yes' | 'No',
    lccMonth: '',
    package: {
      d4: false,
      d4Month: '',
      r4: false,
      r4Month: '',
    },
    note: '',
  })
  const [form, setForm] = useState({
    patientKey: '',
    primaryComplaint: '',
    primaryComplaintHistory: '',
    familyHistory: '',
    allergyHistory: '',
    treatmentHistory: '',
    history: '',
    examFindings: '',
    diagnosis: '',
    advice: '',
    labTestsText: '',
    labNotes: '',
    therapyTestsText: '',
    therapyNotes: '',
    vitalsDisplay: {},
    vitalsNormalized: {},
    diagDisplay: { testsText: '', notes: '' },
    meds: [{ name: '', morning: '', noon: '', evening: '', night: '', qty: '', route: '', instruction: '', durationText: '', freqText: '' }] as MedicineRow[],
  })
  const [saved, setSaved] = useState(false)
  const [settings] = useState<{ name: string; address: string; phone: string; logoDataUrl?: string }>({ name: 'Hospital', address: '', phone: '' })
  const [pat, setPat] = useState<{ address?: string; phone?: string; fatherName?: string; gender?: string; age?: string } | null>(null)
  const [doctorInfo, setDoctorInfo] = useState<{ name?: string; specialization?: string; phone?: string; qualification?: string; departmentName?: string } | null>(null)
  const [openReferral, setOpenReferral] = useState(false)
  const referralFormRef = useRef<any>(null)
  const vitalsRef = useRef<any>(null)
  const diagRef = useRef<any>(null)
  const [sugVersion, setSugVersion] = useState(0)
  const [medNameSuggestions, setMedNameSuggestions] = useState<string[]>([])
  const [labTestsInput, setLabTestsInput] = useState<string>('')

  const checkboxCardLabelCls = (checked: boolean) =>
    `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-800`

  const ord = (n: number) => {
    const j = n % 10
    const k = n % 100
    if (j === 1 && k !== 11) return `${n}st`
    if (j === 2 && k !== 12) return `${n}nd`
    if (j === 3 && k !== 13) return `${n}rd`
    return `${n}th`
  }

  const htTabs = [
    'Personal Information',
    'Marital Status',
    'Coitus',
    'Health',
    'Sexual History',
    'Previous Medical History',
    'Arrival Reference',
  ] as const

  const labQuickTests = [
    'S. Testosterone',
    'S. Prolactin',
    'S. LH',
    'S. FSH',
    'S. Estradiol',
    'S. Cortisol',
    'S. Insulin (Fasting)',
    'S. Folic Acid',
    'S. Zinc',
    'S. Vitamin B12',
    '25-Hydroxy D3 (Vitamin D)',
    'Fasting Lipids Profile',
    'Thyroid Profile',
    'LFTs (Liver Function Tests)',
    'RFTs (Renal Function Tests)',
    'HbA1c',
    'Urine DR',
    'Urine C/S',
    'VDRL',
    'TPHA',
    'HBsAg',
    'Anti-HCV',
    'HIV',
    'CBC',
    'Serum Amylase',
    'Semen Analysis',
    'USG Scrotum',
  ] as const

  type ActiveTab = (typeof htTabs)[number] | 'Medicine' | 'labs' | 'diagnostics' | 'therapy' | 'Counselling'
  const [activeTab, setActiveTab] = useState<ActiveTab>('Personal Information')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      const sess = raw ? JSON.parse(raw) : null
      setDoc(sess)
      // Compat: upgrade legacy id to backend id if needed
      const hex24 = /^[a-f\d]{24}$/i
      if (sess && !hex24.test(String(sess.id||''))) {
        ;(async () => {
          try {
            const res = await hospitalApi.listDoctors() as any
            const docs: any[] = res?.doctors || []
            const match = docs.find(d => String(d.username||'').toLowerCase() === String(sess.username||'').toLowerCase()) ||
                          docs.find(d => String(d.name||'').toLowerCase() === String(sess.name||'').toLowerCase())
            if (match) {
              const fixed = { ...sess, id: String(match._id || match.id) }
              try { localStorage.setItem('doctor.session', JSON.stringify(fixed)) } catch {}
              setDoc(fixed)
            }
          } catch {}
        })()
      }
    } catch {}
  }, [])

  // If navigated from queued patients, prefill date range + selected patient
  useEffect(() => {
    try {
      const st: any = (location as any)?.state
      const date = String(st?.date || '')
      const tokenId = String(st?.tokenId || '')
      if (date) { setFrom(date); setTo(date) }
      if (tokenId) setPrefillTokenId(tokenId)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadTokens(); loadPresIds() }, [doc?.id, from, to])
  
  useEffect(() => {
    const h = () => { loadTokens(); loadPresIds() }
    window.addEventListener('doctor:pres-saved', h as any)
    return () => window.removeEventListener('doctor:pres-saved', h as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  // Bootstrap suggestions from previous prescriptions
  useEffect(() => {
    ;(async () => {
      try {
        if (!doc?.id) return
        const res = await hospitalApi.listPrescriptions({ doctorId: doc.id, page: 1, limit: 200 }) as any
        const rows: any[] = res?.prescriptions || []
        const primaries: string[] = []
        const histories: string[] = []
        const primHist: string[] = []
        const family: string[] = []
        const allergy: string[] = []
        const treatment: string[] = []
        const exams: string[] = []
        const diagnosis: string[] = []
        const advice: string[] = []
        const labTestsAll: string[] = []
        const labNotes: string[] = []
        const diagTestsAll: string[] = []
        const diagNotes: string[] = []
        const doses: string[] = []
        const routes: string[] = []
        const instrs: string[] = []
        const freqs: string[] = []
        const durs: string[] = []
        const vPulse: string[] = []
        const vTemp: string[] = []
        const vSys: string[] = []
        const vDia: string[] = []
        const vResp: string[] = []
        const vSugar: string[] = []
        const vWeight: string[] = []
        const vHeight: string[] = []
        const vSpo2: string[] = []
        for (const r of rows) {
          if (r.primaryComplaint) primaries.push(String(r.primaryComplaint))
          if (r.history) histories.push(String(r.history))
          if (r.primaryComplaintHistory) primHist.push(String(r.primaryComplaintHistory))
          if (r.familyHistory) family.push(String(r.familyHistory))
          if (r.allergyHistory) allergy.push(String(r.allergyHistory))
          if (r.treatmentHistory) treatment.push(String(r.treatmentHistory))
          if (r.examFindings) exams.push(String(r.examFindings))
          if (r.diagnosis) diagnosis.push(String(r.diagnosis))
          if (r.advice) advice.push(String(r.advice))
          if (Array.isArray(r.labTests)) labTestsAll.push(...(r.labTests as any[]).map(x=>String(x||'')))
          if (r.labNotes) labNotes.push(String(r.labNotes))
          if (Array.isArray(r.diagnosticTests)) diagTestsAll.push(...(r.diagnosticTests as any[]).map((x:any)=>String(x||'')))
          if (r.diagnosticNotes) diagNotes.push(String(r.diagnosticNotes))
          // collect vitals suggestions from previous prescriptions
          try {
            const vv = r.vitals || {}
            if (vv.pulse != null) vPulse.push(String(vv.pulse))
            if (vv.temperatureC != null) vTemp.push(String(vv.temperatureC))
            if (vv.bloodPressureSys != null) vSys.push(String(vv.bloodPressureSys))
            if (vv.bloodPressureDia != null) vDia.push(String(vv.bloodPressureDia))
            if (vv.respiratoryRate != null) vResp.push(String(vv.respiratoryRate))
            if (vv.bloodSugar != null) vSugar.push(String(vv.bloodSugar))
            if (vv.weightKg != null) vWeight.push(String(vv.weightKg))
            if (vv.heightCm != null) vHeight.push(String(vv.heightCm))
            if (vv.spo2 != null) vSpo2.push(String(vv.spo2))
          } catch {}
          try {
            const items = Array.isArray(r.items) ? (r.items as any[]) : []
            for (const it of items) {
              if (it?.dose) doses.push(String(it.dose))
              if (it?.frequency) freqs.push(String(it.frequency))
              if (it?.duration) durs.push(String(it.duration))
              if (it?.notes) {
                const notes = String(it.notes)
                const mRoute = notes.match(/Route:\s*([^;]+)/i)
                const mInstr = notes.match(/Instruction:\s*([^;]+)/i)
                if (mRoute && mRoute[1]) routes.push(mRoute[1].trim())
                if (mInstr && mInstr[1]) instrs.push(mInstr[1].trim())
              }
            }
          } catch {}
        }
        addMany('primaryComplaint', primaries)
        addMany('history', histories)
        addMany('primaryComplaintHistory', primHist)
        addMany('familyHistory', family)
        addMany('allergyHistory', allergy)
        addMany('treatmentHistory', treatment)
        addMany('examFindings', exams)
        addMany('diagnosis', diagnosis)
        addMany('advice', advice)
        addMany('labTest', labTestsAll)
        addMany('labNotes', labNotes)
        addMany('diagTest', diagTestsAll)
        addMany('diagNotes', diagNotes)
        addMany('dose', doses)
        addMany('route', routes)
        addMany('instruction', instrs)
        // frequency choices in UI are normalized; still store historical labels
        addMany('frequencyTag', freqs)
        addMany('durationTag', durs)
        // vitals suggestions
        addMany('vitals.pulse', vPulse)
        addMany('vitals.temperature', vTemp)
        addMany('vitals.sys', vSys)
        addMany('vitals.dia', vDia)
        addMany('vitals.resp', vResp)
        addMany('vitals.sugar', vSugar)
        addMany('vitals.weight', vWeight)
        addMany('vitals.height', vHeight)
        addMany('vitals.spo2', vSpo2)
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  useEffect(() => {
    ;(async () => {
      try {
        if (!doc?.id) { setDoctorInfo(null); return }
        const [drRes, depRes] = await Promise.all([
          hospitalApi.listDoctors() as any,
          hospitalApi.listDepartments() as any,
        ])
        const doctors: any[] = drRes?.doctors || []
        const depArray: any[] = ((depRes as any)?.departments || (depRes as any) || []) as any[]
        const d = doctors.find(x => String(x._id || x.id) === String(doc.id))
        const deptName = d?.primaryDepartmentId ? (depArray.find((z: any)=> String(z._id||z.id) === String(d.primaryDepartmentId))?.name || '') : ''
        if (d) setDoctorInfo({ name: d.name || '', specialization: d.specialization || '', phone: d.phone || '', qualification: d.qualification || '', departmentName: deptName })
      } catch {}
    })()
  }, [doc?.id])

  async function loadTokens(){
    try {
      if (!doc?.id) { setTokens([]); return }
      const params: any = { doctorId: doc.id }
      if (from) params.from = from
      if (to) params.to = to
      const res = await hospitalApi.listTokens(params) as any
      const items: Token[] = (res.tokens || []).map((t: any) => ({
        id: t._id,
        createdAt: t.createdAt,
        patientName: t.patientName || '-',
        mrNo: t.mrn || '-',
        encounterId: String(t.encounterId || ''),
        doctorId: t.doctorId?._id || String(t.doctorId || ''),
        doctorName: t.doctorId?.name || '',
        status: t.status,
      }))
      setTokens(items)
    } catch {
      setTokens([])
    }
  }

  async function loadPresIds(){
    try {
      if (!doc?.id) { setPresEncounterIds([]); return }
      const params: any = { doctorId: doc.id }
      if (from) params.from = from
      if (to) params.to = to
      const res = await hospitalApi.listPrescriptions(params) as any
      const ids: string[] = (res.prescriptions || []).map((p: any) => String(p.encounterId?._id || p.encounterId || ''))
      setPresEncounterIds(ids)
    } catch {
      setPresEncounterIds([])
    }
  }

  const myPatients = useMemo(() => {
    const presSet = new Set(presEncounterIds.filter(Boolean))
    return tokens
      .filter(t => t.doctorId === doc?.id)
      // treat default as pending if not returned/completed/cancelled
      .filter(t => !t.status || (t.status !== 'returned' && t.status !== 'completed' && t.status !== 'cancelled'))
      // exclude encounters with a saved prescription
      .filter(t => !t.encounterId || !presSet.has(String(t.encounterId)))
  }, [tokens, doc, presEncounterIds])

  useEffect(() => {
    if (!prefillTokenId) return
    const exists = myPatients.some(t => String(t.id) === String(prefillTokenId))
    if (!exists) return
    setForm(f => ({ ...f, patientKey: String(prefillTokenId) }))
    setPrefillTokenId('')
  }, [prefillTokenId, myPatients])
  const setMed = (i: number, key: keyof MedicineRow, value: string) => {
    setForm(f => {
      const next = [...f.meds]
      next[i] = { ...next[i], [key]: value }
      return { ...f, meds: next }
    })
  }
  // Frequency now textable; we keep morning/noon/evening/night as fallback only

  async function searchMedicines(q: string){
    try {
      if (!q || q.trim().length < 2) { setMedNameSuggestions([]); return }
      const res: any = await pharmacyApi.searchMedicines(q.trim())
      const list: string[] = Array.isArray(res?.medicines) ? res.medicines.map((m: any)=> String(m.name||m.genericName||'').trim()).filter(Boolean) :
                           Array.isArray(res) ? res.map((m: any)=> String(m.name||m.genericName||m||'').trim()).filter(Boolean) : []
      const uniq = Array.from(new Set(list))
      setMedNameSuggestions(uniq.slice(0, 20))
    } catch { setMedNameSuggestions([]) }
  }
  const addAfter = (i: number) => {
    setForm(f => {
      const next = [...f.meds]
      next.splice(i + 1, 0, { name: '', morning: '', noon: '', evening: '', night: '', qty: '', route: '', instruction: '', durationText: '', freqText: '' })
      return { ...f, meds: next }
    })
  }
  const removeAt = (i: number) => {
    setForm(f => {
      if (f.meds.length <= 1) return f
      const next = f.meds.filter((_, idx) => idx !== i)
      return { ...f, meds: next }
    })
  }
 
  const sel = myPatients.find(t => `${t.id}` === form.patientKey)

  const getEmptyPersonalInfo = () => ({
    name: '',
    mrNo: '',
    age: '',
    pt: '',
    mamUpto: '',
    mamPn: '',
    height: '',
    weight: '',
    bp: '',
    currentAddress: '',
    permanentAddress: '',
    visitStay: '',
    contact1: '',
    contact2: '',
    sleepHrs: '',
    walkExercise: '',
    education: '',
    jobHours: '',
    natureOfWork: '',
    relax: false,
    stressful: false,
  })

  const getEmptyMaritalStatus = () => ({
    status: '' as '' | 'Married' | 'To Go' | 'Single',
    marriages: [
      {
        years: '',
        months: '',
        divorce: '',
        separation: '',
        reas: '',
        ageOfWife: '',
        educationOfWife: '',
        marriageType: {
          loveMarriage: false,
          arrangeMarriage: false,
          like: false,
        },
        mutualSatisfaction: '' as '' | 'Satisfactory' | 'Non-Satisfactory',
        mutualCooperation: '' as '' | 'Cooperative' | 'Non Cooperative',
        childStatus: '' as '' | 'No Plan' | 'Trying',
        childStatus2: {
          minors: false,
          pregnant: false,
          abortion: false,
          male: '',
          female: '',
        },
      },
    ],
  })

  const getEmptyCoitus = () => ({
    intercourse: '' as '' | 'Successful' | 'Faild',
    partnerLiving: '' as '' | 'Together' | 'Out of Town',
    visitHomeMonths: '',
    visitHomeDays: '',
    frequencyType: '' as '' | 'Weekly' | 'Monthly',
    frequencyNumber: '',
    since: '',
    previousFrequency: '',
  })

  const getEmptyHealth = () => ({
    conditions: {
      ihd: false,
      epiL: false,
      giPu: false,
      ky: false,
      liv: false,
      hrd: false,
      thy: false,
      accident: false,
      surgery: false,
      obesity: false,
      penileTruma: false,
      otherChecked: false,
      otherText: '',
    },
    diabetes: { me: false, father: false, mother: false, since: '', medicineTaking: '' },
    hypertension: { me: false, father: false, mother: false, since: '', medicineTaking: '' },
    drugHistory: { wine: false, weed: false, tobacco: false, gutka: false, naswar: false, pan: false, other: '', quit: '' },
    smoking: {
      status: '' as '' | 'Yes' | 'No',
      since: '',
      quantityUnit: '' as '' | 'Packs' | 'Units',
      quantityNumber: '',
      quit: '',
    },
  })

  const getEmptySexualHistory = () => ({
    erection: {
      percentage: '',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month',
      prePeni: false,
      postPeni: false,
      ej: '' as '' | 'Yes' | 'No',
      med: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pe: {
      preJustValue: '',
      preJustUnit: '' as '' | 'Sec' | 'JK' | 'Min',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month',
      other: '',
    },
    pFluid: {
      foreplay: false,
      phonixSex: false,
      onThoughts: false,
      pornAddiction: false,
      other: '',
      status: '' as '' | 'No issue' | 'ER↓' | 'Weakness',
    },
    ud: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pSize: {
      status: '' as '' | 'Small' | 'Shrink' | 'Bent',
      bentSide: '' as '' | 'Left' | 'Right',
      boeing: '' as '' | 'Yes' | 'No',
    },
    inf: {
      sexuality: {
        status: '' as '' | 'OK' | 'Disturbed',
      },
      diagnosis: {
        azos: false,
        oligo: false,
        terato: false,
        astheno: false,
      },
      problems: {
        magi: false,
        cystitis: false,
        balanitis: false,
      },
      others: '',
    },
    oeMuscle: {
      status: '' as '' | 'OK' | 'Semi' | 'FL',
    },
    npt: {
      status: '' as '' | 'OK' | 'NIL' | 'RARE',
      erectionPercentage: '',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month',
      other: '',
    },
    desire: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    nightfall: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    experiences: {
      preMarriage: {
        gf: false,
        male: false,
        pros: false,
        mb: false,
        multipleOrOnce: '' as '' | 'Once' | 'Multiple',
        other: '',
      },
      postMarriage: {
        gf: false,
        male: false,
        pros: false,
        mb: false,
        multipleOrOnce: '' as '' | 'Once' | 'Multiple',
        other: '',
      },
    },
  })

  const getEmptyPreviousMedicalHistory = () => ({
    exConsultation: '',
    exRx: '',
    cause: '',
  })

  const getEmptyArrivalReference = () => ({
    referredBy: {
      status: '' as '' | 'Doctor' | 'Friend',
      other: '',
    },
    adsSocialMedia: {
      youtube: false,
      google: false,
      facebook: false,
      instagram: false,
      other: '',
    },
    keywords: [] as string[],
    keywordsInput: '',
    appearOnKeyword: {
      drAslamNaveed: false,
      drMujahidFarooq: false,
      mensCareClinic: false,
      olaDoc: false,
      marham: false,
    },
  })

  const getEmptyCounselling = () => ({
    lcc: '' as '' | 'Yes' | 'No',
    lccMonth: '',
    package: {
      d4: false,
      d4Month: '',
      r4: false,
      r4Month: '',
    },
    note: '',
  })

  const resetAllTabs = (opts?: { keepPatientKey?: string | number }) => {
    const keepPatientKey = opts?.keepPatientKey == null ? '' : String(opts.keepPatientKey)
    setHxBy('')
    setHxDate(today)
    setPersonalInfo(getEmptyPersonalInfo())
    setMaritalStatus(getEmptyMaritalStatus())
    setCoitus(getEmptyCoitus())
    setHealth(getEmptyHealth())
    setSexualHistory(getEmptySexualHistory())
    setPreviousMedicalHistory(getEmptyPreviousMedicalHistory())
    setArrivalReference(getEmptyArrivalReference())
    setTherapyPlan(getEmptyTherapyPlan())
    setTherapyMachines(getEmptyTherapyMachines())
    setCounselling(getEmptyCounselling())
    setLabTestsInput('')

    setForm({
      patientKey: keepPatientKey,
      primaryComplaint: '',
      primaryComplaintHistory: '',
      familyHistory: '',
      allergyHistory: '',
      treatmentHistory: '',
      history: '',
      examFindings: '',
      diagnosis: '',
      advice: '',
      labTestsText: '',
      labNotes: '',
      therapyTestsText: '',
      therapyNotes: '',
      vitalsDisplay: {},
      vitalsNormalized: {},
      diagDisplay: { testsText: '', notes: '' },
      meds: [{ name: '', morning: '', noon: '', evening: '', night: '', qty: '', route: '', instruction: '', durationText: '', freqText: '' }],
    })

    try { vitalsRef.current?.setDisplay?.({}) } catch {}
    try { diagRef.current?.setDisplay?.({ testsText: '', notes: '' }) } catch {}
    setActiveTab('Personal Information')
  }

  useEffect(() => {
    if (!sel) {
      resetAllTabs({ keepPatientKey: '' })
      return
    }
    setPersonalInfo(p => ({
      ...p,
      name: sel.patientName && sel.patientName !== '-' ? sel.patientName : p.name,
      mrNo: sel.mrNo && sel.mrNo !== '-' ? sel.mrNo : p.mrNo,
      age: pat?.age && pat.age !== '-' ? String(pat.age) : p.age,
    }))
  }, [sel?.id, sel?.patientName, sel?.mrNo, pat?.age])

  useEffect(() => {
    if (!sel?.encounterId) return
    ;(async()=>{
      try{
        const res: any = await hospitalApi.getHistoryTaking(sel.encounterId)
        const ht = res?.historyTaking
        const data = ht?.data
        if (!data) return
        if (ht?.hxBy != null) setHxBy(String(ht.hxBy || ''))
        if (ht?.hxDate != null) setHxDate(String(ht.hxDate || ''))
        else if ((data as any)?.hxDate != null) setHxDate(String((data as any).hxDate || ''))
        if (data.personalInfo) setPersonalInfo({ ...getEmptyPersonalInfo(), ...data.personalInfo })
        if (data.maritalStatus) setMaritalStatus({ ...getEmptyMaritalStatus(), ...data.maritalStatus })
        if (data.coitus) setCoitus({ ...getEmptyCoitus(), ...data.coitus })
        if (data.health) setHealth({ ...getEmptyHealth(), ...data.health })
        if (data.sexualHistory) setSexualHistory({ ...getEmptySexualHistory(), ...data.sexualHistory })
        if (data.previousMedicalHistory) setPreviousMedicalHistory({ ...getEmptyPreviousMedicalHistory(), ...data.previousMedicalHistory })
        if (data.arrivalReference) setArrivalReference({ ...getEmptyArrivalReference(), ...data.arrivalReference })
      } catch (e: any) {
        showToast('error', String(e?.message || 'Failed to load history taking'))
      }
    })()
  }, [sel?.encounterId])

  const saveHistoryTaking = async () => {
    if (!sel?.encounterId) {
      showToast('error', 'Select a patient first')
      return
    }
    if (!hxBy.trim()) {
      showToast('error', 'Hx by is required')
      return
    }
    try {
      setHistorySaving(true)
      await hospitalApi.upsertHistoryTaking(sel.encounterId, {
        hxBy,
        hxDate,
        data: {
          hxBy,
          hxDate,
          personalInfo,
          maritalStatus,
          coitus,
          health,
          sexualHistory,
          previousMedicalHistory,
          arrivalReference,
        },
      } as any)
      showToast('success', 'History Taking saved')
    } catch {
      showToast('error', 'Failed to save History Taking')
    } finally {
      setHistorySaving(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doc || !sel || !sel.encounterId) { alert('Select a patient first'); return }
    const items = (form.meds || [])
      .filter(m => (m.name||'').trim())
      .map(m => ({
        name: String(m.name).trim(),
        dose: m.qty ? String(m.qty).trim() : undefined,
        frequency: (m.freqText && m.freqText.trim()) ? m.freqText.trim() : (['morning','noon','evening','night'].map(k => (m as any)[k]).filter(Boolean).join('/ ') || undefined),
        duration: (m.durationText && m.durationText.trim()) ? m.durationText.trim() : (m.days ? `${m.days} ${m.durationUnit || 'day(s)'}` : undefined),
        notes: (m.route || m.instruction) ? [m.route?`Route: ${m.route}`:null, m.instruction?`Instruction: ${m.instruction}`:null].filter(Boolean).join('; ') : undefined,
      }))
    if (!items.length) { alert('Add at least one medicine'); return }
    const labTests = form.labTestsText.split(/\n|,/).map(s=>s.trim()).filter(Boolean)
    const therapyTests = String((form as any).therapyTestsText || '').split(/\n|,/).map(s=>s.trim()).filter(Boolean)
    try {
      let vRaw = undefined as any
      try { vRaw = vitalsRef.current?.getNormalized?.() } catch {}
      const hasVitals = vRaw && Object.values(vRaw).some(x => x != null && !(typeof x === 'number' && isNaN(x)))
      let vitals: any = undefined
      if (hasVitals) vitals = vRaw
      else if (Object.keys((form as any).vitalsNormalized||{}).length) vitals = (form as any).vitalsNormalized
      else if ((form as any).vitalsDisplay && Object.values((form as any).vitalsDisplay).some(Boolean)) {
        const d: any = (form as any).vitalsDisplay
        const n = (x?: any) => { const v = parseFloat(String(x||'').trim()); return isFinite(v)? v : undefined }
        vitals = {
          pulse: n(d.pulse),
          temperatureC: n(d.temperature),
          bloodPressureSys: n(d.bloodPressureSys),
          bloodPressureDia: n(d.bloodPressureDia),
          respiratoryRate: n(d.respiratoryRate),
          bloodSugar: n(d.bloodSugar),
          weightKg: n(d.weightKg),
          heightCm: n(d.height),
          spo2: n(d.spo2),
        }
      }
      const dRaw = diagRef.current?.getData?.()
      const diagnosticTests = Array.isArray(dRaw?.tests) && dRaw?.tests?.length ? dRaw?.tests : undefined
      const diagnosticNotes = dRaw?.notes || undefined
      await hospitalApi.createPrescription({
        encounterId: sel.encounterId,
        items,
        labTests: labTests.length ? labTests : undefined,
        labNotes: form.labNotes || undefined,
        therapyTests: therapyTests.length ? therapyTests : undefined,
        therapyNotes: (form as any).therapyNotes || undefined,
        diagnosticTests,
        diagnosticNotes,
        primaryComplaint: form.primaryComplaint || undefined,
        primaryComplaintHistory: form.primaryComplaintHistory || undefined,
        familyHistory: form.familyHistory || undefined,
        allergyHistory: form.allergyHistory || undefined,
        treatmentHistory: form.treatmentHistory || undefined,
        history: form.history || undefined,
        examFindings: form.examFindings || undefined,
        diagnosis: form.diagnosis || undefined,
        advice: form.advice || undefined,
        createdBy: doc.name,
        vitals,
      })
      // Save new suggestions locally
      addOne('primaryComplaint', form.primaryComplaint)
      addOne('history', form.history)
      addOne('primaryComplaintHistory', form.primaryComplaintHistory)
      addOne('familyHistory', form.familyHistory)
      addOne('allergyHistory', form.allergyHistory)
      addOne('treatmentHistory', form.treatmentHistory)
      addOne('examFindings', form.examFindings)
      addOne('diagnosis', form.diagnosis)
      addOne('advice', form.advice)
      addMany('labTest', labTests)
      addOne('labNotes', form.labNotes)
      try {
        for (const m of form.meds || []){
          if (m.qty) addOne('dose', m.qty)
          if (m.instruction) addOne('instruction', m.instruction)
          if (m.route) addOne('route', m.route)
        }
      } catch {}
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch {}
      setSaved(true)
      setForm({ patientKey: '', primaryComplaint: '', primaryComplaintHistory: '', familyHistory: '', allergyHistory: '', treatmentHistory: '', history: '', examFindings: '', diagnosis: '', advice: '', labTestsText: '', labNotes: '', therapyTestsText: '', therapyNotes: '', vitalsDisplay: {}, vitalsNormalized: {}, diagDisplay: { testsText: '', notes: '' }, meds: [{ name: '', morning: '', noon: '', evening: '', night: '', qty: '', route: '', instruction: '', durationText: '', freqText: '' }] })
      setLabTestsInput('')
      try { vitalsRef.current?.setDisplay?.({}) } catch {}
      try { diagRef.current?.setDisplay?.({ testsText: '', notes: '' }) } catch {}
      setTimeout(()=>setSaved(false), 2000)
    } catch (err: any) {
      alert(err?.message || 'Failed to save prescription')
    }
  }

  // Print helpers: build a PDF and open a preview window/tab
  async function openPrint(){
    const sel = myPatients.find(t => `${t.id}` === form.patientKey)
    if (!sel) { alert('Select a patient first'); return }
    // Load settings fresh for header
    let s: any = settings
    try { s = await hospitalApi.getSettings() as any } catch {}
    const settingsNorm = { name: s?.name || 'Hospital', address: s?.address || '', phone: s?.phone || '', logoDataUrl: s?.logoDataUrl || '' }
    // Enrich patient details from Lab if available
    let patient: any = { name: sel.patientName || '-', mrn: sel.mrNo || '-' }
    try {
      if (sel?.mrNo) {
        const resp: any = await labApi.getPatientByMrn(sel.mrNo)
        const p = resp?.patient
        if (p) {
          let ageTxt = ''
          try {
            if (p.age != null) ageTxt = String(p.age)
            else if (p.dob) { const dob = new Date(p.dob); if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now()-dob.getTime())/31557600000))) }
          } catch {}
          patient = { name: p.fullName || sel.patientName || '-', mrn: p.mrn || sel.mrNo || '-', gender: p.gender || '-', fatherName: p.fatherName || '-', phone: p.phoneNormalized || '-', address: p.address || '-', age: ageTxt }
        }
      }
    } catch {}
    const items = form.meds
      .filter(m=>m.name?.trim())
      .map(m=>({
        name: m.name,
        frequency: (m.freqText && m.freqText.trim()) ? m.freqText.trim() : ['morning','noon','evening','night'].map(k=>(m as any)[k]).filter(Boolean).join('/ '),
        duration: (m.durationText && m.durationText.trim()) ? m.durationText.trim() : (m.days?`${m.days} ${m.durationUnit || 'day(s)'}`:undefined),
        dose: m.qty ? String(m.qty) : undefined,
        instruction: m.instruction || undefined,
        route: m.route || undefined,
      }))
    const doctor = { name: doctorInfo?.name || doc?.name || '-', qualification: doctorInfo?.qualification || '', departmentName: doctorInfo?.departmentName || '', phone: doctorInfo?.phone || '' }
    // Capture latest diagnostic display if available
    try { const dd = diagRef.current?.getDisplay?.(); if (dd) setForm(f=>({ ...f, diagDisplay: dd })) } catch {}
    // Capture latest vitals display/normalized if available
    try { const d = vitalsRef.current?.getDisplay?.(); if (d) setForm(f=>({ ...f, vitalsDisplay: d })) } catch {}
    let vRaw = undefined as any
    try { vRaw = vitalsRef.current?.getNormalized?.() } catch {}
    const hasVitals = vRaw && Object.values(vRaw).some((x: any) => x != null && !(typeof x === 'number' && isNaN(x)))
    let vitals: any = undefined
    if (hasVitals) vitals = vRaw
    else if (Object.keys((form as any).vitalsNormalized||{}).length) vitals = (form as any).vitalsNormalized
    else if ((form as any).vitalsDisplay && Object.values((form as any).vitalsDisplay).some(Boolean)) {
      const d: any = (form as any).vitalsDisplay
      const n = (x?: any) => { const v = parseFloat(String(x||'').trim()); return isFinite(v)? v : undefined }
      vitals = {
        pulse: n(d.pulse),
        temperatureC: n(d.temperature),
        bloodPressureSys: n(d.bloodPressureSys),
        bloodPressureDia: n(d.bloodPressureDia),
        respiratoryRate: n(d.respiratoryRate),
        bloodSugar: n(d.bloodSugar),
        weightKg: n(d.weightKg),
        heightCm: n(d.height),
        spo2: n(d.spo2),
      }
    }
    // Build diagnostics data either from live ref or persisted display
    let dPrint: any = {}
    try { dPrint = diagRef.current?.getData?.() || {} } catch {}
    if ((!dPrint?.tests || !dPrint.tests.length) && !(dPrint?.notes)){
      const dd = (form as any).diagDisplay || {}
      const tests = String(dd.testsText||'').split(/\n|,/).map((s:string)=>s.trim()).filter(Boolean)
      dPrint = { tests, notes: String(dd.notes||'').trim() || undefined }
    }
    let tpl: PrescriptionPdfTemplate = 'default'
    try { const raw = localStorage.getItem(`doctor.rx.template.${doc?.id || 'anon'}`) as PrescriptionPdfTemplate | null; if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw } catch {}
    await previewPrescriptionPdf({ doctor, settings: settingsNorm, patient, items, primaryComplaint: form.primaryComplaint, primaryComplaintHistory: form.primaryComplaintHistory, familyHistory: form.familyHistory, allergyHistory: form.allergyHistory, treatmentHistory: form.treatmentHistory, history: form.history, examFindings: form.examFindings, diagnosis: form.diagnosis, advice: form.advice, vitals, labTests: form.labTestsText.split(/\n|,/).map(s=>s.trim()).filter(Boolean), labNotes: form.labNotes, therapyTests: String((form as any).therapyTestsText||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean), therapyNotes: (form as any).therapyNotes || '', diagnosticTests: Array.isArray(dPrint.tests)?dPrint.tests:[], diagnosticNotes: dPrint.notes||'', createdAt: new Date() }, tpl)
  }

  const goTab = (tab: ActiveTab) => {
    if (activeTab === 'diagnostics') {
      try {
        const dd = diagRef.current?.getDisplay?.()
        if (dd) setForm(f=>({ ...f, diagDisplay: dd }))
      } catch {}
    }
    setActiveTab(tab)
  }

  function resetForms(){
    resetAllTabs({ keepPatientKey: '' })
  }

  async function referToDiagnosticQuick(){
    const sel = myPatients.find(t => `${t.id}` === form.patientKey)
    if (!doc?.id || !sel?.encounterId) { alert('Select a patient first'); return }
    try{
      const d = diagRef.current?.getData?.() || {}
      const tests = Array.isArray(d.tests) && d.tests.length ? d.tests : undefined
      const notes = d.notes && String(d.notes).trim() ? String(d.notes).trim() : undefined
      await hospitalApi.createReferral({ type: 'diagnostic', encounterId: sel.encounterId, doctorId: doc.id, tests, notes })
      alert('Diagnostic referral created')
    } catch(e: any){
      alert(e?.message || 'Failed to create diagnostic referral')
    }
  }

  // Always read patient details from DB for printing/header (same behavior as prescription history)
  useEffect(() => {
    ;(async () => {
      try {
        if (!sel?.mrNo) { setPat(null); return }
        const resp: any = await labApi.getPatientByMrn(sel.mrNo)
        const p = resp?.patient
        if (!p) { setPat(null); return }
        let ageTxt = ''
        try {
          if (p.age != null) ageTxt = String(p.age)
          else if (p.dob) {
            const dob = new Date(p.dob)
            if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now()-dob.getTime())/31557600000)))
          }
        } catch {}
        setPat({ gender: p.gender || '-', fatherName: p.fatherName || '-', phone: p.phoneNormalized || '-', address: p.address || '-', age: ageTxt })
      } catch {
        setPat(null)
      }
    })()
  }, [sel?.mrNo])

  // Suggestions: store per-doctor in localStorage
  const keyFor = (name: string) => `doctor.suggest.${doc?.id || 'anon'}.${name}`
  const loadList = (name: string): string[] => {
    try {
      const raw = localStorage.getItem(keyFor(name))
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) return Array.from(new Set(arr.map((s: any)=>String(s||'').trim()).filter(Boolean)))
      return []
    } catch { return [] }
  }
  const saveList = (name: string, values: string[]) => {
    const uniq = Array.from(new Set(values.map(v=>String(v||'').trim()).filter(Boolean)))
    try { localStorage.setItem(keyFor(name), JSON.stringify(uniq.slice(0, 200))) } catch {}
  }
  const addOne = (name: string, value?: string) => {
    const v = String(value||'').trim(); if (!v) return
    const arr = loadList(name)
    if (!arr.includes(v)) { saveList(name, [v, ...arr]); setSugVersion(x=>x+1) }
  }
  const addMany = (name: string, values: string[]) => {
    const arr = loadList(name)
    const next = [...values.map(s=>String(s||'').trim()).filter(Boolean), ...arr]
    saveList(name, Array.from(new Set(next)))
    setSugVersion(x=>x+1)
  }

  const sugPrimary = useMemo(()=>loadList('primaryComplaint'), [doc?.id, sugVersion])
  const sugHistory = useMemo(()=>loadList('history'), [doc?.id, sugVersion])
  const sugPrimHist = useMemo(()=>loadList('primaryComplaintHistory'), [doc?.id, sugVersion])
  const sugFamily = useMemo(()=>loadList('familyHistory'), [doc?.id, sugVersion])
  const sugRx = useMemo(()=>loadList('rx'), [doc?.id, sugVersion])
  const sugExam = useMemo(()=>loadList('exam'), [doc?.id, sugVersion])
  const sugDiagnosis = useMemo(()=>loadList('diagnosis'), [doc?.id, sugVersion])
  const sugAdvice = useMemo(()=>loadList('advice'), [doc?.id, sugVersion])
  const sugInstr = useMemo(()=>loadList('instruction'), [doc?.id, sugVersion])
  const sugDuration = useMemo(()=>loadList('durationTag'), [doc?.id, sugVersion])
  const sugDose = useMemo(()=>loadList('dose'), [doc?.id, sugVersion])
  const sugFreq = useMemo(()=>loadList('frequencyTag'), [doc?.id, sugVersion])
  const sugRoute = useMemo(()=>loadList('route'), [doc?.id, sugVersion])
  const sugLabTests = useMemo(()=>loadList('lab.tests'), [doc?.id, sugVersion])
  const sugLabNotes = useMemo(()=>loadList('lab.notes'), [doc?.id, sugVersion])
  const sugTherapyTests = useMemo(()=>loadList('therapy.tests'), [doc?.id, sugVersion])
  const sugTherapyNotes = useMemo(()=>loadList('therapy.notes'), [doc?.id, sugVersion])
  const sugDiagTests = useMemo(()=>loadList('diagnostics.tests'), [doc?.id, sugVersion])
  const sugDiagNotes = useMemo(()=>loadList('diagnostics.notes'), [doc?.id, sugVersion])

  const parseListText = (text: string) =>
    String(text || '')
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean)

  const toggleLabQuickTest = (name: string) => {
    setForm(f => {
      const current = parseListText(f.labTestsText)
      const set = new Set(current)
      if (set.has(name)) set.delete(name)
      else set.add(name)
      return { ...f, labTestsText: Array.from(set).join('\n') }
    })
  }

  const addLabTestChip = (vRaw: string) => {
    const v = String(vRaw || '').trim()
    if (!v) return
    setForm(f => {
      const current = parseListText(f.labTestsText)
      if (current.includes(v)) return f
      return { ...f, labTestsText: [...current, v].join('\n') }
    })
  }

  const removeLabTestChip = (vRaw: string) => {
    const v = String(vRaw || '').trim()
    if (!v) return
    setForm(f => {
      const current = parseListText(f.labTestsText)
      const next = current.filter(x => x !== v)
      return { ...f, labTestsText: next.join('\n') }
    })
  }

  async function printReferral(){
    try {
      const s: any = await hospitalApi.getSettings()
      const settingsNorm = { name: s?.name || 'Hospital', address: s?.address || '', phone: s?.phone || '', logoDataUrl: s?.logoDataUrl || '' }
      const d = referralFormRef.current?.getPreviewData?.()
      if (!d) { alert('Referral form not ready'); return }
      await previewIpdReferralPdf({ settings: settingsNorm, patient: d.patient, referral: d.referral })
    } catch (e: any) {
      alert(e?.message || 'Failed to open referral preview')
    }
  }

  return (
    <div className="w-full px-2 sm:px-4">
      <div className="no-print">
      <div className="text-xl font-semibold text-slate-800">Prescription</div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
        <span className="text-slate-500">to</span>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
        <button type="button" onClick={()=>{ const t = new Date().toISOString().slice(0,10); setFrom(t); setTo(t) }} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Today</button>
        <button type="button" onClick={()=>{ setFrom(''); setTo('') }} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Reset</button>
      </div>
      <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Patient</label>
            <select
              value={form.patientKey}
              onChange={e=>{
                const nextKey = e.target.value
                if (!nextKey) {
                  resetAllTabs({ keepPatientKey: '' })
                  return
                }
                resetAllTabs({ keepPatientKey: nextKey })
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select patient</option>
              {myPatients.map(p => (
                <option key={p.id} value={p.id}>{p.patientName} • {p.mrNo}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-sm text-slate-700">Hx by (History Taker)</label>
                <input value={hxBy} onChange={e=>setHxBy(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="w-[170px]">
                <label className="mb-1 block text-sm text-slate-700">Date</label>
                <input type="date" value={hxDate} onChange={e=>setHxDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 border-b border-slate-200">
          <nav className="-mb-px flex flex-wrap gap-2">
            {htTabs.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => goTab(t)}
                className={`px-3 py-2 text-sm ${activeTab === t ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t}
              </button>
            ))}
            <button type="button" onClick={()=>goTab('labs')} className={`px-3 py-2 text-sm ${activeTab==='labs'?'border-b-2 border-sky-600 text-slate-900':'text-slate-600 hover:text-slate-900'}`}>Lab Orders</button>
            <button type="button" onClick={()=>goTab('diagnostics')} className={`px-3 py-2 text-sm ${activeTab==='diagnostics'?'border-b-2 border-sky-600 text-slate-900':'text-slate-600 hover:text-slate-900'}`}>Diagnostic Orders</button>
            <button type="button" onClick={()=>goTab('therapy')} className={`px-3 py-2 text-sm ${activeTab==='therapy'?'border-b-2 border-sky-600 text-slate-900':'text-slate-600 hover:text-slate-900'}`}>Therapy Orders</button>
            <button type="button" onClick={()=>goTab('Medicine')} className={`px-3 py-2 text-sm ${activeTab==='Medicine'?'border-b-2 border-sky-600 text-slate-900':'text-slate-600 hover:text-slate-900'}`}>Medicine</button>
            <button type="button" onClick={()=>goTab('Counselling')} className={`px-3 py-2 text-sm ${activeTab==='Counselling'?'border-b-2 border-sky-600 text-slate-900':'text-slate-600 hover:text-slate-900'}`}>Counselling</button>
          </nav>
        </div>
        {activeTab === 'Personal Information' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700">Name</label>
              <input value={personalInfo.name} onChange={e=>setPersonalInfo(p=>({ ...p, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">MR#</label>
              <input value={personalInfo.mrNo} onChange={e=>setPersonalInfo(p=>({ ...p, mrNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Age</label>
              <input value={personalInfo.age} onChange={e=>setPersonalInfo(p=>({ ...p, age: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">PT</label>
              <input value={personalInfo.pt} onChange={e=>setPersonalInfo(p=>({ ...p, pt: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">MAM</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-slate-600">Upto:</div>
                <input value={personalInfo.mamUpto} onChange={e=>setPersonalInfo(p=>({ ...p, mamUpto: e.target.value }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <div className="text-sm text-slate-600">Pn:</div>
                <input value={personalInfo.mamPn} onChange={e=>setPersonalInfo(p=>({ ...p, mamPn: e.target.value }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Visit/Stay</label>
              <input value={personalInfo.visitStay} onChange={e=>setPersonalInfo(p=>({ ...p, visitStay: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Height</label>
              <input value={personalInfo.height} onChange={e=>setPersonalInfo(p=>({ ...p, height: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Weight</label>
              <input value={personalInfo.weight} onChange={e=>setPersonalInfo(p=>({ ...p, weight: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Blood Pressure (BP)</label>
              <input value={personalInfo.bp} onChange={e=>setPersonalInfo(p=>({ ...p, bp: e.target.value }))} placeholder="e.g., 120/80" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Sleep (hrs)</label>
              <input value={personalInfo.sleepHrs} onChange={e=>setPersonalInfo(p=>({ ...p, sleepHrs: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Contact#1</label>
              <input value={personalInfo.contact1} onChange={e=>setPersonalInfo(p=>({ ...p, contact1: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Contact#2</label>
              <input value={personalInfo.contact2} onChange={e=>setPersonalInfo(p=>({ ...p, contact2: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Walk/Exercise</label>
              <input value={personalInfo.walkExercise} onChange={e=>setPersonalInfo(p=>({ ...p, walkExercise: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Education</label>
              <input value={personalInfo.education} onChange={e=>setPersonalInfo(p=>({ ...p, education: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Job Hours</label>
              <input value={personalInfo.jobHours} onChange={e=>setPersonalInfo(p=>({ ...p, jobHours: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Current Address</label>
              <textarea value={personalInfo.currentAddress} onChange={e=>setPersonalInfo(p=>({ ...p, currentAddress: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Permanent Address</label>
              <textarea value={personalInfo.permanentAddress} onChange={e=>setPersonalInfo(p=>({ ...p, permanentAddress: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Nature of Work</label>
              <textarea value={personalInfo.natureOfWork} onChange={e=>setPersonalInfo(p=>({ ...p, natureOfWork: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="sm:col-span-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={checkboxCardLabelCls(personalInfo.relax)}>
                  <input
                    type="checkbox"
                    checked={personalInfo.relax}
                    onChange={e=>setPersonalInfo(p=>({ ...p, relax: e.target.checked, stressful: e.target.checked ? false : p.stressful }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Relax
                </label>
                <label className={checkboxCardLabelCls(personalInfo.stressful)}>
                  <input
                    type="checkbox"
                    checked={personalInfo.stressful}
                    onChange={e=>setPersonalInfo(p=>({ ...p, stressful: e.target.checked, relax: e.target.checked ? false : p.relax }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Stressful
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Marital Status' && (
          <div className="space-y-4">
            <div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className={checkboxCardLabelCls(maritalStatus.status === 'Married')}>
                  <input
                    type="checkbox"
                    checked={maritalStatus.status === 'Married'}
                    onChange={(e)=>setMaritalStatus(s=>( {
                      ...s,
                      status: e.target.checked ? 'Married' : '',
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Married
                </label>
                <label className={checkboxCardLabelCls(maritalStatus.status === 'To Go')}>
                  <input
                    type="checkbox"
                    checked={maritalStatus.status === 'To Go'}
                    onChange={(e)=>setMaritalStatus(s=>( {
                      ...s,
                      status: e.target.checked ? 'To Go' : '',
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  To Go
                </label>
                <label className={checkboxCardLabelCls(maritalStatus.status === 'Single')}>
                  <input
                    type="checkbox"
                    checked={maritalStatus.status === 'Single'}
                    onChange={(e)=>setMaritalStatus(s=>( {
                      ...s,
                      status: e.target.checked ? 'Single' : '',
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Single
                </label>
              </div>
            </div>

            {maritalStatus.status === 'Married' && (
              <div className="space-y-4">
                {maritalStatus.marriages.map((m, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">{ord(idx + 1)} Marriage</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setMaritalStatus(s => {
                              const next = [...s.marriages]
                              next.push({
                                years: '',
                                months: '',
                                divorce: '',
                                separation: '',
                                ageOfWife: '',
                                educationOfWife: '',
                                reas: '',
                                marriageType: { loveMarriage: false, arrangeMarriage: false, like: false },
                                mutualSatisfaction: '' as '' | 'Satisfactory' | 'Non-Satisfactory',
                                mutualCooperation: '' as '' | 'Cooperative' | 'Non Cooperative',
                                childStatus: '' as '' | 'No Plan' | 'Trying',
                                childStatus2: { minors: false, pregnant: false, abortion: false, male: '', female: '' },
                              })
                              return { ...s, marriages: next }
                            })
                          }
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMaritalStatus(s => {
                              const next = [...s.marriages]
                              next.splice(idx, 1)
                              return { ...s, marriages: next.length ? next : s.marriages }
                            })
                          }
                          disabled={maritalStatus.marriages.length === 1}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Years/Months</label>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm text-slate-600">Year:</div>
                          <input
                            value={m.years}
                            onChange={e=>setMaritalStatus(s=>{
                              const next = [...s.marriages]
                              next[idx] = { ...next[idx], years: e.target.value }
                              return { ...s, marriages: next }
                            })}
                            className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                          <div className="text-sm text-slate-600">Month:</div>
                          <input
                            value={m.months}
                            onChange={e=>setMaritalStatus(s=>{
                              const next = [...s.marriages]
                              next[idx] = { ...next[idx], months: e.target.value }
                              return { ...s, marriages: next }
                            })}
                            className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Divorce</label>
                        <input
                          value={m.divorce}
                          onChange={e=>setMaritalStatus(s=>{
                            const next = [...s.marriages]
                            next[idx] = { ...next[idx], divorce: e.target.value }
                            return { ...s, marriages: next }
                          })}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Separation</label>
                        <input
                          value={m.separation}
                          onChange={e=>setMaritalStatus(s=>{
                            const next = [...s.marriages]
                            next[idx] = { ...next[idx], separation: e.target.value }
                            return { ...s, marriages: next }
                          })}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Age of Wife</label>
                        <input
                          value={m.ageOfWife}
                          onChange={e=>setMaritalStatus(s=>{
                            const next = [...s.marriages]
                            next[idx] = { ...next[idx], ageOfWife: e.target.value }
                            return { ...s, marriages: next }
                          })}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Education of Wife</label>
                        <input
                          value={m.educationOfWife}
                          onChange={e=>setMaritalStatus(s=>{
                            const next = [...s.marriages]
                            next[idx] = { ...next[idx], educationOfWife: e.target.value }
                            return { ...s, marriages: next }
                          })}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm text-slate-700">Reas</label>
                        <textarea
                          value={m.reas}
                          onChange={e=>setMaritalStatus(s=>{
                            const next = [...s.marriages]
                            next[idx] = { ...next[idx], reas: e.target.value }
                            return { ...s, marriages: next }
                          })}
                          rows={2}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-1 block text-sm text-slate-700">Marriage Type</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <label className={checkboxCardLabelCls(!!m.marriageType?.loveMarriage)}>
                            <input
                              type="checkbox"
                              checked={!!m.marriageType?.loveMarriage}
                              onChange={(e)=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], marriageType: { ...(next[idx] as any).marriageType, loveMarriage: e.target.checked, arrangeMarriage: e.target.checked ? false : (next[idx] as any).marriageType?.arrangeMarriage } }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Love Marriage
                          </label>
                          <label className={checkboxCardLabelCls(!!m.marriageType?.arrangeMarriage)}>
                            <input
                              type="checkbox"
                              checked={!!m.marriageType?.arrangeMarriage}
                              onChange={(e)=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], marriageType: { ...(next[idx] as any).marriageType, arrangeMarriage: e.target.checked, loveMarriage: e.target.checked ? false : (next[idx] as any).marriageType?.loveMarriage } }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Arrange Marriage
                          </label>
                          <label className={checkboxCardLabelCls(!!m.marriageType?.like)}>
                            <input
                              type="checkbox"
                              checked={!!m.marriageType?.like}
                              onChange={(e)=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], marriageType: { ...(next[idx] as any).marriageType, like: e.target.checked } }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            LIKE
                          </label>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-1 block text-sm text-slate-700">Mutual Relations</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {(['Satisfactory','Non-Satisfactory'] as const).map(opt => (
                            <label key={opt} className={checkboxCardLabelCls(m.mutualSatisfaction === opt)}>
                              <input
                                type="checkbox"
                                checked={m.mutualSatisfaction === opt}
                                onChange={(e)=>setMaritalStatus(s=>{
                                  const next = [...s.marriages]
                                  next[idx] = { ...next[idx], mutualSatisfaction: e.target.checked ? opt : '' }
                                  return { ...s, marriages: next }
                                })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              {opt}
                            </label>
                          ))}
                          {(['Cooperative','Non Cooperative'] as const).map(opt => (
                            <label key={opt} className={checkboxCardLabelCls(m.mutualCooperation === opt)}>
                              <input
                                type="checkbox"
                                checked={m.mutualCooperation === opt}
                                onChange={(e)=>setMaritalStatus(s=>{
                                  const next = [...s.marriages]
                                  next[idx] = { ...next[idx], mutualCooperation: e.target.checked ? opt : '' }
                                  return { ...s, marriages: next }
                                })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-1 block text-sm text-slate-700">Child Status#1</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(['No Plan','Trying'] as const).map(opt => (
                            <label key={opt} className={checkboxCardLabelCls(m.childStatus === opt)}>
                              <input
                                type="checkbox"
                                checked={m.childStatus === opt}
                                onChange={(e)=>setMaritalStatus(s=>{
                                  const next = [...s.marriages]
                                  next[idx] = { ...next[idx], childStatus: e.target.checked ? opt : '' }
                                  return { ...s, marriages: next }
                                })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-1 block text-sm text-slate-700">Child Status#2</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <label className={checkboxCardLabelCls(!!m.childStatus2?.minors)}>
                            <input
                              type="checkbox"
                              checked={!!m.childStatus2?.minors}
                              onChange={(e)=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                const cs2 = { ...(next[idx] as any).childStatus2, minors: e.target.checked }
                                if (!e.target.checked){ cs2.male = ''; cs2.female = '' }
                                next[idx] = { ...next[idx], childStatus2: cs2 }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Minors
                          </label>
                          <label className={checkboxCardLabelCls(!!m.childStatus2?.pregnant)}>
                            <input
                              type="checkbox"
                              checked={!!m.childStatus2?.pregnant}
                              onChange={(e)=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], childStatus2: { ...(next[idx] as any).childStatus2, pregnant: e.target.checked } }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Pregnant
                          </label>
                          <label className={checkboxCardLabelCls(!!m.childStatus2?.abortion)}>
                            <input
                              type="checkbox"
                              checked={!!m.childStatus2?.abortion}
                              onChange={(e)=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], childStatus2: { ...(next[idx] as any).childStatus2, abortion: e.target.checked } }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Abortion
                          </label>
                        </div>

                        {!!m.childStatus2?.minors && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="text-sm text-slate-600">Male</div>
                            <input
                              value={m.childStatus2?.male || ''}
                              onChange={e=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], childStatus2: { ...(next[idx] as any).childStatus2, male: e.target.value } }
                                return { ...s, marriages: next }
                              })}
                              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                            <div className="text-sm text-slate-600">Female</div>
                            <input
                              value={m.childStatus2?.female || ''}
                              onChange={e=>setMaritalStatus(s=>{
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], childStatus2: { ...(next[idx] as any).childStatus2, female: e.target.value } }
                                return { ...s, marriages: next }
                              })}
                              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Medicine' && (
          <div>
            <div className="mb-1 block text-sm text-slate-700">Medicines</div>
            <div className="rounded-xl border border-slate-200">
              <div className="hidden sm:grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Duration</div>
                <div className="col-span-2">Dosage</div>
                <div className="col-span-2">Route</div>
                <div className="col-span-2">Frequency</div>
                <div className="col-span-1">Instruction</div>
              </div>
              <div className="divide-y divide-slate-200">
                {form.meds.map((m, idx) => (
                  <div key={idx} className="px-3 py-2">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-12 sm:col-span-3">
                        <SuggestField
                          as="input"
                          value={m.name || ''}
                          onChange={(v)=>{ setMed(idx, 'name', v); searchMedicines(v) }}
                          suggestions={medNameSuggestions}
                          placeholder="Medicine name"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <SuggestField
                          as="input"
                          value={m.durationText || ''}
                          onChange={(v)=>setMed(idx, 'durationText', v)}
                          onBlurValue={(v)=>addOne('durationTag', v)}
                          suggestions={sugDuration}
                          placeholder="Duration"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <SuggestField
                          as="input"
                          value={m.qty || ''}
                          onChange={(v)=>setMed(idx, 'qty', v)}
                          onBlurValue={(v)=>addOne('dose', v)}
                          suggestions={sugDose}
                          placeholder="Dosage"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <SuggestField
                          as="input"
                          value={m.route || ''}
                          onChange={(v)=>setMed(idx, 'route', v)}
                          onBlurValue={(v)=>addOne('route', v)}
                          suggestions={sugRoute}
                          placeholder="Route"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <SuggestField
                          as="input"
                          value={m.freqText || ''}
                          onChange={(v)=>setMed(idx, 'freqText', v)}
                          onBlurValue={(v)=>addOne('frequencyTag', v)}
                          suggestions={sugFreq}
                          placeholder="Frequency"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-1">
                        <SuggestField
                          as="input"
                          value={m.instruction || ''}
                          onChange={(v)=>setMed(idx, 'instruction', v)}
                          onBlurValue={(v)=>addOne('instruction', v)}
                          suggestions={sugInstr}
                          placeholder="Instruction"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={()=>removeAt(idx)}
                        className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
                        title="Remove"
                        disabled={form.meds.length <= 1}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={()=>addAfter(idx)}
                        className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700"
                      >
                        + Drug
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Coitus' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 block text-sm font-semibold text-slate-800">Intercourse</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['Successful','Faild'] as const).map(opt => (
                  <label key={opt} className={checkboxCardLabelCls(coitus.intercourse === opt)}>
                    <input
                      type="checkbox"
                      checked={coitus.intercourse === opt}
                      onChange={(e)=>setCoitus(s=>({ ...s, intercourse: e.target.checked ? opt : '' }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt === 'Faild' ? 'Failed' : opt}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 block text-sm font-semibold text-slate-800">Partner Living</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['Together','Out of Town'] as const).map(opt => (
                  <label key={opt} className={checkboxCardLabelCls(coitus.partnerLiving === opt)}>
                    <input
                      type="checkbox"
                      checked={coitus.partnerLiving === opt}
                      onChange={(e)=>setCoitus(s=>(
                        {
                          ...s,
                          partnerLiving: e.target.checked ? opt : '',
                          visitHomeMonths: (e.target.checked && opt === 'Out of Town') ? s.visitHomeMonths : '',
                          visitHomeDays: (e.target.checked && opt === 'Out of Town') ? s.visitHomeDays : '',
                        }
                      ))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>

              {coitus.partnerLiving === 'Out of Town' && (
                <div className="mt-3">
                  <div className="mb-1 block text-sm text-slate-700">Visit Home</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm text-slate-600">in(months):</div>
                    <input value={coitus.visitHomeMonths} onChange={e=>setCoitus(s=>({ ...s, visitHomeMonths: e.target.value }))} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    <div className="text-sm text-slate-600">for(days):</div>
                    <input value={coitus.visitHomeDays} onChange={e=>setCoitus(s=>({ ...s, visitHomeDays: e.target.value }))} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 block text-sm font-semibold text-slate-800">Coitus Frequency</div>
              <div className="flex flex-wrap items-center gap-6">
                {(['Weekly','Monthly'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={coitus.frequencyType === opt}
                      onChange={(e)=>setCoitus(s=>({ ...s, frequencyType: e.target.checked ? opt : '' }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Frequency (number)</label>
                  <input value={coitus.frequencyNumber} onChange={e=>setCoitus(s=>({ ...s, frequencyNumber: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <input value={coitus.since} onChange={e=>setCoitus(s=>({ ...s, since: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">Previous Coitus Frequency</label>
              <input value={coitus.previousFrequency} onChange={e=>setCoitus(s=>({ ...s, previousFrequency: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {activeTab === 'Health' && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Health</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className={checkboxCardLabelCls(health.conditions.ihd)}>
                  <input type="checkbox" checked={health.conditions.ihd} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, ihd: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  IHD
                </label>
                <label className={checkboxCardLabelCls(health.conditions.epiL)}>
                  <input type="checkbox" checked={health.conditions.epiL} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, epiL: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Epi.L
                </label>
                <label className={checkboxCardLabelCls(health.conditions.giPu)}>
                  <input type="checkbox" checked={health.conditions.giPu} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, giPu: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  GI/PU
                </label>
                <label className={checkboxCardLabelCls(health.conditions.ky)}>
                  <input type="checkbox" checked={health.conditions.ky} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, ky: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  KY
                </label>
                <label className={checkboxCardLabelCls(health.conditions.liv)}>
                  <input type="checkbox" checked={health.conditions.liv} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, liv: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  LIV
                </label>
                <label className={checkboxCardLabelCls(health.conditions.hrd)}>
                  <input type="checkbox" checked={health.conditions.hrd} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, hrd: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  HrD
                </label>
                <label className={checkboxCardLabelCls(health.conditions.thy)}>
                  <input type="checkbox" checked={health.conditions.thy} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, thy: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Thy
                </label>
                <label className={checkboxCardLabelCls(health.conditions.accident)}>
                  <input type="checkbox" checked={health.conditions.accident} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, accident: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Accident
                </label>
                <label className={checkboxCardLabelCls(health.conditions.surgery)}>
                  <input type="checkbox" checked={health.conditions.surgery} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, surgery: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Surgery
                </label>
                <label className={checkboxCardLabelCls(health.conditions.obesity)}>
                  <input type="checkbox" checked={health.conditions.obesity} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, obesity: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Obesity
                </label>
                <label className={checkboxCardLabelCls(health.conditions.penileTruma)}>
                  <input type="checkbox" checked={health.conditions.penileTruma} onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, penileTruma: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Penile Truma
                </label>
                <label className={checkboxCardLabelCls(health.conditions.otherChecked)}>
                  <input
                    type="checkbox"
                    checked={health.conditions.otherChecked}
                    onChange={e=>setHealth(s=>(
                      {
                        ...s,
                        conditions: {
                          ...s.conditions,
                          otherChecked: e.target.checked,
                          otherText: e.target.checked ? s.conditions.otherText : '',
                        },
                      }
                    ))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Other
                </label>
              </div>

              {health.conditions.otherChecked && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input
                    value={health.conditions.otherText}
                    onChange={e=>setHealth(s=>({ ...s, conditions: { ...s.conditions, otherText: e.target.value } }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Enter other"
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Diabetes</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                {(['me','father','mother'] as const).map(k => (
                  <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={health.diabetes[k] as boolean}
                      onChange={e=>setHealth(s=>({ ...s, diabetes: { ...s.diabetes, [k]: e.target.checked } }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {k === 'me' ? 'Me' : k === 'father' ? 'Father' : 'Mother'}
                  </label>
                ))}
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <input value={health.diabetes.since} onChange={e=>setHealth(s=>({ ...s, diabetes: { ...s.diabetes, since: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Medicine Taking</label>
                  <input value={health.diabetes.medicineTaking} onChange={e=>setHealth(s=>({ ...s, diabetes: { ...s.diabetes, medicineTaking: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Hypertension</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                {(['me','father','mother'] as const).map(k => (
                  <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={health.hypertension[k] as boolean}
                      onChange={e=>setHealth(s=>({ ...s, hypertension: { ...s.hypertension, [k]: e.target.checked } }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {k === 'me' ? 'Me' : k === 'father' ? 'Father' : 'Mother'}
                  </label>
                ))}
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <input value={health.hypertension.since} onChange={e=>setHealth(s=>({ ...s, hypertension: { ...s.hypertension, since: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Medicine Taking</label>
                  <input value={health.hypertension.medicineTaking} onChange={e=>setHealth(s=>({ ...s, hypertension: { ...s.hypertension, medicineTaking: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Drug History</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={health.drugHistory.wine} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, wine: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Wine
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={health.drugHistory.weed} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, weed: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Weed
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={health.drugHistory.tobacco} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, tobacco: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Tobacco
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={health.drugHistory.gutka} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, gutka: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Gutka
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={health.drugHistory.naswar} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, naswar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Naswar
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={health.drugHistory.pan} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, pan: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Pan
                </label>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={health.drugHistory.other} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Quit</label>
                  <input value={health.drugHistory.quit} onChange={e=>setHealth(s=>({ ...s, drugHistory: { ...s.drugHistory, quit: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Smoking</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                {(['Yes','No'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={health.smoking.status === opt}
                      onChange={(e)=>setHealth(s=>(
                        {
                          ...s,
                          smoking: {
                            ...s.smoking,
                            status: e.target.checked ? opt : '',
                            since: (e.target.checked && opt === 'Yes') ? s.smoking.since : '',
                            quantityUnit: (e.target.checked && opt === 'Yes') ? s.smoking.quantityUnit : '',
                            quantityNumber: (e.target.checked && opt === 'Yes') ? s.smoking.quantityNumber : '',
                            quit: (e.target.checked && opt === 'Yes') ? s.smoking.quit : '',
                          },
                        }
                      ))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>

              {health.smoking.status === 'Yes' && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Since</label>
                      <input value={health.smoking.since} onChange={e=>setHealth(s=>({ ...s, smoking: { ...s.smoking, since: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Quit</label>
                      <input value={health.smoking.quit} onChange={e=>setHealth(s=>({ ...s, smoking: { ...s.smoking, quit: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 block text-sm text-slate-700">Quantity of Cigerrete (Daily)</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Packs','Units'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={health.smoking.quantityUnit === opt}
                            onChange={(e)=>setHealth(s=>({ ...s, smoking: { ...s.smoking, quantityUnit: e.target.checked ? opt : '' } }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {opt}
                        </label>
                      ))}
                      <input
                        value={health.smoking.quantityNumber}
                        onChange={e=>setHealth(s=>({ ...s, smoking: { ...s.smoking, quantityNumber: e.target.value } }))}
                        className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="#"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Sexual History' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Erection</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Percentage</label>
                  <input value={sexualHistory.erection.percentage} onChange={e=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, percentage: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input value={sexualHistory.erection.sinceValue} onChange={e=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, sinceValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.erection.sinceUnit === 'Year'} onChange={(e)=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? 'Year' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      Year
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.erection.sinceUnit === 'Month'} onChange={(e)=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? 'Month' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      Month
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <label className={checkboxCardLabelCls(sexualHistory.erection.prePeni)}>
                  <input type="checkbox" checked={sexualHistory.erection.prePeni} onChange={e=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, prePeni: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Pre peni
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.erection.postPeni)}>
                  <input type="checkbox" checked={sexualHistory.erection.postPeni} onChange={e=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, postPeni: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Post peni
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">e/? EJ</div>
                  <div className="flex flex-wrap items-center gap-6">
                    {(['Yes','No'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.erection.ej === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, ej: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">e/? med</div>
                  <div className="flex flex-wrap items-center gap-6">
                    {(['Yes','No'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.erection.med === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, med: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.erection.other} onChange={e=>setSexualHistory(s=>({ ...s, erection: { ...s.erection, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Experiences</div>

              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Pre-Marriage</div>
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.gf} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, gf: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      GF
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.male} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, male: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Male
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.pros} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, pros: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Pros
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.mb} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, mb: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      MB
                    </label>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold text-slate-800">Number of Experiences</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Once','Multiple'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={sexualHistory.experiences.preMarriage.multipleOrOnce === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, multipleOrOnce: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Others</label>
                    <input value={sexualHistory.experiences.preMarriage.other} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, other: e.target.value } } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Post Marriage</div>
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.gf} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, gf: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      GF
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.male} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, male: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Male
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.pros} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, pros: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Pros
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.mb} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, mb: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      MB
                    </label>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold text-slate-800">Number of Experiences</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Once','Multiple'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={sexualHistory.experiences.postMarriage.multipleOrOnce === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, multipleOrOnce: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Others</label>
                    <input value={sexualHistory.experiences.postMarriage.other} onChange={e=>setSexualHistory(s=>({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, other: e.target.value } } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">NPT</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                {(['OK','NIL','RARE'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={sexualHistory.npt.status === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, npt: { ...s.npt, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                    {opt}
                  </label>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Erection(%)</label>
                  <input value={sexualHistory.npt.erectionPercentage} onChange={e=>setSexualHistory(s=>({ ...s, npt: { ...s.npt, erectionPercentage: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input value={sexualHistory.npt.sinceValue} onChange={e=>setSexualHistory(s=>({ ...s, npt: { ...s.npt, sinceValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Year'} onChange={(e)=>setSexualHistory(s=>({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Year' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      Year
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Month'} onChange={(e)=>setSexualHistory(s=>({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Month' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      Month
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.npt.other} onChange={e=>setSexualHistory(s=>({ ...s, npt: { ...s.npt, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Desire</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['Yes','No'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.desire.status === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, desire: { ...s.desire, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.desire.other} onChange={e=>setSexualHistory(s=>({ ...s, desire: { ...s.desire, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Nightfall (NF)</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['Yes','No'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.nightfall.status === opt} onChange={(e)=>setSexualHistory(s=>({ ...s, nightfall: { ...s.nightfall, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.nightfall.other} onChange={e=>setSexualHistory(s=>({ ...s, nightfall: { ...s.nightfall, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">PE</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Pre.Just</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input value={sexualHistory.pe.preJustValue} onChange={e=>setSexualHistory(s=>({ ...s, pe: { ...s.pe, preJustValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                    {(['Sec','JK','Min'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={sexualHistory.pe.preJustUnit === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, pe: { ...s.pe, preJustUnit: e.target.checked ? opt : '' } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input value={sexualHistory.pe.sinceValue} onChange={e=>setSexualHistory(s=>({ ...s, pe: { ...s.pe, sinceValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                    {(['Year','Month'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={sexualHistory.pe.sinceUnit === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, pe: { ...s.pe, sinceUnit: e.target.checked ? opt : '' } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.pe.other} onChange={e=>setSexualHistory(s=>({ ...s, pe: { ...s.pe, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">P.Fluid</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.foreplay)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.foreplay} onChange={e=>setSexualHistory(s=>({ ...s, pFluid: { ...s.pFluid, foreplay: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Foreplay
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.phonixSex)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.phonixSex} onChange={e=>setSexualHistory(s=>({ ...s, pFluid: { ...s.pFluid, phonixSex: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Phonix Sex
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.onThoughts)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.onThoughts} onChange={e=>setSexualHistory(s=>({ ...s, pFluid: { ...s.pFluid, onThoughts: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  On Thoughts
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.pornAddiction)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.pornAddiction} onChange={e=>setSexualHistory(s=>({ ...s, pFluid: { ...s.pFluid, pornAddiction: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Porn Addiction
                </label>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.pFluid.other} onChange={e=>setSexualHistory(s=>({ ...s, pFluid: { ...s.pFluid, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm text-slate-700">Status</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(['No issue','ER↓','Weakness'] as const).map(opt => (
                    <label key={opt} className={checkboxCardLabelCls(sexualHistory.pFluid.status === opt)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pFluid.status === opt}
                        onChange={(e)=>setSexualHistory(s=>({ ...s, pFluid: { ...s.pFluid, status: e.target.checked ? opt : '' } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">UD</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                {(['Yes','No'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={sexualHistory.ud.status === opt}
                      onChange={(e)=>setSexualHistory(s=>({ ...s, ud: { ...s.ud, status: e.target.checked ? opt : '' } }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.ud.other} onChange={e=>setSexualHistory(s=>({ ...s, ud: { ...s.ud, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">P.Size</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(['Bent','Small','Shrink'] as const).map(opt => (
                  <label key={opt} className={checkboxCardLabelCls(sexualHistory.pSize.status === opt)}>
                    <input
                      type="checkbox"
                      checked={sexualHistory.pSize.status === opt}
                      onChange={(e)=>setSexualHistory(s=>(
                        {
                          ...s,
                          pSize: {
                            ...s.pSize,
                            status: e.target.checked ? opt : '',
                            bentSide: (e.target.checked && opt === 'Bent') ? s.pSize.bentSide : '',
                          },
                        }
                      ))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>

              {sexualHistory.pSize.status === 'Bent' && (
                <div className="mt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                  <label className={checkboxCardLabelCls(sexualHistory.pSize.bentSide === 'Left')}>
                    <input
                      type="checkbox"
                      checked={sexualHistory.pSize.bentSide === 'Left'}
                      onChange={(e)=>setSexualHistory(s=>({ ...s, pSize: { ...s.pSize, bentSide: e.target.checked ? 'Left' : '' } } ))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Left
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.pSize.bentSide === 'Right')}>
                    <input
                      type="checkbox"
                      checked={sexualHistory.pSize.bentSide === 'Right'}
                      onChange={(e)=>setSexualHistory(s=>({ ...s, pSize: { ...s.pSize, bentSide: e.target.checked ? 'Right' : '' } } ))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Right
                  </label>
                </div>
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 text-sm text-slate-700">Boeing</div>
                <div className="grid gap-2 grid-cols-2">
                  {(['Yes','No'] as const).map(opt => (
                    <label key={opt} className={checkboxCardLabelCls(sexualHistory.pSize.boeing === opt)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pSize.boeing === opt}
                        onChange={(e)=>setSexualHistory(s=>({ ...s, pSize: { ...s.pSize, boeing: e.target.checked ? opt : '' } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">INF</div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Sexuality</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['OK','Disturbed'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.inf.sexuality.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.inf.sexuality.status === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, sexuality: { ...s.inf.sexuality, status: e.target.checked ? opt : '' } } } ))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Diagnosis</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.azos)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.azos} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, azos: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Azos
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.oligo)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.oligo} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, oligo: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Oligo
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.terato)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.terato} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, terato: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Terato
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.astheno)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.astheno} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, astheno: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Astheno
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Problems</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={checkboxCardLabelCls(sexualHistory.inf.problems.magi)}>
                      <input type="checkbox" checked={sexualHistory.inf.problems.magi} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, problems: { ...s.inf.problems, magi: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      MAGI
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.problems.cystitis)}>
                      <input type="checkbox" checked={sexualHistory.inf.problems.cystitis} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, problems: { ...s.inf.problems, cystitis: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Cystitis
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.problems.balanitis)}>
                      <input type="checkbox" checked={sexualHistory.inf.problems.balanitis} onChange={(e)=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, problems: { ...s.inf.problems, balanitis: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Balanitis
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Others</label>
                  <textarea value={sexualHistory.inf.others} onChange={e=>setSexualHistory(s=>({ ...s, inf: { ...s.inf, others: e.target.value } }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-800">On-Examine (OE)</div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Muscles</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(['OK','Semi','FL'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oeMuscle.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oeMuscle.status === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, oeMuscle: { ...s.oeMuscle, status: e.target.checked ? opt : '' } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Disease</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={checkboxCardLabelCls(sexualHistory.oe.disease.peyronie)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oe.disease.peyronie}
                        onChange={(e)=>setSexualHistory(s=>({ ...s, oe: { ...s.oe, disease: { ...s.oe.disease, peyronie: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Peyronie
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.oe.disease.calcification)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oe.disease.calcification}
                        onChange={(e)=>setSexualHistory(s=>({ ...s, oe: { ...s.oe, disease: { ...s.oe.disease, calcification: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Calcification
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-700">Testes</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Atrophic','Normal'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.testes.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oe.testes.status === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, oe: { ...s.oe, testes: { ...s.oe.testes, status: e.target.checked ? opt : '' } } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Epi.D Cst</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Right','Left'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.epidCst.side === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oe.epidCst.side === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, oe: { ...s.oe, epidCst: { ...s.oe.epidCst, side: e.target.checked ? opt : '' } } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Varicocle</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Right','Left'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.varicocele.side === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oe.varicocele.side === opt}
                          onChange={(e)=>setSexualHistory(s=>({
                            ...s,
                            oe: {
                              ...s.oe,
                              varicocele: {
                                ...s.oe.varicocele,
                                side: e.target.checked ? opt : '',
                              },
                            },
                          }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>

                  {sexualHistory.oe.varicocele.side === 'Right' && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {(['g1','g2','g3','g4'] as const).map(g => (
                        <label key={g} className={checkboxCardLabelCls((sexualHistory.oe.varicocele.rightGrades as any)[g])}>
                          <input
                            type="checkbox"
                            checked={(sexualHistory.oe.varicocele.rightGrades as any)[g]}
                            onChange={(e)=>setSexualHistory(s=>({
                              ...s,
                              oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  rightGrades: { ...s.oe.varicocele.rightGrades, [g]: e.target.checked },
                                },
                              },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  )}

                  {sexualHistory.oe.varicocele.side === 'Left' && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {(['g1','g2','g3','g4'] as const).map(g => (
                        <label key={g} className={checkboxCardLabelCls((sexualHistory.oe.varicocele.leftGrades as any)[g])}>
                          <input
                            type="checkbox"
                            checked={(sexualHistory.oe.varicocele.leftGrades as any)[g]}
                            onChange={(e)=>setSexualHistory(s=>({
                              ...s,
                              oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  leftGrades: { ...s.oe.varicocele.leftGrades, [g]: e.target.checked },
                                },
                              },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-slate-800">US/S</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Yes','No'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.uss.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.uss.status === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, uss: { ...s.uss, status: e.target.checked ? opt : '' } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Other</label>
                    <input value={sexualHistory.uss.other} onChange={e=>setSexualHistory(s=>({ ...s, uss: { ...s.uss, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Previous Medical History' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Previous Medical History</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">Ex-Consultation</label>
                  <textarea value={previousMedicalHistory.exConsultation} onChange={e=>setPreviousMedicalHistory(s=>({ ...s, exConsultation: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">Ex Rx. (Ex-Treatment)</label>
                  <textarea value={previousMedicalHistory.exRx} onChange={e=>setPreviousMedicalHistory(s=>({ ...s, exRx: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Cause</label>
                <textarea value={previousMedicalHistory.cause} onChange={e=>setPreviousMedicalHistory(s=>({ ...s, cause: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Arrival Reference' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Referred by</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                {(['Doctor','Friend'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={arrivalReference.referredBy.status === opt}
                      onChange={(e)=>setArrivalReference(s=>({ ...s, referredBy: { ...s.referredBy, status: e.target.checked ? opt : '' } }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={arrivalReference.referredBy.other} onChange={e=>setArrivalReference(s=>({ ...s, referredBy: { ...s.referredBy, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Ads. (Social Media)</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.youtube} onChange={e=>setArrivalReference(s=>({ ...s, adsSocialMedia: { ...s.adsSocialMedia, youtube: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Youtube
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.google} onChange={e=>setArrivalReference(s=>({ ...s, adsSocialMedia: { ...s.adsSocialMedia, google: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Google
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.facebook} onChange={e=>setArrivalReference(s=>({ ...s, adsSocialMedia: { ...s.adsSocialMedia, facebook: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Facebook
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.instagram} onChange={e=>setArrivalReference(s=>({ ...s, adsSocialMedia: { ...s.adsSocialMedia, instagram: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Instagram
                </label>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={arrivalReference.adsSocialMedia.other} onChange={e=>setArrivalReference(s=>({ ...s, adsSocialMedia: { ...s.adsSocialMedia, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Keywords</div>
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 px-3 py-2">
                  {arrivalReference.keywords.map((k) => (
                    <span key={k} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      <span>{k}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setArrivalReference(s => ({
                            ...s,
                            keywords: s.keywords.filter(x => x !== k),
                          }))
                        }
                        className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300"
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    value={arrivalReference.keywordsInput}
                    onChange={e => setArrivalReference(s => ({ ...s, keywordsInput: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = arrivalReference.keywordsInput.trim()
                        if (!v) return
                        if (arrivalReference.keywords.includes(v)) {
                          setArrivalReference(s => ({ ...s, keywordsInput: '' }))
                          return
                        }
                        setArrivalReference(s => ({ ...s, keywords: [...s.keywords, v], keywordsInput: '' }))
                      }
                    }}
                    className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                    placeholder="Type keyword and press Enter"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Appear(on keyword)</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.drAslamNaveed} onChange={e=>setArrivalReference(s=>({ ...s, appearOnKeyword: { ...s.appearOnKeyword, drAslamNaveed: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Dr. Aslam Naveed
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.drMujahidFarooq} onChange={e=>setArrivalReference(s=>({ ...s, appearOnKeyword: { ...s.appearOnKeyword, drMujahidFarooq: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Dr. Mujahid Farooq
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.mensCareClinic} onChange={e=>setArrivalReference(s=>({ ...s, appearOnKeyword: { ...s.appearOnKeyword, mensCareClinic: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Men's Care Clinic
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.olaDoc} onChange={e=>setArrivalReference(s=>({ ...s, appearOnKeyword: { ...s.appearOnKeyword, olaDoc: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Ola Doc
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.marham} onChange={e=>setArrivalReference(s=>({ ...s, appearOnKeyword: { ...s.appearOnKeyword, marham: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Marham
                </label>
              </div>
            </div>
          </div>
        )}
        {activeTab==='diagnostics' && (
          <div>
            <PrescriptionDiagnosticOrders ref={diagRef} initialTestsText={(form as any).diagDisplay?.testsText} initialNotes={(form as any).diagDisplay?.notes} suggestionsTests={sugDiagTests} suggestionsNotes={sugDiagNotes} />
          </div>
        )}
        {activeTab==='labs' && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Lab Orders</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {labQuickTests.map(t => {
                  const checked = parseListText(form.labTestsText).includes(t)
                  return (
                    <label key={t} className={checkboxCardLabelCls(checked)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={()=>toggleLabQuickTest(t)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {t}
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Lab Tests (comma or one per line)</label>
              <div className="rounded-md border border-slate-300 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {parseListText(form.labTestsText).map((k) => (
                    <span key={k} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {k}
                      <button
                        type="button"
                        onClick={() => removeLabTestChip(k)}
                        className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300"
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    value={labTestsInput}
                    onChange={e => setLabTestsInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = labTestsInput.trim()
                        if (!v) return
                        addLabTestChip(v)
                        addOne('lab.tests', v)
                        setLabTestsInput('')
                      }
                    }}
                    className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                    placeholder="Type test and press Enter"
                    list="lab-tests-suggestions"
                  />
                  <datalist id="lab-tests-suggestions">
                    {sugLabTests.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Lab Notes</label>
              <SuggestField rows={2} value={form.labNotes} onChange={v=>setForm(f=>({ ...f, labNotes: v }))} suggestions={sugLabNotes} />
            </div>
          </div>
        )}
        {activeTab==='therapy' && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Therapy Plan</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Months</label>
                  <SuggestField
                    as="input"
                    value={therapyPlan.months}
                    onChange={v=>setTherapyPlan(s=>({ ...s, months: v }))}
                    suggestions={['1','2','3','4']}
                    placeholder="For how many months..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Days</label>
                  <SuggestField
                    as="input"
                    value={therapyPlan.days}
                    onChange={v=>setTherapyPlan(s=>({ ...s, days: v }))}
                    suggestions={['1','2','3','4']}
                    placeholder="For how many days..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Packages</label>
                  <SuggestField
                    as="input"
                    value={therapyPlan.packages}
                    onChange={v=>setTherapyPlan(s=>({ ...s, packages: v }))}
                    suggestions={['5','10','15','20','25','30','35','40','45','50','55','65','70','75','80','85','90','95']}
                    maxSuggestions={50}
                    placeholder="Packages"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Machines</div>
              <div className="grid gap-2">
                <label className={checkboxCardLabelCls(therapyMachines.chi.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.chi.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      chi: e.target.checked ? { ...s.chi, enabled: true } : { enabled: false, pr: false, bk: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  CHi (R 2.5 Sp6, D 420 UB)
                </label>
                {therapyMachines.chi.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.chi.pr} onChange={e=>setTherapyMachines(s=>({ ...s, chi: { ...s.chi, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      PR
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.chi.bk} onChange={e=>setTherapyMachines(s=>({ ...s, chi: { ...s.chi, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      BK
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.eswt.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.eswt.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      eswt: e.target.checked ? { ...s.eswt, enabled: true } : { enabled: false, v1000: false, v1500: false, v2000: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  ESWT (Repair)
                </label>
                {therapyMachines.eswt.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.eswt.v1000} onChange={e=>setTherapyMachines(s=>({ ...s, eswt: { ...s.eswt, v1000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      1000
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.eswt.v1500} onChange={e=>setTherapyMachines(s=>({ ...s, eswt: { ...s.eswt, v1500: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      1500
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.eswt.v2000} onChange={e=>setTherapyMachines(s=>({ ...s, eswt: { ...s.eswt, v2000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      2000
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.ms.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.ms.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      ms: e.target.checked ? { ...s.ms, enabled: true } : { enabled: false, pr: false, bk: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  M/S (R 2.5 UB P)
                </label>
                {therapyMachines.ms.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.ms.pr} onChange={e=>setTherapyMachines(s=>({ ...s, ms: { ...s.ms, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      PR
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.ms.bk} onChange={e=>setTherapyMachines(s=>({ ...s, ms: { ...s.ms, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      BK
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.mam.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.mam.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      mam: e.target.checked ? { ...s.mam, enabled: true } : { enabled: false, m: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  MAM (CHCN)
                </label>
                {therapyMachines.mam.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.mam.m} onChange={e=>setTherapyMachines(s=>({ ...s, mam: { ...s.mam, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      M
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.us.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.us.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      us: e.target.checked ? { ...s.us, enabled: true } : { enabled: false, pr: false, bk: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  U/S (R 2.5 UB P)
                </label>
                {therapyMachines.us.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.us.pr} onChange={e=>setTherapyMachines(s=>({ ...s, us: { ...s.us, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      PR
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.us.bk} onChange={e=>setTherapyMachines(s=>({ ...s, us: { ...s.us, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      BK
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.mcgSpg.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.mcgSpg.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      mcgSpg: e.target.checked ? { ...s.mcgSpg, enabled: true } : { enabled: false, dashBar: false, equal: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  MCG SPG
                </label>
                {therapyMachines.mcgSpg.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.mcgSpg.dashBar} onChange={e=>setTherapyMachines(s=>({ ...s, mcgSpg: { ...s.mcgSpg, dashBar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      --|
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.mcgSpg.equal} onChange={e=>setTherapyMachines(s=>({ ...s, mcgSpg: { ...s.mcgSpg, equal: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      =
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.mproCryo.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.mproCryo.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      mproCryo: e.target.checked ? { ...s.mproCryo, enabled: true } : { enabled: false, m: false, c: false },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Mpro Cryo
                </label>
                {therapyMachines.mproCryo.enabled && (
                  <div className="ml-7 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.mproCryo.m} onChange={e=>setTherapyMachines(s=>({ ...s, mproCryo: { ...s.mproCryo, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      M
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={therapyMachines.mproCryo.c} onChange={e=>setTherapyMachines(s=>({ ...s, mproCryo: { ...s.mproCryo, c: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                      C
                    </label>
                  </div>
                )}

                <label className={checkboxCardLabelCls(therapyMachines.ximen.enabled)}>
                  <input
                    type="checkbox"
                    checked={therapyMachines.ximen.enabled}
                    onChange={e=>setTherapyMachines(s=>({
                      ...s,
                      ximen: e.target.checked ? { ...s.ximen, enabled: true } : { enabled: false, note: '' },
                    }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  XIMEN
                </label>
                {therapyMachines.ximen.enabled && (
                  <div className="ml-7">
                    <input
                      value={therapyMachines.ximen.note}
                      onChange={e=>setTherapyMachines(s=>({ ...s, ximen: { ...s.ximen, note: e.target.value } }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Enter"
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Therapy Notes</label>
              <SuggestField rows={2} value={(form as any).therapyNotes} onChange={v=>setForm(f=>({ ...(f as any), therapyNotes: v }))} suggestions={sugTherapyNotes} />
            </div>
          </div>
        )}

        {activeTab==='Counselling' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 block text-sm text-slate-700">LCC</div>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-4">
                  <label className={`${checkboxCardLabelCls(!!counselling.lcc)} w-full justify-start`}>
                    <input
                      type="checkbox"
                      checked={!!counselling.lcc}
                      onChange={(e)=>setCounselling(s=>({
                        ...s,
                        lcc: e.target.checked ? 'Yes' : '',
                        lccMonth: e.target.checked ? s.lccMonth : '',
                      }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    LCC
                  </label>
                </div>
                <div className="col-span-12 sm:col-span-8">
                  <input
                    value={counselling.lccMonth}
                    onChange={e=>setCounselling(s=>({ ...s, lccMonth: e.target.value }))}
                    placeholder="Month"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 block text-sm text-slate-700">Package</div>
              <div className="space-y-3">
                <div className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-12 sm:col-span-4">
                    <label className={checkboxCardLabelCls(!!counselling.package.d4)}>
                      <input
                        type="checkbox"
                        checked={!!counselling.package.d4}
                        onChange={e=>setCounselling(s=>({
                          ...s,
                          package: { ...s.package, d4: e.target.checked, d4Month: e.target.checked ? s.package.d4Month : '' },
                        }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      D4
                    </label>
                  </div>
                  <div className="col-span-12 sm:col-span-8">
                    <input
                      value={counselling.package.d4Month}
                      onChange={e=>setCounselling(s=>({ ...s, package: { ...s.package, d4Month: e.target.value } }))}
                      placeholder="Month"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-12 sm:col-span-4">
                    <label className={checkboxCardLabelCls(!!counselling.package.r4)}>
                      <input
                        type="checkbox"
                        checked={!!counselling.package.r4}
                        onChange={e=>setCounselling(s=>({
                          ...s,
                          package: { ...s.package, r4: e.target.checked, r4Month: e.target.checked ? s.package.r4Month : '' },
                        }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      R4
                    </label>
                  </div>
                  <div className="col-span-12 sm:col-span-8">
                    <input
                      value={counselling.package.r4Month}
                      onChange={e=>setCounselling(s=>({ ...s, package: { ...s.package, r4Month: e.target.value } }))}
                      placeholder="Month"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Note</label>
              <textarea
                rows={4}
                value={counselling.note}
                onChange={e=>setCounselling(s=>({ ...s, note: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={saveHistoryTaking}
            className="rounded-md bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700 disabled:opacity-60"
            disabled={historySaving}
          >
            {historySaving ? 'Saving History...' : 'Save History Taking'}
          </button>
          <button type="button" onClick={openPrint} className="btn-outline-navy">Print</button>
          <button type="button" onClick={resetForms} className="btn-outline-navy">Reset Forms</button>
          <button type="button" disabled={!sel} onClick={()=>setOpenReferral(true)} className="btn-outline-navy disabled:opacity-50">Refer to IPD</button>
          <button type="button" disabled={!sel} onClick={referToDiagnosticQuick} className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50">Refer to Diagnostic</button>
          <button type="submit" className="btn">Save</button>
        </div>
        {saved && <div className="text-sm text-emerald-600">Saved</div>}
      </form>
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-3 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {toast.message}
        </div>
      )}

      {openReferral && (
        <div id="referral-print" className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-2 sm:px-4">
          <style>{`@media print { body * { visibility: hidden !important; } #referral-print, #referral-print * { visibility: visible !important; } #referral-print { position: static !important; inset: auto !important; background: transparent !important; } }`}</style>
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-base font-semibold text-slate-900">Refer to IPD</div>
              <div className="flex items-center gap-2">
                <button onClick={printReferral} className="btn-outline-navy">Print</button>
                <button onClick={()=>setOpenReferral(false)} className="btn">Close</button>
              </div>
            </div>
            <div className="max-h-[85vh] overflow-y-auto p-3 sm:p-4">
              <Doctor_IpdReferralForm ref={referralFormRef} mrn={sel?.mrNo} doctor={{ id: doc?.id, name: doc?.name }} onSaved={()=>setOpenReferral(false)} />
            </div>
          </div>
        </div>
      )}

      <PrescriptionPrint
        printId="prescription-print"
        doctor={{ name: doc?.name, specialization: doctorInfo?.specialization, qualification: doctorInfo?.qualification, departmentName: doctorInfo?.departmentName, phone: doctorInfo?.phone }}
        settings={settings}
        patient={{ name: sel?.patientName || '-', mrn: sel?.mrNo || '-', gender: pat?.gender, fatherName: pat?.fatherName, age: pat?.age, phone: pat?.phone, address: pat?.address }}
        items={form.meds
          .filter(m=>m.name?.trim())
          .map(m=>({
            name: m.name,
            frequency: ['morning','noon','evening','night'].map(k=>(m as any)[k]).filter(Boolean).join('/ '),
            duration: m.days?`${m.days} ${m.durationUnit || 'day(s)'}`:undefined,
            dose: m.qty ? String(m.qty) : undefined,
            instruction: m.instruction || undefined,
            route: m.route || undefined,
          }))}
        labTests={form.labTestsText.split(/\n|,/).map(s=>s.trim()).filter(Boolean)}
        labNotes={form.labNotes}
        therapyTests={String((form as any).therapyTestsText||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean)}
        therapyNotes={(form as any).therapyNotes}
        diagnosticTests={(diagRef.current?.getData?.()?.tests)||[]}
        diagnosticNotes={(diagRef.current?.getData?.()?.notes)||''}
        primaryComplaint={form.primaryComplaint}
        primaryComplaintHistory={form.primaryComplaintHistory}
        familyHistory={form.familyHistory}
        allergyHistory={form.allergyHistory}
        treatmentHistory={form.treatmentHistory}
        history={form.history}
        examFindings={form.examFindings}
        diagnosis={form.diagnosis}
        advice={form.advice}
        createdAt={new Date()}
      />
    </div>
  )
}