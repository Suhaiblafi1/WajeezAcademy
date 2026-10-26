/* «شارك دوراتك» — نصٌّ لكلّ منصّة، ورابطُ مشاركتها، والكودُ الظاهرُ أعلى الخصمين (٢٦ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «عندما أضغط على شير أختار ما بين إنستغرام وواتساب وفيسبوك وتيك توك ولينكدإن… يفتح لي صفحة
   اللينكدإن مع بوستٍ جاهز… وإذا هو يريد أن يفعّل كودا منفصلا فيظهر الكودُ الأعلى». والعلّةُ في `share-kit.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bestCode, SHARE_PLATFORMS, shareText, shareUrl, type ShareInput } from '@/application/trainer/share-kit'
import { artPlan } from '@/components/trainer/share-art'

const URL_ONE = 'https://www.wajeezacademy.com/build/C-1?ref=WJ-AAAA'
const one: ShareInput = {
  courses: [{ courseTitle: 'مهارة الخطابة', startsAt: '2026-11-15T15:00:00Z', url: URL_ONE }],
  url: URL_ONE,
  code: { code: 'WJ30-K7Q2MX', percentOff: 30 },
  dayAr: () => '15 نوفمبر',
}
const all: ShareInput = {
  ...one,
  courses: [one.courses[0], { courseTitle: 'إدارة المخزون', startsAt: null, url: 'x' }],
  url: 'https://www.wajeezacademy.com/t/صهيب',
}

describe('النص لكل منصة', () => {
  it('⚠️ كل نص فيه اسم الدورة والكود — وما يفتح برابط فيه الرابط', () => {
    for (const p of SHARE_PLATFORMS) {
      const t = shareText(p.id, one)
      expect(t, p.id).toContain('مهارة الخطابة')
      expect(t, `${p.id} بلا كود`).toContain('WJ30-K7Q2MX')
      expect(t, `${p.id} بلا موعد`).toContain('15 نوفمبر')
    }
    for (const p of ['whatsapp', 'linkedin', 'facebook', 'x'] as const) expect(shareText(p, one)).toContain(URL_ONE)
  })

  it('⚠️ وإنستغرام وتيك توك لا رابط ينقر فيهما — «الرابط في البايو»', () => {
    for (const p of ['instagram', 'tiktok'] as const) {
      expect(shareText(p, one)).not.toContain('https://')
      expect(shareText(p, one)).toContain('الرابط في البايو')
    }
  })

  it('ودوراته كلها قائمة برابطه العام — وبلا كود لا يذكر خصم', () => {
    const t = shareText('linkedin', all)
    expect(t).toContain('· مهارة الخطابة')
    expect(t).toContain('· إدارة المخزون')
    expect(t).toContain(all.url)
    expect(shareText('whatsapp', { ...one, code: null })).not.toContain('خصم')
  })

  it('ولا تشكيل إعرابي في النصوص — الشدة وحدها (قرار ١١ أكتوبر)', () => {
    for (const p of SHARE_PLATFORMS) expect(shareText(p.id, all), p.id).not.toMatch(/[ً-ِْ]/)
  })
})

describe('باب كل منصة', () => {
  it('⚠️ واتساب ولينكدإن وإكس بالنص كاملا، وفيسبوك بالرابط وحده', () => {
    const wa = new URL(shareUrl('whatsapp', one)!)
    expect(wa.host).toBe('wa.me')
    expect(wa.searchParams.get('text')).toBe(shareText('whatsapp', one))
    const li = new URL(shareUrl('linkedin', one)!)
    expect(li.host).toBe('www.linkedin.com')
    expect(li.searchParams.get('text')).toBe(shareText('linkedin', one))
    expect(new URL(shareUrl('x', one)!).searchParams.get('text')).toBe(shareText('x', one))
    expect(new URL(shareUrl('facebook', one)!).searchParams.get('u')).toBe(URL_ONE)
  })

  it('⚠️ وإنستغرام وتيك توك بلا باب — تشارك الصورة من الهاتف أو تنزل', () => {
    expect(shareUrl('instagram', one)).toBeNull()
    expect(shareUrl('tiktok', one)).toBeNull()
    expect(SHARE_PLATFORMS.filter((p) => !p.opens).map((p) => p.id)).toEqual(['instagram', 'tiktok'])
  })
})

describe('الكود الظاهر أعلى الخصمين', () => {
  const ours = { code: 'WJ30-OURS', percentOff: 30 }
  it('⚠️ خصمنا ما لم يعله كوده — وكوده إن ساواه، فهو اختاره لجمهوره', () => {
    expect(bestCode(ours, [{ code: 'MY20', percentOff: 20 }])).toEqual(ours)
    expect(bestCode(ours, [{ code: 'MY30', percentOff: 30 }])).toEqual({ code: 'MY30', percentOff: 30 })
    expect(bestCode({ ...ours, percentOff: 20 }, [{ code: 'MY25', percentOff: 25 }])).toEqual({ code: 'MY25', percentOff: 25 })
  })
  it('وكوده بالمبلغ لا يقارن بالنسبة — يبقى خصمنا', () => {
    expect(bestCode(ours, [{ code: 'AMT', percentOff: null }])).toEqual(ours)
  })
})

describe('الصور لكل صيغة', () => {
  it('منشور وستوري صورة واحدة، والكاروسيل غلاف وشريحة لكل دورة وشريحة للخصم', () => {
    expect(artPlan('post', 3)).toEqual([{ kind: 'post', index: 0 }])
    expect(artPlan('story', 3)).toEqual([{ kind: 'story', index: 0 }])
    expect(artPlan('carousel', 3).map((p) => p.kind)).toEqual(['cover', 'course', 'course', 'course', 'offer'])
    expect(artPlan('carousel', 20).length, 'إنستغرام يقبل عشر شرائح').toBeLessThanOrEqual(10)
  })
})

describe('في صفحة «شارك دوراتك»', () => {
  const page = readFileSync(join(process.cwd(), 'src/pages/trainer/Referral.tsx'), 'utf8')
  it('⚠️ لكل شعبة زر «شارك»، ولدوراته كلها لوحة برابطه العام — والكود أعلى الخصمين', () => {
    expect(page).toMatch(/sharing === c\.cohortId && \([\s\S]{0,80}<ShareKit [^>]*url=\{c\.url\} code=\{shareCodeOf\(kit\)\}/)
    expect(page).toMatch(/sharing === "all" && \([\s\S]{0,80}<ShareKit [^>]*url=\{referral\.url\} code=\{shareCodeOf\(kit\)\}/)
    expect(page).toMatch(/const shareCodeOf = \(k: ShareKitData\) => bestCode\(/)
  })
})
