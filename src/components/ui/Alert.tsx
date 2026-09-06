/* الشريطُ الذي يقول ما وقع — ولمن يقرأ بأذنه لا بعينه.
 *
 * كانت صيغةُ الخطإ الواحدة تتكرّر في إحدى عشرةَ شاشةً حرفا بحرف
 * (`rounded-xl border-red-400/30 bg-red-400/10 …`)، ومعها أخواتُها في صيغٍ
 * تختلف بدرجةِ حمرةٍ أو مقدارِ حشو. فمن يقرأ لا يعرف أهي الحالةُ نفسُها أم
 * حالتان.
 *
 * ── وثلاثةُ فروقٍ عن مجرّد مستطيلٍ ملوّن ──
 *
 * ١) **يُعلَن لقارئ الشاشة.** الخطأُ `role="alert"` فيُقرأ فورَ ظهوره،
 *    والتنبيهُ `role="status"` فيُقرأ بلا مقاطعة. ولونٌ وحدَه لا يبلغ
 *    الكفيفَ ولا من لا يميّز الأحمر.
 *
 * ٢) **لا يعتذر ولا يُبهم.** «تعذّر حفظُ التغييرات — راجع الاتّصالَ ثمّ أعد»
 *    خيرٌ من «حدث خطأ ما». والنصُّ من المُنادي لأنّه يعرف ما وقع، لكنّ
 *    `actionAr` هنا يُلزمه بأن يقول **ما العمل** حين يكون ثمّ عمل.
 *
 * ٣) **العنوانُ اختياريّ.** سطرٌ واحدٌ يكفي غالبا، وعنوانٌ فوق سطرٍ واحدٍ
 *    حشوٌ يبطّئ القراءة.
 */

import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type AlertTone = 'danger' | 'warn' | 'positive' | 'info'

const TONE: Record<AlertTone, { box: string; ink: string; icon: LucideIcon }> = {
  danger: { box: 'border-red-400/30 bg-red-400/10', ink: 'text-danger-ink', icon: XCircle },
  warn: { box: 'border-gold/30 bg-gold/[0.08]', ink: 'text-gold-ink', icon: AlertTriangle },
  positive: { box: 'border-emerald-400/30 bg-emerald-400/[0.08]', ink: 'text-emerald-300', icon: CheckCircle2 },
  info: { box: 'border-teal/30 bg-teal/[0.07]', ink: 'text-teal-light-ink', icon: Info },
}

export interface AlertProps {
  tone?: AlertTone
  titleAr?: string
  children: ReactNode
  /** ما العمل الآن — زرٌّ أو رابطٌ يبنيه المُنادي، فهو يعرف ما يملك */
  actionAr?: ReactNode
  className?: string
}

export default function Alert({
  tone = 'danger', titleAr, children, actionAr, className = '',
}: AlertProps) {
  const t = TONE[tone]
  const Icon = t.icon
  return (
    <div
      /* الخطأُ يقاطع، وما دونه يُقرأ في دوره */
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border px-4 py-3 ${t.box} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.ink}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {titleAr && <p className={`text-sm font-black ${t.ink}`}>{titleAr}</p>}
        <div className={`text-sm leading-6 ${titleAr ? 'mt-1 text-foreground/90' : t.ink}`}>{children}</div>
        {actionAr && <div className="mt-3">{actionAr}</div>}
      </div>
    </div>
  )
}
