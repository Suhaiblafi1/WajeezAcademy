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
