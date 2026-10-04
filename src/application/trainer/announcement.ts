/* ═══ إعلانُ الإدارة إلى المدرّبين — ما يتّفق عليه الخادمُ والشاشتان (٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا». وعُرضت
   عليه ثلاثةُ خياراتٍ بفروقها، فاختار الأوّل: **نافذةً** تظهر للمدرّب في بوّابته
   فيها «قرأتُه»، و**إشعارا** في الجرس، و**قائمةً** يرى فيها من قرأ ومن لم يقرأ.

   ── وثلاثةٌ تُحكم بها ──

   ① **الإرسالُ بيد صاحب الصلاحيّة وحدَه** (`staff.notify` — «من يبثّ الإعلانات»):
      النصُّ يُكتب ويُرى كما سيصل، ثمّ يُسأل «أترسله الآن؟» وخيارا الجواب بأثر كلٍّ.
      ولا شيءَ يُرسَل تلقائيّا.
   ② **والنافذةُ لا تمنع**: «ذكّرني لاحقا» يغلقها حتّى الجلسة التالية، والمدرّبُ في
      عمله. وتعود ما لم يضغط «قرأتُه» — فذاك «تأكّد أنّهم قرؤوها».
   ③ **والقائمةُ تفرّق ثلاثة**: قرأه (ضغط «قرأتُه»)، ورآه ولم يؤكّد (ظهرت له النافذةُ
      فأجّلها)، ولم يفتح بوّابتَه بعد. فمن يتابع يعرف من يُكلَّم ومن ينتظر. */

import { addDays } from './axis-timeline'
import { realDate, zonedInstant } from './cohort-period'

/** حدّا النصّ — يفحصهما المسلكُ، وتعدّهما الشاشة */
export const ANNOUNCEMENT_TITLE_MAX = 160
export const ANNOUNCEMENT_BODY_MAX = 4000

/** مفتاحُ الإشعار في الجرس — صنفُه «إعلاناتُ الأكاديمية» (`categories.ts`) */
export const ANNOUNCEMENT_TEMPLATE_KEY = 'trainer.announcement'

/** ما يقوله بندُ الجرس تحت العنوان — والنصُّ كاملا في النافذة لا في الجرس */
export const ANNOUNCEMENT_BELL_BODY_AR = 'إعلانٌ من إدارة الأكاديمية — افتحه لتقرأه كاملا.'

/* ═══ النصُّ المقترح — يُملأ به نموذجُ الإرسال، ويُعدَّل قبل أن يُرسَل ═══

   كتبه صاحبُ المنصّة بمعناه: «أعلم أنّ بعضكم بدأ يضع لقاءاته، لكن خطرت فكرةٌ: أنصح
   الجميعَ وأوصيهم أن تبدأ اللقاءاتُ أواخرَ نوفمبر بدلَ أوائله، لأنّا نحتاج وقتا أطول
   لنعلن عن عملكم الجيّد… اجعله أكثرَ احترافيّة». وعُرضت عليه الصيغةُ هذه، وزِيد
   فيها بعد العرض سطرُ من رتّب مواعيدَه بيده (`followPeriod` لا يحرّك ترتيبه). */
export const ANNOUNCEMENT_DRAFT = {
  titleAr: 'موعدُ بدء الشُّعب — اقتراحٌ من الإدارة',
  bodyAr: [
    'الزملاءُ المدرّبون الكرام،',
    'نشكر لكم جهدَكم في إعداد شُعبكم. نعلم أنّ بعضكم قد حدّد مواعيدَ شعبته ولقاءاتِه، ونقترح أن تبدأ الشُّعبُ في أواخر نوفمبر أو في ديسمبر بدلًا من أوائله؛ ليتّسع لنا الوقتُ للتعريف بدوراتكم وتسويقها بما يليق بجهدكم.',
    'وهذا اقتراحٌ لا إلزام: من أراد البدءَ قبل ذلك فله ما أراد، ولا يتوقّف شيءٌ في شعبته.',
    'ولتعديل الموعد: افتح شعبتك، ثمّ «المعلومات الأساسيّة»، وغيّر تاريخَ البدء، فتتبعه مواعيدُ المحاور — ومن رتّبها بيده يجد زرّا يوزّعها على المدّة الجديدة.',
    'مع التقدير،',
    'إدارةُ أكاديمية وجيز',
  ].join('\n\n'),
} as const

/* ═══ ومن يصير مدرّبا بعد الإرسال (٤ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «اعرضه لمن ينضمّ بعدُ أيضا». فيُختار عند الإرسال بين خيارين بأثر
   كلٍّ: «المدرّبون الآن، ومن يصير مدرّبا حتّى يومٍ تختاره» أو «المدرّبون الآن وحدَهم».
   ومن انضمّ في المدّة يُكتب مستقبِلا أوّلَ ما يفتح بوّابتَه، فتظهر له النافذةُ ويصله الجرس.

   ولا يبقى البابُ مفتوحا بلا يوم: نصيحةُ «ابدأ أواخرَ نوفمبر» لا معنى لها لمن انضمّ في
   يناير. فللنصّ المقترح آخرُ نوفمبر، ولغيره شهرٌ من يوم الإرسال — ويُغيَّر كلاهما. */
export const LATE_JOINERS_DRAFT_UNTIL = '2026-11-30'
export const LATE_JOINERS_DEFAULT_DAYS = 30
/** أبعدُ يومٍ يُقبل — أبعدُ منه غالبا خطأُ سنة */
export const LATE_JOINERS_MAX_DAYS = 366

/** اليومُ الذي يُقترح آخرَ مدّةٍ للمنضمّين — والنصُّ المقترحُ حتّى آخر نوفمبر ما دام لم يمضِ */
export function defaultLateUntil(today: string, isDraft: boolean): string {
  if (isDraft && today <= LATE_JOINERS_DRAFT_UNTIL) return LATE_JOINERS_DRAFT_UNTIL
  return addDays(today, LATE_JOINERS_DEFAULT_DAYS)
}

/** ما يمنع هذا اليومَ آخرا للمدّة — أو `null` */
export function lateUntilProblem(day: string, today: string): string | null {
  if (!realDate(day)) return 'اكتب يوما صحيحا لآخر مدّة المنضمّين'
  if (day < today) return 'آخرُ مدّة المنضمّين يومٌ مضى — اختر اليومَ أو ما بعده'
  if (day > addDays(today, LATE_JOINERS_MAX_DAYS)) return 'آخرُ مدّة المنضمّين أبعدُ من سنة — أهو خطأٌ في السنة؟'
  return null
}

/** لحظةُ انتهاء المدّة: آخرُ ثانيةٍ من ذلك اليوم بعمّان */
export function lateUntilInstant(day: string): Date {
  return zonedInstant(day, [23, 59, 59, 999])
}

/** حالُ مدرّبٍ مع إعلان — كما تقرؤه قائمةُ «من قرأ» */
export type RecipientState = 'read' | 'seen' | 'unseen'

export function recipientState(r: { seenAt?: string | Date | null; readAt?: string | Date | null }): RecipientState {
  if (r.readAt) return 'read'
  if (r.seenAt) return 'seen'
  return 'unseen'
}

export const RECIPIENT_STATE_AR: Record<RecipientState, string> = {
  read: 'قرأه',
  seen: 'رآه ولم يضغط «قرأتُه» بعد',
  unseen: 'لم يفتح بوّابتَه منذ أُرسل',
}

/** مفتاحُ «ذكّرني لاحقا» في جلسة المتصفّح — تعود النافذةُ في الجلسة التالية */
export function laterKey(announcementId: string): string {
  return `wajeez.announcement.later.${announcementId}`
}

/** أيُّ إعلانٍ تفتحه النافذةُ الآن؟ — المطلوبُ بالاسم (من الجرس) ولو قُرئ، وإلّا
    أقدمُ ما لم يُقرأ ولم يُؤجَّل في هذه الجلسة. والقائمةُ أحدثُها أوّلا كما يردّها الخادم. */
export function announcementToShow<T extends { id: string; readAt?: string | null }>(
  items: readonly T[],
  opts: { wanted?: string | null; deferred: (id: string) => boolean },
): T | null {
  if (opts.wanted) {
    const hit = items.find((a) => a.id === opts.wanted)
    if (hit) return hit
  }
  const waiting = items.filter((a) => !a.readAt && !opts.deferred(a.id))
  return waiting.length ? waiting[waiting.length - 1] : null
}
