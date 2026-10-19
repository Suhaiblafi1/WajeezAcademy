/* كشوفُ عمولة المستشار — ما تقوله الشاشاتُ ومن يملك الباب (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/advisor-payouts.test.ts`. وهنا: البابُ بيد من يصرف (`finance`)
   لا بيد المستشار ولا من يقرّر نسبتَه، وكلُّ فعلٍ بتأكيدٍ يقول ما سيقع، والمستشارُ يرى كشوفَه
   ببنودها، والجرسُ مالٌ لا يُكتَم يفتح «عمولتي» — والنصوصُ بلا تشكيل. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { categoryForTemplate, isSilenceable } from '@/application/notifications/categories'
import { auditActionAr } from '@/application/audit/labels'
import { ROLE_PERMISSIONS } from '../../../server/auth/permissions'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const ROUTES = code('server/http/routes/admin-advisor-payouts.routes.ts')
const ADMIN = code('src/pages/admin/AdvisorPayouts.tsx')
const MINE = code('src/pages/advisor/Earnings.tsx')
const SERVICE = code('server/services/advisor-payout.service.ts')
const JOBS = code('server/worker/jobs.ts')
const NAV = code('src/pages/admin/nav-map.ts')
const APP = code('src/App.tsx')
const DESTINATIONS = code('src/application/notifications/destinations.ts')

describe('البابُ بيد من يصرف', () => {
  it('⚠️ الماليّةُ تملكه — لا المستشارُ ولا المديرُ الأكاديميّ', () => {
    expect(ROLE_PERMISSIONS.finance).toContain('advisor.payout.manage')
    expect(ROLE_PERMISSIONS.advisor).not.toContain('advisor.payout.manage')
    expect(ROLE_PERMISSIONS.academic_manager).not.toContain('advisor.payout.manage')
  })

  it('⚠️ وكلُّ مسارٍ في البابِ خلفه', () => {
    expect(ROUTES).toMatch(/const canPay = requirePermission\('advisor\.payout\.manage'\)/)
    const routes = ROUTES.match(/app\.(get|post)\(/g) ?? []
    const guarded = ROUTES.match(/preHandler: canPay,/g) ?? []
    /* وكشفُ رقم الحساب وحدَه بصلاحيّته الماليّة — `advisor-bank-screens.test.ts` */
    const reveal = ROUTES.match(/preHandler: requirePermission\('finance\.bank\.reveal'\),/g) ?? []
    expect(routes.length).toBe(6)
    expect(guarded.length + reveal.length, 'مسارٌ بلا حارس').toBe(routes.length)
    expect(reveal.length).toBe(1)
    expect(NAV).toMatch(/to: "\/admin\/advisor-payouts", [^}]*need: "advisor\.payout\.manage"/)
    expect(APP).toMatch(/<Route path="\/admin\/advisor-payouts" element=\{<AdminAdvisorPayouts \/>\} \/>/)
  })
})

describe('شاشةُ من يصرف', () => {
  it('⚠️ لا فعلَ بضغطةٍ واحدة — والإلغاءُ بسبب', () => {
    for (const kind of ['approve', 'pay', 'cancel']) {
      expect(ADMIN).toMatch(new RegExp(`onClick=\\{\\(\\) => setConfirm\\(\\{ kind: "${kind}", payout: p \\}\\)\\}`))
      expect(ADMIN).toMatch(new RegExp(`\\{confirm\\?\\.kind === "${kind}" && \\(\\s*<ConfirmAction`))
    }
    expect(ADMIN).toMatch(/reason=\{\{ labelAr: "سبب الإلغاء", minLength: 5 \}\}/)
  })
})

describe('«عمولتي»', () => {
  it('⚠️ ما صُرف وما ينتظر وما يدخل القادم — وكشوفُه ببنودها', () => {
    for (const k of ['data.paid', 'data.awaiting', 'data.upcoming']) expect(MINE).toContain(`fmtMoney(${k}, data.currency)`)
    expect(MINE).toMatch(/data\.payouts\.map\(\(p\) =>/)
    expect(MINE).toMatch(/p\.items\.map\(\(i\) =>/)
  })
})

describe('الجرسُ والعامل', () => {
  it('⚠️ جرسُ مالٍ لا يُكتَم — يفتح «عمولتي»', () => {
    expect(categoryForTemplate('advisor_payout')?.key).toBe('money')
    expect(isSilenceable('advisor_payout')).toBe(false)
    expect(DESTINATIONS).toMatch(/'advisor_payout': \{ path: '\/advisor\/earnings'/)
  })

  it('⚠️ والعاملُ يولّد الشهرَ الذي انتهى — كلَّ ستّ ساعات', () => {
    expect(JOBS).toMatch(/\{ key: 'advisor_payouts', everyMs: 6 \* HOUR, run: runAdvisorPayouts,/)
    expect(JOBS).toMatch(/generate\(lastClosedPeriod\(now\), null, now\)/)
  })
})

describe('النصوص', () => {
  it('بلا تشكيلٍ إعرابيّ', () => {
    const screens = [
      'ولد كشوف', 'لا مستشار له نسبة عمولة بعد.', 'ينتظر الصرف', 'لم يدخل كشفا', 'مرجع الحوالة (اختياري)',
      'أكد الصرف', 'ألغ الكشف', 'يصير الكشف معتمدا ينتظر الصرف، ويبلغ المستشار. ويمكن إلغاؤه ما لم يصرف.',
      'يلغى الكشف ويبلغ المستشار بالسبب. وتعود دفعاته إلى الكشف التالي، فيولد من جديد بنسبته يومها.',
    ]
    for (const t of screens) {
      expect(ADMIN).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const t of ['صرف لي', 'يدخل الكشف القادم', 'لا كشف بعد. يولد كشفك بعد نهاية كل شهر.', 'كشوفي']) {
      expect(MINE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const t of ['كشف عمولة جديد', 'اعتمد كشف عمولتك', 'صرفت عمولتك', 'ألغي كشف عمولتك', 'لا تعتمد كشفك ولا تصرفه بنفسك']) {
      expect(SERVICE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const k of ['advisor_payout.generate', 'advisor_payout.approve', 'advisor_payout.pay', 'advisor_payout.cancel', 'worker.advisor_payouts']) {
      expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
    }
  })
})
