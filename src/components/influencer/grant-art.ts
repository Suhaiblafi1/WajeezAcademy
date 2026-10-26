/* ═══ صورُ «منحة مؤثرين وجيز» — تُرسم في متصفّح المؤثّر (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحة… كما فعلنا للمدرّب». فالهيئةُ هيئةُ
   صور المدرّب (`trainer/share-art.ts`) — أرضيّةُ الورق، والشريطُ الفيروزيّ، وشارةُ وجيز، والصورةُ بحلقتها — والمحتوى
   المنحة: من يهديها، ونسبتُها كبيرةً بالذهب، وعددُ دوراتها وآخرُ يومٍ لها، والكودُ الخاصُّ به. وبلا عنوان الموقع: الرابطُ
   في النصّ المرافق يُنقر، وفي الصورة لا («لا داعيَ للرابط لأنّه لا يمكن نسخُه أو نقرُه داخل التصميم»).

   · **منشور** ١٠٨٠×١٠٨٠ · **ستوري** ١٠٨٠×١٩٢٠
   · **كاروسيل** ثلاثُ شرائح ١٠٨٠×١٣٥٠: من يهديها، وما فيها، وكيف يحجزها. */

import { C, fitLines, font, frame, loadImage, perks, portrait, roundRect } from '../trainer/share-art'

export type GrantArtKind = 'post' | 'story' | 'cover' | 'offer' | 'steps'

export interface GrantArtData {
  name: string
  photoUrl: string | null
  percentOff: number
  maxCourses: number
  code: string
  /** «30 أكتوبر» */
  lastDayAr: string | null
}

const SIZE: Record<GrantArtKind, [number, number]> = {
  post: [1080, 1080], story: [1080, 1920], cover: [1080, 1350], offer: [1080, 1350], steps: [1080, 1350],
}

/** سطرُ ما تحت النسبة: عددُ الدورات وآخرُ يوم */
const termsAr = (d: GrantArtData) => [`اختر حتى ${d.maxCourses} دورات`, ...(d.lastDayAr ? [`آخر يوم ${d.lastDayAr}`] : [])].join(' · ')

/** شارةُ الكود الذهبيّة — «الكود الخاص بي: SARA» */
function codePill(ctx: CanvasRenderingContext2D, code: string, cx: number, y: number, px: number) {
  ctx.font = font(700, px)
  const text = `الكود الخاص بي: ${code}`
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

/** من يهديها — اسمُه وتحته «يهديك منحة من أكاديمية وجيز» — ويُرجع أسفلَهما */
function giver(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, px: number, width: number): number {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  const n = fitLines(ctx, d.name, width, 1, px, px - 14)
  ctx.font = font(700, n.px)
  ctx.fillText(n.lines[0], cx, y)
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(px * 0.62))
  ctx.fillText('يهديك منحة من أكاديمية وجيز', cx, y + px * 1.1)
  return y + px * 1.1
}

/** النسبةُ كبيرةً بالذهب، و«منحتك تصل إلى» فوقها، و«من سعر الدورات» تحتها — ويُرجع أسفلَها */
function percentBlock(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, big: number): number {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  ctx.font = font(700, Math.round(big * 0.24))
  ctx.fillText('منحتك تصل إلى', cx, y)
  ctx.fillStyle = C.gold
  ctx.font = font(700, big)
  ctx.fillText(`${d.percentOff}٪`, cx, y + big * 0.95)
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, Math.round(big * 0.2))
  ctx.fillText('من سعر الدورات', cx, y + big * 1.25)
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(big * 0.16))
  ctx.fillText(termsAr(d), cx, y + big * 1.55)
  return y + big * 1.55
}

/** خطواتُ الحجز — رقمٌ في دائرةٍ فيروزيّةٍ يمينا، ونصُّها بجانبه */
function steps(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, top: number, px: number) {
  const lines = ['افتح الرابط في البايو', `اكتب الكود ${d.code}`, `اختر حتى ${d.maxCourses} دورات واحجز منحتك`]
  ctx.font = font(700, px)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const r = px * 0.75
  const right = cx + (widest + r * 2 + px * 0.6) / 2
  lines.forEach((l, i) => {
    const y = top + i * px * 2.4
    ctx.fillStyle = C.teal
    ctx.beginPath(); ctx.arc(right - r, y - px * 0.35, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = C.white
    ctx.font = font(700, r * 1.1)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), right - r, y - px * 0.35 + r * 0.06)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'right'
    ctx.fillStyle = C.tealInk
    ctx.font = font(700, px)
    ctx.fillText(l, right - r * 2 - px * 0.6, y)
  })
  ctx.textAlign = 'center'
}

/** يرسم صورةً بعينها */
export async function drawGrantArt(kind: GrantArtKind, d: GrantArtData): Promise<HTMLCanvasElement> {
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
  frame(ctx, logo, w, h)
  ctx.textAlign = 'center'
  const cx = w / 2

  if (kind === 'post') {
    portrait(ctx, photo, d.name, cx, 240, 92)
    const below = giver(ctx, d, cx, 240 + 92 + 66, 44, w - 200)
    percentBlock(ctx, d, cx, below + 92, 190)
    perks(ctx, cx, h - 208, 22)
    codePill(ctx, d.code, cx, h - 136, 32)
  } else if (kind === 'story') {
    portrait(ctx, photo, d.name, cx, 420, 170)
    const below = giver(ctx, d, cx, 420 + 170 + 96, 58, w - 200)
    percentBlock(ctx, d, cx, below + 130, 280)
    perks(ctx, cx, h - 470, 28)
    codePill(ctx, d.code, cx, h - 380, 44)
    ctx.fillStyle = C.ink
    ctx.font = font(700, 46)
    ctx.fillText('احجز منحتك — الرابط في البايو', cx, h - 200)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 34)
    ctx.fillText('المنح محدودة', cx, h - 140)
  } else if (kind === 'cover') {
    portrait(ctx, photo, d.name, cx, 470, 230)
    const below = giver(ctx, d, cx, 830, 64, w - 200)
    perks(ctx, cx, below + 80, 26)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 38)
    ctx.fillText('اسحب للتفاصيل ←', cx, h - 150)
  } else if (kind === 'offer') {
    percentBlock(ctx, d, cx, 380, 300)
    perks(ctx, cx, 1010, 28)
    ctx.fillStyle = C.ink
    ctx.font = font(700, 42)
    ctx.fillText('المنح محدودة — احجز منحتك', cx, 1190)
  } else {
    ctx.fillStyle = C.ink
    ctx.font = font(700, 60)
    ctx.fillText('كيف تحجز منحتك؟', cx, 340)
    steps(ctx, d, cx, 560, 50)
    codePill(ctx, d.code, cx, 1040, 40)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 36)
    ctx.fillText('المنح محدودة', cx, 1230)
  }
  return canvas
}

/** ما يُرسم لكلّ صيغة: صورةٌ للمنشور والستوري، وثلاثُ شرائح للكاروسيل */
export function grantArtPlan(format: 'post' | 'story' | 'carousel'): { kind: GrantArtKind; index: number }[] {
  if (format !== 'carousel') return [{ kind: format, index: 0 }]
  return [{ kind: 'cover', index: 0 }, { kind: 'offer', index: 0 }, { kind: 'steps', index: 0 }]
}
