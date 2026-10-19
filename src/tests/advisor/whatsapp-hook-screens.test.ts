/* بابُ منصّة محادثات واتساب — ما يُطابَق به الرقم وما تقوله الشاشات (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/whatsapp-hook.test.ts`. وهنا: ذيلُ الرقم يساوي بين صيغه، والبابُ
   يسأل عن الرمز قبل أن يقرأ الجسم، والرمزُ يولَّد في المتصفّح ولا يُعاد من الخادم إلّا مقنَّعا، وشاشةُ
   التكاملات تقول الصيغةَ والعنوان، وسجلُّ تواصل المستشار يقول ما جاء من المنصّة. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { phoneTail } from '@/application/advisor/phone-tail'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const ROUTE = code('server/http/routes/whatsapp-hook.routes.ts')
const APP = code('server/http/app.ts')
const INTEGRATIONS = code('server/services/integrations.service.ts')
const SCREEN = code('src/pages/admin/Integrations.tsx')
const CASES = code('src/pages/advisor/Cases.tsx')

describe('ذيلُ الرقم', () => {
  it('⚠️ يساوي بين ما يرسله واتساب وما كتبه الإنسان', () => {
    const tail = phoneTail('962791234567')
    expect(tail).toBe('791234567')
    for (const v of ['0791234567', '+962 79-123-4567', '00962 (79) 123 4567', '٠٧٩١٢٣٤٥٦٧']) {
      expect(phoneTail(v), `«${v}» لا يطابق`).toBe(tail)
    }
  })

  it('وما ليس رقما لا ذيلَ له', () => {
    for (const v of ['', 'abc', '12345', null, undefined]) expect(phoneTail(v)).toBeNull()
  })
})

describe('البابُ ورمزُه', () => {
  it('⚠️ يسأل عن الرمز قبل أن يقرأ الجسم — ومسجَّلٌ في التطبيق', () => {
    const guard = ROUTE.indexOf('if (!cfg.enabled || !hookTokenMatches(tokenFromHeaders(req.headers), cfg.token))')
    expect(guard, 'لا حارسَ رمزٍ على الباب').toBeGreaterThan(-1)
    expect(guard, 'يُقرأ الجسمُ قبل الرمز').toBeLessThan(ROUTE.indexOf('.parse(req.body)'))
    expect(APP).toMatch(/registerWhatsAppHookRoutes\(app, prisma\)/)
  })

  it('⚠️ والرمزُ لا يغادر الخادمَ إلّا مقنَّعا — ويولَّد في المتصفّح', () => {
    expect(INTEGRATIONS).toMatch(/token: mask\(cfg\.token\), hasToken: !!cfg\.token,/)
    expect(SCREEN).toMatch(/crypto\.getRandomValues\(new Uint8Array\(32\)\)/)
    expect(SCREEN).toMatch(/apiPut\("\/api\/admin\/integrations\/whatsapp-hook", hookForm\)/)
    expect(ROUTE, 'حفظُ الرمز بلا صلاحيّة الإعدادات').toMatch(
      /app\.put\('\/api\/admin\/integrations\/whatsapp-hook', \{\s*preHandler: requirePermission\('settings\.manage'\)/)
  })
})

describe('الشاشات', () => {
  it('⚠️ التكاملاتُ تقول العنوانَ والصيغة', () => {
    expect(SCREEN).toMatch(/readOnly value=\{view\.whatsappHook\.url\}/)
    for (const k of ['"studentPhone"', '"advisorEmail"', 'Authorization: Bearer']) expect(SCREEN).toContain(k)
  })

  it('⚠️ وسجلُّ التواصل يقول ما جاء من المنصّة', () => {
    expect(CASES).toMatch(/c\.source === "whatsapp_hook" \? " · من منصة واتساب" : ""/)
  })

  it('ونصوصُها بلا تشكيلٍ إعرابيّ', () => {
    for (const t of [
      'ربط منصة محادثات واتساب', 'عنوان الاستقبال — يضبط في المنصة', 'رمز الربط — يخزن ولا يعرض', 'أنشئ رمزا',
      'انسخ الرمز الآن وضعه في المنصة — لا يعرض بعد الحفظ.', 'حفظ ربط المنصة', 'لم يصل أي طلب بعد.',
      'رقم الطالب كما يصل من واتساب. وبريد المستشار هو بريد حسابه هنا.',
      'يسجل التواصل لمستشار الحالة فقط، ومرة كل ست ساعات للحالة.',
    ]) {
      expect(SCREEN).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})
