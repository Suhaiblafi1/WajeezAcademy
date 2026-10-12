/* الطلبُ على الدورات بلا شعبة — لأيّها يُبحث عن مدرّبٍ أوّلا (١٢ أكتوبر ٢٠٢٦).

   منذ لا يُعرض للعموم إلّا ما اعتُمدت خطّةُ مدرّبه، صارت أكثرُ الدورات بلا شعبة —
   وسؤالُ صاحب المنصّة: من أين أبدأ؟ والجوابُ ممّن ينتظر: متعلّمٌ في خطّته لم يشترها،
   وزائرٌ ترك بريدَه لها في صفحتها. فالأكثرُ انتظارا أوّلا، ومعه ما يقف بينه وبين
   شعبةٍ تُباع: بلا مدرّب، أو مدرّبٌ يجهّزها، أو خطّةٌ تنتظر اعتمادك، أو معتمدةٌ تنتظر فتحك.

   والحسابُ في الخادم (`CourseInterestService.demand`). وهذه تعرضه ولا تكتب شيئا. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader2, Users } from "lucide-react";
import { apiGet } from "@/services/api";
import { Inset, Panel } from "@/components/ui/Surface";

type DemandState = "no_trainer" | "trainer_preparing" | "plan_submitted" | "approved_draft";

interface DemandRow {
  courseId: string;
  titleAr: string;
  planWaiting: number;
  visitorWaiting: number;
  total: number;
  state: DemandState;
}

/** ما يقف بين الدورة وشعبةٍ تُباع — بكلمة صاحب القرار */
const STATE_AR: Record<DemandState, { label: string; cls: string }> = {
  no_trainer: { label: "بلا مدرّب", cls: "border-gold/50 text-gold-ink" },
  trainer_preparing: { label: "مدرّب يجهّزها", cls: "border-white/20 text-muted-foreground" },
  plan_submitted: { label: "خطّة تنتظر اعتمادك", cls: "border-teal/50 text-teal-light-ink" },
  approved_draft: { label: "معتمدة — تنتظر فتحك", cls: "border-teal/60 text-teal-light-ink" },
};

/** كم يُعرض قبل «عرض الكل» — الأعلى طلبا هو ما يُقرأ */
const SHOWN = 8;

export default function CourseDemand() {
  const [rows, setRows] = useState<DemandRow[] | null>(null);
  const [all, setAll] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiGet<{ rows: DemandRow[] }>("/api/admin/course-demand")
      .then((r) => setRows(r.rows))
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  const shown = rows ? (all ? rows : rows.slice(0, SHOWN)) : [];
  return (
    <Panel as="section" className="mb-6">
      <h2 className="flex items-center gap-2 text-sm font-black">
        <Users className="h-4 w-4 text-teal" /> من ينتظر دورة بلا شعبة
      </h2>
      <p className="mt-1 max-w-3xl text-read leading-6 text-muted-foreground">
        كم ينتظر كل دورة لا شعبة تباع لها — في خطّته أو ببريده. ابدأ البحث عن مدرّب من الأعلى.
      </p>

      {!rows ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground/50" />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-read text-muted-foreground">لا أحد ينتظر دورة بلا شعبة الآن.</p>
      ) : (
        <>
          <Inset as="ul" className="mt-3 divide-y divide-white/8 overflow-hidden p-0">
            {shown.map((r) => {
              const st = STATE_AR[r.state];
              return (
                <li key={r.courseId} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{r.titleAr}</span>
                    <span className="text-read text-muted-foreground">
                      في خططهم <b className="tabular-nums text-foreground">{r.planWaiting}</b>
                      {" · "}ببريدهم <b className="tabular-nums text-foreground">{r.visitorWaiting}</b>
                    </span>
                  </span>
                  <span className="text-lg font-black tabular-nums" aria-label={`ينتظرها ${r.total}`}>{r.total}</span>
                  {r.state === "plan_submitted" ? (
                    <Link to="/admin/pending-plans" className={`rounded-full border px-3 py-1 text-fine font-bold hover:bg-white/5 ${st.cls}`}>
                      {st.label}
                    </Link>
                  ) : (
                    <span className={`rounded-full border px-3 py-1 text-fine font-bold ${st.cls}`}>{st.label}</span>
                  )}
                </li>
              );
            })}
          </Inset>
          {rows.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="mt-2 text-read font-bold text-teal-light-ink hover:underline"
            >
              {all ? "اعرض الأعلى فقط" : `اعرض الكل (${rows.length})`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
