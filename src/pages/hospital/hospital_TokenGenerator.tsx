import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { logAudit } from '../../utils/hospital_audit'
import { hospitalApi } from '../../utils/api'
import Hospital_TokenSlip, { type TokenSlipData } from '../../components/hospital/Hospital_TokenSlip'

export default function Hospital_TokenGenerator() {
  const location = useLocation()
  const payToStorageKey = useMemo(() => {
    const p = String(location.pathname || '')
    return p.startsWith('/reception/') ? 'reception.receivedToAccountCode' : 'hospital.receivedToAccountCode'
  }, [location.pathname])
  const phoneStorageKey = useMemo(() => {
    const p = String(location.pathname || '')
    return p.startsWith('/reception/') ? 'reception.tokenGenerator.lastPhone' : 'hospital.tokenGenerator.lastPhone'
  }, [location.pathname])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; fee?: number }>>([])
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; fee?: number; primaryDepartmentId?: string; departmentIds?: string[] }>>([])
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const dRes = await hospitalApi.listDepartments() as any
        const deps = (dRes.departments || dRes || []).map((d: any) => ({ id: String(d._id || d.id), name: d.name, fee: Number(d.opdBaseFee ?? d.baseFee ?? d.fee ?? 0) }))
        const docRes = await hospitalApi.listDoctors() as any
        const docs = (docRes.doctors || docRes || []).map((r: any) => ({
          id: String(r._id || r.id),
          name: r.name,
          fee: Number(r.opdBaseFee ?? r.baseFee ?? r.fee ?? 0),
          primaryDepartmentId: r.primaryDepartmentId ? String(r.primaryDepartmentId) : undefined,
          departmentIds: Array.isArray(r.departmentIds) ? r.departmentIds.map((x: any) => String(x)) : undefined,
        }))
        if (!cancelled) { setDepartments(deps); setDoctors(docs) }
      } catch { }
    }

    load()
    return () => { cancelled = true }
  }, [])
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
            if (rs) continue // Skip if responsible staff is assigned
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
            setForm(prev => {
              const existing = String((prev as any).receivedToAccountCode || '').trim()
              if (existing) return prev as any
              let stored = ''
              try { stored = String(localStorage.getItem(payToStorageKey) || '').trim().toUpperCase() } catch {}
              if (stored) return { ...(prev as any), receivedToAccountCode: stored }
              if (myCode) return { ...(prev as any), receivedToAccountCode: myCode }
              return prev as any
            })
          }
        } catch {
          if (mounted) setPayToAccounts([])
        }
      })()
    return () => { mounted = false }
  }, [payToStorageKey])
  const [form, setForm] = useState({
    phone: '',
    patientId: '',
    mrn: '',
    patientName: '',
    age: '',
    gender: '',
    guardianRel: '',
    guardianName: '',
    cnic: '',
    address: '',
    doctor: '',
    departmentId: '',
    billingType: 'Cash',
    accountNumberIban: '',
    receptionistName: '',
    receivedToAccountCode: '',
    paymentStatus: 'paid',
    consultationFee: '',
    discount: '0',
  })

  function clamp0(n: any){
    const x = Number(n || 0)
    return Number.isFinite(x) ? Math.max(0, x) : 0
  }

  // Auto-fill when coming from Appointments page
  useEffect(() => {
    const st: any = (location as any)?.state
    if (!st || st.from !== 'appointments') return
    const p = st.patient || {}
    const doctorId = String(st.doctorId || '')
    const departmentId = String(st.departmentId || '')
    setForm(prev => ({
      ...prev,
      phone: String(p.phone || prev.phone || ''),
      patientName: String(p.name || prev.patientName || ''),
      age: String(p.age || prev.age || ''),
      gender: String(p.gender || prev.gender || ''),
      guardianRel: String(p.guardianRel || prev.guardianRel || ''),
      guardianName: String(p.guardianName || prev.guardianName || ''),
      cnic: String(p.cnic || prev.cnic || ''),
      address: String(p.address || prev.address || ''),
      doctor: doctorId || prev.doctor,
      departmentId: departmentId || prev.departmentId,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scheduling (OPD appointments)
  const [apptDate, setApptDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [schedules, setSchedules] = useState<Array<{ _id: string; doctorId: string; dateIso: string; startTime: string; endTime: string; slotMinutes: number; fee?: number; followupFee?: number }>>([])
  const [scheduleId, setScheduleId] = useState('')

  const finalFee = useMemo(() => {
    const fee = parseFloat(form.consultationFee || '0')
    const discount = parseFloat(form.discount || '0')
    const f = Math.max(fee - discount, 0)
    return isNaN(f) ? 0 : f
  }, [form.consultationFee, form.discount])

  const [account, setAccount] = useState<{ dues: number; advance: number } | null>(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const [payPreviousDues, setPayPreviousDues] = useState(false)
  const [useAdvance, setUseAdvance] = useState(false)
  const [amountReceivedNow, setAmountReceivedNow] = useState('0')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pid = String((form as any).patientId || '').trim()
        if (!pid) {
          if (!cancelled) setAccount({ dues: 0, advance: 0 })
          return
        }
        if (!cancelled) setAccountLoading(true)
        const res: any = await hospitalApi.getAccount(pid)
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
    return () => { cancelled = true }
  }, [(form as any).patientId])

  const paymentPreview = useMemo(() => {
    const duesBefore = Math.max(0, Number(account?.dues || 0))
    const advanceBefore = Math.max(0, Number(account?.advance || 0))
    const received = Math.max(0, Number(amountReceivedNow || 0))
    const net = clamp0(finalFee)
    const isUnpaid = String((form as any).paymentStatus || 'paid').toLowerCase() === 'unpaid'
    const canPay = !isUnpaid

    const payPrev = canPay ? payPreviousDues : false
    const useAdv = canPay ? useAdvance : false
    const receivedNow = canPay ? received : 0

    let advanceApplied = 0
    let netDueToday = net
    let advanceLeft = advanceBefore
    if (useAdv) {
      advanceApplied = Math.min(advanceBefore, netDueToday)
      netDueToday = Math.max(0, netDueToday - advanceApplied)
      advanceLeft = Math.max(0, advanceBefore - advanceApplied)
    }

    let amt = receivedNow
    let duesPaidLocal = 0
    let paidForTodayLocal = 0
    let advanceAddedLocal = 0
    let duesAfter = duesBefore

    if (payPrev) {
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
      amountReceived: receivedNow,
      duesPaid: duesPaidLocal,
      paidForToday: paidForTodayLocal,
      advanceAdded: advanceAddedLocal,
      duesAfter,
      advanceAfter,
      payPreviousDues: payPrev,
      useAdvance: useAdv,
      paymentStatus: isUnpaid ? 'unpaid' : 'paid',
    }
  }, [account?.dues, account?.advance, amountReceivedNow, payPreviousDues, useAdvance, finalFee, (form as any).paymentStatus])

  const update = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'receivedToAccountCode') {
      try {
        const v = String(value || '').trim().toUpperCase()
        if (v) localStorage.setItem(payToStorageKey, v)
      } catch {}
    }
  }

  const paymentStatus = String(form.paymentStatus || 'paid')

  useEffect(() => {
    if (paymentStatus !== 'unpaid') return
    setForm(prev => {
      if (!prev.billingType && !(prev as any).accountNumberIban) return prev
      return { ...prev, billingType: '', accountNumberIban: '' }
    })
  }, [paymentStatus])

  const reset = () => {
    let keepPayTo = ''
    try { keepPayTo = String(localStorage.getItem(payToStorageKey) || '').trim().toUpperCase() } catch {}
    setForm({
      phone: '',
      patientId: '',
      mrn: '',
      patientName: '',
      age: '',
      gender: '',
      guardianRel: '',
      guardianName: '',
      cnic: '',
      address: '',
      doctor: '',
      departmentId: '',
      billingType: 'Cash',
      accountNumberIban: '',
      receptionistName: '',
      receivedToAccountCode: keepPayTo,
      paymentStatus: 'paid',
      consultationFee: '',
      discount: '0',
    })
    setAmountReceivedNow('0')
    setPayPreviousDues(false)
    setUseAdvance(false)
  }

  const [showSlip, setShowSlip] = useState(false)
  const [slipData, setSlipData] = useState<TokenSlipData | null>(null)

  // IPD inline admit state
  const isIPD = useMemo(() => {
    const dep = departments.find(d => String(d.id) === String(form.departmentId))
    return (dep?.name || '').trim().toLowerCase() === 'ipd'
  }, [departments, form.departmentId])
  const [ipdBeds, setIpdBeds] = useState<Array<{ _id: string; label: string; charges?: number }>>([])
  const [ipdBedId, setIpdBedId] = useState('')
  const [ipdDeposit, setIpdDeposit] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadBeds() {
      if (!isIPD) return
      try {
        const res = await hospitalApi.listBeds({ status: 'available' }) as any
        if (!cancelled) setIpdBeds(res.beds || [])
      } catch { }
    }
    loadBeds()
    return () => { cancelled = true }
  }, [isIPD])

  // When a bed is selected, auto-fill Bed Charges from bed.charges
  useEffect(() => {
    if (!ipdBedId) { setIpdDeposit(''); return }
    const sel = ipdBeds.find(b => String(b._id) === String(ipdBedId))
    if (sel && sel.charges != null) setIpdDeposit(String(sel.charges))
  }, [ipdBedId, ipdBeds])

  // Auto-quote fee when department/doctor changes
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!form.departmentId) return
      try {
        const res = await hospitalApi.quoteOPDPrice({ departmentId: form.departmentId, doctorId: form.doctor || undefined, visitType: undefined }) as any
        if (!cancelled) {
          const feeCandidate = [res?.fee, res?.feeResolved, res?.pricing?.feeResolved, res?.amount, res?.price, res?.data?.fee]
            .map((x: any) => Number(x))
            .find(n => Number.isFinite(n) && n >= 0)
          if (feeCandidate != null) setForm(prev => ({ ...prev, consultationFee: String(feeCandidate) }))
        }
      } catch { }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.departmentId, form.doctor])

  // Load doctor schedules for selected date (non-IPD only)
  useEffect(() => {
    let cancelled = false
    async function loadSchedules() {
      try {
        if (!form.doctor) { setSchedules([]); setScheduleId(''); return }
        const res = await hospitalApi.listDoctorSchedules({ doctorId: form.doctor, departmentId: form.departmentId || undefined, date: apptDate }) as any
        const items = (res?.schedules || []) as any[]
        if (cancelled) return
        setSchedules(items)
        if (items.length === 1) setScheduleId(String(items[0]._id))
        else setScheduleId('')
      } catch { setSchedules([]); setScheduleId('') }
    }
    if (!isIPD) loadSchedules()
    return () => { cancelled = true }
  }, [form.doctor, form.departmentId, apptDate, isIPD])

  const [confirmPatient, setConfirmPatient] = useState<null | { summary: string; patient: any; key: string }>(null)
  const [focusAfterConfirm, setFocusAfterConfirm] = useState<null | 'phone' | 'name'>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const skipLookupKeyRef = useRef<string | null>(null)
  const lastPromptKeyRef = useRef<string | null>(null)
  const [selectPatientOpen, setSelectPatientOpen] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<any[]>([])
  const lastPhonePromptRef = useRef<string | null>(null)
  const phoneLookupTimerRef = useRef<any>(null)
  const phoneLookupSeqRef = useRef(0)
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const [phoneLookupSearchedDigits, setPhoneLookupSearchedDigits] = useState('')
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  function applyPatientToForm(p: any) {
    setForm(prev => ({
      ...prev,
      patientId: String(p._id || prev.patientId || ''),
      mrn: String(p.mrn || prev.mrn || ''),
      patientName: p.fullName || prev.patientName,
      guardianName: p.fatherName || prev.guardianName,
      guardianRel: p.guardianRel || prev.guardianRel,
      address: p.address || prev.address,
      gender: p.gender || prev.gender,
      age: p.age || prev.age,
      phone: p.phoneNormalized || prev.phone,
      cnic: p.cnicNormalized || p.cnic || prev.cnic,
    }))
  }

  const filteredDoctors = ((): Array<{ id: string; name: string; fee?: number }> => {
    const depId = String(form.departmentId || '')
    if (!depId) return []
    return doctors.filter(d => {
      if (d.primaryDepartmentId && String(d.primaryDepartmentId) === depId) return true
      if (Array.isArray(d.departmentIds) && d.departmentIds.map(String).includes(depId)) return true
      return false
    })
  })()

  const onDepartmentChange = (depId: string) => {
    setForm(prev => ({ ...prev, departmentId: depId }))
    // Clear doctor if it doesn't belong to selected department
    if (form.doctor) {
      const d = doctors.find(x => String(x.id) === String(form.doctor))
      const belongs = d && ((d.primaryDepartmentId && String(d.primaryDepartmentId) === depId) || (Array.isArray(d.departmentIds) && d.departmentIds.map(String).includes(depId)))
      if (!belongs) setForm(prev => ({ ...prev, doctor: '' }))
    }
  }

  const onDoctorChange = (docId: string) => {
    if (!form.departmentId) {
      showToast('error', 'Select department first')
      return
    }
    setForm(prev => ({ ...prev, doctor: docId }))
  }

  // Phone lookup and confirm


  async function lookupExistingByPhoneAndName(source: 'phone' | 'name' = 'phone') {
    const digits = (form.phone || '').replace(/\D+/g, '')
    const nameEntered = (form.patientName || '').trim()
    if (!digits || !nameEntered) return
    try {
      const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
      const key = `${digits}|${norm(nameEntered)}`
      if (skipLookupKeyRef.current === key || lastPromptKeyRef.current === key) return
      const r: any = await hospitalApi.searchPatients({ phone: digits, limit: 10 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (!list.length) return
      const p = list.find(x => norm(x.fullName) === norm(nameEntered))
      if (!p) return
      const summary = [
        `Found existing patient. Apply details?`,
        `MRN: ${p.mrn || '-'}`,
        `Name: ${p.fullName || '-'}`,
        `Phone: ${p.phoneNormalized || digits}`,
        `Age: ${p.age ?? (form.age?.trim() || '-')}`,
        p.gender ? `Gender: ${p.gender}` : null,
        p.address ? `Address: ${p.address}` : null,
        p.fatherName ? `Guardian: ${p.fatherName}` : null,
        `Guardian Relation: ${p.guardianRel || (form.guardianRel || '-')}`,
        p.cnicNormalized ? `CNIC: ${p.cnicNormalized}` : null,
      ].filter(Boolean).join('\n')
      setTimeout(() => { setFocusAfterConfirm(source); lastPromptKeyRef.current = key; setConfirmPatient({ summary, patient: p, key }) }, 0)
    } catch { }
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
      const r: any = await hospitalApi.searchPatients({ phone: d, limit: 25 })
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
    } catch {}

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
    try { stored = String(localStorage.getItem(phoneStorageKey) || '').trim() } catch {}
    const digits = stored.replace(/\D+/g, '')
    if (!digits) return
    setForm(prev => {
      const cur = String(prev.phone || '').replace(/\D+/g, '')
      if (cur) return prev
      return { ...prev, phone: digits }
    })
    setTimeout(() => {
      runPhoneLookup(digits, { open: true })
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneStorageKey])

  async function onPhoneBlur() {
    const phone = form.phone?.trim()
    if (!phone) return
    const digits = (phone || '').replace(/\D+/g, '')
    if (!digits) return
    if ((form.patientName || '').trim()) { await lookupExistingByPhoneAndName('phone'); }
  }



  const generateToken = async (e: React.FormEvent) => {
    e.preventDefault()
    const selDoc = doctors.find(d => String(d.id) === String(form.doctor))
    const selDept = departments.find(d => String(d.id) === String(form.departmentId))
    if (!form.departmentId) {
      alert('Please select a department before generating a token')
      return
    }
    try {
      // Inline IPD admit flow: if department is IPD, require bed and admit immediately
      if (isIPD) {
        if (!ipdBedId) { alert('Please select a bed for IPD admission'); return }
        const payload: any = {
          departmentId: form.departmentId,
          doctorId: form.doctor || undefined,
          discount: Number(form.discount) || 0,
          paymentStatus: (form as any).paymentStatus || 'paid',
          receptionistName: (form as any).receptionistName || undefined,
          paymentMethod: (form as any).billingType || undefined,
          accountNumberIban: (form as any).accountNumberIban || undefined,
          receivedToAccountCode: ((form as any).paymentStatus === 'unpaid') ? undefined : ((form as any).receivedToAccountCode || undefined),
          paymentRef: undefined,
        }
        // Patient demographics for saving/updating patient
        payload.patientName = form.patientName || undefined
        payload.phone = form.phone || undefined
        payload.gender = form.gender || undefined
        payload.guardianRel = form.guardianRel || undefined
        payload.guardianName = form.guardianName || undefined
        payload.cnic = form.cnic || undefined
        payload.address = form.address || undefined
        payload.age = form.age || undefined
        if ((form as any).patientId) payload.patientId = (form as any).patientId
        else if (form.patientName) payload.patientName = form.patientName
        const rawDeposit = String(ipdDeposit || '').trim()
        const cleanedDeposit = rawDeposit.replace(/[^0-9.]/g, '')
        const depAmt = cleanedDeposit ? parseFloat(cleanedDeposit) : NaN
        const res = await hospitalApi.createOpdToken({ ...payload, overrideFee: isNaN(depAmt) ? undefined : depAmt }) as any
        const tokenId = String(res?.token?._id || '')
        if (!tokenId) throw new Error('Failed to create token for admission')
        await hospitalApi.admitFromOpdToken({ tokenId, bedId: ipdBedId, deposit: isNaN(depAmt) ? undefined : depAmt })
        logAudit('token_generate', `ipd_admit dept=IPD, bed=${ipdBedId}`)
        // Show print slip with full details
        const slip: TokenSlipData = {
          tokenNo: res?.token?.tokenNo || 'N/A',
          departmentName: (departments.find(d => String(d.id) === String(form.departmentId))?.name) || '-',
          doctorName: (doctors.find(d => String(d.id) === String(form.doctor))?.name) || '-',
          patientName: res?.token?.patientName || form.patientName || '-',
          phone: form.phone || '',
          mrn: String(res?.token?.mrn || res?.token?.patientId?.mrn || (form as any).mrn || ''),
          age: form.age || '',
          gender: form.gender || '',
          guardianRel: form.guardianRel || '',
          guardianName: form.guardianName || '',
          cnic: form.cnic || '',
          address: form.address || '',
          paymentStatus: (form as any).paymentStatus || 'paid',
          receptionistName: String((payToAccounts.find(x => x.code === String((form as any).receivedToAccountCode || '').trim().toUpperCase())?.label) || (res?.token?.receptionistName ?? (form as any).receptionistName) || ''),
          receivedToAccountCode: ((form as any).paymentStatus === 'unpaid') ? undefined : (String((form as any).receivedToAccountCode || '').trim() || undefined),
          paymentMethod: String((res?.token?.paymentMethod ?? (form as any).billingType) || ''),
          accountNumberIban: String((res?.token?.accountNumberIban ?? (form as any).accountNumberIban) || ''),
          amount: isNaN(depAmt) ? 0 : depAmt,
          discount: 0,
          payable: isNaN(depAmt) ? 0 : depAmt,
          createdAt: res?.token?.createdAt,
        }
        setSlipData(slip)
        setShowSlip(true)
        reset()
        setIpdBedId(''); setIpdDeposit('')
        return
      }
      const payload: any = {
        departmentId: form.departmentId,
        doctorId: form.doctor || undefined,
        discount: Number(form.discount) || 0,
        paymentStatus: (form as any).paymentStatus || 'paid',
        receptionistName: (form as any).receptionistName || undefined,
        paymentMethod: (form as any).billingType || undefined,
        accountNumberIban: (form as any).accountNumberIban || undefined,
        receivedToAccountCode: ((form as any).paymentStatus === 'unpaid') ? undefined : ((form as any).receivedToAccountCode || undefined),
        paymentRef: undefined,
        payPreviousDues,
        useAdvance,
        amountReceived: clamp0(amountReceivedNow),
      }
      // Patient demographics for saving/updating patient
      payload.patientName = form.patientName || undefined
      payload.phone = form.phone || undefined
      payload.gender = form.gender || undefined
      payload.guardianRel = form.guardianRel || undefined
      payload.guardianName = form.guardianName || undefined
      payload.cnic = form.cnic || undefined
      payload.address = form.address || undefined
      payload.age = form.age || undefined
      // Attach scheduleId to auto-assign next free slot
      if (!isIPD && scheduleId) (payload as any).scheduleId = scheduleId
      if ((form as any).patientId) payload.patientId = (form as any).patientId
      else if (form.patientName) payload.patientName = form.patientName
      const res = await hospitalApi.createOpdToken(payload) as any
      const tokenNo = res?.token?.tokenNo || 'N/A'
      // Prepare slip and show (OPD)
      const tok = res?.token || {}
      const slip: TokenSlipData = {
        tokenNo,
        departmentName: selDept?.name || '-',
        doctorName: selDoc?.name || '-',
        patientName: res?.token?.patientName || form.patientName || '-',
        phone: form.phone || '',
        mrn: String(res?.token?.mrn || res?.token?.patientId?.mrn || (form as any).mrn || ''),
        age: form.age || '',
        gender: form.gender || '',
        guardianRel: form.guardianRel || '',
        guardianName: form.guardianName || '',
        cnic: form.cnic || '',
        address: form.address || '',
        paymentStatus: (form as any).paymentStatus || 'paid',
        receptionistName: String((payToAccounts.find(x => x.code === String((form as any).receivedToAccountCode || '').trim().toUpperCase())?.label) || (res?.token?.receptionistName ?? (form as any).receptionistName) || ''),
        receivedToAccountCode: ((form as any).paymentStatus === 'unpaid') ? undefined : (String((form as any).receivedToAccountCode || '').trim() || undefined),
        paymentMethod: String((res?.token?.paymentMethod ?? (form as any).billingType) || ''),
        accountNumberIban: String((res?.token?.accountNumberIban ?? (form as any).accountNumberIban) || ''),
        amount: Number((tok.amount ?? tok.fee ?? 0) || 0),
        discount: Number((tok.discount ?? 0) || 0),
        payable: Number((tok.fee ?? 0) || 0),
        amountReceived: paymentPreview.amountReceived,
        payPreviousDues: paymentPreview.payPreviousDues,
        useAdvance: paymentPreview.useAdvance,
        advanceApplied: paymentPreview.advanceApplied,
        duesBefore: paymentPreview.duesBefore,
        advanceBefore: paymentPreview.advanceBefore,
        duesPaid: paymentPreview.duesPaid,
        paidForToday: paymentPreview.paidForToday,
        advanceAdded: paymentPreview.advanceAdded,
        duesAfter: paymentPreview.duesAfter,
        advanceAfter: paymentPreview.advanceAfter,
        createdAt: res?.token?.createdAt,
      }
      setSlipData(slip)
      setShowSlip(true)
      logAudit('token_generate', `patient=${form.patientName || 'N/A'}, dept=${form.departmentId}, doctor=${selDoc?.name || 'N/A'}, fee=${res?.pricing?.finalFee ?? finalFee}`)
    } catch (err: any) {
      alert(err?.message || 'Failed to generate token')
    }
    reset()
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800">Token Generator</h2>
      <form onSubmit={generateToken} className="mt-6 space-y-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Patient Information</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">MR Number</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 outline-none"
                  placeholder="Auto"
                  value={String((form as any).mrn || '')}
                  readOnly
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" placeholder="Enter 11-digit phone" value={form.phone} onChange={e => { update('phone', e.target.value); skipLookupKeyRef.current = null; lastPromptKeyRef.current = null; lastPhonePromptRef.current = null; schedulePhoneLookup(e.target.value, { open: true }) }} onBlur={onPhoneBlur} ref={phoneRef} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" placeholder="Full Name" value={form.patientName} onChange={e => { update('patientName', e.target.value); skipLookupKeyRef.current = null; lastPromptKeyRef.current = null }} onBlur={() => lookupExistingByPhoneAndName('name')} ref={nameRef} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" placeholder="e.g., 25" value={form.age} onChange={e => update('age', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" value={form.gender} onChange={e => update('gender', e.target.value)}>
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Guardian</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" value={form.guardianRel} onChange={e => update('guardianRel', e.target.value)}>
                  <option value="">S/O or D/O</option>
                  <option value="S/O">S/O</option>
                  <option value="D/O">D/O</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Name</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" placeholder="Father/Guardian Name" value={form.guardianName} onChange={e => update('guardianName', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">CNIC</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" placeholder="13-digit CNIC (no dashes)" value={form.cnic} onChange={e => update('cnic', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" rows={3} placeholder="Residential Address" value={form.address} onChange={e => update('address', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Visit & Billing</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" value={form.departmentId} onChange={e => onDepartmentChange(e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Doctor</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  value={form.doctor}
                  onChange={e => onDoctorChange(e.target.value)}
                  onMouseDown={(e) => { if (!form.departmentId) { e.preventDefault(); showToast('error', 'Select department first') } }}
                  onFocus={(e) => { if (!form.departmentId) { showToast('error', 'Select department first'); (e.target as HTMLSelectElement).blur() } }}
                >
                  <option value="">{form.departmentId ? 'Select doctor' : 'Select department first'}</option>
                  {filteredDoctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Doctor selection is optional for IPD.</p>
              </div>

              {!isIPD && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Appointment Date</label>
                    <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Doctor Schedule</label>
                    <select value={scheduleId} onChange={e => setScheduleId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                      <option value="">{schedules.length ? 'Select schedule' : 'No schedules found'}</option>
                      {schedules.map(s => (
                        <option key={s._id} value={s._id}>{s.startTime} - {s.endTime} • {s.slotMinutes} min</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Auto-assigns next free slot in selected schedule.</p>
                  </div>
                </div>
              )}
              {paymentStatus !== 'unpaid' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
                    <select className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" value={form.billingType} onChange={e => update('billingType', e.target.value)}>
                      <option>Cash</option>
                      <option>Card</option>
                      <option>Insurance</option>
                    </select>
                  </div>

                  {String(form.billingType || '') === 'Card' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Account Number/IBAN</label>
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        placeholder="Enter account number or IBAN"
                        value={(form as any).accountNumberIban || ''}
                        onChange={e => update('accountNumberIban' as any, e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
              {isIPD && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Select Bed</label>
                    <select
                      value={ipdBedId}
                      onChange={(e) => {
                        setIpdBedId(e.target.value)
                        const opt = (e.target as HTMLSelectElement).selectedOptions?.[0] as any
                        const chargesAttr = opt?.getAttribute?.('data-charges')
                        if (chargesAttr !== null && chargesAttr !== undefined) setIpdDeposit(chargesAttr)
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    >
                      <option value="">Available beds</option>
                      {ipdBeds.map(b => (
                        <option key={b._id} value={String(b._id)} data-charges={b.charges ?? ''}>
                          {b.label}{b.charges != null ? ` - (Rs. ${b.charges})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Bed Charges</label>
                    <input value={ipdDeposit} onChange={e => setIpdDeposit(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" placeholder="e.g., Rs. 1000" />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Fee Details</h3>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mt-1 divide-y divide-slate-200 text-sm">
              <div className="flex items-center justify-between py-2">
                <div className="text-slate-600">Fee</div>
                <div>PKR {Number(Number(form.consultationFee || 0) || 0).toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="text-slate-600">Discount</div>
                <input
                  className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-right"
                  placeholder="0"
                  value={form.discount}
                  onChange={e => update('discount', e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between py-2 font-semibold">
                <div>Net Fee</div>
                <div>PKR {(isIPD ? (Number(ipdDeposit || '0') || 0) : finalFee).toLocaleString()}</div>
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
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Receptionist</h3>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Payed to (Account)</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              value={String((form as any).receivedToAccountCode || '')}
              onChange={e => update('receivedToAccountCode' as any, e.target.value)}
              disabled={paymentStatus === 'unpaid'}
            >
              <option value="">Select account</option>
              {payToAccounts.map(a => (
                <option key={a.code} value={a.code}>{a.label}</option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Payment Status</h3>
          <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white p-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={(form as any).paymentStatus === 'paid'}
                onChange={() => update('paymentStatus' as any, 'paid')}
                className="h-4 w-4"
              />
              Paid
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={(form as any).paymentStatus === 'unpaid'}
                onChange={() => update('paymentStatus' as any, 'unpaid')}
                className="h-4 w-4"
              />
              Unpaid
            </label>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset Form</button>
          <button type="submit" className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800">Generate Token</button>
        </div>
      </form>
      {showSlip && slipData && (
        <Hospital_TokenSlip open={showSlip} onClose={() => setShowSlip(false)} data={slipData} autoPrint={true} />
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
                  setForm(prev => ({
                    ...prev,
                    patientId: String(p._id || prev.patientId || ''),
                    patientName: p.fullName || prev.patientName,
                    guardianName: p.fatherName || prev.guardianName,
                    guardianRel: p.guardianRel || prev.guardianRel,
                    address: p.address || prev.address,
                    gender: p.gender || prev.gender,
                    age: p.age || prev.age,
                    phone: p.phoneNormalized || prev.phone,
                    cnic: p.cnicNormalized || prev.cnic,
                  }))
                } finally { if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key; setConfirmPatient(null) }
              }} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
            </div>
          </div>
        </div>
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
              <div className="mb-3 text-sm text-slate-600">
                {phoneLookupLoading
                  ? `Searching registered patients for ${phoneLookupSearchedDigits || (form.phone || '').replace(/\D+/g, '')}...`
                  : (phoneMatches.length > 0
                      ? `Found ${phoneMatches.length} patients on this phone number. Select one to autofill.`
                      : `No registered patients found for ${phoneLookupSearchedDigits || (form.phone || '').replace(/\D+/g, '')}.`)
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
                <div className="mt-1 text-xs text-slate-600">Phone: {p.phoneNormalized || form.phone}</div>
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
                onClick={() => { setSelectPatientOpen(false); setPhoneMatches([]); setTimeout(() => nameRef.current?.focus(), 0) }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Enter New Patient
              </button>
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
