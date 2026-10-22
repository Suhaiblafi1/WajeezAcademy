/* «المتابعة» — ما يستدعي يدَ الإدارة في الشعبة (٢٢ أكتوبر ٢٠٢٦).

   «وكأنّنا مراقبون لكلّ مجريات الشعبة» (صاحب المنصّة). والتنبيهُ هو ما يجعل التقريرَ يُقرأ: لقاءٌ
   بلا حضور، وتسليمٌ ينتظر طويلا، ومتعلّمٌ يغيب، ومدرّبٌ صامت. ويُحرس أيضا ما لا يُنبَّه إليه — فتنبيهٌ
   كاذبٌ يُعلّم صاحبَه ألّا يقرأ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { attendancePct, monitorAlerts, REVIEW_LATE_DAYS, TRAINER_SILENT_DAYS } from '@/application/learning/cohort-monitor'

const now = new Date('2026-10-22T12:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)
const quiet = { status: 'active', now, pastSessions: [], waitingSince: [], learners: [], lastTrainerMessageAt: null, startedAt: null }

describe('تنبيهات المتابعة', () => {
  it('⚠️ لقاء مضى عليه يوم بلا حضور — لا لقاء اليوم', () => {
    expect(monitorAlerts({ ...quiet, pastSessions: [{ startsAt: ago(3), marked: false }] })).toEqual(['لقاء مضى بلا حضور مسجل'])
    expect(monitorAlerts({ ...quiet, pastSessions: [{ startsAt: ago(0.2), marked: false }] })).toEqual([])
    expect(monitorAlerts({ ...quiet, pastSessions: [{ startsAt: ago(3), marked: true }] })).toEqual([])
  })

  it('⚠️ تسليم ينتظر التصحيح أكثر من أسبوع', () => {
    expect(monitorAlerts({ ...quiet, waitingSince: [ago(REVIEW_LATE_DAYS + 1), ago(1)] })[0]).toMatch(/^1 تسليم ينتظر التصحيح/)
    expect(monitorAlerts({ ...quiet, waitingSince: [ago(2)] })).toEqual([])
  })

  it('⚠️ متعلم حضوره أقل من النصف بعد لقاءين — لا بعد لقاء واحد', () => {
    expect(monitorAlerts({ ...quiet, learners: [{ held: 4, attendancePct: 25 }] })).toEqual(['1 متعلم حضوره أقل من النصف'])
    expect(monitorAlerts({ ...quiet, learners: [{ held: 1, attendancePct: 0 }] })).toEqual([])
  })

  it('⚠️ مدرب صامت في شعبة جارية — لا في شعبة لم تبدأ', () => {
    const silent = { ...quiet, startedAt: ago(TRAINER_SILENT_DAYS + 5), lastTrainerMessageAt: ago(TRAINER_SILENT_DAYS + 1) }
    expect(monitorAlerts(silent)).toEqual([`لم يراسل المدرب طلبته منذ أكثر من ${TRAINER_SILENT_DAYS} يوما`])
    expect(monitorAlerts({ ...silent, lastTrainerMessageAt: ago(2) })).toEqual([])
    expect(monitorAlerts({ ...silent, status: 'open' })).toEqual([])
  })

  it('والنسبة قبل أي تسجيل حضور «—» لا صفر', () => {
    expect(attendancePct(0, 0)).toBeNull()
    expect(attendancePct(3, 4)).toBe(75)
  })
})

describe('الشاشة تقرأ ولا تكتب', () => {
  const code = readFileSync(join(process.cwd(), 'src/pages/admin/CohortMonitor.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  it('⚠️ لا طلب كتابة في «المتابعة» — تقرير واحد يقرأ', () => {
    expect(code).toMatch(/apiGet<Report>\(`\/api\/admin\/cohorts\/\$\{cohortId\}\/monitor`\)/)
    expect(code).not.toMatch(/apiPost|apiPatch|apiPut|apiDelete/)
  })
})
