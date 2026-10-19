/* بياناتُ من لم يسجّل تُمحى بعد ستة أشهر بلا نشاط (١٩ أكتوبر ٢٠٢٦) — ما يقوله النصُّ وأين يجري.

   الحسابُ في `server/tests/advisors/guest-erasure.test.ts`. وهنا: الأجلُ ستة أشهر كما قرّر صاحبُ
   المنصّة، والعاملُ يجريه كلَّ يوم، وسياسةُ الخصوصيّة تقوله لمن ترك رقمَه — ونصوصُه بلا تشكيل.
   والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import { staticPageBySlug } from '@/data/siteContent'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const SERVICE = code('server/services/guest-erasure.service.ts')
const JOBS = code('server/worker/jobs.ts')

describe('محوُ بيانات من لم يسجّل', () => {
  it('⚠️ بعد ستة أشهر — وكلَّ يوم', () => {
    expect(SERVICE).toMatch(/export const GUEST_IDLE_DAYS = 183\n/)
    expect(JOBS).toMatch(/\{ key: 'erase_idle_guests', everyMs: 24 \* HOUR, run: runEraseIdleGuests,/)
  })

  it('⚠️ وسياسةُ الخصوصيّة تقوله لمن ترك رقمَه', () => {
    const privacy = staticPageBySlug('privacy')
    const lines = privacy?.sections.flatMap((s) => [...(s.bullets ?? []), ...(s.paragraphs ?? [])]) ?? []
    expect(lines).toContain('إن تركت رقمك أو بريدك ولم تنشئ حسابا، نحذف اسمك ورقمك وبريدك ونتيجتك بعد ستة أشهر بلا تواصل.')
    expect(lines.some((l) => l.includes('ولا تغادر جهازك')), 'بقي «لا تغادر جهازك» وهي تصلنا مع طلب المستشار').toBe(false)
  })

  it('ونصوصُه بلا تشكيلٍ إعرابيّ', () => {
    const texts = [
      'بيانات محذوفة', 'حذف بعد ستة أشهر بلا نشاط', 'محو بيانات من لم يسجل بعد ستة أشهر بلا نشاط',
      'لا أحد لم يسجل مرت عليه ستة أشهر بلا نشاط',
    ]
    for (const t of texts) {
      expect(SERVICE + JOBS).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    for (const k of ['advisor.case.guest_erased', 'worker.erase_idle_guests']) {
      expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
      expect(auditActionAr(k)).toBe(plainAr(auditActionAr(k)))
    }
  })
})
