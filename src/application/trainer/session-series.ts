/* ═══ السلسلةُ — شعبةٌ تجتمع دوريّا، فتُجدوَل مرّةً لا اثنتَي عشرةَ مرّة ═══

   ── العطبُ ──

   نموذجُ الجدولة يُنشئ لقاءً واحدا. ومدرّبةٌ عندها اثنا عشرَ لقاءً تملؤه
   اثنتَي عشرةَ مرّة: العنوانُ والتاريخُ والساعتان والنبذةُ في كلّ مرّة.
   والشعبةُ في فصلٍ ثابتٍ تجتمع سلسلةً — وهذه **حقيقةُ نموذجنا** لا تفضيلُ
   تصميم. فالمتكرّرُ هو المختارُ سلفا، والمتفرّقُ مخرجٌ لمن يحتاجه.

   ── ولمَ معاينةٌ قبل الإرسال ──

   لأنّ كلَّ تاريخٍ يصير **اجتماعَ زووم** وصفَّ اعتمادٍ عند الإدارة. فقاعدةُ
   تكرارٍ تُطبَّق بلا أن تُرى تُنشئ اثني عشرَ اجتماعا على تواريخَ لم يقرأها
   أحد. والمعاينةُ صفوفٌ تُقرأ وتُحذف وتُعدَّل، وما خرج عن الفصل مشطوبٌ
   بسببه — فلا يُرسَل ما لا يُقبَل، ولا يُكتم سببُ سقوطه.

   ── والتباعدُ نصيحةٌ لا حكم ──

   «باعِدْ بين لقاءَين أسبوعا على الأقلّ — بينهما يُنجِز الطلبةُ تكاليفَهم»
   (١٧ سبتمبر ٢٠٢٦). وهي **تُقال ولا تُفرَض**: دورةٌ مكثّفةٌ في أسبوعٍ قرارُ
   صاحبها، والمنصّةُ تنصح ولا تحجر.

   ── والحسابُ بتوقيتٍ عالميٍّ قصدا ──

   التواريخُ هنا «سنة-شهر-يوم» لا لحظات. ولو حُسبت بتوقيت الجهاز لانزلق
   اليومُ يوما كاملا عند من جهازُه غربَ غرينتش — فيقرأ سلسلةً تبدأ قبل
   تاريخِ بدئه. */

const DAY_MS = 86_400_000

/** أسماءُ الأيّام بترتيب `getUTCDay` — الأحدُ صفر */
export const WEEKDAYS_AR = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
] as const

/** أكثرُ ما تُولّده قاعدةٌ واحدة — وما فوقه خطأُ إدخالٍ لا نيّة */
export const MAX_SERIES = 60
/** ولا تُمشى الأيّامُ إلى ما لا نهاية حين لا يُختار يوم */
const MAX_WALK_DAYS = 730

/** أسبوعٌ — حدُّ نصيحة التباعد */
export const ADVISED_GAP_DAYS = 7
export const SPACING_ADVICE_AR =
  'باعِدْ بين لقاءَين أسبوعا على الأقلّ — بينهما يُنجِز الطلبةُ تكاليفَهم.'

export interface SeriesInput {
  /** «YYYY-MM-DD» — أوّلُ يومٍ يُنظَر فيه، ويدخل السلسلةَ إن وافق يوما مختارا */
  startDate: string
  /** أيّامُ الأسبوع المختارة — `getUTCDay` */
  weekdays: number[]
  count: number
  /** حدودُ الفصل «YYYY-MM-DD» — و`null` تعني بلا حدٍّ من تلك الجهة */
  termStart?: string | null
  termEnd?: string | null
}

export interface SeriesRow {
  /** «YYYY-MM-DD» */
  date: string
  weekdayAr: string
  /** خارجَ حدود الفصل — يُشطَب ولا يُرسَل */
  outside: boolean
  /** سببُ الشطب بكلمة، و`''` لما هو داخلَها */
  reasonAr: string
}

function dayMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(t) ? t : null
}

function ymd(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** التواريخُ المشتقّةُ من قاعدةِ التكرار — مرتَّبةً، وما خرج عن الفصل مُعلَّما */
export function buildSeries(input: SeriesInput): SeriesRow[] {
  const start = dayMs(input.startDate)
  const days = [...new Set(input.weekdays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  const want = Math.min(Math.max(Math.trunc(input.count) || 0, 0), MAX_SERIES)
  if (start === null || days.length === 0 || want === 0) return []

  const from = input.termStart ? dayMs(input.termStart) : null
  const to = input.termEnd ? dayMs(input.termEnd) : null

  const rows: SeriesRow[] = []
  for (let i = 0; i < MAX_WALK_DAYS && rows.length < want; i++) {
    const t = start + i * DAY_MS
    const d = new Date(t).getUTCDay()
    if (!days.includes(d)) continue
    /* والسببُ بكلمة: «خارج الفصل» تقول ما وقع ومن يملك حلَّه */
    const outside = (from !== null && t < from) || (to !== null && t > to)
    rows.push({
      date: ymd(t),
      weekdayAr: WEEKDAYS_AR[d],
      outside,
      reasonAr: outside ? 'خارج الفصل' : '',
    })
  }
  return rows
}

/** أثمّة لقاءان بينهما أقلُّ من أسبوع؟ — للنصيحة وحدَها، لا للمنع */
export function tooTight(dates: readonly string[]): boolean {
  const ts = dates.map(dayMs).filter((t): t is number => t !== null).sort((a, b) => a - b)
  for (let i = 1; i < ts.length; i++) {
    if ((ts[i] - ts[i - 1]) / DAY_MS < ADVISED_GAP_DAYS) return true
  }
  return false
}
