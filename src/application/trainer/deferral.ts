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

/** كم شهرا بين التأجيل والتواصل — «بعد شهرين من الآن» */
export const DEFER_FOLLOW_UP_MONTHS = 2

/** اسمُ الحالة في القاعدة — ونتيجةُ المقابلة وحكمُ القارئ بالاسم نفسِه */
export const DEFERRED = 'deferred'

/** موعدُ التواصل: بعد شهرين تقويميّين من القرار، في اليوم نفسِه — أو آخرِ الشهر إن قصر */
export function deferredFollowUpAt(decidedAt: Date, months = DEFER_FOLLOW_UP_MONTHS): Date {
  const y = decidedAt.getUTCFullYear()
  const m = decidedAt.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const d = Math.min(decidedAt.getUTCDate(), lastDay)
  return new Date(Date.UTC(y, m, d, decidedAt.getUTCHours(), decidedAt.getUTCMinutes(), decidedAt.getUTCSeconds()))
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
    labelAr: 'نعم، ما زلتُ مهتمّا',
    whatAr: 'يعود طلبُك إلى المراجعة بملفّه ومستنداته ومقابلته، ونتواصل معك لنرى أنسبَ فصلٍ لدوراتك. ولا يلزمك أن تتقدّم من جديد.',
  },
  {
    answer: 'not_interested',
    labelAr: 'لم أعد مهتمّا',
    whatAr: 'نسحب طلبَك بطلبك، ولا نراسلك بعدها بشأنه. ولك أن تتقدّم من جديد متى شئت.',
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
