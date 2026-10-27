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
const RESULTS = code('src/pages/admin/GrantResults.tsx')
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
    expect(PAGE).toMatch(/const api = forInfluencer \? "\/api\/admin\/influencer-grant" : "\/api\/admin\/member-grant";/)
    expect(PAGE).toMatch(/apiGet<\{ rows: MarginRow\[\]; commissionPercent\?: number \}>\(`\$\{api\}\/margins\?percentOff=\$\{pctNum\}`\)/)
    expect(PAGE).toContain('والأكواد التي أعطيت قبله')
  })
})

describe('دورات المنحة', () => {
  it('⚠️ في شاشة المنحة بالنسبة التي في الخانة — وبابها بصلاحية الكوبونات، ولا اقتراحات', () => {
    expect(PAGE).toMatch(/<GrantCourses percentOff=\{pctOk \? pctNum : null\} \/>/)
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
    /* وأفعالُ أثر الاقتراحات باقيةٌ في المعجم: ما كُتب منها قبل الحذف يُقرأ باسمه */
    for (const k of ['coupon.grant_pathway_save', 'coupon.grant_pathway_remove']) expect(auditActionAr(k)).not.toBe(k)
  })
})

describe('نتائج الحملة', () => {
  it('⚠️ في شاشة المنحة — وبابها بصلاحية الكوبونات، ونصوصها بلا تشكيل', () => {
    expect(PAGE).toMatch(/<GrantResults \/>/)
    expect(RESULTS).toMatch(/apiGet<Results>\("\/api\/admin\/member-grant\/results"\)/)
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/member-grant\/results', \{\s*preHandler: canManage/)
    for (const t of ['نتائج الحملة', 'عبأ النموذج', 'أخذ كودا', 'اشترى', 'القناة', 'الدفعة', 'مجالات العمل', 'بلا وسم']) {
      expect(RESULTS).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})

describe('من عبأ النموذج', () => {
  it('⚠️ قائمة بالأسماء في شاشة المنحة — ببحث وزر واتساب ورسالة جاهزة، وبابها بصلاحية الكوبونات', () => {
    expect(PAGE).toMatch(/<GrantRegistrants \/>/)
    expect(REG).toMatch(/\{ api = "\/api\/admin\/member-grant\/registrants" \}/)
    expect(REG).toMatch(/apiGet<Registrant\[\]>\(api\)/)
    expect(REG).toMatch(/<ListToolbar q=\{q\}/)
    expect(REG).toMatch(/const wa = waToPerson\(r\.phone, grantFollowupAr\(r\.fullName\)\)/)
    expect(ROUTES).toMatch(/app\.get\('\/api\/admin\/member-grant\/registrants', \{\s*preHandler: canManage/)
    for (const t of ['من عبأ النموذج', 'اشترى', 'ينتظر الدفع', 'لم يشتر بعد', 'واتساب', grantFollowupAr('سارة')]) {
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
    for (const c of ['grant_closed', 'grant_used', 'grant_once', 'grant_pending', 'grant_not_better', 'grant_max_courses']) {
      expect(GRANT.GRANT_ERROR_CODES as readonly string[]).toContain(c)
    }
  })
})

describe('النصوص', () => {
  it('بلا تشكيل إعرابي', () => {
    const texts = [
      GRANT.MEMBER_GRANT_NAME_AR, GRANT.GRANT_CLOSED_AR, GRANT.GRANT_SOLD_OUT_AR, GRANT.GRANT_USED_AR,
      GRANT.GRANT_ONCE_AR, GRANT.GRANT_PENDING_AR, GRANT.GRANT_NOT_BETTER_AR, GRANT.GRANT_CHECKOUT_ONLY_AR, GRANT.grantMaxCoursesAr(4),
    ]
    for (const t of ['المنحة مشغلة', 'المنحة موقوفة', 'نسبة المنحة %', 'عدد المنح', 'دورات المنحة', 'آخر يوم', 'يبقى للأكاديمية', 'لا قاعدة أتعاب']) {
      expect(PAGE).toContain(t)
      texts.push(t)
    }
    for (const t of texts) expect(t).toBe(plainAr(t))
    for (const k of ['coupon.grant_settings', 'coupon.grant_issue']) {
      expect(auditActionAr(k), `«${k}» بلا عنوان`).not.toBe(k)
    }
  })

  it('وآخر يوم يحفظ يومه كله ويقرأ كما كتب', () => {
    const ends = GRANT.grantClosesAt('2026-11-30')
    expect(new Date(ends).getDate()).toBe(1)
    expect(GRANT.grantLastDay(ends)).toBe('2026-11-30')
  })
})
