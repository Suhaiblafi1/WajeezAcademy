/* ═══ صورُ «منحة مؤثرين وجيز» — تُرسم في متصفّح المؤثّر (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحة… كما فعلنا للمدرّب». فالهيئةُ هيئةُ
   صور المدرّب (`trainer/share-art.ts`) — أرضيّةُ الورق، والشريطُ الفيروزيّ، وشارةُ وجيز — والمحتوى المنحةُ والأكاديميّة.
   وبلا عنوان الموقع: الرابطُ في النصّ المرافق يُنقر، وفي الصورة لا.

   ═══ أربعةُ تصاميم، وبلا صورة المؤثّر (٢٦ أكتوبر ٢٠٢٦) ═══

   ثمّ قال: «أضف تصاميمَ أخرى تدلّ على الأكاديميّة ودوراتها ومدرّبيها… صور مدرّبين على شكل دوائر… لا داعيَ لوجود
   صورة صاحب المنحة، فهو ينشرها لحساباته فقط، اذكرها مع الكود كاسمه». فلكلّ تصميمٍ منشورٌ وستوري، وفي أسفل كلٍّ
   «الكود الخاص بـ<اسمه>»:
   · **المنحة** — نسبتُها كبيرةً بالذهب، وعددُ دوراتها وآخرُ يومٍ لها.
   · **المدرّبون** — وجوهُ مدرّبي الموسم في دوائر بأسمائهم، و«+N» لمن لم يسعه، وعددُهم وعددُ الدورات.
   · **الدورات** — دوراتُ الفصل مرقّمةً بمواعيدها، و«و N دورات أخرى».
   · **الأكاديميّة** — من هي، وأرقامُها، وما يحصل عليه المتعلّم.
   والكاروسيلُ شرائحُها كلُّها بالترتيب، وآخرُها «كيف تحجز منحتك؟».

   وكلُّ ما يُقال قائمٌ في المنصّة لا وعدٌ يُختلق: المدرّبون والدوراتُ من دورات المنحة نفسِها ببوّابة النشر
   (`grant-courses.service.ts`)، والمزايا ممّا تعده صفحةُ المنحة (`GRANT_GAINS_AR`) وصورُ المدرّب (`ART_PERKS`). */

import { C, fitLines, font, frame, loadImage, perks, portrait, roundRect } from '../trainer/share-art'
import { splitTitle } from '@/application/trainer/share-kit'
import { GRANT_ACADEMY_LINE_AR } from '@/application/commerce/grant-landing'
import { influencerCodeLabelAr } from '@/application/commerce/influencer'

export type GrantDesign = 'offer' | 'trainers' | 'courses' | 'academy'
export type GrantSize = 'post' | 'story' | 'slide'

export interface GrantArtData {
  /** اسمُ المؤثّر — يُذكر مع كوده لا بصورته */
  name: string
  code: string
  percentOff: number
  maxCourses: number
  /** «30 أكتوبر» */
  lastDayAr: string | null
  /** فصلُ الدورات — «فصل الخريف 2026» */
  termAr: string | null
  /** مدرّبو الموسم بصورهم — بلا تكرار */
  trainers: { name: string; photoUrl: string }[]
  /** كم مدرّبا في الموسم كلُّهم — بصورةٍ أو بلا */
  trainerTotal: number
  courses: { title: string; startsAt: string | null }[]
  dayAr: (iso: string) => string
}

/** التصاميمُ بأسمائها كما تُعرض في اللوحة */
export const GRANT_DESIGNS: { id: GrantDesign; label: string }[] = [
  { id: 'offer', label: 'المنحة' },
  { id: 'trainers', label: 'المدربون' },
  { id: 'courses', label: 'الدورات' },
  { id: 'academy', label: 'الأكاديمية' },
]

/** ما يحصل عليه المتعلّم — ممّا تعده صفحةُ المنحة وصورُ المدرّب، لا غيره */
export const ACADEMY_FEATURES = [
  'لقاءات مباشرة على Zoom مع مدرب معتمد',
  'تطبيقات عملية في كل دورة',
  'تسجيل كل لقاء تعود إليه',
  'شهادة موثقة ورسالة توصية لمن يلتزم',
] as const

/** وجوهُ المدرّبين لا تُرسم بأقلّ من ثلاثة — وجهان لا يقولان «مدرّبون» */
export const MIN_FACES = 3

const SIZE: Record<GrantSize, [number, number]> = { post: [1080, 1080], story: [1080, 1920], slide: [1080, 1350] }

/** «4 دورات» و«24 دورة» و«دورتين» و«دورة واحدة» — والعددُ فوق العشرة يأخذ المفرد */
export const coursesAr = (n: number) => (n === 1 ? 'دورة واحدة' : n === 2 ? 'دورتين' : n <= 10 ? `${n} دورات` : `${n} دورة`)
const trainersAr = (n: number) => (n === 1 ? 'مدرب واحد' : n === 2 ? 'مدربان' : n <= 10 ? `${n} مدربين` : `${n} مدربا`)

/** اسمُ الدورة قصيرا — ما قبل النقطتين، وبلا ما بين القوسين: «أساسيات التخطيط الاستراتيجي (من فهم الواقع…)» */
export const shortTitle = (title: string) => splitTitle(title).name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()

/** ما يتغيّر بالمقاس: موضعُ العنوان وحجمُه، وحدُّ ما يُرسم، وذيلُ الصورة */
function metrics(size: GrantSize) {
  if (size === 'story') return { titleY: 360, titlePx: 70, bodyTop: 520, bodyBottom: 1340, perksY: 1400, pctY: 1500, pillY: 1560, cta: true, s: 1.35 }
  if (size === 'slide') return { titleY: 300, titlePx: 58, bodyTop: 420, bodyBottom: 1020, perksY: 1050, pctY: 1150, pillY: 1190, cta: false, s: 1.1 }
  return { titleY: 250, titlePx: 52, bodyTop: 330, bodyBottom: 770, perksY: 800, pctY: 900, pillY: 940, cta: false, s: 1 }
}

/** شارةُ الكود الذهبيّة — «الكود الخاص بـسارة: SARA» */
function codePill(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, px: number, maxW: number) {
  const text = `${influencerCodeLabelAr(d.name)}: ${d.code}`
  let p = px
  ctx.font = font(700, p)
  while (p > 22 && ctx.measureText(text).width + p * 1.6 > maxW) { p -= 2; ctx.font = font(700, p) }
  const w = ctx.measureText(text).width + p * 1.6
  const h = p * 2
  roundRect(ctx, cx - w / 2, y, w, h, h / 2)
  ctx.fillStyle = C.gold
  ctx.fill()
  ctx.fillStyle = C.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2 + p * 0.05)
  ctx.textBaseline = 'alphabetic'
}

function title(ctx: CanvasRenderingContext2D, text: string, sub: string | null, cx: number, y: number, px: number, width: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  const t = fitLines(ctx, text, width, 1, px, px - 14)
  ctx.font = font(700, t.px)
  ctx.fillText(t.lines[0], cx, y)
  if (sub) {
    ctx.fillStyle = C.muted
    ctx.font = font(500, Math.round(px * 0.56))
    ctx.fillText(sub, cx, y + px * 0.95)
  }
}

/** سطرُ المنحة فوق الكود في التصاميم التي ليست المنحة — «منحتك تصل إلى 45٪ من سعر الدورات» */
function grantLine(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, px: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, px)
  ctx.fillText(`منحتك تصل إلى ${d.percentOff}٪ من سعر الدورات`, cx, y)
}

/** ذيلُ الستوري — دعوةٌ والمنحُ محدودة */
function storyCta(ctx: CanvasRenderingContext2D, cx: number, h: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  ctx.font = font(700, 46)
  ctx.fillText('احجز منحتك — الرابط في البايو', cx, h - 170)
  ctx.fillStyle = C.muted
  ctx.font = font(500, 34)
  ctx.fillText('المنح محدودة', cx, h - 110)
}

/* ═══ التصاميم ═══ */

function drawOffer(ctx: CanvasRenderingContext2D, d: GrantArtData, size: GrantSize, w: number) {
  const m = metrics(size)
  const cx = w / 2
  title(ctx, 'منحة من أكاديمية وجيز', null, cx, m.titleY, m.titlePx, w - 200)
  const big = Math.round(210 * m.s)
  const y = m.bodyTop + big * 0.42
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
  ctx.font = font(500, Math.round(big * 0.15))
  ctx.fillText([`اختر حتى ${coursesAr(d.maxCourses)}`, ...(d.lastDayAr ? [`آخر يوم ${d.lastDayAr}`] : [])].join(' · '), cx, y + big * 1.55)
  perks(ctx, cx, m.perksY, Math.round(22 * m.s))
}

async function drawTrainers(ctx: CanvasRenderingContext2D, d: GrantArtData, size: GrantSize, w: number) {
  const m = metrics(size)
  const cx = w / 2
  title(ctx, 'تتعلم مع مدربين معتمدين', `${trainersAr(d.trainerTotal)} · ${coursesAr(d.courses.length)} مباشرة على Zoom`, cx, m.titleY, m.titlePx, w - 200)
  const cols = 4
  const maxRows = size === 'post' ? 2 : 3
  const slots = cols * maxRows
  const more = d.trainerTotal > slots ? d.trainerTotal - (slots - 1) : 0
  const shown = d.trainers.slice(0, more ? slots - 1 : slots)
  const cells = shown.length + (more ? 1 : 0)
  const rows = Math.max(1, Math.ceil(cells / cols))
  const top = m.bodyTop + Math.round(40 * m.s)
  const region = m.bodyBottom - top
  const namePx = Math.round(24 * m.s)
  const r = Math.min((w - 180) / cols / 2 - 22, (region / rows - namePx * 2.2) / 2 - 12)
  const cellH = region / rows
  const imgs = await Promise.all(shown.map((t) => loadImage(t.photoUrl)))
  for (let i = 0; i < cells; i += 1) {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, cells - row * cols)
    const col = i % cols
    /* الصفُّ الأخيرُ الناقصُ يتوسّط — ومن اليمين إلى اليسار */
    const step = (w - 180) / cols
    const x = cx + ((inRow - 1) / 2 - col) * step
    const y = top + row * cellH + r + 12
    if (i < shown.length) {
      portrait(ctx, imgs[i], shown[i].name, x, y, r)
      ctx.fillStyle = C.ink
      const n = fitLines(ctx, shown[i].name.split(/\s+/).slice(0, 2).join(' '), step - 16, 1, namePx, namePx - 6)
      ctx.font = font(700, n.px)
      ctx.textAlign = 'center'
      ctx.fillText(n.lines[0], x, y + r + 12 + namePx * 1.3)
    } else {
      ctx.beginPath()
      ctx.arc(x, y, r + 12, 0, Math.PI * 2)
      ctx.fillStyle = C.tealInk
      ctx.fill()
      ctx.fillStyle = C.white
      ctx.font = font(700, Math.round(r * 0.62))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.direction = 'ltr'
      ctx.fillText(`+${more}`, x, y)
      ctx.direction = 'rtl'
      ctx.textBaseline = 'alphabetic'
    }
  }
}

function drawCourses(ctx: CanvasRenderingContext2D, d: GrantArtData, size: GrantSize, w: number) {
  const m = metrics(size)
  const cx = w / 2
  title(ctx, 'دورات مباشرة هذا الفصل', d.termAr, cx, m.titleY, m.titlePx, w - 200)
  const cap = size === 'story' ? 9 : size === 'slide' ? 6 : 5
  const list = d.courses.slice(0, cap)
  const rest = d.courses.length - list.length
  const top = m.bodyTop + Math.round(50 * m.s)
  const bottom = m.bodyBottom - (rest > 0 ? Math.round(40 * m.s) : 0)
  const rowH = Math.min((bottom - top) / Math.max(1, list.length), 130 * m.s)
  const namePx = Math.round(Math.min(34 * m.s, rowH * 0.36))
  const datePx = Math.round(namePx * 0.72)
  const r = namePx * 0.7
  const right = w - 110
  list.forEach((c, i) => {
    const y = top + i * rowH + namePx
    ctx.fillStyle = C.teal
    ctx.beginPath(); ctx.arc(right - r, y - namePx * 0.35, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = C.white
    ctx.font = font(700, r * 1.05)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), right - r, y - namePx * 0.35 + r * 0.06)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'right'
    ctx.fillStyle = C.tealInk
    const t = fitLines(ctx, shortTitle(c.title), w - 240 - r * 2, 1, namePx, namePx - 6)
    ctx.font = font(700, t.px)
    ctx.fillText(t.lines[0], right - r * 2 - 22, y)
    ctx.fillStyle = C.muted
    ctx.font = font(500, datePx)
    ctx.fillText(c.startsAt ? `تبدأ ${d.dayAr(c.startsAt)}` : 'موعدها قريبا', right - r * 2 - 22, y + datePx * 1.35)
  })
  if (rest > 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = C.muted
    ctx.font = font(700, Math.round(28 * m.s))
    ctx.fillText(`و${coursesAr(rest)} أخرى تختار منها`, cx, m.bodyBottom)
  }
}

function drawAcademy(ctx: CanvasRenderingContext2D, d: GrantArtData, size: GrantSize, w: number) {
  const m = metrics(size)
  const cx = w / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, Math.round(m.titlePx * 1.1))
  ctx.fillText('أكاديمية وجيز', cx, m.titleY)
  const line = fitLines(ctx, GRANT_ACADEMY_LINE_AR, w - 240, 2, Math.round(28 * m.s), Math.round(22 * m.s), 500)
  ctx.fillStyle = C.muted
  ctx.font = font(500, line.px)
  line.lines.forEach((l, i) => ctx.fillText(l, cx, m.titleY + m.titlePx * 0.9 + i * line.px * 1.4))
  /* الأرقام: دوراتُ الموسم، ومدرّبوه، ونسبةُ المنحة */
  const stats = [
    { n: String(d.courses.length), t: 'دورة مباشرة' },
    { n: String(d.trainerTotal), t: 'مدربا معتمدا' },
    { n: `${d.percentOff}٪`, t: 'منحتك' },
  ].filter((x) => x.n !== '0')
  const statY = m.bodyTop + Math.round(90 * m.s)
  const colW = (w - 200) / stats.length
  stats.forEach((x, i) => {
    const sx = cx + ((stats.length - 1) / 2 - i) * colW
    ctx.fillStyle = C.gold
    ctx.font = font(700, Math.round(72 * m.s))
    ctx.fillText(x.n, sx, statY)
    ctx.fillStyle = C.ink
    ctx.font = font(500, Math.round(26 * m.s))
    ctx.fillText(x.t, sx, statY + 44 * m.s)
  })
  /* وما يحصل عليه — صفوفٌ بعلامةٍ فيروزيّة على حافّةٍ يمنى واحدة وسطَ الصورة */
  const px = Math.round(30 * m.s)
  ctx.font = font(700, px)
  const widest = Math.max(...ACADEMY_FEATURES.map((f) => ctx.measureText(f).width))
  const r = px * 0.55
  const right = cx + (widest + r * 2 + 20) / 2
  const top = statY + Math.round(130 * m.s)
  const gap = Math.min((m.bodyBottom - top) / ACADEMY_FEATURES.length, 90 * m.s)
  ACADEMY_FEATURES.forEach((f, i) => {
    const y = top + i * gap
    ctx.fillStyle = C.teal
    ctx.beginPath(); ctx.arc(right - r, y - px * 0.35, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = C.white
    ctx.lineWidth = Math.max(3, r * 0.22)
    ctx.beginPath()
    ctx.moveTo(right - r * 1.45, y - px * 0.35)
    ctx.lineTo(right - r * 1.05, y - px * 0.35 + r * 0.38)
    ctx.lineTo(right - r * 0.5, y - px * 0.35 - r * 0.35)
    ctx.stroke()
    ctx.fillStyle = C.tealInk
    ctx.font = font(700, px)
    ctx.textAlign = 'right'
    ctx.fillText(f, right - r * 2 - 20, y)
  })
  ctx.textAlign = 'center'
}

/** خطواتُ الحجز — آخرُ شرائح الكاروسيل */
function drawSteps(ctx: CanvasRenderingContext2D, d: GrantArtData, w: number) {
  const cx = w / 2
  title(ctx, 'كيف تحجز منحتك؟', null, cx, 300, 60, w - 200)
  const lines = ['افتح الرابط في البايو', `اكتب الكود ${d.code}`, `اختر حتى ${coursesAr(d.maxCourses)} واحجز منحتك`]
  const px = 48
  ctx.font = font(700, px)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const r = px * 0.75
  const right = cx + (widest + r * 2 + px * 0.6) / 2
  lines.forEach((l, i) => {
    const y = 520 + i * px * 2.4
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

/** يرسم تصميما بمقاسه — و`steps` شريحةُ الكاروسيل الأخيرة */
export async function drawGrantArt(design: GrantDesign | 'steps', size: GrantSize, d: GrantArtData): Promise<HTMLCanvasElement> {
  const [w, h] = SIZE[design === 'steps' ? 'slide' : size]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  await Promise.all([document.fonts.load(font(700, 40)), document.fonts.load(font(500, 40))]).catch(() => undefined)
  const logo = await loadImage('/logo-mark.png')
  ctx.direction = 'rtl'
  frame(ctx, logo, w, h)
  const cx = w / 2
  const m = metrics(size)

  if (design === 'steps') {
    drawSteps(ctx, d, w)
    codePill(ctx, d, cx, 1000, 40, w - 160)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 36)
    ctx.textAlign = 'center'
    ctx.fillText('المنح محدودة', cx, 1200)
    return canvas
  }
  if (design === 'offer') drawOffer(ctx, d, size, w)
  else if (design === 'trainers') await drawTrainers(ctx, d, size, w)
  else if (design === 'courses') drawCourses(ctx, d, size, w)
  else drawAcademy(ctx, d, size, w)

  /* والذيلُ لكلّ تصميم: سطرُ المنحة (إلّا في تصميمها) ثمّ الكودُ باسمه */
  if (design !== 'offer') grantLine(ctx, d, cx, m.pctY - Math.round(46 * m.s), Math.round(30 * m.s))
  codePill(ctx, d, cx, m.pillY, Math.round(30 * m.s), w - 160)
  if (m.cta) storyCta(ctx, cx, h)
  return canvas
}

/** التصاميمُ المتاحة — وجوهُ المدرّبين بثلاثةٍ فأكثر، والدوراتُ بواحدةٍ فأكثر */
export function grantDesigns(d: Pick<GrantArtData, 'trainers' | 'courses'>): GrantDesign[] {
  return GRANT_DESIGNS.map((x) => x.id).filter((id) =>
    id === 'trainers' ? d.trainers.length >= MIN_FACES : id === 'courses' ? d.courses.length > 0 : true)
}

/** ما يُرسم لكلّ صيغة: التصميمُ المختارُ منشورا أو ستوري، والكاروسيلُ التصاميمُ كلُّها ثمّ «كيف تحجز» */
export function grantArtPlan(format: 'post' | 'story' | 'carousel', design: GrantDesign, available: GrantDesign[]): { kind: string; index: number }[] {
  if (format !== 'carousel') return [{ kind: `${design}:${format}`, index: 0 }]
  return [...available.map((x) => ({ kind: `${x}:slide`, index: 0 })), { kind: 'steps:slide', index: 0 }]
}

/** «offer:post» ← التصميمُ ومقاسُه */
export function parseGrantKind(kind: string): { design: GrantDesign | 'steps'; size: GrantSize } {
  const [design, size] = kind.split(':') as [GrantDesign | 'steps', GrantSize]
  return { design, size }
}
