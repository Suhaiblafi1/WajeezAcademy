/* خطّةُ المدرّب تعلو الكتالوج — وثلاثةُ حدودٍ لا تُتجاوز.

   كان المدرّبُ يؤلّف خطّةً كاملةً وتُعتمَد، ولا يقرؤها متعلّمٌ أبدا:
   `plan.content` لا يصل سطحَ متعلّمٍ واحدا، ودرسُه من وحدات الكتالوج.
   وقرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): تعلو خطّتُه الكتالوجَ حيث كتب.

   والحدودُ الثلاثةُ هي ما يسقط بصمتٍ لو أُفلت. */

import { describe, expect, it } from 'vitest'
import {
  overlayModule, overlayModules, planIsVisible, projectPlanForLearner, resourceKind,
  PLAN_VISIBLE_STATUSES, RESOURCE_KINDS,
  type CatalogModuleLike, type LearnerPlanView,
} from '@/application/trainer/plan-overlay'

const catalog: CatalogModuleLike[] = [
  { id: 'C-M1', title: 'وحدةُ الكتالوج الأولى', outcome: 'مخرَجُ الكتالوج', activity: 'نشاطُ الكتالوج', artifact: 'ناتجُ الكتالوج', body: 'متنُ الكتالوج' },
  { id: 'C-M2', title: 'وحدةُ الكتالوج الثانية', outcome: null, activity: null, artifact: null, body: null },
]

const plan = (modules: LearnerPlanView['modules']): LearnerPlanView => ({ modules, resources: [] })

describe('① الاعتمادُ هو البوّابة', () => {
  it('المعتمَدُ والمنشورُ يُقرآن — لا سواهما', () => {
    for (const ok of ['approved', 'published']) expect(planIsVisible(ok), ok).toBe(true)
    /* والمسودّةُ والمردودةُ والمرسَلةُ نقضٌ لحاكميّة الاعتماد لو قُرئت:
       المدرّبُ ينشر على متعلّميه قبل أن يراجعه أحد. */
    for (const no of ['draft', 'submitted', 'changes_requested', 'superseded', '', 'APPROVED']) {
      expect(planIsVisible(no), no).toBe(false)
    }
    expect(planIsVisible(null)).toBe(false)
    expect(planIsVisible(undefined)).toBe(false)
  })

  it('والقائمةُ حالتان لا أكثر — فزيادتُها قرارٌ يُرى لا سهو', () => {
    expect([...PLAN_VISIBLE_STATUSES]).toEqual(['approved', 'published'])
  })
})

describe('② الفارغُ لا يمحو', () => {
  it('حقلٌ كتبه المدرّبُ يعلو، وحقلٌ تركه فارغا يُبقي الكتالوج', () => {
    const out = overlayModules(catalog, plan([
      { moduleId: 'C-M1', titleAr: 'عنوانُ المدرّب', outcomeAr: '', activityAr: null, artifactAr: undefined, bodyAr: 'متنُ المدرّب' },
    ]))
    const m = out[0]
    expect(m.title, 'العنوانُ لم يعلُ').toBe('عنوانُ المدرّب')
    expect(m.body, 'المتنُ لم يعلُ').toBe('متنُ المدرّب')
    /* والثلاثةُ الفارغةُ بقيت كما في الكتالوج — لم تُمحَ */
    expect(m.outcome, 'الفارغُ محا المخرَج').toBe('مخرَجُ الكتالوج')
    expect(m.activity, 'الفارغُ محا النشاط').toBe('نشاطُ الكتالوج')
    expect(m.artifact, 'الفارغُ محا الناتج').toBe('ناتجُ الكتالوج')
  })

  it('والمسافاتُ وحدَها ليست كتابةً — وإلّا محا مسافةٌ متنَ وحدة', () => {
    const out = overlayModules(catalog, plan([{ moduleId: 'C-M1', titleAr: '   ', bodyAr: '\n  \t ' }]))
    expect(out[0].title).toBe('وحدةُ الكتالوج الأولى')
    expect(out[0].body).toBe('متنُ الكتالوج')
  })

  it('ومحورٌ في الخطّة بحقولٍ فارغةٍ لا يُنسَب إلى المدرّب', () => {
    /* «من مدرّبك» على محورٍ لم يكتب فيه شيئا نسبةٌ كاذبة */
    const out = overlayModules(catalog, plan([{ moduleId: 'C-M1', titleAr: '  ' }]))
    expect(out[0].fromTrainer).toBe(false)
  })
})

describe('③ لا يُخفى محورُ كتالوجٍ حذفه المدرّبُ من خطّته', () => {
  it('المحذوفُ يبقى بمتنِ الكتالوج — وإخفاؤه يحبس المائةَ في المائة', () => {
    /* `totalModules` عددُ وحدات الكتالوج (progress.service.ts)، فمحورٌ
       مخفيٌّ يبقى في المقام ولا سبيلَ إلى إتمامه. */
    const out = overlayModules(catalog, plan([{ moduleId: 'C-M1', titleAr: 'عنوانُ المدرّب' }]))
    expect(out.map((m) => m.id), 'المحورُ المحذوفُ اختفى').toEqual(['C-M1', 'C-M2'])
    expect(out[1].title).toBe('وحدةُ الكتالوج الثانية')
  })
})

describe('وما أضافه المدرّبُ يظهر في ذيل القائمة', () => {
  it('محورٌ ليس في الكتالوج يُضاف بترتيب الخطّة، منسوبا إلى مدرّبه', () => {
    const out = overlayModules(catalog, plan([
      { moduleId: 'C-M1', titleAr: 'عنوانُ المدرّب' },
      { moduleId: 'C-T1', titleAr: 'محورُ المدرّب الأوّل', bodyAr: 'متنُه' },
      { moduleId: 'C-T2', titleAr: 'محورُ المدرّب الثاني' },
    ]))
    expect(out.map((m) => m.id)).toEqual(['C-M1', 'C-M2', 'C-T1', 'C-T2'])
    expect(out[2].fromTrainer).toBe(true)
    expect(out[2].body).toBe('متنُه')
  })

  it('وترتيبُ الكتالوج لا يُبعثره ترتيبُ الخطّة', () => {
    const out = overlayModules(catalog, plan([
      { moduleId: 'C-M2', titleAr: 'الثانية بيد المدرّب' },
      { moduleId: 'C-M1', titleAr: 'الأولى بيد المدرّب' },
    ]))
    expect(out.map((m) => m.id)).toEqual(['C-M1', 'C-M2'])
  })
})

describe('وخطّةٌ غائبةٌ تترك الكتالوجَ كما هو', () => {
  it('بلا خطّةٍ — ولا حقلَ ينقص ولا ينسب إلى مدرّب', () => {
    const out = overlayModules(catalog, null)
    expect(out.map((m) => m.title)).toEqual(['وحدةُ الكتالوج الأولى', 'وحدةُ الكتالوج الثانية'])
    expect(out.every((m) => m.fromTrainer === false)).toBe(true)
  })

  it('وبخطّةٍ بلا محاور', () => {
    expect(overlayModules(catalog, plan([]))[0].title).toBe('وحدةُ الكتالوج الأولى')
  })
})

describe('والمحورُ الواحدُ يعلو بالمنطق نفسِه', () => {
  it('`overlayModule` يوافق `overlayModules` — لا نسخةَ ثانيةٍ تفترق', () => {
    const p = plan([{ moduleId: 'C-M1', titleAr: 'عنوانُ المدرّب', bodyAr: 'متنُ المدرّب' }])
    const one = overlayModule(catalog[0], p, 'C-M1')
    const many = overlayModules(catalog, p)[0]
    expect(one).toEqual(many)
  })

  it('ومحورٌ أضافه المدرّبُ يُقرأ ولو لم يكن في الكتالوج أصلا', () => {
    const p = plan([{ moduleId: 'C-T1', titleAr: 'محورُ المدرّب', bodyAr: 'متنُه' }])
    const one = overlayModule(null, p, 'C-T1')
    expect(one?.title).toBe('محورُ المدرّب')
    expect(one?.body).toBe('متنُه')
  })

  it('ومحورٌ لا وجودَ له يعيد لا شيء', () => {
    expect(overlayModule(null, plan([]), 'C-NOPE')).toBeNull()
  })
})

describe('④ ما يخرج إلى المتعلّم يُنتقى بأسمائه لا يُحذف منه', () => {
  const content = {
    kind: 'trainer',
    summaryAr: 'وصفُ الشعبة',
    modules: [{ moduleId: 'C-M1', titleAr: 'عنوان', bodyAr: 'متن' }],
    resources: [{ title: 'مرجع', url: 'https://x.test/a', kind: 'book', noteAr: '  ' }],
    liveNoteAr: 'ملاحظةُ اللقاءات',
    proposals: { courseTitleAr: 'اسمٌ مقترَحٌ لم يُعتمد', pathwayTitleAr: 'مسارٌ مقترَح' },
  }

  it('الاقتراحاتُ لا تخرج — وهي حوارٌ بين المدرّب والإدارة', () => {
    const out = projectPlanForLearner({ status: 'approved', content })
    expect(out).not.toBeNull()
    /* الفحصُ على المفاتيح المسموحة نفسِها: `toEqual` على كائنٍ متوقَّعٍ يمرّ
       لو أُضيف مفتاحٌ ثالثٌ غدا واستُنسخ كاملا. */
    expect(Object.keys(out as object).sort()).toEqual(['modules', 'resources', 'summaryAr'])
    expect(JSON.stringify(out)).not.toContain('مقترَح')
    expect(JSON.stringify(out), 'ملاحظةُ اللقاءات خرجت وهي للمدرّب').not.toContain('ملاحظةُ اللقاءات')
  })

  it('وخطّةٌ لم تُعتمد لا تخرج أصلا', () => {
    for (const st of ['draft', 'submitted', 'changes_requested']) {
      expect(projectPlanForLearner({ status: st, content }), st).toBeNull()
    }
    expect(projectPlanForLearner(null)).toBeNull()
    expect(projectPlanForLearner({ status: 'approved', content: null })).toBeNull()
  })

  it('ومحتوى مشوّهٌ لا يُسقط الصفحة', () => {
    const out = projectPlanForLearner({ status: 'approved', content: { modules: 'لا مصفوفة', resources: 7 } })
    expect(out?.modules).toEqual([])
    expect(out?.resources).toEqual([])
  })
})

describe('ونوعُ المصدر يُقال للمتعلّم', () => {
  it('الأنواعُ المعروفةُ تمرّ كما هي', () => {
    for (const k of RESOURCE_KINDS) expect(resourceKind(k), k).toBe(k)
  })

  it('وما لا يُعرف يصير رابطا — لا يُسقَط ولا يُعرض نوعا مخترعا', () => {
    for (const bad of ['', null, undefined, 'كتابٌ صوتيّ', 'VIDEO', '__proto__']) {
      expect(resourceKind(bad as string), String(bad)).toBe('link')
    }
  })

  it('والمشروعُ يطبّق ذلك على كلّ مصدر', () => {
    const out = projectPlanForLearner({
      status: 'approved',
      content: { modules: [], resources: [{ title: 'أ', url: 'https://x.test', kind: 'nonsense' }] },
    })
    expect(out?.resources[0].kind).toBe('link')
  })
})
