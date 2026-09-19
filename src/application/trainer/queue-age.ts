/* عمرُ الطلب في الطابور — «منذ متى وهو واقف، وعند من هو واقف».

   ═══ العطبُ الذي كُتب له ═══

   صفُّ الطابور كان يعرض التخصّصات والوثائق والمقابلات، ولا يقول **متى وصل**.
   والترتيبُ الداخليُّ يضع الأقدمَ أوّلا، لكنّ العينَ لا ترى الفرقَ بين طلبٍ
   جاء أمسِ وطلبٍ يقف منذ ثلاثة أسابيع — فيشيخ الطلبُ بصمت. وهو العطبُ نفسُه
   الذي عولج في البريد: من رُدّ كان يتفقّد صفحتَه شهرا ولا خبر.

   ═══ ولمَ «عند من هو واقف» لا العمرُ وحدَه ═══

   لأنّ عمرا بلا صاحبٍ يكذب: طلبٌ في «نحتاج معلومات إضافية» ينتظر **صاحبَه**
   لا إيّانا، فلو احمرّ بعد أسبوعَين لقرأه الموظّفُ تقصيرا منه واستعجل قرارا
   لا يملك مادّته. والتفريقُ يجعل اللونَ خبرا: ما احمرَّ فهو دَينٌ علينا.

   ومن وقع في طلبه قرارٌ (اعتُمد · رُدّ · سُحب · أُوقف) لا عمرَ له أصلا — لا
   شيءَ ينتظر، وشارةٌ عليه ضجيجٌ في صفٍّ مزدحم. وقائمةُ الانتظار مثلُه:
   وقوفُها مقصودٌ حتّى تُفتح حاجة، فلا تُقرأ تأخّرا.

   ═══ والحدّان سبعةٌ وأربعةَ عشر ═══

   أسبوعٌ مهلةُ المراجعة المعقولة في هذه المنصّة (رسالةُ «وصل طلبك» تَعِد
   بالقراءة قبل الموعد)، وأسبوعان ضعفُها — وما تجاوزهما يُنادى أحمرَ لا
   ليُلام أحد، بل ليُرى قبل أن يصير شهرا. */

import { countAr, type CountForms } from '../text/count-ar'

/** الحالاتُ التي تنتظرنا نحن — وفيها وحدَها يتلوّن العمر */
export const AWAITING_US: readonly string[] = [
  'submitted', 'under_review', 'shortlisted', 'interview_scheduled',
  'demo_requested', 'academic_review', 'conditionally_approved',
  'contract_pending', 'onboarding',
]

/** الحالاتُ التي تنتظر صاحبَ الطلب — يُقال عمرُها ولا يُلوَّن */
export const AWAITING_APPLICANT: readonly string[] = [
  'draft', 'email_verification_pending', 'information_requested',
]

/** ما بعد الحدّ الأوّل يُنبَّه عليه، وما بعد الثاني يُنادى */
export const AGE_WARN_DAYS = 7
export const AGE_LATE_DAYS = 14

export type AgeTone = 'calm' | 'warn' | 'late'

export interface QueueAge {
  tone: AgeTone
  days: number
  /** ما يُقرأ في الشارة */
  ar: string
}

/** صيغُ اليوم — تُصدَّر لأنّ ملخّصَ الإدارة يقول المدّةَ نفسَها في بريده.
 *
 *  ولو كُتبت مرّتَين لانحرفت إحداهما يوما، فيقرأ الموظّفُ «5 أيّام» في
 *  الشاشة و«5 يوما» في الرسالة عن الإنسان نفسِه. */
export const DAY_FORMS: CountForms = { one: 'يوم', two: 'يومين', few: 'أيّام', many: 'يوما' }

/** عمرُ الطلب في حالته الحاليّة — و`null` لمن لا عمرَ له: وقع فيه قرار.
 *
 *  و`since` آخرُ حركةٍ في الطلب لا تاريخُ إنشائه: من نُقل أمسِ إلى «مراجعة
 *  أكاديميّة» ينتظرنا منذ أمسِ لا منذ شهر. */
export function queueAge(
  status: string,
  since: string | Date | null | undefined,
  now: Date = new Date(),
): QueueAge | null {
  if (!since) return null
  if (!AWAITING_US.includes(status) && !AWAITING_APPLICANT.includes(status)) return null

  const at = since instanceof Date ? since : new Date(since)
  if (Number.isNaN(at.getTime())) return null
  /* الأرضيّةُ صفرٌ: ساعةٌ في المستقبل (فرقُ ساعةِ خادم) لا تُقرأ «منذ -١» */
  const days = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 86_400_000))
  const label = days === 0 ? 'اليوم' : `منذ ${countAr(days, DAY_FORMS)}`

  if (AWAITING_APPLICANT.includes(status)) return { tone: 'calm', days, ar: `بانتظاره ${label}` }
  return {
    tone: days >= AGE_LATE_DAYS ? 'late' : days >= AGE_WARN_DAYS ? 'warn' : 'calm',
    days,
    ar: `عندنا ${label}`,
  }
}
