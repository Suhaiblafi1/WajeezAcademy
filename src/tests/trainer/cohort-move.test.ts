/* نقلُ الشعبة إلى فصلٍ آخر — المحضُ والشاشتان (١٧ أكتوبر ٢٠٢٦).
   الحسابُ: أيُّ الفصول يُختار، وكم تُزاح المواعيد. والشاشتان على بنيتهما: البطاقةُ ترسل طلبا
   ولا تغيّر موعدا، والإدارةُ وحدها تنقل. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  moveChoices, moveProblemAr, moveShiftMs, nextTerm, shiftDate, termLabelAr,
} from '@/application/trainer/cohort-move'

const DAY = 86_400_000
const now = new Date('2026-10-17T09:00:00Z') // في موسم الخريف ٢٠٢٦

describe('① الفصول المعروضة', () => {
  it('الشتاء يعبر رأس السنة — وما بعده ربيع السنة التالية', () => {
    expect(nextTerm({ year: 2026, season: 'aug_oct' })).toEqual({ year: 2026, season: 'nov_jan' })
    expect(nextTerm({ year: 2026, season: 'nov_jan' })).toEqual({ year: 2027, season: 'feb_apr' })
  })

  it('القادمة وحدها، الأقرب أوّلا، بلا فصل الشعبة — فتؤجَّل إلى بعده أو تعاد إلى قبله', () => {
    const c = moveChoices(now, { year: 2027, season: 'feb_apr' })
    expect(c.map(termLabelAr)).toEqual(['موسم الشتاء 2026', 'موسم الصيف 2027', 'موسم الخريف 2027', 'موسم الشتاء 2027'])
  })

  it('ولا فصلَ مضى أو جارٍ', () => {
    const c = moveChoices(now, null)
    expect(c[0]).toEqual({ year: 2026, season: 'nov_jan' })
    expect(c).not.toContainEqual({ year: 2026, season: 'aug_oct' })
  })
})

describe('② الإزاحة', () => {
  it('أسابيع كاملة — فيبقى يوم الأسبوع والساعة', () => {
    const ms = moveShiftMs({ year: 2026, season: 'nov_jan' }, { year: 2027, season: 'feb_apr' })
    expect(ms % (7 * DAY)).toBe(0)
    const first = new Date('2026-11-10T16:00:00Z')
    const moved = shiftDate(first, ms)!
    expect(moved.getUTCDay()).toBe(first.getUTCDay())
    expect(moved.getUTCHours()).toBe(16)
    expect(moved.toISOString().slice(0, 7)).toBe('2027-02')
  })

  it('والإعادة إلى فصل أقرب إزاحة سالبة', () => {
    expect(moveShiftMs({ year: 2027, season: 'feb_apr' }, { year: 2026, season: 'nov_jan' })).toBeLessThan(0)
    expect(shiftDate(null, 7 * DAY)).toBeNull()
  })
})

describe('③ ما يمنع الطلب', () => {
  const base = {
    status: 'open', firstStartsAt: new Date('2026-11-10T16:00:00Z'),
    current: { year: 2026, season: 'nov_jan' as const }, target: { year: 2027, season: 'feb_apr' as const },
    now, reason: 'لا يكفي الطلب هذا الفصل',
  }
  it('طلب سليم يمرّ', () => expect(moveProblemAr(base)).toBeNull())
  it('شعبة بدأت أو انتهت لا تنقل', () => {
    expect(moveProblemAr({ ...base, status: 'active' })).toMatch(/بدأت أو انتهت/)
    expect(moveProblemAr({ ...base, firstStartsAt: new Date('2026-10-01T00:00:00Z') })).toMatch(/مضى/)
  })
  it('ولا إلى فصلها ولا إلى فصل مضى', () => {
    expect(moveProblemAr({ ...base, target: base.current })).toMatch(/غير فصلها/)
    expect(moveProblemAr({ ...base, target: { year: 2026, season: 'aug_oct' } })).toMatch(/غير فصلها/)
  })
  it('وبلا سبب لا يرسل', () => expect(moveProblemAr({ ...base, reason: 'لا' })).toMatch(/السبب/))
})

describe('④ الشاشتان', () => {
  const strip = (s: string) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (p: string) => strip(readFileSync(join(process.cwd(), p), 'utf8'))
  const box = read('src/components/trainer/CohortMoveBox.tsx')
  const board = read('src/pages/trainer/CohortBoard.tsx')
  const admin = read('src/pages/admin/AdminCohorts.tsx')

  it('البطاقة ترسل طلبا وتسحبه — ولا تكتب موعدا', () => {
    expect(box).toContain('`/api/trainer/cohorts/${cohortId}/move-request`')
    expect(box).toContain('`/api/trainer/cohort-moves/${pending.id}/withdraw`')
    expect(box).not.toMatch(/\/api\/admin\//)
    expect(board).toMatch(/<CohortMoveBox cohortId=\{c\.id\}/)
  })

  it('والإدارة تنقل أو تردّ — من صندوق طلبات النقل', () => {
    expect(admin).toContain('`/api/admin/cohort-moves/${id}/review`')
    expect(admin).toMatch(/reviewMove\(m\.id, "approve"\)/)
    expect(admin).toMatch(/reviewMove\(m\.id, "reject"\)/)
  })
})
