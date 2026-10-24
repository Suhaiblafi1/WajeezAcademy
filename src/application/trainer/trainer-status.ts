/* ═══ حالُ المدرّب وما ينتظره — سطرٌ واحدٌ في «المدربون» (٢٠ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة وهو ينظر في بطاقة حفصة: «هذه الصفحةُ طويلةٌ ومعقّدة.. يجب أن تكون هناك فلاترُ واضحةٌ لكلّ
   الحالات، وأن يكون كلُّ مدرّبٍ مضموما ومكتوبا حالُه، وما المطلوبُ منّي أو منه ليقوم بعمله». وكانت البطاقةُ تعرض
   كلَّ شيءٍ مفتوحا: دوراتِه وشعبَه، وملفَّه العامّ وحقولَه، والاقتراحات — ولا تقول في سطرٍ ما الذي يقف.

   فلكلّ مدرّبٍ هنا:
   · **خطواتٌ** — ما ينتظر أحدا الآن، ولكلٍّ صاحبُها: «منك» (الإدارة) أو «منه» (المدرّب). تُقرأ من بياناته وحدَها:
     حسابُه، وعقدُه ما دام طلبُه غيرَ نشط، وظهورُه، وخططُ شعبه، وملفُّه العامّ، والاقتراحاتُ، ودوراتٌ عُرضت عليه.
   · **وحالٌ واحدة** يُفرز بها: موقوف، ثمّ اسمُه لا يظهر وله دوراتٌ منشورة، ثمّ ينتظرك، ثمّ ينتظره، ثمّ لا شيء
     ينتظر. والحالُ مفردةٌ فمجموعُ الفلاتر عددُ المدرّبين.
   · **ومرحلةٌ واحدة** على سلّم دوراته (`trainerStageOf`، ٢٤ أكتوبر ٢٠٢٦) — فلترٌ ثانٍ مستقلٌّ عن الحال.

   والدوالُّ نقيّةٌ تقرؤها الشاشة (`TrainerRunOps.tsx`). */

import { countAr } from '../text/count-ar'
import { plainAr } from '../text/plain-ar'
import { STATUS_LABELS } from './application-status'
import { hiddenOnSale, planMarkOf, type CardCohort } from './trainer-card'

export type Turn = 'you' | 'trainer'
/* ═══ ولكلّ خطوةٍ منك بابُها (٢١ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة وهو ينظر في بطاقةٍ تقول «المطلوب منك: تجهيز عقده وإرساله» وتحتها «اعتمده مدربا»: «لماذا
   هذا الخيارُ هنا! يجب أن يأخذني الزرُّ للإجراء الذي ينتظرني». فلكلّ خطوةٍ منك فعلُها، وزرُّ البطاقة فعلُ
   أولاها — والشاشةُ تقرأ الفعلَ وتذهب به (`TrainerRunOps.tsx`). وما لا بابَ له بعدُ لا زرَّ له. */
export type StepAct = 'contract_new' | 'contract' | 'approve' | 'publish' | 'requests' | 'plans' | 'profile' | 'suggest'
export interface TrainerStep { turn: Turn; ar: string; act?: StepAct }

/** نصُّ زرّ كلّ فعل */
export const STEP_ACT_AR: Record<StepAct, string> = {
  contract_new: 'جهز عقده',
  contract: 'افتح عقده',
  approve: 'اعتمده مدربا',
  publish: 'اعتمد ظهوره',
  requests: 'افتح طلبات التأهيل',
  plans: 'راجع الخطة',
  profile: 'راجع ملفه',
  suggest: 'افتح الاقتراح',
}

/* ═══ «جاهز» و«بلا شعبة» خرجتا من الحال إلى المرحلة (٢٤ أكتوبر ٢٠٢٦) ═══

   كانت الحالُ مفردةً بترتيب: من ينتظر أحدا يقع في «ينتظرك» أو «ينتظر المدرب» أوّلا، و«بلا شعبة» لمن لا ينتظر شيئا
   ولا شعبةَ له. فمن لا شعبةَ له وينقصه رفعُ صورةٍ أو قبولُ دورةٍ — وهم أكثرُهم — كان في «ينتظر المدرب»، فقالت الصفحةُ
   «بلا شعبة (0)» وتحتها كثيرون بلا شعبة. فسأل صاحبُ المنصّة: «هناك العديد بلا شعبة ولا يظهروا في الفلتر!!!».
   فالحالُ الآن من ينتظر وحدَها، وما بقي «لا شيء ينتظر»؛ والشعبةُ في المرحلة (`trainerStageOf`) — فلترٌ مستقلٌّ يرى
   كلَّ من بلا شعبةٍ ولو كان ينتظر شيئا. */
export type TrainerState = 'hidden' | 'you' | 'trainer' | 'quiet' | 'suspended'

export const TRAINER_STATES: { id: TrainerState; ar: string; tone: 'danger' | 'accent' | 'info' | 'positive' | 'neutral' }[] = [
  { id: 'hidden', ar: 'اسمه لا يظهر', tone: 'danger' },
  { id: 'you', ar: 'ينتظرك', tone: 'accent' },
  { id: 'trainer', ar: 'ينتظر المدرب', tone: 'info' },
  { id: 'quiet', ar: 'لا شيء ينتظر', tone: 'neutral' },
  { id: 'suspended', ar: 'موقوف', tone: 'neutral' },
]

/* ═══ سلّمُ المدرّب مع دوراته — أربعُ كلماتٍ لا تتشابه (٢٤ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أنت تقول لديه دورة معتمدة.. معتمدة تعني أنا اعتمدتها رسميا». وكانت «معتمدة» تُقال لثلاثة:
   دورةٍ اخترناها له، ودورةٍ قبِلها هو، وخطّةٍ اعتمدناها. فصار لكلٍّ كلمتُه، كما رتّبها هو:
   · **مؤهل لها** — دورةٌ اخترناها له (`pending` أو `qualified`)، أجّلها أو لم يبدأ بها أو لم يوافق عليها بعد. فإن
     اعتذر عنها (`retired`) أو رُفض تأهيلُه (`rejected`) فليس مؤهلا لها. وطلبُ تأهيلٍ ينتظر قرارَك ليس تأهيلا بعد.
   · **وافق وفتح شعبة** — قبِل دورةً فأُنشئت له شعبتُها، أو أُسند إلى شعبة. والموافقةُ وفتحُ الشعبة فعلٌ واحدٌ في
     المنصّة: القبولُ في «مؤهّلاتي» يُنشئ الشعبة (`TrainerPrepService.accept`) — فهما مرحلةٌ واحدة.
   · **جاهز** — اعتمدتَ خطّةَ شعبةٍ له. و«معتمدة» لا تُقال إلّا لهذا.
   والمرحلةُ أعلى ما بلغه في شعبةٍ قائمة؛ والمنتهيةُ وراءه لا تجعله جاهزا لفصلٍ قادم. */
export type TrainerStage = 'none' | 'eligible' | 'opened' | 'ready'

export const TRAINER_STAGES: { id: TrainerStage; ar: string; tone: 'positive' | 'info' | 'neutral' }[] = [
  { id: 'none', ar: 'لا دورة مؤهل لها', tone: 'neutral' },
  { id: 'eligible', ar: 'مؤهل ولم يوافق', tone: 'neutral' },
  { id: 'opened', ar: 'وافق وفتح شعبة', tone: 'info' },
  { id: 'ready', ar: 'جاهز', tone: 'positive' },
]

export interface StageQualification { status: string; requested?: boolean }

/** أمؤهلٌ لها — اخترناها له ولم يعتذر عنها ولم يُرفض، وليست طلبا ينتظر قرارك */
export const isEligible = (q: StageQualification): boolean =>
  (q.status === 'pending' && !q.requested) || q.status === 'qualified'

/** مرحلتُه — أعلى ما بلغه في شعبةٍ قائمة، وإلّا أهو مؤهلٌ لدورة */
export function trainerStageOf(t: {
  qualifications: StageQualification[]
  cohorts: Pick<CardCohort, 'status' | 'plan' | 'postponedTo'>[]
}): TrainerStage {
  const live = t.cohorts.filter((c) => !DONE.includes(c.status))
  if (live.some((c) => planMarkOf(c) === 'approved')) return 'ready'
  if (live.length > 0) return 'opened'
  return t.qualifications.some(isEligible) ? 'eligible' : 'none'
}

export interface StatusInput {
  suspended: boolean
  hasAccount: boolean
  applicationStatus: string
  publiclyVisible: boolean
  isVerified: boolean
  hasLiveCourse: boolean
  photoUrl: string | null
  pendingPhotoUrl: string | null
  pendingText: unknown
  pitchDraft: string[] | null
  bioDraft: string | null
  pitchLatest: { status: string } | null
  bioLatest: { status: string } | null
  cohorts: Pick<CardCohort, 'status' | 'plan' | 'postponedTo'>[]
  /** آخرُ عقدٍ له غيرُ مُزاح — `null` = لا عقد */
  contract: { status: string } | null
  /** من طابور التأهيل: طلباتٌ تنتظر البتّ، ودوراتٌ عُرضت عليه لم يقبلها */
  queue: { requests: number; toAccept: number }
}

const DONE = ['completed', 'cancelled']
const SHEETS = { one: 'شعبة', two: 'شعبتين', few: 'شعب', many: 'شعبة' }
const COURSES = { one: 'دورة', two: 'دورتين', few: 'دورات', many: 'دورة' }
const ASKS = { one: 'طلب', two: 'طلبين', few: 'طلبات', many: 'طلبا' }
/** «خطة شعبة» · «خطط شعبتين» · «خطط 3 شعب» */
const plansOf = (n: number) => (n === 1 ? 'خطة شعبة' : n === 2 ? 'خطط شعبتين' : `خطط ${countAr(n, SHEETS)}`)
const some = (n: number, forms: typeof COURSES) => (n === 1 ? forms.one : n === 2 ? forms.two : countAr(n, forms))

/** يمكن أن تصله الاقتراحات — شرطُ «أرسل الكل» في الخادم نفسُه */
const reachable = (t: StatusInput) => t.applicationStatus === 'active' || t.hasLiveCourse

/** ما ينتظر أحدا الآن — بترتيب ما يوقف عمله أوّلا */
export function trainerSteps(t: StatusInput): TrainerStep[] {
  if (t.suspended) return []
  const you: { ar: string; act?: StepAct }[] = []
  const him: string[] = []
  const mine = (ar: string, act?: StepAct) => you.push({ ar, act })
  const active = t.applicationStatus === 'active'
  const invited = ['contract_pending', 'onboarding'].includes(t.applicationStatus)

  /* عقدُه — ما دام طلبُه غيرَ نشط. والنشطُ عقدُه وراءه */
  let contractStep: TrainerStep | null = null
  if (!active) {
    const c = t.contract?.status ?? null
    if (c === 'draft') contractStep = { turn: 'you', ar: 'إرسال عقده', act: 'contract' }
    else if (c === 'amendment_requested') contractStep = { turn: 'you', ar: 'الرد على طلب تعديل عقده', act: 'contract' }
    else if (c === 'signed') contractStep = { turn: 'you', ar: 'اعتماد توقيعه على العقد', act: 'contract' }
    else if (c === 'sent') contractStep = { turn: 'trainer', ar: 'توقيع عقده' }
    else if (c === 'declined' || c === 'revoked' || c === 'expired') contractStep = { turn: 'you', ar: 'إرسال عقد جديد له', act: 'contract_new' }
    else if (c === null && t.applicationStatus === 'conditionally_approved') contractStep = { turn: 'you', ar: 'تجهيز عقده وإرساله', act: 'contract_new' }
  }

  /* ═══ حسابُه: بلا حسابٍ لا يدخل بوّابتَه. ومن دُعي فإنشاؤه عليه ═══

     وكان سطرُه لمن سواه «قبوله من «طلبات المدربين» — لا حساب له»، فسأل صاحبُ المنصّة (٢٠ أكتوبر ٢٠٢٦):
     «ماذا تقصد بقبول المدرب.. قبول داخلي؟ اجعلها أسهل، اعتمده من هنا بدل من هناك». وكان السطرُ يكرّر خطوةً
     يقولها العقد: اعتمادُ توقيعه يربط حسابَه وحدَه. فإن كانت للعقد خطوةٌ فهي تكفي، وإلّا قيل «اعتماده مدربا»
     — وزرُّه في بطاقته (`TrainerRunOps.tsx`). */
  if (!t.hasAccount) {
    if (invited) him.push('إنشاء حسابه من الدعوة')
    else if (active) mine('ربط حساب بملفه — لا حساب له')
    else if (!contractStep) mine('اعتماده مدربا — لا حساب له بعد', 'approve')
  }
  if (contractStep) {
    if (contractStep.turn === 'you') mine(contractStep.ar, contractStep.act)
    else him.push(contractStep.ar)
  }

  /* ظهورُه: له دوراتٌ منشورةٌ واسمُه لا يظهر. والزرُّ لا يقبل طلبا غيرَ نشط — فهناك تكفي خطواتُ تفعيله */
  if (hiddenOnSale(t) && active) mine('اعتماد ظهوره — له دورات منشورة واسمه لا يظهر', 'publish')

  /* طابورُ التأهيل */
  if (t.queue.requests > 0) mine(`البت في ${some(t.queue.requests, ASKS)} تأهيل`, 'requests')
  if (t.queue.toAccept > 0) him.push(`الموافقة على ${some(t.queue.toAccept, COURSES)} مؤهل لها`)

  /* خططُ شعبه القائمة */
  const live = t.cohorts.filter((c) => !DONE.includes(c.status))
  const marks = live.map((c) => planMarkOf(c))
  const n = (m: string) => marks.filter((x) => x === m).length
  if (n('submitted') > 0) mine(`اعتماد ${plansOf(n('submitted'))}`, 'plans')
  if (n('none') + n('draft') > 0) him.push(`كتابة ${plansOf(n('none') + n('draft'))}`)
  if (n('returned') > 0) him.push(`تعديل ${plansOf(n('returned'))} رددتها`)

  /* ملفُّه العامّ */
  /* واسمُه الجديدُ يُرسل معهما فيُقال أوّلا (٢١ أكتوبر ٢٠٢٦) */
  const renamed = Boolean((t.pendingText as { name?: string | null } | null)?.name)
  if (renamed) mine(t.pendingPhotoUrl ? 'مراجعة اسمه الجديد ونبذته وصورته' : 'مراجعة اسمه الجديد ونبذته', 'profile')
  else if (t.pendingText && t.pendingPhotoUrl) mine('مراجعة نبذته وصورته الجديدتين', 'profile')
  else if (t.pendingText) mine('مراجعة نبذته الجديدة', 'profile')
  else if (t.pendingPhotoUrl) mine('مراجعة صورته الجديدة', 'profile')
  else if (!t.photoUrl) him.push('رفع صورته')

  /* اقتراحاتُنا على بطاقته: ما لم يُرسل علينا، وما أُرسل ولم يُجب عليه */
  if (reachable(t)) {
    if (t.pitchDraft && t.bioDraft) mine('إرسال اقتراحي «لماذا نفتخر به» والنبذة', 'suggest')
    else if (t.pitchDraft) mine('إرسال اقتراح «لماذا نفتخر به»', 'suggest')
    else if (t.bioDraft) mine('إرسال اقتراح النبذة', 'suggest')
  }
  const waiting = [t.pitchLatest, t.bioLatest].filter((s) => s?.status === 'pending').length
  if (waiting > 0) him.push(waiting === 2 ? 'الرد على اقتراحينا' : 'الرد على اقتراحنا')

  return [
    ...you.map((y) => ({ turn: 'you' as const, ...y })),
    ...him.map((ar) => ({ turn: 'trainer' as const, ar })),
  ]
}

/** حالُه الواحدة — يُفرز بها ويُصفّى */
export function trainerStateOf(t: StatusInput, steps: TrainerStep[] = trainerSteps(t)): TrainerState {
  if (t.suspended) return 'suspended'
  if (hiddenOnSale(t)) return 'hidden'
  if (steps.some((s) => s.turn === 'you')) return 'you'
  if (steps.some((s) => s.turn === 'trainer')) return 'trainer'
  return 'quiet'
}

/** سطرُ الصاحب: «المطلوب منك: اعتماد خطة شعبة · مراجعة صورته الجديدة» — أو لا شيء.
    و`from` يتخطّى ما قيل في الوسم: فيقال الباقي «وأيضا منك» */
export function stepsLineAr(steps: TrainerStep[], turn: Turn, from = 0): string | null {
  const mine = steps.filter((s) => s.turn === turn).slice(from).map((s) => s.ar)
  if (mine.length === 0) return null
  const head = turn === 'trainer' ? 'المطلوب منه' : from > 0 ? 'وأيضا منك' : 'المطلوب منك'
  return `${head}: ${mine.join(' · ')}`
}

/* ═══ و«ينتظرك» يقول ما ينتظر (٢١ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «عند الاسم "ينتظرك" — يجب أن تكون ينتظرك وتضع معها المطلوبَ منّي بصورةٍ واضحة لأميّز
   ما المطلوبُ بسهولة». فوسمُ «ينتظرك» يحمل أولى خطواتك بلا شرحها بعد الشَّرطة، وسطرُ «المطلوب منك» يقول ما
   بعدها وحدَه (`stepsLineAr(…, 'you', 1)`). وسائرُ الحالات وسمُها اسمُها. */
export function stateChipAr(state: TrainerState, steps: TrainerStep[]): string {
  const name = TRAINER_STATES.find((x) => x.id === state)!.ar
  const first = state === 'you' ? steps.find((s) => s.turn === 'you') : undefined
  return first ? `${name}: ${first.ar.split(' — ')[0]}` : name
}

/** أوّلُ خطوةٍ منك لها باب — وهي زرُّ البطاقة */
export function firstActOf(steps: TrainerStep[]): TrainerStep | null {
  return steps.find((s) => s.turn === 'you' && s.act) ?? null
}

/* ═══ والمعتمَدةُ بلا شعبةٍ تنتظره هو (٢١ أكتوبر ٢٠٢٦) ═══

   كان «قبولُ دورةٍ عُرضت عليه» يُعدّ من طابور التأهيل وحدَه — والطابورُ صفوفٌ معلّقة. والدورةُ المعتمَدةُ له
   بلا شعبةٍ يقبلها هو في «مؤهّلاتي» فتُنشأ مسوّدتُها (قرارُ ٣ أكتوبر «B»، `approvedWithoutCohort`) — فلا تُعدّ.
   فقالت البطاقةُ لمدرّبٍ نشطٍ ينتظر قبولُه «بلا شعبة — يسند من صفحة الشعبة»، فسأل صاحبُ المنصّة: «لماذا لم تكن
   تلقائيا كالعادة؟». واختار «A»: يُقال إنّها تنتظره، ويبقى القبولُ قبولَه.

   والقاعدةُ قاعدةُ الخادم: معتمَدةٌ ولا شعبةَ له فيها غيرَ ملغاة. فمن انتهت شعبتُه فيها لا يُعرض عليه قبولُها —
   الشعبُ الزائدةُ تنشئها الإدارة — ويبقى بلا شعبة. */
export function approvedToAccept(t: {
  qualifications: { courseId: string; status: string }[]
  cohorts: { courseId: string; status: string }[]
}): number {
  const held = new Set(t.cohorts.filter((c) => c.status !== 'cancelled').map((c) => c.courseId))
  return new Set(t.qualifications.filter((q) => q.status === 'qualified' && !held.has(q.courseId)).map((q) => q.courseId)).size
}

/** ما يقال حين لا ينتظر شيء — والغائبُ بطلبٍ غيرِ نشطٍ يقال طورُ طلبه، فهو ما ينشره حين ينشط */
export function quietLineAr(state: TrainerState, applicationStatus: string, stage: TrainerStage): string | null {
  if (state === 'hidden') {
    return applicationStatus === 'active' ? null : `يظهر حين ينشط طلبه — طلبه الآن: ${plainAr(STATUS_LABELS[applicationStatus] ?? applicationStatus)}`
  }
  if (state === 'quiet') {
    if (stage === 'ready') return 'لا شيء ينتظر — اعتمدت خطة شعبته'
    if (stage === 'opened') return 'لا شيء ينتظر'
    return 'لا شيء ينتظر — لا شعبة قادمة له. يسند من صفحة الشعبة'
  }
  if (state === 'suspended') return 'موقوف — يرفع الإيقاف من ملفه في «طلبات المدربين»'
  return null
}
