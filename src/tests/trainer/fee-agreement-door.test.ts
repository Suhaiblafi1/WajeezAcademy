/* الأجرُ في «الاتفاقية» وحدَها — والماليّةُ تفتح «الاتفاقية» وحدَها (٢٦ أكتوبر ٢٠٢٦).

   سُئل صاحبُ المنصّة: الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها، والماليّةُ تضبطه (قرارُ «C») ولا تقرأ الطلبات.
   أين تغيّره؟ فقال «a»: تفتح «الاتفاقية» وحدَها، و«الأتعاب» تعرض الأجرَ ولا تغيّره — كلُّ سطرٍ فيها يفتح ملفَّ صاحبه.
   والخادمُ يحرسه `server/tests/trainer/fee-agreement-door.test.ts`؛ وهذا يحرس الشاشة:

   ① من يضبط الأجرَ أو يركّب العقدَ ولا يقرأ الطلبات يُفتح له الملفُّ على «الاتفاقية» وحدَها — بأدوار المنصّة نفسِها.
   ② وملفُّه بالعنوان نفسِه: يُنتظر جوابُ الجلسة، ثمّ «الاتفاقية» وحدَها من حمولتها، بخطواتها نفسِها لا بنسخةٍ ثانية.
   ③ و«الأتعاب» لا تكتب قاعدة: كلُّ سطرٍ يفتح «الاتفاقية» — والكاتبُ الوحيدُ للقاعدة في الشاشات خطوةُ الأجر.
   ④ وخطوةُ الأجر تقصره على شعبةٍ من شعبه كما كانت «الأتعاب» — وسجلُّه يسمّي الشعبة، والعقدُ لا يُذكر لقاعدة شعبة.
   ⑤ واعتمادُ التوقيع لمن يملكه: للماليّة سطرٌ لا زرٌّ يردّه الخادم. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROLE_PERMISSIONS } from '../../../server/auth/permissions'
import { agreementHref, opensAgreementOnly } from '@/application/trainer/record-links'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PREP = code('src/pages/admin/PreparationSteps.tsx')
const APPS = code('src/pages/admin/TrainerApplications.tsx')
const ONLY = code('src/pages/admin/TrainerAgreementOnly.tsx')
const OPS = code('src/pages/admin/TrainerOps.tsx')
const FEE = /function FeeStep\(\{[\s\S]*?\n\}\n/.exec(PREP)?.[0] ?? ''
const CONTRACT = /function ContractStep\(\{[\s\S]*?\n\}\n/.exec(PREP)?.[0] ?? ''

describe('① من يفتح «الاتفاقية» وحدها', () => {
  it('⚠️ الماليّة — ومن يقرأ الطلبات يفتح الملف كله', () => {
    expect(opensAgreementOnly(ROLE_PERMISSIONS.finance)).toBe(true)
    expect(opensAgreementOnly(ROLE_PERMISSIONS.academic_manager)).toBe(false)
    expect(opensAgreementOnly(ROLE_PERMISSIONS.super_admin)).toBe(false)
    expect(opensAgreementOnly(ROLE_PERMISSIONS.academic_coordinator)).toBe(false)
    expect(opensAgreementOnly(ROLE_PERMISSIONS.support)).toBe(false)
    /* وبكلّ حبّةٍ من حبّتَي الأجر وحدَها — فالتفويضُ الفرديُّ يسلكه كذلك */
    expect(opensAgreementOnly(['trainer.compensation.manage'])).toBe(true)
    expect(opensAgreementOnly(['trainer.contract.manage'])).toBe(true)
  })
})

describe('② وملفّه بالعنوان نفسه', () => {
  it('⚠️ ينتظر الجلسة ثم «الاتفاقية» وحدها', () => {
    const entry = /export default function TrainerApplications\(\) \{[\s\S]*?\n\}\n/.exec(APPS)?.[0] ?? ''
    expect(entry, 'لا مدخل').toContain('const { user, checked } = useRealSession();')
    const wait = entry.indexOf('if (!checked) return')
    const only = entry.indexOf('if (id && opensAgreementOnly(user?.permissions ?? [])) return <TrainerAgreementOnly id={id} />;')
    expect(wait, 'لا ينتظر الجلسة').toBeGreaterThan(-1)
    expect(only, 'لا «اتفاقية» وحدها').toBeGreaterThan(wait)
    expect(entry).toContain('return <TrainerApplicationsPage />;')
  })

  it('⚠️ من حمولتها وحدها — بخطواتها نفسها لا بنسخة ثانية', () => {
    expect(ONLY).toContain('apiGet<AgreementView>(`/api/admin/trainer-applications/${id}/agreement`)')
    expect(ONLY, 'تقرأ الملف كله').not.toMatch(/`\/api\/admin\/trainer-applications\/\$\{id\}`/)
    expect(ONLY).toMatch(/<PreparationSteps\s+profileId=\{a\.profile\?\.id \?\? null\}/)
    expect(ONLY, 'تكتب بنفسها').not.toMatch(/\bapi(Post|Patch|Put|Delete)\b/)
  })
})

describe('③ و«الأتعاب» لا تكتب قاعدة', () => {
  it('⚠️ كل سطر يفتح «الاتفاقية» في ملفه', () => {
    expect(OPS).toMatch(/<Link to=\{agreementHref\(t\.applicationId\)\}/)
    expect(agreementHref('app-1')).toBe('/admin/trainers/app-1?tab=agreement')
  })

  it('⚠️ والكاتب الوحيد للقاعدة في الشاشات خطوة الأجر', () => {
    const writers: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        const rel = full.slice(process.cwd().length + 1)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(name) && /apiPost(<[^>]*>)?\(\s*["'`]\/api\/admin\/trainer-compensation-rules["'`]/.test(code(rel))) {
          writers.push(rel)
        }
      }
    }
    walk(join(process.cwd(), 'src/pages'))
    walk(join(process.cwd(), 'src/components'))
    expect(writers).toEqual(['src/pages/admin/PreparationSteps.tsx'])
    expect(FEE).toContain('apiPost("/api/admin/trainer-compensation-rules", {')
  })
})

describe('④ وخطوة الأجر تقصره على شعبة', () => {
  it('⚠️ شعبه كلها أو شعبة منها — كما كانت «الأتعاب»', () => {
    expect(FEE).toContain('apiGet<FeeCohort[]>(`/api/admin/trainers/${profileId}/fee-cohorts`)')
    const pick = /<select value=\{scope\}[\s\S]*?<\/select>/.exec(FEE)?.[0] ?? ''
    expect(pick, 'لا اختيار').toContain('<option value="">شعبه كلّها</option>')
    expect(pick).toContain('{cohorts.map((c) => <option key={c.id} value={c.id}>')
    const save = /const save = \(\) =>[\s\S]*?"ضبط الاتفاق الماليّ"\);/.exec(FEE)?.[0] ?? ''
    expect(save, 'الحفظ لا يقصر').toContain('...(scope ? { cohortId: scope } : {}),')
    expect(save, 'لا يعاد ما سرى على شعبه').toContain('loadCohorts();')
  })

  it('⚠️ وما سرى على شعبه يقرأ بجانب العامة — والسجل يسمي الشعبة', () => {
    expect(FEE).toMatch(/\{own\.map\(\(c\) => \(\s*<li key=\{c\.id\}/)
    expect(FEE).toContain('{h.cohortTitle && <> لشعبة «{h.cohortTitle}»</>}')
  })

  it('⚠️ والعقد لا يذكر لقاعدة شعبة — نصه بالأجر العام', () => {
    expect(FEE).toMatch(/\{out && !scope && \(\s*<Inset/)
    expect(FEE).toMatch(/\{out && !scope && contractsHref && \(/)
  })
})

describe('⑤ واعتماد التوقيع لمن يملكه', () => {
  it('⚠️ للماليّة سطر لا زر يرده الخادم', () => {
    expect(CONTRACT).toMatch(/\{awaitingCountersign && !canApprove && \(\s*<p/)
    expect(CONTRACT).toMatch(/\{awaitingCountersign && canApprove && \(/)
    expect(PREP).toContain('canApprove={can("trainer.applications.decide")}')
  })
})
