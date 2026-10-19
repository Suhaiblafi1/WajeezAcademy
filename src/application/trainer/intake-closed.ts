/* إغلاقُ استقبال طلبات المدرّبين لهذا الفصل — قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   «عند أيّ طلب مدرّب جديد يجب أن نبلغه أنّنا توقّفنا عن استقبال الطلبات لهذا الفصل،
   ولكن سيتمّ التواصل معك في شهر ١٢ لتنضمّ للفصل القادم "فصل الربيع"».

   فالاستمارةُ تبقى مفتوحةً والطلبُ يُحفظ — والذي يتغيّر ما يُقال لصاحبه: في رأس
   الاستمارة قبل أن يبدأ، وفي شاشة ما بعد الإرسال، وفي بريد التأكيد. ثلاثةُ مواضعَ
   تقرأ النصَّ من هنا، فلا يَعِد أحدُها بشهرٍ ويَعِد الآخرُ بغيره.

   ═══ ومفتاحٌ يُطفأ لا نصٌّ يُحذف ═══

   كوقف الحجز (`INTERVIEW_BOOKING_PAUSE`): الإغلاقُ يتكرّر كلَّ فصلٍ يمتلئ، ومن حذفه
   اليومَ كتبه ثانيةً ناقصا. ويومَ يُفتح الاستقبالُ يُطفأ `active` وحدَه.

   ═══ ولا يَعِد بديسمبرَ بعد أن يمضي ═══

   الوعدُ «نتواصل معك في ديسمبر» كذبٌ لمن يقرؤه في يناير. فالإغلاقُ ينتهي وحدَه يومَ
   موعد التواصل — وهو موعدُ التأجيل نفسُه (`deferral.ts`): قبل بداية الفصل المسمّى
   بستّة أسابيع، أي ٢١ ديسمبر لفصل الربيع ٢٠٢٧.

   بلا React ولا قاعدة — يُستورد من الطرفين. */

import { termBounds } from '../terms/season'
import { DEFER_LEAD_DAYS } from './deferral'
import type { TrainingSeason } from './application-options'

const DAY_MS = 24 * 60 * 60 * 1000

export const TRAINER_INTAKE_CLOSED = {
  /** أُوقد ١٩ أكتوبر ٢٠٢٦ — ويُطفأ وحدَه يومَ يُفتح الاستقبال */
  active: true,
  /** الفصلُ الذي نضمّه إليه */
  nextTerm: { year: 2027, season: 'feb_apr' as TrainingSeason },
  /** كما يُقرأ — بلفظ صاحب المنصّة */
  nextTermAr: 'فصل الربيع ٢٠٢٧',
  nextMonthsAr: 'فبراير – أبريل',
  /** شهرُ التواصل */
  contactMonthAr: 'ديسمبر',
} as const

/** موعدُ التواصل: قبل بداية الفصل القادم بستّة أسابيع — ٢١ ديسمبر ٢٠٢٦ */
export function intakeFollowUpAt(): Date {
  const { year, season } = TRAINER_INTAKE_CLOSED.nextTerm
  return new Date(termBounds(year, season).startsOn.getTime() - DEFER_LEAD_DAYS * DAY_MS)
}

/** أمغلقٌ الاستقبالُ الآن؟ — المفتاحُ موقَد، وموعدُ التواصل لم يحلّ */
export function intakeClosed(now: Date = new Date()): boolean {
  return TRAINER_INTAKE_CLOSED.active && now.getTime() < intakeFollowUpAt().getTime()
}

/** العنوان — بلفظ القرار */
export const INTAKE_CLOSED_TITLE_AR = 'توقفنا عن استقبال الطلبات لهذا الفصل'

/** الوعد — موعدُ التواصل والفصلُ المسمّى */
export const INTAKE_CLOSED_PROMISE_AR =
  `وسنتواصل معك في ${TRAINER_INTAKE_CLOSED.contactMonthAr} لتنضم إلى الفصل القادم: `
  + `${TRAINER_INTAKE_CLOSED.nextTermAr} (${TRAINER_INTAKE_CLOSED.nextMonthsAr}).`

/** في رأس الاستمارة — قبل أن يبدأ: التقديمُ ما زال مفتوحا */
export const INTAKE_CLOSED_BEFORE_AR = `يمكنك التقديم الآن. ${INTAKE_CLOSED_PROMISE_AR}`

/** بعد الإرسال — ولا يُعيد التقديم */
export const INTAKE_CLOSED_AFTER_AR = 'طلبك محفوظ عندنا، ولا حاجة لإعادة التقديم.'

/* ═══ وما يقع بالطلب: يؤجَّل وحدَه إلى فصل الربيع ═══

   اختار صاحبُ المنصّة (١٩ أكتوبر ٢٠٢٦) من خيارين — يؤجَّل وحدَه، أو يدخل الطابورَ
   كالعادة ويتواصل الفريقُ بيده في ديسمبر — الأوّلَ: يصير الطلبُ عند إرساله
   `deferred` بموعد تواصلٍ `intakeFollowUpAt()`، فيسأله العاملُ في موعده «أما زلتَ
   مهتمّا؟» ويُذكَّر الفريق (`trainer-deferral.service.ts`). ويبقى حيّا يُقبل أو
   يُردّ قبلها متى شاءت الإدارة.

   ═══ وصفحةُ حالته تقول له ما قيل له ═══

   شرحُ «مؤجَّل» في `APPLICANT_STATUS` يبدأ بـ«راجعنا طلبك»، وهذا لم يُراجَع. فيُعرف
   المؤجَّلُ بالإغلاق بسطره في سجلّ الحالة — نصٌّ نكتبه نحن وحدَنا من هذا الثابت —
   ويُقرأ له شرحُ الإغلاق بدل شرح المراجعة. */

/** ملاحظةُ سطر التأجيل في سجلّ الحالة — وبها يُعرف المؤجَّلُ بالإغلاق */
export const INTAKE_DEFER_NOTE_AR = `استقبال الطلبات مغلق لهذا الفصل — أجّل إلى ${TRAINER_INTAKE_CLOSED.nextTermAr}`

/** شرحُ حالته في صفحة المتابعة — بلفظ ما قيل له عند الإرسال */
export const INTAKE_DEFERRED_EXPLAIN_AR = `${INTAKE_CLOSED_TITLE_AR}. ${INTAKE_CLOSED_PROMISE_AR} ${INTAKE_CLOSED_AFTER_AR}`

/** أمؤجَّلٌ بإغلاق الاستقبال؟ — الحالةُ مؤجَّلة، وآخرُ دخولٍ فيها يبدأ بسطر الإغلاق.
    «يبدأ» لا «يساوي»: المراجعُ يؤجّل بهذا السبب ويضيف ملاحظتَه بعده. */
export function deferredByIntake(app: {
  status: string
  statusHistory: readonly { toStatus: string; note: string | null }[]
}): boolean {
  if (app.status !== 'deferred') return false
  const last = [...app.statusHistory].reverse().find((h) => h.toStatus === 'deferred')
  return last?.note?.startsWith(INTAKE_DEFER_NOTE_AR) ?? false
}

/* ═══ وسببُ التأجيل يُختار — لمن قدّم قبل الإغلاق (١٩ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عمّن قدّموا قبل الإغلاق وما زالوا ينتظرون لقاءً لم يقع: أفي
   التأجيل سببٌ يقول «أغلقنا الاستقبال» كسبب «لا طلب»؟ ولم يكن: زرُّ التأجيل — فرديّا
   وجماعيّا — يرسل سببا واحدا («لا نتوقّع طلبا كافيا على دوراتك»). فاختار من ثلاثة
   بدائل أن يُختار السببُ في الزرّ نفسِه، ويختار هو من يصله أيُّهما.

   و«أغلقنا الاستقبال» يقول ما يقوله لمن يقدّم اليوم، بموعده (`intakeFollowUpAt`)، ويُكتب
   سطرُه في السجلّ فتقرؤه صفحةُ حالته (`deferredByIntake`). ولا يُعرض إلّا والاستقبالُ
   مغلق — والخادمُ يردّه بعدها. */

export const DEFER_REASONS = [
  {
    value: 'demand',
    labelAr: 'لا يوجد طلب كاف على دوراته',
    whatAr: 'يصله بريد بأن الطلب على دوراته قليل في الفصل القادم، وأننا نتواصل معه قبل الفصل الذي بعده.',
  },
  {
    value: 'intake_closed',
    labelAr: INTAKE_CLOSED_TITLE_AR,
    whatAr: `يصله بريد بأننا توقفنا عن استقبال الطلبات لهذا الفصل، وأننا نتواصل معه في ${TRAINER_INTAKE_CLOSED.contactMonthAr} لينضم إلى ${TRAINER_INTAKE_CLOSED.nextTermAr}.`,
  },
] as const

export type DeferReason = (typeof DEFER_REASONS)[number]['value']
export const DEFER_REASON_VALUES = DEFER_REASONS.map((r) => r.value) as [DeferReason, ...DeferReason[]]

/** الأسبابُ المعروضةُ الآن — «أغلقنا الاستقبال» ما دام مغلقا وحدَه */
export function deferReasonsNow(now: Date = new Date()): readonly (typeof DEFER_REASONS)[number][] {
  return intakeClosed(now) ? DEFER_REASONS : DEFER_REASONS.filter((r) => r.value !== 'intake_closed')
}
