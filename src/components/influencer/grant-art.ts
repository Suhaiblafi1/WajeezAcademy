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

/** اسمُ الدورة قصيرا — ما قبل النقطتين، وبلا ما بين القوسين */
export const shortTitle = (title: string) => splitTitle(title).name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()

/* ═══ الهيئةُ الجديدة (٣١ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «جميعُ التصاميم فيها نصٌّ كثير وتقليديّة… يجب أن يكون ما قلّ ودلّ، وأن يكون التصميمُ أنعم ولا يظهر
   وكأنّه AI generated»، و«صورُ المدرّبين على شكل دوائر، ولا داعي أن نقول ٢٤ دورة و١٤ مدرّبا — هذه أرقامٌ ليست بفخرة…
   أمورٌ تحفيزيّةٌ أكثر: ماذا سيحصل الشخص؟»، و«صورةُ الإنفلونسر وتحتها منحةٌ خاصّةٌ لمتابعيني ٤٥٪».
   فصار لكلّ تصميمٍ فكرةٌ واحدة: عنوانٌ قصيرٌ بخطٍّ كبير تحته خطٌّ ذهبيٌّ مرسومٌ باليد، وسطرٌ واحدٌ بعده على الأكثر،
   والنسبةُ ملصقٌ ذهبيٌّ مائل، وصورُ المدرّبين دوائرُ بإطارٍ أبيض. وأرضيّتان تتناوبان: «ليل» فيروزيٌّ عميقٌ بدوائرِ ضوءٍ
   خافتة، و«نهار» نعناعيٌّ فاتح — وحبيباتٌ خفيفةٌ فوقهما تكسر ملاسةَ ما يُولَّد. ولا قوائمَ ولا أرقامَ عددٍ ولا بطاقاتٌ مكدّسة. */

type Mood = 'night' | 'day'

const TONE = {
  night: { bg: '#0E4950', glow: [43, 138, 146, 0.55], warm: [250, 188, 5, 0.16], head: '#FFFFFF', sub: '#CDEBE8', grain: 'rgba(255,255,255,0.05)' },
  day: { bg: '#EAF5F3', glow: [168, 222, 216, 0.7], warm: [250, 188, 5, 0.16], head: '#10272B', sub: '#3E5A5E', grain: 'rgba(16,39,43,0.04)' },
} as const

/** لكلّ تصميمٍ أرضيّتُه — يتناوبان في الكاروسيل */
const MOOD: Record<GrantDesign, Mood> = {
  personal: 'night', offer: 'night', academy: 'day', start: 'day', features: 'night',
  why: 'day', trainers: 'night', team: 'day', courses: 'day', steps: 'night',
}

/** حدودُ المتن والذيل لكلّ مقاس */
function frameOf(size: GrantSize) {
  if (size === 'story') return { top: 300, bottom: 1480, pillY: 1560, s: 1.3, cta: true }
  if (size === 'slide') return { top: 210, bottom: 1130, pillY: 1190, s: 1.1, cta: false }
  return { top: 180, bottom: 880, pillY: 930, s: 1, cta: false }
}

/** الأرضيّة: لونٌ واحد، ودائرتا ضوءٍ خافتتان، وحبيباتٌ ثابتةُ المواضع (بذرةٌ واحدة — فالصورةُ نفسُها كلَّ مرّة) */
function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, mood: Mood) {
  const t = TONE[mood]
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, w, h)
  /* والضوءُ يخفت إلى لونه شفّافا لا إلى أسودَ شفّاف — وإلّا رمّد الأرضيّةَ الفاتحة */
  const glow = (x: number, y: number, r: number, [cr, cg, cb, a]: readonly number[]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`)
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  glow(w * 0.88, h * 0.1, w * 0.7, t.glow)
  glow(w * 0.08, h * 0.92, w * 0.6, t.warm)
  let seed = 20261031
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  ctx.fillStyle = t.grain
  for (let i = 0; i < 2600; i++) ctx.fillRect(rand() * w, rand() * h, 2, 2)
}

/** الرأس: علامةُ وجيز صغيرةً واسمُها — لا شارات */
function header(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, w: number, mood: Mood) {
  if (logo) ctx.drawImage(logo, w - 60 - 58, 56, 58, 58)
  ctx.fillStyle = TONE[mood].head
  ctx.font = font(700, 30)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('أكاديمية وجيز', w - 60 - 58 - 16, 86)
  ctx.textBaseline = 'alphabetic'
}

/** خطٌّ ذهبيٌّ كأنّه بالقلم تحت العنوان */
function swoosh(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, s: number) {
  ctx.save()
  ctx.strokeStyle = C.gold
  ctx.lineWidth = 9 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + width / 2, y)
  ctx.quadraticCurveTo(cx + width * 0.1, y + 16 * s, cx - width / 2, y - 6 * s)
  ctx.stroke()
  ctx.restore()
}

/** العنوان: سطران على الأكثر بخطٍّ كبير، وتحته الخطُّ الذهبيّ — ويُرجع أسفلَه */
function headline(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, px: number, width: number, mood: Mood, s: number): number {
  const t = fitLines(ctx, text, width, 2, px, Math.round(px * 0.7))
  ctx.textAlign = 'center'
  ctx.fillStyle = TONE[mood].head
  ctx.font = font(700, t.px)
  t.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * t.px * 1.18))
  const last = y + (t.lines.length - 1) * t.px * 1.18
  ctx.font = font(700, t.px)
  const lw = Math.min(ctx.measureText(t.lines[t.lines.length - 1]).width * 0.55, width * 0.5)
  swoosh(ctx, cx, last + t.px * 0.42, lw, s)
  return last + t.px * 0.42
}

/** سطرٌ واحدٌ بعد العنوان */
function subline(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, px: number, width: number, mood: Mood) {
  const t = fitLines(ctx, text, width, 2, px, Math.round(px * 0.8), 500)
  ctx.textAlign = 'center'
  ctx.fillStyle = TONE[mood].sub
  ctx.font = font(500, t.px)
  t.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * t.px * 1.45))
  return y + (t.lines.length - 1) * t.px * 1.45
}

/** ملصقُ النسبة: ذهبيٌّ مائلٌ بظلّ، وفوق الرقم «لحد» */
function sticker(ctx: CanvasRenderingContext2D, cx: number, cy: number, pct: number, px: number, tilt = -0.08) {
  const big = `${pct}٪`
  ctx.font = font(700, px)
  const w = ctx.measureText(big).width + px * 0.7
  const h = px * 1.55
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt)
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = px * 0.35
  ctx.shadowOffsetY = px * 0.1
  roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.26)
  ctx.fillStyle = C.gold
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#10272B'
  ctx.textAlign = 'center'
  ctx.font = font(500, Math.round(px * 0.24))
  ctx.fillText('لحد', 0, -h / 2 + px * 0.34)
  ctx.font = font(700, px)
  ctx.fillText(big, 0, h / 2 - px * 0.22)
  ctx.restore()
}

/** صورةٌ في دائرةٍ بإطارٍ أبيضَ وظلٍّ خفيف — أو دائرةٌ فاتحة إن تعذّرت */
function circlePhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, r: number, ring = 0.06) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.22)'
  ctx.shadowBlur = r * 0.3
  ctx.shadowOffsetY = r * 0.06
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = C.white
  ctx.fill()
  ctx.restore()
  const inner = r * (1 - ring)
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.2 : (img.naturalHeight - side) / 2
    ctx.drawImage(img, (img.naturalWidth - side) / 2, sy, side, side, cx - inner, cy - inner, inner * 2, inner * 2)
  } else {
    ctx.fillStyle = '#CFE7E5'
    ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2)
  }
  ctx.restore()
}

/** شاراتٌ قصيرةٌ في سطرٍ أو سطرين — للكلمات لا للجمل */
function pills(ctx: CanvasRenderingContext2D, items: readonly string[], cx: number, y: number, px: number, maxW: number, mood: Mood): number {
  ctx.font = font(500, px)
  const padX = px * 1.1
  const h = px * 2.1
  const gap = px * 0.6
  const rows: string[][] = [[]]
  let rowW = 0
  for (const t of items) {
    const tw = ctx.measureText(t).width + padX * 2
    if (rows[rows.length - 1].length > 0 && rowW + gap + tw > maxW) { rows.push([]); rowW = 0 }
    rows[rows.length - 1].push(t)
    rowW += (rowW ? gap : 0) + tw
  }
  rows.forEach((row, ri) => {
    const widths = row.map((t) => ctx.measureText(t).width + padX * 2)
    let right = cx + (widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1)) / 2
    const ry = y + ri * (h + gap)
    row.forEach((t, i) => {
      roundRect(ctx, right - widths[i], ry, widths[i], h, h / 2)
      ctx.fillStyle = mood === 'night' ? 'rgba(255,255,255,0.12)' : '#FFFFFF'
      ctx.fill()
      ctx.fillStyle = TONE[mood].head
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = font(500, px)
      ctx.fillText(t, right - widths[i] / 2, ry + h / 2 + px * 0.05)
      ctx.textBaseline = 'alphabetic'
      right -= widths[i] + gap
    })
  })
  return y + rows.length * (h + gap) - gap
}

/** الكودُ باسمه في الذيل — «الكود الخاص بـسارة: SARA» */
function codePill(ctx: CanvasRenderingContext2D, d: GrantArtData, cx: number, y: number, px: number, maxW: number, mood: Mood = 'night') {
  const text = `${influencerCodeLabelAr(d.name)}: ${d.code}`
  let p = px
  ctx.font = font(700, p)
  while (p > 22 && ctx.measureText(text).width + p * 1.8 > maxW) { p -= 2; ctx.font = font(700, p) }
  const w = ctx.measureText(text).width + p * 1.8
  const h = p * 2.1
  roundRect(ctx, cx - w / 2, y, w, h, h / 2)
  ctx.fillStyle = mood === 'night' ? C.white : '#0E4950'
  ctx.fill()
  ctx.fillStyle = mood === 'night' ? '#0E4950' : C.white
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font(700, p)
  ctx.fillText(text, cx, y + h / 2 + p * 0.05)
  ctx.textBaseline = 'alphabetic'
}

/** رقمٌ في دائرةٍ ذهبيّة — للخطوات وحدَها، فهي تسلسل */
function stepDot(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, r: number) {
  ctx.fillStyle = C.gold
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#10272B'
  ctx.font = font(700, r * 1.05)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), cx, cy + r * 0.06)
  ctx.textBaseline = 'alphabetic'
}

/** دوائرُ المدرّبين متجاورةً في سطورٍ متداخلةٍ قليلا — كأنّهم معا لا في جدول */
function circleCluster(ctx: CanvasRenderingContext2D, imgs: (HTMLImageElement | null)[], cx: number, top: number, bottom: number, w: number) {
  const n = imgs.length
  if (n === 0) return
  /* والمتنُ الطويلُ (الستوري) يأخذ سطورا أكثر — فتكبر الدوائرُ بدل أن يبقى نصفُه فارغا */
  const tall = bottom - top > w * 0.75
  const perRow = n <= 3 ? n : tall ? Math.ceil(n / (n <= 6 ? 2 : n <= 12 ? 3 : 4)) : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3)
  const rows = Math.ceil(n / perRow)
  const r = Math.min((w - 160) / (perRow * 1.85), (bottom - top) / (rows * 1.85 + 0.2))
  const step = r * 1.85
  const blockH = r * 2 + (rows - 1) * step * 0.92
  const y0 = top + (bottom - top - blockH) / 2 + r
  imgs.forEach((img, i) => {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, n - row * perRow)
    const col = i % perRow
    const rowW = (inRow - 1) * step
    circlePhoto(ctx, img, cx + rowW / 2 - col * step, y0 + row * step * 0.92, r)
  })
}

/* ═══ التصاميم ═══ */

type Box = ReturnType<typeof frameOf>

/** تصميمُه الخاصّ — صورتُه في دائرةٍ كبيرة، واسمُه، و«منحة خاصة لمتابعيني» والملصق */
async function drawPersonal(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const mood = MOOD.personal
  const r = size === 'story' ? 300 : size === 'slide' ? 230 : 190
  const img = d.own.photo ? await loadImage(d.own.photo) : null
  const blockH = r * 2 + 60 * f.s + 150 * f.s
  const cy = f.top + Math.max(10, (f.bottom - f.top - blockH) / 2) + r
  if (img) circlePhoto(ctx, img, cx, cy, r, 0.035)
  else {
    circlePhoto(ctx, null, cx, cy, r, 0.035)
    ctx.fillStyle = 'rgba(14,73,80,0.25)'
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.22, r * 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.75, r * 0.55, r * 0.5, 0, Math.PI, 0); ctx.fill()
    ctx.fillStyle = '#0E4950'
    ctx.font = font(700, Math.round(r * 0.14))
    ctx.textAlign = 'center'
    ctx.fillText('صورتك هنا', cx, cy + r * 0.62)
  }
  sticker(ctx, cx - r * 0.78, cy + r * 0.62, d.percentOff, Math.round(r * 0.42))
  ctx.textAlign = 'center'
  ctx.fillStyle = TONE[mood].sub
  ctx.font = font(500, Math.round(30 * f.s))
  ctx.fillText(d.own.name, cx, cy + r + 62 * f.s)
  headline(ctx, 'منحة خاصة لمتابعيني', cx, cy + r + 140 * f.s, Math.round(64 * f.s), w - 180, mood, f.s)
}

/** المنحة: عنوانٌ وملصقٌ كبير، وسطرٌ يقول على ماذا */
function drawOffer(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const mood = MOOD.offer
  const big = Math.round(170 * f.s)
  const blockH = 90 * f.s + big * 1.55 + 70 * f.s + 120 * f.s
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  headline(ctx, 'منحة خاصة لمتابعيني', cx, top + 70 * f.s, Math.round(66 * f.s), w - 180, mood, f.s)
  sticker(ctx, cx, top + 90 * f.s + 60 * f.s + big * 0.78, d.percentOff, big)
  subline(ctx, 'على دورات أكاديمية وجيز، بمناسبة انطلاقتها', cx, top + 150 * f.s + big * 1.55 + 70 * f.s, Math.round(32 * f.s), w - 200, mood)
}

/** الأكاديمية: ما يحصل عليه — بلا أرقام. وصفٌّ صغيرٌ من دوائر المدرّبين إن كانوا */
async function drawAcademy(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const mood = MOOD.academy
  const faces = d.photos.length >= MIN_FACES ? d.photos.slice(0, 5) : []
  const r = Math.round(52 * f.s)
  const blockH = 260 * f.s + (faces.length ? r * 2 + 60 * f.s : 0)
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  const below = headline(ctx, 'تعلم اليوم، طبق غدا', cx, top + 80 * f.s, Math.round(76 * f.s), w - 180, mood, f.s)
  const after = subline(ctx, 'دورات مباشرة مع مدربين من أهل المجال', cx, below + 80 * f.s, Math.round(32 * f.s), w - 220, mood)
  if (faces.length) {
    const imgs = await Promise.all(faces.map(loadImage))
    const step = r * 1.7
    const y = after + 70 * f.s + r
    imgs.forEach((img, i) => circlePhoto(ctx, img, cx + ((imgs.length - 1) * step) / 2 - i * step, y, r))
  }
}

/** من أين تبدأ: سؤالٌ وجوابٌ في سطر، وأسماءُ الاختبارات شاراتٍ صغيرة */
function drawStart(ctx: CanvasRenderingContext2D, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const mood = MOOD.start
  const blockH = 420 * f.s
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  const below = headline(ctx, 'لا تعرف من أين تبدأ؟', cx, top + 80 * f.s, Math.round(74 * f.s), w - 160, mood, f.s)
  const after = subline(ctx, 'تشخيص مجاني يدلك على طريقك، بلا حساب', cx, below + 80 * f.s, Math.round(32 * f.s), w - 220, mood)
  pills(ctx, ASSESSMENTS.map((a) => a.title), cx, after + 60 * f.s, Math.round((size === 'story' ? 28 : 25) * f.s), w - 160, mood)
}

/** المزايا: عنوانٌ وأربعُ كلماتٍ لا ثمانٍ */
function drawFeatures(ctx: CanvasRenderingContext2D, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const mood = MOOD.features
  const blockH = 400 * f.s
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  const below = headline(ctx, 'كل ما تحتاجه في مكان واحد', cx, top + 80 * f.s, Math.round(70 * f.s), w - 160, mood, f.s)
  const shown = [ACADEMY_PERKS[2], ACADEMY_PERKS[4], ACADEMY_PERKS[5], ACADEMY_PERKS[6]]
  pills(ctx, shown, cx, below + 80 * f.s, Math.round((size === 'story' ? 30 : 27) * f.s), w - 160, mood)
}

/** لماذا: جملةٌ واحدةٌ تقول الفرق */
function drawWhy(ctx: CanvasRenderingContext2D, f: Box, w: number) {
  const cx = w / 2
  const mood = MOOD.why
  const blockH = 300 * f.s
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  const below = headline(ctx, 'لا تجمع شهادات، ابن مهارة', cx, top + 80 * f.s, Math.round(78 * f.s), w - 160, mood, f.s)
  subline(ctx, 'تطبيق عملي في كل دورة، ومدرب يرافقك', cx, below + 80 * f.s, Math.round(32 * f.s), w - 220, mood)
}

/** المدرّبون: دوائرُ معا، وعنوانٌ يقول من هم — بلا عدد */
async function drawTrainers(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const mood = MOOD.trainers
  const below = headline(ctx, 'تعلم من أهل الخبرة', cx, f.top + 80 * f.s, Math.round(70 * f.s), w - 180, mood, f.s)
  const imgs = await Promise.all(d.photos.slice(0, 7).map(loadImage))
  circleCluster(ctx, imgs, cx, below + 50 * f.s, f.bottom - 70 * f.s, w)
  subline(ctx, 'مدربون معتمدون يرافقونك في كل لقاء', cx, f.bottom - 10 * f.s, Math.round(30 * f.s), w - 220, mood)
}

/** كلُّ المدرّبين معا — دوائرُهم تملأ المتن */
async function drawTeam(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const mood = MOOD.team
  const below = headline(ctx, 'مدربونا', cx, f.top + 80 * f.s, Math.round(74 * f.s), w - 180, mood, f.s)
  const imgs = await Promise.all(d.photos.slice(0, size === 'story' ? 15 : 12).map(loadImage))
  circleCluster(ctx, imgs, cx, below + 40 * f.s, f.bottom, w)
}

/** الدورات: أسماؤها شاراتٍ — خمسٌ على الأكثر، بلا مواعيد */
function drawCourses(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number, size: GrantSize) {
  const cx = w / 2
  const mood = MOOD.courses
  const list = d.courses.slice(0, size === 'story' ? 7 : 5).map((c) => shortTitle(c.title))
  const rest = d.courses.length - list.length
  const blockH = 160 * f.s + list.length * 70 * f.s
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  const below = headline(ctx, 'دورات هذا الفصل', cx, top + 80 * f.s, Math.round(70 * f.s), w - 180, mood, f.s)
  const px = Math.round(28 * f.s)
  let y = below + 70 * f.s
  for (const t of list) {
    y = pills(ctx, [t], cx, y, px, w - 160, mood) + px * 0.7
  }
  if (rest > 0) subline(ctx, 'ودورات أخرى تختار منها', cx, y + px * 1.2, Math.round(26 * f.s), w - 200, mood)
}

/** كيف تحجز: ثلاثُ خطواتٍ مرقّمة — فهي تسلسلٌ حقّا */
function drawSteps(ctx: CanvasRenderingContext2D, d: GrantArtData, f: Box, w: number) {
  const cx = w / 2
  const mood = MOOD.steps
  const lines = ['افتح الرابط في البايو', `اكتب كودي ${d.code}`, 'اختر دوراتك واحجز']
  const gap = 120 * f.s
  const blockH = 200 * f.s + gap * 3
  const top = f.top + Math.max(0, (f.bottom - f.top - blockH) / 2)
  const below = headline(ctx, '3 خطوات وتبدأ', cx, top + 80 * f.s, Math.round(72 * f.s), w - 180, mood, f.s)
  const px = Math.round(38 * f.s)
  ctx.font = font(700, px)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const r = 30 * f.s
  const right = cx + (widest + r * 2 + 30 * f.s) / 2
  lines.forEach((l, i) => {
    const y = below + 110 * f.s + i * gap
    stepDot(ctx, i + 1, right - r, y, r)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = TONE[mood].head
    ctx.font = font(700, px)
    ctx.fillText(l, right - r * 2 - 30 * f.s, y + px * 0.05)
    ctx.textBaseline = 'alphabetic'
  })
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
  const mood = MOOD[design]
  backdrop(ctx, w, h, mood)
  header(ctx, logo, w, mood)
  const f = frameOf(size)
  const cx = w / 2

  if (design === 'personal') await drawPersonal(ctx, d, f, w, size)
  else if (design === 'offer') drawOffer(ctx, d, f, w)
  else if (design === 'academy') await drawAcademy(ctx, d, f, w)
  else if (design === 'start') drawStart(ctx, f, w, size)
  else if (design === 'features') drawFeatures(ctx, f, w, size)
  else if (design === 'why') drawWhy(ctx, f, w)
  else if (design === 'trainers') await drawTrainers(ctx, d, f, w)
  else if (design === 'team') await drawTeam(ctx, d, f, w, size)
  else if (design === 'courses') drawCourses(ctx, d, f, w, size)
  else drawSteps(ctx, d, f, w)

  /* والذيلُ لكلّ تصميم: الكودُ باسمه — وفي تصميمه الخاصّ باسمه كما كتبه. والستوري يقول أين الرابط */
  codePill(ctx, design === 'personal' ? { ...d, name: d.own.name } : d, cx, f.pillY, Math.round(30 * f.s), w - 160, mood)
  if (f.cta) {
    ctx.textAlign = 'center'
    ctx.fillStyle = TONE[mood].sub
    ctx.font = font(500, 34)
    ctx.fillText('الرابط في البايو', cx, h - 150)
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
