/* اختيارُ دورةٍ من الكتالوج — الترشيحُ وحدَه، بلا شاشة.

   ═══ العطبُ الذي كُتب له (٢٠ سبتمبر ٢٠٢٦) ═══

   شكا صاحبُ المنصّة: «عند اختيار دورةٍ لأربط الاقتراحَ بها تظهر لي قائمةٌ
   هكذا — وهذا شيءٌ متعبٌ وغيرُ منطقيّ، لأنّه لا يمكن أن أختار الدورةَ
   بسهولة. سهّلْ عمليّةَ البحث، إمّا بمرشِّحاتٍ إضافيّةٍ للمجالات ثمّ نختار
   دورة، أو بأيّ طريقةٍ أخرى».

   وكانت القائمةُ ١١٣ دورةً في `<select>` خامّ، في **موضعَين** لا موضع:
   طابورِ الاقتراحات وشاشةِ التجهيز. فمن أراد دورةً بعينها مرّرها بعينه.

   ═══ ولمَ الاثنان معا: بحثٌ ومرشِّح ═══

   لأنّهما لسؤالَين مختلفَين. من يعرف الاسمَ يكتب حرفَين فيصل — والمرشِّحُ
   يُبطئه. ومن لا يعرفه («أيُّ دوراتِ التسويق عندنا؟») لا ينفعه البحثُ
   أصلا، إذ لا يملك ما يكتبه. فاختار صاحبُ المنصّة الاثنين، وهو الصواب.

   ═══ والبحثُ بمُطبِّع العربيّة لا بـ`includes` ═══

   «تمويل» و«تموﻳل»، و«الأتمتة» و«أتمتة»، والهمزةُ على صورها — كلُّها
   يكتبها الناسُ ويقصدون واحدا. و`matchesQuery` هي مُطبِّعُ هذا المستودَع،
   ولها من قبلُ عملٌ في طابور الطلبات. فلا تُكتب مطابقةٌ ثانيةٌ بجانبها. */

import { matchesQuery } from '../text/search-ar'

/** ما يلزم للترشيح — لا صفُّ الدورة كلُّه */
export interface PickableCourse {
  id: string
  title: string
  /** مساراتُها بأسمائها — وهي ما يُفرز به في الغالب */
  pathwayNames?: readonly string[]
  /** ومجالاتُها التشخيصيّة — لدورةٍ قائمةٍ بنفسها لا مسارَ لها */
  diagnosticDomains?: readonly string[]
}

/** بندُ «كلُّ المجالات» — قيمتُه الفراغ، فلا يلتبس باسمِ مجالٍ حقيقيّ */
export const ALL_GROUPS = ''

/**
 * المجالاتُ والمساراتُ التي يُرشَّح بها — مرتَّبةً عربيّا وبلا تكرار.
 *
 * والاثنان في قائمةٍ واحدة: الدورةُ المربوطةُ بمسارٍ تُعرف باسمه، والقائمةُ
 * بنفسها تُعرف بمجالها — ومن يفرز لا يفرّق بينهما، إنّما يسأل «أين هي؟».
 */
export function courseGroups(courses: readonly PickableCourse[]): string[] {
  const seen = new Set<string>()
  for (const c of courses) {
    for (const g of [...(c.pathwayNames ?? []), ...(c.diagnosticDomains ?? [])]) {
      if (g) seen.add(g)
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'ar'))
}

/** أتنتمي الدورةُ إلى هذا المجال أو المسار؟ */
function inGroup(c: PickableCourse, group: string): boolean {
  if (group === ALL_GROUPS) return true
  return (c.pathwayNames ?? []).includes(group) || (c.diagnosticDomains ?? []).includes(group)
}

/**
 * ما يبقى بعد المرشِّح والبحث معا — والترتيبُ كما ورد.
 *
 * والبحثُ على الاسم **وعلى الرمز**: من نسخ `C-MKT-101` من موضعٍ آخر يلصقه
 * ويجد، ولا يُطالَب بأن يترجمه إلى اسمٍ عربيٍّ أوّلا.
 */
export function filterCourses<T extends PickableCourse>(
  courses: readonly T[],
  opts: { group?: string; q?: string },
): T[] {
  const group = opts.group ?? ALL_GROUPS
  const q = (opts.q ?? '').trim()
  return courses.filter((c) => inGroup(c, group) && matchesQuery(q, [c.title, c.id]))
}
