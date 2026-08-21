import { describe, expect, it } from 'vitest'
import { courseById, launchPathways } from '../../domain/diagnostic/catalog'
import {
  buildPathwayMap,
  enrollmentFactsFromApi,
  NODE_LABEL_AR,
  type EnrollmentFact,
} from '../../application/student/pathway-map'

function richPathway() {
  const p = launchPathways.find((x) => x.course_ids.filter((c) => courseById.has(c)).length >= 4)
  expect(p, 'يجب أن يوجد مسار بأربع دورات على الأقل في الكتالوج').toBeTruthy()
  return p!
}

describe('خريطة المسار — الترتيب والحالات', () => {
  it('بلا مسار أو بمسار غير موجود تعيد null ولا تختلق خريطة', () => {
    expect(buildPathwayMap(null, [])).toBeNull()
    expect(buildPathwayMap('PW-LA-YOUJAD', [])).toBeNull()
  })

  it('الترتيب من تسلسل الكتالوج لا من ترتيب التسجيلات', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    /* نمرّر الوقائع معكوسة عمدا */
    const facts: EnrollmentFact[] = [...ids].reverse().map((id) => ({ courseId: id, enrolled: true, percent: 10, completed: false }))
    const map = buildPathwayMap(pw.id, facts)!
    const seqs = map.nodes.map((n) => n.sequence)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
  })

  it('دورة بلا تسجيل percent = null لا صفرا — والصفر يعني «سجّل ولم يبدأ»', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const map = buildPathwayMap(pw.id, [{ courseId: ids[0], enrolled: true, percent: 0, completed: false }])!
    const enrolled = map.nodes.find((n) => n.id === ids[0])!
    const untouched = map.nodes.find((n) => n.id === ids[1])!
    expect(enrolled.percent).toBe(0)
    expect(enrolled.state).toBe('enrolled')
    expect(untouched.percent).toBeNull()
    expect(untouched.state).toBe('not_enrolled')
  })

  it('الحالات: مكتملة ١٠٠٪ أو بشهادة، وجارية بتقدم بين ١ و٩٩', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const map = buildPathwayMap(pw.id, [
      { courseId: ids[0], enrolled: true, percent: 100, completed: false },
      { courseId: ids[1], enrolled: true, percent: 40, completed: false },
      { courseId: ids[2], enrolled: true, percent: 5, completed: true },
    ])!
    const byId = new Map(map.nodes.map((n) => [n.id, n]))
    expect(byId.get(ids[0])!.state).toBe('completed')
    expect(byId.get(ids[1])!.state).toBe('in_progress')
    expect(byId.get(ids[2])!.state).toBe('completed')
  })

  it('currentIndex أول غير مكتملة، و-1 عند إكمال المسار', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const partial = buildPathwayMap(pw.id, [{ courseId: ids[0], enrolled: true, percent: 100, completed: true }])!
    expect(partial.currentIndex).toBe(1)
    expect(partial.completedCount).toBe(1)

    const all = buildPathwayMap(pw.id, ids.map((id) => ({ courseId: id, enrolled: true, percent: 100, completed: true })))!
    expect(all.currentIndex).toBe(-1)
    expect(all.completedCount).toBe(all.totalCount)
    expect(all.doneHours).toBe(all.totalHours)
  })

  it('تسجيلان لنفس الدورة: يُبقى الأعلى تقدما ولا تتكرر العقدة', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const map = buildPathwayMap(pw.id, [
      { courseId: ids[0], enrolled: true, percent: 10, completed: false },
      { courseId: ids[0], enrolled: true, percent: 100, completed: true },
    ])!
    expect(map.nodes.filter((n) => n.id === ids[0])).toHaveLength(1)
    expect(map.nodes.find((n) => n.id === ids[0])!.state).toBe('completed')
  })


  it('enrolled: false يعني «لم تُسجّل» حتى لو حمل الواقع تقدما — التسجيل صريح', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const map = buildPathwayMap(pw.id, [{ courseId: ids[0], enrolled: false, percent: 80, completed: false }])!
    const node = map.nodes.find((n) => n.id === ids[0])!
    expect(node.state).toBe('not_enrolled')
    expect(node.percent).toBeNull()
  })

  it('التسمية البديلة من المصدر تُقدَّم على التسمية الافتراضية', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const map = buildPathwayMap(pw.id, [{ courseId: ids[0], enrolled: false, percent: null, completed: false, labelAr: 'مقفلة' }])!
    expect(map.nodes.find((n) => n.id === ids[0])!.labelAr).toBe('مقفلة')
  })

  it('لكل حالة تسمية عربية — فلا تُقرأ الحالة من اللون وحده', () => {
    for (const s of ['completed', 'in_progress', 'enrolled', 'not_enrolled'] as const) {
      expect(NODE_LABEL_AR[s].length).toBeGreaterThan(2)
    }
  })

  it('مجموع الساعات من الكتالوج، والمنجَز مجموع ساعات المكتملة فقط', () => {
    const pw = richPathway()
    const ids = pw.course_ids.filter((c) => courseById.has(c))
    const map = buildPathwayMap(pw.id, [{ courseId: ids[0], enrolled: true, percent: 100, completed: true }])!
    expect(map.totalHours).toBe(map.nodes.reduce((s, n) => s + n.hours, 0))
    expect(map.doneHours).toBe(courseById.get(ids[0])!.total_hours)
  })
})

describe('خريطة المسار — قراءة رد الخادم', () => {
  it('تستخلص معرّف الدورة والتقدم، وتتجاهل الصفوف بلا معرّف', () => {
    const facts = enrollmentFactsFromApi([
      { status: 'enrolled', cohort: { course: { id: 'C-A' } }, courseProgress: { percent: 42 }, certificates: [] },
      { status: 'enrolled', cohort: { course: {} }, courseProgress: { percent: 10 } },
      { status: 'enrolled', cohort: null },
      null,
    ])
    expect(facts).toEqual([{ courseId: 'C-A', enrolled: true, percent: 42, completed: false }])
  })

  it('الإكمال من الحالة أو من شهادة صادرة أو من ١٠٠٪', () => {
    const [a, b, c] = enrollmentFactsFromApi([
      { status: 'completed', cohort: { course: { id: 'C-A' } }, courseProgress: null, certificates: [] },
      { status: 'enrolled', cohort: { course: { id: 'C-B' } }, courseProgress: { percent: 30 }, certificates: [{}] },
      { status: 'enrolled', cohort: { course: { id: 'C-C' } }, courseProgress: { percent: 100 }, certificates: [] },
    ])
    expect(a.completed).toBe(true)
    expect(b.completed).toBe(true)
    expect(c.completed).toBe(true)
  })

  it('بلا سجل تقدم يبقى null، والقيم الشاذة لا تصير أصفارا صامتة', () => {
    const [a, b] = enrollmentFactsFromApi([
      { status: 'enrolled', cohort: { course: { id: 'C-A' } }, courseProgress: null },
      { status: 'enrolled', cohort: { course: { id: 'C-B' } }, courseProgress: { percent: Number.NaN } },
    ])
    expect(a.percent).toBeNull()
    expect(b.percent).toBeNull()
  })

  it('التقدم يُحدّ بين ٠ و١٠٠', () => {
    const [a, b] = enrollmentFactsFromApi([
      { status: 'enrolled', cohort: { course: { id: 'C-A' } }, courseProgress: { percent: 250 } },
      { status: 'enrolled', cohort: { course: { id: 'C-B' } }, courseProgress: { percent: -5 } },
    ])
    expect(a.percent).toBe(100)
    expect(b.percent).toBe(0)
  })

  it('رد غير مصفوفة لا يُسقط الصفحة', () => {
    expect(enrollmentFactsFromApi(null)).toEqual([])
    expect(enrollmentFactsFromApi({ rows: [] })).toEqual([])
  })
})
