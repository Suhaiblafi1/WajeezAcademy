/* ═══ الانضمام — ثلاثُ محطّاتٍ قبل التوقيع، ومن عليه الدورُ في كلٍّ (٢٤ أكتوبر ٢٠٢٦) ═══

   المرحلةُ الثالثةُ من مقترح لوحة الإدارة. والمحطّاتُ بأسمائها بقرار صاحب المنصّة («keep them»): «الطلب ·
   المقابلة · الاتفاقية»، و«لاحقا» و«مغلق» جانبا كي يبقى الخطُّ قصيرا. ومن اعتمدنا توقيعَه عبر إلى «المدربون»
   (`OPERATING_TRAINER_WHERE` في `trainer-operating.ts`) فلا يُعدّ هنا — وسلّمُه هناك كلماتُ صاحب المنصّة
   (`TRAINER_STAGES`).

   ولكلّ طلبٍ هنا:
   · **محطّةٌ واحدة** (`joiningStopOf`) — فمجموعُ الفلاتر عددُ الطلبات.
   · **وخطوةٌ تاليةٌ واحدة** (`joiningNextOf`): من عليه الدورُ — «منك» أو «منه» أو لا أحد — وما هي، وزرُّها.
     وكان الصفُّ يقول الاسمَ والرقمَ والحالةَ ونتيجةَ المقابلة (قرارُ ٢٠ سبتمبر)، ولا يقول ما يقف ولا عند من.

   والأحكامُ من مصادرها لا تُكتب هنا ثانية: الدعوةُ إلى الحجز من `interview-invitation.ts` (ما أرسلناه فعلا)،
   وخطوةُ العقد من `contract-next-step.ts` — وهي ما تقوله شاشةُ العقود عن العقد نفسِه. */

import { contractNextStep } from './contract-next-step'
import { canRemindToBook } from './application-options'
import { isInvitedToBook } from './interview-invitation'
import { STATUS_LABELS } from './application-status'
import { NO_SHOW } from './interview-outcome'
import { plainAr } from '../text/plain-ar'
import { fmtDate } from '../text/format-ar'

export type JoiningStop = 'application' | 'interview' | 'agreement' | 'later' | 'closed'

export const JOINING_STOPS: { id: JoiningStop; ar: string; aside: boolean }[] = [
  { id: 'application', ar: 'الطلب', aside: false },
  { id: 'interview', ar: 'المقابلة', aside: false },
  { id: 'agreement', ar: 'الاتفاقية', aside: false },
  { id: 'later', ar: 'لاحقا', aside: true },
  { id: 'closed', ar: 'مغلق', aside: true },
]

type DateLike = string | Date | null | undefined

/** ما يلزم للحكم — من صفّ الطابور (`listApplications`) */
export interface JoiningFacts {
  status: string
  /** عبر إلى «المدربون»: اعتمدنا توقيعَه، أو عمل يوما (`OPERATING_TRAINER_WHERE`) */
  operating: boolean
  /** مواعيدُه القائمة — والملغى لا يُحسب */
  interviewsCount: number
  /** متى خرجت إليه دعوةُ الحجز — من الأثر، و`null` لمن لم تخرج إليه */
  interviewInvitedAt?: DateLike
  /** موعدُه الذي ينتظر: قادمٌ، أو ماضٍ بلا نتيجة */
  pendingInterviewAt: DateLike
  interviewOutcome: string | null
  deferredFollowUpAt?: DateLike
  deferredInterestAskedAt?: DateLike
  /** آخرُ عقدٍ له غيرُ مُزاح — و`null` لمن لا عقدَ له */
  contract: {
    status: string
    tokenExpiresAt: DateLike
    gatesActivation: boolean
    documentNameAr: string | null
    signedNameAr: string | null
  } | null
}

/** ما يُقرأ فيه الطلبُ قبل المقابلة — وفيه تُرسَل الدعوةُ إليها */
const REVIEWING = ['submitted', 'under_review', 'information_requested', 'academic_review']
/** قبلناه داخليّا ولم نعتمد توقيعَه بعد */
const AGREEMENT = ['conditionally_approved', 'contract_pending']
/** عقدٌ لا يُبنى عليه: يُركَّب له غيرُه */
const CLOSED_CONTRACT = ['declined', 'revoked', 'expired', 'terminated', 'superseded']

/** محطّتُه في الانضمام — و`null` لمن عبر إلى «المدربون» */
export function joiningStopOf(f: JoiningFacts): JoiningStop | null {
  if (f.operating) return null
  if (f.status === 'rejected' || f.status === 'withdrawn') return 'closed'
  if (f.status === 'waitlisted' || f.status === 'deferred') return 'later'
  if (AGREEMENT.includes(f.status)) return 'agreement'
  if (f.status === 'interview_scheduled') return 'interview'
  /* ومن دعوناه إلى الحجز، أو قابلناه، في المقابلة — ولو عاد طلبُه إلى «قيد المراجعة» بعد لقائه */
  if (REVIEWING.includes(f.status)) {
    const invited = isInvitedToBook({ status: f.status, liveInterviews: f.interviewsCount, invitedAt: f.interviewInvitedAt ?? null })
    return invited || f.interviewsCount > 0 ? 'interview' : 'application'
  }
  if (f.status === 'draft') return 'application'
  return null
}

/** زرُّ الصفّ: يفتح ملفَّه، أو يُذكّره، أو يذهب إلى عقده */
export type JoiningAct = 'open' | 'remind_draft' | 'remind_booking' | 'contract_new' | 'contract'

export const JOINING_ACT_AR: Record<JoiningAct, string> = {
  open: 'افتح ملفه',
  remind_draft: 'ذكّره بإكمال طلبه',
  remind_booking: 'ذكّره بحجز الموعد',
  contract_new: 'جهز الاتفاقية',
  contract: 'افتح الاتفاقية',
}

export type JoiningTurn = 'you' | 'them' | 'none'

export interface JoiningNext {
  turn: JoiningTurn
  ar: string
  act: JoiningAct
}

/** ما يقف الآن، وعند من، وزرُّه — و`null` لمن عبر إلى «المدربون» */
export function joiningNextOf(f: JoiningFacts, now: Date = new Date()): JoiningNext | null {
  const stop = joiningStopOf(f)
  if (!stop) return null
  switch (stop) {
    case 'closed':
      return { turn: 'none', ar: plainAr(STATUS_LABELS[f.status] ?? f.status), act: 'open' }

    case 'later':
      if (f.status === 'deferred') {
        if (f.deferredInterestAskedAt) return { turn: 'them', ar: 'يرد على سؤالنا عن اهتمامه', act: 'open' }
        return { turn: 'none', ar: f.deferredFollowUpAt ? `مؤجل — نتواصل معه ${fmtDate(f.deferredFollowUpAt)}` : 'مؤجل', act: 'open' }
      }
      return { turn: 'none', ar: 'في قائمة الانتظار', act: 'open' }

    case 'agreement': {
      const c = f.contract
      if (!c || CLOSED_CONTRACT.includes(c.status)) {
        return { turn: 'you', ar: c ? 'جهز اتفاقية جديدة وأرسلها' : 'جهز الاتفاقية وأرسلها', act: 'contract_new' }
      }
      const step = contractNextStep({
        status: c.status, gatesActivation: c.gatesActivation, tokenExpiresAt: c.tokenExpiresAt,
        documentNameAr: c.documentNameAr, signedNameAr: c.signedNameAr, now,
      })
      return { turn: step.who, ar: plainAr(step.textAr), act: 'contract' }
    }

    case 'interview':
      if (f.status === 'information_requested') return { turn: 'them', ar: 'يرسل ما طلبته', act: 'open' }
      if (f.pendingInterviewAt) {
        return new Date(f.pendingInterviewAt).getTime() > now.getTime()
          ? { turn: 'none', ar: `مقابلته ${fmtDate(f.pendingInterviewAt)}`, act: 'open' }
          : { turn: 'you', ar: 'سجل نتيجة المقابلة', act: 'open' }
      }
      if (f.interviewOutcome === NO_SHOW) return { turn: 'you', ar: 'لم يحضر — تابع غيابه أو قرر', act: 'open' }
      if (f.interviewOutcome) return { turn: 'you', ar: 'قرر بعد المقابلة', act: 'open' }
      /* دعوناه ولم يحجز — والتذكيرُ مِحَكُّه مِحَكُّ الإرسال في الخادم نفسُه */
      return canRemindToBook({ status: f.status, liveInterviews: f.interviewsCount })
        ? { turn: 'them', ar: 'يحجز موعد المقابلة', act: 'remind_booking' }
        : { turn: 'them', ar: 'يحجز موعد المقابلة', act: 'open' }

    case 'application':
      if (f.status === 'draft') return { turn: 'them', ar: 'يكمل طلبه', act: 'remind_draft' }
      if (f.status === 'information_requested') return { turn: 'them', ar: 'يرسل ما طلبته', act: 'open' }
      return { turn: 'you', ar: 'اقرأ طلبه وقرر', act: 'open' }
  }
}

/** عددُ كلِّ محطّة — من الطابور نفسِه، فلا محطّةَ بعددٍ لا يُخرج شيئا */
export function joiningCounts(rows: readonly JoiningFacts[]): Record<JoiningStop, number> {
  const out: Record<JoiningStop, number> = { application: 0, interview: 0, agreement: 0, later: 0, closed: 0 }
  for (const r of rows) {
    const s = joiningStopOf(r)
    if (s) out[s] += 1
  }
  return out
}
