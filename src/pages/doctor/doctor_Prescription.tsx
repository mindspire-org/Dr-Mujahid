import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X, Eye, BookmarkPlus } from 'lucide-react'
import { hospitalApi, labApi, pharmacyApi } from '../../utils/api'
import { previewPrescriptionPdf } from '../../utils/prescriptionPdf'
import type { PrescriptionPdfTemplate } from '../../utils/prescriptionPdf'
import { mergeHistoryWithEdits, collectAllHistoryEdits, type HistorySection } from '../../utils/historyEdits'
import Doctor_IpdReferralForm from '../../components/doctor/Doctor_IpdReferralForm'
import { previewIpdReferralPdf } from '../../utils/ipdReferralPdf'
import PrescriptionPrint from '../../components/doctor/PrescriptionPrint'
import SuggestField from '../../components/SuggestField'
import PrescriptionDiagnosticOrders from '../../components/doctor/PrescriptionDiagnosticOrders'
import { useLocation } from 'react-router-dom'
import { AddTemplateDialog, ViewTemplatesDialog, type LabTemplate } from '../../components/doctor/LabTemplateDialogs'

type DoctorSession = { id: string; name: string; username: string }

type Token = {
  id: string
  tokenNo: string
  createdAt: string
  patientName: string
  mrNo: string
  patientId?: string
  encounterId: string
  doctorId?: string
  doctorName?: string
  status?: 'queued' | 'in-progress' | 'completed' | 'returned' | 'cancelled'
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
  durationUnit?: 'day(s)' | 'week(s)' | 'month(s)'
  durationText?: string
  freqText?: string
}

type LabTestRow = {
  testName: string
  normalValue: string
  result: string
  status: string
}

type PreviousVisit = {
  id: string
  createdAt: string
  encounterId: string
  medicine: Array<{ name?: string; dose?: string; frequency?: string; duration?: string; notes?: string }>
  diagnosticTests?: string[]
  diagnosticNotes?: string
  therapyTests?: string[]
  therapyNotes?: string
}

type PrevHistoryTaking = {
  _id: string
  submittedAt?: string
  createdAt?: string
  hxBy?: string
  hxDate?: string
  data?: any
}

type PrevLabReportsEntry = {
  _id: string
  submittedAt?: string
  createdAt?: string
  hxBy?: string
  hxDate?: string
  labInformation?: any
  semenAnalysis?: any
  tests?: any[]
}

type SemenAnalysis = {
  date: string
  vol: string
  ph: string
  abs: string
  tsc: string
  cml: string
  mPct: string
  rL: string
  sl: string
  slg: string
  imt: string
  mor: string
  pus: string
  fr: string
  vt: string
}

const EMPTY_SEMEN_ANALYSIS: SemenAnalysis = {
  date: '',
  vol: '',
  ph: '',
  abs: '',
  tsc: '',
  cml: '',
  mPct: '',
  rL: '',
  sl: '',
  slg: '',
  imt: '',
  mor: '',
  pus: '',
  fr: '',
  vt: '',
}

const SEMEN_FIELDS: Array<{ key: keyof SemenAnalysis; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'vol', label: 'Vol' },
  { key: 'ph', label: 'Ph' },
  { key: 'abs', label: 'Abs' },
  { key: 'tsc', label: 'Tsc' },
  { key: 'cml', label: 'C/ml' },
  { key: 'mPct', label: 'M%' },
  { key: 'rL', label: 'R-L' },
  { key: 'sl', label: 'SL' },
  { key: 'slg', label: 'SLG' },
  { key: 'imt', label: 'IMT' },
  { key: 'mor', label: 'Mor' },
  { key: 'pus', label: 'Pus' },
  { key: 'fr', label: 'Fr' },
  { key: 'vt', label: 'Vt' },
]

type LabInformation = {
  labName: string
  mrNo: string
  date: string
}

const EMPTY_LAB_INFORMATION: LabInformation = {
  labName: '',
  mrNo: '',
  date: '',
}

const NORMAL_RANGES: Record<string, string> = {
  t: '265-1k',
  p: '1.3-14',
  fa: '4-30',
  zn: '50-150',
  d3: '>30',
  b12: '>150',
  cortisol: '3.7-19',
  lh: '2-12',
  fsh: '1-18',
  tsh: '0.4-4',
  t3: '0.8-2',
  t4: '5-14',
  estra: '7-42',
  u: '15-45',
  cr: '0.6-1.3',
}

function normalizeTestNameKey(raw: string): string {
  const v = (raw || '').trim()
  if (!v) return ''

  const beforeParen = v.split('(')[0].trim()
  const lower = beforeParen.toLowerCase()

  if (lower === 't') return 't'
  if (lower === 'fa') return 'fa'
  if (lower === 'd3') return 'd3'
  if (lower === 'lh') return 'lh'
  if (lower === 'fsh') return 'fsh'
  if (lower === 'tsh') return 'tsh'
  if (lower === 't3') return 't3'
  if (lower === 't4') return 't4'
  if (lower === 'u') return 'u'
  if (lower === 'cr') return 'cr'
  if (lower === 'p') return 'p'
  if (lower === 'zn') return 'zn'
  if (lower === 'b12') return 'b12'

  if (lower.includes('cortisol')) return 'cortisol'
  if (lower.includes('estra')) return 'estra'

  return lower
}

const TEST_SUGGESTIONS = [
  'T(Testosterone)',
  'FA (Folic Acid)',
  'D3 (Vitamin D3)',
  'Cortisol',
  'LH',
  'Ch (Cholesterol)',
  'HDL',
  'VL (VLDL)',
  'Estra (Estradiol)',
  'GGT',
  'ALT',
  'ALP',
  'SHBG',
  'Insulin',
  'VDRL',
  'P (Phosphorus)',
  'Zn (Zinc)',
  'B12',
  'HbA1c',
  'FSH',
  'TSH',
  'T3',
  'T4',
  'U. D/R (Urine Detailed Report)',
  'U (Urea)',
  'Cr (Creatinine)',
  'Semen C/S',
  'HIV-Ab',
  'Anti-HCV-Ab',
  'HBsAg',
  'HTPA',
  'TPHA',
]

const STATUS_SUGGESTIONS = [
  'Normal',
  'Abnormal',
  'Low',
  'High',
  'Critical',
]

//

function stableStringify(value: any): string {
  const seen = new WeakSet<object>()
  const norm = (v: any): any => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return null
      seen.add(v)
      if (Array.isArray(v)) return v.map(norm)
      const out: any = {}
      for (const k of Object.keys(v).sort()) out[k] = norm(v[k])
      return out
    }
    return v
  }
  try { return JSON.stringify(norm(value)) } catch { return '' }
}

export default function Doctor_Prescription() {
  const location = useLocation()
  const today = new Date().toISOString().slice(0, 10)
  const [doc, setDoc] = useState<DoctorSession | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [forcedToken, setForcedToken] = useState<Token | null>(null)
  const [presEncounterIds, setPresEncounterIds] = useState<string[]>([])
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [prefillTokenId, setPrefillTokenId] = useState<string>('')
  const [prefillEncounterId, setPrefillEncounterId] = useState<string>('')

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('hospital.session') || localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        return String(u?.username || u?.fullName || u?.name || '').trim()
      }
    } catch { }
    return ''
  }, [])

  const [hxBy, setHxBy] = useState<string>(currentUser)
  const [hxDate, setHxDate] = useState<string>(today)
  const [historyTakingId, setHistoryTakingId] = useState<string>('')
  const [labReportsEntryId, setLabReportsEntryId] = useState<string>('')
  const historyTakingBaselineRef = useRef<string>('')
  const labReportsBaselineRef = useRef<string>('')
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }
  const [previousVisitOpen, setPreviousVisitOpen] = useState(false)
  const [previousVisitLoading, setPreviousVisitLoading] = useState(false)
  const [previousVisitError, setPreviousVisitError] = useState<string>('')
  const [previousVisits, setPreviousVisits] = useState<PreviousVisit[]>([])
  const [labReportsHxBy, setLabReportsHxBy] = useState<string>('')
  const [labReportsHxDate, setLabReportsHxDate] = useState<string>(today)
  const [labReportsTests, setLabReportsTests] = useState<LabTestRow[]>([
    { testName: '', normalValue: '', result: '', status: '' },
  ])
  const [labReportsLabInformation, setLabReportsLabInformation] = useState<LabInformation>(EMPTY_LAB_INFORMATION)
  const [labReportsSemenAnalysis, setLabReportsSemenAnalysis] = useState<SemenAnalysis>(EMPTY_SEMEN_ANALYSIS)
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
    status: '' as '' | 'Married' | 'To Go',
    timePeriod: '',
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
    timePeriod: '',
    marriages: [emptyMarriage],
  })
  const [coitus, setCoitus] = useState({
    intercourse: '' as '' | 'Successful' | 'Faild',
    partnerLiving: '' as '' | 'Together' | 'Out of Town',
    visitHomeMonths: '',
    visitHomeDays: '',
    frequencyType: '' as '' | 'Daily' | 'Weekly' | 'Monthly',
    frequencyNumber: '',
    since: '',
    previousFrequency: '',
  })
  const [health, setHealth] = useState({
    selectedConditions: [] as string[],
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
      sinceUnit: '' as '' | 'Year' | 'Month' | 'Week' | 'Day',
      prePeni: false,
      postPeni: false,
      ej: '' as '' | 'Yes' | 'No',
      med: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pe: {
      pre: false,
      preValue: '',
      preUnit: '' as '' | 'Sec' | 'JK' | 'Min',
      just: false,
      justValue: '',
      justUnit: '' as '' | 'Sec' | 'JK' | 'Min',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month' | 'Week' | 'Day',
      other: '',
    },
    pFluid: {
      foreplay: false,
      phonixSex: false,
      onThoughts: false,
      pornAddiction: false,
      other: '',
      status: {
        noIssue: false,
        erDown: false,
        weakness: false,
      },
    },
    ud: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pSize: {
      bent: false,
      bentLeft: false,
      bentRight: false,
      small: false,
      smallHead: false,
      smallBody: false,
      smallTip: false,
      smallMid: false,
      smallBase: false,
      shrink: false,
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
      ok: false,
      semi: false,
      fl: false,
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
        right: false,
        left: false,
      },
      varicocele: {
        right: false,
        left: false,
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
      sinceUnit: '' as '' | 'Year' | 'Month' | 'Week' | 'Day',
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
        multipleP: false,
        multipleOrOnce: '' as '' | 'Once' | 'Multiple',
        other: '',
      },
      postMarriage: {
        gf: false,
        male: false,
        pros: false,
        mb: false,
        multipleP: false,
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

  const therapyMachineLabel = (key: string) => {
    if (key === 'chi') return 'CHi (R 2.5 Sp6, D 420 UB)'
    if (key === 'eswt') return 'ESWT (Repair)'
    if (key === 'ms') return 'M/S (R 2.5 UB P)'
    if (key === 'mam') return 'MAM (CHCN)'
    if (key === 'us') return 'U/S (R 2.5 UB P)'
    if (key === 'mcgSpg') return 'MCG SPG'
    if (key === 'mproCryo') return 'Mpro Cryo'
    if (key === 'ximen') return 'XIMEN'
    return key
  }

  const [therapyPlan, setTherapyPlan] = useState(getEmptyTherapyPlan())
  const [therapyMachines, setTherapyMachines] = useState(getEmptyTherapyMachines())
  const [hiddenTherapyMachines, setHiddenTherapyMachines] = useState<string[]>([])
  const [customTherapyMachines, setCustomTherapyMachines] = useState<
    Array<
      | { id: string; name: string; kind: 'checkboxes'; options: string[] }
      | { id: string; name: string; kind: 'fields'; fields: string[] }
    >
  >([])
  const [customTherapyMachineState, setCustomTherapyMachineState] = useState<
    Record<string, { enabled: boolean; checks?: Record<string, boolean>; fields?: Record<string, string> }>
  >({})
  const [therapyMachineRemoveDialog, setTherapyMachineRemoveDialog] = useState<null | { kind: 'fixed' | 'custom'; key: string; label: string }>(null)
  const [isTherapyMachineRestoreDialogOpen, setIsTherapyMachineRestoreDialogOpen] = useState(false)
  const [therapyMachineAddName, setTherapyMachineAddName] = useState('')
  const [therapyMachineAddKind, setTherapyMachineAddKind] = useState<'checkboxes' | 'fields'>('checkboxes')
  const [therapyMachineAddOptions, setTherapyMachineAddOptions] = useState<string[]>([''])
  const [therapyMachineAddFields, setTherapyMachineAddFields] = useState<string[]>([''])

  // Text color picker for history taking
  const [selectedColor, _setSelectedColor] = useState<'black' | 'blue' | 'red' | 'green'>('black')
  const colorClasses = {
    black: 'text-black',
    blue: 'text-blue-600',
    red: 'text-red-600',
    green: 'text-green-600',
  }

  // Health conditions management (like hospital portal)
  const defaultHealthConditions = [
    'IHD',
    'Epi.L',
    'GI/PU',
    'KY',
    'LIV',
    'HrD',
    'Thy',
    'Accident',
    'Surgery',
    'Obesity',
    'Penile Truma',
  ] as const

  const [hiddenHealthConditions, setHiddenHealthConditions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('doctor.historyTaking_hiddenHealthConditions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch { /* ignore */ }
    return []
  })
  const [customHealthConditions, setCustomHealthConditions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('doctor.historyTaking_customHealthConditions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch { /* ignore */ }
    return []
  })

  // Dialog states for Add Condition
  const [isAddConditionDialogOpen, setIsAddConditionDialogOpen] = useState(false)
  const [addConditionInputs, setAddConditionInputs] = useState<string[]>([''])

  // Dialog states for Delete Confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ type: 'default' | 'custom'; value: string } | null>(null)

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
    therapyDiscount: '0',
    counsellingDiscount: '0',
    vitalsDisplay: {},
    vitalsNormalized: {},
    diagDisplay: { testsText: '', notes: '', discount: '0' },
    meds: [{ name: '', morning: '', noon: '', evening: '', night: '', qty: '', route: '', instruction: '', durationText: '', freqText: '' }] as MedicineRow[],
  })
  const [saved] = useState(false)
  const [settings] = useState<{ name: string; address: string; phone: string; logoDataUrl?: string }>({ name: 'Hospital', address: '', phone: '' })
  const [pat, setPat] = useState<{ address?: string; phone?: string; fatherName?: string; gender?: string; age?: string } | null>(null)
  const [doctorInfo, setDoctorInfo] = useState<{ name?: string; specialization?: string; phone?: string; qualification?: string; departmentName?: string } | null>(null)
  const [openReferral, setOpenReferral] = useState(false)
  const referralFormRef = useRef<any>(null)
  const vitalsRef = useRef<any>(null)
  const diagRef = useRef<any>(null)
  const [sugVersion, setSugVersion] = useState(0)
  const [medNameSuggestions, setMedNameSuggestions] = useState<string[]>([])

  // Preload medicines from pharmacy inventory on mount
  useEffect(() => {
    ;(async () => {
      try {
        const res: any = await pharmacyApi.getAllMedicines()
        const list: string[] = Array.isArray(res?.medicines)
          ? res.medicines.map((m: any) => String(m.name || '').trim()).filter(Boolean)
          : Array.isArray(res?.suggestions)
            ? res.suggestions.map((m: any) => String(m.name || '').trim()).filter(Boolean)
            : []
        setMedNameSuggestions(list)
      } catch {
        // Silently fail - will use empty suggestions until user searches
      }
    })()
  }, [])

  const [labTestsInput, setLabTestsInput] = useState<string>('')
  const [isLabOrderDialogOpen, setIsLabOrderDialogOpen] = useState(false)
  const [labOrderDraft, setLabOrderDraft] = useState('')
  const [hiddenLabQuickTests, setHiddenLabQuickTests] = useState<string[]>([])
  const [customLabOrderTests, setCustomLabOrderTests] = useState<string[]>([])
  const [labOrderRemoveDialog, setLabOrderRemoveDialog] = useState<null | { kind: 'quick' | 'custom'; name: string }>(null)

  // Lab Template states
  const [isAddTemplateDialogOpen, setIsAddTemplateDialogOpen] = useState(false)
  const [isViewTemplatesDialogOpen, setIsViewTemplatesDialogOpen] = useState(false)
  const [labTemplates, setLabTemplates] = useState<LabTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  useEffect(() => {
    const key = `doctor.therapyMachines.hidden.${doc?.id || 'anon'}`
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHiddenTherapyMachines(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setHiddenTherapyMachines([])
    } catch {
      setHiddenTherapyMachines([])
    }
  }, [doc?.id])

  useEffect(() => {
    const key = `doctor.therapyMachines.custom.${doc?.id || 'anon'}`
    try {
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : null
      const defs = Array.isArray(data?.defs) ? data.defs : []
      const st = data?.state && typeof data.state === 'object' ? data.state : {}
      setCustomTherapyMachines(defs)
      setCustomTherapyMachineState(st)
    } catch {
      setCustomTherapyMachines([])
      setCustomTherapyMachineState({})
    }
  }, [doc?.id])

  const hiddenTherapyMachinesSet = useMemo(() => new Set(hiddenTherapyMachines.map(s => String(s || '').trim()).filter(Boolean)), [hiddenTherapyMachines])

  const saveHiddenTherapyMachines = (next: string[]) => {
    const uniq = Array.from(new Set(next.map(s => String(s || '').trim()).filter(Boolean)))
    setHiddenTherapyMachines(uniq)
    const key = `doctor.therapyMachines.hidden.${doc?.id || 'anon'}`
    try { localStorage.setItem(key, JSON.stringify(uniq)) } catch { }
  }

  const saveCustomTherapyMachines = (
    defs: Array<
      | { id: string; name: string; kind: 'checkboxes'; options: string[] }
      | { id: string; name: string; kind: 'fields'; fields: string[] }
    >,
    state: Record<string, { enabled: boolean; checks?: Record<string, boolean>; fields?: Record<string, string> }>
  ) => {
    setCustomTherapyMachines(defs)
    setCustomTherapyMachineState(state)
    const key = `doctor.therapyMachines.custom.${doc?.id || 'anon'}`
    try { localStorage.setItem(key, JSON.stringify({ defs, state })) } catch { }
  }

  useEffect(() => {
    const key = `doctor.labOrders.hiddenQuickTests.${doc?.id || 'anon'}`
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHiddenLabQuickTests(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setHiddenLabQuickTests([])
    } catch {
      setHiddenLabQuickTests([])
    }
  }, [doc?.id])

  const hiddenLabQuickTestsSet = useMemo(() => new Set(hiddenLabQuickTests.map(s => String(s || '').trim()).filter(Boolean)), [hiddenLabQuickTests])

  const saveHiddenLabQuickTests = (next: string[]) => {
    const uniq = Array.from(new Set(next.map(s => String(s || '').trim()).filter(Boolean)))
    setHiddenLabQuickTests(uniq)
    const key = `doctor.labOrders.hiddenQuickTests.${doc?.id || 'anon'}`
    try { localStorage.setItem(key, JSON.stringify(uniq)) } catch { }
  }

  useEffect(() => {
    const key = `doctor.labOrders.customTests.${doc?.id || 'anon'}`
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setCustomLabOrderTests(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setCustomLabOrderTests([])
    } catch {
      setCustomLabOrderTests([])
    }
  }, [doc?.id])

  const saveCustomLabOrderTests = (next: string[]) => {
    const uniq = Array.from(new Set(next.map(s => String(s || '').trim()).filter(Boolean)))
    setCustomLabOrderTests(uniq)
    const key = `doctor.labOrders.customTests.${doc?.id || 'anon'}`
    try { localStorage.setItem(key, JSON.stringify(uniq)) } catch { }
  }

  const checkboxCardLabelCls = (checked: boolean) =>
    `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm ${inputColorCls()} hover:border-blue-800`

  // Helper to get text color class for inputs
  const inputColorCls = () => colorClasses[selectedColor]

  const hiddenHealthConditionsSet = useMemo(() => new Set(hiddenHealthConditions.map(s => String(s || '').trim()).filter(Boolean)), [hiddenHealthConditions])

  const addHealthCondition = (vRaw: string, autoSelect: boolean = false) => {
    const v = String(vRaw || '').trim()
    if (!v) return
    if (!(defaultHealthConditions as readonly string[]).includes(v)) {
      setCustomHealthConditions(prev => [...prev, v])
    }
    if (autoSelect && !health.selectedConditions.includes(v)) {
      setHealth(s => ({ ...s, selectedConditions: [...s.selectedConditions, v] }))
    }
  }

  const removeHealthCondition = (vRaw: string) => {
    const v = String(vRaw || '').trim()
    if (!v) return
    setHealth(s => ({ ...s, selectedConditions: s.selectedConditions.filter(x => x !== v) }))
  }

  const toggleHealthCondition = (v: string) => {
    const checked = health.selectedConditions.includes(v)
    if (checked) {
      setHealth(s => ({ ...s, selectedConditions: s.selectedConditions.filter(x => x !== v) }))
    } else {
      setHealth(s => ({ ...s, selectedConditions: [...s.selectedConditions, v] }))
    }
  }

  // Save custom health conditions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('doctor.historyTaking_customHealthConditions', JSON.stringify(customHealthConditions))
    } catch {
      // Ignore localStorage errors
    }
  }, [customHealthConditions])

  // Save hidden health conditions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('doctor.historyTaking_hiddenHealthConditions', JSON.stringify(hiddenHealthConditions))
    } catch {
      // Ignore localStorage errors
    }
  }, [hiddenHealthConditions])

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

  type ActiveTab = (typeof htTabs)[number] | 'labReportsEntry' | 'Medicine' | 'labs' | 'diagnostics' | 'therapy' | 'Counselling'
  const [activeTab, setActiveTab] = useState<ActiveTab>('Personal Information')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('doctor.session')
      const sess = raw ? JSON.parse(raw) : null
      setDoc(sess)
      // Compat: upgrade legacy id to backend id if needed
      const hex24 = /^[a-f\d]{24}$/i
      if (sess && !hex24.test(String(sess.id || ''))) {
        ; (async () => {
          try {
            const res = await hospitalApi.listDoctors() as any
            const docs: any[] = res?.doctors || []
            const match = docs.find(d => String(d.username || '').toLowerCase() === String(sess.username || '').toLowerCase()) ||
              docs.find(d => String(d.name || '').toLowerCase() === String(sess.name || '').toLowerCase())
            if (match) {
              const fixed = { ...sess, id: String(match._id || match.id) }
              try { localStorage.setItem('doctor.session', JSON.stringify(fixed)) } catch { }
              setDoc(fixed)
            }
          } catch { }
        })()
      }
    } catch { }
  }, [])

  // If navigated from queued patients or prescription history edit, prefill date range + selected patient/encounter.
  useEffect(() => {
    try {
      const st: any = (location as any)?.state
      const date = String(st?.date || '')
      const tokenId = String(st?.tokenId || '')
      const encounterId = String(st?.encounterId || '')


      if (date) {
        setFrom(date)
        setTo(date)
      } else {
        setFrom(today)
        setTo(today)
      }

      if (tokenId) setPrefillTokenId(tokenId)
      if (encounterId) setPrefillEncounterId(encounterId)

    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (moved) navigation prefill is handled above

  useEffect(() => { loadTokens(); loadPresIds() }, [doc?.id, from, to])

  useEffect(() => {
    const h = () => { loadTokens(); loadPresIds() }
    window.addEventListener('doctor:pres-saved', h as any)
    return () => window.removeEventListener('doctor:pres-saved', h as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  // Bootstrap suggestions from previous prescriptions
  useEffect(() => {
    ; (async () => {
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
          if (Array.isArray(r.labTests)) labTestsAll.push(...(r.labTests as any[]).map(x => String(x || '')))
          if (r.labNotes) labNotes.push(String(r.labNotes))
          if (Array.isArray(r.diagnosticTests)) diagTestsAll.push(...(r.diagnosticTests as any[]).map((x: any) => String(x || '')))
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
          } catch { }

          // collect medicine suggestions (support new `medicine` and legacy `items`)
          try {
            const meds = Array.isArray((r as any).medicine)
              ? ((r as any).medicine as any[])
              : (Array.isArray((r as any).items) ? ((r as any).items as any[]) : [])
            for (const it of meds) {
              if (it?.dose) doses.push(String(it.dose))
              if (it?.frequency) freqs.push(String(it.frequency))
              if (it?.duration) durs.push(String(it.duration))
              const nt = String(it?.notes || '')
              const mRoute = nt.match(/Route:\s*([^;]+)/i)
              const mInstr = nt.match(/Instruction:\s*([^;]+)/i)
              if (mRoute && mRoute[1]) routes.push(mRoute[1].trim())
              if (mInstr && mInstr[1]) instrs.push(mInstr[1].trim())
            }
          } catch { }
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
      } catch { }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  useEffect(() => {
    ; (async () => {
      try {
        if (!doc?.id) { setDoctorInfo(null); return }
        const [drRes, depRes] = await Promise.all([
          hospitalApi.listDoctors() as any,
          hospitalApi.listDepartments() as any,
        ])
        const doctors: any[] = drRes?.doctors || []
        const depArray: any[] = ((depRes as any)?.departments || (depRes as any) || []) as any[]
        const d = doctors.find(x => String(x._id || x.id) === String(doc.id))
        const deptName = d?.primaryDepartmentId ? (depArray.find((z: any) => String(z._id || z.id) === String(d.primaryDepartmentId))?.name || '') : ''
        if (d) setDoctorInfo({ name: d.name || '', specialization: d.specialization || '', phone: d.phone || '', qualification: d.qualification || '', departmentName: deptName })
      } catch { }
    })()
  }, [doc?.id])

  async function loadTokens() {
    try {
      if (!doc?.id) { setTokens([]); return }
      const params: any = { doctorId: doc.id }
      if (from) params.from = from
      if (to) params.to = to
      const res = await hospitalApi.listTokens(params) as any
      const items: Token[] = (res.tokens || []).map((t: any) => ({
        id: t._id,
        tokenNo: String(t.tokenNo || ''),
        createdAt: t.createdAt,
        patientName: t.patientName || '-',
        mrNo: t.mrn || '-',
        patientId: t.patientId?._id != null ? String(t.patientId._id) : (t.patientId != null && typeof t.patientId === 'string' ? String(t.patientId) : undefined),
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

  async function fetchPrintData(id: string) {
    const [detail, settings] = await Promise.all([
      hospitalApi.getPrescription(id) as any,
      hospitalApi.getSettings() as any,
    ])
    const pres = detail?.prescription
    const encounterId = String(pres?.encounterId?._id || pres?.encounterId || '')
    let historyTaking: any = null
    try {
      if (encounterId) {
        const ht: any = await hospitalApi.getHistoryTaking(encounterId)
        historyTaking = ht?.historyTaking?.data || null
      }
    } catch { }
    const vitalsFromHistoryTaking = (() => {
      const d: any = historyTaking || null
      if (!d) return undefined
      const p = d.personalInfo || d.personal_info || d.personal || d.patient || d
      const num = (x: any) => {
        if (x == null) return undefined
        const v = parseFloat(String(x).trim())
        return isFinite(v) ? v : undefined
      }
      const bpRaw = p?.bp ?? p?.BP ?? p?.bloodPressure ?? p?.blood_pressure
      let sys: number | undefined
      let dia: number | undefined
      if (typeof bpRaw === 'string') {
        const s = String(bpRaw).trim()
        if (s.includes('/')) {
          const m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
          if (m) { sys = num(m[1]); dia = num(m[2]) }
        } else {
          sys = num(s)
        }
      } else if (bpRaw && typeof bpRaw === 'object') {
        sys = num(bpRaw.sys ?? bpRaw.systolic ?? bpRaw.bloodPressureSys)
        dia = num(bpRaw.dia ?? bpRaw.diastolic ?? bpRaw.bloodPressureDia)
      }
      const heightCm = num(p?.heightCm ?? p?.height_cm ?? p?.height)
      const weightKg = num(p?.weightKg ?? p?.weight_kg ?? p?.weight)
      if (sys == null && dia == null && heightCm == null && weightKg == null) return undefined
      return {
        bloodPressureSys: sys,
        bloodPressureDia: dia,
        heightCm,
        weightKg,
      }
    })()
    const vitals = pres?.vitals || vitalsFromHistoryTaking
    let patient: any = { name: pres?.encounterId?.patientId?.fullName || '-', mrn: pres?.encounterId?.patientId?.mrn || '-' }
    try {
      if (patient?.mrn) {
        let p: any = null
        try {
          const resp: any = await labApi.getPatientByMrn(patient.mrn)
          p = resp?.patient || null
        } catch { }
        if (!p) {
          try {
            const resp: any = await hospitalApi.searchPatients({ mrn: String(patient.mrn), limit: 1 })
            const first = Array.isArray(resp?.patients) ? resp.patients[0] : null
            p = first || null
          } catch { }
        }
        if (p) {
          let ageTxt = ''
          try {
            if (p.age != null) ageTxt = String(p.age)
            else if (p.dob) {
              const dob = new Date(p.dob)
              if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now() - dob.getTime()) / 31557600000)))
            }
          } catch { }
          const gender = p.gender || p.sex || p.Gender || '-'
          const fatherName = p.fatherName || p.guardianName || p.guardian || p.father || p.father_name || '-'
          const phone = p.phoneNormalized || p.phone || p.phoneNumber || p.mobile || p.mobileNo || '-'
          const address = p.address || p.homeAddress || p.currentAddress || p.addressLine || '-'
          patient = { name: p.fullName || p.name || patient.name, mrn: p.mrn || p.mrNo || patient.mrn, gender, fatherName, phone, address, age: ageTxt }
        }
      }
    } catch { }
    let doctor: any = { name: pres?.encounterId?.doctorId?.name || '-', specialization: '', qualification: '', departmentName: '', phone: '' }
    try {
      const drList: any = await hospitalApi.listDoctors()
      const doctors: any[] = drList?.doctors || []
      const drId = String(pres?.encounterId?.doctorId?._id || pres?.encounterId?.doctorId || '')
      const d = doctors.find(x => String(x._id || x.id) === drId)
      if (d) doctor = { name: d.name || doctor.name, specialization: d.specialization || '', qualification: d.qualification || '', departmentName: '', phone: d.phone || '' }
      try {
        const depRes: any = await hospitalApi.listDepartments()
        const depArray: any[] = (depRes?.departments || depRes || []) as any[]
        const deptName = d?.primaryDepartmentId ? (depArray.find((z: any) => String(z._id || z.id) === String(d.primaryDepartmentId))?.name || '') : ''
        if (deptName) doctor.departmentName = deptName
      } catch { }
    } catch { }
    return {
      settings,
      doctor,
      patient,
      historyTaking,
      items: pres?.medicine || pres?.items || [],
      vitals,
      primaryComplaint: pres?.primaryComplaint || pres?.complaints,
      primaryComplaintHistory: pres?.primaryComplaintHistory,
      familyHistory: pres?.familyHistory,
      allergyHistory: pres?.allergyHistory,
      treatmentHistory: pres?.treatmentHistory,
      history: pres?.history,
      examFindings: pres?.examFindings,
      diagnosis: pres?.diagnosis,
      advice: pres?.advice,
      labTests: pres?.labTests || [],
      labNotes: pres?.labNotes,
      diagnosticTests: pres?.diagnosticTests || [],
      diagnosticNotes: pres?.diagnosticNotes,
      therapyTests: pres?.therapyTests || [],
      therapyNotes: pres?.therapyNotes || '',
      therapyPlan: pres?.therapyPlan,
      therapyMachines: pres?.therapyMachines,
      counselling: pres?.counselling,
      createdAt: pres?.createdAt,
    }
  }

  async function loadPresIds() {
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

  const allPatients = useMemo(() => {
    const presSet = new Set(presEncounterIds.filter(Boolean))
    const list = [...myPatients]
    if (forcedToken) {
      const exists = list.some(t => String(t.encounterId) === String(forcedToken.encounterId))
      if (!exists) list.unshift(forcedToken)
    }
    // Final safety filter to ensure no already-prescribed patients appear in the dropdown
    // unless it's a forced token (e.g. editing an existing one)
    return list.filter(t => {
      if (forcedToken && String(t.encounterId) === String(forcedToken.encounterId)) return true
      return !t.encounterId || !presSet.has(String(t.encounterId))
    })
  }, [myPatients, forcedToken, presEncounterIds])

  useEffect(() => {
    if (!prefillTokenId) return
    const exists = allPatients.some(t => String(t.id) === String(prefillTokenId))
    if (!exists) return
    setForm(f => ({ ...f, patientKey: String(prefillTokenId) }))
    setPrefillTokenId('')
  }, [prefillTokenId, allPatients])
  const setMed = (i: number, key: keyof MedicineRow, value: string) => {
    setForm(f => {
      const next = [...f.meds]
      next[i] = { ...next[i], [key]: value }
      return { ...f, meds: next }
    })
  }
  // Frequency now textable; we keep morning/noon/evening/night as fallback only

  async function searchMedicines(q: string) {
    try {
      if (!q || q.trim().length < 2) { setMedNameSuggestions([]); return }
      const res: any = await pharmacyApi.searchMedicines(q.trim())
      const list: string[] = Array.isArray(res?.suggestions)
        ? res.suggestions.map((m: any) => String(m.name || '').trim()).filter(Boolean)
        : Array.isArray(res?.medicines)
          ? res.medicines.map((m: any) => String(m.name || m.genericName || '').trim()).filter(Boolean)
          : Array.isArray(res)
            ? res.map((m: any) => String(m.name || m.genericName || m || '').trim()).filter(Boolean)
            : []
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

  const sel = allPatients.find(t => `${t.id}` === form.patientKey)
  const lastSelIdRef = useRef<string>('')

  // Edit mode hydration (opened from Prescription History)
  useEffect(() => {
    const encounterId = String(prefillEncounterId || '')
    if (!encounterId) return
    let cancelled = false
      ; (async () => {
        try {
          const [presRes, htRes, labRes] = await Promise.all([
            hospitalApi.getPrescriptionByEncounter(encounterId) as any,
            hospitalApi.getHistoryTaking(encounterId).catch(() => null) as any,
            hospitalApi.getLabReportsEntry(encounterId).catch(() => null) as any,
          ])
          if (cancelled) return

          const p = presRes?.prescription || null
          const htData = htRes?.historyTaking?.data || null
          const lr = labRes?.labReportsEntry || null

          try {
            const patientName = p?.encounterId?.patientId?.fullName || 'Patient'
            const mrNo = p?.encounterId?.patientId?.mrn || '-'
            const doctorId = String(p?.encounterId?.doctorId?._id || p?.encounterId?.doctorId || doc?.id || '')
            const doctorName = p?.encounterId?.doctorId?.name || doc?.name || ''
            const tok: Token = {
              id: `encounter:${encounterId}`,
              tokenNo: '-',
              createdAt: p?.createdAt || new Date().toISOString(),
              patientName,
              mrNo,
              patientId: String(p?.patientId?._id || p?.patientId || ''),
              encounterId,
              doctorId,
              doctorName,
              status: 'in-progress',
            }
            setForcedToken(tok)
            setForm(f => ({ ...f, patientKey: tok.id }))
          } catch { }

          if (p) {
            const meds = (Array.isArray(p.medicine) ? p.medicine : (Array.isArray(p.items) ? p.items : []))
              .filter((m: any) => String(m?.name || '').trim())
              .map((m: any) => {
                const notes = String(m?.notes || '')
                const mRoute = notes.match(/Route:\s*([^;]+)/i)
                const mInstr = notes.match(/Instruction:\s*([^;]+)/i)
                return {
                  name: String(m?.name || ''),
                  qty: m?.dose != null ? String(m.dose) : '',
                  freqText: m?.frequency != null ? String(m.frequency) : '',
                  durationText: m?.duration != null ? String(m.duration) : '',
                  route: mRoute?.[1]?.trim() || '',
                  instruction: mInstr?.[1]?.trim() || '',
                  morning: '',
                  noon: '',
                  evening: '',
                  night: '',
                } as MedicineRow
              })

            const diagTestsText = Array.isArray(p?.diagnosticTests) ? (p.diagnosticTests as any[]).map((x: any) => String(x || '').trim()).filter(Boolean).join('\n') : ''
            const diagNotesText = p?.diagnosticNotes != null ? String(p.diagnosticNotes) : ''
            const therapyTestsText = Array.isArray(p?.therapyTests) ? (p.therapyTests as any[]).map((x: any) => String(x || '').trim()).filter(Boolean).join('\n') : ''
            const therapyNotesText = p?.therapyNotes != null ? String(p.therapyNotes) : ''
            const labTestsText = Array.isArray(p?.labTests) ? (p.labTests as any[]).map((x: any) => String(x || '').trim()).filter(Boolean).join('\n') : ''
            const labNotesText = p?.labNotes != null ? String(p.labNotes) : ''

            setForm(f => ({
              ...f,
              primaryComplaint: p?.primaryComplaint || '',
              primaryComplaintHistory: p?.primaryComplaintHistory || '',
              familyHistory: p?.familyHistory || '',
              allergyHistory: p?.allergyHistory || '',
              treatmentHistory: p?.treatmentHistory || '',
              history: p?.history || '',
              examFindings: p?.examFindings || '',
              diagnosis: p?.diagnosis || '',
              advice: p?.advice || '',
              labTestsText,
              labNotes: labNotesText,
              therapyTestsText,
              therapyNotes: therapyNotesText,
              therapyDiscount: String(p?.therapyDiscount ?? 0),
              counsellingDiscount: String(p?.counsellingDiscount ?? 0),
              diagDisplay: { testsText: diagTestsText, notes: diagNotesText, discount: String(p?.diagnosticDiscount ?? 0) },
              meds: meds.length ? meds : f.meds,
              vitalsNormalized: p?.vitals || {},
            }))

            try {
              if (p?.vitals) {
                const vv: any = p.vitals
                vitalsRef.current?.setDisplay?.({
                  pulse: vv?.pulse != null ? String(vv.pulse) : '',
                  temperature: vv?.temperatureC != null ? String(vv.temperatureC) : '',
                  bloodPressureSys: vv?.bloodPressureSys != null ? String(vv.bloodPressureSys) : '',
                  bloodPressureDia: vv?.bloodPressureDia != null ? String(vv.bloodPressureDia) : '',
                  respiratoryRate: vv?.respiratoryRate != null ? String(vv.respiratoryRate) : '',
                  bloodSugar: vv?.bloodSugar != null ? String(vv.bloodSugar) : '',
                  weightKg: vv?.weightKg != null ? String(vv.weightKg) : '',
                  height: vv?.heightCm != null ? String(vv.heightCm) : '',
                  spo2: vv?.spo2 != null ? String(vv.spo2) : '',
                })
              }
            } catch { }
            try { diagRef.current?.setDisplay?.({ testsText: diagTestsText, notes: diagNotesText, discount: String(p?.diagnosticDiscount ?? 0) }) } catch { }
            try {
              if (p?.therapyPlan) setTherapyPlan((prev: any) => ({ ...(prev || getEmptyTherapyPlan()), ...(p.therapyPlan || {}) }))
              if (p?.therapyMachines) {
                const tm: any = p.therapyMachines || {}
                const custom = tm?.__custom
                const fixedOnly: any = { ...tm }
                try { delete fixedOnly.__custom } catch { }
                setTherapyMachines((prev: any) => ({ ...(prev || getEmptyTherapyMachines()), ...(fixedOnly || {}) }))
                try {
                  const defs = Array.isArray(custom?.defs) ? custom.defs : []
                  const st = custom?.state && typeof custom.state === 'object' ? custom.state : {}
                  setCustomTherapyMachines(defs)
                  setCustomTherapyMachineState(st)
                } catch { }
              }
              if (p?.counselling) setCounselling((prev: any) => ({ ...(prev || {}), ...(p.counselling || {}) }))
            } catch { }
          }

          if (htData) {
            try {
              setHxBy(String(htData?.hxBy || ''))
              setHxDate(String(htData?.hxDate || today))
              const d = htData
              const snap: any = { hxBy: String(d?.hxBy || ''), hxDate: String(d?.hxDate || today), data: d }
              historyTakingBaselineRef.current = stableStringify(snap)
              setPersonalInfo((prev: any) => ({ ...(prev || getEmptyPersonalInfo()), ...(d?.personalInfo || {}) }))
              setMaritalStatus((prev: any) => ({ ...(prev || getEmptyMaritalStatus()), ...(d?.maritalStatus || {}) }))
              setCoitus((prev: any) => ({ ...(prev || getEmptyCoitus()), ...(d?.coitus || {}) }))
              setHealth((prev: any) => ({ ...(prev || getEmptyHealth()), ...(d?.health || {}) }))
              setSexualHistory((prev: any) => ({ ...(prev || getEmptySexualHistory()), ...(d?.sexualHistory || {}) }))
              setPreviousMedicalHistory((prev: any) => ({ ...(prev || getEmptyPreviousMedicalHistory()), ...(d?.previousMedicalHistory || {}) }))
              setArrivalReference((prev: any) => ({ ...(prev || getEmptyArrivalReference()), ...(d?.arrivalReference || {}) }))
            } catch { }
          }

          if (lr) {
            try {
              setLabReportsHxBy(String(lr?.hxBy || ''))
              setLabReportsHxDate(String(lr?.hxDate || today))
              setLabReportsLabInformation(lr?.labInformation || EMPTY_LAB_INFORMATION)
              setLabReportsSemenAnalysis(lr?.semenAnalysis || EMPTY_SEMEN_ANALYSIS)
              setLabReportsTests(Array.isArray(lr?.tests) && lr.tests.length ? lr.tests : [{ testName: '', normalValue: '', result: '', status: '' }])
              const snap: any = { hxBy: String(lr?.hxBy || ''), hxDate: String(lr?.hxDate || today), labInformation: lr?.labInformation || {}, semenAnalysis: lr?.semenAnalysis || {}, tests: lr?.tests || [] }
              labReportsBaselineRef.current = stableStringify(snap)
            } catch { }
          }

          showToast('success', 'Prescription loaded for editing')
        } catch (e: any) {
          if (cancelled) return
          showToast('error', String(e?.message || 'Failed to load prescription'))
        }
      })()
    return () => { cancelled = true }
  }, [prefillEncounterId, doc?.id])

  const [prevHistories, setPrevHistories] = useState<PrevHistoryTaking[]>([])
  const [prevHistoryId, setPrevHistoryId] = useState<string>('')
  const [prevLabEntries, setPrevLabEntries] = useState<PrevLabReportsEntry[]>([])
  const [prevLabEntryId, setPrevLabEntryId] = useState<string>('')
  const [prevPrescriptions, setPrevPrescriptions] = useState<PreviousVisit[]>([])
  const [prevPrescriptionId, setPrevPrescriptionId] = useState<string>('')

  const [showPrevHistoriesDlg, setShowPrevHistoriesDlg] = useState(false)
  const [showPrevLabEntriesDlg, setShowPrevLabEntriesDlg] = useState(false)
  const [showPrevPrescriptionsDlg, setShowPrevPrescriptionsDlg] = useState(false)

  const [prevHistoryViewId, setPrevHistoryViewId] = useState<string>('')
  const [prevHistoryViewPrescription, setPrevHistoryViewPrescription] = useState<any>(null)
  const [prevLabEntryViewId, setPrevLabEntryViewId] = useState<string>('')

  const openPreviousPrescriptionPdf = async (prescriptionId: string) => {
    if (!prescriptionId) return
    try {
      const data: any = await fetchPrintData(prescriptionId)
      let tpl: PrescriptionPdfTemplate = 'default'
      try {
        const raw = localStorage.getItem(`doctor.rx.template.${doc?.id || 'anon'}`) as PrescriptionPdfTemplate | null
        if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw
      } catch { }
      await previewPrescriptionPdf({
        doctor: data.doctor || {},
        settings: data.settings || {},
        patient: data.patient || {},
        items: data.items || [],
        historyTaking: data.historyTaking,
        vitals: data.vitals,
        primaryComplaint: data.primaryComplaint,
        primaryComplaintHistory: data.primaryComplaintHistory,
        familyHistory: data.familyHistory,
        allergyHistory: data.allergyHistory,
        treatmentHistory: data.treatmentHistory,
        history: data.history,
        examFindings: data.examFindings,
        diagnosis: data.diagnosis,
        advice: data.advice,
        labTests: data.labTests || [],
        labNotes: data.labNotes || '',
        diagnosticTests: data.diagnosticTests || [],
        diagnosticNotes: data.diagnosticNotes || '',
        therapyTests: data.therapyTests || [],
        therapyNotes: data.therapyNotes || '',
        therapyPlan: data.therapyPlan,
        therapyMachines: data.therapyMachines,
        counselling: data.counselling,
        createdAt: data.createdAt,
      }, tpl)
    } catch (e: any) {
      showToast('error', String(e?.message || 'Failed to open prescription PDF'))
    }
  }

  useEffect(() => {
    if (!prevPrescriptionId) return
    let cancelled = false
      ; (async () => {
        try {
          const res: any = await hospitalApi.getPrescription(prevPrescriptionId)
          const p = res?.prescription
          if (!p || cancelled) return

          const meds = (Array.isArray(p.medicine) ? p.medicine : (Array.isArray(p.items) ? p.items : []))
            .filter((m: any) => String(m?.name || '').trim())
            .map((m: any) => {
              const notes = String(m?.notes || '')
              const mRoute = notes.match(/Route:\s*([^;]+)/i)
              const mInstr = notes.match(/Instruction:\s*([^;]+)/i)
              return {
                name: String(m?.name || ''),
                qty: m?.dose != null ? String(m.dose) : '',
                freqText: m?.frequency != null ? String(m.frequency) : '',
                durationText: m?.duration != null ? String(m.duration) : '',
                route: mRoute?.[1]?.trim() || '',
                instruction: mInstr?.[1]?.trim() || '',
                morning: '',
                noon: '',
                evening: '',
                night: '',
              } as MedicineRow
            })

          const diagTestsText = Array.isArray(p?.diagnosticTests) ? (p.diagnosticTests as any[]).map(x => String(x || '').trim()).filter(Boolean).join('\n') : ''
          const diagNotesText = p?.diagnosticNotes != null ? String(p.diagnosticNotes) : ''
          const therapyTestsText = Array.isArray(p?.therapyTests) ? (p.therapyTests as any[]).map(x => String(x || '').trim()).filter(Boolean).join('\n') : ''
          const therapyNotesText = p?.therapyNotes != null ? String(p.therapyNotes) : ''
          const labTestsText = Array.isArray(p?.labTests) ? (p.labTests as any[]).map(x => String(x || '').trim()).filter(Boolean).join('\n') : ''
          const labNotesText = p?.labNotes != null ? String(p.labNotes) : ''

          setForm(f => ({
            ...f,
            primaryComplaint: p?.primaryComplaint || '',
            primaryComplaintHistory: p?.primaryComplaintHistory || '',
            familyHistory: p?.familyHistory || '',
            allergyHistory: p?.allergyHistory || '',
            treatmentHistory: p?.treatmentHistory || '',
            history: p?.history || '',
            examFindings: p?.examFindings || '',
            diagnosis: p?.diagnosis || '',
            advice: p?.advice || '',
            labTestsText,
            labNotes: labNotesText,
            therapyTestsText,
            therapyNotes: therapyNotesText,
            diagDisplay: { testsText: diagTestsText, notes: diagNotesText, discount: String(p?.diagnosticDiscount ?? 0) },
            meds: meds.length ? meds : f.meds,
            vitalsNormalized: p?.vitals || {},
          }))

          try {
            if (p?.vitals) {
              const vv: any = p.vitals
              vitalsRef.current?.setDisplay?.({
                pulse: vv?.pulse != null ? String(vv.pulse) : '',
                temperature: vv?.temperatureC != null ? String(vv.temperatureC) : '',
                bloodPressureSys: vv?.bloodPressureSys != null ? String(vv.bloodPressureSys) : '',
                bloodPressureDia: vv?.bloodPressureDia != null ? String(vv.bloodPressureDia) : '',
                respiratoryRate: vv?.respiratoryRate != null ? String(vv.respiratoryRate) : '',
                bloodSugar: vv?.bloodSugar != null ? String(vv.bloodSugar) : '',
                weightKg: vv?.weightKg != null ? String(vv.weightKg) : '',
                height: vv?.heightCm != null ? String(vv.heightCm) : '',
                spo2: vv?.spo2 != null ? String(vv.spo2) : '',
              })
            }
          } catch { }
          try { diagRef.current?.setDisplay?.({ testsText: diagTestsText, notes: diagNotesText, discount: String(p?.diagnosticDiscount ?? 0) }) } catch { }

          try {
            if (p?.therapyPlan) setTherapyPlan((prev: any) => ({ ...(prev || getEmptyTherapyPlan()), ...(p.therapyPlan || {}) }))
            if (p?.therapyMachines) setTherapyMachines((prev: any) => ({ ...(prev || getEmptyTherapyMachines()), ...(p.therapyMachines || {}) }))
            if (p?.counselling) setCounselling((prev: any) => ({ ...(prev || {}), ...(p.counselling || {}) }))
          } catch { }

          showToast('success', 'Previous prescription loaded')
        } catch (e: any) {
          if (cancelled) return
          showToast('error', String(e?.message || 'Failed to load previous prescription'))
        }
      })()
    return () => { cancelled = true }
  }, [prevPrescriptionId])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setPrevHistories([])
          setPrevHistoryId('')
          const pid = String(sel?.patientId || '')
          if (!pid) return
          const rr: any = await hospitalApi.listHistoryTakings({ patientId: pid, limit: 100 })
          const rows: PrevHistoryTaking[] = (rr?.historyTakings || []).map((r: any) => ({
            _id: String(r._id || r.id || ''),
            submittedAt: r.submittedAt ? String(r.submittedAt) : undefined,
            createdAt: r.createdAt ? String(r.createdAt) : undefined,
            hxBy: r.hxBy != null ? String(r.hxBy) : undefined,
            hxDate: r.hxDate != null ? String(r.hxDate) : undefined,
            data: r.data,
          })).filter((x: PrevHistoryTaking) => !!x._id)
          if (!cancelled) setPrevHistories(rows)
        } catch {
          if (!cancelled) { setPrevHistories([]); setPrevHistoryId('') }
        }
      })()
    return () => { cancelled = true }
  }, [sel?.patientId, sel?.id])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setPrevLabEntries([])
          setPrevLabEntryId('')
          const pid = String(sel?.patientId || '')
          if (!pid) return
          const rr: any = await hospitalApi.listLabReportsEntries({ patientId: pid, limit: 100 })
          const rows: PrevLabReportsEntry[] = (rr?.labReportsEntries || []).map((r: any) => ({
            _id: String(r._id || r.id || ''),
            submittedAt: r.submittedAt ? String(r.submittedAt) : undefined,
            createdAt: r.createdAt ? String(r.createdAt) : undefined,
            hxBy: r.hxBy != null ? String(r.hxBy) : undefined,
            hxDate: r.hxDate != null ? String(r.hxDate) : undefined,
            labInformation: r.labInformation,
            semenAnalysis: r.semenAnalysis,
            tests: r.tests,
          })).filter((x: PrevLabReportsEntry) => !!x._id)
          if (!cancelled) setPrevLabEntries(rows)
        } catch {
          if (!cancelled) { setPrevLabEntries([]); setPrevLabEntryId('') }
        }
      })()
    return () => { cancelled = true }
  }, [sel?.patientId, sel?.id])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setPrevPrescriptions([])
          setPrevPrescriptionId('')
          if (!sel?.mrNo) return
          const res: any = await hospitalApi.listPrescriptions({ patientMrn: sel.mrNo, page: 1, limit: 2000 })
          const rows: any[] = res?.prescriptions || []
          const mapped: PreviousVisit[] = rows.map((p: any) => ({
            id: String(p._id || p.id || ''),
            createdAt: p.createdAt ? String(p.createdAt) : '',
            encounterId: String(p.encounterId?._id || p.encounterId || ''),
            medicine: Array.isArray(p.medicine) ? p.medicine : (Array.isArray(p.items) ? p.items : []),
            diagnosticTests: Array.isArray(p.diagnosticTests) ? p.diagnosticTests : undefined,
            diagnosticNotes: p.diagnosticNotes != null ? String(p.diagnosticNotes) : undefined,
            therapyTests: Array.isArray(p.therapyTests) ? p.therapyTests : undefined,
            therapyNotes: p.therapyNotes != null ? String(p.therapyNotes) : undefined,
          })).filter((x: PreviousVisit) => !!x.id)
          if (!cancelled) setPrevPrescriptions(mapped)
        } catch {
          if (!cancelled) { setPrevPrescriptions([]); setPrevPrescriptionId('') }
        }
      })()
    return () => { cancelled = true }
  }, [sel?.mrNo])

  // Fetch prescription for history view to get historyEdits
  useEffect(() => {
    if (!prevHistoryViewId) {
      setPrevHistoryViewPrescription(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        // Use historyTakingId to find the correct prescription
        const res: any = await hospitalApi.getPrescriptionByHistoryTakingId(prevHistoryViewId)
        if (!cancelled && res?.prescription) {
          setPrevHistoryViewPrescription(res.prescription)
        }
      } catch {
        if (!cancelled) setPrevHistoryViewPrescription(null)
      }
    })()
    return () => { cancelled = true }
  }, [prevHistoryViewId])

  useEffect(() => {
    if (!previousVisitOpen) return
    if (!sel?.mrNo) {
      setPreviousVisitError('Select a patient first')
      setPreviousVisits([])
      return
    }
    let cancelled = false
      ; (async () => {
        setPreviousVisitLoading(true)
        setPreviousVisitError('')
        try {
          const res: any = await hospitalApi.listPrescriptions({ patientMrn: sel.mrNo, page: 1, limit: 2000 })
          const rows: any[] = res?.prescriptions || []
          const mapped: PreviousVisit[] = rows
            .map((p: any) => ({
              id: String(p._id || p.id || ''),
              createdAt: String(p.createdAt || p.date || ''),
              encounterId: String(p.encounterId?._id || p.encounterId || ''),
              medicine: Array.isArray(p.medicine) ? p.medicine : (Array.isArray(p.items) ? p.items : []),
              diagnosticTests: Array.isArray(p.diagnosticTests) ? p.diagnosticTests : undefined,
              diagnosticNotes: p.diagnosticNotes ? String(p.diagnosticNotes) : undefined,
              therapyTests: Array.isArray(p.therapyTests) ? p.therapyTests : undefined,
              therapyNotes: p.therapyNotes ? String(p.therapyNotes) : undefined,
            }))
            .filter(v => v.id)
            .sort((a, b) => {
              const ta = new Date(a.createdAt).getTime()
              const tb = new Date(b.createdAt).getTime()
              return (isFinite(ta) ? ta : 0) - (isFinite(tb) ? tb : 0)
            })
          if (!cancelled) setPreviousVisits(mapped)
        } catch (e: any) {
          if (!cancelled) {
            setPreviousVisitError(String(e?.message || 'Failed to load previous visits'))
            setPreviousVisits([])
          }
        } finally {
          if (!cancelled) setPreviousVisitLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [previousVisitOpen, sel?.mrNo])

  useEffect(() => {
    const encId = sel?.encounterId
    if (!encId) {
      setLabReportsEntryId('')
      setLabReportsHxBy('')
      setLabReportsHxDate(today)
      setLabReportsLabInformation(EMPTY_LAB_INFORMATION)
      setLabReportsSemenAnalysis(EMPTY_SEMEN_ANALYSIS)
      setLabReportsTests([{ testName: '', normalValue: '', result: '', status: '' }])
      labReportsBaselineRef.current = stableStringify({
        hxBy: '',
        hxDate: today,
        labInformation: EMPTY_LAB_INFORMATION,
        semenAnalysis: EMPTY_SEMEN_ANALYSIS,
        tests: [{ testName: '', normalValue: '', result: '', status: '' }],
      })
      return
    }

    // Intentionally do not auto-load Lab Reports Entry on patient selection.
    // User should explicitly choose a previous lab entry from the dropdown if they want to load it.
    setLabReportsEntryId('')
    setLabReportsHxBy('')
    setLabReportsHxDate(today)
    setLabReportsLabInformation(EMPTY_LAB_INFORMATION)
    setLabReportsSemenAnalysis(EMPTY_SEMEN_ANALYSIS)
    setLabReportsTests([{ testName: '', normalValue: '', result: '', status: '' }])
    labReportsBaselineRef.current = stableStringify({
      hxBy: '',
      hxDate: today,
      labInformation: EMPTY_LAB_INFORMATION,
      semenAnalysis: EMPTY_SEMEN_ANALYSIS,
      tests: [{ testName: '', normalValue: '', result: '', status: '' }],
    })
  }, [sel?.encounterId, today]);

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
    timePeriod: '',
    marriages: [{
      status: '' as '' | 'Married' | 'To Go',
      timePeriod: '',
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
    }],
  })

  const getEmptyCoitus = () => ({
    intercourse: '' as '' | 'Successful' | 'Faild',
    partnerLiving: '' as '' | 'Together' | 'Out of Town',
    visitHomeMonths: '',
    visitHomeDays: '',
    frequencyType: '' as '' | 'Daily' | 'Weekly' | 'Monthly',
    frequencyNumber: '',
    since: '',
    previousFrequency: '',
  })

  const getEmptyHealth = () => ({
    selectedConditions: [] as string[],
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
      sinceUnit: '' as '' | 'Year' | 'Month' | 'Week' | 'Day',
      prePeni: false,
      postPeni: false,
      ej: '' as '' | 'Yes' | 'No',
      med: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pe: {
      pre: false,
      preValue: '',
      preUnit: '' as '' | 'Sec' | 'JK' | 'Min',
      just: false,
      justValue: '',
      justUnit: '' as '' | 'Sec' | 'JK' | 'Min',
      sinceValue: '',
      sinceUnit: '' as '' | 'Year' | 'Month' | 'Week' | 'Day',
      other: '',
    },
    pFluid: {
      foreplay: false,
      phonixSex: false,
      onThoughts: false,
      pornAddiction: false,
      other: '',
      status: {
        noIssue: false,
        erDown: false,
        weakness: false,
      },
    },
    ud: {
      status: '' as '' | 'Yes' | 'No',
      other: '',
    },
    pSize: {
      bent: false,
      bentLeft: false,
      bentRight: false,
      small: false,
      smallHead: false,
      smallBody: false,
      smallTip: false,
      smallMid: false,
      smallBase: false,
      shrink: false,
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
      ok: false,
      semi: false,
      fl: false,
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
        right: false,
        left: false,
      },
      varicocele: {
        right: false,
        left: false,
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
      sinceUnit: '' as '' | 'Year' | 'Month' | 'Week' | 'Day',
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
        multipleP: false,
        multipleOrOnce: '' as '' | 'Once' | 'Multiple',
        other: '',
      },
      postMarriage: {
        gf: false,
        male: false,
        pros: false,
        mb: false,
        multipleP: false,
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
    setHxBy(currentUser)
    setHxDate(today)
    setHistoryTakingId('')
    historyTakingBaselineRef.current = ''
    setLabReportsHxBy('')
    setLabReportsHxDate(today)
    setLabReportsEntryId('')
    labReportsBaselineRef.current = ''
    setLabReportsLabInformation(EMPTY_LAB_INFORMATION)
    setLabReportsSemenAnalysis(EMPTY_SEMEN_ANALYSIS)
    setLabReportsTests([{ testName: '', normalValue: '', result: '', status: '' }])
    setPersonalInfo(getEmptyPersonalInfo())
    setMaritalStatus(getEmptyMaritalStatus())
    setCoitus(getEmptyCoitus())
    setHealth(getEmptyHealth())
    setSexualHistory(getEmptySexualHistory())
    setPreviousMedicalHistory(getEmptyPreviousMedicalHistory())
    setArrivalReference(getEmptyArrivalReference())
    setTherapyPlan(getEmptyTherapyPlan())
    setTherapyMachines(getEmptyTherapyMachines())
    setTherapyMachineRemoveDialog(null)
    setIsTherapyMachineRestoreDialogOpen(false)
    setTherapyMachineAddName('')
    setTherapyMachineAddKind('checkboxes')
    setTherapyMachineAddOptions([''])
    setTherapyMachineAddFields([''])
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
      therapyDiscount: '0',
      counsellingDiscount: '0',
      vitalsDisplay: {},
      vitalsNormalized: {},
      diagDisplay: { testsText: '', notes: '', discount: '0' },
      meds: [{ name: '', morning: '', noon: '', evening: '', night: '', qty: '', route: '', instruction: '', durationText: '', freqText: '' }],
    })

    try { vitalsRef.current?.setDisplay?.({}) } catch { }
    try { diagRef.current?.setDisplay?.({ testsText: '', notes: '', discount: '0' }) } catch { }
    setActiveTab('Personal Information')
  }

  useEffect(() => {
    if (!sel) {
      resetAllTabs({ keepPatientKey: '' })
      return
    }
    const nextId = String(sel.id || '')
    if (!nextId) return
    if (lastSelIdRef.current === nextId) return
    lastSelIdRef.current = nextId

    // Selecting a patient should NOT auto-load any existing data.
    // Clear all tabs to empty so the doctor fills manually or explicitly loads previous records.
    setPrevHistoryId('')
    setPrevLabEntryId('')
    setPrevPrescriptionId('')
    resetAllTabs({ keepPatientKey: nextId })
  }, [sel?.id, sel?.patientName, sel?.mrNo, pat?.age])

  useEffect(() => {
    if (!sel?.encounterId) return
      ; (async () => {
        try {
          // Intentionally do not auto-load History Taking on patient selection.
          // User should explicitly choose a previous history from the dropdown if they want to load it.
          setHistoryTakingId('')
          historyTakingBaselineRef.current = stableStringify({ hxBy: '', hxDate: today, data: { hxBy: '', hxDate: today } })
        } catch (e: any) {
          showToast('error', String(e?.message || 'Failed to load history taking'))
        }
      })()
  }, [sel?.encounterId])


  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const encounterId = String(sel?.encounterId || prefillEncounterId || '')
    if (!doc || !encounterId) { alert('Select a patient first'); return }
    const items = (form.meds || [])
      .filter(m => (m.name || '').trim())
      .map(m => ({
        name: String(m.name).trim(),
        dose: m.qty ? String(m.qty).trim() : undefined,
        frequency: (m.freqText && m.freqText.trim()) ? m.freqText.trim() : (['morning', 'noon', 'evening', 'night'].map(k => (m as any)[k]).filter(Boolean).join('/ ') || undefined),
        duration: (m.durationText && m.durationText.trim()) ? m.durationText.trim() : (m.days ? `${m.days} ${m.durationUnit || 'day(s)'}` : undefined),
        notes: (m.route || m.instruction) ? [m.route ? `Route: ${m.route}` : null, m.instruction ? `Instruction: ${m.instruction}` : null].filter(Boolean).join('; ') : undefined,
      }))
    const labTests = form.labTestsText.split(/\n|,/).map(s => s.trim()).filter(Boolean)
    const therapyTests = String((form as any).therapyTestsText || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)

    // Collect latest diagnostic and therapy data for validation
    let dRaw: any = undefined
    try { dRaw = diagRef.current?.getData?.() } catch { }
    let diagTests = Array.isArray(dRaw?.tests) && dRaw?.tests?.length ? dRaw?.tests : undefined
    let diagNotes = dRaw?.notes || undefined
    if ((!diagTests || !diagTests.length) && !diagNotes) {
      const dd = (form as any).diagDisplay || {}
      const tests = String(dd.testsText || '').split(/\n|,/).map((s: string) => s.trim()).filter(Boolean)
      diagTests = tests.length ? tests : undefined
      diagNotes = String(dd.notes || '').trim() || undefined
    }

    // Validation: At least one of the 5 required sections must have data
    const hasLab = labTests.length > 0 || (form.labNotes || '').trim().length > 0
    const hasDiag = (diagTests && diagTests.length > 0) || (diagNotes || '').trim().length > 0
    const hasTherapy = therapyTests.length > 0 || ((form as any).therapyNotes || '').trim().length > 0 || (therapyPlan?.months || therapyPlan?.days || therapyPlan?.packages) ? true : false
    const hasMedicine = items.length > 0
    const hasCounselling = !!(counselling?.lcc || counselling?.lccMonth || counselling?.package?.d4 || counselling?.package?.r4 || counselling?.note)

    if (!hasLab && !hasDiag && !hasTherapy && !hasMedicine && !hasCounselling) {
      showToast('error', 'Please enter data in at least one tab (Lab, Diagnostic, Therapy, Medicine, or Counselling)')
      return
    }

    try {
      if (saving) return
      setSaving(true)

      const htSnapshotObj: any = {
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
      }
      const htPayload: any = {
        ...htSnapshotObj,
        submittedBy: doc?.name || undefined,
      }
      const htSnapshot = stableStringify(htSnapshotObj)
      const htDirty = htSnapshot !== historyTakingBaselineRef.current
      let htId = historyTakingId
      if (!htId || htDirty) {
        if (!hxBy.trim()) { showToast('error', 'Hx by is required'); return }
        if (!hxDate.trim()) { showToast('error', 'Hx date is required'); return }
        const r: any = await hospitalApi.upsertHistoryTaking(encounterId, htPayload)
        htId = String(r?.historyTaking?._id || '')
        if (!htId) { showToast('error', 'Failed to save History Taking'); return }
        setHistoryTakingId(htId)
        historyTakingBaselineRef.current = htSnapshot
      }

      const labSnapshotObj: any = {
        hxBy: labReportsHxBy,
        hxDate: labReportsHxDate,
        labInformation: labReportsLabInformation,
        semenAnalysis: labReportsSemenAnalysis,
        tests: labReportsTests,
      }
      const labPayload: any = {
        ...labSnapshotObj,
        submittedBy: doc?.name || undefined,
      }
    const isLabEmpty = !labReportsHxBy.trim() &&
        !labReportsLabInformation.labName.trim() &&
        !labReportsLabInformation.mrNo.trim() &&
        !labReportsLabInformation.date.trim() &&
        !Object.values(labReportsSemenAnalysis).some(v => String(v || '').trim()) &&
        labReportsTests.every(t => !t.testName.trim() && !t.result.trim())

      const labSnapshot = stableStringify(labSnapshotObj)
      const labDirty = labSnapshot !== labReportsBaselineRef.current
      let lrId = labReportsEntryId
      if (!isLabEmpty && (!lrId || labDirty)) {
        const r: any = await hospitalApi.upsertLabReportsEntry(encounterId, labPayload)
        lrId = String(r?.labReportsEntry?._id || '')
        if (!lrId) { showToast('error', 'Failed to save Lab Reports Entry'); return }
        setLabReportsEntryId(lrId)
        labReportsBaselineRef.current = labSnapshot
      } else if (isLabEmpty) {
        lrId = undefined
      }

      let vRaw = undefined as any
      try { vRaw = vitalsRef.current?.getNormalized?.() } catch { }
      const hasVitals = vRaw && Object.values(vRaw).some(x => x != null && !(typeof x === 'number' && isNaN(x)))
      let vitals: any = undefined
      if (hasVitals) vitals = vRaw
      else if (Object.keys((form as any).vitalsNormalized || {}).length) vitals = (form as any).vitalsNormalized
      else if ((form as any).vitalsDisplay && Object.values((form as any).vitalsDisplay).some(Boolean)) {
        const d: any = (form as any).vitalsDisplay
        const n = (x?: any) => { const v = parseFloat(String(x || '').trim()); return isFinite(v) ? v : undefined }
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

      let dRaw: any = undefined
      try { dRaw = diagRef.current?.getData?.() } catch { }
      let diagnosticTests = Array.isArray(dRaw?.tests) && dRaw?.tests?.length ? dRaw?.tests : undefined
      let diagnosticNotes = dRaw?.notes || undefined
      let diagnosticDiscount = dRaw?.discount
      if (diagnosticDiscount === undefined || diagnosticDiscount === null || diagnosticDiscount === '') {
        diagnosticDiscount = (form as any).diagDisplay?.discount || '0'
      }
      if ((!diagnosticTests || !diagnosticTests.length) && !diagnosticNotes && (diagnosticDiscount === '0' || !diagnosticDiscount)) {
      }
      const therapyMachinesPayload: any = {
        ...(therapyMachines || {}),
        __custom: {
          defs: customTherapyMachines,
          state: customTherapyMachineState,
        },
      }

      // Collect doctor's edits on history fields for color coding
      const originalHistory = prevHistories.find(h => String(h._id) === String(prevHistoryId))?.data || {}
      const historyEdits = collectAllHistoryEdits(originalHistory, {
        personalInfo,
        maritalStatus,
        coitus,
        health,
        sexualHistory,
        previousMedicalHistory,
        arrivalReference,
      })

      const parseDiscount = (val: any) => {
        return String(val || '0').trim()
      }

      await hospitalApi.upsertPrescriptionByEncounter(encounterId, {
        historyTakingId: htId,
        labReportsEntryId: lrId,
        medicine: items.length ? items : undefined,
        labTests: labTests.length ? labTests : undefined,
        labNotes: form.labNotes || undefined,
        therapyTests: therapyTests.length ? therapyTests : undefined,
        therapyNotes: (form as any).therapyNotes || undefined,
        therapyDiscount: parseDiscount((form as any).therapyDiscount),
        therapyPlan,
        therapyMachines: therapyMachinesPayload,
        diagnosticTests,
        diagnosticNotes,
        diagnosticDiscount: parseDiscount(diagnosticDiscount),
        counselling,
        counsellingDiscount: parseDiscount((form as any).counsellingDiscount),
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
        historyEdits: historyEdits || undefined,
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
        for (const m of form.meds || []) {
          if (m.qty) addOne('dose', m.qty)
          if (m.instruction) addOne('instruction', m.instruction)
          if (m.route) addOne('route', m.route)
        }
      } catch { }
      try { window.dispatchEvent(new CustomEvent('doctor:pres-saved')) } catch { }
      const wasEdit = !!prefillEncounterId
      showToast('success', wasEdit ? 'Prescription updated successfully' : 'Prescription saved successfully')
      setPrefillEncounterId('')

      setForcedToken(null)
      resetAllTabs({ keepPatientKey: '' })
    } catch (err: any) {
      alert(err?.message || 'Failed to save prescription')
    } finally {
      setSaving(false)
    }
  }

  // Print helpers: build a PDF and open a preview window/tab
  async function openPrint() {
    const sel = myPatients.find(t => `${t.id}` === form.patientKey)
    if (!sel) { alert('Select a patient first'); return }
    // Load settings fresh for header
    let s: any = settings
    try { s = await hospitalApi.getSettings() as any } catch { }
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
            else if (p.dob) { const dob = new Date(p.dob); if (!isNaN(dob.getTime())) ageTxt = String(Math.max(0, Math.floor((Date.now() - dob.getTime()) / 31557600000))) }
          } catch { }
          patient = { name: p.fullName || sel.patientName || '-', mrn: p.mrn || sel.mrNo || '-', gender: p.gender || '-', fatherName: p.fatherName || '-', phone: p.phoneNormalized || '-', address: p.address || '-', age: ageTxt }
        }
      }
    } catch { }
    const doctor = { name: doctorInfo?.name || doc?.name || '-', qualification: doctorInfo?.qualification || '', departmentName: doctorInfo?.departmentName || '', phone: doctorInfo?.phone || '' }

    // Read history taking from DB (staff module) for this encounter
    let historyTaking: any = null
    try {
      if (sel?.encounterId) {
        const ht: any = await hospitalApi.getHistoryTaking(String(sel.encounterId))
        historyTaking = ht?.historyTaking?.data || null
      }
    } catch { }

    // Prefer DB-backed prescription content for printing
    let presDb: any = null
    try {
      if (sel?.encounterId) {
        const resp: any = await hospitalApi.getPrescriptionByEncounter(String(sel.encounterId))
        presDb = resp?.prescription || null
      }
    } catch { }

    const items = presDb
      ? ((presDb.medicine || presDb.items) || []).map((m: any) => {
        const notes = String(m?.notes || '')
        let instr = String(m?.instruction || '').trim()
        let route = String(m?.route || '').trim()
        if (!instr) {
          try { const mi = notes.match(/Instruction:\s*([^;]+)/i); if (mi && mi[1]) instr = mi[1].trim() } catch { }
        }
        if (!route) {
          try { const mr = notes.match(/Route:\s*([^;]+)/i); if (mr && mr[1]) route = mr[1].trim() } catch { }
        }
        return {
          name: m?.name,
          frequency: m?.frequency,
          duration: m?.duration,
          dose: m?.dose,
          instruction: instr || undefined,
          route: route || undefined,
          notes: m?.notes,
        }
      })
      : form.meds
        .filter(m => m.name?.trim())
        .map(m => ({
          name: m.name,
          frequency: (m.freqText && m.freqText.trim()) ? m.freqText.trim() : ['morning', 'noon', 'evening', 'night'].map(k => (m as any)[k]).filter(Boolean).join('/ '),
          duration: (m.durationText && m.durationText.trim()) ? m.durationText.trim() : (m.days ? `${m.days} ${m.durationUnit || 'day(s)'}` : undefined),
          dose: m.qty ? String(m.qty) : undefined,
          instruction: m.instruction || undefined,
          route: m.route || undefined,
        }))
    // Capture latest diagnostic display if available
    try { const dd = diagRef.current?.getDisplay?.(); if (dd) setForm(f => ({ ...f, diagDisplay: dd })) } catch { }
    // Capture latest vitals display/normalized if available
    try { const d = vitalsRef.current?.getDisplay?.(); if (d) setForm(f => ({ ...f, vitalsDisplay: d })) } catch { }
    let vitals: any = undefined
    if (presDb?.vitals) vitals = presDb.vitals
    else {
      let vRaw = undefined as any
      try { vRaw = vitalsRef.current?.getNormalized?.() } catch { }
      const hasVitals = vRaw && Object.values(vRaw).some((x: any) => x != null && !(typeof x === 'number' && isNaN(x)))
      if (hasVitals) vitals = vRaw
      else if (Object.keys((form as any).vitalsNormalized || {}).length) vitals = (form as any).vitalsNormalized
      else if ((form as any).vitalsDisplay && Object.values((form as any).vitalsDisplay).some(Boolean)) {
        const d: any = (form as any).vitalsDisplay
        const n = (x?: any) => { const v = parseFloat(String(x || '').trim()); return isFinite(v) ? v : undefined }
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
    }
    // Build diagnostics data either from DB or live ref / persisted display
    let dPrint: any = presDb ? { tests: presDb.diagnosticTests || [], notes: presDb.diagnosticNotes } : {}
    if (!presDb) {
      try { dPrint = diagRef.current?.getData?.() || {} } catch { }
      if ((!dPrint?.tests || !dPrint.tests.length) && !(dPrint?.notes)) {
        const dd = (form as any).diagDisplay || {}
        const tests = String(dd.testsText || '').split(/\n|,/).map((s: string) => s.trim()).filter(Boolean)
        dPrint = { tests, notes: String(dd.notes || '').trim() || undefined }
      }
    }
    let tpl: PrescriptionPdfTemplate = 'default'
    try { const raw = localStorage.getItem(`doctor.rx.template.${doc?.id || 'anon'}`) as PrescriptionPdfTemplate | null; if (raw === 'default' || raw === 'rx-vitals-left') tpl = raw } catch { }
    const labTests = presDb ? (presDb.labTests || []) : form.labTestsText.split(/\n|,/).map(s => s.trim()).filter(Boolean)
    const labNotes = presDb ? (presDb.labNotes || '') : form.labNotes
    const therapyTests = presDb ? (presDb.therapyTests || []) : String((form as any).therapyTestsText || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)
    const therapyNotes = presDb ? (presDb.therapyNotes || '') : ((form as any).therapyNotes || '')
    const therapyDiscount = presDb ? (presDb.therapyDiscount || '0') : ((form as any).therapyDiscount || '0')
    const counsellingPrint = presDb ? presDb.counselling : counselling
    const counsellingDiscount = presDb ? (presDb.counsellingDiscount || '0') : ((form as any).counsellingDiscount || '0')
    const diagnosticDiscount = presDb ? (presDb.diagnosticDiscount || '0') : (dPrint.discount || '0')
    await previewPrescriptionPdf({ doctor, settings: settingsNorm, patient, items, historyTaking, vitals, labTests, labNotes, therapyTests, therapyNotes, therapyDiscount, diagnosticTests: Array.isArray(dPrint.tests) ? dPrint.tests : [], diagnosticNotes: dPrint.notes || '', diagnosticDiscount, counselling: counsellingPrint, counsellingDiscount, createdAt: presDb?.createdAt || new Date() }, tpl)
  }

  const goTab = (tab: ActiveTab) => {
    if (activeTab === 'diagnostics') {
      try {
        const dd = diagRef.current?.getDisplay?.()
        if (dd) setForm(f => ({ ...f, diagDisplay: dd }))
      } catch { }
    }
    setActiveTab(tab)
  }

  function resetForms() {
    resetAllTabs({ keepPatientKey: '' })
  }


  // Patient details from selected token (for print header)
  useEffect(() => {
    if (!sel?.mrNo) { setPat(null); return }
    // Use patient data from token selection
    setPat({ 
      gender: '-', 
      fatherName: '-', 
      phone: '-', 
      address: '-', 
      age: '' 
    })
  }, [sel?.mrNo])

  // Suggestions: store per-doctor in localStorage
  const keyFor = (name: string) => `doctor.suggest.${doc?.id || 'anon'}.${name}`
  const loadList = (name: string): string[] => {
    try {
      const raw = localStorage.getItem(keyFor(name))
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) return Array.from(new Set(arr.map((s: any) => String(s || '').trim()).filter(Boolean)))
      return []
    } catch { return [] }
  }
  const saveList = (name: string, values: string[]) => {
    const uniq = Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)))
    try { localStorage.setItem(keyFor(name), JSON.stringify(uniq.slice(0, 200))) } catch { }
  }
  const addOne = (name: string, value?: string) => {
    const v = String(value || '').trim(); if (!v) return
    const arr = loadList(name)
    if (!arr.includes(v)) { saveList(name, [v, ...arr]); setSugVersion(x => x + 1) }
  }
  const addMany = (name: string, values: string[]) => {
    const arr = loadList(name)
    const next = [...values.map(s => String(s || '').trim()).filter(Boolean), ...arr]
    saveList(name, Array.from(new Set(next)))
    setSugVersion(x => x + 1)
  }

  const sugInstr = useMemo(() => loadList('instruction'), [doc?.id, sugVersion])
  const sugDuration = useMemo(() => loadList('durationTag'), [doc?.id, sugVersion])
  const sugDose = useMemo(() => loadList('dose'), [doc?.id, sugVersion])
  const sugFreq = useMemo(() => loadList('frequencyTag'), [doc?.id, sugVersion])
  const sugRoute = useMemo(() => loadList('route'), [doc?.id, sugVersion])
  const sugLabNotes = useMemo(() => loadList('lab.notes'), [doc?.id, sugVersion])
  const sugTherapyNotes = useMemo(() => loadList('therapy.notes'), [doc?.id, sugVersion])
  const sugDiagNotes = useMemo(() => loadList('diagnostics.notes'), [doc?.id, sugVersion])

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

  const toggleCustomLabTest = (name: string) => {
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

    if (!(labQuickTests as readonly string[]).includes(v)) {
      saveCustomLabOrderTests([...customLabOrderTests, v])
    }

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

  // Lab Template functions
  const loadLabTemplates = async () => {
    if (!doc?.id) return
    setIsLoadingTemplates(true)
    try {
      const res = await labApi.listTemplates(doc.id) as { templates: LabTemplate[] }
      setLabTemplates(res?.templates || [])
    } catch (e: any) {
      console.error('Failed to load lab templates:', e)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const getDoctorId = () => {
    // Try to get doctor ID from multiple sources
    if (doc?.id) return doc.id

    // Try hospital session
    try {
      const hospitalSession = localStorage.getItem('hospital.session')
      if (hospitalSession) {
        const parsed = JSON.parse(hospitalSession)
        if (parsed?.id || parsed?._id) return parsed.id || parsed._id
      }
    } catch { }

    // Try user
    try {
      const user = localStorage.getItem('user')
      if (user) {
        const parsed = JSON.parse(user)
        if (parsed?.id || parsed?._id) return parsed.id || parsed._id
      }
    } catch { }

    return ''
  }

  const saveLabTemplate = async (template: Omit<LabTemplate, '_id' | 'createdAt' | 'updatedAt'>) => {
    const doctorId = getDoctorId()
    if (!doctorId) {
      throw new Error('Doctor ID is missing. Please log in again.')
    }
    const res = await labApi.createTemplate({ ...template, doctorId }) as { template: LabTemplate }
    if (res?.template) {
      setLabTemplates(prev => [res.template, ...prev])
    }
  }

  const deleteLabTemplate = async (templateId: string) => {
    await labApi.deleteTemplate(templateId)
    setLabTemplates(prev => prev.filter(t => t._id !== templateId))
  }

  const applyLabTemplate = (template: LabTemplate) => {
    setForm(f => {
      const current = parseListText(f.labTestsText)
      const currentSet = new Set(current)
      // Add all tests from template
      template.tests.forEach(test => currentSet.add(test))
      return { ...f, labTestsText: Array.from(currentSet).join('\n') }
    })
    // Add any custom tests from template to the custom tests list
    const newCustomTests = template.tests.filter(t => !(labQuickTests as readonly string[]).includes(t) && !customLabOrderTests.includes(t))
    if (newCustomTests.length) {
      saveCustomLabOrderTests([...customLabOrderTests, ...newCustomTests])
    }
  }

  useEffect(() => {
    const selectedCustom = parseListText(form.labTestsText).filter(t => !(labQuickTests as readonly string[]).includes(t))
    if (selectedCustom.length) {
      saveCustomLabOrderTests([...customLabOrderTests, ...selectedCustom])
    }
  }, [form.labTestsText])

  useEffect(() => {
    if (isViewTemplatesDialogOpen && doc?.id) {
      loadLabTemplates()
    }
  }, [isViewTemplatesDialogOpen, doc?.id])

  async function printReferral() {
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
        <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
            <span className="text-slate-500">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
            <button type="button" onClick={() => { const t = new Date().toISOString().slice(0, 10); setFrom(t); setTo(t) }} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Today</button>
            <button type="button" onClick={() => { setFrom(''); setTo('') }} className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Reset</button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-600">Select Previous Histories</label>
              <select
                value={prevHistoryId}
                onChange={e => {
                  const id = String(e.target.value || '')
                  setPrevHistoryId(id)
                  const r = prevHistories.find(x => x._id === id)
                  if (!r) return

                  const data = r.data
                  setHxBy(String(r.hxBy || (data?.hxBy ?? '') || ''))
                  setHxDate(String(r.hxDate || (data?.hxDate ?? '') || today))
                  const nextPersonalInfo = data?.personalInfo ? { ...getEmptyPersonalInfo(), ...data.personalInfo } : getEmptyPersonalInfo()
                  const nextMaritalStatus = data?.maritalStatus ? { ...getEmptyMaritalStatus(), ...data.maritalStatus } : getEmptyMaritalStatus()
                  const nextCoitus = data?.coitus ? { ...getEmptyCoitus(), ...data.coitus } : getEmptyCoitus()
                  const nextHealth = data?.health ? { ...getEmptyHealth(), ...data.health } : getEmptyHealth()
                  const nextSexualHistory = data?.sexualHistory ? { ...getEmptySexualHistory(), ...data.sexualHistory } : getEmptySexualHistory()
                  const nextPreviousMedicalHistory = data?.previousMedicalHistory ? { ...getEmptyPreviousMedicalHistory(), ...data.previousMedicalHistory } : getEmptyPreviousMedicalHistory()
                  const nextArrivalReference = data?.arrivalReference ? { ...getEmptyArrivalReference(), ...data.arrivalReference } : getEmptyArrivalReference()
                  setPersonalInfo(nextPersonalInfo)
                  setMaritalStatus(nextMaritalStatus)
                  setCoitus(nextCoitus)
                  setHealth(nextHealth)
                  if (nextSexualHistory.oe?.epidCst?.side) {
                    if (nextSexualHistory.oe.epidCst.side === 'Right') nextSexualHistory.oe.epidCst.right = true;
                    if (nextSexualHistory.oe.epidCst.side === 'Left') nextSexualHistory.oe.epidCst.left = true;
                  }
                  if (nextSexualHistory.oe?.varicocele?.side) {
                    if (nextSexualHistory.oe.varicocele.side === 'Right') nextSexualHistory.oe.varicocele.right = true;
                    if (nextSexualHistory.oe.varicocele.side === 'Left') nextSexualHistory.oe.varicocele.left = true;
                  }
                  setSexualHistory(nextSexualHistory)
                  setPreviousMedicalHistory(nextPreviousMedicalHistory)
                  setArrivalReference(nextArrivalReference)
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!sel?.patientId || prevHistories.length === 0}
              >
                <option value="">Previous Histories</option>
                {prevHistories.map(r => {
                  const when = r.submittedAt || r.createdAt || ''
                  const label = when ? new Date(when).toLocaleString() : r._id
                  return (
                    <option key={r._id} value={r._id}>{label}</option>
                  )
                })}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!sel?.patientId || prevHistories.length === 0) {
                    showToast('error', 'No previous histories')
                    return
                  }
                  setShowPrevHistoriesDlg(true)
                }}
                className="mt-2 w-full rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Show Previous Histories
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-600">Select Previous Lab Entries</label>
              <select
                value={prevLabEntryId}
                onChange={e => {
                  const id = String(e.target.value || '')
                  setPrevLabEntryId(id)
                  const r = prevLabEntries.find(x => x._id === id)
                  if (!r) return
                  setLabReportsHxBy(String(r.hxBy || ''))
                  setLabReportsHxDate(String(r.hxDate || today))
                  setLabReportsLabInformation({ ...EMPTY_LAB_INFORMATION, ...(r.labInformation || {}) })
                  setLabReportsSemenAnalysis({ ...EMPTY_SEMEN_ANALYSIS, ...(r.semenAnalysis || {}) })
                  const list = Array.isArray(r.tests) ? r.tests : []
                  setLabReportsTests(list.length ? (list as any) : [{ testName: '', normalValue: '', result: '', status: '' }])
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!sel?.patientId || prevLabEntries.length === 0}
              >
                <option value="">Previous Lab Entries</option>
                {prevLabEntries.map(r => {
                  const when = r.submittedAt || r.createdAt || ''
                  const label = when ? new Date(when).toLocaleString() : r._id
                  return (
                    <option key={r._id} value={r._id}>{label}</option>
                  )
                })}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!sel?.patientId || prevLabEntries.length === 0) {
                    showToast('error', 'No previous lab entries')
                    return
                  }
                  setShowPrevLabEntriesDlg(true)
                }}
                className="mt-2 w-full rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Show Previous Lab Entries
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-600">Select Previous Prescription</label>
              <select
                value={prevPrescriptionId}
                onChange={e => {
                  const id = String(e.target.value || '')
                  setPrevPrescriptionId(id)
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!sel?.mrNo || prevPrescriptions.length === 0}
              >
                <option value="">Previous Prescriptions</option>
                {prevPrescriptions.map(r => {
                  const when = r.createdAt || ''
                  const label = when ? new Date(when).toLocaleString() : r.id
                  return (
                    <option key={r.id} value={r.id}>{label}</option>
                  )
                })}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!sel?.mrNo || prevPrescriptions.length === 0) {
                    showToast('error', 'No previous prescriptions')
                    return
                  }
                  setShowPrevPrescriptionsDlg(true)
                }}
                className="mt-2 w-full rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Show Previous Prescription
              </button>
            </div>
          </div>
        </div>

        {showPrevHistoriesDlg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={() => setShowPrevHistoriesDlg(false)}>
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
                <div>
                  <div className="text-base font-semibold text-slate-900">Previous Histories</div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-900"></span>
                      <span className="text-slate-600">History Taker</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                      <span className="text-blue-600">Doctor Edited</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setShowPrevHistoriesDlg(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                {(() => {
                  const selected = prevHistories.find(x => String(x._id) === String(prevHistoryViewId))
                  const originalData = (selected as any)?.data || {}
                  
                  // Merge with doctor's edits if available
                  const historyEdits = prevHistoryViewPrescription?.historyEdits || {}
                  const sectionsList: HistorySection[] = [
                    'personalInfo', 'maritalStatus', 'coitus', 'health', 
                    'sexualHistory', 'previousMedicalHistory', 'arrivalReference'
                  ]
                  const mergedData: any = {}
                  const allEditedPaths = new Set<string>()
                  for (const section of sectionsList) {
                    const { data, editedPaths } = mergeHistoryWithEdits(
                      originalData[section],
                      historyEdits[section],
                      section
                    )
                    mergedData[section] = data
                    editedPaths.forEach(p => allEditedPaths.add(`${section}.${p}`))
                  }
                  
                  const sections: Array<{ title: string; key: HistorySection; value: any }> = [
                    { title: 'Personal Information', key: 'personalInfo', value: mergedData?.personalInfo },
                    { title: 'Marital Status', key: 'maritalStatus', value: mergedData?.maritalStatus },
                    { title: 'Coitus', key: 'coitus', value: mergedData?.coitus },
                    { title: 'Health', key: 'health', value: mergedData?.health },
                    { title: 'Sexual History', key: 'sexualHistory', value: mergedData?.sexualHistory },
                    { title: 'Previous Medical History', key: 'previousMedicalHistory', value: mergedData?.previousMedicalHistory },
                    { title: 'Arrival Reference', key: 'arrivalReference', value: mergedData?.arrivalReference },
                  ]

                  const toLabel = (key: string) =>
                    String(key || '')
                      .replace(/_/g, ' ')
                      .replace(/([a-z])([A-Z])/g, '$1 $2')
                      .replace(/\s+/g, ' ')
                      .trim()

                  const formatValue = (v: any): string => {
                    if (v == null) return ''
                    if (typeof v === 'string') return v.trim()
                    if (typeof v === 'number') return isFinite(v) ? String(v) : ''
                    if (typeof v === 'boolean') return v ? 'Yes' : ''
                    if (Array.isArray(v)) {
                      const parts = v.map((x) => {
                        if (x == null) return ''
                        if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return formatValue(x)
                        if (typeof x === 'object') {
                          const pick = (o: any, key: string) => {
                            const vv = o?.[key]
                            return typeof vv === 'string' ? vv.trim() : (typeof vv === 'number' && isFinite(vv) ? String(vv) : '')
                          }
                          const label = pick(x, 'label') || pick(x, 'name') || pick(x, 'title') || pick(x, 'type') || pick(x, 'status') || pick(x, 'value') || pick(x, 'description')
                          if (label) return label
                          const inner = formatValue(x)
                          return inner
                        }
                        try { return String(x).trim() } catch { return '' }
                      }).filter(Boolean)
                      return parts.join(', ')
                    }
                    if (typeof v === 'object') {
                      const keys = Object.keys(v || {})
                      const boolKeys: string[] = []
                      const parts: string[] = []
                      for (const k of keys) {
                        const vv = (v as any)[k]
                        if (typeof vv === 'boolean') {
                          if (vv) boolKeys.push(toLabel(k))
                          continue
                        }
                        if (vv == null) continue
                        if (typeof vv === 'string') { const t = vv.trim(); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                        if (typeof vv === 'number') { if (isFinite(vv)) parts.push(`${toLabel(k)}: ${vv}`); continue }
                        if (Array.isArray(vv)) { const t = formatValue(vv); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                        if (typeof vv === 'object') {
                          const inner = formatValue(vv)
                          if (inner) parts.push(`${toLabel(k)}: ${inner}`)
                          continue
                        }
                        try { const t = String(vv).trim(); if (t) parts.push(`${toLabel(k)}: ${t}`) } catch { }
                      }
                      const merged: string[] = []
                      if (boolKeys.length) merged.push(boolKeys.join(', '))
                      if (parts.length) merged.push(parts.join(' • '))
                      return merged.join(' • ')
                    }
                    try { return String(v).trim() } catch { return '' }
                  }

                  const renderPairs = (obj: any, editedPaths?: Set<string>, basePath?: string) => {
                    if (!obj || typeof obj !== 'object') return null

                    const isEditedExact = (fullPath: string): boolean => {
                      if (!editedPaths) return false
                      return editedPaths.has(fullPath)
                    }

                    const renderArrayPrimitiveChips = (arr: any[], fullPath: string) => {
                      const parts = arr
                        .map(v => (v == null ? '' : String(v).trim()))
                        .filter(Boolean)
                      if (!parts.length) return null
                      return (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {parts.map((t) => {
                            // Prefer exact leaf tracking. If only parent array path exists (legacy/older data), treat all chips as edited.
                            const edited = isEditedExact(`${fullPath}.${t}`) || isEditedExact(fullPath)
                            return (
                              <span
                                key={t}
                                className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${edited ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                                title={edited ? 'Edited by doctor' : 'Entered by history taker'}
                              >
                                {t}
                              </span>
                            )
                          })}
                        </div>
                      )
                    }

                    const keys = Object.keys(obj || {})
                    const rows = keys
                      .map(k => ({ k, v: (obj as any)[k] }))
                      .map(it => ({ ...it, txt: formatValue(it.v) }))
                      .filter(it => !!it.txt)
                    if (!rows.length) return null

                    const isMaritalStatus = basePath === 'maritalStatus'
                    return (
                      <div className={`mt-2 grid gap-2 ${isMaritalStatus ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
                        {rows.map(({ k, txt }) => {
                          const fullPath = basePath ? `${basePath}.${k}` : k
                          const v = (obj as any)[k]
                          // Do not paint the whole card as edited for nested changes.
                          // Only paint it when this exact field was edited.
                          const isEdited = isEditedExact(fullPath)
                          const isArray = Array.isArray(v)
                          const isPrimitiveArray = isArray && (v as any[]).every(x => x == null || typeof x !== 'object')
                          const isObjectValue = !isArray && v != null && typeof v === 'object'
                          const isArrayOfObjects = isArray && !isPrimitiveArray

                          const renderArrayOfObjects = (arr: any[], path: string) => {
                            if (!Array.isArray(arr) || !arr.length) return null
                            return (
                              <div className="mt-2 space-y-3">
                                {arr.map((item, idx) => {
                                  const itemPath = `${path}.${idx}`
                                  const itemKeys = Object.keys(item || {}).filter(ik => ik !== '_id' && ik !== 'id')
                                  if (!itemKeys.length) return null
                                  return (
                                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        {toLabel(path.split('.').pop() || '')} #{idx + 1}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {itemKeys.map(ik => {
                                          const leafPath = `${itemPath}.${ik}`
                                          const val = item[ik]
                                          if (val == null) return null
                                          
                                          if (typeof val === 'object' && !Array.isArray(val)) {
                                            return (
                                              <div key={ik} className="rounded-md border border-slate-100 bg-slate-50 p-2">
                                                <div className="text-[10px] font-medium text-slate-500">{toLabel(ik)}</div>
                                                {renderObjectValue(val, leafPath)}
                                              </div>
                                            )
                                          }

                                          const txt = formatValue(val)
                                          if (!txt) return null
                                          const edited = isEditedExact(leafPath)
                                          return (
                                            <div key={ik} className={`rounded-md border border-slate-100 p-2 ${edited ? 'bg-blue-50' : 'bg-slate-50'}`}>
                                              <div className="text-[10px] text-slate-500">{toLabel(ik)}</div>
                                              <div className={`mt-0.5 text-xs font-semibold ${edited ? 'text-blue-600' : 'text-slate-900'}`}>
                                                {txt}
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          }

                          const renderObjectValue = (val: any, path: string) => {
                            if (!val || typeof val !== 'object' || Array.isArray(val)) return null
                            const keys2 = Object.keys(val || {})
                            const boolItems: Array<{ key: string; label: string; edited: boolean }> = []
                            const parts2: Array<{ key: string; text: string; edited: boolean }> = []
                            
                            const collectLeaves = (v: any, currentPath: string, prefixLabel: string = '') => {
                              if (v == null) return
                              if (typeof v === 'boolean') {
                                if (v) boolItems.push({ key: currentPath, label: prefixLabel.trim(), edited: isEditedExact(currentPath) })
                              } else if (typeof v === 'object' && !Array.isArray(v)) {
                                Object.keys(v).forEach(k => {
                                  collectLeaves(v[k], `${currentPath}.${k}`, `${prefixLabel} ${toLabel(k)}`)
                                })
                              } else {
                                const t = formatValue(v)
                                if (t) parts2.push({ key: currentPath, text: `${prefixLabel.trim()}: ${t}`, edited: isEditedExact(currentPath) })
                              }
                            }

                            for (const kk of keys2) {
                              collectLeaves((val as any)[kk], `${path}.${kk}`, toLabel(kk))
                            }
                            if (!boolItems.length && !parts2.length) return null
                            return (
                              <div className="mt-0.5">
                                {!!boolItems.length && (
                                  <div className="flex flex-wrap gap-2">
                                    {boolItems.map((b) => (
                                      <span
                                        key={b.key}
                                        className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${b.edited ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                                        title={b.edited ? 'Edited by doctor' : 'Entered by history taker'}
                                      >
                                        {b.label}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {!!parts2.length && (
                                  <div className="mt-1 text-sm font-semibold">
                                    {parts2.map((p, idx) => (
                                      <span key={p.key}>
                                        {idx > 0 ? <span className="text-slate-400"> • </span> : null}
                                        <span className={p.edited ? 'text-blue-600' : 'text-slate-900'}>{p.text}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          return (
                            <div key={k} className={`rounded-lg border border-slate-200 p-3 ${isEdited ? 'bg-blue-50' : 'bg-slate-50'}`}>
                              <div className="text-xs text-slate-500">{toLabel(k)}</div>
                              {isPrimitiveArray ? (
                                renderArrayPrimitiveChips(v as any[], fullPath)
                              ) : isArrayOfObjects ? (
                                renderArrayOfObjects(v as any[], fullPath)
                              ) : isObjectValue ? (
                                renderObjectValue(v, fullPath)
                              ) : (
                                <div className={`mt-0.5 text-sm font-semibold ${isEdited ? 'text-blue-600' : 'text-slate-900'}`}>
                                  {txt}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  }

                  if (!prevHistoryViewId) {
                    return (
                      <div className="space-y-3">
                        {prevHistories.map((h, idx) => {
                          const when = h.submittedAt || h.createdAt || ''
                          const dateTxt = when ? new Date(when).toLocaleString() : ''
                          return (
                            <div key={h._id || idx} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{sel?.patientName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {sel?.mrNo || '-'})</span></div>
                                <div className="mt-1 text-xs text-slate-600">Visit#{idx + 1}{dateTxt ? ` • ${dateTxt}` : ''}</div>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                                onClick={() => setPrevHistoryViewId(String(h._id || ''))}
                              >
                                View
                              </button>
                            </div>
                          )
                        })}
                        {prevHistories.length === 0 && (
                          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">No previous histories found.</div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{sel?.patientName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {sel?.mrNo || '-'})</span></div>
                          <div className="mt-1 text-xs text-slate-600">Hx By: {String((selected as any)?.hxBy || originalData?.hxBy || '-')} • Hx Date: {String((selected as any)?.hxDate || originalData?.hxDate || '-')}</div>
                        </div>
                        <button type="button" className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50" onClick={() => setPrevHistoryViewId('')}>Back</button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {sections.map(s => {
                          if (s.title === 'Arrival Reference' && s.value && typeof s.value === 'object') {
                            const src: any = s.value
                            const plainValue = (v: any): string => {
                              if (v == null) return ''
                              if (typeof v === 'string') return v.trim()
                              if (typeof v === 'number') return isFinite(v) ? String(v) : ''
                              if (typeof v === 'boolean') return v ? 'Yes' : ''
                              if (Array.isArray(v)) return v.map(x => plainValue(x)).filter(Boolean).join(', ')
                              if (typeof v === 'object') {
                                const direct = plainValue((v as any)?.value) || plainValue((v as any)?.name) || plainValue((v as any)?.label) || plainValue((v as any)?.title)
                                if (direct) return direct
                                // common nested shape { status, other }
                                const s2 = plainValue((v as any)?.status)
                                const o2 = plainValue((v as any)?.other)
                                const merged2 = [s2, o2].filter(Boolean).join(' • ')
                                if (merged2) return merged2
                                // fallback: join primitive leaves only
                                const parts: string[] = []
                                for (const k of Object.keys(v || {})) {
                                  const t = plainValue((v as any)[k])
                                  if (t) parts.push(t)
                                }
                                return parts.join(' • ')
                              }
                              try { return String(v).trim() } catch { return '' }
                            }

                            const statusTxt = plainValue(src?.status)
                            const otherTxt = plainValue(src?.other)
                            const merged = [statusTxt, otherTxt].filter(Boolean).join(' • ')
                            const rest: any = { ...src }
                            try { delete rest.status; delete rest.other } catch { }
                            const restContent = renderPairs(rest, allEditedPaths, s.key)
                            if (!merged && !restContent) return null
                            return (
                              <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                                {merged && (
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                      <div className="text-xs text-slate-500">Arrival Reference</div>
                                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{merged}</div>
                                    </div>
                                  </div>
                                )}
                                {restContent}
                              </div>
                            )
                          }

                          const content = renderPairs(s.value, allEditedPaths, s.key)
                          if (!content) return null
                          return (
                            <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                              {content}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {showPrevLabEntriesDlg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={() => setShowPrevLabEntriesDlg(false)}>
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
                <div className="text-base font-semibold text-slate-900">Previous Lab Entries</div>
                <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setShowPrevLabEntriesDlg(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                {(() => {
                  const selected = prevLabEntries.find(x => String(x._id) === String(prevLabEntryViewId)) as any
                  const toLabel = (key: string) =>
                    String(key || '')
                      .replace(/_/g, ' ')
                      .replace(/([a-z])([A-Z])/g, '$1 $2')
                      .replace(/\s+/g, ' ')
                      .trim()

                  const formatValue = (v: any): string => {
                    if (v == null) return ''
                    if (typeof v === 'string') return v.trim()
                    if (typeof v === 'number') return isFinite(v) ? String(v) : ''
                    if (typeof v === 'boolean') return v ? 'Yes' : ''
                    if (Array.isArray(v)) {
                      const parts = v.map((x) => {
                        if (x == null) return ''
                        if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return formatValue(x)
                        if (typeof x === 'object') {
                          const pick = (o: any, key: string) => {
                            const vv = o?.[key]
                            return typeof vv === 'string' ? vv.trim() : (typeof vv === 'number' && isFinite(vv) ? String(vv) : '')
                          }
                          const label = pick(x, 'label') || pick(x, 'name') || pick(x, 'title') || pick(x, 'type') || pick(x, 'status') || pick(x, 'value') || pick(x, 'description')
                          if (label) return label
                          const inner = formatValue(x)
                          return inner
                        }
                        try { return String(x).trim() } catch { return '' }
                      }).filter(Boolean)
                      return parts.join(', ')
                    }
                    if (typeof v === 'object') {
                      const keys = Object.keys(v || {})
                      const boolKeys: string[] = []
                      const parts: string[] = []
                      for (const k of keys) {
                        const vv = (v as any)[k]
                        if (typeof vv === 'boolean') {
                          if (vv) boolKeys.push(toLabel(k))
                          continue
                        }
                        if (vv == null) continue
                        if (typeof vv === 'string') { const t = vv.trim(); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                        if (typeof vv === 'number') { if (isFinite(vv)) parts.push(`${toLabel(k)}: ${vv}`); continue }
                        if (Array.isArray(vv)) { const t = formatValue(vv); if (t) parts.push(`${toLabel(k)}: ${t}`); continue }
                        if (typeof vv === 'object') {
                          const inner = formatValue(vv)
                          if (inner) parts.push(`${toLabel(k)}: ${inner}`)
                          continue
                        }
                        try { const t = String(vv).trim(); if (t) parts.push(`${toLabel(k)}: ${t}`) } catch { }
                      }
                      const merged: string[] = []
                      if (boolKeys.length) merged.push(boolKeys.join(', '))
                      if (parts.length) merged.push(parts.join(' • '))
                      return merged.join(' • ')
                    }
                    try { return String(v).trim() } catch { return '' }
                  }

                  const renderPairs = (obj: any) => {
                    if (!obj || typeof obj !== 'object') return null
                    const keys = Object.keys(obj || {})
                    const rows = keys
                      .map(k => ({ k, v: obj[k] }))
                      .map(it => ({ ...it, txt: formatValue(it.v) }))
                      .filter(it => !!it.txt)
                    if (!rows.length) return null
                    return (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {rows.map(({ k, txt }) => (
                          <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">{toLabel(k)}</div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-900">{txt}</div>
                          </div>
                        ))}
                      </div>
                    )
                  }

                  if (!prevLabEntryViewId) {
                    return (
                      <div className="space-y-3">
                        {prevLabEntries.map((h, idx) => {
                          const when = h.submittedAt || h.createdAt || ''
                          const dateTxt = when ? new Date(when).toLocaleString() : ''
                          return (
                            <div key={h._id || idx} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{sel?.patientName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {sel?.mrNo || '-'})</span></div>
                                <div className="mt-1 text-xs text-slate-600">Visit#{idx + 1}{dateTxt ? ` • ${dateTxt}` : ''}</div>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                                onClick={() => setPrevLabEntryViewId(String(h._id || ''))}
                              >
                                View
                              </button>
                            </div>
                          )
                        })}
                        {prevLabEntries.length === 0 && (
                          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">No previous lab entries found.</div>
                        )}
                      </div>
                    )
                  }

                  const tests = Array.isArray(selected?.tests) ? selected.tests : []
                  const labInformation = selected?.labInformation || {}
                  const semenAnalysis = selected?.semenAnalysis || {}

                  return (
                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{sel?.patientName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {sel?.mrNo || '-'})</span></div>
                          <div className="mt-1 text-xs text-slate-600">Entered By: {String(selected?.hxBy || '-')} • Entered On: {String(selected?.hxDate || '-')}</div>
                        </div>
                        <button type="button" className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50" onClick={() => setPrevLabEntryViewId('')}>Back</button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {renderPairs(labInformation) && (
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-800">Lab Information</div>
                            {renderPairs(labInformation)}
                          </div>
                        )}

                        {renderPairs(semenAnalysis) && (
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-800">Semen Analysis</div>
                            {renderPairs(semenAnalysis)}
                          </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-sm font-semibold text-slate-800">Tests</div>
                          {tests.length === 0 ? (
                            <div className="mt-2 text-sm text-slate-600">No tests</div>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="min-w-full border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-left text-xs text-slate-600">
                                    <th className="border border-slate-200 px-3 py-2">Test</th>
                                    <th className="border border-slate-200 px-3 py-2">Normal</th>
                                    <th className="border border-slate-200 px-3 py-2">Result</th>
                                    <th className="border border-slate-200 px-3 py-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tests.map((t: any, i: number) => (
                                    <tr key={i} className="text-slate-800">
                                      <td className="border border-slate-200 px-3 py-2">{String(t?.testName || '')}</td>
                                      <td className="border border-slate-200 px-3 py-2">{String(t?.normalValue || '')}</td>
                                      <td className="border border-slate-200 px-3 py-2">{String(t?.result || '')}</td>
                                      <td className="border border-slate-200 px-3 py-2">{String(t?.status || '')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {showPrevPrescriptionsDlg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 py-4 sm:px-4" onClick={() => setShowPrevPrescriptionsDlg(false)}>
            <div className="w-full max-w-4xl max-h-[96dvh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
                <div className="text-base font-semibold text-slate-900">Previous Prescriptions</div>
                <button
                  type="button"
                  className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setShowPrevPrescriptionsDlg(false)
                  }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="mb-2 text-sm font-semibold text-slate-800">Visits</div>
                <div className="space-y-3">
                  {prevPrescriptions.map((p, idx) => {
                    const when = p.createdAt || ''
                    const dateTxt = when ? new Date(when).toLocaleString() : ''
                    return (
                      <div key={p.id || idx} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{sel?.patientName || '-'} <span className="text-xs font-normal text-slate-500">(MR: {sel?.mrNo || '-'})</span></div>
                          <div className="mt-1 text-xs text-slate-600">Visit#{idx + 1}{dateTxt ? ` • ${dateTxt}` : ''}</div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                          onClick={() => openPreviousPrescriptionPdf(String(p.id || ''))}
                        >
                          Prescription PDF
                        </button>
                      </div>
                    )
                  })}
                  {prevPrescriptions.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">No previous prescriptions found.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {previousVisitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 py-4 sm:px-4" onClick={() => setPreviousVisitOpen(false)}>
            <div className="w-full max-w-5xl max-h-[96dvh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
                <div className="text-base font-semibold text-slate-900">Previous Visits</div>
                <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => setPreviousVisitOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Patient</div>
                    <div className="text-sm font-semibold text-slate-900">{sel?.patientName || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">MR#</div>
                    <div className="text-sm font-semibold text-slate-900">{sel?.mrNo || '-'}</div>
                  </div>
                </div>

                <div className="mt-4">
                  {previousVisitLoading && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">Loading...</div>
                  )}

                  {!previousVisitLoading && previousVisitError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{previousVisitError}</div>
                  )}

                  {!previousVisitLoading && !previousVisitError && previousVisits.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">No previous visits found.</div>
                  )}

                  <div className="mt-3 space-y-3">
                    {previousVisits.map((v, idx) => {
                      const dateTxt = v.createdAt ? new Date(v.createdAt).toLocaleString() : ''
                      const meds = Array.isArray(v.medicine) ? v.medicine.filter(m => String(m?.name || '').trim()) : []
                      const diag = Array.isArray(v.diagnosticTests) ? v.diagnosticTests.filter(Boolean) : []
                      const therapy = Array.isArray(v.therapyTests) ? v.therapyTests.filter(Boolean) : []
                      return (
                        <div key={v.id || idx} className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm font-semibold text-slate-900">Visit#{idx + 1}</div>
                            <div className="text-xs text-slate-500">{dateTxt}</div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="text-sm font-semibold text-slate-800">Prescription</div>
                              <div className="mt-2 space-y-1 text-sm text-slate-700">
                                {meds.length === 0 ? (
                                  <div className="text-xs text-slate-500">No prescription</div>
                                ) : (
                                  meds.map((m, mi) => (
                                    <div key={mi} className="rounded-md bg-white/70 px-2 py-1">
                                      <div className="font-medium">{String(m.name || '').trim()}</div>
                                      <div className="text-xs text-slate-600">
                                        {m.dose ? `Dose: ${m.dose}` : null}{m.dose && (m.frequency || m.duration) ? ' • ' : null}
                                        {m.frequency ? `Freq: ${m.frequency}` : null}{m.frequency && m.duration ? ' • ' : null}
                                        {m.duration ? `Dur: ${m.duration}` : null}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="text-sm font-semibold text-slate-800">Diagnostics</div>
                              <div className="mt-2 space-y-1 text-sm text-slate-700">
                                {diag.length === 0 && !v.diagnosticNotes ? (
                                  <div className="text-xs text-slate-500">No diagnostics</div>
                                ) : (
                                  <>
                                    {diag.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {diag.map((t, ti) => (
                                          <span key={ti} className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">{t}</span>
                                        ))}
                                      </div>
                                    )}
                                    {v.diagnosticNotes && (
                                      <div className="text-xs text-slate-600">{v.diagnosticNotes}</div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="text-sm font-semibold text-slate-800">Therapy</div>
                              <div className="mt-2 space-y-1 text-sm text-slate-700">
                                {therapy.length === 0 && !v.therapyNotes ? (
                                  <div className="text-xs text-slate-500">No therapy</div>
                                ) : (
                                  <>
                                    {therapy.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {therapy.map((t, ti) => (
                                          <span key={ti} className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">{t}</span>
                                        ))}
                                      </div>
                                    )}
                                    {v.therapyNotes && (
                                      <div className="text-xs text-slate-600">{v.therapyNotes}</div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700">Patient</label>
              <select
                value={form.patientKey}
                onChange={e => {
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
                {allPatients.length > 0 && allPatients.map(p => (
                  <option key={p.id} value={p.id}>T#{p.tokenNo} • {p.patientName} • {p.mrNo}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm text-slate-700">Hx by (History Taker)</label>
                  <input value={hxBy} disabled className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600" />
                </div>
                <div className="w-[170px]">
                  <label className="mb-1 block text-sm text-slate-700">Date</label>
                  <input type="date" value={hxDate} onChange={e => setHxDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
              <button type="button" onClick={() => goTab('labReportsEntry')} className={`px-3 py-2 text-sm ${activeTab === 'labReportsEntry' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Lab Reports Entry</button>
              <button type="button" onClick={() => goTab('labs')} className={`px-3 py-2 text-sm ${activeTab === 'labs' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Lab Orders</button>
              <button type="button" onClick={() => goTab('diagnostics')} className={`px-3 py-2 text-sm ${activeTab === 'diagnostics' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Diagnostic Orders</button>
              <button type="button" onClick={() => goTab('therapy')} className={`px-3 py-2 text-sm ${activeTab === 'therapy' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Therapy Orders</button>
              <button type="button" onClick={() => goTab('Medicine')} className={`px-3 py-2 text-sm ${activeTab === 'Medicine' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Medicine</button>
              <button type="button" onClick={() => goTab('Counselling')} className={`px-3 py-2 text-sm ${activeTab === 'Counselling' ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Counselling</button>
            </nav>
          </div>
          {activeTab === 'Personal Information' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Name</label>
                <input value={personalInfo.name} onChange={e => setPersonalInfo(p => ({ ...p, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">MR#</label>
                <input value={personalInfo.mrNo} onChange={e => setPersonalInfo(p => ({ ...p, mrNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Age</label>
                <input value={personalInfo.age} onChange={e => setPersonalInfo(p => ({ ...p, age: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">PT</label>
                <input value={personalInfo.pt} onChange={e => setPersonalInfo(p => ({ ...p, pt: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">MAM</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-slate-600">Upto:</div>
                  <input value={personalInfo.mamUpto} onChange={e => setPersonalInfo(p => ({ ...p, mamUpto: e.target.value }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  <div className="text-sm text-slate-600">Pn:</div>
                  <input value={personalInfo.mamPn} onChange={e => setPersonalInfo(p => ({ ...p, mamPn: e.target.value }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Visit/Stay</label>
                <input value={personalInfo.visitStay} onChange={e => setPersonalInfo(p => ({ ...p, visitStay: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Height</label>
                <input value={personalInfo.height} onChange={e => setPersonalInfo(p => ({ ...p, height: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Weight</label>
                <input value={personalInfo.weight} onChange={e => setPersonalInfo(p => ({ ...p, weight: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Blood Pressure (BP)</label>
                <input value={personalInfo.bp} onChange={e => setPersonalInfo(p => ({ ...p, bp: e.target.value }))} placeholder="e.g., 120/80" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Sleep (hrs)</label>
                <input value={personalInfo.sleepHrs} onChange={e => setPersonalInfo(p => ({ ...p, sleepHrs: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Contact#1</label>
                <input value={personalInfo.contact1} onChange={e => setPersonalInfo(p => ({ ...p, contact1: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Contact#2</label>
                <input value={personalInfo.contact2} onChange={e => setPersonalInfo(p => ({ ...p, contact2: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Walk/Exercise</label>
                <input value={personalInfo.walkExercise} onChange={e => setPersonalInfo(p => ({ ...p, walkExercise: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Education</label>
                <input value={personalInfo.education} onChange={e => setPersonalInfo(p => ({ ...p, education: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Job Hours</label>
                <input value={personalInfo.jobHours} onChange={e => setPersonalInfo(p => ({ ...p, jobHours: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Current Address</label>
                <textarea value={personalInfo.currentAddress} onChange={e => setPersonalInfo(p => ({ ...p, currentAddress: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Permanent Address</label>
                <textarea value={personalInfo.permanentAddress} onChange={e => setPersonalInfo(p => ({ ...p, permanentAddress: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Nature of Work</label>
                <textarea value={personalInfo.natureOfWork} onChange={e => setPersonalInfo(p => ({ ...p, natureOfWork: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div className="sm:col-span-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className={checkboxCardLabelCls(personalInfo.relax)}>
                    <input
                      type="checkbox"
                      checked={personalInfo.relax}
                      onChange={e => setPersonalInfo(p => ({ ...p, relax: e.target.checked, stressful: e.target.checked ? false : p.stressful }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Relax
                  </label>
                  <label className={checkboxCardLabelCls(personalInfo.stressful)}>
                    <input
                      type="checkbox"
                      checked={personalInfo.stressful}
                      onChange={e => setPersonalInfo(p => ({ ...p, stressful: e.target.checked, relax: e.target.checked ? false : p.relax }))}
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
                      onChange={(e) => setMaritalStatus(s => ({
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
                      onChange={(e) => setMaritalStatus(s => ({
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
                      onChange={(e) => setMaritalStatus(s => ({
                        ...s,
                        status: e.target.checked ? 'Single' : '',
                      }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Single
                  </label>
                </div>
              </div>

              {/* Show TimePeriod field when top-level To Go is selected */}
              {maritalStatus.status === 'To Go' && (
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Time Period</label>
                  <input
                    value={maritalStatus.timePeriod}
                    onChange={e => setMaritalStatus(s => ({ ...s, timePeriod: e.target.value }))}
                    placeholder="Enter time period"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

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
                                next.push({ ...emptyMarriage })
                                return { ...s, marriages: next }
                              })
                            }
                            className="rounded-md border border-blue-800 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50"
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
                            className="rounded-md border border-red-600 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* For additional marriages (idx > 0), show Married/To Go selection first */}
                      {idx > 0 && (
                        <div className="mb-4 grid gap-2 sm:grid-cols-2">
                          <label className={checkboxCardLabelCls(m.status === 'Married')}>
                            <input
                              type="checkbox"
                              checked={m.status === 'Married'}
                              onChange={(e) => setMaritalStatus(s => {
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], status: e.target.checked ? 'Married' : '' }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Married
                          </label>
                          <label className={checkboxCardLabelCls(m.status === 'To Go')}>
                            <input
                              type="checkbox"
                              checked={m.status === 'To Go'}
                              onChange={(e) => setMaritalStatus(s => {
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], status: e.target.checked ? 'To Go' : '' }
                                return { ...s, marriages: next }
                              })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            To Go
                          </label>
                        </div>
                      )}

                      {/* Show TimePeriod field for To Go marriages (idx > 0) */}
                      {idx > 0 && m.status === 'To Go' && (
                        <div className="mb-4">
                          <label className="mb-1 block text-sm text-slate-700">Time Period</label>
                          <input
                            value={m.timePeriod}
                            onChange={e => setMaritalStatus(s => {
                              const next = [...s.marriages]
                              next[idx] = { ...next[idx], timePeriod: e.target.value }
                              return { ...s, marriages: next }
                            })}
                            placeholder="Enter time period"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}

                      {/* Show full marriage form for first marriage OR when Married is selected for additional marriages */}
                      {(idx === 0 || m.status === 'Married') && (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm text-slate-700">Years/Months</label>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm text-slate-600">Year:</div>
                              <input
                                value={m.years}
                                onChange={e => setMaritalStatus(s => {
                                  const next = [...s.marriages]
                                  next[idx] = { ...next[idx], years: e.target.value }
                                  return { ...s, marriages: next }
                                })}
                                className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                              <div className="text-sm text-slate-600">Month:</div>
                              <input
                                value={m.months}
                                onChange={e => setMaritalStatus(s => {
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
                              onChange={e => setMaritalStatus(s => {
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
                              onChange={e => setMaritalStatus(s => {
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
                              onChange={e => setMaritalStatus(s => {
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
                              onChange={e => setMaritalStatus(s => {
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
                              onChange={e => setMaritalStatus(s => {
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
                                  onChange={(e) => setMaritalStatus(s => {
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
                                  onChange={(e) => setMaritalStatus(s => {
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
                                  onChange={(e) => setMaritalStatus(s => {
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
                              {(['Satisfactory', 'Non-Satisfactory'] as const).map(opt => (
                                <label key={opt} className={checkboxCardLabelCls(m.mutualSatisfaction === opt)}>
                                  <input
                                    type="checkbox"
                                    checked={m.mutualSatisfaction === opt}
                                    onChange={(e) => setMaritalStatus(s => {
                                      const next = [...s.marriages]
                                      next[idx] = { ...next[idx], mutualSatisfaction: e.target.checked ? opt : '' }
                                      return { ...s, marriages: next }
                                    })}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  {opt}
                                </label>
                              ))}
                              {(['Cooperative', 'Non Cooperative'] as const).map(opt => (
                                <label key={opt} className={checkboxCardLabelCls(m.mutualCooperation === opt)}>
                                  <input
                                    type="checkbox"
                                    checked={m.mutualCooperation === opt}
                                    onChange={(e) => setMaritalStatus(s => {
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
                              {(['No Plan', 'Trying'] as const).map(opt => (
                                <label key={opt} className={checkboxCardLabelCls(m.childStatus === opt)}>
                                  <input
                                    type="checkbox"
                                    checked={m.childStatus === opt}
                                    onChange={(e) => setMaritalStatus(s => {
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
                                  onChange={(e) => setMaritalStatus(s => {
                                    const next = [...s.marriages]
                                    const cs2 = { ...(next[idx] as any).childStatus2, minors: e.target.checked }
                                    if (!e.target.checked) { cs2.male = ''; cs2.female = '' }
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
                                  onChange={(e) => setMaritalStatus(s => {
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
                                  onChange={(e) => setMaritalStatus(s => {
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
                                  onChange={e => setMaritalStatus(s => {
                                    const next = [...s.marriages]
                                    next[idx] = { ...next[idx], childStatus2: { ...(next[idx] as any).childStatus2, male: e.target.value } }
                                    return { ...s, marriages: next }
                                  })}
                                  className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                                <div className="text-sm text-slate-600">Female</div>
                                <input
                                  value={m.childStatus2?.female || ''}
                                  onChange={e => setMaritalStatus(s => {
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
                      )}
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
                            onChange={(v) => { setMed(idx, 'name', v); searchMedicines(v) }}
                            suggestions={medNameSuggestions}
                            placeholder="Medicine name"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <SuggestField
                            as="input"
                            value={m.durationText || ''}
                            onChange={(v) => setMed(idx, 'durationText', v)}
                            onBlurValue={(v) => addOne('durationTag', v)}
                            suggestions={sugDuration}
                            placeholder="Duration"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <SuggestField
                            as="input"
                            value={m.qty || ''}
                            onChange={(v) => setMed(idx, 'qty', v)}
                            onBlurValue={(v) => addOne('dose', v)}
                            suggestions={sugDose}
                            placeholder="Dosage"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <SuggestField
                            as="input"
                            value={m.route || ''}
                            onChange={(v) => setMed(idx, 'route', v)}
                            onBlurValue={(v) => addOne('route', v)}
                            suggestions={sugRoute}
                            placeholder="Route"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <SuggestField
                            as="input"
                            value={m.freqText || ''}
                            onChange={(v) => setMed(idx, 'freqText', v)}
                            onBlurValue={(v) => addOne('frequencyTag', v)}
                            suggestions={sugFreq}
                            placeholder="Frequency"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-1">
                          <SuggestField
                            as="input"
                            value={m.instruction || ''}
                            onChange={(v) => setMed(idx, 'instruction', v)}
                            onBlurValue={(v) => addOne('instruction', v)}
                            suggestions={sugInstr}
                            placeholder="Instruction"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => removeAt(idx)}
                          className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
                          title="Remove"
                          disabled={form.meds.length <= 1}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => addAfter(idx)}
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
                  {(['Successful', 'Faild'] as const).map(opt => (
                    <label key={opt} className={checkboxCardLabelCls(coitus.intercourse === opt)}>
                      <input
                        type="checkbox"
                        checked={coitus.intercourse === opt}
                        onChange={(e) => setCoitus(s => ({ ...s, intercourse: e.target.checked ? opt : '' }))}
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
                  {(['Together', 'Out of Town'] as const).map(opt => (
                    <label key={opt} className={checkboxCardLabelCls(coitus.partnerLiving === opt)}>
                      <input
                        type="checkbox"
                        checked={coitus.partnerLiving === opt}
                        onChange={(e) => setCoitus(s => (
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
                      <input value={coitus.visitHomeMonths} onChange={e => setCoitus(s => ({ ...s, visitHomeMonths: e.target.value }))} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      <div className="text-sm text-slate-600">for(days):</div>
                      <input value={coitus.visitHomeDays} onChange={e => setCoitus(s => ({ ...s, visitHomeDays: e.target.value }))} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 block text-sm font-semibold text-slate-800">Coitus Frequency</div>
                <div className="flex flex-wrap items-center gap-6">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={coitus.frequencyType === opt}
                        onChange={(e) => setCoitus(s => ({ ...s, frequencyType: e.target.checked ? opt : '' }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Frequency (number)</label>
                    <input value={coitus.frequencyNumber} onChange={e => setCoitus(s => ({ ...s, frequencyNumber: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Since</label>
                    <input value={coitus.since} onChange={e => setCoitus(s => ({ ...s, since: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">Previous Coitus Frequency</label>
                <input value={coitus.previousFrequency} onChange={e => setCoitus(s => ({ ...s, previousFrequency: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {activeTab === 'Health' && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Health</div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddConditionInputs([''])
                      setIsAddConditionDialogOpen(true)
                    }}
                    className="inline-flex items-center gap-2 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                    title="Add Condition"
                  >
                    <Plus className="h-4 w-4" />
                    Add Condition
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Default Health Conditions (not hidden) */}
                  {defaultHealthConditions
                    .filter(c => !hiddenHealthConditionsSet.has(String(c || '')))
                    .map(c => {
                      const checked = health.selectedConditions.includes(c)
                      return (
                        <div key={c} className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleHealthCondition(c)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {c}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmItem({ type: 'default', value: c })
                              setIsDeleteConfirmOpen(true)
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}

                  {/* Custom Health Conditions */}
                  {customHealthConditions
                    .filter(c => !(defaultHealthConditions as readonly string[]).includes(c))
                    .map(c => {
                      const checked = health.selectedConditions.includes(c)
                      return (
                        <div key={`custom-${c}`} className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleHealthCondition(c)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {c}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmItem({ type: 'custom', value: c })
                              setIsDeleteConfirmOpen(true)
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                </div>

                {/* Hidden conditions can be restored */}
                {hiddenHealthConditions.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs text-slate-500">Hidden conditions (click to restore):</div>
                    <div className="flex flex-wrap gap-2">
                      {hiddenHealthConditions.map(c => (
                        <button
                          key={`hidden-${c}`}
                          type="button"
                          onClick={() => setHiddenHealthConditions(prev => prev.filter(x => x !== c))}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          + {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Condition Dialog */}
              {isAddConditionDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-800">Add Health Conditions</h3>
                      <button
                        type="button"
                        onClick={() => setIsAddConditionDialogOpen(false)}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        ×
                      </button>
                    </div>
                    <div className="max-h-96 space-y-3 overflow-y-auto">
                      {addConditionInputs.map((input, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            value={input}
                            onChange={e => {
                              const newInputs = [...addConditionInputs]
                              newInputs[idx] = e.target.value
                              setAddConditionInputs(newInputs)
                            }}
                            placeholder={`Condition ${idx + 1}`}
                            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newInputs = addConditionInputs.filter((_, i) => i !== idx)
                              setAddConditionInputs(newInputs.length ? newInputs : [''])
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setAddConditionInputs([...addConditionInputs, ''])}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                        Add More
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddConditionDialogOpen(false)}
                          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addConditionInputs.forEach(v => {
                              if (v.trim()) addHealthCondition(v.trim(), false)
                            })
                            setIsAddConditionDialogOpen(false)
                          }}
                          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                        >
                          Add All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Dialog */}
              {isDeleteConfirmOpen && deleteConfirmItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-800">Confirm Delete</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Are you sure you want to permanently delete <strong>"{deleteConfirmItem.value}"</strong>?
                      </p>
                      {deleteConfirmItem.type === 'default' && (
                        <p className="mt-1 text-xs text-slate-500">
                          This will hide the default condition. You can restore it later.
                        </p>
                      )}
                      {deleteConfirmItem.type === 'custom' && (
                        <p className="mt-1 text-xs text-rose-600">
                          This custom condition will be permanently deleted.
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirmOpen(false)}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (deleteConfirmItem.type === 'default') {
                            setHiddenHealthConditions(prev => [...prev, deleteConfirmItem.value])
                          } else {
                            setCustomHealthConditions(prev => prev.filter(x => x !== deleteConfirmItem.value))
                            removeHealthCondition(deleteConfirmItem.value)
                          }
                          setIsDeleteConfirmOpen(false)
                          setDeleteConfirmItem(null)
                        }}
                        className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Diabetes</div>
                <div className="mt-2 flex flex-wrap items-center gap-6">
                  {(['me', 'father', 'mother'] as const).map(k => (
                    <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={health.diabetes[k] as boolean}
                        onChange={e => setHealth(s => ({ ...s, diabetes: { ...s.diabetes, [k]: e.target.checked } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {k === 'me' ? 'Me' : k === 'father' ? 'Father' : 'Mother'}
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Since</label>
                    <input value={health.diabetes.since} onChange={e => setHealth(s => ({ ...s, diabetes: { ...s.diabetes, since: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Medicine Taking</label>
                    <input value={health.diabetes.medicineTaking} onChange={e => setHealth(s => ({ ...s, diabetes: { ...s.diabetes, medicineTaking: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Hypertension</div>
                <div className="mt-2 flex flex-wrap items-center gap-6">
                  {(['me', 'father', 'mother'] as const).map(k => (
                    <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={health.hypertension[k] as boolean}
                        onChange={e => setHealth(s => ({ ...s, hypertension: { ...s.hypertension, [k]: e.target.checked } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {k === 'me' ? 'Me' : k === 'father' ? 'Father' : 'Mother'}
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Since</label>
                    <input value={health.hypertension.since} onChange={e => setHealth(s => ({ ...s, hypertension: { ...s.hypertension, since: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Medicine Taking</label>
                    <input value={health.hypertension.medicineTaking} onChange={e => setHealth(s => ({ ...s, hypertension: { ...s.hypertension, medicineTaking: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Drug History</div>
                <div className="mt-2 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={health.drugHistory.wine} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, wine: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Wine
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={health.drugHistory.weed} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, weed: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Weed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={health.drugHistory.tobacco} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, tobacco: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Tobacco
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={health.drugHistory.gutka} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, gutka: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Gutka
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={health.drugHistory.naswar} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, naswar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Naswar
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={health.drugHistory.pan} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, pan: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Pan
                  </label>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Other</label>
                    <input value={health.drugHistory.other} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Quit</label>
                    <input value={health.drugHistory.quit} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, quit: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Smoking</div>
                <div className="mt-2 flex flex-wrap items-center gap-6">
                  {(['Yes', 'No'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={health.smoking.status === opt}
                        onChange={(e) => setHealth(s => (
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
                        <input value={health.smoking.since} onChange={e => setHealth(s => ({ ...s, smoking: { ...s.smoking, since: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Quit</label>
                        <input value={health.smoking.quit} onChange={e => setHealth(s => ({ ...s, smoking: { ...s.smoking, quit: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 block text-sm text-slate-700">Quantity of Cigerrete (Daily)</div>
                      <div className="flex flex-wrap items-center gap-6">
                        {(['Packs', 'Units'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={health.smoking.quantityUnit === opt}
                              onChange={(e) => setHealth(s => ({ ...s, smoking: { ...s.smoking, quantityUnit: e.target.checked ? opt : '' } }))}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {opt}
                          </label>
                        ))}
                        <input
                          value={health.smoking.quantityNumber}
                          onChange={e => setHealth(s => ({ ...s, smoking: { ...s.smoking, quantityNumber: e.target.value } }))}
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
                    <input value={sexualHistory.erection.percentage} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, percentage: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Since</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input value={sexualHistory.erection.sinceValue} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                      {(['Year', 'Month', 'Week', 'Day'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={sexualHistory.erection.sinceUnit === opt} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className={checkboxCardLabelCls(sexualHistory.erection.prePeni)}>
                    <input type="checkbox" checked={sexualHistory.erection.prePeni} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, prePeni: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Pre peni
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.erection.postPeni)}>
                    <input type="checkbox" checked={sexualHistory.erection.postPeni} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, postPeni: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Post peni
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-800">e/? EJ</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Yes', 'No'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={sexualHistory.erection.ej === opt} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, ej: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-800">e/? med</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Yes', 'No'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={sexualHistory.erection.med === opt} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, med: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.erection.other} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Experiences</div>

                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-800">Pre-Marriage</div>
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.preMarriage.gf} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, gf: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        GF
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.preMarriage.male} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, male: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        Male
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.preMarriage.pros} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, pros: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        Pros
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.preMarriage.mb} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, mb: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        MB
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={!!sexualHistory.experiences.preMarriage.multipleP} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, multipleP: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        Multiple.P
                      </label>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold text-slate-800">Number of Experiences</div>
                      <div className="flex flex-wrap items-center gap-6">
                        {(['Once', 'Multiple'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={sexualHistory.experiences.preMarriage.multipleOrOnce === opt} onChange={(e) => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, multipleOrOnce: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-1 block text-sm text-slate-700">Others</label>
                      <input value={sexualHistory.experiences.preMarriage.other} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, other: e.target.value } } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-800">Post Marriage</div>
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.postMarriage.gf} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, gf: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        GF
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.postMarriage.male} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, male: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        Male
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.postMarriage.pros} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, pros: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        Pros
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.experiences.postMarriage.mb} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, mb: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        MB
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={!!sexualHistory.experiences.postMarriage.multipleP} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, multipleP: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                        Multiple.P
                      </label>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold text-slate-800">Number of Experiences</div>
                      <div className="flex flex-wrap items-center gap-6">
                        {(['Once', 'Multiple'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={sexualHistory.experiences.postMarriage.multipleOrOnce === opt} onChange={(e) => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, multipleOrOnce: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-1 block text-sm text-slate-700">Others</label>
                      <input value={sexualHistory.experiences.postMarriage.other} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, other: e.target.value } } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">NPT</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['OK', 'NIL', 'RARE'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={sexualHistory.npt.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                      {opt}
                    </label>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Erection(%)</label>
                    <input value={sexualHistory.npt.erectionPercentage} onChange={e => setSexualHistory(s => ({ ...s, npt: { ...s.npt, erectionPercentage: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Since</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input value={sexualHistory.npt.sinceValue} onChange={e => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Year'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Year' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        Year
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Month'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Month' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        Month
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Week'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Week' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        Week
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Day'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Day' : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        Day
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.npt.other} onChange={e => setSexualHistory(s => ({ ...s, npt: { ...s.npt, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-800">Desire</div>
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    {(['Yes', 'No'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.desire.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, desire: { ...s.desire, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        {opt}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Other</label>
                    <input value={sexualHistory.desire.other} onChange={e => setSexualHistory(s => ({ ...s, desire: { ...s.desire, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-800">Nightfall (NF)</div>
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    {(['Yes', 'No'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={sexualHistory.nightfall.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, nightfall: { ...s.nightfall, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300" />
                        {opt}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Other</label>
                    <input value={sexualHistory.nightfall.other} onChange={e => setSexualHistory(s => ({ ...s, nightfall: { ...s.nightfall, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">PE</div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    {/* Pre Checkbox and Fields */}
                    <label className={checkboxCardLabelCls(sexualHistory.pe.pre)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pe.pre}
                        onChange={(e) => setSexualHistory(s => ({
                          ...s,
                          pe: {
                            ...s.pe,
                            pre: e.target.checked,
                            preValue: e.target.checked ? s.pe.preValue : '',
                            preUnit: e.target.checked ? s.pe.preUnit : '',
                          },
                        }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Pre
                    </label>

                    {sexualHistory.pe.pre && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <input
                          value={sexualHistory.pe.preValue}
                          onChange={e => setSexualHistory(s => ({ ...s, pe: { ...s.pe, preValue: e.target.value } }))}
                          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="#"
                        />
                        {(['Sec', 'JK', 'Min'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={sexualHistory.pe.preUnit === opt}
                              onChange={(e) => setSexualHistory(s => ({ ...s, pe: { ...s.pe, preUnit: e.target.checked ? opt : '' } }))}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Just Checkbox and Fields */}
                    <label className={checkboxCardLabelCls(sexualHistory.pe.just)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pe.just}
                        onChange={(e) => setSexualHistory(s => ({
                          ...s,
                          pe: {
                            ...s.pe,
                            just: e.target.checked,
                            justValue: e.target.checked ? s.pe.justValue : '',
                            justUnit: e.target.checked ? s.pe.justUnit : '',
                          },
                        }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Just
                    </label>

                    {sexualHistory.pe.just && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <input
                          value={sexualHistory.pe.justValue}
                          onChange={e => setSexualHistory(s => ({ ...s, pe: { ...s.pe, justValue: e.target.value } }))}
                          className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="#"
                        />
                        {(['Sec', 'JK', 'Min'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={sexualHistory.pe.justUnit === opt}
                              onChange={(e) => setSexualHistory(s => ({ ...s, pe: { ...s.pe, justUnit: e.target.checked ? opt : '' } }))}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Since</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input value={sexualHistory.pe.sinceValue} onChange={e => setSexualHistory(s => ({ ...s, pe: { ...s.pe, sinceValue: e.target.value } }))} className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#" />
                      {(['Year', 'Month', 'Week', 'Day'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={sexualHistory.pe.sinceUnit === opt}
                            onChange={(e) => setSexualHistory(s => ({ ...s, pe: { ...s.pe, sinceUnit: e.target.checked ? opt : '' } }))}
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
                  <input value={sexualHistory.pe.other} onChange={e => setSexualHistory(s => ({ ...s, pe: { ...s.pe, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">P.Fluid</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className={checkboxCardLabelCls(sexualHistory.pFluid.foreplay)}>
                    <input type="checkbox" checked={sexualHistory.pFluid.foreplay} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, foreplay: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Foreplay
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.pFluid.phonixSex)}>
                    <input type="checkbox" checked={sexualHistory.pFluid.phonixSex} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, phonixSex: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Phonix Sex
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.pFluid.onThoughts)}>
                    <input type="checkbox" checked={sexualHistory.pFluid.onThoughts} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, onThoughts: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    On Thoughts
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.pFluid.pornAddiction)}>
                    <input type="checkbox" checked={sexualHistory.pFluid.pornAddiction} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, pornAddiction: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Porn Addiction
                  </label>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.pFluid.other} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Status</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={checkboxCardLabelCls(sexualHistory.pFluid.status.noIssue)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pFluid.status.noIssue}
                        onChange={(e) => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, status: { ...s.pFluid.status, noIssue: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      No issue
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.pFluid.status.erDown)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pFluid.status.erDown}
                        onChange={(e) => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, status: { ...s.pFluid.status, erDown: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      ER↓
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.pFluid.status.weakness)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.pFluid.status.weakness}
                        onChange={(e) => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, status: { ...s.pFluid.status, weakness: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Weakness
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">UD</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['Yes', 'No'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={sexualHistory.ud.status === opt}
                        onChange={(e) => setSexualHistory(s => ({ ...s, ud: { ...s.ud, status: e.target.checked ? opt : '' } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.ud.other} onChange={e => setSexualHistory(s => ({ ...s, ud: { ...s.ud, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">P.Size</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label className={checkboxCardLabelCls(sexualHistory.pSize.bent)}>
                    <input
                      type="checkbox"
                      checked={sexualHistory.pSize.bent}
                      onChange={(e) => setSexualHistory(s => ({
                        ...s,
                        pSize: {
                          ...s.pSize,
                          bent: e.target.checked,
                          bentLeft: e.target.checked ? s.pSize.bentLeft : false,
                          bentRight: e.target.checked ? s.pSize.bentRight : false,
                        },
                      }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Bent
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.pSize.small)}>
                    <input
                      type="checkbox"
                      checked={sexualHistory.pSize.small}
                      onChange={(e) => setSexualHistory(s => ({
                        ...s,
                        pSize: {
                          ...s.pSize,
                          small: e.target.checked,
                          smallHead: e.target.checked ? s.pSize.smallHead : false,
                          smallBody: e.target.checked ? s.pSize.smallBody : false,
                          smallTip: e.target.checked ? s.pSize.smallTip : false,
                          smallMid: e.target.checked ? s.pSize.smallMid : false,
                          smallBase: e.target.checked ? s.pSize.smallBase : false,
                        },
                      }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Small
                  </label>
                  <label className={checkboxCardLabelCls(sexualHistory.pSize.shrink)}>
                    <input
                      type="checkbox"
                      checked={sexualHistory.pSize.shrink}
                      onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, shrink: e.target.checked } }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Shrink
                  </label>
                </div>

                {sexualHistory.pSize.bent && (
                  <div className="mt-3">
                    <div className="text-sm text-slate-600 mb-2">Bent Side</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.bentLeft)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.bentLeft}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, bentLeft: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Left
                      </label>
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.bentRight)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.bentRight}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, bentRight: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Right
                      </label>
                    </div>
                  </div>
                )}

                {sexualHistory.pSize.small && (
                  <div className="mt-3">
                    <div className="text-sm text-slate-600 mb-2">Part</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.smallHead)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.smallHead}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, smallHead: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Head
                      </label>
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.smallBody)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.smallBody}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, smallBody: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Body
                      </label>
                    </div>
                  </div>
                )}

                {sexualHistory.pSize.shrink && (
                  <div className="mt-3">
                    <div className="text-sm text-slate-600 mb-2">Section</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.smallTip)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.smallTip}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, smallTip: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Tip
                      </label>
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.smallMid)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.smallMid}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, smallMid: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Mid
                      </label>
                      <label className={checkboxCardLabelCls(sexualHistory.pSize.smallBase)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.smallBase}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, smallBase: e.target.checked } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Base
                      </label>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Boeing</div>
                  <div className="grid gap-2 grid-cols-2">
                    {(['Yes', 'No'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.pSize.boeing === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.pSize.boeing === opt}
                          onChange={(e) => setSexualHistory(s => ({ ...s, pSize: { ...s.pSize, boeing: e.target.checked ? opt : '' } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">On-Examine (OE)</div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Muscles</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={checkboxCardLabelCls(sexualHistory.oeMuscle.ok)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oeMuscle.ok}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oeMuscle: { ...s.oeMuscle, ok: e.target.checked } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      OK
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.oeMuscle.semi)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oeMuscle.semi}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oeMuscle: { ...s.oeMuscle, semi: e.target.checked } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Semi
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.oeMuscle.fl)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oeMuscle.fl}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oeMuscle: { ...s.oeMuscle, fl: e.target.checked } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      FL
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Disease</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={checkboxCardLabelCls(sexualHistory.oe.disease.peyronie)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oe.disease.peyronie}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, disease: { ...s.oe.disease, peyronie: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Peyronie
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.oe.disease.calcification)}>
                      <input
                        type="checkbox"
                        checked={sexualHistory.oe.disease.calcification}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, disease: { ...s.oe.disease, calcification: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Calcification
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-700">Testes</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Atrophic', 'Normal'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.testes.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oe.testes.status === opt}
                          onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, testes: { ...s.oe.testes, status: e.target.checked ? opt : '' } } }))}
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
                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.epidCst.right)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.epidCst.right}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, epidCst: { ...s.oe.epidCst, right: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Right
                    </label>
                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.epidCst.left)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.epidCst.left}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, epidCst: { ...s.oe.epidCst, left: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Left
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-700">Varicocle</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.varicocele.right)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.varicocele.right}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, varicocele: { ...s.oe.varicocele, right: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Right
                    </label>
                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.varicocele.left)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.varicocele.left}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, varicocele: { ...s.oe.varicocele, left: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Left
                    </label>
                  </div>



                  {!!sexualHistory.oe.varicocele.right && (
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      <div className="text-xs font-semibold text-slate-600">Right Grades:</div>
                      {(['G1', 'G2', 'G3'] as const).map(g => (
                        <label key={'right_' + g} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!(sexualHistory.oe.varicocele.rightGrades as any)[g.toLowerCase()]}
                            onChange={(e) => setSexualHistory(s => ({
                              ...s,
                              oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  rightGrades: { ...s.oe.varicocele.rightGrades, [g.toLowerCase()]: e.target.checked },
                                },
                              },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  )}

                  {!!sexualHistory.oe.varicocele.left && (
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      <div className="text-xs font-semibold text-slate-600">Left Grades:</div>
                      {(['G1', 'G2', 'G3'] as const).map(g => (
                        <label key={'left_' + g} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!(sexualHistory.oe.varicocele.leftGrades as any)[g.toLowerCase()]}
                            onChange={(e) => setSexualHistory(s => ({
                              ...s,
                              oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  leftGrades: { ...s.oe.varicocele.leftGrades, [g.toLowerCase()]: e.target.checked },
                                },
                              },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-slate-800">US/S</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Yes', 'No'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.uss.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.uss.status === opt}
                          onChange={(e) => setSexualHistory(s => ({ ...s, uss: { ...s.uss, status: e.target.checked ? opt : '' } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Other</label>
                    <input value={sexualHistory.uss.other} onChange={e => setSexualHistory(s => ({ ...s, uss: { ...s.uss, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">INF</div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Sexuality</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['OK', 'Disturbed'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.inf.sexuality.status === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.inf.sexuality.status === opt}
                          onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, sexuality: { ...s.inf.sexuality, status: e.target.checked ? opt : '' } } }))}
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
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.azos} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, azos: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Azos
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.oligo)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.oligo} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, oligo: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Oligo
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.terato)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.terato} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, terato: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Terato
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.diagnosis.astheno)}>
                      <input type="checkbox" checked={sexualHistory.inf.diagnosis.astheno} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, diagnosis: { ...s.inf.diagnosis, astheno: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Astheno
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-slate-700">Problems</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={checkboxCardLabelCls(sexualHistory.inf.problems.magi)}>
                      <input type="checkbox" checked={sexualHistory.inf.problems.magi} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, problems: { ...s.inf.problems, magi: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      MAGI
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.problems.cystitis)}>
                      <input type="checkbox" checked={sexualHistory.inf.problems.cystitis} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, problems: { ...s.inf.problems, cystitis: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Cystitis
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.inf.problems.balanitis)}>
                      <input type="checkbox" checked={sexualHistory.inf.problems.balanitis} onChange={(e) => setSexualHistory(s => ({ ...s, inf: { ...s.inf, problems: { ...s.inf.problems, balanitis: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300" />
                      Balanitis
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Others</label>
                  <textarea value={sexualHistory.inf.others} onChange={e => setSexualHistory(s => ({ ...s, inf: { ...s.inf, others: e.target.value } }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                    <textarea value={previousMedicalHistory.exConsultation} onChange={e => setPreviousMedicalHistory(s => ({ ...s, exConsultation: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm text-slate-700">Ex Rx. (Ex-Treatment)</label>
                    <textarea value={previousMedicalHistory.exRx} onChange={e => setPreviousMedicalHistory(s => ({ ...s, exRx: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Cause</label>
                  <textarea value={previousMedicalHistory.cause} onChange={e => setPreviousMedicalHistory(s => ({ ...s, cause: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Arrival Reference' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Referred by</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['Doctor', 'Friend'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={arrivalReference.referredBy.status === opt}
                        onChange={(e) => setArrivalReference(s => ({ ...s, referredBy: { ...s.referredBy, status: e.target.checked ? opt : '' } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={arrivalReference.referredBy.other} onChange={e => setArrivalReference(s => ({ ...s, referredBy: { ...s.referredBy, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Ads. (Social Media)</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.adsSocialMedia.youtube} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, youtube: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Youtube
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.adsSocialMedia.google} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, google: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Google
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.adsSocialMedia.facebook} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, facebook: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Facebook
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.adsSocialMedia.instagram} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, instagram: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Instagram
                  </label>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={arrivalReference.adsSocialMedia.other} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, other: e.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
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
                    <input type="checkbox" checked={arrivalReference.appearOnKeyword.drAslamNaveed} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, drAslamNaveed: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Dr. Aslam Naveed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.appearOnKeyword.drMujahidFarooq} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, drMujahidFarooq: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Dr. Mujahid Farooq
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.appearOnKeyword.mensCareClinic} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, mensCareClinic: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Men's Care Clinic
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.appearOnKeyword.olaDoc} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, olaDoc: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Ola Doc
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={arrivalReference.appearOnKeyword.marham} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, marham: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    Marham
                  </label>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'diagnostics' && (
            <div>
              <PrescriptionDiagnosticOrders
                ref={diagRef}
                doctorId={doc?.id}
                initialTestsText={(form as any).diagDisplay?.testsText}
                initialNotes={(form as any).diagDisplay?.notes}
                initialDiscount={(form as any).diagDisplay?.discount}
                suggestionsNotes={sugDiagNotes}
              />
            </div>
          )}
          {activeTab === 'labReportsEntry' && (
            <div className="space-y-4">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Reports Entered by</label>
                    <input
                      value={labReportsHxBy}
                      onChange={(e) => setLabReportsHxBy(e.target.value)}
                      placeholder="Enter name..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Reports Entered on</label>
                    <input type="date" value={labReportsHxDate} onChange={e => setLabReportsHxDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-800">Lab Information</div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Lab Name</label>
                      <input
                        value={labReportsLabInformation.labName}
                        onChange={e => setLabReportsLabInformation(s => ({ ...s, labName: e.target.value }))}
                        placeholder="Lab Name"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">MR#</label>
                      <input
                        value={labReportsLabInformation.mrNo}
                        onChange={e => setLabReportsLabInformation(s => ({ ...s, mrNo: e.target.value }))}
                        placeholder="MR#"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Date</label>
                      <input
                        type="date"
                        value={labReportsLabInformation.date}
                        onChange={e => setLabReportsLabInformation(s => ({ ...s, date: e.target.value }))}
                        placeholder="Date"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-800">Semen Analysis</div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SEMEN_FIELDS.map(f => (
                      <div key={String(f.key)}>
                        <label className="mb-1 block text-sm text-slate-700">{f.label}</label>
                        <input
                          type={f.key === 'date' ? 'date' : 'text'}
                          value={labReportsSemenAnalysis[f.key]}
                          onChange={e => setLabReportsSemenAnalysis(s => ({ ...s, [f.key]: e.target.value }))}
                          placeholder={f.label}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800">Lab Tests</div>
                    <div />
                  </div>

                  <div className="mt-4 space-y-3">
                    {labReportsTests.map((row, idx) => (
                      <div key={idx}>
                        <div className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5">
                          <div className="lg:col-span-2">
                            <label className="mb-1 block text-sm text-slate-700">Test Name</label>
                            <SuggestField
                              value={row.testName}
                              onChange={(v: string) =>
                                setLabReportsTests(s =>
                                  s.map((x, i) => {
                                    if (i !== idx) return x
                                    const prevKey = normalizeTestNameKey(x.testName)
                                    const nextKey = normalizeTestNameKey(v)

                                    const prevMapped = prevKey ? NORMAL_RANGES[prevKey] : undefined
                                    const nextMapped = nextKey ? NORMAL_RANGES[nextKey] : undefined

                                    const normalTrim = (x.normalValue || '').trim()
                                    const canAutoOverwrite = !normalTrim || (!!prevMapped && normalTrim === prevMapped)
                                    const nextNormal = (canAutoOverwrite && nextMapped) ? nextMapped : x.normalValue

                                    return { ...x, testName: v, normalValue: nextNormal }
                                  })
                                )
                              }
                              suggestions={TEST_SUGGESTIONS}
                              maxSuggestions={50}
                              placeholder="Select or type test name"
                              as="input"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm text-slate-700">Normal Value</label>
                            <input
                              value={row.normalValue}
                              onChange={e => setLabReportsTests(s => s.map((x, i) => (i === idx ? { ...x, normalValue: e.target.value } : x)))}
                              placeholder="Auto-filled (editable)"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm text-slate-700">Result</label>
                            <input
                              value={row.result}
                              onChange={e => setLabReportsTests(s => s.map((x, i) => (i === idx ? { ...x, result: e.target.value } : x)))}
                              placeholder="Enter result"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm text-slate-700">Flag/Status</label>
                            <SuggestField
                              value={row.status}
                              onChange={(v: string) => setLabReportsTests(s => s.map((x, i) => (i === idx ? { ...x, status: v } : x)))}
                              suggestions={STATUS_SUGGESTIONS}
                              maxSuggestions={10}
                              placeholder="Select status"
                              as="input"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setLabReportsTests(s => [...s, { testName: '', normalValue: '', result: '', status: '' }])}
                            className="inline-flex items-center justify-center rounded-md border border-blue-800 px-2.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                            title="Add"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLabReportsTests(s => (s.length === 1 ? s : s.filter((_, i) => i !== idx)))}
                            disabled={labReportsTests.length === 1}
                            className="inline-flex items-center justify-center rounded-md border border-rose-600 px-2.5 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'labs' && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Lab Orders</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsViewTemplatesDialogOpen(true)}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title="View Templates"
                    >
                      <Eye className="h-4 w-4" />
                      View Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddTemplateDialogOpen(true)}
                      className="inline-flex items-center gap-2 rounded-md border border-green-700 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
                      title="Add Template"
                    >
                      <BookmarkPlus className="h-4 w-4" />
                      Add Template
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLabOrderDraft('')
                        setIsLabOrderDialogOpen(true)
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                      title="Add Test"
                    >
                      <Plus className="h-4 w-4" />
                      Add Test
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {labQuickTests.filter(t => !hiddenLabQuickTestsSet.has(String(t || ''))).map(t => {
                    const checked = parseListText(form.labTestsText).includes(t)
                    return (
                      <div key={t} className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLabQuickTest(t)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">{t}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setLabOrderRemoveDialog({ kind: 'quick', name: t })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}

                  {customLabOrderTests
                    .filter(t => !(labQuickTests as readonly string[]).includes(t))
                    .map(t => {
                      const checked = parseListText(form.labTestsText).includes(t)
                      return (
                        <div key={`custom-${t}`} className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCustomLabTest(t)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">{t}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setLabOrderRemoveDialog({ kind: 'custom', name: t })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Lab Notes</label>
                <SuggestField rows={2} value={form.labNotes} onChange={v => setForm(f => ({ ...f, labNotes: v }))} suggestions={sugLabNotes} />
              </div>

              {isLabOrderDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">Add Lab Test</div>
                      <button
                        type="button"
                        onClick={() => setIsLabOrderDialogOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        title="Close"
                      >
                        <X className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Lab Test</label>
                      <input
                        value={labOrderDraft}
                        onChange={e => setLabOrderDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const v = labOrderDraft.trim()
                            if (!v) return
                            addLabTestChip(v)
                            addOne('lab.tests', v)
                            setIsLabOrderDialogOpen(false)
                            setLabOrderDraft('')
                          }
                        }}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Type lab test"
                        autoFocus
                      />
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLabOrderDialogOpen(false)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const v = labOrderDraft.trim()
                          if (!v) return
                          addLabTestChip(v)
                          addOne('lab.tests', v)
                          setIsLabOrderDialogOpen(false)
                          setLabOrderDraft('')
                        }}
                        className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {labOrderRemoveDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">Remove Lab Test</div>
                      <button
                        type="button"
                        onClick={() => setLabOrderRemoveDialog(null)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        title="Close"
                      >
                        <X className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>

                    <div className="text-sm text-slate-700">
                      Are you sure you want to remove <span className="font-semibold">{labOrderRemoveDialog.name}</span>?
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setLabOrderRemoveDialog(null)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = labOrderRemoveDialog
                          if (!d) return
                          if (d.kind === 'custom') {
                            saveCustomLabOrderTests(customLabOrderTests.filter(x => x !== d.name))
                            removeLabTestChip(d.name)
                          } else {
                            // Hide quick test permanently (per doctor)
                            saveHiddenLabQuickTests([...hiddenLabQuickTests, d.name])
                            // If selected, also uncheck/remove from current prescription list
                            setForm(f => {
                              const current = parseListText(f.labTestsText)
                              const next = current.filter(x => x !== d.name)
                              return { ...f, labTestsText: next.join('\n') }
                            })
                          }
                          setLabOrderRemoveDialog(null)
                        }}
                        className="rounded-md border border-rose-600 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'therapy' && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-800">Therapy Plan</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Months</label>
                    <SuggestField
                      as="input"
                      value={therapyPlan.months}
                      onChange={v => setTherapyPlan(s => ({ ...s, months: v }))}
                      suggestions={['1', '2', '3', '4']}
                      placeholder="For how many months..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Days</label>
                    <SuggestField
                      as="input"
                      value={therapyPlan.days}
                      onChange={v => setTherapyPlan(s => ({ ...s, days: v }))}
                      suggestions={['1', '2', '3', '4']}
                      placeholder="For how many days..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Packages</label>
                    <SuggestField
                      as="input"
                      value={therapyPlan.packages}
                      onChange={v => setTherapyPlan(s => ({ ...s, packages: v }))}
                      suggestions={['5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '65', '70', '75', '80', '85', '90', '95']}
                      maxSuggestions={50}
                      placeholder="Packages"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                  <div>Machines</div>
                  <button
                    type="button"
                    onClick={() => setIsTherapyMachineRestoreDialogOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Add"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div className="grid gap-2">
                  {!hiddenTherapyMachinesSet.has('chi') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.chi.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.chi.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              chi: e.target.checked ? { ...s.chi, enabled: true } : { enabled: false, pr: false, bk: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">CHi (R 2.5 Sp6, D 420 UB)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'chi', label: 'CHi (R 2.5 Sp6, D 420 UB)' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.chi.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.chi.pr} onChange={e => setTherapyMachines(s => ({ ...s, chi: { ...s.chi, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            PR
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.chi.bk} onChange={e => setTherapyMachines(s => ({ ...s, chi: { ...s.chi, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            BK
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('eswt') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.eswt.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.eswt.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              eswt: e.target.checked ? { ...s.eswt, enabled: true } : { enabled: false, v1000: false, v1500: false, v2000: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">ESWT (Repair)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'eswt', label: 'ESWT (Repair)' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.eswt.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.eswt.v1000} onChange={e => setTherapyMachines(s => ({ ...s, eswt: { ...s.eswt, v1000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            1000
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.eswt.v1500} onChange={e => setTherapyMachines(s => ({ ...s, eswt: { ...s.eswt, v1500: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            1500
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.eswt.v2000} onChange={e => setTherapyMachines(s => ({ ...s, eswt: { ...s.eswt, v2000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            2000
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('ms') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.ms.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.ms.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              ms: e.target.checked ? { ...s.ms, enabled: true } : { enabled: false, pr: false, bk: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">M/S (R 2.5 UB P)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'ms', label: 'M/S (R 2.5 UB P)' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.ms.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.ms.pr} onChange={e => setTherapyMachines(s => ({ ...s, ms: { ...s.ms, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            PR
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.ms.bk} onChange={e => setTherapyMachines(s => ({ ...s, ms: { ...s.ms, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            BK
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('mam') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.mam.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.mam.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              mam: e.target.checked ? { ...s.mam, enabled: true } : { enabled: false, m: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">MAM (CHCN)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'mam', label: 'MAM (CHCN)' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.mam.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.mam.m} onChange={e => setTherapyMachines(s => ({ ...s, mam: { ...s.mam, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            M
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('us') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.us.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.us.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              us: e.target.checked ? { ...s.us, enabled: true } : { enabled: false, pr: false, bk: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">U/S (R 2.5 UB P)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'us', label: 'U/S (R 2.5 UB P)' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.us.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.us.pr} onChange={e => setTherapyMachines(s => ({ ...s, us: { ...s.us, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            PR
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.us.bk} onChange={e => setTherapyMachines(s => ({ ...s, us: { ...s.us, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            BK
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('mcgSpg') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.mcgSpg.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.mcgSpg.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              mcgSpg: e.target.checked ? { ...s.mcgSpg, enabled: true } : { enabled: false, dashBar: false, equal: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">MCG SPG</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'mcgSpg', label: 'MCG SPG' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.mcgSpg.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.mcgSpg.dashBar} onChange={e => setTherapyMachines(s => ({ ...s, mcgSpg: { ...s.mcgSpg, dashBar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            --|
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.mcgSpg.equal} onChange={e => setTherapyMachines(s => ({ ...s, mcgSpg: { ...s.mcgSpg, equal: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            =
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('mproCryo') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.mproCryo.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.mproCryo.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              mproCryo: e.target.checked ? { ...s.mproCryo, enabled: true } : { enabled: false, m: false, c: false },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">Mpro Cryo</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'mproCryo', label: 'Mpro Cryo' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.mproCryo.enabled && (
                        <div className="ml-7 flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.mproCryo.m} onChange={e => setTherapyMachines(s => ({ ...s, mproCryo: { ...s.mproCryo, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            M
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={therapyMachines.mproCryo.c} onChange={e => setTherapyMachines(s => ({ ...s, mproCryo: { ...s.mproCryo, c: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                            C
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {!hiddenTherapyMachinesSet.has('ximen') && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className={`${checkboxCardLabelCls(therapyMachines.ximen.enabled)} flex-1`}>
                          <input
                            type="checkbox"
                            checked={therapyMachines.ximen.enabled}
                            onChange={e => setTherapyMachines(s => ({
                              ...s,
                              ximen: e.target.checked ? { ...s.ximen, enabled: true } : { enabled: false, note: '' },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="flex-1">XIMEN</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setTherapyMachineRemoveDialog({ kind: 'fixed', key: 'ximen', label: 'XIMEN' })}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {therapyMachines.ximen.enabled && (
                        <div className="ml-7">
                          <input
                            value={therapyMachines.ximen.note}
                            onChange={e => setTherapyMachines(s => ({ ...s, ximen: { ...s.ximen, note: e.target.value } }))}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Enter"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {customTherapyMachines.map(m => {
                    const st = customTherapyMachineState[m.id] || { enabled: false }
                    const checked = !!st.enabled
                    return (
                      <div key={m.id}>
                        <div className="flex items-center gap-2">
                          <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const enabled = e.target.checked
                                setCustomTherapyMachineState(s => {
                                  const next = { ...s }
                                  const cur = next[m.id] || {}
                                  next[m.id] = { ...cur, enabled }
                                  saveCustomTherapyMachines(customTherapyMachines, next)
                                  return next
                                })
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="flex-1">{m.name}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineRemoveDialog({ kind: 'custom', key: m.id, label: m.name })}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {checked && m.kind === 'checkboxes' && (
                          <div className="ml-7 flex flex-wrap items-center gap-6">
                            {(m.options || []).filter(Boolean).map(opt => {
                              const isChecked = !!st.checks?.[opt]
                              return (
                                <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      const v = e.target.checked
                                      setCustomTherapyMachineState(s => {
                                        const next = { ...s }
                                        const cur = next[m.id] || { enabled: true }
                                        const checks = { ...(cur.checks || {}) }
                                        checks[opt] = v
                                        next[m.id] = { ...cur, enabled: true, checks }
                                        saveCustomTherapyMachines(customTherapyMachines, next)
                                        return next
                                      })
                                    }}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  {opt}
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {checked && m.kind === 'fields' && (
                          <div className="ml-7 grid gap-2">
                            {(m.fields || []).filter(Boolean).map(fld => {
                              const val = st.fields?.[fld] || ''
                              return (
                                <div key={fld}>
                                  <label className="mb-1 block text-sm text-slate-700">{fld}</label>
                                  <input
                                    value={val}
                                    onChange={e => {
                                      const v = e.target.value
                                      setCustomTherapyMachineState(s => {
                                        const next = { ...s }
                                        const cur = next[m.id] || { enabled: true }
                                        const fields = { ...(cur.fields || {}) }
                                        fields[fld] = v
                                        next[m.id] = { ...cur, enabled: true, fields }
                                        saveCustomTherapyMachines(customTherapyMachines, next)
                                        return next
                                      })
                                    }}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Enter"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Therapy Notes</label>
                <SuggestField rows={2} value={(form as any).therapyNotes} onChange={v => setForm(f => ({ ...(f as any), therapyNotes: v }))} suggestions={sugTherapyNotes} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">Discount</label>
                <input
                  value={(form as any).therapyDiscount || ''}
                  onChange={(e) => setForm(f => ({ ...f as any, therapyDiscount: e.target.value }))}
                  placeholder="Enter discount"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {therapyMachineRemoveDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">Remove Machine</div>
                      <button
                        type="button"
                        onClick={() => setTherapyMachineRemoveDialog(null)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        title="Close"
                      >
                        <X className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>

                    <div className="text-sm text-slate-700">
                      Are you sure you want to remove <span className="font-semibold">{therapyMachineRemoveDialog.label}</span>?
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setTherapyMachineRemoveDialog(null)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = therapyMachineRemoveDialog
                          if (!d) return
                          if (d.kind === 'custom') {
                            const nextDefs = customTherapyMachines.filter(x => x.id !== d.key)
                            const nextState = { ...customTherapyMachineState }
                            delete nextState[d.key]
                            saveCustomTherapyMachines(nextDefs, nextState)
                          } else {
                            saveHiddenTherapyMachines([...hiddenTherapyMachines, d.key])
                            setTherapyMachines(s => ({ ...s, [d.key]: (getEmptyTherapyMachines() as any)[d.key] } as any))
                          }
                          setTherapyMachineRemoveDialog(null)
                        }}
                        className="rounded-md border border-rose-600 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isTherapyMachineRestoreDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">Add Machine</div>
                      <button
                        type="button"
                        onClick={() => setIsTherapyMachineRestoreDialogOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        title="Close"
                      >
                        <X className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-700">Machine Name</label>
                        <input
                          value={therapyMachineAddName}
                          onChange={e => setTherapyMachineAddName(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Enter machine name"
                        />
                      </div>

                      <div>
                        <div className="mb-2 text-sm font-semibold text-slate-800">Type</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setTherapyMachineAddKind('checkboxes')}
                            className={`rounded-md border px-3 py-2 text-sm ${therapyMachineAddKind === 'checkboxes' ? 'border-blue-800 text-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                          >
                            Checkboxes
                          </button>
                          <button
                            type="button"
                            onClick={() => setTherapyMachineAddKind('fields')}
                            className={`rounded-md border px-3 py-2 text-sm ${therapyMachineAddKind === 'fields' ? 'border-blue-800 text-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                          >
                            Fields
                          </button>
                        </div>
                      </div>

                      {therapyMachineAddKind === 'checkboxes' && (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-800">Checkbox Options</div>
                            <button
                              type="button"
                              onClick={() => setTherapyMachineAddOptions(s => [...s, ''])}
                              className="inline-flex items-center justify-center rounded-md border border-blue-800 px-2.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                              title="Add"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {therapyMachineAddOptions.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  value={opt}
                                  onChange={e => setTherapyMachineAddOptions(s => s.map((x, i) => (i === idx ? e.target.value : x)))}
                                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  placeholder="Option name"
                                />
                                <button
                                  type="button"
                                  onClick={() => setTherapyMachineAddOptions(s => (s.length <= 1 ? [''] : s.filter((_, i) => i !== idx)))}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                                  title="Remove"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {therapyMachineAddKind === 'fields' && (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-800">Fields</div>
                            <button
                              type="button"
                              onClick={() => setTherapyMachineAddFields(s => [...s, ''])}
                              className="inline-flex items-center justify-center rounded-md border border-blue-800 px-2.5 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                              title="Add"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {therapyMachineAddFields.map((fld, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  value={fld}
                                  onChange={e => setTherapyMachineAddFields(s => s.map((x, i) => (i === idx ? e.target.value : x)))}
                                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  placeholder="Field name"
                                />
                                <button
                                  type="button"
                                  onClick={() => setTherapyMachineAddFields(s => (s.length <= 1 ? [''] : s.filter((_, i) => i !== idx)))}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:border-rose-600 hover:bg-rose-50 hover:text-rose-600"
                                  title="Remove"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {hiddenTherapyMachines.length > 0 && (
                        <div>
                          <div className="mb-2 text-sm font-semibold text-slate-800">Restore Hidden Machines</div>
                          <div className="space-y-2">
                            {hiddenTherapyMachines.map(k => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  saveHiddenTherapyMachines(hiddenTherapyMachines.filter(x => x !== k))
                                  setIsTherapyMachineRestoreDialogOpen(false)
                                }}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {therapyMachineLabel(k)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTherapyMachineRestoreDialogOpen(false)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const name = String(therapyMachineAddName || '').trim()
                          if (!name) return
                          const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`

                          if (therapyMachineAddKind === 'checkboxes') {
                            const options = Array.from(new Set(therapyMachineAddOptions.map(s => String(s || '').trim()).filter(Boolean)))
                            const def = { id, name, kind: 'checkboxes' as const, options }
                            const nextDefs = [...customTherapyMachines, def]
                            const nextState = { ...customTherapyMachineState, [id]: { enabled: true, checks: {} as Record<string, boolean> } }
                            saveCustomTherapyMachines(nextDefs, nextState)
                          } else {
                            const fields = Array.from(new Set(therapyMachineAddFields.map(s => String(s || '').trim()).filter(Boolean)))
                            const def = { id, name, kind: 'fields' as const, fields }
                            const nextDefs = [...customTherapyMachines, def]
                            const nextState = { ...customTherapyMachineState, [id]: { enabled: true, fields: {} as Record<string, string> } }
                            saveCustomTherapyMachines(nextDefs, nextState)
                          }

                          setTherapyMachineAddName('')
                          setTherapyMachineAddKind('checkboxes')
                          setTherapyMachineAddOptions([''])
                          setTherapyMachineAddFields([''])
                          setIsTherapyMachineRestoreDialogOpen(false)
                        }}
                        className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Counselling' && (
            <div className="space-y-4">
              <div>
                <div className="mb-1 block text-sm text-slate-700">LCC</div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-4">
                    <label className={`${checkboxCardLabelCls(!!counselling.lcc)} w-full justify-start`}>
                      <input
                        type="checkbox"
                        checked={!!counselling.lcc}
                        onChange={(e) => setCounselling(s => ({
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
                      onChange={e => setCounselling(s => ({ ...s, lccMonth: e.target.value }))}
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
                          onChange={e => setCounselling(s => ({
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
                        onChange={e => setCounselling(s => ({ ...s, package: { ...s.package, d4Month: e.target.value } }))}
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
                          onChange={e => setCounselling(s => ({
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
                        onChange={e => setCounselling(s => ({ ...s, package: { ...s.package, r4Month: e.target.value } }))}
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
                  onChange={e => setCounselling(s => ({ ...s, note: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">Discount</label>
                <input
                  value={(form as any).counsellingDiscount || ''}
                  onChange={(e) => setForm(f => ({ ...f as any, counsellingDiscount: e.target.value }))}
                  placeholder="Enter discount"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={openPrint} className="btn-outline-navy w-full sm:w-auto">Print</button>
            <button type="button" onClick={resetForms} className="btn-outline-navy w-full sm:w-auto">Reset Forms</button>
            <button type="submit" className="btn w-full sm:w-auto">Save</button>
          </div>
          {saved && <div className="text-center text-sm text-emerald-600 sm:text-right">Saved</div>}
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
                <button onClick={() => setOpenReferral(false)} className="btn">Close</button>
              </div>
            </div>
            <div className="max-h-[85vh] overflow-y-auto p-3 sm:p-4">
              <Doctor_IpdReferralForm ref={referralFormRef} mrn={sel?.mrNo} doctor={{ id: doc?.id, name: doc?.name }} onSaved={() => setOpenReferral(false)} />
            </div>
          </div>
        </div>
      )}

      <PrescriptionPrint
        printId="prescription-print"
        doctor={{ name: doc?.name, specialization: doctorInfo?.specialization, qualification: doctorInfo?.qualification, departmentName: doctorInfo?.departmentName, phone: doctorInfo?.phone }}
        settings={settings}
        patient={{ name: sel?.patientName || '-', mrn: sel?.mrNo || '-', gender: pat?.gender, fatherName: pat?.fatherName, age: pat?.age, phone: pat?.phone, address: pat?.address }}
        historyTaking={{ personalInfo, maritalStatus, coitus, health, sexualHistory, previousMedicalHistory }}
        items={form.meds
          .filter(m => m.name?.trim())
          .map(m => ({
            name: m.name,
            frequency: ['morning', 'noon', 'evening', 'night'].map(k => (m as any)[k]).filter(Boolean).join('/ '),
            duration: m.days ? `${m.days} ${m.durationUnit || 'day(s)'}` : undefined,
            dose: m.qty ? String(m.qty) : undefined,
            instruction: m.instruction || undefined,
            route: m.route || undefined,
          }))}
        labTests={form.labTestsText.split(/\n|,/).map(s => s.trim()).filter(Boolean)}
        labNotes={form.labNotes}
        therapyTests={String((form as any).therapyTestsText || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)}
        therapyNotes={(form as any).therapyNotes}
        therapyDiscount={ (form as any).therapyDiscount || '0' }
        therapyPlan={therapyPlan}
        therapyMachines={therapyMachines}
        diagnosticTests={(diagRef.current?.getData?.()?.tests) || []}
        diagnosticNotes={(diagRef.current?.getData?.()?.notes) || ''}
        diagnosticDiscount={diagRef.current?.getData?.()?.discount || '0'}
        counselling={counselling}
        counsellingDiscount={(form as any).counsellingDiscount || '0'}
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

      <AddTemplateDialog
        open={isAddTemplateDialogOpen}
        onClose={() => setIsAddTemplateDialogOpen(false)}
        onSave={saveLabTemplate}
        doctorId={doc?.id || ''}
        availableTests={[...labQuickTests]}
        customTests={customLabOrderTests}
      />

      <ViewTemplatesDialog
        open={isViewTemplatesDialogOpen}
        onClose={() => setIsViewTemplatesDialogOpen(false)}
        templates={labTemplates}
        onApply={applyLabTemplate}
        onDelete={deleteLabTemplate}
        isLoading={isLoadingTemplates}
      />
    </div>
  )
}