/* سلّمُ الأسطح — البنيةُ تحمل معلومةً لا زينة.
 *
 * ── العطبُ الذي يزيله، مقيسا ──
 *
 * في المستودَع **٧٦٣ صيغةَ «بطاقة» فريدة** مكتوبةً في مكانها، والاثنتا عشرةَ
 * الأولى وحدَها تتكرّر ١٧٥ مرّة. فحين تُحسَّن شاشةٌ تبقى الثلاثُ الأخريات كما
 * هي، ويُقرأ الحكمُ صادقا: «التصاميمُ لم تتغيّر».
 *
 * ── لكنّ العلاجَ ليس مكوّنَ «بطاقة» واحدا ──
 *
 * العطبُ الأعمقُ أنّ **كلَّ شيءٍ بطاقة**: انحناءٌ واحدٌ وحدٌّ واحدٌ لقسمٍ كامل
 * ولصفٍّ داخله ولتفصيلٍ داخل الصفّ. فلا تقول البنيةُ شيئا عن الأهمّيّة، وتصير
 * الصفحةُ سطحا واحدا مسطَّحا يبحث فيه القارئُ عن مبتدإٍ ومنتهى.
 *
 * فالنظامُ **سلّمٌ من ثلاث درجات، والعمقُ يُقرأ من الشكل**:
 *
 *   Panel  — حاويةُ قسمٍ في الصفحة.   انحناءٌ أوسع · حدٌّ أظهر · أرضيّةٌ أعلى
 *   Card   — عنصرٌ داخل قسم.          انحناءٌ أضيق · حدٌّ أخفت
 *   Inset  — تفصيلٌ داخل عنصر.        بلا حدٍّ · أرضيّةٌ غاطسة
 *
 * كلّما عمُقتَ ضاق الانحناءُ وخفَت الحدّ. فالتداخلُ يُرى بلا أن يُشرَح، ولا
 * يحتاج القارئُ إلى عدِّ الإطارات.
 *
 * ── واللونُ يُقرَّر مرّةً واحدة ──
 *
 * `tone` يحمل الحالةَ: `accent` لما يستحقّ نظرةً أولى، و`positive` و`warn`
 * و`danger` للحالات. وكانت هذه تُكتب بتسع صيغٍ مختلفةٍ للحالة الواحدة —
 * فيختلف أحمرُ شاشةٍ عن أحمرِ أختها، ويتعلّم المستخدمُ لغتَين للشيء نفسِه.
 *
 * ── وقاعدةُ استعمالٍ واحدة ──
 *
 * **لا تُمرَّر `className` فيها حدٌّ أو انحناءٌ أو أرضيّة.** المسافاتُ الخارجيّة
 * والعرضُ والشبكةُ من حقّ المُنادي؛ أمّا هيئةُ السطح فمن هنا وحدَها — وإلّا
 * عادت الصيغُ السبعُمئة من الباب الخلفيّ. وحارسُ
 * `src/tests/design-system.test.ts` يعدّ ما بقي منها ويمنع نموّه.
 */

import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type SurfaceTone = 'default' | 'accent' | 'positive' | 'warn' | 'danger'

/* الأرضيّةُ والحدُّ لكلّ حالة. والفصلُ بين «تعبئة» و«حبر» مقصودٌ ومكتوبٌ في
   `index.css`: `teal` للحدّ والتعبئة، و`teal-ink` للنصّ. وخلطُهما يقلب سطحا
   هادئا إلى لوحةٍ ساطعة. */
const TONE: Record<SurfaceTone, string> = {
  default: 'border-white/10 bg-white/[0.03]',
  accent: 'border-teal/30 bg-teal/[0.06]',
  positive: 'border-emerald-400/25 bg-emerald-400/[0.05]',
  warn: 'border-gold/30 bg-gold/[0.05]',
  danger: 'border-red-400/30 bg-red-400/[0.06]',
}

/* الحدُّ يخفت مع العمق: قسمٌ يُرى إطارُه، وتفصيلٌ داخله لا يحتاج إطارا ثالثا */
const DEPTH = {
  panel: 'rounded-3xl border p-6',
  card: 'rounded-2xl border p-5',
  inset: 'rounded-xl border-0 p-4',
} as const

/* وأرضيّةُ الغاطس أعمقُ لا أعلى — فالتفصيلُ يغوص في حاضنه ولا يطفو فوقه */
const INSET_TONE: Record<SurfaceTone, string> = {
  ...TONE,
  default: 'bg-black/20',
}

/* ═══ السطحُ الذي يُضغط — وحلقةُ التركيز التي كانت غائبة ═══

   في المستودَع **٤٧٢ زرّا مكتوبا بيده، و`focus-visible` في ثلاثة مواضعَ**.
   أي أنّ من يتنقّل بلوحة المفاتيح لا يرى أين هو في المنصّات الأربع — يضغط
   Tab فيختفي المؤشّر، فلا يعرف ما الذي سيقع إن ضغط Enter.

   وهذا عطبُ إتاحةٍ صامت: لا يُحمّر اختبارا، ولا يشتكي منه من يستعمل الفأرة
   — وهم من يراجعون الشاشات. فالحلقةُ هنا في أصل السطح، لا خيارا يُذكَر في
   كلّ استعمالٍ فيُنسى في أكثرها.

   والتحويمُ معها: حدٌّ يميل إلى الفيروزيّ يقول «هذا يُضغط» قبل الضغط. */
const INTERACTIVE =
  'cursor-pointer text-start transition hover:border-teal/40 hover:bg-teal/[0.04] '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 '
  + 'focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-40'

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  tone?: SurfaceTone
  /** سطحٌ يُضغط: يحمل حلقةَ تركيزٍ ظاهرةً وتحويما. استعمله مع `as="button"` */
  interactive?: boolean
  /** العنصرُ الدلاليّ — `section` لقسمٍ له عنوان، `article` لعنصرٍ قائمٍ بذاته */
  as?: ElementType
  /** مسافاتٌ وعرضٌ وشبكةٌ فقط — لا حدَّ ولا انحناءَ ولا أرضيّة */
  className?: string
  children?: ReactNode
  /* السطحُ يصير أيَّ وسمٍ أو مكوّن (`as={Link}`، `as="label"`)، فيحمل خصائصَه:
     `to` للرابط، و`htmlFor` للّصيقة. ولا يُعرف نوعُها هنا لأنّها تتبع `as`. */
  [key: string]: unknown
}

function make(depth: keyof typeof DEPTH) {
  return function SurfaceLevel({
    tone = 'default', as, interactive = false, className = '', children, ...rest
  }: SurfaceProps) {
    const Tag = (as ?? 'div') as ElementType
    const palette = depth === 'inset' ? INSET_TONE[tone] : TONE[tone]
    return (
      <Tag
        className={`${DEPTH[depth]} ${palette} ${interactive ? INTERACTIVE : ''} ${className}`}
        {...rest}
      >
        {children}
      </Tag>
    )
  }
}

/** الدرجةُ الأولى — حاويةُ قسمٍ في الصفحة */
export const Panel = make('panel')

/** الدرجةُ الثانية — عنصرٌ داخل قسم */
export const Card = make('card')

/** الدرجةُ الثالثة — تفصيلٌ داخل عنصر. غاطسٌ بلا حدّ */
export const Inset = make('inset')
