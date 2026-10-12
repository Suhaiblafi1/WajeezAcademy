/* مخطِّطُ توزيع الشعب — القيودُ عقدٌ، والحتميّةُ شرط (البند ٤٨).

   المعاينةُ التي تعطي نتيجةً مختلفةً في كلّ تشغيلٍ ليست معاينة. والقيدُ الذي
   يُخالَف مرّةً واحدةً يجعل الجدولَ كلَّه غيرَ جديرٍ بالثقة. فهذه حراستُهما. */

import { describe, expect, it } from 'vitest'
import {
  planTerm, pairPenalty, PENALTY, MIN_PATHWAY_GAP_WEEKS,
  type PlannableCourse, type PlannerSlot,
} from '../../application/terms/planner'

const slots = (n = 13): PlannerSlot[] =>
  Array.from({ length: n }, (_, w) => ({
    week: w,
    startsAt: new Date(Date.UTC(2026, 1, 1 + w * 7)),
    monthWithinTerm: Math.min(3, Math.floor(w / (n / 3)) + 1),
  }))

const course = (id: string, over: Partial<PlannableCourse> = {}): PlannableCourse => ({
  courseId: id, pathwayId: null, sequence: null, domainAr: null, collisionGroup: null,
  skillSlugs: [], skillFamilies: [], weeks: 2, ...over,
})

const chain = (pw: string, n: number): PlannableCourse[] =>
  Array.from({ length: n }, (_, i) => course(`${pw}-${i + 1}`, { pathwayId: pw, sequence: i + 1 }))

describe('الحتميّة — المعاينة التي تتغيّر ليست معاينة', () => {
  it('التشغيلان يعطيان الجدول نفسه حرفا بحرف', () => {
    const courses = [...chain('P', 4), ...chain('Q', 4), ...chain('R', 5)]
    const a = planTerm({ courses, slots: slots() })
    const b = planTerm({ courses, slots: slots() })
    expect(a.rows.map((r) => [r.courseId, r.week])).toEqual(b.rows.map((r) => [r.courseId, r.week]))
    expect(a.totalPenalty).toBe(b.totalPenalty)
  })

  it('ولا يتغيّر الجدول بتغيّر ترتيب المدخلات', () => {
    const courses = [...chain('P', 4), ...chain('Q', 4)]
    const a = planTerm({ courses, slots: slots() })
    const b = planTerm({ courses: [...courses].reverse(), slots: slots() })
    expect(new Map(a.rows.map((r) => [r.courseId, r.week])))
      .toEqual(new Map(b.rows.map((r) => [r.courseId, r.week])))
  })
})

describe('قيد المسار — ترتيب لكلّ زوج، وفجوة للمتتاليين', () => {
  it('اللاحقة لا تسبق السابقة أبدا', () => {
    const courses = [...chain('P', 5), ...chain('Q', 4), ...chain('R', 4)]
    const r = planTerm({ courses, slots: slots() })
    const at = new Map(r.rows.map((x) => [x.courseId, x.week]))
    for (const c of courses) {
      for (const d of courses) {
        if (c.pathwayId !== d.pathwayId || c.sequence! >= d.sequence!) continue
        const wc = at.get(c.courseId), wd = at.get(d.courseId)
        if (wc === undefined || wd === undefined) continue
        expect(wd, `${d.courseId} سبقت ${c.courseId}`).toBeGreaterThan(wc)
      }
    }
  })

  it('والمتتاليتان بينهما أسبوعان على الأقلّ', () => {
    const courses = [...chain('P', 4), ...chain('Q', 4)]
    const r = planTerm({ courses, slots: slots() })
    const at = new Map(r.rows.map((x) => [x.courseId, x.week]))
    for (const c of courses) {
      const next = courses.find((d) => d.pathwayId === c.pathwayId && d.sequence === c.sequence! + 1)
      if (!next) continue
      const wc = at.get(c.courseId), wn = at.get(next.courseId)
      if (wc === undefined || wn === undefined) continue
      expect(wn - wc, `${c.courseId} ← ${next.courseId}`).toBeGreaterThanOrEqual(MIN_PATHWAY_GAP_WEEKS)
    }
  })

  it('ومسار طويل يسع الفصل يجدول كاملا', () => {
    const r = planTerm({ courses: chain('P', 5), slots: slots() })
    expect(r.unplaced, 'مسار من خمس لم يسع فصلا من ثلاثة عشر أسبوعا').toEqual([])
    expect(r.rows.every((x) => x.orderBreachAr === null), 'كسر الترتيب بلا تثبيت').toBe(true)
  })
})

describe('السقف الأسبوعيّ يشتقّ — ولا تسقط دورة صامتة', () => {
  it('حمل واقعيّ يجدول كاملا بلا سقف ممرّر', () => {
    const courses = Array.from({ length: 20 }, (_, i) => chain(`P${i}`, 4)).flat()
    const r = planTerm({ courses, slots: slots() })
    expect(r.rows).toHaveLength(courses.length)
    expect(r.unplaced).toEqual([])
  })

  it('وسقف ضيّق يمرّر يقال أثره بسببه لا يبتلع', () => {
    const courses = Array.from({ length: 20 }, (_, i) => chain(`P${i}`, 4)).flat()
    const r = planTerm({ courses, slots: slots(), weeklyCap: 2 })
    expect(r.unplaced.length).toBeGreaterThan(0)
    for (const u of r.unplaced) expect(u.whyAr.length, u.courseId).toBeGreaterThan(10)
  })

  it('وسلسلة أطول من الفصل تقال بطولها لا بعبارة عامّة', () => {
    const r = planTerm({ courses: chain('P', 9), slots: slots(6) })
    expect(r.unplaced[0].whyAr).toMatch(/تحتاج \d+ أسبوعا والفصل \d+/)
  })
})

describe('المثبّت يحترم — التجاوز البشريّ لا يزحزح', () => {
  it('الشعبة المثبّتة تبقى في أسبوعها ويخطّط حولها', () => {
    const courses = [...chain('P', 4), ...chain('Q', 4)]
    const r = planTerm({ courses, slots: slots(), pinned: { 'Q-1': 11 } })
    const row = r.rows.find((x) => x.courseId === 'Q-1')!
    expect(row.week).toBe(11)
    expect(row.pinned).toBe(true)
  })

  /* التثبيتُ يتجاوز البناءَ كلَّه — فقرارُ الإنسان يُحترَم، **وأثرُه يُقال**:
     من ثبّت الرابعةَ قبل الأولى رأى ذلك في صفّه لا بعد شهر. */
  it('وتثبيت يكسر ترتيب المسار يقال ولا يمنع', () => {
    const r = planTerm({ courses: chain('P', 4), slots: slots(), pinned: { 'P-4': 0 } })
    const four = r.rows.find((x) => x.courseId === 'P-4')!
    expect(four.week, 'لم يحترم التثبيت').toBe(0)
    expect(four.orderBreachAr, 'كسر الترتيب ولم يقل').toBeTruthy()
    expect(four.orderBreachAr).toContain('ترتيب المسار مكسور')
  })

  it('وتثبيت سليم لا ينبّه عليه — لا ضجيج بلا سبب', () => {
    const r = planTerm({ courses: chain('P', 4), slots: slots(), pinned: { 'P-1': 0 } })
    expect(r.rows.every((x) => x.orderBreachAr === null)).toBe(true)
  })
})

describe('العقوبة تقول سببها — لا صندوق أسود', () => {
  it('المهارات المشتركة أثقل من العائلات المشتركة', () => {
    const a = course('A', { skillSlugs: ['x'] })
    const b = course('B', { skillSlugs: ['x'] })
    const c = course('C', { skillFamilies: ['F'] })
    const d = course('D', { skillFamilies: ['F'] })
    expect(pairPenalty(a, b).penalty).toBeGreaterThan(pairPenalty(c, d).penalty)
    expect(PENALTY.sharedSkill).toBeGreaterThan(PENALTY.sharedFamily)
  })

  it('وكلّ عقوبة معها سببها بالعربيّة', () => {
    const a = course('A', { pathwayId: 'P', skillSlugs: ['x'], domainAr: 'التسويق' })
    const b = course('B', { pathwayId: 'P', skillSlugs: ['x'], domainAr: 'التسويق' })
    const p = pairPenalty(a, b)
    expect(p.penalty).toBeGreaterThan(0)
    expect(p.whyAr).toContain('مهارة مشتركة')
    expect(p.whyAr).toContain('المسار نفسه')
    expect(p.whyAr).toContain('التسويق')
  })

  it('وبلا تقاطع لا عقوبة ولا سبب', () => {
    expect(pairPenalty(course('A'), course('B'))).toEqual({ penalty: 0, whyAr: '' })
  })

  it('والصفّ يحمل أعلى تزاحم قبل — فترى المقايضة', () => {
    const courses = [
      course('A', { skillSlugs: ['x', 'y'], pathwayId: 'P', sequence: 1 }),
      course('B', { skillSlugs: ['x', 'y'], pathwayId: 'P', sequence: 2 }),
    ]
    const r = planTerm({ courses, slots: slots(4) })
    const withCollision = r.rows.filter((x) => x.worstCollision)
    expect(withCollision.length).toBeGreaterThan(0)
    expect(withCollision[0].worstCollision!.whyAr).toBeTruthy()
  })
})

describe('والحمل يعرض بالشهر — ليرى الاتّزان لا ليدّعى', () => {
  it('مجموع الأشهر يساوي ما جدول', () => {
    const courses = [...chain('P', 4), ...chain('Q', 4), ...chain('R', 4)]
    const r = planTerm({ courses, slots: slots() })
    const total = Object.values(r.loadByMonth).reduce((a, b) => a + b, 0)
    expect(total).toBe(r.rows.length)
  })
})
