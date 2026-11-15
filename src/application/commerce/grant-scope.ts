/* دوراتُ كلّ منحة — القاعدةُ الواحدةُ لما تعرضه صفحتُها وما يخصم عليه كودُها (١٥ نوفمبر ٢٠٢٦).

   ═══ قراراتُ صاحب المنصّة ═══

   ١) **يختار المديرُ دوراتِ كلّ حملة** (المنحُ الثلاث). والاختيارُ يحدّ الأمرين معا: ما تعرضه صفحتُها، وما يخصم عليه
      كودُها عند الدفع — وما سواها في السلّة نفسِها يُدفع بسعره كاملا، بلا خطأ. وشروطُ العرض باقيةٌ فوقه (دورةٌ منشورة،
      ومدرّبٌ منشور، وشعبةٌ تُشترى): مختارةٌ بلا شعبةٍ لا تظهر.
   ٢) **والافتراضيُّ تلقائيّ**: حملةٌ بلا اختيار (قائمةٌ فارغة) كما كانت — تُعرض كلُّ دورةٍ بالشروط، ويخصم الكودُ على
      أيّ دورة. ومن اختار لا تظهر له دورةٌ جديدةٌ وحدَها: يضيفها هو.
   ٣) **والمؤثّرُ بعضُ قائمة حملته**: بلا اختيارٍ قائمةُ «منحة مؤثرين وجيز» كلُّها، وباختيارٍ ما يقع منه فيها وحدَه
      (التقاطع) — فإن أسقطت الحملةُ دورةً سقطت منه، ولا يزيد على قائمتها أبدا. ومنها صفحتُه `/grant/i/<كوده>`
      وأكوادُ من جاء بكوده.
   ٤) **والكودُ الذي دُفع به مرّةً يثبت** على ما كان له يومَ أوّلِ شراءٍ مدفوع (وإن كان تلقائيّا فتلقائيّا)، والذي لم
      يُدفع به شيءٌ يتبع القائمةَ كما هي اليوم. وما اشتُري قبلُ لا يُمسّ.

   ═══ والتمثيل ═══

   «النطاق» (`CourseScope`) مجموعةُ معرّفات دورات، أو `null` = بلا حدّ (تلقائيّ). والقائمةُ المحفوظةُ الفارغةُ تُقرأ
   `null` — فلا تُحفظ «لا دورة» في حملةٍ أو مؤثّر. وأمّا التقاطعُ فقد يكون مجموعةً فارغة: مؤثّرٌ أسقطت حملتُه دوراتِه
   كلَّها لا يُعرض له شيء، ولا يرجع إلى القائمة كلِّها من نفسه.

   والخادمُ يقرأ هنا وحدَه: `server/services/grant-scope.service.ts` يحمّل الصفوف ويناديها، وصفحةُ المنحة وصفحةُ
   المؤثّر والدفعُ وتذكيرُ البريد منه. والحارس: `server/tests/commerce/grant-course-choice.test.ts`. */

/** دوراتُ منحةٍ بعينها — أو `null`: بلا حدّ */
export type CourseScope = ReadonlySet<string> | null

/** قائمةٌ محفوظة → نطاق: الفارغةُ تلقائيّة */
export function scopeOfIds(ids: readonly string[] | null | undefined): CourseScope {
  return ids && ids.length > 0 ? new Set(ids) : null
}

/** نطاقٌ داخلَ نطاق — ما يقع من الداخل في الخارج وحدَه. وبلا حدٍّ يأخذ الآخرَ كما هو */
export function narrowScope(outer: CourseScope, inner: CourseScope): CourseScope {
  if (outer === null) return inner
  if (inner === null) return outer
  return new Set([...inner].filter((id) => outer.has(id)))
}

/** أتقع الدورةُ في النطاق؟ */
export const inScope = (scope: CourseScope, courseId: string): boolean => scope === null || scope.has(courseId)

/** ما يُحتاج من صفوف الكود وحملته ومؤثّره لمعرفة دوراته */
export interface GrantScopeRows {
  campaignCourseIds: readonly string[]
  /** دوراتُ مؤثّر الكود — وبلا مؤثّرٍ لا شيء */
  influencerCourseIds?: readonly string[] | null
  /** لحظةُ أوّلِ شراءٍ دُفع به — وبها تثبت دوراتُه */
  firstPaidAt?: Date | string | null
  allCoursesAtFirstPaid?: boolean
  courseIdsAtFirstPaid?: readonly string[]
}

/** النطاقُ الحيُّ لحملةٍ ومؤثّرها — ما تعرضه صفحتُه وما يخصم عليه كودٌ لم يُدفع به بعد */
export function liveGrantScope(campaignCourseIds: readonly string[], influencerCourseIds?: readonly string[] | null): CourseScope {
  return narrowScope(scopeOfIds(campaignCourseIds), scopeOfIds(influencerCourseIds))
}

/** دوراتُ كودٍ بعينه: الثابتةُ إن دُفع به، وإلّا الحيّة */
export function grantCodeScope(rows: GrantScopeRows): CourseScope {
  if (rows.firstPaidAt) return rows.allCoursesAtFirstPaid ? null : new Set(rows.courseIdsAtFirstPaid ?? [])
  return liveGrantScope(rows.campaignCourseIds, rows.influencerCourseIds)
}

/** ما يُكتب على الكود يومَ يثبت — `all` صادقٌ للتلقائيّ، وإلّا القائمةُ بعينها */
export function frozenScopeData(scope: CourseScope): { allCoursesAtFirstPaid: boolean; courseIdsAtFirstPaid: string[] } {
  return scope === null
    ? { allCoursesAtFirstPaid: true, courseIdsAtFirstPaid: [] }
    : { allCoursesAtFirstPaid: false, courseIdsAtFirstPaid: [...scope].sort() }
}
