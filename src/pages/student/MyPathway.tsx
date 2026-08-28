/* «مساري» — من التسجيلات الحقيقية وحدها.
   ------------------------------------------------------------------
   كانت هذه الصفحة تختار مسارا من localStorage (`getEnrollment`) أو أوّل مسار
   فيه أربع دورات، ثم تبني حالته من متجرٍ محليّ يبذر تقدّما ومشروعَ تخرّجٍ
   وشروطَ فتحٍ لا وجود لها. فتعرض خمس دورات «متاحة» لمن لا شعبة له — وهو
   التناقضُ الذي رآه صاحب المنتج بين اللوحة وهذه الصفحة.
   المصدر الآن واحد: /api/learner/my-learning. ولا شيء يُعرض بلا تسجيل. */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, BookOpen, ChevronLeft, RefreshCcw } from "lucide-react";
import PortalLayout from "./PortalLayout";
import PathwayMap from "@/components/PathwayMap";
import AdvisorContact from "@/components/AdvisorContact";
import { usePublishedContent } from "@/services/public-content";
import { buildPathwayMap, enrollmentFactsFromApi } from "@/application/student/pathway-map";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";
import { pathwayById, pathways } from "@/data/pathways";
import { courseById, pathwayCourses } from "@/data/courses";

/** صفٌّ من /api/learner/my-learning — ما نحتاجه منه هنا فقط */
interface Row {
  id: string;
  status: string;
  cohort: { title: string; course: { id: string } | null } | null;
  courseProgress: { percent: number } | null;
  certificates?: unknown[];
}

export default function MyPathway() {
  const catalogVersion = usePublishedContent();
  const { user: sessionUser } = useRealSession();
  const [fetched, setFetched] = useState<Row[] | null>(null);
  /* بلا جلسة لا نداء ولا تصفير حالة داخل تأثير (react-hooks/set-state-in-effect):
     النتيجة تُعطف أثناء التصيير — زائرٌ بلا جلسة صفوفُه فارغة قطعا. */
  const rows = sessionUser ? fetched : [];

  useEffect(() => {
    if (!sessionUser) return;
    let on = true;
    apiGet<Row[]>("/api/learner/my-learning")
      .then((r) => { if (on) setFetched(r); })
      .catch(() => { if (on) setFetched([]); });
    return () => { on = false; };
  }, [sessionUser]);

  if (rows === null || pathways.length === 0) {
    return (
      <PortalLayout title="مساري">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>
      </PortalLayout>
    );
  }
  if (rows.length === 0) return <NoPathway />;
  return <PathwayBody key={catalogVersion} rows={rows} />;
}

function NoPathway() {
  return (
    <PortalLayout title="مساري">
      <section className="grid place-items-center rounded-3xl border border-teal/30 bg-gradient-to-b from-teal/10 to-transparent py-16 text-center">
        <BookOpen className="h-12 w-12 text-teal-light-ink" />
        <h2 className="mt-5 text-2xl font-black">لا مسار لك بعد</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-white/60">
          مسارك يُبنى حين تُفتح أول شعبة لك. تصفح الشعب المفتوحة واطلب التسجيل،
          أو ابدأ بالتشخيص ليُقترح عليك مسار يناسب هدفك.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/student/cohorts" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            تصفح الشعب المفتوحة
          </Link>
          <Link to="/diagnostic" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
            ابدأ التشخيص
          </Link>
        </div>
      </section>
    </PortalLayout>
  );
}

/** المسار يُستنتج من دورات التسجيل نفسها: أكثر مسارٍ يحتويها */
function pathwayOf(courseIds: string[]): string | null {
  let best: { id: string; hits: number } | null = null;
  for (const p of pathways) {
    const ids = new Set(pathwayCourses[p.id] ?? []);
    const hits = courseIds.filter((c) => ids.has(c)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { id: p.id, hits };
  }
  return best?.id ?? null;
}

function PathwayBody({ rows }: { rows: Row[] }) {
  const enrolledCourseIds = rows.map((r) => r.cohort?.course?.id).filter((x): x is string => typeof x === "string");
  const pathwayId = pathwayOf(enrolledCourseIds);
  const pathway = pathwayId ? pathwayById(pathwayId) : null;
  const facts = enrollmentFactsFromApi(rows);
  const map = pathwayId ? buildPathwayMap(pathwayId, facts) : null;
  const factOf = new Map(facts.map((f) => [f.courseId, f]));
  const ids = pathwayId ? (pathwayCourses[pathwayId] ?? []) : enrolledCourseIds;
  const reviewMsg = `مرحبا، أنا طالب${pathway ? ` مسار «${pathway.name}»` : ""} وأريد مراجعة مساري (تبديل/إضافة دورة).`;

  return (
    <PortalLayout title={pathway ? `مساري — ${pathway.name}` : "مساري"}>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black">
              {pathway ? "ماذا ستتقن في نهاية هذا المسار؟" : "دوراتك المسجَّلة"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-white/60">
              {pathway?.output ?? "شعبك الحالية لا تنتمي إلى مسار جاهز واحد — وهذه دوراتها."}
            </p>
          </div>
          <AdvisorContact
            text={reviewMsg}
            label="مراجعة مساري"
            icon={<RefreshCcw className="h-4 w-4" />}
            className="flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
          />
        </div>
        <p className="mt-3 text-[11px] text-white/55">
          التبديل لا يتم عشوائيا — تطلب مراجعة مع مستشارك يفحص الأهلية والتكافؤ ثم يُنفذ بأثر موثق.
        </p>
      </section>

      {map && <PathwayMap map={map} className="mt-6" />}

      <section className="mt-6 space-y-3">
        {ids.map((id, i) => {
          const c = courseById(id);
          if (!c) return null;
          const f = factOf.get(id);
          const enrolled = !!f?.enrolled;
          const pct = f?.percent ?? null;
          const done = !!f?.completed;
          return (
            <div
              key={id}
              className={`flex flex-wrap items-center gap-4 rounded-3xl border p-5 ${
                done ? "border-teal/60 bg-white/[0.03]" : enrolled ? "border-teal/40 bg-white/[0.03]" : "border-white/10 bg-white/[0.01]"
              }`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black ${done ? "bg-teal text-on-teal" : "bg-white/5"}`}>
                {done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-black ${enrolled ? "" : "text-white/50"}`}>{c.name}</p>
                <p className="mt-0.5 text-xs text-white/45">{c.skill}</p>
                {enrolled && pct !== null && pct > 0 && pct < 100 && (
                  <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                  done ? "border-teal/60 text-teal-ink" : enrolled ? "border-teal/40 text-teal-light-ink" : "border-white/15 text-white/50"
                }`}>
                  {done ? "مكتملة" : enrolled ? "مسجَّل" : "غير مسجَّل"}
                </span>
                {enrolled ? (
                  <Link to="/student/learning" className="flex items-center gap-1 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light">
                    افتح في تعلّمي <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link to="/student/cohorts" className="text-[11px] font-bold text-teal-light-ink hover:text-white">
                    اطلب شعبة
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </PortalLayout>
  );
}
