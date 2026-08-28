/* اختيار ما يستطيع المدرّب تدريسه — مجال ثم مستوى ثم عنوان من الكتالوج.

   كان حقلا نصيا مفتوحا («الدورات الحالية التي تستطيع تدريسها فعلا») يكتب فيه
   المتقدم ما شاء. وفيه عيبان: المراجع يقارن نصوصا حرة لا عناوين، وربطُ المدرب
   بمقرر بعد الاعتماد يحتاج معرّف مقرر لا جملة — فكان أحدهم يترجم النص إلى
   معرّف بيده، وهي خطوة تُنسى وتُخطئ.

   والتسلسل ثلاثي لا قائمة بمئة عنوان: المجال يقصّ الكتالوج إلى عشرة، والمستوى
   يقصّه إلى خمسة، فيقرأ المتقدم خمسة عناوين لا مئة. */

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { courses, courseFullById } from '@/data/courses'
import { pathwayCategory } from '@/data/pathways'
import { levelBucket, type TeachLevel } from '@/application/catalog/teach-level'

const selectCls =
  'w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white focus:border-teal focus:outline-none [&>option]:bg-surface'

export default function TeachableCoursePicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [domain, setDomain] = useState('')
  const [level, setLevel] = useState<TeachLevel | ''>('')
  const [courseId, setCourseId] = useState('')

  const domains = useMemo(
    () => [...new Set(courses.map((c) => pathwayCategory(c.pathwayId)))].sort((a, b) => a.localeCompare(b, 'ar')),
    [],
  )
  const inDomain = useMemo(
    () => (domain ? courses.filter((c) => pathwayCategory(c.pathwayId) === domain) : []),
    [domain],
  )
  const options = useMemo(
    () => inDomain.filter((c) => (level ? levelBucket(courseFullById(c.id)?.level ?? '') === level : true) && !selected.includes(c.id)),
    [inDomain, level, selected],
  )

  const add = () => {
    if (!courseId || selected.includes(courseId)) return
    onChange([...selected, courseId])
    setCourseId('')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tc-domain" className="mb-1.5 block text-xs font-bold text-white/60">المجال</label>
          <select
            id="tc-domain"
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setLevel(''); setCourseId('') }}
            className={selectCls}
          >
            <option value="" disabled>اختر المجال</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tc-level" className="mb-1.5 block text-xs font-bold text-white/60">المستوى</label>
          <select
            id="tc-level"
            value={level}
            disabled={!domain}
            onChange={(e) => { setLevel(e.target.value as TeachLevel); setCourseId('') }}
            className={`${selectCls} disabled:opacity-40`}
          >
            <option value="" disabled>اختر المستوى</option>
            <option value="أساسي">أساسي</option>
            <option value="متقدم">متقدم</option>
          </select>
        </div>
        <div>
          <label htmlFor="tc-course" className="mb-1.5 block text-xs font-bold text-white/60">عنوان الدورة</label>
          <select
            id="tc-course"
            value={courseId}
            disabled={!domain || !level}
            onChange={(e) => setCourseId(e.target.value)}
            className={`${selectCls} disabled:opacity-40`}
          >
            <option value="" disabled>{options.length === 0 && level ? 'لا دورات متبقية هنا' : 'اختر الأقرب'}</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={add}
        disabled={!courseId}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-teal/45 px-5 py-2 text-xs font-black text-teal-light-ink transition hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Plus className="h-3.5 w-3.5" />
        {selected.length === 0 ? 'أضف هذه الدورة' : 'إضافة دورة أخرى'}
      </button>

      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((id) => {
            const c = courses.find((x) => x.id === id)
            if (!c) return null
            return (
              <li key={id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block text-xs font-black leading-snug">{c.name}</span>
                  <span className="mt-0.5 block text-[10.5px] text-white/40">
                    {pathwayCategory(c.pathwayId)} · {levelBucket(courseFullById(c.id)?.level ?? '')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                  aria-label={`أزل ${c.name}`}
                  className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-white/40">
        اختر العنوان الأقرب لما تستطيع تقديمه الآن. ستحدّد المحاور والمخرجات وخطة الجلسات لاحقا مع فريق وجيز.
      </p>
    </div>
  )
}
