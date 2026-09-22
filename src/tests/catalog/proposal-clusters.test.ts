/* تجميعُ اقتراحات المدرّبين — المقيسُ القاعدةُ لا التقرير.

   السؤالُ الذي وُضع له التجميعُ (٢١ سبتمبر ٢٠٢٦): أيُّهما أسهل — دورةٌ دورة،
   أم جمعُها كلَّ فترةٍ في مسارات؟ والجوابُ يُقاس لا يُرأى. وهذا يحرس ما
   يجعل القياسَ صادقا:

   ① **عددُ دورات المسار ليس رقما مختارا** — هو شكلُ الكتالوج القائم، ويُقابَل
      به الكتالوجُ الحيُّ هنا. فمن غيّر الشكلَ يرى الحارسَ أحمرَ بدل أن يمرّ
      عنقودٌ بمقياسٍ عتيق.
   ② **وما لا يُوضَع لا يُبتلَع** — المرشِّحُ نصّيّ، وصمتُه عمّن لا يشبه شيئا
      يجعل التقريرَ يقول «كلُّ شيءٍ في مجاله» وفيه ما لا مجالَ له.
   ③ **وأربعةٌ بلا جمهورٍ واحدٍ ليست مسارا** — هي «الجوكر» الذي يحذّر منه
      `PathwayWizard`: كيانٌ يُحفَظ ولا يُرشَّح لأحد.
   ④ **ومجالٌ لا يصله هدفٌ يُقال ولو بلغ العددُ** — وإلّا وُلد المسارُ ميّتا
      كما وُلد اثنا عشرَ قبلَه (`CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md`). */

import { describe, expect, it } from 'vitest'
import {
  PATH_COURSE_COUNT, buildCourseIndex, clusterHeadlineAr, clusterProposals, reachableDomains,
  type UniverseEntity,
} from '@/application/catalog/proposal-clusters'
import { recommendationUniverse } from '@/domain/diagnostic/v2_1/universe'
import type { MatchableCourse } from '@/application/trainer/proposal-match'

/* ─────────── كتالوجٌ مصغَّرٌ وفضاءٌ مصغَّر ───────────

   مصنوعان بقصد: القواعدُ تُقاس على حالاتٍ مرسومةٍ لا على الكتالوج الحيّ —
   وإلّا صار الحارسُ يحمرّ كلَّما أُضيفت دورة. والحيُّ يُقابَل به الثابتُ
   وحدَه (①) وتُجرَّب عليه الحلقةُ كاملةً في آخر الملفّ. */
const COURSES: MatchableCourse[] = [
  { id: 'C-A1', titleAr: 'تحليل البيانات للقرار', extraAr: ['جداول', 'مؤشرات'] },
  { id: 'C-A2', titleAr: 'لوحات المؤشرات التنفيذية', extraAr: ['عرض', 'قياس'] },
  { id: 'C-B1', titleAr: 'الخطابة أمام لجنة', extraAr: ['إلقاء'] },
]

const entity = (over: Partial<UniverseEntity> = {}): UniverseEntity => ({
  entity_id: 'PW-X', entity_type: 'standard', domains: ['data_decision'],
  career_stages: ['early_career'], required_courses: ['C-A1'],
  reachable_goals: ['need_data'], status: 'approved_active', ...over,
})

const proposal = (id: string, titleAr: string) => ({ id, titleAr })

describe('① عددُ دورات المسار يُقابَل بالكتالوج الحيّ لا يُكتب رقما', () => {
  it('كلُّ مسارٍ قياسيٍّ في الكتالوج يحمل العددَ نفسَه الذي يقيس به التجميع', () => {
    const std = recommendationUniverse().entities.filter((e) => e.entity_type === 'standard')
    expect(std.length, 'لا مسارَ قياسيٌّ في الفضاء — أتغيّر النوع؟').toBeGreaterThan(10)
    const counts = [...new Set(std.map((e) => e.required_courses.length))]
    expect(counts, `مساراتُ الكتالوج لم تعد بعددٍ واحد: ${counts.join('، ')}`).toEqual([PATH_COURSE_COUNT])
  })
})

describe('الفهرسُ يجمع ما ترثه الدورةُ من كيانَيها', () => {
  it('دورةٌ في كيانين ترث مجالَيهما وجمهورَيهما — لا يُختار أحدُهما بترتيب حلقة', () => {
    const index = buildCourseIndex([
      entity({ entity_id: 'PW-1', domains: ['data_decision'], career_stages: ['early_career'] }),
      entity({ entity_id: 'PW-2', domains: ['finance_mgmt'], career_stages: ['manager'] }),
    ])
    const a = index.get('C-A1')
    expect(a?.domains).toEqual(['data_decision', 'finance_mgmt'])
    expect(a?.stages).toEqual(['early_career', 'manager'])
    expect(a?.entityIds).toEqual(['PW-1', 'PW-2'])
  })

  /* ─────────── والقالبُ المركّبُ لا يعرّف مقرَّ الدورة ───────────

     قياسُ الفضاء الحيّ (٢٢ سبتمبر ٢٠٢٦): بالقوالب تبلغ الدورةُ ثمانيةَ مجالات؛
     وبالمسارات وحدَها تنفرد ستٌّ وتسعون من مئةٍ وأربعٍ بمجالٍ واحد. فلو دخل
     القالبُ الفهرسَ لَوقع الاقتراحُ الواحدُ في ثمانية عناقيد، وقيل «تتجمّع»
     وما تجمّع شيء. وهذا يُمسك ذلك الانتفاخ عند بابه. */
  it('والقالبُ المركّبُ لا يورّث الدورةَ مجالَه — المسارُ القياسيُّ وحدَه يعرّف المقرّ', () => {
    const index = buildCourseIndex([
      entity({ entity_id: 'PW-1', domains: ['data_decision'], career_stages: ['early_career'] }),
      entity({
        entity_id: 'CT-1', entity_type: 'composite', domains: ['sales', 'marketing_growth'],
        career_stages: ['founder'], required_courses: ['C-A1'],
      }),
    ])
    const a = index.get('C-A1')
    expect(a?.domains, 'ورثت الدورةُ مجالَ قالبٍ مركّب').toEqual(['data_decision'])
    expect(a?.stages, 'ورثت جمهورَ قالبٍ مركّب').toEqual(['early_career'])
    expect(a?.entityIds).toEqual(['PW-1'])
  })

  it('ودورةٌ لا يضمّها إلّا قالبٌ مركّبٌ لا مقرَّ لها — ولا تُختلَق لها واحدٌ', () => {
    const index = buildCourseIndex([
      entity({ entity_id: 'CT-1', entity_type: 'composite', required_courses: ['C-A2'] }),
    ])
    expect(index.has('C-A2'), 'قالبٌ وحدَه صنع مقرّا').toBe(false)
  })

  it('والمجالاتُ التي يصلها هدفٌ لا تشمل كيانا موقوفا ولا كيانا بلا هدفٍ قابلٍ للوصول', () => {
    const live = reachableDomains([
      entity({ domains: ['data_decision'] }),
      entity({ entity_id: 'PW-DEAD', domains: ['operations'], reachable_goals: [] }),
      entity({ entity_id: 'PW-OFF', domains: ['sales'], status: 'needs_academic_review' }),
    ])
    expect(live.has('data_decision')).toBe(true)
    expect(live.has('operations'), 'مجالٌ بلا هدفٍ قابلٍ للوصول عُدّ حيّا').toBe(false)
    expect(live.has('sales'), 'كيانٌ غيرُ نشطٍ رفع مجالَه').toBe(false)
  })

  /* والفرقُ بين الدالّتين مقصودٌ يُحرَس: القالبُ لا يعرّف مقرّا ويَصِل */
  it('لكنّ القالبَ النشطَ **يرفع** مجالَه في الوصول — فمجالٌ يُرشَّح ليس مهجورا', () => {
    const live = reachableDomains([
      entity({ entity_id: 'CT-1', entity_type: 'composite', domains: ['sales'] }),
    ])
    expect(live.has('sales'), 'قالبٌ نشطٌ يُرشَّح وقيل عن مجاله مهجور').toBe(true)
  })
})

describe('③ أربعةٌ بجمهورٍ واحدٍ مرشَّحُ مسار — وبلا جمهورٍ ليست مسارا', () => {
  const four = [
    proposal('1', 'تحليل البيانات للمبيعات'),
    proposal('2', 'تحليل البيانات المالية'),
    proposal('3', 'تحليل البيانات للتسويق'),
    proposal('4', 'تحليل البيانات للموارد'),
  ]

  it('أربعةٌ في مجالٍ واحدٍ بجمهورٍ واحدٍ تُرشَّح مسارا', () => {
    const r = clusterProposals(four, COURSES, [entity()])
    expect(r.unanchored, 'سقط اقتراحٌ بلا مرساة').toHaveLength(0)
    const c = r.clusters.find((x) => x.domain === 'data_decision')!
    expect(c.proposals).toHaveLength(PATH_COURSE_COUNT)
    expect(c.commonStages).toEqual(['early_career'])
    expect(c.verdict).toBe('path_candidate')
  })

  /* و«الجوكر»: العددُ يكفي والجمهورُ يفترق — فالمسارُ لا يُرشَّح لأحد.

     والحيلةُ أن يرسوَ الخامسُ على دورةٍ في المجال نفسِه جمهورُها لا يلتقي
     جمهورَ الأربعة: فيسقط التقاطعُ إلى لا شيء، والعددُ باقٍ فوق الحدّ. */
  it('وأربعةٌ بلا جمهورٍ مشترَكٍ تُقسَم بالجمهور ولا تُرشَّح مسارا', () => {
    const r = clusterProposals(
      [...four, proposal('5', 'تحليل البيانات للقادة')],
      [...COURSES, { id: 'C-A9', titleAr: 'تحليل البيانات للقادة', extraAr: [] }],
      [
        entity({ entity_id: 'PW-1', required_courses: ['C-A1'], career_stages: ['early_career'] }),
        entity({ entity_id: 'PW-2', required_courses: ['C-A9'], career_stages: ['manager'] }),
      ],
    )
    const c = r.clusters.find((x) => x.domain === 'data_decision')!
    expect(c.proposals.length).toBeGreaterThanOrEqual(PATH_COURSE_COUNT)
    expect(c.commonStages, 'جمهورٌ مشترَكٌ حيث لا يلتقيان').toHaveLength(0)
    expect(c.verdict).toBe('split_by_audience')
  })

  it('وما دون الأربعة دورةٌ قائمةٌ بنفسها لا مسار', () => {
    const r = clusterProposals(four.slice(0, 2), COURSES, [entity()])
    const c = r.clusters.find((x) => x.domain === 'data_decision')!
    expect(c.verdict).toBe('standalone')
    expect(c.verdictAr, 'لا يُحيل إلى البابِ الأقرب').toMatch(/تُرشَّح وحدَها/)
  })
})

describe('④ ومجالٌ لا يصله هدفٌ يُقال ولو بلغ العدد', () => {
  it('المرشَّحُ يبقى مرشَّحا، ونصُّه يقول إنّ بنكَ الأسئلة أوّلا', () => {
    const four = ['1', '2', '3', '4'].map((i) => proposal(i, `تحليل البيانات ${i}`))
    const r = clusterProposals(four, COURSES, [entity({ reachable_goals: [] })])
    const c = r.clusters.find((x) => x.domain === 'data_decision')!
    expect(c.verdict).toBe('path_candidate')
    expect(c.domainReachable, 'مجالٌ بلا هدفٍ قُرئ حيّا').toBe(false)
    expect(c.verdictAr, 'لا يُنبَّه إلى الدَّين القائم').toMatch(/لا يصله هدف/)
  })
})

describe('② وما لا يُوضَع يُقال ولا يُبتلَع', () => {
  it('اقتراحٌ لا تشترك كلمةٌ من عنوانه مع الكتالوج يخرج بلا مرساة', () => {
    const r = clusterProposals(
      [proposal('1', 'تربية الأبناء في سنّ المراهقة'), proposal('2', 'تحليل البيانات للمبيعات')],
      COURSES,
      [entity()],
    )
    expect(r.unanchored.map((p) => p.id), 'ابتُلع ما لا مرساةَ له').toEqual(['1'])
    expect(r.totalProposals, 'المجموعُ لا يعدّ ما خرج بلا مرساة').toBe(2)
    expect(r.clusters.flatMap((c) => c.proposals).map((p) => p.id)).toEqual(['2'])
  })

  it('ولا يُوضَع في مجالٍ ما رسا على دورةٍ خارج كلّ كيان', () => {
    /* دورةٌ في الكتالوج لا يضمّها كيانٌ أصلا: لا مرساةَ في الفهرس */
    const r = clusterProposals([proposal('1', 'الخطابة أمام لجنة')], COURSES, [entity()])
    expect(r.unanchored.map((p) => p.id), 'رسا على دورةٍ خارج الفضاء فدخل عنقودا').toEqual(['1'])
  })

  /* ─────────── والبابُ الثاني للابتلاع، وهو الأخفى ───────────

     دورةٌ **داخلَ** كيانٍ لا مجالَ له: المرساةُ تُوجَد في الفهرس، ويمرّ
     الاقتراحُ من شرط `!anchor` سالما — ثمّ لا يدخل عنقودا لأنّ حلقةَ
     `for (const d of a.domains)` لا تدور على شيء. فيسقط من العنقودِ
     والمعلَّقِ معا: لا يُعدّ ولا يُقال، وهو الابتلاعُ بعينِه.

     وكيانٌ بلا مجالٍ ليس في الفضاء اليوم — الاثنان والأربعون كلُّها بمجال.
     فالشرطُ احتياطٌ، وهذا يثبت أنّه احتياطٌ يعمل لا سطرٌ ميّت. */
  it('ولا يُبتلَع ما رسا على دورةٍ داخل كيانٍ بلا مجال', () => {
    const r = clusterProposals(
      [proposal('1', 'تحليل البيانات للمبيعات')],
      COURSES,
      [entity({ entity_id: 'PW-NODOMAIN', domains: [], required_courses: ['C-A1'] })],
    )
    expect(r.clusters.flatMap((c) => c.proposals), 'دخل عنقودا بلا مجال').toHaveLength(0)
    expect(r.unanchored.map((p) => p.id), 'سقط من العنقودِ والمعلَّقِ معا — ابتُلع').toEqual(['1'])
  })
})

describe('والخلاصةُ تقول ما يُقرَّر منه', () => {
  it('بلا عنقودٍ يبلغ مسارا تقول إنّ التجميعَ لا يدفع ثمنَه اليوم', () => {
    const r = clusterProposals([proposal('1', 'تحليل البيانات للمبيعات')], COURSES, [entity()])
    expect(clusterHeadlineAr(r)).toMatch(/لا عنقودَ يبلغ مسارا/)
  })

  it('وبلا اقتراحاتٍ تقول ذلك ولا تعدّ صفرا في جملةٍ طويلة', () => {
    expect(clusterHeadlineAr(clusterProposals([], COURSES, [entity()]))).toMatch(/لا اقتراحَ مفتوحا/)
  })
})

/* ─────────── والحلقةُ كاملةً على الكتالوج الحيّ ───────────

   ما سبق يقيس القواعدَ على حالاتٍ مرسومة. وهذا يُجري التجميعَ على **فضاء
   التوصيات الحقيقيّ** باقتراحاتٍ مصنوعة: فلو انفصل الفضاءُ عن شكل القاعدة
   (اسمُ حقلٍ تغيّر، أو صار `required_courses` فارغا) لَخرج التقريرُ فارغا
   في التشغيل الحيّ ولا يحمرّ شيءٌ ممّا فوق. */
describe('والتجميعُ يعمل على فضاء التوصيات الحيّ لا على المصنوع وحدَه', () => {
  it('اقتراحٌ باسم دورةٍ حقيقيّةٍ يرسو في مجالها ويحمل سببَ رسوّه', () => {
    const u = recommendationUniverse()
    const entities = u.entities as unknown as UniverseEntity[]
    const anchorEntity = entities.find((e) => e.domains.length > 0 && e.required_courses.length > 0)!
    const courseId = anchorEntity.required_courses[0]

    /* والكتالوجُ هنا رمزٌ واحدٌ بعنوانٍ نعرفه — فالاختبارُ لا يقرأ قاعدة */
    const courses: MatchableCourse[] = [{ id: courseId, titleAr: 'الخطابة والعرض التنفيذي', extraAr: [] }]
    const r = clusterProposals([proposal('1', 'الخطابة أمام الإدارة التنفيذية')], courses, entities)

    expect(r.unanchored, 'لم يرسُ على رمزٍ حقيقيٍّ من الفضاء').toHaveLength(0)
    const c = r.clusters[0]
    expect(c.domain, 'رسا بلا مجال').toBeTruthy()
    expect(anchorEntity.domains).toContain(c.domain)
    expect(c.proposals[0].sharedAr.length, 'رُشّح بلا سببٍ يُقرأ').toBeGreaterThan(0)
  })
})
