/* قواعدُ كود المدرّب — الردُّ والحسمُ والإعادة (`trainer-code.ts`).

   والمقيسُ ما يقع صامتا في كشفٍ بعد شهر:
   ① **الردُّ ينقص ما عليه بقدره** — لا يبقى عليه خصمٌ كاملٌ عن شراءٍ رُدّ نصفُه،
      ولا يُعفى من كلّه.
   ② **والإعادةُ تُؤخذ دائما، وتفسح للحسم** — مالٌ له لا يُؤجَّل، ومكانٌ فتحه.
   ③ **والحسمُ كاملٌ بالأقدم أوّلا، ولا ينزل الكشفُ تحت الصفر** — البند 4-10. */

import { describe, expect, it } from 'vitest'
import {
  MAX_TRAINER_CODE_PERCENT, owedAfterRefund, planLedger, refundedShare, type LedgerEntry,
} from '@/application/trainer/trainer-code'

const at = (d: number) => new Date(Date.UTC(2026, 9, d))
const entry = (ref: string, amount: number, day: number): LedgerEntry => ({ ref, amount, at: at(day) })

describe('السقفُ رقمٌ واحد', () => {
  it('ثلاثون — قرارُ صاحب المنصّة، وقيدُ القاعدة يقول الرقمَ نفسَه', () => {
    expect(MAX_TRAINER_CODE_PERCENT).toBe(30)
  })
})

describe('① الردُّ ينقص ما عليه بقدره', () => {
  it('⚠️ حصّةُ ما رُدّ بين الصفر والواحد', () => {
    expect(refundedShare(50, 200)).toBe(0.25)
    expect(refundedShare(0, 200)).toBe(0)
    expect(refundedShare(250, 200), 'حصّةٌ فوق الكلّ').toBe(1)
    expect(refundedShare(10, 0), 'دفعةٌ بصفرٍ لا يُقسم عليها').toBe(0)
  })

  it('⚠️ وما يبقى عليه: الخصمُ ناقصا حصّةَ الردّ — لا الخصمُ كاملا ولا صفر', () => {
    expect(owedAfterRefund(18.4, 0.5)).toBe(9.2)
    expect(owedAfterRefund(18.4, 0)).toBe(18.4)
    expect(owedAfterRefund(18.4, 1)).toBe(0)
    expect(owedAfterRefund(10, 1 / 3), 'التقريبُ إلى القرش').toBe(6.67)
  })
})

describe('② والإعادةُ تُؤخذ دائما، وتفسح للحسم', () => {
  it('⚠️ كشفٌ بلا إجماليٍّ تُؤخذ فيه الإعادةُ كاملة', () => {
    const plan = planLedger(0, [], [entry('c1', 18.4, 3)])
    expect(plan.credits.map((c) => c.ref)).toEqual(['c1'])
    expect(plan.credited).toBe(18.4)
  })

  it('⚠️ والإعادةُ تفتح مكانا لحسمٍ لا يسعه الإجماليُّ وحدَه', () => {
    /* إجماليٌّ ١٠ وحسمٌ ١٥: لا يسعه وحدَه — والإعادةُ (٨) تجعل المتاحَ ١٨ */
    expect(planLedger(10, [entry('d1', 15, 1)], []).taken).toHaveLength(0)
    expect(planLedger(10, [entry('d1', 15, 1)], [entry('c1', 8, 2)]).taken.map((t) => t.ref)).toEqual(['d1'])
  })
})

describe('③ والحسمُ كاملٌ بالأقدم أوّلا، ولا ينزل الكشفُ تحت الصفر', () => {
  it('⚠️ الأقدمُ أوّلا مهما جاء ترتيبُ المصفوفة', () => {
    /* الأحدثُ أصغرُ فيسعه الكشفُ كلَّ مرّة — ولو أُخذ أوّلا لبقي الأقدمُ معلَّقا */
    const plan = planLedger(20, [entry('new', 5, 9), entry('old', 18, 1)], [])
    expect(plan.taken.map((t) => t.ref)).toEqual(['old'])
    expect(plan.deferred.map((t) => t.ref)).toEqual(['new'])
  })

  it('⚠️ ولا يُشطَر حسمٌ، ولا يتجاوز مجموعُ المأخوذ ما يسعه الكشف', () => {
    const plan = planLedger(30, [entry('a', 12, 1), entry('b', 25, 2), entry('c', 10, 3)], [])
    const taken = plan.taken.reduce((s, t) => s + t.amount, 0)
    expect(plan.taken.map((t) => t.ref)).toEqual(['a', 'c'])
    expect(taken).toBeLessThanOrEqual(30)
    for (const t of plan.taken) expect([12, 25, 10], 'حسمٌ شُطر').toContain(t.amount)
  })
})
