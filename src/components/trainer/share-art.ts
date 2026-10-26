/* ═══ صورُ «شارك دوراتك» — تُرسم في متصفّح المدرّب (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «صورة احترافيّة بسيطة فيها صورته وفيها معلومات عن دورته، ولا تكون مكتظّةً بالكلام، وتشجّع
   الناس على الدخول»، و«إنستغرام… الكاروسيل، أو ستوري». فلكلّ منشورٍ مقاسُ منصّته:

   · **منشور** مربّع ١٠٨٠×١٠٨٠ — لينكدإن وفيسبوك وإنستغرام.
   · **ستوري** ١٠٨٠×١٩٢٠ — إنستغرام وتيك توك وحالة واتساب.
   · **كاروسيل** شرائحُ ١٠٨٠×١٣٥٠ — غلافٌ بصورته، وشريحةٌ لكلّ دورة، وشريحةٌ للخصم.

   ولمَ في المتصفّح لا في الخادم: الخطُّ العربيُّ للمنصّة محمَّلٌ فيه أصلا، والحرفُ يُشكَّل ويُوصَل كما في الصفحة؛
   والخادمُ بلا محرّكِ رسمٍ يُضاف له. والصورةُ من مسار المنصّة نفسِها (`photoPublicUrl`) فلا تُلوِّث اللوحَ — وإن
   تعذّرت رُسم الحرفُ الأوّلُ من اسمه في دائرة. وكلُّ صورةٍ ملفُّ PNG يُنزَّل أو يُشارَك من الهاتف. */

export type ArtKind = 'post' | 'story' | 'cover' | 'course' | 'offer'

export interface ArtData {
  name: string
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

const C = { paper: '#F5F3EE', ink: '#1F2A2E', muted: '#5C6B70', teal: '#38A7B4', tealInk: '#1A5C64', gold: '#FABC05', white: '#FFFFFF' }
const FONT = '"Avenir Arabic", "IBM Plex Sans Arabic", "Neo Sans Arabic", system-ui, sans-serif'
const font = (weight: number, px: number) => `${weight} ${px}px ${FONT}`

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** يلفّ النصَّ على عرضٍ — ولا يتجاوز سطورا بعينها، وآخرُها ينتهي بنقاط إن طال */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= width || !line) line = next
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  /* ويُقطع على كلمةٍ تامّة لا وسطَها — «لتدريب الأطفال…» لا «لتدريب الأطفال ع…» */
  const kept = lines.slice(0, maxLines)
  const words2 = kept[maxLines - 1].split(' ')
  while (words2.length > 1 && ctx.measureText(`${words2.join(' ')}…`).width > width) words2.pop()
  kept[maxLines - 1] = `${words2.join(' ')}…`
  return kept
}

function centered(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number): number {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return y + lines.length * lineHeight
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
    /* تُقصّ من وسطها على مربّع — لا تُمطّ */
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = C.tealInk
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = C.white
    ctx.font = font(700, r)
    ctx.textBaseline = 'middle'
    ctx.fillText(name.trim().charAt(0), cx, cy)
  }
  ctx.restore()
}

/** شارةُ الخصم الذهبيّة: «خصم 30% · WJ30-ABCDEF» */
function codePill(ctx: CanvasRenderingContext2D, code: ArtData['code'], cx: number, y: number, px: number) {
  if (!code) return
  ctx.font = font(700, px)
  /* و«٪» العربيّةُ لا «%»: اللاتينيّةُ تنقلب في السطر العربيّ فتُقرأ «%30» مرّةً و«30%» مرّة */
  const text = `خصم ${code.percentOff}٪ بالكود ${code.code}`
  const w = ctx.measureText(text).width + px * 1.6
  const h = px * 2
  roundRect(ctx, cx - w / 2, y, w, h, h / 2)
  ctx.fillStyle = C.gold
  ctx.fill()
  ctx.fillStyle = C.ink
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2 + px * 0.05)
  ctx.textBaseline = 'alphabetic'
}

/** الرأس: علامةُ وجيز واسمُها — والذيل: عنوانُ الموقع */
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
  ctx.textAlign = 'center'
  ctx.fillStyle = C.muted
  ctx.font = font(500, 32)
  ctx.fillText(host, w / 2, h - 60)
}

const datedAr = (c: ArtData['courses'][number], dayAr: ArtData['dayAr']) => (c.startsAt ? `تبدأ ${dayAr(c.startsAt)}` : 'مقاعد محدودة')

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
  const one = d.courses[index] ?? d.courses[0]

  if (kind === 'post' || kind === 'story') {
    const tall = kind === 'story'
    /* والمربّعُ ضيّق: الصورةُ أصغر، وكلُّ سطرٍ تحت سابقه بقياسه — فلا يركب التاريخُ شارةَ الخصم */
    const r = tall ? 210 : 118
    const cy = tall ? 520 : 290
    portrait(ctx, photo, d.name, w / 2, cy, r)
    ctx.fillStyle = C.ink
    ctx.font = font(700, tall ? 60 : 50)
    let y = cy + r + (tall ? 120 : 82)
    ctx.fillText(d.name, w / 2, y)
    ctx.fillStyle = C.muted
    ctx.font = font(500, tall ? 40 : 34)
    y += tall ? 70 : 52
    ctx.fillText(d.courses.length > 1 ? 'دوراتي في أكاديمية وجيز' : 'أقدم دورة', w / 2, y)
    ctx.fillStyle = C.tealInk
    ctx.font = font(700, tall ? 72 : 58)
    /* وفي القائمة اسمُ الدورة بلا عنوانها الفرعيّ: «التحضير لشهادة CPIM» لا ما بعد النقطتين */
    const titles = d.courses.length > 1
      ? d.courses.slice(0, tall ? 5 : 3).map((c) => c.courseTitle.split(':')[0].trim())
      : [one.courseTitle]
    y += tall ? 110 : 80
    if (d.courses.length > 1) {
      ctx.font = font(700, tall ? 50 : 40)
      for (const t of titles) y = centered(ctx, wrap(ctx, t, w - 180, 1), w / 2, y, tall ? 76 : 56)
    } else {
      y = centered(ctx, wrap(ctx, one.courseTitle, w - 160, tall ? 3 : 2), w / 2, y, tall ? 92 : 70)
      ctx.fillStyle = C.muted
      ctx.font = font(500, tall ? 42 : 34)
      ctx.fillText(datedAr(one, d.dayAr), w / 2, y + (tall ? 20 : 0))
      y += tall ? 20 : 0
    }
    codePill(ctx, d.code, w / 2, tall ? h - 420 : Math.max(y + 34, h - 250), tall ? 44 : 36)
    if (tall) {
      ctx.fillStyle = C.ink
      ctx.font = font(700, 46)
      ctx.fillText('سجل الآن — الرابط في البايو', w / 2, h - 230)
    }
  } else if (kind === 'cover') {
    portrait(ctx, photo, d.name, w / 2, 470, 230)
    ctx.fillStyle = C.ink
    ctx.font = font(700, 64)
    ctx.fillText(d.name, w / 2, 830)
    ctx.fillStyle = C.tealInk
    ctx.font = font(700, 52)
    ctx.fillText(d.courses.length > 1 ? `${d.courses.length} دورات هذا الموسم` : 'دورتي هذا الموسم', w / 2, 920)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 38)
    ctx.fillText('اسحب للتفاصيل ←', w / 2, 1060)
  } else if (kind === 'course') {
    ctx.fillStyle = C.teal
    roundRect(ctx, 90, 230, w - 180, 760, 48)
    ctx.fill()
    ctx.fillStyle = C.white
    ctx.font = font(500, 40)
    ctx.fillText(d.courses.length > 1 ? `دورة ${index + 1} من ${d.courses.length}` : 'دورة', w / 2, 340)
    ctx.font = font(700, 72)
    const end = centered(ctx, wrap(ctx, one.courseTitle, w - 300, 4), w / 2, 480, 96)
    ctx.font = font(500, 44)
    ctx.fillText(datedAr(one, d.dayAr), w / 2, Math.max(end + 40, 880))
    ctx.fillStyle = C.ink
    ctx.font = font(700, 44)
    ctx.fillText('لقاءات مباشرة على Zoom', w / 2, 1120)
  } else {
    ctx.fillStyle = C.ink
    ctx.font = font(700, 60)
    ctx.fillText(d.code ? 'هدية لمن يتابعني' : 'سجل الآن', w / 2, 360)
    if (d.code) {
      ctx.fillStyle = C.gold
      ctx.font = font(700, 260)
      ctx.fillText(`${d.code.percentOff}٪`, w / 2, 660)
      ctx.fillStyle = C.ink
      ctx.font = font(700, 54)
      ctx.fillText('خصم بالكود', w / 2, 780)
      ctx.fillStyle = C.tealInk
      ctx.font = font(700, 76)
      ctx.direction = 'ltr'
      ctx.fillText(d.code.code, w / 2, 900)
      ctx.direction = 'rtl'
    }
    ctx.fillStyle = C.ink
    ctx.font = font(700, 48)
    ctx.fillText('الرابط في البايو', w / 2, 1100)
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
