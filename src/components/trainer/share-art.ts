/* ═══ صورُ «شارك دوراتك» — تُرسم في متصفّح المدرّب (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «صورة احترافيّة بسيطة فيها صورته وفيها معلومات عن دورته، ولا تكون مكتظّةً بالكلام، وتشجّع
   الناس على الدخول»، و«إنستغرام… الكاروسيل، أو ستوري». فلكلّ منشورٍ مقاسُ منصّته:

   · **منشور** مربّع ١٠٨٠×١٠٨٠ — لينكدإن وفيسبوك وإنستغرام.
   · **ستوري** ١٠٨٠×١٩٢٠ — إنستغرام وتيك توك وحالة واتساب.
   · **كاروسيل** شرائحُ ١٠٨٠×١٣٥٠ — غلافٌ بصورته، وشريحةٌ لكلّ دورة، وشريحةٌ للخصم.

   ═══ ثمّ أُعيد تصميمُها (٢٦ أكتوبر ٢٠٢٦) ═══

   رآها صاحبُ المنصّة فقال: «تبدو نصوصا لا أكثر، غيرَ ملفتة.. ونصوصُ الدورات مقصوصة.. أضف أنّ الدورات بثٌّ مباشر
   وبعضَ الأمور التسويقيّة التي تجذب للشراء». فصارت:
   · **أرضيّةً فيروزيّةً داكنة** بلون العلامة ودوائرَ خفيفة — تُرى بين منشوراتٍ بيضاء.
   · **شارةَ «بث مباشر» حمراء** أعلاها، وصورتَه بحلقةٍ ذهبيّة، واسمَه ومسمّاه.
   · **الدوراتِ في بطاقةٍ فاتحةٍ باسمها كاملا** — يصغر الخطُّ حتّى يسعها ولا يُقصّ (`fitLines`)، ووعدُها تحتها في
     الدورة الواحدة، وموعدُها في شارة.
   · **ثلاثَ مزايا صادقة** (`ART_PERKS`): بثٌّ مباشرٌ على Zoom، وتسجيلُ كلّ لقاء، وشهادةٌ موثّقة — ممّا تقدّمه المنصّة فعلا.
   · **وقسيمةَ خصمٍ ذهبيّة** بنسبتها والكود في إطارٍ متقطّع، و«المقاعد محدودة».

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

const C = {
  deep: '#0B3338', deep2: '#17565E', teal: '#38A7B4', tealSoft: '#A9E0E6', tealInk: '#1A5C64',
  gold: '#FABC05', ink: '#14262A', muted: '#5C6B70', white: '#FFFFFF', paper: '#F5F3EE', line: '#E6E2D9',
  chip: '#E7F5F6', live: '#E5484D',
}
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
  for (let px = maxPx; px >= minPx; px -= 2) {
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

/** الأرضيّة: فيروزيٌّ داكنٌ متدرّج، ودوائرُ خفيفةٌ في زاويتين */
function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, C.deep2)
  g.addColorStop(1, C.deep)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = C.teal
  ctx.beginPath(); ctx.arc(w - 40, 120, 300, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(60, h - 80, 240, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.2
  ctx.strokeStyle = C.gold
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(150, 300, 64, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

interface PillStyle { px: number; bg?: string; fg: string; border?: string; dot?: string; center?: boolean; weight?: number }

function pillWidth(ctx: CanvasRenderingContext2D, text: string, o: PillStyle): number {
  ctx.font = font(o.weight ?? 700, o.px)
  return ctx.measureText(text).width + o.px * 1.6 + (o.dot ? o.px * 0.9 : 0)
}

/** شارةٌ مستديرة. و`x` حافّتُها اليمنى، أو وسطُها إن `center` */
function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: PillStyle) {
  const w = pillWidth(ctx, text, o)
  const pad = o.px * 0.8
  const h = o.px * 1.9
  const left = o.center ? x - w / 2 : x - w
  roundRect(ctx, left, y, w, h, h / 2)
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fill() }
  if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 2.5; ctx.stroke() }
  if (o.dot) {
    ctx.fillStyle = o.dot
    ctx.beginPath(); ctx.arc(left + w - pad - o.px * 0.3, y + h / 2, o.px * 0.28, 0, Math.PI * 2); ctx.fill()
  }
  ctx.font = font(o.weight ?? 700, o.px)
  ctx.fillStyle = o.fg
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + w - pad - (o.dot ? o.px * 0.9 : 0), y + h / 2 + o.px * 0.06)
  ctx.textBaseline = 'alphabetic'
}

/** صورتُه في دائرةٍ بحلقةٍ ذهبيّة — أو حرفُه الأوّل إن لم تكن */
function portrait(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2)
  ctx.fillStyle = C.gold; ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    /* تُقصّ على مربّع، وأعلى الصورة الطويلة أولى بالبقاء — فيه الوجه */
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.2 : 0
    ctx.drawImage(img, (img.naturalWidth - side) / 2, sy, side, side, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = C.teal
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = C.white
    ctx.font = font(700, r)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name.trim().charAt(0), cx, cy)
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()
}

/** الرأس: شارةُ وجيز يمينا، و«بث مباشر» حمراءُ يسارا */
function header(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, w: number, top = 56) {
  ctx.fillStyle = C.white
  roundRect(ctx, w - 136, top, 80, 80, 20); ctx.fill()
  if (logo) ctx.drawImage(logo, w - 128, top + 8, 64, 64)
  ctx.fillStyle = C.white
  ctx.font = font(700, 36)
  ctx.textAlign = 'right'
  ctx.fillText('أكاديمية وجيز', w - 156, top + 54)
  const live: PillStyle = { px: 30, bg: C.live, fg: C.white, dot: C.white }
  pill(ctx, 'بث مباشر', 56 + pillWidth(ctx, 'بث مباشر', live), top + 12, live)
}

/** المزايا شاراتٌ في صفٍّ وسطَ عرضه — أو بعضُها تحت بعض إن ضاق. ويُرجع أسفلَها */
function perks(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, px: number): number {
  const style: PillStyle = { px, fg: C.white, border: C.tealSoft, dot: C.gold, weight: 500 }
  const widths = ART_PERKS.map((t) => pillWidth(ctx, t, style))
  const gap = px * 0.6
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)
  const h = px * 1.9
  if (total <= width) {
    let right = cx + total / 2
    ART_PERKS.forEach((t, i) => { pill(ctx, t, right, y, style); right -= widths[i] + gap })
    return y + h
  }
  ART_PERKS.forEach((t, i) => pill(ctx, t, cx, y + i * (h + gap), { ...style, center: true }))
  return y + ART_PERKS.length * (h + gap) - gap
}

/** قسيمةُ الخصم الذهبيّة: النسبةُ يمينا والكودُ في إطارٍ متقطّع يسارا — أو دعوةٌ بلا خصم */
function coupon(ctx: CanvasRenderingContext2D, code: ArtData['code'], x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 28)
  ctx.fillStyle = C.gold
  ctx.fill()
  ctx.fillStyle = C.ink
  ctx.textBaseline = 'middle'
  if (!code) {
    ctx.font = font(700, h * 0.32)
    ctx.textAlign = 'center'
    ctx.fillText('سجل الآن — المقاعد محدودة', x + w / 2, y + h / 2)
    ctx.textBaseline = 'alphabetic'
    return
  }
  ctx.textAlign = 'right'
  ctx.font = font(700, h * 0.38)
  ctx.fillText(`خصم ${code.percentOff}٪`, x + w - 36, y + h * 0.4)
  ctx.font = font(500, h * 0.18)
  ctx.fillText('لمن يتابعني', x + w - 36, y + h * 0.77)
  /* والكودُ في إطارٍ متقطّعٍ كقسيمةٍ تُقصّ */
  ctx.font = font(700, h * 0.26)
  const cw = ctx.measureText(code.code).width + 56
  const bh = h * 0.56
  const bx = x + 28
  const by = y + (h - bh) / 2
  ctx.save()
  ctx.setLineDash([12, 9])
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 3
  roundRect(ctx, bx, by, cw, bh, 16)
  ctx.stroke()
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.direction = 'ltr'
  ctx.fillText(code.code, bx + cw / 2, by + bh / 2 + 2)
  ctx.direction = 'rtl'
  ctx.textBaseline = 'alphabetic'
}

const startsAr = (c: ArtData['courses'][number], dayAr: ArtData['dayAr']) => (c.startsAt ? `تبدأ ${dayAr(c.startsAt)}` : 'موعدها قريبا')

/** بطاقةُ الدورات — دورةٌ واحدةٌ باسمها كاملا ووعدِها، أو قائمةٌ مرقّمة. يُقاس المحتوى ثمّ تُرسم بقدره، وتُرجع أسفلَها */
function courseCard(
  ctx: CanvasRenderingContext2D, d: ArtData, courses: ArtData['courses'], x: number, y: number, w: number,
  o: { big: boolean; label: string },
): number {
  const pad = o.big ? 52 : 40
  const inner = w - pad * 2
  const right = x + w - pad
  const draws: (() => void)[] = []
  let cy = y + pad
  if (courses.length === 1) {
    const { name, promise } = splitTitle(courses[0].courseTitle)
    const lpx = o.big ? 30 : 26
    const ly = cy
    draws.push(() => pill(ctx, o.label, right, ly, { px: lpx, bg: C.teal, fg: C.white }))
    cy += lpx * 1.9 + 24
    const t = fitLines(ctx, name, inner, o.big ? 4 : 3, o.big ? 72 : 58, o.big ? 42 : 34)
    const ty = cy
    draws.push(() => {
      ctx.font = font(700, t.px); ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
      t.lines.forEach((l, i) => ctx.fillText(l, right, ty + i * t.px * 1.32))
      ctx.textBaseline = 'alphabetic'
    })
    cy += t.lines.length * t.px * 1.32 + 12
    if (promise) {
      const p = fitLines(ctx, promise, inner, 3, o.big ? 36 : 30, o.big ? 28 : 24, 500)
      const py = cy
      draws.push(() => {
        ctx.font = font(500, p.px); ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
        p.lines.forEach((l, i) => ctx.fillText(l, right, py + i * p.px * 1.45))
        ctx.textBaseline = 'alphabetic'
      })
      cy += p.lines.length * p.px * 1.45 + 8
    }
    const dpx = o.big ? 32 : 26
    const dy = cy + 12
    draws.push(() => pill(ctx, startsAr(courses[0], d.dayAr), right, dy, { px: dpx, bg: C.chip, fg: C.tealInk, dot: C.teal }))
    cy = dy + dpx * 1.9
  } else {
    const rowPx = o.big ? 42 : 32
    const num = o.big ? 60 : 50
    courses.forEach((c, i) => {
      if (i > 0) {
        const sy = cy + 2
        draws.push(() => { ctx.fillStyle = C.line; ctx.fillRect(x + pad, sy, inner, 2) })
        cy += 22
      }
      const ny = cy
      draws.push(() => {
        ctx.fillStyle = C.teal
        ctx.beginPath(); ctx.arc(right - num / 2, ny + num / 2, num / 2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = C.white; ctx.font = font(700, num * 0.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), right - num / 2, ny + num / 2 + 2)
        ctx.textBaseline = 'alphabetic'
      })
      const tx = right - num - 22
      const t = fitLines(ctx, splitTitle(c.courseTitle).name, inner - num - 22, 2, rowPx, rowPx - 10)
      const ty = cy
      const sub = rowPx * 0.68
      draws.push(() => {
        ctx.font = font(700, t.px); ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
        t.lines.forEach((l, k) => ctx.fillText(l, tx, ty + k * t.px * 1.3))
        ctx.font = font(500, sub); ctx.fillStyle = C.tealInk
        ctx.fillText(startsAr(c, d.dayAr), tx, ty + t.lines.length * t.px * 1.3 + 4)
        ctx.textBaseline = 'alphabetic'
      })
      cy += Math.max(num, t.lines.length * t.px * 1.3 + sub + 8)
    })
  }
  const h = cy + pad - y
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 10
  roundRect(ctx, x, y, w, h, 36)
  ctx.fillStyle = C.paper
  ctx.fill()
  ctx.restore()
  draws.forEach((f) => f())
  return y + h
}

/** الاسمُ والمسمّى وسطَ العرض — ويُرجع أسفلَهما */
function nameBlock(ctx: CanvasRenderingContext2D, d: ArtData, cx: number, y: number, px: number, width: number): number {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.white
  const n = fitLines(ctx, d.name, width, 1, px, px - 16)
  ctx.font = font(700, n.px)
  ctx.fillText(n.lines[0], cx, y)
  if (!d.headline) return y + 12
  const hl = fitLines(ctx, d.headline, width, 2, Math.round(px * 0.5), Math.round(px * 0.4), 500)
  ctx.font = font(500, hl.px)
  ctx.fillStyle = C.tealSoft
  hl.lines.forEach((l, i) => ctx.fillText(l, cx, y + px * 0.9 + i * hl.px * 1.35))
  return y + px * 0.9 + (hl.lines.length - 1) * hl.px * 1.35 + 12
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
    d.photoUrl && kind !== 'course' && kind !== 'offer' ? loadImage(d.photoUrl) : Promise.resolve(null),
  ])
  ctx.direction = 'rtl'
  backdrop(ctx, w, h)
  header(ctx, logo, w)
  const cx = w / 2
  const one = d.courses[index] ?? d.courses[0]
  const label = d.courses.length > 1 ? 'دوراتي بث مباشر' : 'أقدم دورة بث مباشر'
  const footer = (text: string, y: number) => {
    ctx.textAlign = 'center'; ctx.fillStyle = C.tealSoft; ctx.font = font(500, 30)
    ctx.fillText(text, cx, y)
  }

  if (kind === 'post') {
    /* المربّع: صورتُه يمينا واسمُه بجانبها، ثمّ البطاقة، ثمّ المزايا والقسيمة */
    const r = 84
    const pcx = w - 64 - r
    const pcy = 180 + r
    portrait(ctx, photo, d.name, pcx, pcy, r)
    const textRight = pcx - r - 34
    const textW = textRight - 56
    ctx.textAlign = 'right'
    ctx.fillStyle = C.white
    const n = fitLines(ctx, d.name, textW, 1, 52, 38)
    ctx.font = font(700, n.px)
    ctx.fillText(n.lines[0], textRight, pcy + (d.headline ? -4 : 16))
    if (d.headline) {
      const hl = fitLines(ctx, d.headline, textW, 1, 30, 24, 500)
      ctx.font = font(500, hl.px); ctx.fillStyle = C.tealSoft
      ctx.fillText(hl.lines[0], textRight, pcy + 44)
    }
    const shown = d.courses.slice(0, 3)
    const end = courseCard(ctx, d, shown, 56, 396, w - 112, { big: false, label })
    if (d.courses.length > 3) footer(`و${d.courses.length - 3} غيرها في الرابط`, end + 40)
    perks(ctx, cx, Math.min(end + (d.courses.length > 3 ? 64 : 30), 840), w - 112, 26)
    coupon(ctx, d.code, 56, 926, w - 112, 112)
  } else if (kind === 'story') {
    portrait(ctx, photo, d.name, cx, 360, 150)
    const below = nameBlock(ctx, d, cx, 600, 64, w - 160)
    const end = courseCard(ctx, d, d.courses.slice(0, 4), 70, below + 46, w - 140, { big: true, label })
    const py = perks(ctx, cx, end + 44, w - 140, 30)
    coupon(ctx, d.code, 70, Math.max(py + 44, h - 400), w - 140, 150)
    ctx.textAlign = 'center'; ctx.fillStyle = C.white; ctx.font = font(700, 46)
    ctx.fillText('سجل الآن — الرابط في البايو', cx, h - 160)
    footer(`المقاعد محدودة · ${d.host}`, h - 96)
  } else if (kind === 'cover') {
    portrait(ctx, photo, d.name, cx, 450, 200)
    const below = nameBlock(ctx, d, cx, 770, 70, w - 160)
    ctx.textAlign = 'center'; ctx.fillStyle = C.gold; ctx.font = font(700, 52)
    ctx.fillText(d.courses.length > 1 ? `${d.courses.length} دورات بث مباشر هذا الموسم` : 'دورتي القادمة بث مباشر', cx, below + 86)
    perks(ctx, cx, below + 136, w - 140, 28)
    footer('اسحب للتفاصيل ←', h - 80)
  } else if (kind === 'course') {
    const tag = d.courses.length > 1 ? `دورة ${index + 1} من ${d.courses.length} · بث مباشر` : 'دورة بث مباشر'
    const end = courseCard(ctx, d, [one], 64, 210, w - 128, { big: true, label: tag })
    perks(ctx, cx, end + 50, w - 128, 28)
    ctx.textAlign = 'center'; ctx.fillStyle = C.white; ctx.font = font(700, 44)
    ctx.fillText('المقاعد محدودة — احجز مكانك', cx, h - 160)
    footer(d.host, h - 90)
  } else {
    ctx.textAlign = 'center'
    ctx.fillStyle = C.white
    ctx.font = font(700, 62)
    ctx.fillText(d.code ? 'هدية لمن يتابعني' : 'سجل الآن', cx, 330)
    if (d.code) {
      ctx.fillStyle = C.gold
      ctx.font = font(700, 280)
      ctx.fillText(`${d.code.percentOff}٪`, cx, 640)
      ctx.fillStyle = C.white
      ctx.font = font(500, 46)
      ctx.fillText('خصم على دوراتي بالكود', cx, 740)
      /* والنسبةُ قيلت كبيرةً فوقه — فالكودُ وحدَه في إطاره المتقطّع، لا قسيمةٌ تعيدها */
      ctx.font = font(700, 76)
      const cw = ctx.measureText(d.code.code).width + 110
      roundRect(ctx, cx - cw / 2, 800, cw, 150, 28)
      ctx.fillStyle = C.gold
      ctx.fill()
      ctx.save()
      ctx.setLineDash([16, 12]); ctx.strokeStyle = C.ink; ctx.lineWidth = 4
      roundRect(ctx, cx - cw / 2 + 18, 818, cw - 36, 114, 18)
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'
      ctx.fillText(d.code.code, cx, 878)
      ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic'
    } else {
      coupon(ctx, null, 120, 600, w - 240, 150)
    }
    ctx.fillStyle = C.white
    ctx.font = font(700, 48)
    ctx.fillText('الرابط في البايو', cx, 1080)
    footer(`المقاعد محدودة · ${d.host}`, h - 80)
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
