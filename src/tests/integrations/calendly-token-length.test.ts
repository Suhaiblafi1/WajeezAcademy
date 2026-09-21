/* سقفُ رمز Calendly — أيسعُ رمزا حقيقيّا؟

   ═══ العطبُ الذي كُتب له (٢١ سبتمبر ٢٠٢٦) ═══

   كانت المزامنةُ ساقطةً بـ«ردّ 401» — رمزٌ مرفوض. فذهب صاحبُ المنصّة يولّد
   رمزا جديدا ويلصقه، فرُدّ بـ«القيمةُ فوق الحدّ الأعلى — الحقل token».

   والحدُّ أربعُمئةِ حرفٍ اخترناها نحن. ورمزُ Calendly الشخصيُّ **JWT**:
   ترويسةٌ وحمولةٌ وتوقيعُ ES256 مفصولةٌ بنقطتَين — ويجاوز الأربعَمئةَ في
   الأعمّ. فلا حيلةَ لمن قرأ الردّ: الرمزُ يُولَّد بطوله عند Calendly، ولا
   يُقصّ ولا يُختصَر ولا يُعاد توليدُه أقصرَ.

   **فبابُ إصلاح العطب كان مغلقا بعطبٍ ثانٍ**، وبقيت «المقابلات (0)» في كلّ
   ملفّ لأجل حرفٍ زائد.

   ═══ ولمَ يُقاس على رمزٍ مبنيٍّ لا على رقمٍ مكتوب ═══

   لو قيل «السقفُ ألفان» لَصار الحارسُ يحرس الرقمَ لا المعنى: من خفضه إلى
   خمسِمئةٍ يمرّ ما دام أكبرَ من الأربعِمئة الأولى. فيُبنى هنا رمزٌ بصورة
   JWT حقيقيّةٍ بأطوالٍ معروفة، ويُسأل: أيسعه الحاجز؟ */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CALENDLY_TOKEN_MAX } from '@/application/integrations/calendly-token'

/** رمزٌ بصورة JWT: ترويسةٌ ES256 وحمولةُ PAT وتوقيعٌ — بأطوالٍ واقعيّة */
function fakeCalendlyPat(): string {
  const b64 = (n: number) => 'a'.repeat(n)
  /* الترويسةُ نحوُ ١٣٠، والحمولةُ نحوُ ٣٢٠، والتوقيعُ نحوُ ٩٠ — وهي أطوالُ
     رمزٍ مولَّدٍ فعلا، مجموعُها يجاوز الأربعَمئةَ بمراحل. */
  return `${b64(130)}.${b64(320)}.${b64(90)}`
}

describe('سقفُ رمز Calendly يسع رمزا حقيقيّا', () => {
  const token = fakeCalendlyPat()

  it('ورمزٌ بصورة JWT يجاوز الأربعَمئةَ — وهو ما كان يُردّ', () => {
    expect(token.length, 'الرمزُ المبنيُّ أقصرُ من أن يكشف العطب')
      .toBeGreaterThan(400)
  })

  /* ═══ وهذا هو الحارسُ الذي من أجله كُتب الملفّ ═══ */
  it('والحاجزُ يسعه — فلا يُردّ رمزٌ صحيحٌ بحدٍّ اخترناه', () => {
    expect(
      z.string().max(CALENDLY_TOKEN_MAX).safeParse(token).success,
      `سقفُ الرمز ${CALENDLY_TOKEN_MAX} لا يسع رمزا طولُه ${token.length}`,
    ).toBe(true)
  })

  it('ويسع ضِعفَه — فرمزٌ أطولُ من غدٍ لا يُردّ كذلك', () => {
    const longer = `${'a'.repeat(300)}.${'a'.repeat(600)}.${'a'.repeat(120)}`
    expect(z.string().max(CALENDLY_TOKEN_MAX).safeParse(longer).success).toBe(true)
  })

  it('والسقفُ موضوعٌ لا مرفوع — فحقلُ اعتمادٍ بلا حدٍّ بابٌ مفتوح', () => {
    expect(CALENDLY_TOKEN_MAX).toBeLessThanOrEqual(8000)
    expect(z.string().max(CALENDLY_TOKEN_MAX).safeParse('a'.repeat(CALENDLY_TOKEN_MAX + 1)).success)
      .toBe(false)
  })

  /* والحاجزان — الحفظُ والفحص — يقرآن الثابتَ نفسَه. ولو نُسخ رقمُه في
     أحدهما لَقبِل موضعٌ ما يردّه الآخر، فيُحفظ رمزٌ لا يُفحَص أو عكسُه. */
  it('والحفظُ والفحصُ يقرآن الثابتَ نفسَه لا رقمَين', () => {
    const route = readFileSync(
      join(process.cwd(), 'server/http/routes/integrations.routes.ts'), 'utf8',
    )
    const hits = [...route.matchAll(/token: z\.string\(\)[^\n]*max\(([^)]+)\)/g)]
    expect(hits.length, 'لم يُعثر على حاجزَي الرمز').toBe(2)
    for (const h of hits) {
      expect(h[1], `حاجزٌ برقمٍ مكتوبٍ بيده: ${h[0]}`).toBe('CALENDLY_TOKEN_MAX')
    }
  })
})
