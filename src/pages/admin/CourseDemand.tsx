/* الطلبُ على الدورات بلا شعبة — لأيّها يُبحث عن مدرّبٍ أوّلا (١٢ أكتوبر ٢٠٢٦).

   منذ لا يُعرض للعموم إلّا ما اعتُمدت خطّةُ مدرّبه، صارت أكثرُ الدورات بلا شعبة —
   وسؤالُ صاحب المنصّة: من أين أبدأ؟ والجوابُ ممّن ينتظر: متعلّمٌ في خطّته لم يشترها،
   وزائرٌ ترك بريدَه لها في صفحتها. فالأكثرُ انتظارا أوّلا، ومعه ما يقف بينه وبين
   شعبةٍ تُباع: بلا مدرّب، أو مدرّبٌ يجهّزها، أو خطّةٌ تنتظر اعتمادك، أو معتمدةٌ تنتظر فتحك.

   والحسابُ في الخادم (`CourseInterestService.demand`). وهذه تعرضه ولا تكتب شيئا.

   ═══ ولا تظهر حين لا ينتظر أحدٌ حقيقيّ (١٧ أكتوبر ٢٠٢٦) ═══

   «اخفي هذه القائمة اذا كان الطلب من حساب تجريبي» (صاحب المنصّة). فطلبُ حساب التجربة لا يُعدّ
   (`test-account.ts`)، وما لم يبقَ فيه طلبٌ لا تُعرض له لوحةٌ تقول «لا أحد».

   ═══ ومن هم — وبجانب كلٍّ «حساب تجريبي» (١٨ أكتوبر ٢٠٢٦) ═══

   بقيت القائمةُ: حسابُ التجربة متعلّمٌ لا يُعرف من نفسه، ولا يُعرف أيُّ حسابٍ هو. فاختار صاحبُ المنصّة
   «Show who is waiting»: من في خططهم بأسمائهم مرّةً لكلٍّ، وبجانبه زرٌّ يُخرجه من العدّ — ثمّ تُقرأ القائمةُ
   ثانيةً، فإن لم يبقَ فيها أحدٌ غابت. والأسماءُ من الخادم لمن يرى الحسابات، والزرُّ لمن يديرها. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { FlaskConical, Loader2, Users } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { toast, toastError } from "@/components/Toast";
import { useRealSession } from "@/services/session";
import { countAr } from "@/application/text/count-ar";

type DemandState = "no_trainer" | "trainer_preparing" | "plan_submitted" | "approved_draft";

interface DemandRow {
  courseId: string;
  titleAr: string;
  planWaiting: number;
  visitorWaiting: number;
  total: number;
  state: DemandState;
}

/** من ينتظر في خطّته — كما يردّه `CourseInterestService.demand` لمن يرى الحسابات */
interface DemandLearner {
  id: string;
  nameAr: string;
  email: string;
  courses: number;
}

/** «دورة واحدة» و«دورتان» بلا رقمهما */
function coursesAr(n: number): string {
  if (n === 1) return "دورة واحدة";
  if (n === 2) return "دورتين";
  return countAr(n, { one: "دورة", two: "دورتين", few: "دورات", many: "دورة" });
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
  const [learners, setLearners] = useState<DemandLearner[]>([]);
  const { user: viewer } = useRealSession();
  const canMark = viewer?.permissions.includes("admin.users.manage") ?? false;
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => apiGet<{ rows: DemandRow[]; learners?: DemandLearner[] }>("/api/admin/course-demand")
    .then((r) => { setRows(r.rows); setLearners(r.learners ?? []); })
    .catch(() => setError(true)), []);
  useEffect(() => { void load(); }, [load]);

  /* «حساب تجريبي» من هنا — المسارُ نفسُه الذي في «المستخدمون والأدوار» (`admin-users.routes.ts`) */
  const markTest = async (l: DemandLearner) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/admin/users/${l.id}/test-account`, { value: true });
      toast(`صار «${l.nameAr}» حسابا تجريبيا، ولا يعد طلبه.`);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  if (error || rows?.length === 0) return null;

  const shown = rows ? (all ? rows : rows.slice(0, SHOWN)) : [];
  return (
    <Panel as="section" className="mb-6">
      <h2 className="flex items-center gap-2 text-sm font-black">
        <Users className="h-4 w-4 text-teal" /> من ينتظر دورة بلا شعبة
      </h2>
      <p className="mt-1 max-w-3xl text-read leading-6 text-muted-foreground">
        كم ينتظر كل دورة لا شعبة تباع لها — في خطّته أو ببريده، دون الحسابات التجريبية. ابدأ البحث عن مدرّب من الأعلى.
      </p>

      {learners.length > 0 && (
        <details className="mt-3" open={learners.length <= 3}>
          <summary className="cursor-pointer text-read font-bold text-teal-light-ink">من في خططهم؟ ({learners.length})</summary>
          <ul className="mt-2 space-y-2">
            {learners.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <b className="text-read">{l.nameAr}</b>
                <span dir="ltr" className="text-fine text-muted-foreground">{l.email}</span>
                <span className="text-read text-muted-foreground">ينتظر {coursesAr(l.courses)}</span>
                {canMark && (
                  <Button size="sm" tone="secondary" icon={FlaskConical} disabled={busy} onClick={() => void markTest(l)}>
                    حساب تجريبي
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canMark && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              «حساب تجريبي» يخرج طلبه من هذا العد، ولا يغير دخوله ولا ما يملك. وترجعه من «المستخدمون والأدوار».
            </p>
          )}
        </details>
      )}

      {!rows ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground/50" />
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
