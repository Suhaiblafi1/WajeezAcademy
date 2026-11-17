/* «منحة أعضاء وجيز» — ما تقوله الشاشات ومن يملك الباب (٢٠ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/commerce/member-grant.test.ts` و`grant-pricing.test.ts`. وهنا: شاشةُ صاحب
   المنصّة بطريقها وبندِها وصلاحيّتها، والحفظُ بتأكيدٍ يقول ما يقع، والهامشُ بالنسبة التي في الخانة؛
   ولوحُ الشراء يسمّي المنحةَ ويقول سببَ ردّها تحت خانة الكود؛ والنصوصُ بلا تشكيل. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { auditActionAr } from '@/application/audit/labels'
import { allSections } from '@/pages/admin/nav-map'
import * as GRANT from '@/application/commerce/grant'
import * as INFLUENCER from '@/application/commerce/influencer'
import { homePathForRoles } from '@/services/auth'
import { grantFollowupAr } from '@/application/commerce/grant-landing'
import { waToPerson } from '@/application/site/whatsapp'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/admin/MemberGrant.tsx')
const APP = code('src/App.tsx')
const ROUTES = code('server/http/routes/admin-grant.routes.ts')
const BUY = code('src/components/BuyPanel.tsx')
const HTTP = code('server/http/app.ts')
const COURSES = code('src/pages/admin/GrantCourses.tsx')
const STATS = code('src/pages/admin/GrantRegistrantStats.tsx')
const REG = code('src/pages/admin/GrantRegistrants.tsx')

describe('شاشة صاحب المنصة', () => {
  it('⚠️ لها طريق وبند في الشريط — بصلاحية الكوبونات', () => {
    expect(APP).toMatch(/<Route path="\/admin\/member-grant" element=\{<AdminMemberGrant \/>\} \/>/)
    const item = allSections.flatMap((s) => s.items).find((i) => i.to === '/admin/member-grant')
    expect(item?.need).toBe('commerce.manage')
    expect(HTTP).toMatch(/registerAdminGrantRoutes\(app, prisma\)/)
    for (const [verb, path] of [['get', '/api/admin/member-grant'], ['put', '/api/admin/member-grant'], ['get', '/api/admin/member-grant/margins']]) {
      expect(ROUTES).toMatch(new RegExp(`app\\.${verb}\\('${path.replace(/\//g, '\\/')}', \\{\\s*preHandler: canManage`))
    }
    expect(ROUTES).toMatch(/const canManage = requirePermission\('commerce\.manage'\)/)
  })

  it('⚠️ الحفظ بتأكيد يقول ما يقع — والهامش بالنسبة التي في الخانة', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setConfirm\(true\)\}>احفظ<\/Button>/)
    expect(PAGE).toMatch(/\{confirm && \(\s*<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void save\(\)\}/)
    /* والشاشةُ نفسُها لمنحة المؤثّرين ببابها (٢٦ أكتوبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const api = forInfluencer \? "\/api\/admin\/influencer-grant" : forOpen \? "\/api\/admin\/open-grant" : forBlackFriday \? "\/api\/admin\/black-friday-grant" : "\/api\/admin\/member-grant";/)
    /* و«منحة وجيز العامة» ببابها هي — إعداداتُها ونتائجُها (١ نوفمبر ٢٠٢٦) */
    expect(ROUTES).toMatch(/app\.put\('\/api\/admin\/open-grant', \{\s*preHandler: canManage/)
    /* والنسبةُ التي في الخانة تُجرَّب في «فحص الهامش» على منحة الصفحة (`GrantMarginCheck`) */
    expect(PAGE).toMatch(/<GrantMarginCheck pageKey=\{GRANT_KIND_SLUG\[grantKind\]\} draftPercent=\{pctOk \? pctNum : null\} \/>/)
    expect(PAGE).toContain('والأكواد التي أعطيت قبله')
  })
})

describe('دورات المنحة', () => {
  it('⚠️ في شاشة المنحة بالنسبة التي في الخانة — وبابها بصلاحية الكوبونات، ولا اقتراحات', () => {
    /* ولكلّ حملةٍ دوراتُها يختارها المدير (١٥ نوفمبر ٢٠٢٦) — فالقائمةُ بحملتها */
    /* واسمُ حملة الصفحة واحدٌ لمن عبّأ ولدوراتها — و«بلاك فرايدي وجيز» رابعتُها (١٥ نوفمبر ٢٠٢٦) */
    expect(PAGE).toMatch(/const grantKind: GrantKind = forInfluencer \? "influencer" : forOpen \? "open" : forBlackFriday \? "blackfriday" : "member";/)
    expect(PAGE).toMatch(/<GrantCourses grant=\{grantKind\} percentOff=\{pctOk \? pctNum : null\} \/>/)
    expect(COURSES).toMatch(/<GrantCourseChoice endpoint=\{`\/api\/admin\/grant-courses\/\$\{grant\}`\}/)
    for (const verb of ['get', 'put']) expect(ROUTES).toMatch(new RegExp(`app\\.${verb}\\('\\/api\\/admin\\/grant-courses\\/:grant', \\{\\s*preHandler: canManage`))
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/member-grant\/open-courses', \{\s*preHandler: canManage/)
    expect(ROUTES, 'عادت أبواب الاقتراحات').not.toMatch(/member-grant\/pathways/)
  })

  it('⚠️ بفصلها وسعرها قبل المنحة وبعدها — ببحث، لا جملة تقول «كل الدورات»', () => {
    expect(COURSES).toMatch(/\.then\(\(r\) => \{ setOpen\(r\.courses\); setTermAr\(r\.termAr\); \}\)/)
    expect(COURSES).toMatch(/<h2 className="[^"]*">دورات المنحة \(\{open\.length\}\)<\/h2>/)
    expect(COURSES).toMatch(/\{shown\.rows\.map\(\(c\) => \(\s*<li key=\{c\.courseId\}/)
    expect(COURSES, 'قائمة تنمو بلا بحث').toMatch(/<ListToolbar q=\{q\} onQ=\{setQ\} onPage=\{setPage\} view=\{shown\}/)
    expect(COURSES).toMatch(/fmtMoney\(grantPrice\(c\.price, percentOff\), c\.currency\)/)
    expect(COURSES, 'يوم الشعبة بمنطقة الأكاديمية').toMatch(/cohortDayAr\(c\.startsAt\)/)
    expect(COURSES, 'عاد الوعد بكل الدورات').not.toContain('يختار من كل الدورات المتاحة')
  })

  it('بلا تشكيل', () => {
    for (const t of ['دورات المنحة', 'كل دورة منشورة لها مدرب منشور وشعبة مفتوحة للتسجيل', 'قبل المنحة', 'بعد المنحة', 'لا دورة متاحة الآن.', 'لا دورة بهذا الاسم.']) {
      expect(COURSES).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    /* واختيارُ الدورات (١٥ نوفمبر ٢٠٢٦): «تلقائي» ظاهرٌ والعودةُ إليه خيار، والتأكيدُ يقول ما يقع — بلا تشكيل */
    const CHOICE = code('src/pages/admin/GrantCourseChoice.tsx')
    for (const t of ['تلقائي: كل الدورات المتاحة', 'أختار الدورات', 'احفظ الدورات', 'الدورة الجديدة لا تظهر حتى تضيفها.',
      'هذه القائمة تختار الدورات التي تظهر في صفحة المنحة. والكود يعمل على أي دورة حتى حده.',
      'والكود يعمل على أي دورة حتى حده، ظهرت في الصفحة أو لم تظهر.', 'اختر دورة واحدة على الأقل، أو اختر التلقائي.']) {
      expect(CHOICE).toContain(t)
      expect(t).toBe(plainAr(t))
    }
    expect(CHOICE).toMatch(/\{confirm && \(\s*<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void save\(\)\}/)
    /* وتحت كلّ دورةٍ مدرّبُ أقرب شعبةٍ ويومُ بدئها (١٥ نوفمبر ٢٠٢٦: «اجعلني أرى اسم المدرب ومتى تبدأ أول شعبة») */
    expect(CHOICE).toMatch(/c\.trainerName \? `المدرب: \$\{c\.trainerName\}`/)
    expect(CHOICE).toMatch(/c\.startsAt && ` · تبدأ أول شعبة \$\{cohortDayAr\(c\.startsAt\)\}`/)
    expect(CHOICE, 'عاد سطر «لا شعبة» — والقائمة ما له شعبة وحده').not.toContain('لا شعبة تشترى الآن، فلا تظهر')
    for (const k of ['coupon.grant_courses', 'influencer.courses']) expect(auditActionAr(k)).not.toBe(k)
    /* وأفعالُ أثر الاقتراحات باقيةٌ في المعجم: ما كُتب منها قبل الحذف يُقرأ باسمه */
    for (const k of ['coupon.grant_pathway_save', 'coupon.grant_pathway_remove']) expect(auditActionAr(k)).not.toBe(k)
  })
})

describe('نتائج الحملة', () => {
  it('⚠️ في إحصاءات من عبأ — بالقناة والدفعة والمبلغ، وتفتح على منحة الشاشة، ونصوصها بلا تشكيل', () => {
    /* صارت «نتائج الحملة» في الإحصاءات فوق القائمة (٢ نوفمبر ٢٠٢٦) — والجدولُ القديمُ وبابُه ذهبا */
    expect(PAGE).toMatch(/<GrantRegistrants grant=\{grantKind\} \/>/)
    expect(PAGE).not.toMatch(/GrantResults/)
    expect(ROUTES).not.toMatch(/grant\/results'/)
    expect(REG).toMatch(/useState<"" \| keyof typeof GRANT_AR>\(fromLink \? "" : pageGrant\)/)
    expect(STATS).toMatch(/<Bars title="القناة والدفعة" items=\{s\.byLink\} \/>/)
    expect(STATS).toMatch(/<Tile label="المبلغ" value=\{fmtMoney\(s\.revenue, "USD"\)\}/)
    for (const t of ['القناة والدفعة', 'المبلغ', 'طلب مدفوع', 'بلا وسم', 'هدية من صديق']) expect(t).toBe(plainAr(t))
  })
})

/* ═══ الإحصاءاتُ لمنحة الصفحة أو للمنح كلّها (٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «الإحصاءاتُ يجب أن تكون لكلّ المنح أو المنحةِ المفعّلة بالصفحة». فالأرقامُ والقِمعُ بالنطاق نفسِه،
   ويُختار بزرّين فوق الإحصاءات — وفي الصفحات الثلاث، منحةُ المؤثرين معها. */
describe('نطاق الإحصاءات', () => {
  it('⚠️ القمع بمنحة الإحصاءات لا بالمنح كلها دائما', () => {
    expect(REG).toMatch(/const funnel = grant \? data\.funnels\[grant\] : data\.funnel;/)
    expect(REG).toMatch(/<GrantRegistrantStats s=\{stats\} scopeAr=\{scopeAr\} allGrants=\{!grant\} filtered=\{narrowed\} funnel=\{funnel\} \/>/)
    expect(REG, 'القمع للمنح كلها في كل صفحة').not.toMatch(/funnel=\{data\.funnel\}/)
  })

  it('⚠️ وزران فوقها: منحة الصفحة وكل المنح — والعنوان يسمي النطاق', () => {
    expect(REG).toMatch(/onClick=\{\(\) => \{ setGrant\(pageGrant\); reset\(\); \}\}/)
    expect(REG).toMatch(/onClick=\{\(\) => \{ setGrant\(""\); reset\(\); \}\}>\s*كل المنح/)
    expect(STATS).toMatch(/الإحصاءات — \{scopeAr\}/)
    expect(STATS, 'توزيع المنح في منحة واحدة').toMatch(/\{allGrants && <Tile label="منحة وجيز"/)
  })

  it('⚠️ ومنحة المؤثرين لها إحصاءاتها', () => {
    expect(PAGE).toMatch(/<GrantRegistrants grant=\{grantKind\} \/>/)
    expect(PAGE).toMatch(/const grantKind: GrantKind = forInfluencer \? "influencer"/)
  })
})

describe('من عبأ النموذج', () => {
  it('⚠️ قائمة بالأسماء في شاشة المنحة — ببحث وزر واتساب ورسالة جاهزة، وبابها بصلاحية الكوبونات', () => {
    expect(PAGE).toMatch(/<GrantRegistrants grant=/)
    expect(REG).toMatch(/apiGet<List>\("\/api\/admin\/member-grant\/registrants"\)/)
    expect(REG).toMatch(/<ListToolbar q=\{q\}/)
    /* وباسم منحته كلّها — «بلاك فرايدي وجيز» رابعتُها (١٥ نوفمبر ٢٠٢٦) */
    expect(REG).toMatch(/const wa = waToPerson\(r\.phone, grantFollowupAr\(r\.fullName, r\.grant === "member" \? undefined : GRANT_CAMPAIGNS\[GRANT_KIND_SLUG\[r\.grant\]\]\.nameAr\)\)/)
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/member-grant\/registrants', \{\s*preHandler: canManage/)
    /* ومتابعُ المؤثّر قناتُه كودُ مؤثّره نفسُه — فلا يُعاد في «المصدر» بعد «كود …» (٢٨ أكتوبر ٢٠٢٦). وصار العمودُ «المصدر»
       (٣١ أكتوبر ٢٠٢٦)، وحارسُه على السلوك في `grant-registrants.test.ts` */
    expect(REG).toMatch(/<span className="font-bold">\{r\.source\.labelAr\}<\/span>/)
    for (const t of ['من عبأ النموذج', 'اشترى', 'ينتظر الدفع', 'لم يشتر بعد', 'واتساب', grantFollowupAr('سارة'), grantFollowupAr('سارة', GRANT.INFLUENCER_GRANT_NAME_AR), 'منحة المؤثرين']) {
      expect(t).toBe(plainAr(t))
    }
  })

  it('⚠️ رابط واتساب بمفتاح دولي أو جوال أردني — ولا يخمن مفتاحا لغيره', () => {
    expect(waToPerson('+962791234567', 'x')).toBe('https://wa.me/962791234567?text=x')
    expect(waToPerson('00966501234567', 'x')).toBe('https://wa.me/966501234567?text=x')
    expect(waToPerson('0791234567', 'x')).toBe('https://wa.me/962791234567?text=x')
    expect(waToPerson('0501234567', 'x'), 'خمن مفتاح بلد لرقم محلي غير أردني').toBeNull()
    expect(waToPerson(null, 'x')).toBeNull()
  })
})

describe('لوح الشراء', () => {
  it('⚠️ يسمي المنحة باسمها — ويقول سبب ردها تحت خانة الكود', () => {
    expect(BUY).toMatch(/quote\.grantPct !== null \? `\$\{quote\.grantNameAr \?\? MEMBER_GRANT_NAME_AR\} — \$\{quote\.grantPct\}٪`/)
    expect(BUY).toMatch(/new Set\(\[[^\]]*\.\.\.GRANT_ERROR_CODES\]\)/)
    for (const c of ['grant_closed', 'grant_used', 'grant_once', 'grant_not_better', 'grant_max_courses']) {
      expect(GRANT.GRANT_ERROR_CODES as readonly string[]).toContain(c)
    }
  })
})

/* بلاغُ المراجعة (٤ نوفمبر ٢٠٢٦): كودُ صفحة المنحة كان يغلب كودَ حسابه — فإن رُدّ («منحة واحدة لكل متعلم») عُرض عليه الدفعُ
   بلا منحة، وكودُه الذي اشترى به باقٍ بدوراته */
describe('لوح الشراء · كود الصفحة المردود', () => {
  it('⚠️ يسأل عن كود حسابه ولو فتح بكود الصفحة', () => {
    const effect = BUY.match(/useEffect\(\(\) => \{[^]*?fetchMyGrant\(\)/)?.[0] ?? ''
    expect(effect, 'لا سؤال عن كود الحساب').not.toBe('')
    expect(effect, 'لا يسأل حين يفتح بكود الصفحة').not.toMatch(/if \(initialCoupon\) return/)
  })

  it('⚠️ وإن رد كود الصفحة لسبب في المنحة جرب كود حسابه قبل أن يقال السبب', () => {
    const handler = BUY.match(/COUPON_ERRORS\.has\(e\.code\)\) \{[^]*?setCouponError\(e\.message\)/)?.[0] ?? ''
    expect(handler, 'لا يجرب كود الحساب').toMatch(/GRANT_OWN_ERRORS\.has\(e\.code\) && fallback[^]*?setApplied\(fallback\)[^]*?return;/)
    expect(BUY).toMatch(/GRANT_OWN_ERRORS[^=]*= new Set\(\["grant_once", "grant_used", "grant_closed"\]\)/)
  })
})

describe('النصوص', () => {
  it('بلا تشكيل إعرابي', () => {
    const texts = [
      GRANT.MEMBER_GRANT_NAME_AR, GRANT.GRANT_CLOSED_AR, GRANT.GRANT_SOLD_OUT_AR, GRANT.grantUsedUpAr(4),
      GRANT.GRANT_ONCE_AR, GRANT.GRANT_NOT_BETTER_AR, GRANT.GRANT_CHECKOUT_ONLY_AR, GRANT.grantMaxCoursesAr(4),
      GRANT.grantCoursesLeftAr(1), GRANT.grantCoursesLeftAr(2), GRANT.grantCoursesLeftAr(3),
    ]
    for (const t of ['المنحة مشغلة', 'المنحة موقوفة', 'نسبة المنحة %', 'عدد المنح', 'دورات المنحة', 'آخر يوم', 'يبقى للأكاديمية', 'لا قاعدة أتعاب']) {
      expect(PAGE + code('src/pages/admin/GrantMarginCheck.tsx')).toContain(t)
      texts.push(t)
    }
    for (const t of texts) expect(t).toBe(plainAr(t))
    for (const k of ['coupon.grant_settings', 'coupon.grant_issue']) {
      expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
    }
  })

  it('وآخر يوم يحفظ يومه كله ويقرأ كما كتب', () => {
    const ends = GRANT.grantClosesAt('2026-11-30')
    expect(GRANT.grantLastDay(ends)).toBe('2026-11-30')
  })

  /* كانت النهايةُ بتوقيت جهاز من يحفظ — فمن حفظ النسبةَ من جهازٍ بتوقيت الإمارات نقل نهايةَ ٣٠ أكتوبر إلى ٣١ */
  it('⚠️ وبتوقيت عمّان أينما كان الجهاز — نهاية 30 أكتوبر كما هي في القاعدة', () => {
    expect(GRANT.grantClosesAt('2026-10-30')).toBe('2026-10-30T21:00:00.000Z')
    expect(GRANT.grantLastDay('2026-10-30T21:00:00.000Z')).toBe('2026-10-30')
    /* وآخرُ السنة يعبر إلى أوّل التالية */
    expect(GRANT.grantClosesAt('2026-12-31')).toBe('2026-12-31T21:00:00.000Z')
    expect(GRANT.grantLastDay(GRANT.grantClosesAt('2026-12-31'))).toBe('2026-12-31')
    /* ولا تقرأ الدالتان توقيتَ الجهاز */
    const src = readFileSync(join(root, 'src/application/commerce/grant.ts'), 'utf8')
    const fns = src.slice(src.indexOf('export function grantClosesAt'))
    expect(fns.slice(0, fns.indexOf('\n}\n', fns.indexOf('export function grantLastDay'))), 'عاد توقيت الجهاز').not.toMatch(/getDate\(|getFullYear\(|getMonth\(|T00:00:00`/)
  })
})

/* ═══ «بلاك فرايدي وجيز» وخصمُ كلّ مؤثّرٍ وكودُه (١٥ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «اسمح لي تغيير الكود هناك وقيمة الخصم للمؤثر كلا على حدا». فشاشتُها بطريقها وبندها وبابها، والمؤثّرون
   تحتها بخصمِ كلٍّ وكودِه ورابطَيه. والسلوكُ في `server/tests/commerce/black-friday-grant.test.ts`. */
describe('بلاك فرايدي وجيز ومؤثروها', () => {
  const INF_ROUTES = code('server/http/routes/influencer.routes.ts')
  const PANEL = code('src/pages/admin/InfluencersPanel.tsx')

  it('⚠️ لها طريق وبند وباب بصلاحية الكوبونات — وإعداداتها كأخواتها، والمؤثرون في صفحتهم لا هنا', () => {
    expect(APP).toMatch(/<Route path="\/admin\/black-friday-grant" element=\{<AdminMemberGrant variant="blackfriday" \/>\} \/>/)
    const item = allSections.flatMap((s) => s.items).find((i) => i.to === '/admin/black-friday-grant')
    expect(item?.need).toBe('commerce.manage')
    expect(INF_ROUTES).toMatch(/\['\/api\/admin\/black-friday-grant', new GrantService\(prisma, BLACK_FRIDAY_GRANT_SLUG\), 'بلاك فرايدي وجيز'\]/)
    expect(INF_ROUTES).toMatch(/app\.put\(path, \{\s*preHandler: canManage/)
    expect(INF_ROUTES).toMatch(/const canManage = requirePermission\('commerce\.manage'\)/)
    /* والمؤثّرون في صفحتهم وحدَها — لا في بلاك فرايدي (١٦ نوفمبر ٢٠٢٦: «احذف المؤثرين من صفحة منحة بلاك فرايدي») */
    expect(PAGE).toMatch(/\{forInfluencer && <InfluencersPanel \/>\}/)
    expect(PAGE, 'عاد لوح المؤثرين إلى صفحة بلاك فرايدي').not.toMatch(/forBlackFriday\) && <InfluencersPanel/)
    expect(GRANT.BLACK_FRIDAY_GRANT_DEFAULTS).toEqual({ percentOff: 70, maxCodes: 1000, maxCourses: 4 })
  })

  it('⚠️ لكل مؤثر رابطه وخصمه وآخر يومه وكوده — والكود بسطر يقول إن الرابط القديم يعمل، والخصم على ما بعد الحفظ', () => {
    expect(PANEL).toMatch(/<bdi dir="ltr">\{x\.links\.influencer\}<\/bdi>/)
    /* ورابطُ «بلاك فرايدي» خرج من صفّه (١٧ نوفمبر ٢٠٢٦): صارت منحةً للجميع لا تقرأ كودَ مؤثّر (١٦ نوفمبر ٢٠٢٦، `grant-merge.service.ts`)،
       فكان يوحي بأنّه يُحسب له وهو لا يُحسب */
    expect(PANEL, 'عاد رابط بلاك فرايدي إلى صف المؤثر').not.toMatch(/x\.links\.blackFriday/)
    /* وآخرُ يومٍ لمتابعيه — يغلب نهايةَ المنحة له وحدَه (١٧ نوفمبر ٢٠٢٦، `influencerClosesAt`) */
    expect(PANEL).toMatch(/apiPatch\(`\/api\/admin\/influencers\/\$\{x\.id\}`, \{ closesAt: lastDay \? grantClosesAt\(lastDay\) : null \}\)/)
    expect(INF_ROUTES).toMatch(/closesAt: z\.coerce\.date\(\)\.nullable\(\)\.optional\(\),/)
    expect(PANEL).toMatch(/apiPatch\(`\/api\/admin\/influencers\/\$\{x\.id\}`, \{ percentOff: discountNum \?\? null \}\)/)
    expect(PANEL).toMatch(/apiPatch\(`\/api\/admin\/influencers\/\$\{x\.id\}`, \{ code: codeNorm \}\)/)
    expect(PANEL).toMatch(/: INFLUENCER_CODE_KEEPS_AR\}<\/p>/)
    expect(INF_ROUTES).toMatch(/percentOff: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)\.nullable\(\)\.optional\(\),[\s\S]{0,200}?code: z\.string\(\)/)
    const texts = [
      INFLUENCER.INFLUENCER_CODE_KEEPS_AR, INFLUENCER.INFLUENCER_DISCOUNT_BAD_AR, 'خصم متابعيه %', 'احفظ الخصم', 'غير الكود',
      'فارغ يعني نسبة المنحة. والخصم الجديد على من يأخذ كودا بعد الحفظ فقط.', 'نسبة المنحة',
      'آخر يوم لمتابعيه', 'احفظ آخر يوم', 'نهاية المنحة',
    ]
    for (const t of texts.slice(2)) expect(PANEL).toContain(t)
    for (const t of texts) expect(t).toBe(plainAr(t))
    for (const k of ['influencer.discount.set', 'influencer.code.change', 'influencer.closes.set']) expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
  })
})

/* ═══ تفاصيلُ المؤثّر كلُّها تتغيّر (١٥ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «منحني فرصة تغيير اسم صاحب المنحة المؤثر وتغيير كل التفاصيل، إيميله، رقمه». فاسمُه ورقمُه وبريدُه في تفاصيله
   بتأكيدٍ يقول ما يقع، ودعوتُه تُعاد لمن لم يفعّل. والسلوكُ في `server/tests/commerce/influencer-contact.test.ts`. */
describe('تفاصيل المؤثر تتغير', () => {
  const INF_ROUTES = code('server/http/routes/influencer.routes.ts')
  const PANEL = code('src/pages/admin/InfluencersPanel.tsx')

  it('⚠️ اسمه ورقمه وبريده بتأكيد، ودعوته تعاد — وأبوابها بصلاحية الكوبونات', () => {
    expect(PANEL).toMatch(/apiPatch\(`\/api\/admin\/influencers\/\$\{x\.id\}`, \{ nameAr: nameNew \}\)/)
    expect(PANEL).toMatch(/apiPatch\(`\/api\/admin\/influencers\/\$\{x\.id\}`, \{ phone: phoneNew \?\? null \}\)/)
    expect(PANEL).toMatch(/apiPost<Connected>\(`\/api\/admin\/influencers\/\$\{x\.id\}\/account`, \{ email: emailNew \}\), connectedAr,/)
    expect(PANEL).toMatch(/\{x\.accountStatus === "invited" && \(\s*<Button[\s\S]{0,200}\/resend-invite`/)
    for (const c of ['"name"', '"phone"', '"email"']) expect(PANEL, `${c} بلا تأكيد`).toMatch(new RegExp(`\\{confirm === ${c} && \\(\\s*<ConfirmAction`))
    /* والبريدُ القديمُ لا يُسدّ بابُه: «غير البريد» حيث كان «أنشئ حسابه أو اربطه» وحدَه لمن لا حساب له */
    expect(PANEL).toContain('{x.email ? "غير البريد" : "أنشئ حسابه أو اربطه"}')
    expect(INF_ROUTES).toMatch(/app\.post\('\/api\/admin\/influencers\/:id\/resend-invite', \{\s*preHandler: canManage/)
    expect(INF_ROUTES).toMatch(/return influencers\.connectAccount\(id\.parse\(req\.params\)\.id, email, req\.auth!\.userId\)/)
    expect(INF_ROUTES).toMatch(/phone: z\.string\(\)\.trim\(\)\.max\(40\)\.nullable\(\)\.optional\(\),\s*active: z\.boolean\(\)/)
  })

  it('⚠️ الرقم بشكله أو فارغ — ونصوصها بلا تشكيل، وأفعال أثرها بعناوين', () => {
    expect(INFLUENCER.cleanInfluencerPhone('  +962  79 123-4567 ')).toBe('+962 79 123-4567')
    expect(INFLUENCER.cleanInfluencerPhone('')).toBeNull()
    expect(INFLUENCER.cleanInfluencerPhone(null)).toBeNull()
    for (const bad of ['abc', '12345', '+962 79 12a', '1'.repeat(21), '962+79']) expect(INFLUENCER.cleanInfluencerPhone(bad), bad).toBeUndefined()
    const texts = [
      INFLUENCER.INFLUENCER_PHONE_BAD_AR, 'الاسم', 'احفظ الاسم', 'رقمه', 'احفظ الرقم', 'غير البريد', 'أعد إرسال الدعوة',
      'تغيير اسم المؤثر', 'تغيير رقم المؤثر', 'تغيير بريد المؤثر', 'ربط حساب المؤثر', 'يمحى رقمه.',
      'لم يفعل حسابه بعد. الدعوة الجديدة تصله مع كوده، وتبطل القديمة.',
      'ويصل البريد الجديد رسالة بكوده: دعوة لتفعيل حسابه إن كان جديدا، أو دخول بحسابه إن كان له حساب.',
    ]
    for (const t of texts.slice(1)) expect(PANEL).toContain(t)
    for (const t of texts) expect(t).toBe(plainAr(t))
    for (const k of ['influencer.account', 'influencer.invite.resend']) expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
  })

  /* وسؤالُ صاحب المنصّة: يُربط حسابُه مؤثّرا (SUHAIB) ويبقى بابُه الإدارة — الدورُ الأعلى أوّلا */
  it('⚠️ مدير المنصة مؤثرا يبقى بابه الإدارة', () => {
    expect(homePathForRoles(['influencer', 'super_admin'])).toBe('/admin')
    expect(homePathForRoles(['learner', 'influencer'])).toBe('/influencer')
  })
})

/* ═══ «فحص الهامش» لأيّ منحة — يُختار فوق جدوله (١٦ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «أريد فوق هذا الجدول أن أختار المنحةَ التي أرى جدولَها، خاصّةً للمؤثّرين والشركاء.. ولا حاجةَ
   للجدول الذي وضعتَه في رأس الصفحة». والسلوكُ في `server/tests/commerce/grant-margin-picker.test.ts`. */
describe('فحص الهامش باختيار المنحة', () => {
  const CHECK = code('src/pages/admin/GrantMarginCheck.tsx')
  const PARTNERS = code('src/pages/admin/PartnerGrants.tsx')

  it('⚠️ لا لوح هامش في رأس صفحات المنح — تحت روابط المنح إعداداتها مباشرة', () => {
    expect(PAGE).toMatch(/<GrantSwitcher current=\{variant\} \/>\s*<Card/)
    expect(PARTNERS).toMatch(/<GrantSwitcher current="partners" \/>\s*<Card>/)
    expect(PAGE + PARTNERS, 'عاد لوح الهامش في كل المنح').not.toMatch(/GrantMarginsSummary|margins-summary/)
  })

  it('⚠️ فوق الجدول اختيار: المنح ثم المؤثرون ثم الشركاء — يبدأ بمنحة الصفحة، والشريك بشريكه', () => {
    expect(CHECK).toMatch(/<h2[^>]*>فحص الهامش[\s\S]*?<select value=\{key\} onChange=\{\(e\) => setKey\(e\.target\.value\)\}[\s\S]*?<table/)
    expect(CHECK).toMatch(/\{ group: "campaign", labelAr: "المنح" \},\s*\{ group: "influencer", labelAr: "المؤثرون" \},\s*\{ group: "partner", labelAr: "الشركاء" \}/)
    expect(CHECK).toMatch(/<optgroup key=\{group\} label=\{labelAr\}>/)
    expect(CHECK).toMatch(/useState\(pageKey \?\? ""\)/)
    expect(CHECK).toMatch(/apiGet<\{ options: MarginOption\[\] \}>\("\/api\/admin\/grants\/margin-options"\)/)
    expect(CHECK).toMatch(/apiGet<Margins>\(`\/api\/admin\/grants\/margins\?\$\{q\}`\)/)
    /* والنسبةُ التي في الخانة على منحة الصفحة وحدَها */
    expect(CHECK).toMatch(/const tryPct = ownPage \? draftPercent \?\? null : null;/)
    expect(PARTNERS).toMatch(/<GrantMarginCheck key=\{current\.id\} pageKey=\{partnerCampaignSlug\(current\.slug\)\} \/>/)
    for (const path of ['/api/admin/grants/margin-options', '/api/admin/grants/margins']) {
      expect(ROUTES).toMatch(new RegExp(`app\\.get\\('${path.replace(/\//g, '\\/')}', \\{\\s*preHandler: canManage`))
    }
  })

  it('⚠️ عمود المؤثر حين عمولة، وعمود الشريك حين حصة — والنصوص بلا تشكيل', () => {
    expect(CHECK).toMatch(/\{commission && <th className="p-2 text-start">للمؤثر<\/th>\}/)
    expect(CHECK).toMatch(/\{share && <th className="p-2 text-start">للشريك<\/th>\}/)
    for (const t of ['المنحة', 'المنح', 'المؤثرون', 'الشركاء', 'للمؤثر', 'للشريك', 'يبقى للأكاديمية', 'تعذر حساب الهامش الآن.', ' · موقوفة']) {
      expect(CHECK).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})
