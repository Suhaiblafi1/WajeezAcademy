/* أيستحقّ المدرّبُ الصرفَ الآن — القاعدةُ وما تقوله شاشةُ الأتعاب (١٩ أكتوبر ٢٠٢٦).

   الحسابُ على القاعدة في `server/tests/trainer/payout-readiness.test.ts`. وهنا: القاعدةُ نفسُها
   (`pay-readiness.ts`)، والشاشةُ تقول سطرَها على كلّ كشف، وموعدَ الاعتماد، ولا تُكشف الأرقامُ إلّا
   بتأكيد، ولا زرَّ صرفٍ قبل الكشف — والنصوصُ بلا تشكيل. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { MANUAL_PAYOUT_AR, cohortIdsOf, payReadiness, payReadinessAr } from '@/application/trainer/pay-readiness'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const OPS = code('src/pages/admin/TrainerOps.tsx')

const s = (status: string, approvalState = 'approved') => ({ status, approvalState })
const ID = '0b6c1a52-8f3e-4f0a-9d1e-3c2b5a7d9e10'

describe('القاعدة', () => {
  it('⚠️ يستحقّ إذا انتهت لقاءاتُه الحيّةُ كلُّها أو أُغلقت الشعبة', () => {
    expect(payReadiness({ title: 'أ', status: 'active', sessions: [s('done'), s('scheduled')] }).ready).toBe(false)
    expect(payReadiness({ title: 'أ', status: 'active', sessions: [s('done'), s('done')] }).ready).toBe(true)
    expect(payReadiness({ title: 'أ', status: 'completed', sessions: [s('done'), s('live')] }).ready).toBe(true)
    expect(payReadiness({ title: 'أ', status: 'active', sessions: [] }).ready, 'شعبةٌ بلا لقاءاتٍ لم تُغلق عُدّت منتهية').toBe(false)
  })

  it('⚠️ والملغى والمنتظرُ اعتمادَه لا يُعدّان لقاءً حيّا', () => {
    const r = payReadiness({ title: 'أ', status: 'active', sessions: [s('done'), s('cancelled'), s('scheduled', 'pending')] })
    expect(r).toMatchObject({ sessionsTotal: 1, sessionsLeft: 0, ready: true })
  })

  it('⚠️ وشعبُ الكشف من بنوده — ومنها `:referral` و`:floor`، ولا غيرها', () => {
    expect(cohortIdsOf([{ sourceRef: `cohort:${ID}` }, { sourceRef: `cohort:${ID}:floor` }, { sourceRef: 'trainer_code:x' }, { sourceRef: null }])).toEqual([ID])
  })
})

describe('شاشةُ الأتعاب', () => {
  it('⚠️ سطرُ الاستحقاق على كلّ كشف — واليدويُّ يُقال إنّه يدويّ', () => {
    expect(OPS).toMatch(/\{p\.readiness\.length === 0 && <p className="text-gold-ink">\{MANUAL_PAYOUT_AR\}<\/p>\}/)
    expect(OPS).toMatch(/\{p\.readiness\.map\(\(r, k\) => \(/)
  })

  it('⚠️ وموعدُ الاعتماد — والزرُّ لا يُضغط قبله', () => {
    expect(OPS).toMatch(/\{p\.status === "pending" && new Date\(p\.approvableFrom\) > new Date\(\) && \(/)
    expect(OPS).toMatch(/disabled=\{busy \|\| new Date\(p\.approvableFrom\) > new Date\(\)\}/)
  })

  it('⚠️ ولا يُكشف الرقمُ إلّا بتأكيد، ولا زرَّ صرفٍ قبل الكشف', () => {
    expect(OPS).toMatch(/onClick=\{\(\) => setRevealFor\(p\)\}>اكشف رقم الحساب<\/Button>/)
    expect(OPS).toMatch(/\{revealFor && \(\s*<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void reveal\(revealFor\)\}/)
    expect(OPS).toMatch(/apiPost<\{ iban: string \}>\(`\/api\/admin\/trainer-payouts\/\$\{p\.id\}\/bank-account\/reveal`\)/)
    expect(OPS).toMatch(/\{p\.status === "approved" && p\.bankAccount && \(ibans\[p\.id\] \|\| p\.revealed\) && \(\s*<Button[^\n]*\/pay`/)
  })
})

describe('النصوص', () => {
  it('بلا تشكيلٍ إعرابيّ', () => {
    const samples = [
      MANUAL_PAYOUT_AR,
      payReadinessAr(payReadiness({ title: 'القيادة', status: 'active', sessions: [s('done'), s('scheduled')] })),
      payReadinessAr(payReadiness({ title: 'القيادة', status: 'active', sessions: [s('done')] })),
      payReadinessAr(payReadiness({ title: 'القيادة', status: 'completed', sessions: [s('done')] })),
      payReadinessAr(payReadiness({ title: 'القيادة', status: 'completed', sessions: [s('scheduled')] })),
      payReadinessAr(payReadiness({ title: 'القيادة', status: 'completed', sessions: [] })),
      payReadinessAr(payReadiness({ title: 'القيادة', status: 'active', sessions: [] })),
    ]
    for (const t of samples) expect(t).toBe(plainAr(t))
    for (const t of [
      'لم يدخل المدرب حسابه البنكي بعد، فلا يصرف حتى يدخله من «مستحقاتي».',
      'يظهر الرقم كاملا في هذه الشاشة فقط، ويسجل الكشف باسمك مع الكشف ومبلغه. وإن بدل المدرب حسابه بعدها فلا يقبل الصرف حتى تكشفه ثانية.',
    ]) {
      expect(OPS).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})
