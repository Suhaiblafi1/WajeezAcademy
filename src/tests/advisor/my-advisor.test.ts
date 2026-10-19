/* الطالبُ يعرف مستشارَه — ما تقوله اللوحةُ والرسالة (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/my-advisor.test.ts`. وهنا: رسالةُ واتساب تحمل اسمَ المستشار في
   سطرها الأخير، وكلُّ زرّ مراسلةٍ يمرّ بها، ولا يُسأل الخادمُ لمن لا جلسةَ له ولا مع كلّ زرّ، وبطاقةُ
   «مستشارك» في كلّ وجوه اللوحة ولا تُعرض بلا اسم. والتعليقاتُ تُنزع. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { withAdvisorName } from '@/application/advisor/advisor-message'

const session = vi.hoisted(() => ({ current: null as null | { email: string } }))
const api = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/services/auth', () => ({ readSession: () => session.current }))
vi.mock('@/services/api', () => ({ apiGet: api.apiGet }))

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const CONTACT = code('src/components/AdvisorContact.tsx')
const CARD = code('src/components/MyAdvisorCard.tsx')
const DASH = code('src/pages/student/Dashboard.tsx')
const ROUTES = code('server/http/routes/operations.routes.ts')

describe('رسالةُ واتساب تحمل اسمَ المستشار', () => {
  it('⚠️ في سطرٍ أخيرٍ بصيغةٍ ثابتة — وبلا مستشارٍ تبقى كما هي', () => {
    expect(withAdvisorName('مرحبا', 'سارة')).toBe('مرحبا\n(مستشاري: سارة)')
    expect(withAdvisorName('مرحبا', null)).toBe('مرحبا')
    expect(withAdvisorName('مرحبا', '  ')).toBe('مرحبا')
  })

  it('⚠️ وكلُّ زرّ مراسلةٍ يمرّ بها — واتساب والبريدُ معا', () => {
    expect(CONTACT).toMatch(/const message = withAdvisorName\(text, useMyAdvisorName\(\)\)/)
    expect(CONTACT).toMatch(/waHref\(numbers, 'advisor', CONTACT\.whatsapp, message\)/)
    expect(CONTACT).toMatch(/&body=\$\{encodeURIComponent\(message\)\}/)
    expect(CONTACT, 'بقي النصُّ بلا اسم في موضع').not.toMatch(/encodeURIComponent\(text\)|, text\)/)
  })
})

describe('السؤالُ عن المستشار', () => {
  beforeEach(() => { vi.resetModules(); api.apiGet.mockReset() })

  it('⚠️ لا يُسأل الخادمُ لمن لا جلسةَ له', async () => {
    session.current = null
    const { fetchMyAdvisorName } = await import('@/services/my-advisor')
    expect(await fetchMyAdvisorName()).toBeNull()
    expect(api.apiGet).not.toHaveBeenCalled()
  })

  it('⚠️ ويُسأل مرّةً للجلسة لا مع كلّ زرّ — وجلسةٌ أخرى تُسأل من جديد', async () => {
    session.current = { email: 'a@test.local' }
    api.apiGet.mockResolvedValue({ advisor: { displayName: 'سارة' } })
    const { fetchMyAdvisorName } = await import('@/services/my-advisor')
    expect(await fetchMyAdvisorName()).toBe('سارة')
    expect(await fetchMyAdvisorName()).toBe('سارة')
    expect(api.apiGet).toHaveBeenCalledTimes(1)
    expect(api.apiGet).toHaveBeenCalledWith('/api/learner/advisor')
    session.current = { email: 'b@test.local' }
    await fetchMyAdvisorName()
    expect(api.apiGet, 'قُرئ مستشارُ حسابٍ سابق').toHaveBeenCalledTimes(2)
  })

  it('والفشلُ يُقرأ «لا مستشار»', async () => {
    session.current = { email: 'c@test.local' }
    api.apiGet.mockRejectedValue(new Error('offline'))
    const { fetchMyAdvisorName } = await import('@/services/my-advisor')
    expect(await fetchMyAdvisorName()).toBeNull()
  })

  it('والبابُ لمن دخل — باسمه وحدَه', () => {
    expect(ROUTES).toMatch(/app\.get\('\/api\/learner\/advisor', \{\s*preHandler: requireAuth,/)
    expect(ROUTES).toMatch(/advisor: await advisors\.myAdvisorOf\(req\.auth!\.userId\)/)
  })
})

describe('بطاقةُ «مستشارك»', () => {
  it('⚠️ في كلّ وجوه اللوحة — بتسجيلاتٍ وبلا تسجيل', () => {
    expect(DASH.match(/<MyAdvisorCard className="mt-6" \/>/g)?.length, 'وجهٌ من اللوحة بلا بطاقة').toBe(5)
  })

  it('⚠️ ولا تُعرض بلا اسم', () => {
    expect(CARD).toMatch(/const name = useMyAdvisorName\(\);\s*if \(!name\) return null;/)
  })

  it('ونصوصُها بلا تشكيلٍ إعرابيّ', () => {
    for (const t of ['مستشارك: ', 'يساعدك في اختيار دوراتك ومتابعة تقدمك.', 'راسل مستشارك', 'مرحبا، أريد التحدث مع مستشاري.']) {
      expect(CARD).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    expect(withAdvisorName('', 'س')).toBe(plainAr(withAdvisorName('', 'س')))
  })
})
