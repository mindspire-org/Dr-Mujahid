import { useMemo, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Diagnostic_TokenSlip from '../../components/diagnostic/Diagnostic_TokenSlip'
import type { DiagnosticTokenSlipData } from '../../components/diagnostic/Diagnostic_TokenSlip'
import { diagnosticApi, corporateApi, hospitalApi } from '../../utils/api'

export default function Diagnostic_TokenGenerator() {
  const location = useLocation() as any
  const navState = (location && (location.state || null)) || null
  // Patient details
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [guardianRel, setGuardianRel] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [cnic, setCnic] = useState('')
  const [address, setAddress] = useState('')
  const [mrn, setMrn] = useState('')

  // Selected existing patient (from Lab_Patient collection)
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)
  const [confirmPatient, setConfirmPatient] = useState<null | { summary: string; patient: any; key: string }>(null)
  const [focusAfterConfirm, setFocusAfterConfirm] = useState<null | 'phone' | 'name'>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const skipLookupKeyRef = useRef<string | null>(null)
  const lastPromptKeyRef = useRef<string | null>(null)
  const autoMrnAppliedRef = useRef<boolean>(false)
  const [selectPatientOpen, setSelectPatientOpen] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<any[]>([])
  const lastPhonePromptRef = useRef<string | null>(null)
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }
  // Referral context (optional)
  const [fromReferralId, setFromReferralId] = useState<string>('')
  const [requestedTests, setRequestedTests] = useState<string[]>([])
  const [referringConsultant, setReferringConsultant] = useState('')
  const autoTestsAppliedRef = useRef<boolean>(false)

  // Tests (from backend)
  type Test = { id: string; name: string; price: number }
  const [tests, setTests] = useState<Test[]>([])
  const [testsLoading, setTestsLoading] = useState(false)
  const [testsLoadError, setTestsLoadError] = useState<string>('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [showTestDropdown, setShowTestDropdown] = useState(false)
  const testPickerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        if (mounted) { setTestsLoading(true); setTestsLoadError('') }
        try {
          const res = await diagnosticApi.listTests({ limit: 1000 }) as any
          const arr = (res?.items || res || []).map((t: any) => ({ id: String(t._id || t.id), name: t.name, price: Number(t.price || 0) }))
          if (mounted) setTests(arr)
        } catch (e: any) {
          if (mounted) {
            setTests([])
            setTestsLoadError(String(e?.message || 'Failed to load tests'))
          }
        } finally {
          if (mounted) setTestsLoading(false)
        }
      })()
    return () => { mounted = false }
  }, [])
  // Apply navState patient autofill and requested tests
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

        // If MRN is provided from referral context, fetch the canonical patient record and autofill
        if (p.mrn && !selectedPatient && !autoMrnAppliedRef.current) {
          const code = String(p.mrn || '').trim()
          if (code) {
            ; (async () => {
              try {
                const r: any = await diagnosticApi.getPatientByMrn(code)
                const pat = r?.patient || r
                if (!pat) return
                setSelectedPatient(pat)
                setFullName(pat.fullName || '')
                setPhone(pat.phoneNormalized || '')
                setAge((pat.age != null && pat.age !== '') ? String(pat.age) : '')
                if (pat.gender) setGender(String(pat.gender))
                setGuardianName(pat.fatherName || '')
                if (pat.guardianRel) {
                  const g = String(pat.guardianRel).toUpperCase()
                  const mapped = (g === 'FATHER' || g === 'S/O' || g === 'SON') ? 'S/O' : ((g === 'MOTHER' || g === 'D/O' || g === 'DAUGHTER') ? 'D/O' : g)
                  setGuardianRel(mapped)
                }
                setAddress(pat.address || '')
                setCnic(pat.cnicNormalized || pat.cnic || '')
                setMrn(pat.mrn || '')
                autoMrnAppliedRef.current = true
              } catch { }
            })()
          }
        }
      }
      if (Array.isArray(st?.requestedTests) && st.requestedTests.length > 0) {
        setRequestedTests(st.requestedTests.map((x: any) => String(x)))
      } else if (st?.fromReferralId && !autoTestsAppliedRef.current) {
        // Fetch the referral to get prescription tests
        autoTestsAppliedRef.current = true
        ;(async () => {
          try {
            const res: any = await hospitalApi.getReferral(String(st.fromReferralId))
            const ref = res?.referral
            // Try tests stored directly on referral first
            const directTests: string[] = Array.isArray(ref?.tests) ? ref.tests.map((x: any) => String(x)).filter(Boolean) : []
            if (directTests.length) { setRequestedTests(directTests); return }
            // Fall back to prescription's diagnosticTests
            const pres = ref?.prescriptionId
            const diagTests: string[] = Array.isArray(pres?.diagnosticTests) ? pres.diagnosticTests.map((x: any) => String(x)).filter(Boolean) : []
            if (diagTests.length) setRequestedTests(diagTests)
          } catch { }
        })()
      } else if (st?.prescriptionId && !autoTestsAppliedRef.current) {
        autoTestsAppliedRef.current = true
        ;(async () => {
          try {
            const res: any = await hospitalApi.getPrescription(String(st.prescriptionId))
            const pres = res?.prescription
            const diagTests: string[] = Array.isArray(pres?.diagnosticTests) ? pres.diagnosticTests.map((x: any) => String(x)).filter(Boolean) : []
            if (diagTests.length) setRequestedTests(diagTests)
          } catch { }
        })()
      }
      if (st?.fromReferralId) setFromReferralId(String(st.fromReferralId))
      if (st?.referringConsultant) setReferringConsultant(String(st.referringConsultant))
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.key])
  // When tests list is loaded or requestedTests changes, preselect those tests
  useEffect(() => {
    if (!requestedTests.length || !tests.length) return
    const normalize = (s: string) => String(s).trim().toLowerCase()
    const requested = requestedTests.map(normalize)
    const ids = tests
      .filter(t => {
        const tName = normalize(t.name)
        return requested.some(r => tName === r || tName.includes(r) || r.includes(tName))
      })
      .map(t => t.id)
    if (ids.length) {
      setSelected(prev => Array.from(new Set([...prev, ...ids])))
    }
  }, [requestedTests, tests])
  // Corporate billing (declare early so it's available to pricing helpers)
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  const [corpCompanyId, setCorpCompanyId] = useState('')
  const [corpPreAuthNo, setCorpPreAuthNo] = useState('')
  const [corpCoPayPercent, setCorpCoPayPercent] = useState('')
  const [corpCoverageCap, setCorpCoverageCap] = useState('')
  // Corporate effective pricing map for DIAG tests
  const [corpTestPriceMap, setCorpTestPriceMap] = useState<Record<string, number>>({})


  const getEffectivePrice = (id: string): number => {
    const base = Number((tests.find(t => t.id === id)?.price) || 0)
    if (!corpCompanyId) return base
    const v = corpTestPriceMap[id]
    return v != null ? v : base
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tests.filter(t => !selected.includes(t.id)).filter(t => !q || t.name.toLowerCase().includes(q)).slice(0, 30)
  }, [tests, query, selected])
  const selectedTests = useMemo(() => selected.map(id => tests.find(t => t.id === id)).filter(Boolean) as Test[], [selected, tests])
  const subtotal = useMemo(() => selectedTests.reduce((s, t) => s + getEffectivePrice(t.id), 0), [selectedTests, corpCompanyId, corpTestPriceMap])
  const [discount, setDiscount] = useState('0')
  const [discountType, setDiscountType] = useState<'PKR' | '%'>('PKR')
  const calculatedDiscount = useMemo(() => {
    if (discountType === '%') {
      return subtotal * (Number(discount) / 100)
    }
    return Number(discount) || 0
  }, [subtotal, discount, discountType])
  const net = Math.max(0, subtotal - calculatedDiscount)

  const [account, setAccount] = useState<{ dues: number; advance: number } | null>(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const [payPreviousDues, setPayPreviousDues] = useState(false)
  const [useAdvance, setUseAdvance] = useState(false)
  const [amountReceivedNow, setAmountReceivedNow] = useState('0')

  // Payment (declare early so paymentStatus is available to effects below)
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid')

  // Auto-fill amount received with net fee when payment status is paid
  useEffect(() => {
    if (paymentStatus === 'unpaid') {
      setAmountReceivedNow('0')
    } else {
      setAmountReceivedNow(net > 0 ? String(net) : '0')
    }
  }, [net, paymentStatus])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          if (!selectedPatient?._id) {
            if (!cancelled) setAccount({ dues: 0, advance: 0 })
            return
          }
          if (!cancelled) setAccountLoading(true)
          const res: any = await diagnosticApi.getAccount(String(selectedPatient._id))
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

  // Payment (mirrors Hospital token generator)
  const [receivedToAccountCode, setReceivedToAccountCode] = useState('')
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash')
  const [accountNumberIban, setAccountNumberIban] = useState('')

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const [mineRes, bankRes, pettyRes] = await Promise.all([
            hospitalApi.myPettyCash(),
            hospitalApi.listBankAccounts(),
            hospitalApi.listPettyCashAccounts(),
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
            
            // Determine auto-selection based on user's accounts
            const existing = String(receivedToAccountCode || '').trim()
            if (!existing) {
              // Get current user info from session
              let currentUsername = ''
              try {
                const session = JSON.parse(localStorage.getItem('hospital.session') || '{}')
                currentUsername = String(session?.username || '').trim()
              } catch {}
              
              // Find user's bank account (where responsibleStaff matches current user)
              const myBankAccount = banks.find((b: any) => {
                const rs = String(b?.responsibleStaff || '').trim().toLowerCase()
                return rs && rs === currentUsername.toLowerCase()
              })
              
              // Determine which account to auto-select
              const hasPettyCash = !!myCode
              const hasBankAccount = !!myBankAccount
              
              if (hasPettyCash) {
                // Priority 1: Petty cash (if user has it)
                setReceivedToAccountCode(myCode)
              } else if (hasBankAccount) {
                // Priority 2: Bank account (if user has only bank account)
                const an = String(myBankAccount?.accountNumber || '')
                const last4 = an ? an.slice(-4) : ''
                const bankCode = String(myBankAccount?.financeAccountCode || (last4 ? `BANK_${last4}` : '')).trim().toUpperCase()
                setReceivedToAccountCode(bankCode)
              }
            }
          }
        } catch {
          if (mounted) setPayToAccounts([])
        }
      })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (paymentStatus !== 'unpaid') return
    setPaymentMethod('Cash')
    setAccountNumberIban('')
    setAmountReceivedNow('0')
    setPayPreviousDues(false)
    setUseAdvance(false)
  }, [paymentStatus])

  // Corporate billing (load companies)
  // Recompute corporate pricing after corpCompanyId is declared
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!corpCompanyId) { setCorpTestPriceMap({}); return }
      try {
        const r = await corporateApi.listRateRules({ companyId: corpCompanyId, scope: 'DIAG' }) as any
        const rules: any[] = (r?.rules || []).filter((x: any) => x && x.active !== false)
        const today = new Date().toISOString().slice(0, 10)
        const valid = rules.filter((x: any) => (!x.effectiveFrom || String(x.effectiveFrom).slice(0, 10) <= today) && (!x.effectiveTo || today <= String(x.effectiveTo).slice(0, 10)))
        const def = valid.filter(x => x.ruleType === 'default').sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100))[0] || null
        const apply = (base: number, rule: any) => {
          const mode = rule?.mode; const val = Number(rule?.value || 0)
          if (mode === 'fixedPrice') return Math.max(0, val)
          if (mode === 'percentDiscount') return Math.max(0, base - (base * (val / 100)))
          if (mode === 'fixedDiscount') return Math.max(0, base - val)
          return base
        }
        const map: Record<string, number> = {}
        for (const t of tests) {
          const base = Number(t.price || 0)
          const specific = valid.filter(x => x.ruleType === 'test' && String(x.refId) === String(t.id)).sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100))[0] || null
          const rule = specific || def
          map[t.id] = rule ? apply(base, rule) : base
        }
        if (!cancelled) setCorpTestPriceMap(map)
      } catch { if (!cancelled) setCorpTestPriceMap({}) }
    }
    load()
    return () => { cancelled = true }
  }, [corpCompanyId, tests])
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await corporateApi.listCompanies() as any
          if (!mounted) return
          const arr = (res?.companies || []).map((c: any) => ({ id: String(c._id || c.id), name: c.name }))
          setCompanies(arr)
        } catch { }
      })()
    return () => { mounted = false }
  }, [])

  // Selected existing patient (from Lab_Patient collection)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = testPickerRef.current
      if (!el) return
      if (!el.contains(e.target as any)) setShowTestDropdown(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowTestDropdown(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function applyPatientToForm(p: any) {
    setSelectedPatient(p)
    setFullName(p.fullName || '')
    setPhone(p.phoneNormalized || '')
    setAge((p.age != null && p.age !== '') ? String(p.age) : '')
    if (p.gender) setGender(String(p.gender))
    setGuardianName(p.fatherName || '')
    if (p.guardianRel) {
      const g = String(p.guardianRel).toUpperCase()
      const mapped = (g === 'FATHER' || g === 'S/O' || g === 'SON') ? 'S/O' : ((g === 'MOTHER' || g === 'D/O' || g === 'DAUGHTER') ? 'D/O' : g)
      setGuardianRel(mapped)
    }
    setAddress(p.address || '')
    setCnic(p.cnicNormalized || p.cnic || '')
    setMrn(p.mrn || '')
  }

  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<DiagnosticTokenSlipData | null>(null)
  const [shouldPrint, setShouldPrint] = useState(false)

  const resetForm = () => {
    setFullName('')
    setPhone('')
    setAge('')
    setGender('')
    setGuardianRel('')
    setGuardianName('')
    setCnic('')
    setAddress('')
    setMrn('')
    setSelectedPatient(null)
    setSelected([])
    setQuery('')
    setDiscount('0')
    setDiscountType('PKR')
    setAmountReceivedNow('0')
    setPayPreviousDues(false)
    setUseAdvance(false)
    setCorpCompanyId('')
    setCorpPreAuthNo('')
    setCorpCoPayPercent('')
    setCorpCoverageCap('')
    setReferringConsultant('')
    setFromReferralId('')
    setRequestedTests([])
    autoMrnAppliedRef.current = false
    autoTestsAppliedRef.current = false
    lastPhonePromptRef.current = null
    lastPromptKeyRef.current = null
    skipLookupKeyRef.current = null
  }

  async function lookupExistingByPhoneAndName(source: 'phone' | 'name' = 'phone') {
    const digits = (phone || '').replace(/\D+/g, '')
    const nameEntered = (fullName || '').trim()
    if (!digits || !nameEntered) return
    try {
      const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
      const key = `${digits}|${norm(nameEntered)}`
      if (skipLookupKeyRef.current === key || lastPromptKeyRef.current === key) return
      const r: any = await diagnosticApi.searchPatients({ phone: digits, limit: 10 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (!list.length) return
      const p = list.find(x => norm(x.fullName) === norm(nameEntered))
      if (!p) return // no exact name match; don't prompt
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
      ].filter(Boolean).join('\n')
      setTimeout(() => { setFocusAfterConfirm(source); lastPromptKeyRef.current = key; setConfirmPatient({ summary, patient: p, key }) }, 0)
    } catch { }
  }

  async function onPhoneBlur() {
    const ph = phone?.trim()
    if (!ph) return
    const digits = (ph || '').replace(/\D+/g, '')
    if (!digits) return
    // Avoid repeated prompts for the same phone unless user changes the input
    if (lastPhonePromptRef.current === digits) {
      if ((fullName || '').trim()) { await lookupExistingByPhoneAndName('phone') }
      return
    }
    try {
      const r: any = await diagnosticApi.searchPatients({ phone: digits, limit: 25 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (list.length >= 1) {
        lastPhonePromptRef.current = digits
        setPhoneMatches(list)
        setSelectPatientOpen(true)
        return
      }
    } catch { }
    if ((fullName || '').trim()) { await lookupExistingByPhoneAndName('phone') }
  }

  const generateToken = async () => {
    if (!fullName.trim() || !phone.trim() || selectedTests.length === 0) return
    try {
      // Resolve patient in Lab_Patient collection
      let patient = selectedPatient
      if (patient) {
        const patch: any = {}
        if ((fullName || '') !== (patient.fullName || '')) patch.fullName = fullName
        if ((guardianName || '') !== (patient.fatherName || '')) patch.fatherName = guardianName
        if ((gender || '') !== (patient.gender || '')) patch.gender = gender
        if ((address || '') !== (patient.address || '')) patch.address = address
        if ((phone || '') !== (patient.phoneNormalized || '')) patch.phone = phone
        if ((cnic || '') !== (patient.cnicNormalized || '')) patch.cnic = cnic
        if (Object.keys(patch).length) {
          const upd = await diagnosticApi.updatePatient(String(patient._id), patch) as any
          patient = upd?.patient || patient
        }
      } else {
        const fr = await diagnosticApi.findOrCreatePatient({ fullName: fullName.trim(), guardianName: guardianName || undefined, phone: phone || undefined, cnic: cnic || undefined, gender: gender || undefined, address: address || undefined, age: age || undefined, guardianRel: guardianRel || undefined }) as any
        patient = fr?.patient
      }
      if (!patient?._id) throw new Error('Failed to resolve patient')

      // Create diagnostic order
      const testIds = selected
      const slipRows = selectedTests.map(t => ({ name: t.name, price: getEffectivePrice(t.id) }))
      const created = await diagnosticApi.createOrder({
        patientId: String(patient._id),
        patient: {
          mrn: patient.mrn || undefined,
          fullName: fullName.trim(),
          phone: phone || undefined,
          age: age || undefined,
          gender: gender || undefined,
          address: address || undefined,
          guardianRelation: guardianRel || undefined,
          guardianName: guardianName || undefined,
          cnic: cnic || undefined,
        },
        tests: testIds,
        subtotal,
        discount: Number(discount) || 0,
        discountType: discountType || 'PKR',
        net,
        payPreviousDues: paymentStatus === 'unpaid' ? false : payPreviousDues,
        useAdvance: paymentStatus === 'unpaid' ? false : useAdvance,
        amountReceived: paymentStatus === 'unpaid' ? 0 : Math.max(0, Number(amountReceivedNow || 0)),
        paymentStatus,
        receivedToAccountCode: paymentStatus === 'paid' ? (receivedToAccountCode || undefined) : undefined,
        paymentMethod: paymentStatus === 'paid' ? paymentMethod : undefined,
        accountNumberIban: paymentStatus === 'paid' && paymentMethod === 'Card' ? (accountNumberIban || undefined) : undefined,
        referringConsultant: referringConsultant || undefined,
        ...(corpCompanyId ? { corporateId: corpCompanyId } : {}),
        ...(corpPreAuthNo ? { corporatePreAuthNo: corpPreAuthNo } : {}),
        ...(corpCoPayPercent ? { corporateCoPayPercent: Number(corpCoPayPercent) } : {}),
        ...(corpCoverageCap ? { corporateCoverageCap: Number(corpCoverageCap) } : {}),
      }) as any

      // If we are processing a referral, mark it completed
      if (fromReferralId) {
        try { await hospitalApi.updateReferralStatus(fromReferralId, 'completed') } catch { }
      }

      const tokenNo = created?.tokenNo || created?.order?.tokenNo || 'N/A'
      const createdAt = created?.createdAt || created?.order?.createdAt || new Date().toISOString()
      const data: DiagnosticTokenSlipData = {
        tokenNo,
        patientName: fullName.trim(),
        phone: phone.trim(),
        age: age || undefined,
        gender: gender || undefined,
        mrn: patient.mrn || undefined,
        guardianRel: guardianRel || undefined,
        guardianName: guardianName || undefined,
        cnic: cnic || undefined,
        address: address || undefined,
        tests: slipRows,
        subtotal,
        discount: Number(discount) || 0,
        discountType: discountType || 'PKR',
        payable: net,
        paymentStatus,
        amountReceived: paymentStatus === 'unpaid' ? 0 : Math.max(0, Number(amountReceivedNow || 0)),
        payPreviousDues: paymentStatus === 'unpaid' ? false : payPreviousDues,
        useAdvance: paymentStatus === 'unpaid' ? false : useAdvance,
        advanceApplied: paymentStatus === 'unpaid' ? 0 : paymentPreview.advanceApplied,
        duesBefore: paymentPreview.duesBefore,
        advanceBefore: paymentPreview.advanceBefore,
        duesPaid: paymentStatus === 'unpaid' ? 0 : paymentPreview.duesPaid,
        paidForToday: paymentStatus === 'unpaid' ? 0 : paymentPreview.paidForToday,
        advanceAdded: paymentStatus === 'unpaid' ? 0 : paymentPreview.advanceAdded,
        duesAfter: paymentPreview.duesAfter,
        advanceAfter: paymentPreview.advanceAfter,
        receptionistName: (payToAccounts.find(x => x.code === String(receivedToAccountCode || '').trim().toUpperCase())?.label) || undefined,
        receivedToAccountCode: paymentStatus === 'paid' ? (String(receivedToAccountCode || '').trim() || undefined) : undefined,
        paymentMethod: paymentStatus === 'paid' ? paymentMethod : undefined,
        accountNumberIban: paymentStatus === 'paid' && paymentMethod === 'Card' ? (accountNumberIban || undefined) : undefined,
        createdAt,
      }
      setSlipData(data)
      setSlipOpen(true)
      setShouldPrint(true)
      resetForm()
    } catch (e: any) {
      alert(e?.message || 'Failed to create order')
    }
  }

  return (
    <div className="space-y-4">
      {/* Patient Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Patient Details</div>
        <div className="text-xs text-slate-500">Fill all required details to generate a token</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">MR #</label>
            <input value={mrn || 'auto'} disabled readOnly className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Phone *</label>
            <input value={phone} onChange={e => { setPhone(e.target.value); skipLookupKeyRef.current = null; lastPromptKeyRef.current = null; lastPhonePromptRef.current = null }} ref={phoneRef} onBlur={onPhoneBlur} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="03XXXXXXXXX" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Patient Name *</label>
            <input value={fullName} onChange={e => { setFullName(e.target.value); skipLookupKeyRef.current = null; lastPromptKeyRef.current = null }} ref={nameRef} onBlur={() => lookupExistingByPhoneAndName('name')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Muhammad Zain" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Age</label>
            <input value={age} onChange={e => setAge(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. 22" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Guardian S/O or D/O</label>
            <select value={guardianRel} onChange={e => setGuardianRel(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select</option>
              <option value="S/O">S/O</option>
              <option value="D/O">D/O</option>
              <option value="O">O</option>
            </select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Guardian Name</label>
            <input value={guardianName} onChange={e => setGuardianName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Arif" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">CNIC</label>
            <input value={cnic} onChange={e => setCnic(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="#####-#######-#" />
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Street, City" />
          </div>
        </div>
      </div>

      {/* Select Tests */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Select Tests</div>
        <div className="text-xs text-slate-500">Tests are loaded from the Diagnostics → Tests page</div>
        {(testsLoading || testsLoadError || tests.length === 0) && (
          <div className="mt-2 text-xs">
            {testsLoading && <div className="text-slate-500">Loading tests…</div>}
            {!testsLoading && testsLoadError && <div className="text-rose-600">{testsLoadError}</div>}
            {!testsLoading && !testsLoadError && tests.length === 0 && <div className="text-amber-700">No tests found in database.</div>}
          </div>
        )}
        <div className="mt-3 space-y-2" ref={testPickerRef}>
          <input
            value={query}
            onFocus={() => setShowTestDropdown(true)}
            onClick={() => setShowTestDropdown(true)}
            onChange={e => { setQuery(e.target.value); setShowTestDropdown(true) }}
            placeholder="Search test by name/code..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {showTestDropdown && filtered.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
              {filtered.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(prev => [...prev, t.id])}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{t.name}</div>
                  </div>
                  <div className="text-xs text-slate-600">PKR {getEffectivePrice(t.id).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
          {selectedTests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTests.map(t => (
                <span key={t.id} className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-sm">
                  {t.name}
                  <button onClick={() => setSelected(prev => prev.filter(x => x !== t.id))} className="text-slate-500 hover:text-slate-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Payment</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Payed to (Account)</label>
            <select value={receivedToAccountCode} onChange={e => setReceivedToAccountCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" disabled={paymentStatus === 'unpaid'}>
              <option value="">Select account</option>
              {payToAccounts.map(a => (
                <option key={a.code} value={a.code}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Payment Status</label>
            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={paymentStatus === 'paid'} onChange={() => setPaymentStatus('paid')} className="h-4 w-4" />
                Paid
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={paymentStatus === 'unpaid'} onChange={() => setPaymentStatus('unpaid')} className="h-4 w-4" />
                Unpaid
              </label>
            </div>
          </div>

          {paymentStatus !== 'unpaid' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              {paymentMethod === 'Card' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Account Number/IBAN</label>
                  <input value={accountNumberIban} onChange={e => setAccountNumberIban(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Enter account number or IBAN" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary and submit */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Billing Summary</div>
        <div className="mt-3 divide-y divide-slate-200 text-sm">
          {selectedTests.map(t => (
            <div key={t.id} className="flex flex-wrap items-center justify-between py-2 gap-2">
              <div className="font-medium">{t.name}</div>
              <div className="text-slate-700">PKR {getEffectivePrice(t.id).toLocaleString()}</div>
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
                onChange={e => setDiscount(e.target.value)}
                className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-right"
                placeholder="0"
              />
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value as 'PKR' | '%')}
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

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-800">Payment</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-slate-600">Previous Dues</div>
              <div className="mt-1 text-sm text-slate-900">{accountLoading ? 'Loading...' : `PKR ${Number(account?.dues || 0).toLocaleString()}`}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600">Previous Advance</div>
              <div className="mt-1 text-sm text-slate-900">{accountLoading ? 'Loading...' : `PKR ${Number(account?.advance || 0).toLocaleString()}`}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Amount Received Now</label>
              <input
                value={amountReceivedNow}
                onChange={(e) => setAmountReceivedNow(e.target.value)}
                disabled={paymentStatus === 'unpaid'}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={payPreviousDues}
                  onChange={(e) => setPayPreviousDues(e.target.checked)}
                  disabled={paymentStatus === 'unpaid' || Number(account?.dues || 0) <= 0}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Pay Previous Dues
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={useAdvance}
                  onChange={(e) => setUseAdvance(e.target.checked)}
                  disabled={paymentStatus === 'unpaid' || Number(account?.advance || 0) <= 0}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Use Advance
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 border border-slate-200">
              <div className="text-slate-600">Dues After</div>
              <div className="font-semibold">PKR {Number(paymentPreview.duesAfter || 0).toLocaleString()}</div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 border border-slate-200">
              <div className="text-slate-600">Advance After</div>
              <div className="font-semibold">PKR {Number(paymentPreview.advanceAfter || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={generateToken} disabled={!fullName || !phone || selectedTests.length === 0} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Generate Token</button>
        </div>
      </div>

      {false && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-base font-semibold text-slate-800">Corporate Billing</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Corporate Company</label>
              <select value={corpCompanyId} onChange={e => setCorpCompanyId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="">None</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {corpCompanyId && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Pre-Auth No</label>
                  <input value={corpPreAuthNo} onChange={e => setCorpPreAuthNo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Co-Pay %</label>
                  <input value={corpCoPayPercent} onChange={e => setCorpCoPayPercent(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="0-100" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Coverage Cap</label>
                  <input value={corpCoverageCap} onChange={e => setCorpCoverageCap(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="e.g., 5000" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Slip modal */}
      {slipOpen && slipData && (
        <Diagnostic_TokenSlip
          open={slipOpen}
          onClose={() => { setSlipOpen(false); setShouldPrint(false) }}
          data={slipData}
          autoPrint={shouldPrint}
          user={(() => {
            try {
              const raw = localStorage.getItem('reception.session') || localStorage.getItem('hospital.session') || localStorage.getItem('diagnostic.user')
              if (!raw) return undefined
              const u = JSON.parse(raw)
              return u?.username || u?.name || undefined
            } catch {
              return undefined
            }
          })()}
        />
      )}

      {selectPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-base font-semibold text-slate-800">Select Patient</div>
              <button
                onClick={() => { setSelectPatientOpen(false); setPhoneMatches([]); setTimeout(() => phoneRef.current?.focus(), 0) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="mb-3 text-sm text-slate-600">Found {phoneMatches.length} patients on this phone number. Select one to autofill.</div>
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
                    <div className="text-sm font-semibold text-slate-800">{p.fullName || 'N/A'}</div>
                    <div className="mt-1 text-xs text-slate-600">MRN: {p.mrn || '-'}</div>
                    <div className="text-xs text-slate-600">Phone: {p.phoneNormalized || '-'}</div>
                    <div className="text-xs text-slate-600">Age: {p.age || '-'}</div>
                    <div className="text-xs text-slate-600">Gender: {p.gender || '-'}</div>
                    <div className="mt-1 text-xs text-slate-600">Guardian: {p.fatherName || '-'}</div>
                    <div className="text-xs text-slate-600">CNIC: {p.cnicNormalized || p.cnic || '-'}</div>
                    <div className="text-xs text-slate-600">Address: {p.address || '-'}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => { setSelectPatientOpen(false); setPhoneMatches([]); setTimeout(() => nameRef.current?.focus(), 0) }}
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
              <button onClick={() => { if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key; setConfirmPatient(null); setTimeout(() => { if (focusAfterConfirm === 'phone') phoneRef.current?.focus(); else if (focusAfterConfirm === 'name') nameRef.current?.focus(); setFocusAfterConfirm(null) }, 0) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => {
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
                  setMrn(p.mrn || '')
                } finally { if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key; setConfirmPatient(null) }
              }} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
