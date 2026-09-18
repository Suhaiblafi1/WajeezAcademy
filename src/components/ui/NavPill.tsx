/* حبّةُ تنقّلٍ في شريط بوّابة — درجةٌ في السلّم، لا صيغةٌ تُكتب في كلّ إطار.
 *
 * ── لماذا درجةٌ جديدة ──
 *
 * الصيغةُ نفسُها مكتوبةٌ بيدها في ثلاثة أُطر: بوّابةُ المدرّب وبوّابةُ
 * المستشار وبوّابةُ المتعلّم. ثلاثُ نسخٍ لشيءٍ واحد تفترق أوّلَ يومٍ يُبدَّل
 * فيه أحدُها — وهي علّةُ هذا المستودَع المعروفة.
 *
 * وما استدعاها الآن: شريطُ المدرّب احتاج **زرّا** إلى جانب روابطه («المزيد»
 * الذي يفتح بقيّةَ التبويبات). والزرُّ المكتوبُ بيده يزيد عدّادَ
 * `design-system.test.ts`، وقاعدةُ ذلك الحارس صريحة: «من احتاج صيغةً لا
 * يغطّيها السلّم، فالنقصُ في السلّم لا في القاعدة — تُضاف الدرجة».
 *
 * ── ولماذا شكلان في ملفٍّ واحد ──
 *
 * `NavPill` رابطٌ يقود إلى مسار، و`NavPillButton` زرٌّ يفتح قائمة. وهما
 * **متطابقان في الشكل بالضرورة**: لو افترقا لبدا أحدُهما في الشريط غريبا.
 * فمصدرُ الصيغة واحدٌ (`pillCls`) ولا يُنسخ بينهما.
 *
 * وبوّابتا المستشار والمتعلّم تُرحَّلان إليها بالعين حين تُقرآن — ولم
 * تُرحَّلا مع هذا التغيير كي لا يتّسع ما لم يُطلَب.
 */

import { NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* `shrink-0` كي لا ينضغط النصُّ حين يُمرَّر الشريط على الهاتف،
   و`min-h-11` هدفُ لمسٍ مريحٌ (٤٤ بكسلا). */
const PILL = 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4'

function pillCls(active: boolean): string {
  return `${PILL} ${active ? 'bg-teal text-on-teal' : 'text-muted-foreground hover:text-foreground'}`
}

export interface NavPillProps {
  to: string
  /** يُطابَق المسارُ تامّا — لجذر البوّابة وحدَه، وإلّا نشِط في كلّ صفحاتها */
  end?: boolean
  icon: LucideIcon
  label: string
  /** ما يلحق الاسمَ داخل الحبّة — شارةُ عددٍ مثلا */
  children?: ReactNode
}

/** حبّةٌ تقود إلى مسار */
export function NavPill({ to, end, icon: Icon, label, children }: NavPillProps) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => pillCls(isActive)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      {children}
    </NavLink>
  )
}

export interface NavPillButtonProps {
  /** نشِطةٌ حين يكون المفتوحُ من ذرّيّتها — فلا يبدو الشريطُ بلا موضعٍ نشط */
  active?: boolean
  icon: LucideIcon
  label: string
  expanded: boolean
  onClick: () => void
  children?: ReactNode
}

/** حبّةٌ تفتح قائمةً — لا تقود إلى مسارٍ بنفسها */
export function NavPillButton({ active = false, icon: Icon, label, expanded, onClick, children }: NavPillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="menu"
      className={`${pillCls(active)} cursor-pointer`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      {children}
    </button>
  )
}
