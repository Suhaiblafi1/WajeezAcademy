/* مسار يبدأ بدورة واحدة — تسعيره واقتراح ما يليه.

   لماذا وُجد: زر «سجّل في الدورة» في نافذة تفاصيل الدورة كان ينقل المتعلم إلى
   صفحة المسار كاملا. فمن أراد دورة واحدة وجد نفسه أمام ستّ دورات وسعرِ مسار،
   ومن أراد أن يبني تركيبته الخاصة لم يجد بابا. والكتالوج فيه مئة دورة ومنتجٌ
   واحد يُشترى: المسار.

   والقاعدة السعرية هنا مأخوذة كما نطقها المالك: ما دام مجموع الدورات المختارة
   منفردةً أقلَّ من سعر المسار، فسعرها هو المعروض ولا يُذكر سعر المسار أصلا —
   إظهاره حينها ليس عرضا بل تشويش. فإذا بلغ المجموع سعر المسار أو تجاوزه صار
   سعر المسار هو المعروض، لأنه صار أوفر فعلا. وقبل ذلك بخطوة واحدة يُقال له
   صراحة: دورة أخرى وتصير في السعر الأوفر.

   منطق خالص بلا React ليُختبر وحده. */

import { courseById, coursePriceOf, pathwayPriceFor, pathwayCourses, courses, type Course } from '../../data/courses'

/** الحد الأدنى لعدد الدورات الذي تبدأ عنده تسعيرة المسار */
export const BUNDLE_MIN_COURSES = 4

export interface PathPricing {
  count: number
  /** مجموع أسعار الدورات المختارة منفردة */
  separate: number
  /** سعر حزمة بهذا العدد — لا يُعرض إلا حين يصير أوفر */
  bundle: number
  /** هل بلغ المجموع سعر الحزمة أو تجاوزه؟ حينها الحزمة هي السعر */
  useBundle: boolean
  /** ما يدفعه فعلا */
  payable: number
  /** نسبة التوفير حين تُعرض الحزمة */
  savingPct: number
}

export function pathPricing(courseIds: readonly string[]): PathPricing {
  const picked = courseIds.map((id) => courseById(id)).filter((c): c is Course => Boolean(c))
  const separate = picked.reduce((s, c) => s + coursePriceOf(c), 0)
  const count = picked.length
  const bundle = pathwayPriceFor(count)
  /* الحزمة لا تُطبَّق تحت حدّها الأدنى مهما بلغ المجموع: «مسار» من دورتين ليس
     مسارا، وتسعيره كذلك يبيع اسما لا محتوى. */
  const useBundle = count >= BUNDLE_MIN_COURSES && separate >= bundle
  return {
    count,
    separate,
    bundle,
    useBundle,
    payable: useBundle ? bundle : separate,
    savingPct: useBundle && separate > bundle ? Math.round((1 - bundle / separate) * 100) : 0,
  }
}

export interface BundleNudge {
  /** العدد بعد الإضافة */
  nextCount: number
  /** ما سيدفعه بعد الإضافة (سعر الحزمة) */
  nextPayable: number
  /** ما كان سيدفعه لو اشترى الدورات الـ nextCount منفردة */
  nextSeparate: number
  /** الفرق لصالحه */
  saves: number
}

/**
 * هل إضافة دورة واحدة تنقله إلى سعر الحزمة الأوفر؟
 * يُحسب بأرخص مرشح متاح لا بأغلاه: الوعد يجب أن يصدق على ما سيختاره فعلا.
 * يعود null إذا كان في الحزمة أصلا، أو إذا كانت الإضافة لا تبلغ بها.
 */
export function bundleNudge(courseIds: readonly string[], candidateIds: readonly string[]): BundleNudge | null {
  const now = pathPricing(courseIds)
  if (now.useBundle) return null
  const prices = candidateIds
    .map((id) => courseById(id))
    .filter((c): c is Course => Boolean(c))
    .map((c) => coursePriceOf(c))
  if (prices.length === 0) return null
  const cheapest = Math.min(...prices)
  const nextCount = now.count + 1
  if (nextCount < BUNDLE_MIN_COURSES) return null
  const nextSeparate = now.separate + cheapest
  const nextBundle = pathwayPriceFor(nextCount)
  if (nextSeparate < nextBundle) return null
  return { nextCount, nextPayable: nextBundle, nextSeparate, saves: nextSeparate - nextBundle }
}

export interface CourseSuggestion {
  courseId: string
  /** سبب الاقتراح بلغة المتعلم — لا وسم تسويقي */
  reason_ar: string
  /** رتبة المجموعة: كلما صغرت تقدّمت */
  rank: number
}

/**
 * ما الذي يُقترح بعد ما اختاره — مرتّبا بسبب لا بعشوائية:
 * ١) بقية دورات مسار الدورة الأولى بترتيبها المصمَّم — أقربها إلى ما بدأ به.
 * ٢) دورات تشترك معه في مهارة — تبني على ما بدأه لا تكرره.
 * ٣) دورات مساراتٍ أخرى من المجال نفسه.
 * ما اختِير أصلا لا يُقترح، والترتيب داخل كل مجموعة بتسلسل المقرر في مساره.
 */
export function suggestNext(courseIds: readonly string[], limit = 8): CourseSuggestion[] {
  const chosen = new Set(courseIds)
  const anchor = courseById(courseIds[0] ?? '')
  if (!anchor) return []
  const chosenCourses = courseIds.map((id) => courseById(id)).filter((c): c is Course => Boolean(c))
  const chosenSkills = new Set(chosenCourses.map((c) => c.skill).filter(Boolean))
  const chosenPathways = new Set(chosenCourses.map((c) => c.pathwayId))

  const out: CourseSuggestion[] = []
  const seen = new Set<string>()
  const push = (id: string, reason_ar: string, rank: number) => {
    if (chosen.has(id) || seen.has(id)) return
    if (!courseById(id)) return
    seen.add(id)
    out.push({ courseId: id, reason_ar, rank })
  }

  /* ١) بقية مسار الدورة الأولى — بترتيب المسار المصمَّم */
  for (const id of pathwayCourses[anchor.pathwayId] ?? []) {
    push(id, `تكمل مسار «${anchor.pathwayName}» الذي بدأت منه — بترتيبه المصمَّم`, 1)
  }

  /* ٢) مشتركة في مهارة مع ما اخترته.
     `courses` مصفوفة حية تُملأ في مكانها عند تثبيت اللقطة (splice لا إسناد)،
     فقراءتها هنا وقت النداء تعطي الكتالوج الحالي لا لقطة فارغة وقت التحميل. */
  for (const c of courses) {
    if (chosenSkills.has(c.skill)) push(c.id, `تبني على «${c.skill}» التي بدأتها`, 2)
  }

  /* ٣) مسارات أخرى تلامس ما اخترته — بذكر مسارها بلا ادّعاء تطابق */
  for (const c of courses) {
    if (!chosenPathways.has(c.pathwayId)) push(c.id, `من مسار «${c.pathwayName}» — يوسّع خطتك خارج مجالك الأول`, 3)
  }

  return out.sort((a, b) => a.rank - b.rank).slice(0, limit)
}
