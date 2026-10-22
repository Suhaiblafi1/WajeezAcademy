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
  CAREER_LEVELS, GRANT_ACADEMY_LINE_AR, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_INTEREST_DOMAINS, GRANT_SUGGESTED_COURSES, WORK_FIELDS,
  campaignParams, campaignTag, grantCallDueAt, grantDaysLeftAr, grantSavingAr, grantShareAr, leadProfileAr, rankByInterest, seatsLeftAr, suggestCourses, suggestPaths, toggleCourse, workFieldDomains,
} from '@/application/commerce/grant-landing'
import { courseDomain } from '@/application/catalog/course-domain'
import { zonedInstant } from '@/application/trainer/cohort-period'
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

  it('⚠️ قائمة دورات واحدة — كل ما يشترى اليوم، فالجديد يظهر وحده', () => {
    expect(PAGE).toMatch(/const courses = rankByInterest\(view\.openCourses, \(x\) => \(ours\.has\(x\.courseId\) \? 2 \+ suggested\.length - suggested\.indexOf\(x\.courseId\) : fits\(x\)\)\)/)
    expect(PAGE).toMatch(/\{courses\.map\(\(x\) => \{/)
    expect(PAGE).toMatch(/onChange=\{\(\) => toggle\(x\.courseId\)\}/)
    expect(PAGE, 'يوم الشعبة بمنطقة الأكاديمية').toMatch(/cohortDayAr\(x\.startsAt\)/)
    /* ولا «مسار» في نصٍّ يراه — التعليقاتُ منزوعة */
    /* و«مسار» عادت بقرار صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): مسارٌ رئيسيٌّ وبديلٌ من المسارات العامّة — لا
       مجموعاتٌ يُعدّها هو في شاشة المنحة كما كانت (الاقتراحاتُ المحذوفة) */
  })

  it('⚠️ دورات فقط — لا اقتراحات ولا مجموعات، ولكل دورة سعرها قبل المنحة وبعدها', () => {
    expect(PAGE, 'عادت الاقتراحات').not.toMatch(/view\.pathways|\/api\/admin\/member-grant\/pathways|اقتراحات لك|اختر هذه الدورات/)
    expect(PAGE).toMatch(/قبل المنحة <span dir="ltr" className="line-through">\{money\(x\.price\)\}<\/span>/)
    expect(PAGE).toMatch(/بعد المنحة <span dir="ltr">\{money\(grantPrice\(x\.price, pct\)\)\}<\/span>/)
    expect(PAGE).toContain('اختر من دورة إلى {max} دورات تريدها ضمن منحتك. ويمكنك استبدالها لاحقا بدورات أخرى بعد استشارة مستشارك الخاص.')
  })

  it('⚠️ وأنها مباشرة على Zoom — في أول الصفحة، وفيما يحصل عليه، وفوق القائمة، وفي كل دورة', () => {
    expect(PAGE).toContain('دورات مباشرة على Zoom، تختار منها حتى {c.maxCourses}.')
    expect(GRANT_GAINS_AR[0]).toMatchObject({ id: 'live', title: 'لقاءات مباشرة على Zoom' })
    expect(GRANT_GAINS_AR.map((g) => g.id)).toContain('recording')
    expect(PAGE).toContain('كل الدورات مباشرة على Zoom')
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
    expect(PAGE).toMatch(/<Button size="sm" tone="secondary" onClick=\{switchPath\}>/)
    expect(PAGE).toMatch(/setPath\(\{ main: path\.alt, alt: path\.main \}\);/)
  })

  it('⚠️ والصفحة تختارها حين يصير له كود — وما تركه قبل توثيق بريده أولى، ولا تتجاوز الحد', () => {
    const effect = PAGE.slice(PAGE.indexOf('useEffect(() => {\n    if (!view || !stored || seeded) return;'))
    expect(effect.length, 'الاختيار الأول لا ينتظر الكود').toBeGreaterThan(0)
    expect(effect).toMatch(/suggestCourses\(view\.openCourses, stored\.interests, stored\.workField, Math\.min\(GRANT_SUGGESTED_COURSES, max\)\)/)
    expect(effect).toMatch(/setPicked\(resumed \? resumed\.intent\.courseIds\.filter\(\(id\) => open\.has\(id\)\)\.slice\(0, max\) : ours\)/)
    expect(PAGE, 'لا يحفظ مجال عمله').toMatch(/interests, workField: form\.workField,/)
    expect(PAGE).toMatch(/ours\.has\(x\.courseId\)\s*\? <Chip tone="accent" className="mt-1">اخترناها لك<\/Chip>/)
  })

  it('⚠️ «بقي X مقاعد» حين تقل وحدها — والمدرب المنشور وتفاصيل الدورة في نافذة جديدة', () => {
    expect(seatsLeftAr(3)).toBe('بقي 3 مقاعد')
    expect(seatsLeftAr(2)).toBe('بقي مقعدان')
    expect(seatsLeftAr(1)).toBe('بقي مقعد واحد')
    expect(seatsLeftAr(5)).toBe('بقي 5 مقاعد')
    expect(seatsLeftAr(6), 'رقم كبير يقلل القيمة').toBeNull()
    expect(seatsLeftAr(0)).toBeNull()
    expect(seatsLeftAr(null), 'بلا سعة').toBeNull()
    expect(PAGE).toMatch(/\{seatsLeftAr\(x\.seatsLeft\) && <Chip tone="warn"/)
    /* والمدرّبُ من الخادم وحدَه — لا اسمَ يُكتب في الصفحة — وإلى بطاقته في صفحة الفريق */
    expect(PAGE).toMatch(/\{x\.trainer && \(\s*<a href=\{`\/trainers#trainer-\$\{encodeURIComponent\(x\.trainer\.id\)\}`\} target="_blank"/)
    expect(PAGE).toMatch(/<a href=\{`\/build\/\$\{encodeURIComponent\(x\.courseId\)\}`\} target="_blank"[^>]*>تفاصيل الدورة<\/a>/)
  })

  it('⚠️ «أهد منحة لصديق» — رسالة جاهزة برابط المنحة ووسم قناتها، وواتساب من بابه الواحد', () => {
    const m = grantShareAr('https://www.wajeezacademy.com', 60, '2026/10/31')
    expect(m).toContain('https://www.wajeezacademy.com/grant?ch=share')
    expect(m).toContain('بخصم 60%')
    expect(m).toContain('قبل 2026/10/31')
    expect(grantShareAr('https://x.co', 60, null)).not.toContain('قبل')
    expect(campaignParams('?ch=share').channel, 'وسم القناة لا يقرأ').toBe('share')
    expect(PAGE).toMatch(/href=\{waShare\(grantShareAr\(window\.location\.origin, pct, lastDay\)\)\}/)
    expect(PAGE).toMatch(/import \{ waShare \} from "@\/application\/site\/whatsapp";/)
    expect(PAGE).toContain('أهد منحة لصديق')
    expect(code('src/pages/admin/GrantResults.tsx'), 'نتائج الحملة تسمي قناتها').toMatch(/share: "من صديق"/)
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

  it('⚠️ ولا عدد للمنح — «المنح محدودة» وآخر يوم وحدهما، والعدد لا يصل الزائر', () => {
    expect(PAGE).toMatch(/<Chip tone="warn">المنح محدودة\{lastDay \? `، وآخر يوم \$\{lastDay\}` : ""\}<\/Chip>/)
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
    ]
    const onPage = ['احجز منحتي الآن', 'الاسم الكامل', 'رقم الواتساب', 'البريد الإلكتروني', 'مجال عملك', 'مستواك الوظيفي', 'ما الذي تريد تطويره؟',
      'سؤالان اختياريان لنرتب لك الدورات', 'كود منحتك', 'اختر دوراتك',
      'كل الدورات المتاحة', 'كل الدورات مباشرة على Zoom', 'قبل المنحة', 'بعد المنحة', 'اخترناها لك', 'حددنا لك دورات مسار', 'تناسبك.', 'أو مسار', 'بدّل إليه', 'يناسب ما تريد تطويره', 'لست متأكدا؟ تواصل مع مستشار', 'اطلب مستشارا', 'ادفع الآن']
    for (const t of [...data, ...onPage]) expect(t).toBe(plainAr(t))
    for (const t of onPage) expect(PAGE).toContain(t)
    expect(auditActionAr('coupon.grant_apply')).not.toBe('coupon.grant_apply')
  })
})
