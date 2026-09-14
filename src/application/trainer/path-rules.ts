/* قواعدُ مسارِ المدرّب — قسمةٌ واحدةٌ يقرؤها الخادمُ والشاشة (ن-١ … ن-٨).

   ═══ ما هنا وما ليس هنا ═══

   هنا ما لا يحتاج قاعدةً: متى يُعدَّل، ومتى يصلح للإرسال، وما يُقال لصاحبه
   حين لا يصلح. وليس هنا شيءٌ عن السعر — **ولا عمودَ سعرٍ في المخطّط أصلا**
   (ن-٦): «السعرُ والسعةُ بيد الإدارة» مكتوبةٌ في وجه المدرّب في ورشة شعبته،
   ومسارٌ عامٌّ يسعّر نفسَه يسلّم سلطةَ التسعير لمن يجمع حزمة. والمساراتُ
   المنسَّقةُ نفسُها لا تحمل سعرا — الأسعارُ من الشعب المفتوحة — فهذا يتبعها.

   ═══ ولمَ القائمةُ أسبابٌ لا `boolean` ═══

   «لا يصلح للإرسال» بلا سببٍ يترك صاحبَه يجرّب حتّى يصيب. والأسبابُ تُعرض
   له قبل أن يضغط، فيعرف ما ينقص وهو يبني لا بعد أن يُردّ. */

/** ما يملك صاحبُه تعديلَه وحذفَه — والمردودُ يُعدَّل ليُعاد */
export const PATH_OPEN = ['draft', 'rejected'] as const
/** ما خرج من يده — عند الإدارة أو على الرفّ أو مسحوبٌ منه */
export const PATH_LOCKED = ['submitted', 'published', 'retired'] as const

export type PathStatus = (typeof PATH_OPEN)[number] | (typeof PATH_LOCKED)[number]

/** حدودُ الاسم — اسمٌ على رفٍّ عامّ، لا سطرٌ في مسوّدة */
export const MIN_PATH_TITLE = 6
export const MAX_PATH_TITLE = 120
export const MAX_PATH_BLURB = 600

/** أقلُّ ما يُسمّى مسارا — دورةٌ واحدةٌ ليست مسارا بل دورة */
export const MIN_PATH_COURSES = 2
/** وأكثرُ ما يُحتمل قراءتُه في بطاقة */
export const MAX_PATH_COURSES = 8

export function canTrainerEdit(status: string): boolean {
  return (PATH_OPEN as readonly string[]).includes(status)
}

export interface PathDraftLike {
  titleAr: string
  courseIds: readonly string[]
  termId: string | null
  /** الدوراتُ التي أُهِّل لها — ما خرج عنها ليس «من دوراته» (ن-١) */
  qualifiedCourseIds: readonly string[]
  /** هل اعتُمد نشرُ اسمه للعامّة؟ (ن-٢) */
  trainerPubliclyVisible: boolean
}

/* ما يمنع الإرسالَ، بعبارةٍ يقرؤها صاحبُه.

   وترتيبُها ترتيبُ ما يُصلَح أوّلا: الاسمُ ثمّ الدوراتُ ثمّ الموسمُ ثمّ
   البوّابةُ التي ليست بيده. */
export function pathBlockersAr(d: PathDraftLike): string[] {
  const out: string[] = []
  const title = d.titleAr.trim()
  if (title.length < MIN_PATH_TITLE) out.push(`اسمُ المسار ${MIN_PATH_TITLE} أحرفٍ فأكثر`)
  if (title.length > MAX_PATH_TITLE) out.push(`اسمُ المسار ${MAX_PATH_TITLE} حرفا على الأكثر`)

  const unique = new Set(d.courseIds)
  if (unique.size < MIN_PATH_COURSES) out.push(`المسارُ ${MIN_PATH_COURSES} دورتَين فأكثر`)
  if (unique.size > MAX_PATH_COURSES) out.push(`المسارُ ${MAX_PATH_COURSES} دوراتٍ على الأكثر`)

  /* ن-١: «من دوراته». وما لم يُؤهَّل له ليس منها — ولا يُرسَل ليُردّ، بل
     يُقال له قبل الإرسال. */
  const qualified = new Set(d.qualifiedCourseIds)
  const stray = [...unique].filter((c) => !qualified.has(c))
  if (stray.length > 0) out.push(`لستَ مؤهَّلا لـ: ${stray.join(' · ')}`)

  /* ن-٣: موسمٌ من التقويم لا نصّ — والبطاقةُ تقول متى يُفتح التسجيلُ صدقا */
  if (!d.termId) out.push('اختر الموسمَ الذي يعمل فيه المسار')

  /* ن-٢ — وهذه ليست بيده، فتُقال بوصفها حالا لا خطأ */
  if (!d.trainerPubliclyVisible) {
    out.push('لم يُعتمد ظهورُ اسمك للعامّة بعد — والمسارُ يحمل اسمَك، فلا يُنشر قبله')
  }
  return out
}

/** يصلح للإرسال؟ — نفسُ القسمة، بلا تكرارِ شرطٍ في موضعَين */
export function canSubmitPath(d: PathDraftLike): boolean {
  return pathBlockersAr(d).length === 0
}
