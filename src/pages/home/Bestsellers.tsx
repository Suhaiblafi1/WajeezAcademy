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
import { ArrowLeft, ChevronDown, Flame, Route, Target } from "lucide-react"
import { bestsellers, pathwayById, pathwayDomain } from "@/data/pathways"
import { resolveCatalogRefsAr } from "@/application/catalog/visitor-text"
import { getCatalogVersion, onCoreCatalogInstalled } from "@/data/core-catalog-source"
import { bestsellerCourses, courseById, pathwaySizeAr } from "@/data/courses"
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
  counts, active, onChange, label,
}: {
  counts: [string, number][]
  active: string
  onChange: (c: string) => void
  label: string
}) {
  const [more, setMore] = useState(false)
  const TOP = 5
  const total = counts.reduce((sum, [, n]) => sum + n, 0)
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

/** عدُّ التكرار مرتَّبا تنازليّا — بلا «الكل»، يضيفه المرشِّح */
function countBy(values: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
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
  const [pwCat, setPwCat] = useState('الكل')
  const [crCat, setCrCat] = useState('الكل')

  /* أسماءُ المسارات لفكّ إحالات «ليس لك إن» — الحقلُ يشير إلى مساراتٍ بمعرّفها */
  const nameById = useMemo(
    () => new Map(picks.map((b) => [b.p.id, b.p.shortName])),
    [picks],
  )

  /* بقيّةُ المختارات بعد المميّزة — تُصفّى ثمّ تُقتطع بستّ */
  const restPaths = useMemo(() => picks.slice(1), [picks])
  const pwCounts = useMemo(() => countBy(restPaths.map((b) => pathwayDomain(b.p.id))), [restPaths])
  const morePaths = useMemo(
    () => restPaths.filter((b) => pwCat === 'الكل' || pathwayDomain(b.p.id) === pwCat).slice(0, 6),
    [restPaths, pwCat],
  )

  const allCourses = useMemo(
    () => bestsellerCourses.map((b) => ({ ...b, c: courseById(b.id)! })).filter((b) => b.c),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- كما فوقه: الكتالوجُ يُستبدل وقت التشغيل
    [catalogVersion],
  )
  const crCounts = useMemo(() => countBy(allCourses.map((b) => b.c.category)), [allCourses])
  const moreCourses = useMemo(
    () => allCourses.filter((b) => crCat === 'الكل' || b.c.category === crCat).slice(0, 6),
    [allCourses, crCat],
  )

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
            <FavoriteButton pathwayId={spotlight.id} pathwayName={spotlight.p.name}
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

            والعددُ ستٌّ لكلٍّ: يملأ الشريطَ ولا يُغري بالتمرير بلا نهاية. */}
        {morePaths.length > 0 && (
          <div className="reveal mt-12">
            <h3 className="text-lg font-bold md:text-xl">مسارات أخرى من اختيارنا</h3>
            <CategoryFilter counts={pwCounts} active={pwCat} onChange={setPwCat} label="تصفية المسارات حسب المجال" />
            <div className="scrollbar-hide -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
              {morePaths.map((b) => (
                <Card
                  key={b.id}
                  as={Link}
                  to={`/pathways/${b.id}`}
                  tone="accent"
                  interactive
                  className="group flex w-[280px] shrink-0 snap-start flex-col gap-2 p-5"
                >
                  {/* ذهبيّةٌ كبطاقة الدورة المجاورة (صاحب المنصّة، ١٢ سبتمبر
                      ٢٠٢٦): الوسمُ واحدٌ في معناه — «هذه مختارةٌ ولمن» —
                      فلونان له في شريطين متجاورين يقولان فرقا لا وجود له. */}
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-fine font-bold text-gold-ink">
                    <Flame className="h-3 w-3" />
                    {b.note}
                  </span>
                  {/* الاسمُ **القصير** كبطاقة الكتالوج: الكاملُ متوسّطُه ٤٥ حرفا
                      وفيه نقطتان — يصلح لصفحةٍ لا لبطاقةٍ في شريط. */}
                  <h4 className="text-base font-black leading-snug">{b.p.shortName}</h4>
                  {/* «لمن؟» حُذفت من البطاقة (٩ سبتمبر ٢٠٢٦، قرارُ صاحب المنصّة
                      — عكسُ البند ٣٠): بطاقةٌ أهدأ وأقلّ ازدحاما. و«ليس لك
                      إن» يبقى — أصدقُ سطرٍ في الكتالوج: يمنع شراءً خاطئا قبل
                      وقوعه، والمنعُ خدمةٌ لا خسارة. */}
                  {b.p.notFor && (
                    <p className="line-clamp-2 text-read leading-5 text-muted-foreground">
                      <span className="font-bold text-gold-ink">ليس لك إن: </span>
                      {resolveCatalogRefsAr(b.p.notFor, (id) => nameById.get(id))}
                    </p>
                  )}
                  <p className="flex items-start gap-1.5 text-read leading-5 text-teal-light-ink">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2 min-w-0">تتخرّج بـ: {b.p.output}</span>
                  </p>
                  {/* سطرُ الذيل: الحجمُ يمينا، و«تفاصيل المسار» يسارا — لافتةٌ
                      خافتةٌ تقول إنّ البطاقةَ تُفتح، لا زرٌّ يزاحم المحتوى.
                      كانت البطاقةُ بلا أيّ إشارةٍ إلى أنّها رابط (٨ سبتمبر ٢٠٢٦).

                      والخفوتُ بالحجم لا بالشفافيّة: `text-teal-light-ink/75`
                      أسقط التباينَ إلى ٣٫٨:١ على الورق الفاتح (فحصُ الإتاحة في
                      CI)، والحبرُ كاملا ينقلب إلى `#1F6E77` هناك فيبلغ ٤٫٥:١. */}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-fine text-muted-foreground">
                    <span>{pathwaySizeAr(b.p)}</span>
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
            <CategoryFilter counts={crCounts} active={crCat} onChange={setCrCat} label="تصفية الدورات حسب المجال" />
            <div className="scrollbar-hide -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
              {moreCourses.map((b) => (
                /* ⚠️ `‎/build/:courseId` لا `‎/courses/:id`.
                   الثاني **ليس مسارا في التطبيق** — كتبتُه في #46 فكانت كلُّ
                   بطاقةِ دورةٍ رابطا مكسورا على الإنتاج. والكتالوجُ يقصد
                   `‎/build/` نفسَه: صفحةٌ من هذه الدورة وحدَها. */
                <Card
                  key={b.id}
                  as={Link}
                  to={`/build/${b.id}`}
                  interactive
                  className="group flex w-[260px] shrink-0 snap-start flex-col gap-2 p-5"
                >
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-fine font-bold text-gold-ink">
                    <Flame className="h-3 w-3" />
                    {b.note}
                  </span>
                  <CourseTitle as="h4" name={b.c.name} termEn={b.c.termEn} className="font-bold leading-relaxed" />
                  {/* الوعدُ — ما يخرج به المتعلّم، وهو ما يُشترى */}
                  {b.c.promise && (
                    <p className="line-clamp-2 text-read leading-6 text-muted-foreground">{b.c.promise}</p>
                  )}
                  <p className="text-read text-muted-foreground">
                    {b.c.weeks} {b.c.weeks === 1 ? 'أسبوع' : 'أسابيع'}
                  </p>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="w-fit rounded-full border border-teal/25 bg-teal/10 px-2.5 py-1 text-fine text-teal-light-ink">
                      {b.c.skill}
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
