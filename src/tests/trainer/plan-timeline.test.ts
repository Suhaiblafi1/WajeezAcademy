/* سجلُّ تواصل الخطّة ووسمُ جولتها — المحضُ والشاشتان (١٧ أكتوبر ٢٠٢٦) */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planReturns, planTimeline, roundLabelAr, type PlanEvent } from '@/application/trainer/plan-timeline'

const t = (m: number) => new Date(Date.UTC(2026, 9, 1, 9, m)).toISOString()
const ev = (action: string, m: number, meta?: Record<string, unknown>, by: string | null = 'س'): PlanEvent => ({ action, at: t(m), by, meta })

describe('① الجولة', () => {
  it('جديدة ما لم ترد — والردّ والتأجيل كلاهما ردّ', () => {
    expect(planReturns([ev('cohort.plan.submit', 1)])).toBe(0)
    expect(roundLabelAr(0)).toBe('جديدة')
    const r = planReturns([ev('cohort.plan.submit', 1), ev('cohort.plan.changes_requested', 2), ev('cohort.plan.postpone', 3)])
    expect(r).toBe(2)
    expect(roundLabelAr(1)).toBe('أعادها بعد التعديلات · الجولة 2')
  })
})

describe('② السجل', () => {
  const events = [
    ev('cohort.plan.save', 0),
    ev('cohort.plan.submit', 1),
    ev('cohort.plan.edits.propose', 2, { count: 7 }, 'المدير'),
    ev('cohort.plan.changes_requested', 3, {}, 'المدير'),
    ev('cohort.plan.edit.accept', 4),
    ev('cohort.plan.edit.accept', 5),
    ev('cohort.plan.edit.reject', 6),
    ev('cohort.plan.submit', 7),
    ev('cohort.plan.review_bundle', 8, {}, 'المدير'),
    ev('cohort.plan.approve', 9, {}, 'المدير'),
  ]
  const lines = planTimeline([...events].reverse())

  it('بالترتيب، والحفظ والتنزيل ليسا تواصلا', () => {
    expect(lines.map((l) => l.labelAr)).toEqual([
      'أرسل الخطة للاعتماد',
      'أرسلت 7 بطاقة تعديل',
      'ردّت الخطة بتعديلات',
      'قبل 2 بطاقة ورفض 1 بطاقة',
      'أعاد إرسال الخطة بعد التعديلات',
      'اعتمدت الخطة',
    ])
  })

  it('ومن فعل: الإدارة أم المدرب، باسمه وتاريخه', () => {
    expect(lines.map((l) => l.side)).toEqual(['trainer', 'admin', 'admin', 'trainer', 'trainer', 'admin'])
    expect(lines[1]!.by).toBe('المدير')
    /* وسطرُ البطاقات بتاريخ آخرها */
    expect(lines[3]!.at).toBe(t(6))
  })

  it('وقرارات البطاقات يفصلها حدث بينها', () => {
    const l = planTimeline([ev('cohort.plan.edit.accept', 1), ev('cohort.plan.edits.propose', 2, { count: 1 }), ev('cohort.plan.edit.reject', 3)])
    expect(l.map((x) => x.labelAr)).toEqual(['قبل 1 بطاقة', 'أرسلت 1 بطاقة تعديل', 'رفض 1 بطاقة'])
  })
})

describe('③ الشاشتان', () => {
  const strip = (s: string) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (p: string) => strip(readFileSync(join(process.cwd(), p), 'utf8'))
  it('الوسم في الطابور، والسجل في الخطة — للإدارة', () => {
    expect(read('src/pages/admin/PendingPlans.tsx')).toMatch(/roundLabelAr\(r\.returns\)/)
    expect(read('src/components/admin/TrainerPlanReview.tsx')).toMatch(/<PlanTimeline planId=\{trainerPlan\.id\} \/>/)
    expect(read('src/components/admin/PlanTimeline.tsx')).toContain('`/api/admin/cohort-plans/${planId}/timeline`')
  })
  it('ولا يرى المدرب السجل — باختيار صاحب المنصة', () => {
    expect(read('src/pages/trainer/CohortWorkspace.tsx')).not.toMatch(/PlanTimeline|\/timeline`/)
  })
})
