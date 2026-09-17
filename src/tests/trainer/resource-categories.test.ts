/* ═══ المصادرُ ثلاثُ خاناتٍ لا كومةُ صفوفٍ بقائمة أنواع ═══

   قال صاحبُ المنصّة (١٥ سبتمبر ٢٠٢٦): «في صفحة المصادر للشعبة هنا عشوائيّة.
   يجب أن تكون مصنّفةً بدلا أن يختار نوعا لكلّ ملفٍّ بنفسه: دوراتٌ مسجّلةٌ
   للمدرّب — وهي جلساتٌ تدريبيّةٌ مسجّلة — ويحدّد متى تفتح للطالب طيلةَ
   الفصل؛ كتبٌ وملفّاتٌ ويكتب ما الهدف؛ فيديوهاتٌ وروابطُ عامّةٌ للفائدة».
   وقال أيضا: «لا داعيَ لخانة مواد الشعبة كلّيّا».

   وأخطرُ ما هنا **بوّابةُ الفتح**: «متى تفتح للطالب» لو طُبِّقت في الشاشة
   وحدَها لم تكن بوّابة — الرابطُ يصل الجهازَ فيُقرأ من أدوات المتصفّح أو
   من نداءٍ مباشر. فالحجبُ في الإسقاط الذي يبني ما يُرسَل، وهذا ما يُختبَر
   بالسلوك لا بقراءة نصّ. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RESOURCE_CATEGORIES, resourceCategory, kindForCategory, resourceOpen, projectPlanForLearner,
} from '@/application/trainer/plan-overlay'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const NOW = new Date('2027-01-15T12:00:00.000Z')
const plan = (resources: unknown[]) => ({ status: 'approved', content: { kind: 'trainer', modules: [], resources } })

describe('الأصنافُ الثلاثةُ ومعنى القديم فيها', () => {
  it('ثلاثةٌ لا أكثرُ ولا أقلّ — بأسماء صاحب القرار', () => {
    expect([...RESOURCE_CATEGORIES]).toEqual(['recorded', 'reading', 'public'])
  })

  it('⚠️ والقديمُ لا يُلفَّق له «مسجَّل» — فالترحيلُ لا يحجب', () => {
    /* أخطرُ اشتقاقٍ ممكن: عدُّ الفيديو القديم تسجيلا للمدرّب. فلو صار كذلك
       ورثَ بوّابةَ الفتح، ولو كُتب له تاريخٌ يوما احتجب عن متعلّمٍ كان يراه. */
    expect(resourceCategory({ kind: 'video' }), 'فيديو قديمٌ صار مسجَّلا').not.toBe('recorded')
    expect(resourceCategory({ kind: 'link' })).toBe('public')
    expect(resourceCategory({ kind: 'social' })).toBe('public')
    /* وما كان كتابا أو ملفًّا فهو «كتبٌ وملفّات» — أقربُ خانةٍ إليه */
    for (const kind of ['book', 'audiobook', 'file']) {
      expect(resourceCategory({ kind }), `${kind} لم يُصنَّف قراءةً`).toBe('reading')
    }
  })

  it('والصنفُ المكتوبُ يعلو الاشتقاق، والمخترَعُ يسقط إلى «عامّ»', () => {
    expect(resourceCategory({ category: 'recorded', kind: 'link' })).toBe('recorded')
    expect(resourceCategory({ category: 'حلوى', kind: 'book' }), 'صنفٌ مخترَعٌ مرّ').toBe('reading')
  })

  it('والنوعُ يُشتقُّ من الصنف — فلا يُسأل عنه المدرّب', () => {
    expect(kindForCategory('recorded', false)).toBe('video')
    expect(kindForCategory('reading', true), 'المرفوعُ لم يُعَدّ ملفّا').toBe('file')
    expect(kindForCategory('reading', false)).toBe('book')
    expect(kindForCategory('public', false)).toBe('link')
  })
})

describe('بوّابةُ «متى تُفتح للطالب»', () => {
  it('الفارغُ لا يحجب — مصدرٌ بلا موعدٍ مفتوحٌ مع أوّل يوم', () => {
    expect(resourceOpen({ category: 'recorded', opensAt: null }, NOW)).toBe(true)
    expect(resourceOpen({ category: 'recorded' }, NOW)).toBe(true)
  })

  it('⚠️ والمسجَّلُ قبل موعده محجوب، وبعده مفتوح', () => {
    expect(resourceOpen({ category: 'recorded', opensAt: '2027-02-01T00:00:00.000Z' }, NOW), 'مرّ ما لم يحن').toBe(false)
    expect(resourceOpen({ category: 'recorded', opensAt: '2027-01-01T00:00:00.000Z' }, NOW)).toBe(true)
    /* واللحظةُ نفسُها مفتوحة — «يُفتح في هذا اليوم» لا «بعده» */
    expect(resourceOpen({ category: 'recorded', opensAt: NOW.toISOString() }, NOW)).toBe(true)
  })

  it('والبوّابةُ للمسجَّل وحدَه — لا تُورَّث للكتب ولا للعامّ', () => {
    expect(resourceOpen({ category: 'reading', opensAt: '2027-02-01T00:00:00.000Z' }, NOW)).toBe(true)
    expect(resourceOpen({ category: 'public', opensAt: '2027-02-01T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('وتاريخٌ فاسدٌ لا يحجب — العطبُ في الحقل لا يُعاقَب به المتعلّم', () => {
    expect(resourceOpen({ category: 'recorded', opensAt: 'ليس تاريخا' }, NOW)).toBe(true)
  })

  it('⚠️ والمحجوبُ لا يصل المتعلّمَ أصلا — لا يُخفى في الشاشة وحدَها', () => {
    const view = projectPlanForLearner(plan([
      { title: 'الجلسة الأولى', url: 'https://x.test/1', category: 'recorded', opensAt: '2027-01-01T00:00:00.000Z' },
      { title: 'الجلسة الثانية', url: 'https://x.test/2', category: 'recorded', opensAt: '2027-02-01T00:00:00.000Z' },
      { title: 'كرّاسة', url: 'https://x.test/3', category: 'reading' },
    ]), NOW)

    const titles = view!.resources.map((r) => r.title)
    expect(titles, 'المحجوبُ خرج مع ما يُرسَل').not.toContain('الجلسة الثانية')
    expect(titles).toEqual(['الجلسة الأولى', 'كرّاسة'])
    /* ولا يتسرّب رابطُه في صفٍّ منزوعِ العنوان */
    expect(JSON.stringify(view), 'رابطُ المحجوب تسرّب').not.toContain('https://x.test/2')
  })

  it('والصنفُ يصل المتعلّمَ — شاشتُه تعرضه مجموعا لا كومةً واحدة', () => {
    const view = projectPlanForLearner(plan([
      { title: 'كرّاسة', url: 'https://x.test/3', category: 'reading' },
    ]), NOW)
    expect(view!.resources[0].category).toBe('reading')
  })
})

describe('الشاشةُ: خانةٌ لكلّ صنف، ولا «موادُّ شعبة»', () => {
  const WS = code('src/pages/trainer/CohortWorkspace.tsx')
  const stage = WS.slice(WS.indexOf('stage === "resources"'), WS.indexOf('④ اللقاءات'))

  it('⚠️ لا قائمةَ أنواعٍ في صفّ المصدر — كان يختارها لكلّ ملفّ', () => {
    expect(stage, 'ما زال يختار النوعَ بنفسه').not.toMatch(/aria-label=\{`نوع المصدر/)
    expect(stage, 'الخاناتُ لا تُبنى من قائمة الأصناف').toContain('RESOURCE_CATEGORIES.map')
  })

  it('والنوعُ يُكتب مشتقًّا عند الإضافة — لا يُترك فارغا فيُقرأ رابطا', () => {
    expect(stage).toMatch(/kind: kindForCategory\(cat, false\)/)
    expect(stage).toMatch(/category: cat/)
  })

  it('وتاريخُ الفتح يُعرض للمسجَّل وحدَه، محدودا بأشهر الفصل', () => {
    expect(stage).toMatch(/cat === "recorded" && \(/)
    expect(stage, 'التاريخُ غيرُ محدودٍ بالفصل').toMatch(/min=\{ws\.cohort\.term \? ws\.cohort\.term\.startsOn/)
    expect(stage).toMatch(/max=\{ws\.cohort\.term \? ws\.cohort\.term\.endsOn/)
  })

  it('⚠️ و«موادُّ الشعبة» أُغلقت — لوحةً ومسلكا، لا لوحةً وحدَها', () => {
    expect(WS, 'اللوحةُ ما زالت مُصيَّرةً').not.toContain('CohortMaterials')

    /* ═══ والمسلكُ معها بقرارٍ لا باجتهاد ═══

       كنتُ حذفتُه أوّلَ مرّةٍ من عندي فسقطت أربعةُ اختباراتٍ تحرس عقدَه في
       CI، فرَدَدتُه ورفعتُ الأمرَ إلى صاحب المنصّة. وقرارُه: يُغلَق، وتُحذف
       اختباراتُه — «nothing is real for now».

       والعلّةُ أنّه كان يكتب `LearningMaterial` بحالة `active` — لا حالةَ
       انتظارٍ في ذلك الصفّ أصلا — فيصل المسجَّلين لحظتَه. فهو البابُ الوحيدُ
       الذي كان ينشر به المدرّبُ على طلبته بلا أن تراه الإدارة. */
    expect(code('server/http/routes/learning-portal.routes.ts'), 'مسلكُ رفع المدرّب ما زال مفتوحا')
      .not.toContain("'/api/trainer/cohorts/:id/materials'")
    /* ورفعُ الإدارة باقٍ — لها شاشتُها وصلاحيّتُها، وهي من تعتمد */
    expect(code('server/http/routes/admin-learning.routes.ts')).toContain("'/api/admin/cohorts/:id/materials'")
  })
})
