/* حزمةُ الخطط المفتوحة كلِّها — ومنها ما عند المدرّبين، وما فعلوه بالتعديلات (١٢ أكتوبر ٢٠٢٦).
   «طبّق ذلك على كلّ خطّةٍ أرسلتُها إلى المدرّبين» (صاحب المنصّة). الخادمُ في
   `server/tests/plan/review-bundle.test.ts` (٤)، وهنا الشاشةُ والنصّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE_SCOPES } from '@/application/trainer/review-bundle-scopes'
import { decisionsMarkdown } from '@/application/trainer/plan-review-bundle'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const page = code('src/pages/admin/PendingPlans.tsx')

describe('زرّان بما في كلّ منهما', () => {
  it('⚠️ لكلّ حزمة مسلكها في الخادم', () => {
    expect(BUNDLE_SCOPES.pending.path).toBe('/api/admin/cohort-plans/pending/review-bundle')
    expect(BUNDLE_SCOPES.open.path).toBe('/api/admin/cohort-plans/open/review-bundle')
    expect(page).toMatch(/await apiDownload\(BUNDLE_SCOPES\[scope\]\.path, BUNDLE_SCOPES\[scope\]\.fileName\)/)
  })

  it('⚠️ وزرّ المفتوحة يظهر ولو لم تنتظر خطّة اعتمادك — وما فيه مقول بجانبه', () => {
    const box = page.slice(page.indexOf('{rows !== null && (\n        <Inset'))
    expect(box.indexOf('BUNDLE_SCOPES.open.whatAr'), 'زرّ المفتوحة داخل شرط «في الطابور خطط»')
      .toBeGreaterThan(box.indexOf('{rows.length > 0 && ('))
    expect(box.indexOf('BUNDLE_SCOPES.open.whatAr')).toBeGreaterThan(box.indexOf('</>'))
    expect(page).toMatch(/onClick=\{\(\) => void downloadAll\("open"\)\}/)
    expect(BUNDLE_SCOPES.open.whatAr).toMatch(/ما رددته إلى مدربه/)
    expect(BUNDLE_SCOPES.open.whatAr).toMatch(/ما قبله المدرب من التعديلات وما رفضه وكلمته/)
  })

  it('⚠️ ونصّه بلا تشكيل إعرابي — اللغة البيضاء', () => {
    expect([BUNDLE_SCOPES.open.labelAr, BUNDLE_SCOPES.open.whatAr].join(' ')).not.toMatch(/[ً-ِْ]/)
  })
})

describe('ملف قرار المدرب', () => {
  const item = (status: string, noteAr: string | null = null) => ({ titleAr: `بند ${status}`, stepAr: 'المحاور', status, required: true, reasonAr: 'السبب', noteAr })

  it('⚠️ العدد لكل حال، والمرفوض أولا بكلمة المدرب', () => {
    const md = decisionsMarkdown('الشعبة', 'المدرب', [item('accepted'), item('rejected', 'المواعيد صعبة'), item('pending')])
    expect(md).toContain('**العدد:** رفضها 1 · عند المدرب — لم يقرر 1 · قبلها 1')
    expect(md.indexOf('## رفضها')).toBeLessThan(md.indexOf('## قبلها'))
    expect(md).toContain('  - كلمة المدرب: المواعيد صعبة')
    expect(md).toContain('- **بند rejected** · المحاور · مطلوب')
  })

  it('ولا بنود: يقال ذلك', () => {
    expect(decisionsMarkdown('الشعبة', null, [])).toContain('لا تعديلات مقترحة على هذه الخطة.')
  })
})
