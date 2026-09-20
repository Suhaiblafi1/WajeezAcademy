/* دورةٌ قائمةٌ بنفسها — تدخل فضاءَ التوصية بمهاراتها، ولا تُزاحم مسارا.

   ═══ العطبُ الذي وُلدت منه ═══

   كان فضاءُ التوصية نوعَين: مسارٌ قياسيٌّ وقالبٌ مركّب — وكلاهما يُبنى من
   قائمةِ دوراتٍ معلومة. فدورةٌ لا مسارَ لها ولا قالبَ **لا وجودَ لها عند
   المحرّك**: `skillsOfCourses` لا تمرّ بها، فلا تدخل مهاراتُها مهاراتِ أيّ
   كيان، فلا تُقاس ولا تُرشَّح ولا تُرى — وهي في الكتالوج منشورةٌ يقرؤها
   الناس. ومعها كان إنشاءُ الدورة نفسُه يشترط مسارا، فمن أراد دورةً قائمةً
   بنفسها اخترع لها مسارا أو ألحقها بمسارٍ لا تنتمي إليه.

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): «إن أردتُ أن أضيفها دورةً جديدةً،
   فلِمَ أضيفها إلى مسار؟ ينبغي أن تُحتسب دورةً جديدةً في نتيجة التشخيص
   بمهاراتها. ولا حاجةَ لأن تُعرض مسارَ تعلّمٍ إلّا أن يصنع المدرّبُ مسارَه».

   ═══ والقاعدةُ التي تحكمها ═══

   **لا تُزاحم مسارا، وإنّما تقف حيث كان يُقال «لا شيءَ لك»**. وأكثرُ ما هنا
   فحصٌ لهذا الحدّ من طرفَيه: أنّها تدخل الفضاءَ فعلا، وأنّها لا تغلب مسارا
   مؤهَّلا أبدا.

   ═══ ولمَ تُثبَّت لقطةٌ بدل تزييف الفضاء ═══

   الفضاءُ يُبنى من الكتالوج الحيّ ويُبطَل مع كلّ تثبيت (`onCatalogInstalled`).
   فالطريقُ الصادقُ إلى دورةٍ مأذونٍ لها هو الطريقُ الذي تسلكه في الإنتاج:
   لقطةٌ تحمل الرمزَ والمجال. وتُعاد اللقطةُ الأصليّةُ بعد كلّ حالةٍ كي لا
   تتسرّب دورةٌ مخترَعةٌ إلى جولةٍ أخرى. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import questionsJson from '@/data/catalog/questions.v1.ar.json'
import skillsJson from '@/data/catalog/skills.slim.v1.json'
import coreCatalogJson from '@/data/catalog/core-catalog.slim.v2.json'
import templatesJson from '@/data/catalog/composite-templates.v1.json'
import optionEffectsJson from '@/data/overlays/option-effects.v2.json'
import pathwayProfilesJson from '@/data/overlays/pathway-profiles.v1.json'
import { installCatalogSnapshot, catalogCourses } from '@/domain/diagnostic/catalog'
import { recommendationUniverse, standaloneCourses } from '@/domain/diagnostic/v2_1/universe'
import type { Answer, CatalogCourse } from '@/domain/diagnostic/types'
import { createEngineV21 } from '@/domain/diagnostic/v2_1'

/* eslint-disable @typescript-eslint/no-explicit-any */
const basePayload = () => ({
  questions: questionsJson as any,
  skills: skillsJson as any,
  coreCatalog: JSON.parse(JSON.stringify(coreCatalogJson)) as any,
  templates: templatesJson as any,
  optionEffects: optionEffectsJson as any,
  pathwayProfiles: pathwayProfilesJson as any,
})

/** جمهورُها المُعلَن — والصمتُ عنه يُخرجها من المنافسة (`assessEntityEligibility`) */
const STAGES = ['early_career', 'experienced']

/** دورةٌ مخترَعةٌ لهذه الجولة — بلا مسارٍ، كما تخرج من باني اللقطة */
const SOLO: CatalogCourse = {
  course_id: 'C-SOLO-901',
  pathway_id: '',
  sequence: 1,
  title_ar: 'دورةٌ قائمةٌ بنفسها للاختبار',
  total_hours: 8,
  skill_slugs: [],
  skill_ids: [],
  skill_names_ar: [],
}

/** يُثبّت لقطةً فيها دورةٌ واحدةٌ بلا مسار، بخصائصَ تُعدَّل لكلّ حالة */
function installWithSolo(patch: Partial<CatalogCourse>) {
  const payload = basePayload()
  /* ومهاراتُها من دورةٍ قائمةٍ في الكتالوج — فالمهارةُ المخترَعةُ لا تُعرف
     في قاموس المهارات، ولا تُقاس، فيصير الفحصُ على وهم. */
  const donor = (payload.coreCatalog.courses as CatalogCourse[]).find((c) => c.skill_slugs.length > 0)!
  payload.coreCatalog.courses = [
    ...(payload.coreCatalog.courses as CatalogCourse[]),
    { ...SOLO, skill_slugs: donor.skill_slugs, skill_ids: donor.skill_ids, skill_names_ar: donor.skill_names_ar, ...patch },
  ]
  installCatalogSnapshot(payload as any, 'test-solo')
}

const restore = () => installCatalogSnapshot(basePayload() as any, 'test-restore')

beforeEach(restore)
afterEach(restore)

describe('الفضاءُ لا يتغيّر حتّى يُؤذَن لدورة', () => {
  it('ولا دورةَ مأذونٌ لها في الكتالوج المضمَّن — فالميزةُ خاملةٌ حتّى تُشعَل', () => {
    expect(standaloneCourses()).toEqual([])
    expect(recommendationUniverse().entities.some((e) => e.entity_type === 'course')).toBe(false)
  })

  it('والرمزُ وحدَه لا يكفي — بلا مجالٍ لا يصلها هدفٌ ولا احتياج', () => {
    installWithSolo({ recommendable_directly: true, diagnostic_domains: [], diagnostic_stages: STAGES })
    expect(standaloneCourses(), 'دخلت الفضاءَ بلا مجالٍ فوقفت فيه لا تفوز أبدا').toEqual([])
  })

  it('والمجالُ وحدَه لا يكفي — رمزٌ مطفأٌ يبقى مطفأ', () => {
    installWithSolo({ recommendable_directly: false, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES })
    expect(standaloneCourses()).toEqual([])
  })

  /* ═══ والصمتُ عن الجمهور يُخرجها لا يُدخلها ═══

     كُتب كيانُ الدورة أوّلا بجمهورٍ فارغٍ بحجّة أنّ «الدورةَ الواحدةَ لا
     تُصمَّم لمرحلة». فدخلت الفضاءَ **ولم تنافس مرّةً واحدة**: قاعدةُ
     `assessEntityEligibility` تُسقط كلَّ كيانٍ لم يُعلَن جمهورُه. وميزةٌ
     تدخل ولا تنافس أسوأُ من ميزةٍ لا تدخل: تُقرأ في الشاشة «تُرشَّح» وهي
     لا تُرشَّح. */
  it('ولا تدخل بلا جمهورٍ مُعلَن — وإلّا دخلت الفضاءَ ولم تنافس مرّةً', () => {
    installWithSolo({ recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: [] })
    expect(standaloneCourses()).toEqual([])
  })

  it('ولا تدخل بلا مهارة — تنافس بمهاراتها، وبلا مهارةٍ لا شيءَ يُقاس', () => {
    installWithSolo({ recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES, skill_slugs: [], skill_ids: [], skill_names_ar: [] })
    expect(standaloneCourses()).toEqual([])
  })
})

describe('وبالرمز والمجال تصير كيانا يُقرأ', () => {
  beforeEach(() => {
    installWithSolo({ recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES })
  })

  it('تدخل الفضاءَ كيانا من نوع «دورة»', () => {
    const ent = recommendationUniverse().byId.get('C-SOLO-901')
    expect(ent, 'أُذن لها ولم تدخل الفضاء').toBeTruthy()
    expect(ent!.entity_type).toBe('course')
    expect(ent!.status).toBe('approved_active')
  })

  it('ومهاراتُها مهاراتُها — لا مهاراتِ مسارٍ لا تنتمي إليه', () => {
    const ent = recommendationUniverse().byId.get('C-SOLO-901')!
    const solo = catalogCourses.find((c) => c.course_id === 'C-SOLO-901')!
    expect(ent.skill_slugs).toEqual([...new Set(solo.skill_slugs)].sort())
    expect(ent.skill_slugs.length).toBeGreaterThan(0)
  })

  it('ومقرّراتُها هي نفسُها — فساعاتُها تُقرأ ولا تُحسب صفرا', () => {
    const ent = recommendationUniverse().byId.get('C-SOLO-901')!
    expect(ent.required_courses).toEqual(['C-SOLO-901'])
    expect(ent.estimated_hours).toBe(8)
  })

  it('ولا مسارَ تمثّله — والحقلُ يبقى صادقا لا يُملأ باسمٍ مخترَع', () => {
    expect(recommendationUniverse().byId.get('C-SOLO-901')!.pathway_requirements).toEqual([])
  })

  /* ═══ وهذا هو الحدُّ الذي يحمي المنتَج ═══

     المسارُ تحوّلٌ مصمَّمٌ لإنسانٍ بعينه — جمهورٌ وهدفٌ ومدّةٌ ومشروعٌ ختاميّ.
     والدورةُ الواحدةُ ليست تحوّلا. فلو غلبت مسارا مؤهَّلا لبِعنا للمتعلّم
     أقلَّ ممّا يحتاج. */
  it('⚠️ ولا جمهورَ لها ولا هدفٌ مصمَّم — فلا تنافس على ما لا تملكه', () => {
    const ent = recommendationUniverse().byId.get('C-SOLO-901')!
    expect(ent.goals, 'اختُرع لها هدفٌ لم يكتبه أحد').toEqual([])
    /* والجمهورُ ما أُعلن لا «الكلّ» — والصمتُ عنه يُخرجها لا يفتح لها كلَّ باب */
    expect(ent.career_stages).toEqual([...STAGES].sort())
    /* وإشارتُها الموجبةُ واحدةٌ: مجالُها. */
    expect(ent.positive_signals).toHaveLength(1)
    expect(ent.positive_signals[0].fact_key).toBe('need_domains')
  })

  it('ولا يُزاد عددُ المسارات ولا القوالب بدخولها', () => {
    const countBy = (type: string) =>
      recommendationUniverse().entities.filter((e) => e.entity_type === type).length
    restore()
    const standardsBefore = countBy('standard')
    const compositesBefore = countBy('composite')

    installWithSolo({ recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES })
    expect(countBy('standard'), 'تغيّر عددُ المسارات بدخول دورة').toBe(standardsBefore)
    expect(countBy('composite'), 'تغيّر عددُ القوالب بدخول دورة').toBe(compositesBefore)
    expect(countBy('course')).toBe(1)
  })
})

/* ═══════════ وأثرُها في نتيجةٍ حقيقيّة ═══════════

   ما سبق يفحص بناءَ الكيان. وهذا يفحص **ما يراه المتعلّم** — وهو موضعُ
   الخطر: دورةٌ واحدةٌ تغلب مسارا مصمَّما تبيع للمتعلّم أقلَّ ممّا يحتاج. */

function runJourney(sessionId: string, script: Record<string, string>) {
  const e = createEngineV21(sessionId)
  for (let i = 0; i < 30; i += 1) {
    const n = e.nextQuestion()
    if (!n.question) break
    const q = n.question
    const want = script[q.question_id]
    let v: Answer['value']
    if (want !== undefined) {
      const k = q.options_ar.indexOf(want)
      expect(k, `«${want}» ليس خيارا في ${q.question_id}`).toBeGreaterThanOrEqual(0)
      v = q.options_ar[k]
    } else v = q.options_ar.length ? q.options_ar[0] : 'لا ينطبق'
    e.answer({ questionId: q.question_id, value: v })
  }
  return e.recommend() as unknown as {
    kind: string
    primaryPathway: { pathwayId: string } | null
  }
}

/** متعلّمٌ حاجتُه التسويقُ والنموّ — وهو مجالُ دورتنا القائمةِ بنفسها */
const MARKETER = {
  'QC-S1-001': 'موظف في بداية مساري المهني',
  'QC-N3-001': 'التسويق والنمو',
}

describe('⚠️ ولا تُزاحم مسارا — هذا هو الحدُّ الذي يحمي المنتَج', () => {
  it('الفائزُ لا يتغيّر بدخولها — ولو كانت في صميم حاجته', () => {
    restore()
    const before = runJourney('solo-none', MARKETER)
    /* ونقطةُ البداية تُثبَّت لا تُفترض: مسارا كانت أو قالبا، المهمّ أنّها
       **ليست دورةً** — وإلّا فالفحصُ لا يقيس ما يدّعيه. */
    expect(before.kind).not.toBe('single_course')
    expect(before.primaryPathway?.pathwayId, 'لا فائزَ قبلُ — لا شيءَ يُزاح').toBeTruthy()

    installWithSolo({ recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES })
    const after = runJourney('solo-added', MARKETER)
    expect(after.kind, 'أزاحت دورةٌ واحدةٌ كيانا مصمَّما').toBe(before.kind)
    expect(after.primaryPathway?.pathwayId, 'تغيّر الفائزُ بدخول دورةٍ قائمةٍ بنفسها')
      .toBe(before.primaryPathway?.pathwayId)
  })

  /* ═══ وتقف حيث كان يُقال «لا شيءَ لك» ═══

     وهذا هو ما طُلب إصلاحُه: كان المحرّكُ يُعلن فجوةَ كتالوجٍ ويُحيل إلى
     مستشار بينما في الكتالوج دورةٌ منشورةٌ تناسب — لا يراها لأنّها بلا مسار.

     ومسارٌ بلا دوراتٍ يُدقَّق `needs_revision` فلا ينافس (`auditStandard`)،
     فهذه لقطةٌ لا مسارَ مؤهَّلا فيها ولا قالب. */
  it('وتقف وحدَها حين لا مسارَ مؤهَّلا — بدل «إحالةٍ إلى مستشار» ودورتُها عندنا', () => {
    const payload = basePayload()
    const donor = (payload.coreCatalog.courses as CatalogCourse[]).find((c) => c.skill_slugs.length > 0)!
    /* تُفرَّغ المسارات من دوراتها فتسقط في التدقيق، وتُرفع القوالب */
    payload.coreCatalog.launch_pathways = (payload.coreCatalog.launch_pathways as { course_ids: string[] }[])
      .map((p) => ({ ...p, course_ids: [] }))
    payload.templates = { templates: [] } as any
    payload.coreCatalog.courses = [
      ...(payload.coreCatalog.courses as CatalogCourse[]),
      {
        ...SOLO,
        skill_slugs: donor.skill_slugs, skill_ids: donor.skill_ids, skill_names_ar: donor.skill_names_ar,
        recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES,
      },
    ]
    installCatalogSnapshot(payload as any, 'test-solo-only')

    const u = recommendationUniverse()
    expect(u.active.filter((e) => e.entity_type === 'standard'), 'بقي مسارٌ مؤهَّلٌ — الفحصُ لا يقيس ما يدّعيه').toEqual([])

    const rec = runJourney('solo-alone', MARKETER)
    expect(rec.kind, 'لم تقف الدورةُ حيث لا مسار — وعاد المتعلّمُ بلا شيء').toBe('single_course')
    expect(rec.primaryPathway?.pathwayId).toBe('C-SOLO-901')
  })
})

/* ═══════════ ومقرّراتُ الكيان تُقرأ من الكيان لا من عمود المسار ═══════════

   عطبٌ كُشف أثناء هذا العمل، وهو **قائمٌ منذ دخلت القوالبُ المركّبة**:
   `meanCourseLevel` و`totalHoursOf` و`familiesToRate` كنّ يقرأن
   `catalogCourses.filter((c) => c.pathway_id === id)`. وهي صحيحةٌ للمسار
   القياسيِّ وحدَه — **والقالبُ المركّبُ ليس مسارا**، فلا دورةَ في الكتالوج
   تحمل معرِّفَه، فتعود القائمةُ فارغةً دائما.

   وأثرُه يصل المتعلّم: `contrastOf` تبني على الساعات نصّا يقرؤه. فمركّبٌ من
   ستّ دوراتٍ واثنتين وخمسين ساعةً تُحسب ساعاتُه صفرا، فيخرج له «أقصر —
   ساعات أقل إن كان وقتك أضيق». أي أنّ السطرَ يكذب، ولا يسقط شيءٌ فيُكتشف.

   وهذا الحارسُ يُثبت السببَ نفسَه لا العرَض: للقالب مقرّراتٌ، ولا واحدةَ
   منها تحمل معرِّفَه في `pathway_id`. فمن عاد يقرؤها بعمود المسار عاد إلى
   الصفر. */
describe('⚠️ القالبُ المركّبُ ليس مسارا — ومقرّراتُه لا تُلتمَس بعمود المسار', () => {
  it('له مقرّراتٌ معلومة، ولا دورةَ في الكتالوج تحمل معرِّفَه', () => {
    restore()
    const composites = recommendationUniverse().entities.filter((e) => e.entity_type === 'composite')
    expect(composites.length, 'لا قوالبَ في الكتالوج — الفحصُ لا يقيس شيئا').toBeGreaterThan(0)
    for (const c of composites) {
      expect(c.required_courses.length, `${c.entity_id} بلا مقرّرات`).toBeGreaterThan(0)
      expect(c.estimated_hours, `${c.entity_id} ساعاتُه صفر`).toBeGreaterThan(0)
      const byPathwayColumn = catalogCourses.filter((x) => x.pathway_id === c.entity_id)
      expect(byPathwayColumn, `${c.entity_id} يُلتمَس بعمود المسار — والفحصُ لا يقيس ما يدّعيه`).toEqual([])
    }
  })

  it('وكذلك الدورةُ القائمةُ بنفسها — مقرّرُها هي، وعمودُ مسارها فارغ', () => {
    installWithSolo({ recommendable_directly: true, diagnostic_domains: ['marketing_growth'], diagnostic_stages: STAGES })
    const ent = recommendationUniverse().byId.get('C-SOLO-901')!
    expect(ent.estimated_hours).toBeGreaterThan(0)
    expect(catalogCourses.filter((x) => x.pathway_id === ent.entity_id)).toEqual([])
  })
})
