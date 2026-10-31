/* «انضم كمؤثر» وطابورُه، والدفعةُ الزائدةُ على الرصيد (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: رابطٌ لاتّفاق المؤثّر — كيف يفعّل حسابه، وما يجد فيه، والاتّفاقُ الماليّ لكلّ فصل — ومنه يتقدّم
   فيظهر في قائمة المتقدّمين. والخادمُ يحرسه `server/tests/commerce/influencer-applications.test.ts`؛ وهنا:

   ① البابُ في التذييل بجانب «انضم كمستشار»، وفي خريطة الموقع، والصفحةُ في الموجّه.
   ② والأرقامُ من الخادم لا من الصفحة: بابُ الاتّفاق هو ما يسجّله الخادم، والنصوصُ تُبنى من الأرقام التي تصلها،
      ولا رقمَ نسبةٍ مكتوبٌ في الصفحة.
   ③ والنموذجُ يسأل عن الحسابات بمتابعيها، ولا يُرسل بلا قبول الاتّفاق، والفخُّ في الحمولة.
   ④ والطابورُ في «منحة مؤثرين وجيز»، الأوسعُ وصولا أوّلا، والقبولُ بكودٍ مطبَّعٍ وعمولةٍ تبدأ بالمقترحة ومن نافذته وحدَها.
   ⑤ والدفعةُ الزائدةُ على الرصيد تُعرض بخيارَيها: «سجلها سلفة» و«عدل المبلغ».
   ⑥ ونصوصُها بلا تشكيل. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INFLUENCER_DEAL_PATH, byReach, influencerExampleAr, influencerTermsAr, influencerWhatAr, suggestInfluencerCode,
} from '@/application/commerce/influencer-application'
import { PUBLIC_PAGES } from '@/application/site/public-pages'
import ts from 'typescript'
import { markedTexts } from '../helpers/marked-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق نصٌّ في شرح */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const PAGE = code('src/pages/JoinInfluencer.tsx')
const QUEUE = code('src/pages/admin/InfluencerApplications.tsx')
const PANEL = code('src/pages/admin/InfluencersPanel.tsx')

/** نصوصُ الملفّ كما يراها إنسان — النصُّ والقالبُ ونصُّ JSX، لا التعليقاتُ ولا الأرقامُ في الشيفرة */
function textsOf(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text)
    else if (ts.isTemplateExpression(n)) out.push(n.head.text, ...n.templateSpans.map((x) => x.literal.text))
    else if (ts.isJsxText(n)) out.push(n.text)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  /* وما فيه حرفٌ عربيّ وحدَه — لا أسماءُ الأصناف (`bg-teal/15`) ولا المسارات */
  return out.filter((t) => /[\u0600-\u06FF]/.test(t))
}

describe('① الباب', () => {
  it('⚠️ «انضم كمؤثر» في التذييل بجانب «انضم كمستشار»، وفي خريطة الموقع، والصفحة في الموجه', () => {
    expect(code('src/components/SiteFooter.tsx')).toMatch(
      /\{ label: 'انضم كمستشار', to: '\/join-advisor' \},\s*\{ label: 'انضم كمؤثر', to: '\/join-influencer' \}/,
    )
    expect(PUBLIC_PAGES.find((p) => p.path === '/join-influencer')?.title).toBe('انضم كمؤثر')
    expect(code('src/App.tsx')).toMatch(/<Route path="\/join-influencer" element=\{<JoinInfluencer \/>\} \/>/)
  })
})

describe('② الأرقام من الخادم', () => {
  it('⚠️ الصفحة تقرأ باب الاتفاق — وهو الباب الذي يسجله الخادم بإعدادات المنحة', () => {
    expect(PAGE).toMatch(/apiGet<InfluencerDealView>\(INFLUENCER_DEAL_PATH\)\.then\(setDeal\)/)
    const routes = code('server/http/routes/influencer-applications.routes.ts')
    expect(routes).toContain(`app.get('${INFLUENCER_DEAL_PATH}'`)
    expect(routes).toMatch(/async \(\) => svc\.deal\(\)\)/)
    expect(code('server/services/influencer-application.service.ts'))
      .toMatch(/new GrantService\(this\.prisma, INFLUENCER_GRANT_SLUG\)\.settings\(\)[\s\S]{0,200}percentOff: s\.percentOff, maxCourses: s\.maxCourses, commissionPercent: INFLUENCER_COMMISSION_DEFAULT/)
  })

  it('⚠️ والنصوص تبنى من الأرقام التي تصلها — والصفحة تمرر ما وصلها', () => {
    const n = { percentOff: 37, maxCourses: 2, commissionPercent: 11 }
    expect(influencerWhatAr(n).join(' ')).toMatch(/37%[\s\S]*2 دورات[\s\S]*11%/)
    expect(influencerExampleAr(n)).toBe('مثال: دورة سعرها 100 دولار. يدفع متابعك 63، ولك 11.')
    expect(influencerTermsAr(n).join(' ')).toContain('عمولتك 11% من سعر الدورات قبل الخصم')
    for (const call of ['influencerWhatAr(deal)', 'influencerExampleAr(deal)', 'influencerTermsAr(deal)']) expect(PAGE).toContain(call)
  })

  it('⚠️ ولا رقم نسبة مكتوب في الصفحة ولا في نصوصها', () => {
    for (const f of ['src/pages/JoinInfluencer.tsx', 'src/application/commerce/influencer-application.ts']) {
      const texts = textsOf(f, read(f))
      expect(texts.length, `لم يقرأ نص من ${f}`).toBeGreaterThan(5)
      expect(texts.filter((t) => /\d+\s*[%٪]|\b(?:40|45|15)\b/.test(t)), f).toEqual([])
      expect(code(f), f).not.toMatch(/\b(?:percentOff|maxCourses|commissionPercent)\s*[:=]\s*\d/)
    }
  })
})

describe('③ النموذج', () => {
  it('⚠️ يسأل عن الحسابات بمتابعيها — ولا يرسل بلا قبول الاتفاق، والفخ في الحمولة', () => {
    expect(PAGE).toMatch(/accounts: filled\.map\(\(a\) => \(\{ platform: a\.platform, url: a\.url\.trim\(\), followers: Number\(digitsOnly\(a\.followers\)\) \}\)\)/)
    expect(PAGE).toMatch(/if \(!terms\) e\.terms = /)
    expect(PAGE).toMatch(/if \(Object\.keys\(found\)\.length > 0\) \{[\s\S]*?return;\s*\}/)
    expect(PAGE).toMatch(/termsAccepted: true,\s*\[HONEYPOT_FIELD\]: hp\.value,/)
    expect(PAGE).toContain('{hp.field}')
    for (const label of ['الاسم الكامل', 'البريد الإلكتروني', 'رقم الجوال (واتساب)', 'حساباتك', 'كيف ستنشر كودك؟']) expect(PAGE).toContain(label)
    for (const h of ['ما هي', 'كيف تفعل حسابك', 'ما تجده في حسابك', 'الاتفاق المالي — لكل فصل']) expect(PAGE).toContain(`>${h}</h2>`)
  })
})

describe('④ الطابور', () => {
  it('⚠️ في «منحة مؤثرين وجيز» فوق المؤثرين — والأوسع وصولا أولا', () => {
    expect(PANEL).toMatch(/<InfluencerApplications onApproved=\{load\} \/>/)
    expect(QUEUE).toMatch(/const shown = byReach\(rows\.filter\(\(r\) => r\.status === stage\)\);/)
    const row = (id: string, reachTotal: number, createdAt: string) => ({ id, reachTotal, createdAt })
    expect(byReach([row('a', 100, '2026-10-01'), row('b', 5000, '2026-09-01'), row('c', 100, '2026-10-05')]).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('⚠️ والقبول بكود مطبع وعمولة تبدأ بالمقترحة — ومن نافذته وحدها', () => {
    expect(QUEUE).toMatch(/code: suggestInfluencerCode\(r\.email\), commission: String\(INFLUENCER_COMMISSION_DEFAULT\)/)
    expect(QUEUE).toMatch(/const code = form \? normalizeInfluencerCode\(form\.code\) : null;/)
    expect(suggestInfluencerCode('sara.ali-99@mail.com')).toBe('SARAALI99')
    expect(suggestInfluencerCode('a@b.c')).toBe('')
    expect(QUEUE.match(/\/approve`/g) ?? []).toHaveLength(1)
    const approveBox = /\{pending\?\.kind === "approve" && form && code && \([\s\S]*?<\/ConfirmAction>/.exec(QUEUE)?.[0] ?? ''
    expect(approveBox, 'القبول يقع خارج نافذته').toMatch(/apiPost\(`\/api\/admin\/influencer-applications\/\$\{row\.id\}\/approve`, \{ code, commissionPercent: commission \}\)/)
    const rejectBox = /\{pending\?\.kind === "reject" && \([\s\S]*?<\/ConfirmAction>/.exec(QUEUE)?.[0] ?? ''
    expect(rejectBox, 'الاعتذار يقع خارج نافذته').toContain('/reject`')
  })
})

describe('⑤ الدفعة الزائدة على الرصيد', () => {
  it('⚠️ رد الخادم يعرض خياريه — سلفة بـadvance، أو تعديل المبلغ', () => {
    expect(PANEL).toMatch(/if \(e instanceof ApiError && e\.code === "payout_exceeds_balance"\) setOver\(e\.message\);/)
    expect(PANEL).toMatch(/\.\.\.\(advance \? \{ advance: true \} : \{\}\)/)
    const box = /\{over && \([\s\S]*?<\/Inset>/.exec(PANEL)?.[0] ?? ''
    expect(box).toMatch(/onClick=\{\(\) => void pay\(true\)\}>سجلها سلفة<\/Button>/)
    expect(box).toMatch(/amountRef\.current\?\.focus\(\); \}\}>عدل المبلغ<\/Button>/)
    expect(PANEL).toMatch(/onConfirm=\{\(\) => void pay\(false\)\}/)
  })
})

describe('⑥ بلا تشكيل', () => {
  for (const f of [
    'src/application/commerce/influencer-application.ts', 'src/pages/JoinInfluencer.tsx', 'src/pages/admin/InfluencerApplications.tsx',
    'src/pages/admin/InfluencersPanel.tsx', 'server/services/influencer-application.service.ts', 'server/services/influencer.service.ts',
  ]) {
    it(f, () => expect(markedTexts(f, read(f))).toEqual([]))
  }
})
