/* ما يستطيع المدرّب تدريسه — مجالٌ أوّلا، ثم دورات ذلك المجال.

   الكتالوج مئةُ عنوان، وعرضُها دفعةً واحدة يجعل المتقدّم يمسح لا يختار. فالمجال
   يقصّها إلى عشرة تُقرأ، وله أن يعود فيختار مجالا آخر ودورةً أخرى — فمداره
   ليس مجالا واحدا ولا دورة واحدة.

   والمعرّف لا النصّ: المراجع يقارن عناوين، وربطُ المدرب بمقرر بعد الاعتماد
   يحتاج معرّف المقرر لا جملةً تُترجَم بيد أحدهم فتُنسى وتُخطئ. وما ليس في
   الكتالوج له حقلٌ حرٌّ بجانبه لا بدلا عنه — فلا يُغلق باب ما لم نفكّر فيه. */

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { controlCls, Field, OptionGrid } from '@/components/FormKit'
import { courses, courseDomain } from '@/data/courses'
import { usePublishedContent } from '@/services/public-content'
import { Card } from '@/components/ui/Surface'

export default function TeachableCoursePicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [domain, setDomain] = useState('')
  /* الكتالوج لا يُحمَّل مع الحزمة: `courses` تبدأ فارغة وتُملأ حين تصل اللقطة
     المنشورة. وصفحة الانضمام لا تطلبها لغير هذا الحقل — فبلا هذا الخطاف تبقى
     القائمة فارغةً أبدا عند المتقدّم ولا يعرف لماذا. وهو يجلب ويشترك معا. */
  const catalogVersion = usePublishedContent()

  const domains = useMemo(() => {
    void catalogVersion /* `courses` تُملأ في مكانها — فالنسخة هي إشارة الحساب */
    return [...new Set(courses.map((c) => courseDomain(c.id)))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ar'))
  }, [catalogVersion])
  const inDomain = useMemo(() => {
    void catalogVersion
    return domain ? courses.filter((c) => courseDomain(c.id) === domain) : []
  }, [domain, catalogVersion])
  const picked = useMemo(() => {
    void catalogVersion
    return selected.map((id) => courses.find((c) => c.id === id))
      .filter((c): c is (typeof courses)[number] => Boolean(c))
  }, [selected, catalogVersion])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="space-y-4">
      <Field label="المجال" htmlFor="tc-domain">
        <select
          id="tc-domain" value={domain} onChange={(e) => setDomain(e.target.value)}
          className={`${controlCls} [&>option]:bg-surface`}
        >
          <option value="">اختر المجال لتظهر دوراته</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>

      {/* شبكةٌ لا رصفٌ حرّ: عناوين الدورات متفاوتة الطول جدا («دورة سرد
          البيانات وعرض التوصيات» مقابل «دورة SQL»)، فالرصفُ بعرض النصّ يجعل
          بعضها يملأ السطر وبعضها كلمتين — وهو التبعثر الذي شُكي منه. */}
      {domain && (
        <Card className="bg-paper/20">
          <p className="mb-3 text-fine leading-6 text-muted-foreground">
            اختر ما تستطيع تدريسه الآن من {domain} — ولك أن تعود وتختار مجالا آخر.
          </p>
          <div className="max-h-64 overflow-y-auto pl-1">
            <OptionGrid
              items={inDomain.map((c) => ({ value: c.id, label: c.name }))}
              isOn={(id) => selected.includes(id)}
              onToggle={toggle}
              cols={2}
              name={`دورات ${domain}`}
            />
          </div>
        </Card>
      )}

      {/* المختار يبقى مرئيا ولو غادر مجاله — وإلا ظنّ أنه فقده */}
      {picked.length > 0 && (
        <div>
          <p className="mb-2 text-fine font-bold text-muted-foreground">اخترت {picked.length} دورة:</p>
          <ul className="flex flex-wrap gap-2">
            {picked.map((c) => (
              <li key={c.id}>
                <button
                  type="button" onClick={() => toggle(c.id)}
                  aria-label={`أزل ${c.name}`}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/50 bg-teal/10 px-3 py-1.5 text-fine font-bold text-teal-light-ink transition hover:border-teal"
                >
                  {c.name}
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
