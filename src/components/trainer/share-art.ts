/* ═══ صورُ «شارك دوراتك» — تُرسم في متصفّح المدرّب (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «صورة احترافيّة بسيطة فيها صورته وفيها معلومات عن دورته، ولا تكون مكتظّةً بالكلام، وتشجّع
   الناس على الدخول»، و«إنستغرام… الكاروسيل، أو ستوري». فلكلّ منشورٍ مقاسُ منصّته:

   · **منشور** مربّع ١٠٨٠×١٠٨٠ — لينكدإن وفيسبوك وإنستغرام.
   · **ستوري** ١٠٨٠×١٩٢٠ — إنستغرام وتيك توك وحالة واتساب.
   · **كاروسيل** شرائحُ ١٠٨٠×١٣٥٠ — غلافٌ بصورته، وشريحةٌ لكلّ دورة، وشريحةٌ للخصم.

   ═══ التصميمُ الأوّلُ باقٍ، والمحتوى جديد (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة عن الصور: «نصوصُ الدورات مقصوصة.. أضف أنّ الدورات بثٌّ مباشر وبعضَ الأمور التسويقيّة». فجُرّب
   تصميمٌ داكن، فقال: «لم تعجبني تصاميمُك الجديدة.. أبقِ القديمة وغيّر المحتوى فقط، وآليّةَ عرض الدورات وباقي المحتوى
   الجديد». فالشكلُ شكلُه الأوّل — أرضيّةُ الورق، والشريطُ الفيروزيّ، وشارةُ وجيز، والصورةُ بحلقتها الفيروزيّة،
   وشارةُ الخصم الذهبيّة — وما فيه جديد:
   · **أسماءُ الدورات كاملة** — يصغر الخطُّ حتّى يسعها ولا يُقصّ (`fitLines`)، ويصغر المحتوى كلُّه معا إن ضاق
     (`courseBlock`). ووعدُ الدورة الواحدة تحت اسمها، وموعدُ كلِّ دورةٍ تحتها.
   · **«بث مباشر»** شارةً حمراءَ في الرأس، و**ثلاثُ مزايا صادقة** (`ART_PERKS`): بثٌّ مباشرٌ على Zoom، وتسجيلُ كلّ
     لقاء، وشهادةٌ موثّقة — ممّا تقدّمه المنصّة فعلا — و**«المقاعد محدودة»**.

   ولمَ في المتصفّح لا في الخادم: الخطُّ العربيُّ للمنصّة محمَّلٌ فيه أصلا، والحرفُ يُشكَّل ويُوصَل كما في الصفحة؛
   والخادمُ بلا محرّكِ رسمٍ يُضاف له. والصورةُ من مسار المنصّة نفسِها (`photoPublicUrl`) فلا تُلوِّث اللوحَ — وإن
   تعذّرت رُسم الحرفُ الأوّلُ من اسمه في دائرة. وكلُّ صورةٍ ملفُّ PNG يُنزَّل أو يُشارَك من الهاتف. */

import { splitTitle } from '@/application/trainer/share-kit'

export type ArtKind = 'post' | 'story' | 'cover' | 'course' | 'offer'

export interface ArtData {
  name: string
  /** مسمّاه المهنيّ — سطرٌ تحت اسمه إن كان */
  headline?: string | null
  photoUrl: string | null
  courses: { courseTitle: string; startsAt: string | null }[]
  code: { code: string; percentOff: number } | null
  /** «31 أكتوبر» */
  dayAr: (iso: string) => string
  /** «www.wajeezacademy.com» */
  host: string
}

const SIZE: Record<ArtKind, [number, number]> = {
  post: [1080, 1080], story: [1080, 1920], cover: [1080, 1350], course: [1080, 1350], offer: [1080, 1350],
}

const C = { paper: '#F5F3EE', ink: '#1F2A2E', muted: '#5C6B70', teal: '#38A7B4', tealInk: '#1A5C64', gold: '#FABC05', white: '#FFFFFF', live: '#E5484D' }
const FONT = '"Avenir Arabic", "IBM Plex Sans Arabic", "Neo Sans Arabic", system-ui, sans-serif'
const font = (weight: number, px: number) => `${weight} ${px}px ${FONT}`

/** المزايا — ممّا تقدّمه المنصّةُ فعلا: البثُّ على Zoom، والتسجيلُ في «مصادر هذه المرحلة»، والشهادةُ الموثّقةُ بشروط إنجاز */
export const ART_PERKS = ['بث مباشر على Zoom', 'تسجيل كل لقاء', 'شهادة موثقة'] as const

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** يلفّ النصَّ على عرضٍ بالخطّ المضبوط */
function wrapAt(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= width || !line) line = next
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  return lines
}

/** النصُّ كاملا في سطورٍ لا تزيد — يصغر الخطُّ حتّى يسعه، ولا يُقصّ إلّا إن لم يسعه أصغرُ خطّ */
export function fitLines(
  ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number, maxPx: number, minPx: number, weight = 700,
): { px: number; lines: string[] } {
  for (let px = Math.round(maxPx); px >= minPx; px -= 2) {
    ctx.font = font(weight, px)
    const lines = wrapAt(ctx, text, width)
    if (lines.length <= maxLines) return { px, lines }
  }
  ctx.font = font(weight, minPx)
  const lines = wrapAt(ctx, text, width)
  /* وما لم يسعه أصغرُ خطٍّ يُقطع على كلمةٍ تامّة */
  const kept = lines.slice(0, maxLines)
  const words = kept[maxLines - 1].split(' ')
  while (words.length > 1 && ctx.measureText(`${words.join(' ')}…`).width > width) words.pop()
  kept[maxLines - 1] = `${words.join(' ')}…`
  return { px: minPx, lines: kept }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** صورتُه في دائرةٍ بحلقةٍ فيروزيّة — أو حرفُه الأوّل إن لم تكن */
function portrait(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2)
  ctx.fillStyle = C.teal
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    /* تُقصّ على مربّع، وأعلى الصورة الطويلة أولى بالبقاء — فيه الوجه */
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.2 : (img.naturalHeight - side) / 2
    ctx.drawImage(img, (img.naturalWidth - side) / 2, sy, side, side, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = C.tealInk
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = C.white
    ctx.font = font(700, r)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name.trim().charAt(0), cx, cy)
  }
  ctx.restore()
}

interface PillStyle { px: number; bg?: string; fg: string; border?: string; dot?: string; weight?: number }

function pillWidth(ctx: CanvasRenderingContext2D, text: string, o: PillStyle): number {
  ctx.font = font(o.weight ?? 700, o.px)
  return ctx.measureText(text).width + o.px * 1.6 + (o.dot ? o.px * 0.9 : 0)
}

/** شارةٌ مستديرة، و`right` حافّتُها اليمنى */
function pill(ctx: CanvasRenderingContext2D, text: string, right: number, y: number, o: PillStyle) {
  const w = pillWidth(ctx, text, o)
  const pad = o.px * 0.8
  const h = o.px * 1.9
  const left = right - w
  roundRect(ctx, left, y, w, h, h / 2)
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fill() }
  if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 2.5; ctx.stroke() }
  if (o.dot) {
    ctx.fillStyle = o.dot
    ctx.beginPath(); ctx.arc(right - pad - o.px * 0.3, y + h / 2, o.px * 0.28, 0, Math.PI * 2); ctx.fill()
  }
  ctx.font = font(o.weight ?? 700, o.px)
  ctx.fillStyle = o.fg
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, right - pad - (o.dot ? o.px * 0.9 : 0), y + h / 2 + o.px * 0.06)
  ctx.textBaseline = 'alphabetic'
}

/** المزايا شاراتٌ بإطارٍ فيروزيٍّ في صفٍّ وسطَ عرضه */
function perks(ctx: CanvasRenderingContext2D, cx: number, y: number, px: number) {
  const style: PillStyle = { px, fg: C.tealInk, border: C.teal, dot: C.gold, weight: 500 }
  const widths = ART_PERKS.map((t) => pillWidth(ctx, t, style))
  const gap = px * 0.6
  let right = cx + (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2
  ART_PERKS.forEach((t, i) => { pill(ctx, t, right, y, style); right -= widths[i] + gap })
  ctx.textAlign = 'center'
}

/** شارةُ الخصم الذهبيّة: «خصم 30٪ بالكود WJ30-ABCDEF» — أو «المقاعد محدودة» بلا خصم */
function codePill(ctx: CanvasRenderingContext2D, code: ArtData['code'], cx: number, y: number, px: number) {
  ctx.font = font(700, px)
  /* و«٪» العربيّةُ لا «%»: اللاتينيّةُ تنقلب في السطر العربيّ فتُقرأ «%30» مرّةً و«30%» مرّة */
  const text = code ? `خصم ${code.percentOff}٪ بالكود ${code.code}` : 'سجل الآن — المقاعد محدودة'
  const w = ctx.measureText(text).width + px * 1.6
  const h = px * 2
  roundRect(ctx, cx - w / 2, y, w, h, h / 2)
  ctx.fillStyle = C.gold
  ctx.fill()
  ctx.fillStyle = C.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2 + px * 0.05)
  ctx.textBaseline = 'alphabetic'
}

/** الرأس: علامةُ وجيز واسمُها، و«بث مباشر» حمراءُ يسارا — والذيل: عنوانُ الموقع */
function frame(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, w: number, h: number, host: string) {
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = C.teal
  ctx.fillRect(0, 0, w, 14)
  if (logo) ctx.drawImage(logo, w - 140, 56, 84, 84)
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, 38)
  ctx.textAlign = 'right'
  ctx.fillText('أكاديمية وجيز', w - 160, 112)
  const live: PillStyle = { px: 30, bg: C.live, fg: C.white, dot: C.white }
  pill(ctx, 'بث مباشر', 56 + pillWidth(ctx, 'بث مباشر', live), 70, live)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.muted
  ctx.font = font(500, 32)
  ctx.fillText(host, w / 2, h - 60)
}

const startsAr = (c: ArtData['courses'][number], dayAr: ArtData['dayAr']) => (c.startsAt ? `تبدأ ${dayAr(c.startsAt)}` : 'موعدها قريبا')

/* ═══ آليّةُ عرض الدورات — كاملةً بين حدّين ═══
   الدورةُ الواحدة: اسمُها كبيرا، ووعدُها تحته، وموعدُها. والدوراتُ الكثيرة: اسمُ كلٍّ (ما قبل النقطتين) وموعدُها تحته.
   ويُقاس الكلُّ أوّلا: فإن لم يسعه ما بين `top` و`bottom` صغُر كلُّه معا — لا يُقصّ اسمٌ ليتّسع غيرُه. */
function courseBlock(
  ctx: CanvasRenderingContext2D, d: ArtData, courses: ArtData['courses'], cx: number, top: number, bottom: number,
  width: number, base: number,
) {
  type Line = { text: string; px: number; weight: number; color: string; gap: number }
  const build = (s: number): Line[] => {
    const out: Line[] = []
    if (courses.length === 1) {
      const { name, promise } = splitTitle(courses[0].courseTitle)
      const t = fitLines(ctx, name, width, 3, base * 1.15 * s, base * 0.75 * s)
      t.lines.forEach((l) => out.push({ text: l, px: t.px, weight: 700, color: C.tealInk, gap: t.px * 1.3 }))
      if (promise) {
        const p = fitLines(ctx, promise, width, 3, base * 0.62 * s, base * 0.5 * s, 500)
        p.lines.forEach((l, i) => out.push({ text: l, px: p.px, weight: 500, color: C.ink, gap: p.px * 1.45 + (i === 0 ? base * 0.2 * s : 0) }))
      }
      out.push({ text: startsAr(courses[0], d.dayAr), px: base * 0.62 * s, weight: 500, color: C.muted, gap: base * 0.62 * s * 1.6 + base * 0.3 * s })
    } else {
      courses.forEach((c, i) => {
        const t = fitLines(ctx, splitTitle(c.courseTitle).name, width, 2, base * 0.78 * s, base * 0.56 * s)
        t.lines.forEach((l, k) => out.push({ text: l, px: t.px, weight: 700, color: C.tealInk, gap: t.px * 1.28 + (i > 0 && k === 0 ? base * 0.4 * s : 0) }))
        out.push({ text: startsAr(c, d.dayAr), px: base * 0.5 * s, weight: 500, color: C.muted, gap: base * 0.5 * s * 1.5 })
      })
    }
    return out
  }
  const total = (ls: Line[]) => ls.reduce((a, l) => a + l.gap, 0)
  let lines = build(1)
  for (let s = 0.95; s >= 0.6 && total(lines) > bottom - top; s -= 0.05) lines = build(s)
  /* وسطَ ما بين الحدّين — فلا فراغَ كبيرٌ تحته */
  let y = top + Math.max(0, (bottom - top - total(lines)) / 2)
  ctx.textAlign = 'center'
  for (const l of lines) {
    y += l.gap
    ctx.font = font(l.weight, l.px)
    ctx.fillStyle = l.color
    ctx.fillText(l.text, cx, y - l.gap * 0.22)
  }
}

/** اسمُه ومسمّاه — ويُرجع أسفلَهما */
function nameBlock(ctx: CanvasRenderingContext2D, d: ArtData, cx: number, y: number, px: number, width: number): number {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  const n = fitLines(ctx, d.name, width, 1, px, px - 14)
  ctx.font = font(700, n.px)
  ctx.fillText(n.lines[0], cx, y)
  if (!d.headline) return y
  const hl = fitLines(ctx, d.headline, width, 1, px * 0.56, px * 0.44, 500)
  ctx.font = font(500, hl.px)
  ctx.fillStyle = C.muted
  ctx.fillText(hl.lines[0], cx, y + hl.px * 1.5)
  return y + hl.px * 1.5
}

/** يرسم صورةً بعينها — وللكاروسيل `index` الدورةُ التي تُرسم شريحتُها */
export async function drawArt(kind: ArtKind, d: ArtData, index = 0): Promise<HTMLCanvasElement> {
  const [w, h] = SIZE[kind]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  await Promise.all([document.fonts.load(font(700, 40)), document.fonts.load(font(500, 40))]).catch(() => undefined)
  const [logo, photo] = await Promise.all([
    loadImage('/logo-mark.png'),
    d.photoUrl && (kind === 'post' || kind === 'story' || kind === 'cover') ? loadImage(d.photoUrl) : Promise.resolve(null),
  ])
  ctx.direction = 'rtl'
  frame(ctx, logo, w, h, d.host)
  ctx.textAlign = 'center'
  const cx = w / 2
  const one = d.courses[index] ?? d.courses[0]
  const many = d.courses.length > 1

  if (kind === 'post') {
    const r = 108
    portrait(ctx, photo, d.name, cx, 262, r)
    const below = nameBlock(ctx, d, cx, 262 + r + 72, 48, w - 200)
    ctx.fillStyle = C.teal
    ctx.font = font(700, 30)
    ctx.fillText(many ? 'دوراتي بث مباشر هذا الموسم' : 'أقدم دورة بث مباشر', cx, below + 50)
    courseBlock(ctx, d, d.courses.slice(0, 3), cx, below + 64, h - 282, w - 180, 48)
    perks(ctx, cx, h - 268, 22)
    codePill(ctx, d.code, cx, h - 196, 32)
  } else if (kind === 'story') {
    const r = 190
    portrait(ctx, photo, d.name, cx, 440, r)
    const below = nameBlock(ctx, d, cx, 440 + r + 100, 60, w - 200)
    ctx.fillStyle = C.teal
    ctx.font = font(700, 40)
    ctx.fillText(many ? 'دوراتي بث مباشر هذا الموسم' : 'أقدم دورة بث مباشر', cx, below + 76)
    courseBlock(ctx, d, d.courses.slice(0, 5), cx, below + 96, h - 560, w - 160, 66)
    perks(ctx, cx, h - 520, 28)
    codePill(ctx, d.code, cx, h - 420, 44)
    ctx.fillStyle = C.ink
    ctx.font = font(700, 46)
    ctx.fillText('سجل الآن — الرابط في البايو', cx, h - 230)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 34)
    ctx.fillText('المقاعد محدودة', cx, h - 165)
  } else if (kind === 'cover') {
    portrait(ctx, photo, d.name, cx, 470, 230)
    const below = nameBlock(ctx, d, cx, 830, 64, w - 200)
    ctx.fillStyle = C.tealInk
    ctx.font = font(700, 52)
    ctx.fillText(many ? `${d.courses.length} دورات بث مباشر هذا الموسم` : 'دورتي بث مباشر هذا الموسم', cx, below + 90)
    perks(ctx, cx, below + 130, 26)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 38)
    ctx.fillText('اسحب للتفاصيل ←', cx, h - 150)
  } else if (kind === 'course') {
    ctx.fillStyle = C.teal
    roundRect(ctx, 90, 230, w - 180, 760, 48)
    ctx.fill()
    ctx.fillStyle = C.white
    ctx.font = font(500, 40)
    ctx.fillText(many ? `دورة ${index + 1} من ${d.courses.length} · بث مباشر` : 'دورة بث مباشر', cx, 330)
    /* اسمُها كاملا ووعدُها تحته، يصغران حتّى تسعهما البطاقة — وموعدُها في أسفلها */
    const { name, promise } = splitTitle(one.courseTitle)
    const t = fitLines(ctx, name, w - 300, 3, 72, 48)
    ctx.font = font(700, t.px)
    let y = 450
    t.lines.forEach((l) => { ctx.fillText(l, cx, y); y += t.px * 1.3 })
    if (promise) {
      const p = fitLines(ctx, promise, w - 320, 3, 40, 30, 500)
      ctx.font = font(500, p.px)
      y += 10
      p.lines.forEach((l) => { ctx.fillText(l, cx, y); y += p.px * 1.45 })
    }
    ctx.font = font(700, 44)
    ctx.fillText(startsAr(one, d.dayAr), cx, Math.max(y + 30, 920))
    perks(ctx, cx, 1050, 28)
    ctx.fillStyle = C.ink
    ctx.font = font(700, 42)
    ctx.fillText('المقاعد محدودة — احجز مكانك', cx, 1200)
  } else {
    ctx.fillStyle = C.ink
    ctx.font = font(700, 60)
    ctx.fillText(d.code ? 'هدية لمن يتابعني' : 'سجل الآن', cx, 360)
    if (d.code) {
      ctx.fillStyle = C.gold
      ctx.font = font(700, 260)
      ctx.fillText(`${d.code.percentOff}٪`, cx, 660)
      ctx.fillStyle = C.ink
      ctx.font = font(700, 54)
      ctx.fillText('خصم بالكود', cx, 780)
      ctx.fillStyle = C.tealInk
      ctx.font = font(700, 76)
      ctx.direction = 'ltr'
      ctx.fillText(d.code.code, cx, 900)
      ctx.direction = 'rtl'
    }
    ctx.fillStyle = C.ink
    ctx.font = font(700, 48)
    ctx.fillText('الرابط في البايو', cx, 1080)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 36)
    ctx.fillText('المقاعد محدودة', cx, 1150)
  }
  return canvas
}

/** الصورةُ ملفّا — يُنزَّل أو يُشارَك */
export function toFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(new File([b], name, { type: 'image/png' })) : reject(new Error('تعذر رسم الصورة'))), 'image/png')
  })
}

/** ما يُرسم لكلّ صيغة: صورةٌ واحدةٌ للمنشور والستوري، وشرائحُ للكاروسيل */
export function artPlan(format: 'post' | 'story' | 'carousel', courses: number): { kind: ArtKind; index: number }[] {
  if (format !== 'carousel') return [{ kind: format, index: 0 }]
  return [
    { kind: 'cover', index: 0 },
    ...Array.from({ length: Math.max(1, Math.min(courses, 8)) }, (_, i) => ({ kind: 'course' as const, index: i })),
    { kind: 'offer', index: 0 },
  ]
}
