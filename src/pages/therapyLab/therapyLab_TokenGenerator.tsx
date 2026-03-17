import { useMemo, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import TherapyLab_TokenSlip from '../../components/therapyLab/TherapyLab_TokenSlip'
import type { TherapyLabTokenSlipData } from '../../components/therapyLab/TherapyLab_TokenSlip'
import { therapyApi } from '../../utils/api'
import { Plus, Trash2, X } from 'lucide-react'

type Patient = {
  _id: string
  mrn?: string
  fullName?: string
  phoneNormalized?: string
  age?: string
  gender?: string
  address?: string
  fatherName?: string
  guardianRel?: string
  cnicNormalized?: string
  cnic?: string
}

type TherapyPackage = {
  _id: string
  packageName?: string
  package: number
  price: number
  status: 'active' | 'inactive'
  machinePreset?: any
}

type CustomTherapyMachineDef =
  | { id: string; name: string; kind: 'checkboxes'; options: string[] }
  | { id: string; name: string; kind: 'fields'; fields: string[] }

function sanitizeCustomTherapyMachineDefs(input: any): CustomTherapyMachineDef[] {
  const arr: any[] = Array.isArray(input) ? input : []
  const out: CustomTherapyMachineDef[] = []
  for (const d of arr) {
    if (!d || typeof d !== 'object') continue
    const id = String((d as any).id || '').trim()
    const name = String((d as any).name || '').trim()
    const kind = (d as any).kind
    if (!id || !name) continue
    if (kind === 'checkboxes') {
      const options = Array.from(new Set(((d as any).options || []).map((s: any) => String(s || '').trim()).filter(Boolean))) as string[]
      out.push({ id, name, kind: 'checkboxes', options })
    } else if (kind === 'fields') {
      const fields = Array.from(new Set(((d as any).fields || []).map((s: any) => String(s || '').trim()).filter(Boolean))) as string[]
      out.push({ id, name, kind: 'fields', fields })
    }
  }
  return out
}



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

const FIXED_THERAPY_MACHINE_KEYS = ['chi', 'eswt', 'ms', 'mam', 'us', 'mcgSpg', 'mproCryo', 'ximen'] as const

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

const checkboxCardLabelCls = (checked: boolean) =>
  `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-800`

function normPhone(s: string) {
  return (s || '').replace(/\D+/g, '')
}

function normName(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export default function TherapyLab_TokenGenerator() {
  const location = useLocation() as any
  const navState = (location && (location.state || null)) || null

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [guardianRel, setGuardianRel] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [cnic, setCnic] = useState('')
  const [address, setAddress] = useState('')
  const [mrn, setMrn] = useState('')
  const [patientId, setPatientId] = useState('')

  const phoneStorageKey = 'therapyLab.tokenGenerator.lastPhone'
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const [phoneLookupSearchedDigits, setPhoneLookupSearchedDigits] = useState('')
  const phoneLookupTimerRef = useRef<any>(null)
  const phoneLookupSeqRef = useRef(0)

  const [fromReferralId, setFromReferralId] = useState<string>('')
  const [referringConsultant, setReferringConsultant] = useState('')

  const [packages, setPackages] = useState<TherapyPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState<string>('')
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')

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

  useEffect(() => {
    const key = 'therapyLab.therapyMachines.hidden'
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) setHiddenTherapyMachines(arr.map((s: any) => String(s || '').trim()).filter(Boolean))
      else setHiddenTherapyMachines([])
    } catch {
      setHiddenTherapyMachines([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setPackagesLoading(true)
          setPackagesError('')
          const res: any = await therapyApi.listPackages({ status: 'active', limit: 500 } as any)
          const list: any[] = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
          if (!cancelled) setPackages(list as any)
        } catch (e: any) {
          if (!cancelled) {
            setPackages([])
            setPackagesError(e?.message || 'Failed to load packages')
          }
        } finally {
          if (!cancelled) setPackagesLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const key = 'therapyLab.therapyMachines.custom'
    try {
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : null
      const defs = sanitizeCustomTherapyMachineDefs(data?.defs)
      const st = data?.state && typeof data.state === 'object' ? data.state : {}
      setCustomTherapyMachines(defs)
      setCustomTherapyMachineState(st)
    } catch {
      setCustomTherapyMachines([])
      setCustomTherapyMachineState({})
    }
  }, [])

  const hiddenTherapyMachinesSet = useMemo(() => new Set(hiddenTherapyMachines.map((s) => String(s || '').trim()).filter(Boolean)), [hiddenTherapyMachines])

  const saveHiddenTherapyMachines = (next: string[]) => {
    const uniq = Array.from(new Set(next.map((s) => String(s || '').trim()).filter(Boolean)))
    setHiddenTherapyMachines(uniq)
    const key = 'therapyLab.therapyMachines.hidden'
    try {
      localStorage.setItem(key, JSON.stringify(uniq))
    } catch { }
  }

  const saveCustomTherapyMachines = (
    defs: Array<
      | { id: string; name: string; kind: 'checkboxes'; options: string[] }
      | { id: string; name: string; kind: 'fields'; fields: string[] }
    >,
    state: Record<string, { enabled: boolean; checks?: Record<string, boolean>; fields?: Record<string, string> }>
  ) => {
    const safeDefs = sanitizeCustomTherapyMachineDefs(defs)
    setCustomTherapyMachines(safeDefs)
    setCustomTherapyMachineState(state)
    const key = 'therapyLab.therapyMachines.custom'
    try {
      localStorage.setItem(key, JSON.stringify({ defs: safeDefs, state }))
    } catch { }
  }

  const selectedPackage = useMemo(
    () => packages.find((p) => String(p._id) === String(selectedPackageId)) || null,
    [packages, selectedPackageId]
  )

  const applyMachinePreset = (preset: any) => {
    if (!preset || typeof preset !== 'object') return

    if (preset.therapyMachines && typeof preset.therapyMachines === 'object') {
      const base: any = getEmptyTherapyMachines()
      const src: any = preset.therapyMachines
      const next: any = { ...base }
      for (const k of FIXED_THERAPY_MACHINE_KEYS as any) {
        if (src[k] && typeof src[k] === 'object') next[k] = { ...base[k], ...src[k] }
      }
      setTherapyMachines(next)

      const enabledFixed = (FIXED_THERAPY_MACHINE_KEYS as any).filter((k: any) => !!src?.[k]?.enabled)
      if (enabledFixed.length) {
        saveHiddenTherapyMachines(hiddenTherapyMachines.filter((k) => !enabledFixed.includes(k)))
      }
    }

    const presetDefs: any[] = sanitizeCustomTherapyMachineDefs(preset.customTherapyMachines)
    const presetState: any = preset.customTherapyMachineState && typeof preset.customTherapyMachineState === 'object' ? preset.customTherapyMachineState : {}
    if (presetDefs.length || Object.keys(presetState || {}).length) {
      const defsById = new Map<string, any>()
      for (const d of customTherapyMachines) defsById.set(String((d as any).id), d)
      for (const d of presetDefs) {
        const id = String((d as any)?.id || '')
        if (id && !defsById.has(id)) defsById.set(id, d)
      }
      const nextDefs = Array.from(defsById.values())
      const nextState = { ...customTherapyMachineState, ...(presetState as any) }
      saveCustomTherapyMachines(nextDefs as any, nextState as any)
    }
  }

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [confirmPatient, setConfirmPatient] = useState<null | { summary: string; patient: Patient; key: string }>(null)
  const [focusAfterConfirm, setFocusAfterConfirm] = useState<null | 'phone' | 'name'>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const skipLookupKeyRef = useRef<string | null>(null)
  const lastPromptKeyRef = useRef<string | null>(null)
  const autoMrnAppliedRef = useRef<boolean>(false)
  const [selectPatientOpen, setSelectPatientOpen] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<Patient[]>([])
  const lastPhonePromptRef = useRef<string | null>(null)
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  function applyPatientToForm(p: Patient) {
    setSelectedPatient(p)
    setPatientId(p._id || '')
    setFullName(p.fullName || '')
    setPhone(p.phoneNormalized || (p as any).phone || '')
    setAge(p.age || '')
    setMrn(p.mrn || '')
    if (p.gender) setGender(String(p.gender))
    setGuardianName(p.fatherName || '')
    if (p.guardianRel) {
      const g = String(p.guardianRel).toUpperCase()
      const mapped = g === 'FATHER' || g === 'S/O' || g === 'SON' ? 'S/O' : g === 'MOTHER' || g === 'D/O' || g === 'DAUGHTER' ? 'D/O' : g
      setGuardianRel(mapped)
    }
    setAddress(p.address || '')
    setCnic(p.cnicNormalized || (p as any).cnicNormalized || p.cnic || (p as any).cnic || '')
  }

  async function runPhoneLookup(digits: string, { open }: { open: boolean }) {
    const d = String(digits || '').replace(/\D+/g, '')
    if (!d) {
      setPhoneMatches([])
      setPhoneLookupLoading(false)
      setPhoneLookupSearchedDigits('')
      if (open) setSelectPatientOpen(false)
      return
    }
    setPhoneLookupLoading(true)
    setPhoneLookupSearchedDigits(d)
    const seq = ++phoneLookupSeqRef.current
    try {
      const r: any = await therapyApi.searchPatients({ phone: d, limit: 25 } as any)
      if (seq !== phoneLookupSeqRef.current) return
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      setPhoneMatches(list)
      if (open) setSelectPatientOpen(list.length >= 1)
    } catch {
      if (seq !== phoneLookupSeqRef.current) return
      setPhoneMatches([])
      if (open) setSelectPatientOpen(false)
    } finally {
      if (seq !== phoneLookupSeqRef.current) return
      setPhoneLookupLoading(false)
    }
  }

  function schedulePhoneLookup(rawPhone: string, { open }: { open: boolean }) {
    const digits = String(rawPhone || '').replace(/\D+/g, '')
    try {
      if (digits) localStorage.setItem(phoneStorageKey, digits)
      else localStorage.removeItem(phoneStorageKey)
    } catch { }

    if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current)
    if (!digits) {
      setPhoneMatches([])
      setPhoneLookupLoading(false)
      setPhoneLookupSearchedDigits('')
      if (open) setSelectPatientOpen(false)
      return
    }
    phoneLookupTimerRef.current = setTimeout(() => {
      runPhoneLookup(digits, { open })
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current)
    }
  }, [])

  useEffect(() => {
    let stored = ''
    try { stored = String(localStorage.getItem(phoneStorageKey) || '').trim() } catch { }
    const digits = stored.replace(/\D+/g, '')
    if (!digits) return
    setPhone(prev => {
      const cur = String(prev || '').replace(/\D+/g, '')
      if (cur) return prev
      return digits
    })
    setTimeout(() => {
      runPhoneLookup(digits, { open: true })
    }, 0)
  }, [])

  const [account, setAccount] = useState<{ dues: number; advance: number } | null>(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const [payPreviousDues, setPayPreviousDues] = useState(false)
  const [useAdvance, setUseAdvance] = useState(false)
  const [amountReceivedNow, setAmountReceivedNow] = useState('0')

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          if (!selectedPatient?._id) {
            if (!cancelled) setAccount({ dues: 0, advance: 0 })
            return
          }
          if (!cancelled) setAccountLoading(true)
          const res: any = await therapyApi.getAccount(String(selectedPatient._id))
          const a: any = res?.account || null
          const dues = Math.max(0, Number(a?.dues || 0))
          const advance = Math.max(0, Number(a?.advance || 0))
          if (!cancelled) {
            setAccount({ dues, advance })
            if (dues <= 0) setPayPreviousDues(false)
            if (advance <= 0) setUseAdvance(false)
          }
        } catch {
          if (!cancelled) setAccount({ dues: 0, advance: 0 })
        } finally {
          if (!cancelled) setAccountLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [selectedPatient?._id])

  async function lookupExistingByPhoneAndName(source: 'phone' | 'name' = 'phone') {
    const digits = normPhone(phone)
    const nameEntered = (fullName || '').trim()
    if (!digits || !nameEntered) return

    const key = `${digits}|${normName(nameEntered)}`
    if (skipLookupKeyRef.current === key || lastPromptKeyRef.current === key) return

    const res: any = await therapyApi.searchPatients({ phone: digits, name: nameEntered, limit: 25 } as any)
    const list: any[] = Array.isArray(res?.patients) ? res.patients : []
    if (!list.length) return
    const p = (list as any[]).find((x) => normName((x as any).fullName || '') === normName(nameEntered))
    if (!p) return

    const summary = [
      `Found existing patient. Apply details?`,
      `MRN: ${p.mrn || '-'}`,
      `Name: ${p.fullName || '-'}`,
      `Phone: ${p.phoneNormalized || digits}`,
      `Age: ${p.age ?? (age?.trim() || '-')}`,
      p.gender ? `Gender: ${p.gender}` : null,
      p.address ? `Address: ${p.address}` : null,
      p.fatherName ? `Guardian: ${p.fatherName}` : null,
      `Guardian Relation: ${p.guardianRel || (guardianRel || '-')}`,
      p.cnicNormalized ? `CNIC: ${p.cnicNormalized}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    setTimeout(() => {
      setFocusAfterConfirm(source)
      lastPromptKeyRef.current = key
      setConfirmPatient({ summary, patient: p, key })
    }, 0)
  }

  async function onPhoneBlur() {
    const ph = phone?.trim()
    if (!ph) return
    const digits = normPhone(ph)
    if (!digits) return

    if (lastPhonePromptRef.current === digits) {
      if ((fullName || '').trim()) {
        await lookupExistingByPhoneAndName('phone')
      }
      return
    }

    const res: any = await therapyApi.searchPatients({ phone: digits, limit: 25 } as any)
    const list: any[] = Array.isArray(res?.patients) ? res.patients : []
    if (list.length >= 1) {
      lastPhonePromptRef.current = digits
      setPhoneMatches(list as any)
      setSelectPatientOpen(true)
      return
    }

    if ((fullName || '').trim()) {
      await lookupExistingByPhoneAndName('phone')
    }
  }

  useEffect(() => {
    try {
      const st = navState || {}
      if (st?.patient) {
        const p = st.patient
        if (p.fullName) setFullName(String(p.fullName))
        if (p.phone) setPhone(String(p.phone))
        if (p.gender) setGender(String(p.gender))
        if (p.address) setAddress(String(p.address))
        if (p.fatherName) setGuardianName(String(p.fatherName))
        if (p.guardianRelation) setGuardianRel(String(p.guardianRelation))
        if (p.cnic) setCnic(String(p.cnic))
        if (p.mrn) setMrn(String(p.mrn))
        if (p.age) setAge(String(p.age))

        if (p.mrn && !selectedPatient && !autoMrnAppliedRef.current) {
          const code = String(p.mrn || '').trim()
          if (code) {
            ; (async () => {
              try {
                const r: any = await therapyApi.getPatientByMrn(code)
                const pat: any = r?.patient || null
                if (pat) {
                  applyPatientToForm(pat as any)
                  autoMrnAppliedRef.current = true
                }
              } catch { }
            })()
          }
        }
      }
      if (st?.fromReferralId) setFromReferralId(String(st.fromReferralId))
      if (st?.referringConsultant) setReferringConsultant(String(st.referringConsultant))

      if (st?.requestedPackages && Array.isArray(st.requestedPackages) && packages.length > 0) {
        const pkgNames = st.requestedPackages.map((n: any) => String(n).trim().toLowerCase())
        const found = packages.find(p => pkgNames.includes(String(p.packageName || '').trim().toLowerCase()))
        if (found) {
          setSelectedPackageId(String(found._id))
          if (found.machinePreset) {
            applyMachinePreset(found.machinePreset)
          }
        }
      }
    } catch { }
  }, [location?.key, packages])

  const selectedMachines = useMemo(() => {
    const rows: Array<{ id: string; name: string; details?: any }> = []

    for (const k of FIXED_THERAPY_MACHINE_KEYS) {
      const st: any = (therapyMachines as any)[k]
      if (st?.enabled) {
        const details: any = {}
        Object.keys(st).forEach(key => {
          if (key !== 'enabled' && st[key] === true) {
            details[key] = true
          } else if (key === 'note' && st[key]) {
            details[key] = st[key]
          }
        })
        rows.push({ id: k, name: therapyMachineLabel(k), details })
      }
    }

    for (const m of customTherapyMachines) {
      const st = customTherapyMachineState[m.id] || { enabled: false }
      if (st.enabled) {
        const details: any = {}
        if (st.checks) details.checks = st.checks
        if (st.fields) details.fields = st.fields
        rows.push({ id: m.id, name: m.name, details })
      }
    }

    return rows
  }, [therapyMachines, customTherapyMachines, customTherapyMachineState])

  const subtotal = useMemo(() => {
    const pkgPrice = Number((selectedPackage as any)?.price || 0)
    return pkgPrice
  }, [selectedPackage])
  const [discount, setDiscount] = useState('0')
  const [discountType, setDiscountType] = useState<'PKR' | '%'>('PKR')
  const calculatedDiscount = useMemo(() => {
    if (discountType === '%') {
      return subtotal * (Number(discount) / 100)
    }
    return Number(discount) || 0
  }, [subtotal, discount, discountType])
  const net = Math.max(0, subtotal - calculatedDiscount)

  const paymentPreview = useMemo(() => {
    const duesBefore = Math.max(0, Number(account?.dues || 0))
    const advanceBefore = Math.max(0, Number(account?.advance || 0))
    const received = Math.max(0, Number(amountReceivedNow || 0))

    let advanceApplied = 0
    let netDueToday = net
    let advanceLeft = advanceBefore
    if (useAdvance) {
      advanceApplied = Math.min(advanceBefore, netDueToday)
      netDueToday = Math.max(0, netDueToday - advanceApplied)
      advanceLeft = Math.max(0, advanceBefore - advanceApplied)
    }

    let amt = received
    let duesPaidLocal = 0
    let paidForTodayLocal = 0
    let advanceAddedLocal = 0
    let duesAfter = duesBefore

    if (payPreviousDues) {
      duesPaidLocal = Math.min(duesAfter, amt)
      duesAfter = Math.max(0, duesAfter - duesPaidLocal)
      amt -= duesPaidLocal
    }

    paidForTodayLocal = Math.min(netDueToday, amt)
    netDueToday = Math.max(0, netDueToday - paidForTodayLocal)
    amt -= paidForTodayLocal

    advanceAddedLocal = Math.max(0, amt)
    duesAfter = duesAfter + netDueToday
    const advanceAfter = advanceLeft + advanceAddedLocal

    return {
      duesBefore,
      advanceBefore,
      advanceApplied,
      amountReceived: received,
      duesPaid: duesPaidLocal,
      paidForToday: paidForTodayLocal,
      advanceAdded: advanceAddedLocal,
      duesAfter,
      advanceAfter,
    }
  }, [account?.dues, account?.advance, amountReceivedNow, useAdvance, payPreviousDues, net])

  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<TherapyLabTokenSlipData | null>(null)

  const [billingType, setBillingType] = useState<'Cash' | 'Card'>('Cash')
  const [accountNumberIban, setAccountNumberIban] = useState('')
  const [receptionistName, setReceptionistName] = useState('')
  const [receivedToAccountCode, setReceivedToAccountCode] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid')
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const hApi = (await import('../../utils/api')).hospitalApi
        const [mineRes, bankRes, pettyRes] = await Promise.all([
          hApi.myPettyCash(),
          hApi.listBankAccounts(),
          hApi.listPettyCashAccounts(),
        ]) as any

        const opts: Array<{ code: string; label: string }> = []
        const seen = new Set<string>()
        const add = (code?: string, label?: string) => {
          const c = String(code || '').trim().toUpperCase()
          if (!c) return
          if (seen.has(c)) return
          seen.add(c)
          opts.push({ code: c, label: String(label || c) })
        }

        const myCode = String(mineRes?.account?.code || '').trim().toUpperCase()
        if (myCode) {
          add(myCode, `${mineRes?.account?.name || 'My Petty Cash'} (${myCode})`)
        }

        const petty: any[] = pettyRes?.accounts || []
        for (const p of petty) {
          const code = String(p?.code || '').trim().toUpperCase()
          if (!code) continue
          const rs = String(p?.responsibleStaff || '').trim()
          if (rs) continue
          if (String(p?.status || 'Active') !== 'Active') continue
          add(code, `${String(p?.name || code).trim()} (${code})`)
        }

        const banks: any[] = bankRes?.accounts || []
        for (const b of banks) {
          const an = String(b?.accountNumber || '')
          const last4 = an ? an.slice(-4) : ''
          const code = String(b?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
          if (!code) continue
          const bankLabel = `${String(b?.bankName || '').trim()} - ${String(b?.accountTitle || '').trim()}${last4 ? ` (${last4})` : ''}`.trim()
          add(code, bankLabel ? `${bankLabel} (${code})` : code)
        }

        if (mounted) {
          setPayToAccounts(opts)
          const storedPayTo = localStorage.getItem('therapyLab.receivedToAccountCode')
          if (storedPayTo) setReceivedToAccountCode(storedPayTo)
          else if (myCode) setReceivedToAccountCode(myCode)
        }
      } catch {
        if (mounted) setPayToAccounts([])
      }
    })()
    return () => { mounted = false }
  }, [])

  const generateToken = async () => {
    if (!fullName.trim() || !phone.trim() || selectedMachines.length === 0) return

    try {
      let patient = selectedPatient

      if (!patient?._id) {
        const r: any = await therapyApi.findOrCreatePatient({
          fullName: fullName.trim(),
          guardianName: guardianName || undefined,
          phone: phone || undefined,
          cnic: cnic || undefined,
          gender: gender || undefined,
          address: address || undefined,
          age: age || undefined,
          guardianRel: guardianRel || undefined,
        })

        if (r?.needSelection && Array.isArray(r?.matches)) {
          setPhoneMatches(r.matches)
          setSelectPatientOpen(true)
          return
        }

        patient = (r?.patient || null) as any
        if (patient) applyPatientToForm(patient as any)
      }

      if (!patient?._id) throw new Error('Failed to resolve patient')

      // Keep backend patient record in sync with form edits
      try {
        const patch: any = {}
        if ((fullName || '') !== (patient!.fullName || '')) patch.fullName = fullName
        if ((guardianName || '') !== (patient!.fatherName || '')) patch.fatherName = guardianName
        if ((gender || '') !== (patient!.gender || '')) patch.gender = gender
        if ((address || '') !== (patient!.address || '')) patch.address = address
        if ((phone || '') !== (patient!.phoneNormalized || '')) patch.phone = phone
        if ((cnic || '') !== (patient!.cnicNormalized || '')) patch.cnic = cnic
        if (Object.keys(patch).length) {
          const upd: any = await therapyApi.updatePatient(String(patient._id), patch)
          const p2 = upd?.patient || patient
          patient = p2
          applyPatientToForm(p2)
        }
      } catch { }

      const slipRows = selectedMachines.map((m) => ({ name: m.name, details: m.details }))

      const visitRes: any = await therapyApi.createVisit({
        patientId: String(patient!._id),
        patient: {
          mrn: patient!.mrn || undefined,
          fullName: fullName.trim(),
          phone: phone.trim(),
          age: age || undefined,
          gender: gender || undefined,
          address: address || undefined,
          guardianRelation: guardianRel || undefined,
          guardianName: guardianName || undefined,
          cnic: cnic || undefined,
        },
        packageId: selectedPackage ? String((selectedPackage as any)._id) : undefined,
        packageName: selectedPackage ? String((selectedPackage as any).packageName || '') : undefined,
        tests: selectedMachines.map((m) => ({ id: m.id, name: m.name, details: m.details })),
        subtotal,
        discount: Number(discount) || 0,
        discountType: discountType || 'PKR',
        net,
        paymentStatus,
        paymentMethod: paymentStatus === 'paid' ? billingType : undefined,
        accountNumberIban: (paymentStatus === 'paid' && billingType === 'Card') ? accountNumberIban : undefined,
        receivedToAccountCode: paymentStatus === 'paid' ? receivedToAccountCode : undefined,
        receptionistName: receptionistName || undefined,
        payPreviousDues,
        useAdvance,
        amountReceived: paymentStatus === 'paid' ? Math.max(0, Number(amountReceivedNow || 0)) : 0,
        fromReferralId: fromReferralId || undefined,
        referringConsultant: referringConsultant || undefined,
      })

      const v: any = visitRes?.visit || null
      const a: any = visitRes?.account || null

      if (v && a) {
        setAccount({ dues: Math.max(0, Number(a?.dues || 0)), advance: Math.max(0, Number(a?.advance || 0)) })
      }

      const data: TherapyLabTokenSlipData = {
        tokenNo: String(v?.tokenNo || ''),
        patientName: fullName.trim(),
        phone: phone.trim(),
        age: age || undefined,
        gender: gender || undefined,
        mrn: patient!.mrn || undefined,
        guardianRel: guardianRel || undefined,
        guardianName: guardianName || undefined,
        cnic: cnic || undefined,
        address: address || undefined,
        tests: slipRows,
        subtotal,
        discount: Number(v?.discount ?? discount ?? 0),
        discountType: v?.discountType ?? discountType ?? 'PKR',
        payable: Number(v?.net ?? net ?? 0),
        paymentStatus: v?.paymentStatus || paymentStatus,
        paymentMethod: v?.paymentMethod || billingType,
        accountNumberIban: v?.accountNumberIban || accountNumberIban,
        receivedToAccountCode: v?.receivedToAccountCode || receivedToAccountCode,
        receptionistName: v?.receptionistName || receptionistName,
        amountReceived: Number(v?.amountReceived ?? (paymentStatus === 'paid' ? amountReceivedNow : 0)),
        payPreviousDues,
        useAdvance,
        advanceApplied: Number(v?.advanceApplied || 0),
        duesBefore: Number(v?.duesBefore || 0),
        advanceBefore: Number(v?.advanceBefore || 0),
        duesPaid: Number(v?.duesPaid || 0),
        paidForToday: Number(v?.paidForToday || 0),
        advanceAdded: Number(v?.advanceAdded || 0),
        duesAfter: Number(v?.duesAfter || 0),
        advanceAfter: Number(v?.advanceAfter || 0),
        createdAt: String(v?.createdAtIso || v?.createdAt || ''),
      }

      setSlipData(data)
      setSlipOpen(true)
      showToast('success', 'Token generated')
    } catch (e: any) {
      alert(e?.message || 'Failed to create order')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Patient Information</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">MR #</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 bg-slate-50 text-slate-600 outline-none" value={mrn || 'auto'} disabled readOnly />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              placeholder="Enter 11-digit phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                skipLookupKeyRef.current = null
                lastPromptKeyRef.current = null
                lastPhonePromptRef.current = null
                schedulePhoneLookup(e.target.value, { open: true })
              }}
              onBlur={onPhoneBlur}
              ref={phoneRef}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                skipLookupKeyRef.current = null
                lastPromptKeyRef.current = null
              }}
              onBlur={() => lookupExistingByPhoneAndName('name')}
              ref={nameRef}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              placeholder="e.g., 25"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Guardian</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              value={guardianRel}
              onChange={(e) => setGuardianRel(e.target.value)}
            >
              <option value="">S/O or D/O</option>
              <option value="S/O">S/O</option>
              <option value="D/O">D/O</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Name</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              placeholder="Father/Guardian Name"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">CNIC</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              placeholder="13-digit CNIC (no dashes)"
              value={cnic}
              onChange={(e) => setCnic(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              rows={3}
              placeholder="Residential Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Select Package</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Package</label>
            <select
              value={selectedPackageId}
              onChange={(e) => {
                const id = e.target.value
                setSelectedPackageId(id)
                const pkg = packages.find((p) => String(p._id) === String(id)) || null
                if (pkg?.machinePreset) applyMachinePreset(pkg.machinePreset)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              disabled={packagesLoading}
            >
              <option value="">Select package</option>
              {packages.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.packageName ? `${p.packageName} (${p.package})` : String(p.package)} - PKR {Number(p.price || 0).toLocaleString()}
                </option>
              ))}
            </select>
            {packagesError && <div className="mt-1 text-xs text-rose-600">{packagesError}</div>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Price</label>
            <input
              value={selectedPackage ? `PKR ${Number(selectedPackage.price || 0).toLocaleString()}` : ''}
              readOnly
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2"
              placeholder={packagesLoading ? 'Loading...' : 'Select a package'}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-base font-semibold text-slate-800">
          <div>Select Machine</div>
          <button
            type="button"
            onClick={() => setIsTherapyMachineRestoreDialogOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
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
                <label className={`${checkboxCardLabelCls((therapyMachines as any).chi.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).chi.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        chi: e.target.checked ? { ...s.chi, enabled: true } : { enabled: false, pr: false, bk: false },
                      }))
                    }
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
              {(therapyMachines as any).chi.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).chi.pr} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, chi: { ...s.chi, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    PR
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).chi.bk} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, chi: { ...s.chi, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    BK
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('eswt') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).eswt.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).eswt.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        eswt: e.target.checked ? { ...s.eswt, enabled: true } : { enabled: false, v1000: false, v1500: false, v2000: false },
                      }))
                    }
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
              {(therapyMachines as any).eswt.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).eswt.v1000} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, eswt: { ...s.eswt, v1000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    1000
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).eswt.v1500} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, eswt: { ...s.eswt, v1500: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    1500
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).eswt.v2000} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, eswt: { ...s.eswt, v2000: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    2000
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('ms') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).ms.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).ms.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        ms: e.target.checked ? { ...s.ms, enabled: true } : { enabled: false, pr: false, bk: false },
                      }))
                    }
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
              {(therapyMachines as any).ms.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).ms.pr} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, ms: { ...s.ms, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    PR
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).ms.bk} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, ms: { ...s.ms, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    BK
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('mam') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).mam.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).mam.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        mam: e.target.checked ? { ...s.mam, enabled: true } : { enabled: false, m: false },
                      }))
                    }
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
              {(therapyMachines as any).mam.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).mam.m} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mam: { ...s.mam, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    M
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('us') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).us.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).us.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        us: e.target.checked ? { ...s.us, enabled: true } : { enabled: false, pr: false, bk: false },
                      }))
                    }
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
              {(therapyMachines as any).us.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).us.pr} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, us: { ...s.us, pr: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    PR
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).us.bk} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, us: { ...s.us, bk: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    BK
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('mcgSpg') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).mcgSpg.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).mcgSpg.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        mcgSpg: e.target.checked ? { ...s.mcgSpg, enabled: true } : { enabled: false, dashBar: false, equal: false },
                      }))
                    }
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
              {(therapyMachines as any).mcgSpg.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).mcgSpg.dashBar} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mcgSpg: { ...s.mcgSpg, dashBar: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    --|
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).mcgSpg.equal} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mcgSpg: { ...s.mcgSpg, equal: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    =
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('mproCryo') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).mproCryo.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).mproCryo.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        mproCryo: e.target.checked ? { ...s.mproCryo, enabled: true } : { enabled: false, m: false, c: false },
                      }))
                    }
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
              {(therapyMachines as any).mproCryo.enabled && (
                <div className="ml-7 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).mproCryo.m} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mproCryo: { ...s.mproCryo, m: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    M
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={(therapyMachines as any).mproCryo.c} onChange={(e) => setTherapyMachines((s: any) => ({ ...s, mproCryo: { ...s.mproCryo, c: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300" />
                    C
                  </label>
                </div>
              )}
            </>
          )}

          {!hiddenTherapyMachinesSet.has('ximen') && (
            <>
              <div className="flex items-center gap-2">
                <label className={`${checkboxCardLabelCls((therapyMachines as any).ximen.enabled)} flex-1`}>
                  <input
                    type="checkbox"
                    checked={(therapyMachines as any).ximen.enabled}
                    onChange={(e) =>
                      setTherapyMachines((s: any) => ({
                        ...s,
                        ximen: e.target.checked ? { ...s.ximen, enabled: true } : { enabled: false, note: '' },
                      }))
                    }
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
              {(therapyMachines as any).ximen.enabled && (
                <div className="ml-7">
                  <input
                    value={(therapyMachines as any).ximen.note}
                    onChange={(e) => setTherapyMachines((s: any) => ({ ...s, ximen: { ...s.ximen, note: e.target.value } }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Enter"
                  />
                </div>
              )}
            </>
          )}

          {customTherapyMachines.map((m) => {
            const st = customTherapyMachineState[m.id] || { enabled: false }
            const checked = !!st.enabled
            return (
              <div key={m.id}>
                <div className="flex items-center gap-2">
                  <label className={`${checkboxCardLabelCls(checked)} flex-1`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const enabled = e.target.checked
                        setCustomTherapyMachineState((s) => {
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
                    {(m.options || []).filter(Boolean).map((opt) => {
                      const isChecked = !!st.checks?.[opt]
                      return (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const v = e.target.checked
                              setCustomTherapyMachineState((s) => {
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
                    {(m.fields || []).filter(Boolean).map((fld) => {
                      const val = st.fields?.[fld] || ''
                      return (
                        <div key={fld}>
                          <label className="mb-1 block text-sm text-slate-700">{fld}</label>
                          <input
                            value={val}
                            onChange={(e) => {
                              const v = e.target.value
                              setCustomTherapyMachineState((s) => {
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Billing Summary</div>
        <div className="mt-3 divide-y divide-slate-200 text-sm">
          {selectedMachines.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between py-2 gap-2">
              <div className="font-medium">{m.name}</div>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <div className="text-slate-600">Subtotal</div>
            <div className="font-medium">PKR {subtotal.toLocaleString()}</div>
          </div>
          <div className="flex flex-wrap items-center justify-between py-2 gap-2">
            <div className="text-slate-600">Discount</div>
            <div className="flex items-center gap-2">
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-right"
                placeholder="0"
              />
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'PKR' | '%')}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="PKR">PKR</option>
                <option value="%">%</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 font-bold text-lg text-slate-900 border-t border-slate-300 mt-1 pt-3">
            <div>Net Amount</div>
            <div>PKR {net.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-800">Payment & Account</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-slate-200 bg-white p-2">
                  <div className="text-[10px] font-medium uppercase text-slate-500">Prev. Dues</div>
                  <div className="text-sm font-bold text-rose-600">{accountLoading ? '...' : `PKR ${Number(account?.dues || 0).toLocaleString()}`}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2">
                  <div className="text-[10px] font-medium uppercase text-slate-500">Prev. Advance</div>
                  <div className="text-sm font-bold text-emerald-600">{accountLoading ? '...' : `PKR ${Number(account?.advance || 0).toLocaleString()}`}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="paid">PAID</option>
                  <option value="unpaid">UNPAID</option>
                </select>
              </div>

              {paymentStatus === 'paid' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Method</label>
                      <select
                        value={billingType}
                        onChange={(e) => setBillingType(e.target.value as any)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Amount Received</label>
                      <input
                        value={amountReceivedNow}
                        onChange={(e) => setAmountReceivedNow(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-blue-700"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {billingType === 'Card' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Card/IBAN Details</label>
                      <input
                        value={accountNumberIban}
                        onChange={(e) => setAccountNumberIban(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Last 4 digits or IBAN"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Receive To (Account)</label>
                    <select
                      value={receivedToAccountCode}
                      onChange={(e) => {
                        const v = e.target.value
                        setReceivedToAccountCode(v)
                        localStorage.setItem('therapyLab.receivedToAccountCode', v)
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select Account</option>
                      {payToAccounts.map((a) => (
                        <option key={a.code} value={a.code}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-blue-800">Settlement Preview</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Current Net</span>
                    <span className="font-medium">PKR {net.toLocaleString()}</span>
                  </div>
                  {paymentStatus === 'paid' && (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={payPreviousDues}
                          onChange={(e) => setPayPreviousDues(e.target.checked)}
                          disabled={Number(account?.dues || 0) <= 0}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-700">Pay Previous Dues</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={useAdvance}
                          onChange={(e) => setUseAdvance(e.target.checked)}
                          disabled={Number(account?.advance || 0) <= 0}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-700">Use Advance</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-blue-200 pt-2">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Dues After</span>
                      <span className={paymentPreview.duesAfter > 0 ? 'text-rose-600' : ''}>PKR {paymentPreview.duesAfter.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Advance After</span>
                      <span className="text-emerald-600">PKR {paymentPreview.advanceAfter.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Receptionist Name (Optional)</label>
                <input
                  value={receptionistName}
                  onChange={(e) => setReceptionistName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setFullName('')
              setPhone('')
              setAge('')
              setGender('')
              setGuardianRel('')
              setGuardianName('')
              setCnic('')
              setAddress('')
              setMrn('')
              setPatientId('')
              setSelectedPatient(null)
              setSelectedPackageId('')
              setTherapyMachines(getEmptyTherapyMachines())
              setCustomTherapyMachineState({})
              setDiscount('0')
              setAmountReceivedNow('0')
              setPayPreviousDues(false)
              setUseAdvance(false)
              setAccountNumberIban('')
              setReceptionistName('')
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            onClick={generateToken}
            disabled={!fullName || !phone || selectedMachines.length === 0}
            className="rounded-md bg-violet-700 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-40"
          >
            Generate & Print Token
          </button>
        </div>
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
                    const nextDefs = customTherapyMachines.filter((x) => x.id !== d.key)
                    const nextState = { ...customTherapyMachineState }
                    delete (nextState as any)[d.key]
                    saveCustomTherapyMachines(nextDefs, nextState)
                  } else {
                    saveHiddenTherapyMachines([...hiddenTherapyMachines, d.key])
                    setTherapyMachines((s: any) => ({ ...s, [d.key]: (getEmptyTherapyMachines() as any)[d.key] }))
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
                  onChange={(e) => setTherapyMachineAddName(e.target.value)}
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
                      onClick={() => setTherapyMachineAddOptions((s) => [...s, ''])}
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
                          onChange={(e) => setTherapyMachineAddOptions((s) => s.map((x, i) => (i === idx ? e.target.value : x)))}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Option name"
                        />
                        <button
                          type="button"
                          onClick={() => setTherapyMachineAddOptions((s) => (s.length <= 1 ? [''] : s.filter((_, i) => i !== idx)))}
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
                      onClick={() => setTherapyMachineAddFields((s) => [...s, ''])}
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
                          onChange={(e) => setTherapyMachineAddFields((s) => s.map((x, i) => (i === idx ? e.target.value : x)))}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Field name"
                        />
                        <button
                          type="button"
                          onClick={() => setTherapyMachineAddFields((s) => (s.length <= 1 ? [''] : s.filter((_, i) => i !== idx)))}
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
                    {hiddenTherapyMachines.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          saveHiddenTherapyMachines(hiddenTherapyMachines.filter((x) => x !== k))
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
                    const options = Array.from(new Set(therapyMachineAddOptions.map((s) => String(s || '').trim()).filter(Boolean)))
                    const def = { id, name, kind: 'checkboxes' as const, options }
                    const nextDefs = [...customTherapyMachines, def]
                    const nextState = { ...customTherapyMachineState, [id]: { enabled: true, checks: {} as Record<string, boolean> } }
                    saveCustomTherapyMachines(nextDefs, nextState)
                  } else {
                    const fields = Array.from(new Set(therapyMachineAddFields.map((s) => String(s || '').trim()).filter(Boolean)))
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

      {slipOpen && slipData && <TherapyLab_TokenSlip open={slipOpen} onClose={() => setSlipOpen(false)} data={slipData} />}

      {selectPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Select Patient</div>
              <button
                onClick={() => {
                  setSelectPatientOpen(false)
                  setPhoneMatches([])
                  setTimeout(() => phoneRef.current?.focus(), 0)
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="mb-3 text-sm text-slate-600">
                {phoneLookupLoading
                  ? `Searching registered patients for ${phoneLookupSearchedDigits || phone.replace(/\D+/g, '')}...`
                  : (phoneMatches.length > 0
                    ? `Found ${phoneMatches.length} patients on this phone number. Select one to autofill.`
                    : `No registered patients found for ${phoneLookupSearchedDigits || phone.replace(/\D+/g, '')}.`)
                }
              </div>

              {!phoneLookupLoading && phoneMatches.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  You can continue by entering a new patient.
                </div>
              )}

              {phoneMatches.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {phoneMatches.map((p, idx) => (
                    <button
                      key={p._id || p.mrn || idx}
                      type="button"
                      onClick={() => {
                        applyPatientToForm(p)
                        setSelectPatientOpen(false)
                        setPhoneMatches([])
                        showToast('success', 'Patient selected and autofilled')
                      }}
                      className="w-full rounded-lg border border-slate-200 p-4 text-left hover:border-violet-300 hover:bg-violet-50"
                    >
                      <div className="text-sm font-semibold text-slate-800">{p.fullName || 'Unnamed'}</div>
                      <div className="mt-1 text-xs text-slate-600">MRN: {p.mrn || '-'}</div>
                      <div className="mt-1 text-xs text-slate-600">Phone: {p.phoneNormalized || phone}</div>
                      {(p.age != null || p.gender) && (
                        <div className="mt-1 text-xs text-slate-600">
                          {p.age != null ? `Age: ${p.age}` : ''}{p.age != null && p.gender ? ' • ' : ''}{p.gender ? `Gender: ${p.gender}` : ''}
                        </div>
                      )}
                      {p.address && <div className="mt-1 line-clamp-2 text-xs text-slate-600">Address: {p.address}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setSelectPatientOpen(false)
                  setPhoneMatches([])
                  setTimeout(() => nameRef.current?.focus(), 0)
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Enter New Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">Confirm Patient</div>
            <div className="px-5 py-4 text-sm whitespace-pre-wrap text-slate-700">{confirmPatient.summary}</div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={() => {
                  if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key
                  setConfirmPatient(null)
                  setTimeout(() => {
                    if (focusAfterConfirm === 'phone') phoneRef.current?.focus()
                    else if (focusAfterConfirm === 'name') nameRef.current?.focus()
                    setFocusAfterConfirm(null)
                  }, 0)
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const p = confirmPatient.patient
                  try {
                    setSelectedPatient(p)
                    setFullName(p.fullName || '')
                    setPhone(p.phoneNormalized || '')
                    setAge((p.age != null && p.age !== '') ? String(p.age) : '')
                    if (p.gender) setGender(String(p.gender))
                    setGuardianName(p.fatherName || '')
                    if (p.guardianRel) setGuardianRel(String(p.guardianRel))
                    setAddress(p.address || '')
                    setCnic(p.cnicNormalized || p.cnic || '')
                  } finally {
                    if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key
                    setConfirmPatient(null)
                  }
                }}
                className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
