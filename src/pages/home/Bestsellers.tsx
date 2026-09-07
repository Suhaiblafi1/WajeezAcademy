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

import { useMemo, useSyncExternalStore } from "react"
import { Link } from "react-router"
import { ArrowLeft, Flame, Route, Target } from "lucide-react"
import { bestsellers, pathwayById } from "@/data/pathways"
import { getCatalogVersion, onCoreCatalogInstalled } from "@/data/core-catalog-source"
import { bestsellerCourses, courseById, pathwaySizeAr } from "@/data/courses"
import CourseTitle from "@/components/CourseTitle"
import { Card } from "@/components/ui/Surface"
import FavoriteButton from "@/components/FavoriteButton"
import SectionLabel from "./SectionLabel"

/* البابان يشتركان في هيئةٍ واحدة، ويفترق لونُهما وحدَه */
const DOOR = "inline-flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-bold transition"

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
  /* بقيّةُ المختارات — ستٌّ تكفي شريطا ولا تُعيد الكتالوج */
  const morePaths = picks.slice(1, 7)
  const moreCourses = useMemo(
    () => bestsellerCourses.map((b) => ({ ...b, c: courseById(b.id)! })).filter((b) => b.c).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- كما فوقه: الكتالوجُ يُستبدل وقت التشغيل
    [catalogVersion],
  )

  return (
    <section id="bestsellers" className="scroll-mt-20 pb-16 pt-10 md:pb-20 md:pt-14">
      <div className="mx-auto max-w-7xl px-5">
        <div className="reveal">
          <SectionLabel>مختارات وجيز</SectionLabel>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">مسارات ودورات من اختيارنا</h2>
          {/* كانت تقول «اختر مجالك أولا» وتحتها فلتر. ذهب الفلتر، فذهبت
              الإحالةُ إليه: الجملةُ تصف ما تحتها الآن — مثالٌ ثمّ بابان. */}
          <p className="mt-3 max-w-lg leading-8 text-muted-foreground">
            لا تريد البدء بالتشخيص؟ هذا مثالٌ على ما نرشّحه — والكتالوج كاملا على بُعد نقرة.
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
        {spotlight && (
          <article className="reveal relative mt-8">
            <Link
              to={`/pathways/${spotlight.id}`}
              className="group grid overflow-hidden rounded-3xl border border-teal/30 bg-gradient-to-l from-panel to-card transition hover:border-teal/60 hover:shadow-[0_30px_80px_-40px_rgba(56,167,180,0.5)] md:grid-cols-5"
            >
              <div className="relative flex min-h-[104px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_30%,rgba(56,167,180,0.4),transparent_65%)] md:col-span-2 md:min-h-[190px]">
                <Route className="h-10 w-10 text-teal-light-ink/70 md:h-16 md:w-16" />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-fine font-black text-on-gold md:right-5 md:top-5 md:gap-1.5 md:px-3.5 md:py-1.5 md:text-xs">
                  <Flame className="h-3.5 w-3.5" />
                  {spotlight.note}
                </span>
              </div>
              <div className="p-5 md:col-span-3 md:p-10">
                <span className="kicker">اختيار وجيز الأول</span>
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
            <div className="scrollbar-hide -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
              {morePaths.map((b) => (
                <Card
                  key={b.id}
                  as={Link}
                  to={`/pathways/${b.id}`}
                  tone="accent"
                  interactive
                  className="flex w-[260px] shrink-0 snap-start flex-col gap-2 p-5"
                >
                  <span className="kicker text-teal-light-ink">{b.note}</span>
                  <h4 className="text-base font-black leading-snug">{b.p.name}</h4>
                  <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">{b.p.transformation}</p>
                  <span className="mt-auto pt-2 text-fine text-muted-foreground">{pathwaySizeAr(b.p)}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {moreCourses.length > 0 && (
          <div className="reveal mt-10">
            <h3 className="text-lg font-bold md:text-xl">ودوراتٌ مفردة</h3>
            <div className="scrollbar-hide -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
              {moreCourses.map((b) => (
                <Card
                  key={b.id}
                  as={Link}
                  to={`/courses/${b.id}`}
                  interactive
                  className="flex w-[240px] shrink-0 snap-start flex-col gap-2 p-5"
                >
                  <span className="kicker text-gold-ink">{b.note}</span>
                  <CourseTitle as="h4" name={b.c.name} termEn={b.c.termEn} className="text-base font-black leading-snug" />
                  <span className="mt-auto pt-2 text-fine text-muted-foreground">{b.c.weeks} أسابيع</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* البابان — إلى الكتالوج كاملا */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/pathways"
            className={`${DOOR} border-teal/40 text-teal-light-ink hover:bg-teal-deep hover:text-white`}
          >
            تصفح كل المسارات
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link
            to="/courses"
            className={`${DOOR} border-white/15 text-muted-foreground hover:border-gold/50 hover:text-gold-ink`}
          >
            تصفح كل الدورات
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
