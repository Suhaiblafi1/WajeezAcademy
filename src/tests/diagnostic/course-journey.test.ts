import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { courseFullById, pathwayDelivery } from '../../data/courses'
import coreCatalog from '../../data/catalog/core-catalog.v2.json'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

interface RawPathway {
  id: string
  course_ids: string[]
}

describe('رحلة الدورات — اكتمال بيانات العرض', () => {
  const pathways = (coreCatalog as { launch_pathways: RawPathway[] }).launch_pathways

  it('كل دورة في كل مسار من المسارات العشرين لها بيانات الرحلة كاملة', () => {
    const missing: string[] = []
    for (const p of pathways) {
      for (const cid of p.course_ids) {
        const c = courseFullById(cid)
        if (!c) {
          missing.push(`${cid}: غير موجودة`)
          continue
        }
        if (!c.title || c.title.length < 5) missing.push(`${cid}: بلا عنوان`)
        if (c.modules.length < 3) missing.push(`${cid}: وحدات أقل من 3`)
        for (const m of c.modules) {
          if (!m.outcome) missing.push(`${cid}/${m.id}: وحدة بلا مخرج`)
        }
        if (c.learningObjectives.length === 0) missing.push(`${cid}: بلا أهداف`)
        if (c.learningOutcomes.length === 0) missing.push(`${cid}: بلا مخرجات`)
        if (!c.practicalProject) missing.push(`${cid}: بلا مشروع تطبيقي`)
        if (!c.shortPromise) missing.push(`${cid}: بلا وعد قصير`)
      }
    }
    expect(missing).toEqual([])
  })

  it('كل مسار يحمل وصف تقديم (مسجل/مباشر) ليظهر في الرحلة', () => {
    const missing = pathways.filter((p) => !pathwayDelivery(p.id)).map((p) => p.id)
    expect(missing).toEqual([])
  })

  it('المكوّن يستخدم Collapsible لا Modal — لا نافذة منبثقة في الرحلة', () => {
    const src = readFileSync(join(root, 'src/components/CourseJourney.tsx'), 'utf8')
    expect(src).not.toMatch(/from\s+['"][^'"]*dialog['"]/i)
    expect(src).not.toContain('<Modal')
    expect(src).not.toContain('<Dialog')
    expect(src).toContain('Collapsible')
  })

  it('عنوان القسم هو سؤال الإنجاز لا مجرد قائمة', () => {
    const src = readFileSync(join(root, 'src/components/CourseJourney.tsx'), 'utf8')
    expect(src).toContain('ماذا ستحقق من خلال خطتك؟')
  })
})
