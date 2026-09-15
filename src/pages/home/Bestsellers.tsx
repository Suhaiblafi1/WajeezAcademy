/* «مختارات وجيز» — بطاقةٌ واحدةٌ وبابان، لا كتالوجٌ ثانٍ (البند ٥٦).

   ─────────── ما كان ───────────

   كان هذا القسمُ **صفحةَ كتالوجٍ كاملةً داخلَ الرئيسة**: فلترُ مجالاتٍ
   بعدّاداتٍ و«المزيد»، وبطاقةٌ مميّزة، وشريطُ بطاقاتِ مسارات، ثمّ عنوانٌ
   ثانٍ وفلترٌ ثانٍ وشريطٌ ثانٍ للدورات، ثمّ زرّان يحيلان إلى `/pathways`
   و`/courses` — أي إلى **الصفحتين اللتين تفعلان هذا كلَّه وأكثر**.

   والقياسُ على هاتفٍ ٣٩٠×٨٤٤: ٢١٩٩ بكسلا — **خُمسُ الصفحة** من ١٠٨٨٢،
   وأكبرُ كتلةٍ فيها. والرئيسةُ ١٢٫٩ شاشةَ تمرير.

   ─────────── والقرار ───────────

   قرارُ صاحب المنصّة (الخيار «ب»): يبقى **الدليلُ** ويذهب **الكتالوج**.
   فالبطاقةُ المميّزةُ تعرض مسارا واحدا بمخرَجه ومدّته ومستواه — حجّةٌ تُقرأ
   في ثانية. أمّا التصفيةُ بالمجال فهي عملُ صفحة الكتالوج: من أرادها أرادها
   كاملةً، والزرّان يوصلانه إليها.

   وذهب معها: فلترا المجالات، وشريطا البطاقات، وأزرارُ تمريرهما، ومرساةُ
   `#top-courses` (لم تكن مقصودةً من رابطٍ واحدٍ في المشروع). وبقيت مرساةُ
   `#bestsellers` — يقصدها زرُّ «اختر مسارك بنفسك» في الصدر. */

import { useMemo, useState, useSyncExternalStore } from "react"
import { Link } from "react-router"
import { ArrowLeft, ChevronDown, Compass, Flame, Route, Target } from "lucide-react"
import { bestsellers, pathwayById, pathwayDomain, pathways, type Pathway } from "@/data/pathways"
import { resolveCatalogRefsAr } from "@/application/catalog/visitor-text"
import { ALL_AR, filterRows, shownFor, type PickSource } from "@/application/catalog/home-picks"
import { getCatalogVersion, onCoreCatalogInstalled } from "@/data/core-catalog-source"
import { bestsellerCourses, courses, pathwaySizeAr, type Course } from "@/data/courses"
import CourseTitle from "@/components/CourseTitle"
import { Card } from "@/components/ui/Surface"
import FavoriteButton from "@/components/FavoriteButton"
import SectionLabel from "./SectionLabel"

/* البابان يشتركان في هيئةٍ واحدة، ويفترق لونُهما وحدَه */
const DOOR = "inline-flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-bold transition"


/* مرشِّحُ المجالات — أُعيد بطلب صاحب المنصّة (٧ سبتمبر ٢٠٢٦).

   كان قد ذهب مع البند ٥٦ لأنّه جعل القسمَ خُمسَ الصفحة. وقد أُعيدت البطاقاتُ
   وحدَها أوّلا، فسأل: «ولا يوجد فلاتر للدورات أو المسارات؟».

   والصفُّ واحدٌ يُمرَّر على الهاتف لا ثلاثةُ صفوفٍ ملتفّة — وهي العلّةُ التي
   جعلته ثقيلا أوّلَ مرّة: من جاء يتصفّح المسارات يرى المرشِّحات لا المسارات.
   والالتفافُ يعود من `sm:` فلا يفقد سطحُ المكتب شيئا. */
function CategoryFilter({
  counts, allCount, active, onChange, label,
}: {
  counts: [string, number][]
  /* عدُّ «الكل» يُمرَّر ولا يُجمع من الرقاقات.

     كان `counts.reduce(...)` — وهو صحيحٌ ما دام المعروضُ تحت «الكل» هو
     اتّحادَ ما تحت الرقاقات. ولم يعد كذلك: لكلّ رقاقةٍ سقفٌ أربعة و«الكل»
     رقاقةٌ لها سقفُها، فالجمعُ يَعِد باثنتين وعشرين ويعطي أربعا. */
  allCount: number
  active: string
  onChange: (c: string) => void
  label: string
}) {
  const [more, setMore] = useState(false)
  const TOP = 5
  const total = allCount
  const rest = counts.slice(TOP)
  const activeInRest = rest.some(([c]) => c === active)
  const shown: [string, number][] = [['الكل', total], ...counts.slice(0, TOP), ...(more || activeInRest ? rest : [])]
  /* ─── الرقاقةُ صغُرت (صاحب المنصّة، ١٢ سبتمبر ٢٠٢٦): «اجعلها أصغر بكثير» ───

     كانت `text-sm` بحشوِ ‎14×6‎ يرتفع إلى ‎16×8‎ على الشاشات الأوسع — فصفُّ
     المرشِّحات يعلو ٤٠ بكسلا فوق البطاقات التي جاء الزائرُ ليراها، وهي
     أداةٌ تخدم القائمةَ لا تزاحمها. فنزلت إلى `text-fine` بحشوِ ‎10×4‎،
     ولم تعد تكبر على `sm:` — الأداةُ أداةٌ في كلّ عرض.

     والارتفاعُ الملموسُ باقٍ: `min-h-8` تحفظ للإصبع هدفا يُضغط بعد أن
     صار الحشوُ أصغرَ من أن يصنعه وحدَه. */
  const chip = 'inline-flex min-h-8 shrink-0 snap-start items-center gap-1 rounded-full border px-2.5 py-1 text-fine font-semibold transition'

  return (
    <div
      className="scrollbar-hide -mx-5 mt-3 flex snap-x items-center gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
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
              ? 'border-teal bg-teal-deep text-white'
              : 'border-border bg-white/[0.03] text-muted-foreground hover:border-teal/40 hover:text-teal-light-ink'
          }`}
        >
          {c}
          <span className={`rounded-full px-1 text-fine font-black leading-4 tabular-nums ${active === c ? 'bg-black/25' : 'bg-foreground/[0.07] text-muted-foreground'}`}>
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
          <ChevronDown className={`h-3 w-3 transition-transform ${more || activeInRest ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}

/* ــ وسمُ البطاقة: ذهبيٌّ لمن اختير، وهادئٌ لمن اقتُرح ــ

   ما جاء لإتمام الثلاثة ليس «من اختيارنا» — والوسمُ الذهبيُّ ادّعاءٌ تحريريّ
   لا يُلبَس لمن لم يُختر (`home-picks.ts` يعيده بـ`note: null`). فله وسمُه:
   الشكلُ نفسُه والصوتُ أخفض، فيبقى للشريط إيقاعٌ واحدٌ بلا فراغٍ في موضع
   الوسم ولا ادّعاءٍ زائد.

   وما جاء من **خارج** المجال يقول مجالَه صريحا: تحت رقاقةٍ لا يبلغ مجالُها
   ثلاثةً في الكتالوج كلِّه، البطاقةُ الوافدةُ تُعلن من أين هي — فالرقاقةُ
   لا تُنسَب إليها بطاقةٌ ليست منها. */
function PickBadge({ note, fromDomain }: { note: string | null; fromDomain?: string }) {
  if (note) {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-fine font-bold text-gold-ink">
        <Flame className="h-3 w-3" />
        {note}
      </span>
    )
  }
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-fine font-semibold text-muted-foreground">
      <Compass className="h-3 w-3" />
      {fromDomain ? `من ${fromDomain}` : 'مقترحٌ في هذا المجال'}
    </span>
  )
}

export function Bestsellers() {
  const catalogVersion = useSyncExternalStore(onCoreCatalogInstalled, getCatalogVersion)

  /* catalogVersion اعتمادٌ مقصود لا زائد: جسم الـmemo يقرأ من كتالوج مُثبَّت
     على مستوى الوحدة يُستبدل وقت التشغيل، فلا يذكر المتغير نصّا — ومن هنا يظنّه
     القاعدة زائدا. وحذفه يحفظ مصفوفات فارغة إلى الأبد في الإنتاج، وهو العطل
     الذي أُضيف الاشتراك أصلا لإصلاحه. نفس النمط في Catalog.tsx. */
  const picks = useMemo(
    () => bestsellers.map((b) => ({ ...b, p: pathwayById(b.id)! })).filter((b) => b.p),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إبطال ذاكرة عند تبديل الكتالوج
    [catalogVersion],
  )
  const spotlight = picks[0]
  const [pwCat, setPwCat] = useState(ALL_AR)
  const [crCat, setCrCat] = useState(ALL_AR)

  /* أسماءُ المسارات لفكّ إحالات «ليس لك إن» — الحقلُ يشير إلى مساراتٍ بمعرّفها.
     والخريطةُ من الكتالوج كلِّه لا من المختارات وحدَها: المقترَحُ يحمل الحقلَ
     نفسَه، وإحالتُه إلى مسارٍ غيرِ مختارٍ كانت تُحذف مع جملتها (`visitor-text`). */
  const nameById = useMemo(
    () => new Map(pathways.map((p) => [p.id, p.shortName])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- كما فوقه: الكتالوجُ يُستبدل وقت التشغيل
    [catalogVersion],
  )

  /* ── شريطُ المسارات: مختاراتٌ يُتمّها الكتالوجُ إلى ثلاثة، وسقفُها أربعة ──
     البطاقةُ المميّزةُ تُستثنى فلا تُرى مرّتين في قسمٍ واحد. */
  const pathSource: PickSource<Pathway> = useMemo(
    () => ({
      editorial: bestsellers,
      pool: pathways,
      idOf: (p) => p.id,
      domainOf: (p) => pathwayDomain(p.id),
      exclude: spotlight ? [spotlight.id] : [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- كما فوقه: الكتالوجُ يُستبدل وقت التشغيل
    [spotlight, catalogVersion],
  )
  const pwRows = useMemo(() => filterRows(pathSource), [pathSource])
  const pwCounts = useMemo(
    () => pwRows.map((r) => [r.domain, r.shown.length] as [string, number]),
    [pwRows],
  )
  const morePaths = useMemo(() => shownFor(pathSource, pwCat), [pathSource, pwCat])

  /* ── وترتيبُ الاقتراح في الدورات: دورةٌ من كلّ مسارٍ أوّلا ──
     الكتالوجُ مرتَّبٌ بالمسار ثمّ التسلسل، فأوّلُ ما يقع عليه الإتمامُ دورةٌ
     من المسار الذي أُخذت منه المختارة. فتُقدَّم دورةٌ واحدةٌ من كلّ مسارٍ على
     ثانيةٍ من مسارٍ رُئي — اقتراحٌ يوسّع ما يُرى لا يكرّره. */
  const coursePool = useMemo(() => {
    const firsts: typeof courses = []
    const rest: typeof courses = []
    const seen = new Set<string>()
    for (const c of courses) {
      if (seen.has(c.pathwayId)) rest.push(c)
      else { firsts.push(c); seen.add(c.pathwayId) }
    }
    return [...firsts, ...rest]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- كما فوقه: الكتالوجُ يُستبدل وقت التشغيل
  }, [catalogVersion])

  /* والمجالُ لا الفئةُ المستهدفة — كرقاقات صفحة الدورات (صاحب المنصّة، ٨
     سبتمبر ٢٠٢٦: «للدورات أريد البحث يكون بالمجال مثل المسارات وليس الفئة
     المستهدفة»). كانت الرئيسةُ وحدَها بقيت على `category`، فيقرأ الزائرُ
     «موظفون ومختصون» هنا و«إدارة المشاريع والعمليات» هناك للشيء نفسِه. */
  const courseSource: PickSource<Course> = useMemo(
    () => ({
      editorial: bestsellerCourses,
      pool: coursePool,
      idOf: (c) => c.id,
      domainOf: (c) => pathwayDomain(c.pathwayId),
    }),
    [coursePool],
  )
  const crRows = useMemo(() => filterRows(courseSource), [courseSource])
  const crCounts = useMemo(
    () => crRows.map((r) => [r.domain, r.shown.length] as [string, number]),
    [crRows],
  )
  const moreCourses = useMemo(() => shownFor(courseSource, crCat), [courseSource, crCat])

  return (
    <section id="bestsellers" className="scroll-mt-20 pb-10 pt-10 md:pb-12 md:pt-14">
      <div className="shell">
        <div className="reveal">
          <SectionLabel>مختارات وجيز</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">مسارات ودورات من اختيارنا</h2>
          {/* كانت تقول «اختر مجالك أولا» وتحتها فلتر. ذهب الفلتر، فذهبت
              الإحالةُ إليه. ثمّ قُصّرت بقرار صاحب المنصّة (١٢ سبتمبر ٢٠٢٦):
              وصفُ ما تحتها («مثالٌ ثمّ بابان») كانت تقوله البطاقاتُ نفسُها،
              فبقي من الجملة دعوةٌ واحدةٌ صريحةٌ لمن لا يريد التشخيص. */}
          <p className="mt-3 max-w-lg leading-8 text-muted-foreground">
            لا تريد البدء بالتشخيص؟ اختر المسار الذي يناسبك
          </p>
        </div>

        {/* البطاقة المميزة — اختيار وجيز الأول */}
        {/* ── ولماذا `article` لا `div` ──

            البطاقةُ عنصرٌ قائمٌ بذاته: عنوانٌ ووصفٌ ومدّةٌ ومخرَجٌ ورابط —
            وهذا تعريفُ `article` في HTML، لا زخرفةٌ دلاليّة.

            وله أثرٌ مقيس: فحصُ الإتاحة ينتظر `article` علامةً على أنّ
            الرئيسةَ اكتملت (`scripts/a11y-audit.ts:59`). وحين حُذف الشريطان
            في هذا البند ذهبت معهما **كلُّ** عناصر `article` من الصفحة، فوقف
            الفحصُ ٢٥ ثانيةً ثمّ عدّها واقعةَ إتاحة: `landmark: 0 ← 1`.
            وأمسكها CI لا أنا. */}
        {/* ── ولماذا صغُرت (٨ سبتمبر ٢٠٢٦) ──

            كانت لوحةً من خمسة أعمدة: عمودان لأيقونةٍ وحدَها، وثلاثةٌ لحشوٍ
            أربعين بكسلا وعنوانٍ من ثلاثين. ومعاملُ التكبير على اللابتوب يجعلها
            ثلثَ الشاشة لمسارٍ واحد. فوصفها صاحبُ المنصّة بأنّها «كبيرةٌ جدّا»
            واختار ضغطَها لا حذفَها: المحتوى نفسُه، في نصف الارتفاع — عمودٌ
            رفيعٌ للأيقونة، وشارةُ «اختيار وجيز» في صفّ العنوان لا معلّقةً فوق
            فراغ. */}
        {spotlight && (
          <article className="reveal relative mt-8">
            <Link
              to={`/pathways/${spotlight.id}`}
              className="group grid overflow-hidden rounded-3xl border border-teal/30 bg-gradient-to-l from-panel to-card transition hover:border-teal/60 hover:shadow-[0_30px_80px_-40px_rgba(56,167,180,0.5)] md:grid-cols-6"
            >
              <div className="relative flex min-h-[64px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_30%,rgba(56,167,180,0.4),transparent_65%)] md:col-span-1 md:min-h-0">
                <Route className="h-8 w-8 text-teal-light-ink/70 md:h-9 md:w-9" />
              </div>
              <div className="p-5 md:col-span-5 md:px-7 md:py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="kicker">اختيار وجيز الأول</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-fine font-black text-on-gold">
                    <Flame className="h-3 w-3" />
                    {spotlight.note}
                  </span>
                </div>
                <h3 className="mt-2.5 text-xl font-black leading-snug md:text-2xl">{spotlight.p.name}</h3>
                <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{spotlight.p.transformation}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                  <span>{spotlight.p.level}</span>
                  <span className="text-muted-foreground/50">•</span>
                  {/* الحجم كلّه في عبارةٍ واحدة: دوراتٌ وساعاتٌ وأسابيع. وكان
                      «الأسابيع» يُكتب مرّتين حين أُضيفت العبارة فوق سطرٍ يحملها. */}
                  <span>{pathwaySizeAr(spotlight.p)}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{spotlight.p.weeklyHours} أسبوعيا</span>
                </div>
                {/* المخرَج الملموس — لا اسمُ مدرّبٍ لم يُعيَّن بعد */}
                <p className="mt-2 flex items-start gap-1.5 text-read leading-6 text-teal-light-ink">
                  <Target className="mt-1 h-3.5 w-3.5 shrink-0" />
                  <span>تتخرّج بـ: {spotlight.p.output}</span>
                </p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-deep px-5 py-2 text-sm font-bold text-white transition group-hover:bg-teal-darker">
                  افتح المسار
                  <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
                </span>
              </div>
            </Link>
            {/* مفضلة البطاقة المميزة — فوق الرابط بزاوية حرة، والنقر لا يفتح المسار */}
            <FavoriteButton refId={spotlight.id} title={spotlight.p.name}
              className="absolute left-3 top-3 z-10 bg-paper/70 backdrop-blur md:left-5 md:top-5" />
          </article>
        )}


        {/* ── الشريطان: مساراتٌ ودوراتٌ تُرى، بلا فلترٍ يعيد الكتالوج ──

            أُعيدا بقرار صاحب المنصّة (٧ سبتمبر ٢٠٢٦) بعد أن رأى الرئيسةَ
            حيّة: «لا يظهر إلّا مسارٌ واحد — أين مختاراتُ وجيز؟».

            والذي عاد **المحتوى** لا الكتالوج: بطاقاتٌ تُرى وتُنقر. أمّا
            فلترا المجالات بعدّاداتهما و«المزيد» فلم يعودا — هما ما جعل
            القسمَ خُمسَ الصفحة (٢١٩٩ بكسلا)، والتصفيةُ عملُ صفحةِ الكتالوج
            لا الرئيسة. فبقي قرارُ البند ٥٦ في جوهره: **دليلٌ لا كتالوجٌ ثانٍ.**

            وكان العددُ ستّا لكلٍّ تُقتطع من أوّل القائمة. فصار (١٥ سبتمبر
            ٢٠٢٦) ثلاثةً حدًّا أدنى وأربعةً حدًّا أعلى **لكلّ رقاقة** —
            والحسابُ كلُّه في `home-picks.ts` ومعه علّتُه. */}
        {morePaths.length > 0 && (
          <div className="reveal mt-12">
            <h3 className="text-lg font-bold md:text-xl">مسارات أخرى من اختيارنا</h3>
            <CategoryFilter counts={pwCounts} allCount={shownFor(pathSource, ALL_AR).length} active={pwCat} onChange={setPwCat} label="تصفية المسارات حسب المجال" />
            <div className="scrollbar-hide -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
              {morePaths.map((b) => (
                <Card
                  key={b.item.id}
                  as={Link}
                  to={`/pathways/${b.item.id}`}
                  tone="accent"
                  interactive
                  className="group flex w-[280px] shrink-0 snap-start flex-col gap-2 p-5 md:w-[330px] md:gap-2.5 md:p-6"
                >
                  {/* ذهبيّةٌ كبطاقة الدورة المجاورة (صاحب المنصّة، ١٢ سبتمبر
                      ٢٠٢٦): الوسمُ واحدٌ في معناه — «هذه مختارةٌ ولمن» —
                      فلونان له في شريطين متجاورين يقولان فرقا لا وجود له. */}
                  <PickBadge note={b.note} fromDomain={b.kind === 'other' ? pathwayDomain(b.item.id) : undefined} />
                  {/* الاسمُ **القصير** كبطاقة الكتالوج: الكاملُ متوسّطُه ٤٥ حرفا
                      وفيه نقطتان — يصلح لصفحةٍ لا لبطاقةٍ في شريط. */}
                  <h4 className="text-base font-black leading-snug">{b.item.shortName}</h4>
                  {/* «لمن؟» حُذفت من البطاقة (٩ سبتمبر ٢٠٢٦، قرارُ صاحب المنصّة
                      — عكسُ البند ٣٠): بطاقةٌ أهدأ وأقلّ ازدحاما. و«ليس لك
                      إن» يبقى — أصدقُ سطرٍ في الكتالوج: يمنع شراءً خاطئا قبل
                      وقوعه، والمنعُ خدمةٌ لا خسارة. */}
                  {b.item.notFor && (
                    <p className="line-clamp-2 text-read leading-5 text-muted-foreground md:line-clamp-3">
                      <span className="font-bold text-gold-ink">ليس لك إن: </span>
                      {resolveCatalogRefsAr(b.item.notFor, (id) => nameById.get(id))}
                    </p>
                  )}
                  <p className="flex items-start gap-1.5 text-read leading-5 text-teal-light-ink">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2 min-w-0 md:line-clamp-3">تتخرّج بـ: {b.item.output}</span>
                  </p>
                  {/* سطرُ الذيل: الحجمُ يمينا، و«تفاصيل المسار» يسارا — لافتةٌ
                      خافتةٌ تقول إنّ البطاقةَ تُفتح، لا زرٌّ يزاحم المحتوى.
                      كانت البطاقةُ بلا أيّ إشارةٍ إلى أنّها رابط (٨ سبتمبر ٢٠٢٦).

                      والخفوتُ بالحجم لا بالشفافيّة: `text-teal-light-ink/75`
                      أسقط التباينَ إلى ٣٫٨:١ على الورق الفاتح (فحصُ الإتاحة في
                      CI)، والحبرُ كاملا ينقلب إلى `#1F6E77` هناك فيبلغ ٤٫٥:١. */}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-fine text-muted-foreground">
                    <span>{pathwaySizeAr(b.item)}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-teal-light-ink transition group-hover:underline group-hover:underline-offset-4">
                      تفاصيل المسار
                      <ArrowLeft className="h-3 w-3 transition group-hover:-translate-x-0.5" />
                    </span>
                  </span>
                </Card>
              ))}
            </div>
            {/* البابُ تحت شريطه لا في ذيل القسم — بقرار صاحب المنصّة (٨ سبتمبر ٢٠٢٦) */}
            <div className="mt-2 flex justify-center">
              <Link
                to="/pathways"
                className={`${DOOR} border-teal/40 text-teal-light-ink hover:bg-teal-deep hover:text-white`}
              >
                تصفح كل المسارات
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {moreCourses.length > 0 && (
          <div className="reveal mt-10">
            <h3 className="text-lg font-bold md:text-xl">ودوراتٌ مفردة</h3>
            <CategoryFilter counts={crCounts} allCount={shownFor(courseSource, ALL_AR).length} active={crCat} onChange={setCrCat} label="تصفية الدورات حسب المجال" />
            <div className="scrollbar-hide -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
              {moreCourses.map((b) => (
                /* ⚠️ `‎/build/:courseId` لا `‎/courses/:id`.
                   الثاني **ليس مسارا في التطبيق** — كتبتُه في #46 فكانت كلُّ
                   بطاقةِ دورةٍ رابطا مكسورا على الإنتاج. والكتالوجُ يقصد
                   `‎/build/` نفسَه: صفحةٌ من هذه الدورة وحدَها. */
                <Card
                  key={b.item.id}
                  as={Link}
                  to={`/build/${b.item.id}`}
                  interactive
                  className="group flex w-[260px] shrink-0 snap-start flex-col gap-2 p-5 md:w-[310px] md:gap-2.5 md:p-6"
                >
                  <PickBadge note={b.note} fromDomain={b.kind === 'other' ? pathwayDomain(b.item.pathwayId) : undefined} />
                  <CourseTitle as="h4" name={b.item.name} termEn={b.item.termEn} className="font-bold leading-relaxed" />
                  {/* الوعدُ — ما يخرج به المتعلّم، وهو ما يُشترى */}
                  {b.item.promise && (
                    <p className="line-clamp-2 text-read leading-6 text-muted-foreground md:line-clamp-3">{b.item.promise}</p>
                  )}
                  <p className="text-read text-muted-foreground">
                    {b.item.weeks} {b.item.weeks === 1 ? 'أسبوع' : 'أسابيع'}
                  </p>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="w-fit rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-fine text-teal-light-ink">
                      {b.item.skill}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-fine font-semibold text-teal-light-ink transition group-hover:underline group-hover:underline-offset-4">
                      تفاصيل الدورة
                      <ArrowLeft className="h-3 w-3 transition group-hover:-translate-x-0.5" />
                    </span>
                  </span>
                </Card>
              ))}
            </div>
            <div className="mt-2 flex justify-center">
              <Link
                to="/courses"
                className={`${DOOR} border-white/15 text-muted-foreground hover:border-gold/50 hover:text-gold-ink`}
              >
                تصفح كل الدورات
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
