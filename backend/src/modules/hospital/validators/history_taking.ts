import { z } from 'zod'

// Marriage schema
const MarriageSchema = z.object({
  status: z.enum(['', 'Married', 'To Go']).default(''),
  timePeriod: z.string().default(''),
  years: z.string().default(''),
  months: z.string().default(''),
  divorce: z.string().default(''),
  separation: z.string().default(''),
  reas: z.string().default(''),
  ageOfWife: z.string().default(''),
  educationOfWife: z.string().default(''),
  marriageType: z.object({
    loveMarriage: z.boolean().default(false),
    arrangeMarriage: z.boolean().default(false),
    like: z.boolean().default(false),
  }).default({}),
  mutualSatisfaction: z.enum(['', 'Satisfactory', 'Non-Satisfactory']).default(''),
  mutualCooperation: z.enum(['', 'Cooperative', 'Non Cooperative']).default(''),
  childStatus: z.enum(['', 'No Plan', 'Trying']).default(''),
  childStatus2: z.object({
    minors: z.boolean().default(false),
    pregnant: z.boolean().default(false),
    abortion: z.boolean().default(false),
    male: z.string().default(''),
    female: z.string().default(''),
  }).default({}),
}).default({})

// Marital Status schema
const MaritalStatusSchema = z.object({
  status: z.enum(['', 'Married', 'To Go', 'Single']).default(''),
  timePeriod: z.string().default(''),
  marriages: z.array(MarriageSchema).default([]),
}).default({})

// Coitus schema
const CoitusSchema = z.object({
  intercourse: z.enum(['', 'Successful', 'Faild']).default(''),
  partnerLiving: z.enum(['', 'Together', 'Out of Town']).default(''),
  visitHomeMonths: z.string().default(''),
  visitHomeDays: z.string().default(''),
  frequencyType: z.enum(['', 'Daily', 'Weekly', 'Monthly']).default(''),
  frequencyNumber: z.string().default(''),
  since: z.string().default(''),
  previousFrequency: z.string().default(''),
}).default({})

// Health schema
const HealthSchema = z.object({
  selectedConditions: z.array(z.string()).default([]),
  diabetes: z.object({
    me: z.boolean().default(false),
    father: z.boolean().default(false),
    mother: z.boolean().default(false),
    since: z.string().default(''),
    medicineTaking: z.string().default(''),
  }).default({}),
  hypertension: z.object({
    me: z.boolean().default(false),
    father: z.boolean().default(false),
    mother: z.boolean().default(false),
    since: z.string().default(''),
    medicineTaking: z.string().default(''),
  }).default({}),
  drugHistory: z.object({
    wine: z.boolean().default(false),
    weed: z.boolean().default(false),
    tobacco: z.boolean().default(false),
    gutka: z.boolean().default(false),
    naswar: z.boolean().default(false),
    pan: z.boolean().default(false),
    other: z.string().default(''),
    quit: z.string().default(''),
  }).default({}),
  smoking: z.object({
    status: z.enum(['', 'Yes', 'No']).default(''),
    since: z.string().default(''),
    quantityUnit: z.enum(['', 'Packs', 'Units']).default(''),
    quantityNumber: z.string().default(''),
    quit: z.string().default(''),
  }).default({}),
}).default({})

// Sexual History schema
const SexualHistorySchema = z.object({
  erection: z.object({
    percentage: z.string().default(''),
    sinceValue: z.string().default(''),
    sinceUnit: z.enum(['', 'Year', 'Month', 'Week', 'Day']).default(''),
    prePeni: z.boolean().default(false),
    postPeni: z.boolean().default(false),
    ej: z.enum(['', 'Yes', 'No']).default(''),
    med: z.enum(['', 'Yes', 'No']).default(''),
    other: z.string().default(''),
  }).default({}),
  pe: z.object({
    pre: z.boolean().default(false),
    preValue: z.string().default(''),
    preUnit: z.enum(['', 'Sec', 'JK', 'Min']).default(''),
    just: z.boolean().default(false),
    justValue: z.string().default(''),
    justUnit: z.enum(['', 'Sec', 'JK', 'Min']).default(''),
    sinceValue: z.string().default(''),
    sinceUnit: z.enum(['', 'Year', 'Month', 'Week', 'Day']).default(''),
    other: z.string().default(''),
  }).default({}),
  pFluid: z.object({
    foreplay: z.boolean().default(false),
    phonixSex: z.boolean().default(false),
    onThoughts: z.boolean().default(false),
    pornAddiction: z.boolean().default(false),
    other: z.string().default(''),
    status: z.object({
      noIssue: z.boolean().default(false),
      erDown: z.boolean().default(false),
      weakness: z.boolean().default(false),
    }).default({}),
  }).default({}),
  ud: z.object({
    status: z.enum(['', 'Yes', 'No']).default(''),
    other: z.string().default(''),
  }).default({}),
  pSize: z.object({
    bent: z.boolean().default(false),
    bentLeft: z.boolean().default(false),
    bentRight: z.boolean().default(false),
    small: z.boolean().default(false),
    smallHead: z.boolean().default(false),
    smallBody: z.boolean().default(false),
    smallTip: z.boolean().default(false),
    smallMid: z.boolean().default(false),
    smallBase: z.boolean().default(false),
    shrink: z.boolean().default(false),
    boeing: z.enum(['', 'Yes', 'No']).default(''),
  }).default({}),
  inf: z.object({
    sexuality: z.object({
      status: z.enum(['', 'OK', 'Disturbed']).default(''),
    }).default({}),
    diagnosis: z.object({
      azos: z.boolean().default(false),
      oligo: z.boolean().default(false),
      terato: z.boolean().default(false),
      astheno: z.boolean().default(false),
    }).default({}),
    problems: z.object({
      magi: z.boolean().default(false),
      cystitis: z.boolean().default(false),
      balanitis: z.boolean().default(false),
    }).default({}),
    others: z.string().default(''),
  }).default({}),
  oeMuscle: z.object({
    ok: z.boolean().default(false),
    semi: z.boolean().default(false),
    fl: z.boolean().default(false),
  }).default({}),
  oe: z.object({
    disease: z.object({
      peyronie: z.boolean().default(false),
      calcification: z.boolean().default(false),
    }).default({}),
    testes: z.object({
      status: z.enum(['', 'Atrophic', 'Normal']).default(''),
    }).default({}),
    epidCst: z.object({
      right: z.boolean().default(false),
      left: z.boolean().default(false),
    }).default({}),
    varicocele: z.object({
      right: z.boolean().default(false),
      left: z.boolean().default(false),
      rightGrades: z.object({
        g1: z.boolean().default(false),
        g2: z.boolean().default(false),
        g3: z.boolean().default(false),
        g4: z.boolean().default(false),
      }).default({}),
      leftGrades: z.object({
        g1: z.boolean().default(false),
        g2: z.boolean().default(false),
        g3: z.boolean().default(false),
        g4: z.boolean().default(false),
      }).default({}),
    }).default({}),
  }).default({}),
  uss: z.object({
    status: z.enum(['', 'Yes', 'No']).default(''),
    other: z.string().default(''),
  }).default({}),
  npt: z.object({
    status: z.enum(['', 'OK', 'NIL', 'RARE']).default(''),
    erectionPercentage: z.string().default(''),
    sinceValue: z.string().default(''),
    sinceUnit: z.enum(['', 'Year', 'Month', 'Week', 'Day']).default(''),
    other: z.string().default(''),
  }).default({}),
  desire: z.object({
    status: z.enum(['', 'Yes', 'No']).default(''),
    other: z.string().default(''),
  }).default({}),
  nightfall: z.object({
    status: z.enum(['', 'Yes', 'No']).default(''),
    other: z.string().default(''),
  }).default({}),
  experiences: z.object({
    preMarriage: z.object({
      gf: z.boolean().default(false),
      male: z.boolean().default(false),
      pros: z.boolean().default(false),
      mb: z.boolean().default(false),
      multipleP: z.boolean().default(false),
      multipleOrOnce: z.enum(['', 'Once', 'Multiple']).default(''),
      other: z.string().default(''),
    }).default({}),
    postMarriage: z.object({
      gf: z.boolean().default(false),
      male: z.boolean().default(false),
      pros: z.boolean().default(false),
      mb: z.boolean().default(false),
      multipleP: z.boolean().default(false),
      multipleOrOnce: z.enum(['', 'Once', 'Multiple']).default(''),
      other: z.string().default(''),
    }).default({}),
  }).default({}),
}).default({})

// Previous Medical History schema
const PreviousMedicalHistorySchema = z.object({
  exConsultation: z.string().default(''),
  exRx: z.string().default(''),
  cause: z.string().default(''),
}).default({})

// Arrival Reference schema
const ArrivalReferenceSchema = z.object({
  referredBy: z.object({
    status: z.enum(['', 'Doctor', 'Friend']).default(''),
    other: z.string().default(''),
  }).default({}),
  adsSocialMedia: z.object({
    youtube: z.boolean().default(false),
    google: z.boolean().default(false),
    facebook: z.boolean().default(false),
    instagram: z.boolean().default(false),
    other: z.string().default(''),
  }).default({}),
  keywords: z.array(z.string()).default([]),
  keywordsInput: z.string().default(''),
  appearOnKeyword: z.object({
    drAslamNaveed: z.boolean().default(false),
    drMujahidFarooq: z.boolean().default(false),
    mensCareClinic: z.boolean().default(false),
    olaDoc: z.boolean().default(false),
    marham: z.boolean().default(false),
  }).default({}),
}).default({})

// Personal Info schema
const PersonalInfoSchema = z.object({
  name: z.string().default(''),
  mrNo: z.string().default(''),
  age: z.string().default(''),
  pt: z.string().default(''),
  mamUpto: z.string().default(''),
  mamPn: z.string().default(''),
  height: z.string().default(''),
  weight: z.string().default(''),
  bp: z.string().default(''),
  currentAddress: z.string().default(''),
  permanentAddress: z.string().default(''),
  visitStay: z.string().default(''),
  contact1: z.string().default(''),
  contact2: z.string().default(''),
  sleepHrs: z.string().default(''),
  walkExercise: z.string().default(''),
  education: z.string().default(''),
  jobHours: z.string().default(''),
  natureOfWork: z.string().default(''),
  relax: z.boolean().default(false),
  stressful: z.boolean().default(false),
}).default({})

// Data schema
const DataSchema = z.object({
  hxBy: z.string().optional(),
  hxDate: z.string().optional(),
  personalInfo: PersonalInfoSchema,
  maritalStatus: MaritalStatusSchema,
  coitus: CoitusSchema,
  health: HealthSchema,
  sexualHistory: SexualHistorySchema,
  previousMedicalHistory: PreviousMedicalHistorySchema,
  arrivalReference: ArrivalReferenceSchema,
}).default({})

export const upsertHistoryTakingSchema = z.object({
  tokenId: z.string().optional(),
  hxBy: z.string().optional(),
  hxDate: z.string().optional(),
  data: DataSchema,
  submittedBy: z.string().optional(),
})
