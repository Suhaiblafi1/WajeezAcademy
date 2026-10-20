/* صفحةُ «منحة أعضاء وجيز» — ما تقوله وما تحفظه (٢٠ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/commerce/grant-landing.test.ts`. وهنا: الصفحةُ بطريقيها، والنبذةُ قبل النموذج،
   والنموذجُ بخاناته الأربع اللازمة وسؤاليه الاختياريّين ومصيدته ونصِّ موافقته وما يحثّ على تعبئته، وقائمةُ
   دوراتٍ واحدةٌ بلا «مسار» واقتراحاتٌ فوقها مرتّبةٌ بما يريد تطويرَه، والمنحةُ تُقال بالمال، والحسابُ باسمه
   وبريده من النموذج، ولوحُ الدفع بالكود، والعودةُ بعد التوثيق إلى ما اختاره. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import {
  CAREER_LEVELS, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_INTEREST_DOMAINS, WORK_FIELDS,
  campaignParams, campaignTag, grantSavingAr, grantStepsAr, leadProfileAr, rankByInterest, toggleCourse,
} from '@/application/commerce/grant-landing'
import { courseDomain } from '@/application/catalog/course-domain'
import { parsePendingCheckout } from '@/application/commerce/pending-checkout'
import { parseStoredGrant } from '@/services/grant-landing'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
const APP = code('src/App.tsx')
const ROUTES = code('server/http/routes/public-grant.routes.ts')
const HTTP = code('server/http/app.ts')

describe('الطريق والأبواب', () => {
  it('⚠️ /grant و/grant/build (العودة بعد توثيق البريد) — والأبواب العامة بسقف ومصيدة', () => {
    expect(APP).toMatch(/<Route path="\/grant" element=\{<MemberGrantPage \/>\} \/>/)
    expect(APP).toMatch(/<Route path="\/grant\/build" element=\{<MemberGrantPage \/>\} \/>/)
    expect(PAGE, 'طريق العودة غير الطريق الذي يفتح الصفحة').toMatch(/const PICK_PATH = "\/grant\/build";/)
    expect(HTTP).toMatch(/registerPublicGrantRoutes\(app, prisma\)/)
    expect(ROUTES).toMatch(/app\.post\('\/api\/public\/grant', \{\s*config: \{ rateLimit: \{ max: 5, timeWindow: '15 minutes' \} \}/)
    expect(ROUTES).toMatch(/app\.post\('\/api\/public\/grant\/advisor', \{\s*config: \{ rateLimit: \{ max: 3, timeWindow: '15 minutes' \} \}/)
    expect((ROUTES.match(/assertNotBot\(req\.body\)/g) ?? []).length, 'باب بلا مصيدة').toBe(2)
  })
})

describe('النموذج', () => {
  it('⚠️ أربع خانات لازمة وسؤالان اختياريان ومصيدة ونص الموافقة — والقناة والدفعة من الرابط', () => {
    for (const f of ['fullName', 'phone', 'email', 'workField', 'careerLevel']) expect(PAGE).toMatch(new RegExp(`value=\\{form\\.${f}\\}`))
    /* اللازمُ أربعٌ لا ستّ: الجديدُ اختياريّ — قرارُ صاحب المنصّة */
    const ready = PAGE.match(/const ready = ([^;]+);/)![1]
    expect(ready).toMatch(/form\.workField !== ""/)
    expect(ready, 'صار المستوى لازما').not.toMatch(/careerLevel/)
    expect(ready, 'صار ما يريد تطويره لازما').not.toMatch(/interests/)
    expect(PAGE).toMatch(/careerLevel: form\.careerLevel \|\| null, interests, \.\.\.campaignParams/)
    expect(PAGE, 'ما يريد تطويره من مجالات الدورات المفتوحة').toMatch(/const domains = \[\.\.\.new Set\(view\.openCourses\.map\(\(x\) => x\.domainAr\)/)
    expect(PAGE).toMatch(/toggleCourse\(p, d, GRANT_MAX_INTERESTS\)/)
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
    expect(PAGE).toMatch(/const courses = rankByInterest\(view\.openCourses, fits\)/)
    expect(PAGE).toMatch(/\{courses\.map\(\(x\) => \{/)
    expect(PAGE).toMatch(/onChange=\{\(\) => toggle\(x\.courseId\)\}/)
    expect(PAGE, 'يوم الشعبة بمنطقة الأكاديمية').toMatch(/cohortDayAr\(x\.startsAt\)/)
    /* ولا «مسار» في نصٍّ يراه — التعليقاتُ منزوعة */
    expect(PAGE.match(/مسار/g) ?? [], 'عادت كلمة مسار إلى الصفحة').toEqual([])
  })

  it('⚠️ دورات فقط — لا اقتراحات ولا مجموعات، ولكل دورة سعرها قبل المنحة وبعدها', () => {
    expect(PAGE, 'عادت الاقتراحات').not.toMatch(/pathways|suggestions|اقتراحات لك|اختر هذه الدورات/)
    expect(PAGE).toMatch(/قبل المنحة <span dir="ltr" className="line-through">\{money\(x\.price\)\}<\/span>/)
    expect(PAGE).toMatch(/بعد المنحة <span dir="ltr">\{money\(grantPrice\(x\.price, pct\)\)\}<\/span>/)
    expect(PAGE).toContain('من دورة واحدة إلى {max} دورات')
  })

  it('⚠️ وأنها مباشرة على Zoom — في أول الصفحة، وأول ما يحصل عليه، وفوق القائمة، وفي كل دورة', () => {
    expect(PAGE).toContain('دورات مباشرة على Zoom مع مدربين معتمدين')
    expect(GRANT_GAINS_AR[0]).toMatchObject({ id: 'live', title: 'لقاءات مباشرة على Zoom' })
    expect(GRANT_GAINS_AR.map((g) => g.id)).toContain('recording')
    expect(PAGE).toContain('كل الدورات مباشرة على Zoom')
    expect(PAGE).toMatch(/تبدأ \{cohortDayAr\(x\.startsAt\)\} · مباشرة على Zoom/)
    expect(grantStepsAr(60, 5)[2].body).toContain('على Zoom')
  })

  it('⚠️ ما يريد تطويره أولا — وكل على ترتيبه', () => {
    expect(rankByInterest(['a', 'b', 'c', 'd'], (x) => (x === 'c' || x === 'd' ? 1 : 0))).toEqual(['c', 'd', 'a', 'b'])
    expect(rankByInterest(['a', 'b', 'c'], (x) => ({ a: 1, b: 2, c: 0 })[x]!)).toEqual(['b', 'a', 'c'])
    expect(rankByInterest(['a', 'b'], () => 0), 'بلا اهتمام يبقى الترتيب').toEqual(['a', 'b'])
    /* ومجالُ الدورة الذي يعرضه الخادمُ مقبولٌ فيما يريد تطويرَه */
    expect(GRANT_INTEREST_DOMAINS.has(courseDomain('C-HR-101'))).toBe(true)
    expect(GRANT_INTEREST_DOMAINS.has('أخرى')).toBe(false)
    expect(leadProfileAr({ workField: 'الهندسة', careerLevel: 'مدير', interests: ['أ', 'ب'] })).toBe('مجاله: الهندسة · مستواه: مدير · يريد: أ، ب')
    expect(leadProfileAr({ workField: null, careerLevel: null, interests: [] })).toBe('')
  })

  it('⚠️ دورة واحدة أو أكثر حتى الحد — والزائدة ترد بلا أن تمحو ما اختاره', () => {
    expect(toggleCourse([], 'a', 4)).toEqual(['a'])
    expect(toggleCourse(['a', 'b'], 'a', 4)).toEqual(['b'])
    expect(toggleCourse(['a', 'b', 'c', 'd'], 'e', 4), 'تجاوز الحد').toEqual(['a', 'b', 'c', 'd'])
    expect(toggleCourse(['a', 'b', 'c', 'd'], 'd', 4)).toEqual(['a', 'b', 'c'])
  })

  it('⚠️ والنموذج يحث على التعبئة — بما هو قائم: عدد المنح الباقي من الخادم', () => {
    expect(PAGE).toMatch(/c\.left !== null \? `: بقي \$\{c\.left\} منحة` : ""/)
    expect(PAGE).toMatch(/>\{c\.open \? "احجز منحتي الآن" : "سجلني"\}<\/Button>/)
  })

  it('⚠️ نبذة قبل النموذج — من نحن بنصها، وما يحصل عليه، وكيف تعمل المنحة، وعدد الدورات من الخادم', () => {
    expect(PAGE, 'نص «من نحن» نفسه لا نسخة تفترق').toMatch(/\{FAMILY_INTRO\.body\}/)
    expect(PAGE).toMatch(/\{GRANT_GAINS_AR\.map\(\(g\) => \{/)
    expect(PAGE).toMatch(/\{grantStepsAr\(c\.percentOff, c\.maxCourses\)\.map\(/)
    expect(PAGE).toMatch(/dualOr\(view\.openCourses\.length,/)
    expect(PAGE, 'فصل الدورات من الخادم').toMatch(/\{view\.termAr \? ` في \$\{view\.termAr\}` : " الآن"\}/)
    /* والنبذةُ قبل النموذج في الصفحة */
    expect(PAGE.indexOf('{FAMILY_INTRO.body}')).toBeLessThan(PAGE.indexOf('id="grant-form"'))
    const steps = grantStepsAr(60, 5)
    expect(steps.map((x) => x.title)).toEqual(['عبئ النموذج', 'اختر دوراتك', 'ادفع 40% فقط'])
    expect(steps[1].body).toContain('إلى 5 دورات')
    expect(steps[1].body).toContain('قبل المنحة وبعدها')
  })

  it('⚠️ ما يحفظ على الجهاز يفحص — والعودة إلى مسار المنحة مقبولة', () => {
    const ok = { ref: '11111111-1111-4111-8111-111111111111', code: 'WG-ABCD2345', sentTo: null, name: 'سارة', email: 's@x.co', interests: ['أ'], at: Date.now() }
    expect(parseStoredGrant(JSON.stringify(ok))?.code).toBe('WG-ABCD2345')
    expect(parseStoredGrant(JSON.stringify(ok))?.interests).toEqual(['أ'])
    expect(parseStoredGrant(JSON.stringify({ ...ok, interests: [1, 'ب', 'ج', 'د', 'ه'] }))?.interests, 'اهتمام بغير شكله').toEqual(['ب', 'ج', 'د'])
    expect(parseStoredGrant(JSON.stringify({ ...ok, interests: undefined }))?.interests, 'حفظ قبل السؤال').toEqual([])
    expect(parseStoredGrant(JSON.stringify({ ...ok, ref: 'x' }))).toBeNull()
    expect(parseStoredGrant(JSON.stringify({ ...ok, code: 'javascript:1' }))?.code).toBeNull()
    expect(parseStoredGrant(JSON.stringify({ ...ok, at: Date.now() - 61 * 86_400_000 }))).toBeNull()
    const pending = { path: '/grant/11111111-1111-4111-8111-111111111111', intent: { title: 'مسار', amount: 1, kind: 'courses', courseIds: ['C-1'] }, cohortByCourse: {}, at: Date.now() }
    expect(parsePendingCheckout(JSON.stringify(pending), Date.now())?.path).toBe(pending.path)
  })
})

describe('النصوص', () => {
  it('بلا تشكيل', () => {
    const data = [
      GRANT_CONSENT_AR, ...WORK_FIELDS, ...CAREER_LEVELS, ...GRANT_GAINS_AR.flatMap((g) => [g.title, g.body]),
      ...grantStepsAr(60, 4).flatMap((x) => [x.title, x.body]),
    ]
    const onPage = ['احجز منحتي الآن', 'الاسم الكامل', 'رقم الواتساب', 'البريد الإلكتروني', 'مجال عملك', 'مستواك الوظيفي', 'ما الذي تريد تطويره؟',
      'سؤالان اختياريان', 'عن أكاديمية وجيز', 'ماذا تحصل عليه مع كل دورة', 'كيف تعمل المنحة', 'كود منحتك', 'اختر دوراتك',
      'كل الدورات المتاحة', 'كل الدورات مباشرة على Zoom', 'قبل المنحة', 'بعد المنحة', 'يناسب ما تريد تطويره', 'لست متأكدا؟ تواصل مع مستشار', 'اطلب مستشارا', 'ادفع الآن']
    for (const t of [...data, ...onPage]) expect(t).toBe(plainAr(t))
    for (const t of onPage) expect(PAGE).toContain(t)
    expect(auditActionAr('coupon.grant_apply')).not.toBe('coupon.grant_apply')
  })
})
