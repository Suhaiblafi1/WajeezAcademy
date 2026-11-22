/* كاسيت في الصفحة — رأسُها المشترك وزرُّ واتسابها (١٧ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «Influencer page + logo»، ورسالةُ واتساب طلبٌ عمليٌّ من العميل واسمُ المؤثّر في آخرها:
   «مرحبا، أحتاج مساعدتكم في اختيار الدورات المناسبة لي - كاسيت»، إلى رقمنا الذي أُرسل لها (962794050524).
   والسلوكُ في الخادم: `server/tests/commerce/influencer-kaseet.test.ts`. وهنا ثوابتُها، وأنّ الصفحةَ تبني الزرَّ والرأسَ منها. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUILT_IN_INFLUENCER_LOGOS, KASEET_INFLUENCER, influencerBrand, influencerWhatsAppTextAr,
} from '@/application/commerce/influencer'
import { WHATSAPP_SPOTS, waHref } from '@/application/site/whatsapp'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
/* حركاتُ الإعراب والتنوين والسكون والمدّة — والشدّةُ وحدَها تبقى (قرارُ ١١ أكتوبر ٢٠٢٦) */
const DIACRITICS = /[ً-ِْٰ]/

describe('① رسالة واتساب', () => {
  it('⚠️ طلب عملي واسم المؤثر في آخرها — بلا كود ولا «جئت من طرف»', () => {
    expect(influencerWhatsAppTextAr('كاسيت')).toBe('مرحبا، أحتاج مساعدتكم في اختيار الدورات المناسبة لي - كاسيت')
    expect(influencerWhatsAppTextAr('ChatTree')).toBe('مرحبا، أحتاج مساعدتكم في اختيار الدورات المناسبة لي - ChatTree')
  })

  it('⚠️ إلى رقمنا من موضعها في شاشة الربط', () => {
    expect(WHATSAPP_SPOTS.map((s) => s.key)).toContain('influencer_page')
    const href = waHref({ influencer_page: '962794050524', advisor: '962700000000' }, 'influencer_page', '', influencerWhatsAppTextAr('كاسيت'))!
    expect(href.startsWith('https://wa.me/962794050524?text=')).toBe(true)
    expect(decodeURIComponent(href.split('?text=')[1])).toBe('مرحبا، أحتاج مساعدتكم في اختيار الدورات المناسبة لي - كاسيت')
  })

  it('⚠️ ولا حركات في نصوصها — والشدة وحدها تبقى', () => {
    const page = read('src/pages/MemberGrantPage.tsx')
    const button = page.slice(page.indexOf('waHref(numbers, "influencer_page"'))
    const said = [
      influencerWhatsAppTextAr(KASEET_INFLUENCER.nameAr), KASEET_INFLUENCER.nameAr,
      ...WHATSAPP_SPOTS.filter((s) => s.key === 'influencer_page').flatMap((s) => [s.labelAr, s.whereAr]),
      button.slice(button.indexOf('icon={MessageCircle}>') + 'icon={MessageCircle}>'.length, button.indexOf('</Button>')),
    ]
    expect(said.every((t) => t.trim().length > 0)).toBe(true)
    for (const t of said) expect(t, t).not.toMatch(DIACRITICS)
  })
})

describe('② كاسيت ورأسها', () => {
  it('⚠️ كودها KASEET كما أرسل لها، وKASSET سابقه، وعمولتها 5% ورقمها وبريدها', () => {
    expect(KASEET_INFLUENCER).toMatchObject({
      nameAr: 'كاسيت', nameEn: 'Kaseet', code: 'KASEET', formerCodes: ['KASSET'], commissionPercent: 5,
      phone: '+962781010288', email: 'jameelzatara@kaseet.com',
    })
  })

  it('⚠️ لها رأس مشترك — بلا شعار حتى يصل، ومن لم يذكر تبقى صفحته كما هي', () => {
    expect(influencerBrand('KASEET')).toEqual({ logoUrl: BUILT_IN_INFLUENCER_LOGOS.KASEET ?? null })
    /* ووصل شعارُها (٢٢ نوفمبر ٢٠٢٦): ملفٌّ في public، صورةُ PNG حقيقيّة */
    expect(influencerBrand('KASEET'), 'رأس كاسيت بلا شعارها').toEqual({ logoUrl: '/influencers/kaseet.png' })
    expect(readFileSync(join(process.cwd(), 'public/influencers/kaseet.png')).subarray(1, 4).toString()).toBe('PNG')
    expect(influencerBrand('CHATTREE')).toBeNull()
    expect(influencerBrand('constructor'), 'قرأ من نموذج الكائن').toBeNull()
    /* وكلُّ شعارٍ مذكورٍ ملفٌّ في public */
    for (const path of Object.values(BUILT_IN_INFLUENCER_LOGOS)) {
      if (path) expect(existsSync(join(process.cwd(), `public${path}`)), path).toBe(true)
    }
  })

  it('⚠️ والصفحة تبني الرأس والزر منها — وفي بلاك فرايدي برابطها ?ch=', () => {
    const page = read('src/pages/MemberGrantPage.tsx')
    expect(page, 'بلاك فرايدي لا ترسل قناة الرابط').toMatch(/`\/api\/public\/grant\/bf\$\{ch \? `\?ch=\$\{encodeURIComponent\(ch\)\}` : ""\}`/)
    expect(page).toMatch(/waHref\(numbers, "influencer_page", CONTACT\.whatsapp, cobrand\.whatsAppText\)/)
    expect(page.match(/\{cobrand && <InfluencerCobrand cobrand=\{cobrand\}/g)?.length, 'الرأس ليس في الخطوتين').toBe(2)
    expect(page, 'الشعار ليس على أرضية بيضاء').toMatch(/rounded-2xl bg-white[^"]*">\s*\{cobrand\.brand\.logoUrl/)
  })
})
