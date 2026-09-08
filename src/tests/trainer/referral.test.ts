/* رابطُ دعوة المدرّب — من الصفحة إلى الدفع إلى الكشف.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): سعرٌ واحدٌ للطالب، وأجران للمدرّب، ورابطٌ
   لكلّ شعبة، وعلامةٌ عند اسم كلّ طالبٍ تقول من أين جاء. والفحصُ على البنية —
   الشيفرةُ بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('رابطُ دعوة المدرّب', () => {
  it('صفحةُ الدورة تلتقط `?ref` وتحفظه للجلسة — والدفعُ يرسله', () => {
    expect(code('src/pages/CoursePath.tsx')).toMatch(/searchParams\.get\("ref"\)/)
    expect(code('src/pages/CoursePath.tsx')).toContain('sessionStorage.setItem(REFERRAL_KEY')
    const buy = code('src/components/BuyPanel.tsx')
    /* إلى إغلاق النداء نفسِه لا أوّلِ `})` — فوسطَه انتشاراتٌ تُغلق قبله */
    const post = /apiPost<CheckoutResult>\("\/api\/learner\/checkout", \{[\s\S]*?\n\s*\}\)/.exec(buy)?.[0] ?? ''
    expect(post, 'نداءُ الدفع مفقود').toBeTruthy()
    expect(post, 'الرمزُ لا يصل الدفع').toContain('referralCode')
  })

  it('والسعرُ على الطالب واحد — لا خصمَ بالرمز في التسعير', () => {
    const svc = code('server/services/commerce.service.ts')
    const checkout = /async checkout\([\s\S]*?\n {2}\}\n/.exec(svc)?.[0] ?? ''
    expect(checkout).toBeTruthy()
    expect(checkout, 'الرمزُ يدخل التسعير').not.toMatch(/priceFor\([^)]*referral/)
    expect(checkout, 'الرمزُ لا يُحمل مع الحجز').toContain('referralCode')
  })

  it('والمصدرُ يُختم على التسجيل ولا يُكتب فوقَه', () => {
    const svc = code('server/services/enrollment.service.ts')
    expect(svc).toContain('referralProfileId: referral.profileId')
    expect(svc, 'الختمُ الأوّل لا يُصان').toContain('existing.referralProfileId ? {} : stamp')
  })

  it('والمدرّبُ يرى العلامةَ عند الاسم — في «متعلّموني» وفي الورشة', () => {
    expect(code('src/pages/trainer/MyLearners.tsx')).toContain('عبر رابطك')
    expect(code('src/pages/trainer/CohortWorkspace.tsx')).toContain('referral-link')
    expect(code('src/pages/trainer/CohortWorkspace.tsx')).toContain('عبر رابطك')
    /* ولا يخرج معرّفُ المدرّب — العلامةُ وحدَها */
    expect(code('server/services/enrollment.service.ts')).toContain('referralProfileId: undefined')
  })

  it('والكشفُ بندان: عامٌّ وعبر الرابط — وأجرُ الإحالة يُضبط من الإدارة', () => {
    const earn = code('server/services/earnings.service.ts')
    expect(earn).toContain('cohort:${cohortId}:referral')
    expect(code('src/pages/admin/TrainerOps.tsx')).toContain('referralRate')
    expect(code('src/pages/trainer/Earnings.tsx')).toContain('عبر رابطك')
  })
})
