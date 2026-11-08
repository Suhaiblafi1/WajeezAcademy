/* «تعرّف على مدرّبك» — رابطُ فيديو المدرّب يصير إطارا نبنيه نحن، أو زرّا، أو لا شيء (٨ نوفمبر ٢٠٢٦).

   ═══ ما يُحرَس ═══

   ① كلُّ صيغةٍ معروفةٍ من يوتيوب وفيميو ودرايف تصير رابطَ تضمينٍ من أصلٍ ثابت — والمعرّفُ وحدَه يُنقل.
   ② ولا يدخل الإطارَ رابطٌ كتبه إنسان: معرّفٌ لا يطابق تعبيرَه يبقى زرّا، وما ليس https لا يُعرض.
   ③ وفيديو الدورة يغلب التعريف، والتعريفُ بديلُه، ولا شيءَ حين لا فيديو.
   ④ وما يصل الواجهةَ من الشبكة يُفحص بالدالّة نفسِها: إطارٌ لم نبنه لا يُرسم.

   والفحصُ على ناتج الدوالّ — لا على نصٍّ في ملفّ. */

import { describe, expect, it } from 'vitest'
import {
  pickPublicVideo, renderableVideo, videoEmbedOf, VIDEO_EMBED_ORIGINS, type MarketingVideoRow,
} from '@/application/trainer/marketing-video'

const YT = 'dQw4w9WgXcQ'
const YT_EMBED = `https://www.youtube-nocookie.com/embed/${YT}`
const DRIVE = '1aBcD_eFgHiJkLmNoPqRsTuVwXyZ01234'

describe('① كلُّ صيغةٍ معروفةٍ تصير رابطَ تضمينٍ من أصلٍ ثابت', () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://youtube.com/watch?v=${YT}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?si=abc`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    `https://www.youtube.com/live/${YT}`,
    YT_EMBED,
  ])('يوتيوب: %s', (url) => {
    expect(videoEmbedOf(url)).toEqual({ kind: 'embed', provider: 'youtube', src: YT_EMBED })
  })

  it.each([
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://www.vimeo.com/76979871?share=copy', 'https://player.vimeo.com/video/76979871'],
    ['https://vimeo.com/channels/staffpicks/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://player.vimeo.com/video/76979871', 'https://player.vimeo.com/video/76979871'],
    /* غيرُ المدرَج يحمل بصمتَه — بدونها لا يعمل إطارُه */
    ['https://vimeo.com/76979871/a1b2c3d4e5', 'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5'],
    ['https://player.vimeo.com/video/76979871?h=a1b2c3d4e5', 'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5'],
  ])('فيميو: %s', (url, src) => {
    expect(videoEmbedOf(url)).toEqual({ kind: 'embed', provider: 'vimeo', src })
  })

  it.each([
    `https://drive.google.com/file/d/${DRIVE}/view?usp=sharing`,
    `https://drive.google.com/file/d/${DRIVE}/view`,
    `https://drive.google.com/file/d/${DRIVE}/preview`,
    `https://drive.google.com/open?id=${DRIVE}`,
  ])('درايف: %s', (url) => {
    expect(videoEmbedOf(url)).toEqual({ kind: 'embed', provider: 'drive', src: `https://drive.google.com/file/d/${DRIVE}/preview` })
  })

  it('وكلُّ رابط تضمينٍ من الأصول الثلاثة المسموحة وحدَها — وهي ما يُضاف إلى `frame-src`', () => {
    const srcs = [`https://youtu.be/${YT}`, 'https://vimeo.com/76979871', `https://drive.google.com/open?id=${DRIVE}`]
      .map((u) => videoEmbedOf(u))
    for (const v of srcs) {
      expect(v?.kind).toBe('embed')
      if (v?.kind === 'embed') expect(new URL(v.src).origin).toBe(VIDEO_EMBED_ORIGINS[v.provider])
    }
  })
})

describe('② ولا يدخل الإطارَ رابطٌ كتبه إنسان', () => {
  it.each([
    'javascript:alert(1)',
    'http://youtu.be/dQw4w9WgXcQ',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/v.mp4',
    'لا رابط',
    '',
    '   ',
    'https://youtu.be/ dQw4w9WgXcQ',
    `https://example.com/${'a'.repeat(600)}`,
    null,
    42,
  ])('لا يُعرض أصلا: %s', (raw) => {
    expect(videoEmbedOf(raw)).toBeNull()
  })

  it.each([
    /* معرّفٌ بطولٍ خاطئ أو بحرفٍ غريب — يبقى زرّا لا إطارا */
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload=x',
    'https://youtu.be/dQw4w9WgXcQ/extra',
    'https://www.youtube.com/shorts/%3Cscript%3E',
    'https://www.youtube.com/playlist?list=PL123',
    'https://vimeo.com/user/12345',
    'https://vimeo.com/76979871/NOT-A-HASH',
    'https://drive.google.com/file/d/short/view',
    'https://drive.google.com/drive/folders/1aBcD_eFgHiJkLmNoPqRsTuVwXyZ01234',
    /* شبيهُ المضيف ليس هو */
    `https://youtube.com.evil.example/watch?v=${YT}`,
    `https://evil.example/youtu.be/${YT}`,
    `https://www.youtube.com:8443/watch?v=${YT}`,
    'https://www.instagram.com/reel/Cabc123/',
  ])('زرٌّ لا إطار: %s', (url) => {
    const v = videoEmbedOf(url)
    expect(v?.kind).toBe('link')
    if (v?.kind === 'link') expect(new URL(v.href).protocol).toBe('https:')
  })

  it('وناتجُ التضمين ثابتٌ عليه: رابطُ الإطار يُقرأ ثانيةً فيعطي نفسَه', () => {
    for (const u of [`https://youtu.be/${YT}`, 'https://vimeo.com/76979871/a1b2c3d4e5', `https://drive.google.com/open?id=${DRIVE}`]) {
      const once = videoEmbedOf(u)
      expect(once?.kind).toBe('embed')
      if (once?.kind === 'embed') expect(videoEmbedOf(once.src)).toEqual(once)
    }
  })
})

describe('③ فيديو الدورة يغلب التعريف، والتعريفُ بديلُه', () => {
  const bio: MarketingVideoRow = { targetKind: 'bio', targetId: '', url: `https://youtu.be/${YT}` }
  const course: MarketingVideoRow = { targetKind: 'course', targetId: 'C-1', url: 'https://vimeo.com/76979871' }
  const other: MarketingVideoRow = { targetKind: 'course', targetId: 'C-2', url: `https://drive.google.com/open?id=${DRIVE}` }
  const path: MarketingVideoRow = { targetKind: 'path', targetId: 'C-1', url: 'https://vimeo.com/11111111' }

  it('فيديو هذه الدورة أوّلا ولو سبقه التعريفُ في الصفوف', () => {
    expect(pickPublicVideo([bio, other, course], 'C-1')).toEqual(videoEmbedOf(course.url))
  })
  it('والتعريفُ حين لا فيديو لهذه الدورة — لا فيديو دورةٍ أخرى ولا مسار', () => {
    expect(pickPublicVideo([other, path, bio], 'C-1')).toEqual(videoEmbedOf(bio.url))
  })
  it('وصفحتُه هو (`null`): التعريفُ وحدَه', () => {
    expect(pickPublicVideo([course, bio], null)).toEqual(videoEmbedOf(bio.url))
    expect(pickPublicVideo([course], null)).toBeNull()
  })
  it('ولا شيءَ حين لا فيديو — لا صندوقَ فارغ', () => {
    expect(pickPublicVideo([], 'C-1')).toBeNull()
    expect(pickPublicVideo([other, path], 'C-1')).toBeNull()
  })
})

describe('④ ما يصل من الشبكة يُفحص قبل أن يُرسم', () => {
  it('إطارٌ بنيناه يمرّ كما هو', () => {
    const v = videoEmbedOf(`https://youtu.be/${YT}`)
    expect(renderableVideo(v)).toEqual(v)
    expect(renderableVideo({ kind: 'link', href: 'https://example.com/v' })).toEqual({ kind: 'link', href: 'https://example.com/v' })
  })
  it.each([
    { kind: 'embed', provider: 'youtube', src: 'https://evil.example/embed/dQw4w9WgXcQ' },
    { kind: 'embed', provider: 'youtube', src: `https://www.youtube.com/watch?v=${YT}` },
    { kind: 'embed', provider: 'youtube', src: 'javascript:alert(1)' },
    { kind: 'link', href: 'javascript:alert(1)' },
    { kind: 'link', href: 'http://example.com' },
    { kind: 'other', src: YT_EMBED },
    null,
    'https://youtu.be/dQw4w9WgXcQ',
  ])('ويُردّ ما لم نبنه: %j', (v) => {
    expect(renderableVideo(v)).toBeNull()
  })
})
