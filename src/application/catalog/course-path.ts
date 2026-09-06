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

import { courseById, pathwayCourses, courses, type Course } from '../../data/courses'
import { MAX_BUILT_COURSES, buildDiscountPct, bundlePayable, nextBuildStep } from '../commerce/discount-policy'

/* من أين يأتي سعر الدورة؟ من الشعبة — تُمرَّر الدالة ولا تُستورَد.

   كانت هذه الوحدة تستورد `coursePriceOf` من الكتالوج، وهي تقدّر ١٣٠–١٨٠ دولارا
   بمطابقة كلماتٍ في عنوان الدورة، بينما الفاتورة تُصدر بسعر الشعبة وبعملتها.
   فكان كل رقم تحسبه هذه الوحدة وعدا لا يُطالَب به.

   وحقن الدالة يبقيها منطقا خالصا يُختبر وحده، ويجعل «لا سعر معلوم» حالةً
   صريحة (`null`) لا صفرا يُقرأ مجانا. */
export type PriceOf = (courseId: string) => number | null

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
  /** كم من المختارة لها سعر شعبةٍ معلوم */
  priced: number
  /** أكلُّ المختارة مسعَّرة؟ حين لا — الأرقام أصفار والواجهة لا تعرض رقما */
  allPriced: boolean
  /** بلغ السقف فلا تُضاف دورة سادسة */
  atCap: boolean
}

/** ما يدفعه على عدد ومجموع — السلّمُ ثمّ سقفُ المبلغ، من مصدرهما الواحد.

    وكان السلّمَ وحدَه بلا سقف. ولمّا صار للمسار الجاهز سقفُ مبلغٍ (٦٠٠)
    وبقي البناءُ الحرُّ بلا سقف، انقلب المعنى: خمسُ دوراتٍ غاليةٍ يبنيها
    بنفسه = ٦٣٠، ومسارٌ جاهزٌ بستِّ دوراتٍ = ٦٠٠ — **فمن اشترى أقلَّ دفع
    أكثر**. فالسقفُ على كلّ سلّة بقرار صاحب المنصّة، وموضعُه `bundlePayable`
    فلا يفترق حسابُ الشاشة عن حساب الفاتورة. */
const payableFor = bundlePayable

export function pathPricing(courseIds: readonly string[], priceOf: PriceOf): PathPricing {
  const picked = courseIds.map((id) => courseById(id)).filter((c): c is Course => Boolean(c))
  const count = picked.length
  const each = picked.map((c) => priceOf(c.id))
  const priced = each.filter((p): p is number => p !== null && Number.isFinite(p)).length
  const allPriced = count > 0 && priced === count

  /* لا سعر إلا حين تُعرف أسعار المختارة كلها: مجموعٌ ينقصه سعرُ دورةٍ يُقرأ
     «هذا ثمن الأربع» وهو ثمن ثلاث. والنقص يُقال نصّا لا يُخفى في رقم. */
  if (!allPriced) {
    return { count, separate: 0, discountPct: buildDiscountPct(count), saving: 0, payable: 0, priced, allPriced: false, atCap: count >= MAX_BUILT_COURSES }
  }

  const separate = each.reduce<number>((s, p) => s + (p ?? 0), 0)
  const payable = payableFor(separate, count)
  /* النسبة تُشتقّ مما يدفع لا من السلّم — فلا يفترق المعلن عن المحسوب */
  const discountPct = separate > 0 ? Math.round((1 - payable / separate) * 100) : 0
  return { count, separate, discountPct, saving: separate - payable, payable, priced, allPriced: true, atCap: count >= MAX_BUILT_COURSES }
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
export function bundleNudge(courseIds: readonly string[], candidateIds: readonly string[], priceOf: PriceOf): BundleNudge | null {
  const now = pathPricing(courseIds, priceOf)
  const step = nextBuildStep(now.count)
  /* بلا أسعارٍ كاملة لا وعد رقميّ يُقال — والتنبيه كلُّه أرقام */
  if (!step || !now.allPriced) return null
  const cheapest = candidateIds
    .map((id) => courseById(id))
    .filter((c): c is Course => Boolean(c))
    .map((c) => ({ c, p: priceOf(c.id) }))
    .filter((x): x is { c: Course; p: number } => x.p !== null && Number.isFinite(x.p))
    .reduce<{ c: Course; p: number } | null>((best, x) => (!best || x.p < best.p ? x : best), null)
  if (!cheapest) return null
  const listPrice = cheapest.p
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
