import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import { mergeHistoryWithEdits, isFieldEditedByDoctor } from '../../utils/historyEdits'
import type { HistorySection } from '../../utils/historyEdits'

// Types for history data sections
type PersonalInfo = {
  name?: string
  mrNo?: string
  age?: string
  pt?: string
  mamUpto?: string
  mamPn?: string
  height?: string
  weight?: string
  bp?: string
  currentAddress?: string
  permanentAddress?: string
  visitStay?: string
  contact1?: string
  contact2?: string
  sleepHrs?: string
  walkExercise?: string
  education?: string
  jobHours?: string
  natureOfWork?: string
  relax?: boolean
  stressful?: boolean
}

type MaritalStatus = {
  status?: string
  timePeriod?: string
  marriages?: Array<{
    status?: string
    years?: string
    months?: string
    marriageType?: { loveMarriage?: boolean; arrangeMarriage?: boolean; like?: boolean }
    mutualSatisfaction?: string
    mutualCooperation?: string
    childStatus?: string
    childStatus2?: { minors?: boolean; pregnant?: boolean; abortion?: boolean; male?: string; female?: string }
  }>
}

type Coitus = {
  intercourse?: string
  partnerLiving?: string
  visitHomeMonths?: string
  visitHomeDays?: string
  frequencyType?: string
  frequencyNumber?: string
  since?: string
  previousFrequency?: string
}

type Health = {
  selectedConditions?: string[]
  diabetes?: { me?: boolean; father?: boolean; mother?: boolean; since?: string; medicineTaking?: string }
  hypertension?: { me?: boolean; father?: boolean; mother?: boolean; since?: string; medicineTaking?: string }
  drugHistory?: { wine?: boolean; weed?: boolean; tobacco?: boolean; gutka?: boolean; naswar?: boolean; pan?: boolean; other?: string; quit?: string }
  smoking?: { status?: string; since?: string; quantityUnit?: string; quantityNumber?: string; quit?: string }
}

type SexualHistory = {
  erection?: { percentage?: string; sinceValue?: string; sinceUnit?: string; prePeni?: boolean; postPeni?: boolean; ej?: string; med?: string; other?: string }
  pe?: { pre?: boolean; preValue?: string; preUnit?: string; just?: boolean; justValue?: string; justUnit?: string; sinceValue?: string; sinceUnit?: string; other?: string }
  pFluid?: { foreplay?: boolean; phonixSex?: boolean; onThoughts?: boolean; pornAddiction?: boolean; other?: string; status?: { noIssue?: boolean; erDown?: boolean; weakness?: boolean } }
  ud?: { status?: string; other?: string }
  pSize?: { bent?: boolean; bentLeft?: boolean; bentRight?: boolean; small?: boolean; smallHead?: boolean; smallBody?: boolean; smallTip?: boolean; smallMid?: boolean; smallBase?: boolean; shrink?: boolean; boeing?: string }
  inf?: { sexuality?: { status?: string }; diagnosis?: { azos?: boolean; oligo?: boolean; terato?: boolean; astheno?: boolean }; problems?: { magi?: boolean; cystitis?: boolean; balanitis?: boolean }; others?: string }
  oeMuscle?: { ok?: boolean; semi?: boolean; fl?: boolean }
  oe?: { disease?: { peyronie?: boolean; calcification?: boolean }; testes?: { status?: string }; epidCst?: { right?: boolean; left?: boolean }; varicocele?: { right?: boolean; left?: boolean; rightGrades?: any; leftGrades?: any } }
  uss?: { status?: string; other?: string }
  npt?: { status?: string; erectionPercentage?: string; sinceValue?: string; sinceUnit?: string; other?: string }
  desire?: { status?: string; other?: string }
  nightfall?: { status?: string; other?: string }
  experiences?: { preMarriage?: any; postMarriage?: any }
}

type PreviousMedicalHistory = {
  exConsultation?: string
  exRx?: string
  cause?: string
}

type ArrivalReference = {
  referredBy?: { status?: string; other?: string }
  adsSocialMedia?: { youtube?: boolean; google?: boolean; facebook?: boolean; instagram?: boolean; other?: string }
  keywords?: string[]
  keywordsInput?: string
  appearOnKeyword?: { drAslamNaveed?: boolean; drMujahidFarooq?: boolean; mensCareClinic?: boolean; olaDoc?: boolean; marham?: boolean }
}

// Helper component for displaying a field with color coding
function HistoryField({
  label,
  value,
  path,
  editedPaths,
  isBoolean = false
}: {
  label: string
  value: any
  path: string
  editedPaths: Set<string>
  isBoolean?: boolean
}) {
  if (value == null || value === '' || (isBoolean && value !== true)) {
    return null
  }

  const isEdited = isFieldEditedByDoctor(editedPaths, path)
  const displayValue = isBoolean ? (value ? 'Yes' : 'No') : String(value)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-sm font-medium ${isEdited ? 'text-blue-600' : 'text-slate-900'}`}
        title={isEdited ? 'Edited by doctor' : 'Entered by history taker'}
      >
        {displayValue}
      </div>
    </div>
  )
}

function HistoryFieldMulti({
  label,
  value,
  paths,
  editedPaths,
  isBoolean = false
}: {
  label: string
  value: any
  paths: string[]
  editedPaths: Set<string>
  isBoolean?: boolean
}) {
  if (value == null || value === '' || (isBoolean && value !== true)) {
    return null
  }

  const isEdited = paths.some(p => isFieldEditedByDoctor(editedPaths, p))
  const displayValue = isBoolean ? (value ? 'Yes' : 'No') : String(value)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-sm font-medium ${isEdited ? 'text-blue-600' : 'text-slate-900'}`}
        title={isEdited ? 'Edited by doctor' : 'Entered by history taker'}
      >
        {displayValue}
      </div>
    </div>
  )
}

// Section component with tabs
function HistorySectionView({
  title,
  children,
  isActive,
  onClick
}: {
  title: string
  children: React.ReactNode
  isActive: boolean
  onClick: () => void
}) {
  return (
    <div className={`rounded-lg border ${isActive ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'} overflow-hidden`}>
      <button
        onClick={onClick}
        className={`w-full px-4 py-2 text-left text-sm font-semibold ${isActive ? 'text-blue-800' : 'text-slate-700'} flex items-center justify-between`}
      >
        {title}
        <span className="text-xs">{isActive ? '▼' : '▶'}</span>
      </button>
      {isActive && (
        <div className="border-t border-slate-200 p-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Doctor_PreviousHistoryView() {
  const navigate = useNavigate()
  const { id } = useParams() as any
  const location = useLocation() as any
  const [loading, setLoading] = useState(false)
  const [row, setRow] = useState<any>(location?.state?.history || null)
  const [patient] = useState<any>(location?.state?.patient || null)
  const [prescription, setPrescription] = useState<any>(location?.state?.prescription || null)
  const [activeSection, setActiveSection] = useState<HistorySection>('personalInfo')

  const title = useMemo(() => {
    const nm = patient?.name ? String(patient.name) : 'Patient'
    const mrn = patient?.mrn ? String(patient.mrn) : ''
    return mrn ? `${nm} (MR: ${mrn})` : nm
  }, [patient])

  // Load history data if not provided in state
  useEffect(() => {
    if (row || !id) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const patientId = new URLSearchParams(location?.search || '').get('patientId') || ''
        if (patientId) {
          try {
            const rr: any = await hospitalApi.listHistoryTakings({ patientId, limit: 200 })
            const found = (rr?.historyTakings || []).find((x: any) => String(x?._id || x?.id || '') === String(id))
            if (!cancelled && found) setRow(found)
          } catch { }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, row, location?.search])

  // Load prescription data if encounterId is available
  useEffect(() => {
    if (prescription || !row?.encounterId) return
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.getPrescriptionByEncounter(row.encounterId)
        if (!cancelled && res?.prescription) {
          setPrescription(res.prescription)
        }
      } catch { }
    })()
    return () => { cancelled = true }
  }, [row?.encounterId, prescription])

  // Merge original history with doctor's edits
  const mergedData = useMemo(() => {
    const originalData = row?.data || {}
    const historyEdits = prescription?.historyEdits || {}

    const sections: HistorySection[] = [
      'personalInfo',
      'maritalStatus',
      'coitus',
      'health',
      'sexualHistory',
      'previousMedicalHistory',
      'arrivalReference'
    ]

    const merged: any = {}
    const allEditedPaths = new Set<string>()

    for (const section of sections) {
      const { data, editedPaths } = mergeHistoryWithEdits(
        originalData[section],
        historyEdits[section],
        section
      )
      merged[section] = data
      editedPaths.forEach(p => allEditedPaths.add(`${section}.${p}`))
    }

    return { data: merged, editedPaths: allEditedPaths }
  }, [row?.data, prescription?.historyEdits])

  const { data: historyData, editedPaths } = mergedData

  // Render helpers for each section
  const renderPersonalInfo = () => {
    const info: PersonalInfo = historyData.personalInfo || {}
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HistoryField label="Name" value={info.name} path="personalInfo.name" editedPaths={editedPaths} />
        <HistoryField label="MR No" value={info.mrNo} path="personalInfo.mrNo" editedPaths={editedPaths} />
        <HistoryField label="Age" value={info.age} path="personalInfo.age" editedPaths={editedPaths} />
        <HistoryField label="PT" value={info.pt} path="personalInfo.pt" editedPaths={editedPaths} />
        <HistoryField label="MAM Upto" value={info.mamUpto} path="personalInfo.mamUpto" editedPaths={editedPaths} />
        <HistoryField label="MAM PN" value={info.mamPn} path="personalInfo.mamPn" editedPaths={editedPaths} />
        <HistoryField label="Height" value={info.height} path="personalInfo.height" editedPaths={editedPaths} />
        <HistoryField label="Weight" value={info.weight} path="personalInfo.weight" editedPaths={editedPaths} />
        <HistoryField label="BP" value={info.bp} path="personalInfo.bp" editedPaths={editedPaths} />
        <HistoryField label="Current Address" value={info.currentAddress} path="personalInfo.currentAddress" editedPaths={editedPaths} />
        <HistoryField label="Permanent Address" value={info.permanentAddress} path="personalInfo.permanentAddress" editedPaths={editedPaths} />
        <HistoryField label="Visit Stay" value={info.visitStay} path="personalInfo.visitStay" editedPaths={editedPaths} />
        <HistoryField label="Contact 1" value={info.contact1} path="personalInfo.contact1" editedPaths={editedPaths} />
        <HistoryField label="Contact 2" value={info.contact2} path="personalInfo.contact2" editedPaths={editedPaths} />
        <HistoryField label="Sleep Hours" value={info.sleepHrs} path="personalInfo.sleepHrs" editedPaths={editedPaths} />
        <HistoryField label="Walk/Exercise" value={info.walkExercise} path="personalInfo.walkExercise" editedPaths={editedPaths} />
        <HistoryField label="Education" value={info.education} path="personalInfo.education" editedPaths={editedPaths} />
        <HistoryField label="Job Hours" value={info.jobHours} path="personalInfo.jobHours" editedPaths={editedPaths} />
        <HistoryField label="Nature of Work" value={info.natureOfWork} path="personalInfo.natureOfWork" editedPaths={editedPaths} />
        <HistoryField label="Relax" value={info.relax} path="personalInfo.relax" editedPaths={editedPaths} isBoolean />
        <HistoryField label="Stressful" value={info.stressful} path="personalInfo.stressful" editedPaths={editedPaths} isBoolean />
      </div>
    )
  }

  const renderMaritalStatus = () => {
    const status: MaritalStatus = historyData.maritalStatus || {}
    return (
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-1">
          <HistoryField label="Status" value={status.status} path="maritalStatus.status" editedPaths={editedPaths} />
          <HistoryField label="Time Period" value={status.timePeriod} path="maritalStatus.timePeriod" editedPaths={editedPaths} />
        </div>
        <div className="space-y-4">
          {status.marriages?.map((marriage, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">{idx + 1}{getOrdinalSuffix(idx + 1)} Marriage</div>
              <div className="grid gap-3 grid-cols-2">
                <HistoryField label="Status" value={marriage.status} path={`maritalStatus.marriages.${idx}.status`} editedPaths={editedPaths} />
                <HistoryField label="Years" value={marriage.years} path={`maritalStatus.marriages.${idx}.years`} editedPaths={editedPaths} />
                <HistoryField label="Months" value={marriage.months} path={`maritalStatus.marriages.${idx}.months`} editedPaths={editedPaths} />
                <HistoryField label="Mutual Satisfaction" value={marriage.mutualSatisfaction} path={`maritalStatus.marriages.${idx}.mutualSatisfaction`} editedPaths={editedPaths} />
                <HistoryField label="Mutual Cooperation" value={marriage.mutualCooperation} path={`maritalStatus.marriages.${idx}.mutualCooperation`} editedPaths={editedPaths} />
                <HistoryField label="Child Status" value={marriage.childStatus} path={`maritalStatus.marriages.${idx}.childStatus`} editedPaths={editedPaths} />
                <HistoryField label="Love Marriage" value={marriage.marriageType?.loveMarriage} path={`maritalStatus.marriages.${idx}.marriageType.loveMarriage`} editedPaths={editedPaths} isBoolean />
                <HistoryField label="Arrange Marriage" value={marriage.marriageType?.arrangeMarriage} path={`maritalStatus.marriages.${idx}.marriageType.arrangeMarriage`} editedPaths={editedPaths} isBoolean />
                <HistoryField label="Male Children" value={marriage.childStatus2?.male} path={`maritalStatus.marriages.${idx}.childStatus2.male`} editedPaths={editedPaths} />
                <HistoryField label="Female Children" value={marriage.childStatus2?.female} path={`maritalStatus.marriages.${idx}.childStatus2.female`} editedPaths={editedPaths} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderCoitus = () => {
    const coitus: Coitus = historyData.coitus || {}
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HistoryField label="Intercourse" value={coitus.intercourse} path="coitus.intercourse" editedPaths={editedPaths} />
        <HistoryField label="Partner Living" value={coitus.partnerLiving} path="coitus.partnerLiving" editedPaths={editedPaths} />
        <HistoryField label="Visit Home (Months)" value={coitus.visitHomeMonths} path="coitus.visitHomeMonths" editedPaths={editedPaths} />
        <HistoryField label="Visit Home (Days)" value={coitus.visitHomeDays} path="coitus.visitHomeDays" editedPaths={editedPaths} />
        <HistoryField label="Frequency Type" value={coitus.frequencyType} path="coitus.frequencyType" editedPaths={editedPaths} />
        <HistoryField label="Frequency Number" value={coitus.frequencyNumber} path="coitus.frequencyNumber" editedPaths={editedPaths} />
        <HistoryField label="Since" value={coitus.since} path="coitus.since" editedPaths={editedPaths} />
        <HistoryField label="Previous Frequency" value={coitus.previousFrequency} path="coitus.previousFrequency" editedPaths={editedPaths} />
      </div>
    )
  }

  const renderHealth = () => {
    const health: Health = historyData.health || {}
    return (
      <div className="space-y-4">
        {health.selectedConditions && health.selectedConditions.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Selected Conditions</div>
            <div className="mt-1 flex flex-wrap gap-2 text-sm font-medium">
              {health.selectedConditions.map((c: string) => {
                const key = String(c)
                const isEdited = isFieldEditedByDoctor(editedPaths, `health.selectedConditions.${key}`)
                return (
                  <span
                    key={key}
                    className={`rounded-md border px-2 py-0.5 ${isEdited ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                    title={isEdited ? 'Edited by doctor' : 'Entered by history taker'}
                  >
                    {key}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <HistoryField label="Diabetes - Me" value={health.diabetes?.me} path="health.diabetes.me" editedPaths={editedPaths} isBoolean />
          <HistoryField label="Diabetes - Father" value={health.diabetes?.father} path="health.diabetes.father" editedPaths={editedPaths} isBoolean />
          <HistoryField label="Diabetes - Mother" value={health.diabetes?.mother} path="health.diabetes.mother" editedPaths={editedPaths} isBoolean />
          <HistoryField label="Diabetes Since" value={health.diabetes?.since} path="health.diabetes.since" editedPaths={editedPaths} />
          <HistoryField label="Diabetes Medicine" value={health.diabetes?.medicineTaking} path="health.diabetes.medicineTaking" editedPaths={editedPaths} />
          <HistoryField label="Hypertension - Me" value={health.hypertension?.me} path="health.hypertension.me" editedPaths={editedPaths} isBoolean />
          <HistoryField label="Hypertension - Father" value={health.hypertension?.father} path="health.hypertension.father" editedPaths={editedPaths} isBoolean />
          <HistoryField label="Hypertension - Mother" value={health.hypertension?.mother} path="health.hypertension.mother" editedPaths={editedPaths} isBoolean />
          <HistoryField label="Hypertension Since" value={health.hypertension?.since} path="health.hypertension.since" editedPaths={editedPaths} />
          <HistoryField label="Hypertension Medicine" value={health.hypertension?.medicineTaking} path="health.hypertension.medicineTaking" editedPaths={editedPaths} />
          <HistoryField label="Smoking Status" value={health.smoking?.status} path="health.smoking.status" editedPaths={editedPaths} />
          <HistoryField label="Smoking Since" value={health.smoking?.since} path="health.smoking.since" editedPaths={editedPaths} />
          <HistoryField label="Smoking Quantity" value={`${health.smoking?.quantityNumber || ''} ${health.smoking?.quantityUnit || ''}`.trim()} path="health.smoking.quantityNumber" editedPaths={editedPaths} />
          <HistoryField label="Smoking Quit" value={health.smoking?.quit} path="health.smoking.quit" editedPaths={editedPaths} />
        </div>

        {(health.drugHistory?.wine ||
          health.drugHistory?.weed ||
          health.drugHistory?.tobacco ||
          health.drugHistory?.gutka ||
          health.drugHistory?.naswar ||
          health.drugHistory?.pan ||
          health.drugHistory?.other ||
          health.drugHistory?.quit) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-sm font-semibold text-slate-700">Drug History</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <HistoryField label="Wine" value={health.drugHistory?.wine} path="health.drugHistory.wine" editedPaths={editedPaths} isBoolean />
              <HistoryField label="Weed" value={health.drugHistory?.weed} path="health.drugHistory.weed" editedPaths={editedPaths} isBoolean />
              <HistoryField label="Tobacco" value={health.drugHistory?.tobacco} path="health.drugHistory.tobacco" editedPaths={editedPaths} isBoolean />
              <HistoryField label="Gutka" value={health.drugHistory?.gutka} path="health.drugHistory.gutka" editedPaths={editedPaths} isBoolean />
              <HistoryField label="Naswar" value={health.drugHistory?.naswar} path="health.drugHistory.naswar" editedPaths={editedPaths} isBoolean />
              <HistoryField label="Pan" value={health.drugHistory?.pan} path="health.drugHistory.pan" editedPaths={editedPaths} isBoolean />
              <HistoryField label="Other" value={health.drugHistory?.other} path="health.drugHistory.other" editedPaths={editedPaths} />
              <HistoryField label="Quit" value={health.drugHistory?.quit} path="health.drugHistory.quit" editedPaths={editedPaths} />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderSexualHistory = () => {
    const sh: SexualHistory = historyData.sexualHistory || {}
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Erection</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HistoryField label="Percentage" value={sh.erection?.percentage} path="sexualHistory.erection.percentage" editedPaths={editedPaths} />
            <HistoryFieldMulti
              label="Since"
              value={`${sh.erection?.sinceValue} ${sh.erection?.sinceUnit}`}
              paths={["sexualHistory.erection.sinceValue", "sexualHistory.erection.sinceUnit"]}
              editedPaths={editedPaths}
            />
            <HistoryField label="Pre-Penile" value={sh.erection?.prePeni} path="sexualHistory.erection.prePeni" editedPaths={editedPaths} isBoolean />
            <HistoryField label="Post-Penile" value={sh.erection?.postPeni} path="sexualHistory.erection.postPeni" editedPaths={editedPaths} isBoolean />
            <HistoryField label="EJ" value={sh.erection?.ej} path="sexualHistory.erection.ej" editedPaths={editedPaths} />
            <HistoryField label="MED" value={sh.erection?.med} path="sexualHistory.erection.med" editedPaths={editedPaths} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">PE (Premature Ejaculation)</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HistoryField label="Pre" value={sh.pe?.pre} path="sexualHistory.pe.pre" editedPaths={editedPaths} isBoolean />
            <HistoryFieldMulti
              label="Pre Value"
              value={`${sh.pe?.preValue} ${sh.pe?.preUnit}`}
              paths={["sexualHistory.pe.preValue", "sexualHistory.pe.preUnit"]}
              editedPaths={editedPaths}
            />
            <HistoryField label="Just" value={sh.pe?.just} path="sexualHistory.pe.just" editedPaths={editedPaths} isBoolean />
            <HistoryFieldMulti
              label="Since"
              value={`${sh.pe?.sinceValue} ${sh.pe?.sinceUnit}`}
              paths={["sexualHistory.pe.sinceValue", "sexualHistory.pe.sinceUnit"]}
              editedPaths={editedPaths}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HistoryField label="Desire" value={sh.desire?.status} path="sexualHistory.desire.status" editedPaths={editedPaths} />
          <HistoryField label="Nightfall" value={sh.nightfall?.status} path="sexualHistory.nightfall.status" editedPaths={editedPaths} />
          <HistoryField label="NPT" value={sh.npt?.status} path="sexualHistory.npt.status" editedPaths={editedPaths} />
          <HistoryField label="USS" value={sh.uss?.status} path="sexualHistory.uss.status" editedPaths={editedPaths} />
          <HistoryField label="OE Testes" value={sh.oe?.testes?.status} path="sexualHistory.oe.testes.status" editedPaths={editedPaths} />
          <HistoryField label="Inf Sexuality" value={sh.inf?.sexuality?.status} path="sexualHistory.inf.sexuality.status" editedPaths={editedPaths} />
        </div>
      </div>
    )
  }

  const renderPreviousMedicalHistory = () => {
    const pmh: PreviousMedicalHistory = historyData.previousMedicalHistory || {}
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <HistoryField label="Ex Consultation" value={pmh.exConsultation} path="previousMedicalHistory.exConsultation" editedPaths={editedPaths} />
        <HistoryField label="Ex Rx" value={pmh.exRx} path="previousMedicalHistory.exRx" editedPaths={editedPaths} />
        <HistoryField label="Cause" value={pmh.cause} path="previousMedicalHistory.cause" editedPaths={editedPaths} />
      </div>
    )
  }

  const renderArrivalReference = () => {
    const ar: ArrivalReference = historyData.arrivalReference || {}
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <HistoryField label="Referred By" value={ar.referredBy?.status} path="arrivalReference.referredBy.status" editedPaths={editedPaths} />
          <HistoryField label="Referred By Other" value={ar.referredBy?.other} path="arrivalReference.referredBy.other" editedPaths={editedPaths} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Ads/Social Media</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HistoryField label="YouTube" value={ar.adsSocialMedia?.youtube} path="arrivalReference.adsSocialMedia.youtube" editedPaths={editedPaths} isBoolean />
            <HistoryField label="Google" value={ar.adsSocialMedia?.google} path="arrivalReference.adsSocialMedia.google" editedPaths={editedPaths} isBoolean />
            <HistoryField label="Facebook" value={ar.adsSocialMedia?.facebook} path="arrivalReference.adsSocialMedia.facebook" editedPaths={editedPaths} isBoolean />
            <HistoryField label="Instagram" value={ar.adsSocialMedia?.instagram} path="arrivalReference.adsSocialMedia.instagram" editedPaths={editedPaths} isBoolean />
          </div>
        </div>
        {ar.keywords && ar.keywords.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">Keywords</div>
            <div className="mt-1 flex flex-wrap gap-2 text-sm font-medium">
              {ar.keywords.map((k: string) => {
                const key = String(k)
                const isEdited = isFieldEditedByDoctor(editedPaths, `arrivalReference.keywords.${key}`)
                return (
                  <span
                    key={key}
                    className={`rounded-md border px-2 py-0.5 ${isEdited ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                    title={isEdited ? 'Edited by doctor' : 'Entered by history taker'}
                  >
                    {key}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  function getOrdinalSuffix(n: number): string {
    const j = n % 10
    const k = n % 100
    if (j === 1 && k !== 11) return 'st'
    if (j === 2 && k !== 12) return 'nd'
    if (j === 3 && k !== 13) return 'rd'
    return 'th'
  }

  const sections: { key: HistorySection; title: string; render: () => React.ReactNode }[] = [
    { key: 'personalInfo', title: 'Personal Information', render: renderPersonalInfo },
    { key: 'maritalStatus', title: 'Marital Status', render: renderMaritalStatus },
    { key: 'coitus', title: 'Coitus', render: renderCoitus },
    { key: 'health', title: 'Health', render: renderHealth },
    { key: 'sexualHistory', title: 'Sexual History', render: renderSexualHistory },
    { key: 'previousMedicalHistory', title: 'Previous Medical History', render: renderPreviousMedicalHistory },
    { key: 'arrivalReference', title: 'Arrival Reference', render: renderArrivalReference },
  ]

  const hasAnyDoctorEdits = editedPaths.size > 0

  return (
    <div className="w-full px-2 sm:px-4">
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">Previous History</div>
          <div className="text-sm text-slate-600">{title}</div>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyDoctorEdits && (
            <div className="rounded-md bg-blue-50 px-3 py-1 text-xs text-blue-700">
              Blue = Edited by Doctor
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            Back
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        {loading && <div className="text-sm text-slate-700">Loading...</div>}
        {!loading && !row && <div className="text-sm text-slate-700">Not found.</div>}

        {!!row && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Hx By</div>
                <div className="text-sm font-semibold text-slate-900">{String(row?.hxBy || historyData?.hxBy || '-')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Hx Date</div>
                <div className="text-sm font-semibold text-slate-900">{String(row?.hxDate || historyData?.hxDate || '-')}</div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-slate-900"></span>
                <span className="text-slate-700">History Taker (Original)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-600"></span>
                <span className="text-slate-700">Doctor (Edited)</span>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {sections.map(section => (
                <HistorySectionView
                  key={section.key}
                  title={section.title}
                  isActive={activeSection === section.key}
                  onClick={() => setActiveSection(activeSection === section.key ? ('' as HistorySection) : section.key)}
                >
                  {section.render()}
                </HistorySectionView>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
