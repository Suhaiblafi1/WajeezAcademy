/* أقربُ مسارٍ جاهزٍ لهذا الموسم إلى الخطّة — كلُّ دوراته تُشترى الآن (٢ نوفمبر ٢٠٢٦، `closestReadyPathway`).
   يُعرض تحت خطّة التشخيص، في شاشة النتيجة وفي صفحة المسار التي ينتهي إليها. */

import { useMemo } from "react";
import { Link } from "react-router";
import { listedWhole } from "@/application/catalog/listed-courses";
import { closestReadyPathway } from "@/application/catalog/season-replacements";
import { courseById } from "@/data/courses";
import { pathwayDomain } from "@/data/pathways";
import { publicPathways } from "@/data/public-pathways";
import { useListedCourses } from "@/services/listed-courses";
import { Card } from "@/components/ui/Surface";

export default function ReadySeasonPathway({ courseIds, seasonTitleAr }: { courseIds: readonly string[]; seasonTitleAr: string | null }) {
  const listed = useListedCourses();
  const p = useMemo(() => {
    const domains = [...new Set(courseIds.flatMap((id) => {
      const c = courseById(id);
      return c ? [pathwayDomain(c.pathwayId)] : [];
    }))];
    return closestReadyPathway(courseIds, listedWhole(publicPathways, listed), domains);
  }, [courseIds, listed]);
  if (!p) return null;
  return (
    <Card as="section" aria-labelledby="ready-season-path" className="mt-4 px-5 py-4">
      <p id="ready-season-path" className="text-fine font-black tracking-wide text-teal-light-ink">
        مسار جاهز {seasonTitleAr ? `في ${seasonTitleAr}` : "لهذا الموسم"} يناسب نتيجتك
      </p>
      <p className="mt-1.5 text-sm font-black text-foreground">{p.name}</p>
      <p className="mt-1 text-read leading-relaxed text-muted-foreground">{p.transformation}</p>
      <p className="mt-1 text-read leading-relaxed text-muted-foreground">كل دوراته متاحة الآن، ولك أن تستبدل منها ما تريد.</p>
      <Link to={`/pathways/${p.id}`} className="mt-2 inline-block text-read font-bold text-teal-light-ink underline-offset-4 hover:underline">
        افتح المسار
      </Link>
    </Card>
  );
}
