/* قواعدُ كود المدرّب — الردُّ والحسمُ والإعادة (`trainer-code.ts`).

   والمقيسُ ما يقع صامتا في كشفٍ بعد شهر:
   ① **الردُّ ينقص ما عليه بقدره** — لا يبقى عليه خصمٌ كاملٌ عن شراءٍ رُدّ نصفُه،
      ولا يُعفى من كلّه.
   ② **والإعادةُ تُؤخذ دائما، وتفسح للحسم** — مالٌ له لا يُؤجَّل، ومكانٌ فتحه.
   ③ **والحسمُ كاملٌ بالأقدم أوّلا، ولا ينزل الكشفُ تحت الصفر** — البند 4-10.
   ④ **والإصدارُ يُردّ بجملةٍ واحدة** تقرؤها الشاشةُ والخادم — والسقفُ فيها.
   ⑤ **وحالُ الكود تُقال بما هي** — ما انتهى أو نفد لا يُقال «يعمل».
   ⑥ **والرصيدُ لا يمنح ما ليس له** — يُسقَف بما له عندنا (٢٨ سبتمبر ٢٠٢٦). وجمعُ
      أرقامه من القاعدة في `server/tests/commerce/trainer-code-budget.test.ts`. */

import { describe, expect, it } from 'vitest'
import {
  MAX_TRAINER_CODE_PERCENT, MAX_TRAINER_CODE_USES, budgetCovers, codeBlockerAr, codeBudget, codeStateAr,
  owedAfterRefund, planLedger, refundedShare, type LedgerEntry,
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

describe('④ الإصدار: الحاجزُ نصٌّ واحدٌ تقرؤه الشاشةُ والخادم', () => {
  const ok = { percentOff: 20, labelAr: 'متابعو القناة' }

  it('⚠️ النسبةُ عددٌ صحيحٌ بين الحدّين — والسقفُ نفسُه يمرّ', () => {
    expect(codeBlockerAr(ok)).toBeNull()
    expect(codeBlockerAr({ ...ok, percentOff: MAX_TRAINER_CODE_PERCENT }), 'رُدّ السقفُ نفسُه').toBeNull()
    expect(codeBlockerAr({ ...ok, percentOff: MAX_TRAINER_CODE_PERCENT + 1 }), 'مرّ ما فوق السقف').toBeTruthy()
    expect(codeBlockerAr({ ...ok, percentOff: 0 }), 'مرّ الصفر').toBeTruthy()
    expect(codeBlockerAr({ ...ok, percentOff: 12.5 }), 'مرّت نسبةٌ بكسر').toBeTruthy()
    expect(codeBlockerAr({ ...ok, percentOff: Number.NaN })).toBeTruthy()
  })

  it('⚠️ ولمن يُنشَر يُكتب — يُطبع في كشفه', () => {
    expect(codeBlockerAr({ ...ok, labelAr: ' ' })).toBeTruthy()
  })

  it('والاستعمالاتُ عددٌ صحيحٌ موجب — أو بلا حدّ', () => {
    expect(codeBlockerAr({ ...ok, maxUses: null })).toBeNull()
    expect(codeBlockerAr({ ...ok, maxUses: 10 })).toBeNull()
    expect(codeBlockerAr({ ...ok, maxUses: 0 })).toBeTruthy()
    expect(codeBlockerAr({ ...ok, maxUses: 2.5 })).toBeTruthy()
    expect(codeBlockerAr({ ...ok, maxUses: MAX_TRAINER_CODE_USES + 1 })).toBeTruthy()
  })

  it('وتاريخُ الانتهاء لا يكون ماضيا', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    expect(codeBlockerAr({ ...ok, expiresAt: new Date('2026-09-30T10:00:00Z') }, now)).toBeTruthy()
    expect(codeBlockerAr({ ...ok, expiresAt: new Date('2026-10-30T10:00:00Z') }, now)).toBeNull()
  })
})

describe('⑤ حالُ الكود كما تُقال — المخزَّنةُ وما يُشتقّ منها', () => {
  const now = new Date('2026-10-01T10:00:00Z')
  const c = (over: Partial<Parameters<typeof codeStateAr>[0]> = {}) =>
    codeStateAr({ status: 'live', expiresAt: null, maxUses: null, usedCount: 0, ...over }, now).key

  it('⚠️ يعمل، ويُوقَف، ويُلغى', () => {
    expect(c()).toBe('live')
    expect(c({ status: 'paused' })).toBe('paused')
    expect(c({ status: 'revoked' })).toBe('revoked')
  })

  it('⚠️ وما انتهت مدّتُه أو استُنفدت استعمالاتُه يُقال — لا «يعمل»', () => {
    expect(c({ expiresAt: new Date('2026-09-30T10:00:00Z') })).toBe('expired')
    expect(c({ maxUses: 5, usedCount: 5 })).toBe('exhausted')
    expect(c({ maxUses: 5, usedCount: 4 })).toBe('live')
    /* والملغى ملغى ولو انتهت مدّتُه: الإلغاءُ فعلُه هو، والانتهاءُ وقتٌ مرّ */
    expect(c({ status: 'revoked', expiresAt: new Date('2026-09-30T10:00:00Z') })).toBe('revoked')
  })
})

describe('⑥ الرصيدُ — ما له ناقصا ما التزم به', () => {
  const budget = (over: Partial<Parameters<typeof codeBudget>[0]> = {}) =>
    codeBudget({ owed: 0, credits: 0, projected: 0, committed: 0, currency: 'USD', ...over })

  it('⚠️ ما له ثلاثةُ مصادر — كشوفٌ لم تُصرف، وما يُعاد إليه، وما يُتوقَّع من شعبه', () => {
    const b = budget({ owed: 120, credits: 15.5, projected: 200, committed: 60 })
    expect(b.allowance, 'سقط مصدرٌ مما له').toBe(335.5)
    expect(b.committed).toBe(60)
    expect(b.remaining).toBe(275.5)
  })

  it('⚠️ ولا ينزل تحت الصفر — ما التزم به فوق ما له لا يصير رصيدا سالبا يُقرأ', () => {
    expect(budget({ owed: 50, committed: 80 }).remaining).toBe(0)
  })

  it('⚠️ يسع خصما يساويه تماما — وقرشٌ فوقه لا', () => {
    const b = budget({ projected: 30 })
    expect(budgetCovers(b, 30), 'رُدّ خصمٌ يساوي الرصيد').toBe(true)
    expect(budgetCovers(b, 30.01), 'مرّ خصمٌ فوق الرصيد').toBe(false)
    expect(budgetCovers(budget(), 0.01), 'مرّ خصمٌ على رصيدٍ فارغ').toBe(false)
  })

  it('وبالقرش لا بكسور الفاصلة العائمة — ٠٫١ + ٠٫٢ رصيدٌ يسع ٠٫٣', () => {
    const b = budget({ owed: 0.1, credits: 0.2 })
    expect(b.remaining).toBe(0.3)
    expect(budgetCovers(b, 0.3)).toBe(true)
    /* والخصمُ نفسُه بالقرش: ما جُمع من كسورٍ لا يُردّ بجزءٍ من مليار */
    expect(budgetCovers(budget({ projected: 0.3 }), 0.1 + 0.2), 'رُدّ خصمٌ بكسرٍ عائم').toBe(true)
  })
})
