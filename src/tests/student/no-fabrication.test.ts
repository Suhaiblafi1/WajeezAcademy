/* حارس ضد عودة التلفيق إلى بوابة المتعلم.
   ------------------------------------------------------------------
   كان `src/data/student.ts` يبذر إشعارات «وصلت فاتورتك وتأكيد الدفع على
   بريدك» لمن لم يدفع، ويسكّ شهادةً برقم عشوائي في المتصفّح، ويخترع اختبارا
   من أربعة أسئلة قالبية وجلستَي زووم لكل دورة، ويحسب مستوى المهارة بمعادلة
   `1 + المكتمل × 2`. حُذف ذلك كلّه. وهذا الملف يجعل عودته حمراء لا صامتة:
   كلُّ تأكيدٍ هنا يقابل تلفيقا بعينه كان يُعرض لمستخدم حقيقي. */

import { beforeAll, describe, expect, it } from 'vitest'
import { pathways } from '../../data/pathways'
import { pathwayCourses, courseById, courseFullById } from '../../data/courses'

/* المتجر المحلي غير موجود في بيئة node — بديلٌ في الذاكرة يكفي `seedPortal` */
beforeAll(() => {
  const mem = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
})

/* الاستيراد بعد تركيب المتجر — الوحدة لا تلمسه عند التحميل لكنّ التأكيد أأمن */
const mod = () => import('../../data/student')

describe('بوابة المتعلم لا تختلق بيانات', () => {
  it('البذر لا يُنشئ إشعارا واحدا', async () => {
    const { seedPortal } = await mod()
    const pid = pathways[0]!.id
    expect(seedPortal(pid).notifications).toEqual([])
  })

  it('لا دالة تسكّ شهادة أو تتحقق منها محليا', async () => {
    const keys = Object.keys(await mod())
    for (const forbidden of ['issueCertificate', 'loadCertificates', 'verifyCertificate']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('لا اختبار مُركَّب ولا جلسات مخترعة', async () => {
    const keys = Object.keys(await mod())
    for (const forbidden of ['courseQuiz', 'courseSessions', 'QUIZ_PASS', 'QUIZ_MAX_ATTEMPTS', 'pathwaySkills']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('كل درس يُعرض له وحدة حقيقية في الكتالوج', async () => {
    const { courseLessons } = await mod()
    const ids = pathways.flatMap((p) => pathwayCourses[p.id] ?? [])
    let checked = 0
    for (const id of [...new Set(ids)]) {
      const c = courseById(id)
      if (!c) continue
      const real = new Set((courseFullById(id)?.modules ?? []).map((m) => m.id))
      for (const l of courseLessons(c)) {
        expect(real.has(l.id), `درس «${l.title}» في ${id} لا وحدة له في الكتالوج`).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('الدورة لا تكتمل إلا باعتماد المدرّب — لا بمجرد التسليم', async () => {
    const { isCourseComplete } = await mod()
    const id = (pathwayCourses[pathways[0]!.id] ?? [])[0]!
    const c = courseById(id)!
    const lessons = (courseFullById(id)?.modules ?? []).map((m) => m.id)
    const done = Object.fromEntries(lessons.map((l) => [l, { pct: 100 }]))
    const base = { lessons: done, attendance: null, bookQuiz: {} } as const
    expect(isCourseComplete(c, { ...base, assignment: { status: 'submitted' } })).toBe(false)
    expect(isCourseComplete(c, { ...base, assignment: { status: 'under_review' } })).toBe(false)
    expect(isCourseComplete(c, { ...base, assignment: { status: 'approved' } })).toBe(true)
  })

  it('لا شرطَ فتحٍ للمشروع مُقرٌّ سلفا بلا قياس', async () => {
    const { projectConditions, seedPortal } = await mod()
    const pid = pathways.find((p) => (pathwayCourses[p.id] ?? []).length > 0)!.id
    const conds = projectConditions(pid, seedPortal(pid))
    expect(conds.length).toBeGreaterThan(0)
    /* كان فيها «الحساب المالي غير متعثر» بقيمة `met: true` ثابتة */
    expect(conds.every((c) => c.met === false)).toBe(true)
  })
})
