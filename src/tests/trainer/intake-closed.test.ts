/* إغلاقُ استقبال طلبات المدرّبين — المسارُ السريع (١٩ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/intake-closed.ts`، وما يحتاج قاعدةً حقيقيّةً
   في `server/tests/trainer/intake-closed.test.ts`. وهنا:

   ① **الموعدُ ديسمبر** — قبل فصل الربيع ٢٠٢٧، وشارةُ الطابور تسمّي الفصلَ نفسَه.
   ② **والإغلاقُ ينتهي يومَ الموعد** — فلا يُوعَد بديسمبرَ مضى.
   ③ **والمؤجَّلُ بالإغلاق يُعرف بآخر دخولٍ في التأجيل** — لا بأيّ سطرٍ في سجلّه.
   ④ **والنصُّ** — بلا تشكيلٍ إعرابيّ، ويسمّي الشهرَ والفصل.
   ⑤ **وزرُّ الإرسال لا يَعِد بحجز** — «أرسل طلبك» ما دام الاستقبالُ مغلقا، ولا سطرَ
      تقويمٍ فوقه. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

describe('⑤ وزرُّ الإرسال لا يَعِد بحجز', () => {
  /* الشيفرةُ بلا تعليقاتها — فلا يمرّ الحارسُ بنصٍّ في شرحٍ لا في زرّ. وتعليقُ JSX
     واحدٌ بين قوسين لا يعبر إلى آخر: النمطُ الكسولُ وحدَه يبدأ من `{` كتلةِ شيفرةٍ
     فيبتلع ما بينها وبين أوّل تعليقٍ يُغلق قوسا بعدها — والشيفرةَ التي يُفحص عنها معه. */
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
  const src = readFileSync(join(root, 'src/pages/JoinTrainer.tsx'), 'utf8')
    .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
  const send = src.slice(src.indexOf('key="send"'), src.indexOf('</Button>', src.indexOf('key="send"')))

  it('⚠️ والزرُّ يقول «أرسل طلبك» حين يُغلق الاستقبال — و«احجز» في الفرع الآخر وحدَه', () => {
    expect(send.length, 'لم يوجد زرّ الإرسال').toBeGreaterThan(0)
    expect(send).toMatch(/closed \|\| INTERVIEW_BOOKING_PAUSE\.active \? "أرسل طلبك" : "احجز موعد لقاء التعارف"/)
    expect(send.split('احجز موعد لقاء التعارف').length - 1, '«احجز» خارج الشرط').toBe(1)
  })

  it('⚠️ ولا سطرَ يَعِد بالتقويم فوقه', () => {
    const i = src.indexOf('بعد هذا الزر تختار موعد لقاء التعارف')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(Math.max(0, i - 200), i)).toMatch(/step === 3 && !\(closed \|\| INTERVIEW_BOOKING_PAUSE\.active\) && \(/)
  })
})
