/* التأجيلُ إلى الفصول القادمة — خيارٌ ثالثٌ بجانب القبول والرفض (٦ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   قال صاحبُ المنصّة: «عند اختيار مرفوض للمدرّب أو قبول، أعطني خيارا آخر: يؤجَّل
   حسابُك للفصول القادمة، لأنّ الفصلَ القادم لن نحصل فيه على طلبٍ كافٍ لدوراتك،
   وسنتواصل معك بعد شهرين من الآن لنرى اهتمامَك بالانضمام للفصول القادمة».
   وأن يكون في ثلاثة مواضع: قرارِ الإدارة، وتقييمِ المقابلة في خانة المقابلات،
   ورابطِ التقييم الذي يُنشأ للقرّاء.

   ═══ ولمَ حالةٌ جديدةٌ لا «قائمةُ الانتظار» ═══

   `waitlisted` قائمةٌ ومعناها غيرُ هذا: «نعود إليه حين تُفتح حاجةٌ في تخصّصه»،
   وإليها يذهب من غاب عن مقابلته فشُكر (`no-show-followup.ts`). والمؤجَّلُ
   شيءٌ آخر: مناسبٌ، والذي ينقصه طلبٌ على دوراته في الفصل القادم، وله **موعدٌ
   وُعد به** في بريده. ولو اختلطا لما عُرف في الطابور من يُكلَّم في أيّ يوم.

   ═══ وما يقع به ═══

   · يصير الطلبُ `deferred`، ويبقى حيّا يُقرَّر فيه كغيره — يُقبل أو يُردّ أو
     يعود إلى المراجعة متى شاءت الإدارة.
   · ويصل صاحبَه بريدٌ بالتأجيل وموعدِ التواصل (`deferralMail`).
   · ويُكتب الموعدُ في `TrainerApplication.deferredFollowUpAt` ويُرى في الطابور،
     ويُمحى حين يخرج الطلبُ من التأجيل.

   وفي التقييم حكمٌ يُكتب لا قرارٌ يُنفَّذ: من اختار «مؤجَّل» في رابط التقييم
   قارئٌ قد يكون من خارج الفريق، فلا يخرج من يده بريد. والإدارةُ ترى حكمَه، ويُبرَز
   لها زرُّ التأجيل (`recommendedFor`).

   بلا React ولا قاعدة — ويحرسه `src/tests/trainer/deferral.test.ts`. */

import { SEASON_MONTHS, termBounds, termOf, termTitleAr } from '../terms/season'
import { TRAINING_SEASONS } from './application-options'


/* ═══ موعدُ التواصل: قبل فصلٍ قادمٍ مسمّى، لا «بعد شهرين» (١٢ أكتوبر ٢٠٢٦) ═══

   كتب متقدّمٌ مؤجَّلٌ يسأل: أيُّ موعدٍ هو الصحيح؟ — فقد قيل له «نتواصل في ٨ ديسمبر»،
   ويومٌ بعينه يُقرأ وعدا يُحاسَب عليه، ولا صلةَ له بفصول المنصّة. فقرّر صاحبُ المنصّة
   أن يُسمّى الفصلُ لا اليوم: «نتواصل معك قبل موسم الربيع ٢٠٢٧».

   والفصلُ المسمّى هو **الذي بعد القادم**: السببُ أنّ القادمَ لا طلبَ فيه كافيا،
   فالوعدُ بالتواصل قبله وعدٌ بما قلنا إنّه لن يكون. ويحلّ الموعدُ قبل بدايته بستّة
   أسابيع — وقتٌ يكفي ليُخطَّط له ويُسند. واليومُ يبقى في القاعدة للعامل وحدَه، والبريدُ
   والشاشاتُ تقول اسمَ الفصل. */


/** اسمُ الحالة في القاعدة — ونتيجةُ المقابلة وحكمُ القارئ بالاسم نفسِه */
export const DEFERRED = 'deferred'

/** كم يوما قبل بداية الفصل المسمّى نتواصل */
export const DEFER_LEAD_DAYS = 42

const DAY_MS = 24 * 60 * 60 * 1000

/** الفصلُ الذي نتواصل قبله: الذي بعد القادم */
export function deferredTerm(decidedAt: Date): { year: number; season: (typeof TRAINING_SEASONS)[number]['value'] } {
  let t = termOf(decidedAt)
  for (let k = 0; k < 2; k += 1) {
    const i = TRAINING_SEASONS.findIndex((s) => s.value === t.season)
    const next = TRAINING_SEASONS[(i + 1) % TRAINING_SEASONS.length]!.value
    /* الشتاءُ يعبر رأسَ السنة: ما بعده (الربيع) في السنة التالية لبدايته */
    t = { year: SEASON_MONTHS[next].start < SEASON_MONTHS[t.season].start ? t.year + 1 : t.year, season: next }
  }
  return t
}

/** موعدُ التواصل: قبل بداية الفصل الذي بعد القادم بستّة أسابيع */
export function deferredFollowUpAt(decidedAt: Date): Date {
  const t = deferredTerm(decidedAt)
  return new Date(termBounds(t.year, t.season).startsOn.getTime() - DEFER_LEAD_DAYS * DAY_MS)
}

/** اسمُ الفصل الذي نتواصل قبله، من موعد التواصل المحفوظ: «موسم الربيع 2027» */
export function followUpTermAr(followUpAt: Date | string): string {
  const t = termOf(new Date(new Date(followUpAt).getTime() + DEFER_LEAD_DAYS * DAY_MS))
  return termTitleAr(t.year, t.season)
}

/** حلّ موعدُ التواصل؟ — لطلبٍ ما زال مؤجَّلا وحده */
export function followUpDue(f: { status: string; deferredFollowUpAt: Date | string | null }, now: Date): boolean {
  if (f.status !== DEFERRED || !f.deferredFollowUpAt) return false
  return new Date(f.deferredFollowUpAt).getTime() <= now.getTime()
}

/* ═══ المتابعةُ حين يحلّ الموعد (٦ أكتوبر ٢٠٢٦) ═══

   عُرضت على صاحب المنصّة أربعةُ بدائل بفروقها — تذكيرُ الفريق وحدَه، أو سؤالُ
   المتقدّم وحدَه، أو الأمران، أو لا شيءَ آليّا — فاختار الأمرين معا:

   · **يُسأل المتقدّمُ بالبريد** «أما زلتَ مهتمّا بالانضمام إلى الفصول القادمة؟»،
     وفي البريد رابطٌ إلى صفحةٍ فيها خياران وما يقع بكلٍّ منهما تحته. والجوابُ
     **بضغطةٍ في الصفحة لا بفتح الرابط**: برامجُ البريد تفتح الروابطَ لتفحصها، ولو
     كان الفتحُ جوابا لأجاب عنه الفاحصُ قبل أن يقرأه.
   · **ويُذكَّر الفريق** حين يحلّ الموعد، ثمّ حين يُجيب — في الجرس والبريد.

   والجوابان لا ثالثَ لهما، ولكلٍّ وجهتُه في خريطة الحالات:
   «ما زلتُ مهتمّا» يعيد الطلبَ إلى «قيد المراجعة»، و«لم أعد مهتمّا» يسحبه بيده.
   ومن لم يُجب يبقى مؤجَّلا، وشارتُه في الطابور تقول إنّه سُئل ولم يُجب. */

/** جوابا سؤال الاهتمام — والخادمُ يقبلهما من هذه القائمة وحدَها */
export const INTEREST_ANSWERS = ['interested', 'not_interested'] as const
export type InterestAnswer = (typeof INTEREST_ANSWERS)[number]

/** ما يُعرض في صفحة الجواب — وما يقع بكلٍّ مكتوبٌ تحته قبل الضغط */
export const INTEREST_CHOICES: readonly { answer: InterestAnswer; labelAr: string; whatAr: string }[] = [
  {
    answer: 'interested',
    labelAr: 'نعم، ما زلت مهتمّا',
    whatAr: 'يعود طلبك إلى المراجعة بملفّه ومستنداته ومقابلته، ونتواصل معك لنرى أنسب فصل لدوراتك. ولا يلزمك أن تتقدّم من جديد.',
  },
  {
    answer: 'not_interested',
    labelAr: 'لم أعد مهتمّا',
    whatAr: 'نسحب طلبك بطلبك، ولا نراسلك بعدها بشأنه. ولك أن تتقدّم من جديد متى شئت.',
  },
]

/** وجهةُ كلّ جواب في خريطة الحالات */
export function answerTarget(answer: InterestAnswer): 'under_review' | 'withdrawn' {
  return answer === 'interested' ? 'under_review' : 'withdrawn'
}

/** حلّ موعدُه ولم يُسأل بعد؟ — يسأل عنه العاملُ كلَّ ساعة */
export function dueForInterestAsk(
  f: { status: string; deferredFollowUpAt: Date | string | null; deferredInterestAskedAt: Date | string | null },
  now: Date,
): boolean {
  return followUpDue(f, now) && !f.deferredInterestAskedAt
}

/** مسارُ صفحة الجواب — يُبنى منه رابطُ البريد، ويُسجَّل في جدول المسارات */
export const INTEREST_PAGE_PATH = '/join-trainer/interest'
