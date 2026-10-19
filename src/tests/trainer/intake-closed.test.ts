/* إغلاقُ استقبال طلبات المدرّبين — المسارُ السريع (١٩ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/intake-closed.ts`، وما يحتاج قاعدةً حقيقيّةً
   في `server/tests/trainer/intake-closed.test.ts`. وهنا:

   ① **الموعدُ ديسمبر** — قبل فصل الربيع ٢٠٢٧، وشارةُ الطابور تسمّي الفصلَ نفسَه.
   ② **والإغلاقُ ينتهي يومَ الموعد** — فلا يُوعَد بديسمبرَ مضى.
   ③ **والمؤجَّلُ بالإغلاق يُعرف بآخر دخولٍ في التأجيل** — لا بأيّ سطرٍ في سجلّه.
   ④ **والنصُّ** — بلا تشكيلٍ إعرابيّ، ويسمّي الشهرَ والفصل. */

import { describe, expect, it } from 'vitest'
import { CASE_MARKS } from '@/application/text/plain-ar'
import { termBounds, termTitleAr } from '@/application/terms/season'
import { followUpTermAr } from '@/application/trainer/deferral'
import {
  INTAKE_CLOSED_AFTER_AR, INTAKE_CLOSED_BEFORE_AR, INTAKE_CLOSED_PROMISE_AR, INTAKE_CLOSED_TITLE_AR,
  INTAKE_DEFERRED_EXPLAIN_AR, INTAKE_DEFER_NOTE_AR, TRAINER_INTAKE_CLOSED,
  deferredByIntake, intakeClosed, intakeFollowUpAt,
} from '@/application/trainer/intake-closed'

describe('① الموعدُ ديسمبر', () => {
  it('⚠️ ٢١ ديسمبر ٢٠٢٦ — قبل بداية فصل الربيع ٢٠٢٧', () => {
    const at = intakeFollowUpAt()
    expect(at.toISOString()).toBe('2026-12-21T00:00:00.000Z')
    expect(at.getUTCMonth() + 1, 'وعدنا بشهر ١٢').toBe(12)
    expect(at.getTime()).toBeLessThan(termBounds(2027, 'feb_apr').startsOn.getTime())
  })

  it('⚠️ وشارةُ الطابور تسمّي الفصلَ الذي وعدناه — لا الشتاء', () => {
    /* `followUpTermAr` يقرأ الفصلَ من الموعد المحفوظ؛ وموعدٌ أبكرُ من ستّة أسابيع
       قبل الربيع يُقرأ «قبل موسم الشتاء» في شاشة الإدارة */
    const { year, season } = TRAINER_INTAKE_CLOSED.nextTerm
    expect(followUpTermAr(intakeFollowUpAt())).toBe(termTitleAr(year, season))
  })
})

describe('② والإغلاقُ ينتهي يومَ الموعد', () => {
  it('⚠️ مغلقٌ قبله، ومفتوحٌ منه', () => {
    expect(intakeClosed(new Date('2026-10-20T09:00:00Z'))).toBe(TRAINER_INTAKE_CLOSED.active)
    expect(intakeClosed(intakeFollowUpAt()), 'يَعِد بديسمبرَ يومَ حلّ').toBe(false)
    expect(intakeClosed(new Date('2027-01-05T09:00:00Z'))).toBe(false)
  })
})

describe('③ والمؤجَّلُ بالإغلاق يُعرف بآخر دخولٍ في التأجيل', () => {
  const intake = { toStatus: 'deferred', note: INTAKE_DEFER_NOTE_AR }
  const history = [
    { toStatus: 'draft', note: 'إنشاء الطلب — القسم الأول' },
    { toStatus: 'submitted', note: 'اكتمل التقديم' },
    intake,
  ]

  it('⚠️ أُجّل عند إرساله — فهو منه', () => {
    expect(deferredByIntake({ status: 'deferred', statusHistory: history })).toBe(true)
  })

  it('⚠️ ثمّ راجعه مراجعٌ وأجّله — فليس منه وإن بقي السطرُ في سجلّه', () => {
    const later = [...history, { toStatus: 'under_review', note: null }, { toStatus: 'deferred', note: null }]
    expect(deferredByIntake({ status: 'deferred', statusHistory: later })).toBe(false)
  })

  it('⚠️ وخرج من التأجيل — فليس مؤجَّلا أصلا', () => {
    const out = [...history, { toStatus: 'under_review', note: null }]
    expect(deferredByIntake({ status: 'under_review', statusHistory: out })).toBe(false)
  })
})

describe('④ والنصّ', () => {
  const texts = {
    INTAKE_CLOSED_TITLE_AR, INTAKE_CLOSED_PROMISE_AR, INTAKE_CLOSED_BEFORE_AR,
    INTAKE_CLOSED_AFTER_AR, INTAKE_DEFERRED_EXPLAIN_AR, INTAKE_DEFER_NOTE_AR,
  }

  it('⚠️ بلا تشكيلٍ إعرابيّ — والشدّةُ وحدَها تبقى', () => {
    for (const [name, text] of Object.entries(texts)) {
      expect(text.match(CASE_MARKS), name).toBeNull()
    }
  })

  it('⚠️ والوعدُ يسمّي الشهرَ والفصل — وما بعد الإرسال يقول ألّا يعيد التقديم', () => {
    expect(INTAKE_CLOSED_PROMISE_AR).toContain(TRAINER_INTAKE_CLOSED.contactMonthAr)
    expect(INTAKE_CLOSED_PROMISE_AR).toContain(TRAINER_INTAKE_CLOSED.nextTermAr)
    expect(INTAKE_DEFERRED_EXPLAIN_AR).toContain(INTAKE_CLOSED_PROMISE_AR)
    expect(INTAKE_DEFERRED_EXPLAIN_AR).toContain(INTAKE_CLOSED_AFTER_AR)
  })
})
