/* الشارة — كلمةٌ واحدةٌ تقول حالةً، ولونُها يُقرَّر مرّةً في المستودَع كلِّه.
 *
 * كانت الحالةُ الواحدةُ تُلوَّن بصيغٍ مختلفةٍ في شاشاتٍ مختلفة: «قيد المراجعة»
 * ذهبيّةٌ هنا ورماديّةٌ هناك، و«مرفوض» أحمرُ بثلاث درجات. فيتعلّم المستخدمُ
 * لغتَين للشيء نفسِه، ثمّ لا يثق بواحدةٍ منهما.
 *
 * ── ولماذا `tone` لا `color` ──
 *
 * المُنادي يقول **ما الحال** لا **أيّ لون**: `tone="warn"` لا
 * `className="text-gold"`. فيومَ تتغيّر لغةُ اللون تتغيّر في ملفٍّ واحد، ولا
 * يبقى في الشاشات أحمرُ منسيٌّ من عهدٍ مضى.
 *
 * ── والشارةُ ليست زرّا ──
 *
 * لا `onClick` هنا بقصد. شارةٌ تُضغط تُوهم بإجراءٍ لا يقع، ومن يستعمل لوحةَ
 * المفاتيح يقف عندها بلا سبب. فإن أردت إجراءً فهو زرّ، وله شكلُ زرّ.
 */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type ChipTone = 'neutral' | 'accent' | 'positive' | 'warn' | 'danger' | 'info'

/* حدٌّ خفيفٌ وحبرٌ ظاهر — لا تعبئةٌ صمّاء: الشارةُ تُقرأ ولا تصرخ */
const TONE: Record<ChipTone, string> = {
  neutral: 'border-white/15 text-muted-foreground',
  accent: 'border-teal/40 text-teal-light-ink',
  positive: 'border-emerald-400/35 text-emerald-300',
  warn: 'border-gold/40 text-gold-ink',
  danger: 'border-red-400/35 text-danger-ink',
  info: 'border-sky-400/35 text-sky-300',
}

export interface ChipProps {
  tone?: ChipTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
  /* ما لا يظهر للعين ويظهر لقارئ الشاشة: «الحالة: مقبول» بدل «مقبول» عائمةً
     بلا سياق. تُترك فارغةً حين يكفي النصُّ نفسُه. */
  srPrefixAr?: string
}

export default function Chip({
  tone = 'neutral', icon: Icon, children, className = '', srPrefixAr,
}: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-micro font-bold ${TONE[tone]} ${className}`}
    >
      {srPrefixAr && <span className="sr-only">{srPrefixAr}: </span>}
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}
