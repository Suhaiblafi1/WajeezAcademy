/* شريطُ تبويبات البوّابة — يعرض ما وسعه، و«المزيد» لما لم يسعه وحدَه.
 *
 * قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اجعل قائمةَ العناوين مكتملةً ليست
 * داخلَ المزيد، إلّا إذا استُخدم الهاتفُ والشاشةُ صغيرة — هناك نستخدم المزيدَ
 * لمن لا يظهر». وُضع أوّلا في بوّابة المدرّب، نسخا لـ«خمسةٍ تُرى والباقي في
 * المزيد» (١٨ سبتمبر) التي أبقت الخمسةَ على كلّ شاشة حتّى العريضة. ثمّ قال
 * في اليوم نفسِه: «طبّق نفس الشيء على بوابة المستشار والطالب».
 *
 * فصار مكوّنا واحدا تركّبه البوّاباتُ الثلاث، لا ثلاثَ نسخٍ تفترق: شريطُ
 * المدرّب، وشريطُ المستشار، وشريطُ أقسام المتعلّم وصفحاتُ كلِّ قسم.
 *
 * ── كيف يُقاس ──
 *
 * صفٌّ ثانٍ لا يُرى (`invisible` و`aria-hidden`) يحمل **كلَّ** التبويبات وزرَّ
 * «المزيد» بعرضها الطبيعيّ، ويُقرأ منه عرضُ كلِّ حبّة. والصفُّ المرئيُّ لا يصلح
 * للقياس: ما خرج منه لا عرضَ له، فلا يُعرف متى يعود إن اتّسعت الشاشة. ثمّ تقرّر
 * `fitIndices` أيَّها يُعرض (`ui/nav-fit.ts`).
 *
 * و`ResizeObserver` على الاثنين: على الفسحة لأنّ عرضَها يتبدّل بالشاشة وبمعامل
 * التكبير `--app-scale`، وعلى صفّ الأشباح لأنّ عرضَ الحبّات يتبدّل بالخطّ حين
 * يصل.
 *
 * والأشباحُ تحجز مكانَ الشارة قبل أن يصل عددُها (`reservedCount`): العدّادُ
 * يصل بعد التركيب، فبلا حجزٍ يقفز «طابورُ التقييم» إلى «المزيد» على الهاتف في
 * كلّ انتقال. وشبحُ «المزيد» يحمل عدّادَ الكلّ لا عدّادَ المخفيّ: المخفيُّ لا
 * يُعرف إلّا بعد القياس. وأسوأُ ما في الحجزين تبويبٌ يخرج قبل أوانه بعرض شارة
 * — لا حبّةٌ تُقَصّ، ولا شريطٌ يقفز.
 *
 * ── يملأ سطرَه أو يلتفّ على محتواه ──
 *
 * `fill` (الأصل): الشريطُ بعرض فسحته — المدرّبُ والمستشار في سطرٍ تحت الشعار،
 * وصفحاتُ القسم عند المتعلّم. وبلا `fill` يلتفّ الشريطُ على حبّاته في فسحةٍ
 * مرنة: أقسامُ المتعلّم بين الشعار والأدوات، والترويسةُ هناك لا تطول لأنّ
 * `ModuleStudy` يُلصِق خطواتِه تحتها بـ`top-16`.
 *
 * وفي الحالين **تُقاس الفسحةُ لا الشريط**: الشريطُ الملتفُّ عرضُه عرضُ ما فيه،
 * فلو قيس هو لما اتّسع أبدا بعد أن ضاق — يضيق فيُخرج تبويبا فيضيق عرضُه فلا
 * يرى مكانا لما خرج.
 *
 * ── والحاشيةُ تُقاس لا تُفترض ──
 *
 * للشريط حدٌّ وحشوٌ (`p-1`) تأكلان من الفسحة. وصفُّ الأشباح يحمل الحاشيةَ
 * نفسَها، فهي عرضُه ناقصا ما بين أطراف حبّاته. ورقمٌ مكتوبٌ هنا (١٠ بكسلات)
 * يصير ١٣ تحت معامل التكبير، ويفترق عن الصيغة يومَ تُبدَّل.
 *
 * ── ولماذا `flushSync` ──
 *
 * التحديثُ من مراقب الحجم يُجدوَل بعد الرسم، فيرى الهاتفُ إطارا فيه التبويباتُ
 * كلُّها مقصوصةً بلا «المزيد» ثمّ تُصحَّح. والمراقبُ يُنادى بعد التخطيط وقبل
 * الرسم، فالتصييرُ المتزامنُ فيه يجعل أوّلَ ما يُرسم صحيحا — والإطاراتُ تُعاد
 * تركيبُها مع كلّ شاشة، فذاك الإطارُ الخاطئُ كان سيُرى في كلّ انتقال. ويُركَّب
 * المراقبُ في `useLayoutEffect` لا `useEffect` كي يسبق أوّلَ رسمٍ هو أيضا.
 * وقِيس على بناء الإنتاج بمراقبٍ ثانٍ يُنادى بعده قبل الرسم فرآه مصحَّحا.
 *
 * ── ولماذا بلا رموز ──
 *
 * قِيس بالمتصفّح وخطُّ IBM Plex Sans Arabic محمَّل، في البوّابات الثلاث، والرمزُ
 * يُخرج في كلٍّ منها ما كان يسعه الشريط:
 *
 * · المدرّب: الثلاثةَ عشرَ برموزها وحشوِها الأوّل ١٣٠٨ بكسلا (قبل معامل
 *   التكبير)، وبأضيق حشوٍ يُحتمل ١١٠٤، والشريطُ يقف عند ١١٠٢ على أعرض شاشة
 *   (`max-w-6xl`). وبلا رموزٍ ٨٩٦، فتسع كلُّها من إطارٍ نحوُ ١٢٣٠.
 * · المستشار: برموزها لا يسع الهاتفُ (٣٢٠–٣٦٠) إلّا اثنين من أربعة، وبلاها
 *   الأربعةُ كلُّها.
 * · أقسامُ المتعلّم متى نُشرت «المكتبة»: برموزها اثنان من أربعة على ٧٦٨،
 *   وبلاها الأربعة.
 *
 * والاسمُ هو ما يُقرأ. والرموزُ في قائمة «المزيد» حيث تُمسَح بالعين عموديّا،
 * وفي شريط المتعلّم السفليّ على الهاتف — وذاك شريطٌ آخرُ بنسقٍ آخر.
 *
 * ── وما يبيت في البنية ──
 *
 * · الصفُّ المرئيُّ يقصّ (`overflow-hidden`): قياسٌ بائتٌ لإطارٍ واحدٍ يُخفي
 *   طرفَ حبّةٍ ولا يمدّ الصفحةَ عرضا.
 * · وحشوُه يسبق قصَّه (`-m-1 p-1`): حلقةُ التركيز ترتسم خارج الحبّة بأربعة
 *   بكسلات، وصفٌّ يقصّ عند حدّ حبّاته يقطعها من فوقُ ومن تحتُ — في كلّ تبويبٍ
 *   تمرّ به لوحةُ المفاتيح. وكانت صفحاتُ القسم عند المتعلّم تتّقي ذلك بـ
 *   `-mx-1 px-1`، فلا يُفقَد بالترحيل.
 * · ولا تمريرَ فيه: ما لم يسعه يُبلَغ من «المزيد» بنقرةٍ معلومة، لا بتمريرٍ لا
 *   علامةَ عليه — وذاك من قرار ١٨ سبتمبر وما زال قائما.
 * · و«المزيد» خارجَ الصفّ القاصّ: القصُّ يقطع كلَّ `absolute` في داخله، فقائمتُه
 *   كانت ستنفتح مقصوصة.
 * · والفراغُ بين الحبّات واحدٌ في الشريط وصفّيه (`gap`): الحسابُ يقرؤه من
 *   الأشباح ويطبّقه على المرئيّ، فلو افترقا لقاس غيرَ ما يُرسم. وهو صفرٌ في
 *   الحبّات الممتلئة — غيرُ النشطة بلا خلفية، فحشوُها هو ما بين اسمين — وستّةُ
 *   بكسلاتٍ بين الرقائق لأنّ لكلٍّ منها حدّا يُرى.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { Inset } from '@/components/ui/Surface'
import { NavPill, NavPillButton, NavPillGhost, NavPillMenuItem, type PillLook } from '@/components/ui/NavPill'
import { fitIndices, reservedCount } from '@/components/ui/nav-fit'

/** تبويبٌ في شريط البوّابة — وترتيبُه في القائمة أولويّتُه: ما يخرج أوّلا آخرُها */
export interface PortalTab {
  to: string
  label: string
  /** في قائمة «المزيد» وحدَها — الشريطُ بلا رموز */
  icon?: LucideIcon
  end?: boolean
  count?: number
  /** نشاطٌ يقرّره الإطار لا المسار — انظر `NavPill` */
  active?: boolean
}

/* العددُ يُقرأ للعين وللقارئ معا: الرقمُ وحدَه لا يقول ماذا يعدّ. ويختفي عند
   الصفر — «٠ ينتظر» ضجيجٌ لا خبر.

   ومكوّنٌ لا نسخةٌ لأنّه يُرسم في أربعة مواضع: الحبّة، وشبحِها الذي يُقاس به
   عرضُها، وبندِ «المزيد»، وزرِّه. وافتراقُ الشبح عن الحبّة يُفسد القياسَ بصمت.
   وما يُقرأ قبل الرقم من الإطار (`countLabel`): المعدودُ عند المدرّب تسليماتٌ
   تنتظر تصحيحَه، ولا يعرف الشريطُ ذلك. */
function CountBadge({ count, label }: { count?: number; label?: string }) {
  if (!count) return null
  return (
    <span className="rounded-full bg-gold px-1.5 text-fine font-black text-on-gold">
      {label && <span className="sr-only">{label}</span>}{count}
    </span>
  )
}

/* ═══ «المزيد» — لما لم يسعه الشريط، بابٌ يُرى لا تمريرٌ لا يُرى ═══

   جاء هذا الزرُّ بقرار صاحب المنصّة (١٨ سبتمبر ٢٠٢٦): نقرةٌ معلومةٌ خيرٌ من
   تمريرٍ مقدَّر. وكان يحمل ثمانيةً ثابتةً على كلّ شاشة، فصار يحمل ما لم يسعه
   الشريطُ وحدَه (٢٧ سبتمبر) — ولا يظهر أصلا حين يسع الكلّ.

   ── وأربعةٌ تبيت في البنية ──

   · المستمعُ على `document` لا ستارةٌ `fixed`: الترويسةُ تحمل `backdrop-blur`
     و`backdrop-filter` يجعل حاملَه كتلةً حاضنةً لكلّ `fixed` في ذرّيّته،
     فالستارةُ تمتدّ على الترويسة وحدَها. وهي علّةٌ وقعت في ترويسة المدرّب
     بعينها مع `StaffAccountMenu`، فلا تُعاد.
   · والزرُّ يحمل حالةَ النشاط حين يكون المفتوحُ من بنوده: من فتح «مستحقّاتي»
     يرى أين هو، وإلّا بدا الشريطُ بلا موضعٍ نشط. و`end` يُحترَم كما في
     `NavLink`: جذرُ البوّابة لو طوبق بالبادئة لنشِط الزرُّ في كلّ صفحاتها.
   · ويحمل عدّادَ ما خلفه: «طابورُ التقييم» رابعُ قائمة المدرّب فيخرج إليه على
     الهاتف — ورقمُه وُضع في الشريط ليُرى بلا فتحِ شيء، فلا يُدفن خلف نقرة. وهو
     مجموعُ عدّادات المخفيّ بقراءةٍ واحدة (`countLabel`)؛ فمن أضاف عدّادا بمعنًى
     آخر فرّق بينهما هنا، وإلّا قرأ القارئُ «ينتظر تصحيحَك» لغير التصحيح.
   · وتُغلَق عند تبدّل المسار بـ`key={pathname}` من أبيها لا بأثرٍ جانبيٍّ يكتب
     الحالةَ في `useEffect` — وإعادةُ التركيب تضبطها بلا دَينِ تلويم. */
function MoreTabs({ items, look, countLabel }: { items: PortalTab[]; look: PillLook; countLabel?: string }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const here = items.some((t) => t.active ?? (pathname === t.to || (!t.end && pathname.startsWith(`${t.to}/`))))
  const waiting = items.reduce((sum, t) => sum + (t.count ?? 0), 0)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={boxRef} className="relative shrink-0">
      <NavPillButton
        look={look}
        active={here}
        label="المزيد"
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CountBadge count={waiting} label={countLabel} />
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </NavPillButton>

      {open && (
        <Inset role="menu" tone="solid" className="absolute left-0 top-12 z-50 w-64 p-1.5 shadow-2xl">
          {items.map((t) => (
            <NavPillMenuItem
              key={t.to}
              to={t.to}
              end={t.end}
              active={t.active}
              look={look}
              icon={t.icon}
              label={t.label}
              onClick={() => setOpen(false)}
            >
              <CountBadge count={t.count} label={countLabel} />
            </NavPillMenuItem>
          ))}
        </Inset>
      )}
    </div>
  )
}

export interface PortalTabsProps {
  tabs: PortalTab[]
  /** اسمُ الشريط لقارئ الشاشة */
  label: string
  look?: PillLook
  /** يملأ فسحتَه (الأصل)، أو يلتفّ على حبّاته فيها */
  fill?: boolean
  /** ما يُقرأ قبل عدد الشارة لمن لا يرى */
  countLabel?: string
  /** موضعُ الفسحة في الإطار: سطرُها وهوامشُها ومحاذاتُها */
  className?: string
}

export function PortalTabs({ tabs, label, look = 'teal', fill = true, countLabel, className = '' }: PortalTabsProps) {
  const slotRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  /* مواضعُ المعروض لا عددُه — الملءُ يتخطّى العريضَ إلى ضيّقٍ بعده (`fitIndices`) */
  const [shown, setShown] = useState<number[] | null>(null)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const slot = slotRef.current
    const ghost = ghostRef.current
    if (!slot || !ghost || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const rects = Array.from(ghost.children, (el) => el.getBoundingClientRect())
      const more = rects.pop()
      if (!more) return
      /* الفراغُ من موضع حبّتين لا من الأسلوب المحسوب: `getBoundingClientRect`
         يعيد القيمَ مكبَّرةً بمعامل `--app-scale` و`getComputedStyle` يعيدها بلا
         تكبير — ومزجُهما خطأٌ بنسبة ١٫٣ على الحاسوب. وأيُّ الفرقين موجبٌ هو
         الفراغ، في اليمين إلى اليسار وعكسِه. */
      const gap = rects.length > 1
        ? Math.max(0, rects[0].left - rects[1].right, rects[1].left - rects[0].right)
        : 0
      const all = [...rects, more]
      const span = Math.max(...all.map((r) => r.right)) - Math.min(...all.map((r) => r.left))
      const chrome = Math.max(0, ghost.getBoundingClientRect().width - span)
      const next = fitIndices(rects.map((r) => r.width), gap, more.width, slot.getBoundingClientRect().width - chrome)
      flushSync(() => setShown((prev) => (prev && prev.join() === next.join() ? prev : next)))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(slot)
    ro.observe(ghost)
    return () => ro.disconnect()
  }, [])

  const chip = look === 'chip'
  const chrome = chip ? '' : 'rounded-full border border-white/10 bg-white/[0.03] p-1'
  const gap = chip ? 'gap-1.5' : ''
  const counted = tabs.filter((t) => t.count !== undefined)
  const waitingAll = counted.length ? counted.reduce((sum, t) => sum + (t.count ?? 0), 0) : undefined
  const visible = shown ? shown.map((i) => tabs[i]).filter(Boolean) : tabs
  const hidden = shown ? tabs.filter((_, i) => !shown.includes(i)) : []

  return (
    <div ref={slotRef} className={`relative flex min-w-0 items-center ${className}`}>
      <nav aria-label={label} className={`flex min-w-0 items-center ${gap} ${chrome} ${fill ? 'w-full' : 'max-w-full'}`}>
        <div className={`-m-1 flex min-w-0 items-center overflow-hidden p-1 ${gap} ${fill ? 'flex-1' : ''}`}>
          {visible.map((t) => (
            <NavPill key={t.to} to={t.to} end={t.end} active={t.active} look={look} label={t.label}>
              <CountBadge count={t.count} label={countLabel} />
            </NavPill>
          ))}
        </div>
        {hidden.length > 0 && <MoreTabs key={pathname} items={hidden} look={look} countLabel={countLabel} />}
      </nav>
      <div aria-hidden="true" className="pointer-events-none invisible absolute inset-0 overflow-hidden">
        <div ref={ghostRef} className={`flex w-max items-center ${gap} ${chrome}`}>
          {tabs.map((t) => (
            <NavPillGhost key={t.to} look={look} label={t.label}>
              <CountBadge count={reservedCount(t.count)} label={countLabel} />
            </NavPillGhost>
          ))}
          <NavPillGhost look={look} label="المزيد">
            <CountBadge count={reservedCount(waitingAll)} label={countLabel} />
            <ChevronDown className="h-3 w-3 shrink-0" />
          </NavPillGhost>
        </div>
      </div>
    </div>
  )
}
