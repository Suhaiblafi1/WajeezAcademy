/* اسمُ الشعبة الافتراضيّ: «اسمُ الدورة — شعبة ١» (٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: كانت الشعبُ تُسمّى «الدفعة الأولى» و«الشعبة الأولى»
   بلا اسم دورتها، فلا يُعرف من القائمة أيُّها لأيّ دورة. فصار الاسمُ
   الافتراضيُّ اسمَ الدورة نفسَها ومعه رقمُ الشعبة **في تلك الدورة**.

   · **والرقمُ لا يُعاد.** شعبةٌ أُلغيت تبقى برقمها، والتالية بعدها — فلا
     تحمل شهادتان قديمةٌ وجديدةٌ اسما واحدا. فالرقمُ التالي أكبرُ من عدد
     شعب الدورة كلِّها ومن أكبر رقمٍ في أسمائها معا.
   · **وهو افتراضٌ لا قيد:** للإدارة أن تسمّي الشعبةَ بما شاءت.
   · والأرقامُ هنديّةٌ (١، ٢) كما كتبها صاحبُ المنصّة.

   وحدةٌ خالصةٌ يقرؤها الخادمُ والشاشةُ معا. */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export const COHORT_WORD_AR = 'شعبة'

const toArabicDigits = (n: number): string =>
  String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!)

/** «اسمُ الدورة — شعبة ١» */
export function cohortTitleAr(courseTitleAr: string, n: number): string {
  return `${courseTitleAr.trim()} — ${COHORT_WORD_AR} ${toArabicDigits(n)}`
}

/** رقمُ الشعبة من اسمها إن كان على هذا النمط — وإلّا `null` */
export function cohortNumberOf(title: string): number | null {
  const m = new RegExp(`— ${COHORT_WORD_AR} ([٠-٩0-9]+)`).exec(title)
  if (!m) return null
  const western = m[1]!.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
  return Number(western)
}

/** رقمُ الشعبة التالية من أسماء شعب الدورة كلِّها — الملغاةُ منها والمنتهية */
export function nextCohortNumber(existingTitles: string[]): number {
  const highest = existingTitles.reduce((m, t) => Math.max(m, cohortNumberOf(t) ?? 0), 0)
  return Math.max(existingTitles.length, highest) + 1
}

/* ═══ «شعبتك الأولى» — في شاشتَي المدرّب (٤ أكتوبر ٢٠٢٦، ⑫) ═══

   الرقمُ رقمُ الشعبة في دورتها كلِّها، فأوّلُ شعبةٍ لمدرّبٍ جديدٍ في دورةٍ سبقتها
   ثلاثٌ تُسمّى «شعبة ٤» — فيسأل: أين الثلاثُ قبلها؟ وخُيّر صاحبُ المنصّة بين
   أن يبقى الرقمُ وحدَه، أو أن يحلّ محلَّه «شعبتك الأولى» في شاشات المدرّب،
   أو أن يُقالا معا — فاختار أن يُقالا معا («Both»): الاسمُ كما هو، فيتكلّم
   المدرّبُ والإدارةُ والمتعلّمون باسمٍ واحد، ومعه في لوح «شعبي» ورأسِ صفحة
   الشعبة ترتيبُها بين شعب مدرّبها في دورتها.

   · **والترتيبُ بتاريخ الإنشاء** — به يُعطى الرقمُ نفسُه، والملغاةُ تُعَدّ كما
     تُعَدّ هناك؛ والمعرّفُ يفصل شعبتين أُنشئتا في لحظةٍ واحدة.
   · **ويُقال حين يخالف الرقمَ وحدَه**: «شعبة ١ · شعبتك الأولى» تكرارٌ لا جواب،
     واسمٌ سمّته الإدارةُ بغير رقمٍ لا يُسأل فيه عن ثلاثٍ قبله. */

const ORDINAL_FEM_AR = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة']

/** ترتيبُ كلّ شعبةٍ بين شعب مدرّبٍ واحدٍ في دورتها — ١ لأقدمها */
export function trainerOrdinals(cohorts: readonly { id: string; courseId: string; createdAt: Date | string }[]): Map<string, number> {
  const byCourse = new Map<string, Map<string, number>>()
  for (const c of cohorts) {
    const list = byCourse.get(c.courseId) ?? new Map<string, number>()
    list.set(c.id, new Date(c.createdAt).getTime())
    byCourse.set(c.courseId, list)
  }
  const out = new Map<string, number>()
  for (const list of byCourse.values()) {
    ;[...list].sort(([a, ta], [b, tb]) => ta - tb || a.localeCompare(b)).forEach(([id], i) => out.set(id, i + 1))
  }
  return out
}

/** «شعبتك الأولى» بجانب الاسم — أو `null` حين لا يخالف الرقمَ أو لا رقمَ في الاسم */
export function trainerOrdinalNoteAr(title: string, ordinal: number | null | undefined): string | null {
  if (!ordinal || ordinal < 1) return null
  const n = cohortNumberOf(title)
  if (n === null || n === ordinal) return null
  return `شعبتك ${ORDINAL_FEM_AR[ordinal] ?? `رقم ${toArabicDigits(ordinal)}`}`
}
