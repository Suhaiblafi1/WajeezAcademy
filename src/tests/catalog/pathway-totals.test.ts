/* مجاميعُ المسار مخزَّنةٌ ومحسوبةٌ معا — ورقمانِ لشيءٍ واحدٍ يفترقان.

   ── أين يُقرأ كلٌّ منهما ──

   `total_hours` و`module_count` و`course_count` و`support_hours` مكتوبةٌ
   أرقاما في `core-catalog.v2.json` لكلِّ مسار. و`src/data/pathways.ts:149`
   يقرأ **المخزَّن** ويعرضه على صفحة المسار، بينما
   `server/catalog/snapshot-builder.ts:170` **يحسبه** من دوراته عند نشر
   اللقطة. فمصدرانِ لرقمٍ واحد، ولا شيءَ يقول إنّهما اتّفقا.

   ── ولماذا يهمّ ──

   الرقمُ ليس عدّادا داخليّا: «٥٦ ساعة تعلم» تُطبَع في `credential_ar`
   وتُعرَض للزائر قبل الشراء. فدورةٌ تُضاف إلى مسارٍ أو تتغيّر ساعاتُها،
   ويُنسى تحديثُ المجموع، تعني صفحةً تَعِد بأربعين واللقطةَ تنشر ستّا
   وخمسين — بلا أن يشتكيَ شيء.

   والحاجةُ صارت أقرب: أُضيف المسارُ الحادي والعشرون (PW-GRPH-001) بمجاميعَ
   مكتوبةٍ بيدِ سكربتٍ لا محسوبةٍ في الشيفرة. فلو أخطأ السكربتُ رقما لمرّ.

   ⚠ أُثبت سقوطُه: نُقض `total_hours` لمسارٍ واحدٍ فسقط الفحصُ مسمّيا المسارَ
   والحقلَ والرقمين، ثمّ أُعيد فخضرّ. */

import { describe, expect, it } from 'vitest'
import coreCatalog from '../../data/catalog/core-catalog.v2.json'

interface RawCourse { course_id: string; total_hours: number }
interface RawModule { course_id: string }
interface RawPathway {
  id: string
  course_ids: string[]
  total_hours: number
  course_count: number
  module_count: number
  support_hours?: number
  support_course_count?: number
  support_courses?: { course_id: string }[]
}

const raw = coreCatalog as unknown as {
  courses: RawCourse[]
  modules: RawModule[]
  launch_pathways: RawPathway[]
}

const hoursOf = new Map(raw.courses.map((c) => [c.course_id, c.total_hours]))
const modulesOf = raw.modules.reduce<Record<string, number>>((acc, m) => {
  acc[m.course_id] = (acc[m.course_id] ?? 0) + 1
  return acc
}, {})

describe('مجاميعُ المسار: المخزَّنُ يطابق المحسوبَ من دوراته', () => {
  it('القراءةُ تعمل — فلا يخضرّ الحارسُ على كتالوجٍ فارغ', () => {
    expect(raw.launch_pathways.length).toBeGreaterThan(10)
    expect(hoursOf.size).toBeGreaterThan(50)
    expect(Object.keys(modulesOf).length).toBeGreaterThan(50)
  })

  it('لا مسارَ يعلن ساعاتٍ أو وحداتٍ أو عددَ دوراتٍ يخالف ما في دوراته', () => {
    const drift: string[] = []
    for (const p of raw.launch_pathways) {
      const hours = p.course_ids.reduce((s, cid) => s + (hoursOf.get(cid) ?? 0), 0)
      const modules = p.course_ids.reduce((s, cid) => s + (modulesOf[cid] ?? 0), 0)
      if (p.total_hours !== hours) drift.push(`${p.id}: total_hours ${p.total_hours} والمحسوبُ ${hours}`)
      if (p.module_count !== modules) drift.push(`${p.id}: module_count ${p.module_count} والمحسوبُ ${modules}`)
      if (p.course_count !== p.course_ids.length) {
        drift.push(`${p.id}: course_count ${p.course_count} وطولُ course_ids ${p.course_ids.length}`)
      }
    }
    expect(drift, 'صفحةُ المسار تعرض المخزَّن واللقطةُ تنشر المحسوب: ' + drift.join(' · ')).toEqual([])
  })

  it('ولا مسارَ يعلن ساعاتِ مساندةٍ أو عددَها يخالف مساندَيه', () => {
    const drift: string[] = []
    for (const p of raw.launch_pathways) {
      const sup = p.support_courses ?? []
      const hours = sup.reduce((s, sc) => s + (hoursOf.get(sc.course_id) ?? 0), 0)
      if (p.support_hours !== hours) drift.push(`${p.id}: support_hours ${p.support_hours} والمحسوبُ ${hours}`)
      if (p.support_course_count !== sup.length) {
        drift.push(`${p.id}: support_course_count ${p.support_course_count} والفعليُّ ${sup.length}`)
      }
    }
    expect(drift, 'المساندةُ تُعرض بساعاتٍ ليست ساعاتِها: ' + drift.join(' · ')).toEqual([])
  })
})
