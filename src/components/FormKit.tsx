/* لبِناتُ النماذج — سؤالٌ له حدٌّ، وحقلٌ بقياسٍ واحد، وخياراتٌ بمربّعاتٍ متساوية.

   العطب الذي وُلدت منه: نموذج انضمام المدرّب كان عشرين حقلا في شريطٍ واحد
   لا يفصلها إلّا خطٌّ شعرة (`border-white/5`)، وعناوينُها بحجم تلميحاتها.
   فوصفه صاحب المنصّة بأنّه «مبعثر وغير واضح — لا أعرف ما هو السؤال وأين
   ينتهي ومتى يبدأ». وكانت أوسمةُ الاختيار تُرصَف بعرضِ نصِّها، فيصير
   الجواب القصير مربّعا صغيرا والطويلُ مربّعا يملأ السطر — «مربعات لبعض
   الإجابات تأخذ مساحة أكبر من الأخرى».

   فهنا ثلاثُ لبِنات تُصلح الثلاثة بترتيبها:
   - `Question` يعطي كلَّ سؤالٍ صندوقا مرقّما — فبدايتُه ونهايتُه مرئيّتان.
   - `Field` يوحّد العنوان والتلميح والمسافة فوق كلّ حقل.
   - `ChoiceGrid` يرصف الخيارات في شبكةٍ خلاياها متساوية لا في سطرٍ متعرّج.

   ولا شيءَ منها يمسّ البيانات: هذه هيئةٌ فقط، والحقول ومعرّفاتُها ومصادرُها
   كما هي. */

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Card } from '@/components/ui/Surface'

/** قياسٌ واحد لكلّ حقلِ سطرٍ واحد — إدخالا كان أو قائمة */
export const controlCls =
  'h-12 w-full rounded-xl border border-white/15 bg-paper/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none'

/** والنصُّ الطويل يشترك في كلّ شيءٍ إلّا الارتفاع */
export const areaCls =
  'w-full rounded-xl border border-white/15 bg-paper/30 px-4 py-3 text-sm leading-7 text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none'

/** نجمةُ الإلزام — بلونٍ واحدٍ في الصفحة كلّها */
function Req() {
  return <span className="text-gold-ink"> *</span>
}

/** سؤالٌ له حدٌّ مرئيّ ورقمٌ يُقرأ — لا فقرةٌ تسيل في التي تليها */
export function Question({
  n,
  title,
  hint,
  required = false,
  children,
}: {
  n: number
  title: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}) {
  return (
    <Card as="section" className="sm:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal/15 text-xs font-black tabular-nums text-teal-light-ink"
        >
          {n}
        </span>
        <div className="min-w-0">
          {/* h2 لا h3: عنوانُ الصفحة h1، والقفزُ إلى h3 يوهم قارئَ الشاشة
              بقسمٍ غائب — وبوّابةُ الإتاحة تردّه (heading-order). */}
          <h2 className="text-sm font-black leading-6 text-foreground">
            {title}
            {required && <Req />}
          </h2>
          {hint && <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  )
}

/** صفّا حقولٍ متساويين — عمودٌ على الهاتف وعمودان على الشاشة */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>
}

/** حقلٌ واحد: عنوانُه فوقه، وتلميحُه تحت العنوان، والمسافةُ واحدة دائما */
/* ─────────── خطأُ الحقل: يُقال عنده لا في آخر النموذج ───────────

   كانت النماذجُ تُخبر بالخطأ **بعد الإرسال** وفي موضعٍ واحدٍ أعلى الصفحة أو
   أسفلها: «أكمل الحقولَ المطلوبة». فمن ملأ عشرةَ حقولٍ وأخطأ في واحدٍ يبحث
   عنه بعينه، ولا يعرف أيُّها المقصود.

   والشرطان اللذان يجعلان الرسالةَ مفيدةً حقّا:
   • **تظهر عند الحقل** لا في نهايةِ النموذج.
   • **وتُعلَن لقارئ الشاشة** موصولةً بالحقل نفسِه: `aria-invalid` تقول إنّ
     فيه خطأً، و`aria-describedby` تقول ما هو. وبلا الوصلِ يسمع المستخدمُ
     «حقلٌ نصّيّ» ولا يسمع سببَ الرفض.

   ولا تظهر قبل أن يُحاول: رسالةُ خطأٍ على حقلٍ لم يُلمس بعد لومٌ لا إرشاد. */
export function FieldError({ id, children }: { id: string; children?: string | null }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-1.5 text-micro font-bold leading-5 text-red-300">
      {children}
    </p>
  )
}

/** ما يُوصَل بالحقل نفسِه ليُقرأ خطؤه — يُنثَر على `input` أو `textarea` */
// eslint-disable-next-line react-refresh/only-export-components -- سماتٌ خالصةٌ بلا حالة؛ بقاؤها بجانب `FieldError` مقصود
export function invalidProps(errorId: string, error?: string | null) {
  return error
    ? ({ 'aria-invalid': true, 'aria-describedby': errorId } as const)
    : ({} as Record<string, never>)
}

export function Field({
  label,
  htmlFor,
  hint,
  required = false,
  wide = false,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  required?: boolean
  wide?: boolean
  /** خطأُ هذا الحقل — يُعرض عنده ويُوصَل به */
  error?: string | null
  children: ReactNode
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={htmlFor} className="block text-[12.5px] font-bold leading-6 text-foreground">
        {label}
        {required && <Req />}
      </label>
      {hint && <p className="mt-0.5 text-micro leading-5 text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
      {errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

/** المثلُ للمجموعات: `fieldset` بدل `label` كي يصحّ ربطُ الخيارات المتعددة */
export function FieldSet({
  legend,
  hint,
  required = false,
  wide = false,
  error,
  name,
  children,
}: {
  legend: string
  hint?: ReactNode
  required?: boolean
  wide?: boolean
  error?: string | null
  /** يُشتقّ منه معرّفُ رسالة الخطأ حين لا يكون للمجموعة `htmlFor` */
  name?: string
  children: ReactNode
}) {
  const errorId = name ? `${name}-error` : undefined
  return (
    <fieldset className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <legend className="text-[12.5px] font-bold leading-6 text-foreground">
        {legend}
        {required && <Req />}
      </legend>
      {hint && <p className="mt-0.5 text-micro leading-5 text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
      {errorId && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  )
}

/* خياراتٌ في شبكةٍ لا في سطرٍ متعرّج.

   الرصفُ بعرض النصّ (`flex-wrap` على أوسمةٍ حرّة) يجعل «سلاسل الإمداد
   واللوجستيات» ضعفَ «التعلّم الذاتي» فيبدو أحدُهما أهمَّ من الآخر، ويترك
   في آخر كلّ سطرٍ فراغا مختلفا — وهو ما رآه صاحب المنصّة تبعثرا. والشبكةُ
   تُسوّي الخلايا فتستوي الأهمّيّة وتستقيم الحواف. */
export interface GridOption {
  value: string
  label: string
}

export function OptionGrid({
  items,
  isOn,
  onToggle,
  cols = 3,
  name,
}: {
  items: readonly GridOption[]
  isOn: (value: string) => boolean
  onToggle: (value: string) => void
  /** عمودان لخياراتٍ طويلة النصّ، وثلاثةٌ لقصيرها */
  cols?: 2 | 3
  /** يدخل في `aria-label` كي يعرف قارئُ الشاشة أيَّ سؤالٍ يُجيب */
  name?: string
}) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {items.map((it) => {
        const on = isOn(it.value)
        return (
          <button
            type="button"
            key={it.value}
            onClick={() => onToggle(it.value)}
            aria-pressed={on}
            aria-label={name ? `${name}: ${it.label}` : it.label}
            className={`flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right text-xs font-bold leading-5 transition-colors ${
              on
                ? 'border-teal bg-teal/[0.12] text-teal-light-ink'
                : 'border-white/12 bg-paper/25 text-muted-foreground hover:border-white/30 hover:text-foreground'
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                on ? 'border-teal bg-teal' : 'border-white/25'
              }`}
            >
              {on && <Check className="h-3 w-3 text-surface" strokeWidth={3} />}
            </span>
            <span className="min-w-0">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** الحالة الغالبة: الخيار نصُّه هو قيمتُه */
export function ChoiceGrid({
  options,
  selected,
  onToggle,
  cols = 3,
  name,
}: {
  options: readonly string[]
  selected: readonly string[]
  onToggle: (v: string) => void
  cols?: 2 | 3
  name?: string
}) {
  return (
    <OptionGrid
      items={options.map((o) => ({ value: o, label: o }))}
      isOn={(v) => selected.includes(v)}
      onToggle={onToggle}
      cols={cols}
      name={name}
    />
  )
}

/** موافقةٌ تُقرأ ثمّ تُؤشَّر — لا حقلا يبدو فارغا في صفٍّ من الحقول */
export function ConsentRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
        checked ? 'border-teal/40 bg-teal/[0.06]' : 'border-white/12 bg-paper/20 hover:border-white/25'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
      />
      <span className="text-[12.5px] leading-7 text-foreground">{children}</span>
    </label>
  )
}
