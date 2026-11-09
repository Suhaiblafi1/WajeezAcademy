/* لمن هذه الدورة — وصفُها، ثمّ من اختارهم مدرّبو شعبها: «تناسبك إن كنت» و«وتريد» (`course-audience.ts`).
   كان في صفحة الدورة وحدَها (`CoursePath`). ثمّ قرّر صاحبُ المنصّة (٨ نوفمبر ٢٠٢٦) أن يكون في «كل تفاصيل الدورة» من صفحات
   المسار أيضا — فما تعرضه صفحةُ الدورة تعرضه بطاقةُ المسار، من موضعٍ واحدٍ لا نسختين. */
import { useEffect, useState } from "react";
import { Flag, Sparkles, User } from "lucide-react";
import type { CohortAudienceSource, CourseAudienceSource, CourseAudienceView } from "@/application/catalog/course-audience";

export default function CourseAudience({ who }: { who: CourseAudienceView }) {
  if (!who.lead && who.stages.length === 0 && who.goals.length === 0) return null;
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-read font-black text-foreground">
        <User className="h-3.5 w-3.5 text-teal-light-ink" /> لمن هذه الدورة
      </h3>
      {/* بهيئة سطور «ما ستقدر عليه بعدها» جارِه: لا صندوقَ ولا عريض (صاحب المنصّة، ٢٠ أكتوبر ٢٠٢٦) */}
      {who.lead && <p className="mt-1.5 text-read leading-relaxed text-foreground">{who.lead}</p>}
      {who.stages.length > 0 && (
        <div className="mt-3">
          <p className="text-read font-bold text-muted-foreground">تناسبك إن كنت</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {who.stages.map((st) => (
              <li key={st} className="rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-fine font-bold text-teal-light-ink">
                {st}
              </li>
            ))}
          </ul>
        </div>
      )}
      {who.goals.length > 0 && (
        <div className="mt-3">
          <p className="text-read font-bold text-muted-foreground">وتريد</p>
          <ul className="mt-1.5 space-y-1">
            {who.goals.map((g) => (
              <li key={g} className="flex items-start gap-1.5 text-read leading-relaxed text-foreground">
                <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* «من اختيار المدرّب» حين اختاره مدرّبٌ حقّا — ووسومُ الكتالوج بلا هذا السطر */}
      {who.fromCohorts > 0 && (who.stages.length > 0 || who.goals.length > 0) && (
        <p className="mt-2 flex items-center gap-1 text-read text-muted-foreground">
          <Sparkles className="h-3 w-3 text-gold-ink" />
          {who.fromCohorts > 1 ? "من اختيار مدرّبي شعبها" : "من اختيار مدرّب الشعبة"}
        </p>
      )}
    </div>
  );
}

/* ═══ وفي صفحات المسار تُحمَّل حين تُفتح التفاصيل لا مع الصفحة (٨ نوفمبر ٢٠٢٦) ═══
   `course-audience.ts` يقرأ كتالوجَ التشخيص كلَّه (نحو ١٠٠ ك.ب مضغوطة) — ولذلك تحمّله صفحةُ الدورة بعد الرسم (#883). وقالبُ
   المسار (`CourseJourney`) يُفتح في ‎/go وصفحات المسار ونتيجة التشخيص، وشكا صاحبُ المنصّة من بطئها. فهذا لا يُستورد إلّا داخل
   «كل تفاصيل الدورة» المفتوحة: صندوقُها يُركَّب حين يُفتح، فيُطلب الملفُّ حينئذٍ ويظهر القسمُ متى وصل. */
export function LazyCourseAudience({ course, cohorts }: { course: CourseAudienceSource; cohorts: readonly CohortAudienceSource[] }) {
  const [mod, setMod] = useState<typeof import("@/application/catalog/course-audience") | null>(null);
  useEffect(() => {
    let on = true;
    void import("@/application/catalog/course-audience").then((m) => { if (on) setMod(m); }).catch(() => undefined);
    return () => { on = false; };
  }, []);
  return mod ? <CourseAudience who={mod.courseAudienceView(course, cohorts)} /> : null;
}
