import { useMemo, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Counselling_TokenSlip from '../../components/counselling/Counselling_TokenSlip'
import type { CounsellingTokenSlipData } from '../../components/counselling/Counselling_TokenSlip'
import { counsellingApi, corporateApi, hospitalApi } from '../../utils/api'

export default function Counselling_TokenGenerator() {
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

  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)
  const [confirmPatient, setConfirmPatient] = useState<null | { summary: string; patient: any; key: string }>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const skipLookupKeyRef = useRef<string | null>(null)
  const lastPromptKeyRef = useRef<string | null>(null)
  const autoMrnAppliedRef = useRef<boolean>(false)
  const [selectPatientOpen, setSelectPatientOpen] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<any[]>([])
  const lastPhonePromptRef = useRef<string | null>(null)
  const phoneLookupTimerRef = useRef<any>(null)
  const phoneLookupSeqRef = useRef(0)
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const [phoneLookupSearchedDigits, setPhoneLookupSearchedDigits] = useState('')
  
  const [fromReferralId, setFromReferralId] = useState<string>('')
  const [requestedTests, setRequestedTests] = useState<string[]>([])
  const [referringConsultant, setReferringConsultant] = useState('')

  // Packages
  type Package = { id: string; name: string; price: number; month: number }
  const [packages, setPackages] = useState<Package[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesLoadError, setPackagesLoadError] = useState<string>('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [showPackageDropdown, setShowPackageDropdown] = useState(false)
  const packagePickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (mounted) { setPackagesLoading(true); setPackagesLoadError('') }
      try {
        const res = await counsellingApi.listPackages({ status: 'active', limit: 1000 }) as any
        const arr = (res?.items || res || []).map((p: any) => ({ id: String(p._id || p.id), name: p.packageName, price: Number(p.price || 0), month: Number(p.month || 0) }))
        if (mounted) setPackages(arr)
      } catch (e: any) {
        if (mounted) {
          setPackages([])
          setPackagesLoadError(String(e?.message || 'Failed to load packages'))
        }
      } finally {
        if (mounted) setPackagesLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    try {
      const st = navState || {}
      if (st?.patient) {
        const p = st.patient
        if (p.fullName) setFullName(String(p.fullName))
        if (p.phone) setPhone(String(p.phone))
        if (p.age) setAge(String(p.age))
        if (p.gender) setGender(String(p.gender))
        if (p.address) setAddress(String(p.address))
        if (p.fatherName) setGuardianName(String(p.fatherName))
        if (p.guardianRelation) setGuardianRel(String(p.guardianRelation))
        if (p.cnic) setCnic(String(p.cnic))
        if (p.mrn) setMrn(String(p.mrn))

        if (p.mrn && !selectedPatient && !autoMrnAppliedRef.current) {
          const code = String(p.mrn || '').trim()
          if (code) {
            ;(async () => {
              try {
                const r: any = await counsellingApi.getPatientByMrn(code)
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
      if (Array.isArray(st?.requestedPackages)) setRequestedTests(st.requestedPackages.map((x: any) => String(x)))
      if (st?.fromReferralId) setFromReferralId(String(st.fromReferralId))
      if (st?.referringConsultant) setReferringConsultant(String(st.referringConsultant))
    } catch { }
  }, [location?.key, navState, selectedPatient])

  useEffect(() => {
    if (!requestedTests.length || !packages.length) return
    const set = new Set(requestedTests.map(s => String(s).trim().toLowerCase()))
    const ids = packages.filter(p => set.has(String(p.name).trim().toLowerCase())).map(p => p.id)
    if (ids.length) {
      setSelected(prev => Array.from(new Set([...prev, ...ids])))
    }
  }, [requestedTests, packages])

  const [corpPackagePriceMap, setCorpPackagePriceMap] = useState<Record<string, number>>({})

  const getEffectivePrice = (id: string): number => {
    const base = Number((packages.find(p => p.id === id)?.price) || 0)
    return base
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return packages.filter(p => !selected.includes(p.id)).filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, 30)
  }, [packages, query, selected])

  const selectedPackages = useMemo(() => selected.map(id => packages.find(p => p.id === id)).filter(Boolean) as Package[], [selected, packages])
  const subtotal = useMemo(() => selectedPackages.reduce((s, p) => s + getEffectivePrice(p.id), 0), [selectedPackages])
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!selectedPatient?._id) {
          if (!cancelled) setAccount({ dues: 0, advance: 0 })
          return
        }
        if (!cancelled) setAccountLoading(true)
        const res: any = await counsellingApi.getAccount(String(selectedPatient._id))
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

  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid')
  const [receivedToAccountCode, setReceivedToAccountCode] = useState('')
  const [payToAccounts, setPayToAccounts] = useState<Array<{ code: string; label: string }>>([])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash')
  const [accountNumberIban, setAccountNumberIban] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
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
          const existing = String(receivedToAccountCode || '').trim()
          if (!existing && myCode) setReceivedToAccountCode(myCode)
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

  useEffect(() => {
    // Removed unused rate rules logic
  }, [])

  useEffect(() => {
    // Removed unused companies list logic
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = packagePickerRef.current
      if (!el) return
      if (!el.contains(e.target as any)) setShowPackageDropdown(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPackageDropdown(false)
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
  const [slipData, setSlipData] = useState<CounsellingTokenSlipData | null>(null)
  const [hospitalSettings, setHospitalSettings] = useState<any>(null)

  useEffect(() => {
    loadHospitalSettings()
  }, [])

  async function loadHospitalSettings() {
    try {
      const settings = await hospitalApi.getSettings()
      setHospitalSettings(settings)
    } catch (e) {
      console.error('Failed to load hospital settings', e)
    }
  }

  async function lookupExistingByPhoneAndName(source: 'phone' | 'name' = 'phone') {
    const digits = (phone || '').replace(/\D+/g, '')
    const nameEntered = (fullName || '').trim()
    if (!digits || !nameEntered) return
    try {
      const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
      const key = `${digits}|${norm(nameEntered)}`
      if (skipLookupKeyRef.current === key || lastPromptKeyRef.current === key) return
      const r: any = await counsellingApi.searchPatients({ phone: digits, limit: 10 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (!list.length) return
      const p = list.find(x => norm(x.fullName) === norm(nameEntered))
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
      ].filter(Boolean).join('\n')
      setTimeout(() => { lastPromptKeyRef.current = key; setConfirmPatient({ summary, patient: p, key }) }, 0)
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
      const r: any = await counsellingApi.searchPatients({ phone: d, limit: 25 })
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

  async function onPhoneBlur() {
    const ph = phone?.trim()
    if (!ph) return
    const digits = (ph || '').replace(/\D+/g, '')
    if (!digits) return
    if (lastPhonePromptRef.current === digits) {
      if ((fullName || '').trim()) { await lookupExistingByPhoneAndName('phone') }
      return
    }
    try {
      const r: any = await counsellingApi.searchPatients({ phone: digits, limit: 25 })
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
    if (!fullName.trim() || !phone.trim() || selectedPackages.length === 0) return
    try {
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
          const upd = await counsellingApi.updatePatient(String(patient._id), patch) as any
          patient = upd?.patient || patient
        }
      } else {
        const fr = await counsellingApi.findOrCreatePatient({ fullName: fullName.trim(), guardianName: guardianName || undefined, phone: phone || undefined, cnic: cnic || undefined, gender: gender || undefined, address: address || undefined, age: age || undefined, guardianRel: guardianRel || undefined }) as any
        patient = fr?.patient
      }
      if (!patient?._id) throw new Error('Failed to resolve patient')

      const packageIds = selected
      const slipRows = selectedPackages.map(p => ({ name: p.name, price: getEffectivePrice(p.id) }))
      const created = await counsellingApi.createOrder({
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
        packages: packageIds,
        subtotal,
        discount: Number(discount) || 0,
        discountType: discountType || 'PKR',
        net,
        payPreviousDues: paymentStatus === 'unpaid' ? false : payPreviousDues,
        useAdvance: paymentStatus === 'unpaid' ? false : useAdvance,
        amountReceived: paymentStatus === 'unpaid' ? 0 : Math.max(0, Number(amountReceivedNow || 0)),
        paymentStatus,
        receivedToAccountCode: paymentStatus === 'paid' ? (String(receivedToAccountCode || '').trim() || undefined) : undefined,
        paymentMethod: paymentStatus === 'paid' ? paymentMethod : undefined,
        accountNumberIban: paymentStatus === 'paid' && paymentMethod === 'Card' ? (accountNumberIban || undefined) : undefined,
        referringConsultant: referringConsultant || undefined,
      }) as any

      if (fromReferralId) {
        try { await hospitalApi.updateReferralStatus(fromReferralId, 'completed') } catch { }
      }

      const tokenNo = created?.tokenNo || created?.order?.tokenNo || 'N/A'
      const createdAt = created?.createdAt || created?.order?.createdAt || new Date().toISOString()
      const data: CounsellingTokenSlipData = {
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
      // Reset form after successful generation
      setSelected([])
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
      autoMrnAppliedRef.current = false
      setAmountReceivedNow('0')
      setPaymentStatus('paid')
      setPaymentMethod('Cash')
      setAccountNumberIban('')
      setReceivedToAccountCode('')
      setDiscount('0')
      setDiscountType('PKR')
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
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-slate-600">Phone *</label>
            <input 
              value={phone} 
              onChange={e => { 
                setPhone(e.target.value); 
                skipLookupKeyRef.current = null; 
                lastPromptKeyRef.current = null; 
                lastPhonePromptRef.current = null;
                schedulePhoneLookup(e.target.value, { open: true });
              }} 
              ref={phoneRef} 
              onBlur={onPhoneBlur} 
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none" 
              placeholder="03XXXXXXXXX" 
            />
            {selectPatientOpen && phoneMatches.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
                <div className="sticky top-0 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Registered Patients ({phoneMatches.length})
                </div>
                {phoneMatches.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => {
                      applyPatientToForm(p);
                      setSelectPatientOpen(false);
                    }}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-violet-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{p.fullName}</span>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{p.mrn}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{p.phoneNormalized}</span>
                      {p.fatherName && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>{p.guardianRel || 'S/O'}: {p.fatherName}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {phoneLookupLoading && (
              <div className="absolute right-3 top-[32px]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"></div>
              </div>
            )}
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

      {/* Select Packages */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-base font-semibold text-slate-800">Select Packages</div>
        <div className="text-xs text-slate-500">Packages are loaded from the Counselling portal</div>
        {(packagesLoading || packagesLoadError || packages.length === 0) && (
          <div className="mt-2 text-xs">
            {packagesLoading && <div className="text-slate-500">Loading packages…</div>}
            {!packagesLoading && packagesLoadError && <div className="text-rose-600">{packagesLoadError}</div>}
            {!packagesLoading && !packagesLoadError && packages.length === 0 && <div className="text-amber-700">No packages found in database.</div>}
          </div>
        )}
        <div className="mt-3 space-y-2" ref={packagePickerRef}>
          <input
            value={query}
            onFocus={() => setShowPackageDropdown(true)}
            onClick={() => setShowPackageDropdown(true)}
            onChange={e => { setQuery(e.target.value); setShowPackageDropdown(true) }}
            placeholder="Search package by name..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {showPackageDropdown && filtered.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(prev => [...prev, p.id])}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.month} Month{p.month > 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-xs text-slate-600">PKR {getEffectivePrice(p.id).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
          {selectedPackages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPackages.map(p => (
                <span key={p.id} className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-sm">
                  {p.name} ({p.month}M)
                  <button onClick={() => setSelected(prev => prev.filter(x => x !== p.id))} className="text-slate-500 hover:text-slate-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment and Billing Summary */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-base font-semibold text-slate-800">Payment</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Payed to (Account)</label>
              <select value={receivedToAccountCode} onChange={e => setReceivedToAccountCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={paymentStatus === 'unpaid'}>
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
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                {paymentMethod === 'Card' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Account Number/IBAN</label>
                    <input value={accountNumberIban} onChange={e => setAccountNumberIban(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Enter account number or IBAN" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-base font-semibold text-slate-800">Billing Summary</div>
          <div className="mt-3 divide-y divide-slate-200 text-sm">
            {selectedPackages.map(p => (
              <div key={p.id} className="flex flex-wrap items-center justify-between py-2 gap-2">
                <div className="font-medium">{p.name} ({p.month} Month{p.month > 1 ? 's' : ''})</div>
                <div className="text-slate-700">PKR {getEffectivePrice(p.id).toLocaleString()}</div>
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
            <div className="mb-2 text-sm font-semibold text-slate-800">Settlement Preview</div>
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
            <button
              onClick={generateToken}
              disabled={!fullName.trim() || !phone.trim() || selectedPackages.length === 0}
              className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              Generate Token
            </button>
          </div>
        </div>
      </div>

      {slipData && (
        <Counselling_TokenSlip
          open={slipOpen}
          onClose={() => setSlipOpen(false)}
          data={slipData}
          hospitalSettings={hospitalSettings}
          autoPrint
        />
      )}
    </div>
  )
}
