/* الطالبُ والمستشار — ما لو انكسر في الواجهة لم يحمرّ خادم (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/advisor-flow.test.ts`. وهنا: أنّ نتيجةَ الضيف تُرفع بعد
   الدخول ومعها وقتُ حفظها، وأنّ ما أسنده النظامُ يُرى ويُغيَّر في شاشة الإدارة، وأنّ
   المشتريَ بلا تشخيصٍ يُفتح له من كلّ أبواب الشراء. والفحصُ على البنية: التعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const AUTH = code('src/services/auth.ts')
const STORE = code('src/application/diagnostic/session-store.ts')
const ATTACH = code('server/http/routes/operations.routes.ts')
const QUEUE = code('src/pages/admin/Exceptions.tsx')
const ROUTES = code('server/http/routes/advisor.routes.ts')
const COMMERCE = code('server/services/commerce.service.ts')

/** جسمُ دالّةٍ في صنف — من رأسها إلى رأس التي تليها */
const methodBody = (src: string, name: string) => {
  const start = src.indexOf(`async ${name}(`)
  const next = src.indexOf('\n  async ', start + 1)
  const nextPrivate = src.indexOf('\n  private async ', start + 1)
  const ends = [next, nextPrivate].filter((i) => i > start)
  return src.slice(start, ends.length ? Math.min(...ends) : undefined)
}

describe('نتيجةُ الضيف تلحق حسابَه حين يدخل', () => {
  it('⚠️ الدخولُ الناجحُ يرفعها — ومعها وقتُ حفظها ليحكم الخادمُ أيّهما أحدث', () => {
    expect(AUTH).toMatch(/writeSession\([\s\S]{0,800}?void syncPendingDiagnostic\(\)/)
    expect(STORE).toMatch(/fetch\('\/api\/learner\/diagnostic-attach'[\s\S]{0,300}?completedAt/)
    expect(ATTACH).toMatch(/completedAt: z\.string\(\)\.datetime\(\)\.optional\(\)/)
  })
})

describe('ما أسنده النظامُ يُرى ويُغيَّر', () => {
  it('⚠️ شاشةُ الإدارة تقرأ «أسندت تلقائيا» وتغيّر بالباب نفسِه', () => {
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/advisor-cases\/auto-assigned'/)
    expect(QUEUE).toMatch(/apiGet<AutoAssignedCase\[\]>\("\/api\/admin\/advisor-cases\/auto-assigned"\)/)
    expect(QUEUE).toMatch(/autoRows\.map\([\s\S]*?onClick=\{\(\) => void assign\(c\.id\)\}/)
  })

  it('ونصوصُها بلا تشكيلٍ إعرابيّ', () => {
    for (const t of ['أسندت تلقائيا — آخر ٣٠ يوما', 'لأقل المستشارين حالات. غيّر المستشار إن رأيت غيره أنسب.', 'اختر مستشارا آخر…']) {
      expect(QUEUE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})

describe('من يشتري بلا تشخيصٍ يجد مستشارا — من كلّ أبواب الشراء', () => {
  it('⚠️ طلبُ التسجيل، وطلبُ الخطّة، والشراءُ المباشر', () => {
    for (const m of ['requestEnrollment', 'requestPlanEnrollment', 'checkout']) {
      expect(methodBody(COMMERCE, m), `«${m}» لا يفتح حالةً للمشتري`).toMatch(/this\.openBuyerCase\(userId\)/)
    }
  })

  it('⚠️ والتسويةُ تحوّل الحالةَ «سجّل»', () => {
    expect(methodBody(COMMERCE, 'settleOrder')).toMatch(/this\.advisors\.markClientPaid\(order\.userId, orderId\)/)
  })
})
