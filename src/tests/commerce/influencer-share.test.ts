/* «صمم منشورك» للمؤثّر — نصُّ المنحة لكلّ منصّة، وصورُها، ولوحتُها في صفحته (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحةَ والتقديمَ عبر الرابط الذي يُرفقه بالنصّ،
   كما فعلنا للمدرّب». والعلّةُ في `src/application/commerce/influencer-share.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { grantEmailSubject, grantShareText, grantShareUrl, type GrantShareInput } from '@/application/commerce/influencer-share'
import { SHARE_PLATFORMS } from '@/application/trainer/share-kit'
import { plainAr } from '@/application/text/plain-ar'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const URL = 'https://www.wajeezacademy.com/grant/i/SARA'
const g: GrantShareInput = { nameAr: 'سارة الخطيب', code: 'SARA', percentOff: 45, maxCourses: 4, lastDayAr: '30 أكتوبر', url: URL }

describe('نص المنحة لكل منصة', () => {
  it('⚠️ في كل منصة: النسبة بـ«٪» والكود — والرابط حيث ينقر، و«الرابط في البايو» حيث لا ينقر', () => {
    for (const p of SHARE_PLATFORMS) {
      const t = grantShareText(p.id, g)
      expect(t, p.id).toContain('45٪')
      expect(t, `${p.id}: «%» اللاتينية تنقلب في السطر العربي`).not.toContain('%')
      expect(t, p.id).toContain('SARA')
      if (p.id === 'instagram' || p.id === 'tiktok') {
        expect(t, p.id).toContain('الرابط في البايو')
        expect(t, `${p.id}: رابط لا ينقر`).not.toContain(URL)
      } else {
        expect(t, `${p.id}: بلا رابط صفحته`).toContain(URL)
      }
    }
  })

  it('⚠️ «الكود الخاص بي» وعدد الدورات وآخر يوم — والمنحة بنسبتها لا بما يبقى', () => {
    const t = grantShareText('whatsapp', g)
    expect(t).toContain('الكود الخاص بي: *SARA*')
    expect(t).toContain('تصل إلى *45٪* من سعر الدورات')
    expect(t).toContain('اختر حتى 4 دورات')
    expect(t).toContain('آخر يوم: 30 أكتوبر')
    expect(t, 'عاد «تدفع ...٪ فقط»').not.toMatch(/تدفع|55٪/)
    expect(grantShareText('linkedin', g), 'تغليظ لا يقرؤه لينكدإن').not.toContain('*')
    /* وبلا آخر يوم حين لا آخر للمنحة */
    expect(grantShareText('whatsapp', { ...g, lastDayAr: null })).not.toContain('آخر يوم')
  })

  it('البريد: تحية وتوقيع باسمه وعنوان يقول المنحة، وبابه بريده برسالته', () => {
    const t = grantShareText('email', g)
    expect(t.startsWith('مرحبا،')).toBe(true)
    expect(t.trim().endsWith('سارة الخطيب')).toBe(true)
    expect(t, 'وسوم في بريد').not.toContain('#')
    expect(grantEmailSubject(g)).toBe('منحة من أكاديمية وجيز — تصل إلى 45٪ من سعر الدورات')
    const q = new URLSearchParams(grantShareUrl('email', g)!.slice('mailto:?'.length))
    expect(q.get('subject')).toBe(grantEmailSubject(g))
    expect(q.get('body')).toBe(t)
  })

  it('وأبواب المنصات كأبواب المدرب — وإنستغرام وتيك توك بلا باب من موقع', () => {
    expect(grantShareUrl('whatsapp', g)).toContain(encodeURIComponent('SARA'))
    expect(grantShareUrl('facebook', g)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL)}`)
    expect(grantShareUrl('instagram', g)).toBeNull()
    expect(grantShareUrl('tiktok', g)).toBeNull()
  })

  it('ونصوصه بلا تشكيل إعرابي', () => {
    for (const p of SHARE_PLATFORMS) {
      const t = grantShareText(p.id, g)
      expect(plainAr(t), p.id).toBe(t)
    }
  })
})

describe('الصور واللوحة', () => {
  it('⚠️ صفحته تعرض «صمم منشورك» بلوحة المدرب ومحتوى المنحة — قبل كوده وأرقامه', () => {
    const page = code('src/pages/InfluencerHome.tsx')
    expect(page).toMatch(/<ShareKit [^>]*content=\{content\} \/>/)
    expect(page).toMatch(/text: \(p\) => grantShareText\(p, g\)/)
    expect(page).toMatch(/draw: \(kind\) => drawGrantArt\(kind as GrantArtKind, art\)/)
    expect(page, 'اللوحة بعد الكود والأرقام').toMatch(/<GrantShare me=\{me\} \/>[\s\S]*كودك/)
  })

  it('⚠️ ولوحة المدرب تقرأ المحتوى الممرر — وبلاه محتوى المدرب كما كان', () => {
    const kit = code('src/components/trainer/ShareKit.tsx')
    expect(kit).toMatch(/const text = content \? content\.text\(platform\) : shareText\(platform, input\);/)
    expect(kit).toMatch(/content \? content\.draw\(kind, index\) : drawArt\(kind as ArtKind, art, index\)/)
    expect(kit).toMatch(/const door = \(p: SharePlatform\) => \(content \? content\.door\(p\) : shareUrl\(p, input\)\);/)
  })

  it('والصورة بلا عنوان موقع — الرابط في النص ينقر وفي الصورة لا', () => {
    const art = code('src/components/influencer/grant-art.ts')
    expect(art, 'يرسم عنوانا').not.toMatch(/fillText\([^)]*(url|link|wajeez|\.com)/i)
    const data = art.slice(art.indexOf('export interface GrantArtData'), art.indexOf('}', art.indexOf('export interface GrantArtData')))
    expect(data, 'عنوان الموقع في بيانات الرسم').not.toMatch(/\burl\b|\blink\b/i)
  })
})
