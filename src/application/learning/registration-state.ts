/* ═══ ما يُقال عن تسجيل الشعبة — من حالها لا من طور مدرّبها (٣ أكتوبر ٢٠٢٦) ═══

   سار صاحبُ المنصّة في مسار اعتماد الخطط من أوّله إلى آخره، فوجد ستّةَ نصوصٍ
   تقول عن شعبةٍ لا يدخلها أحد إنّها «مفتوحة» أو «تُفتح باعتمادك»: شعبةُ الإعداد
   مسوّدةٌ علمُها منزول، واعتمادُ خطّتها لا يفتحها — تُفتح بقرارٍ منفصل
   (`trainer-prep.service.ts`، قرارُه «2-b»). والنصوصُ كُتبت لشعبةٍ يُرفع علمُها
   قبل الاعتماد، فصدقت هناك وكذبت هنا.

   فالحكمُ هنا من حال الشعبة نفسِها — علمِها وخطّتِها وموعدِ التحاقها — لا من
   اسم طورٍ يزول بالتفعيل. وبترتيب الخادم نفسِه (`cohortAcceptsRegistration` في
   `server/services/registration-window.ts`): العلمُ أوّلا، ثمّ خطّةُ المدرّب، ثمّ
   الالتحاق. وحارسٌ يقابل الاثنين على كلّ تركيب، فلا تقول الشاشةُ «مفتوحة» لما
   يردّه الخادم. ونافذةُ الفصل خارجُ هذا: تُقال في شاشة الفصل.

   والنصُّ قطعٌ ثلاث (`lead` · `date` · `tail`) لا جملةٌ واحدة: التاريخُ يُكتب
   بارزا في الشاشة، والقطعُ تُجمع في البريد والجرس. */

import { whenAr } from './cohort-gate'

export type RegistrationState =
  /** العلمُ منزولٌ وخطّةُ المدرّب لم تُعتمَد قطّ — والاعتمادُ لا يرفعه */
  | 'closed_awaiting_plan'
  /** العلمُ منزولٌ والخطّةُ معتمَدة — تُفتح بقرار من يدير الشعبة */
  | 'closed'
  /** العلمُ مرفوعٌ والخطّةُ لم تُعتمَد — يفتحها الاعتماد */
  | 'opens_on_approval'
  /** مرفوعٌ ومعتمَدة والالتحاقُ قائم */
  | 'open'
  /** مرفوعٌ ومعتمَدة وفات موعدُها الثاني */
  | 'late_closed'

export interface RegistrationFacts {
  registrationOpen: boolean
  /** خطّةُ مدرّبها بدأت ولم تُعتمَد له قطّ (`awaitingTrainerPlan`) */
  awaitingPlan: boolean
  /** آخرُ الالتحاق: بدءُ الموعد الثاني */
  joinClosesAt: string | Date | null
}

export function registrationState(r: RegistrationFacts, now: Date): RegistrationState {
  if (!r.registrationOpen) return r.awaitingPlan ? 'closed_awaiting_plan' : 'closed'
  if (r.awaitingPlan) return 'opens_on_approval'
  if (r.joinClosesAt && now.getTime() >= new Date(r.joinClosesAt).getTime()) return 'late_closed'
  return 'open'
}

/** سطرٌ بقطعه — التاريخُ بارزٌ بينها إن كان */
export interface RegistrationLine { lead: string; date?: string; tail?: string }

/** القطعُ جملةً واحدة — للبريد والجرس */
export function lineText(l: RegistrationLine): string {
  return `${l.lead}${l.date ?? ''}${l.tail ?? ''}`
}

/** ما يقرؤه المعتمِدُ في مراجعة الخطّة — وأين يفتحها إن كانت مغلقة */
export function adminRegistrationLine(r: RegistrationFacts, now: Date): RegistrationLine | null {
  const s = registrationState(r, now)
  if (s === 'closed_awaiting_plan') {
    return { lead: 'التسجيل: مغلق، ولا يفتحه اعتمادُك — تُفتح الشعبةُ للتسجيل بقرارٍ منفصلٍ من بطاقتها («الهُويّة والحالة») بعده.' }
  }
  if (s === 'closed') {
    return { lead: 'التسجيل: مغلق — الخطّةُ معتمَدةٌ والشعبةُ لم تُفتح بعد. تفتحها من بطاقتها («الهُويّة والحالة») حين تشاء.' }
  }
  if (s === 'opens_on_approval') {
    return { lead: 'التسجيل: يُفتح باعتمادك هذه الخطّة — ولا يقبل أحدا قبلها وإن رُفع علمُه.' }
  }
  if (!r.joinClosesAt) return null
  return s === 'late_closed'
    ? { lead: 'أُغلق الالتحاق ', date: whenAr(r.joinClosesAt), tail: ' — ببدء موعدها الثاني.' }
    : { lead: 'الالتحاقُ مفتوحٌ حتّى ', date: whenAr(r.joinClosesAt), tail: ' — بدءِ موعدها الثاني.' }
}

/** ما يقرؤه المدرّبُ في خطوته الأخيرة — و`joinClosesAt` من مواعيد خطّته بالقاعدة
    التي يكتبه بها الاعتماد، فلا يقرأ تاريخا غيرَ ما سيُكتب */
export function trainerRegistrationLine(r: RegistrationFacts, now: Date): RegistrationLine {
  const s = registrationState(r, now)
  const until = r.joinClosesAt
    ? { date: whenAr(r.joinClosesAt), tail: '.' }
    : { tail: '.' }
  const join = r.joinClosesAt ? '، ويُقبل الملتحقون حتّى بدء موعدها الثاني — ' : ''
  if (s === 'closed_awaiting_plan') {
    return { lead: `اعتمادُها لا يفتحها للتسجيل وحدَه — تفتحها الأكاديميةُ بعده${join}`, ...until }
  }
  if (s === 'closed') {
    return { lead: `اعتُمدت، ولم تُفتح للتسجيل بعد — تفتحها الأكاديمية، وتراها مفتوحةً في «شعبي» حين تُفتح${join}`, ...until }
  }
  if (s === 'opens_on_approval') return { lead: `تُفتح الشعبةُ للتسجيل حين تُعتمَد${join}`, ...until }
  if (s === 'late_closed') return { lead: 'أُغلق الالتحاقُ ببدء موعدها الثاني — ', date: whenAr(r.joinClosesAt!), tail: '.' }
  return { lead: `الشعبةُ مفتوحةٌ للتسجيل${join}`, ...until }
}
