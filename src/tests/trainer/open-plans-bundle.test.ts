/* حزمةُ الخطط المفتوحة كلِّها — ومنها ما عند المدرّبين، وما فعلوه بالتعديلات (١٢ أكتوبر ٢٠٢٦).
   «طبّق ذلك على كلّ خطّةٍ أرسلتُها إلى المدرّبين» (صاحب المنصّة). الخادمُ في
   `server/tests/plan/review-bundle.test.ts` (٤)، وهنا الشاشةُ والنصّ.

   ثمّ قال صاحبُ المنصّة (٢٦ أكتوبر ٢٠٢٦): «فقط تحميل ورفع» — فذهب زرُّها من «خطط تنتظر اعتمادك»، وبقي تنزيلٌ واحد:
   المنتظِرة. ومسلكُها في الخادم باقٍ لا يدعوه شيءٌ في الشاشة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REVIEW_BUNDLE } from '@/application/trainer/review-bundle-scopes'
import { decisionsMarkdown } from '@/application/trainer/plan-review-bundle'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const page = code('src/pages/admin/PendingPlans.tsx')

describe('تنزيل واحد — المنتظرة', () => {
  it('⚠️ مسلكها في الخادم، والصفحة تنزلها وحدها', () => {
    expect(REVIEW_BUNDLE.path).toBe('/api/admin/cohort-plans/pending/review-bundle')
    expect(page).toContain('await apiDownload(REVIEW_BUNDLE.path, REVIEW_BUNDLE.fileName)')
    expect(page.match(/apiDownload\(/g), 'عاد زرّ تنزيل ثان').toHaveLength(1)
    expect(page, 'عادت حزمة المفتوحة').not.toMatch(/open\/review-bundle|downloadAll\("open"\)/)
  })

  it('⚠️ ولا يظهر إلا وفي الطابور خطط — فلا زر ينزل فراغا', () => {
    expect(page).toMatch(/\{rows !== null && rows\.length > 0 && \(\s*<Inset[\s\S]*?onClick=\{\(\) => void downloadAll\(\)\}/)
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
