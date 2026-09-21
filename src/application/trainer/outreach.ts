/* ما بعثناه إلى المتقدّم — ليُقرأ في صفّه لا في أثرِه.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   «أضفْ بجانب كلّ شخصٍ قمنا بتذكيره بأخذ موعدٍ أو تذكيرٍ بإكمال الطلب أو
   طلبِ معلوماتٍ إضافيّة… إلخ، موضَّحا في الخانة الرئيسيّة للمدرّبين بجانب
   حالته».

   ═══ ولمَ كان يلزم ═══

   الحالةُ تقول أين وقف الطلب، ولا تقول **أكلّمناه أم لا**. فـ«بانتظار
   معلومات المرشّح» تُقرأ واحدةً سواءٌ طُلبت منه اليومَ أو قبل شهر، و«مسودة»
   تُقرأ واحدةً سواءٌ ذُكّر صاحبُها أم لم يُذكَّر قطّ.

   وأثرُ الطلب يحمل الخبرَ كلَّه — لكنّه خلفَ فتحةِ ملفٍّ ثمّ لسانِ أثر. فمن
   أراد أن يعرف من ذُكّر ومن لم يُذكَّر فتح الملفّاتِ واحدا واحدا. **وكان
   أثرُ ذلك أن يُذكَّر الرجلُ مرّتين في يوم**، أو ألّا يُذكَّر شهرا.

   ═══ وثلاثةٌ هي المقصودة، لا كلُّ الأثر ═══

   «مُراسَلةٌ خرجت إليه ننتظر بها ردَّه» — لا كلُّ ما وقع على الطلب. فقبولُه
   ورفضُه حالتُه نفسُها تقولهما، وانتقالاتُ الحالة الداخليّةُ لا تعنيه. وهذه
   الثلاثةُ وحدَها رسائلُ **نحن فيها الطالبون وهو المطلوبُ منه**.

   وهي أسماءُ أفعالِ أثرٍ بعينها — تُقرأ في الخادم ليُستخرَج آخرُها، وتُقرأ
   في الشاشة ليُكتب لفظُها. فلو كُتبت مرّتين لَاستخرج الخادمُ فعلا لا تعرف
   الشاشةُ لفظَه، فيُعرض مفتاحٌ لاتينيٌّ في صفٍّ عربيّ. */

import { countAr, type CountForms } from '../text/count-ar'

export interface OutreachKind {
  /** اسمُ فعل الأثر كما يُسجَّل في `AuditEvent.action` */
  action: string
  /** ما يُكتب في الصفّ — فعلٌ ماضٍ مبنيٌّ للمجهول: الفاعلُ نحن ولا يعني القارئَ */
  ar: string
}

/** المراسَلاتُ التي ننتظر بها ردَّه — وترتيبُها لا يعني شيئا، فالأحدثُ يُنتقى بتاريخه */
export const OUTREACH: readonly OutreachKind[] = [
  { action: 'trainer.interview.remind', ar: 'ذُكّر بحجز الموعد' },
  { action: 'trainer.application.draft_remind', ar: 'ذُكّر بإكمال الطلب' },
  { action: 'trainer.info_requested.notify', ar: 'طُلبت منه معلومات' },
]

/** ما يُستعلَم به في الخادم — هو المعجمُ نفسُه لا قائمةٌ ثانيةٌ تُكتب هناك */
export const OUTREACH_ACTIONS: readonly string[] = OUTREACH.map((o) => o.action)

/** لفظُ المراسَلة — و`null` لفعلٍ ليس منها، فلا يُعرض مفتاحٌ لاتينيٌّ في صفّ */
export function outreachLabelAr(action: string): string | null {
  return OUTREACH.find((o) => o.action === action)?.ar ?? null
}

/** ما يصل الصفَّ عن آخر مراسَلة */
export interface LastOutreach {
  action: string
  at: string
}

const DAY_FORMS: CountForms = { one: 'يوم', two: 'يومين', few: 'أيّام', many: 'يوما' }

/**
 * «منذ ٣ أيّام» — والمقصودُ قِدَمُ المراسَلة لا تاريخُها.
 *
 * تاريخٌ مكتوبٌ يُطرح بالعين من تاريخ اليوم، والطابورُ يُقرأ عجلةً لا حسابا.
 * **والمستقبلُ يُقرأ «اليوم»** لا «منذ -١»: ساعةُ خادمٍ تتقدّم دقائقَ فرقٌ
 * لا خبر، وتفريعُ «بعد» هنا يَعِد بما لا يقع — لا تُرسَل رسالةٌ في الغد.
 */
export function outreachAgoAr(at: string, now: Date = new Date()): string | null {
  const sent = new Date(at)
  if (Number.isNaN(sent.getTime())) return null
  const days = Math.max(0, Math.floor((now.getTime() - sent.getTime()) / 86_400_000))
  if (days === 0) return 'اليوم'
  if (days === 1) return 'أمس'
  return `منذ ${countAr(days, DAY_FORMS)}`
}

/** سطرُ الصفّ كاملا — لفظُ المراسَلة وقِدَمُها، و`null` لمن لم يُراسَل */
export function outreachAr(last: LastOutreach | null | undefined, now: Date = new Date()): string | null {
  if (!last) return null
  const label = outreachLabelAr(last.action)
  if (!label) return null
  const ago = outreachAgoAr(last.at, now)
  return ago ? `${label} · ${ago}` : label
}
