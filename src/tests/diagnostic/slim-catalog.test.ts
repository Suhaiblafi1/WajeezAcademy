/* موجة ٦ · ج — القاموس النحيف يحمل ما يقرؤه المحرك، لا أقل.

   الخطر الحقيقي في نسخة نحيفة: حقلٌ يُستعمل ويسقط منها، فيتوقف شيء بصمت على
   الحزمة المضمنة وحدها. وقد وقع نظيرُه فعلا في الاتجاه الآخر: اللقطة المنشورة
   لم تكن تحمل `source_frameworks`، فمراجع المنهجية لم تكن تظهر في الإنتاج
   إطلاقا وتظهر على المضمن — عيبٌ صامت لأن لا اختبار يقارن الشكلين. */

import { describe, expect, it } from 'vitest'
import slim from '../../data/catalog/skills.slim.v1.json'
import full from '../../data/catalog/skills.v1.ar.json'
import { skillsCatalog } from '../../domain/diagnostic/catalog'

const slimSkills = (slim as { skills: Record<string, unknown>[] }).skills
const fullSkills = (full as { skills: Record<string, unknown>[] }).skills

describe('النحيف مشتق من الكامل لا مكتوب', () => {
  it('نفس عدد المهارات وبنفس الترتيب', () => {
    expect(slimSkills).toHaveLength(fullSkills.length)
    expect(slimSkills.map((s) => s.slug)).toEqual(fullSkills.map((s) => s.slug))
  })

  it('كل قيمة في النحيف تساوي نظيرتها في الكامل — لا تحرير يدوي', () => {
    for (let i = 0; i < slimSkills.length; i++) {
      for (const [k, v] of Object.entries(slimSkills[i])) {
        expect(v, `${slimSkills[i].slug}.${k}`).toEqual(fullSkills[i][k])
      }
    }
  })

  it('أصغر من الكامل بفارق يستحق العناء — وإلا فلا داعي لنسخة ثانية', () => {
    const slimSize = JSON.stringify(slim).length
    const fullSize = JSON.stringify(full).length
    expect(slimSize).toBeLessThan(fullSize * 0.35)
  })
})

describe('لا حقل يقرؤه المحرك ساقط', () => {
  it('الحقول الأربعة الأساسية موجودة في كل صفّ', () => {
    for (const s of slimSkills) {
      expect(s.skill_id, String(s.slug)).toBeTruthy()
      expect(s.slug).toBeTruthy()
      expect(s.name_ar).toBeTruthy()
    }
  })

  it('الأطر المرجعية محفوظة — تقرؤها مراجع المنهجية لتقرير ما يُذكر للمتعلم', () => {
    const withFw = slimSkills.filter((s) => Array.isArray(s.source_frameworks) && (s.source_frameworks as unknown[]).length > 0)
    expect(withFw.length).toBe(fullSkills.filter((s) => Array.isArray(s.source_frameworks) && (s.source_frameworks as unknown[]).length > 0).length)
    expect(withFw.length).toBeGreaterThan(100)
  })

  it('قرار الدمج والتفعيل محفوظ — بدونه تعود المهارة المدموجة نشطة تشخيصيا', () => {
    const mergedFull = fullSkills.filter((s) => s.merged_into)
    const mergedSlim = slimSkills.filter((s) => s.merged_into)
    expect(mergedSlim.map((s) => s.slug)).toEqual(mergedFull.map((s) => s.slug))
    for (const s of mergedSlim) expect(s.merge_date).toBeTruthy()
  })

  it('الكتالوج المثبَّت يرى كل المهارات — النحيف لا يُنقص عددا', () => {
    const extensions = 89 // امتدادات core-catalog
    expect(skillsCatalog.length).toBe(fullSkills.length + extensions)
  })
})
