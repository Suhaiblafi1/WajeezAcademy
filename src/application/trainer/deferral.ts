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
