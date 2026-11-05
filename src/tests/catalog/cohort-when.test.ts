/* سطرُ موعد الشعبة: تاريخُ أوّل لقاءٍ بيومه (`src/application/catalog/cohort-when.ts`، ٥ نوفمبر ٢٠٢٦).
   والحالتان من الإنتاج نفسِه: بدءٌ ثلاثاءَ ١٥ ولقاءٌ أربعاءَ ١٦، وبدءٌ ثلاثاءَ ١ ولقاءٌ أحدَ ٦. */

import { describe, expect, it } from 'vitest'
import { cohortWhen } from '@/application/catalog/cohort-when'

describe('سطر موعد الشعبة', () => {
  it('⚠️ يبدأ ١٥ ديسمبر ولقاؤه الأربعاء: يقال أول لقاء الأربعاء ١٦', () => {
    const w = cohortWhen({
      startsAt: '2026-12-14T21:00:00.000Z',
      sessions: [{ startsAt: '2026-12-23T16:00:00.000Z' }, { startsAt: '2026-12-16T16:00:00.000Z' }],
    })
    expect(w.labelAr).toContain('أول لقاء')
    expect(w.labelAr).toContain('الأربعاء')
    expect(w.labelAr).toMatch(/16/)
    expect(w.labelAr).not.toMatch(/\b15\b/)
    expect(w.at).toBe('2026-12-16T16:00:00.000Z')
  })

  it('⚠️ يبدأ ١ ديسمبر ولقاؤه الأحد: يقال أول لقاء الأحد ٦', () => {
    const w = cohortWhen({ startsAt: '2026-11-30T21:00:00.000Z', sessions: [{ startsAt: '2026-12-06T16:00:00.000Z' }] })
    expect(w.labelAr).toContain('الأحد')
    expect(w.labelAr).toMatch(/\b6\b/)
  })

  it('⚠️ لقاء ليلي بتوقيت عمان يقال بيومه في عمان لا في UTC', () => {
    /* ٢٢:٣٠ UTC يومَ ١٥ هو ١:٣٠ فجرَ ١٦ في عمّان */
    const w = cohortWhen({ startsAt: null, sessions: [{ startsAt: '2026-12-15T22:30:00.000Z' }] })
    expect(w.labelAr).toMatch(/16/)
    expect(w.labelAr).toContain('الأربعاء')
  })

  it('⚠️ بلا جدول معتمد يبقى تاريخ البدء كما كان', () => {
    const w = cohortWhen({ startsAt: '2026-11-30T21:00:00.000Z', sessions: [] })
    expect(w.labelAr).not.toContain('أول لقاء')
    expect(w.labelAr).toMatch(/\b1\b/)
    expect(w.at).toBe('2026-11-30T21:00:00.000Z')
  })
})
