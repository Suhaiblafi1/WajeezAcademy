import { Route as RouteIcon, CheckCircle2, ArrowUpRight } from "lucide-react";
import { skillNamesAr } from "@/domain/diagnostic/catalog";
import { useCoursePrices, cheapestOf, pricedCount, formatCohortPrice } from "@/services/cohort-prices";

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
  /** «هدفك» أو «فجوة قِسناها» أو «دعم» — يُعرض وسمًا فوق كل مقرر */
  role?: "goal" | "gap" | "support";
  levelMatch: number;
}
export interface ComposedPathView {
  courses: ComposedCourseView[];
  totalHours: number;
  coveredGaps: string[];
  uncoveredGaps: string[];
  matchesPathwayId: string | null;
  /** مقررات لم يتّسع لها حجم الخطة — تُعرض «لمرحلة لاحقة» لا تختفي */
  deferred?: ComposedCourseView[];
  reasons_ar: string[];
}

/* لماذا وسمٌ لكل مقرر: المتعلم يسأل عن كل سطر «ولمَ هذا؟». والجواب كان مبعثرا
   بين لون رقم وشارة «من خارج مسارك». الدور يجيب في كلمتين قبل أن يقرأ التفصيل:
   هذا لهدفك، وهذا لفجوة قِسناها، وهذا يدعم الخطة. */
const ROLE_AR: Record<NonNullable<ComposedCourseView["role"]>, { label: string; cls: string }> = {
  goal: { label: "لهدفك", cls: "bg-teal/20 text-teal-light-ink" },
  gap: { label: "لفجوة قِسناها", cls: "bg-gold/15 text-gold-ink" },
  support: { label: "يدعم خطتك", cls: "bg-white/[0.06] text-muted-foreground" },
};

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

/* سعر الخطة من **شعبةٍ حقيقية** لا من تقدير. كان يُحسب بـ
   `pathwayPriceFor(العدد)` و`coursePriceOf(العنوان)`، والفاتورة تُصدر بسعر
   الشعبة وبعملتها — فالوعد غير المطالبة. وحين لا شعبة مسعَّرة: لا رقم. */
function PlanPrice({ courseIds }: { courseIds: string[] }) {
  const { prices, loaded } = useCoursePrices();
  const cheapest = cheapestOf(courseIds, prices);
  const known = pricedCount(courseIds, prices);
  if (courseIds.length === 0) return null;
  if (!cheapest) {
    return (
      <p className="mt-2 text-fine leading-6 text-muted-foreground">
        {loaded ? "يُعلن سعر دورات هذه الخطة مع فتح شعبها. والدفع لا يُطلب الآن." : "يُقرأ السعر…"}
      </p>
    );
  }
  return (
    <p className="mt-2 text-fine leading-6 text-muted-foreground">
      <span className="font-bold text-foreground">
        تبدأ من <span dir="ltr">{formatCohortPrice(cheapest)}</span> للدورة
      </span>
      {" — وخصمٌ كبير على الخطة كاملة مقابل شرائها دورةً دورة."}
      {known < courseIds.length && " وبعض دوراتها لم تُفتح لها شعبة بعد."}
      {" والدفع لا يُطلب الآن."}
    </p>
  );
}

/* البطاقة لها موضعان:
   ١) بطاقة مستقلة أسفل الخطة، حين تضيف مقررات لا تحويها الخطة المعروضة — فتسرد
      دوراتها لأنها هي التي تعرّف بها.
   ٢) رأس التوصية حين تكون خطة المقررات هي الأولى — وحينها الدورات نفسها تُسرد
      بعدها مباشرة في «ماذا ستحقق من خلال خطتك؟» بتفصيل أوفى وبأداة استبدال.
      فسردها هنا يجعل المتعلم يقرأ ست بطاقات ثم يقرأ الستّ نفسها. لذا `courseList`.
*/
export default function ComposedPlanCard({ plan, courseList = true }: { plan: ComposedPathView; courseList?: boolean }) {
  if (!plan || plan.courses.length === 0) return null;
  const covered = plan.coveredGaps.length;

  return (
    <section className="mt-8 rounded-3xl border border-teal/30 bg-teal/[0.04] p-5 md:p-7" aria-labelledby="cpc-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cpc-title" className="flex items-center gap-2 text-lg font-black md:text-xl">
          <RouteIcon className="h-5 w-5 text-teal-light-ink" />
          خطتك مرتَّبة على مقاسك
        </h2>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-fine font-bold text-muted-foreground" dir="ltr">
          {plan.courses.length} دورات · {plan.totalHours} ساعة
        </span>
      </div>

      {/* السعر بنفس قاعدة المسار الجاهز: العدد هو ما يحدده. وخطة مركّبة بلا سعر
          تترك القارئ يظن أن رقما سيفاجئه — وقد رُصد ذلك في مراجعة التجربة. */}
      <div>
        <PlanPrice courseIds={plan.courses.map((c) => c.courseId)} />
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        {plan.matchesPathwayId
          ? "هذه الدورات تُشكّل مسارا كاملا في الأكاديمية، فتأخذ شهادته كما هي."
          : "رتّبناها لك من أكثر من مسار — لأن فجواتك لا يغطيها مسار واحد جاهز."}
        {covered > 0 && <> وتغطي <b className="text-teal-light-ink">{covered}</b> من الجوانب التي قلت إنك دونها.</>}
      </p>

      {!courseList && (
        <p className="mt-3 text-fine leading-relaxed text-muted-foreground">
          وتفصيل كل دورة — ما تخرج به منها ولماذا هي فيها — أدناه، ولك أن تستبدل أيّها شئت.
        </p>
      )}

      {courseList && (
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
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-black leading-snug md:text-[15px]">
                  {c.title_ar}
                  {c.role && (
                    <span className={`rounded-md px-1.5 py-0.5 text-fine font-black ${ROLE_AR[c.role].cls}`}>
                      {ROLE_AR[c.role].label}
                    </span>
                  )}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-fine text-muted-foreground">
                  <span>{LEVEL_AR[c.level] ?? c.level}</span>
                  <span dir="ltr">{c.hours} ساعة</span>
                  <span>{levelNote(c.levelMatch)}</span>
                  {!c.onAnchor && (
                    <span className="rounded-md bg-gold/10 px-1.5 py-0.5 font-bold text-gold-ink">
                      من خارج مسارك — أضفناها لفجوة مهمة
                    </span>
                  )}
                </div>
                {/* تُسمّى الجوانب لا تُعدّ: «تسدّ ٤ من الجوانب» كانت تتكرر بنصّها
                    تحت كل دورة، فلا تقول للقارئ لماذا هذه بالذات.
                    والشرط على الأسماء المعروفة لا على عدد الرموز: رمز بلا اسم
                    عربي يُسقَط، فسطر «تسدّ ما قلت إنك دونه في:» بلا شيء بعده
                    أسوأ من غيابه. */}
                {(() => {
                  const named = skillNamesAr(c.closesGaps);
                  if (named.length === 0) return null;
                  return (
                    <p className="mt-1.5 flex items-start gap-1.5 text-fine leading-relaxed text-teal-light-ink">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        تسدّ ما قلت إنك دونه في: {named.slice(0, 3).join("، ")}
                        {named.length > 3 && <> وغيرها</>}
                      </span>
                    </p>
                  );
                })()}
              </div>
            </div>
          </li>
        ))}
      </ol>
      )}

      {/* المؤجَّل يُسمّى لا يُلمَّح إليه. «تبقى ٣ جوانب خارج الخطة» جملةٌ تقول
          إن شيئا نقص ولا تقول ما هو — فيظن المتعلم أن ما رآه كل ما يخصه، أو
          يظن أننا أخفينا الأفضل. هنا المقرران التاليان باسميهما، ومكانهما
          صريح: مرحلة تالية لا هذه. */}
      {courseList && (plan.deferred?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-3.5 md:p-4">
          <p className="text-fine font-black text-muted-foreground">وهذان لمرحلتك التالية — لا لهذه الخطة</p>
          <p className="mt-1 text-fine leading-relaxed text-muted-foreground">
            يناسبانك أيضا، لكن حشرهما هنا يطيل الخطة ويضعف إنهاءها. نعرضهما كي تعرف ما ينتظرك لا كي تشتريه الآن.
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {plan.deferred!.map((d) => (
              <li key={d.courseId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-fine text-muted-foreground">
                <span className="font-bold text-foreground">{d.title_ar}</span>
                <span className="text-muted-foreground" dir="ltr">{d.hours} ساعة</span>
                {d.role && (
                  <span className={`rounded-md px-1.5 py-0.5 text-fine font-black ${ROLE_AR[d.role].cls}`}>
                    {ROLE_AR[d.role].label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.uncoveredGaps.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-fine leading-relaxed text-muted-foreground">
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>
            وتبقى <b className="text-foreground">{plan.uncoveredGaps.length}</b> جوانب خارج هذه الخطة — لا نخفيها عنك:
            تُعالَج في مرحلة تالية أو مع مستشارك، فحشرها هنا يطيل الخطة ويشتّتها.
          </span>
        </p>
      )}
    </section>
  );
}
