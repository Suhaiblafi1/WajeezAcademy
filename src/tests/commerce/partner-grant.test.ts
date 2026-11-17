/* منحُ الشركاء في الشاشة (١٥ نوفمبر ٢٠٢٦) — والقراراتُ في رأس `src/application/commerce/partner-grant.ts`، والسلوكُ في
   `server/tests/commerce/partner-grant.test.ts`.

   ① **النطاقُ بحدود المقاطع وبلا حالة الحروف** — القاعدةُ نفسُها في الخادم والشاشة.
   ② **والعنوانُ من نسبة الشريك ونوعه** — «منح تصل إلى 75٪ لطلاب الجامعة» و«شراكة بين … وأكاديمية وجيز».
   ③ **ونصوصُ الصفحة والشاشة بلا تشكيل**، والصفحةُ بمسارين: صفحتُه ورابطُ التأكيد.
   ④ **وما يُحفظ على الجهاز** لا يُقبل إلّا بشكله. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { markedTexts } from '../helpers/marked-text'
import {
  emailMatchesDomains, normalizeDomain, normalizePartnerSlug, partnerCampaignSlug, partnerFaqAr, partnerHeadlineAr,
  partnerOfferAr, partnerSlugOf, isPartnerCampaign, STUDENT_SUGGESTED_COURSES, HU_PARTNER,
  BUILT_IN_PARTNER_LOGOS, MEU_PARTNER, builtInPartnerLogo,
} from '@/application/commerce/partner-grant'
import { GRANT_SLUGS, grantPagePath } from '@/application/commerce/grant'
import { parseStoredPartnerGrant } from '@/services/partner-grant'
import catalog from '@/data/catalog/core-catalog.v2.json'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('① نطاق البريد بحدود المقاطع', () => {
  const hu = ['hu.edu.jo']
  it.each(['x@hu.edu.jo', 'x@std.hu.edu.jo', 'X@Std.HU.edu.JO', ' x@a.b.hu.edu.jo '])('⚠️ يقبل %s', (e) => {
    expect(emailMatchesDomains(e, hu)).toBe(true)
  })
  it.each(['x@hu.edu.jo.evil.com', 'x@evilhu.edu.jo', 'x@hu-edu.jo', 'x@hu.edu.jom', 'x@edu.jo', 'hu.edu.jo', 'x@@hu.edu.jo', 'x@hu.edu.jo.', ''])(
    '⚠️ يرد %s', (e) => expect(emailMatchesDomains(e, hu)).toBe(false),
  )
  it('والنطاق يحفظ بحروف صغيرة، ولا يقبل مقطعا واحدا', () => {
    expect(normalizeDomain('@HU.edu.jo')).toBe('hu.edu.jo')
    expect(normalizeDomain('edu')).toBeNull()
    expect(normalizeDomain('hu..jo')).toBeNull()
    expect(normalizeDomain('-hu.edu.jo')).toBeNull()
  })
  it('والرابط حروف صغيرة وأرقام وشرطة، ومعرف صفه لا يلتبس بالحملات', () => {
    expect(normalizePartnerSlug(' HU ')).toBe('hu')
    expect(normalizePartnerSlug('h')).toBeNull()
    expect(normalizePartnerSlug('hu/../x')).toBeNull()
    expect(partnerSlugOf(partnerCampaignSlug('hu'))).toBe('hu')
    expect(GRANT_SLUGS.some(isPartnerCampaign)).toBe(false)
    expect(grantPagePath(partnerCampaignSlug('hu'))).toBe('/grant/p/hu')
  })
})

describe('② العنوان من نسبة الشريك ونوعه', () => {
  it('⚠️ الجامعة الهاشمية: 75٪ لطلاب الجامعة، وشراكة باسمها', () => {
    expect(partnerOfferAr(HU_PARTNER.percentOff, 'university')).toBe('منح تصل إلى 75٪ لطلاب الجامعة')
    expect(partnerOfferAr(60, 'company')).toBe('منح تصل إلى 60٪ لموظفي الشركة')
    expect(partnerHeadlineAr(HU_PARTNER.nameAr)).toBe('شراكة بين الجامعة الهاشمية وأكاديمية وجيز')
  })
  it('والأسئلة: من يستحق، وكم دورة، وكيف نتحقق، ومن لا بريد جامعيا له', () => {
    const faq = partnerFaqAr({ nameAr: 'الجامعة الهاشمية', type: 'university', percentOff: 75, maxCourses: 4, domains: ['hu.edu.jo'] })
    const qs = faq.map((f) => f.q).join(' ')
    expect(qs).toMatch(/من يستحق/)
    expect(qs).toMatch(/كم دورة/)
    expect(qs).toMatch(/كيف نتحقق/)
    expect(faq.find((f) => /ليس لدي/.test(f.q))?.a).toMatch(/تواصل معنا/)
    expect(faq.map((f) => f.a).join(' ')).toMatch(/hu\.edu\.jo/)
  })
  it('والدورات المقترحة لطلاب الجامعة كلها في الكتالوج', () => {
    const ids = new Set((catalog as { courses: { course_id: string }[] }).courses.map((c) => c.course_id))
    expect(STUDENT_SUGGESTED_COURSES.filter((id) => !ids.has(id))).toEqual([])
  })
})

describe('③ نصوص الصفحة والشاشة', () => {
  const FILES = ['src/application/commerce/partner-grant.ts', 'src/pages/PartnerGrantPage.tsx', 'src/pages/admin/PartnerGrants.tsx', 'server/services/partner-grant.service.ts']
  for (const f of FILES) it(`⚠️ بلا تشكيل: ${f}`, () => expect(markedTexts(f, read(f))).toEqual([]))

  it('⚠️ والصفحة بمسارين: صفحته ورابط التأكيد — وشاشة المدير', () => {
    const app = read('src/App.tsx')
    expect(app).toMatch(/<Route path="\/grant\/p\/:slug" element=\{<PartnerGrantPage \/>\} \/>/)
    expect(app).toMatch(/<Route path="\/grant\/p\/:slug\/confirm" element=\{<PartnerGrantPage \/>\} \/>/)
    expect(app).toMatch(/<Route path="\/admin\/partner-grants" element=\{<AdminPartnerGrants \/>\} \/>/)
  })

  it('⚠️ والرمز يمحى من العنوان قبل أن يرسل', () => {
    const page = read('src/pages/PartnerGrantPage.tsx')
    const wipe = page.indexOf('window.history.replaceState(window.history.state, "", base)')
    const send = page.indexOf('/confirm`, { token })')
    expect(wipe).toBeGreaterThan(-1)
    expect(send).toBeGreaterThan(wipe)
  })

  it('والشعاران متجاوران، والاسم مكان الشعار حتى يرفع', () => {
    const page = read('src/pages/PartnerGrantPage.tsx')
    expect(page).toMatch(/partner\.logoUrl\s*\?\s*<img src=\{mediaSrc\(partner\.logoUrl\)\}/)
    expect(page).toMatch(/src="\/logo-mark\.png" alt="علامة أكاديمية وجيز"/)
  })
})

describe('④ ما يحفظ على الجهاز', () => {
  const ok = { ref: '11111111-2222-3333-4444-555555555555', code: 'WG-ABCDEFGH', percentOff: 75, name: 'سارة', email: 's@hu.edu.jo', picks: ['C-JOB-101'], at: Date.now() }
  it('يقبل بشكله، ويسقط الكود المختلق والقديم', () => {
    expect(parseStoredPartnerGrant(JSON.stringify(ok))?.code).toBe('WG-ABCDEFGH')
    expect(parseStoredPartnerGrant(JSON.stringify({ ...ok, code: '<b>' }))?.code).toBeNull()
    expect(parseStoredPartnerGrant(JSON.stringify({ ...ok, ref: 'x' }))).toBeNull()
    expect(parseStoredPartnerGrant(JSON.stringify({ ...ok, at: Date.now() - 61 * 86_400_000 }))).toBeNull()
    expect(parseStoredPartnerGrant('{')).toBeNull()
  })
})

/* ═══ جامعة الشرق الأوسط وشعارُها مع الموقع (١٦ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «افتح صفحة لشريكين جديدين.. جامعة الشرق الأوسط وكاسيت، وإليك اللوقات.. والنسبة للجامعة ٥٠٪». والسلوكُ
   في `server/tests/commerce/partner-grant.test.ts` ⑦. وهنا: ثوابتُها، وأنّ شعارَها ملفٌّ في `public` صورٌ لا شيفرة، وعلى أرضيّةٍ
   بيضاء في الصفحة — نصُّه رماديٌّ داكنٌ لا يُقرأ على الليليّ. */
describe('⑤ جامعة الشرق الأوسط وشعارها مع الموقع', () => {
  it('⚠️ بخمسين على أربع دورات ونطاقها، وشعارها ملف في public صور لا شيفرة', () => {
    expect(MEU_PARTNER).toMatchObject({ slug: 'meu', nameAr: 'جامعة الشرق الأوسط', nameEn: 'Middle East University', type: 'university', domains: ['meu.edu.jo'], percentOff: 50, maxCourses: 4 })
    expect(builtInPartnerLogo('meu')).toBe('/partners/meu.svg')
    /* والهاشميةُ صار لها شعارٌ مع الموقع (١٧ نوفمبر ٢٠٢٦) — PNG بتوقيعه، لا SVG */
    expect(builtInPartnerLogo('hu')).toBe('/partners/hu.png')
    const png = readFileSync(join(process.cwd(), 'public/partners/hu.png'))
    expect(png.subarray(0, 8).toString('hex'), 'ليس PNG').toBe('89504e470d0a1a0a')
    expect(png.length, 'الشعار أثقل من ١٠٠ ك.ب').toBeLessThan(100_000)
    for (const path of Object.values(BUILT_IN_PARTNER_LOGOS).filter((p) => p.endsWith('.svg'))) {
      const svg = read(`public${path}`)
      expect(svg.startsWith('<svg'), path).toBe(true)
      expect(svg, `${path} فيه شيفرة أو رابط`).not.toMatch(/<script|<foreignObject|<image|\son[a-z]+=|javascript:|href=|@import|url\(/i)
    }
  })

  it('⚠️ والشعار في الصفحة على أرضية بيضاء — فيقرأ في الليلي', () => {
    const page = read('src/pages/PartnerGrantPage.tsx')
    expect(page).toMatch(/<span className="grid h-20 min-w-20 max-w-\[11rem\] place-items-center rounded-2xl bg-white[^"]*">\s*\{partner\.logoUrl/)
  })
})
