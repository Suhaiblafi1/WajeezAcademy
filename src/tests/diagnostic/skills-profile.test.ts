import { describe, expect, it } from 'vitest'
import { launchPathways, courseById } from '../../domain/diagnostic/catalog'
import { pathwaySkills } from '../../domain/diagnostic/catalog'
import {
  buildSkillsProfile,
  bandOf,
  levelLabelAr,
  pathwayIdFromSnapshot,
  skillVectorFromSnapshot,
  LEVEL_MAX,
} from '../../application/student/skills-profile'

/** مسار حقيقي من الكتالوج المنشور بمهارات كافية للاختبار */
function richPathway() {
  const p = launchPathways.find((x) => pathwaySkills(x.id).length >= 6)
  expect(p, 'يجب أن يوجد مسار بست مهارات على الأقل في الكتالوج').toBeTruthy()
  return p!
}

describe('ملف المهارات — حدود التصنيف', () => {
  it('الفجوة دون ٣، وفي الطريق عند ٣، والإتقان من ٤ — نفس حدّ المحرك', () => {
    expect(bandOf(1)).toBe('gap')
    expect(bandOf(2)).toBe('gap')
    expect(bandOf(3)).toBe('on_track')
    expect(bandOf(4)).toBe('mastered')
    expect(bandOf(5)).toBe('mastered')
  })

  it('أسماء الدرجات خمس ولا تتجاوز الحدود', () => {
    expect(levelLabelAr(1)).toBe('لا يعرفها')
    expect(levelLabelAr(4)).toBe('جيد عمليا')
    expect(levelLabelAr(LEVEL_MAX)).toBe('متقدم')
    expect(levelLabelAr(99)).toBe('متقدم')
    expect(levelLabelAr(0)).toBe('لا يعرفها')
  })
})

describe('ملف المهارات — لا اختلاق', () => {
  it('بلا قياس وبلا مسار: hasData=false ولا تغطية ولا صفوف', () => {
    const p = buildSkillsProfile({}, null)
    expect(p.hasData).toBe(false)
    expect(p.coverage).toBeNull()
    expect(p.gap).toHaveLength(0)
    expect(p.mastered).toHaveLength(0)
    expect(p.unmeasured).toHaveLength(0)
  })

  it('غير المقاس لا يظهر أبدا بمستوى — يبقى في مجموعة منفصلة بلا رقم', () => {
    const pw = richPathway()
    const skills = pathwaySkills(pw.id)
    const profile = buildSkillsProfile({ [skills[0].slug]: 2 }, pw.id)
    const measuredSlugs = new Set([...profile.gap, ...profile.onTrack, ...profile.mastered].map((s) => s.slug))
    expect(measuredSlugs.has(skills[0].slug)).toBe(true)
    /* لا صف مقاس بمستوى صفر أو أقل */
    for (const row of [...profile.gap, ...profile.onTrack, ...profile.mastered, ...profile.outsidePathway]) {
      expect(row.level).toBeGreaterThanOrEqual(1)
    }
    /* غير المقاس لا يحمل حقل مستوى إطلاقا */
    for (const u of profile.unmeasured) {
      expect(measuredSlugs.has(u.slug)).toBe(false)
      expect('level' in u).toBe(false)
    }
  })

  it('التغطية = المقاس من المتطلبات ÷ المتطلبات، ولا تُحتسب بلا مسار', () => {
    const pw = richPathway()
    const skills = pathwaySkills(pw.id)
    const three = Object.fromEntries(skills.slice(0, 3).map((s) => [s.slug, 3]))
    const withPathway = buildSkillsProfile(three, pw.id)
    expect(withPathway.requiredCount).toBeGreaterThan(0)
    const measuredRequired = withPathway.requiredCount - withPathway.unmeasured.length
    expect(withPathway.coverage).toBeCloseTo(measuredRequired / withPathway.requiredCount, 6)

    const withoutPathway = buildSkillsProfile(three, null)
    expect(withoutPathway.coverage).toBeNull()
    expect(withoutPathway.requiredCount).toBe(0)
  })

  it('مجموع المقاس والمجهول = متطلبات المسار — لا تسرّب ولا تكرار', () => {
    const pw = richPathway()
    const skills = pathwaySkills(pw.id)
    const vector = Object.fromEntries(skills.slice(0, 4).map((s, i) => [s.slug, [1, 3, 4, 5][i]]))
    const p = buildSkillsProfile(vector, pw.id)
    const inPathway = p.gap.length + p.onTrack.length + p.mastered.length + p.unmeasured.length
    expect(inPathway).toBe(p.requiredCount)
    const slugs = [...p.gap, ...p.onTrack, ...p.mastered, ...p.unmeasured].map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('مقاس ليس من متطلبات المسار يذهب لرصيد خارج المسار ولا يدخل التغطية', () => {
    const pw = richPathway()
    const required = new Set(pathwaySkills(pw.id).map((s) => s.slug))
    const outsider = launchPathways
      .flatMap((p) => pathwaySkills(p.id))
      .find((s) => !required.has(s.slug))
    expect(outsider, 'يجب أن توجد مهارة خارج متطلبات المسار').toBeTruthy()
    const p = buildSkillsProfile({ [outsider!.slug]: 5 }, pw.id)
    expect(p.outsidePathway.map((s) => s.slug)).toContain(outsider!.slug)
    expect(p.mastered.map((s) => s.slug)).not.toContain(outsider!.slug)
    expect(p.coverage).toBe(0)
  })

  it('كل مهارة فجوة تُقرن بدورات المسار التي تُدرّسها فعلا — لا مطابقة نصية', () => {
    const pw = richPathway()
    const skills = pathwaySkills(pw.id)
    const p = buildSkillsProfile(Object.fromEntries(skills.map((s) => [s.slug, 1])), pw.id)
    expect(p.gap.length).toBeGreaterThan(0)
    let linked = 0
    for (const row of p.gap) {
      for (const c of row.coveredBy) {
        /* الدورة من المسار فعلا، وتحمل الشريحة في مهاراتها */
        expect(pw.course_ids).toContain(c.id)
        expect(courseById.get(c.id)?.skill_slugs).toContain(row.slug)
        linked++
      }
    }
    expect(linked, 'يجب أن ترتبط فجوة واحدة بدورة على الأقل').toBeGreaterThan(0)
  })

  it('الفجوات مرتّبة بالأشدّ أولا', () => {
    const pw = richPathway()
    const skills = pathwaySkills(pw.id)
    const p = buildSkillsProfile({ [skills[0].slug]: 2, [skills[1].slug]: 1 }, pw.id)
    expect(p.gap.map((s) => s.level)).toEqual([1, 2])
    expect(p.gap[0].toTarget).toBe(3)
  })
})

describe('ملف المهارات — قراءة اللقطات', () => {
  it('يقرأ متجه القياس من نتيجة كاملة ومن لقطة خادم مسطحة', () => {
    expect(skillVectorFromSnapshot({ resultJson: { skill_vector: { a: 2, b: 4 } } })).toEqual({ a: 2, b: 4 })
    expect(skillVectorFromSnapshot({ skill_vector: { a: 3 } })).toEqual({ a: 3 })
  })

  it('يرفض القيم غير الصالحة ولا يحوّلها أصفارا', () => {
    const v = skillVectorFromSnapshot({ skill_vector: { a: 0, b: -1, c: 'ثلاثة', d: null, e: 2 } })
    expect(v).toEqual({ e: 2 })
  })

  it('يحدّ المستوى بأقصى السلّم ولا يتجاوزه', () => {
    expect(skillVectorFromSnapshot({ skill_vector: { a: 99 } })).toEqual({ a: LEVEL_MAX })
  })

  it('لقطة الديمو المسطحة بلا مهارات لا تُنتج بيانات', () => {
    const demo = { demo: true, kind: 'pathway', pathwayId: 'PW-AUT-001', confidence: 0.82 }
    expect(skillVectorFromSnapshot(demo)).toEqual({})
    expect(pathwayIdFromSnapshot(demo)).toBe('PW-AUT-001')
    expect(buildSkillsProfile(skillVectorFromSnapshot(demo), pathwayIdFromSnapshot(demo)).hasData).toBe(false)
  })

  it('يستخرج المسار من top.id للنتيجة الكاملة', () => {
    expect(pathwayIdFromSnapshot({ top: { id: 'PW-FND-003' } })).toBe('PW-FND-003')
    expect(pathwayIdFromSnapshot(null)).toBeNull()
    expect(pathwayIdFromSnapshot({ top: null })).toBeNull()
  })
})
