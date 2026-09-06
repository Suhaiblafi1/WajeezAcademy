/* الزرّ — سلّمُ أهمّيّةٍ لا مجموعةُ ألوان.
 *
 * ── ما قِيس قبل الكتابة ──
 *
 * ٤٧٢ زرّا مكتوبا بيده في المستودَع، بـ١٨١ صيغةً فريدة. وفيها:
 *
 *   ٩٧  حدٌّ فقط        ٥٥  ممتلئٌ فيروزيّ
 *   ٤٨  ممتلئٌ ذهبيّ    ٢٤  حدٌّ أحمر        ٨  بلا شيء
 *
 * والرقمان الأوسطان يكشفان قرارا لم يُتَّخذ: **رئيسيّان لا واحد.** ومتى كان
 * للشاشة رئيسيّان فليس لها رئيسيّ — تتنازع العينُ بينهما فلا تستقرّ على
 * أوّلِ ما يجب فعله.
 *
 * فالسلّمُ هنا يفصلهما بالدور لا بالذوق، وهو ما كان يفعله المستودَعُ فعلا
 * قبل أن يُسمَّى:
 *
 *   primary   ذهبيّ  — فعلُ الصفحة الأوّل. **واحدٌ في الشاشة، لا اثنان.**
 *   confirm   فيروزيّ — الفعلُ المُثبِت داخل قسمٍ أو نافذة
 *   secondary حدٌّ    — بديلٌ متاحٌ لا يُنافس
 *   danger    أحمر   — ما لا يُتراجَع عنه
 *   ghost     بلا    — إجراءٌ في هامشٍ لا في مسار
 *
 * ── وحلقةُ التركيز في الأصل ──
 *
 * كان `focus-visible` في ثلاثة مواضعَ من ٤٧٢ زرّا: من يتنقّل بلوحة المفاتيح
 * لا يرى أين هو. وهي هنا في كلّ نبرة، فلا تُنسى.
 *
 * ── والانتظارُ يُعلَن لا يُخمَّن ──
 *
 * `loading` يعطّل الزرَّ ويضع دوّامةً ويُعلن `aria-busy`. وكان النمطُ
 * `disabled={busy}` وحدَه: الزرُّ يبهت ولا شيءَ يقول لماذا — ولقارئ الشاشة
 * لا يقول شيئا إطلاقا.
 */

import { Loader2, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ElementType, ReactNode } from 'react'

export type ButtonTone = 'primary' | 'confirm' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const TONE: Record<ButtonTone, string> = {
  primary: 'bg-gold text-on-gold font-black hover:bg-gold/90',
  confirm: 'bg-teal text-on-teal font-black hover:bg-teal-light',
  secondary: 'border border-white/15 text-foreground font-bold hover:border-white/40',
  danger: 'border border-red-500/40 text-danger-ink font-bold hover:bg-red-500/10',
  ghost: 'text-muted-foreground font-bold hover:text-foreground',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'gap-1.5 px-4 py-1.5 text-micro',
  md: 'gap-2 px-5 py-2 text-xs',
}

/* الحلقةُ بإزاحةٍ عن أرضيّة الصفحة — فتُرى على الداكن، وهي بلا إزاحةٍ تلتصق
   بحدّ الزرّ فتكاد تختفي على النبرات ذاتِ الحدّ. */
const BASE =
  'inline-flex cursor-pointer items-center justify-center rounded-full transition '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal '
  + 'focus-visible:ring-offset-2 focus-visible:ring-offset-paper '
  + 'disabled:cursor-not-allowed disabled:opacity-40'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  tone?: ButtonTone
  size?: ButtonSize
  icon?: LucideIcon
  /** يعطّل ويُعلن `aria-busy` ويضع دوّامة — لا بهتانٌ صامت */
  loading?: boolean
  /** `Link` أو `a` حين يكون الفعلُ انتقالا لا تنفيذا */
  as?: ElementType
  /** مسافاتٌ وعرضٌ فقط — لا لونَ ولا حشوَ ولا انحناء */
  className?: string
  children?: ReactNode
  [key: string]: unknown
}

export default function Button({
  tone = 'secondary', size = 'md', icon: Icon, loading = false,
  as, className = '', children, disabled, type, ...rest
}: ButtonProps) {
  const Tag = (as ?? 'button') as ElementType
  const isButton = Tag === 'button'
  return (
    <Tag
      /* النوعُ صريحٌ دائما: زرٌّ بلا `type` داخل نموذجٍ يُرسله عند الضغط —
         وهو عطبٌ يظهر مرّةً كلَّ شهرٍ ولا يُفهم سببُه. */
      {...(isButton ? { type: type ?? 'button', disabled: disabled || loading } : {})}
      aria-busy={loading || undefined}
      className={`${BASE} ${TONE[tone]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        : Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </Tag>
  )
}
