/* الدرجةُ العليا: خانةٌ ميّتة، ورقمٌ يناقض عبارتَه (البنود ٣٤ · ٣٥ · ٣٦).

   ٣٦ · **«تطابق قوي» كان مستحيلا حسابيّا**: الشرطُ نصفُ **كلّ** مهارات
        المسار مقيسٌ بدليل مباشر. والبنكُ يقيس سبعا وعشرين مهارة، فلو أجاب
        المتعلّمُ عن كلّ سؤالٍ في المنصّة لبلغ **متوسّطُ** ما يمكن قياسُه من
        مهارات المسار الواحد نحوَ الخُمس. **ولا مسارَ واحدٌ يبلغ الخمسين.**
        فالنتيجة: صفرٌ من عشرة آلاف جلسة، والمانعُ يُطلَق في مئةٍ بالمئة.

   ٣٥ · **تقييمُ عائلات المهارات كان موصولا بالعرض لا بالقرار**: يصل إلى
        تركيب قائمة الدورات وحدَه — لا إلى حالات المهارات ولا الترتيب ولا
        الثقة. فيُقيّم المتعلّمُ عائلاتِه فتتغيّر القائمةُ ولا يتغيّر شيءٌ آخر.

   ٣٤ · **الرقمُ والعبارةُ يتناقضان بالتصميم**: «٩٧٪ — أفضل تطابق حالي» في
        سطرٍ واحد، و١٧٪ من الجلسات تعرض ٧٨٪ فأعلى تحت «ليس قويّا». */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchPathways, pathwaySkills } from '../../domain/diagnostic/catalog'
import { layersOfSkill, isDiagnosticSkillActive } from '../../domain/diagnostic/v2/data'
import { measurableSkills, recommendationUniverse } from '../../domain/diagnostic/v2_1/universe'
import { assessEntitySkills } from '../../domain/diagnostic/v2_1/compete'
import { STRONG_MEASURABLE_COVERAGE_MIN } from '../../domain/diagnostic/v2/confidence'
import { familyIndex } from '../../domain/diagnostic/v2_1/skill-families'
import type { SkillState } from '../../domain/diagnostic/v2/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const activeRequired = (id: string) =>
  pathwaySkills(id).filter((s) => isDiagnosticSkillActive(layersOfSkill(s.slug)))

describe('٣٦ · المسطرةُ القديمة كانت غيرَ قابلةٍ للبلوغ — والقياسُ يُثبتها', () => {
  it('لا مسارَ واحدٌ يبلغ نصفَ مهاراته قياسا ولو أجاب المتعلّمُ عن كلّ سؤال', () => {
    const canMeasure = measurableSkills()
    const ceilings = launchPathways.map((p) => {
      const req = activeRequired(p.id)
      const can = req.filter((s) => canMeasure.has(s.slug)).length
      return { id: p.id, ceiling: req.length === 0 ? 1 : can / req.length }
    })
    expect(ceilings.length).toBeGreaterThan(10)
    const reachable = ceilings.filter((c) => c.ceiling >= 0.5)
    expect(
      reachable.map((c) => c.id),
      'تغيّر البنكُ أو الكتالوج — تُراجَع معايرةُ المانع، فالمسطرةُ القديمة صارت قابلةً للبلوغ',
    ).toEqual([])
  })

  it('والمسطرةُ الجديدةُ سقفُها المئة — يبلغها من قِيس فيه كلُّ ما نستطيع قياسَه', () => {
    const entity = recommendationUniverse().byId.get('PW-STU-002')!
    const canMeasure = measurableSkills()
    const measured = new Map<string, SkillState>()
    for (const slug of entity.skill_slugs) {
      if (canMeasure.has(slug)) measured.set(slug, { slug, state: 'measured', level: 4 })
    }
    const full = assessEntitySkills(entity, measured, {})
    expect(full.measurableCoverage, 'المسطرةُ الجديدةُ لا تبلغ سقفَها').toBe(1)
    expect(full.measuredCoverage, 'الرقمُ المعروضُ تضخّم — يجب أن يبقى على كلّ المهارات').toBeLessThan(0.5)
  })

  it('والعتبةُ معلَنةٌ رقما واحدا يُقرأ ويُراجَع', () => {
    expect(STRONG_MEASURABLE_COVERAGE_MIN).toBeGreaterThan(0.5)
    expect(STRONG_MEASURABLE_COVERAGE_MIN).toBeLessThanOrEqual(0.8)
  })
})

describe('٣٥ · تقييمُ العائلات يبلغ القرار — لا العرضَ وحدَه', () => {
  const entity = () => recommendationUniverse().byId.get('PW-STU-002')!
  const measurableOf = (e: ReturnType<typeof entity>) => {
    const can = measurableSkills()
    return e.skill_slugs.filter((s) => can.has(s))
  }

  it('الترجيحُ يرفع التغطيةَ — وكان لا يغيّر شيئا خارج قائمة الدورات', () => {
    const e = entity()
    const req = measurableOf(e)
    expect(req.length, 'المسارُ بلا مهارةٍ يمكن قياسُها — يُراجَع الحارس').toBeGreaterThan(0)
    const idx = familyIndex()
    const ratings: Record<string, number> = {}
    for (const slug of req) {
      const fam = idx.familyOf.get(slug)
      if (fam) ratings[fam] = 4
    }
    const without = assessEntitySkills(e, new Map(), {})
    const withRatings = assessEntitySkills(e, new Map(), ratings)
    expect(withRatings.measurableCoverage, 'الترجيحُ ما زال بلا أثرٍ على التغطية')
      .toBeGreaterThan(without.measurableCoverage)
  })

  it('ولا يُفتح ادّعاءُ المعرفة بترجيحٍ وحدَه — قياسٌ مباشرٌ واحدٌ على الأقلّ', () => {
    const e = entity()
    const req = measurableOf(e)
    const idx = familyIndex()
    const ratings: Record<string, number> = {}
    for (const slug of req) {
      const fam = idx.familyOf.get(slug)
      if (fam) ratings[fam] = 5
    }
    const inferredOnly = assessEntitySkills(e, new Map(), ratings)
    expect(inferredOnly.hasDirectSkillEvidence, 'ادُّعي دليلٌ مباشرٌ بلا قياسٍ واحد').toBe(false)
    const measured = new Map<string, SkillState>([[req[0], { slug: req[0], state: 'measured', level: 3 }]])
    expect(assessEntitySkills(e, measured, ratings).hasDirectSkillEvidence).toBe(true)
  })

  it('والمقيسُ يعلو على المرجَّح — الفجوةُ لا تُبنى على تقديرٍ ذاتيّ', () => {
    const e = entity()
    const req = measurableOf(e)
    const idx = familyIndex()
    const ratings: Record<string, number> = {}
    for (const slug of req) {
      const fam = idx.familyOf.get(slug)
      if (fam) ratings[fam] = 1
    }
    /* ترجيحٌ منخفضٌ لا يصنع «فجوةً مقيسة» */
    const inferred = assessEntitySkills(e, new Map(), ratings)
    expect(inferred.gapSkillSlugs, 'ترجيحٌ ذاتيٌّ صار فجوةً مقيسة').toEqual([])
  })

  it('والسياقُ يحمل التقييمَ — وكان لا يغادر تركيبَ قائمة الدورات', () => {
    const types = read('src/domain/diagnostic/v2/types.ts')
    expect(types, 'تقييمُ العائلات لا يبلغ سياقَ القرار').toContain('familyRatings')
    const engine = read('src/domain/diagnostic/v2_1/engine.ts')
    expect(engine).toMatch(/familyRatings: this\.familyRatings/)
  })
})

describe('٣٤ · الرقمُ شيءٌ والدرجةُ شيءٌ آخر', () => {
  const card = read('src/pages/diagnostic/ResultPlanCards.tsx')

  it('لا يُطبعان معا في سطرٍ واحد — «٩٧٪ — أفضل تطابق حالي» تناقضٌ بالتصميم', () => {
    expect(card, 'الرقمُ والدرجةُ ما زالا في سطرٍ واحد')
      .not.toMatch(/\{total\}٪\{bandAr/)
  })

  it('ومع الدرجةِ سببُها — مانعٌ يُقرأ خيرٌ من تناقضٍ يُخمَّن', () => {
    expect(card).toContain('صنفُ النتيجة')
    expect(card).toMatch(/blockers\.map/)
  })

  it('والموانعُ تصل الشاشةَ فعلا — كانت تُحسب وتُسجَّل ولا تُعرض', () => {
    const vm = read('src/application/diagnostic/view-model.ts')
    expect(vm, 'الموانعُ لا تُوضع في نتيجة العرض').toContain('strong_blockers_ar')
    const page = read('src/pages/Diagnostic.tsx')
    expect(page, 'الشاشةُ لا تمرّر الموانع').toContain('strong_blockers_ar')
  })

  it('والعبارةُ تقول أساسَها — «قوية» وحدَها ادّعاءُ علمٍ بما لم يُقَس', () => {
    const conf = read('src/domain/diagnostic/v2/confidence.ts')
    expect(conf).toContain('تطابق قوي بما قِسناه')
    const engine = read('src/domain/diagnostic/v2_1/engine.ts')
    expect(engine).toContain('قوية بما قِسناه')
  })
})
