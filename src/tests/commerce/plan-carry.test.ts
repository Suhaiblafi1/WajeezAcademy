/* خصمُ إكمال الخطّة — ما يحسبه `priceCart` لمن اشترى خطّتَه على دفعات (١٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة («أ٢»): مشتري التشخيص الذي بعضُ دوراته بلا شعبةٍ بعد يشتري ما
   فُتح بسلّمه، فإذا أكمل الخطّةَ لاحقا خُصم من فاتورته ما فاته — حتّى تبلغ الخطّةُ
   كلُّها سعرَها لو اشتُريت معا. ولا يُعطى خصمُ الخطّة كاملةً على ما يُشترى وحدَه.

   والمقيسُ أربعة، وكلُّها مال:
   ① **المجموعُ مجموعُ الخطّة معا** — مهما قُسّمت الدفعات، وبسقف المبلغ نفسِه.
   ② **ولا بابَ لمن لا يُكمل** — أوّلُ دفعةٍ بسلّمها لا أكثر.
   ③ **والكوبونُ لا يُقاصّ** — يقع على ما بعد الإكمال كما يقع على ما بعد الباقة.
   ④ **ولا يُحمَّل أحدٌ أكثرَ** — الخصمُ لا يقلّ عن صفر، ولا يمسّ ما ليس من الخطّة. */

import { describe, expect, it } from 'vitest'
import { priceCart, type CartLine, type PlanCarry } from '@/application/commerce/cart-pricing'
import { bundlePayable } from '@/application/commerce/discount-policy'

const line = (id: string, listPrice: number): CartLine => ({
  cohortId: `K-${id}`, courseId: id, titleAr: `دورة ${id}`, listPrice,
})

/** يشتري الخطّةَ على دفعتين: الأولى بلا سابق، والثانية بما اشتُري في الأولى */
function inTwo(prices: number[], firstCount: number) {
  const plan = prices.map((p, i) => line(`P${i}`, p))
  const first = priceCart(plan.slice(0, firstCount), null, null)
  const carry: PlanCarry = {
    planCourseIds: plan.map((l) => l.courseId),
    boughtCount: firstCount,
    boughtList: first.subtotal,
    /* ما يحفظه الطلب: كلُّ خصمٍ ليس كوبونا */
    boughtReceived: first.bundleDiscount + first.capDiscount + first.planCredit,
  }
  const second = priceCart(plan.slice(firstCount), null, null, 'USD', carry)
  return { first, second, carry }
}

describe('① المجموعُ مجموعُ الخطّة معا', () => {
  it('⚠️ أربعُ دوراتٍ على دفعتين = أربعٌ معا (٤٣٢ لا ٥٥٢)', () => {
    /* ٤ × ١٥٠ = ٦٠٠ ← ٢٨٪ = ٤٣٢. ودفعتان بسلّم دورتين كلٌّ (٨٪): ٢٧٦ + ٢٧٦ = ٥٥٢ */
    const { first, second } = inTwo([150, 150, 150, 150], 2)
    expect(first.total).toBe(276)
    expect(second.planCredit, 'لم يُخصم ما فات').toBe(120)
    expect(second.total).toBe(156)
    expect(first.total + second.total).toBe(432)
  })

  it('⚠️ وعلى كلّ تقسيمٍ وكلّ عددٍ وأسعار الكتالوج — بالقرش', () => {
    const prices = [120, 145, 160, 175, 199, 225]
    for (let n = 2; n <= 6; n++) {
      const plan = prices.slice(0, n)
      const whole = bundlePayable(plan.reduce((s, p) => s + p, 0), n)
      for (let k = 1; k < n; k++) {
        const { first, second } = inTwo(plan, k)
        expect(
          Math.abs(first.total + second.total - whole),
          `${n} دورات، الأولى ${k}: دُفع ${first.total + second.total} والخطّةُ معا ${whole}`,
        ).toBeLessThanOrEqual(0.01)
      }
    }
  })

  it('⚠️ وسقفُ المبلغ (٧٥٠) على الخطّة كلِّها لا على كلّ دفعة', () => {
    /* خمسٌ بـ٢٢٥ = ١١٢٥ ← ٣٠٪ = ٧٨٧٫٥ ← السقف ٧٥٠. ودفعتان كلٌّ دون السقف كانتا
       تبلغان ٥٥٣٫٥ + ٤١٤ = ٩٦٧٫٥ */
    const { first, second } = inTwo([225, 225, 225, 225, 225], 3)
    expect(first.total + second.total).toBe(750)
  })

  it('وعلى ثلاث دفعات — كلُّ دفعةٍ تُكمل ما قبلها', () => {
    const plan = [150, 150, 150, 150].map((p, i) => line(`T${i}`, p))
    const ids = plan.map((l) => l.courseId)
    const a = priceCart([plan[0]], null, null)
    const b = priceCart([plan[1]], null, null, 'USD', {
      planCourseIds: ids, boughtCount: 1, boughtList: a.subtotal, boughtReceived: a.bundleDiscount + a.capDiscount + a.planCredit,
    })
    const c = priceCart([plan[2], plan[3]], null, null, 'USD', {
      planCourseIds: ids, boughtCount: 2, boughtList: a.subtotal + b.subtotal,
      boughtReceived: a.bundleDiscount + a.capDiscount + a.planCredit + b.bundleDiscount + b.capDiscount + b.planCredit,
    })
    expect(a.total + b.total + c.total).toBe(432)
  })
})

describe('② ولا بابَ لمن لا يُكمل', () => {
  it('⚠️ أوّلُ دفعةٍ بسلّمها وحدَه — خمسٌ في الخطّة لا تجعل الواحدةَ بثلاثين', () => {
    const plan = [225, 150, 150, 150, 150].map((p, i) => line(`L${i}`, p))
    /* لا سابقَ له: الخصمُ خصمُ دورةٍ واحدة (صفر) لا خصمُ خمس */
    const first = priceCart([plan[0]], null, null, 'USD', {
      planCourseIds: plan.map((l) => l.courseId), boughtCount: 0, boughtList: 0, boughtReceived: 0,
    })
    expect(first.planCredit).toBe(0)
    expect(first.total).toBe(225)
  })
})

describe('③ والكوبونُ لا يُقاصّ', () => {
  it('⚠️ كوبونُ الدفعة الأولى لا يُنقص خصمَ الإكمال، وكوبونُ الثانية على ما بعده', () => {
    const plan = [150, 150, 150, 150].map((p, i) => line(`C${i}`, p))
    const first = priceCart(plan.slice(0, 2), null, { percentOff: 10, amountOff: null })
    /* حفظُ الطلب بلا الكوبون — فالمقاصّةُ على خصم الباقة وحدَه */
    const carry: PlanCarry = {
      planCourseIds: plan.map((l) => l.courseId), boughtCount: 2,
      boughtList: first.subtotal, boughtReceived: first.bundleDiscount + first.capDiscount + first.planCredit,
    }
    const second = priceCart(plan.slice(2), null, { percentOff: 10, amountOff: null }, 'USD', carry)
    expect(second.planCredit).toBe(120)
    /* ٣٠٠ − ٢٤ − ١٢٠ = ١٥٦ ← عشرةٌ بالمئة منها */
    expect(second.couponDiscount).toBe(15.6)
  })
})

describe('④ ولا يُحمَّل أحدٌ أكثر', () => {
  it('⚠️ دورةٌ من خارج الخطّة في السلّة لا يقع عليها خصمُ الإكمال', () => {
    const plan = [150, 150, 150, 150].map((p, i) => line(`M${i}`, p))
    const outside = line('OUT', 200)
    const carry: PlanCarry = { planCourseIds: plan.map((l) => l.courseId), boughtCount: 2, boughtList: 300, boughtReceived: 24 }
    const withOut = priceCart([...plan.slice(2), outside], null, null, 'USD', carry)
    const without = priceCart(plan.slice(2), null, null, 'USD', carry)
    /* بنودُ الخطّة تبلغ سعرَها معا؛ والدورةُ الخارجيّةُ تأخذ سلّمَ السلّة لا أكثر */
    expect(withOut.planCredit).toBeLessThanOrEqual(without.planCredit)
    expect(withOut.total).toBeGreaterThan(without.total)
  })

  it('⚠️ وما خُصم من قبلُ أكثرَ من خصم الخطّة لا يُستردّ في الدفعة التالية', () => {
    const plan = [150, 150].map((p, i) => line(`N${i}`, p))
    const p = priceCart([plan[1]], null, null, 'USD', {
      planCourseIds: plan.map((l) => l.courseId), boughtCount: 1, boughtList: 150, boughtReceived: 90,
    })
    expect(p.planCredit).toBe(0)
    expect(p.total).toBe(150)
  })

  it('وبلا سابقٍ من الخطّة كلُّ سلّةٍ كما كانت حرفا بحرف', () => {
    const lines = [line('X', 150), line('Y', 175), line('Z', 199)]
    const before = priceCart(lines, null, null)
    const after = priceCart(lines, null, null, 'USD', { planCourseIds: ['X', 'Y', 'Z'], boughtCount: 0, boughtList: 0, boughtReceived: 0 })
    expect(after).toEqual(before)
  })
})
