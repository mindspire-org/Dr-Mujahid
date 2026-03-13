import { Schema, model, models } from 'mongoose'

// Marriage sub-schema
const MarriageSchema = new Schema({
  status: { type: String, enum: ['', 'Married', 'To Go'], default: '' },
  timePeriod: { type: String, default: '' },
  years: { type: String, default: '' },
  months: { type: String, default: '' },
  divorce: { type: String, default: '' },
  separation: { type: String, default: '' },
  reas: { type: String, default: '' },
  ageOfWife: { type: String, default: '' },
  educationOfWife: { type: String, default: '' },
  marriageType: {
    loveMarriage: { type: Boolean, default: false },
    arrangeMarriage: { type: Boolean, default: false },
    like: { type: Boolean, default: false },
  },
  mutualSatisfaction: { type: String, enum: ['', 'Satisfactory', 'Non-Satisfactory'], default: '' },
  mutualCooperation: { type: String, enum: ['', 'Cooperative', 'Non Cooperative'], default: '' },
  childStatus: { type: String, enum: ['', 'No Plan', 'Trying'], default: '' },
  childStatus2: {
    minors: { type: Boolean, default: false },
    pregnant: { type: Boolean, default: false },
    abortion: { type: Boolean, default: false },
    male: { type: String, default: '' },
    female: { type: String, default: '' },
  },
}, { _id: false })

// Marital Status schema
const MaritalStatusSchema = new Schema({
  status: { type: String, enum: ['', 'Married', 'To Go', 'Single'], default: '' },
  timePeriod: { type: String, default: '' },
  marriages: { type: [MarriageSchema], default: [] },
}, { _id: false })

// Coitus schema
const CoitusSchema = new Schema({
  intercourse: { type: String, enum: ['', 'Successful', 'Faild'], default: '' },
  partnerLiving: { type: String, enum: ['', 'Together', 'Out of Town'], default: '' },
  visitHomeMonths: { type: String, default: '' },
  visitHomeDays: { type: String, default: '' },
  frequencyType: { type: String, enum: ['', 'Daily', 'Weekly', 'Monthly'], default: '' },
  frequencyNumber: { type: String, default: '' },
  since: { type: String, default: '' },
  previousFrequency: { type: String, default: '' },
}, { _id: false })

// Health schema
const HealthSchema = new Schema({
  selectedConditions: { type: [String], default: [] },
  diabetes: {
    me: { type: Boolean, default: false },
    father: { type: Boolean, default: false },
    mother: { type: Boolean, default: false },
    since: { type: String, default: '' },
    medicineTaking: { type: String, default: '' },
  },
  hypertension: {
    me: { type: Boolean, default: false },
    father: { type: Boolean, default: false },
    mother: { type: Boolean, default: false },
    since: { type: String, default: '' },
    medicineTaking: { type: String, default: '' },
  },
  drugHistory: {
    wine: { type: Boolean, default: false },
    weed: { type: Boolean, default: false },
    tobacco: { type: Boolean, default: false },
    gutka: { type: Boolean, default: false },
    naswar: { type: Boolean, default: false },
    pan: { type: Boolean, default: false },
    other: { type: String, default: '' },
    quit: { type: String, default: '' },
  },
  smoking: {
    status: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    since: { type: String, default: '' },
    quantityUnit: { type: String, enum: ['', 'Packs', 'Units'], default: '' },
    quantityNumber: { type: String, default: '' },
    quit: { type: String, default: '' },
  },
}, { _id: false })

// Sexual History schema
const SexualHistorySchema = new Schema({
  erection: {
    percentage: { type: String, default: '' },
    sinceValue: { type: String, default: '' },
    sinceUnit: { type: String, enum: ['', 'Year', 'Month', 'Week', 'Day'], default: '' },
    prePeni: { type: Boolean, default: false },
    postPeni: { type: Boolean, default: false },
    ej: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    med: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    other: { type: String, default: '' },
  },
  pe: {
    pre: { type: Boolean, default: false },
    preValue: { type: String, default: '' },
    preUnit: { type: String, enum: ['', 'Sec', 'JK', 'Min'], default: '' },
    just: { type: Boolean, default: false },
    justValue: { type: String, default: '' },
    justUnit: { type: String, enum: ['', 'Sec', 'JK', 'Min'], default: '' },
    sinceValue: { type: String, default: '' },
    sinceUnit: { type: String, enum: ['', 'Year', 'Month', 'Week', 'Day'], default: '' },
    other: { type: String, default: '' },
  },
  pFluid: {
    foreplay: { type: Boolean, default: false },
    phonixSex: { type: Boolean, default: false },
    onThoughts: { type: Boolean, default: false },
    pornAddiction: { type: Boolean, default: false },
    other: { type: String, default: '' },
    status: {
      noIssue: { type: Boolean, default: false },
      erDown: { type: Boolean, default: false },
      weakness: { type: Boolean, default: false },
    },
  },
  ud: {
    status: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    other: { type: String, default: '' },
  },
  pSize: {
    bent: { type: Boolean, default: false },
    bentLeft: { type: Boolean, default: false },
    bentRight: { type: Boolean, default: false },
    small: { type: Boolean, default: false },
    smallHead: { type: Boolean, default: false },
    smallBody: { type: Boolean, default: false },
    smallTip: { type: Boolean, default: false },
    smallMid: { type: Boolean, default: false },
    smallBase: { type: Boolean, default: false },
    shrink: { type: Boolean, default: false },
    boeing: { type: String, enum: ['', 'Yes', 'No'], default: '' },
  },
  inf: {
    sexuality: {
      status: { type: String, enum: ['', 'OK', 'Disturbed'], default: '' },
    },
    diagnosis: {
      azos: { type: Boolean, default: false },
      oligo: { type: Boolean, default: false },
      terato: { type: Boolean, default: false },
      astheno: { type: Boolean, default: false },
    },
    problems: {
      magi: { type: Boolean, default: false },
      cystitis: { type: Boolean, default: false },
      balanitis: { type: Boolean, default: false },
    },
    others: { type: String, default: '' },
  },
  oeMuscle: {
    ok: { type: Boolean, default: false },
    semi: { type: Boolean, default: false },
    fl: { type: Boolean, default: false },
  },
  oe: {
    disease: {
      peyronie: { type: Boolean, default: false },
      calcification: { type: Boolean, default: false },
    },
    testes: {
      status: { type: String, enum: ['', 'Atrophic', 'Normal'], default: '' },
    },
    epidCst: {
      right: { type: Boolean, default: false },
      left: { type: Boolean, default: false },
    },
    varicocele: {
      right: { type: Boolean, default: false },
      left: { type: Boolean, default: false },
      rightGrades: {
        g1: { type: Boolean, default: false },
        g2: { type: Boolean, default: false },
        g3: { type: Boolean, default: false },
        g4: { type: Boolean, default: false },
      },
      leftGrades: {
        g1: { type: Boolean, default: false },
        g2: { type: Boolean, default: false },
        g3: { type: Boolean, default: false },
        g4: { type: Boolean, default: false },
      },
    },
  },
  uss: {
    status: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    other: { type: String, default: '' },
  },
  npt: {
    status: { type: String, enum: ['', 'OK', 'NIL', 'RARE'], default: '' },
    erectionPercentage: { type: String, default: '' },
    sinceValue: { type: String, default: '' },
    sinceUnit: { type: String, enum: ['', 'Year', 'Month', 'Week', 'Day'], default: '' },
    other: { type: String, default: '' },
  },
  desire: {
    status: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    other: { type: String, default: '' },
  },
  nightfall: {
    status: { type: String, enum: ['', 'Yes', 'No'], default: '' },
    other: { type: String, default: '' },
  },
  experiences: {
    preMarriage: {
      gf: { type: Boolean, default: false },
      male: { type: Boolean, default: false },
      pros: { type: Boolean, default: false },
      mb: { type: Boolean, default: false },
      multipleP: { type: Boolean, default: false },
      multipleOrOnce: { type: String, enum: ['', 'Once', 'Multiple'], default: '' },
      other: { type: String, default: '' },
    },
    postMarriage: {
      gf: { type: Boolean, default: false },
      male: { type: Boolean, default: false },
      pros: { type: Boolean, default: false },
      mb: { type: Boolean, default: false },
      multipleP: { type: Boolean, default: false },
      multipleOrOnce: { type: String, enum: ['', 'Once', 'Multiple'], default: '' },
      other: { type: String, default: '' },
    },
  },
}, { _id: false })

// Previous Medical History schema
const PreviousMedicalHistorySchema = new Schema({
  exConsultation: { type: String, default: '' },
  exRx: { type: String, default: '' },
  cause: { type: String, default: '' },
}, { _id: false })

// Arrival Reference schema
const ArrivalReferenceSchema = new Schema({
  referredBy: {
    status: { type: String, enum: ['', 'Doctor', 'Friend'], default: '' },
    other: { type: String, default: '' },
  },
  adsSocialMedia: {
    youtube: { type: Boolean, default: false },
    google: { type: Boolean, default: false },
    facebook: { type: Boolean, default: false },
    instagram: { type: Boolean, default: false },
    other: { type: String, default: '' },
  },
  keywords: { type: [String], default: [] },
  keywordsInput: { type: String, default: '' },
  appearOnKeyword: {
    drAslamNaveed: { type: Boolean, default: false },
    drMujahidFarooq: { type: Boolean, default: false },
    mensCareClinic: { type: Boolean, default: false },
    olaDoc: { type: Boolean, default: false },
    marham: { type: Boolean, default: false },
  },
}, { _id: false })

// Personal Info schema
const PersonalInfoSchema = new Schema({
  name: { type: String, default: '' },
  mrNo: { type: String, default: '' },
  age: { type: String, default: '' },
  pt: { type: String, default: '' },
  mamUpto: { type: String, default: '' },
  mamPn: { type: String, default: '' },
  height: { type: String, default: '' },
  weight: { type: String, default: '' },
  bp: { type: String, default: '' },
  currentAddress: { type: String, default: '' },
  permanentAddress: { type: String, default: '' },
  visitStay: { type: String, default: '' },
  contact1: { type: String, default: '' },
  contact2: { type: String, default: '' },
  sleepHrs: { type: String, default: '' },
  walkExercise: { type: String, default: '' },
  education: { type: String, default: '' },
  jobHours: { type: String, default: '' },
  natureOfWork: { type: String, default: '' },
  relax: { type: Boolean, default: false },
  stressful: { type: Boolean, default: false },
}, { _id: false })

// Data schema containing all tabs
const DataSchema = new Schema({
  hxBy: { type: String },
  hxDate: { type: String },
  personalInfo: { type: PersonalInfoSchema, default: () => ({}) },
  maritalStatus: { type: MaritalStatusSchema, default: () => ({}) },
  coitus: { type: CoitusSchema, default: () => ({}) },
  health: { type: HealthSchema, default: () => ({}) },
  sexualHistory: { type: SexualHistorySchema, default: () => ({}) },
  previousMedicalHistory: { type: PreviousMedicalHistorySchema, default: () => ({}) },
  arrivalReference: { type: ArrivalReferenceSchema, default: () => ({}) },
}, { _id: false })

const HistoryTakingSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', required: true, index: true },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter', required: true, index: true, unique: true },
  tokenId: { type: Schema.Types.ObjectId, ref: 'Hospital_Token', index: true },
  hxBy: { type: String },
  hxDate: { type: String },
  data: { type: DataSchema, default: () => ({}) },
  submittedAt: { type: Date, default: Date.now, index: true },
  submittedBy: { type: String },
}, { timestamps: true })

HistoryTakingSchema.index({ patientId: 1, submittedAt: -1 })

export type HospitalHistoryTakingDoc = {
  _id: string
  patientId: string
  encounterId: string
  tokenId?: string
  hxBy?: string
  hxDate?: string
  data?: any
  submittedAt: Date
  submittedBy?: string
}

export const HospitalHistoryTaking = models.Hospital_HistoryTaking || model('Hospital_HistoryTaking', HistoryTakingSchema)
