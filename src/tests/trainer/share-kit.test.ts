/* «شارك دوراتك» — نصٌّ لكلّ منصّة، ورابطُ مشاركتها، والكودُ الظاهرُ أعلى الخصمين (٢٦ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «عندما أضغط على شير أختار ما بين إنستغرام وواتساب وفيسبوك وتيك توك ولينكدإن… يفتح لي صفحة
   اللينكدإن مع بوستٍ جاهز… وإذا هو يريد أن يفعّل كودا منفصلا فيظهر الكودُ الأعلى». والعلّةُ في `share-kit.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bestCode, emailSubject, manualNoteAr, SHARE_PLATFORMS, shareText, shareUrl, splitTitle, type ShareInput } from '@/application/trainer/share-kit'
import { artPlan } from '@/components/trainer/share-art'
import { previewSig } from '@/components/trainer/link-preview'

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
    for (const p of ['whatsapp', 'linkedin', 'facebook', 'x', 'email'] as const) expect(shareText(p, one)).toContain(URL_ONE)
  })

  it('⚠️ وإنستغرام وتيك توك لا رابط ينقر فيهما — «الرابط في البايو»', () => {
    for (const p of ['instagram', 'tiktok'] as const) {
      expect(shareText(p, one)).not.toContain('https://')
      expect(shareText(p, one)).toContain('الرابط في البايو')
    }
  })

  it('ودوراته كلها قائمة برابطه العام — وبلا كود لا يذكر خصم', () => {
    const t = shareText('linkedin', all)
    expect(t).toContain('1️⃣ مهارة الخطابة')
    expect(t).toContain('2️⃣ إدارة المخزون')
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
    /* والرابطُ المنشورُ قصيرٌ إن كان — وإلّا الطويل */
    expect(page).toMatch(/sharing === c\.cohortId && \([\s\S]{0,80}<ShareKit [^>]*url=\{kit\.short\.cohorts\[c\.cohortId\] \?\? c\.url\} code=\{shareCodeOf\(kit\)\}/)
    expect(page).toMatch(/sharing === "all" && \([\s\S]{0,80}<ShareKit [^>]*url=\{kit\.short\.wide \?\? referral\.url\} code=\{shareCodeOf\(kit\)\}/)
    expect(page).toMatch(/const shareCodeOf = \(k: ShareKitData\) => bestCode\(/)
  })
})

/* ═══ «لا تبدو احترافيّة.. سهلةَ القراءة وممتعةً ومحفّزةً للشراء» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦) ═══ */
describe('نص يقرأ ويغري', () => {
  const funding = 'تمويل المشاريع الصغيرة: من مراحل التمويل إلى إقناع الممول'
  it('⚠️ الاسم قصير قبل النقطتين، ووعده سطر تحته في الدورة الواحدة — لا عنوان ملصوق بموعده', () => {
    expect(splitTitle(funding)).toEqual({ name: 'تمويل المشاريع الصغيرة', promise: 'من مراحل التمويل إلى إقناع الممول' })
    const t = shareText('whatsapp', { ...one, courses: [{ ...one.courses[0], courseTitle: funding }] })
    expect(t).toContain('📘 *تمويل المشاريع الصغيرة*\nمن مراحل التمويل إلى إقناع الممول')
    expect(t, 'الموعد ملصوق بالعنوان').not.toMatch(/الصغيرة، تبدأ/)
  })
  it('⚠️ والدورات بترتيب ما يبدأ أولا، وما لا موعد له آخرا', () => {
    const t = shareText('linkedin', {
      ...all,
      courses: [
        { courseTitle: 'ج', startsAt: null, url: 'x' },
        { courseTitle: 'ب', startsAt: '2026-12-06T00:00:00Z', url: 'x' },
        { courseTitle: 'أ', startsAt: '2026-12-01T00:00:00Z', url: 'x' },
      ],
    })
    expect(t.indexOf('1️⃣ أ')).toBeGreaterThan(-1)
    expect(t.indexOf('2️⃣ ب')).toBeGreaterThan(t.indexOf('1️⃣ أ'))
    expect(t.indexOf('3️⃣ ج')).toBeGreaterThan(t.indexOf('2️⃣ ب'))
  })
  it('والكود سطر وحده بهديته، والدعوة قبل الرابط، والنسبة بـ«٪» العربية', () => {
    const t = shareText('linkedin', one)
    expect(t).toMatch(/\n🎁 خصم 30٪ لمن يتابعني بالكود: WJ30-K7Q2MX\n/)
    expect(t).toMatch(/سجل الآن 👇\nhttps:/)
    expect(t).not.toContain('30%')
  })
})

describe('ما لا ينشر مباشرة يقال قبل الضغط', () => {
  it('⚠️ من الحاسوب: إنستغرام وتيك توك يدويان ويقال لماذا، وفيسبوك يلصق النص، وكل منصة ترفق الصورة بيده', () => {
    expect(manualNoteAr('instagram')).toMatch(/إنستغرام لا يسمح بالنشر المباشر.*يدوي/)
    expect(manualNoteAr('tiktok')).toMatch(/تيك توك لا يسمح بالنشر المباشر.*يدوي/)
    expect(manualNoteAr('facebook')).toMatch(/الصقه/)
    for (const p of ['whatsapp', 'linkedin', 'x', 'email'] as const) expect(manualNoteAr(p), p).toMatch(/فأرفقها/)
  })
  /* «هل يمكن أن تُرفق الصورةُ تلقائيّا عند النشر؟» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦) — نعم من الهاتف، لكلّ منصّة */
  it('⚠️ ومن الهاتف ترفق الصورة والنص معا لكل منصة — بلا «يدوي»', () => {
    for (const p of SHARE_PLATFORMS) {
      const n = manualNoteAr(p.id, true)
      expect(n, p.id).toContain('الصورة والنص معا')
      expect(n, p.id).not.toContain('يدوي')
    }
  })
  it('⚠️ والتنبيه في اللوحة نفسها قبل زر النشر', () => {
    const kit = readFileSync(join(process.cwd(), 'src/components/trainer/ShareKit.tsx'), 'utf8')
    const note = kit.indexOf('{manualNoteAr(platform, canAttach) && (')
    expect(note, 'لا تنبيه في اللوحة').toBeGreaterThan(-1)
    expect(note, 'التنبيه بعد زر النشر').toBeLessThan(kit.indexOf('`انشر على ${platformAr}`'))
    /* والهاتفُ يشارك الصورَ مع النصّ قبل أيّ رابط */
    expect(kit).toMatch(/if \(canAttach && navigator\.canShare\?\.\(\{ files: fs \}\)\) \{[\s\S]{0,120}navigator\.share\(\{ files: fs, text/)
  })
})

/* «أضف إيميلا كدعاية يستخدمها المدرّب إن أراد أن يرسل الدعاية عبر الإيميل» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦) */
describe('البريد', () => {
  const x = { ...one, signature: 'صهيب لافي' }
  it('⚠️ رسالة بتحية ودعوة وتوقيع باسمه، وعنوان يقول الدورة والخصم', () => {
    const t = shareText('email', x)
    expect(t.startsWith('مرحبا،')).toBe(true)
    expect(t).toContain('مهارة الخطابة')
    expect(t).toContain('WJ30-K7Q2MX')
    expect(t).toContain(URL_ONE)
    expect(t.trim().endsWith('صهيب لافي'), 'بلا توقيع').toBe(true)
    expect(t, 'وسوم في بريد').not.toContain('#')
    expect(emailSubject(x)).toBe('دعوة إلى دورة «مهارة الخطابة» — وخصم 30٪ لك')
  })
  it('⚠️ وبابه بريده برسالته جاهزة — يختار هو لمن يرسلها', () => {
    const door = shareUrl('email', x)!
    expect(door.startsWith('mailto:?')).toBe(true)
    const q = new URLSearchParams(door.slice('mailto:?'.length))
    expect(q.get('subject')).toBe(emailSubject(x))
    expect(q.get('body')).toBe(shareText('email', x))
  })
})

/* «أضف معاينة، نعم» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦): رابطُه إذا لُصق ظهرت صورتُه المصمَّمة. والعلّةُ في
   `server/services/link-preview.ts`، وما يقع في القاعدة يحرسه `server/tests/commerce/trainer-share-code.test.ts`. */
describe('معاينة الرابط حين يلصق', () => {
  const face = { name: 'صهيب لافي', headline: null, photoUrl: null, code: { code: 'WJ30-K7Q2MX', percentOff: 30 } }
  const courses = [{ courseTitle: 'مهارة الخطابة', startsAt: '2026-12-01T15:00:00Z' }]

  it('⚠️ البصمة ثابتة لما لم يتغير، وتتغير بتغير الموعد أو الكود — فلا ترفع كل زيارة ولا تبقى قديمة', () => {
    const sig = previewSig(face, courses)
    expect(previewSig(face, courses)).toBe(sig)
    expect(previewSig(face, [{ ...courses[0], startsAt: '2026-12-02T15:00:00Z' }])).not.toBe(sig)
    expect(previewSig({ ...face, code: null }, courses)).not.toBe(sig)
    expect(sig.length, 'البصمة أطول مما يحفظه الخادم').toBeLessThanOrEqual(64)
  })

  it('⚠️ وCaddy يمرر الرابط القصير إلى الخادم قبل الواجهة — وإلا قرأ الزاحف وسوم الرئيسة', () => {
    const caddy = readFileSync(join(process.cwd(), 'deploy/Caddyfile'), 'utf8')
    const short = caddy.search(/handle \/s\/\* \{\s*reverse_proxy app:7101/)
    const spa = caddy.search(/try_files \{path\} \{path\}\.html \/index\.html/)
    expect(short, 'لا كتلة للروابط القصيرة إلى الخادم').toBeGreaterThan(-1)
    expect(short, 'كتلة الروابط القصيرة بعد الواجهة فلا تبلغ').toBeLessThan(spa)
  })

  it('وصفحته ترسم المعاينة وترفعها لروابطه', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/trainer/Referral.tsx'), 'utf8')
    expect(page).toMatch(/void syncLinkPreviews\(\{[\s\S]{0,300}\}, links, kit\.previews \?\? \{\}\)/)
    expect(artPlan('post', 3).some((p) => p.kind === 'link'), 'المعاينة صارت تنزل مع المنشور').toBe(false)
  })
})
