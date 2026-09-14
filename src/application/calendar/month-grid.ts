/* شبكةُ الشهر — حسابٌ نقيٌّ يُشترك فيه كلُّ تقويمٍ في المنصّة.

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من «جدولي»: قائمةٌ مبعثرةٌ لا تقويم.
   وعلّةُ الشكوى أنّ القائمةَ تقول «متى» ولا تقول «أين أنا من الشهر»: من له
   جلستان يوم الأحد وثالثةٌ بعد أسبوعين يقرأ ثلاثةَ أسطرٍ ولا يرى أنّ أسبوعا
   كاملا بينها فارغ.

   ─────────── ولمَ الحسابُ هنا لا في المكوّن ───────────

   حسابُ الشهر موضعُ أخطاءِ الفواصل كلِّها: أوّلُ الشهر في أيّ عمود، وكم
   أسبوعا يلزم، وما يُعرض من الشهر السابق واللاحق. وخطأٌ بيومٍ واحدٍ يضع
   جلسةً في خانةِ غيرها — ولا يُكتشف إلّا حين يحضر أحدٌ في اليوم الخطأ.
   فالحسابُ يُفحص وحدَه، والمكوّنُ يصيّر ما يُعطى.

   وK11 من دفتر العمل: «التقويمُ مكوّنٌ واحدٌ يُستعمل مرّتين» — جدولُ المدرّب
   وجدولُ المتعلّم البياناتُ نفسُها من وجهَين. فلا يُكتب مرّتين.

   ─────────── قراراتٌ مكتوبةٌ كيلا تُخمَّن ───────────

   · **الأسبوعُ يبدأ الأحد.** هو عرفُ التقويم في المنطقة، وهو ترتيبُ
     `DAYS` في هذه المنصّة منذ كُتبت.
   · **والأسابيعُ بقَدرِ الشهر** لا ستّةٌ دائما: صفٌّ فارغٌ في آخر التقويم
     فراغٌ يُقرأ «لا شيءَ هنا» وهو كذبٌ — الشهرُ انتهى.
   · **والحسابُ بالتوقيت المحلّيّ** للمتصفّح: التقويمُ يُقرأ بعين صاحبه، ومن
     حسبه بـUTC وضع جلسةَ العاشرة مساءً في يوم الغد. */

/** خانةُ يومٍ في الشبكة */
export interface DayCell<T> {
  /** اليومُ نفسُه عند منتصف الليل المحلّيّ */
  date: Date
  /** أمن الشهر المعروض هو؟ — ما ليس منه يُعرض باهتا ولا يُحسب */
  inMonth: boolean
  /** أهو اليومُ الجاري؟ */
  isToday: boolean
  /** ما يقع فيه، مرتَّبا بالوقت */
  items: T[]
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** أسماءُ الأيّام من الأحد — ترتيبُ الشبكة نفسُه */
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const

/**
 * شبكةُ شهرٍ: أسابيعُ من سبعِ خانات، تبدأ الأحد.
 *
 * `at` تقرأ تاريخَ العنصر — فالشبكةُ لا تعرف شكلَ ما يوضع فيها.
 */
export function monthGrid<T>(
  year: number, month: number, items: readonly T[], at: (item: T) => Date, now: Date = new Date(),
): DayCell<T>[][] {
  const first = new Date(year, month, 1)
  /* الأحدُ الذي يسبق أوّلَ الشهر أو يوافقه — `getDay()` يعيد ٠ للأحد */
  const gridStart = new Date(year, month, 1 - first.getDay())
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  /* الأسابيعُ بقَدرِ ما يسع الشهرَ مع إزاحة أوّله — لا ستّةٌ دائما */
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7)

  /* العناصرُ تُفهرَس بيومها مرّةً: بحثٌ خطّيٌّ لكلّ خانةٍ يعني ٤٢ مرورا
     على القائمة، وهو ثمنٌ يُدفع في كلّ تصيير. */
  const byDay = new Map<string, T[]>()
  for (const item of items) {
    const d = at(item)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const bucket = byDay.get(key)
    if (bucket) bucket.push(item)
    else byDay.set(key, [item])
  }
  for (const bucket of byDay.values()) bucket.sort((a, b) => at(a).getTime() - at(b).getTime())

  const today = startOfDay(now)
  const grid: DayCell<T>[][] = []
  for (let w = 0; w < weeks; w += 1) {
    const row: DayCell<T>[] = []
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d)
      row.push({
        date,
        inMonth: date.getMonth() === month && date.getFullYear() === year,
        isToday: sameDay(date, today),
        items: byDay.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`) ?? [],
      })
    }
    grid.push(row)
  }
  return grid
}

/**
 * أوّلُ ما هو آتٍ — «الجلسةُ القادمة» التي تُميَّز في التقويم.
 *
 * وما مضى لا يُعدّ قادما ولو بدقيقة: تمييزُ جلسةٍ انتهت يقول للناظر إنّ
 * أمامه ما هو خلفَه.
 */
export function nextItem<T>(items: readonly T[], at: (item: T) => Date, now: Date = new Date()): T | null {
  let best: T | null = null
  let bestAt = Infinity
  for (const item of items) {
    const t = at(item).getTime()
    if (Number.isNaN(t) || t < now.getTime()) continue
    if (t < bestAt) { best = item; bestAt = t }
  }
  return best
}

/** الشهرُ الذي يقع فيه تاريخٌ — نقطةُ بدءِ التقويم */
export const monthOf = (d: Date): { year: number; month: number } =>
  ({ year: d.getFullYear(), month: d.getMonth() })

/** تنقّلٌ بالأشهر بلا أن يفيض الشهرُ إلى سنةٍ خطأ */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const d = new Date(year, month + by, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}
