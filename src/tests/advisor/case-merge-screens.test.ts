/* دمجُ حالتين لطالبٍ واحد — ما تقوله الشاشةُ والجرس (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/case-merge.test.ts`. وهنا: الدمجُ من نتائج البحث في «حالات بلا
   مستشار»، باختيار الحالتين ومن يبقى مستشارَه، وبتأكيدٍ يقول ما سيقع — وبابُه بصلاحيّة الإسناد،
   وجرسُه عملٌ لا يُكتَم يفتح الشاشة نفسَها. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { categoryForTemplate, isSilenceable } from '@/application/notifications/categories'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const TOOLS = code('src/components/admin/AdvisorCaseTools.tsx')
const ROUTES = code('server/http/routes/advisor.routes.ts')
const SERVICE = code('server/services/advisor.service.ts')
const DESTINATIONS = code('src/application/notifications/destinations.ts')

describe('دمجُ حالتين من نتائج البحث', () => {
  it('⚠️ تُختار الحالتان ومن يبقى مستشارَه — ويُنادى بابُه', () => {
    expect(TOOLS).toMatch(/onChange=\{\(\) => toggleMerge\(c\.id\)\}/)
    expect(TOOLS).toMatch(/\{merging\.length === 2 && \(/)
    expect(TOOLS).toMatch(/apiPost\("\/api\/admin\/advisor-cases\/merge", \{ caseIds: merging, advisorId: mergeAdvisor\.id \}\)/)
    expect(ROUTES).toMatch(/app\.post\('\/api\/admin\/advisor-cases\/merge', \{\s*preHandler: requirePermission\('advisor\.assign'\)/)
  })

  it('⚠️ ولا يُدمج بضغطةٍ واحدة — التأكيدُ يقول ما سيقع', () => {
    expect(TOOLS).toMatch(/onClick=\{\(\) => setConfirmMerge\(true\)\}/)
    expect(TOOLS).toMatch(/<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void merge\(\)\}/)
  })

  it('ونصوصُها بلا تشكيلٍ إعرابيّ', () => {
    for (const t of [
      'اختر للدمج', 'ادمج حالتين لطالب واحد', 'تصير الحالتان حالة واحدة عند المستشار الذي تختاره، وتغلق الأخرى.',
      'من يبقى مستشاره…', 'ولكل مستشار عمولة ما دفع الطالب وهو عنده.',
    ]) {
      expect(TOOLS).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const t of ['لهذا البريد حالة أخرى للطالب — أبلغنا الإدارة لتدمجهما', 'حالتان لطالب واحد']) {
      expect(SERVICE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})

describe('جرسُ «حالتان لطالبٍ واحد»', () => {
  it('⚠️ عملٌ لا يُكتَم — ويفتح الشاشةَ التي يُدمج منها', () => {
    expect(categoryForTemplate('advisor.case.duplicate')?.key).toBe('work')
    expect(isSilenceable('advisor.case.duplicate')).toBe(false)
    expect(DESTINATIONS).toMatch(/'advisor\.case\.duplicate': \{ path: '\/admin\/exceptions'/)
  })
})
