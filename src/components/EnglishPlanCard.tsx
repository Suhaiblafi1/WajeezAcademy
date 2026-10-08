/* خطّةُ الإنجليزيّة بخياريها — الفرقُ والكلفةُ، والاختيارُ للمتعلّم.

   قرارُ صاحب المنصّة (٨ أكتوبر ٢٠٢٦) للمبتدئ الذي يريد الإنجليزيّةَ للعمل أو
   للاختبار: «اعرض الخيارين جنبا إلى جنب، ما الفرقُ وكم كلفةُ كلٍّ منهما، ويختار
   هو». وللمتقدّم فوق دوراتنا العامّة: يُقال ذلك، ويُعرض ما يضيف إليه.

   والسعرُ من شعبةٍ حقيقيّةٍ لا من تقدير: أقربُ شعبةٍ مفتوحةٍ لكلّ دورة، وما لا
   شعبةَ له يُقال «مع الشعبة» — والمجموعُ لا يُجمَع من عملتين. */

import { Link } from "react-router";
import { BookOpen, CheckCircle2, ClipboardCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Surface";
import LevelLine from "@/components/LevelLine";
import { courseById } from "@/data/courses";
import { useCourseCohorts } from "@/services/cohort-prices";
import type { EnglishPlanView } from "@/application/diagnostic/landing";
import type { LevelSummary } from "@/application/diagnostic/level-summary";
import { ENGLISH_LEVELS, type EnglishLevel } from "@/domain/diagnostic/v2_1/english";
import { placementHref } from "@/application/placement/links";
import { usePlacementOpen } from "@/services/placement";

function costOf(courseIds: string[], cohorts: ReturnType<typeof useCourseCohorts>["cohorts"]): string {
  const firsts = courseIds.map((id) => cohorts.get(id)?.[0]);
  if (firsts.some((c) => !c)) return "مع الشعبة";
  const currency = firsts[0]!.currency;
  if (firsts.some((c) => c!.currency !== currency)) return "مع الشعبة";
  const total = firsts.reduce((s, c) => s + c!.amount, 0);
  return `${total} ${currency}`;
}

/* بابُ الاختبار: «قريبا» ما دام قيد المراجعة، ورابطٌ إليه حين يُفتح. وهو خيارٌ لا
   شرط — والتسجيلُ بالمستوى الموصوف قائمٌ بجانبه (قرارُ صاحب المنصّة: اختياريّ). */
export function PlacementPanel({ note, stated, className = "mt-6" }: { note: string; stated: EnglishLevel | null; className?: string }) {
  const open = usePlacementOpen();
  return (
    <Panel tone="accent" className={className}>
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
        {open ? "اختبارُ تحديد المستوى المجانيّ" : "اختبارُ تحديد المستوى المجانيّ — قريبا"}
      </p>
      <p className="mt-2 text-read leading-relaxed text-muted-foreground">{note}</p>
      {open && (
        <>
          <p className="mt-2 text-read leading-relaxed text-muted-foreground">
            لك أن تختبر الآن (ربعُ ساعةٍ تقريبا) فنقابل ما وصفتَه بما يقيسه، أو أن تمضي بمستواك الموصوف — والقرارُ بعد النتيجة لك.
          </p>
          <Button as={Link} to={placementHref(stated)} tone="secondary" size="sm" className="mt-3">ابدأ الاختبار المجانيّ</Button>
        </>
      )}
    </Panel>
  );
}

export default function EnglishPlanCard({ plan, level }: { plan: EnglishPlanView; level: LevelSummary | null }) {
  const { cohorts, loaded } = useCourseCohorts();
  const stated = (ENGLISH_LEVELS.find((l) => l.cefr === plan.cefr)?.code ?? null);
  return (
    <section className="story-fade mx-auto max-w-2xl px-5 py-12 md:py-16">
      <h2 className="text-2xl font-black leading-snug md:text-3xl">خطّتك في الإنجليزيّة</h2>
      <p className="mt-3 leading-loose text-foreground">{plan.headline_ar}</p>

      {level && <LevelLine summary={level} className="mt-6" />}

      <PlacementPanel note={plan.placement_note_ar} stated={stated} />

      <ul className="mt-8 flex flex-col gap-4">
        {plan.options.map((o) => (
          <li key={o.course_ids.join("+")}>
            <Card className="md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-black text-foreground">{o.title_ar}</h3>
                {o.suggested && plan.options.length > 1 && (
                  <span className="rounded-full bg-teal/15 px-3 py-1 text-fine font-bold text-teal-light-ink">الأنسبُ لمستواك</span>
                )}
              </div>
              <ol className="mt-3 flex flex-col gap-1.5">
                {o.course_ids.map((id, i) => (
                  <li key={id} className="flex items-start gap-2 text-sm text-foreground">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {o.course_ids.length > 1 ? `${i + 1}. ` : ""}{courseById(id)?.name ?? id}
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex items-start gap-2 text-read leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                {o.difference_ar}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-black text-foreground">
                  {o.course_ids.length > 1 ? "كلفةُ الدورتين: " : "الكلفة: "}
                  <span dir="ltr">{loaded ? costOf(o.course_ids, cohorts) : "…"}</span>
                </span>
                <Button as={Link} to={`/build/${o.course_ids[0]}`} tone={o.suggested ? "primary" : "secondary"}>
                  {o.course_ids.length > 1 ? "ابدأ بالدورة الأولى" : "افتح الدورة"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
