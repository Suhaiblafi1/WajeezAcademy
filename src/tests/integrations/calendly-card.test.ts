/* بطاقةُ Calendly في شاشة التكاملات — البابُ الذي يغني عن SSH.

   ═══ العطبُ الذي كُتبت له ═══

   Calendly وحدَه من تكاملات المنصّة كان يُضبط بمتغيّرِ بيئة: مفتاحُ التوقيع في
   `deploy/.env.production`، والاشتراكُ بسطر أوامرَ على الخادم. وZoom والدفعُ
   والبريدُ كلُّها تُضبط من `/admin/integrations` — فسأل صاحبُ المنصّة: «لماذا
   هذا التعقيد؟ أريدها في الشاشة» (١٢ سبتمبر ٢٠٢٦).

   والحارسُ على **البنية** لا على ورودِ كلمة: أنّ البطاقةَ تنادي مسارَي الحفظ
   والتسجيل القائمَين، وأنّ التسجيلَ معاينةٌ ثمّ تطبيقٌ كسائر ما يمسّ الخارج،
   وأنّ الرمزَ الشخصيَّ لا يُحفظ عندنا. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('بطاقةُ Calendly في شاشة التكاملات', () => {
  const screen = code('src/pages/admin/Integrations.tsx')
  const routes = code('server/http/routes/integrations.routes.ts')
  const service = code('server/services/integrations.service.ts')

  it('تنادي مسارَي الحفظ والتسجيل، وهما مسجَّلان في الخادم', () => {
    expect(screen, 'لا تنادي حفظَ الإعداد').toContain('/api/admin/integrations/calendly"')
    expect(screen, 'لا تنادي التسجيل').toContain('/api/admin/integrations/calendly/register')
    expect(routes).toContain("app.put('/api/admin/integrations/calendly'")
    expect(routes).toContain("app.post('/api/admin/integrations/calendly/register'")
  })

  it('والتسجيلُ معاينةٌ ثمّ تطبيقٌ بطلبٍ صريح — لا يُسجَّل مستقبِلٌ حيٌّ بالخطأ', () => {
    expect(screen, 'لا زرَّ معاينة').toContain('probeCalendly(false)')
    expect(screen, 'لا زرَّ تسجيل').toContain('probeCalendly(true)')
    /* الخادمُ يحرس الافتراضَ كذلك: `apply` غيرُ الممرَّرة معاينة */
    expect(routes).toMatch(/apply: z\.boolean\(\)\.optional\(\)\.default\(false\)/)
  })

  it('والرمزُ الشخصيُّ يُحفظ الآن مع المفتاح — والتسجيلُ يقرأ المحفوظ', () => {
    /* ═══ نقضُ حارسٍ كُتب في اليوم نفسِه ═══

       كان هنا حارسٌ يمنع تخزينَ الرمز: كان يلزم للحظةِ تسجيلِ الاشتراك
       وحدَها، فلا يُترك مفتاحُ حسابِ Calendly كلِّه في قاعدةٍ بلا حاجة.

       ثمّ تبيّن أنّ الاشتراكَ خلفَ خطّةٍ مدفوعةٍ لا يملكها الحساب (١٢ سبتمبر
       ٢٠٢٦)، فصارت المزامنةُ سؤالا دوريّا يسأله العاملُ كلَّ خمس دقائق بلا
       إنسانٍ يلصق الرمز. فنُقض الحارسُ عمدا، ولم يُحذف صامتا.

       والتقنيعُ والمطابقةُ محروسان بالأثر لا بالنصّ، في
       `server/tests/trainer/calendly-polling.test.ts`. */
    expect(screen, 'لا حقلَ للرمز في نموذج الحفظ').toContain('calForm.token')
    /* ولا يُرسَل ما في الحقل إلى نداء التسجيل: هو مقنَّعٌ بعد أوّل حفظ،
       والخادمُ يقرأ المحفوظ. */
    expect(screen, 'الشاشةُ ترسل الرمزَ المقنَّعَ للتسجيل').not.toMatch(/register",\s*\{\s*token:/)
    expect(routes, 'التسجيلُ لا يقرأ الرمزَ المحفوظ').toMatch(/body\.token \?\? config\.token/)
  })

  it('والمستقبِلُ يقرأ المفتاحَ من الإعداد لا من البيئة وحدَها', () => {
    const hook = code('server/http/routes/calendly-webhook.routes.ts')
    expect(hook, 'ما زال يقرأ البيئةَ مباشرة').not.toContain('process.env.CALENDLY_WEBHOOK_SIGNING_KEY')
    expect(hook).toContain('getCalendlyConfig(prisma)')
    /* والغشاءُ في الخدمة: البيئةُ تغلب المحفوظَ حين تُضبط */
    expect(service).toMatch(/env\.CALENDLY_WEBHOOK_SIGNING_KEY/)
  })
})
