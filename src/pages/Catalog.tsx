import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, BookOpen, Flame, Route, Search, SlidersHorizontal, Users } from 'lucide-react'
import { bestsellers, pathways } from '@/data/pathways'
import { bestsellerCourses, courseCategories, courses, pathwayTrainers, weeksLabel, type Course } from '@/data/courses'
import CourseModal from '@/components/CourseModal'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import { track } from '@/services/analytics'

/* ───────────────── تصنيف المسار من عائلته ───────────────── */
const PW_CATEGORY: Record<string, string> = {
  FND: 'أساسيات', STU: 'طلاب ومهنة', CAREER: 'طلاب ومهنة', EMP: 'موظفون',
  GOV: 'حكومي', BIZ: 'أعمال', FREE: 'أعمال', LEAD: 'قيادة', FAM: 'أسرة ورفاه', WELL: 'أسرة ورفاه',
}
const pwCategory = (id: string) => PW_CATEGORY[id.split('-')[1]] ?? 'أساسيات'
const LEVELS = ['الكل', 'أساسي', 'متوسط', 'متقدم'] as const
const bestsellerIds = new Set(bestsellers.map((b) => b.id))
const bestsellerCourseIds = new Set(bestsellerCourses.map((b) => b.id))

type Sort = 'featured' | 'shortest' | 'longest' | 'name'

/* ───────────────── الكتالوج: مسارات أو دورات ─────────────────
   بحث + تصفية بالمجال والمستوى + ترتيب، وكل الفلاتر محفوظة في
   عنوان الصفحة لتصبح النتيجة رابطا قابلا للمشاركة */
export default function Catalog({ kind }: { kind: 'pathways' | 'courses' }) {
  const [params, setParams] = useSearchParams()
  const [modalCourse, setModalCourse] = useState<Course | null>(null)

  const q = params.get('q') ?? ''
  const cat = params.get('cat') ?? 'الكل'
  const level = params.get('level') ?? 'الكل'
  const sort = (params.get('sort') ?? 'featured') as Sort

  const patch = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'الكل' && !(key === 'sort' && value === 'featured')) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const shownPathways = useMemo(() => {
    let list = pathways.filter(
      (p) =>
        (cat === 'الكل' || pwCategory(p.id) === cat) &&
        (level === 'الكل' || p.level === level) &&
        (!q || p.name.includes(q) || p.coreSkills.some((s) => s.includes(q)))
    )
    if (sort === 'shortest') list = [...list].sort((a, b) => a.durationWeeks - b.durationWeeks)
    else if (sort === 'longest') list = [...list].sort((a, b) => b.durationWeeks - a.durationWeeks)
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    else list = [...list].sort((a, b) => Number(bestsellerIds.has(b.id)) - Number(bestsellerIds.has(a.id)))
    return list
  }, [q, cat, level, sort])

  const shownCourses = useMemo(() => {
    let list = courses.filter(
      (c) =>
        (cat === 'الكل' || c.category === cat) &&
        (!q || c.name.includes(q) || c.skill.includes(q) || c.pathwayName.includes(q))
    )
    if (sort === 'shortest') list = [...list].sort((a, b) => a.weeks - b.weeks)
    else if (sort === 'longest') list = [...list].sort((a, b) => b.weeks - a.weeks)
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    else list = [...list].sort((a, b) => Number(bestsellerCourseIds.has(b.id)) - Number(bestsellerCourseIds.has(a.id)))
    return list
  }, [q, cat, sort])

  const isPathways = kind === 'pathways'
  const count = isPathways ? shownPathways.length : shownCourses.length

  return (
    <SiteShell>
      <SeoHead
        title={isPathways ? 'كل المسارات' : 'كل الدورات'}
        description={
          isPathways
            ? 'تصفح كتالوج مسارات أكاديمي وجيز كاملا — ابحث وصفِّ حسب المجال والمستوى والمدة.'
            : 'تصفح دورات أكاديمي وجيز المنفردة — ابحث وصفِّ حسب المجال والمدة.'
        }
        path={isPathways ? '/pathways' : '/courses'}
      />

      {/* الترويسة */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-4 py-1.5 text-sm text-[#6EC7D1]">
          {isPathways ? <Route className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
          {isPathways ? 'كتالوج المسارات' : 'كتالوج الدورات'}
        </div>
        <h1 className="mt-5 text-3xl font-black md:text-4xl">
          {isPathways ? 'كل المسارات — بلا اختصارات' : 'كل الدورات — لمن يعرف ما يريد'}
        </h1>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-white/60">
          {isPathways
            ? 'ابحث وصفِّ حسب المجال والمستوى. وإن حارت، التشخيص يطابقك مع الأنسب ويشرح لك لماذا.'
            : 'دورة واحدة تكفي أحيانا. وإن أكملت لاحقا لمسارها الكامل، خُصم ما دفعته من سعره.'}
        </p>
      </div>

      {/* شريط البحث والترتيب */}
      <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition focus-within:border-[#38A7B4]/60">
          <Search className="h-4.5 w-4.5 shrink-0 text-white/40" />
          <span className="sr-only">{isPathways ? 'ابحث في المسارات' : 'ابحث في الدورات'}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => patch('q', e.target.value)}
            placeholder={isPathways ? 'ابحث باسم مسار أو مهارة…' : 'ابحث باسم دورة أو مهارة…'}
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
          />
        </label>
        <label className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <SlidersHorizontal className="h-4 w-4 text-white/40" />
          <span className="text-xs text-white/50">الترتيب</span>
          <select
            aria-label="ترتيب النتائج"
            value={sort}
            onChange={(e) => patch('sort', e.target.value)}
            className="cursor-pointer bg-transparent text-sm font-semibold outline-none [&>option]:bg-[#121B1D]"
          >
            <option value="featured">المختارة أولا</option>
            <option value="shortest">الأقصر زمنا</option>
            <option value="longest">الأعمق زمنا</option>
            <option value="name">أبجدي</option>
          </select>
        </label>
      </div>

      {/* فلاتر المجال والمستوى */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="تصفية حسب المجال">
        {courseCategories.map((c) => (
          <button
            key={c}
            onClick={() => patch('cat', c)}
            aria-pressed={cat === c}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              cat === c
                ? 'border-[#38A7B4] bg-[#247B84] text-white'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-[#38A7B4]/40 hover:text-[#6EC7D1]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {isPathways && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="تصفية حسب المستوى">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => patch('level', l)}
              aria-pressed={level === l}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                level === l
                  ? 'border-[#FABC05]/60 bg-[#FABC05]/10 text-[#FABC05]'
                  : 'border-white/10 text-white/50 hover:border-[#FABC05]/40 hover:text-[#FABC05]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* عدد النتائج — يُعلن لقارئ الشاشة */}
      <p className="mt-6 text-xs text-white/45" aria-live="polite">
        {count === 0
          ? 'لا نتائج مطابقة — جرّب توسيع البحث'
          : isPathways
            ? `يعرض ${count} ${count === 1 ? 'مسارا' : 'مسارات'}`
            : `يعرض ${count} ${count === 1 ? 'دورة' : 'دورات'}`}
      </p>

      {/* النتائج */}
      {isPathways ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shownPathways.map((p) => (
            <article
              key={p.id}
              className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#38A7B4]/40 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
            >
              <div className="flex items-center gap-2">
                {bestsellerIds.has(p.id) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FABC05]/10 px-3 py-1 text-[11px] font-bold text-[#FABC05]">
                    <Flame className="h-3 w-3" />
                    من مختارات وجيز
                  </span>
                )}
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/50">{pwCategory(p.id)}</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/50">{p.level}</span>
              </div>
              <h2 className="mt-4 text-lg font-bold leading-relaxed">{p.name}</h2>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/55">{p.transformation}</p>
              <div className="mt-3 text-xs text-white/45">
                {weeksLabel(p.durationWeeks)} · {p.weeklyHours} أسبوعيا
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-5 text-white/45">
                <Users className="h-3.5 w-3.5 shrink-0 text-[#38A7B4]" />
                {pathwayTrainers(p.id).map((t) => t.name).join('، ')}
              </div>
              <div className="mt-auto pt-5">
                <Link
                  to={`/pathways/${p.id}`}
                  onClick={() => track('pathway_viewed', { from: 'catalog' })}
                  className="block rounded-xl border border-[#38A7B4]/40 py-2.5 text-center text-sm font-semibold text-[#6EC7D1] transition group-hover:bg-[#247B84] group-hover:text-white"
                >
                  تفاصيل المسار
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shownCourses.map((c) => (
            <article
              key={c.id}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#FABC05]/40"
            >
              <div className="flex items-center gap-2">
                {bestsellerCourseIds.has(c.id) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FABC05]/10 px-2.5 py-1 text-[10px] font-bold text-[#FABC05]">
                    <Flame className="h-3 w-3" />
                    مختارة
                  </span>
                )}
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/50">{c.category}</span>
              </div>
              <h2 className="mt-3 font-bold leading-relaxed">{c.name}</h2>
              <p className="mt-1 text-xs text-white/50">
                من مسار «{c.pathwayName}» · {c.weeks} {c.weeks === 1 ? 'أسبوع' : 'أسابيع'}
              </p>
              <span className="mt-3 w-fit rounded-full border border-[#38A7B4]/25 bg-[#38A7B4]/10 px-2.5 py-1 text-[11px] text-[#6EC7D1]">
                {c.skill}
              </span>
              <div className="mt-auto pt-4">
                <button
                  onClick={() => { track('course_viewed', { from: 'catalog', category: c.category }); setModalCourse(c) }}
                  className="w-full cursor-pointer rounded-lg border border-white/15 py-2 text-xs font-semibold transition group-hover:border-[#38A7B4]/50 group-hover:text-[#6EC7D1]"
                >
                  تفاصيل الدورة
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* دعوة للتشخيص */}
      <div className="mt-14 rounded-3xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-8 text-center">
        <p className="text-lg font-bold">لم تجد ما يناسبك بالضبط؟</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/55">
          التشخيص يطابقك مع مساراتنا المصممة — أو يركّب لك مسارا مخصصا من عدة مسارات — ويشرح لك لماذا.
        </p>
        <Link to="/diagnostic" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#247B84] px-8 py-3.5 font-bold text-white transition hover:bg-[#1E666E]">
          ابدأ التشخيص مجانا
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      {modalCourse && (
        <CourseModal
          course={modalCourse}
          onClose={() => setModalCourse(null)}
          onBuy={(c) => { window.location.href = `/pathways/${c.pathwayId}` }}
        />
      )}
    </SiteShell>
  )
}
