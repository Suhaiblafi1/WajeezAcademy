/* دوراتُ صفحة كلّ منحة — القاعدةُ الواحدةُ لما تعرضه صفحتُها وصفحةُ المؤثّر (١٥ نوفمبر ٢٠٢٦).

   ═══ قراراتُ صاحب المنصّة ═══

   ١) **يختار المديرُ دوراتِ كلّ حملة** (المنحُ الثلاث)، فلا تعرض صفحتُها إلّا هي. وشروطُ العرض باقيةٌ فوقها (دورةٌ منشورة،
      ومدرّبٌ منشور، وشعبةٌ تُشترى): مختارةٌ بلا شعبةٍ لا تظهر.
   ٢) **والقائمةُ للصفحة وحدَها** — قرارُه: «Discount all courses». فالكودُ يخصم على أيّ دورةٍ في السلّة حتى حدّ دوراته
      (`coursesLeft`)، كما كان قبل الاختيار. فلا شيءَ هنا يمسّ الدفع.
   ٣) **والافتراضيُّ تلقائيّ**: حملةٌ بلا اختيار (قائمةٌ فارغة) تعرض كلَّ دورةٍ بالشروط. ومن اختار لا تظهر له دورةٌ جديدةٌ
      وحدَها: يضيفها هو.
   ٤) **والمؤثّرُ بعضُ قائمة حملته**: بلا اختيارٍ قائمةُ «منحة مؤثرين وجيز» كلُّها، وباختيارٍ ما يقع منه فيها وحدَه
      (التقاطع) — فإن أسقطت الحملةُ دورةً سقطت منه، ولا يزيد على قائمتها. **وإن لم يبقَ له منها شيءٌ فقائمةُ الحملة كلُّها**
      — قرارُه: «Full grant list»، لا صفحةٌ فارغة. ومنها صفحتُه `/grant/i/<كوده>` ومادّةُ تصاميمه.

   ═══ والتمثيل ═══

   «النطاق» (`CourseScope`) مجموعةُ معرّفات دورات، أو `null` = بلا حدّ (تلقائيّ). والقائمةُ المحفوظةُ الفارغةُ تُقرأ `null`.

   والخادمُ يقرأ هنا وحدَه: `server/services/grant-scope.service.ts` يحمّل الصفوف ويناديها، وصفحةُ المنحة وصفحةُ المؤثّر
   ومادّةُ تصاميمه وتذكيرُ البريد منه. والحارس: `server/tests/commerce/grant-course-choice.test.ts`. */

/** دوراتُ صفحةٍ بعينها — أو `null`: بلا حدّ */
export type CourseScope = ReadonlySet<string> | null

/** قائمةٌ محفوظة → نطاق: الفارغةُ تلقائيّة */
export function scopeOfIds(ids: readonly string[] | null | undefined): CourseScope {
  return ids && ids.length > 0 ? new Set(ids) : null
}

/** دوراتُ صفحة حملةٍ ومؤثّرها: ما يقع من قائمته في قائمة الحملة — وإن لم يقع منها شيءٌ فقائمةُ الحملة كلُّها */
export function liveGrantScope(campaignCourseIds: readonly string[], influencerCourseIds?: readonly string[] | null): CourseScope {
  const campaign = scopeOfIds(campaignCourseIds)
  const own = scopeOfIds(influencerCourseIds)
  if (own === null) return campaign
  if (campaign === null) return own
  const both = new Set([...own].filter((id) => campaign.has(id)))
  return both.size > 0 ? both : campaign
}
