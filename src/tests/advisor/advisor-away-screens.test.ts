/* إجازةُ المستشار — ما تقوله الشاشاتُ ومن يملك الباب (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/advisor-away.test.ts`. وهنا: يكتبها المستشارُ في «حالاتي» ومن يوزّع
   في أدوات الحالات، وكلٌّ بتأكيدٍ يقول ما سيقع؛ واليومان كاملان؛ ومن في إجازته يُقال في قوائم الإسناد؛
   والغطاءُ قبل التذكير — والنصوصُ بلا تشكيل. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import { advisorOptionAr, awayLastDay, awayRange } from '@/application/advisor/away'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PANEL = code('src/pages/advisor/AwayPanel.tsx')
const CASES = code('src/pages/advisor/Cases.tsx')
const TOOLS = code('src/components/admin/AdvisorCaseTools.tsx')
const EXCEPTIONS = code('src/pages/admin/Exceptions.tsx')
const ROUTES = code('server/http/routes/advisor.routes.ts')
const JOBS = code('server/worker/jobs.ts')

describe('اليومان كاملان', () => {
  it('⚠️ من أوّل يوم البداية إلى آخر يوم النهاية — ويُقال آخرُ يومٍ لا الذي بعده', () => {
    const r = awayRange('2026-11-01', '2026-11-05')
    expect(new Date(r.from).getDate()).toBe(1)
    expect(new Date(r.until).getTime() - new Date(r.from).getTime(), 'لا تشمل النهايةُ آخرَ يومها').toBeGreaterThanOrEqual(5 * 86_400_000 - 3_600_000)
    expect(awayLastDay(r.until).getDate()).toBe(5)
  })
})

describe('المستشارُ يكتبها في «حالاتي»', () => {
  it('⚠️ في رأس قائمته — وبتأكيدٍ قبل الحفظ', () => {
    expect(CASES).toMatch(/<AwayPanel \/>/)
    expect(PANEL).toMatch(/apiPut<\{ moved: number \}>\("\/api\/advisor\/away", awayRange\(from, until\)\)/)
    expect(PANEL).toMatch(/onClick=\{\(\) => setConfirm\(true\)\}>احفظ<\/Button>/)
    expect(PANEL).toMatch(/\{confirm && \(\s*<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void save\(\)\}/)
    for (const verb of ['get', 'put', 'delete']) {
      expect(ROUTES).toMatch(new RegExp(`app\\.${verb}\\('/api/advisor/away', \\{\\s*preHandler: requirePermission\\('advisor\\.cases\\.view'\\)`))
    }
  })
})

describe('ومن يوزّع يكتبها في أدوات الحالات', () => {
  it('⚠️ بصلاحيّة الإسناد — وبتأكيد', () => {
    for (const verb of ['put', 'delete']) {
      expect(ROUTES).toMatch(new RegExp(`app\\.${verb}\\('/api/admin/advisors/:id/away', \\{\\s*preHandler: requirePermission\\('advisor\\.assign'\\)`))
    }
    expect(TOOLS).toMatch(/onClick=\{\(\) => setConfirmAway\(true\)\}/)
    expect(TOOLS).toMatch(/\{confirmAway && awayAdvisor && \(\s*<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void saveAway\(\)\}/)
  })

  it('⚠️ ومن في إجازته يُقال في كلّ قائمة إسناد', () => {
    expect(advisorOptionAr({ displayName: 'سارة', email: 's@x', awayUntil: new Date(2026, 10, 6).toISOString() })).toContain('في إجازة حتى')
    expect(advisorOptionAr({ displayName: 'سارة', email: 's@x', awayUntil: null })).not.toContain('إجازة')
    expect(TOOLS).not.toMatch(/\{a\.displayName\} \(\{a\.email\}\)<\/option>/)
    expect(EXCEPTIONS).not.toMatch(/\{a\.displayName\} \(\{a\.email\}\)<\/option>/)
    expect((EXCEPTIONS.match(/\{advisorOptionAr\(a\)\}/g) ?? []).length).toBe(3)
  })
})

describe('والعامل', () => {
  it('⚠️ يغطّي قبل أن يذكّر — فلا يُذكَّر الغائبُ بمن نُقل عنه', () => {
    const body = JOBS.slice(JOBS.indexOf('export async function runAdvisorReminders'))
    expect(body.indexOf('.coverAway(now)')).toBeGreaterThan(0)
    expect(body.indexOf('.coverAway(now)'), 'التذكيرُ قبل الغطاء').toBeLessThan(body.indexOf('.remindDue(now)'))
  })
})

describe('النصوص', () => {
  it('بلا تشكيلٍ إعرابيّ', () => {
    for (const t of [
      'لا إجازة مسجلة', 'سجل إجازة', 'غير الإجازة', 'ألغ الإجازة',
      'لن تسند إليك حالات جديدة في إجازتك. ومن ينتظر أول تواصل منك ينقل لمستشار آخر حين تبدأ، ولا يعود إليك بعدها.',
    ]) {
      expect(PANEL).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const t of ['إجازة مستشار', 'في إجازته لا تسند إليه حالات جديدة، ومن ينتظر أول تواصل منه ينقل لغيره. ومن تواصل معه يبقى عنده.']) {
      expect(TOOLS).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const k of ['advisor.away.set', 'advisor.away.clear', 'advisor.case.away_cover']) {
      expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
    }
  })
})
