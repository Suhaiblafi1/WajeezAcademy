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
export const ANNOUNCEMENT_BELL_BODY_AR = 'إعلان من إدارة الأكاديمية — افتحه لتقرأه كاملا.'

/* ═══ النصُّ المقترح — يُملأ به نموذجُ الإرسال، ويُعدَّل قبل أن يُرسَل ═══

   كتبه صاحبُ المنصّة بمعناه: «أعلم أنّ بعضكم بدأ يضع لقاءاته، لكن خطرت فكرةٌ: أنصح
   الجميعَ وأوصيهم أن تبدأ اللقاءاتُ أواخرَ نوفمبر بدلَ أوائله، لأنّا نحتاج وقتا أطول
   لنعلن عن عملكم الجيّد… اجعله أكثرَ احترافيّة». وعُرضت عليه الصيغةُ هذه، وزِيد
   فيها بعد العرض سطرُ من رتّب مواعيدَه بيده (`followPeriod` لا يحرّك ترتيبه). */
export const ANNOUNCEMENT_DRAFT = {
  titleAr: 'موعد بدء الشّعب — اقتراح من الإدارة',
  bodyAr: [
    'الزملاء المدرّبون الكرام،',
    'نشكر لكم جهدكم في إعداد شعبكم. نعلم أنّ بعضكم قد حدّد مواعيد شعبته ولقاءاته، ونقترح أن تبدأ الشّعب في أواخر نوفمبر أو في ديسمبر بدلا من أوائله؛ ليتّسع لنا الوقت للتعريف بدوراتكم وتسويقها بما يليق بجهدكم.',
    'وهذا اقتراح لا إلزام: من أراد البدء قبل ذلك فله ما أراد، ولا يتوقّف شيء في شعبته.',
    'ولتعديل الموعد: افتح شعبتك، ثمّ «المعلومات الأساسيّة»، وغيّر تاريخ البدء، فتتبعه مواعيد المحاور — ومن رتّبها بيده يجد زرّا يوزّعها على المدّة الجديدة.',
    'مع التقدير،',
    'إدارة أكاديمية وجيز',
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
  if (day < today) return 'آخر مدّة المنضمّين يوم مضى — اختر اليوم أو ما بعده'
  if (day > addDays(today, LATE_JOINERS_MAX_DAYS)) return 'آخر مدّة المنضمّين أبعد من سنة — أهو خطأ في السنة؟'
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
  seen: 'رآه ولم يضغط «قرأته» بعد',
  unseen: 'لم يفتح بوّابته منذ أرسل',
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

/* ═══ «بدأنا التسويق» — نصٌّ جاهزٌ ثانٍ، ويصل بالبريد أيضا (٢٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «جهّز رسالةً للمدرّبين نبلغهم أنّا بدأنا التسويق، وماذا يفعلون لنشر دوراتهم من قسم «شارك
   دوراتك»، واستخدامِ الصور والنصوص إن أحبّ ذلك.. احترافيّةً واضحةً قصيرةً سهلةَ القراءة، وتصلهم إيميلا ورسالةً على
   المنصّة». فالنصُّ هنا يُملأ به النموذج ويُعدَّل قبل أن يُرسَل — والإرسالُ بيد صاحب الحبّة كما كان (①). وتصل به
   النافذةُ والجرسُ، والبريدُ إن اختاره المرسِل (`byEmail`).

   والرابطُ في سطرٍ وحدَه: النافذةُ تجعله رابطا يُضغط (`LinkedText`)، والبريدُ يجعله زرّا عنوانُه السطرُ قبله
   («افتح «شارك دوراتك»:») — `announcementParts`. والأصلُ (`origin`) من المتصفّح، فلا رابطَ لموقعٍ غيرِ الذي يرسل منه. */
export function marketingDraft(origin: string) {
  return {
    titleAr: 'بدأنا تسويق دوراتكم — شاركوها الآن',
    bodyAr: [
      'الزملاء المدرّبون الكرام،',
      'بدأنا حملة التسويق لدورات هذا الموسم. ودعوتكم أنتم أقوى ما يصل: من يعرفكم يثق بكم، ويسجّل حين تدعونه.',
      'انشر دوراتك في دقيقة:\n1. افتح «شارك دوراتك» من قائمة بوّابتك.\n2. اختر نوع المنشور: «إعلان انضمامي» أو «دعوة لدوراتي».\n3. اختر المنصّة: واتساب، إنستغرام، لينكدإن، فيسبوك أو غيرها.\n4. اضغط «انشر» — الصورة والنص جاهزان، ومعهما كود خصم لمتابعيك.',
      'والصور والنصوص لك إن أحببت: عدّل النص كما تشاء، أو انشر بصورك وأسلوبك، أو انسخ رابطك وحده.',
      'ومن يسجّل من رابطك أو بكودك يحسب لك بأجر الإحالة، والخصم منّا لا يحسم منك شيء.',
      `افتح «شارك دوراتك»:\n${origin}/trainer/share`,
      'مع التقدير،\nإدارة أكاديمية وجيز',
    ].join('\n\n'),
  }
}

/** فقرةٌ من الإعلان كما يرسمها البريد — نصٌّ، أو قائمةٌ مرقّمة، أو زرٌّ برابطه */
export type AnnouncementPart =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'cta'; label: string; href: string }

const BARE_URL = /^https?:\/\/\S+$/
const NUMBERED = /^\d+[.)]\s+/

/** الإعلانُ فقراتٍ للبريد: الرابطُ في سطرٍ وحدَه زرٌّ عنوانُه ما قبله إن انتهى بنقطتين، والأسطرُ المرقّمةُ قائمة */
export function announcementParts(body: string): AnnouncementPart[] {
  const out: AnnouncementPart[] = []
  for (const para of body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    const last = lines[lines.length - 1]
    if (BARE_URL.test(last)) {
      const before = lines.slice(0, -1)
      const head = before[before.length - 1]
      const labelled = head?.endsWith(':')
      const rest = labelled ? before.slice(0, -1) : before
      if (rest.length) out.push({ kind: 'p', text: rest.join('\n') })
      out.push({ kind: 'cta', label: labelled ? head.slice(0, -1).trim() : 'افتح الرابط', href: last })
      continue
    }
    const at = lines.findIndex((l) => NUMBERED.test(l))
    if (at >= 0 && lines.slice(at).every((l) => NUMBERED.test(l))) {
      if (at > 0) out.push({ kind: 'p', text: lines.slice(0, at).join('\n') })
      out.push({ kind: 'list', items: lines.slice(at).map((l) => l.replace(NUMBERED, '')) })
      continue
    }
    out.push({ kind: 'p', text: lines.join('\n') })
  }
  return out
}
