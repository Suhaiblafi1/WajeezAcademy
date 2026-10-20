/* دوراتُ المنحة — في شاشة «منحة أعضاء وجيز» (٢٠ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة: «اجعل الافتراضيَّ كلَّ الدورات المفعّلة ولها مدرّبٌ ولها شعبةٌ مفتوحةٌ للفصل القادم
   القريب»، ثمّ «ألم نتّفق أن يظهر له دوراتٌ فقط» — فحُذفت «اقتراحاتُ المنحة» التي كانت هنا، وبقيت الدوراتُ
   التي يختار منها صاحبُ المنحة: بفصلها، ولكلٍّ يومُ بدئها وسعرُها وسعرُها بالمنحة **بالنسبة التي في خانة
   الإعدادات** ومقاعدُها. ولا تُعدَّل من هنا: تتحدّث وحدَها حين تُفتح شعبةٌ أو تُغلق. والعلّةُ في
   `server/services/grant-courses.service.ts`. */

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice } from "@/application/commerce/grant";
import { countAr } from "@/application/text/count-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import ListToolbar from "@/components/admin/ListToolbar";
import { Card } from "@/components/ui/Surface";

interface OpenCourse { courseId: string; courseTitleAr: string; price: number; currency: string; startsAt: string | null; seatsLeft: number | null }

/** المقاعدُ الباقيةُ بصيغة عددها — والمثنّى بلا رقم */
const seatsLeftAr = (n: number) => (n === 2 ? "بقي مقعدان" : `بقي ${countAr(n, { one: "مقعد", two: "مقعدان", few: "مقاعد", many: "مقعدا" })}`);

export default function GrantCourses({ percentOff }: { percentOff: number | null }) {
  const [open, setOpen] = useState<OpenCourse[]>([]);
  const [termAr, setTermAr] = useState<string | null>(null);
  /* دوراتُ المنحة تنمو بنموّ الكتالوج — فيُبحث فيها ويُقلَّب */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const shown = useMemo(() => paginate(open.filter((c) => matchesQuery(q, [c.courseTitleAr])), page, 25), [open, q, page]);
  useEffect(() => {
    apiGet<{ termAr: string | null; courses: OpenCourse[] }>("/api/admin/member-grant/open-courses")
      .then((r) => { setOpen(r.courses); setTermAr(r.termAr); })
      .catch(() => setOpen([]));
  }, []);

  return (
    <>
      <h2 className="mt-6 text-lg font-black">دورات المنحة ({open.length})</h2>
      <p className="mt-1 text-read text-muted-foreground">
        {termAr ? `${termAr}: ` : ""}كل دورة منشورة لها مدرب منشور وشعبة مفتوحة للتسجيل. منها يختار من يعبئ النموذج، وتتحدث وحدها حين تفتح شعبة أو تغلق.
      </p>
      <Card className="mt-3">
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={shown} placeholder="ابحث باسم الدورة" unit="دورة" />
        {shown.rows.length === 0 ? (
          <p className="text-read text-muted-foreground">{open.length === 0 ? "لا دورة متاحة الآن." : "لا دورة بهذا الاسم."}</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.rows.map((c) => (
              <li key={c.courseId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-read">
                <span className="font-bold">{c.courseTitleAr}</span>
                <span className="text-muted-foreground">
                  تبدأ {cohortDayAr(c.startsAt)}
                  {" · "}قبل المنحة <span dir="ltr">{fmtMoney(c.price, c.currency)}</span>
                  {percentOff !== null && <>{" · "}بعد المنحة <span dir="ltr" className="font-bold text-foreground">{fmtMoney(grantPrice(c.price, percentOff), c.currency)}</span></>}
                  {c.seatsLeft !== null && ` · ${seatsLeftAr(c.seatsLeft)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
