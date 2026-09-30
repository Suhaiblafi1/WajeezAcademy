/* ═══ مدّةُ الشعبة — من متى إلى متى، يحدّدها مدرّبُها ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «في تعديل المعلومات الأساسيّة اجعله أن
   يعتمد متى تبدأ الشعبةُ ومتى تنتهي، لأنّها هي الفترةُ المخصّصة للّقاءات
   المباشرة ومدّةُ رؤية المتعلّمين موارده». ثمّ: «واضحٌ له أنّ اللقاءات بيده،
   ويجب أن تكون ضمن فترة الشعبة نفسها التي وضعها بنفسه ابتداءً حتّى النهاية».

   ── وما كان ──

   الحدودُ كانت حدودَ **الفصل** الذي تسمّيه الإدارةُ عند الإسناد (١٧ سبتمبر
   ٢٠٢٦): ثلاثةُ أشهرٍ هي نافذةُ الجدولة كلُّها، والمدرّبُ ينتظر التسمية ولا
   يستطيع لقاءً واحدا قبلها. وكان في يده بابٌ خلفيٌّ يكتب البدءَ والانتهاءَ
   على الشعبة مباشرةً — **بلا اعتمادٍ** وبلا أن تتحرّك نافذتُه معهما.

   ── وما صار ──

   · المدّةُ تُكتب في الخطّة (`startsOn` و`endsOn`) وتُعتمَد معها: قبل الاعتماد
     لا يراها متعلّم، وبه تصير حدودَ الشعبة المعلَنة.
   · ونافذةُ جدولته تتبعها لحظةَ الحفظ — فيجدول داخلَ مدّته فورا، ولا ينتظر
     أحدا. والنافذةُ إذنُ المدرّب لا وعدٌ للمتعلّم، فلا يلزمها اعتماد.
   · والفصلُ يُشتقّ من تاريخ البدء عند الاعتماد — لا يُسأل عنه المدرّب.

   ── ولمَ ملفٌّ واحد ──

   القاعدةُ يقرؤها الخادمُ (الحفظُ والقائمةُ والاعتماد) وشاشةُ المدرّب معا.
   وقاعدتان تقولان الشيءَ نفسَه في موضعين تفترقان — وهو ما جمع لأجله هذا
   المستودَعُ بوّابةَ الإرسال في `plan-gate.ts` ونافذةَ الجدولة في
   `schedule-window.ts`. */

/** المدّةُ كما تُحفظ — تاريخان بصيغة `YYYY-MM-DD` بلا ساعة */
export interface CohortPeriod {
  startsOn: string
  endsOn: string
}

/** منطقةُ الأكاديميّة — منها تُقرأ «بدايةُ اليوم» و«نهايتُه» */
export const ACADEMY_ZONE = 'Asia/Amman'

/** أطولُ مدّةٍ تُقبل — أطولُ منها غالبا خطأُ سنةٍ في التاريخ لا دورةٌ حقيقيّة */
export const MAX_PERIOD_DAYS = 366

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** تاريخٌ حقيقيٌّ في التقويم — لا `2026-02-31` يقبله النمطُ ويرفضه الشهر.
    ويُصدَّر لخطّ المحاور (`axis-timeline.ts`): مواعيدُه تواريخُ بالصيغة نفسِها. */
export function realDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** عددُ أيّام المدّة بطرفيها — الشعبةُ من الأحد إلى الأحد التالي ثمانيةُ أيّام */
export function periodDays(p: CohortPeriod): number {
  const a = Date.parse(`${p.startsOn}T00:00:00Z`)
  const b = Date.parse(`${p.endsOn}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000) + 1
}

/** المدّةُ كاملةٌ أم لا — والناقصُ `null` لا نصفُ مدّة */
export function asPeriod(p: { startsOn?: string | null; endsOn?: string | null } | null | undefined): CohortPeriod | null {
  if (!p?.startsOn || !p?.endsOn) return null
  return { startsOn: p.startsOn, endsOn: p.endsOn }
}

/** ما يمنع هذه المدّة — بلغة من يصحّحها، أو `null` إن صلحت.

    و`today` و`approvedStart` لا يشترطهما إلّا الحفظ: البدءُ الماضي مردودٌ
    **إلّا** أن يكون هو البدءَ المعتمَدَ نفسَه — شعبةٌ جاريةٌ بدأت أمس لا
    يُطلب من مدرّبها أن يؤخّر بدايتَها كي يحفظ تعديلا في محاورها. */
export function periodProblem(
  p: { startsOn?: string | null; endsOn?: string | null } | null | undefined,
  opts: { today?: string; approvedStart?: string | null } = {},
): string | null {
  if (!p?.startsOn) return 'حدّد تاريخَ بدء الشعبة'
  if (!p.endsOn) return 'حدّد تاريخَ انتهاء الشعبة'
  if (!realDate(p.startsOn) || !realDate(p.endsOn)) return 'تاريخٌ غيرُ صالح — راجِع اليومَ والشهر'
  if (p.endsOn <= p.startsOn) return 'تاريخُ الانتهاء بعد تاريخ البدء — لا قبله ولا في يومه'
  if (periodDays({ startsOn: p.startsOn, endsOn: p.endsOn }) > MAX_PERIOD_DAYS) {
    return 'مدّةٌ أطولُ من سنة — تحقّق من السنة في التاريخ'
  }
  if (opts.today && p.startsOn < opts.today && p.startsOn !== (opts.approvedStart ?? null)) {
    return 'تاريخُ البدء مضى — اختر يوما من اليوم فما بعده'
  }
  return null
}

/* ═══ الساعةُ في منطقةٍ بعينها ═══

   «بدايةُ الشعبة» منتصفُ ليل يومها **في عمّان** لا في غرينتش ولا في متصفّح
   من يفتح الشاشة: لقاءٌ في التاسعة مساءً بتوقيت عمّان من آخر يومٍ يقع في
   اليوم التالي بغرينتش، فلو قيس الحدُّ بها لرُدّ لقاءٌ داخلَ المدّة.
   وكان هذا عطبا قائما في نافذة الفصل: تُكتب نهايتُها منتصفَ ليل اليوم
   الأخير بغرينتش، فيُردّ كلُّ لقاءٍ في آخر يومٍ من الفصل. */
function offsetMinutes(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - at.getTime()) / 60_000)
}

/** اللحظةُ التي تكون فيها الساعةُ كذا من يومِ كذا في المنطقة */
export function zonedInstant(date: string, clock: [number, number, number, number], zone = ACADEMY_ZONE): Date {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, clock[0], clock[1], clock[2], clock[3])
  return new Date(guess - offsetMinutes(new Date(guess), zone) * 60_000)
}

/** حدّا المدّة لحظتين: أوّلُ يومِها منذ منتصف ليله، وآخرُ يومِها حتّى آخر ثانية */
export function periodBounds(p: CohortPeriod, zone = ACADEMY_ZONE): { from: Date; to: Date } {
  return {
    from: zonedInstant(p.startsOn, [0, 0, 0, 0], zone),
    to: zonedInstant(p.endsOn, [23, 59, 59, 999], zone),
  }
}

/** يومُ لحظةٍ في المنطقة — `YYYY-MM-DD` */
export function zonedDay(at: Date | string, zone = ACADEMY_ZONE): string {
  const d = typeof at === 'string' ? new Date(at) : at
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** ساعةُ لحظةٍ في المنطقة — «18:30» */
export function zonedClock(at: Date | string, zone = ACADEMY_ZONE): string {
  const d = typeof at === 'string' ? new Date(at) : at
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}

/** لحظةُ يومٍ وساعةٍ «18:30» في المنطقة — عكسُ `zonedDay` و`zonedClock` */
export function zonedAt(date: string, clock: string, zone = ACADEMY_ZONE): Date {
  const [h, m] = clock.split(':').map(Number)
  return zonedInstant(date, [h || 0, m || 0, 0, 0], zone)
}

/** أيقع هذا الموعدُ داخلَ المدّة؟ — بدايتُه ونهايتُه كلتاهما */
export function withinPeriod(
  when: { startsAt: Date | string; endsAt?: Date | string | null },
  p: CohortPeriod,
  zone = ACADEMY_ZONE,
): boolean {
  const { from, to } = periodBounds(p, zone)
  const s = new Date(when.startsAt).getTime()
  const e = when.endsAt ? new Date(when.endsAt).getTime() : s
  return s >= from.getTime() && e <= to.getTime()
}
