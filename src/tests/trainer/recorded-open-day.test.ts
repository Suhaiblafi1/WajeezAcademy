/* ═══ يومُ فتح الجلسة المسجّلة يومُ عمّان (٢٠ أكتوبر ٢٠٢٦) — `CohortWorkspace.tsx` ═══

   في الشعبة التي اعتُمدت قبل المواعيد كان الحقلُ يكتب منتصفَ ليل المتصفّح، ويقرأ أوّلَ عشرة أحرفٍ بغرينتش:
   منتصفُ ليل عمّان التاسعةُ مساءَ أمسه بغرينتش — فيُعرض اليومَ السابق، ومن اختاره ثانيةً أخّره يوما.
   والموضعُ الآخرُ (`SlotSessions`) يكتبه بـ`zonedDay` والثامنةِ صباحا من قبل.

   ورُئي ساقطا: أُعيد `r.opensAt.slice(0, 10)` فسقط. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { zonedDay, zonedInstant } from '@/application/trainer/cohort-period'

const WS = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('يوم فتح الجلسة المسجّلة', () => {
  it('اليوم المكتوب يقرأ هو نفسه — والثامنة صباحا بعمّان', () => {
    const at = zonedInstant('2027-02-01', [8, 0, 0, 0])
    expect(at.toISOString()).toBe('2027-02-01T05:00:00.000Z')
    expect(zonedDay(at)).toBe('2027-02-01')
  })

  it('⚠️ الحقل يقرأ بيوم عمّان ويكتب بها — لا بالمتصفّح ولا بأوّل عشرة أحرف', () => {
    expect(WS).toMatch(/value=\{r\.opensAt \? zonedDay\(r\.opensAt\) : ""\}/)
    expect(WS).toMatch(/opensAt: e\.target\.value \? zonedInstant\(e\.target\.value, \[8, 0, 0, 0\]\)\.toISOString\(\) : null/)
    expect(WS, 'عاد يوم غرينتش').not.toContain('r.opensAt.slice(0, 10)')
  })
})
