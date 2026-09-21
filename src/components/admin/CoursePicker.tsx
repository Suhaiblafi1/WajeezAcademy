/* اختيارُ دورةٍ من الكتالوج — مكوّنٌ واحدٌ لموضعَين.

   ═══ لماذا وُجد ═══

   «عند اختيار دورةٍ لأربط الاقتراحَ بها تظهر لي قائمةٌ هكذا — وهذا شيءٌ
   متعبٌ وغيرُ منطقيّ، لأنّه لا يمكن أن أختار الدورةَ بسهولة» (صاحبُ
   المنصّة، ٢٠ سبتمبر ٢٠٢٦). وكانت ١١٣ دورةً في `<select>` خامّ، **في
   موضعَين**: طابورِ الاقتراحات وشاشةِ التجهيز. ولو أُصلح أحدُهما لَبقي
   الآخرُ على حاله، ولافترقا عند أوّل تحسين.

   ═══ ولمَ قائمةٌ ظاهرةٌ لا قائمةٌ منسدلة ═══

   المنسدلةُ تُخفي النتيجةَ حتّى تُفتح، فلا يرى الباحثُ أثرَ ما كتبه إلّا
   بنقرةٍ ثانية. وهذه `<select size>`: صندوقٌ مفتوحٌ يضيق تحت الكتابة،
   فيُقرأ أثرُ كلّ حرفٍ في حينه.

   وهي عنصرٌ أصيلٌ لا صندوقٌ مركَّب: التنقّلُ بالأسهم، والانتقاءُ بالحرف
   الأوّل، وقارئُ الشاشة — كلُّها تعمل بلا سطرٍ نكتبه. وصندوقٌ نبنيه
   بأيدينا يعني إعادةَ كتابة ذلك كلِّه، ونسيانَ نصفِه.

   ═══ والعددُ مكتوب ═══

   «١٢ من ١١٣» — فمن رشّح حتّى لم يبقَ شيءٌ يعرف أنّه رشّح، لا أنّ
   الكتالوجَ فارغ. وصندوقٌ خالٍ بلا تفسيرٍ يُقرأ عطبا. */

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  ALL_GROUPS, courseGroups, filterCourses, type PickableCourse,
} from '@/application/catalog/course-picker'
import { staffControlCls, staffSelectCls } from '@/components/FormKit'

export default function CoursePicker({
  courses, value, onChange, id, labelAr = 'اختر الدورةَ القائمة…',
}: {
  courses: readonly PickableCourse[]
  value: string
  onChange: (courseId: string) => void
  /** معرّفُ الصندوق — يربطه وسمٌ خارجيٌّ به */
  id?: string
  labelAr?: string
}) {
  const [group, setGroup] = useState(ALL_GROUPS)
  const [q, setQ] = useState('')

  const groups = useMemo(() => courseGroups(courses), [courses])
  const shown = useMemo(() => filterCourses(courses, { group, q }), [courses, group, q])

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {/* والمرشِّحُ لا يُعرض حين لا مجالَ يُفرز به — عنصرٌ بخيارٍ واحدٍ زينة */}
        {groups.length > 0 && (
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label="رشّحْ بالمجال أو المسار"
            className={`${staffSelectCls} !w-auto min-w-[10rem] flex-1`}
          >
            <option value={ALL_GROUPS}>كلُّ المجالات</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <label className="relative min-w-[11rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو الرمز…"
            aria-label="ابحث بالاسم أو الرمز"
            className={`${staffControlCls} !pr-9`}
          />
        </label>
      </div>

      <select
        id={id}
        size={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={labelAr}
        className={`${staffSelectCls} !h-auto !py-1`}
      >
        {shown.map((c) => (
          <option key={c.id} value={c.id}>{c.title} — {c.id}</option>
        ))}
      </select>

      <p className="text-read text-muted-foreground">
        {shown.length === courses.length
          ? `${courses.length} دورة`
          : `${shown.length} من ${courses.length} دورة`}
        {shown.length === 0 && ' — لا شيءَ يطابق، وسّعْ البحثَ أو غيّرِ المجال.'}
      </p>
    </div>
  )
}
