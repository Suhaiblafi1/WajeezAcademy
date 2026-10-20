/* صفحةُ «منحة أعضاء وجيز» — ما تقوله وما تحفظه (٢٠ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/commerce/grant-landing.test.ts`. وهنا: الصفحةُ بطريقيها، والنموذجُ بخاناته
   الأربع ومصيدته ونصِّ موافقته وما يحثّ على تعبئته، وقائمةُ دوراتٍ واحدةٌ بلا «مسار» واقتراحاتٌ فوقها، والمنحةُ
   تُقال بالمال، والحسابُ باسمه وبريده من النموذج، ولوحُ الدفع بالكود، والعودةُ بعد التوثيق إلى ما اختاره.
   والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import { GRANT_CONSENT_AR, GRANT_PERKS_AR, WORK_FIELDS, campaignParams, campaignTag, grantSavingAr, toggleCourse } from '@/application/commerce/grant-landing'
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
    expect(PAGE).toMatch(/grantSavingAr\(money\(payTotal\), money\(listTotal - payTotal\)\)/)
    expect(PAGE).toMatch(/prefill=\{\{ name: stored\.name, email: stored\.email \}\}/)
    expect(PAGE).toMatch(/initialCoupon=\{stored\.code \?\? ""\}/)
    expect(PAGE, 'يحفظ ما اختاره قبل أن يطلب منه حساب').toMatch(/savePendingCheckout\(\{\s*path: PICK_PATH,/)
    expect(PAGE).toMatch(/<ResumeCheckout ready=/)
  })

  it('⚠️ قائمة دورات واحدة بلا كلمة «مسار» — كل ما يشترى اليوم، فالجديد يظهر وحده', () => {
    expect(PAGE).toMatch(/\{view\.openCourses\.map\(\(x\) => \{/)
    expect(PAGE).toMatch(/onChange=\{\(\) => toggle\(x\.courseId\)\}/)
    expect(PAGE, 'يوم الشعبة بمنطقة الأكاديمية').toMatch(/cohortDayAr\(x\.startsAt\)/)
    /* ولا «مسار» في نصٍّ يراه — التعليقاتُ منزوعة */
    expect(PAGE.match(/مسار/g) ?? [], 'عادت كلمة مسار إلى الصفحة').toEqual([])
  })

  it('⚠️ الاقتراحات تختار دوراتها بضغطة — ثم يعدل كما يشاء', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setPicked\(p\.courses\.map\(\(x\) => x\.courseId\)\.slice\(0, max\)\)\}>اختر هذه الدورات<\/Button>/)
  })

  it('⚠️ دورة واحدة أو أكثر حتى الحد — والزائدة ترد بلا أن تمحو ما اختاره', () => {
    expect(toggleCourse([], 'a', 4)).toEqual(['a'])
    expect(toggleCourse(['a', 'b'], 'a', 4)).toEqual(['b'])
    expect(toggleCourse(['a', 'b', 'c', 'd'], 'e', 4), 'تجاوز الحد').toEqual(['a', 'b', 'c', 'd'])
    expect(toggleCourse(['a', 'b', 'c', 'd'], 'd', 4)).toEqual(['a', 'b', 'c'])
  })

  it('⚠️ والنموذج يحث على التعبئة — بما هو قائم: عدد المنح الباقي من الخادم', () => {
    expect(PAGE).toMatch(/c\.left !== null \? `: بقي \$\{c\.left\} منحة` : ""/)
    expect(PAGE).toMatch(/>\{c\.open \? "احجز منحتي الآن" : "أرسل"\}<\/Button>/)
    expect(PAGE).toMatch(/\{GRANT_PERKS_AR\.map\(/)
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
    const texts = [GRANT_CONSENT_AR, ...WORK_FIELDS, ...GRANT_PERKS_AR, 'احجز منحتي الآن', 'رقم واتساب', 'مجال عملك', 'كود منحتك', 'اختر دوراتك',
      'اقتراحات لك', 'اختر هذه الدورات', 'كل الدورات المتاحة', 'دقيقة واحدة وتأخذ كود منحتك فورا', 'لست متأكدا؟ تواصل مع مستشار', 'اطلب مستشارا', 'ادفع الآن']
    for (const t of texts) expect(t).toBe(plainAr(t))
    for (const t of texts.slice(1 + WORK_FIELDS.length + GRANT_PERKS_AR.length)) expect(PAGE).toContain(t)
    expect(auditActionAr('coupon.grant_apply')).not.toBe('coupon.grant_apply')
  })
})
