/* مسار يبدأ بدورة واحدة — تسعيره واقتراح ما يليه.

   لماذا وُجد: زر «سجّل في الدورة» في نافذة تفاصيل الدورة كان ينقل المتعلم إلى
   صفحة المسار كاملا. فمن أراد دورة واحدة وجد نفسه أمام ستّ دورات وسعرِ مسار،
   ومن أراد أن يبني تركيبته الخاصة لم يجد بابا. والكتالوج فيه مئة دورة ومنتجٌ
   واحد يُشترى: المسار.

   والقاعدة السعرية تراكمية: مجموع أسعار الدورات المختارة ظاهرٌ كما هو، ثم
   خصمٌ يرتفع كلما أضاف دورة (سلّم معلن في discount-policy.ts)، ثم كودٌ واحد
   فوقه إن كان معه كود. فيرى المتعلم في كل خطوة ثلاثة أرقام: ما قبل الخصم،
   وكم وفّر، وكم يدفع — لا رقما واحدا يقفز بلا تفسير.

   وكانت القاعدة قبل ذلك «سعر مسار مقطوع عند أربع دورات»، وفيها عيبان: قفزةٌ
   لا يرى المتعلم سببها، وصمتٌ تام عن الخصم قبل الدورة الرابعة — فمن اختار
   دورتين لم يكن يكسب شيئا بالاختيار.

   والسقف خمس دورات: ما زاد يُحفظ «للمرحلة التالية». الستة للمسارات الجاهزة
   المصمَّمة، والبناء الحر ليس نسخةً منها بلا تصميم.

   منطق خالص بلا React ليُختبر وحده. */

import { courseById, coursePriceOf, pathwayCourses, courses, type Course } from '../../data/courses'
import { MAX_BUILT_COURSES, buildDiscountPct, nextBuildStep, readyPathwayCeiling } from '../commerce/discount-policy'

export { MAX_BUILT_COURSES }

export interface PathPricing {
  count: number
  /** مجموع أسعار الدورات المختارة منفردة — قبل أي خصم */
  separate: number
  /** نسبة الخصم الفعلية على سلّته هو — مشتقّة مما يدفع، لا معلنة قبله */
  discountPct: number
  /** قيمة ما وفّره بالخصم */
  saving: number
  /** ما يدفعه فعلا قبل أي كود */
  payable: number
  /** هل حدّ المسار الجاهز هو الذي قرّر السعر (لا السلّم)؟ */
  cappedByReady: boolean
  /** بلغ السقف فلا تُضاف دورة سادسة */
  atCap: boolean
}

/** ما يدفعه على عدد ومجموع — السلّم مع سقف المسار الجاهز فوقه */
function payableFor(separate: number, count: number): number {
  const laddered = Math.round(separate * (1 - buildDiscountPct(count) / 100))
  /* السقف: من ركّب أربع دورات بنفسه لا يجوز أن يدفع أكثر ممن اشترى مسارا
     جاهزا بأربع. السلّم وحده لا يضمنها — قِيس على أغلى خمس دورات في الكتالوج
     فأعطى 566 مقابل 550. فالضمان بنيويّ لا بمعايرة نسبةٍ تنكسر مع أول تسعيرة
     جديدة. وما دون الحدّ الأدنى للمسار الجاهز لا سقف له: لا مسار بثلاث. */
  const ceiling = count >= MIN_READY_COURSES ? readyPathwayCeiling(count) : Infinity
  return Math.min(laddered, ceiling)
}

/** الحدّ الذي يبدأ عنده وجود مسار جاهز بهذا العدد — ودونه لا سقف يُقارن به */
const MIN_READY_COURSES = 4

export function pathPricing(courseIds: readonly string[]): PathPricing {
  const picked = courseIds.map((id) => courseById(id)).filter((c): c is Course => Boolean(c))
  const separate = picked.reduce((s, c) => s + coursePriceOf(c), 0)
  const count = picked.length
  /* التقريب على المدفوع لا على الخصم: الفاتورة تُصدر بالمدفوع، فتقريبُ الخصم
     ثم الطرح يُخرج قرشا لا يظهر في أي شاشة ويظهر في الفاتورة. */
  const payable = payableFor(separate, count)
  /* النسبة تُشتقّ مما يدفع لا من السلّم: حين يحسم السقف، النسبة الفعلية أعلى
     من المعلنة — وعرضُ الأدنى كذبٌ في صالحنا، وهو كذب. */
  const discountPct = separate > 0 ? Math.round((1 - payable / separate) * 100) : 0
  return {
    count,
    separate,
    discountPct,
    saving: separate - payable,
    payable,
    cappedByReady: count >= MIN_READY_COURSES && payable < Math.round(separate * (1 - buildDiscountPct(count) / 100)),
    atCap: count >= MAX_BUILT_COURSES,
  }
}

export interface BundleNudge {
  /** العدد بعد الإضافة */
  nextCount: number
  /** نسبة الخصم التي يبلغها */
  nextPct: number
  /** ما سيدفعه بعد الإضافة */
  nextPayable: number
  /** مجموع الأسعار المفردة عند ذلك العدد */
  nextSeparate: number
  /** الكلفة الحقيقية للدورة الإضافية: الفرق بين ما يدفعه الآن وما سيدفعه */
  marginal: number
  /** سعرها المعلن — والفرق بينه وبين marginal هو ما تكسبه الإضافة */
  listPrice: number
}

/**
 * ماذا تكسبه دورة واحدة أخرى؟ يُحسب بأرخص مرشح متاح لا بأغلاه: الوعد يجب أن
 * يصدق على ما سيختاره فعلا. ولا يُعرض إلا حين ترفع الإضافةُ نسبةَ الخصم
 * فعلا، وحين تكون كلفتها الحقيقية دون سعرها المعلن.
 * يعود null عند السقف، أو حين لا مرشح، أو حين لا مكسب يُقال.
 */
export function bundleNudge(courseIds: readonly string[], candidateIds: readonly string[]): BundleNudge | null {
  const now = pathPricing(courseIds)
  const step = nextBuildStep(now.count)
  if (!step) return null
  const cheapest = candidateIds
    .map((id) => courseById(id))
    .filter((c): c is Course => Boolean(c))
    .reduce<Course | null>((best, c) => (!best || coursePriceOf(c) < coursePriceOf(best) ? c : best), null)
  if (!cheapest) return null
  const listPrice = coursePriceOf(cheapest)
  const nextSeparate = now.separate + listPrice
  const nextPayable = payableFor(nextSeparate, step.count)
  const marginal = nextPayable - now.payable
  if (marginal >= listPrice) return null
  return { nextCount: step.count, nextPct: step.pct, nextPayable, nextSeparate, marginal, listPrice }
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
