/* صورةُ المدرّب بحلقة الفيديو، وبطاقتُه المنبثقة (٩ نوفمبر ٢٠٢٦).

   قرارا صاحب المنصّة: في صفحة المدرّب يصير الفيديو حلقةَ «قصّة» حول صورته وشارةَ تشغيلٍ عليها ورابطا صغيرا تحت
   تعريفه (`src/components/trainer/TrainerAvatarRing.tsx`) — ومن لا فيديو له صفحتُه كما كانت. وحيث يُرى اسمُ مدرّبٍ أو
   صورتُه تفتح بطاقةٌ منبثقةٌ بنبذته وتخصّصاته ورابطِ صفحته، ويُشاهَد الفيديو فيها نفسِها
   (`src/components/trainer/TrainerQuickView.tsx`).

   ═══ ما يُحرَس، على المكوّن نفسِه مُصيَّرا ═══

   ① الحلقةُ والشارةُ وزرُّ التشغيل لما يُضمَّن وحدَه — والرابطُ الذي لا يُضمَّن بلا حلقة، يفتحه رابطٌ في لسانٍ جديد،
      ومن لا فيديو له صورتُه كما كانت. ولا إطارَ قبل الضغط.
   ② والبطاقةُ قبل التشغيل: لا إطار، وحلقةٌ على صورته، ورابطُ صفحته `/t/<slug>`، وأربعُ تخصّصاتٍ على الأكثر.
   ③ وفي التشغيل: إطارٌ واحدٌ بالتشغيل التلقائيّ مكانَ الصورة.
   ④ والدمج: فيديو الدورة يغلب تعريفَه، وبلا مسارٍ لا رابطَ صفحة.

   ولا بيئةَ DOM هنا (`modal-focus-once.test.ts`)؛ فالفتحُ والإغلاقُ والتشغيلُ في البطاقة وعودةُ التركيز قيست في متصفّحٍ
   حقيقيّ على Vite بواجهاتٍ محاكاة.

   رُئي ساقطا: رُسم المشغّلُ في البطاقة بلا ضغطٍ فسقط ② الأوّل، وأُعطيت الحلقةُ للرابط الذي لا يُضمَّن (`onPlay` لكلّ فيديو)
   فسقط ① الثاني، وأُزيل قصُّ التخصّصات فسقط ②، وحُذف رابطُ الصفحة فسقط ②، وصار فيديو الصفحة يغلب فيديو الدورة فسقط ④. */

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TrainerAvatarRing, TrainerPagePhoto, TrainerVideoLink } from '@/components/trainer/TrainerAvatarRing'
import { TrainerQuickViewCard } from '@/components/trainer/TrainerQuickView'
import { mergeQuickView, QUICK_VIEW_SPECIALTIES, type TrainerQuickViewData } from '@/application/trainer/quick-view'
import { playerSrcOf, videoEmbedOf, type PublicTrainerVideo } from '@/application/trainer/marketing-video'

const SHORTS = videoEmbedOf('https://www.youtube.com/shorts/dQw4w9WgXcQ')
const VIMEO = videoEmbedOf('https://vimeo.com/76979871')
if (SHORTS?.kind !== 'embed' || VIMEO?.kind !== 'embed') throw new Error('لم يُبن تضمين')
const LINK: PublicTrainerVideo = { kind: 'link', href: 'https://www.instagram.com/reel/Cabc123/' }
const PHOTO = '/api/v1/trainer-photos/abc'
const NAME = 'انوار ابراهيم الجراح'
const noop = () => undefined

/** المُصيَّر مفكوكا: عناصرُ بأسمائها وسماتها — لا ورودُ حرفٍ في نصّ */
function parse(html: string) {
  const tags = [...html.matchAll(/<([a-z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g)].map((m) => ({
    tag: m[1]!,
    attrs: Object.fromEntries([...m[2]!.matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, (a[2] ?? '').replace(/&amp;/g, '&')])),
  }))
  return {
    tags,
    of: (tag: string) => tags.filter((t) => t.tag === tag),
    marked: (attr: string) => tags.filter((t) => attr in t.attrs),
    text: html.replace(/<[^>]+>/g, ' '),
  }
}
const render = (el: ReactElement) => parse(renderToStaticMarkup(createElement(MemoryRouter, null, el)))

describe('① الحلقةُ لما يُضمَّن وحدَه', () => {
  it('⚠️ فيديو يُضمَّن: زرٌّ باسمه بحلقةٍ وشارة — ولا إطار', () => {
    const dom = render(createElement(TrainerPagePhoto, { name: NAME, photoUrl: PHOTO, video: SHORTS, onPlay: noop }))
    const ring = dom.marked('data-video-ring')
    expect(ring.map((b) => [b.tag, b.attrs['aria-label']])).toEqual([['button', `شغل الفيديو التعريفي: ${NAME}`]])
    expect(dom.marked('data-play-badge')).toHaveLength(1)
    expect(dom.of('img').map((i) => i.attrs.src)).toEqual([PHOTO])
    expect(dom.of('iframe')).toEqual([])
  })

  it('⚠️ رابطٌ لا يُضمَّن: صورتُه بلا حلقةٍ ولا زرّ — والرابطُ الصغير يفتحه في لسانٍ جديد', () => {
    const dom = render(createElement(TrainerPagePhoto, { name: NAME, photoUrl: PHOTO, video: LINK, onPlay: noop }))
    expect(dom.marked('data-video-ring')).toEqual([])
    expect(dom.marked('data-play-badge')).toEqual([])
    expect(dom.of('button')).toEqual([])
    expect(dom.of('img').map((i) => i.attrs.src)).toEqual([PHOTO])

    const link = render(createElement(TrainerVideoLink, { video: LINK, onPlay: noop }))
    expect(link.of('a').map((a) => [a.attrs.href, a.attrs.target, a.attrs.rel])).toEqual([[LINK.href, '_blank', 'noopener noreferrer']])
    expect(link.of('button')).toEqual([])
  })

  it('⚠️ بلا فيديو: صورتُه كما كانت قبل الفيديو — وبلا صورةٍ لا شيء', () => {
    const dom = render(createElement(TrainerPagePhoto, { name: NAME, photoUrl: PHOTO, video: null, onPlay: noop }))
    /* و`link` تقديمٌ مسبقٌ للصورة يضعه React في رأس الصفحة — ليس عنصرا هنا */
    expect(dom.tags.map((t) => t.tag).filter((t) => t !== 'link')).toEqual(['img'])
    expect(dom.of('img')[0]!.attrs.class).toBe('h-24 w-24 shrink-0 rounded-2xl object-cover')
    expect(render(createElement(TrainerPagePhoto, { name: NAME, photoUrl: null, video: null, onPlay: noop })).tags).toEqual([])
  })

  it('والحلقةُ بلا صورة: حرفُه داخلها — لا صورةَ مكسورة', () => {
    const dom = render(createElement(TrainerAvatarRing, { name: NAME, photoUrl: null, onPlay: noop }))
    expect(dom.marked('data-video-ring')).toHaveLength(1)
    expect(dom.of('img')).toEqual([])
  })
})

const BASE: TrainerQuickViewData = {
  name: NAME, slug: 'anwar-aljarrah', headline: 'مدربة تفاوض', photoUrl: PHOTO, country: 'الأردن',
  bio: 'عشر سنوات في التفاوض التجاري', specialties: ['التفاوض', 'الإقناع'], video: SHORTS,
}
const card = (data: Partial<TrainerQuickViewData>, extra: { playing?: boolean; status?: 'loading' | 'ready' | 'error' } = {}) =>
  render(createElement(TrainerQuickViewCard, {
    data: { ...BASE, ...data }, status: extra.status ?? 'ready', playing: extra.playing ?? false,
    onPlay: noop, onRetry: noop, onClose: noop,
  }))

describe('② البطاقةُ قبل التشغيل', () => {
  const dom = card({})

  it('⚠️ لا إطارَ قبل الضغط — ولا شيءَ من المزوّد', () => {
    expect(dom.of('iframe')).toEqual([])
    const urls = dom.tags.flatMap((t) => [t.attrs.src, t.attrs.href]).filter(Boolean)
    for (const u of urls) expect(u).not.toMatch(/youtube|ytimg|vimeo|drive\.google/)
  })

  it('⚠️ صورتُه بحلقة الفيديو، وزرُّ «شاهد الفيديو»', () => {
    expect(dom.marked('data-video-ring').map((b) => b.attrs['aria-label'])).toEqual([`شغل الفيديو التعريفي: ${NAME}`])
    expect(dom.text).toContain('شاهد الفيديو')
  })

  it('⚠️ ورابطُ صفحته كاملة', () => {
    expect(dom.of('a').map((a) => a.attrs.href)).toContain('/t/anwar-aljarrah')
  })

  it('⚠️ وأربعُ تخصّصاتٍ على الأكثر، وما زاد عددُه', () => {
    const many = ['أ', 'ب', 'ج', 'د', 'ه', 'و', 'ز']
    const list = card({ specialties: many }).tags
    const ul = list.findIndex((t) => t.tag === 'ul' && t.attrs['aria-label'] === 'التخصصات')
    expect(ul).toBeGreaterThan(-1)
    const items = card({ specialties: many }).text
    for (const s of many.slice(0, QUICK_VIEW_SPECIALTIES)) expect(items).toContain(` ${s} `)
    for (const s of many.slice(QUICK_VIEW_SPECIALTIES)) expect(items).not.toContain(` ${s} `)
    expect(items).toContain(`+${many.length - QUICK_VIEW_SPECIALTIES}`)
    expect(QUICK_VIEW_SPECIALTIES).toBe(4)
  })

  it('ورابطٌ لا يُضمَّن: بلا حلقة، و«شاهد الفيديو» يفتحه في لسانٍ جديد', () => {
    const link = card({ video: LINK })
    expect(link.marked('data-video-ring')).toEqual([])
    expect(link.of('iframe')).toEqual([])
    expect(link.of('a').filter((a) => a.attrs.href === LINK.href).map((a) => [a.attrs.target, a.attrs.rel]))
      .toEqual([['_blank', 'noopener noreferrer']])
  })

  it('وبلا فيديو: صورتُه بلا حلقةٍ ولا زرّ تشغيل', () => {
    const none = card({ video: null })
    expect(none.marked('data-video-ring')).toEqual([])
    expect(none.text).not.toContain('شاهد الفيديو')
  })

  it('وبلا مسار: لا رابطَ صفحة', () => {
    expect(card({ slug: null }).of('a').map((a) => a.attrs.href).filter((h) => h?.startsWith('/t/'))).toEqual([])
  })

  it('والتحميلُ هيكلٌ، والخطأُ «تعذر التحميل» بزرٍّ يعيد', () => {
    expect(card({ bio: null }, { status: 'loading' }).marked('data-skeleton')).toHaveLength(1)
    const err = card({ bio: null }, { status: 'error' })
    expect(err.text).toContain('تعذر التحميل')
    expect(err.text).toContain('أعد المحاولة')
  })
})

describe('③ وفي التشغيل: المشغّلُ مكانَ الصورة', () => {
  it('⚠️ إطارٌ واحدٌ بالتشغيل التلقائيّ — ولا صورةَ بحلقة', () => {
    const dom = card({}, { playing: true })
    expect(dom.of('iframe').map((f) => f.attrs.src)).toEqual([playerSrcOf(SHORTS)])
    expect(dom.of('iframe')[0]!.attrs.allow?.split(/;\s*/)).toContain('autoplay')
    expect(dom.marked('data-video-ring')).toEqual([])
    /* و‎9:16‎ لـ«شورتس»، و‎16:9‎ لغيره */
    expect(dom.marked('data-quick-view-player')[0]!.attrs.style).toContain('aspect-ratio:9 / 16')
    expect(card({ video: VIMEO }, { playing: true }).marked('data-quick-view-player')[0]!.attrs.style).toContain('aspect-ratio:16 / 9')
  })

  it('ورابطٌ لا يُضمَّن لا يُرسم له إطارٌ ولو طُلب', () => {
    expect(card({ video: LINK }, { playing: true }).of('iframe')).toEqual([])
  })
})

describe('④ الدمج', () => {
  const page = {
    slug: 'p', name: NAME, headline: 'ح', bio: 'نبذة', photoUrl: PHOTO, country: null, specialties: ['س'],
    video: { kind: 'embed', provider: 'vimeo', src: VIMEO.src },
  }

  it('⚠️ فيديو الدورة يغلب فيديو تعريفه — وبلاه فتعريفُه', () => {
    expect(mergeQuickView({ name: NAME, slug: 'p', video: SHORTS }, page).video).toEqual(SHORTS)
    expect(mergeQuickView({ name: NAME, slug: 'p', video: null }, page).video).toEqual(VIMEO)
    expect(mergeQuickView({ name: NAME, slug: 'p' }, page).video).toEqual(VIMEO)
  })

  it('وما لم نبنه لا يصير فيديو، وصورةٌ من غير أصلنا لا تُرسم', () => {
    const bad = mergeQuickView({ name: NAME, slug: null, video: { kind: 'embed', provider: 'youtube', src: 'https://evil.example/x' }, photoUrl: 'http://x/y.png' }, null)
    expect(bad.video).toBeNull()
    expect(bad.photoUrl).toBeNull()
    expect(bad.slug).toBeNull()
  })
})
