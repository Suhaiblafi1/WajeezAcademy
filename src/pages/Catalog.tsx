import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, BookOpen, Flame, Route, Search, SlidersHorizontal, Target } from 'lucide-react'
import { bestsellers, pathwayDomain, pathwayDomains, pathways } from '@/data/pathways'
import { bestsellerCourses, courseCategories, courses, pathwaySizeAr } from '@/data/courses'
import FavoriteButton from '@/components/FavoriteButton'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'
import CourseTitle from "@/components/CourseTitle";
import { track } from '@/services/analytics'
import { usePublishedContent } from '@/services/public-content'
import { catalogRank, matchesCatalogQuery } from '@/application/catalog/catalog-search'
import { resolveCatalogRefsAr } from '@/application/catalog/visitor-text'
import { sortKeyAr } from '@/application/catalog/course-title'
import { UpcomingTermBanner } from '@/components/UpcomingTermNote'

const LEVELS = ['الكل', 'أساسي', 'متوسط', 'متقدم'] as const
/* البند ع-١: كانت هذه المجموعتان تُحسبان في نطاق الوحدة — لقطة وقت الاستيراد.
   بعد جعل الكتالوج المضمن كسولا صارت البيانات تصل لاحقا، فلا بد أن تُحسبا
   داخل المكوّن مرتبطتين برقم نسخة الكتالوج وإلا بقيتا فارغتين للأبد.

   و`exhaustive-deps` يعدّ `catalogVersion` تبعيّةً زائدةً لأنّها لا تُقرأ في
   الجسد — وهي **الإشارةُ الوحيدة**: لقطةُ API تُثبَّت بـ`splice` على المصفوفة
   نفسِها (`data/pathways.ts:153`) فتبقى هويّتُها كما هي، ولا يرى React تغيّرا.
   فحذفُها — وهو ما تقترحه القاعدة — يجمّد أوّلَ لقطةٍ إلى الأبد، وهو عينُ
   العطب الذي وُصف أعلاه. فالقاعدةُ تُسكَت في مواضعها بسببها لا بخط أساس. */

type Sort = 'featured' | 'shortest' | 'longest' | 'name'

/* ───────────────── الكتالوج: مسارات أو دورات ─────────────────
   بحث + تصفية بالمجال والمستوى + ترتيب، وكل الفلاتر محفوظة في
   عنوان الصفحة لتصبح النتيجة رابطا قابلا للمشاركة */
export default function Catalog({ kind }: { kind: 'pathways' | 'courses' }) {
  const catalogVersion = usePublishedContent()
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- رقمُ النسخة هو إشارةُ الإبطال الوحيدة: مصفوفاتُ الكتالوج تُملأ في مكانها بـ`splice` فلا تتغيّر هويّتُها، فحذفُ التبعيّة يجمّد أوّلَ لقطة */
  const bestsellerIds = useMemo(() => new Set(bestsellers.map((b) => b.id)), [catalogVersion])
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- رقمُ النسخة هو إشارةُ الإبطال الوحيدة: مصفوفاتُ الكتالوج تُملأ في مكانها بـ`splice` فلا تتغيّر هويّتُها، فحذفُ التبعيّة يجمّد أوّلَ لقطة */
  const bestsellerCourseIds = useMemo(() => new Set(bestsellerCourses.map((b) => b.id)), [catalogVersion])
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  /* «الكل» هي الافتراضيّة — والعنوانُ يقول «كلّ الدورات».

     كانت «أساسيات»، فيفتح الزائرُ صفحةً عنوانُها «كلّ الدورات — لمن يعرف ما
     يريد» فيرى **أربعا من إحدى وثمانين**، والمسارات ثلاثةَ عشرَ من عشرين. ولا
     شيءَ يخبره أنّ تصفيةً مفعَّلة: الرقاقةُ مظلَّلةٌ نعم، لكنّها تُقرأ تبويبَ
     تصنيفٍ لا مرشِّحا يُخفي سبعا وسبعين دورة. ثمّ يكتب في صندوق البحث فيبحث
     داخل الأربع — فينجح البحثُ أحيانا ويفشل غالبا بلا سببٍ يراه.

     والقيمةُ الافتراضيّةُ تُحذف من العنوان (`patch` أدناه)، فالموضعان يتغيّران
     معا أبدا: لو بقيت «أساسيات» افتراضيّةً هناك لصارت رقاقتُها غيرَ قابلةٍ
     للاختيار — تُحذف من العنوان فيرتدّ المعروضُ إلى «الكل». */
  const cat = params.get('cat') ?? 'الكل'
  const level = params.get('level') ?? 'الكل'
  const sort = (params.get('sort') ?? 'featured') as Sort

  const patch = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    /* القيمة الافتراضية تحذف من العنوان: الكل للمجال والمستوى، featured للترتيب */
    const isDefault =
      (key === 'cat' && value === 'الكل') ||
      (key === 'level' && value === 'الكل') ||
      (key === 'sort' && value === 'featured') ||
      (key === 'q' && !value)
    if (!isDefault && value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const shownPathways = useMemo(() => {
    const pathwayRank = (p: (typeof pathways)[number]) =>
      catalogRank(q, [[p.name, p.shortName], [...p.coreSkills], [p.audience, p.transformation, p.output]])
    let list = pathways.filter(
      (p) =>
        (cat === 'الكل' || pathwayDomain(p.id) === cat) &&
        (level === 'الكل' || p.level === level) &&
        /* الحقولُ كلُّها لا حقلان: الاسمُ القصيرُ والمهاراتُ **والجمهورُ
           والتحوّلُ والمخرَج** — وكلُّها مؤلَّفةٌ في الكتالوج اليوم ولم يكن
           يبحث فيها أحد. */
        matchesCatalogQuery(q, [p.name, p.shortName, p.audience, p.transformation, p.output, ...p.coreSkills])
    )
    if (sort === 'shortest') list = [...list].sort((a, b) => a.durationWeeks - b.durationWeeks)
    else if (sort === 'longest') list = [...list].sort((a, b) => b.durationWeeks - a.durationWeeks)
    else if (sort === 'name') list = [...list].sort((a, b) => sortKeyAr(a.name).localeCompare(sortKeyAr(b.name), 'ar'))
    else list = [...list].sort((a, b) => Number(bestsellerIds.has(b.id)) - Number(bestsellerIds.has(a.id)))
    /* والصلةُ تتقدّم على الترتيب المختار حين يكون هناك بحث: من كتب كلمةً
       يريد ما يحملها في اسمه أوّلا، ثمّ يبقى ترتيبُه فاصلا بين المتساويين. */
    if (q) list = [...list].sort((a, b) => pathwayRank(b) - pathwayRank(a))
    return list
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- رقمُ النسخة هو إشارةُ الإبطال الوحيدة: مصفوفاتُ الكتالوج تُملأ في مكانها بـ`splice` فلا تتغيّر هويّتُها، فحذفُ التبعيّة يجمّد أوّلَ لقطة */
  }, [q, cat, level, sort, bestsellerIds, catalogVersion])

  const shownCourses = useMemo(() => {
    const courseRank = (c: (typeof courses)[number]) =>
      catalogRank(q, [[c.name], [c.promise, ...c.skills], [c.audience, c.pathwayName]])
    let list = courses.filter(
      (c) =>
        (cat === 'الكل' || c.category === cat) &&
        matchesCatalogQuery(q, [c.name, c.promise, c.audience, c.pathwayName, ...c.skills])
    )
    if (sort === 'shortest') list = [...list].sort((a, b) => a.weeks - b.weeks)
    else if (sort === 'longest') list = [...list].sort((a, b) => b.weeks - a.weeks)
    /* ── والترتيبُ بالاسم يرتّب فعلا ──

       ٨١ عنوانا من ٨١ يبدأ بكلمة «دورة» (وهي بقرار صاحب المنتج، تبقى)،
       فكان «الترتيب: بالاسم» يضعها كلَّها تحت حرف الدال ثمّ يرتّب داخلها
       بما لا يراه أحد. فالمفتاحُ يتجاوز السابقةَ المشتركة، والعنوانُ
       المعروضُ لا يتغيّر. */
    else if (sort === 'name') list = [...list].sort((a, b) => sortKeyAr(a.name).localeCompare(sortKeyAr(b.name), 'ar'))
    else list = [...list].sort((a, b) => Number(bestsellerCourseIds.has(b.id)) - Number(bestsellerCourseIds.has(a.id)))
    if (q) list = [...list].sort((a, b) => courseRank(b) - courseRank(a))
    return list
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- رقمُ النسخة هو إشارةُ الإبطال الوحيدة: مصفوفاتُ الكتالوج تُملأ في مكانها بـ`splice` فلا تتغيّر هويّتُها، فحذفُ التبعيّة يجمّد أوّلَ لقطة */
  }, [q, cat, sort, bestsellerCourseIds, catalogVersion])

  /* الأسماءُ القصيرةُ بمعرِّفاتها — لفكّ الإحالات الداخليّة في «ليس لك إن…» */
  const nameById = useMemo(
    () => new Map(pathways.map((p) => [p.id, p.shortName])),
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- كسابقاتها: رقمُ النسخة هو إشارةُ الإبطال الوحيدة */
    [catalogVersion],
  )

  const isPathways = kind === 'pathways'
  const count = isPathways ? shownPathways.length : shownCourses.length

  return (
    <SiteShell>
      <SeoHead
        title={isPathways ? 'كل المسارات' : 'كل الدورات'}
        description={
          isPathways
            ? 'تصفح كتالوج مسارات أكاديمية وجيز كاملا — ابحث وصفِّ حسب المجال والمستوى والمدة.'
            : 'تصفح دورات أكاديمية وجيز المنفردة — ابحث وصفِّ حسب المجال والمدة.'
        }
        path={isPathways ? '/pathways' : '/courses'}
      />

      {/* الترويسة */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1.5 text-sm text-teal-light-ink">
          {isPathways ? <Route className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
          {isPathways ? 'كتالوج المسارات' : 'كتالوج الدورات'}
        </div>
        <h1 className="mt-5 text-3xl font-black md:text-4xl">
          {isPathways ? 'كل المسارات — بلا اختصارات' : 'كل الدورات — لمن يعرف ما يريد'}
        </h1>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
          {isPathways
            ? 'ابحث وصفِّ حسب المجال والمستوى. وإن حارت، التشخيص يطابقك مع الأنسب ويشرح لك لماذا.'
            : 'دورة واحدة تكفي أحيانا. وإن أكملت لاحقا لمسارها الكامل، خُصم ما دفعته من سعره.'}
        </p>
      </div>

      {/* شريط البحث والترتيب */}
      <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition focus-within:border-teal/60">
          <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
          <span className="sr-only">{isPathways ? 'ابحث في المسارات' : 'ابحث في الدورات'}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => patch('q', e.target.value)}
            placeholder={isPathways ? 'ابحث باسم مسار أو مهارة…' : 'ابحث باسم دورة أو مهارة…'}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/75"
          />
        </label>
        <label className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">الترتيب</span>
          <select
            aria-label="ترتيب النتائج"
            value={sort}
            onChange={(e) => patch('sort', e.target.value)}
            className="cursor-pointer bg-transparent text-sm font-semibold outline-none [&>option]:bg-surface"
          >
            <option value="featured">المختارة أولا</option>
            <option value="shortest">الأقصر زمنا</option>
            <option value="longest">الأعمق زمنا</option>
            <option value="name">أبجدي</option>
          </select>
        </label>
      </div>

      {/* فلاتر المجال (مسارات) أو الفئة (دورات) والمستوى */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={isPathways ? 'تصفية حسب المجال' : 'تصفية حسب الفئة'}>
        {(isPathways ? pathwayDomains : courseCategories).map((c) => (
          <button
            key={c}
            onClick={() => patch('cat', c)}
            aria-pressed={cat === c}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              cat === c
                ? 'border-teal bg-teal-deep text-white'
                : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-teal/40 hover:text-teal-light-ink'
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
                  ? 'border-gold/60 bg-gold/10 text-gold-ink'
                  : 'border-white/10 text-muted-foreground hover:border-gold/40 hover:text-gold-ink'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* ــ الفصلُ القادم: هاتان الصفحتان لا تعرضان تاريخا إطلاقا (البند ٥٢).
             وموضعُه فوق النتائج لا تحتَها: من يتصفّح ثمانين بطاقةً لا يصل
             إلى ذيل الصفحة، والتاريخُ يُقرأ قبل الاختيار لا بعده. */}
      <UpcomingTermBanner className="mt-6" />

      {/* عدد النتائج — يُعلن لقارئ الشاشة */}
      <p className="mt-6 text-xs text-muted-foreground" aria-live="polite">
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
              className="group flex min-w-0 flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-teal/40 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
            >
              {/* يلتف: صفٌّ لا يلتف يفرض عرض محتواه على البطاقة مهما ضاقت الشاشة،
                  فتخرج البطاقة خارج شبكتها ويظهر تمرير أفقي عند التكبير. */}
              <div className="flex flex-wrap items-center gap-2">
                {bestsellerIds.has(p.id) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-fine font-bold text-gold-ink">
                    <Flame className="h-3 w-3" />
                    من مختارات وجيز
                  </span>
                )}
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-fine text-muted-foreground">{pathwayDomain(p.id)}</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-fine text-muted-foreground">{p.level}</span>
                <FavoriteButton pathwayId={p.id} pathwayName={p.name} className="-ms-1 ms-auto" />
              </div>
              {/* ── الاسمُ القصيرُ في البطاقة، والكاملُ في الصفحة ──

                  العنوانُ الكاملُ مكتوبٌ بلغة التحوّل — «ريادة الأعمال: من
                  الفكرة إلى أوّل عميلٍ يدفع» — وهو صحيحٌ ويُحافَظ عليه. لكنّه
                  يصلح للصفحة لا لبطاقةٍ في شبكةٍ من أربع: متوسّطُه ٤٥ حرفا،
                  و١٦ من ٢٠ فيه نقطتان. و`short_title` مؤلَّفٌ لكلّ مسارٍ في
                  الكتالوج ولم يكن يُعرض لأحد. */}
              <h2 className="mt-4 text-lg font-bold leading-relaxed">{p.shortName}</h2>
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">{p.transformation}</p>
              {/* ── لمن هو، ولمن ليس ──

                  الحقلان (`audience` و`not_for`) مؤلَّفان لكلّ مسارٍ من عشرين
                  ولا يُعرض واحدٌ منهما. و«ليست لك إن…» أصدقُ سطرٍ في الكتالوج:
                  يمنع شراءً خاطئا قبل وقوعه، **والمنعُ خدمةٌ لا خسارة** — ومن
                  ردَّته الجملةُ عن مسارٍ لا يناسبه لم نخسره، بل كسبنا ثقتَه. */}
              {p.audience && (
                <p className="mt-3 line-clamp-2 text-fine leading-5 text-muted-foreground">
                  <span className="font-bold text-foreground">لمن؟ </span>{p.audience}
                </p>
              )}
              {p.notFor && (
                <p className="mt-1.5 line-clamp-2 text-fine leading-5 text-muted-foreground">
                  <span className="font-bold text-gold-ink">ليس لك إن: </span>
                  {resolveCatalogRefsAr(p.notFor, (id) => nameById.get(id))}
                </p>
              )}
              {/* المخرَجُ الملموس مكانَ اسم مدرّبٍ لم يُعيَّن بعد — كان يظهر
                  مكرّرا بعدد مدرّبي المسار، فيملأ البطاقة بلا معلومة. */}
              <div className="mt-3 flex items-start gap-1.5 text-fine leading-5 text-teal-light-ink">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2 min-w-0">تتخرّج بـ: {p.output}</span>
              </div>
              <div className="mt-3 text-fine leading-5 text-muted-foreground">
                {pathwaySizeAr(p)} · {p.weeklyHours} أسبوعيا
              </div>
              <div className="mt-auto pt-5">
                <Link
                  to={`/pathways/${p.id}`}
                  onClick={() => track('pathway_viewed', { from: 'catalog' })}
                  className="block rounded-xl border border-teal/40 py-2.5 text-center text-sm font-semibold text-teal-light-ink transition group-hover:bg-teal-deep group-hover:text-white"
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
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold/40"
            >
              <div className="flex items-center gap-2">
                {bestsellerCourseIds.has(c.id) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-fine font-bold text-gold-ink">
                    <Flame className="h-3 w-3" />
                    مختارة
                  </span>
                )}
                {/* لا وسمَ ثانويّا على الدورة.

                    كان «أساسيات» أو «موظفون» — وهو تصنيفُ **المسار** الذي
                    تسكنه الدورة لا وصفٌ لها. وقد سقط «من مسار كذا» من تحت
                    العنوان للسبب نفسِه، فبقاؤه وسما فوقَه يعيد الشيءَ من بابٍ
                    آخر. والبطاقةُ الآن: الاسمُ ثمّ المخرَجُ ثمّ المدّة. */}
              </div>
              <CourseTitle name={c.name} termEn={c.termEn} className="mt-3 font-bold leading-relaxed" />
              {/* المخرَجُ أوّلا لا موضعُ الدورة من مسار.

                  كان السطرُ تحت العنوان يقول «من مسار كذا» — وهو نسبٌ إداريّ
                  لا يعني المشتري: من يفتح كتالوج الدورات يريد دورةً بعينها،
                  ولو أراد المسارَ لفتح المسارات. والوعدُ (`short_promise_ar`)
                  يقول ما يخرج به، وهو ما يُشترى.

                  والمسارُ لم يُحذف من البحث: `pathwayName` ما زال ضمن ما
                  يُطابَق عليه في المرشِّح — يُبحث به ولا يُزاحم به المخرَج. */}
              {c.promise && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-muted-foreground">{c.promise}</p>
              )}
              <p className="mt-1.5 text-fine text-muted-foreground">
                {c.weeks} {c.weeks === 1 ? 'أسبوع' : 'أسابيع'}
              </p>
              <span className="mt-3 w-fit rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-fine text-teal-light-ink">
                {c.skill}
              </span>
              <div className="mt-auto pt-4">
                {/* التفاصيل تفتح مسارا من هذه الدورة وحدها لا نافذة مقتطفة:
                    النافذة كانت تعرض المحاور والمخرج فقط، وزرّها الوحيد ينقل
                    القارئ إلى المسار كاملا — فمن أراد دورة وجد ستّا وسعر مسار. */}
                <Link
                  to={`/build/${c.id}`}
                  onClick={() => track('course_viewed', { from: 'catalog', category: c.category })}
                  /* حبرٌ صريحٌ كبطاقة المسار المجاورة: بلا صنفِ لونٍ كان
                     الرابطُ يرث لونا مبنيّا على أرضيّةٍ داكنة، فقياسُه على
                     الورق ١٫٦:‏١ — والشاشةُ لم تكن في مجموعة الفحص. */
                  className="block w-full cursor-pointer rounded-lg border border-white/15 py-2 text-center text-xs font-semibold text-teal-light-ink transition group-hover:border-teal/50"
                >
                  تفاصيل الدورة
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* دعوة للتشخيص */}
      <div className="mt-14 rounded-3xl border border-teal/25 bg-teal/5 p-8 text-center">
        <p className="text-lg font-bold">لم تجد ما يناسبك بالضبط؟</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
          التشخيص يطابقك مع مساراتنا المصممة — أو يركّب لك مسارا مخصصا من عدة مسارات — ويشرح لك لماذا.
        </p>
        <Link to="/diagnostic" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-teal-deep px-8 py-3.5 font-bold text-white transition hover:bg-teal-darker">
          ابدأ التشخيص مجانا
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

    </SiteShell>
  )
}
