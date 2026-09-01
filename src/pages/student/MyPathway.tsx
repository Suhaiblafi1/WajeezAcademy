/* «مساري» — من التسجيلات الحقيقية وحدها.
   ------------------------------------------------------------------
   كانت هذه الصفحة تختار مسارا من localStorage (`getEnrollment`) أو أوّل مسار
   فيه أربع دورات، ثم تبني حالته من متجرٍ محليّ يبذر تقدّما ومشروعَ تخرّجٍ
   وشروطَ فتحٍ لا وجود لها. فتعرض خمس دورات «متاحة» لمن لا شعبة له — وهو
   التناقضُ الذي رآه صاحب المنتج بين اللوحة وهذه الصفحة.
   المصدر الآن واحد: /api/learner/my-learning. ولا شيء يُعرض بلا تسجيل. */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, BookOpen, ChevronLeft, RefreshCcw, Send } from "lucide-react";
import PortalLayout from "./PortalLayout";
import PathwayMap from "@/components/PathwayMap";
import AdvisorContact from "@/components/AdvisorContact";
import { usePublishedContent } from "@/services/public-content";
import { buildPathwayMap, enrollmentFactsFromApi } from "@/application/student/pathway-map";
import { useRealSession } from "@/services/session";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { pathwayById, pathways } from "@/data/pathways";
import { courseById, pathwayCourses } from "@/data/courses";
import { useCourseCohorts } from "@/services/cohort-prices";
import CohortPicker from "@/components/CohortPicker";
import BuyCohort from "@/components/BuyCohort";
import AwaitingCourseChoices from "@/components/AwaitingCourseChoices";
import { fmtDayMonth } from "@/application/text/format-ar";

/** صفٌّ من /api/learner/my-learning — ما نحتاجه منه هنا فقط */
interface Row {
  id: string;
  status: string;
  cohort: { title: string; course: { id: string } | null } | null;
  courseProgress: { percent: number } | null;
  certificates?: unknown[];
}

/* الخطّة المعتمَدة من الخادم — حالةُ كلّ دورة مشتقّةٌ هناك لا هنا */
type PlanItemState = "enrolled" | "schedulable" | "awaiting_cohort";
interface PlanItem {
  courseId: string;
  sequence: number;
  isGift: boolean;
  state: PlanItemState;
  cohort: { id: string; title: string; startsAt: string | null; seatsLeft: number | null } | null;
  requestPending: boolean;
  notifyOnCohort: boolean;
}
interface Plan {
  id: string;
  nameAr: string;
  composed: boolean;
  items: PlanItem[];
  counts: { total: number; enrolled: number; schedulable: number; awaitingCohort: number };
}

export default function MyPathway() {
  const catalogVersion = usePublishedContent();
  const { user: sessionUser } = useRealSession();
  const [fetched, setFetched] = useState<Row[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  /* بعد إرسال طلب الخطّة تُعاد القراءة: الحالة مشتقّة على الخادم، فلا تُصحَّح هنا بيد */
  const [reloadKey, setReloadKey] = useState(0);
  /* بلا جلسة لا نداء ولا تصفير حالة داخل تأثير (react-hooks/set-state-in-effect):
     النتيجة تُعطف أثناء التصيير — زائرٌ بلا جلسة صفوفُه فارغة قطعا. */
  const rows = sessionUser ? fetched : [];

  useEffect(() => {
    if (!sessionUser) return;
    let on = true;
    apiGet<Row[]>("/api/learner/my-learning")
      .then((r) => { if (on) setFetched(r); })
      .catch(() => { if (on) setFetched([]); });
    /* الخطّة المعتمَدة — إن وُجدت فهي المصدر، وإلا يبقى الاستنتاج القديم */
    apiGet<{ plan: Plan | null }>("/api/learner/plan")
      .then((r) => { if (on) setPlan(r.plan); })
      .catch(() => { if (on) setPlan(null); });
    return () => { on = false; };
  }, [sessionUser, reloadKey]);

  if (rows === null || pathways.length === 0) {
    return (
      <PortalLayout title="مساري">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>
      </PortalLayout>
    );
  }
  /* الخطّة أوّلا: هي ما اعتمده هو. والاستنتاج احتياطٌ لمن سجّل بلا خطّة. */
  if (plan) return <PlanBody key={catalogVersion} plan={plan} rows={rows} reload={() => setReloadKey((k) => k + 1)} />;
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
          <Link to="/pathways" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
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

/* ─────────── الخطّة كما اعتمدها — لا استنتاجا ───────────

   كانت هذه الصفحة **تستنتج** المسار: تنظر إلى دوراته المسجَّلة وتختار المسار
   الأكثر تطابقا معها، ثم تعرض **قائمة الكتالوج** لا قائمته هو. فمن سجّل في
   دورة واحدة قد يُنسَب إلى مسارٍ لم يخترْه، ومن اعتمد خطّةً بستّ دورات يرى خمسا.

   وحالةُ كلّ دورة تأتي مشتقّةً من الخادم: أمسجَّل فيها؟ ألها شعبة يطلبها الآن؟
   أم لا شعبة لها بعد؟ وهذا آخرها هو ما يجب أن يُقال صراحةً لا أن يُكتشَف بعد
   الدفع — «بانتظار شعبة» أصدق من زرٍّ يقود إلى لا شيء. */

const STATE_AR: Record<PlanItemState, { label: string; cls: string }> = {
  enrolled: { label: "مسجَّل", cls: "border-teal/50 text-teal-light-ink" },
  schedulable: { label: "شعبة متاحة", cls: "border-gold/50 text-gold-ink" },
  awaiting_cohort: { label: "بانتظار شعبة", cls: "border-white/15 text-white/45" },
};

function startsLabel(iso: string | null): string {
  if (!iso) return "الموعد يُعلن قريبا";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "الموعد يُعلن قريبا";
  return `تبدأ ${fmtDayMonth(d)}`;
}

/* طلب الخطّة كاملةً بنداءٍ واحد (التوصيتان ٢ و٣).

   كان على المتعلّم أن يذهب إلى «الشعب المفتوحة» ويطلب دورةً دورة — أي أن
   يعيد بناء خطّته بيده في شاشةٍ لا تعرف أنّ له خطّة، ثم يدفع أربع فواتير
   وفي كلٍّ منها فرصةٌ للتوقّف. والخادم الآن يقرأ خطّته، فيطلب ما له شعبة
   ويسمّي ما لا شعبة له بدل أن يبيعه صامتا. */
interface PlanRequestResult {
  requested: { courseId: string }[];
  awaiting: string[];
  alreadyRequested: string[];
}

function RequestWholePlan({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PlanRequestResult | null>(null);
  const askable = plan.items.filter((i) => i.state === "schedulable" && !i.requestPending).length;
  const pending = plan.items.filter((i) => i.requestPending).length;

  if (done) {
    return (
      <p className="mt-4 rounded-2xl border border-teal/35 bg-teal/[0.07] px-4 py-3 text-[12px] leading-6 text-teal-light-ink">
        وصلنا طلبك على {done.requested.length === 1 ? "دورة واحدة" : `${done.requested.length} دورات`}.
        نراجعها ونحجز مقاعدك، ثم تصلك فاتورةٌ واحدة للخطّة كلها.
        {done.awaiting.length > 0 && ` و${done.awaiting.length} من دوراتك تنتظر فتح شعبتها — لا تُحتسب عليك الآن.`}
      </p>
    );
  }

  if (askable === 0) {
    if (pending === 0) return null;
    return (
      <p className="mt-4 rounded-2xl border border-gold/30 bg-gold/[0.06] px-4 py-3 text-[12px] leading-6 text-gold-ink">
        طلبك على {pending === 1 ? "دورة واحدة" : `${pending} دورات`} قيد المراجعة. نحجز مقاعدك ثم تصلك
        فاتورةٌ واحدة للخطّة كلها — دفعةٌ واحدة لا أربع.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await apiPost<PlanRequestResult>("/api/learner/plan/enrollment-request");
            setDone(r);
            onDone();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "تعذّر إرسال الطلب — أعد المحاولة");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-black text-on-teal transition hover:bg-teal-light disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        اطلب تسجيلك في {askable === 1 ? "دورتك المتاحة" : `دوراتك الـ${askable} المتاحة`}
      </button>
      <p className="mt-2 text-[11px] leading-5 text-white/45">
        طلبٌ واحد لخطّتك كلها، وفاتورةٌ واحدة بعد حجز مقاعدك — لا دورةً دورة.
        {plan.counts.awaitingCohort > 0 && " وما لم تُفتح شعبته لا يُطلب ولا يُدفع ثمنه."}
      </p>
      {error && <p className="mt-2 text-[11px] font-bold text-gold-ink">{error}</p>}
    </div>
  );
}

function PlanBody({ plan, rows, reload }: { plan: Plan; rows: Row[]; reload: () => void }) {
  /* مواعيد الشعب لكلّ دورة — نداءٌ واحد لكلّ الصفحة، والاختيار محفوظٌ بالدورة */
  const { cohorts } = useCourseCohorts();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const facts = enrollmentFactsFromApi(rows);
  const factOf = new Map(facts.map((f) => [f.courseId, f]));
  const { total, enrolled, awaitingCohort } = plan.counts;
  const reviewMsg = `مرحبا، أنا صاحب «${plan.nameAr}» وأريد مراجعة خطّتي (تبديل/إضافة دورة).`;

  return (
    <PortalLayout title={plan.nameAr}>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black">خطّتك كما اعتمدتها</h2>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-white/60">
              {total} دورات · <span className="text-teal-light-ink">{enrolled} مسجَّل</span>
              {awaitingCohort > 0 && (
                <> · <span className="text-white/45">{awaitingCohort} بانتظار شعبة</span></>
              )}
            </p>
          </div>
          <AdvisorContact
            text={reviewMsg}
            label="مراجعة خطّتي"
            icon={<RefreshCcw className="h-4 w-4" />}
            className="flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
          />
        </div>
        {awaitingCohort > 0 && (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] leading-6 text-white/60">
            <span className="font-bold text-white/80">{awaitingCohort} من دوراتك لم تُفتح لها شعبة بعد.</span>{" "}
            لا تُطلب الآن ولا يُدفع ثمنها — نُعلمك فور جدولتها، أو استبدلها بمراجعة مع مستشارك.
          </p>
        )}
        <RequestWholePlan plan={plan} onDone={reload} />
      </section>

      <section className="mt-6 space-y-3">
        {plan.items.map((item) => {
          const c = courseById(item.courseId);
          if (!c) return null;
          const f = factOf.get(item.courseId);
          const done = !!f?.completed;
          const pct = f?.percent ?? null;
          const chip = done ? { label: "مكتملة", cls: "border-teal/60 text-teal-ink" } : STATE_AR[item.state];
          return (
            <div
              key={item.courseId}
              className={`flex flex-wrap items-center gap-4 rounded-3xl border p-5 ${
                done || item.state === "enrolled" ? "border-teal/40 bg-white/[0.03]" : "border-white/10 bg-white/[0.01]"
              }`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black ${done ? "bg-teal text-on-teal" : "bg-white/5"}`}>
                {done ? <CheckCircle2 className="h-5 w-5" /> : item.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-black ${item.state === "awaiting_cohort" ? "text-white/50" : ""}`}>
                  {c.name}
                  {item.isGift && (
                    <span className="ms-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold-ink">هديّتك</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-white/45">
                  {c.skill}
                  {item.state === "schedulable" && item.cohort && <> · {startsLabel(item.cohort.startsAt)}</>}
                </p>
                {item.state === "enrolled" && pct !== null && pct > 0 && pct < 100 && (
                  <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${chip.cls}`}>{chip.label}</span>
                {item.state === "enrolled" ? (
                  <Link to={`/student/course/${item.courseId}`} className="flex items-center gap-1 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light">
                    افتح المحطات <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                ) : item.requestPending ? (
                  <span className="text-[11px] font-bold text-gold-ink">طلبك قيد المراجعة</span>
                ) : item.state === "schedulable" ? (
                  /* الطلب من زرّ الخطّة أعلاه لا من هنا: طلبٌ لدورةٍ واحدة
                     يُنتج فاتورةً لدورةٍ واحدة — وهو بعينه ما يُفتّت الخطّة. */
                  <span className="text-[11px] font-bold text-gold-ink">جاهزة للطلب</span>
                ) : (
                  /* الخياراتُ أسفل البطاقة — استبدالٌ أو حذفٌ أو انتظارٌ بإشعار.
                     وكان هنا نصٌّ ساكن «نُعلمك عند فتحها»: صادقٌ ولا يترك
                     للمتعلّم شيئا يفعله. */
                  <span className="text-[11px] text-white/35">بانتظار شعبة</span>
                )}
              </div>

              {/* غير المسجَّلة: موعدُها وشراؤها هنا لا في صفحةٍ أخرى.

                  كان الزرّ يرمي إلى «الشعب المفتوحة»، فيبحث المتعلّم عن موعد
                  دورةٍ في قائمةٍ عامّة بعيدةٍ عن مساره، ثمّ ينتظر موافقة
                  إدارة. وقد صار الشراء مباشرا، فصار الموعد والدفع في موضع
                  القرار. */}
              {item.state === "awaiting_cohort" && (
                <AwaitingCourseChoices
                  courseId={item.courseId}
                  courseTitle={c?.name ?? item.courseId}
                  notifyOnCohort={item.notifyOnCohort}
                  onChanged={reload}
                />
              )}

              {item.state === "schedulable" && !done && (
                <div className="w-full border-t border-white/8 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CohortPicker
                      compact
                      cohorts={cohorts.get(item.courseId) ?? []}
                      selectedId={picked[item.courseId] ?? null}
                      onSelect={(cid) => setPicked((prev) => ({ ...prev, [item.courseId]: cid }))}
                    />
                    <BuyCohort
                      cohort={(cohorts.get(item.courseId) ?? []).find((x) => x.id === (picked[item.courseId] ?? (cohorts.get(item.courseId) ?? [])[0]?.id)) ?? null}
                      onBought={reload}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
  const { cohorts } = useCourseCohorts();
  const [picked, setPicked] = useState<Record<string, string>>({});
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
                {enrolled && (
                  <Link to={`/student/course/${id}`} className="flex items-center gap-1 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light">
                    افتح المحطات <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {/* غير المسجَّلة: موعدُها وشراؤها هنا لا في صفحةٍ أخرى.

                  كان الزرّ يرمي إلى «الشعب المفتوحة»، فيبحث المتعلّم عن موعد
                  دورةٍ في قائمةٍ عامّة بعيدةٍ عن مساره، ثمّ ينتظر موافقة
                  إدارة. وقد صار الشراء مباشرا، فصار الموعد والدفع في موضع
                  القرار. */}
              {!enrolled && (
                <div className="w-full border-t border-white/8 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CohortPicker
                      compact
                      cohorts={cohorts.get(id) ?? []}
                      selectedId={picked[id] ?? null}
                      onSelect={(cid) => setPicked((prev) => ({ ...prev, [id]: cid }))}
                    />
                    <BuyCohort
                      cohort={(cohorts.get(id) ?? []).find((x) => x.id === (picked[id] ?? (cohorts.get(id) ?? [])[0]?.id)) ?? null}
                      onBought={undefined}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </PortalLayout>
  );
}
