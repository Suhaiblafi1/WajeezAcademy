/* تأجيلُ شعب الشهر إلى الشهر التالي — الحسابُ والشاشتان (٢٤ أكتوبر ٢٠٢٦).

   «افحص كلَّ الدورات التي تبدأ بشهر ١١ واقترح تأجيلا لها وأرسلها للمدرّب مع إعلامه بأنّه سيتمّ توقيفُ الشعبة
   تلقائيّا» (صاحب المنصّة). والحسابُ في `postpone-offer.ts`، والأثرُ في `cohort-postpone.service.ts` ويحرسه
   `server/tests/learning/cohort-postpone.test.ts`. والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  NOT_ON_SITE_AR, academyMonth, deadlineProblemAr, defaultDeadline, isOnSite, prePicked, shiftByWeeks, weeksToNextMonth,
} from '@/application/trainer/postpone-offer'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const DAY = 86_400_000

describe('الإزاحة', () => {
  it('⚠️ لقاءا نوار: الأحد ١ نوفمبر ← ٦ ديسمبر، والاثنين ٢ نوفمبر ← ٧ ديسمبر — بنفس الساعة', () => {
    const sun = new Date('2026-11-01T16:00:00Z')
    expect(weeksToNextMonth(sun)).toBe(5)
    expect(shiftByWeeks(sun, 5).toISOString()).toBe('2026-12-06T16:00:00.000Z')
    expect(shiftByWeeks(new Date('2026-11-02T16:00:00Z'), weeksToNextMonth(new Date('2026-11-02T16:00:00Z'))).toISOString())
      .toBe('2026-12-07T16:00:00.000Z')
  })

  it('⚠️ كل يوم في نوفمبر يقع في ديسمبر بعدها — وبأقل أسابيع: أسبوع أقل يبقيه في نوفمبر', () => {
    for (let d = 1; d <= 30; d++) {
      const at = new Date(Date.UTC(2026, 10, d, 16, 0))
      const w = weeksToNextMonth(at)
      expect(academyMonth(shiftByWeeks(at, w)), `${d} نوفمبر`).toEqual({ year: 2026, month: 12 })
      expect(academyMonth(shiftByWeeks(at, w - 1)).month, `${d} نوفمبر — أسابيع زائدة`).toBe(11)
    }
  })

  it('⚠️ والشهر بتوقيت عمان: منتصف ليل ١ نوفمبر هناك ما زال ٣١ أكتوبر في UTC', () => {
    expect(academyMonth(new Date('2026-10-31T22:00:00Z'))).toEqual({ year: 2026, month: 11 })
  })
})

describe('المهلة', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  it('⚠️ ثلاثة أيام، ولا تتجاوز يومين قبل أول لقاء، ولا تقل عن ساعة من الآن', () => {
    expect(defaultDeadline(now, new Date('2026-11-01T16:00:00Z')).getTime()).toBe(now.getTime() + 3 * DAY)
    expect(defaultDeadline(now, new Date('2026-10-28T12:00:00Z')).getTime()).toBe(now.getTime() + 2 * DAY)
    expect(defaultDeadline(now, new Date('2026-10-25T12:00:00Z')).getTime()).toBe(now.getTime() + 3600_000)
  })
  it('⚠️ مهلة مضت أو بعد أول لقاء لا ترسل', () => {
    const first = new Date('2026-11-01T16:00:00Z')
    expect(deadlineProblemAr(new Date(now.getTime() - 1), now, first)).toMatch(/مضت/)
    expect(deadlineProblemAr(first, now, first)).toMatch(/بعد أول لقاء/)
    expect(deadlineProblemAr(new Date(now.getTime() + DAY), now, first)).toBeNull()
  })
})

describe('شاشة الإدارة — تعاين ثم ترسل، وتقول ما يقع بكل خيار', () => {
  const box = code('src/components/admin/PostponeMonthBox.tsx')
  it('⚠️ المعاينة لا ترسل، والإرسال لما اختير وحده بعد تأكيد', () => {
    expect(box).toContain('`/api/admin/cohort-postpones/preview?year=${month.year}&month=${month.month}`')
    expect(box).toContain('cohortIds: chosen.map((c) => c.cohortId), deadlineAt: deadlineAt.toISOString(), reasonAr: reason.trim()')
    expect(box).toMatch(/!confirming \? \(\s*<Button[\s\S]*?onClick=\{\(\) => setConfirming\(true\)\}/)
    expect(box).toMatch(/<Button tone="confirm" loading=\{busy\} onClick=\{send\}>/)
  })
  it('⚠️ الخيارات الثلاثة قبل الزر — والسبب يحرر', () => {
    for (const t of ['<b>يقبل:</b>', '<b>لا يقبل:</b>', '<b>لا يرد حتى المهلة:</b> تتوقف الشعبة تلقائيا.']) expect(box).toContain(t)
    expect(box).toMatch(/<textarea value=\{reason\} onChange=/)
  })
  it('⚠️ والمسودة ليست على الموقع: توسم «غير منشورة» ولا تختار سلفا — ويختارها هو إن أراد', () => {
    expect(isOnSite('open')).toBe(true)
    expect(isOnSite('full')).toBe(true)
    expect(isOnSite('draft')).toBe(false)
    const row = (cohortId: string, status: string, blockedAr: string | null = null) => ({ cohortId, status, blockedAr })
    expect(prePicked([row('a', 'open'), row('b', 'draft'), row('c', 'full'), row('d', 'open', 'أرسل لها اقتراح ينتظر الرد')]))
      .toEqual(['a', 'c'])
    expect(box).toMatch(/const pre = prePicked\(r\);\s*setPicked\(new Set\(pre\)\);/)
    expect(box).toMatch(/\{!isOnSite\(c\.status\) && <Chip tone="neutral">\{NOT_ON_SITE_AR\}<\/Chip>\}/)
    /* والمسوّدةُ تُختار باليد: لا يُعطَّل صندوقُها إلّا بما يمنع الإرسال */
    expect(box).toContain('disabled={Boolean(c.blockedAr)}')
    expect(NOT_ON_SITE_AR).toBe('غير منشورة')
  })
  it('⚠️ وهي في «تبدأ قريبا»', () => {
    expect(code('src/components/admin/UpcomingCohorts.tsx')).toMatch(/<PostponeMonthBox onChanged=/)
  })
})

describe('بطاقة المدرب — قبل وبعد، ثم يقبل أو لا', () => {
  const card = code('src/components/trainer/PostponeOfferCards.tsx')
  it('⚠️ الموعدان والمهلة والتوقف التلقائي', () => {
    expect(card).toContain('{fmtDateTimeAr(o.fromFirstAt)}')
    expect(card).toContain('{fmtDateTimeAr(o.toFirstAt)}')
    expect(card).toContain('إن لم ترد حتى هذا الموعد تتوقف الشعبة تلقائيا.')
  })
  it('⚠️ القبول بزر، وعدم القبول يسأل مرة ثانية قبل أن يوقف', () => {
    expect(card).toMatch(/onClick=\{\(\) => void decide\(o, "accept"\)\}>اقبل التأجيل</)
    expect(card).toMatch(/onClick=\{\(\) => \{ setErr\(null\); setAsking\(o\.id\); \}\}>لا أريد التأجيل</)
    expect(card).toMatch(/asking === o\.id \? \([\s\S]*?decide\(o, "decline"\)/)
  })
  it('⚠️ وفي رأس «شعبي» لكل شعبة', () => {
    expect(code('src/pages/trainer/CohortBoard.tsx')).toMatch(/\{!offline && <PostponeOfferCards onDecided=/)
  })
})

describe('النصوص بلا تشكيل — والشدة وحدها تبقى', () => {
  it('⚠️ في الشاشتين والجرس', () => {
    for (const p of ['src/components/admin/PostponeMonthBox.tsx', 'src/components/trainer/PostponeOfferCards.tsx', 'server/services/cohort-postpone.service.ts', 'src/application/trainer/postpone-offer.ts']) {
      const literals = code(p).match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1|>[^<>{}\n]+</g) ?? []
      const marked = literals.filter((l) => /[ً-ِْ]/.test(l))
      expect(marked, p).toEqual([])
    }
  })
})

describe('والعامل يوقف ما مضت مهلته', () => {
  it('⚠️ في جدول المهام', () => {
    expect(code('server/worker/jobs.ts')).toMatch(/\{ key: 'cohort_postpone_expire', everyMs: [^,]+, run: runCohortPostponeExpire,/)
  })
})
