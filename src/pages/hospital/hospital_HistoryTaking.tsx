import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { hospitalApi } from '../../utils/api'

type Token = {
  id: string
  tokenNo: string
  createdAt: string
  patientName: string
  mrNo: string
  patientId?: string
  age?: string
  phone?: string
  encounterId?: string
  status?: string
  doctor?: string
  department?: string
}

type PrevHistoryTaking = {
  _id: string
  submittedAt?: string
  createdAt?: string
  hxBy?: string
  hxDate?: string
  data?: any
}

export default function Hospital_HistoryTaking() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState<string>(today)
  const [to, setTo] = useState<string>(today)
  const [tokens, setTokens] = useState<Token[]>([])
  const [historySavedTokenIds, setHistorySavedTokenIds] = useState<string[]>([])
  const [patientKey, setPatientKey] = useState<string>('')
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
  const [submitState, setSubmitState] = useState<{ saving: boolean }>({ saving: false })
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }
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
      const saved = localStorage.getItem('historyTaking_hiddenHealthConditions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch { /* ignore */ }
    return []
  })
  const [customHealthConditions, setCustomHealthConditions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('historyTaking_customHealthConditions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch { /* ignore */ }
    return []
  })
  const [healthConditionsInput, setHealthConditionsInput] = useState<string>('')
  const [editingHealthCondition, setEditingHealthCondition] = useState<null | { original: string; current: string }>(null)

  // Dialog states for Add Condition
  const [isAddConditionDialogOpen, setIsAddConditionDialogOpen] = useState(false)
  const [addConditionInputs, setAddConditionInputs] = useState<string[]>([''])

  // Dialog states for Delete Confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ type: 'default' | 'custom'; value: string } | null>(null)



  // Save custom health conditions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('historyTaking_customHealthConditions', JSON.stringify(customHealthConditions))
    } catch {
      // Ignore localStorage errors
    }
  }, [customHealthConditions])

  // Save hidden health conditions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('historyTaking_hiddenHealthConditions', JSON.stringify(hiddenHealthConditions))
    } catch {
      // Ignore localStorage errors
    }
  }, [hiddenHealthConditions])

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

  const resetAllTabs = (opts?: { keepPatientKey?: string }) => {
    const keepKey = opts?.keepPatientKey || ''
    setPatientKey(keepKey)
    setHxBy(currentUser)
    setHxDate(today)
    setPersonalInfo({
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
    setMaritalStatus({ status: '' as '' | 'Married' | 'To Go' | 'Single', timePeriod: '', marriages: [{ ...emptyMarriage }] })
    setCoitus({
      intercourse: '' as '' | 'Successful' | 'Faild',
      partnerLiving: '' as '' | 'Together' | 'Out of Town',
      visitHomeMonths: '',
      visitHomeDays: '',
      frequencyType: '' as '' | 'Daily' | 'Weekly' | 'Monthly',
      frequencyNumber: '',
      since: '',
      previousFrequency: '',
    })
    setHealth({
      selectedConditions: [],
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
    setHealthConditionsInput('')
    setEditingHealthCondition(null)
    setSexualHistory({
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
    setPreviousMedicalHistory({ exConsultation: '', exRx: '', cause: '' })
    setArrivalReference({
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
    setActiveTab('Personal Information')
  }

  const ord = (n: number) => {
    const j = n % 10
    const k = n % 100
    if (j === 1 && k !== 11) return `${n}st`
    if (j === 2 && k !== 12) return `${n}nd`
    if (j === 3 && k !== 13) return `${n}rd`
    return `${n}th`
  }

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

  const saveEditedHealthCondition = () => {
    if (!editingHealthCondition) return
    const { original, current } = editingHealthCondition
    const trimmed = current.trim()
    if (!trimmed || trimmed === original) {
      setEditingHealthCondition(null)
      return
    }
    // Update in default or custom list
    if ((defaultHealthConditions as readonly string[]).includes(original)) {
      // For default conditions, add to hidden and create custom with new name
      setHiddenHealthConditions(prev => [...prev, original])
      setCustomHealthConditions(prev => [...prev, trimmed])
    } else {
      // For custom conditions, rename
      setCustomHealthConditions(prev => prev.map(c => c === original ? trimmed : c))
    }
    // Update selected conditions
    setHealth(s => ({
      ...s,
      selectedConditions: s.selectedConditions.map(c => c === original ? trimmed : c)
    }))
    setEditingHealthCondition(null)
  }

  const checkboxCardLabelCls = (checked: boolean) =>
    `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-black hover:border-blue-800`



  const tabs = [
    'Personal Information',
    'Marital Status',
    'Coitus',
    'Health',
    'Sexual History',
    'Previous Medical History',
    'Arrival Reference',
  ] as const

  type TabKey = (typeof tabs)[number]
  const [activeTab, setActiveTab] = useState<TabKey>('Personal Information')

  useEffect(() => {
    loadTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          if (String(from || '') !== today || String(to || '') !== today) { setHistorySavedTokenIds([]); return }
          const mine = tokens.filter(t => !!t.encounterId)
          const checks = await Promise.all(
            mine.map(async (t) => {
              try {
                const res: any = await hospitalApi.getHistoryTaking(String(t.encounterId))
                const ht = res?.historyTaking
                const has = !!(ht?._id) && (ht?.data != null || ht?.hxBy != null || ht?.hxDate != null)
                return has ? String(t.id) : ''
              } catch {
                return ''
              }
            })
          )
          const ids = checks.filter(Boolean)
          if (!cancelled) setHistorySavedTokenIds(ids)
        } catch {
          if (!cancelled) setHistorySavedTokenIds([])
        }
      })()
    return () => { cancelled = true }
  }, [tokens, from, to, today])

  useEffect(() => {
    if (!patientKey) return
    const t = tokens.find(x => x.id === patientKey)
    if (!t) return
    setPersonalInfo(p => ({
      ...p,
      name: t.patientName && t.patientName !== '-' ? t.patientName : p.name,
      mrNo: t.mrNo && t.mrNo !== '-' ? t.mrNo : p.mrNo,
      age: t.age && t.age !== '-' ? t.age : p.age,
      contact1: p.contact1 ? p.contact1 : (t.phone || p.contact1),
    }))
  }, [patientKey, tokens])

  const selectedToken = useMemo(() => tokens.find(t => String(t.id) === String(patientKey)) || null, [tokens, patientKey])

  const [prevHistories, setPrevHistories] = useState<PrevHistoryTaking[]>([])
  const [prevHistoryId, setPrevHistoryId] = useState<string>('')

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setPrevHistories([])
          setPrevHistoryId('')
          const pid = String(selectedToken?.patientId || '')
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
          if (!cancelled) {
            setPrevHistories([])
            setPrevHistoryId('')
          }
        }
      })()
    return () => { cancelled = true }
  }, [selectedToken?.patientId, selectedToken?.id])

  useEffect(() => {
    if (!patientKey) return
    const t = tokens.find(x => x.id === patientKey)
    const encounterId = t?.encounterId
    if (!t || !encounterId) return

    resetAllTabs({ keepPatientKey: patientKey })

    setPersonalInfo(p => ({
      ...p,
      name: t.patientName && t.patientName !== '-' ? t.patientName : p.name,
      mrNo: t.mrNo && t.mrNo !== '-' ? t.mrNo : p.mrNo,
      age: t.age && t.age !== '-' ? t.age : p.age,
      contact1: p.contact1 ? p.contact1 : (t.phone || p.contact1),
    }))

      ; (async () => {
        try {
          const res: any = await hospitalApi.getHistoryTaking(encounterId)
          const ht = res?.historyTaking
          const data = ht?.data
          if (!data) return

          if (ht?.hxBy != null) setHxBy(String(ht.hxBy || ''))
          else if (data.hxBy != null) setHxBy(String(data.hxBy || ''))
          if (ht?.hxDate != null) setHxDate(String(ht.hxDate || ''))
          else if ((data as any).hxDate != null) setHxDate(String((data as any).hxDate || ''))
          if (data.personalInfo) setPersonalInfo((p) => ({ ...p, ...data.personalInfo }))
          if (data.maritalStatus) setMaritalStatus((s) => ({ ...s, ...data.maritalStatus }))
          if (data.coitus) setCoitus((s) => ({ ...s, ...data.coitus }))
          if (data.health) setHealth((s) => ({ ...s, ...data.health }))
          if (data.sexualHistory) setSexualHistory((s) => {
            const sh = { ...s, ...data.sexualHistory }
            if (sh.oe?.epidCst?.side) {
              if (sh.oe.epidCst.side === 'Right') sh.oe.epidCst.right = true
              if (sh.oe.epidCst.side === 'Left') sh.oe.epidCst.left = true
            }
            if (sh.oe?.varicocele?.side) {
              if (sh.oe.varicocele.side === 'Right') sh.oe.varicocele.right = true
              if (sh.oe.varicocele.side === 'Left') sh.oe.varicocele.left = true
            }
            return sh
          })
          if (data.previousMedicalHistory) setPreviousMedicalHistory((s) => ({ ...s, ...data.previousMedicalHistory }))
          if (data.arrivalReference) setArrivalReference((s) => ({ ...s, ...data.arrivalReference }))

        } catch (e: any) {
          // ignore load errors silently for now
        }
      })()
  }, [patientKey, tokens])

  useEffect(() => {
    if (!patientKey) return
    const excludeSavedToday = String(from || '') === today && String(to || '') === today
    if (!excludeSavedToday) return
    if (!historySavedTokenIds.includes(String(patientKey))) return
    resetAllTabs({ keepPatientKey: '' })
  }, [patientKey, historySavedTokenIds, from, to, today])

  async function loadTokens() {
    try {
      const res: any = await hospitalApi.listTokens({ from: from || undefined, to: to || undefined })
      const items: Token[] = (res?.tokens || []).map((t: any) => ({
        id: String(t._id || t.id),
        tokenNo: String(t.tokenNo || ''),
        createdAt: String(t.createdAt || ''),
        patientName: String(t.patientId?.fullName || t.patientName || '-'),
        mrNo: String(t.patientId?.mrn || t.mrn || '-'),
        patientId: t.patientId?._id != null ? String(t.patientId._id) : (t.patientId != null && typeof t.patientId === 'string' ? String(t.patientId) : undefined),
        age: t.patientId?.age != null ? String(t.patientId.age) : (t.patientId?.patientAge != null ? String(t.patientId.patientAge) : undefined),
        phone: t.patientId?.phoneNormalized != null ? String(t.patientId.phoneNormalized) : (t.patientId?.phone != null ? String(t.patientId.phone) : (t.phone != null ? String(t.phone) : undefined)),
        encounterId: t.encounterId != null ? String(t.encounterId) : undefined,
        status: String(t.status || ''),
        doctor: String(t.doctorId?.name || t.doctor || ''),
        department: String(t.departmentId?.name || t.department || ''),
      }))
      setTokens(items)
    } catch {
      setTokens([])
    }
  }

  const patients = useMemo(() => {
    const excludeSavedToday = String(from || '') === today && String(to || '') === today
    const savedSet = new Set(excludeSavedToday ? historySavedTokenIds.map(String) : [])
    const map = new Map<string, { key: string; label: string }>()
    for (const t of tokens) {
      const key = t.id
      if (!key) continue
      if (savedSet.has(String(key))) continue
      if (t.status === 'returned') continue
      const doctorPart = t.doctor ? `Dr. ${t.doctor}` : ''
      const deptPart = t.department || ''
      const extra = [doctorPart, deptPart].filter(Boolean).join(' • ')
      const label = `${t.tokenNo} - ${t.patientName} • ${t.mrNo}${extra ? ` | ${extra}` : ''}`
      if (!map.has(key)) map.set(key, { key, label })
    }
    return Array.from(map.values())
  }, [tokens, from, to, today, historySavedTokenIds])
  return (
    <div className="w-full px-2 sm:px-4">
      <div className="text-xl font-semibold text-slate-800">History Taking</div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:flex sm:items-center sm:gap-2">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 sm:w-auto" />
            <span className="hidden text-slate-500 sm:inline">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 sm:w-auto" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => {
                const t = new Date().toISOString().slice(0, 10)
                setFrom(t)
                setTo(t)
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs hover:bg-slate-50 sm:w-auto sm:py-1"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs hover:bg-slate-50 sm:w-auto sm:py-1"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="hidden flex-1 sm:block" />



        <select
          value={prevHistoryId}
          onChange={e => {
            const id = String(e.target.value || '')
            setPrevHistoryId(id)
            const r = prevHistories.find((x: PrevHistoryTaking) => x._id === id)
            if (!r) return

            const data = r.data
            if (!data) return

            setHxBy(String(r.hxBy || data.hxBy || ''))
            setHxDate(String(r.hxDate || (data as any).hxDate || today))
            if (data.personalInfo) setPersonalInfo((p) => ({ ...p, ...data.personalInfo }))
            if (data.maritalStatus) setMaritalStatus((s) => ({ ...s, ...data.maritalStatus }))
            if (data.coitus) setCoitus((s) => ({ ...s, ...data.coitus }))
            if (data.health) setHealth((s) => ({ ...s, ...data.health }))
            if (data.sexualHistory) setSexualHistory((s) => {
              const sh = { ...s, ...data.sexualHistory }
              if (sh.oe?.epidCst?.side) {
                if (sh.oe.epidCst.side === 'Right') sh.oe.epidCst.right = true
                if (sh.oe.epidCst.side === 'Left') sh.oe.epidCst.left = true
              }
              if (sh.oe?.varicocele?.side) {
                if (sh.oe.varicocele.side === 'Right') sh.oe.varicocele.right = true
                if (sh.oe.varicocele.side === 'Left') sh.oe.varicocele.left = true
              }
              return sh
            })
            if (data.previousMedicalHistory) setPreviousMedicalHistory((s) => ({ ...s, ...data.previousMedicalHistory }))
            if (data.arrivalReference) setArrivalReference((s) => ({ ...s, ...data.arrivalReference }))
            setActiveTab('Personal Information')
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs sm:w-auto"
          disabled={!selectedToken?.encounterId || prevHistories.length === 0}
        >
          <option value="">Previous History</option>
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
            if (!patientKey) {
              showToast('error', 'Please select patient first')
              return
            }
            const base = pathname.startsWith('/reception') ? '/reception' : '/hospital'
            navigate(`${base}/lab-reports-entry?tokenId=${encodeURIComponent(patientKey)}`)
          }}
          className="w-full rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 sm:w-auto"
        >
          Enter Lab Reports
        </button>
      </div>

      <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Patient</label>
            <select
              value={patientKey}
              onChange={e => {
                const nextKey = e.target.value
                if (!nextKey) {
                  resetAllTabs({ keepPatientKey: '' })
                  return
                }
                const t = tokens.find(x => x.id === nextKey)
                if (t) {
                  setPersonalInfo(p => ({
                    ...p,
                    name: t.patientName && t.patientName !== '-' ? t.patientName : p.name,
                    mrNo: t.mrNo && t.mrNo !== '-' ? t.mrNo : p.mrNo,
                    age: t.age && t.age !== '-' ? t.age : p.age,
                    contact1: p.contact1 ? p.contact1 : (t.phone || p.contact1),
                  }))
                }
                setPatientKey(nextKey)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select patient</option>
              {patients.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Hx by (History Taker)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input value={hxBy} disabled className="min-w-[180px] flex-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600" />
              <input type="date" value={hxDate} onChange={e => setHxDate(e.target.value)} className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="mt-2 border-b border-slate-200">
          <nav className="-mb-px flex flex-wrap gap-2">
            {tabs.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-3 py-2 text-sm ${activeTab === t ? 'border-b-2 border-sky-600 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'Personal Information' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700">Name</label>
              <input value={personalInfo.name} onChange={e => setPersonalInfo(p => ({ ...p, name: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">MR#</label>
              <input value={personalInfo.mrNo} onChange={e => setPersonalInfo(p => ({ ...p, mrNo: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Age</label>
              <input value={personalInfo.age} onChange={e => setPersonalInfo(p => ({ ...p, age: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">PT</label>
              <input value={personalInfo.pt} onChange={e => setPersonalInfo(p => ({ ...p, pt: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">MAM</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-slate-600">Upto:</div>
                <input value={personalInfo.mamUpto} onChange={e => setPersonalInfo(p => ({ ...p, mamUpto: e.target.value }))} className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                <div className="text-sm text-slate-600">Pn:</div>
                <input value={personalInfo.mamPn} onChange={e => setPersonalInfo(p => ({ ...p, mamPn: e.target.value }))} className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Visit/Stay</label>
              <input value={personalInfo.visitStay} onChange={e => setPersonalInfo(p => ({ ...p, visitStay: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Height</label>
              <input value={personalInfo.height} onChange={e => setPersonalInfo(p => ({ ...p, height: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Weight</label>
              <input value={personalInfo.weight} onChange={e => setPersonalInfo(p => ({ ...p, weight: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Blood Pressure (BP)</label>
              <input value={personalInfo.bp} onChange={e => setPersonalInfo(p => ({ ...p, bp: e.target.value }))} placeholder="e.g., 120/80" className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Sleep (hrs)</label>
              <input value={personalInfo.sleepHrs} onChange={e => setPersonalInfo(p => ({ ...p, sleepHrs: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Contact#1</label>
              <input value={personalInfo.contact1} onChange={e => setPersonalInfo(p => ({ ...p, contact1: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Contact#2</label>
              <input value={personalInfo.contact2} onChange={e => setPersonalInfo(p => ({ ...p, contact2: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Walk/Exercise</label>
              <input value={personalInfo.walkExercise} onChange={e => setPersonalInfo(p => ({ ...p, walkExercise: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Education</label>
              <input value={personalInfo.education} onChange={e => setPersonalInfo(p => ({ ...p, education: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Job Hours</label>
              <input value={personalInfo.jobHours} onChange={e => setPersonalInfo(p => ({ ...p, jobHours: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Current Address</label>
              <textarea value={personalInfo.currentAddress} onChange={e => setPersonalInfo(p => ({ ...p, currentAddress: e.target.value }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Permanent Address</label>
              <textarea value={personalInfo.permanentAddress} onChange={e => setPersonalInfo(p => ({ ...p, permanentAddress: e.target.value }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Nature of Work</label>
              <textarea value={personalInfo.natureOfWork} onChange={e => setPersonalInfo(p => ({ ...p, natureOfWork: e.target.value }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                  className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                              className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
                            />
                            <div className="text-sm text-slate-600">Month:</div>
                            <input
                              value={m.months}
                              onChange={e => setMaritalStatus(s => {
                                const next = [...s.marriages]
                                next[idx] = { ...next[idx], months: e.target.value }
                                return { ...s, marriages: next }
                              })}
                              className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                                className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
                              />
                              <div className="text-sm text-slate-600">Female</div>
                              <input
                                value={m.childStatus2?.female || ''}
                                onChange={e => setMaritalStatus(s => {
                                  const next = [...s.marriages]
                                  next[idx] = { ...next[idx], childStatus2: { ...(next[idx] as any).childStatus2, female: e.target.value } }
                                  return { ...s, marriages: next }
                                })}
                                className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                      onChange={(e) => setCoitus(s => ({
                        ...s,
                        partnerLiving: e.target.checked ? opt : '',
                        visitHomeMonths: (e.target.checked && opt === 'Out of Town') ? s.visitHomeMonths : '',
                        visitHomeDays: (e.target.checked && opt === 'Out of Town') ? s.visitHomeDays : '',
                      }))}
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
                    <input value={coitus.visitHomeMonths} onChange={e => setCoitus(s => ({ ...s, visitHomeMonths: e.target.value }))} className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                    <div className="text-sm text-slate-600">for(days):</div>
                    <input value={coitus.visitHomeDays} onChange={e => setCoitus(s => ({ ...s, visitHomeDays: e.target.value }))} className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 block text-sm font-semibold text-slate-800">Coitus Frequency</div>
              <div className="flex flex-wrap items-center gap-6">
                {(['Daily', 'Weekly', 'Monthly'] as const).map(opt => (
                  <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                  <input value={coitus.frequencyNumber} onChange={e => setCoitus(s => ({ ...s, frequencyNumber: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <input value={coitus.since} onChange={e => setCoitus(s => ({ ...s, since: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">Previous Coitus Frequency</label>
              <input value={coitus.previousFrequency} onChange={e => setCoitus(s => ({ ...s, previousFrequency: e.target.value }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                          className={`flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                  <label key={k} className={`flex items-center gap-2 text-sm text-black`}>
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
                  <input value={health.diabetes.since} onChange={e => setHealth(s => ({ ...s, diabetes: { ...s.diabetes, since: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Medicine Taking</label>
                  <input value={health.diabetes.medicineTaking} onChange={e => setHealth(s => ({ ...s, diabetes: { ...s.diabetes, medicineTaking: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Hypertension</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                {(['me', 'father', 'mother'] as const).map(k => (
                  <label key={k} className={`flex items-center gap-2 text-sm text-black`}>
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
                  <input value={health.hypertension.since} onChange={e => setHealth(s => ({ ...s, hypertension: { ...s.hypertension, since: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Medicine Taking</label>
                  <input value={health.hypertension.medicineTaking} onChange={e => setHealth(s => ({ ...s, hypertension: { ...s.hypertension, medicineTaking: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Drug History</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={health.drugHistory.wine} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, wine: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Wine
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={health.drugHistory.weed} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, weed: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Weed
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={health.drugHistory.tobacco} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, tobacco: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Tobacco
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={health.drugHistory.gutka} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, gutka: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Gutka
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={health.drugHistory.naswar} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, naswar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Naswar
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={health.drugHistory.pan} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, pan: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Pan
                </label>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={health.drugHistory.other} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Quit</label>
                  <input value={health.drugHistory.quit} onChange={e => setHealth(s => ({ ...s, drugHistory: { ...s.drugHistory, quit: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Smoking</div>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                {(['Yes', 'No'] as const).map(opt => (
                  <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                    <input
                      type="checkbox"
                      checked={health.smoking.status === opt}
                      onChange={(e) => setHealth(s => ({
                        ...s,
                        smoking: {
                          ...s.smoking,
                          status: e.target.checked ? opt : '',
                          since: (e.target.checked && opt === 'Yes') ? s.smoking.since : '',
                          quantityUnit: (e.target.checked && opt === 'Yes') ? s.smoking.quantityUnit : '',
                          quantityNumber: (e.target.checked && opt === 'Yes') ? s.smoking.quantityNumber : '',
                          quit: (e.target.checked && opt === 'Yes') ? s.smoking.quit : '',
                        },
                      }))}
                      className="h-4 w-4 rounded border-slate-300"
                      
                    />
                    {opt}
                  </label>
                ))}
              </div>

              {health.smoking.status === 'Yes' && (
                <div className="mt-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Since</label>
                      <input value={health.smoking.since} onChange={e => setHealth(s => ({ ...s, smoking: { ...s.smoking, since: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Quit</label>
                      <input value={health.smoking.quit} onChange={e => setHealth(s => ({ ...s, smoking: { ...s.smoking, quit: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 block text-sm text-slate-700">Quantity of Cigerrete (Daily)</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Packs', 'Units'] as const).map(opt => (
                        <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                        className={`w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
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
                  <input value={sexualHistory.erection.percentage} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, percentage: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input value={sexualHistory.erection.sinceValue} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceValue: e.target.value } }))} className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} placeholder="#" />
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.erection.sinceUnit === 'Year'} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? 'Year' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Year
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.erection.sinceUnit === 'Month'} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? 'Month' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Month
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.erection.sinceUnit === 'Week'} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? 'Week' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Week
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.erection.sinceUnit === 'Day'} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, sinceUnit: e.target.checked ? 'Day' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Day
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <label className={checkboxCardLabelCls(sexualHistory.erection.prePeni)}>
                  <input type="checkbox" checked={sexualHistory.erection.prePeni} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, prePeni: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Pre peni
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.erection.postPeni)}>
                  <input type="checkbox" checked={sexualHistory.erection.postPeni} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, postPeni: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Post peni
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">e/? EJ</div>
                  <div className="flex flex-wrap items-center gap-6">
                    {(['Yes', 'No'] as const).map(opt => (
                      <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                        <input type="checkbox" checked={sexualHistory.erection.ej === opt} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, ej: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">e/? med</div>
                  <div className="flex flex-wrap items-center gap-6">
                    {(['Yes', 'No'] as const).map(opt => (
                      <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                        <input type="checkbox" checked={sexualHistory.erection.med === opt} onChange={(e) => setSexualHistory(s => ({ ...s, erection: { ...s.erection, med: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.erection.other} onChange={e => setSexualHistory(s => ({ ...s, erection: { ...s.erection, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Experiences</div>

              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Pre-Marriage</div>
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.gf} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, gf: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      GF
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.male} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, male: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Male
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.pros} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, pros: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Pros
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.preMarriage.mb} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, mb: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      MB
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={!!sexualHistory.experiences.preMarriage.multipleP} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, multipleP: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Multiple.P
                    </label>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold text-slate-800">Number of Experiences</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Once', 'Multiple'] as const).map(opt => (
                        <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                          <input type="checkbox" checked={sexualHistory.experiences.preMarriage.multipleOrOnce === opt} onChange={(e) => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, multipleOrOnce: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300"  />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Others</label>
                    <input value={sexualHistory.experiences.preMarriage.other} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, preMarriage: { ...s.experiences.preMarriage, other: e.target.value } } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">Post Marriage</div>
                  <div className="mt-3 flex flex-wrap items-center gap-6">
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.gf} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, gf: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      GF
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.male} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, male: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Male
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.pros} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, pros: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Pros
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.experiences.postMarriage.mb} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, mb: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      MB
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={!!sexualHistory.experiences.postMarriage.multipleP} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, multipleP: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Multiple.P
                    </label>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold text-slate-800">Number of Experiences</div>
                    <div className="flex flex-wrap items-center gap-6">
                      {(['Once', 'Multiple'] as const).map(opt => (
                        <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                          <input type="checkbox" checked={sexualHistory.experiences.postMarriage.multipleOrOnce === opt} onChange={(e) => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, multipleOrOnce: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300"  />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Others</label>
                    <input value={sexualHistory.experiences.postMarriage.other} onChange={e => setSexualHistory(s => ({ ...s, experiences: { ...s.experiences, postMarriage: { ...s.experiences.postMarriage, other: e.target.value } } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">NPT</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                {(['OK', 'NIL', 'RARE'] as const).map(opt => (
                  <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                    <input type="checkbox" checked={sexualHistory.npt.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                    {opt}
                  </label>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Erection(%)</label>
                  <input value={sexualHistory.npt.erectionPercentage} onChange={e => setSexualHistory(s => ({ ...s, npt: { ...s.npt, erectionPercentage: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Since</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input value={sexualHistory.npt.sinceValue} onChange={e => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceValue: e.target.value } }))} className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} placeholder="#" />
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Year'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Year' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Year
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Month'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Month' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Month
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Week'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Week' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Week
                    </label>
                    <label className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.npt.sinceUnit === 'Day'} onChange={(e) => setSexualHistory(s => ({ ...s, npt: { ...s.npt, sinceUnit: e.target.checked ? 'Day' : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Day
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.npt.other} onChange={e => setSexualHistory(s => ({ ...s, npt: { ...s.npt, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Desire</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['Yes', 'No'] as const).map(opt => (
                    <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.desire.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, desire: { ...s.desire, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.desire.other} onChange={e => setSexualHistory(s => ({ ...s, desire: { ...s.desire, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800">Nightfall (NF)</div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  {(['Yes', 'No'] as const).map(opt => (
                    <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
                      <input type="checkbox" checked={sexualHistory.nightfall.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, nightfall: { ...s.nightfall, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm text-slate-700">Other</label>
                  <input value={sexualHistory.nightfall.other} onChange={e => setSexualHistory(s => ({ ...s, nightfall: { ...s.nightfall, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                        className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
                        placeholder="#"
                      />
                      {(['Sec', 'JK', 'Min'] as const).map(opt => (
                        <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                        className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`}
                        placeholder="#"
                      />
                      {(['Sec', 'JK', 'Min'] as const).map(opt => (
                        <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                    <input value={sexualHistory.pe.sinceValue} onChange={e => setSexualHistory(s => ({ ...s, pe: { ...s.pe, sinceValue: e.target.value } }))} className={`w-28 rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} placeholder="#" />
                    {(['Year', 'Month', 'Week', 'Day'] as const).map(opt => (
                      <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                <input value={sexualHistory.pe.other} onChange={e => setSexualHistory(s => ({ ...s, pe: { ...s.pe, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">P.Fluid</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.foreplay)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.foreplay} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, foreplay: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Foreplay
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.phonixSex)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.phonixSex} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, phonixSex: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Phonix Sex
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.onThoughts)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.onThoughts} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, onThoughts: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  On Thoughts
                </label>
                <label className={checkboxCardLabelCls(sexualHistory.pFluid.pornAddiction)}>
                  <input type="checkbox" checked={sexualHistory.pFluid.pornAddiction} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, pornAddiction: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300"  />
                  Porn Addiction
                </label>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={sexualHistory.pFluid.other} onChange={e => setSexualHistory(s => ({ ...s, pFluid: { ...s.pFluid, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                  <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                <input value={sexualHistory.ud.other} onChange={e => setSexualHistory(s => ({ ...s, ud: { ...s.ud, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

              <div className="mt-6">
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
                      <input type="checkbox" checked={sexualHistory.oe.disease.peyronie} onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, disease: { ...s.oe.disease, peyronie: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Peyronie
                    </label>
                    <label className={checkboxCardLabelCls(sexualHistory.oe.disease.calcification)}>
                      <input type="checkbox" checked={sexualHistory.oe.disease.calcification} onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, disease: { ...s.oe.disease, calcification: e.target.checked } } }))} className="h-4 w-4 rounded border-slate-300"  />
                      Calcification
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-700">Testes</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['Atrophic', 'Normal'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.testes.status === opt)}>
                        <input type="checkbox" checked={sexualHistory.oe.testes.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, testes: { ...s.oe.testes, status: e.target.checked ? opt : '' } } }))} className="h-4 w-4 rounded border-slate-300"  />
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
                        <input type="checkbox" checked={sexualHistory.uss.status === opt} onChange={(e) => setSexualHistory(s => ({ ...s, uss: { ...s.uss, status: e.target.checked ? opt : '' } }))} className="h-4 w-4 rounded border-slate-300"  />
                        {opt}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-700">Other</label>
                    <input value={sexualHistory.uss.other} onChange={e => setSexualHistory(s => ({ ...s, uss: { ...s.uss, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
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
                <textarea value={sexualHistory.inf.others} onChange={e => setSexualHistory(s => ({ ...s, inf: { ...s.inf, others: e.target.value } }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                  <textarea value={previousMedicalHistory.exConsultation} onChange={e => setPreviousMedicalHistory(s => ({ ...s, exConsultation: e.target.value }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">Ex Rx. (Ex-Treatment)</label>
                  <textarea value={previousMedicalHistory.exRx} onChange={e => setPreviousMedicalHistory(s => ({ ...s, exRx: e.target.value }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Cause</label>
                <textarea value={previousMedicalHistory.cause} onChange={e => setPreviousMedicalHistory(s => ({ ...s, cause: e.target.value }))} rows={2} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                  <label key={opt} className={`flex items-center gap-2 text-sm text-black`}>
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
                <input value={arrivalReference.referredBy.other} onChange={e => setArrivalReference(s => ({ ...s, referredBy: { ...s.referredBy, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Ads. (Social Media)</div>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.youtube} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, youtube: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Youtube
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.google} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, google: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Google
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.facebook} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, facebook: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Facebook
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.adsSocialMedia.instagram} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, instagram: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Instagram
                </label>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-700">Other</label>
                <input value={arrivalReference.adsSocialMedia.other} onChange={e => setArrivalReference(s => ({ ...s, adsSocialMedia: { ...s.adsSocialMedia, other: e.target.value } }))} className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black`} />
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
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.drAslamNaveed} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, drAslamNaveed: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Dr. Aslam Naveed
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.drMujahidFarooq} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, drMujahidFarooq: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Dr. Mujahid Farooq
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.mensCareClinic} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, mensCareClinic: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Men's Care Clinic
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.olaDoc} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, olaDoc: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Ola Doc
                </label>
                <label className={`flex items-center gap-2 text-sm text-black`}>
                  <input type="checkbox" checked={arrivalReference.appearOnKeyword.marham} onChange={e => setArrivalReference(s => ({ ...s, appearOnKeyword: { ...s.appearOnKeyword, marham: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                  Marham
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'Personal Information' && activeTab !== 'Marital Status' && activeTab !== 'Coitus' && activeTab !== 'Health' && activeTab !== 'Sexual History' && activeTab !== 'Previous Medical History' && activeTab !== 'Arrival Reference' && <div />}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => resetAllTabs({ keepPatientKey: patientKey })}
          className="rounded-md border border-blue-800 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
        >
          Reset Forms
        </button>
        <button
          type="button"
          onClick={async () => {
            const t = tokens.find(x => x.id === patientKey)
            const encounterId = t?.encounterId
            if (!t || !encounterId) {
              showToast('error', 'Please select patient first')
              return
            }
            if (!hxBy.trim()) {
              showToast('error', 'User not authenticated')
              return
            }

            try {
              setSubmitState({ saving: true })
              await hospitalApi.upsertHistoryTaking(encounterId, {
                tokenId: patientKey,
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
              })
              showToast('success', 'Saved')
              resetAllTabs({ keepPatientKey: '' })
            } catch (e: any) {
              showToast('error', e?.message || 'Failed to save')
            } finally {
              setSubmitState({ saving: false })
            }
          }}
          disabled={submitState.saving}
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState.saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {toast ? (
        <div className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
