/* من لا ملفَّ له يُقال في قوائم الإسناد ولا يُختار (٢٤ أكتوبر ٢٠٢٦).

   الخادمُ يردّ إسنادَ حالةٍ لمستشارٍ بلا ملفّ (`assign` و`mergeCases` في `advisor.service.ts`)، والحسابُ في
   `server/tests/advisors/advisor-assign-profile.test.ts`. وهنا: كلُّ قائمة إسنادٍ تقول لماذا لا يُختار وتمنع اختيارَه،
   فلا يختار الإداريُّ اسما ثمّ يلقى رسالةَ ردّ. وشاشةُ المستشارين تقول لماذا لا تصله حالات. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { advisorOptionAr, canTakeCases } from '@/application/advisor/away'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const TOOLS = code('src/components/admin/AdvisorCaseTools.tsx')
const EXCEPTIONS = code('src/pages/admin/Exceptions.tsx')
const ADVISORS = code('src/pages/admin/Advisors.tsx')

const AWAY = new Date(2026, 10, 6).toISOString()

describe('اسمه في القائمة يقول لماذا', () => {
  it('⚠️ بلا ملف يقال — ويسبق الإجازة', () => {
    expect(advisorOptionAr({ displayName: 'سارة', email: 's@x', hasProfile: false })).toContain('بلا ملف مستشار')
    expect(advisorOptionAr({ displayName: 'سارة', email: 's@x', hasProfile: false, awayUntil: AWAY })).not.toContain('إجازة')
    expect(advisorOptionAr({ displayName: 'سارة', email: 's@x', hasProfile: true })).not.toContain('ملف')
  })

  it('وغياب الخبر لا يمنع — الخادم يقرر', () => {
    expect(canTakeCases({})).toBe(true)
    expect(canTakeCases({ hasProfile: true })).toBe(true)
    expect(canTakeCases({ hasProfile: false })).toBe(false)
  })
})

describe('ولا يختار في أي قائمة إسناد', () => {
  it('⚠️ كل خيار مستشار ممنوع لمن لا ملف له', () => {
    for (const [name, src] of [['أدوات الحالات', TOOLS], ['حالات بلا مستشار', EXCEPTIONS]] as const) {
      const options = src.match(/<option key=\{a\.id\} value=\{a\.id\}[^>]*>/g) ?? []
      expect(options.length, name).toBeGreaterThan(0)
      for (const o of options) expect(o, `${name}: خيار يختار من لا ملف له`).toContain('disabled={!canTakeCases(a)}')
    }
  })

  it('⚠️ ومن لم يبق غيره فلا أحد جاهز — ويقال أين يصلح', () => {
    expect(EXCEPTIONS).toMatch(/const ready = advisors\.filter\(canTakeCases\)/)
    expect(EXCEPTIONS).toMatch(/disabledReasonAr=\{ready\.length === 0\s*\? "[^"]*«المستشارون والعمولة»/)
    expect(EXCEPTIONS).not.toMatch(/advisors\.length === 0/)
  })
})

describe('وشاشة المستشارين تقول لماذا لا تصله حالات', () => {
  it('⚠️ بلا عمولة محفوظة', () => {
    expect(ADVISORS).toMatch(/r\.status === "active" && r\.commissionPct === null && <span>لا تصله حالات حتى تحفظ عمولته<\/span>/)
  })
})
