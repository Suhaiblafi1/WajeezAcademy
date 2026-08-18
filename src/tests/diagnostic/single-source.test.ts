/* إثبات وحدة المصدر: الدورة كيان مركزي واحد في core-catalog.v2.json،
   وتعديلها ينعكس على المحرك والواجهة دون تعديل أي مكان آخر.
   المهندس المعماري: الحقول المضمنة في القوالب (course_title_ar/hours) توثيقية
   للمراجعة البشرية فقط — هذا الاختبار يثبت أن المحرك يتجاهلها حتى لو فسدت. */

import { describe, expect, it } from 'vitest'
import { buildCoursePlan } from '../../domain/diagnostic/composite'
import { compositeTemplates, courseById, launchPathways, type CompositeTemplate } from '../../domain/diagnostic/catalog'
import { courses, pathwayCourses, courseFullById } from '../../data/courses'

describe('وحدة مصدر الدورة — الدورة كيان مركزي واحد', () => {
  const venture = compositeTemplates.find((t) => t.template_id === 'TPL-VENTURE-001')!

  it('خطة القالب المركب تعرض عنوان الدورة وساعاتها من الكتالوج المركزي حصرا', () => {
    const plan = buildCoursePlan(venture, 'full', [])
    expect(plan.items.length).toBeGreaterThan(0)
    for (const item of plan.items) {
      const central = courseById.get(item.courseId)!
      expect(item.titleAr).toBe(central.title_ar)
      expect(item.hours).toBe(central.total_hours)
    }
  })

  it('المحرك يتجاهل النسخة المضمنة في القالب حتى لو فسدت — لا يعتمد إلا على المركزي', () => {
    /* نستنسخ القالب ونفسد نسخه المضمنة عمدا: عنوان مزيف وساعات مزيفة */
    const corrupted: CompositeTemplate = JSON.parse(JSON.stringify(venture))
    for (const list of [corrupted.required_courses, corrupted.conditional_courses ?? [], corrupted.bridge_courses ?? [], corrupted.starter_courses ?? []]) {
      for (const ref of list) {
        ref.course_title_ar = 'عنوان مزيف لا يجب أن يظهر'
        ref.hours = 999
      }
    }
    const plan = buildCoursePlan(corrupted, 'full', [])
    expect(plan.items.length).toBeGreaterThan(0)
    for (const item of plan.items) {
      const central = courseById.get(item.courseId)!
      expect(item.titleAr).toBe(central.title_ar)
      expect(item.titleAr).not.toBe('عنوان مزيف لا يجب أن يظهر')
      expect(item.hours).toBe(central.total_hours)
      expect(item.hours).not.toBe(999)
    }
  })

  it('محوّل الواجهة (courses.ts) يشتق اسمه ومساره من الكتالوج المركزي ذاته', () => {
    expect(courses.length).toBe(100)
    for (const c of courses.slice(0, 20)) {
      const central = courseById.get(c.id)!
      expect(c.name).toBe(central.title_ar)
      expect(c.pathwayId).toBe(central.pathway_id)
    }
  })

  it('قوائم دورات المسارات في الواجهة هي مراجع course_ids المركزية ذاتها', () => {
    for (const p of launchPathways) {
      expect(pathwayCourses[p.id]).toEqual(p.course_ids)
    }
  })

  it('تفاصيل الدورة المعروضة (المحاور والمخرجات) تُشتق من الكتالوج المركزي', () => {
    const anyId = launchPathways[0].course_ids[0]
    const full = courseFullById(anyId)!
    const central = courseById.get(anyId)!
    expect(full.title).toBe(central.title_ar)
    expect(full.totalHours).toBe(central.total_hours)
    expect(full.relatedSkills).toEqual(central.skill_names_ar)
  })

  it('تعديل مركزي واحد ينعكس على كل السطوح: محاكاة تغيير عنوان في الكتالوج', () => {
    /* نغيّر العنوان في كائن الكتالوج المركزي مباشرة (ذاكرة الاختبار فقط) */
    const target = compositeTemplates.find((t) => t.template_id === 'TPL-VENTURE-001')!
    const anyCourseId = target.required_courses[0].course_id
    const central = courseById.get(anyCourseId)!
    const original = central.title_ar
    central.title_ar = 'عنوان جديد معدل مركزيا'
    try {
      /* المحرك */
      const plan = buildCoursePlan(target, 'full', [])
      expect(plan.items.find((i) => i.courseId === anyCourseId)?.titleAr).toBe('عنوان جديد معدل مركزيا')
    } finally {
      central.title_ar = original
    }
  })
})
