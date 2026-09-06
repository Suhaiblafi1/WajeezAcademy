/* الأكثرُ طلبا في الرئيسيّة — مسارٌ يُرشَّح وفلترُ تصنيفه.

   نُقل من `Home.tsx` وكان ألفا وخمسَ مئةٍ وستّةً وستّين سطرا: عشرون قسما
   في ملفٍّ واحد، وهذان أطولُها (٣٧٦ سطرا) وأكثرُها منطقا — فهما وحدَهما
   يقرآن الكتالوجَ المنشور ويستمعان إلى تحديثه.

   والقطعُ **بلا تغييرِ سلوك**: القسمان كانا دالّتَين عليا لا تقرآن شيئا من
   حالة الصفحة، فنُقلا كما هما. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Link } from "react-router"
import { ArrowLeft, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Compass, Flame, Route, Target } from "lucide-react"
import { bestsellers, pathwayById, pathwayDomain } from "@/data/pathways"
import { getCatalogVersion, onCoreCatalogInstalled } from "@/data/core-catalog-source"
import { bestsellerCourses, courseById, pathwaySizeAr } from "@/data/courses"
import { track } from "@/services/analytics"
import CourseTitle from "@/components/CourseTitle"
import FavoriteButton from "@/components/FavoriteButton"
import SectionLabel from "./SectionLabel"

import { Card, Inset, Panel } from "@/components/ui/Surface";
function CategoryFilter({
  counts, active, onChange, label,
}: {
  counts: [string, number][] // مرتبة تنازليا حسب العدد — بلا «الكل»
  active: string
  onChange: (c: string) => void
  label: string
}) {
  const [more, setMore] = useState(false)
  const TOP = 5
  const total = counts.reduce((s, [, n]) => s + n, 0)
  const main = counts.slice(0, TOP)
  const rest = counts.slice(TOP)
  const activeInRest = rest.some(([c]) => c === active)
  const shown: [string, number][] = [['الكل', total], ...main, ...(more || activeInRest ? rest : [])]

  /* ─────────── لماذا صفٌّ واحدٌ يُمرَّر على الهاتف ───────────

     كانت الأزرارُ `px-4 py-2 text-sm` تلتفّ إلى **ثلاثة صفوف** على شاشة
     الهاتف، فتأخذ نحو ثلث الشاشة قبل أن تظهر بطاقةٌ واحدة — ومَن جاء يتصفّح
     المسارات يرى المرشِّحات لا المسارات.

     فصارت على الهاتف شريطا واحدا يُمرَّر أفقيّا بأزرارٍ أصغرَ وأخفّ، وعلى
     الشاشات الأوسع تلتفّ كما كانت (المساحةُ هناك ليست شحيحة). والالتفافُ
     يعود من `sm:` فلا يفقد سطحُ المكتب شيئا.

     و`-mx-5 px-5` تمدّ الشريطَ إلى حافّتي الشاشة داخل حاوية `px-5`: بلاها
     يبدو الزرُّ الأخير مقصوصا عند حدٍّ داخليٍّ لا يفهمه القارئ. */
  const chip = 'inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition sm:px-4 sm:py-2 sm:text-sm'

  return (
    <div
      className="scrollbar-hide -mx-5 mt-6 flex snap-x items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      role="group"
      aria-label={label}
    >
      {shown.map(([c, n]) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-pressed={active === c}
          className={`${chip} ${
            active === c
              ? 'border-teal bg-teal-deep text-white shadow-[0_0_24px_-6px_#38A7B4]'
              : 'border-border bg-white/[0.03] text-muted-foreground hover:border-teal/40 hover:text-teal-light-ink'
          }`}
        >
          {c}
          <span className={`rounded-full px-1.5 text-micro font-black tabular-nums ${active === c ? 'bg-black/25' : 'bg-foreground/[0.07] text-muted-foreground'}`}>
            {n}
          </span>
        </button>
      ))}
      {rest.length > 0 && (
        <button
          onClick={() => setMore((m) => !m)}
          aria-expanded={more || activeInRest}
          className={`${chip} border-dashed border-border text-muted-foreground hover:border-teal/40 hover:text-teal-light-ink`}
        >
          {more || activeInRest ? 'أقل' : `المزيد (${rest.length})`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${more || activeInRest ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}

export function Bestsellers() {
  // الاشتراك في نسخة الكتالوج: تُحسب القوائم أول مرة والمصدر فارغ في الإنتاج
  // (البند ع-١) — بلا هذا الاشتراك تبقى المصفوفات الفارغة محفوظة في useMemo
  const catalogVersion = useSyncExternalStore(onCoreCatalogInstalled, getCatalogVersion)
  const [pwCat, setPwCat] = useState('الكل')
  const [crCat, setCrCat] = useState('الكل')
  const pwRailRef = useRef<HTMLDivElement>(null)
  const crRailRef = useRef<HTMLDivElement>(null)
  // في RTL المحتوى الزائد يكون يسارا؛ scrollBy النسبي يعمل في كل المتصفحات
  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: 'next' | 'prev') =>
    ref.current?.scrollBy({ left: dir === 'next' ? -420 : 420, behavior: 'smooth' })
  // تحكم لوحة المفاتيح في الشرائط: الأسهم تحرك الشريط — المرجع يُقرأ داخل الحدث فقط
  const railKeys = (ref: React.RefObject<HTMLDivElement | null>, e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); scroll(ref, 'next') }
    if (e.key === 'ArrowRight') { e.preventDefault(); scroll(ref, 'prev') }
  }

  /* catalogVersion اعتمادٌ مقصود لا زائد: جسم الـmemo يقرأ من كتالوج مُثبَّت
     على مستوى الوحدة يُستبدل وقت التشغيل، فلا يذكر المتغير نصّا — ومن هنا يظنّه
     القاعدة زائدا. وحذفه يحفظ مصفوفات فارغة إلى الأبد في الإنتاج، وهو العطل
     الذي أُضيف الاشتراك أصلا لإصلاحه. نفس النمط في Catalog.tsx. */
  const allPathways = useMemo(
    () => bestsellers.map((b) => ({ ...b, p: pathwayById(b.id)! })).filter((b) => b.p),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إبطال ذاكرة عند تبديل الكتالوج
    [catalogVersion],
  )
  const allCourses = useMemo(
    () => bestsellerCourses.map((b) => ({ ...b, c: courseById(b.id)! })).filter((b) => b.c),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إبطال ذاكرة عند تبديل الكتالوج
    [catalogVersion],
  )
  const countBy = (items: string[]) => {
    const m = new Map<string, number>()
    for (const c of items) m.set(c, (m.get(c) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const pwCounts = useMemo(() => countBy(allPathways.map((b) => pathwayDomain(b.p.id))), [allPathways])
  const crCounts = useMemo(() => countBy(allCourses.map((b) => b.c.category)), [allCourses])

  /* الرئيسية تعرض كل المختارات — الشرائط قابلة للتمرير أفقيا */
  const shownPathways = allPathways
    .filter((b) => pwCat === 'الكل' || pathwayDomain(b.p.id) === pwCat)
  const shownCourses = allCourses
    .filter((b) => crCat === 'الكل' || b.c.category === crCat)
  const spotlight = shownPathways[0]
  const railPathways = shownPathways.slice(1)

  /* الشرائط تُملأ بعد وصول الكتالوج أو عند تغيير الفلتر — نعيد التمرير لبداية الشريط
     (scrollLeft = 0 هو الطرف الأيمن في RTL بكل المتصفحات الحديثة) حتى لا تبدأ من المنتصف */
  useEffect(() => {
    pwRailRef.current?.scrollTo({ left: 0 })
  }, [shownPathways.length, pwCat, catalogVersion])
  useEffect(() => {
    crRailRef.current?.scrollTo({ left: 0 })
  }, [shownCourses.length, crCat, catalogVersion])

  return (
    /* الفراغُ كان مرّتين: `scroll-mt-24` يُنزل القسمَ ٩٦ بكسلا تحت أعلى
       الشاشة، ثم `pt-24/28` يضيف ٩٦–١١٢ قبل أوّل سطر — فمن نقر «المسارات»
       رأى شاشةً فارغةً نصفَها. والترويسةُ ٦٤ بكسلا وحدها، فـ`scroll-mt-20`
       يكفي لتجاوزها، والحشوُ العلويّ يصير نصفَه. */
    <section id="bestsellers" className="scroll-mt-20 pb-20 pt-10 md:pb-24 md:pt-14">
      <div className="mx-auto max-w-7xl px-5">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>مختارات وجيز</SectionLabel>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">مسارات ودورات من اختيارنا</h2>
            <p className="mt-3 max-w-lg leading-8 text-muted-foreground">
              لا تريد البدء بالتشخيص؟ اختر مجالك أولا — ثم مسارا كاملا، أو دورة واحدة إن كنت تعرف ما تريد بالضبط.
            </p>
          </div>
        </div>

        {/* فلتر المسارات — أهم 5 مجالات بعدادات حقيقية، والباقي ينسدل بـ«المزيد» */}
        <div className="reveal mt-2">
          <CategoryFilter counts={pwCounts} active={pwCat} onChange={setPwCat} label="تصفية المسارات حسب المجال" />
        </div>
      </div>

      {/* البطاقة المميزة — اختيار وجيز الأول في هذا المجال */}
      {spotlight && (
        <div className="mx-auto max-w-7xl px-5">
          <div className="reveal relative mt-8">
          <Panel as={Link} tone="accent" interactive to={`/pathways/${spotlight.id}`} className="group grid overflow-hidden bg-gradient-to-l from-panel to-card transition hover:border-teal/60 hover:shadow-[0_30px_80px_-40px_rgba(56,167,180,0.5)] md:grid-cols-5">
            <div className="relative flex min-h-[104px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_30%,rgba(56,167,180,0.4),transparent_65%)] md:col-span-2 md:min-h-[190px]">
              <Route className="h-10 w-10 text-teal-light-ink/70 md:h-16 md:w-16" />
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-micro font-black text-on-gold md:right-5 md:top-5 md:gap-1.5 md:px-3.5 md:py-1.5 md:text-xs">
                <Flame className="h-3.5 w-3.5" />
                {spotlight.note}
              </span>
            </div>
            <div className="p-5 md:col-span-3 md:p-10">
              <span className="kicker">اختيار وجيز الأول في هذا المجال</span>
              <h3 className="mt-3 text-2xl font-black leading-snug md:text-3xl">{spotlight.p.name}</h3>
              <p className="mt-3 max-w-lg text-sm leading-8 text-muted-foreground">{spotlight.p.transformation}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span>{spotlight.p.level}</span>
                <span className="text-muted-foreground/50">•</span>
                {/* الحجم كلّه في عبارةٍ واحدة: دوراتٌ وساعاتٌ وأسابيع. وكان
                    «الأسابيع» يُكتب مرّتين حين أُضيفت العبارة فوق سطرٍ يحملها. */}
                <span>{pathwaySizeAr(spotlight.p)}</span>
                <span className="text-muted-foreground/50">•</span>
                <span>{spotlight.p.weeklyHours} أسبوعيا</span>
              </div>
              {/* المخرَج الملموس — لا اسمُ مدرّبٍ لم يُعيَّن بعد */}
              <p className="mt-3 flex items-start gap-1.5 text-xs leading-6 text-teal-light-ink">
                <Target className="mt-1 h-3.5 w-3.5 shrink-0" />
                <span>تتخرّج بـ: {spotlight.p.output}</span>
              </p>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-deep px-6 py-2.5 text-sm font-bold text-white transition group-hover:bg-teal-darker">
                افتح المسار
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
              </span>
            </div>
          </Panel>
          {/* مفضلة البطاقة المميزة — فوق الرابط بزاوية حرة، والنقر لا يفتح المسار */}
          <FavoriteButton pathwayId={spotlight.id} pathwayName={spotlight.p.name}
            className="absolute left-3 top-3 z-10 bg-paper/70 backdrop-blur md:left-5 md:top-5" />
          </div>
        </div>
      )}

      {/* راويل المسارات — بطاقات أنحف وأنظف */}
      <p className="sr-only" aria-live="polite">
        {`يعرض ${railPathways.length} ${railPathways.length === 1 ? 'مسارا' : 'مسارات'} — اسحب بإصبعك أو استخدم أسهم لوحة المفاتيح للتنقل بينها`}
      </p>
      <div className="mx-auto max-w-7xl px-5">
      <div
        ref={pwRailRef}
        role="region"
        aria-roledescription="شريط بطاقات"
        aria-label="مسارات مختارات وجيز"
        tabIndex={0}
        onKeyDown={(e) => railKeys(pwRailRef, e)}
        className="scrollbar-hide mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4"
      >
        {railPathways.map(({ id, note, p }) => (
          <Panel as="article" tone="accent" key={id} className="group flex w-[280px] shrink-0 snap-start flex-col bg-card transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]">
            {/* وسمٌ واحد لا اثنان.

                كان فوق كلّ بطاقةٍ وسمان: «الأنسب للخريجين» و«طلاب ومهنة».
                والثاني تصنيفٌ يقوله شريطُ التصفية فوق الشريط نفسِه — فمن
                رشّح «طلاب ومهنة» يقرأ الكلمةَ مرّتين، مرّةً وقد اختارها.
                والأوّل وحدَه يضيف: يقول لمن يصلح هذا المسار.

                وصغُر: ١٠px وحدٌّ رفيع بلا خلفيّةٍ ولا أيقونة — يُقرأ وسما
                لا زرّا، فلا ينافس عنوانَ المسار تحته. */}
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-teal/30 px-2.5 py-0.5 text-micro font-semibold text-teal-light-ink">
                {note}
              </span>
              <FavoriteButton pathwayId={id} pathwayName={p.name} className="-ms-1 ms-auto" />
            </div>
            <h3 className="mt-4 text-lg font-bold leading-relaxed">{p.name}</h3>
            {/* وصفُ التحوّل نزل إلى صفحة المسار.

                كان على البطاقة ثلاثةُ أسطرٍ منه فوق «تتخرّج بـ» — وهما يقولان
                الشيءَ نفسَه بدرجتين من التجريد: الأوّلُ وعدٌ عامّ، والثاني
                المخرَجُ الملموس. وفي شريطٍ من ثلاثَ عشرةَ بطاقة يصير الفرقُ
                خمسَ مئة كلمةٍ على صفحةٍ تُمسح بالعين لا تُقرأ.

                فبقي الأخصُّ: ما يتخرّج به، وحجمُ ما يشتريه. والعامُّ يُقرأ في
                صفحة المسار حيث للقارئ نيّةُ القراءة. */}
            <div className="mt-3 flex items-start gap-1.5 text-micro leading-5 text-teal-light-ink">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">تتخرّج بـ: {p.output}</span>
            </div>
            <div className="mt-3 text-micro leading-5 text-muted-foreground">
              {p.level} · {pathwaySizeAr(p)}
            </div>
            <div className="mt-auto pt-5">
              <Inset as={Link} tone="accent" interactive to={`/pathways/${id}`} className="block py-2.5 text-center text-sm font-semibold text-teal-light-ink transition group-hover:bg-teal-deep group-hover:text-white">
                تفاصيل المسار
              </Inset>
            </div>
          </Panel>
        ))}

        {/* بطاقة ختامية تعيد للتشخيص */}
        <Panel as={Link} tone="accent" interactive to="/diagnostic" className="flex w-[280px] shrink-0 snap-start flex-col items-center justify-center border-dashed text-center transition hover:border-teal/60 hover:bg-teal/10">
          <Compass className="h-8 w-8 text-teal-ink" />
          <p className="mt-4 font-bold leading-relaxed">لم تجد ما يناسبك؟</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            التشخيص يطابقك مع مساراتنا المصممة — ويشرح لك لماذا.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-light-ink">
            ابدأ التشخيص
            <ArrowLeft className="h-4 w-4" />
          </span>
        </Panel>
      </div>
      {/* أسهم التقليب — أسفل الشريط: يبقى السحب بالإصبع متاحا والأسهم بديل واضح */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button onClick={() => scroll(pwRailRef, 'prev')} aria-label="السابق في المسارات"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light-ink">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button onClick={() => scroll(pwRailRef, 'next')} aria-label="التالي في المسارات"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light-ink">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      </div>

      {/* راويل الدورات المختارة */}
      <div id="top-courses" className="mx-auto mt-12 max-w-7xl scroll-mt-24 px-5">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="h-6 w-6 text-gold-ink" />
              دورات مختارة بعناية
            </h3>
            <p className="mt-2 max-w-lg text-sm leading-7 text-muted-foreground">
              تعرف تماما ما تريد؟ خذ دورة واحدة وابدأ اليوم — وإن أكملت لاحقا لمسارها الكامل، خُصم ما دفعته من سعره.
            </p>
          </div>
        </div>
        {/* فلتر الدورات — حسب المجال، بعدادات من بيانات الدورات نفسها */}
        <div className="reveal">
          <CategoryFilter counts={crCounts} active={crCat} onChange={setCrCat} label="تصفية الدورات حسب المجال" />
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {`يعرض ${shownCourses.length} ${shownCourses.length === 1 ? 'دورة' : 'دورات'} — اسحب بإصبعك أو استخدم أسهم لوحة المفاتيح للتنقل بينها`}
      </p>
      <div className="mx-auto max-w-7xl px-5">
      <div
        ref={crRailRef}
        role="region"
        aria-roledescription="شريط بطاقات"
        aria-label="دورات مختارة من وجيز"
        tabIndex={0}
        onKeyDown={(e) => railKeys(crRailRef, e)}
        className="scrollbar-hide mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
      >
        {shownCourses.map(({ id, note, c }) => (
          <Card as="article" tone="accent" key={id} className="group flex w-[270px] shrink-0 snap-start flex-col bg-card transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-micro font-bold text-teal-light-ink">
                <Flame className="h-3 w-3" />
                {note}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-micro text-muted-foreground">{c.category}</span>
            </div>
            <CourseTitle as="h4" name={c.name} termEn={c.termEn} className="mt-3 font-bold leading-relaxed" termClassName="text-muted-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">من مسار «{c.pathwayName}» · {c.weeks} {c.weeks === 1 ? 'أسبوع' : 'أسابيع'}</p>
            {c.skill && (
              <span className="mt-3 w-fit rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-micro text-teal-light-ink">
                {c.skill}
              </span>
            )}
            <div className="mt-auto pt-4">
              {/* تفتح مسارا من هذه الدورة وحدها — لا نافذة مقتطفة ولا المسار كاملا */}
              <Link to={`/build/${c.id}`} onClick={() => track('course_viewed', { category: c.category })} className="block w-full cursor-pointer rounded-lg border border-white/15 py-2 text-center text-xs font-semibold text-foreground transition group-hover:border-teal/50 group-hover:text-teal-light-ink">
                تفاصيل الدورة
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {/* أسهم التقليب — أسفل الشريط: يبقى السحب بالإصبع متاحا والأسهم بديل واضح */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button onClick={() => scroll(crRailRef, 'prev')} aria-label="السابق في الدورات"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light-ink">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button onClick={() => scroll(crRailRef, 'next')} aria-label="التالي في الدورات"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light-ink">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-center gap-3 px-5">
        <Card as={Link} tone="accent" interactive to="/pathways" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-teal-light-ink transition hover:bg-teal-deep hover:text-white">
          تصفح كل المسارات
          <ArrowLeft className="h-4 w-4" />
        </Card>
        <Card as={Link} tone="warn" interactive to="/courses" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-muted-foreground transition hover:border-gold/50 hover:text-gold-ink">
          تصفح كل الدورات
          <ArrowLeft className="h-4 w-4" />
        </Card>
      </div>

    </section>
  )
}

/* ───────────────── FAQ ───────────────── */
