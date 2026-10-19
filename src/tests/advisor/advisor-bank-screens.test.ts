/* حسابُ المستشار البنكيّ — ما تقوله الشاشاتُ ومن يملك الباب (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/advisor-bank.test.ts`. وهنا: المستشارُ يكتب حسابَه في «عمولتي»
   بخانة المدرّب نفسِها، والكشفُ بصلاحيّة `finance.bank.reveal` وبتأكيدٍ يقول ما سيقع، ولا زرَّ صرفٍ
   قبل الكشف — والنصوصُ بلا تشكيل. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import { BANK_COPY } from '@/application/bank/panel-copy'
import { ROLE_PERMISSIONS } from '../../../server/auth/permissions'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const MINE = code('src/pages/advisor/Earnings.tsx')
const ADMIN = code('src/pages/admin/AdvisorPayouts.tsx')
const ADVISOR_ROUTES = code('server/http/routes/advisor.routes.ts')
const PAYOUT_ROUTES = code('server/http/routes/admin-advisor-payouts.routes.ts')
const SERVICE = code('server/services/advisor-bank.service.ts')

describe('المستشارُ يكتب حسابَه في «عمولتي»', () => {
  it('⚠️ بخانة المدرّب نفسِها وبابِه هو', () => {
    expect(MINE).toContain('<BankAccountPanel endpoint="/api/advisor/bank-account" copy={BANK_COPY.advisor} />')
    for (const verb of ['get', 'put', 'delete']) {
      expect(ADVISOR_ROUTES).toMatch(new RegExp(`app\\.${verb}\\('/api/advisor/bank-account', \\{\\s*preHandler: requirePermission\\('advisor\\.cases\\.view'\\)`))
    }
  })
})

describe('والكشفُ بيد الماليّة', () => {
  it('⚠️ بصلاحيّة الكشف — لا بصلاحيّة الكشوف وحدَها', () => {
    expect(PAYOUT_ROUTES).toMatch(/app\.post\('\/api\/admin\/advisor-payouts\/:id\/bank-account\/reveal', \{\s*preHandler: requirePermission\('finance\.bank\.reveal'\)/)
    expect(ROLE_PERMISSIONS.finance).toContain('finance.bank.reveal')
    expect(ROLE_PERMISSIONS.advisor).not.toContain('finance.bank.reveal')
  })

  it('⚠️ بتأكيدٍ يقول ما سيقع — ولا زرَّ صرفٍ قبل الكشف', () => {
    expect(ADMIN).toMatch(/onClick=\{\(\) => setConfirm\(\{ kind: "reveal", payout: p \}\)\}/)
    expect(ADMIN).toMatch(/\{confirm\?\.kind === "reveal" && \(\s*<ConfirmAction/)
    expect(ADMIN).toMatch(/\{p\.status === "approved" && p\.bankAccount && \(ibans\[p\.id\] \|\| p\.revealed\) && \(/)
  })
})

describe('النصوص', () => {
  it('بلا تشكيلٍ إعرابيّ', () => {
    for (const t of Object.values(BANK_COPY.advisor)) expect(t).toBe(plainAr(t))
    for (const t of [
      'اكشف رقم الحساب', 'لم يدخل المستشار حسابه البنكي بعد، فلا يصرف حتى يدخله من «عمولتي».',
      'يظهر الرقم كاملا في هذه الشاشة فقط، ويسجل الكشف باسمك مع الكشف ومبلغه. وإن بدل المستشار حسابه بعدها فلا يقبل الصرف حتى تكشفه ثانية.',
    ]) {
      expect(ADMIN).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const t of ['تغير حسابك البنكي في وجيز', 'ألغي حسابك البنكي في وجيز', 'حسابك موقوف، فلا يبدل الحساب البنكي الآن. راجع الإدارة.']) {
      expect(SERVICE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const k of ['advisor.bank.set', 'advisor.bank.remove', 'advisor.bank.reveal']) {
      expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
    }
  })
})
