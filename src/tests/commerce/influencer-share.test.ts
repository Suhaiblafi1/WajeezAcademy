/* «صمم منشورك» للمؤثّر — نصُّ المنحة لكلّ منصّة، وصورُها، ولوحتُها في صفحته (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحةَ والتقديمَ عبر الرابط الذي يُرفقه بالنصّ،
   كما فعلنا للمدرّب». والعلّةُ في `src/application/commerce/influencer-share.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { grantEmailSubject, grantShareText, grantShareUrl, type GrantShareInput } from '@/application/commerce/influencer-share'
import { SHARE_PLATFORMS } from '@/application/trainer/share-kit'
import { plainAr } from '@/application/text/plain-ar'
import { coursesAr, grantArtPlan, grantDesigns, parseGrantKind, shortTitle, trainersCountAr, ACADEMY_FEATURES, ACADEMY_PERKS, ASSESSMENTS, GRANT_DESIGNS, MIN_FACES } from '@/components/influencer/grant-art'
import { FIELD_CHECKS } from '@/domain/placement/field-check'

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
    expect(page).toMatch(/draw: \(kind\) => \{ const k = parseGrantKind\(kind\); return drawGrantArt\(k\.design, k\.size, art\); \}/)
    /* وبلا صورته: وجهُ اللوحة بلا صورة، وصورُ المدرّبين ودوراتُ الموسم من حسابه (بلا صاحب المنصّة) */
    expect(page).toMatch(/face=\{\{ name: me\.nameAr, photoUrl: null \}\}/)
    expect(page).toMatch(/termAr: me\.designs\.termAr, photos: me\.designs\.photos, trainerTotal: me\.designs\.trainerTotal,/)
    expect(page, 'عادت صور المدربين من صفحة المنحة العامة — وفيها صاحب المنصة').not.toMatch(/\/api\/public\/grant/)
    /* والتصميمُ يُختار من المتاح وحدَه */
    expect(page).toMatch(/GRANT_DESIGNS\.filter\(\(x\) => available\.includes\(x\.id\)\)/)
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

/* «أضف تصاميم أخرى تدل على الأكاديمية ودوراتها ومدربيها… لا داعي لوجود صورة صاحب المنحة… اذكرها مع الكود كاسمه»
   (صاحب المنصة، ٢٦ أكتوبر ٢٠٢٦)، ثمّ (٢٧ أكتوبر): «لا اريد ان توضح صور المدربين بشكل قوي… ولا تضع صهيب من ضمنهم
   ولا داعي لاسمائهم… نحتاج تصميم للاكاديمية ككل… كلما زادت التصاميم كان افضل… تصميم فيه كل المدربين معا… اكثر نعومة» */
describe('تسعة تصاميم بلا صورة المؤثر ولا أسماء المدربين', () => {
  const course = { title: 'أ', startsAt: null }
  it('⚠️ صور المدربين بثلاث فأكثر، والدورات بواحدة فأكثر — وما سواها دائما', () => {
    const ALL = ['offer', 'academy', 'start', 'features', 'why', 'trainers', 'team', 'courses', 'steps']
    expect(GRANT_DESIGNS.map((x) => x.id)).toEqual(ALL)
    expect(grantDesigns({ photos: ['/a', '/b', '/c'], courses: [course] })).toEqual(ALL)
    expect(grantDesigns({ photos: ['/a', '/b'], courses: [] }), 'صورتان لا تقولان «مدربون»').toEqual(['offer', 'academy', 'start', 'features', 'why', 'steps'])
    expect(MIN_FACES).toBe(3)
  })
  it('⚠️ المنشور والستوري للتصميم المختار، والكاروسيل بصور المدربين مرة واحدة و«مزايا وجيز» مكان «لماذا» ثم «كيف تحجز»', () => {
    expect(grantArtPlan('post', 'trainers', ['offer', 'trainers'])).toEqual([{ kind: 'trainers:post', index: 0 }])
    expect(grantArtPlan('story', 'academy', ['offer', 'academy'])).toEqual([{ kind: 'academy:story', index: 0 }])
    const all = grantDesigns({ photos: ['/a', '/b', '/c'], courses: [course] })
    expect(grantArtPlan('carousel', 'offer', all).map((x) => x.kind))
      .toEqual(['offer:slide', 'academy:slide', 'start:slide', 'team:slide', 'courses:slide', 'features:slide', 'steps:slide'])
    expect(parseGrantKind('courses:story')).toEqual({ design: 'courses', size: 'story' })
  })
  it('⚠️ لا صورة له ولا أسماء للمدربين في بيانات الرسم — واسمه مع الكود في كل تصميم', () => {
    const art = code('src/components/influencer/grant-art.ts')
    const data = art.slice(art.indexOf('export interface GrantArtData'), art.indexOf('\n}', art.indexOf('export interface GrantArtData')))
    expect(data, 'عادت صورة المؤثر إلى بيانات الرسم').not.toMatch(/^\s*photoUrl/m)
    expect(data, 'المدربون صور فقط').toMatch(/^\s*photos: string\[\]$/m)
    expect(data, 'عادت أسماء المدربين إلى بيانات الرسم').not.toMatch(/trainers|nameAr/)
    expect(art).toMatch(/const text = `\$\{influencerCodeLabelAr\(d\.name\)\}: \$\{d\.code\}`/)
    expect(art, 'الكود لا يرسم في ذيل كل تصميم').toMatch(/codePill\(ctx, d, cx, f\.pillY,/)
  })
  it('والعدد فوق العشرة بالمفرد، واسم الدورة بلا ما بين القوسين', () => {
    expect(coursesAr(4)).toBe('4 دورات')
    expect(coursesAr(24)).toBe('24 دورة')
    expect(coursesAr(2)).toBe('دورتين')
    expect(trainersCountAr(14)).toBe('14 مدربا معتمدا')
    expect(trainersCountAr(5)).toBe('5 مدربين معتمدين')
    expect(shortTitle('أساسيات التخطيط الاستراتيجي (من فهم الواقع إلى تحديد الاتجاه)')).toBe('أساسيات التخطيط الاستراتيجي')
    expect(shortTitle('تمويل المشاريع: من الفكرة إلى التمويل')).toBe('تمويل المشاريع')
  })
  it('ومزايا الأكاديمية مما تعده صفحة المنحة لا غيره — ونصوص التصاميم بلا تشكيل', () => {
    expect(ACADEMY_FEATURES).toEqual(['لقاءات مباشرة على Zoom مع مدرب معتمد', 'تطبيقات عملية في كل دورة', 'تسجيل كل لقاء تعود إليه', 'شهادة موثقة ورسالة توصية لمن يلتزم'])
    for (const f of ACADEMY_FEATURES) expect(plainAr(f)).toBe(f)
    for (const x of GRANT_DESIGNS) expect(plainAr(x.label)).toBe(x.label)
  })

  /* «تصميم آخر عن التشخيص واختبارات تحديد المستوى وتحديد الميول وغيرها، وأي ميزة للأكاديمية ضعها في مجموعة
     التصاميم» (صاحب المنصة، ٢٧ أكتوبر ٢٠٢٦) — وكل رقم فيها رقم صفحته، لا وعد يختلق */
  it('⚠️ «اعرف من أين تبدأ»: الأربعة بأرقام صفحاتها، ومجالات الفحص من الفحوص نفسها', () => {
    expect(ASSESSMENTS.map((a) => [a.title, a.tag])).toEqual([
      ['التشخيص الذكي', 'من 3 إلى 6 دقائق'],
      ['مرآة وجيز', '24 بندا في 3 دقائق'],
      ['تحديد مستوى الإنجليزية', 'نحو 30 سؤالا'],
      ['فحص المهارة', '12 سؤالا'],
    ])
    expect(ASSESSMENTS[3].sub.split(' · ')).toEqual(FIELD_CHECKS.map((c) => c.title_ar))
    expect(code('src/pages/Diagnostic.tsx'), 'تغير زمن التشخيص في صفحته').toContain('text: "٣–٦ دقائق"')
    expect(code('src/application/site/public-pages.ts'), 'تغير وصف المرآة').toContain('أربعة وعشرون بندا في ثلاث دقائق')
    for (const a of ASSESSMENTS) for (const t of [a.title, a.sub, a.tag]) expect(plainAr(t), t).toBe(t)
    /* و«3–6» بشرطة تنقلب «6–3» في السطر العربي */
    for (const a of ASSESSMENTS) expect(a.tag, 'شرطة بين رقمين').not.toMatch(/\d\s*[–-]\s*\d/)
  })
  it('⚠️ «مزايا وجيز» ثمان — وفيها ما تعده صفحة المنحة كله', () => {
    expect(ACADEMY_PERKS).toHaveLength(8)
    for (const p of ACADEMY_PERKS) expect(plainAr(p), p).toBe(p)
    expect(ACADEMY_PERKS).toEqual(expect.arrayContaining(['لقاءات مباشرة على Zoom', 'تطبيقات عملية', 'تسجيل كل لقاء', 'رسالة توصية لمن يلتزم']))
    const art = code('src/components/influencer/grant-art.ts')
    expect(art).toMatch(/else if \(design === 'start'\) drawStart\(ctx, f, w, size\)/)
    expect(art).toMatch(/else if \(design === 'features'\) drawFeatures\(ctx, f, w, size\)/)
  })
})
