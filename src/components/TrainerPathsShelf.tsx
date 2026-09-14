/* رفُّ «مسارات أعدّها مدرّبونا المعتمدون» — قسمٌ في صفحة المسارات (ن-١).

   ═══ ولمَ يُقرأ حيًّا والصفحةُ تقرأ لقطةً ═══

   بقيّةُ الصفحة تُبنى من الكتالوج المضمَّن — لقطةٌ تُبنى وقتَ النشر. وهذا
   القسمُ لا يصلح فيه ذلك: ن-٤ يشترط أن يُغلق المسارُ للتسجيل **في اللحظة**
   حين يُوقَف صاحبُه، ولقطةٌ لا تعرف الإيقافَ حتّى تُعاد. فالقراءةُ حيّةٌ من
   `/api/public/trainer-paths`، والترشيحُ هناك.

   ═══ وقسمٌ مستقلٌّ بقصد ═══

   ن-٥: هذه ليست من مسارات التشخيص ولا تزاحمها. وعنوانُها يقول ذلك للزائر
   قبل أن يقرأ بطاقةً: **من أعدّها إنسانٌ يُسمّى**، لا خوارزميّةُ قياس. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Route, UserRound } from "lucide-react";
import { apiGet } from "@/services/api";
import { Card, Inset } from "@/components/ui/Surface";
import { fmtDateLong } from "@/application/text/format-ar";

interface ShelfPath {
  id: string;
  slug: string | null;
  titleAr: string;
  blurbAr: string | null;
  trainerName: string;
  trainerHeadline: string | null;
  trainerSlug: string | null;
  term: {
    titleAr: string;
    season: string;
    year: number;
    startsOn: string;
    registrationOpensAt: string | null;
    registrationClosesAt: string | null;
    status: string;
  } | null;
  courses: { courseId: string; titleAr: string }[];
}

/* ن-٣: البطاقةُ تقول متى يُفتح التسجيلُ **من التقويم** لا بنصٍّ مكتوب.
   ونصٌّ حرٌّ مثل «قريبا» يبلى ساعةَ يمضي الموسمُ ولا يتذكّر أحدٌ تحريرَه. */
function seasonLineAr(term: ShelfPath["term"]): string | null {
  if (!term) return null;
  const opens = term.registrationOpensAt ? new Date(term.registrationOpensAt) : null;
  if (opens && opens.getTime() > Date.now()) {
    return `${term.titleAr} — يُفتح التسجيلُ ${fmtDateLong(term.registrationOpensAt ?? "")}`;
  }
  if (term.status === "open") return `${term.titleAr} — التسجيلُ مفتوحٌ الآن`;
  return `${term.titleAr} — يبدأ ${fmtDateLong(term.startsOn)}`;
}

export default function TrainerPathsShelf() {
  const [rows, setRows] = useState<ShelfPath[] | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<ShelfPath[]>("/api/public/trainer-paths")
      .then((r) => { if (alive) setRows(r); })
      /* ورفٌّ لا يُحمَّل لا يُعطّل الصفحةَ: المساراتُ المنسَّقةُ فوقه هي المتن */
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="mt-14" aria-labelledby="trainer-paths-shelf">
      <h2 id="trainer-paths-shelf" className="flex items-center gap-2 text-xl font-black text-foreground">
        <Route className="h-5 w-5 text-teal" aria-hidden />
        مسارات أعدّها مدرّبونا المعتمدون
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
        رتّبها مدرّبٌ من دوراته التي أُهِّل لها، وتحمل اسمَه. وهي غيرُ مسارات
        «مؤشّر وجيز» — تلك يختارها القياسُ من فجوةِ مهاراتك، وهذه يعرضها صاحبُها.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {rows.map((p) => {
          const season = seasonLineAr(p.term);
          return (
            <Card key={p.id}>
              <h3 className="text-read font-black text-foreground">{p.titleAr}</h3>

              {/* اسمُ من أعدّها — وهو كلُّ الفرق بين هذا الرفّ وما فوقه */}
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4 text-teal" aria-hidden />
                {p.trainerSlug ? (
                  <Link to={`/t/${p.trainerSlug}`} className="font-bold text-teal hover:underline">
                    {p.trainerName}
                  </Link>
                ) : (
                  <span className="font-bold text-foreground">{p.trainerName}</span>
                )}
                {p.trainerHeadline ? <span className="text-muted-foreground/70">· {p.trainerHeadline}</span> : null}
              </div>

              {p.blurbAr ? (
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.blurbAr}</p>
              ) : null}

              {season ? (
                <Inset className="mt-3 text-sm font-bold text-foreground">{season}</Inset>
              ) : null}

              <ul className="mt-3 grid gap-1.5">
                {p.courses.map((c, i) => (
                  <li key={c.courseId} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="font-bold text-teal">{i + 1}.</span>
                    <Link to={`/courses?q=${encodeURIComponent(c.titleAr)}`} className="hover:text-foreground">
                      {c.titleAr}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
