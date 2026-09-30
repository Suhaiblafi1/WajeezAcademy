/* «انقل الموعد» بتوقيت الشعبة — لا بتوقيت غرينتش ولا المتصفّح (٣٠ سبتمبر ٢٠٢٦).

   كان النموذجُ يُهيَّأ من نصّ ISO (`startsAt.slice(11, 16)`) — أي ساعةِ
   غرينتش — ويُرسَل بـ`new Date('…T18:00')` بتوقيت المتصفّح. فلقاءُ السادسة
   مساءً بعمّان يظهر في النموذج على الثالثة، ومن غيّر اليومَ وحدَه نقله ثلاثَ
   ساعاتٍ إلى الوراء. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { zonedAt, zonedClock, zonedDay } from '../../application/trainer/cohort-period'

describe('ساعةُ الشعبة ولحظتُها', () => {
  it('لقاءُ ١٥:٠٠ غرينتش هو السادسةُ مساءً بعمّان', () => {
    expect(zonedClock('2026-11-03T15:00:00.000Z')).toBe('18:00')
    expect(zonedDay('2026-11-03T22:30:00.000Z')).toBe('2026-11-04')
  })

  it('والعكسُ: السادسةُ بعمّان لحظةُ ١٥:٠٠ غرينتش', () => {
    expect(zonedAt('2026-11-03', '18:00').toISOString()).toBe('2026-11-03T15:00:00.000Z')
  })

  it('ويُهيَّأ النموذجُ ويُرسَل بهما — لا اقتطاعَ من نصّ ISO', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/trainer/SessionsAndAttendance.tsx'), 'utf8')
    expect(src, 'النموذجُ يقتطع ساعةَ غرينتش من نصّ ISO').not.toMatch(/startsAt\.slice\(11,\s*16\)/)
    expect(src).toMatch(/from: zonedClock\(s\.startsAt\)/)
    expect(src).toMatch(/startsAt: zonedAt\(moveForm\.date, moveForm\.from\)/)
  })
})
