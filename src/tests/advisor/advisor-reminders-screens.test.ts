/* حالةٌ لم يسجّل مستشارُها تواصلا — ما تقوله الشاشات والأجراس (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/advisor-reminders.test.ts`. وهنا: قسمُ «بلا تواصل منذ يومين» في
   «حالات بلا مستشار» ينادي بابَه ويغيّر المستشارَ بالباب القائم، ولا تُعاد حالتُه في «أسندت تلقائيا»،
   و«يومين» في نصّه هي الرقمُ الذي يحسب به الخادم، والوظيفةُ في جدول العامل. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { ESCALATE_AFTER_HOURS, REMIND_AFTER_HOURS } from '@/application/advisor/contact-sla'
import { categoryForTemplate, isSilenceable } from '@/application/notifications/categories'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const QUEUE = code('src/pages/admin/Exceptions.tsx')
const ROUTES = code('server/http/routes/advisor.routes.ts')
const SERVICE = code('server/services/advisor.service.ts')
const JOBS = code('server/worker/jobs.ts')

describe('قسمُ «بلا تواصل منذ يومين»', () => {
  it('⚠️ ينادي بابَه — ويغيّر المستشارَ بالباب القائم', () => {
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/advisor-cases\/uncontacted', \{\s*preHandler: requirePermission\('advisor\.assign'\)/)
    expect(QUEUE).toMatch(/apiGet<AutoAssignedCase\[\]>\("\/api\/admin\/advisor-cases\/uncontacted"\)/)
    expect(QUEUE).toMatch(/quietRows\.map\([\s\S]*?onClick=\{\(\) => void assign\(c\.id\)\}/)
  })

  it('⚠️ وحالتُه لا تُعاد في «أسندت تلقائيا»', () => {
    expect(QUEUE).toMatch(/advisor-cases\/auto-assigned"\)\)\.filter\(\(c\) => !quietIds\.has\(c\.id\)\)/)
  })

  it('⚠️ و«يومين» في نصّه رقمُ الخادم نفسُه', () => {
    expect(ESCALATE_AFTER_HOURS).toBe(48)
    expect(REMIND_AFTER_HOURS).toBe(24)
    expect(QUEUE).toContain('بلا تواصل منذ يومين')
    expect(SERVICE).toMatch(/ESCALATE_AFTER_HOURS \* HOUR_MS/)
  })

  it('ونصوصُها بلا تشكيلٍ إعرابيّ', () => {
    for (const t of [
      'بلا تواصل منذ يومين', 'لم يسجل مستشارها تواصلا منذ أسندت إليه. غيّر المستشار أو تابع معه.',
    ]) {
      expect(QUEUE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})

describe('الأجراسُ والعامل', () => {
  it('⚠️ أجراسُها عملٌ لا يُكتَم — والوظيفةُ في جدول العامل', () => {
    for (const k of ['advisor.case.no_contact', 'advisor.case.uncontacted', 'advisor.followup.due']) {
      expect(categoryForTemplate(k)?.key, `«${k}» بلا صنف`).toBe('work')
      expect(isSilenceable(k), `«${k}» يكتم — والعميل ينتظر`).toBe(false)
    }
    expect(JOBS).toMatch(/\{ key: 'advisor_reminders', everyMs: 15 \* 60_000, run: runAdvisorReminders,/)
  })

  it('ونصوصُ الأجراس قصيرةٌ بلا تشكيل', () => {
    for (const t of [
      'حالة تنتظر تواصلك', 'قبل يوم ولم تسجل تواصلا بعد. تواصل معه وسجل ذلك في الحالة.',
      'حالة بلا تواصل منذ يومين', 'لم يسجل مستشاروها تواصلا منذ أسندت إليهم. غيّر المستشار أو تابع معهم.',
      'حان موعد متابعة', 'افتح الحالة وسجل ما تم.',
    ]) {
      expect(SERVICE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})
