import { describe, expect, it } from 'vitest'
import { catalogCourses } from '../../domain/diagnostic/catalog'
import {
  REMEASURE_MAX,
  buildGrowthSummary,
  buildRemeasureForm,
  growthBySlug,
  latestLevels,
  mergeMeasured,
  remeasureGate,
  validateRemeasure,
  type RemeasureRecord,
} from '../../application/student/skill-growth'

/** دورة حقيقية من الكتالوج المنشور بمهارات كافية */
function richCourse() {
  const c = catalogCourses.find((x) => x.skill_slugs.length >= 3)
  expect(c, 'يجب أن توجد دورة بثلاث مهارات على الأقل في الكتالوج').toBeTruthy()
  return c!
}

const FACTS = { enrollmentStatus: 'enrolled', hasCertificate: false, rulesChecked: 0, rulesMet: false, percent: 0 }

describe('ح-٧ بوابة القياس البعدي — لا فرق بلا إتمام', () => {
  it('التسجيل المنسحب أو في الانتظار: مغلق مهما كان التقدم', () => {
    expect(remeasureGate({ ...FACTS, enrollmentStatus: 'dropped', percent: 100, rulesChecked: 2, rulesMet: true }).open).toBe(false)
    expect(remeasureGate({ ...FACTS, enrollmentStatus: 'waitlisted', hasCertificate: true }).open).toBe(false)
  })

  it('التقدم وحده لا يفتح القياس — ٩٩٪ ليست إتماما', () => {
    const g = remeasureGate({ ...FACTS, percent: 99, rulesChecked: 3, rulesMet: false })
    expect(g.open).toBe(false)
    expect(g.reasonAr).toContain('99')
  })

  it('غياب قواعد الإكمال لا يُعدّ إتماما — لا يُفتح بالفراغ', () => {
    const g = remeasureGate({ ...FACTS, percent: 100, rulesChecked: 0, rulesMet: true })
    expect(g.open).toBe(false)
    expect(g.reasonAr).toContain('قواعد إكمال')
  })

  it('يُفتح بشهادة أو بحالة مكتمل أو بقواعد متحققة — ثلاث بوابات صريحة', () => {
    expect(remeasureGate({ ...FACTS, hasCertificate: true }).open).toBe(true)
    expect(remeasureGate({ ...FACTS, enrollmentStatus: 'completed' }).open).toBe(true)
    expect(remeasureGate({ ...FACTS, rulesChecked: 2, rulesMet: true }).open).toBe(true)
  })
})

describe('ح-٧ الاستمارة — من مهارات الدورة لا من مهارات المسار', () => {
  it('صفوفها مهارات الدورة نفسها بأسمائها', () => {
    const c = richCourse()
    const form = buildRemeasureForm(c.course_id, {})
    expect(form.measurable).toBe(true)
    expect(form.rows.map((r) => r.slug)).toEqual(c.skill_slugs)
    expect(form.courseTitleAr).toBe(c.title_ar)
    for (const r of form.rows) expect(r.nameAr.length).toBeGreaterThan(1)
  })

  it('ما لم يقسه المؤشر لا يظهر بمستوى صفرا بل بـ null', () => {
    const c = richCourse()
    const form = buildRemeasureForm(c.course_id, { [c.skill_slugs[0]]: 2 })
    expect(form.rows[0].beforeLevel).toBe(2)
    expect(form.rows[1].beforeLevel).toBeNull()
  })

  it('دورة غير موجودة: لا استمارة ولا اختلاق مهارات', () => {
    const form = buildRemeasureForm('C-NOT-REAL', { x: 3 })
    expect(form.measurable).toBe(false)
    expect(form.rows).toHaveLength(0)
    expect(form.courseTitleAr).toBeNull()
  })
})

describe('ح-٧ التحقق قبل الكتابة', () => {
  it('يرفض مهارة خارج الدورة ومستوى خارج السلّم ويقبل الصحيح', () => {
    const bad = validateRemeasure({ a: 3, b: 4, c: 9 }, ['a', 'c'])
    expect(bad.ok).toBe(false)
    /* خطأان مختلفان: مهارة خارج الدورة، ومستوى خارج السلّم */
    expect(bad.errorsAr).toHaveLength(2)
    expect(bad.errorsAr[0]).toContain('ليست من مهارات هذه الدورة')
    expect(bad.errorsAr[1]).toContain('مستوى غير مقبول')
    expect(bad.clean).toEqual({ a: 3 })
    const good = validateRemeasure({ a: 1, c: REMEASURE_MAX }, ['a', 'c'])
    expect(good.ok).toBe(true)
    expect(good.clean).toEqual({ a: 1, c: REMEASURE_MAX })
  })

  it('يرفض الكسور والقيم غير الرقمية والفراغ', () => {
    expect(validateRemeasure({ a: 2.5 }, ['a']).ok).toBe(false)
    expect(validateRemeasure({ a: '4' as unknown as number }, ['a']).ok).toBe(false)
    expect(validateRemeasure({}, ['a']).ok).toBe(false)
  })
})

describe('ح-٧ ملخص النمو — الصدق في الحساب', () => {
  const rec = (slug: string, before: number | null, after: number, courseId = 'C-1', at = '2026-08-01T00:00:00.000Z'): RemeasureRecord =>
    ({ courseId, skillSlug: slug, beforeLevel: before, afterLevel: after, measuredAt: at })

  it('بلا سجلات: hasData=false ولا أرقام', () => {
    const s = buildGrowthSummary([])
    expect(s.hasData).toBe(false)
    expect(s.netPoints).toBe(0)
    expect(s.courses).toHaveLength(0)
  })

  it('القياس الأول (بلا مرجع قبليّ) لا يدخل الفرق ولا يُعدّ صفرا', () => {
    const s = buildGrowthSummary([rec('a', null, 5)], { a: 'مهارة أ' })
    expect(s.firstMeasured).toBe(1)
    expect(s.improved).toBe(0)
    expect(s.netPoints).toBe(0)
    expect(s.courses[0].skills[0].delta).toBeNull()
    expect(s.courses[0].skills[0].direction).toBe('first')
  })

  it('التراجع يُعرض ويُخصم — لا مؤشر يرتفع فقط', () => {
    const s = buildGrowthSummary([rec('a', 2, 4), rec('b', 3, 2)], { a: 'أ', b: 'ب' })
    expect(s.improved).toBe(1)
    expect(s.declined).toBe(1)
    expect(s.netPoints).toBe(1)
    expect(s.courses[0].skills.at(-1)!.direction).toBe('down')
  })

  it('عبور المستهدف يُحسب مرة واحدة ولمن كان دونه فقط', () => {
    const s = buildGrowthSummary([rec('a', 2, 4), rec('b', 4, 5), rec('c', 1, 3)])
    expect(s.crossedTarget).toBe(1)
    expect(s.courses[0].skills.find((x) => x.slug === 'b')!.crossedTarget).toBe(false)
  })

  it('يجمع بالدورات ويرتّبها بالأحدث أولا', () => {
    const s = buildGrowthSummary([
      rec('a', 1, 3, 'C-OLD', '2026-01-01T00:00:00.000Z'),
      rec('b', 2, 4, 'C-NEW', '2026-06-01T00:00:00.000Z'),
    ])
    expect(s.courses.map((c) => c.courseId)).toEqual(['C-NEW', 'C-OLD'])
    expect(s.netPoints).toBe(4)
  })

  it('المستوى البعديّ يُقصّ على السلّم فلا يتسرب رقم خارجه', () => {
    const s = buildGrowthSummary([rec('a', 1, 99)])
    expect(s.courses[0].skills[0].afterLevel).toBe(REMEASURE_MAX)
  })
})

describe('ح-٧ الدمج في ملف المهارات', () => {
  const rec = (slug: string, after: number, at: string): RemeasureRecord =>
    ({ courseId: 'C-1', skillSlug: slug, beforeLevel: 2, afterLevel: after, measuredAt: at })

  it('أحدث قياس بعديّ لكل مهارة هو الذي يغلب', () => {
    const levels = latestLevels([rec('a', 3, '2026-01-01T00:00:00.000Z'), rec('a', 5, '2026-05-01T00:00:00.000Z')])
    expect(levels).toEqual({ a: 5 })
  })

  it('الدمج لا يخترع مهارة غير مقيسة ولا يمحو مقيسة خارج الدورة', () => {
    const merged = mergeMeasured({ x: 4, a: 2 }, [rec('a', 4, '2026-05-01T00:00:00.000Z')])
    expect(merged).toEqual({ x: 4, a: 4 })
  })

  it('خريطة الشارات تأخذ الأحدث عند تكرار المهارة في دورتين', () => {
    const s = buildGrowthSummary([
      { courseId: 'C-OLD', skillSlug: 'a', beforeLevel: 1, afterLevel: 2, measuredAt: '2026-01-01T00:00:00.000Z' },
      { courseId: 'C-NEW', skillSlug: 'a', beforeLevel: 2, afterLevel: 5, measuredAt: '2026-06-01T00:00:00.000Z' },
    ])
    expect(growthBySlug(s).get('a')).toMatchObject({ beforeLevel: 2, delta: 3 })
  })
})
