/* حقلُ تاريخٍ يُختار من ثلاث قوائم — لا من تقويم المتصفّح.

   ═══ لماذا تُرك `<input type="date">` ═══

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من العودة إلى ١٩٨٥ لتاريخ ميلاده:
   «تعذّبت». والسببُ بنيويٌّ لا ذوقيّ — منتقي المتصفّح يتنقّل **شهرا شهرا**،
   فبلوغُ سنةٍ قبل أربعين سنةً أربعُمئةٍ وثمانون ضغطة. ومن كتب الرقمَ بيده
   وقع في الأسوأ: الحقلُ ثلاثةُ مقاطعَ مقفلةٍ بترتيبٍ يختلف بين المتصفّحات،
   ولا يقول أيُّها السنة.

   والقوائمُ تُبلغ ١٩٨٥ في ضغطتَين: السنةُ قائمةٌ واحدةٌ يُقفز فيها بالحرف
   الأوّل أو بالتمرير. وهي بنيةٌ يعرفها كلُّ قارئ شاشةٍ بلا تدريب.

   ═══ وما لم يُرحَّل ═══

   شاشاتُ الفريق (مرشِّحاتُ «من… إلى…»، ومواعيدُ جلسةٍ بعد أسبوع) تبقى على
   منتقي المتصفّح: التاريخُ فيها قريبٌ من اليوم، وثلاثُ قوائمَ لاختيار الغد
   أبطأُ لا أسرع. فالقاعدة: **من احتاج القفزَ بعيدا اختار من قائمة.** */

import { useId } from 'react'
import {
  daysInMonth, joinIsoDay, MONTHS_AR, splitIsoDay, yearChoices,
} from '@/application/text/date-parts'

export interface DateFieldProps {
  /** `yyyy-mm-dd` أو `''` حين لا اختيار */
  value: string
  onChange: (value: string) => void
  /** أقدمُ سنةٍ في القائمة وأحدثُها — الحدّان داخلان */
  fromYear: number
  toYear: number
  /** الأحدثُ أوّلا (ميلادٌ) أم الأقدمُ (موعدٌ قادم) */
  yearOrder?: 'asc' | 'desc'
  /** صيغةُ حقول الشاشة المضيفة — فلا تفترق قوائمُ هذا الحقل عمّا حولها */
  selectClassName?: string
  /** يُنادى عند مغادرة الحقل — لتُعرض رسالتُه كبقيّة الحقول */
  onBlur?: () => void
  /* الخطأُ يقع على القوائم الثلاث لا على واحدةٍ منها: التاريخُ حقلٌ واحدٌ في
     ذهن القارئ، فمن بلغ أيَّ قائمةٍ منه لزمه أن يسمع أنّه مرفوضٌ ولماذا.

     والاسمان بصيغة `aria-*` عمدا: الشاشاتُ تُنتجهما بـ`bad()` و`invalidProps()`
     — فتُنثَر نتيجتُهما على هذا الحقل كما تُنثَر على `<input>`، ولا تُترجَم. */
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  /** معرّفٌ يشير إليه `<label>` الشاشة — يقع على أوّل قائمة */
  id?: string
  className?: string
}

export default function DateField({
  value, onChange, fromYear, toYear, yearOrder = 'desc',
  selectClassName = '', onBlur, id, className = '', ...aria
}: DateFieldProps) {
  const auto = useId()
  const base = id ?? auto
  const parts = splitIsoDay(value)
  const years = yearChoices(fromYear, toYear, yearOrder)
  const dayCount = daysInMonth(Number(parts.year), Number(parts.month))

  /* الجزءُ يتغيّر فيُعاد بناءُ التاريخ كلِّه — والناقصُ يُردّ `''`، فلا يُرسَل
     نصفُ تاريخٍ إلى الخادم لأنّ السنةَ وحدَها اختيرت. */
  const set = (patch: Partial<typeof parts>) => onChange(joinIsoDay({ ...parts, ...patch }))

  /* `[&>option]:bg-surface` لازمةٌ في الواجهة الداكنة: قائمةُ النظام تُرسم
     بخلفيّةٍ بيضاءَ فيختفي النصُّ الفاتح فيها — وهي الصيغةُ المعتمدة في
     شاشات المنصّة. */
  const cls = `${selectClassName} [&>option]:bg-surface`

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`} dir="rtl">
      <select
        id={base} aria-label="اليوم" {...aria} value={parts.day} onBlur={onBlur}
        onChange={(e) => set({ day: e.target.value })} className={cls}
      >
        <option value="">اليوم</option>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <select
        aria-label="الشهر" {...aria} value={parts.month} onBlur={onBlur}
        onChange={(e) => set({ month: e.target.value })} className={cls}
      >
        <option value="">الشهر</option>
        {MONTHS_AR.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>

      <select
        aria-label="السنة" {...aria} value={parts.year} onBlur={onBlur}
        onChange={(e) => set({ year: e.target.value })} className={cls}
      >
        <option value="">السنة</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
