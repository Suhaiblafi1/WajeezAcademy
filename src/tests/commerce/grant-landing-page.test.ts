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
import { influencerCodeLabelAr } from '@/application/commerce/influencer'
import { auditActionAr } from '@/application/audit/labels'
import {
  CAREER_LEVELS, GRANT_ACADEMY_LINE_AR, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_GIFT_AR, GRANT_GIFT_MAX, GRANT_INTEREST_DOMAINS, GRANT_SUGGESTED_COURSES, WORK_FIELDS,
  GRANT_VALUE_AR, GRANT_VALUE_PAID_AR, GRANT_SECTION_GROUPS, GRANT_SUMMARY_GOALS, grantCourseSummary, grantSectionOf, GRANT_FACES_MAX, GRANT_FACES_PHONE, GRANT_FAQ_AR, grantTrainerFaces, grantTrainersAr, campaignParams, campaignTag, grantAdvisorTextAr, grantClashAr, grantThanksAr, GRANT_SHARE_PATH, grantLeftAr, grantLimitAr, grantRemainingAr, grantCallDueAt, grantCountAr, grantCountdown, grantDaysLeftAr, grantSections, grantShareAr, grantShareMailto, leadProfileAr, rankByInterest, seatsLeftAr, suggestCourses, suggestPaths, toggleCourse, workFieldDomains,
} from '@/application/commerce/grant-landing'
import { courseDomain } from '@/application/catalog/course-domain'
import { zonedInstant } from '@/application/trainer/cohort-period'
import { parsePendingCheckout } from '@/application/commerce/pending-checkout'
import { parseStoredGrant } from '@/services/grant-landing'
import { WHATSAPP_SPOTS } from '@/application/site/whatsapp'
import { ENDORSEMENT_MIN_ATTENDANCE } from '@/application/learning/endorsement'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
/** صندوقُ الكود أعلى الصفحة الثانية — بدايتُه، تُقطع منها الشيفرةُ في الحرّاس */
const TOP_CARD = '<Card tone="accent" className="text-center">'
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
    /* وباب منحة المؤثّرين ثالثُها، بالسقف نفسِه (٢٦ أكتوبر ٢٠٢٦) */
    expect(ROUTES).toMatch(/app\.post\('\/api\/public\/grant\/influencer', \{\s*config: \{ rateLimit: \{ max: 5, timeWindow: '15 minutes' \} \}/)
    expect((ROUTES.match(/assertNotBot\(req\.body\)/g) ?? []).length, 'باب بلا مصيدة').toBe(3)
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
  it('⚠️ ما يدفعه كبيرا «4 دورات بـ$320 بدل $800»، وقيمة منحته صغيرة تحته — والمبالغ معزولة فلا تنقلب', () => {
    expect(`${GRANT_VALUE_AR} $480 ${GRANT_VALUE_PAID_AR}`).toBe('قيمة منحتك $480 تدفعها الأكاديمية عنك')
    const panel = PAGE.slice(PAGE.indexOf('<Card tone="solid" className="sticky'))
    const big = panel.indexOf('<p className="text-lg font-black">')
    expect(big, 'السطر الكبير').toBeGreaterThan(-1)
    expect(panel.slice(big)).toMatch(/^<p className="text-lg font-black">\s*\{grantCountAr\(chosen\.length\)\} بـ<bdi dir="ltr">\{money\(payTotal\)\}<\/bdi>/)
    expect(panel).toMatch(/بدل <bdi dir="ltr" className="line-through">\{money\(listTotal\)\}<\/bdi>/)
    expect(panel, 'قيمة المنحة بخط صغير').toMatch(/<p className="mt-0\.5 text-read text-muted-foreground">\{GRANT_VALUE_AR\} <bdi dir="ltr">\{money\(listTotal - payTotal\)\}<\/bdi> \{GRANT_VALUE_PAID_AR\}<\/p>/)
    expect(PAGE, 'عاد «ووجيز تتحمل»').not.toMatch(/تتحمل|grantSavingAr/)
    expect([1, 2, 4, 10, 11].map(grantCountAr)).toEqual(['دورة واحدة', 'دورتان', '4 دورات', '10 دورات', '11 دورة'])
    expect(PAGE).toMatch(/prefill=\{\{ name: stored\.name, email: stored\.email \}\}/)
    expect(PAGE).toMatch(/initialCoupon=\{stored\.code \?\? ""\}/)
    expect(PAGE, 'يحفظ ما اختاره قبل أن يطلب منه حساب').toMatch(/savePendingCheckout\(\{\s*path: pickPath \?\? PICK_PATH,/)
    expect(PAGE).toMatch(/<ResumeCheckout ready=/)
  })

  it('⚠️ قائمة دورات واحدة — كل ما يشترى اليوم، فالجديد يظهر وحده', () => {
    expect(PAGE).toMatch(/const courses = rankByInterest\(view\.openCourses, \(x\) => \(ours\.has\(x\.courseId\) \? 2 \+ suggested\.length - suggested\.indexOf\(x\.courseId\) : fits\(x\)\)\)/)
    expect(PAGE).toMatch(/const row = \(x: GrantCourse, inSection = false\) => \{/)
    expect(PAGE).toMatch(/onChange=\{\(\) => toggle\(x\.courseId\)\}/)
    expect(PAGE, 'يوم الشعبة بمنطقة الأكاديمية').toMatch(/cohortDayAr\(x\.startsAt\)/)
    /* ولا «مسار» في نصٍّ يراه — التعليقاتُ منزوعة */
    /* و«مسار» عادت بقرار صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): مسارٌ رئيسيٌّ وبديلٌ من المسارات العامّة — لا
       مجموعاتٌ يُعدّها هو في شاشة المنحة كما كانت (الاقتراحاتُ المحذوفة) */
  })

  it('⚠️ دورات فقط — لا اقتراحات ولا مجموعات، ولكل دورة سعرها قيمتين بلا «قبل المنحة/بعد المنحة»', () => {
    expect(PAGE, 'عادت الاقتراحات').not.toMatch(/view\.pathways|\/api\/admin\/member-grant\/pathways|اقتراحات لك|اختر هذه الدورات/)
    /* ما يدفعه كبيرا وأصلُه مشطوبا بعده — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «فقط السعرُ قبل وبعد كقيم» */
    expect(PAGE).toMatch(/<bdi dir="ltr" className="text-lg font-black">\{money\(grantPrice\(x\.price, pct\)\)\}<\/bdi>\s*<bdi dir="ltr" className="text-read text-muted-foreground line-through">\{money\(x\.price\)\}<\/bdi>/)
    expect(PAGE, 'عادت «قبل المنحة/بعد المنحة»').not.toMatch(/قبل المنحة|بعد المنحة/)
  })

  it('⚠️ الحد جملة واحدة تحت «آخر يوم» في بطاقة الكود — لا فقرة تحت العنوان', () => {
    expect([1, 2, 4].map(grantLimitAr)).toEqual([
      'اختر حتى دورة واحدة، ويمكنك استبدالها لاحقا مع مستشارك.',
      'اختر حتى دورتين، ويمكنك استبدالها لاحقا مع مستشارك.',
      'اختر حتى 4 دورات، ويمكنك استبدالها لاحقا مع مستشارك.',
    ])
    const card = PAGE.slice(PAGE.indexOf(TOP_CARD), PAGE.indexOf('<h2 className="mt-6'))
    expect(card).toMatch(/<GrantCountdown closesAt=\{c\.closesAt\} className="mt-3" \/>\}\s*\{c\.open && <p className="mt-0\.5 text-read text-muted-foreground">\{grantLimitAr\(max\)\}<\/p>\}/)
    expect(PAGE.match(/grantLimitAr\(/g)?.length, 'الحد يقال مرتين').toBe(1)
    expect(PAGE, 'عادت فقرة الحد الطويلة').not.toMatch(/وهذا أقصى ما تغطيه منحتك|بعد استشارة مستشارك الخاص/)
  })

  it('⚠️ وجوه مدربي الموسم تحت النموذج — من دورات المنحة، من له صورة، بلا تكرار، والعدد لكلهم', () => {
    /* قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦): «كيف نقنع العميل أكثر؟ ماذا نضيف أسفل طلب التسجيل؟» — فاختار وجوهَ المدرّبين */
    const t = (id: string, photo: boolean) => ({ trainer: { id, name: `مدرب ${id}`, photoUrl: photo ? `/p/${id}` : null } })
    const out = grantTrainerFaces([t('a', true), t('a', true), t('b', false), t('c', true), { trainer: null }, t('d', true)])
    expect(out.total, 'العدد لكل المدربين بلا تكرار').toBe(4)
    expect(out.faces.map((f) => f.id), 'من له صورة وحده').toEqual(['a', 'c', 'd'])
    expect(grantTrainerFaces(Array.from({ length: 20 }, (_, i) => t(`x${i}`, true))).faces).toHaveLength(GRANT_FACES_MAX)
    expect(GRANT_FACES_MAX).toBe(9)
    expect([1, 2, 5, 10, 15].map(grantTrainersAr)).toEqual(['مدرب واحد', 'مدربان', '5 مدربين', '10 مدربين', '15 مدربا'])
    /* وفي الصفحة: بعد النموذج وقبل سطر الأكاديمية، من الدورات المعروضة نفسِها، وثلاثةُ وجوهٍ على الأقلّ */
    expect(PAGE).toMatch(/const trainers = grantTrainerFaces\(view\.openCourses\);/)
    const after = PAGE.slice(PAGE.indexOf('{GRANT_CONSENT_AR}</p>\n        </Card>'))
    expect(after.indexOf('{trainers.faces.length >= 3 && ('), 'الوجوه ليست بعد النموذج').toBeGreaterThan(0)
    expect(after.indexOf('{trainers.faces.length >= 3 && ('), 'الوجوه بعد سطر الأكاديمية').toBeLessThan(after.indexOf('{GRANT_ACADEMY_LINE_AR}'))
    expect(after).toMatch(/\{grantTrainersAr\(trainers\.total\)\} · \{grantCountAr\(view\.openCourses\.length\)\} مباشرة على Zoom/)
    expect(after).toMatch(/\+\{trainers\.total - trainers\.faces\.length\}/)
    for (const x of ['تتعلم مع مدربين معتمدين لدينا', 'مباشرة على Zoom']) { expect(plainAr(x)).toBe(x); expect(PAGE).toContain(x) }
  })

  it('⚠️ أسئلة سريعة تحت النموذج — أربعة مطوية، وأجوبتها مما في المنصة لا وعد يختلق', () => {
    /* قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): اختار «أسئلةٌ قصيرةٌ مطويّة» تحت النموذج */
    expect(GRANT_FAQ_AR).toHaveLength(4)
    for (const f of GRANT_FAQ_AR) { expect(plainAr(f.q)).toBe(f.q); expect(plainAr(f.a)).toBe(f.a) }
    const answers = GRANT_FAQ_AR.map((f) => f.a).join(' ')
    expect(answers, 'حد رسالة التوصية ليس من مصدره').toContain(`حضر ${ENDORSEMENT_MIN_ATTENDANCE}% من اللقاءات وأنجز كل مهامه`)
    expect(answers, 'وعد بتسجيل اللقاءات — استبدله صاحب المنصة بتطبيقات عملية').not.toMatch(/تسجيل|مسجلة/)
    expect(code('src/components/BuyPanel.tsx'), 'الجواب يقول ما لم يعد يقوله لوح الدفع').toContain('لا نحفظ بيانات بطاقتك')
    expect(grantLimitAr(4), 'الاستبدال مع المستشار لم يعد قول الصفحة').toContain('مع مستشارك')
    const after = PAGE.slice(PAGE.indexOf('{GRANT_CONSENT_AR}</p>\n        </Card>'))
    const at = after.indexOf('{GRANT_FAQ_AR.map((f) => (')
    expect(at, 'الأسئلة ليست بعد النموذج').toBeGreaterThan(0)
    expect(at, 'الأسئلة بعد سطر الأكاديمية').toBeLessThan(after.indexOf('{GRANT_ACADEMY_LINE_AR}'))
    expect(after.slice(at), 'الأسئلة مفتوحة أو بلا طي').toMatch(/^\{GRANT_FAQ_AR\.map\(\(f\) => \(\s*<Inset as="details" key=\{f\.q\} className="group px-3\.5 py-2\.5">/)
    /* وأصغرُ قليلا — قرارُه (٢٧ أكتوبر ٢٠٢٦): «الأسئلة السريعة حاول أن تجعلها أصغر قليلا» */
    const faq = after.slice(after.indexOf('أسئلة سريعة</h2>') - 200, after.indexOf('{GRANT_ACADEMY_LINE_AR}'))
    expect(faq, 'عاد عرض الأسئلة كاملا').toMatch(/<div className="mx-auto mt-12 max-w-xl">\s*<h2 className="mb-2 text-center text-read font-bold">أسئلة سريعة<\/h2>\s*<div className="space-y-1\.5">/)
    expect(faq, 'السؤال بخط الصفحة الكبير').toMatch(/<summary className="[^"]*\btext-read font-bold\b/)
    expect(faq, 'عادت حشوة الأسئلة الكبيرة').toMatch(/<p className="mt-1\.5 text-read leading-6 text-muted-foreground">\{f\.a\}<\/p>/)
  })

  /* «تزيد المسافات ما بين صور المدربين والبوكس» — قرارُه (٢٧ أكتوبر ٢٠٢٦): فوقها النموذجُ وتحتها الأسئلة */
  it('⚠️ وجوه المدربين بمسافة أوسع فوقها وتحتها', () => {
    const after = PAGE.slice(PAGE.indexOf('{GRANT_CONSENT_AR}</p>\n        </Card>'))
    expect(after).toMatch(/\{trainers\.faces\.length >= 3 && \(\s*<div className="mt-12 text-center">/)
    expect(after).toMatch(/<div className="mx-auto mt-12 max-w-xl">\s*<h2[^>]*>أسئلة سريعة/)
  })

  it('⚠️ وجوه المدربين أكبر قليلا — ولا تنضغط، وما على الهاتف يتسع لهاتف بعرض 360', () => {
    /* قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «اجعل صور المدربين أكبر قليلا». والمقاسُ يُقرأ من الصنف نفسِه ويُحسب، لا يُنسخ رقما */
    const row = PAGE.slice(PAGE.indexOf('{trainers.faces.length >= 3 && ('), PAGE.indexOf('تتعلم مع مدربين معتمدين لدينا'))
    const imgCls = row.match(/<img key=\{t\.id\}[^>]*className=\{`([^`]*)`\}/)?.[1] ?? ''
    const img = imgCls.split(/\s+/)
    const size = (re: RegExp) => Number(img.find((c) => re.test(c))?.match(re)?.[1] ?? 0) * 4
    const phone = size(/^h-(\d+)$/), wide = size(/^sm:h-(\d+)$/), overlap = Number(row.match(/-space-x-(\d+)/)?.[1] ?? 0) * 4
    expect(phone, 'الوجه على الهاتف ليس أكبر من 44').toBeGreaterThan(44)
    expect(wide, 'الوجه على الواسعة ليس أكبر منه على الهاتف').toBeGreaterThan(phone)
    expect(img, 'وجه بلا عرض أو بلا ثبات — ينضغط فيصير بيضاويا').toEqual(expect.arrayContaining([`w-${phone / 4}`, `sm:w-${wide / 4}`, 'shrink-0']))
    expect((GRANT_FACES_PHONE + 1) * phone - GRANT_FACES_PHONE * overlap, 'صف الهاتف لا يتسع لهاتف بعرض 360').toBeLessThanOrEqual(320)
    expect(GRANT_FACES_PHONE).toBeLessThan(GRANT_FACES_MAX)
    /* وما بعد ستّةٍ يختفي على الهاتف، ولكلّ شاشةٍ «+N» بعددها وبمقاس وجوهها */
    expect(imgCls).toContain('${i < GRANT_FACES_PHONE ? "" : "hidden sm:block"}')
    expect(row).toMatch(new RegExp(`h-${phone / 4} w-${phone / 4} shrink-0 [^"]*sm:hidden" dir="ltr">\\s*\\+\\{trainers\\.total - Math\\.min\\(trainers\\.faces\\.length, GRANT_FACES_PHONE\\)\\}`))
    expect(row).toMatch(new RegExp(`h-${wide / 4} w-${wide / 4} shrink-0 [^"]*sm:grid" dir="ltr">\\s*\\+\\{trainers\\.total - trainers\\.faces\\.length\\}`))
  })

  it('⚠️ المنحة بنسبتها «تصل إلى 60%» لا «تدفع 40% فقط» — في الصفحة الأولى وبريد الكود وبريد التذكير', () => {
    /* قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦): «نقول إنّ المنحة تصل لـ٦٠٪ أفضل من أنّك تدفع ٤٠٪» */
    /* ثمّ صار سطرُه شكرا من تطبيق وجيز لمستخدمه (٢٧ أكتوبر ٢٠٢٦) — والنسبةُ «تصل إلى» كما هي */
    expect(PAGE).toMatch(/\{!forInfluencer\s*\? grantThanksAr\(c\.percentOff\)/)
    expect(grantThanksAr(60)).toBe('تطبيق وجيز يشكرك لأنك من قرائه، ويسعدنا أن نقدم لك منحة حصرية تصل إلى 60% لتستفيد من منتجنا الجديد: أكاديمية وجيز.')
    /* وفي منحة المؤثّرين باسم المؤثّر إن جاء برابطه (٢٦ أكتوبر ٢٠٢٦) */
    expect(PAGE).toContain('`بدعوة من ${view.influencer.nameAr}، منحتك تصل إلى ${c.percentOff}% من سعر دوراتك.`')
    /* وخانةُ الكود باسم المؤثّر لا «كود المؤثّر» — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦) */
    expect(PAGE).toMatch(/<label className="grid gap-1 text-read">\{influencerCodeLabelAr\(view\.influencer\?\.nameAr\)\}/)
    expect(PAGE, 'عاد «كود المؤثر» اسما للخانة').not.toMatch(/text-read">كود المؤثر\s*</)
    expect(influencerCodeLabelAr('سارة')).toBe('الكود الخاص بـسارة')
    expect(influencerCodeLabelAr(' ')).toBe('الكود الخاص بالمؤثر')
    expect(influencerCodeLabelAr(null)).toBe('الكود الخاص بالمؤثر')
    expect(code('server/services/grant-landing.service.ts')).toContain('`منحتك تصل إلى ${percentOff}% من سعر دورات أكاديمية وجيز.`')
    expect(code('server/services/grant-followup.service.ts')).toContain('`منحتك تصل إلى ${pct}% من سعر دورات مباشرة على Zoom مع مدربين معتمدين.`')
    for (const f of ['src/pages/MemberGrantPage.tsx', 'server/services/grant-landing.service.ts', 'server/services/grant-followup.service.ts']) {
      expect(code(f), `${f}: عاد «تدفع …% فقط»`).not.toMatch(/تدفع \$?\{100 - |% فقط من سعر/)
    }
    for (const t of [grantThanksAr(60), 'من سعر دوراتك.', 'بدعوة من']) expect(plainAr(t)).toBe(t)
  })

  it('⚠️ وأنها مباشرة على Zoom — في أول الصفحة وفي كل دورة، وما يحصل عليه سطر صغير في صندوق الكود', () => {
    expect(PAGE).toContain('دورات مباشرة على Zoom، تختار منها حتى {c.maxCourses}.')
    /* البنودُ بقرار صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «لقاءات مباشرة + تطبيقات عملية + شهادة ورسالة توصية» — و«لمن يلتزم» باقٍ */
    expect(GRANT_GAINS_AR.map((g) => [g.id, g.title])).toEqual([
      ['live', 'لقاءات مباشرة'],
      ['practice', 'تطبيقات عملية'],
      ['certificate', 'شهادة ورسالة توصية لمن يلتزم'],
    ])
    for (const g of GRANT_GAINS_AR) expect(plainAr(g.title)).toBe(g.title)
    /* وفي صندوق الكود وحدَه — حُذف من الصفحة الأولى بقراره (٢٥ أكتوبر ٢٠٢٦): «احذفها من الصفحة الأولى» */
    expect(PAGE.match(/\{GRANT_GAINS_AR\.map\(/g)?.length, 'البنود في غير صندوق الكود').toBe(1)
    const formAt = PAGE.indexOf('const ready = form.fullName')
    expect(formAt, 'الصفحة الأولى لم توجد').toBeGreaterThan(0)
    expect(PAGE.slice(formAt), 'عادت البنود إلى الصفحة الأولى').not.toContain('GRANT_GAINS_AR')
    const card = PAGE.slice(PAGE.indexOf(TOP_CARD), PAGE.indexOf('<h2 className="mt-6'))
    /* عمودٌ واحدٌ في الوسط — قرارُه (٢٧ أكتوبر ٢٠٢٦): «تنتهي المنحة… وآخر يوم واختر حتى ٤ يجب أن تكون في المنتصف،
       وأسفلها سطرٌ صغير». فلا عمودان ولا ما يميل إلى طرفٍ على الحاسوب */
    expect(card).toMatch(/^<Card tone="accent" className="text-center">/)
    expect(card, 'مال شيء في الصندوق إلى طرف على الحاسوب').not.toMatch(/sm:(text-start|justify-start|justify-end|grid-cols|border-s)/)
    /* وبأيقونةٍ قبل كلّ بندٍ في السطر نفسِه — قرارُه (٢٧ أكتوبر ٢٠٢٦): «ضع أيقوناتٍ للمباشر وغيرها في نفس السطر.. تكون عصريّة» */
    expect(card, 'السطر الصغير ليس تحت الحد').toMatch(/\{grantLimitAr\(max\)\}<\/p>\}\s*<p className="mx-auto mt-3 flex max-w-lg flex-wrap justify-center gap-x-4 gap-y-1 border-t border-border pt-3 text-read leading-6 text-muted-foreground">\s*\{GRANT_GAINS_AR\.map\(\(g\) => \{/)
    expect(card, 'البند بلا أيقونته في سطره').toMatch(/<span key=\{g\.id\} className="inline-flex items-center gap-1\.5 whitespace-nowrap">\s*<Icon className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" \/>\{g\.title\}\s*<\/span>/)
    expect(PAGE).toMatch(/const GAIN_ICON: Record<\(typeof GRANT_GAINS_AR\)\[number\]\["id"\], LucideIcon> = \{ live: Video, practice: PencilRuler, certificate: Award \};/)
    expect(card, 'عادت «+» بين البنود').not.toContain('"+ "')
    expect(card, 'عادت الأيقونات قائمة عمودية').not.toMatch(/GrantGains|<ul /)
    expect(card, 'عادت أيقونة الهدية سطرا وحدها').not.toMatch(/<Gift className="mx-auto/)
    expect(card, 'فقرة فارغة حين لا شيء يقال').toMatch(/topNote && <p className="text-read">\{topNote\}<\/p>/)
    const picker = PAGE.slice(PAGE.indexOf('<h2 className="mt-6'), PAGE.indexOf('view.openCourses.length === 0'))
    expect(picker, 'البنود تحت العنوان لا في الصندوق').not.toContain('GRANT_GAINS_AR')
    expect(PAGE, 'عاد صندوق Zoom الكبير').not.toMatch(/كل الدورات مباشرة على Zoom|تسجيل كل لقاء/)
    expect(PAGE).toMatch(/تبدأ \{cohortDayAr\(x\.startsAt\)\} · مباشرة على Zoom/)
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

  it('⚠️ خمس دورات نقترحها له — ما يريد تطويره، ثم مجال عمله، ثم الأقرب موعدا', () => {
    /* «اجعلهم ٥ دوراتٍ على أن يختار هو أربعةً فقط» — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
    expect(GRANT_SUGGESTED_COURSES).toBe(5)
    const hr = courseDomain('C-HR-101'), mkt = courseDomain('C-MKT-101'), ai = courseDomain('C-AI-101')
    const day = (d: number) => new Date(Date.UTC(2026, 10, d)).toISOString()
    const pool = [
      { courseId: 'ai-late', domainAr: ai, startsAt: day(30) },
      { courseId: 'hr-late', domainAr: hr, startsAt: day(25) },
      { courseId: 'ai-soon', domainAr: ai, startsAt: day(2) },
      { courseId: 'mkt', domainAr: mkt, startsAt: day(20) },
      { courseId: 'hr-soon', domainAr: hr, startsAt: day(9) },
      { courseId: 'none', domainAr: null, startsAt: null },
    ]
    /* مجالُ عمله «الموارد البشرية» واهتمامُه «التسويق»: التسويقُ أوّلا، ثمّ دورتا الموارد البشريّة بموعدهما، ثمّ الأقرب */
    expect(suggestCourses(pool, [mkt], 'الموارد البشرية', 4)).toEqual(['mkt', 'hr-soon', 'hr-late', 'ai-soon'])
    /* بلا اهتمامٍ ومجالٍ لا يقابل دورة: الأقربُ موعدا، وبلا موعدٍ آخرا */
    expect(suggestCourses(pool, [], 'أخرى', 4)).toEqual(['ai-soon', 'hr-soon', 'mkt', 'hr-late'])
    expect(suggestCourses(pool, [], 'أخرى', 9).at(-1), 'بلا موعد قبل ما له موعد').toBe('none')
    expect(suggestCourses(pool.slice(0, 2), [mkt], 'الهندسة', 4), 'أكثر مما يشترى').toHaveLength(2)
    expect(suggestCourses(pool, [], 'أخرى', 0)).toEqual([])
    /* ولكلّ مجال عملٍ مجالاتُ دوراتٍ قائمة — إلّا «أخرى» */
    for (const f of WORK_FIELDS) {
      const ds = workFieldDomains(f)
      for (const d of ds) expect(GRANT_INTEREST_DOMAINS.has(d), `${f}: ${d}`).toBe(true)
      if (f !== 'أخرى') expect(ds.length, `بلا مجالات: ${f}`).toBeGreaterThan(0)
    }
  })

  /* «اقترح له ٤ دوراتٍ لا تتعارض ولا تكرّر المدرّبَ نفسَه، واجعلهم ٥» — و«عندما تتعارض دوراتٌ يجب أن تظهر فورا… تتعارض مع
     التي قبلها، واجعل الرسالةَ واضحةً وسهلةَ القراءة» — قرارا صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ والمقترحة لا تتعارض ولا يتكرر فيها مدرب — ودورات المسار الرئيسي أولها', () => {
    const at = (d: number, h: number) => ({ startsAt: new Date(Date.UTC(2026, 11, d, h)).toISOString(), endsAt: new Date(Date.UTC(2026, 11, d, h + 2)).toISOString() })
    const t = (id: string) => ({ id })
    const pool = [
      { courseId: 'a', domainAr: null, startsAt: null, trainer: t('T1'), sessions: [at(1, 16)] },
      { courseId: 'b', domainAr: null, startsAt: null, trainer: t('T1'), sessions: [at(2, 16)] },
      { courseId: 'c', domainAr: null, startsAt: null, trainer: t('T2'), sessions: [at(1, 17)] },
      { courseId: 'd', domainAr: null, startsAt: null, trainer: t('T3'), sessions: [at(1, 18)] },
      { courseId: 'e', domainAr: null, startsAt: null, trainer: null, sessions: [] },
      { courseId: 'f', domainAr: null, startsAt: null, trainer: t('T4'), sessions: [at(3, 16)] },
    ]
    /* «b» مدرّبُ «a»، و«c» تقع على «a» (١٧ داخلَ ١٦–١٨)، و«d» تبدأ حين تنتهي «a» فلا تتعارض. وبلا جدولٍ لا يُتخطّى */
    expect(suggestCourses(pool, [], 'أخرى', 5)).toEqual(['a', 'd', 'e', 'f'])
    expect(suggestCourses(pool, [], 'أخرى', 2)).toEqual(['a', 'd'])
    /* ودوراتُ المسار الرئيسيّ أوّلا بترتيبه — ثمّ تُطبَّق القاعدتان على ما بعدها: «a» مدرّبُ «b»، و«d» تقع على «c» */
    expect(suggestCourses(pool, [], 'أخرى', 5, ['c', 'b'])).toEqual(['c', 'b', 'e', 'f'])
    /* وسطرُ التعارض: مع التي قبلها وحدَها، ومرّةً */
    const row = (courseId: string, sessions: { startsAt: string; endsAt: string }[]) => ({ courseId, cohortId: `K-${courseId}`, titleAr: `دورة ${courseId}`, sessions })
    const x = row('x', [at(6, 16), at(13, 16)]), y = row('y', [at(6, 17), at(13, 17)]), z = row('z', [at(7, 16)])
    /* «خفّف نصَّ التعارض.. قل تتعارض فقط بدون في كم لقاء» — قرارُه (٢٧ أكتوبر ٢٠٢٦) */
    expect(grantClashAr(y, [x])).toBe('تتعارض مع «x».')
    expect(grantClashAr(x, []), 'الأولى لا تتعارض مع ما بعدها').toBeNull()
    expect(grantClashAr(z, [x, y])).toBeNull()
    expect(plainAr(grantClashAr(y, [x])!)).toBe(grantClashAr(y, [x]))
    /* والاسمُ قصيرٌ يُعرف به — لا العنوانُ كلُّه بوعده */
    const long = { ...x, titleAr: 'دورة تحليلات الموارد البشرية: فحص التحيّز قبل أن يصير سياسة' }
    expect(grantClashAr(y, [long])).toBe('تتعارض مع «تحليلات الموارد البشرية».')
    /* وفي الصفّ: فورَ اختيارها، مع ما اختاره قبلها بترتيبه — ولا يمنع الاختيار */
    const card = PAGE.slice(PAGE.indexOf('const row = '), PAGE.indexOf(TOP_CARD))
    expect(card).toMatch(/const clash = on \? grantClashAr\(x, chosen\.slice\(0, chosen\.findIndex\(\(c\) => c\.courseId === x\.courseId\)\)\) : null;/)
    expect(card).toMatch(/\{clash && \(\s*<span role="status" className="mt-2 flex items-start gap-1\.5 text-read font-bold leading-6 text-gold-ink">/)
    expect(card, 'التعارض يمنع الاختيار').toMatch(/const full = !on && picked\.length >= max;/)
    /* و«لا تتعارض» لا تُقال إلّا وكلُّ مقترحةٍ لها لقاءاتٌ معتمَدة */
    expect(PAGE).toMatch(/const timedSuggested = top\.length > 0 && top\.every\(\(x\) => \(x\.sessions\?\.length \?\? 0\) > 0\);/)
    expect(PAGE).toMatch(/تناسبك\{timedSuggested \? " ولا تتعارض مواعيدها" : ""\}\.\{suggested\.length > max && ` اختر منها حتى \$\{max\}\.`\}/)
  })

  /* «عندما يقوم بالدفع لا يظهر نفس السعر… يجب أن يصلح من جهتك» — واختار صاحبُ المنصّة المطابقةَ بالبريد (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ من لا كود ظاهرا له يأخذه بحسابه حين يدخل — ولوح الدفع يعاد بالكود فيسعر بمنحته', () => {
    /* وحين يفتح لوحُ الدفع أيضا — من أنشأ حسابه في نافذة الدفع لا تعرفه الصفحةُ بعدُ (بلاغُ ٢٧ أكتوبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const claimFor = \(session \|\| buyOpen\) && stored && !stored\.code \? `\$\{session\?\.email \?\? "buy"\}\|\$\{stored\.ref\}` : null;/)
    expect(PAGE).toMatch(/apiGet<\{ code: string \| null \}>\(`\/api\/learner\/grant-code\?campaign=\$\{forInfluencer \? "influencer" : "member"\}`\)/)
    expect(PAGE, 'لا يحفظ الكود على الجهاز').toMatch(/if \(kept && !kept\.code\) saveStoredGrant\(\{ \.\.\.kept, code, sentTo: null \}, storeKey\);/)
    expect(PAGE).toMatch(/setStored\(\(s\) => \(s && !s\.code \? \{ \.\.\.s, code, sentTo: null \} : s\)\);/)
    /* ولوحُ الدفع يُبنى من جديدٍ حين يصل الكود — فلا يبقى على أوّل حالٍ بلا منحة */
    expect(PAGE).toMatch(/<BuyPanel\s+key=\{stored\.code \?\? "no-code"\}[\s\S]{0,200}initialCoupon=\{stored\.code \?\? ""\}/)
    expect(code('server/http/routes/public-grant.routes.ts')).toMatch(/app\.get\('\/api\/learner\/grant-code', \{\s*preHandler: requireAuth,/)
    expect(auditActionAr('coupon.grant_claim')).not.toBe('coupon.grant_claim')
  })

  it('⚠️ مسار رئيسي وبديل — كل دوراته في المنحة، والأنسب له، ولا رئيسي بلا ملاءمة', () => {
    const hr = courseDomain('C-HR-101'), mkt = courseDomain('C-MKT-101'), ai = courseDomain('C-AI-101'), cyb = courseDomain('C-CYB-101')
    const pool = [
      { courseId: 'H1', domainAr: hr }, { courseId: 'H2', domainAr: hr },
      { courseId: 'M1', domainAr: mkt }, { courseId: 'M2', domainAr: mkt },
      { courseId: 'A1', domainAr: ai }, { courseId: 'C1', domainAr: cyb },
    ]
    const people = { id: 'P-HR', title: 'الناس', courseIds: ['H1', 'H2', 'M1'] }
    const market = { id: 'P-MKT', title: 'السوق', courseIds: ['M1', 'M2'] }
    const half = { id: 'P-HALF', title: 'نصفه مغلق', courseIds: ['H1', 'H9'] }
    const tech = { id: 'P-TECH', title: 'التقنية', courseIds: ['A1', 'C1'] }
    /* مجالُ الموارد البشريّة واهتمامُه التسويق: «السوق» ٤ (٢+٢) فوق «الناس» ٤ (١+١+٢)؟ يتعادلان — فالأسبقُ في الترتيب */
    expect(suggestPaths([people, market, tech], pool, [mkt], 'الموارد البشرية')).toEqual({ main: people, alt: market })
    expect(suggestPaths([market, people, tech], pool, [mkt], 'الموارد البشرية').main, 'التعادل بترتيب المختارات').toBe(market)
    /* ولا مسارَ بعضُ دوراته خارج المنحة — ولو كان أنسبَها */
    expect(suggestPaths([half, tech], pool, [hr], 'الموارد البشرية')).toEqual({ main: null, alt: tech })
    /* ولا رئيسيَّ بملاءمةٍ صفر: يُعرض أوّلُها بديلا، ودوراتُه الأربع من suggestCourses */
    expect(suggestPaths([market, tech], pool, [], 'أخرى')).toEqual({ main: null, alt: market })
    expect(suggestPaths([], pool, [mkt], 'الموارد البشرية')).toEqual({ main: null, alt: null })
    /* وفي الصفحة: المساراتُ العامّةُ بترتيب المختارات، ودوراتُ الرئيسيّ تُختار، والبديلُ بضغطة */
    expect(PAGE).toMatch(/import publicPathsData from "@\/data\/catalog\/public-pathways\.json";/)
    expect(PAGE).toMatch(/const found = suggestPaths\(GRANT_PATHS, view\.openCourses, stored\.interests, stored\.workField\);/)
    /* ودوراتُ الرئيسيّ أوّلُ المقترحة — لا كلُّها: الخمسُ لا تتعارض ولا يتكرّر فيها مدرّب (٢٧ أكتوبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const ours = suggestCourses\(view\.openCourses, stored\.interests, stored\.workField, GRANT_SUGGESTED_COURSES, found\.main\?\.courseIds \?\? \[\]\);/)
    /* ولا خيارَ «بدّل» إلى البديل — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «لا داعي لخيار بدّل للمسار لأنّه غير مفهوم» */
    expect(PAGE, 'عاد خيار بدّل المسار').not.toMatch(/switchPath|بدّل إليه|أو مسار|\.alt\b/)
  })

  it('⚠️ نقترحها ولا نختارها عنه — وما تركه قبل توثيق بريده يعود مختارا، ولا تتجاوز الحد', () => {
    const effect = PAGE.slice(PAGE.indexOf('useEffect(() => {\n    if (!view || !stored || seeded) return;'))
    expect(effect.length, 'الاختيار الأول لا ينتظر الكود').toBeGreaterThan(0)
    expect(effect).toMatch(/suggestCourses\(view\.openCourses, stored\.interests, stored\.workField, GRANT_SUGGESTED_COURSES, found\.main\?\.courseIds \?\? \[\]\)/)
    expect(effect, 'اختارها عنه').toMatch(/setPicked\(resumed \? resumed\.intent\.courseIds\.filter\(\(id\) => open\.has\(id\)\)\.slice\(0, max\) : \[\]\)/)
    expect(PAGE, 'لا يحفظ مجال عمله').toMatch(/interests, workField: form\.workField,/)
    /* وسمٌ نصّيٌّ أعلى البطاقة لا قرصٌ يشبه الزرّ — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const tag = ours\.has\(x\.courseId\) \? "نقترحها لك" : fits\(x\) > 0 \? "يناسب ما تريد تطويره" : null;/)
    const card = PAGE.slice(PAGE.indexOf('const row = '), PAGE.indexOf(TOP_CARD))
    expect(card, 'الوسم قرص').not.toMatch(/<Chip/)
    /* وأصغرُ وأهدأُ من العنوان — قرارُه (٢٧ أكتوبر ٢٠٢٦): «كلمة نقترحها لك يجب أن تكون أصغر وبخطٍّ أقلّ أهميّةً للنظر» */
    expect(card, 'الوسم بحجم العنوان أو بلونه').toMatch(/\{tag && <span className="inline-flex items-center gap-1 text-fine text-muted-foreground"><Sparkles className="h-3 w-3 text-gold-ink"/)
    expect(card, 'عاد الوسم عريضا').not.toMatch(/<span className="mb-1 flex flex-wrap items-center gap-x-3 text-read font-bold">/)
    expect(card.indexOf('{tag && <span'), 'الوسم أعلى البطاقة').toBeGreaterThan(-1)
    expect(card.indexOf('{tag && <span'), 'الوسم تحت العنوان').toBeLessThan(card.indexOf('<span className="block font-bold leading-6">{x.titleAr}'))
    expect(PAGE, 'عاد «اخترناها لك» أو «حددنا لك»').not.toMatch(/اخترناها لك|حددنا لك/)
  })

  it('⚠️ «بقي X مقاعد» حين تقل وحدها — والمدرب المنشور اسما في الصف بلا رابط إلى الموقع', () => {
    expect(seatsLeftAr(3)).toBe('بقي 3 مقاعد')
    expect(seatsLeftAr(2)).toBe('بقي مقعدان')
    expect(seatsLeftAr(1)).toBe('بقي مقعد واحد')
    expect(seatsLeftAr(5)).toBe('بقي 5 مقاعد')
    expect(seatsLeftAr(6), 'رقم كبير يقلل القيمة').toBeNull()
    expect(seatsLeftAr(0)).toBeNull()
    expect(seatsLeftAr(null), 'بلا سعة').toBeNull()
    expect(PAGE).toMatch(/const seats = seatsLeftAr\(x\.seatsLeft\);/)
    expect(PAGE).toMatch(/\{seats && <span className="inline-flex items-center gap-1 text-read font-bold text-red-300">/)
    /* وصورةُ المدرّب أوّلُ ما في البطاقة وبكبرها — وبلا صورةٍ مربّعٌ بحجمها فلا تتفاوت البطاقات */
    const card = PAGE.slice(PAGE.indexOf('const row = '), PAGE.indexOf(TOP_CARD))
    expect(card).toMatch(/<img src=\{x\.trainer\.photoUrl\} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover/)
    expect(card).toMatch(/: <span className="grid h-24 w-24 place-items-center rounded-2xl/)
    expect(card.indexOf('x.trainer?.photoUrl'), 'الصورة قبل العنوان').toBeLessThan(card.indexOf('<span className="block font-bold leading-6">{x.titleAr}'))
    expect(card, 'عادت الصورة الصغيرة').not.toMatch(/h-6 w-6 rounded-full/)
    /* والمدرّبُ من الخادم وحدَه — لا اسمَ يُكتب في الصفحة. واسمُه نصٌّ في الصفّ لا رابط: قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦):
       «عند النقر على الدورات لشرائها لا يجب أن تأخذ النقرةُ العميلَ إلى صفحة الموقع» */
    expect(card).toMatch(/\{x\.trainer && <span className="mt-0\.5 block text-read font-bold text-teal-light-ink">مع \{x\.trainer\.name\}<\/span>\}/)
    expect(card, 'عاد رابط إلى صفحة الفريق').not.toContain('/trainers#trainer-')
    expect(card, 'عادت «تفاصيل الدورة» رابطا في الصف').not.toContain('تفاصيل الدورة')
  })

  /* «"تفاصيل الدورة" أريد أن تبدلها بسهمٍ للأسفل، وينسدل نبذةٌ بسيطةٌ عن الدورة: نبذةٌ عنها وأهدافُها ولمن هي» — قرارُه (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ نبذة الدورة تنسدل في صفها — والصف وحده يختار، ولا رابط فيه إلا «المزيد» بطلبه في نافذة جديدة', () => {
    const card = PAGE.slice(PAGE.indexOf('const row = '), PAGE.indexOf(TOP_CARD))
    /* الوسمُ يغلق قبل السهم: فالسهمُ لا يختار، والنبذةُ لا تختار */
    const label = card.slice(card.indexOf('<label className="flex cursor-pointer items-start gap-4">'), card.indexOf('</label>'))
    expect(label, 'الصف لا يختار').toContain('onChange={() => toggle(x.courseId)}')
    expect(label, 'رابط داخل ما يختار').not.toMatch(/<a |<button /)
    const after = card.slice(card.indexOf('</label>'))
    expect(after).toMatch(/<button\s+type="button" aria-expanded=\{open\} aria-controls=\{sumId\} onClick=\{\(\) => setSummaryOf\(open \? null : x\.courseId\)\}/)
    expect(after).toMatch(/\{open \? "إخفاء النبذة" : "نبذة عن الدورة"\}\s*<ChevronDown className=\{`h-4 w-4 transition \$\{open \? "rotate-180" : ""\}`\}/)
    expect(after).toMatch(/\{open && \(\s*<div id=\{sumId\}/)
    expect(after).toMatch(/\{sum\.aboutAr && <p>\{sum\.aboutAr\}<\/p>\}/)
    expect(after).toMatch(/<p className="font-bold">أهدافها<\/p>/)
    expect(after).toMatch(/<span className="font-bold">لمن هي: <\/span>\{sum\.audienceAr\}/)
    /* ورابطٌ واحدٌ في الصفّ كلِّه: «المزيد» داخلَ النبذة، في نافذةٍ جديدة */
    expect(card.match(/<a /g)?.length, 'رابط غير «المزيد» في الصف').toBe(1)
    expect(after).toMatch(/<a href=\{`\/build\/\$\{encodeURIComponent\(x\.courseId\)\}`\} target="_blank" rel="noreferrer"[^>]*>\s*المزيد عن الدورة/)
    expect(PAGE).toMatch(/const \[summaryOf, setSummaryOf\] = useState<string \| null>\(null\);/)
  })

  it('⚠️ والنبذة من نسخة الدورة — وعدها أو وصفها، وثلاثة أهداف، ولمن هي، بلا تشكيل — ولا شيء بلا نص', () => {
    const v = {
      shortPromiseAr: 'تعرِف من تحتاج بعد سنة.', descriptionAr: 'وصف', audienceAr: ' من يوظّف  عند الحاجة. ',
      objectives: [{ textAr: 'أ' }, { textAr: 'ب' }, { textAr: '  ' }, { textAr: 'ج' }, { textAr: 'د' }],
    }
    expect(grantCourseSummary(v)).toEqual({ aboutAr: 'تعرف من تحتاج بعد سنة.', goalsAr: ['أ', 'ب', 'ج'], audienceAr: 'من يوظّف عند الحاجة.' })
    expect(GRANT_SUMMARY_GOALS).toBe(3)
    expect(grantCourseSummary({ ...v, shortPromiseAr: null })?.aboutAr, 'بلا وعد يقال الوصف').toBe('وصف')
    expect(grantCourseSummary({ shortPromiseAr: ' ', descriptionAr: null, audienceAr: '', objectives: [] }), 'سهم بلا نبذة').toBeNull()
    expect(grantCourseSummary(null)).toBeNull()
    expect(PAGE, 'السهم يظهر بلا نبذة').toMatch(/\{sum && \(/)
  })

  it('⚠️ «يحق لك أن تهدي هذه المنحة لأصدقائك» — صندوق وحده خارج لوح الدفع، برسالة جاهزة في واتساب والبريد', () => {
    /* ونصُّها يتباهى بمنحته ويختار صديقَه، بلا رمزٍ تعبيريّ وبرابطٍ قصير — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
    const link = 'https://wajeezacademy.com/s/AB12CD'
    const m = grantShareAr(link, 60, '30 أكتوبر 2026')
    expect(m.split('\n')[0]).toBe('حصلت على منحة حصرية من تطبيق وجيز لأني من قرائه، ويحق لي أن أشاركها مع 3 من أصدقائي، واخترتك منهم.')
    expect(m).toContain('المنحة تصل إلى 60% من سعر دورات مباشرة على Zoom مع مدربين معتمدين، وآخر يوم لها 30 أكتوبر 2026.')
    expect(m.trim().split('\n').at(-1), 'الرابط آخر الرسالة وحده').toBe(link)
    expect(m, 'رمز تعبيري — كان يصل مربعا في واتساب الحاسوب').not.toMatch(/\p{Extended_Pictographic}/u)
    expect(grantShareAr(link, 60, null)).not.toContain('آخر يوم')
    for (const line of m.split('\n')) expect(plainAr(line), line).toBe(line)
    /* وهديّةُ منحة المؤثّرين لا تقول «من تطبيق وجيز» — منحتُها من المؤثّر */
    expect(grantShareAr(link, 45, null, false).split('\n')[0]).toBe('حصلت على منحة من أكاديمية وجيز، ويحق لي أن أشاركها مع 3 من أصدقائي، واخترتك منهم.')
    const mail = grantShareMailto(link, 60, '30 أكتوبر 2026')
    expect(mail.startsWith('mailto:?subject=')).toBe(true)
    expect(decodeURIComponent(mail.split('subject=')[1].split('&')[0])).toBe('اخترتك لتشاركني منحة وجيز')
    expect(decodeURIComponent(mail.split('body=')[1])).toContain(m)
    expect(decodeURIComponent(grantShareMailto(link, 45, null, false).split('subject=')[1].split('&')[0])).toBe('اخترتك لتشاركني منحة أكاديمية وجيز')
    expect(campaignParams('?ch=share').channel, 'وسم القناة لا يقرأ').toBe('share')
    expect(GRANT_SHARE_PATH).toBe('/grant?ch=share')
    /* والحدُّ أعلى يُقال ولا يُحصى — الرابطُ عامّ */
    expect(GRANT_GIFT_MAX).toBe(3)
    expect(GRANT_GIFT_AR).toEqual({ title: 'يحق لك أن تهدي هذه المنحة لأصدقائك', limit: 'بحد أعلى 3 أصدقاء' })
    /* الرابطُ القصيرُ من الخادم إن صنعه، والطويلُ بوسمه إن لم يصنع — ومنحةُ المؤثّرين برابط مؤثّرها */
    expect(PAGE).toMatch(/const sharePath = forInfluencer && creditedCode \? `\$\{INFLUENCER_GRANT_PATH\}\/\$\{creditedCode\}` : GRANT_SHARE_PATH;/)
    expect(PAGE).toMatch(/const shareLink = view\.sharePath \? `https:\/\/\$\{BARE_HOST\}\$\{view\.sharePath\}` : `\$\{window\.location\.origin\}\$\{sharePath\}`;/)
    expect(PAGE).toMatch(/const shareText = grantShareAr\(shareLink, pct, lastDayLong, !forInfluencer\);/)
    expect(PAGE).toMatch(/href=\{waShare\(shareText\)\}/)
    expect(PAGE).toMatch(/href=\{grantShareMailto\(shareLink, pct, lastDayLong, !forInfluencer\)\}/)
    expect(PAGE).toMatch(/import \{ waHref, waShare \} from "@\/application\/site\/whatsapp";/)
    expect(PAGE, 'عاد «ثلاثة أصدقاء»').not.toContain('ثلاثة أصدقاء')
    /* خارجَ لوح الدفع وبعده — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «صندوقُ الإهداء يكون خارجَ صندوق الدفع» */
    const from = PAGE.indexOf('<Card tone="solid" className="sticky')
    const panel = PAGE.slice(from, PAGE.indexOf('</Card>', from))
    expect(panel, 'الزر').toContain('احصل على المنحة')
    expect(panel, 'عادت الهدية في لوح الدفع').not.toMatch(/waShare|grantShareMailto|GRANT_GIFT_AR|أهدها/)
    const gift = PAGE.indexOf('{GRANT_GIFT_AR.title}')
    expect(gift, 'صندوق الهدية').toBeGreaterThan(from + panel.length)
    expect(PAGE.slice(gift)).toMatch(/^\{GRANT_GIFT_AR\.title\}<\/span>\s*<span className="block text-read text-muted-foreground">\{GRANT_GIFT_AR\.limit\}/)
    /* والكودُ ظاهرٌ فوق، والعدّادُ فوق وحدَه — لا يُعادان في اللوح */
    expect(panel, 'عاد سطر الكود في اللوح').not.toMatch(/يوضع تلقائيا|stored\.code/)
    expect(panel, 'عاد العداد في اللوح').not.toContain('GrantCountdown')
    expect(PAGE, 'عاد شرح الكود الطويل').not.toContain('يستعمل مرة واحدة')
    expect(PAGE).toContain('أرسلناه إلى بريدك أيضا.')
    expect(PAGE, 'عادت «ادفع الآن»').not.toContain('ادفع الآن')
    expect(code('src/pages/admin/GrantResults.tsx'), 'نتائج الحملة تسمي قناتها').toMatch(/share: "من صديق"/)
  })

  it('⚠️ لوح الدفع من صفحة المنحة: «تفصيل السعر» مطوي — والمبلغ ظاهر — ومن لم يكتب كوده يقال له ما يصير إليه', () => {
    /* قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «هنا يجب أن يكون تفصيلُ كم كانت الدورة، وبعد المنحة». ثمّ (٢٦ أكتوبر):
       «اجعل تفصيلَ الحساب مطويّا افتراضيّا.. أيُّ حسابٍ تقصد؟» — فطُوي للجميع وسُمّي «تفصيل السعر» */
    const BUY = code('src/components/BuyPanel.tsx')
    expect(PAGE).toMatch(/initialCoupon=\{stored\.code \?\? ""\}\s*grantPayTotal=\{payTotal\}/)
    const fold = BUY.slice(BUY.lastIndexOf('<details', BUY.indexOf('تفصيل السعر')), BUY.indexOf('</details>', BUY.indexOf('تفصيل السعر')))
    expect(fold.match(/<details[^>]*>/)?.[0], 'التفصيل مفتوح افتراضا').toBe('<details className="group">')
    expect(fold, 'التفصيل بلا بند المنحة').toContain('quote.couponDiscount > 0')
    expect(BUY, 'عاد اسم «تفصيل الحساب» — يقرأ حساب المستخدم').not.toContain('تفصيل الحساب')
    expect(BUY.slice(BUY.indexOf('</details>', BUY.indexOf('تفصيل السعر'))), 'المبلغ طوي مع تفصيله').toMatch(/^<\/details>\s*<div[^>]*>\s*<span[^>]*>ما تدفعه الآن<\/span>/)
    expect(BUY).toMatch(/\{grantPayTotal !== undefined && quote && quote\.grantPct === null && !couponError && !nothingLeft && \(/)
    expect(BUY).toContain('اكتب كود منحتك ليصير المبلغ <bdi dir="ltr">{shownGrant}</bdi>. تجده في بريدك.')
    /* بصيغة المجموع نفسِها، وبعملة البطاقة إن بدّلها */
    expect(BUY).toMatch(/const shownGrant = quote && grantPayTotal !== undefined\s*\? usd \? formatPresentment\(convertFromUsd\(grantPayTotal, currency\), currency\) : money\(grantPayTotal, quote\.currency\)/)
    for (const t of ['اكتب كود منحتك ليصير المبلغ', 'تجده في بريدك.']) expect(plainAr(t)).toBe(t)
  })

  it('⚠️ ولا كود يكتب مثالا في خانة الكود — سري نعطيه لمن نريد', () => {
    /* قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «لا تضع داخل الكود مثالا لأنّه سرّي، نعطيه فقط لمن نريد» */
    for (const f of ['src/components/BuyPanel.tsx', 'src/pages/Pathway.tsx']) {
      const holders = code(f).match(/placeholder=(\{[^}]*\}|"[^"]*")/g) ?? []
      expect(holders.filter((h) => /FIRST_TIME_PROMO|WA2026|مثال/.test(h)), f).toEqual([])
    }
    expect(code('src/components/BuyPanel.tsx')).toContain('placeholder="كود الخصم"')
  })

  it('⚠️ المستشار على واتساب مباشرة — برقم موضعه في شاشة الربط، ورسالة فيها اسمه وكوده', () => {
    expect(WHATSAPP_SPOTS.map((s) => s.key)).toContain('grant_advisor')
    expect(PAGE).toMatch(/const advisorHref = waHref\(numbers, "grant_advisor", CONTACT\.whatsapp, grantAdvisorTextAr\(\{/)
    expect(PAGE).toMatch(/<Button as="a" href=\{advisorHref\} target="_blank"/)
    /* من هو وبريدُه وما يريد، ودوراتُه، وكودُه وملفُّه — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «على الأقلّ مرحبا أنا
       اسمي كذا وإيميلي كذا — المعلوماتُ التي تستطيع أخذها من الموقع أضفها» */
    expect(grantAdvisorTextAr({
      name: 'سارة', email: 'sara@x.test', code: 'WG-ABCD2345', courses: ['تحليل البيانات', 'إدارة المشاريع'], recordLink: 'x.test/g/WG-ABCD2345',
    })).toBe(
      'مرحبا، أنا سارة (sara@x.test).\nسجلت في منحة وجيز، وأحتاج مساعدة في اختيار دوراتي.'
      + '\n\nالدورات التي اخترتها:\n1. تحليل البيانات\n2. إدارة المشاريع'
      + '\n\nكود منحتي: WG-ABCD2345\nملفي: x.test/g/WG-ABCD2345',
    )
    /* ومن لم يختر بعدُ ولا كودَ له — ومنحةُ المؤثّرين باسمها */
    expect(grantAdvisorTextAr({ name: 'سارة', grantNameAr: 'منحة مؤثرين وجيز' })).toBe('مرحبا، أنا سارة.\nسجلت في منحة مؤثرين وجيز، وأحتاج مساعدة في اختيار دوراتي.')
    expect(grantAdvisorTextAr({ name: ' ', email: 'sara@x.test' }).split('\n')[0]).toBe('مرحبا، بريدي sara@x.test.')
    expect(PAGE).toMatch(/name: stored\.name, email: stored\.email, code: stored\.code, courses: chosen\.map\(\(x\) => x\.titleAr\),/)
    expect(PAGE).toMatch(/recordLink: grantRecordLink\(BARE_HOST, stored\.code \?\? stored\.ref\), grantNameAr: nameAr,/)
    expect(PAGE, 'عاد الطلب المكتوب').not.toMatch(/\/api\/public\/grant\/advisor|<textarea|اطلب مستشارا/)
  })

  it('⚠️ مكالمة المستشار بعد ساعتين من النموذج — في ساعات العمل بتوقيت عمان، ولا موعد في الماضي', () => {
    const amman = (day: string, h: number, m = 0) => zonedInstant(day, [h, m, 0, 0])
    const D = '2026-11-03'
    expect(grantCallDueAt(amman(D, 10), amman(D, 10)).getTime(), 'ساعتان').toBe(amman(D, 12).getTime())
    expect(grantCallDueAt(amman(D, 18, 59), amman(D, 18, 59)).getTime()).toBe(amman(D, 20, 59).getTime())
    expect(grantCallDueAt(amman(D, 19), amman(D, 19)).getTime(), 'التاسعة مساء خارجها').toBe(amman('2026-11-04', 10).getTime())
    expect(grantCallDueAt(amman(D, 23), amman(D, 23)).getTime(), 'بعد منتصف الليل').toBe(amman('2026-11-04', 10).getTime())
    expect(grantCallDueAt(amman(D, 2), amman(D, 2)).getTime(), 'قبل التاسعة صباحا').toBe(amman(D, 10).getTime())
    expect(grantCallDueAt(amman(D, 10), amman(D, 15)).getTime(), 'فات موعده فالآن').toBe(amman(D, 15).getTime())
    expect(grantCallDueAt(amman('2026-12-31', 22), amman('2026-12-31', 22)).getTime(), 'آخر السنة').toBe(amman('2027-01-01', 10).getTime())
  })

  it('⚠️ عنوان تذكير ما قبل انتهاء المنحة — من الأيام الباقية حقا', () => {
    expect(grantDaysLeftAr(3)).toBe('بقي 3 أيام على منحتك')
    expect(grantDaysLeftAr(2)).toBe('بقي يومان على منحتك')
    expect(grantDaysLeftAr(1)).toBe('اليوم آخر يوم لمنحتك')
    expect(grantDaysLeftAr(0)).toBe('اليوم آخر يوم لمنحتك')
  })

  it('⚠️ دورة واحدة أو أكثر حتى الحد — والزائدة ترد بلا أن تمحو ما اختاره', () => {
    expect(toggleCourse([], 'a', 4)).toEqual(['a'])
    expect(toggleCourse(['a', 'b'], 'a', 4)).toEqual(['b'])
    expect(toggleCourse(['a', 'b', 'c', 'd'], 'e', 4), 'تجاوز الحد').toEqual(['a', 'b', 'c', 'd'])
    expect(toggleCourse(['a', 'b', 'c', 'd'], 'd', 4)).toEqual(['a', 'b', 'c'])
  })

  it('⚠️ ما اخترناه فوق مفتوحا، والباقي أقسام مطوية بمجالها — ما يريد تطويره أولا و«أخرى» آخرا', () => {
    const c = (id: string, domainAr: string | null) => ({ id, domainAr })
    const secs = grantSections([c('a', 'الإدارة'), c('b', 'الموارد البشرية'), c('c', 'الإدارة'), c('d', null), c('e', 'التسويق')], ['التسويق'], 'أخرى')
    expect(secs.map((x) => x.domain), 'ترتيب الأقسام').toEqual(['التسويق', 'الإدارة', 'الموارد البشرية', 'أخرى'])
    expect(secs[1].items.map((x) => x.id)).toEqual(['a', 'c'])
    expect(PAGE).toMatch(/const top = courses\.filter\(\(x\) => ours\.has\(x\.courseId\)\);/)
    expect(PAGE).toMatch(/grantSections\(courses\.filter\(\(x\) => !ours\.has\(x\.courseId\)\), stored\.interests, OTHER_DOMAIN\)/)
    expect(PAGE).toMatch(/\{top\.length > 0 && <div className="mt-5 space-y-3">\{top\.map\(\(x\) => row\(x\)\)\}<\/div>\}/)
    /* وعنوانُ الأقسام بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «دوراتٌ أخرى حسب المجال.. عنوانٌ فاشل» */
    expect(PAGE).toMatch(/\{top\.length > 0 && <p className="mb-1 font-bold">ويمكنك اختيار دورات أخرى من المجالات التالية<\/p>\}/)
    expect(PAGE).not.toContain('دورات أخرى حسب المجال')
    expect(PAGE, 'عاد «كل الدورات المتاحة»').not.toContain('كل الدورات المتاحة')
    expect(PAGE).toMatch(/اختر دوراتك\{view\.termAr && <span className="text-read font-normal text-muted-foreground"> · \{view\.termAr\}<\/span>\}/)
    expect(PAGE, 'الأقسام مطوية بلا فتح').toMatch(/<details key=\{sec\.domain\} className="group py-3 last:pb-0">/)
    expect(PAGE, 'يعيد اسم المجال تحت قسمه').toMatch(/\{sec\.items\.map\(\(x\) => row\(x, true\)\)\}/)
    expect(PAGE).toMatch(/\{x\.domainAr && !inSection \? `\$\{x\.domainAr\} · ` : ""\}/)
    expect(PAGE, 'لا تقول كم اختار في القسم المطوي').toMatch(/mineHere > 0 && <Chip tone="accent">اخترت \{mineHere\}<\/Chip>/)
  })

  /* «أشعر بأنّ التصميمَ سطحيٌّ… لا أزرارا متكدّسة… ادمج كلَّ جزئين… للمنح فقط، لا تغيّره في الموقع» — قرارُه (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ وكل مجالين قسم واحد في صفحة المنحة — بنص صاحب المنصة، وكل عائلة في قسم واحد على الأكثر، والموقع بمجالاته', () => {
    const named = (f: string) => courseDomain(`C-${f}-101`)
    for (const [a, b] of [['FIN', 'FINM'], ['HR', 'JOB'], ['BIZ', 'MGR'], ['MKT', 'COMX']]) {
      expect(grantSectionOf(named(a)), `${a} و${b} قسمان`).toBe(grantSectionOf(named(b)))
      expect(grantSectionOf(named(a)), 'بقي اسم المجال').not.toBe(named(a))
    }
    const fams = GRANT_SECTION_GROUPS.flatMap((g) => g.families)
    expect(new Set(fams).size, 'عائلة في قسمين').toBe(fams.length)
    for (const f of fams) expect(named(f), `${f} ليست عائلة`).not.toBe('أخرى')
    for (const g of GRANT_SECTION_GROUPS) expect(plainAr(g.title)).toBe(g.title)
    expect(grantSectionOf('مجال بلا قسم'), 'ضاع مجال بلا قسم').toBe('مجال بلا قسم')
    /* والأقسامُ بقسمها المدموج، وما يريد تطويرَه يرفع قسمَه */
    const c = (id: string, f: string) => ({ id, domainAr: named(f) })
    const secs = grantSections([c('a', 'MKT'), c('b', 'FIN'), c('c', 'COMX'), c('d', 'FINM'), c('e', 'SVC')], [named('FIN')], 'أخرى')
    expect(secs.map((x) => [x.domain, x.items.map((i) => i.id)])).toEqual([
      [grantSectionOf(named('FIN')), ['b', 'd']],
      [grantSectionOf(named('MKT')), ['a', 'c', 'e']],
    ])
    /* والموقعُ يبقى بمجالاته: لا يقرأ الأقسامَ إلّا صفحةُ المنحة */
    expect(courseDomain('C-FIN-101')).toBe('المال الشخصي والادّخار')
    for (const f of ['src/pages/CoursePath.tsx', 'src/pages/Pathway.tsx', 'src/application/catalog/course-domain.ts']) {
      expect(code(f), `${f} يقرأ أقسام المنحة`).not.toMatch(/grantSectionOf|GRANT_SECTION_GROUPS/)
    }
    /* وبطاقةٌ واحدةٌ هادئة لا أزرارٌ متكدّسة: الأقسامُ صفوفٌ بينها خطوط، وفي رأس كلٍّ وجوهُ مدرّبيه */
    expect(PAGE).toMatch(/<Card className="mt-6">\s*\{top\.length > 0 && <p className="mb-1 font-bold">/)
    expect(PAGE).toMatch(/<div className="divide-y divide-border">\s*\{sections\.map\(/)
    expect(PAGE, 'تكرر وجه المدرب في رأس القسم').toMatch(/const faces = \[\.\.\.new Map\(sec\.items\.filter\(\(x\) => x\.trainer\?\.photoUrl\)\.map\(\(x\) => \[x\.trainer!\.id, x\]\)\)\.values\(\)\]\.slice\(0, SECTION_FACES\);/)
  })

  it('⚠️ عداد انتهاء المنحة — بالأيام، وتحت اليوم بالساعات، وفوق وحده — وآخر يوم بتاريخه', () => {
    const end = '2026-11-01T21:00:00.000Z'
    expect(grantCountdown(end, new Date('2026-10-30T19:58:57.000Z'))).toEqual({ days: 2, hours: 1, minutes: 1, seconds: 3 })
    expect(grantCountdown(end, new Date(end)), 'انتهت').toBeNull()
    expect(grantCountdown(null, new Date())).toBeNull()
    expect([1, 2, 6, 11].map((days) => grantLeftAr({ days, hours: 5 }))).toEqual(['يوم واحد', 'يومين', '6 أيام', '11 يوما'])
    expect([1, 2, 9, 23].map((hours) => grantLeftAr({ days: 0, hours }))).toEqual(['ساعة واحدة', 'ساعتين', '9 ساعات', '23 ساعة'])
    expect(grantLeftAr({ days: 0, hours: 0 })).toBe('أقل من ساعة')
    expect(grantLeftAr(null)).toBeNull()
    expect(PAGE).toMatch(/const left = grantLeftAr\(grantCountdown\(closesAt, now\)\);/)
    expect(PAGE, 'لا ثوان ولا دقائق').toMatch(/setInterval\(\(\) => setNow\(new Date\(\)\), 60_000\)/)
    expect(PAGE).not.toMatch(/"دقيقة"|"ثانية"/)
    expect(PAGE).toContain('تنتهي المنحة بعد {left}')
    expect(PAGE).toContain('آخر يوم: {fmtDateLong(')
    expect(PAGE).toMatch(/\{c\.open && c\.closesAt && <GrantCountdown closesAt=\{c\.closesAt\} className="mt-3" \/>\}/)
    expect(PAGE.match(/<GrantCountdown /g)?.length, 'العداد في النموذج وتحت الكود وحدهما').toBe(2)
  })

  it('⚠️ حد المنحة يقال حدا — «بقي لك دورتان ضمن منحتك» حتى يكتمل', () => {
    expect([0, 2, 3, 4].map((n) => grantRemainingAr(n, 4))).toEqual(['بقي لك 4 دورات ضمن منحتك', 'بقي لك دورتان ضمن منحتك', 'بقيت لك دورة واحدة ضمن منحتك', 'استعملت منحتك كاملة'])
    expect(PAGE).toMatch(/\{grantRemainingAr\(chosen\.length, max\)\}/)
  })

  it('⚠️ ولا عدد للمنح — العداد وآخر يوم وحدهما، والعدد لا يصل الزائر', () => {
    expect(PAGE).toMatch(/\? <GrantCountdown closesAt=\{c\.closesAt\} className="mt-4" \/>\s*: <p className="mt-3"><Chip tone="warn">المنح محدودة<\/Chip><\/p>/)
    expect(PAGE, 'عاد عدد المنح إلى الصفحة').not.toMatch(/\.left\b|بقي \$\{/)
    expect(PAGE).toMatch(/campaign: \{ open: boolean; percentOff: number; maxCourses: number; closesAt: string \| null \};/)
    expect(PAGE).toMatch(/>\{c\.open \? "احجز منحتي الآن" : "سجلني"\}<\/Button>/)
  })

  it('⚠️ قليل هادئ — ثلاث بكلمتين، وأربع خانات بلا شرح تحتها، والاختياري مطوي، وسطر عن الأكاديمية', () => {
    expect(GRANT_GAINS_AR, 'عادت بطاقات ما يحصل عليه').toHaveLength(3)
    expect(PAGE).toMatch(/\{GRANT_GAINS_AR\.map\(\(g\) => \{/)
    expect(PAGE, 'عادت النبذة الطويلة').not.toMatch(/FAMILY_INTRO|grantStepsAr|كيف تعمل المنحة|ماذا تحصل عليه/)
    /* الاختياريّان داخل <details> مطويّ — لا مفتوحَين فوق الزرّ */
    const formAt = PAGE.indexOf('<Card as="form"')
    const folded = PAGE.slice(formAt).match(/<details[^>]*>([\s\S]*?)<\/details>/)
    expect(folded, 'لا طي للاختياري').not.toBeNull()
    expect(folded![1]).toMatch(/value=\{form\.careerLevel\}/)
    expect(folded![1]).toMatch(/toggleCourse\(p, d, GRANT_MAX_INTERESTS\)|pickInterest\(d\)/)
    expect(folded![0].match(/<details[^>]*>/)![0], 'الاختياري مفتوح').not.toMatch(/\bopen\b/)
    /* وخانةٌ لازمةٌ بلا سطر شرحٍ تحتها: الوسمُ يُغلق بعد الحقل مباشرة */
    const form = PAGE.slice(formAt, PAGE.indexOf('<details', formAt))
    expect(form.match(/<span className="text-muted-foreground">/g) ?? [], 'عاد الشرح تحت الخانات').toEqual([])
    expect(PAGE).toMatch(/\{GRANT_ACADEMY_LINE_AR\}/)
  })

  it('⚠️ ما يحفظ على الجهاز يفحص — والعودة إلى مسار المنحة مقبولة', () => {
    const ok = { ref: '11111111-1111-4111-8111-111111111111', code: 'WG-ABCD2345', sentTo: null, name: 'سارة', email: 's@x.co', interests: ['أ'], at: Date.now() }
    expect(parseStoredGrant(JSON.stringify(ok))?.code).toBe('WG-ABCD2345')
    expect(parseStoredGrant(JSON.stringify(ok))?.interests).toEqual(['أ'])
    expect(parseStoredGrant(JSON.stringify({ ...ok, workField: 'الهندسة' }))?.workField).toBe('الهندسة')
    expect(parseStoredGrant(JSON.stringify(ok))?.workField, 'حفظ قبل مجال العمل').toBe('')
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
      GRANT_CONSENT_AR, GRANT_ACADEMY_LINE_AR, ...WORK_FIELDS, ...CAREER_LEVELS, ...GRANT_GAINS_AR.map((g) => g.title),
      GRANT_GIFT_AR.title, GRANT_GIFT_AR.limit, grantLimitAr(4), grantAdvisorTextAr({ name: 'سارة', email: 'a@b.c', code: 'WG-ABCD2345', courses: ['دورة'], recordLink: 'u' }), grantThanksAr(60), grantShareAr('u', 60, '30 أكتوبر'),
    ]
    const onPage = ['احجز منحتي الآن', 'الاسم الكامل', 'رقم الواتساب', 'البريد الإلكتروني', 'مجال عملك', 'مستواك الوظيفي', 'ما الذي تريد تطويره؟',
      'سؤالان اختياريان لنرتب لك الدورات', 'كود منحتك', 'اختر دوراتك',
      'نقترحها لك', 'نقترح لك', 'تناسبك', ' ولا تتعارض مواعيدها', ' اختر منها حتى', 'يناسب ما تريد تطويره', 'تحتاج مساعدة في الاختيار؟', 'مستشارك الخاص يرد عليك مباشرة على واتساب.', 'راسل مستشارك', 'احصل على المنحة', 'برسالة جاهزة ترسلها بضغطة.', 'تنتهي المنحة بعد', 'آخر يوم:', 'ويمكنك اختيار دورات أخرى من المجالات التالية', 'أرسلناه إلى بريدك أيضا.', 'نبذة عن الدورة', 'إخفاء النبذة', 'أهدافها', 'لمن هي: ', 'المزيد عن الدورة']
    for (const t of [...data, ...onPage]) expect(t).toBe(plainAr(t))
    for (const t of onPage) expect(PAGE).toContain(t)
    expect(auditActionAr('coupon.grant_apply')).not.toBe('coupon.grant_apply')
  })

  /* قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «في الصفحات الخاصّة بالمنحة لا تستخدم كلمة عضو، بل مستخدم وجيز»، ثمّ في اليوم نفسِه:
     «بدل عضو.. استخدم قرّاء وجيز بدلا من مستخدم». فما يصل إنسانا من الصفحتين وبريدَيهما ورسائلِهما — الشيفرةُ بلا تعليقاتها،
     والتعليقُ يبقى بتاريخه */
  it('⚠️ لا «عضو» ولا «مستخدم» في نص يصل إنسانا من المنحتين — «قراء وجيز»', () => {
    const files = [
      'src/pages/MemberGrantPage.tsx', 'src/application/commerce/grant-landing.ts', 'src/application/commerce/grant.ts',
      'src/application/site/whatsapp.ts', 'src/components/BuyPanel.tsx',
      'server/services/grant-landing.service.ts', 'server/services/grant-followup.service.ts', 'server/http/routes/public-grant.routes.ts',
    ]
    for (const f of files) {
      const said = code(f).replace(/^\s*\/\/.*$/gm, '')
      expect(said, `${f}: عادت «عضو» أو «مستخدم»`).not.toMatch(/أعضاء|عضو|مستخدم/)
    }
    const all = [grantThanksAr(60), grantShareAr('u', 60, '30 أكتوبر'), grantShareAr('u', 45, '30 أكتوبر', false),
      grantShareMailto('u', 60, '30 أكتوبر'), grantAdvisorTextAr({ name: 'سارة' }), ...WHATSAPP_SPOTS.map((s) => s.labelAr)]
    for (const t of all) expect(t).not.toMatch(/أعضاء|عضو|مستخدم/)
    expect(grantThanksAr(60)).toContain('من قرائه')
    expect(grantShareAr('u', 60, '30 أكتوبر')).toContain('لأني من قرائه')
    expect(code('src/pages/MemberGrantPage.tsx')).toContain('منحة حصرية لقراء وجيز')
  })

  /* «هذا الخصمُ الخاصّ بشراء أوّل دورةٍ تمّ منحُه لدورة كذا الأعلى سعرا، باختصار» — قرارُه (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ سطر كود أول شراء يسمي الدورة باسمها من اللوح — لا «الكود WA2026» ولا عنوان الشعبة', () => {
    const BUY = code('src/components/BuyPanel.tsx')
    const line = BUY.slice(BUY.indexOf('quote.items.some((i) => i.couponApplies === false)'))
    const p = line.slice(0, line.indexOf('</p>'))
    expect(p, 'سطر أول شراء بغير اسمه').toMatch(/quote\.firstPurchasePct \? "خصم أول عملية شراء على الدورة الأعلى سعرا: " : "خصم الكود على: "/)
    expect(p, 'سمى الشعبة لا الدورة').toMatch(/\.map\(\(i\) => lines\.find\(\(l\) => l\.courseId === i\.courseId\)\?\.name \?\? i\.titleAr\)/)
    expect(BUY, 'بند التفصيل يقول «الكود WA2026»').toMatch(/: quote\.firstPurchasePct \? `خصم أول عملية شراء — \$\{quote\.firstPurchasePct\}٪` : `الكود \$\{quote\.couponCode\}`/)
    expect(plainAr('خصم أول عملية شراء على الدورة الأعلى سعرا')).toBe('خصم أول عملية شراء على الدورة الأعلى سعرا')
  })
})
