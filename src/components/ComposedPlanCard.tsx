import { Route as RouteIcon, CheckCircle2, ArrowUpRight } from "lucide-react";

/* بطاقة الخطة المركّبة — تُعرض حين يقيّم المتعلم جوانبه.

   لماذا بطاقة مستقلة لا تعديل على CourseJourney: رحلة الدورات القائمة تخدم
   الاختيار (استبدال · هدية · حذف)، وهذه تخدم التفسير: لماذا هذه الدورة بالذات
   ولماذا بهذا الترتيب. خلطهما يفسد الاثنين. */

export interface ComposedCourseView {
  courseId: string;
  title_ar: string;
  pathwayId: string;
  hours: number;
  level: string;
  total: number;
  closesGaps: string[];
  onAnchor: boolean;
  levelMatch: number;
}
export interface ComposedPathView {
  courses: ComposedCourseView[];
  totalHours: number;
  coveredGaps: string[];
  uncoveredGaps: string[];
  matchesPathwayId: string | null;
  reasons_ar: string[];
}

const LEVEL_AR: Record<string, string> = {
  foundational: "تأسيسي",
  foundational_applied: "تأسيسي إلى تطبيقي",
  applied: "تطبيقي",
  practitioner: "ممارس",
};

/** وصف موضع المقرر من مستوى المتعلم — بلغته لا بنسبة */
function levelNote(m: number): string {
  if (m >= 0.99) return "بمستواك تماما";
  if (m >= 0.66) return "قريب من مستواك";
  return "يمتد فوق مستواك الحالي";
}

export default function ComposedPlanCard({ plan }: { plan: ComposedPathView }) {
  if (!plan || plan.courses.length === 0) return null;
  const covered = plan.coveredGaps.length;

  return (
    <section className="mt-8 rounded-3xl border border-teal/30 bg-teal/[0.04] p-5 md:p-7" aria-labelledby="cpc-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cpc-title" className="flex items-center gap-2 text-lg font-black md:text-xl">
          <RouteIcon className="h-5 w-5 text-teal-light-ink" />
          خطتك مرتَّبة على مقاسك
        </h2>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-white/60" dir="ltr">
          {plan.courses.length} دورات · {plan.totalHours} ساعة
        </span>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-white/60">
        {plan.matchesPathwayId
          ? "هذه الدورات تُشكّل مسارا كاملا في الأكاديمية، فتأخذ شهادته كما هي."
          : "رتّبناها لك من أكثر من مسار — لأن فجواتك لا يغطيها مسار واحد جاهز."}
        {covered > 0 && <> وتغطي <b className="text-teal-light-ink">{covered}</b> من الجوانب التي قلت إنك دونها.</>}
      </p>

      <ol className="mt-5 space-y-2.5">
        {plan.courses.map((c, i) => (
          <li key={c.courseId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 md:p-4">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                  c.onAnchor ? "bg-teal/15 text-teal-light-ink" : "bg-gold/15 text-gold-ink"
                }`}
                dir="ltr"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black leading-snug md:text-[15px]">{c.title_ar}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                  <span>{LEVEL_AR[c.level] ?? c.level}</span>
                  <span dir="ltr">{c.hours} ساعة</span>
                  <span>{levelNote(c.levelMatch)}</span>
                  {!c.onAnchor && (
                    <span className="rounded-md bg-gold/10 px-1.5 py-0.5 font-bold text-gold-ink">
                      من خارج مسارك — أضفناها لفجوة مهمة
                    </span>
                  )}
                </div>
                {c.closesGaps.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-teal-light-ink">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    تسدّ {c.closesGaps.length} من الجوانب التي قلت إنك دونها
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {plan.uncoveredGaps.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11.5px] leading-relaxed text-white/55">
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
          <span>
            وتبقى <b className="text-white/75">{plan.uncoveredGaps.length}</b> جوانب خارج هذه الخطة — لا نخفيها عنك:
            تُعالَج في مرحلة تالية أو مع مستشارك، فحشرها هنا يطيل الخطة ويشتّتها.
          </span>
        </p>
      )}
    </section>
  );
}
