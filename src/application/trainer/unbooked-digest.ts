/* من أتمّ طلبَه ولم يحجز — ملخّصٌ يوميٌّ للإدارة، لا رسالةٌ للمتقدّم.

   ═══ العطبُ الذي كُتب له ═══

   قرارُ صاحب المنصّة (١٩ سبتمبر ٢٠٢٦) أنّ تذكيرَ المتقدّم **يدويّ**: لا
   يخرج بريدٌ إلى إنسانٍ إلّا بيدٍ تضغط. وهو قرارٌ صحيح — لا تُطارِد الآلةُ
   أحدا. وثمنُه أن يتذكّر الموظّفُ أن يفتح الطابورَ ويرشّحه بـ«لم يحجز
   موعدا»؛ فإن نسي أسبوعا وقف أربعةٌ ينتظرون رسالةً لا أحدَ يُرسلها.

   فالآلةُ تُذكّر **الموظّفَ** لا المتقدّم: سطورٌ تقول من وقف ومنذ متى،
   وزرُّها يفتح الطابور. فيبقى القرارُ في يدِ إنسان، ويخرج النسيانُ منها.

   ═══ وثلاثةُ حدودٍ تفرّق بين ملخّصٍ يُقرأ وآخرَ يُهمَل ═══

   ① **لا يُرسَل فارغا.** صباحٌ لا متأخّرَ فيه لا رسالةَ له. ورسالةٌ يوميّةٌ
      تقول «لا شيء» تُعلِّم قارئَها أن يمرَّ عليها بلا قراءة — فتضيع يومَ
      تحمل خبرا. ولذلك يُردّ `null` لا ملخّصٌ بصفر.
   ② **ولا يُدرَج من أتمّ أمسِ.** صفحةُ الشكر تعرض التقويمَ أمامه، وكثيرٌ
      يحجز في يومه أو غده. فإدراجُه اليومَ يجعل الملخّصَ قائمةَ الواصلين
      لا قائمةَ المتأخّرين — وقائمةُ الواصلين يعرفها الطابورُ أصلا.
   ③ **ومن حجز أو وقع في طلبه قرارٌ يخرج.** والمِحَكُّ `canRemindToBook`
      نفسُه الذي يقرّر عرضَ الزرّ في الشاشة وقبولَ الخادم — فلا يُدرَج في
      ملخّصٍ من لو ضُغط له الزرُّ لَرُدّ ٤٠٩.

   ═══ والعمرُ من الإتمام لا من آخر حركة ═══

   شارةُ الطابور تعدّ من آخر حركةٍ في الطلب (`queue-age.ts`)، وهو صوابٌ
   هناك: تقول منذ متى يقف **عندنا**. والسؤالُ هنا آخر: منذ متى يستطيع أن
   يحجز ولم يفعل؟ وذاك يبدأ بإتمام الطلب لا بنقلِ حالةٍ بعده. ولذلك يُسمَّى
   المبدأُ في السطر صراحةً («أتمّ طلبَه منذ…») فلا يُقرأ رقما يناقض الشارة. */

import { countAr } from '../text/count-ar'
import { canRemindToBook } from './application-options'
import { DAY_FORMS } from './queue-age'

/** الأيّامُ كما تُقرأ في الشاشة نفسِها — الصيغُ من `queue-age.ts` */
const daysAr = (n: number): string => countAr(n, DAY_FORMS)

/** لا يُدرَج من أتمّ طلبَه قبل أقلَّ من هذه المدّة */
export const UNBOOKED_AFTER_DAYS = 3

/** كم اسما يُذكر في الرسالة — والباقي عددٌ في آخرها */
export const DIGEST_NAMES = 8

/** توقيتُ الأكاديمية — وبه يُعرف «الصباح» لا بتوقيت الخادم */
export const ACADEMY_TZ = 'Asia/Amman'

/** نافذةُ الصباح: تُفتح السابعةَ وتُغلق قبل العاشرة */
export const DIGEST_FROM_HOUR = 7
export const DIGEST_TO_HOUR = 10

export interface UnbookedRow {
  fullName: string
  reference: string
  status: string
  /** المقابلاتُ القائمةُ له — والملغاةُ لا تُعَدّ، فمن ألغى لم يعد له موعد */
  liveInterviews: number
  /** متى أتمّ طلبَه — ومن لا إتمامَ له لا يُدرَج */
  completedAt: Date | string | null
  /** متى ذُكِّر آخرَ مرّة — أو `null` لمن لم يُذكَّر قطّ */
  remindedAt?: Date | string | null
}

export interface LateToBook extends UnbookedRow {
  /** الأيّامُ منذ إتمام الطلب */
  days: number
  /** السطرُ كما يُقرأ في الرسالة */
  lineAr: string
}

export interface UnbookedDigest {
  count: number
  /** أطولُهم وقوفا — يُقال في خبر الوظيفة */
  oldestDays: number
  /** ومصرَّفا عربيّا: «منذ 5 أيّام» لا «منذ 5 يوما» */
  oldestAr: string
  /** موضوعُ الرسالة وعنوانُها */
  titleAr: string
  /** المتنُ فقراتٍ مفصولةً بسطرٍ فارغ — هكذا يقرؤه `notificationMailDoc` */
  bodyAr: string
  /** السطورُ المعروضةُ وحدَها — لمن أراد عرضَها في شاشة */
  lines: string[]
}

const DAY_MS = 86_400_000

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const daysSince = (at: Date, now: Date): number => Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY_MS))

/* ═══ ولمَ يُقال «ذُكِّر» أو «لم يُذكَّر» في كلّ سطر ═══

   لأنّ الملخّصَ بلا هذا يُقرأ قائمةً واحدة، فيُبدأ من أوّلها كلَّ صباح —
   ويُذكَّر من ذُكِّر أمسِ مرّتَين، ويبقى من لم يُمَسّ آخرَ القائمة. والفرقُ
   بين الاثنين هو كلُّ ما يفعله الموظّفُ بهذه الرسالة. */
const remindPart = (remindedAt: Date | null, now: Date): string => {
  if (!remindedAt) return 'لم يُذكَّر بعد'
  const d = daysSince(remindedAt, now)
  return d === 0 ? 'ذُكِّر اليوم' : `ذُكِّر منذ ${daysAr(d)}`
}

/** المتأخّرون عن الحجز، أطولُهم وقوفا أوّلا */
export function lateToBook(rows: readonly UnbookedRow[], now: Date = new Date()): LateToBook[] {
  const late: LateToBook[] = []
  for (const row of rows) {
    if (!canRemindToBook({ status: row.status, liveInterviews: row.liveInterviews })) continue
    const completed = asDate(row.completedAt)
    if (!completed) continue
    const days = daysSince(completed, now)
    if (days < UNBOOKED_AFTER_DAYS) continue
    late.push({
      ...row,
      days,
      lineAr: `${row.fullName} (${row.reference}) — أتمّ طلبَه منذ ${daysAr(days)}`
        + ` · ${remindPart(asDate(row.remindedAt), now)}`,
    })
  }
  return late.sort((a, b) => b.days - a.days)
}

/** عنوانُ الرسالة — والعددُ فيه يُصرَّف عربيّا، فلا «1 متقدّمين» */
export function unbookedTitleAr(count: number): string {
  if (count === 1) return 'متقدّمٌ واحدٌ لم يحجز موعدَ لقاء التعارف'
  if (count === 2) return 'متقدّمان لم يحجزا موعدَ لقاء التعارف'
  if (count <= 10) return `${count} متقدّمين لم يحجزوا موعدَ لقاء التعارف`
  return `${count} متقدّما لم يحجزوا موعدَ لقاء التعارف`
}

/** ملخّصُ الصباح — أو `null` حين لا متأخّرَ، فلا تخرج رسالةٌ بلا خبر */
export function unbookedDigest(rows: readonly UnbookedRow[], now: Date = new Date()): UnbookedDigest | null {
  const late = lateToBook(rows, now)
  if (late.length === 0) return null

  const shown = late.slice(0, DIGEST_NAMES)
  const rest = late.length - shown.length
  const lines = shown.map((r) => r.lineAr)
  const parts = [
    'ولا يصل المتقدّمَ شيءٌ من هذه الرسالة: التذكيرُ يخرج بيدك من طابور الطلبات، ولا تُرسله الآلةُ عن أحد.',
    ...lines,
    ...(rest > 0
      ? [rest === 1
        ? 'وفي الطابور واحدٌ غيرُهم على الحال نفسِها.'
        : `وفي الطابور ${rest} غيرُهم على الحال نفسِها.`]
      : []),
  ]

  return {
    count: late.length,
    oldestDays: late[0].days,
    oldestAr: `منذ ${daysAr(late[0].days)}`,
    titleAr: unbookedTitleAr(late.length),
    bodyAr: parts.join('\n\n'),
    lines,
  }
}

/** أفي نافذة الصباح نحن؟ — بتوقيت الأكاديمية لا بتوقيت الخادم.
 *
 *  والسؤالُ يقع في كلّ دورةٍ لا في واحدةٍ كلَّ أربعٍ وعشرين ساعة: العاملُ
 *  يُقلع مع كلّ نشرة، ودورةٌ تُقاس بالساعات منذ الإقلاع تُرسل الملخّصَ
 *  الرابعةَ عصرا لمن نشر عند الظهر. فالوقتُ يُسأل عنه، والتكرارُ يمنعه
 *  أثرُ الإرسال نفسُه. */
export function isDigestHour(now: Date, tz: string = ACADEMY_TZ): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now),
  )
  if (Number.isNaN(hour)) return false
  return hour >= DIGEST_FROM_HOUR && hour < DIGEST_TO_HOUR
}
