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
 * ── ولماذا ثلاثةُ أشكالٍ في ملفٍّ واحد ──
 *
 * `NavPill` رابطٌ يقود إلى مسار، و`NavPillButton` زرٌّ يفتح قائمة، و
 * `NavPillGhost` نسخةٌ لا تُرى يُقاس بها عرضُ الحبّة قبل أن يُقرَّر هل
 * تسعها المساحة. والثلاثةُ **متطابقةٌ في الشكل بالضرورة**: لو افترق الأوّلان
 * لبدا أحدُهما في الشريط غريبا، ولو افترق الشبحُ عنهما لقاس غيرَ ما يُرى —
 * فيُطرَد تبويبٌ يسعه الشريط، أو يُقَصُّ تبويبٌ لا يسعه. فمصدرُ الصيغة واحدٌ
 * (`pillCls`) ومصدرُ الجسم واحدٌ (`PillBody`)، ولا يُنسخ بينها شيء.
 *
 * وبوّابتا المستشار والمتعلّم تُرحَّلان إليها بالعين حين تُقرآن — ولم
 * تُرحَّلا مع هذا التغيير كي لا يتّسع ما لم يُطلَب.
 */

import { NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* `shrink-0` كي لا تنضغط الحبّةُ حين يضيق الشريط: عرضُها الطبيعيُّ هو ما
   يقيسه الشبح، فلو انضغطت لقاس شيئا ورُسم غيرُه.
   و`min-h-11` هدفُ لمسٍ مريحٌ (٤٤ بكسلا).

   و`px-3` في كلّ مقاس، بلا `sm:px-4` التي كانت تُضاف فوق الهاتف: شريطُ
   المدرّب يحمل ثلاثةَ عشرَ تبويبا، وقرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) أن
   تُرى كلُّها على الحاسوب. وتلك الزيادةُ ١٠٤ بكسلات على الثلاثة عشر، فلا
   يسعها إطارُ ١٢٨٠ — وهو إطارُ الحاسوب الشائع بشاشة ١٩٢٠ وتكبيرِ ١٥٠٪ —
   ويقف ١٣٦٦ على حافّتها ببكسل. والأرقامُ كاملةً في `TabsBar`.
   والحرفُ لم يُصغَّر: شكا صاحبُ المنصّة من صغره مرّةً
   (`site-nav-size.test.ts`)، فما يُقتطَع من الفراغ لا من القراءة. */
const PILL = 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition'

function pillCls(active: boolean): string {
  return `${PILL} ${active ? 'bg-teal text-on-teal' : 'text-muted-foreground hover:text-foreground'}`
}

interface PillBodyProps {
  /** اختياريّة: شريطُ المدرّب بلا رموزٍ كي تسع التبويباتُ الثلاثةَ عشر سطرَها */
  icon?: LucideIcon
  label: string
  children?: ReactNode
}

/* جسمُ الحبّة في أشكالها الثلاثة — والرمزُ حين يُمرَّر وحدَه */
function PillBody({ icon: Icon, label, children }: PillBodyProps) {
  return (
    <>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
      {children}
    </>
  )
}

export interface NavPillProps extends PillBodyProps {
  to: string
  /** يُطابَق المسارُ تامّا — لجذر البوّابة وحدَه، وإلّا نشِط في كلّ صفحاتها */
  end?: boolean
}

/** حبّةٌ تقود إلى مسار */
export function NavPill({ to, end, icon, label, children }: NavPillProps) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => pillCls(isActive)}>
      <PillBody icon={icon} label={label}>{children}</PillBody>
    </NavLink>
  )
}

export interface NavPillButtonProps extends PillBodyProps {
  /** نشِطةٌ حين يكون المفتوحُ من ذرّيّتها — فلا يبدو الشريطُ بلا موضعٍ نشط */
  active?: boolean
  expanded: boolean
  onClick: () => void
}

/** حبّةٌ تفتح قائمةً — لا تقود إلى مسارٍ بنفسها */
export function NavPillButton({ active = false, icon, label, expanded, onClick, children }: NavPillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="menu"
      className={`${pillCls(active)} cursor-pointer`}
    >
      <PillBody icon={icon} label={label}>{children}</PillBody>
    </button>
  )
}

/** شبحُ حبّةٍ للقياس — الشكلُ نفسُه بلا رابطٍ ولا زرّ، فلا يُركَّز ولا يُنقَر.
 *  والإخفاءُ على حاويته (`invisible` و`aria-hidden`) لا عليه: هو يُقاس، وهي
 *  التي تقرّر أنّه لا يُرى. */
export function NavPillGhost({ icon, label, children }: PillBodyProps) {
  return (
    <span className={pillCls(false)}>
      <PillBody icon={icon} label={label}>{children}</PillBody>
    </span>
  )
}
