/* الدورات المساندة: عرضٌ في المسار الجاهز، لا إشارةُ تشخيص.

   شرط صاحب المنصّة كان صريحا: «المساندات في المسارات الجاهزة تمام، أمّا
   للتشخيص فكلّ الدورات تظهر حسب الاحتياج وحسب التشخيص».

   وترجمةُ الشرط إلى بنية: `course_ids` وحدها يقرؤها `pathwaySkills`
   (catalog.ts)، ومنها يشتقّ `scoreSkillGap` فجوةَ المهارات التي تزن ٢٥٪ من
   ترتيب المسارات (pathway-score.ts). فمساندةٌ تتسرّب إلى `course_ids` تضيف
   مهاراتِها إلى متطلّبات المسار، فيرتفع أو ينخفض ترتيبه لكلّ متعلّم — تغيّرٌ
   في القياس مصدرُه قرارُ عرضٍ تسويقيّ. وهذا ما يمنعه هذا الملف.

   والاختبار ليس على النيّة بل على الأثر: يُحسب متّجهُ مهاراتٍ ويُرتَّب به
   المسارات مرّتين، مرّةً كما هو ومرّةً بعد إقحام كلّ المساندات في
   `course_ids` — فإن تطابق الترتيبان كان الفصلُ وهما. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchPathways, pathwaySkills, courseById } from '../../domain/diagnostic/catalog'
import { pathwayCourses, pathwaySupportCourses, readyPathwayCourseIds, MIN_PATHWAY_COURSES, MAX_PATHWAY_COURSES, SUPPORT_PER_PATHWAY } from '../../data/courses'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as {
  launch_pathways: { id: string; course_ids: string[]; support_courses?: { course_id: string; reason_ar: string }[] }[]
  courses: { course_id: string; pathway_id: string; skill_slugs: string[] }[]
}

describe('الدورات المساندة — بنيتها', () => {
  /* ستّ دورات لا سبع: أربعٌ أساسية ومساندتان. كانت ثلاث مساندات فصار
     المجموع سبعا — أثقل ممّا اتُّفق عليه — فحُذفت الأخيرة من كلّ مسار. */
  it('كل مسار جاهز: أربعُ أساسيات على الأقل ومساندتان بالضبط — والمجموع ستّ', () => {
    for (const p of CORE.launch_pathways) {
      expect(p.course_ids.length, p.id).toBeGreaterThanOrEqual(MIN_PATHWAY_COURSES)
      expect(p.support_courses?.length ?? 0, p.id).toBe(SUPPORT_PER_PATHWAY)
      expect(p.course_ids.length + (p.support_courses?.length ?? 0), p.id)
        .toBeLessThanOrEqual(MAX_PATHWAY_COURSES)
    }
  })

  it('لا مساندة تكرّر دورةً أساسية في مسارها، ولكلٍّ سببٌ مكتوب', () => {
    for (const p of CORE.launch_pathways) {
      const core = new Set(p.course_ids)
      for (const s of p.support_courses ?? []) {
        expect(core.has(s.course_id), `${p.id} · ${s.course_id}`).toBe(false)
        expect(s.reason_ar.trim().length, `${p.id} · ${s.course_id}`).toBeGreaterThan(20)
      }
    }
  })

  it('المساندات متنوّعة: لا ثلاثيّ واحد يتكرّر على كل المسارات', () => {
    const trios = CORE.launch_pathways.map((p) => (p.support_courses ?? []).map((s) => s.course_id).sort().join('+'))
    expect(new Set(trios).size).toBe(trios.length)
    const distinct = new Set(CORE.launch_pathways.flatMap((p) => (p.support_courses ?? []).map((s) => s.course_id)))
    expect(distinct.size).toBeGreaterThanOrEqual(20)
  })

  it('المسار الجاهز كما يُعرض لا يتجاوز سقف الدورات', () => {
    for (const p of CORE.launch_pathways) {
      expect(readyPathwayCourseIds(p.id).length, p.id).toBeLessThanOrEqual(MAX_PATHWAY_COURSES)
    }
  })
})

describe('الدورات المساندة — لا تصل إلى التشخيص', () => {
  it('pathwayCourses (وهي مصدر التشخيص) نسخةٌ من course_ids بلا مساندة', () => {
    for (const p of CORE.launch_pathways) {
      expect(pathwayCourses[p.id]).toEqual(p.course_ids)
      const sup = (p.support_courses ?? []).map((s) => s.course_id)
      for (const id of sup) expect(pathwayCourses[p.id], `${p.id} · ${id}`).not.toContain(id)
      expect(pathwaySupportCourses[p.id].map((s) => s.courseId)).toEqual(sup)
    }
  })

  it('pathwaySkills لا يحمل مهارةً مصدرُها مساندةٌ وحدها', () => {
    let checked = 0
    for (const p of CORE.launch_pathways) {
      const measured = new Set(pathwaySkills(p.id).map((s) => s.slug))
      const coreSlugs = new Set(p.course_ids.flatMap((id) => courseById.get(id)?.skill_slugs ?? []))
      /* لا مهارة في متطلّبات المسار خارج مهارات دوراته الأساسية */
      for (const slug of measured) expect(coreSlugs.has(slug), `${p.id} · ${slug}`).toBe(true)
      for (const s of p.support_courses ?? []) {
        const onlyFromSupport = (courseById.get(s.course_id)?.skill_slugs ?? []).filter((x) => !coreSlugs.has(x))
        for (const slug of onlyFromSupport) {
          expect(measured.has(slug), `${p.id}: ${slug} من المساندة ${s.course_id} تسرّبت إلى متطلّبات المسار`).toBe(false)
          checked++
        }
      }
    }
    /* الفحص عديم القيمة لو لم تحمل أيّ مساندةٍ مهارةً جديدة — نثبت أنّه فحص */
    expect(checked).toBeGreaterThan(20)
  })

  it('الفصل ليس وهما: إقحام المساندات في course_ids يغيّر متطلّبات المسارات فعلا', () => {
    /* لو كان إدخال المساندات لا يغيّر شيئا لما كان الفصل يحمي شيئا. */
    const changed = CORE.launch_pathways.filter((p) => {
      const before = new Set(pathwaySkills(p.id).map((s) => s.slug))
      const after = new Set([
        ...before,
        ...(p.support_courses ?? []).flatMap((s) => courseById.get(s.course_id)?.skill_slugs ?? []),
      ])
      return after.size > before.size
    })
    expect(changed.length).toBe(CORE.launch_pathways.length)
  })

  it('launchPathways المحمَّل في المحرّك يرى course_ids نفسها لا المعروضة', () => {
    for (const p of launchPathways) {
      const src = CORE.launch_pathways.find((x) => x.id === p.id)!
      expect(p.course_ids).toEqual(src.course_ids)
    }
  })
})
