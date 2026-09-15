/* حقلُ تاريخٍ **يُكتب** أرقاما — والقوائمُ بابٌ ثانٍ لمن أرادها (أ-٢).

   ═══ شكويان لا واحدة ═══

   ① «تعذّبت» في العودة إلى ١٩٨٥ بمنتقي المتصفّح (١٣ سبتمبر ٢٠٢٦). والسببُ
      بنيويّ: المنتقي يتنقّل شهرا شهرا، فبلوغُ سنةٍ قبل أربعين سنةً أربعُمئةٍ
      وثمانون ضغطة. **حُلّت** بثلاث قوائم.
   ② «كتابةُ التاريخ أرقاما ما زالت صعبة… أريد نمطا عالميّا معتادا» (أ-٢).
      وهي هذه: ثلاثُ قوائمَ لتاريخٍ يعرفه صاحبُه عن ظهر قلب أبطأُ من كتابته.

   ═══ فصار الحقلُ يُكتب أوّلا ═══

   `13/09/2026` في حقلٍ واحد، أربعةَ عشرَ محرفا. والقفزُ البعيدُ يُحلّ بالكتابة
   نفسِها — أربعةُ أرقامٍ للسنة، لا قائمةٌ تُمرَّر ولا أربعُمئةُ ضغطة. فالشكويان
   تسقطان معا بحقلٍ واحد، ولا يُبنى نمطان متوازيان.

   **والقوائمُ تبقى بابا ثانيا** لمن لا يعرف تاريخَه رقما أو يفضّل الاختيار —
   تُفتح بزرٍّ ولا تُعرض معه. ولا تُحذف: هي ما حلّ الشكوى الأولى، وحذفُها
   يعيدها.

   ═══ وما لا يُخمَّن ═══

   الناقصُ لا يُكمَّل: `13/09` بلا سنةٍ ليس تاريخا، و«السنةُ الحاليّة» تخمينٌ
   يُرسَل إلى الخادم باسم من لم يكتبه. ومن يكتب لا يُقاطَع برسالة خطأٍ عند كلّ
   محرف — الرسالةُ لما اكتمل شكلا وبطَل معنى («٣١/٠٢»).

   والقسمةُ كلُّها في `application/text/date-parts` تُفحَص بلا شاشة. */

import { useId, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  type DateParts, dateStateFromIso, daysInMonth, MONTHS_AR, parseTypedDate, pickDatePart,
  syncDateState, typeDateText, yearChoices,
} from '@/application/text/date-parts'

export interface DateFieldProps {
  /** `yyyy-mm-dd` أو `''` حين لا اختيار */
  value: string
  onChange: (value: string) => void
  /** أقدمُ سنةٍ في قائمة السنوات وأحدثُها — الحدّان داخلان */
  fromYear: number
  toYear: number
  /** الأحدثُ أوّلا (ميلادٌ) أم الأقدمُ (موعدٌ قادم) */
  yearOrder?: 'asc' | 'desc'
  /** صيغةُ حقول الشاشة المضيفة — فلا يفترق هذا الحقل عمّا حوله */
  selectClassName?: string
  /** يُنادى عند مغادرة الحقل — لتُعرض رسالتُه كبقيّة الحقول */
  onBlur?: () => void
  /* الخطأُ يقع على الحقل كلِّه لا على جزءٍ منه: التاريخُ حقلٌ واحدٌ في ذهن
     القارئ. والاسمان بصيغة `aria-*` عمدا — الشاشاتُ تُنتجهما بـ`bad()` و
     `invalidProps()`، فتُنثَر نتيجتُهما هنا كما تُنثَر على `<input>`. */
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  /** معرّفٌ يشير إليه `<label>` الشاشة — يقع على حقل الكتابة */
  id?: string
  className?: string
}

export default function DateField({
  value, onChange, fromYear, toYear, yearOrder = 'desc',
  selectClassName = '', onBlur, id, className = '', ...aria
}: DateFieldProps) {
  const auto = useId()
  const base = id ?? auto
  /* ═══ الحالةُ هنا لا تُشتقّ من `value` ═══

     `value` لا تحمل إلّا تاريخا مكتملا، والقوائمُ تُملأ جزءا جزءا. فلو
     قُرئت الأجزاءُ منها لارتدّ كلُّ اختيارٍ ناقصٍ إلى الفراغ أمام عين
     صاحبه — وهو العطبُ الموصوفُ في `date-parts`. والانتقالاتُ الثلاثةُ
     هناك خالصةٌ ومفحوصة، وهذا المكوّنُ يناديها لا غير. */
  const [state, setState] = useState(() => dateStateFromIso(value))
  const [picking, setPicking] = useState(false)

  /* ما يأتي من فوقُ يُعرض — تحميلُ ملفٍّ محفوظ، أو تفريغٌ من الشاشة المضيفة.

     والمواءمةُ **أثناء التصيير** لا في أثرٍ بعده: هذه حالةٌ تُشتقّ من خاصّيّة،
     وأثرٌ لها يُصيّر مرّتين ويُعيد رسمَ الحقل تحت إصبع من يكتب (وهو ما يمنعه
     `react-hooks/set-state-in-effect`). والنمطُ من توثيق React نفسِه.

     و`syncDateState` تمنع محوَ ما يُكتب: من كتب «13/09/2026» أنتج القيمةَ
     نفسَها، فلا يُعاد بناءُ نصِّه منها ويقفز مؤشّرُه إلى آخره. */
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setState((prev) => syncDateState(prev, value))
  }

  const parsed = parseTypedDate(state.text)
  const parts = state.parts
  const years = yearChoices(fromYear, toYear, yearOrder)
  const dayCount = daysInMonth(Number(parts.year), Number(parts.month))

  /* الانتقالُ يُحسب مرّةً ويُقرأ منه الاثنان: ما يُعرض وما يُرسَل — فلا
     يفترق ما في الشاشة عمّا في الطلب. */
  const apply = (next: typeof state) => {
    setState(next)
    if (next.iso !== state.iso) onChange(next.iso)
  }

  const type = (next: string) => apply(typeDateText(state, next))

  const set = (patch: Partial<DateParts>) => apply(pickDatePart(state, patch))

  const cls = `${selectClassName} [&>option]:bg-surface`

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          id={base}
          {...aria}
          value={state.text}
          onChange={(e) => type(e.target.value)}
          onBlur={onBlur}
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          placeholder="13/09/2026"
          aria-label="التاريخ — يوم/شهر/سنة"
          className={`${selectClassName} text-left`}
        />
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          aria-controls={`${base}-picker`}
          title="اختر من قوائم"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 text-muted-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">اختر التاريخ من قوائم</span>
        </button>
      </div>

      {/* رسالةُ الشكل — دون رسالة الشاشة، وتظهر لما بطَل لا لما لم يكتمل */}
      {parsed.errorAr && (
        <p className="mt-1 text-read text-gold-ink">{parsed.errorAr}</p>
      )}

      {picking && (
        <div id={`${base}-picker`} className="mt-2 grid grid-cols-3 gap-2" dir="rtl">
          <select aria-label="اليوم" value={parts.day} onBlur={onBlur}
            onChange={(e) => set({ day: e.target.value })} className={cls}>
            <option value="">اليوم</option>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select aria-label="الشهر" value={parts.month} onBlur={onBlur}
            onChange={(e) => set({ month: e.target.value })} className={cls}>
            <option value="">الشهر</option>
            {MONTHS_AR.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select aria-label="السنة" value={parts.year} onBlur={onBlur}
            onChange={(e) => set({ year: e.target.value })} className={cls}>
            <option value="">السنة</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
