/* بابُ الإنجليزيّة — غرضٌ ومستوى يحسمان الدورة، لا سباقُ مسارات.

   ── لماذا خارج المنافسة ──

   كانت دوراتُ الإنجليزيّة تنافس بمجال «التواصل والتأثير»، فلا يصلها إلّا من
   سأل عن التواصل — ولا سؤالَ في التشخيص يقول «أريد الإنجليزيّة». ثمّ إنّ ما
   يحسمها ليس ملاءمةً تُوزن بل **قاعدةٌ** قرّرها صاحبُ المنصّة (٨ أكتوبر ٢٠٢٦)
   سؤالا سؤالا:

     · يُسأل المتعلّمُ عن غرضه (حديثٌ يوميّ · عمل · اختبار) ثمّ عن مستواه
       بأوصافٍ يتعرّف فيها على نفسه، ووراءها سلّمُ CEFR من A1 إلى C1.
     · ويُقال له إنّ اختبارَ تحديد مستوى مجانيّا يؤكّده — فما يصفه نقطةُ
       بدايةٍ لا حكم.
     · المبتدئُ الذي غرضُه العملُ أو الاختبار يُعرض عليه **الخياران معا**:
       المستوى العامّ أوّلا ثمّ دورةُ غرضه، أو دورةُ غرضه مباشرةً — بما يختلف
       فيه كلٌّ منهما، ويختار هو. («Show both, learner picks»)
     · والمتقدّمُ فوق دوراتنا العامّة لا تُعرض عليه دورةٌ دون مستواه: يُقال له
       ذلك صراحةً، ويُعرض ما يضيف إليه — الإنجليزيّةُ للأعمال، أو IELTS في
       مستواه الثاني إن أراد شهادة. («Redirect to goal course»)

   فالجدولُ هنا هو القرار، مكتوبا حيث يُقرأ.

   ── والجمهورُ لا يحجب هنا ──

   جمهورُ الدورات المعلَن (`diagnostic_stages`) قرارُ صاحب المنصّة لمن **يرشّحه
   السباق** — حتّى لا تُعرض الإنجليزيّةُ على مديرٍ سأل عن التواصل. أمّا من سمّى
   الإنجليزيّةَ بنفسه فقد أجاب عن السؤال الذي وُضع الجمهورُ ليخمّنه، ومستواه في
   اللغة لا تقوله مرحلتُه المهنيّة. */

/** الدوراتُ الخمس — معرّفاتُها في الكتالوج */
export const ENGLISH_COURSES = {
  general1: 'C-COMX-111',
  general2: 'C-COMX-112',
  business: 'C-COMX-106',
  exam1: 'C-COMX-113',
  exam2: 'C-COMX-114',
} as const

export type EnglishPurpose = 'general' | 'work' | 'exam'
export type EnglishLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1'

export const ENGLISH_PURPOSES: { code: EnglishPurpose; label_ar: string }[] = [
  { code: 'general', label_ar: 'المحادثة والتواصل اليوميّ' },
  { code: 'work', label_ar: 'العمل — الاجتماعات والبريد المهنيّ' },
  { code: 'exam', label_ar: 'اختبار IELTS أو TOEFL' },
]

/** أوصافٌ يتعرّف فيها المتعلّمُ على نفسه — وCEFR وراءها لا أمامها */
export const ENGLISH_LEVELS: { code: EnglishLevel; cefr: string; label_ar: string }[] = [
  { code: 'a1', cefr: 'A1', label_ar: 'أعرف كلماتٍ وجملا قليلة' },
  { code: 'a2', cefr: 'A2', label_ar: 'أتدبّر حديثا يوميّا بسيطا' },
  { code: 'b1', cefr: 'B1', label_ar: 'أفهم الاجتماعات والنصوص، وأتعثّر حين أتكلّم أو أكتب' },
  { code: 'b2', cefr: 'B2', label_ar: 'أتكلّم وأكتب براحةٍ في أغلب المواقف' },
  { code: 'c1', cefr: 'C1', label_ar: 'أتكلّم وأكتب بطلاقةٍ قريبةٍ من أهل اللغة' },
]

export const PLACEMENT_TEST_NOTE_AR =
  'ما وصفتَه نقطةُ بداية: سنعطيك اختبارَ تحديد مستوى مجانيّا يحسم مستواك، وتنتقل بعده إلى الدورة التي تناسبه.'

export interface EnglishOption {
  /** الدوراتُ بترتيب أخذها */
  course_ids: string[]
  title_ar: string
  /** بماذا يختلف هذا الخيارُ عن غيره — يُقرأ قبل الاختيار */
  difference_ar: string
  /** الأنسبُ لمستواك كما وصفتَه — يُعلَّم ولا يُفرَض */
  suggested: boolean
}

export interface EnglishPlan {
  purpose: EnglishPurpose
  level: EnglishLevel
  cefr: string
  /** مستواك فوق دوراتنا العامّة — يُقال صراحةً */
  above_general: boolean
  headline_ar: string
  options: EnglishOption[]
  placement_note_ar: string
}

const c = ENGLISH_COURSES

/** الخطّةُ من الغرض والمستوى — حتميّةٌ تماما: نفسُ الجوابين ← نفسُ الخيارات */
export function englishPlanOf(purpose: EnglishPurpose, level: EnglishLevel): EnglishPlan {
  const cefr = ENGLISH_LEVELS.find((l) => l.code === level)?.cefr ?? 'A1'
  const plan = (headline_ar: string, options: EnglishOption[], above_general = false): EnglishPlan => ({
    purpose,
    level,
    cefr,
    above_general,
    headline_ar,
    options,
    placement_note_ar: PLACEMENT_TEST_NOTE_AR,
  })
  const one = (course: string, title_ar: string, difference_ar: string): EnglishOption => ({
    course_ids: [course],
    title_ar,
    difference_ar,
    suggested: true,
  })

  if (purpose === 'general') {
    if (level === 'a1') {
      return plan('تبدأ من أوّل الطريق — والمستوى الأوّل مبنيٌّ لهذه البداية.', [
        one(c.general1, 'الإنجليزيّة العامّة — المستوى الأوّل', 'من الجملة المحفوظة إلى حديثٍ يوميٍّ يُفهَم.'),
      ])
    }
    if (level === 'a2' || level === 'b1') {
      return plan('تملك الأساس — والمستوى الثاني يبني عليه.', [
        one(c.general2, 'الإنجليزيّة العامّة — المستوى الثاني', 'من الموقف المألوف إلى رأيٍ تشرحه وتدافع عنه.'),
      ])
    }
    return plan(
      'مستواك فوق دوراتنا العامّة — فلا نعرض عليك ما دونه، بل ما يضيف إليه.',
      [
        { ...one(c.business, 'الإنجليزيّة للأعمال', 'تصقل مستواك في الاجتماعات والبريد المهنيّ.'), suggested: true },
        { ...one(c.exam2, 'IELTS وTOEFL — المستوى الثاني', 'إن أردت شهادةً تُثبت مستواك: الكتابةُ والمحادثةُ بمعايير الدرجات العليا.'), suggested: false },
      ],
      true,
    )
  }

  if (purpose === 'work') {
    if (level === 'a1') {
      return plan('الإنجليزيّةُ للأعمال تفترض حديثا يوميّا — فلك طريقان، والفرقُ بينهما أدناه.', [
        {
          course_ids: [c.general1, c.business],
          title_ar: 'المستوى الأوّل ثمّ الإنجليزيّة للأعمال',
          difference_ar: 'دورتان: الأولى توصلك إلى الحديث اليوميّ الذي تفترضه الثانية، فتدخلها جاهزا.',
          suggested: true,
        },
        {
          course_ids: [c.business],
          title_ar: 'الإنجليزيّة للأعمال مباشرةً',
          difference_ar: 'دورةٌ واحدة وكلفةٌ أقلّ — لكنّها تفترض حديثا يوميّا قد لا تملكه بعد.',
          suggested: false,
        },
      ])
    }
    return plan('غرضُك العمل — والإنجليزيّةُ للأعمال مبنيّةٌ له.', [
      one(c.business, 'الإنجليزيّة للأعمال', 'المشاركةُ في الاجتماع وكتابةُ البريد المهنيّ.'),
    ])
  }

  /* purpose === 'exam' */
  if (level === 'a1' || level === 'a2') {
    const bridge = level === 'a1' ? c.general1 : c.general2
    const bridgeName = level === 'a1' ? 'المستوى الأوّل' : 'المستوى الثاني'
    return plan('اختبارُ IELTS يفترض أساسا في اللغة — فلك طريقان، والفرقُ بينهما أدناه.', [
      {
        course_ids: [bridge, c.exam1],
        title_ar: `${bridgeName} ثمّ التحضير لـIELTS وTOEFL`,
        difference_ar: 'دورتان: الأولى تبني الأساسَ الذي يفترضه الاختبار، فتدخل التحضيرَ جاهزا.',
        suggested: true,
      },
      {
        course_ids: [c.exam1],
        title_ar: 'التحضير لـIELTS وTOEFL مباشرةً',
        difference_ar: 'دورةٌ واحدة وكلفةٌ أقلّ — لكنّها تفترض أساسا قد لا تملكه بعد.',
        suggested: false,
      },
    ])
  }
  if (level === 'b1') {
    return plan('أساسُك يكفي للتحضير — والمستوى الأوّل يبدأ بفهم الاختبار ومهاراته الأربع.', [
      one(c.exam1, 'التحضير لـIELTS وTOEFL — المستوى الأوّل', 'فهمُ الاختبار وبناءُ مهاراته الأربع.'),
    ])
  }
  return plan('مستواك يتّجه إلى الدرجات العليا — والمستوى الثاني مبنيٌّ لها.', [
    one(c.exam2, 'التحضير لـIELTS وTOEFL — المستوى الثاني', 'الكتابةُ والمحادثةُ بمعايير الدرجات العليا.'),
  ])
}

/** الدورةُ التي تقصدها الخطّة — آخرُ دورةٍ في الخيار المقترَح.

    «المستوى الأوّل ثمّ الإنجليزيّة للأعمال» وجهتُه الإنجليزيّةُ للأعمال، والأوّلُ
    طريقٌ إليها. فالتوصيةُ تُسمّى بوجهتها لا بأوّل خطوة: وإلّا قُرئ المبتدئُ الذي
    يريد العملَ والمبتدئُ الذي يريد الاختبارَ واحدا — «المستوى الأوّل» لكليهما —
    وصار سؤالُ الغرض لا يغيّر شيئا ممّا يُسمّى (أمسكته بوّابةُ هدر الأسئلة). */
export function englishDestinationOf(plan: EnglishPlan): string {
  const chosen = plan.options.find((o) => o.suggested) ?? plan.options[0]
  return chosen.course_ids[chosen.course_ids.length - 1]
}

/** هل يكفي الجوابان لخطّة؟ — والقيمتان من الحقائق كما هي */
export function englishPlanFromFacts(facts: Record<string, { value: unknown } | undefined>): EnglishPlan | null {
  if (facts['need_id']?.value !== 'need_english') return null
  const purpose = facts['english_purpose']?.value
  const level = facts['english_level']?.value
  if (!ENGLISH_PURPOSES.some((p) => p.code === purpose)) return null
  if (!ENGLISH_LEVELS.some((l) => l.code === level)) return null
  return englishPlanOf(purpose as EnglishPurpose, level as EnglishLevel)
}
