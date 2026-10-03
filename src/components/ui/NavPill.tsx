/* حبّةُ تنقّلٍ في شريط بوّابة — درجةٌ في السلّم، لا صيغةٌ تُكتب في كلّ إطار.
 *
 * ── لماذا درجةٌ جديدة ──
 *
 * الصيغةُ نفسُها كانت مكتوبةً بيدها في ثلاثة أُطر: بوّابةُ المدرّب وبوّابةُ
 * المستشار وبوّابةُ المتعلّم. ثلاثُ نسخٍ لشيءٍ واحد تفترق أوّلَ يومٍ يُبدَّل
 * فيه أحدُها — وهي علّةُ هذا المستودَع المعروفة.
 *
 * وما استدعاها أوّلا: شريطُ المدرّب احتاج **زرّا** إلى جانب روابطه («المزيد»
 * الذي يفتح بقيّةَ التبويبات). والزرُّ المكتوبُ بيده يزيد عدّادَ
 * `design-system.test.ts`، وقاعدةُ ذلك الحارس صريحة: «من احتاج صيغةً لا
 * يغطّيها السلّم، فالنقصُ في السلّم لا في القاعدة — تُضاف الدرجة».
 *
 * ── ولماذا أربعةُ أشكالٍ في ملفٍّ واحد ──
 *
 * `NavPill` رابطٌ يقود إلى مسار، و`NavPillButton` زرٌّ يفتح قائمة، و
 * `NavPillGhost` نسخةٌ لا تُرى يُقاس بها عرضُ الحبّة قبل أن يُقرَّر هل
 * تسعها المساحة، و`NavPillMenuItem` بندُ ما لم يسعه في قائمة «المزيد».
 * والثلاثةُ الأولى **متطابقةٌ في الشكل بالضرورة**: لو افترق الأوّلان لبدا
 * أحدُهما في الشريط غريبا، ولو افترق الشبحُ عنهما لقاس غيرَ ما يُرى — فيُطرَد
 * تبويبٌ يسعه الشريط، أو يُقَصُّ تبويبٌ لا يسعه. فمصدرُ الصيغة واحدٌ
 * (`pillCls`) ومصدرُ الجسم واحدٌ (`PillBody`)، ولا يُنسخ بينها شيء.
 *
 * ── وثلاثةُ ألوانٍ لا ثلاثُ نسخ (٢٧ سبتمبر ٢٠٢٦) ──
 *
 * رُحِّلت بوّابتا المستشار والمتعلّم إليها حين طُبّق عليهما شريطُ المدرّب
 * بقرار صاحب المنصّة. ولكلٍّ هويّتُها: المدرّبُ تركوازٌ ممتلئ، والمستشارُ
 * ذهبٌ ممتلئ، وصفحاتُ القسم عند المتعلّم رقائقُ بحدٍّ لا بأرضيّة — لأنّها
 * تنقّلٌ ثانٍ تحت شريطٍ أوّل، فلا تنافسه. فصار اللونُ مُعامِلا (`look`)
 * والصيغةُ واحدة.
 */

import { Link, NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* `shrink-0` كي لا تنضغط الحبّةُ حين يضيق الشريط: عرضُها الطبيعيُّ هو ما
   يقيسه الشبح، فلو انضغطت لقاس شيئا ورُسم غيرُه.
   و`min-h-11` هدفُ لمسٍ مريحٌ (٤٤ بكسلا).

   و`px-3` في كلّ مقاس، بلا `sm:px-4` التي كانت تُضاف فوق الهاتف: شريطُ
   المدرّب يحمل ثلاثةَ عشرَ تبويبا، وقرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) أن
   تُرى كلُّها على الحاسوب. وتلك الزيادةُ ١٠٤ بكسلات على الثلاثة عشر، فلا
   يسعها إطارُ ١٢٨٠ — وهو إطارُ الحاسوب الشائع بشاشة ١٩٢٠ وتكبيرِ ١٥٠٪ —
   ويقف ١٣٦٦ على حافّتها ببكسل. والأرقامُ كاملةً في `PortalTabs`.
   والحرفُ لم يُصغَّر: شكا صاحبُ المنصّة من صغره مرّةً
   (`site-nav-size.test.ts`)، فما يُقتطَع من الفراغ لا من القراءة. */
/* ═══ وعلى الهاتف حشوٌ أضيق (٣ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة على صورة الهاتف: «make them appear more». فالحشوُ دون
   `sm` ثمانيةُ بكسلاتٍ لا اثنا عشر — والحرفُ كما هو، وهدفُ اللمس كما هو. */
const PILL = 'flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs font-bold transition sm:gap-1.5 sm:px-3'

/* والرقاقةُ صيغةُ صفحات القسم عند المتعلّم كما كانت (`px-4` وحدٌّ)، ومعها ما
   تحتاجه لتُقاس: `shrink-0` و`min-h-11` — وهذه الأخيرةُ كانت تأتيها من
   `nav a` في `index.css`، فصارت في صيغتها لا في مصادفة موضعها. */
const CHIP = 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition'

export type PillLook = 'teal' | 'gold' | 'chip'

const LOOKS: Record<PillLook, { base: string; on: string; off: string; menuOn: string }> = {
  teal: { base: PILL, on: 'bg-teal text-on-teal', off: 'text-muted-foreground hover:text-foreground', menuOn: 'bg-teal text-on-teal' },
  gold: { base: PILL, on: 'bg-gold text-on-gold', off: 'text-muted-foreground hover:text-foreground', menuOn: 'bg-gold text-on-gold' },
  chip: {
    base: CHIP,
    on: 'border-teal/60 bg-teal/15 text-teal-light-ink',
    off: 'border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground',
    menuOn: 'bg-teal/15 text-teal-light-ink',
  },
}

function pillCls(active: boolean, look: PillLook): string {
  const l = LOOKS[look]
  return `${l.base} ${active ? l.on : l.off}`
}

interface PillBodyProps {
  /** يُرسم حين يُمرَّر وحدَه: شريطُ المدرّب بلا رموزٍ كي تسع الثلاثةَ عشرَ سطرَها */
  icon?: LucideIcon
  label: string
  /** ما يلحق الاسمَ داخل الحبّة — شارةُ عددٍ مثلا */
  children?: ReactNode
  /** اللون: هويّةُ البوّابة (`teal` افتراضا) */
  look?: PillLook
}

/* جسمُ الحبّة في أشكالها الثلاثة — والرمزُ حين يُمرَّر وحدَه */
function PillBody({ icon: Icon, label, children }: Omit<PillBodyProps, 'look'>) {
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
  /** نشاطٌ يقرّره الإطار لا المسار: قسمٌ عند المتعلّم تقع صفحاتُه خارجَ مساره
      («تعلّمي» نشِطٌ في `/student/review`). فيُرسم رابطا بـ`aria-current`
      صريح — و`NavLink` لا يقبل أن يُقال له «أنت نشِط» خلافَ مطابقته. */
  active?: boolean
}

/** حبّةٌ تقود إلى مسار */
export function NavPill({ to, end, active, icon, label, children, look = 'teal' }: NavPillProps) {
  if (active !== undefined) {
    return (
      <Link to={to} aria-current={active ? 'page' : undefined} className={pillCls(active, look)}>
        <PillBody icon={icon} label={label}>{children}</PillBody>
      </Link>
    )
  }
  return (
    <NavLink to={to} end={end} className={({ isActive }) => pillCls(isActive, look)}>
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
export function NavPillButton({ active = false, icon, label, expanded, onClick, children, look = 'teal' }: NavPillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="menu"
      className={`${pillCls(active, look)} cursor-pointer`}
    >
      <PillBody icon={icon} label={label}>{children}</PillBody>
    </button>
  )
}

/** شبحُ حبّةٍ للقياس — الشكلُ نفسُه بلا رابطٍ ولا زرّ، فلا يُركَّز ولا يُنقَر.
 *  والإخفاءُ على حاويته (`invisible` و`aria-hidden`) لا عليه: هو يُقاس، وهي
 *  التي تقرّر أنّه لا يُرى. */
export function NavPillGhost({ icon, label, children, look = 'teal' }: PillBodyProps) {
  return (
    <span className={pillCls(false, look)}>
      <PillBody icon={icon} label={label}>{children}</PillBody>
    </span>
  )
}

export interface NavPillMenuItemProps extends Omit<NavPillProps, 'look'> {
  look?: PillLook
  onClick?: () => void
}

/** بندٌ في قائمة «المزيد» — ونشاطُه بلون الحبّة التي خرج منها */
export function NavPillMenuItem({ to, end, active, icon: Icon, label, children, look = 'teal', onClick }: NavPillMenuItemProps) {
  const cls = (on: boolean) =>
    `flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-xs font-bold transition ${
      on ? LOOKS[look].menuOn : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
    }`
  const body = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
      {children}
    </>
  )
  if (active !== undefined) {
    return (
      <Link to={to} role="menuitem" aria-current={active ? 'page' : undefined} onClick={onClick} className={cls(active)}>
        {body}
      </Link>
    )
  }
  return (
    <NavLink to={to} end={end} role="menuitem" onClick={onClick} className={({ isActive }) => cls(isActive)}>
      {body}
    </NavLink>
  )
}
