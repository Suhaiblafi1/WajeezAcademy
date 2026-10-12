/* ═══ قواعدُ اللقاء تُقال في منتقيه — لا نصيحةً في الخطوة الأخيرة (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «حدُّ الساعتين، وتجنُّبُ ٢٥
   ديسمبر و١ يناير، والأيّامُ المناسبة: تُعلَّم في منتقي التاريخ والساعة بدلَ أن
   تظهر كنصيحةٍ في الخطوة الأخيرة». وكانت بطاقةُ المعايير (`plan-scorecard.ts`)
   تقولها بعد أن يُجدوَل كلُّ شيء — فيعود المدرّبُ يفكّ ما ربطه.

   فالقواعدُ هنا هي قواعدُ البطاقة نفسُها (ثوابتُها تُستورد لا تُنسخ): ما يُعلَّم
   في المنتقي هو ما سيقرؤه المعتمِد. وكلُّها **علامةٌ لا منع** — كما في البطاقة:
   نصيحةٌ بسببها، والقرارُ للمدرّب. والمانعُ الوحيدُ حدُّ الساعتين، وهو في
   `session-length.ts` يُبنى عليه سلّمُ «إلى الساعة» نفسُه.

   ═══ والتكرارُ الأسبوعيّ — خيارٌ جانبيٌّ لا طريقةٌ واحدة ═══

   «يبقى الإدخالُ اليدويُّ هو الأساس… ويُضاف خيارٌ اختياريٌّ لمن يريد إيقاعا
   ثابتا»: يختار يوما وساعةً مرّةً فتُقترح لقاءاتُ المواعيد كلِّها، ثمّ يعدّل
   أيَّها قبل الحفظ. والاقتراحُ هنا محضٌ لا يكتب شيئا — الشاشةُ تعرضه، والمدرّبُ
   يحفظه أو يتركه. */

import { HOLIDAYS, LATEST_END, WORKDAYS, WORKDAY_EARLIEST, WEEKDAY_AR, weekdayOf } from './plan-scorecard'
import { EARLY_DAYS, dayLabelAr, type PlanSlot } from './axis-timeline'
import { MIN_SESSION_MINUTES } from './session-length'

/** العطلةُ الرسميّةُ في هذا اليوم — أو `null` */
export function holidayOn(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return HOLIDAYS.find((h) => day.slice(5) === h.day)?.nameAr ?? null
}

/** يومُ عملٍ في الأردن (الأحد إلى الخميس)؟ */
export function isWorkday(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && WORKDAYS.includes(weekdayOf(day))
}

/** اسمُ اليوم — «الخميس» */
export function weekdayAr(day: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? WEEKDAY_AR[weekdayOf(day)] ?? '' : ''
}

/** ما يُعلَّم به خيارُ «من الساعة» في يومٍ بعينه — أو `null` لخيارٍ مناسب */
export function fromClockNote(day: string, clock: string): string | null {
  return isWorkday(day) && clock < WORKDAY_EARLIEST ? 'وقت عمل' : null
}

/** ما يُعلَّم به خيارُ «إلى الساعة» — أو `null` */
export function toClockNote(clock: string): string | null {
  return clock > LATEST_END ? 'متأخّر' : null
}

/** ما يُقال تحت اليوم حين يُختار — عطلةٌ أو يومُ عمل؛ نصيحةٌ لا تمنع */
export function dayNoteAr(day: string): string | null {
  const h = holidayOn(day)
  if (h) return `${weekdayAr(day)} ${day.slice(8)}/${day.slice(5, 7)} ${h} — عطلة رسميّة، والأفضل يوم غيره.`
  if (isWorkday(day)) return `${weekdayAr(day)} يوم عمل — فاجعل اللقاء بعد الخامسة مساء.`
  return null
}

/** لماذا يبدأ سلّمُ «إلى الساعة» بعد ساعتين — كان يُخفي الأقصرَ بلا كلمة فيُظنّ عطبا */
export const TO_LADDER_WHY_AR =
  `تبدأ القائمة بعد ${MIN_SESSION_MINUTES === 120 ? 'ساعتين' : `${MIN_SESSION_MINUTES} دقيقة`} من البدء، لأنّ اللقاء لا يقلّ عنهما. وما ينتهي بعد العاشرة والنصف ليلا يعلّم «متأخّر».`

/* ─────────── التكرارُ الأسبوعيّ ─────────── */

/** يومُ الأسبوع بأرقام `getUTCDay` — ٠ الأحد … ٦ السبت */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** لقاءٌ مقترَح: موعدُه، ويومُه، ومحاورُه — و`date: null` حين لا يقع اليومُ داخلَه */
export interface WeeklyProposal {
  slotIndex: number
  date: string | null
  moduleIds: string[]
}

const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** أوّلُ يومٍ من أيّام الأسبوع هذا داخلَ الموعد — يتخطّى العطلَ، أو `null` */
export function firstWeekdayIn(slot: { startsOn: string; endsOn: string }, weekday: Weekday): string | null {
  let day = slot.startsOn
  for (let i = 0; i < 7 && day <= slot.endsOn; i += 1, day = addDays(day, 1)) {
    if (weekdayOf(day) !== weekday) continue
    /* العطلةُ تُتخطّى إلى الأسبوع التالي داخلَ الموعد — وإلّا بقيت كما هي فتُعلَّم */
    for (let d = day; d <= slot.endsOn; d = addDays(d, 7)) if (!holidayOn(d)) return d
    return day
  }
  return null
}

/**
 * لقاءٌ لكلّ موعدٍ في يومِ الأسبوع المختار — لمحاوره التي لا لقاءَ لها بعد.
 * والموعدُ الذي غُطّيت محاورُه كلُّها لا يُقترح له شيء: لا يُكرَّر ما جدوله بيده.
 */
export function weeklyProposals(
  slots: readonly PlanSlot[],
  covered: ReadonlySet<string>,
  weekday: Weekday,
): WeeklyProposal[] {
  return slots.flatMap((slot, slotIndex) => {
    const moduleIds = slot.moduleIds.filter((id) => !covered.has(id))
    if (moduleIds.length === 0) return []
    return [{ slotIndex, date: firstWeekdayIn(slot, weekday), moduleIds }]
  })
}

/** أيقع اليومُ بعد أوّل ثلاثة أيّامٍ من موعده؟ — نصيحةُ `EARLY_DAYS` نفسُها */
export function lateInSlot(day: string, slot: { startsOn: string }): boolean {
  const a = Date.parse(`${slot.startsOn}T00:00:00Z`)
  const b = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) && (b - a) / 86_400_000 + 1 > EARLY_DAYS
}

/** عنوانُ اللقاء الذي يُقترح مثالا — عناوينُ محاوره، أو رقمُها إن لم تُكتب */
export function suggestedSessionTitle(
  moduleIds: readonly string[],
  titles: ReadonlyMap<string, string>,
  axisNo: ReadonlyMap<string, number>,
): string {
  const parts = moduleIds.map((id) => (titles.get(id) ?? '').trim() || `المحور ${axisNo.get(id) ?? '؟'}`)
  return parts.join(' · ')
}

/* ═══ أيّامُ الموعد وحدَها — لا تقويمٌ مفتوح (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «يومُ اللقاء المباشر، ويومُ فتح الجلسة المسجّلة، داخلَ وقت المحور. جرّبتُه
   بنفسي: أضعه في أيّ يومٍ وتعطيني ملاحظة — لا، اعرض لي الوقتَ المسموحَ به وحدَه». وكان الحقلُ تقويما
   بحدّين (`min`/`max`) يُرشد ولا يمنع: اليومُ يُكتب باليد.

   فالمنتقي قائمةُ أيّام الموعد نفسِها: كلُّ يومٍ باسمه وتاريخه، وأوّلُ ثلاثة أيّامٍ «الأنسب» (`EARLY_DAYS`)
   (فبعد اللقاء تُفتح المهامّ)، والعطلةُ الرسميّةُ معلَّمةٌ ويبقى لها أن تُختار — نصيحةٌ لا منع، كما في
   بطاقة المعايير. */

export interface SlotDay {
  /** `YYYY-MM-DD` */
  date: string
  /** «السبت 23 يناير» */
  labelAr: string
  /** من أوّل `EARLY_DAYS` أيّامٍ في الموعد */
  early: boolean
  /** اسمُ العطلة الرسميّة في هذا اليوم — أو `null` */
  holidayAr: string | null
}

/** أيّامُ الموعد من أوّله إلى آخره — وموعدٌ مقلوبٌ أو غيرُ مقروءٍ لا أيّامَ له */
export function slotDays(slot: Pick<PlanSlot, 'startsOn' | 'endsOn'>): SlotDay[] {
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
  if (!ok(slot.startsOn) || !ok(slot.endsOn) || slot.endsOn < slot.startsOn) return []
  const out: SlotDay[] = []
  for (let d = slot.startsOn; d <= slot.endsOn && out.length < 366; d = addDays(d, 1)) {
    out.push({ date: d, labelAr: `${weekdayAr(d)} ${dayLabelAr(d)}`, early: out.length < EARLY_DAYS, holidayAr: holidayOn(d) })
  }
  return out
}

/** نصُّ خيار اليوم — «السبت 23 يناير · الأنسب» أو «… · عطلة: عيد الميلاد» */
export function slotDayOptionAr(d: SlotDay): string {
  if (d.holidayAr) return `${d.labelAr} · عطلة: ${d.holidayAr}`
  return d.early ? `${d.labelAr} · الأنسب` : d.labelAr
}
