/* ═══ حالُ المدرّب وما ينتظره — سطرٌ واحدٌ في «المدربون» (٢٠ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة وهو ينظر في بطاقة حفصة: «هذه الصفحةُ طويلةٌ ومعقّدة.. يجب أن تكون هناك فلاترُ واضحةٌ لكلّ
   الحالات، وأن يكون كلُّ مدرّبٍ مضموما ومكتوبا حالُه، وما المطلوبُ منّي أو منه ليقوم بعمله». وكانت البطاقةُ تعرض
   كلَّ شيءٍ مفتوحا: دوراتِه وشعبَه، وملفَّه العامّ وحقولَه، والاقتراحات — ولا تقول في سطرٍ ما الذي يقف.

   فلكلّ مدرّبٍ هنا:
   · **خطواتٌ** — ما ينتظر أحدا الآن، ولكلٍّ صاحبُها: «منك» (الإدارة) أو «منه» (المدرّب). تُقرأ من بياناته وحدَها:
     حسابُه، وعقدُه ما دام طلبُه غيرَ نشط، وظهورُه، وخططُ شعبه، وملفُّه العامّ، والاقتراحاتُ، ودوراتٌ عُرضت عليه.
   · **وحالٌ واحدة** يُفرز بها: موقوف، ثمّ اسمُه لا يظهر وله دوراتٌ منشورة، ثمّ ينتظرك، ثمّ ينتظره، ثمّ جاهز،
     ثمّ بلا شعبة. والحالُ مفردةٌ فمجموعُ الفلاتر عددُ المدرّبين.

   والدوالُّ نقيّةٌ تقرؤها الشاشة (`TrainerRunOps.tsx`). */

import { countAr } from '../text/count-ar'
import { plainAr } from '../text/plain-ar'
import { STATUS_LABELS } from './application-status'
import { hiddenOnSale, planMarkOf, type CardCohort } from './trainer-card'

export type Turn = 'you' | 'trainer'
export interface TrainerStep { turn: Turn; ar: string }

export type TrainerState = 'hidden' | 'you' | 'trainer' | 'ready' | 'idle' | 'suspended'

export const TRAINER_STATES: { id: TrainerState; ar: string; tone: 'danger' | 'accent' | 'info' | 'positive' | 'neutral' }[] = [
  { id: 'hidden', ar: 'اسمه لا يظهر', tone: 'danger' },
  { id: 'you', ar: 'ينتظرك', tone: 'accent' },
  { id: 'trainer', ar: 'ينتظر المدرب', tone: 'info' },
  { id: 'ready', ar: 'جاهز', tone: 'positive' },
  { id: 'idle', ar: 'بلا شعبة', tone: 'neutral' },
  { id: 'suspended', ar: 'موقوف', tone: 'neutral' },
]

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
  const you: string[] = []
  const him: string[] = []
  const active = t.applicationStatus === 'active'
  const invited = ['contract_pending', 'onboarding'].includes(t.applicationStatus)

  /* حسابُه: بلا حسابٍ لا يدخل بوّابتَه. ومن دُعي فإنشاؤه عليه */
  if (!t.hasAccount) {
    if (invited) him.push('إنشاء حسابه من الدعوة')
    else you.push('قبوله من «طلبات المدربين» — لا حساب له')
  }

  /* عقدُه — ما دام طلبُه غيرَ نشط. والنشطُ عقدُه وراءه */
  if (!active) {
    const c = t.contract?.status ?? null
    if (c === 'draft') you.push('إرسال عقده')
    else if (c === 'amendment_requested') you.push('الرد على طلب تعديل عقده')
    else if (c === 'signed') you.push('اعتماد توقيعه على العقد')
    else if (c === 'sent') him.push('توقيع عقده')
    else if (c === 'declined' || c === 'revoked' || c === 'expired') you.push('إرسال عقد جديد له')
    else if (c === null && t.applicationStatus === 'conditionally_approved') you.push('تجهيز عقده وإرساله')
  }

  /* ظهورُه: له دوراتٌ منشورةٌ واسمُه لا يظهر. والزرُّ لا يقبل طلبا غيرَ نشط — فهناك تكفي خطواتُ تفعيله */
  if (hiddenOnSale(t) && active) you.push('اعتماد ظهوره — له دورات منشورة واسمه لا يظهر')

  /* طابورُ التأهيل */
  if (t.queue.requests > 0) you.push(`البت في ${some(t.queue.requests, ASKS)} تأهيل`)
  if (t.queue.toAccept > 0) him.push(`قبول ${some(t.queue.toAccept, COURSES)} عرضت عليه`)

  /* خططُ شعبه القائمة */
  const live = t.cohorts.filter((c) => !DONE.includes(c.status))
  const marks = live.map((c) => planMarkOf(c))
  const n = (m: string) => marks.filter((x) => x === m).length
  if (n('submitted') > 0) you.push(`اعتماد ${plansOf(n('submitted'))}`)
  if (n('none') + n('draft') > 0) him.push(`كتابة ${plansOf(n('none') + n('draft'))}`)
  if (n('returned') > 0) him.push(`تعديل ${plansOf(n('returned'))} رددتها`)

  /* ملفُّه العامّ */
  if (t.pendingText && t.pendingPhotoUrl) you.push('مراجعة نبذته وصورته الجديدتين')
  else if (t.pendingText) you.push('مراجعة نبذته الجديدة')
  else if (t.pendingPhotoUrl) you.push('مراجعة صورته الجديدة')
  else if (!t.photoUrl) him.push('رفع صورته')

  /* اقتراحاتُنا على بطاقته: ما لم يُرسل علينا، وما أُرسل ولم يُجب عليه */
  if (reachable(t)) {
    if (t.pitchDraft && t.bioDraft) you.push('إرسال اقتراحي «لماذا نفتخر به» والنبذة')
    else if (t.pitchDraft) you.push('إرسال اقتراح «لماذا نفتخر به»')
    else if (t.bioDraft) you.push('إرسال اقتراح النبذة')
  }
  const waiting = [t.pitchLatest, t.bioLatest].filter((s) => s?.status === 'pending').length
  if (waiting > 0) him.push(waiting === 2 ? 'الرد على اقتراحينا' : 'الرد على اقتراحنا')

  return [...you.map((ar) => ({ turn: 'you' as const, ar })), ...him.map((ar) => ({ turn: 'trainer' as const, ar }))]
}

/** حالُه الواحدة — يُفرز بها ويُصفّى */
export function trainerStateOf(t: StatusInput, steps: TrainerStep[] = trainerSteps(t)): TrainerState {
  if (t.suspended) return 'suspended'
  if (hiddenOnSale(t)) return 'hidden'
  if (steps.some((s) => s.turn === 'you')) return 'you'
  if (steps.some((s) => s.turn === 'trainer')) return 'trainer'
  return t.cohorts.some((c) => !DONE.includes(c.status)) ? 'ready' : 'idle'
}

/** سطرُ الصاحب: «المطلوب منك: اعتماد خطة شعبة · مراجعة صورته الجديدة» — أو لا شيء */
export function stepsLineAr(steps: TrainerStep[], turn: Turn): string | null {
  const mine = steps.filter((s) => s.turn === turn).map((s) => s.ar)
  if (mine.length === 0) return null
  return `${turn === 'you' ? 'المطلوب منك' : 'المطلوب منه'}: ${mine.join(' · ')}`
}

/** ما يقال حين لا ينتظر شيء — والغائبُ بطلبٍ غيرِ نشطٍ يقال طورُ طلبه، فهو ما ينشره حين ينشط */
export function quietLineAr(state: TrainerState, applicationStatus: string): string | null {
  if (state === 'hidden') {
    return applicationStatus === 'active' ? null : `يظهر حين ينشط طلبه — طلبه الآن: ${plainAr(STATUS_LABELS[applicationStatus] ?? applicationStatus)}`
  }
  if (state === 'ready') return 'لا شيء ينتظر — شعبه معتمدة'
  if (state === 'idle') return 'لا شيء ينتظر — لا شعبة قادمة له. يسند من صفحة الشعبة'
  if (state === 'suspended') return 'موقوف — يرفع الإيقاف من ملفه في «طلبات المدربين»'
  return null
}
