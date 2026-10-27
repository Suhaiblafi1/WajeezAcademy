/* ═══ صورُ «منحة مؤثرين وجيز» — تُرسم في متصفّح المؤثّر (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحة… كما فعلنا للمدرّب»، ثمّ: «أضف تصاميمَ
   أخرى تدلّ على الأكاديميّة ودوراتها ومدرّبيها… لا داعيَ لوجود صورة صاحب المنحة… اذكرها مع الكود كاسمه».

   ═══ ثمّ أنعمُ وأكثر (٢٧ أكتوبر ٢٠٢٦) ═══

   «لا أريد أن توضَح صورُ المدرّبين بشكلٍ قويٍّ على شكل كرات، ولا تضع صهيبَ من ضمنهم، ولا داعيَ لأسمائهم. نحتاج
   تصميما للأكاديميّة ككلّ أيضا.. كلّما زادت التصاميمُ كان أفضل، وأريد تصميما فيه كلُّ المدرّبين معا.. اجعل التصميمَ
   أكثرَ نعومةً وعصريّة». فصار:
   · **الهيئةُ ناعمة**: أرضيّةٌ متدرّجةٌ فاتحة وبقعتا ضوءٍ فيروزيّةٌ وذهبيّة، وبطاقاتٌ بيضاءُ مستديرةٌ بظلٍّ خفيف.
   · **وصورُ المدرّبين مربّعاتٌ مستديرةُ الزوايا صغيرة**، بلا حلقاتٍ ولا أسماء — والمدرّبُ صاحبُ المنصّة لا يُعرض
     (`influencer.service.ts#designMaterial`، بالدور لا بالاسم).
   · **سبعةُ تصاميم**، لكلٍّ منشورٌ وستوري، والكاروسيلُ شرائحُها:
     المنحة · الأكاديميّة · لماذا وجيز · المدرّبون · كلّ المدرّبين · الدورات · كيف تحجز.
   ═══ ثمّ التشخيصُ والاختباراتُ ومزايا الأكاديميّة (٢٧ أكتوبر ٢٠٢٦) ═══

   «تصميم آخر عن التشخيص واختبارات تحديد المستوى وتحديد الميول وغيرها، وأيّ ميزةٍ للأكاديميّة ضعها في مجموعة
   التصاميم». فزاد تصميمان:
   · **اعرف من أين تبدأ**: التشخيصُ الذكيّ، ومرآةُ وجيز (الميول)، وتحديدُ مستوى الإنجليزيّة، وفحصُ المهارة — مجّانيّةٌ
     بلا حساب، وأرقامُها كما في صفحاتها (`ASSESSMENTS`)، ومجالاتُ الفحص من `FIELD_CHECKS` نفسِها.
   · **مزايا وجيز**: ثماني مزايا قائمةٌ في المنصّة (`ACADEMY_PERKS`)، وهي في الكاروسيل مكانَ «لماذا وجيز» لأنّها تحويها.

   ═══ ثمّ «تصميمك الخاص» بصورته واسمه (٢٧ أكتوبر ٢٠٢٦) ═══

   «امنحه فرصةً أن يصمّم تصميما خاصّا به، ويُطلب منه رفعُ صورته واسمه! اجعل هذا تلقائيّا». فالتصميمُ العاشرُ أوّلُها:
   صورتُه كبيرةً واسمُه، و«منحتي لكم» بنسبتها. وصورتُه صورةُ حسابه (يرفعها من اللوحة نفسِها، فتبقى لكلّ زيارة)،
   واسمُه يكتبه هو. وبلا صورةٍ يرى القالبَ بمكانها «صورتك هنا» ويُطلب منه رفعُها — ولا يُنزَّل قالبٌ فارغ.
   وصورتُه لا تُرسم في غيره: «لا داعي لوجود صورة صاحب المنحة» ما زال قاعدةَ التصاميم الأخرى.

   وفي ذيل كلٍّ «الكود الخاص بـ<اسمه>». وبلا عنوان الموقع: الرابطُ في النصّ المرافق يُنقر، وفي الصورة لا.

   وكلُّ ما يُقال قائمٌ في المنصّة لا وعدٌ يُختلق: المدرّبون والدوراتُ من دورات المنحة ببوّابة النشر، والمزايا ممّا
   تعده صفحةُ المنحة (`GRANT_GAINS_AR`) وصورُ المدرّب (`ART_PERKS`). */

import { C, fitLines, font, loadImage, roundRect } from '../trainer/share-art'
import { splitTitle } from '@/application/trainer/share-kit'
import { GRANT_ACADEMY_LINE_AR } from '@/application/commerce/grant-landing'
import { influencerCodeLabelAr } from '@/application/commerce/influencer'
import { FIELD_CHECKS } from '@/domain/placement/field-check'

export type GrantDesign = 'personal' | 'offer' | 'academy' | 'start' | 'features' | 'why' | 'trainers' | 'team' | 'courses' | 'steps'
export type GrantSize = 'post' | 'story' | 'slide'

export interface GrantArtData {
  /** اسمُ المؤثّر — يُذكر مع كوده لا بصورته */
  name: string
  code: string
  percentOff: number
  maxCourses: number
  /** «30 أكتوبر» */
  lastDayAr: string | null
  /** فصلُ الدورات — «موسم الشتاء 2026/2027» */
  termAr: string | null
  /** صورُ مدرّبي الموسم — بلا أسماء، وبلا صاحب المنصّة */
  photos: string[]
  /** كم مدرّبا في الموسم — بصورةٍ أو بلا */
  trainerTotal: number
  courses: { title: string; startsAt: string | null }[]
  dayAr: (iso: string) => string
  /** «تصميمك الخاص» وحدَه — صورةُ حسابه واسمُه كما كتبه، ولا يُرسمان في غيره */
  own: { photo: string | null; name: string }
}

/** التصاميمُ بأسمائها كما تُعرض في اللوحة */
export const GRANT_DESIGNS: { id: GrantDesign; label: string }[] = [
  { id: 'personal', label: 'تصميمك الخاص' },
  { id: 'offer', label: 'المنحة' },
  { id: 'academy', label: 'الأكاديمية' },
  { id: 'start', label: 'التشخيص والاختبارات' },
  { id: 'features', label: 'مزايا وجيز' },
  { id: 'why', label: 'لماذا وجيز' },
  { id: 'trainers', label: 'المدربون' },
  { id: 'team', label: 'كل المدربين' },
  { id: 'courses', label: 'الدورات' },
  { id: 'steps', label: 'كيف تحجز' },
]

/** ما يحصل عليه المتعلّم — ممّا تعده صفحةُ المنحة وصورُ المدرّب، لا غيره */
export const ACADEMY_FEATURES = [
  'لقاءات مباشرة على Zoom مع مدرب معتمد',
  'تطبيقات عملية في كل دورة',
  'تسجيل كل لقاء تعود إليه',
  'شهادة موثقة ورسالة توصية لمن يلتزم',
] as const

/** ما يعرف به المتعلّمُ من أين يبدأ — بأرقام صفحاتها: التشخيصُ «٣–٦ دقائق» (`Diagnostic.tsx`)، والمرآةُ «أربعةٌ
    وعشرون بندا في ثلاث دقائق» (`Mirror.tsx`)، والإنجليزيّةُ «ثلاثون سؤالا تقريبا» (`PlacementTest.tsx`)، والفحصُ «اثنا
    عشر سؤالا» (`SkillCheck.tsx`). وكلُّها مجّانيّةٌ تُفتح بلا حساب (`/api/public/placement`) */
export const ASSESSMENTS = [
  { title: 'التشخيص الذكي', sub: 'يفهم هدفك ويرسم لك مسارا مفسرا', tag: 'من 3 إلى 6 دقائق' },
  { title: 'مرآة وجيز', sub: 'تظهر ميولك وجاهزيتك للتطبيق', tag: '24 بندا في 3 دقائق' },
  { title: 'تحديد مستوى الإنجليزية', sub: 'قواعد ومفردات وقراءة', tag: 'نحو 30 سؤالا' },
  { title: 'فحص المهارة', sub: FIELD_CHECKS.map((c) => c.title_ar).join(' · '), tag: '12 سؤالا' },
] as const

/** مزايا الأكاديميّة — كلُّها قائمةٌ في المنصّة: التشخيصُ والاختبارات، واللقاءاتُ وتسجيلُها، والشهادةُ وصفحةُ التحقّق
    منها برقمها (`/verify`)، ورسالةُ التوصية (`EndorsementLetter.tsx`) */
export const ACADEMY_PERKS = [
  'تشخيص مجاني يرسم مسارك',
  'اختبارات تحديد المستوى',
  'لقاءات مباشرة على Zoom',
  'مدرب معتمد في كل دورة',
  'تطبيقات عملية',
  'تسجيل كل لقاء',
  'شهادة تتحقق منها برقمها',
  'رسالة توصية لمن يلتزم',
] as const

/** صورُ المدرّبين لا تُرسم بأقلّ من ثلاث — صورتان لا تقولان «مدرّبون» */
export const MIN_FACES = 3

const SIZE: Record<GrantSize, [number, number]> = { post: [1080, 1080], story: [1080, 1920], slide: [1080, 1350] }

/** «4 دورات» و«24 دورة» و«دورتين» و«دورة واحدة» — والعددُ فوق العشرة يأخذ المفرد */
export const coursesAr = (n: number) => (n === 1 ? 'دورة واحدة' : n === 2 ? 'دورتين' : n <= 10 ? `${n} دورات` : `${n} دورة`)
/** «14 مدربا معتمدا» و«5 مدربين معتمدين» و«مدربان معتمدان» */
export const trainersCountAr = (n: number) =>
  (n === 1 ? 'مدرب معتمد' : n === 2 ? 'مدربان معتمدان' : n <= 10 ? `${n} مدربين معتمدين` : `${n} مدربا معتمدا`)
/** ما تحت الرقم في بطاقته — «دورة مباشرة» أو «دورات مباشرة» بحسب العدد */
const underNumber = (n: number, few: string, many: string) => (n >= 3 && n <= 10 ? few : many)

/** اسمُ الدورة قصيرا — ما قبل النقطتين، وبلا ما بين القوسين */
export const shortTitle = (title: string) => splitTitle(title).name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()

/** حدودُ المتن والذيل لكلّ مقاس */
function frameOf(size: GrantSize) {
  if (size === 'story') return { top: 300, bottom: 1400, lineY: 1470, pillY: 1520, s: 1.3, cta: true }
  if (size === 'slide') return { top: 230, bottom: 1080, lineY: 1140, pillY: 1180, s: 1.08, cta: false }
  return { top: 190, bottom: 830, lineY: 885, pillY: 925, s: 1, cta: false }
}

/* ═══ الهيئةُ الناعمة ═══ */

const SOFT = { bgTop: '#F8F6F1', bgBottom: '#EAF4F4', card: 'rgba(255,255,255,0.94)', tint: '#E6F3F4', line: '#DDE7E8' }

/** الأرضيّة: تدرّجٌ فاتح، وبقعتا ضوءٍ فيروزيّةٌ أعلى اليمين وذهبيّةٌ أسفلَ اليسار */
function softBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, SOFT.bgTop)
  g.addColorStop(1, SOFT.bgBottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const blob = (x: number, y: number, r: number, color: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, color)
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, w, h)
  }
  blob(w * 0.92, h * 0.06, w * 0.62, 'rgba(56,167,180,0.20)')
  blob(w * 0.05, h * 0.95, w * 0.55, 'rgba(250,188,5,0.14)')
}

/** بطاقةٌ بيضاءُ مستديرةٌ بظلٍّ خفيف */
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 40) {
  ctx.save()
  ctx.shadowColor = 'rgba(31,42,46,0.10)'
  ctx.shadowBlur = 44
  ctx.shadowOffsetY = 14
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = SOFT.card
  ctx.fill()
  ctx.restore()
}

/** الرأس: علامةُ وجيز واسمُها يمينا، وشارةٌ بيضاءُ «مباشر على Zoom» بنقطةٍ حمراء يسارا */
function softHeader(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, w: number) {
  if (logo) ctx.drawImage(logo, w - 56 - 68, 52, 68, 68)
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, 32)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('أكاديمية وجيز', w - 56 - 68 - 18, 88)
  const label = 'مباشر على Zoom'
  ctx.font = font(500, 24)
  const pw = ctx.measureText(label).width + 70
  card(ctx, 56, 62, pw, 52, 26)
  ctx.fillStyle = C.live
  ctx.beginPath(); ctx.arc(56 + pw - 28, 88, 7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = C.ink
  ctx.font = font(500, 24)
  ctx.fillText(label, 56 + pw - 46, 89)
  ctx.textBaseline = 'alphabetic'
}

/** عنوانٌ وسطٌ وتحته سطرٌ خافت — ويُرجع أسفلَهما */
function heading(ctx: CanvasRenderingContext2D, text: string, sub: string | null, cx: number, y: number, px: number, width: number): number {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  const t = fitLines(ctx, text, width, 2, px, px - 16)
  ctx.font = font(700, t.px)
  t.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * t.px * 1.25))
  let bottom = y + (t.lines.length - 1) * t.px * 1.25
  if (sub) {
    const sp = Math.round(px * 0.5)
    const sl = fitLines(ctx, sub, width, 2, sp, sp - 6, 500)
    ctx.fillStyle = C.muted
    ctx.font = font(500, sl.px)
    sl.lines.forEach((l, i) => ctx.fillText(l, cx, bottom + sp * 1.6 + i * sl.px * 1.45))
    bottom += sp * 1.6 + (sl.lines.length - 1) * sl.px * 1.45
  }
  return bottom
}

/** صورةُ مدرّبٍ مربّعةٌ مستديرةُ الزوايا بإطارٍ أبيضَ رفيعٍ وظلٍّ خفيف — أو مربّعٌ فاتحٌ إن تعذّرت */
function tile(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, size: number) {
  const r = size * 0.28
  ctx.save()
  ctx.shadowColor = 'rgba(31,42,46,0.12)'
  ctx.shadowBlur = size * 0.18
  ctx.shadowOffsetY = size * 0.05
  roundRect(ctx, x, y, size, size, r)
  ctx.fillStyle = C.white
  ctx.fill()
  ctx.restore()
  const b = Math.max(3, size * 0.04)
  ctx.save()
  roundRect(ctx, x + b, y + b, size - b * 2, size - b * 2, r - b)
  ctx.clip()
  if (img) {
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.2 : (img.naturalHeight - side) / 2
    ctx.drawImage(img, (img.naturalWidth - side) / 2, sy, side, side, x + b, y + b, size - b * 2, size - b * 2)
  } else {
    ctx.fillStyle = SOFT.tint
    ctx.fillRect(x, y, size, size)
  }
  ctx.restore()
}

/** شاراتُ المزايا — بيضاءُ بنقطةٍ فيروزيّة، في صفٍّ وسطَ عرضه */
function softChips(ctx: CanvasRenderingContext2D, items: readonly string[], cx: number, y: number, px: number) {
  ctx.font = font(500, px)
  const widths = items.map((t) => ctx.measureText(t).width + px * 2.4)
  const gap = px * 0.6
  let right = cx + (widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1)) / 2
  items.forEach((t, i) => {
    const w = widths[i]
    card(ctx, right - w, y, w, px * 2, px)
    ctx.fillStyle = C.teal
    ctx.beginPath(); ctx.arc(right - px * 0.9, y + px, px * 0.24, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = C.tealInk
    ctx.font = font(500, px)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(t, right - px * 1.5, y + px + px * 0.05)
    ctx.textBaseline = 'alphabetic'
    right -= w + gap
  })
  ctx.textAlign = 'center'
}

/** شارةُ الكود الذهبيّة بظلٍّ خفيف — «الكود الخاص بـسارة: SARA» */
function codePill(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, px: number, maxW: number) {
  const text = `${influencerCodeLabelAr(d.name)}: ${d.code}`
  let p = px
  ctx.font = font(700, p)
  while (p > 22 && ctx.measureText(text).width + p * 1.8 > maxW) { p -= 2; ctx.font = font(700, p) }
  const w = ctx.measureText(text).width + p * 1.8
  const h = p * 2.1
  ctx.save()
  ctx.shadowColor = 'rgba(250,188,5,0.35)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 10
  roundRect(ctx, cx - w / 2, y, w, h, h / 2)
  ctx.fillStyle = C.gold
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = C.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font(700, p)
  ctx.fillText(text, cx, y + h / 2 + p * 0.05)
  ctx.textBaseline = 'alphabetic'
}

/** سطرُ المنحة فوق الكود — «منحتك تصل إلى 45٪ من سعر الدورات» */
function grantLine(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, px: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, px)
  ctx.fillText(`منحتك تصل إلى ${d.percentOff}٪ من سعر الدورات`, cx, y)
}

/** رقمٌ في دائرةٍ فيروزيّةٍ فاتحة — للخطوات والدورات */
function numberChip(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, r: number) {
  ctx.fillStyle = SOFT.tint
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, r * 1.05)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), cx, cy + r * 0.06)
  ctx.textBaseline = 'alphabetic'
}

/** علامةُ صحٍّ في دائرةٍ فيروزيّةٍ فاتحة */
function checkChip(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = SOFT.tint
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = C.teal
  ctx.lineWidth = Math.max(3, r * 0.2)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.42, cy)
  ctx.lineTo(cx - r * 0.1, cy + r * 0.32)
  ctx.lineTo(cx + r * 0.45, cy - r * 0.32)
  ctx.stroke()
}

/** صورُ المدرّبين متراكبةً قليلا في صفّ — و«+N» آخرَها */
function facePile(ctx: CanvasRenderingContext2D, imgs: (HTMLImageElement | null)[], more: number, cx: number, y: number, size: number) {
  const step = size * 0.78
  const n = imgs.length + (more > 0 ? 1 : 0)
  const total = step * (n - 1) + size
  let x = cx + total / 2 - size
  imgs.forEach((img) => { tile(ctx, img, x, y, size); x -= step })
  if (more > 0) {
    ctx.save()
    ctx.shadowColor = 'rgba(31,42,46,0.12)'
    ctx.shadowBlur = size * 0.18
    roundRect(ctx, x, y, size, size, size * 0.28)
    ctx.fillStyle = C.tealInk
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = C.white
    ctx.font = font(700, size * 0.32)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.direction = 'ltr'
    ctx.fillText(`+${more}`, x + size / 2, y + size / 2)
    ctx.direction = 'rtl'
    ctx.textBaseline = 'alphabetic'
  }
}

/* ═══ التصاميم ═══ */

type Box = ReturnType<typeof frameOf>

function drawOffer(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const cardW = w - 160
  const big = Math.round(190 * f.s)
  const cardH = big * 2.25
  const y0 = f.top + Math.max(20, (f.bottom - f.top - cardH - 110 * f.s) / 2)
  card(ctx, 80, y0, cardW, cardH, 56)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(30 * f.s))
  ctx.fillText('منحة من أكاديمية وجيز', cx, y0 + big * 0.42)
  ctx.fillStyle = C.ink
  ctx.font = font(700, Math.round(42 * f.s))
  ctx.fillText('منحتك تصل إلى', cx, y0 + big * 0.72)
  ctx.fillStyle = C.gold
  ctx.font = font(700, big)
  ctx.fillText(`${d.percentOff}٪`, cx, y0 + big * 1.62)
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, Math.round(36 * f.s))
  ctx.fillText('من سعر الدورات', cx, y0 + big * 1.88)
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(26 * f.s))
  ctx.fillText([`اختر حتى ${coursesAr(d.maxCourses)}`, ...(d.lastDayAr ? [`آخر يوم ${d.lastDayAr}`] : [])].join(' · '), cx, y0 + big * 2.08)
  softChips(ctx, ['لقاءات على Zoom', 'تسجيل كل لقاء', 'شهادة موثقة'], cx, y0 + cardH + 40 * f.s, Math.round(22 * f.s))
}

async function drawAcademy(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const line = fitLines(ctx, GRANT_ACADEMY_LINE_AR, w - 240, 2, Math.round(28 * f.s), Math.round(22 * f.s), 500)
  const pile = d.photos.length >= MIN_FACES ? Math.round(78 * f.s) : 0
  const ch = 190 * f.s
  /* الكتلةُ كلُّها وسطَ ما بين الرأس والذيل — فلا يبقى في الستوري فراغٌ تحتها */
  const blockH = 140 * f.s + line.lines.length * line.px * 1.45 + 30 * f.s + (pile ? pile + 40 * f.s : 0) + ch
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, Math.round(76 * f.s))
  ctx.fillText('أكاديمية وجيز', cx, top + 80 * f.s)
  ctx.fillStyle = C.muted
  ctx.font = font(500, line.px)
  line.lines.forEach((l, i) => ctx.fillText(l, cx, top + 140 * f.s + i * line.px * 1.45))
  /* صفٌّ صغيرٌ من صور المدرّبين — يقول «معك مدرّبون» بلا أن يغلب */
  let y = top + 140 * f.s + line.lines.length * line.px * 1.45 + 30 * f.s
  if (pile) {
    const shown = d.photos.slice(0, 6)
    const imgs = await Promise.all(shown.map(loadImage))
    facePile(ctx, imgs, Math.max(0, d.trainerTotal - shown.length), cx, y, pile)
    y += pile + 40 * f.s
  }
  /* ثلاثُ بطاقاتٍ بأرقام الموسم */
  const stats = [
    { n: String(d.courses.length), t: underNumber(d.courses.length, 'دورات مباشرة', 'دورة مباشرة') },
    { n: String(d.trainerTotal), t: underNumber(d.trainerTotal, 'مدربين معتمدين', 'مدربا معتمدا') },
    { n: `${d.percentOff}٪`, t: 'منحتك' },
  ].filter((x) => x.n !== '0')
  const gap = 24
  const cw = (w - 160 - gap * (stats.length - 1)) / stats.length
  stats.forEach((x, i) => {
    const left = w - 80 - (i + 1) * cw - i * gap
    card(ctx, left, y, cw, ch, 36)
    ctx.textAlign = 'center'
    ctx.fillStyle = i === stats.length - 1 ? C.gold : C.tealInk
    ctx.font = font(700, Math.round(70 * f.s))
    ctx.fillText(x.n, left + cw / 2, y + ch * 0.52)
    ctx.fillStyle = C.muted
    ctx.font = font(500, Math.round(26 * f.s))
    ctx.fillText(x.t, left + cw / 2, y + ch * 0.8)
  })
}

function drawWhy(ctx: CanvasRenderingContext2D, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const below = heading(ctx, 'لماذا أكاديمية وجيز؟', 'دورات تتعلم فيها وتطبق، مع مدرب معتمد', cx, f.top + 70 * f.s, Math.round(60 * f.s), w - 200)
  const top = below + 60 * f.s
  const cols = size === 'story' ? 1 : 2
  const rows = Math.ceil(ACADEMY_FEATURES.length / cols)
  const gap = 28
  const cw = (w - 160 - gap * (cols - 1)) / cols
  const ch = Math.min((f.bottom - top - gap * (rows - 1)) / rows, (cols === 1 ? 150 : 230) * f.s)
  ACADEMY_FEATURES.forEach((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const left = w - 80 - (col + 1) * cw - col * gap
    const y = top + row * (ch + gap)
    card(ctx, left, y, cw, ch, 36)
    const r = 30 * f.s
    if (cols === 1) {
      checkChip(ctx, left + cw - 40 - r, y + ch / 2, r)
      ctx.fillStyle = C.tealInk
      ctx.textAlign = 'right'
      const tl = fitLines(ctx, t, cw - r * 2 - 100, 1, Math.round(34 * f.s), Math.round(26 * f.s))
      ctx.font = font(700, tl.px)
      ctx.textBaseline = 'middle'
      ctx.fillText(tl.lines[0], left + cw - 60 - r * 2, y + ch / 2)
      ctx.textBaseline = 'alphabetic'
    } else {
      checkChip(ctx, left + cw / 2, y + 30 * f.s + r, r)
      ctx.fillStyle = C.tealInk
      ctx.textAlign = 'center'
      const tl = fitLines(ctx, t, cw - 60, 2, Math.round(30 * f.s), Math.round(24 * f.s))
      ctx.font = font(700, tl.px)
      tl.lines.forEach((l, k) => ctx.fillText(l, left + cw / 2, y + 30 * f.s + r * 2 + 50 * f.s + k * tl.px * 1.3))
    }
  })
  ctx.textAlign = 'center'
}

/** اعرف من أين تبدأ — أربعُ بطاقات: اسمُ الاختبار وما يعطيك، وشارةٌ بزمنه أو عدد أسئلته */
function drawStart(ctx: CanvasRenderingContext2D, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const below = heading(ctx, 'اعرف من أين تبدأ', 'تشخيص واختبارات مجانية، بلا حساب', cx, f.top + 70 * f.s, Math.round(60 * f.s), w - 200)
  const top = below + 56 * f.s
  const cols = size === 'story' ? 1 : 2
  const rows = Math.ceil(ASSESSMENTS.length / cols)
  const gap = 26
  const cw = (w - 160 - gap * (cols - 1)) / cols
  const ch = Math.min((f.bottom - top - gap * (rows - 1)) / rows, (cols === 1 ? 210 : 260) * f.s)
  const tagPx = Math.round(21 * f.s)
  ASSESSMENTS.forEach((a, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const left = w - 80 - (col + 1) * cw - col * gap
    const y = top + row * (ch + gap)
    card(ctx, left, y, cw, ch, 36)
    const pad = 36
    const right = left + cw - pad
    /* الكتلةُ (الشارة، فالاسم، فما يعطيك) وسطَ البطاقة — وتصغر إن لم تتّسع لها */
    const t = fitLines(ctx, a.title, cw - pad * 2, 1, Math.round(36 * f.s), Math.round(26 * f.s))
    const sl = fitLines(ctx, a.sub, cw - pad * 2, 2, Math.round(25 * f.s), Math.round(19 * f.s), 500)
    const th0 = tagPx * 1.9
    const blockH = th0 + t.px * 1.5 + sl.px * 0.6 + sl.lines.length * sl.px * 1.4
    const k = Math.min(1, (ch - 44) / blockH)
    const tp = tagPx * k
    const th = th0 * k
    let yy = y + (ch - blockH * k) / 2
    ctx.font = font(700, tp)
    const tw = ctx.measureText(a.tag).width + tp * 1.6
    roundRect(ctx, right - tw, yy, tw, th, th / 2)
    ctx.fillStyle = SOFT.tint
    ctx.fill()
    ctx.fillStyle = C.tealInk
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(a.tag, right - tw / 2, yy + th / 2 + tp * 0.05)
    ctx.textBaseline = 'top'
    yy += th + t.px * 0.4 * k
    ctx.textAlign = 'right'
    ctx.fillStyle = C.ink
    ctx.font = font(700, t.px * k)
    ctx.fillText(t.lines[0], right, yy)
    yy += t.px * 1.1 * k + sl.px * 0.6 * k
    ctx.fillStyle = C.muted
    ctx.font = font(500, sl.px * k)
    sl.lines.forEach((l, n) => ctx.fillText(l, right, yy + n * sl.px * 1.4 * k))
    ctx.textBaseline = 'alphabetic'
  })
  ctx.textAlign = 'center'
}

/** مزايا وجيز — ثماني مزايا بعلامة صحّ: عمودان في المنشور والشريحة، وعمودٌ في الستوري */
function drawFeatures(ctx: CanvasRenderingContext2D, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const below = heading(ctx, 'كل ما تجده في وجيز', 'من أول خطوة حتى الشهادة', cx, f.top + 70 * f.s, Math.round(60 * f.s), w - 200)
  const top = below + 50 * f.s
  const cols = size === 'story' ? 1 : 2
  const rows = Math.ceil(ACADEMY_PERKS.length / cols)
  const gap = 20
  const cw = (w - 160 - gap * (cols - 1)) / cols
  const ch = Math.min((f.bottom - top - gap * (rows - 1)) / rows, (cols === 1 ? 110 : 130) * f.s)
  const r = Math.min(26 * f.s, ch * 0.26)
  ACADEMY_PERKS.forEach((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const left = w - 80 - (col + 1) * cw - col * gap
    const y = top + row * (ch + gap)
    card(ctx, left, y, cw, ch, 30)
    checkChip(ctx, left + cw - 28 - r, y + ch / 2, r)
    ctx.fillStyle = C.tealInk
    ctx.textAlign = 'right'
    const tl = fitLines(ctx, t, cw - r * 2 - 76, 1, Math.round((cols === 1 ? 34 : 28) * f.s), Math.round(20 * f.s))
    ctx.font = font(700, tl.px)
    ctx.textBaseline = 'middle'
    ctx.fillText(tl.lines[0], left + cw - 48 - r * 2, y + ch / 2)
    ctx.textBaseline = 'alphabetic'
  })
  ctx.textAlign = 'center'
}

async function drawTrainers(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  heading(ctx, 'تتعلم مع نخبة من المدربين', `${trainersCountAr(d.trainerTotal)} · ${coursesAr(d.courses.length)} مباشرة على Zoom`, cx, f.top + 80 * f.s, Math.round(60 * f.s), w - 200)
  const shown = d.photos.slice(0, 6)
  const imgs = await Promise.all(shown.map(loadImage))
  const size = Math.round(118 * f.s)
  const y = f.top + 80 * f.s + (f.bottom - f.top - 80 * f.s) / 2 - size / 2 + 10 * f.s
  facePile(ctx, imgs, Math.max(0, d.trainerTotal - shown.length), cx, y, size)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(28 * f.s))
  ctx.fillText('مدرب معتمد لدينا يرافقك في كل لقاء', cx, y + size + 70 * f.s)
}

/** كلُّ المدرّبين معا — شبكةٌ من صورهم تملأ ما فوق البطاقة، وبطاقةٌ بيضاءُ أسفلَها تقول من هم */
async function drawTeam(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const photos = d.photos.slice(0, size === 'story' ? 20 : size === 'slide' ? 16 : 12)
  const imgs = await Promise.all(photos.map(loadImage))
  const cardH = 230 * f.s
  const gridTop = f.top + 10
  const gridBottom = f.bottom - cardH - 30 * f.s
  const cols = size === 'post' ? 6 : 5
  const rows = Math.ceil(photos.length / cols)
  const gap = 18
  const tileSize = Math.min((w - 140 - gap * (cols - 1)) / cols, (gridBottom - gridTop - gap * (rows - 1)) / rows)
  const gridH = rows * tileSize + gap * (rows - 1)
  const y0 = gridTop + (gridBottom - gridTop - gridH) / 2
  imgs.forEach((img, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, photos.length - row * cols)
    const col = i % cols
    const rowW = inRow * tileSize + gap * (inRow - 1)
    const x = cx + rowW / 2 - (col + 1) * tileSize - col * gap
    tile(ctx, img, x, y0 + row * (tileSize + gap), tileSize)
  })
  const cy = f.bottom - cardH
  card(ctx, 80, cy, w - 160, cardH, 44)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  ctx.font = font(700, Math.round(52 * f.s))
  ctx.fillText('مدربونا', cx, cy + cardH * 0.42)
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(28 * f.s))
  ctx.fillText(`${trainersCountAr(d.trainerTotal)} في ${coursesAr(d.courses.length)} مباشرة هذا الفصل`, cx, cy + cardH * 0.72)
}

function drawCourses(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const below = heading(ctx, 'دورات مباشرة هذا الفصل', d.termAr, cx, f.top + 70 * f.s, Math.round(58 * f.s), w - 200)
  const cap = size === 'story' ? 9 : size === 'slide' ? 6 : 5
  const list = d.courses.slice(0, cap)
  const rest = d.courses.length - list.length
  const top = below + 50 * f.s
  const restH = rest > 0 ? 60 * f.s : 0
  const cardH = f.bottom - top - restH
  card(ctx, 80, top, w - 160, cardH, 44)
  const rowH = (cardH - 40) / Math.max(1, list.length)
  const namePx = Math.round(Math.min(32 * f.s, rowH * 0.36))
  const datePx = Math.round(namePx * 0.74)
  const r = namePx * 0.78
  const right = w - 80 - 44
  list.forEach((c, i) => {
    const yc = top + 20 + i * rowH + rowH / 2
    numberChip(ctx, i + 1, right - r, yc, r)
    ctx.textAlign = 'right'
    ctx.fillStyle = C.ink
    const t = fitLines(ctx, shortTitle(c.title), w - 300 - r * 2, 1, namePx, namePx - 6)
    ctx.font = font(700, t.px)
    ctx.fillText(t.lines[0], right - r * 2 - 24, yc - datePx * 0.15)
    ctx.fillStyle = C.muted
    ctx.font = font(500, datePx)
    ctx.fillText(c.startsAt ? `تبدأ ${d.dayAr(c.startsAt)}` : 'موعدها قريبا', right - r * 2 - 24, yc + datePx * 1.15)
    if (i < list.length - 1) {
      ctx.fillStyle = SOFT.line
      ctx.fillRect(130, top + 20 + (i + 1) * rowH, w - 260, 2)
    }
  })
  if (rest > 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = C.muted
    ctx.font = font(700, Math.round(26 * f.s))
    ctx.fillText(`و${coursesAr(rest)} أخرى تختار منها`, cx, f.bottom - 8)
  }
}

function drawSteps(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const below = heading(ctx, 'كيف تحجز منحتك؟', 'ثلاث خطوات، وتبدأ', cx, f.top + 70 * f.s, Math.round(60 * f.s), w - 200)
  const lines = ['افتح الرابط في البايو', `اكتب الكود ${d.code}`, `اختر حتى ${coursesAr(d.maxCourses)} واحجز منحتك`]
  const top = below + 60 * f.s
  const gap = 26
  const ch = Math.min((f.bottom - top - gap * 2) / 3, 170 * f.s)
  lines.forEach((l, i) => {
    const y = top + i * (ch + gap)
    card(ctx, 80, y, w - 160, ch, 36)
    const r = 34 * f.s
    numberChip(ctx, i + 1, w - 80 - 44 - r, y + ch / 2, r)
    ctx.textAlign = 'right'
    ctx.fillStyle = C.tealInk
    const t = fitLines(ctx, l, w - 320, 1, Math.round(38 * f.s), Math.round(28 * f.s))
    ctx.font = font(700, t.px)
    ctx.textBaseline = 'middle'
    ctx.fillText(t.lines[0], w - 80 - 44 - r * 2 - 28, y + ch / 2)
    ctx.textBaseline = 'alphabetic'
  })
  ctx.textAlign = 'center'
}

/** مكانُ الصورة في القالب — ظلُّ رأسٍ وكتفين و«صورتك هنا» */
function photoSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = SOFT.tint
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = 'rgba(31,111,120,0.22)'
  ctx.beginPath(); ctx.arc(x + size / 2, y + size * 0.38, size * 0.16, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(x + size / 2, y + size * 1.04, size * 0.34, size * 0.4, 0, Math.PI, 0); ctx.fill()
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, Math.round(size * 0.075))
  ctx.textAlign = 'center'
  ctx.fillText('صورتك هنا', x + size / 2, y + size * 0.88)
}

/** تصميمُه الخاصّ — صورتُه كبيرةً مستديرةَ الزوايا، واسمُه، و«منحتي لكم تصل إلى ٤٥٪» في بطاقة */
async function drawPersonal(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  /* الصورةُ أكبرُ ما يتّسع له المقاس — والستوري أطولُها فصورتُه أكبر */
  const P = size === 'story' ? 560 : size === 'slide' ? 400 : 330
  const cardH = 130 * f.s
  const blockH = P + 72 * f.s + 50 * f.s + 40 * f.s + cardH
  const y0 = f.top + Math.max(10, (f.bottom - f.top - blockH) / 2)
  const x0 = cx - P / 2
  const r = P * 0.22
  const img = d.own.photo ? await loadImage(d.own.photo) : null
  ctx.save()
  ctx.shadowColor = 'rgba(31,42,46,0.16)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 18
  roundRect(ctx, x0, y0, P, P, r)
  ctx.fillStyle = C.white
  ctx.fill()
  ctx.restore()
  const b = 10
  ctx.save()
  roundRect(ctx, x0 + b, y0 + b, P - b * 2, P - b * 2, r - b)
  ctx.clip()
  if (img) {
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.2 : (img.naturalHeight - side) / 2
    ctx.drawImage(img, (img.naturalWidth - side) / 2, sy, side, side, x0 + b, y0 + b, P - b * 2, P - b * 2)
  } else photoSlot(ctx, x0 + b, y0 + b, P - b * 2)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink
  const nm = fitLines(ctx, d.own.name, w - 200, 1, Math.round(58 * f.s), Math.round(36 * f.s))
  ctx.font = font(700, nm.px)
  ctx.fillText(nm.lines[0], cx, y0 + P + 72 * f.s)
  ctx.fillStyle = C.muted
  ctx.font = font(500, Math.round(28 * f.s))
  ctx.fillText('أنصحكم بأكاديمية وجيز', cx, y0 + P + 122 * f.s)
  /* «منحتي لكم تصل إلى» والنسبةُ ذهبيّةٌ كبيرةٌ إلى يسارها، في بطاقةٍ بيضاء */
  const cy = y0 + P + 162 * f.s
  const lead = 'منحتي لكم تصل إلى'
  const tail = 'من سعر الدورات'
  const big = `${d.percentOff}٪`
  const lp = Math.round(32 * f.s)
  const bp = Math.round(76 * f.s)
  ctx.font = font(700, lp)
  const lw = ctx.measureText(lead).width
  const tw = ctx.measureText(tail).width
  ctx.font = font(700, bp)
  const bw = ctx.measureText(big).width
  const gap = 22 * f.s
  const total = lw + gap + bw + gap + tw
  const cw = Math.min(w - 160, total + 90 * f.s)
  card(ctx, cx - cw / 2, cy, cw, cardH, cardH / 2)
  let right = cx + total / 2
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, lp)
  ctx.fillText(lead, right, cy + cardH / 2 + lp * 0.08)
  right -= lw + gap
  ctx.fillStyle = C.gold
  ctx.font = font(700, bp)
  ctx.fillText(big, right, cy + cardH / 2 + bp * 0.06)
  right -= bw + gap
  ctx.fillStyle = C.tealInk
  ctx.font = font(700, lp)
  ctx.fillText(tail, right, cy + cardH / 2 + lp * 0.08)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
}

/** يرسم تصميما بمقاسه */
export async function drawGrantArt(design: GrantDesign, size: GrantSize, d: GrantArtData): Promise<HTMLCanvasElement> {
  const [w, h] = SIZE[size]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  await Promise.all([document.fonts.load(font(700, 40)), document.fonts.load(font(500, 40))]).catch(() => undefined)
  const logo = await loadImage('/logo-mark.png')
  ctx.direction = 'rtl'
  softBackground(ctx, w, h)
  softHeader(ctx, logo, w)
  const f = frameOf(size)
  const cx = w / 2

  if (design === 'personal') await drawPersonal(ctx, d, f, w, size)
  else if (design === 'offer') drawOffer(ctx, d, f, w)
  else if (design === 'academy') await drawAcademy(ctx, d, f, w)
  else if (design === 'start') drawStart(ctx, f, w, size)
  else if (design === 'features') drawFeatures(ctx, f, w, size)
  else if (design === 'why') drawWhy(ctx, f, w, size)
  else if (design === 'trainers') await drawTrainers(ctx, d, f, w)
  else if (design === 'team') await drawTeam(ctx, d, f, w, size)
  else if (design === 'courses') drawCourses(ctx, d, f, w, size)
  else drawSteps(ctx, d, f, w)

  /* والذيلُ لكلّ تصميم: سطرُ المنحة (إلّا فيما يقولها) ثمّ الكودُ باسمه — وفي تصميمه الخاصّ باسمه كما كتبه */
  if (design !== 'offer' && design !== 'personal') grantLine(ctx, d, cx, f.lineY, Math.round(28 * f.s))
  codePill(ctx, design === 'personal' ? { ...d, name: d.own.name } : d, cx, f.pillY, Math.round(30 * f.s), w - 160)
  if (f.cta) {
    ctx.textAlign = 'center'
    ctx.fillStyle = C.ink
    ctx.font = font(700, 44)
    ctx.fillText('احجز منحتك — الرابط في البايو', cx, h - 170)
    ctx.fillStyle = C.muted
    ctx.font = font(500, 32)
    ctx.fillText('المنح محدودة', cx, h - 112)
  }
  return canvas
}

/** التصاميمُ المتاحة — «تصميمك الخاص» دائما (قالبُه يطلب صورته)، وما فيه صورُ المدرّبين بثلاثٍ فأكثر، والدوراتُ بواحدةٍ فأكثر */
export function grantDesigns(d: Pick<GrantArtData, 'photos' | 'courses'>): GrantDesign[] {
  return GRANT_DESIGNS.map((x) => x.id).filter((id) =>
    id === 'trainers' || id === 'team' ? d.photos.length >= MIN_FACES : id === 'courses' ? d.courses.length > 0 : true)
}

/** ما يُرسم لكلّ صيغة: التصميمُ المختارُ منشورا أو ستوري، والكاروسيلُ شرائحُ التصاميم المتاحة — أوّلُها تصميمُه الخاصّ
    إن رفع صورته (والقالبُ الفارغُ لا يُنزَّل)، وبلا «المدرّبون»
    وفيه «كلّ المدرّبين» (صورُهم مرّةً واحدةً تكفي في الكاروسيل)، وبلا «لماذا وجيز» وفيه «مزايا وجيز» التي تحويها،
    و«كيف تحجز» آخرَه */
export function grantArtPlan(format: 'post' | 'story' | 'carousel', design: GrantDesign, available: GrantDesign[], ownPhoto = false): { kind: string; index: number }[] {
  if (format !== 'carousel') return [{ kind: `${design}:${format}`, index: 0 }]
  const order: GrantDesign[] = [...(ownPhoto ? ['personal' as const] : []), 'offer', 'academy', 'start', 'team', 'courses', 'features', 'steps']
  return order.filter((x) => available.includes(x)).map((x) => ({ kind: `${x}:slide`, index: 0 }))
}

/** «offer:post» ← التصميمُ ومقاسُه */
export function parseGrantKind(kind: string): { design: GrantDesign; size: GrantSize } {
  const [design, size] = kind.split(':') as [GrantDesign, GrantSize]
  return { design, size }
}
