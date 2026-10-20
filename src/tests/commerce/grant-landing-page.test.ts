/* صفحةُ «منحة أعضاء وجيز» — ما تقوله وما تحفظه (٢٠ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/commerce/grant-landing.test.ts`. وهنا: الصفحةُ بطريقيها، والنموذجُ بخاناته
   الأربع ومصيدته ونصِّ موافقته، والمنحةُ تُقال بالمال، والحسابُ يُنشأ حين يختار المسار باسمه وبريده
   من النموذج، ولوحُ الدفع يُفتح بالكود، والعودةُ بعد التوثيق إلى المسار نفسِه. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import { GRANT_CONSENT_AR, WORK_FIELDS, campaignParams, campaignTag, grantSavingAr } from '@/application/commerce/grant-landing'
import { parsePendingCheckout } from '@/application/commerce/pending-checkout'
import { parseStoredGrant } from '@/services/grant-landing'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
const APP = code('src/App.tsx')
const ROUTES = code('server/http/routes/public-grant.routes.ts')
const HTTP = code('server/http/app.ts')

describe('الطريق والأبواب', () => {
  it('⚠️ /grant و/grant/:pathwayId — والأبواب العامة بسقف ومصيدة', () => {
    expect(APP).toMatch(/<Route path="\/grant" element=\{<MemberGrantPage \/>\} \/>/)
    expect(APP).toMatch(/<Route path="\/grant\/:pathwayId" element=\{<MemberGrantPage \/>\} \/>/)
    expect(HTTP).toMatch(/registerPublicGrantRoutes\(app, prisma\)/)
    expect(ROUTES).toMatch(/app\.post\('\/api\/public\/grant', \{\s*config: \{ rateLimit: \{ max: 5, timeWindow: '15 minutes' \} \}/)
    expect(ROUTES).toMatch(/app\.post\('\/api\/public\/grant\/advisor', \{\s*config: \{ rateLimit: \{ max: 3, timeWindow: '15 minutes' \} \}/)
    expect((ROUTES.match(/assertNotBot\(req\.body\)/g) ?? []).length, 'باب بلا مصيدة').toBe(2)
  })
})

describe('النموذج', () => {
  it('⚠️ أربع خانات ومصيدة ونص الموافقة — والقناة والدفعة من الرابط', () => {
    for (const f of ['fullName', 'phone', 'email', 'workField']) expect(PAGE).toMatch(new RegExp(`value=\\{form\\.${f}\\}`))
    expect(PAGE).toMatch(/\{GRANT_CONSENT_AR\}/)
    expect(PAGE).toMatch(/\.\.\.campaignParams\(window\.location\.search\), website: hp\.value/)
    expect(campaignParams('?ch=WhatsApp&w=2')).toEqual({ channel: 'whatsapp', wave: '2' })
    expect(campaignTag('<b>')).toBeNull()
  })
})

describe('بعد النموذج', () => {
  it('⚠️ المنحة تقال بالمال — والحساب باسمه وبريده من النموذج، ولوح الدفع بالكود', () => {
    expect(grantSavingAr('240 USD', '360 USD')).toBe('تدفع 240 USD فقط، ووجيز تتحمل 360 USD')
    expect(PAGE).toMatch(/grantSavingAr\(money\(p\.grantTotal\), money\(p\.listTotal - p\.grantTotal\)\)/)
    expect(PAGE).toMatch(/prefill=\{\{ name: stored\?\.name, email: stored\?\.email \}\}/)
    expect(PAGE).toMatch(/initialCoupon=\{stored\?\.code \?\? ""\}/)
    expect(PAGE, 'يحفظ ما اختاره قبل أن يطلب منه حساب').toMatch(/savePendingCheckout\(\{\s*path,/)
    expect(PAGE).toMatch(/<ResumeCheckout ready=/)
  })

  it('⚠️ الحذف والإضافة بدورات لها شعب — وحتى الحد', () => {
    expect(PAGE).toMatch(/\{picked\.length < max && swapOptions\.length > 0 && \(/)
    expect(PAGE).toMatch(/const swapOptions = \(view\?\.openCourses \?\? \[\]\)\.filter/)
    expect(PAGE, 'يوم الشعبة بمنطقة الأكاديمية').toMatch(/cohortDayAr\(x\.startsAt\)/)
  })

  it('⚠️ «اختر دوراتك بنفسك» من كل ما يشترى اليوم — فالجديد يظهر وحده', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => navigate\(`\/grant\/\$\{BUILD\}`\)\}>اختر دوراتك<\/Button>/)
    expect(PAGE).toMatch(/const pathway = useMemo<GrantPathway \| null>\(\(\) => \(pathwayId === BUILD/)
    expect(PAGE, 'خيار البناء مربوط بقائمة ثابتة').toMatch(/\{view\.openCourses\.length > 0 && \(/)
  })

  it('⚠️ ما يحفظ على الجهاز يفحص — والعودة إلى مسار المنحة مقبولة', () => {
    const ok = { ref: '11111111-1111-4111-8111-111111111111', code: 'WG-ABCD2345', sentTo: null, name: 'سارة', email: 's@x.co', at: Date.now() }
    expect(parseStoredGrant(JSON.stringify(ok))?.code).toBe('WG-ABCD2345')
    expect(parseStoredGrant(JSON.stringify({ ...ok, ref: 'x' }))).toBeNull()
    expect(parseStoredGrant(JSON.stringify({ ...ok, code: 'javascript:1' }))?.code).toBeNull()
    expect(parseStoredGrant(JSON.stringify({ ...ok, at: Date.now() - 61 * 86_400_000 }))).toBeNull()
    const pending = { path: '/grant/11111111-1111-4111-8111-111111111111', intent: { title: 'مسار', amount: 1, kind: 'courses', courseIds: ['C-1'] }, cohortByCourse: {}, at: Date.now() }
    expect(parsePendingCheckout(JSON.stringify(pending), Date.now())?.path).toBe(pending.path)
  })
})

describe('النصوص', () => {
  it('بلا تشكيل', () => {
    const texts = [GRANT_CONSENT_AR, ...WORK_FIELDS, 'أعطني كود المنحة', 'رقم واتساب', 'مجال عملك', 'كود منحتك', 'اختر مسارا يناسبك',
      'اختر هذا المسار', 'أو اختر دوراتك بنفسك', 'اختر دوراتك', 'لست متأكدا؟ تواصل مع مستشار', 'اطلب مستشارا', 'ادفع الآن', 'أضف دورة لها شعبة مفتوحة']
    for (const t of texts) expect(t).toBe(plainAr(t))
    for (const t of texts.slice(GRANT_CONSENT_AR ? 1 + WORK_FIELDS.length : 0)) expect(PAGE).toContain(t)
    expect(auditActionAr('coupon.grant_apply')).not.toBe('coupon.grant_apply')
  })
})
