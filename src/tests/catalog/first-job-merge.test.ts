/* «التحضير لأول وظيفة» دورتان لا أربع — والدمجُ لا يُسقط شيئا.

   ═══ القرار (٣٠ سبتمبر ٢٠٢٦) ═══

   قرّر صاحبُ المنصّة دمجَ دورات المسار الأربع في اثنتين: C-JOB-103 (ملفّ
   الأعمال) في C-JOB-101 (الاستهداف والسيرة) — ما تُريه صاحبَ العمل — وC-JOB-105
   (البحث عن عمل) في C-JOB-104 (المقابلات) — كيف تصل إليه. وقبِل أن يقلّ عددُ
   دورات المسار وسعرُه.

   ═══ وما يُحرَس ═══

   ① **لا يعود المُدمَجُ من بابٍ جانبيّ** — لا دورةً ولا وحدةً ولا رابطَ مسارٍ
      ولا موضعا في قالب.
   ② **ولا يضيع منه شيء**: وحداتُه العشرون بترتيبها، وساعاتُه الأربعون،
      ومهاراتُه كلُّها — تُعدّ من الدورات الأربع كما كانت، لا من الناتج.
   ③ **والمدموجةُ دورةٌ واحدةٌ متّسقة**: سُلّمُ تقييمها يُجمع مئة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Course {
  course_id: string; total_hours: number; guided_hours: number; independent_hours: number; practice_hours: number
  skill_slugs: string[]; skill_ids: string[]; skill_names_ar: string[]; rubric_criteria_ar: string[]
  learning_outcomes_ar: string[]; list_price: number
}
const read = (p: string) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'))
const core = read('src/data/catalog/core-catalog.v2.json') as {
  courses: Course[]
  modules: { module_id: string; course_id: string; sequence: number }[]
  launch_pathways: { id: string; course_ids: string[]; support_courses?: { course_id: string }[]; total_hours: number; module_count: number; course_count: number }[]
}
const slim = read('src/data/catalog/core-catalog.slim.v2.json') as unknown
const templates = read('src/data/catalog/composite-templates.v1.json') as unknown
const course = (id: string) => core.courses.find((c) => c.course_id === id)!
const unitsOf = (id: string) => core.modules
  .filter((m) => m.course_id === id)
  .sort((a, b) => a.sequence - b.sequence)
  .map((m) => m.module_id)

const RETIRED = ['C-JOB-103', 'C-JOB-105']

describe('① لا يعود المُدمَجُ من بابٍ جانبيّ', () => {
  it('لا دورةَ ولا وحدةَ ولا رابطَ مسارٍ باسم المُدمَجة', () => {
    for (const id of RETIRED) {
      expect(core.courses.some((c) => c.course_id === id), `${id} عادت دورة`).toBe(false)
      expect(core.modules.filter((m) => m.course_id === id), `وحداتٌ ما زالت تحت ${id}`).toEqual([])
      for (const p of core.launch_pathways) {
        expect([...p.course_ids, ...(p.support_courses ?? []).map((s) => s.course_id)], p.id).not.toContain(id)
      }
    }
  })

  it('ولا موضعَ لها في قالبٍ مركّبٍ ولا في النسخة المختصرة — يُقرأ المعرّفُ في البنية لا في نصّ', () => {
    /* يُمشى على الكائنات ويُقارَن حقلُ `course_id` وحده: فالمعرّفُ في تعليقٍ أو
       عنوانٍ قديمٍ لا يُسقط الحارس، وموضعُه الحقيقيُّ يُسقطه */
    const ids: string[] = []
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk)
      else if (x && typeof x === 'object') {
        for (const [k, v] of Object.entries(x)) {
          if (k === 'course_id' && typeof v === 'string') ids.push(v)
          else if (k === 'course_ids' && Array.isArray(v)) ids.push(...v.filter((s): s is string => typeof s === 'string'))
          else walk(v)
        }
      }
    }
    walk(templates)
    walk(slim)
    expect(ids.length, 'لم يُقرأ معرّفٌ واحد — تغيّرت البنية؟').toBeGreaterThan(100)
    for (const id of RETIRED) expect(ids, `${id} باقيةٌ في قالبٍ أو نسخة`).not.toContain(id)
  })
})

describe('② ولا يضيع منه شيء', () => {
  it('الوحداتُ العشرون بترتيبها: ما تُريه صاحبَ العمل، ثمّ كيف تصل إليه', () => {
    expect(unitsOf('C-JOB-101')).toEqual([
      'C-JOB-101-M1', 'C-JOB-101-M2', 'C-JOB-101-M3', 'C-JOB-101-M4',
      'C-JOB-102-M1', 'C-JOB-102-M2', 'C-JOB-102-M3', 'C-JOB-102-M4',
      'C-JOB-103-M1', 'C-JOB-103-M2', 'C-JOB-103-M3', 'C-JOB-103-M4',
    ])
    /* والبحثُ قبل المقابلة: لا مقابلةَ بلا بحثٍ يوصل إليها */
    expect(unitsOf('C-JOB-104')).toEqual([
      'C-JOB-105-M1', 'C-JOB-105-M2', 'C-JOB-105-M3', 'C-JOB-105-M4',
      'C-JOB-104-M1', 'C-JOB-104-M2', 'C-JOB-104-M3', 'C-JOB-104-M4',
    ])
    for (const id of ['C-JOB-101', 'C-JOB-104']) {
      expect(core.modules.filter((m) => m.course_id === id).map((m) => m.sequence).sort((a, b) => a - b),
        `${id}: ترتيبٌ مثقوبٌ أو مكرّر`).toEqual(unitsOf(id).map((_, i) => i + 1))
    }
  })

  it('وساعاتُ المسار الأربعون: ٢٤ و١٦ — وكلُّ ساعةٍ من مصدرها', () => {
    const [a, b] = [course('C-JOB-101'), course('C-JOB-104')]
    expect([a.total_hours, b.total_hours]).toEqual([24, 16])
    /* والتفصيلُ جمعُ تفصيلَي الجزأين كما كانا — مكتوبا من المصدر. ولا يُشترط
       أن يُجمَع إلى الإجماليّ: عشرون دورةً في الكتالوج (كلُّ «-105» منها)
       تفصيلُها عشرُ ساعاتٍ من ثمانٍ، ومنها C-JOB-105 — نمطٌ قائمٌ لا يُصلَح هنا */
    expect([a.guided_hours, a.independent_hours, a.practice_hours]).toEqual([3 + 1.5, 5 + 2.5, 8 + 4])
    expect([b.guided_hours, b.independent_hours, b.practice_hours]).toEqual([2.5 + 2, 3.5 + 2, 4 + 4])
    const p = core.launch_pathways.find((x) => x.id === 'PW-STU-002')!
    expect(p.course_ids).toEqual(['C-JOB-101', 'C-JOB-104'])
    expect([p.course_count, p.total_hours, p.module_count]).toEqual([2, 40, 20])
  })

  it('ومهاراتُ الدورات الأربع كلُّها باقيةٌ في اثنتين — والمعرّفُ والاسمُ مع كلٍّ منها', () => {
    /* مكتوبةٌ من الدورات الأربع قبل الدمج، لا مقروءةٌ من الناتج:
       حارسٌ يقارن الدمجَ بنفسِه يخضرّ وإن سقطت مهارة */
    expect(course('C-JOB-101').skill_slugs).toEqual([
      'career_planning', 'market_research', 'personal_branding', 'workplace_professionalism',
      'cv_writing', 'linkedin_profile', 'arabic_business_writing', // C-JOB-101
      'portfolio_building', 'learning_transfer', 'project_management', 'feedback_receiving', // C-JOB-103
    ])
    expect(course('C-JOB-104').skill_slugs).toEqual([
      'job_search_strategy', 'networking', 'time_management', 'accountability', // C-JOB-105
      'interview_skills', 'clear_expression', 'active_listening', 'voice_and_presence', // C-JOB-104
    ])
    for (const id of ['C-JOB-101', 'C-JOB-104']) {
      const c = course(id)
      expect([c.skill_ids.length, c.skill_names_ar.length], id).toEqual([c.skill_slugs.length, c.skill_slugs.length])
    }
    expect(course('C-JOB-101').learning_outcomes_ar).toHaveLength(12)
    expect(course('C-JOB-104').learning_outcomes_ar).toHaveLength(8)
  })
})

describe('③ والمدموجةُ دورةٌ واحدةٌ متّسقة', () => {
  it('سُلّمُ تقييم كلٍّ منهما يُجمع مئة', () => {
    for (const id of ['C-JOB-101', 'C-JOB-104']) {
      const weights = course(id).rubric_criteria_ar.map((r) => Number(/(\d+)%/.exec(r)?.[1] ?? NaN))
      expect(weights.every((w) => Number.isFinite(w)), `${id}: معيارٌ بلا وزن`).toBe(true)
      expect(weights.reduce((s, w) => s + w, 0), id).toBe(100)
    }
  })
})
