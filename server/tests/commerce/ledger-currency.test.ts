/* عملةُ الدفتر واحدة — والافتراضُ لا يُخالفها.

   كانت سبعةُ نماذج في المخطّط تفترض الدينارَ الأردنيّ (`@default("JOD")`)،
   منها مسلكُ المال كلُّه: `Cohort` و`Order` و`Invoice` و`Payment`. وخمسةُ
   مواضع في الخدمات تسقط إليه (`?? 'JOD'`). والكتالوجُ مسعَّرٌ بالدولار مئةً
   بالمئة، وحسابُ Stripe لدينا أمريكيٌّ لا يقبل `jod` أصلا — جُرّب فرُفض.

   وهذا صنفُ عطبٍ لا يُرمى له خطأ: الصفُّ يُنشأ، ويُخزَّن، ويُعرض، ويُجمع مع
   غيره — ولا يظهر إلّا عند أوّل شحنٍ يُرفض، أو لا يظهر أبدا ويُحاسَب برقمٍ
   من عملةٍ أخرى.

   فالحارسُ على الافتراض نفسِه لا على مثالٍ يمرّ به. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LEDGER_CURRENCY, isPresentmentCurrency } from '../../../src/application/commerce/presentment'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('المخطّطُ لا يفترض عملةً غير الدفتر', () => {
  const SCHEMA = read('prisma/schema.prisma')

  it('لا `@default("JOD")` في أيّ نموذج — ولا في مسلك المال خاصّة', () => {
    expect(SCHEMA, 'عاد افتراضُ الدينار إلى المخطّط').not.toMatch(/@default\("JOD"\)/)
  })

  it('وكلُّ افتراضِ عملةٍ هو عملةُ الدفتر — لا ثالثَ يتسلّل', () => {
    const defaults = [...SCHEMA.matchAll(/currency\s+String\??\s+@default\("([A-Z]{3})"\)/g)].map((m) => m[1])
    expect(defaults.length, 'اختفت افتراضاتُ العملة كلُّها — أوَحُذف العمود؟').toBeGreaterThanOrEqual(7)
    expect([...new Set(defaults)]).toEqual([LEDGER_CURRENCY])
  })

  it('والترحيلُ موجودٌ فعلا — المخطّطُ وحدَه لا يغيّر قاعدةً قائمة', () => {
    const sql = read('prisma/migrations/20260901180000_ledger_currency_usd/migration.sql')
    for (const table of ['Cohort', 'Order', 'Invoice', 'Payment', 'SubscriptionPlan', 'TrainerPayout', 'TrainerCompensationRule']) {
      expect(sql, `${table} خارج الترحيل`).toMatch(new RegExp(`"${table}"[\\s\\S]{0,60}SET DEFAULT 'USD'`))
    }
  })
})

describe('والخدماتُ لا تسقط إلى عملةٍ مكتوبة', () => {
  for (const f of [
    'server/services/earnings.service.ts',
    'server/services/commerce.service.ts',
    'server/services/cohort.service.ts',
  ]) {
    it(`${f}: السقوطُ إلى الثابت لا إلى حرفٍ في السطر`, () => {
      const src = read(f)
      expect(src, 'عاد الحرفُ المكتوب').not.toMatch(/\?\?\s*'JOD'/)
      expect(src).toMatch(/\?\?[^\n]*LEDGER_CURRENCY/)
    })
  }

  /* كان المستشار يرفع خصما بالدينار على شعبةٍ مسعَّرة بالدولار، فيصل إلى
     الماليّة رقمٌ بعملةٍ لا يقبلها الطلب — والعملةُ تُختار عند الدفع وحدَه. */
  it('ولا منتقيَ عملةٍ في طلبات المستشار — التبديلُ عند الدفع لا قبله', () => {
    const src = read('src/pages/advisor/RequestsPanel.tsx')
    expect(src, 'عاد منتقي العملة').not.toMatch(/<option value="JOD"/)
    expect(src).toMatch(/LEDGER_CURRENCY/)
  })
})

describe('وعملةُ الدفتر داخلةٌ في عملات العرض', () => {
  /* لو خرجت لصار الدفترُ بعملةٍ لا يستطيع أحدٌ أن يدفع بها */
  it('الدولارُ مقبولٌ للعرض كما هو للدفتر', () => {
    expect(isPresentmentCurrency(LEDGER_CURRENCY)).toBe(true)
  })
})
