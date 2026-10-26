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
  CAREER_LEVELS, GRANT_ACADEMY_LINE_AR, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_GIFT_AR, GRANT_GIFT_MAX, GRANT_INTEREST_DOMAINS, GRANT_SUGGESTED_COURSES, WORK_FIELDS,
  GRANT_VALUE_AR, GRANT_VALUE_PAID_AR, GRANT_FACES_MAX, GRANT_FACES_PHONE, grantTrainerFaces, grantTrainersAr, campaignParams, campaignTag, grantAdvisorTextAr, grantLeftAr, grantLimitAr, grantRemainingAr, grantCallDueAt, grantCountAr, grantCountdown, grantDaysLeftAr, grantSections, grantShareAr, grantShareMailto, leadProfileAr, rankByInterest, seatsLeftAr, suggestCourses, suggestPaths, toggleCourse, workFieldDomains,
} from '@/application/commerce/grant-landing'
import { courseDomain } from '@/application/catalog/course-domain'
import { zonedInstant } from '@/application/trainer/cohort-period'
import { parsePendingCheckout } from '@/application/commerce/pending-checkout'
import { parseStoredGrant } from '@/services/grant-landing'
import { WHATSAPP_SPOTS } from '@/application/site/whatsapp'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
/** صندوقُ الكود أعلى الصفحة الثانية — بدايتُه، تُقطع منها الشيفرةُ في الحرّاس */
const TOP_CARD = '<Card tone="accent" className="grid gap-4'
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
    expect(PAGE).toContain('`لأنك من أعضاء وجيز، منحتك تصل إلى ${c.percentOff}% من سعر دوراتك.`')
    /* وفي منحة المؤثّرين باسم المؤثّر إن جاء برابطه (٢٦ أكتوبر ٢٠٢٦) */
    expect(PAGE).toContain('`بدعوة من ${view.influencer.nameAr}، منحتك تصل إلى ${c.percentOff}% من سعر دوراتك.`')
    expect(code('server/services/grant-landing.service.ts')).toContain('`منحتك تصل إلى ${percentOff}% من سعر الدورات.`')
    expect(code('server/services/grant-followup.service.ts')).toContain('`منحتك تصل إلى ${pct}% من سعر دورات مباشرة على Zoom.`')
    for (const f of ['src/pages/MemberGrantPage.tsx', 'server/services/grant-landing.service.ts', 'server/services/grant-followup.service.ts']) {
      expect(code(f), `${f}: عاد «تدفع …% فقط»`).not.toMatch(/تدفع \$?\{100 - |% فقط من سعر/)
    }
    for (const t of ['لأنك من أعضاء وجيز، منحتك تصل إلى', 'من سعر دوراتك.', 'بدعوة من']) expect(plainAr(t)).toBe(t)
  })

  it('⚠️ وأنها مباشرة على Zoom — في أول الصفحة، وفي الشريط في صندوق الكود، وفي كل دورة', () => {
    expect(PAGE).toContain('دورات مباشرة على Zoom، تختار منها حتى {c.maxCourses}.')
    /* الشريطُ بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): مع مدرّبٍ معتمد، وتطبيقاتٌ عمليّة، ورسالةُ توصية */
    expect(GRANT_GAINS_AR.map((g) => [g.id, g.title])).toEqual([
      ['live', 'لقاءات مباشرة على Zoom مع مدرب معتمد لدينا'],
      ['practice', 'تطبيقات عملية'],
      ['certificate', 'شهادة ورسالة توصية لمن يلتزم'],
    ])
    /* وهو نفسُه في النموذج وفي صندوق الكود أعلى الصفحة الثانية، بعد سطر الحدّ — بدل صندوق Zoom الكبير. قرارُ صاحب المنصّة
       (٢٤ أكتوبر ٢٠٢٦): «ضعهم في الصندوق الأعلى بطريقةٍ مرتّبةٍ مع أيقونات» */
    /* وفي صندوق الكود وحدَه — حُذف من الصفحة الأولى بقراره (٢٥ أكتوبر ٢٠٢٦): «احذفها من الصفحة الأولى» */
    expect(PAGE.match(/<GrantGains\b/g)?.length, 'الشريط في غير صندوق الكود').toBe(1)
    const formAt = PAGE.indexOf('const ready = form.fullName')
    expect(formAt, 'الصفحة الأولى لم توجد').toBeGreaterThan(0)
    expect(PAGE.slice(formAt), 'عاد الشريط إلى الصفحة الأولى').not.toMatch(/GrantGains|GRANT_GAINS_AR/)
    const card = PAGE.slice(PAGE.indexOf(TOP_CARD), PAGE.indexOf('<h2 className="mt-6'))
    expect(card).toMatch(/\{grantLimitAr\(max\)\}<\/p>\}\s*<\/div>\s*<div className="border-t border-border pt-4 sm:border-s sm:border-t-0 sm:ps-8 sm:pt-0"><GrantGains \/><\/div>\s*<\/Card>/)
    /* وصغيرٌ مرتّب — قرارُه (٢٤ أكتوبر ٢٠٢٦): «لم يستغلّ البوكس.. من الممكن أن يكون أصغر وأرتب»: عمودان على الحاسوب،
       والكودُ والعدّادُ والحدُّ في الأوّل، وما يحصل عليه في الثاني. ولا أيقونةُ هديّةٍ وحدَها سطرا */
    expect(card).toMatch(/^<Card tone="accent" className="grid gap-4 sm:grid-cols-\[minmax\(0,1fr\)_auto\] sm:items-center sm:gap-8">\s*<div className="text-center sm:text-start">/)
    expect(card, 'عادت أيقونة الهدية سطرا وحدها').not.toMatch(/<Gift className="mx-auto/)
    expect(card, 'فقرة فارغة حين لا شيء يقال').toMatch(/topNote && <p className="text-read">\{topNote\}<\/p>/)
    const picker = PAGE.slice(PAGE.indexOf('<h2 className="mt-6'), PAGE.indexOf('view.openCourses.length === 0'))
    expect(picker, 'الشريط تحت العنوان لا في الصندوق').not.toContain('GrantGains')
    /* مرتّبٌ: قائمةٌ عموديّةٌ كتلتُها في الوسط، وأيقونةُ كلِّ بندٍ في دائرة */
    const gains = PAGE.slice(PAGE.indexOf('function GrantGains'), PAGE.indexOf('export default function'))
    expect(gains).toMatch(/<ul className=\{`mx-auto grid w-fit gap-2\.5 text-start text-read \$\{className\}`\}>/)
    expect(gains).toMatch(/<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal\/10"><Icon /)
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

  it('⚠️ أربع دورات نختارها له سلفا — ما يريد تطويره، ثم مجال عمله، ثم الأقرب موعدا', () => {
    expect(GRANT_SUGGESTED_COURSES).toBe(4)
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
    expect(PAGE).toMatch(/const ours = found\.main\s*\? found\.main\.courseIds\.slice\(0, max\)\s*: suggestCourses\(/)
    expect(PAGE).toMatch(/setMainPath\(found\.main\);/)
    /* ولا خيارَ «بدّل» إلى البديل — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «لا داعي لخيار بدّل للمسار لأنّه غير مفهوم» */
    expect(PAGE, 'عاد خيار بدّل المسار').not.toMatch(/switchPath|بدّل إليه|أو مسار|\.alt\b/)
  })

  it('⚠️ نقترحها ولا نختارها عنه — وما تركه قبل توثيق بريده يعود مختارا، ولا تتجاوز الحد', () => {
    const effect = PAGE.slice(PAGE.indexOf('useEffect(() => {\n    if (!view || !stored || seeded) return;'))
    expect(effect.length, 'الاختيار الأول لا ينتظر الكود').toBeGreaterThan(0)
    expect(effect).toMatch(/suggestCourses\(view\.openCourses, stored\.interests, stored\.workField, Math\.min\(GRANT_SUGGESTED_COURSES, max\)\)/)
    expect(effect, 'اختارها عنه').toMatch(/setPicked\(resumed \? resumed\.intent\.courseIds\.filter\(\(id\) => open\.has\(id\)\)\.slice\(0, max\) : \[\]\)/)
    expect(PAGE, 'لا يحفظ مجال عمله').toMatch(/interests, workField: form\.workField,/)
    /* وسمٌ نصّيٌّ أعلى البطاقة لا قرصٌ يشبه الزرّ — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const tag = ours\.has\(x\.courseId\) \? "نقترحها لك" : fits\(x\) > 0 \? "يناسب ما تريد تطويره" : null;/)
    const card = PAGE.slice(PAGE.indexOf('const row = '), PAGE.indexOf(TOP_CARD))
    expect(card, 'الوسم قرص').not.toMatch(/<Chip/)
    expect(card.indexOf('{tag && <span'), 'الوسم أعلى البطاقة').toBeGreaterThan(-1)
    expect(card.indexOf('{tag && <span'), 'الوسم تحت العنوان').toBeLessThan(card.indexOf('<span className="block font-bold leading-6">{x.titleAr}'))
    expect(PAGE, 'عاد «اخترناها لك» أو «حددنا لك»').not.toMatch(/اخترناها لك|حددنا لك/)
  })

  it('⚠️ «بقي X مقاعد» حين تقل وحدها — والمدرب المنشور وتفاصيل الدورة في نافذة جديدة', () => {
    expect(seatsLeftAr(3)).toBe('بقي 3 مقاعد')
    expect(seatsLeftAr(2)).toBe('بقي مقعدان')
    expect(seatsLeftAr(1)).toBe('بقي مقعد واحد')
    expect(seatsLeftAr(5)).toBe('بقي 5 مقاعد')
    expect(seatsLeftAr(6), 'رقم كبير يقلل القيمة').toBeNull()
    expect(seatsLeftAr(0)).toBeNull()
    expect(seatsLeftAr(null), 'بلا سعة').toBeNull()
    expect(PAGE).toMatch(/const seats = seatsLeftAr\(x\.seatsLeft\);/)
    expect(PAGE).toMatch(/\{seats && <span className="inline-flex items-center gap-1 text-red-300">/)
    /* وصورةُ المدرّب أوّلُ ما في البطاقة وبكبرها — وبلا صورةٍ مربّعٌ بحجمها فلا تتفاوت البطاقات */
    const card = PAGE.slice(PAGE.indexOf('const row = '), PAGE.indexOf(TOP_CARD))
    expect(card).toMatch(/<img src=\{x\.trainer\.photoUrl\} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover/)
    expect(card).toMatch(/: <span className="grid h-24 w-24 place-items-center rounded-2xl/)
    expect(card.indexOf('x.trainer?.photoUrl'), 'الصورة قبل العنوان').toBeLessThan(card.indexOf('<span className="block font-bold leading-6">{x.titleAr}'))
    expect(card, 'عادت الصورة الصغيرة').not.toMatch(/h-6 w-6 rounded-full/)
    /* والمدرّبُ من الخادم وحدَه — لا اسمَ يُكتب في الصفحة — وإلى بطاقته في صفحة الفريق */
    expect(PAGE).toMatch(/\{x\.trainer && \(\s*<a href=\{`\/trainers#trainer-\$\{encodeURIComponent\(x\.trainer\.id\)\}`\} target="_blank"/)
    expect(PAGE).toMatch(/<a href=\{`\/build\/\$\{encodeURIComponent\(x\.courseId\)\}`\} target="_blank"[^>]*>تفاصيل الدورة<\/a>/)
  })

  it('⚠️ «يحق لك أن تهدي هذه المنحة لأصدقائك» — صندوق وحده خارج لوح الدفع، برسالة جاهزة في واتساب والبريد', () => {
    const m = grantShareAr('https://www.wajeezacademy.com', 60, '30 أكتوبر 2026')
    expect(m.split('\n')[0]).toBe('أهديك منحة من أكاديمية وجيز 🎁')
    expect(m).toContain('تغطي 60% من سعر دورات مباشرة على Zoom، مع مدربين وشهادة لكل دورة.')
    expect(m).toContain('آخر يوم لها: 30 أكتوبر 2026')
    expect(m).toContain('https://www.wajeezacademy.com/grant?ch=share')
    expect(grantShareAr('https://x.co', 60, null)).not.toContain('آخر يوم')
    for (const line of m.split('\n')) expect(plainAr(line), line).toBe(line)
    const mail = grantShareMailto('https://www.wajeezacademy.com', 60, '30 أكتوبر 2026')
    expect(mail.startsWith('mailto:?subject=')).toBe(true)
    expect(decodeURIComponent(mail.split('subject=')[1].split('&')[0])).toBe('أهديك منحة من أكاديمية وجيز')
    expect(decodeURIComponent(mail.split('body=')[1])).toContain(m)
    expect(campaignParams('?ch=share').channel, 'وسم القناة لا يقرأ').toBe('share')
    /* والحدُّ أعلى يُقال ولا يُحصى — الرابطُ عامّ */
    expect(GRANT_GIFT_MAX).toBe(3)
    expect(GRANT_GIFT_AR).toEqual({ title: 'يحق لك أن تهدي هذه المنحة لأصدقائك', limit: 'بحد أعلى 3 أصدقاء' })
    expect(PAGE).toMatch(/const shareText = grantShareAr\(window\.location\.origin, pct, lastDayLong, sharePath\);/)
    /* ومنحةُ المؤثّرين تُهدى برابط مؤثّرها — والأولى بـ`/grant` كما كانت */
    expect(PAGE).toMatch(/const sharePath = forInfluencer && creditedCode \? `\$\{INFLUENCER_GRANT_PATH\}\/\$\{creditedCode\}` : undefined;/)
    expect(grantShareAr('https://x.test', 45, null, '/grant/i/SARA')).toContain('احجز منحتك من هنا: https://x.test/grant/i/SARA')
    expect(PAGE).toMatch(/href=\{waShare\(shareText\)\}/)
    expect(PAGE).toMatch(/href=\{grantShareMailto\(window\.location\.origin, pct, lastDayLong, sharePath\)\}/)
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
    expect(PAGE).toMatch(/const advisorHref = waHref\(numbers, "grant_advisor", CONTACT\.whatsapp, grantAdvisorTextAr\(stored\.name, stored\.code, chosen\.map\(\(x\) => x\.titleAr\), grantRecordLink\(BARE_HOST, stored\.code \?\? stored\.ref\), nameAr\)\);/)
    expect(PAGE).toMatch(/<Button as="a" href=\{advisorHref\} target="_blank"/)
    expect(grantAdvisorTextAr('سارة', 'WG-ABCD2345')).toBe('مرحبا، أنا سارة. عندي سؤال عن منحة وجيز. كود منحتي: WG-ABCD2345')
    expect(grantAdvisorTextAr(' ', null)).toBe('مرحبا، عندي سؤال عن منحة وجيز.')
    /* ومنحةُ المؤثّرين باسمها (٢٦ أكتوبر ٢٠٢٦) */
    expect(grantAdvisorTextAr('سارة', null, [], null, 'منحة مؤثرين وجيز')).toBe('مرحبا، أنا سارة. عندي سؤال عن منحة مؤثرين وجيز.')
    /* والدوراتُ التي اختارها نصّا في الرسالة — فيعرف المستشارُ ما اختاره بلا سؤال */
    expect(grantAdvisorTextAr('سارة', 'WG-ABCD2345', ['تحليل البيانات', 'إدارة المشاريع'])).toBe(
      'مرحبا، أنا سارة. عندي سؤال عن منحة وجيز. كود منحتي: WG-ABCD2345\n\nالدورات التي اخترتها:\n- تحليل البيانات\n- إدارة المشاريع',
    )
    /* ورابطُ ملفّه القصيرُ آخرَها — مع الدورات وبدونها */
    expect(grantAdvisorTextAr('سارة', 'WG-ABCD2345', ['تحليل البيانات'], 'x.test/g/WG-ABCD2345')).toBe(
      'مرحبا، أنا سارة. عندي سؤال عن منحة وجيز. كود منحتي: WG-ABCD2345\n\nالدورات التي اخترتها:\n- تحليل البيانات\n\nرابط ملفي: x.test/g/WG-ABCD2345',
    )
    expect(grantAdvisorTextAr('سارة', null, [], 'x.test/g/u')).toBe('مرحبا، أنا سارة. عندي سؤال عن منحة وجيز.\n\nرابط ملفي: x.test/g/u')
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
    expect(PAGE).toMatch(/\{top\.length > 0 && <p className="mt-6 font-bold">ويمكنك اختيار دورات أخرى من المجالات التالية<\/p>\}/)
    expect(PAGE).not.toContain('دورات أخرى حسب المجال')
    expect(PAGE, 'عاد «كل الدورات المتاحة»').not.toContain('كل الدورات المتاحة')
    expect(PAGE).toMatch(/اختر دوراتك\{view\.termAr && <span className="text-read font-normal text-muted-foreground"> · \{view\.termAr\}<\/span>\}/)
    expect(PAGE, 'الأقسام مطوية بلا فتح').toMatch(/<Inset as="details" key=\{sec\.domain\} className="group">/)
    expect(PAGE, 'يعيد اسم المجال تحت قسمه').toMatch(/\{sec\.items\.map\(\(x\) => row\(x, true\)\)\}/)
    expect(PAGE).toMatch(/\{x\.domainAr && !inSection \? `\$\{x\.domainAr\} · ` : ""\}/)
    expect(PAGE, 'لا تقول كم اختار في القسم المطوي').toMatch(/mineHere > 0 && <Chip tone="accent">اخترت \{mineHere\}<\/Chip>/)
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
    const folded = PAGE.match(/<details[^>]*>([\s\S]*?)<\/details>/)
    expect(folded, 'لا طي للاختياري').not.toBeNull()
    expect(folded![1]).toMatch(/value=\{form\.careerLevel\}/)
    expect(folded![1]).toMatch(/toggleCourse\(p, d, GRANT_MAX_INTERESTS\)|pickInterest\(d\)/)
    expect(PAGE.match(/<details[^>]*>/)![0], 'الاختياري مفتوح').not.toMatch(/\bopen\b/)
    /* وخانةٌ لازمةٌ بلا سطر شرحٍ تحتها: الوسمُ يُغلق بعد الحقل مباشرة */
    const form = PAGE.slice(PAGE.indexOf('<Card as="form"'), PAGE.indexOf('<details'))
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
      GRANT_GIFT_AR.title, GRANT_GIFT_AR.limit, grantLimitAr(4), grantAdvisorTextAr('سارة', 'WG-ABCD2345'), grantAdvisorTextAr('سارة', null, ['دورة'], 'u'),
    ]
    const onPage = ['احجز منحتي الآن', 'الاسم الكامل', 'رقم الواتساب', 'البريد الإلكتروني', 'مجال عملك', 'مستواك الوظيفي', 'ما الذي تريد تطويره؟',
      'سؤالان اختياريان لنرتب لك الدورات', 'كود منحتك', 'اختر دوراتك',
      'نقترحها لك', 'نقترح لك دورات مسار', 'تناسبك.', 'يناسب ما تريد تطويره', 'تحتاج مساعدة في الاختيار؟', 'مستشارك الخاص يرد عليك مباشرة على واتساب.', 'راسل مستشارك', 'احصل على المنحة', 'برسالة جاهزة ترسلها بضغطة.', 'تنتهي المنحة بعد', 'آخر يوم:', 'ويمكنك اختيار دورات أخرى من المجالات التالية', 'أرسلناه إلى بريدك أيضا.', 'تفاصيل الدورة']
    for (const t of [...data, ...onPage]) expect(t).toBe(plainAr(t))
    for (const t of onPage) expect(PAGE).toContain(t)
    expect(auditActionAr('coupon.grant_apply')).not.toBe('coupon.grant_apply')
  })
})
