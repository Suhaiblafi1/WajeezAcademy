/* فيديو المدرّب نافذةٌ صغيرةٌ تكبر بضغطة — لا إطارٌ قبل الضغط (٩ نوفمبر ٢٠٢٦).

   قال صاحبُ المنصّة عن الإطار الكبير المضمَّن: «غير احترافي.. اجعله بشاشة أصغر وكأنك تقوم بعمل زوم». فصار نافذةَ
   مشاركٍ بصورة المدرّب (`src/components/TrainerVideo.tsx`)، والمشغّلُ لا يوجد حتى يُضغط.

   ═══ ما يُحرَس، على المكوّن نفسِه مُصيَّرا ═══

   ① النافذةُ الصغيرة: زرٌّ باسمه، بصورته من أصلنا — **ولا إطارَ ولا شيءَ من يوتيوب** (لا صورةً مصغّرة) قبل الضغط.
   ② والمشغّلُ المفتوح: إطارٌ رابطُه `playerSrcOf` بالتشغيل التلقائيّ، ويسمح بالتشغيل التلقائيّ.
   ③ والرابطُ الذي لا يُضمَّن يبقى زرّا يفتحه — بلا نافذة.

   ولا بيئةَ DOM في اختبارات هذا المستودَع (`modal-focus-once.test.ts`)، فالضغطُ وEsc والإغلاقُ بالخلفيّة قيست في
   متصفّحٍ حقيقيّ على صفحة الدورة: لا إطارَ قبل الضغط، وإطارٌ واحدٌ بعده والتركيزُ على «إغلاق»، وبعد Esc لا إطارَ والتركيزُ
   عائدٌ إلى النافذة الصغيرة. والإغلاقُ نفسُه من `Modal` المنصّة المحروسِ هناك.

   رُئي ساقطا: وُضع الإطارُ في النافذة الصغيرة فسقط ①، وأُعطي المشغّلُ `video.src` بلا معاملاته فسقط ②، وحُذف `autoplay` من `allow` فسقط ثانيه، ورُسمت النافذةُ
   للرابط فسقط ③. */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TrainerVideoCard, TrainerVideoPlayerWindow } from '@/components/TrainerVideo'
import { playerSrcOf, videoEmbedOf } from '@/application/trainer/marketing-video'

const SHORTS = videoEmbedOf('https://www.youtube.com/shorts/dQw4w9WgXcQ')
if (SHORTS?.kind !== 'embed') throw new Error('الشورتس لم يُبن تضمينا')
const PHOTO = '/api/v1/trainer-photos/abc'
const NAME = 'انوار ابراهيم الجراح'

/** المُصيَّر مفكوكا: عناصرُ بأسمائها وسماتها — لا ورودُ حرفٍ في نصّ */
function parse(html: string) {
  const tags = [...html.matchAll(/<([a-z]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g)].map((m) => ({
    tag: m[1]!,
    attrs: Object.fromEntries([...m[2]!.matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, (a[2] ?? '').replace(/&amp;/g, '&')])),
  }))
  return { tags, of: (tag: string) => tags.filter((t) => t.tag === tag) }
}

describe('① النافذةُ الصغيرة قبل الضغط', () => {
  const html = renderToStaticMarkup(createElement(TrainerVideoCard, { video: SHORTS, name: NAME, headline: 'مدربة', photoUrl: PHOTO }))
  const dom = parse(html)

  it('⚠️ لا إطارَ قبل الضغط', () => {
    expect(dom.of('iframe')).toEqual([])
  })

  it('⚠️ ولا طلبَ إلى المزوّد: لا رابطَ من يوتيوب في أيّ سمة', () => {
    const urls = dom.tags.flatMap((t) => [t.attrs.src, t.attrs.href, t.attrs.srcset]).filter(Boolean)
    for (const u of urls) expect(u).not.toMatch(/youtube|ytimg|vimeo|drive\.google/)
  })

  it('⚠️ زرٌّ باسمه يشغّله، وخلفيّتُه صورتُه من أصلنا', () => {
    expect(dom.of('button').map((b) => b.attrs['aria-label'])).toContain(`شغل الفيديو التعريفي: ${NAME}`)
    expect(dom.of('img').map((i) => i.attrs.src)).toEqual([PHOTO])
  })

  it('وبلا صورة: لا صورةَ مكسورة — حرفُه', () => {
    const none = parse(renderToStaticMarkup(createElement(TrainerVideoCard, { video: SHORTS, name: NAME, photoUrl: null })))
    expect(none.of('img')).toEqual([])
    expect(none.of('iframe')).toEqual([])
  })
})

describe('② المشغّلُ المفتوح', () => {
  const html = renderToStaticMarkup(createElement(TrainerVideoPlayerWindow, {
    video: SHORTS, name: NAME, photoUrl: PHOTO, from: { x: 0, y: 0 }, onClose: () => undefined,
  }))
  const frames = parse(html).of('iframe')

  it('⚠️ إطارٌ واحدٌ رابطُه رابطُ المشغّل بالتشغيل التلقائيّ', () => {
    expect(frames.map((f) => f.attrs.src)).toEqual([playerSrcOf(SHORTS)])
    expect(new URL(frames[0]!.attrs.src!).searchParams.get('autoplay')).toBe('1')
  })

  it('⚠️ ويسمح بالتشغيل التلقائيّ', () => {
    expect(frames[0]!.attrs.allow?.split(/;\s*/)).toContain('autoplay')
  })

  it('وزرُّ «إغلاق»', () => {
    expect(parse(html).of('button').map((b) => b.attrs['aria-label'])).toContain('إغلاق')
  })
})

describe('③ والرابطُ الذي لا يُضمَّن زرٌّ يفتحه', () => {
  it('⚠️ بلا نافذة ولا إطار', () => {
    const dom = parse(renderToStaticMarkup(createElement(TrainerVideoCard, {
      video: { kind: 'link', href: 'https://www.instagram.com/reel/Cabc123/' }, name: NAME, photoUrl: PHOTO,
    })))
    expect(dom.of('iframe')).toEqual([])
    expect(dom.of('button')).toEqual([])
    expect(dom.of('a').map((a) => a.attrs.href)).toEqual(['https://www.instagram.com/reel/Cabc123/'])
  })
})

describe('⑤ شارةُ الاسم فوق المشغّل — «النمط ٢» على يوتيوب (٩ نوفمبر ٢٠٢٦)', () => {
  const html = renderToStaticMarkup(createElement(TrainerVideoPlayerWindow, {
    video: SHORTS, name: NAME, headline: 'مدربة كوتشنج', photoUrl: PHOTO, from: { x: 0, y: 0 }, onClose: () => {},
  }))
  const { tags } = parse(html)
  const tag = tags.find((t) => 'data-video-name-tag' in t.attrs)

  it('⚠️ الشارةُ تُرسم مع المشغّل بالشعار والاسم القصير والوصف', () => {
    expect(tag).toBeDefined()
    expect(tags.some((t) => t.tag === 'img' && t.attrs.src === '/logo-mark.png')).toBe(true)
    expect(html).toContain('انوار الجراح')
    expect(html).toContain('مدربة كوتشنج')
  })
  it('⚠️ وفي منتصف المشغّل أفقيّا — لا على أحد جانبيه', () => {
    const cls = tag!.attrs.class!.split(/\s+/)
    expect(cls).toEqual(expect.arrayContaining(['left-1/2', '-translate-x-1/2']))
    expect(cls.some((c) => /^(right|left)-\d/.test(c) && c !== 'left-1/2')).toBe(false)
  })
  it('⚠️ ولا تحجب أزرارَ يوتيوب تحتها — لا تلتقط لمسا', () => {
    expect(tag!.attrs.class!.split(/\s+/)).toContain('pointer-events-none')
  })
  it('⚠️ وتعلو الإطارَ لا تُرسم تحته — بعده في الشجرة وبطبقةٍ أعلى', () => {
    const iframe = tags.findIndex((t) => t.tag === 'iframe')
    const at = tags.indexOf(tag!)
    expect(iframe).toBeGreaterThanOrEqual(0)
    expect(at).toBeGreaterThan(iframe)
    expect(tag!.attrs.class!.split(/\s+/)).toContain('z-10')
  })
})
