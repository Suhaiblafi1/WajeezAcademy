/* «دوراتي» — كلُّ دورةٍ لي، وحالُها، وقراري فيها. صفحةٌ واحدةٌ لا ثلاث.

   ═══ وصارت قائمةً واحدةً بأقسامٍ ثلاثة (الخطوة F، ١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): كانت الدورةُ تصله من ثلاثة أبواب —
   «دوراتُك قيد الإعداد» فوق، وعروضُ الشعب تحتها، وما أُسند إليه في «شعبي» لا يُرى هنا أصلا — ولكلٍّ
   كلماتُ حاله. فصار **صفٌّ لكلّ دورة** من الأبواب كلّها وحالُها كلمةٌ واحدة، وأفعالُ كلّ بابٍ في صفّه
   (`application/trainer/my-courses.ts`). و«دوراتي المقترحة» و«مساراتي» صارتا قسمين هنا بعد أن كانتا
   لسانين في القائمة.

   ═══ وكان اسمُها «مؤهّلاتي» حتّى ٦ أكتوبر ٢٠٢٦ ═══

   «نؤهّلك» قد تُقرأ «ندرّبك» (`qualify-word.test.ts`)، فخرجت من كلّ ما يقرؤه
   المدرّب — ثمّ عُرض اسمُ اللسان خيارا بثلاثة، فاختار صاحبُ المنصّة «دوراتي»
   («B»). والمسارُ `/trainer/qualifications` باقٍ: روابطُ الرسائل التي خرجت
   تفتحه، ومرساةُ الدليل `#qualifications` كذلك.

   ═══ ولمَ صارت «عروضي» فيها (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «مؤهّلاتي كبيرةُ الخطّ.. اجعلِ التصميمَ أرتبَ.. وادمجْ
   هذه الصفحةَ مع عروضي ولا داعيَ لعروضي منفصلة. يكون هناك حالٌ لكلّ مؤهَّل:
   سُحب، أو دُمج، أو أُضيف، وما هو متاحٌ له ليقدّمه — وهنا يقرّر بالموافقة
   أو الرفض ويكتب السبب».

   وكانت الشاشتان تتكلّمان عن الشيء نفسِه من طرفين: «مؤهّلاتي» تعدّ
   الدوراتِ بلا حال، و«عروضي» تعدّ العروضَ بلا صلةٍ ظاهرةٍ بالمؤهَّل الذي
   جاءت منه. فمن أراد أن يعرف «ما حالُ دورةِ كذا عندي؟» فتح الاثنتين وقابل
   بعينه. فصار **صفٌّ لكلّ دورة**، وحالُها في شارةٍ واحدة، والقرارُ عندها.

   ═══ ومن أين تُقرأ الحال ═══

   ثلاثةُ مصادرَ قائمةٌ — لا جدولٌ جديد:

     · `/api/trainer/me/qualifications` — ما أُهِّل له.
     · `/api/trainer/offers` — ما عُرض عليه منه وجوابُه:
         متاحةٌ لك (عرضٌ ينتظر قرارك) · أُضيفت إلى دوراتك (قبِلتَه) ·
         سُحبت (سحبتها الإدارة بسببها) · اعتذرتَ (بسببك) · انقضت مهلتُها.
     · `/api/trainer/course-proposals` — ما اقترحه فبُتّ فيه:
         دُمجت بدورةٍ قائمة (`linked`) · أُضيفت إلى الكتالوج (`became_course`).

   وأحدثُ العروض يحكم الحال؛ فإن لم يكن عرضٌ فأصلُ الدورة (دمجٌ أو إضافة)؛
   فإن لم يكن فـ«مؤهَّلٌ — لا عرضَ بعد». والعروضُ الأقدمُ سجلٌّ يُفتح ولا
   يُزاحم.

   ═══ وما بقي من العروض كما كان ═══

   ① **الاعتذارُ جوابٌ لا عطب** — زرُّه بحجم زرِّ القبول، وسببُه يُكتب
      (مثلا «دمجتُها مع دورةٍ أخرى أدرّسها»).
   ② **وانقضاءُ المهلة ليس مأخذا** — البندُ ٣-٣ يجعله ردّا.
   ③ **وأجلُ الإعداد يُرى قبل أن ينقضي**، والإقرارُ بالجاهزيّة عنده.

   ═══ ونطاقُ الاقتراحات خرج منها ═══

   كان هنا لوحُ «نطاقُ اقتراحاتي» (`/api/trainer/catalog-scope`) يشرح
   لمن يقترح تعديلا على دورته أين يصل تعديلُه. وذهبت شاشةُ «تعديلاتي على
   دوراتي» بالقرار نفسِه («لا داعيَ لهذا القسم كلّيّا»)، فلم يبقَ ما يشرحه.

   ═══ ومن قبلُ: ذهبت الإتاحةُ كلُّها (٢٧ سبتمبر ٢٠٢٦) ═══

   «ساعاتي الأسبوعيّة» و«فصولي» و«فترات غيابي» — بقرار صاحب المنصّة: «هو
   من يتحكّم بكلّ شيء.. اللقاءاتُ بيده ضمن فترة الشعبة نفسِها». */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Award, CalendarClock, Check, ChevronDown, ClipboardCheck, Loader2, PencilLine, ServerOff, Users, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { PrepDecision, PrepSetupNote, type PrepRow } from "./CourseMaterialsPanel";
import CohortMoveBox, { type MoveRequestRow } from "@/components/trainer/CohortMoveBox";
import { boardPlace, cohortTerm } from "@/application/trainer/board-place";
import { boardStart } from "@/application/trainer/plan-gate";
import { termLabelAr, type TermRef } from "@/application/trainer/cohort-move";
import { termBounds } from "@/application/terms/season";
import CourseProposalsSection from "./MyCourseProposals";
import MyPathsSection from "./MyPaths";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import TabBar from "@/components/ui/TabBar";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import { fmtDateLong } from "@/application/text/format-ar";
import { cohortDayAr, DAY_NUMERIC } from "@/application/learning/cohort-gate";
import {
  buildMyCourses, MY_COURSE_FILTERS, type MyCourse, type MyCourseCohort, type MyCourseFilter, type MyCourseRequest,
} from "@/application/trainer/my-courses";

interface Qualification { courseId: string; title: string; currentVersion: number; qualifiedAt: string }

interface Offer {
  id: string;
  status: string;
  courseId: string;
  courseTitleAr: string;
  cohort: { id: string; title: string; startsAt: string | null } | null;
  sessionsCount: number | null;
  startsAt: string | null;
  feeNoteAr: string | null;
  noteAr: string | null;
  expiresAt: string;
  offeredAt: string;
  respondedAt: string | null;
  declineReasonAr: string | null;
  withdrawReasonAr: string | null;
  prepDays: number;
  prepDueAt: string | null;
  prepConfirmedAt: string | null;
  prepLapsedAt: string | null;
}

const fmtDate = fmtDateLong;

type Row = MyCourse<Offer, PrepRow>;

/* ═══ ثلاثةُ أقسامٍ في لسانٍ واحد (الخطوة F، ١٩ أكتوبر ٢٠٢٦) ═══
   «دوراتي المقترحة» و«مساراتي» كانتا لسانين في قائمة المدرّب، فصارتا قسمين هنا. ومساراهما القديمان
   يُحالان إلى قسميهما (`App.tsx`) — فروابطُ الرسائل التي خرجت تفتح ما وعدت به. */
const SECTIONS = [
  { id: "courses", label: "دوراتي" },
  { id: "proposals", label: "دوراتي المقترحة" },
  { id: "paths", label: "مساراتي" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

/** فوق هذا العدد تظهر أدواتُ الفرز والبحث — وما دونه يُقرأ بالعين */
const TOOLS_FROM = 6;

/** كم بقي من مهلة — والعددُ بالعربيّة لا بتاريخٍ يُحسب في الرأس */
function remainingAr(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "انقضت";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `بقي ${days} يوما`;
  if (days === 1) return "بقي يومان تقريبا";
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `بقي ${hours} ساعة`;
}


export default function TrainerQualifications() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const section: Section = SECTIONS.some((s) => s.id === asked) ? (asked as Section) : "courses";
  return (
    <TrainerLayout title="دوراتي">
      <TabBar
        ariaLabel="أقسام دوراتي"
        className="mb-5"
        value={section}
        onChange={(id) => setParams(id === "courses" ? {} : { tab: id }, { replace: true })}
        items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
      />
      {section === "courses" && <MyCoursesList />}
      {section === "proposals" && <CourseProposalsSection />}
      {section === "paths" && <MyPathsSection />}
    </TrainerLayout>
  );
}

function MyCoursesList() {
  const [quals, setQuals] = useState<Qualification[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [prep, setPrep] = useState<PrepRow[]>([]);
  const [cohorts, setCohorts] = useState<MyCourseCohort[]>([]);
  const [requests, setRequests] = useState<MyCourseRequest[]>([]);
  /* وطلباتُ نقل الشعب — التأجيلُ من صفّ دورتها (٢٠ أكتوبر ٢٠٢٦) */
  const [moves, setMoves] = useState<MoveRequestRow[]>([]);
  /* ═══ و«تعذر الوصول» لما لم يصل وحدَه (١٩ أكتوبر ٢٠٢٦) ═══
     بلاغُ صاحب المنصّة: مدرّبةٌ وُقّع عقدُها تفتح «دوراتي» فتقرأ «تعذر الوصول إلى الخادم». وكان
     كلُّ ردٍّ بخطأ — رفضٌ بسببٍ مسمًّى من الخادم — يُعرض كأنّ الخادمَ غاب. فما ردّه الخادمُ بسببه
     يُقال بسببه، و«تعذر الوصول» لما لم يصل أصلا. */
  const [down, setDown] = useState<false | { reasonAr: string | null }>(false);
  const [busy, setBusy] = useState(false);
  /* محرّرُ اعتذارٍ واحدٌ في كلّ وقت — والسببُ يُكتب قبل الإرسال لا بعده */
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<MyCourseFilter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());

  /* والكتابةُ في ردّ النداء لا في جسم الأثر (`react-hooks/set-state-in-effect`).
     والمؤهّلاتُ وحدَها تُسقط الشاشةَ إن غابت؛ العروضُ ودوراتُ الإعداد والشعبُ تكميلٌ —
     غيابُها يُفقِد الحالَ تفصيلَها ولا يُخفي ما أُهِّل له. */
  const load = useCallback(() =>
    Promise.all([
      apiGet<Qualification[]>("/api/trainer/me/qualifications"),
      apiGet<Offer[]>("/api/trainer/offers").catch(() => [] as Offer[]),
      /* دوراتُ طور الإعداد — يقبلها فتُعَدّ في «شعبي» (٢ أكتوبر ٢٠٢٦) */
      apiGet<PrepRow[]>("/api/trainer/prep").catch(() => [] as PrepRow[]),
      /* وشعبُه في «شعبي» — ما أُسند إليه بلا عرضٍ كان لا يُرى هنا (الخطوة F) */
      apiGet<MyCourseCohort[]>("/api/trainer/cohorts/summary").catch(() => [] as MyCourseCohort[]),
      /* وطلباتُ تأهيله بشعبتها — تُقرأ ولا يُقرَّر فيها (٢٠ أكتوبر ٢٠٢٦) */
      apiGet<MyCourseRequest[]>("/api/trainer/qualification-requests").catch(() => [] as MyCourseRequest[]),
      apiGet<MoveRequestRow[]>("/api/trainer/cohort-moves").catch(() => [] as MoveRequestRow[]),
    ])
      .then(([qs, os, pr, cs, rq, mv]) => { setQuals(qs); setOffers(os); setPrep(pr); setCohorts(cs); setRequests(rq); setMoves(mv); setDown(false); })
      .catch((e) => setDown({ reasonAr: e instanceof ApiError ? e.message : null })), []);

  useEffect(() => { void load(); }, [load]);

  /* ═══ شعبُ الفصول القادمة في قسمها — لا تحت دوراتها (٢١ أكتوبر ٢٠٢٦، `board-place.ts`) ═══
     قرارُ صاحب المنصّة: ما أُجّل أو نُقل إلى فصلٍ بعد الذي نعمل له يُرى «بقسمٍ منفصل يقول دورات الفصول القادمة».
     فيُخرَج من صفوف الدورات — شعبُه وبابُ إعداده معا — ويُعرض تحتها بفصله. */
  const later = useMemo(() => cohorts.filter((c) => boardPlace(c, new Date(now)) === "later"), [cohorts, now]);
  const rows = useMemo(() => {
    const away = new Set(later.map((c) => c.id));
    const laterCourses = new Set(later.map((c) => c.courseId));
    /* ودورةٌ لم يبقَ لها هنا إلّا تأهيلُها — وشعبتُها في القسم — لا تُعاد صفّا «معتمدة لك» بلا شعبة */
    return buildMyCourses({
      quals: quals ?? [], offers, requests, now,
      prep: prep.filter((p) => !p.cohortId || !away.has(p.cohortId)),
      cohorts: cohorts.filter((c) => !away.has(c.id)),
    }).filter((r) => !(r.state === "ready" && laterCourses.has(r.courseId)));
  }, [quals, offers, prep, cohorts, requests, now, later]);
  const counts = useMemo(() => {
    const c = {} as Record<MyCourseFilter, number>;
    for (const f of MY_COURSE_FILTERS) c[f.id] = f.states.length === 0 ? rows.length : rows.filter((r) => f.states.includes(r.state)).length;
    return c;
  }, [rows]);
  const tools = rows.length > TOOLS_FROM;
  const view = useMemo(() => {
    const states = MY_COURSE_FILTERS.find((f) => f.id === filter)?.states ?? [];
    return paginate(
      rows
        .filter((r) => !tools || states.length === 0 || states.includes(r.state))
        .filter((r) => !tools || matchesQuery(q, [r.title, r.labelAr, ...r.cohorts.map((c) => c.title), ...r.offers.map((o) => o.cohort?.title)])),
      tools ? page : 1, tools ? 20 : Math.max(rows.length, 1),
    );
  }, [rows, filter, q, page, tools]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setDeclining(null);
      setReason("");
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ ما طلبت");
    } finally {
      setBusy(false);
    }
  }

  /* ورابطُ «شعبي» إلى القسم (`#later`) يصله بعد أن يُرسم */
  const laterShown = later.length > 0;
  useEffect(() => {
    if (laterShown && window.location.hash === "#later") document.getElementById("later")?.scrollIntoView({ block: "start" });
  }, [laterShown]);

  if (down) {
    return (
      <EmptyState
        icon={ServerOff}
        titleAr={down.reasonAr ? "لم تفتح دوراتك" : "تعذّر الوصول إلى الخادم"}
        reasonAr={down.reasonAr ?? "تحقّق من اتصالك ثمّ أعد المحاولة."}
        actions={[{ labelAr: "أعد المحاولة", onClick: () => void load() }]}
      />
    );
  }

  if (!quals) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
      </div>
    );
  }

  if (rows.length === 0 && later.length === 0) {
    /* وكانت تقول «تُؤهَّل تلقائيّا لكلّ دورةٍ ذكرتَها» — ودوراتُ طلبه قيد
       الإعداد لا مؤهَّلة، فكان النصُّ يَعِد بما لا يراه. فصار يقول أين هي. */
    return (
      <EmptyState
        icon={Award}
        titleAr="لا دورة بعد"
        reasonAr="تظهر هنا دوراتك والشعب المتاحة لك. ولك أن تقترح دورة ليست في كتالوجنا."
        actions={[{ to: "/trainer/qualifications?tab=proposals", labelAr: "دوراتي المقترحة", hintAr: "اقترح دورة تقدر عليها" }]}
      />
    );
  }

  return (
    <>
      {/* ═══ أين يُعدَّل محتوى الدورة بعد اعتمادها (٢ أكتوبر ٢٠٢٦) ═══

          بلاغُ صاحب المنصّة: «المدرّبُ يقول لا يستطيع تعديلَ دوراته من
          مؤهّلاتي». وقرارُه: لا موضعَ ثانٍ للتعبئة — «المدرّبُ يعبّئ في شعبي».
          فهذا السطرُ يقول ذلك ويدلّ عليه، ولا يفتح محرّرا هنا. */}
      <Inset tone="accent" className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-read leading-7">
          <PencilLine className="mt-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>كل دوراتك هنا وحال كل منها. والمحتوى تعبّئه في «شعبي».</span>
        </p>
        <Button as={Link} to="/trainer/board" size="sm" icon={Users}>افتح «شعبي»</Button>
      </Inset>

      <PrepSetupNote rows={prep} />

      {tools && (
        <>
          <TabBar
            ariaLabel="حال دوراتي"
            className="mb-4"
            value={filter}
            onChange={(f) => { setFilter(f); setPage(1); }}
            items={MY_COURSE_FILTERS.map((f) => ({
              id: f.id,
              label: <>{f.label} <span className="tabular-nums opacity-70">({counts[f.id]})</span></>,
            }))}
          />
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="دورة"
            placeholder="ابحث باسم الدورة أو شعبتها…" />
        </>
      )}

      {view.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">لا دورة في هذا الباب.</p>
      ) : (
        <ul className="grid gap-2.5">
          {view.rows.map((r) => (
            <CourseRow
              key={r.courseId} row={r} now={now} busy={busy}
              declining={declining} reason={reason}
              onDeclineStart={(id) => { setDeclining(id); setReason(""); }}
              onDeclineCancel={() => setDeclining(null)}
              onReason={setReason}
              run={run}
              moves={moves}
              onChanged={() => void load()}
            />
          ))}
        </ul>
      )}

      {later.length > 0 && <LaterTerms cohorts={later} moves={moves} onChanged={() => void load()} />}
    </>
  );
}

/* ═══ «دورات الفصول القادمة» — قسمٌ بفصولها (٢١ أكتوبر ٢٠٢٦) ═══
   كلُّ فصلٍ عنوانٌ وتحته شعبُه: دورتُها وحالُها ومتى تبدأ، وبابُها، ونقلُها إلى فصلٍ آخر — ومنه إعادتُها. والمؤجَّلةُ
   خطّتُها لا يُقال يومُ بدئها المقترح: هو من فصلها القديم، وفصلُها الجديد هو ما يُقال. */
function LaterTerms({ cohorts, moves, onChanged }: { cohorts: MyCourseCohort[]; moves: MoveRequestRow[]; onChanged: () => void }) {
  const groups = new Map<string, { term: TermRef; cohorts: MyCourseCohort[] }>();
  for (const c of cohorts) {
    const t = cohortTerm(c);
    if (!t) continue;
    const key = `${t.year}:${t.season}`;
    const g = groups.get(key) ?? { term: t, cohorts: [] };
    g.cohorts.push(c);
    groups.set(key, g);
  }
  const ordered = [...groups.values()].sort((a, b) =>
    termBounds(a.term.year, a.term.season).startsOn.getTime() - termBounds(b.term.year, b.term.season).startsOn.getTime());
  return (
    <section id="later" aria-labelledby="later-title" className="mt-8 scroll-mt-24">
      <h2 id="later-title" className="flex items-center gap-2 text-lg font-black">
        <CalendarClock className="h-5 w-5 text-gold-ink" aria-hidden="true" />
        دورات الفصول القادمة
      </h2>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        أجّلت أو نقلت إلى فصل لاحق، وترجع إلى «شعبي» حين يقترب فصلها.
      </p>
      {ordered.map((g) => (
        <div key={`${g.term.year}:${g.term.season}`} className="mt-4">
          <h3 className="text-read font-black text-muted-foreground">{termLabelAr(g.term)} ({g.cohorts.length})</h3>
          <ul className="mt-2 grid gap-2.5">
            {g.cohorts.map((c) => <LaterCohort key={c.id} c={c} moves={moves} onChanged={onChanged} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function laterStateOf(c: MyCourseCohort): { label: string; tone: ChipTone } {
  if (c.next?.key === "postponed") return { label: "مؤجّلة", tone: "neutral" };
  if (c.approvedOnce || c.status !== "draft") return { label: "معتمدة", tone: "positive" };
  if (c.planStatus === "submitted") return { label: "بانتظار الاعتماد", tone: "info" };
  return { label: "في التجهيز", tone: "neutral" };
}

function LaterCohort({ c, moves, onChanged }: { c: MyCourseCohort; moves: MoveRequestRow[]; onChanged: () => void }) {
  const st = laterStateOf(c);
  const postponed = c.next?.key === "postponed";
  const start = postponed ? { at: null, proposed: false } : boardStart({ startsAt: c.startsAt ?? null, proposedStartsOn: c.proposedStartsOn });
  return (
    <Card as="li" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-read text-muted-foreground">{c.courseTitle}</p>
          <h4 className="text-read font-bold leading-6 text-foreground">{c.title}</h4>
        </div>
        <Chip tone={st.tone} srPrefixAr="الحال">{st.label}</Chip>
      </div>
      {start.at && (
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          تبدأ {cohortDayAr(start.at)}{start.proposed && " · مقترح"}
        </p>
      )}
      {c.next?.labelAr && (
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          {c.next.waiting ? c.next.labelAr : <><span className="font-bold text-foreground">التالي:</span> {c.next.labelAr}</>}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button as={Link} to={`/trainer/cohort/${c.id}`} size="sm" icon={Users} tone="secondary">افتح الشعبة</Button>
      </div>
      <CohortMoveBox cohortId={c.id} status={c.status} startsAt={c.startsAt ?? null} proposedStartsOn={c.proposedStartsOn ?? null}
        pending={moves.find((m) => m.cohortId === c.id && m.status === "pending") ?? null}
        onChange={onChanged} />
    </Card>
  );
}

function CourseRow({
  row: r, now, busy, declining, reason, onDeclineStart, onDeclineCancel, onReason, run, moves, onChanged,
}: {
  row: Row; now: number; busy: boolean; declining: string | null; reason: string;
  onDeclineStart: (offerId: string) => void; onDeclineCancel: () => void; onReason: (v: string) => void;
  run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
  moves: MoveRequestRow[];
  onChanged: () => void;
}) {
  const q = r.qual;
  const open = r.openOffer;
  /* العرضُ الذي يُقرأ في الصفّ: المفتوحُ، وإلّا الأحدثُ — حين يكون هو ما يحكم الحال */
  const lead = open ?? (r.state === "closed" || (r.state === "teaching" && r.cohorts.length === 0) ? r.offers[0] ?? null : null);
  const earlier = r.offers.filter((o) => o !== lead);
  const accepted = r.offers.find((o) => o.status === "accepted" && o.prepDueAt && !o.prepConfirmedAt) ?? null;
  /* ═══ وما يُعدّ من شعبه يُجهَّز من هنا، والحاليّةُ في «شعبي» (٢٠ أكتوبر ٢٠٢٦، `board-place.ts`) ═══
     اقتراحُ صاحب المنصّة: «صفحة دوراتي فيها كلّ الدورات ليوافق عليها ويرفضها أو يؤجّلها، وتبقى صفحة شعبي نظيفة».
     فما لم تُعتمد خطّتُه قطّ يُرى تحت دورته بخطوته التالية، و«جهّزها»، وبابِ تأجيله. ومن لا يقرأ «شعبي» بعدُ
     (طورُ الإعداد) تأتيه شعبةُ إعداده من بابها. */
  const preparing = r.cohorts.filter((c) => boardPlace(c) === "courses");
  const links: { id: string; title: string | null }[] = r.cohorts.length > 0
    ? r.cohorts.filter((c) => boardPlace(c) !== "courses").map((c) => ({ id: c.id, title: c.title }))
    : r.prep?.cohortId && r.prep.state !== "declined" ? [{ id: r.prep.cohortId, title: r.prep.cohortTitle }] : [];

  return (
    /* ═══ ولماذا لا رمزَ للدورة في الصفّ ═══

       شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أسماءُ الدورات بدل رموزها».
       والرمزُ حُذف لا استُبدل — الاسمُ فوقه أصلا. وحين لا اسمَ في الكتالوج
       يُقال إنّ الاسمَ غائب، لا يُطبع الرمزُ بديلا. */
    <Card as="li" className={`p-4 ${r.state === "decide" ? "border-gold/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <h2 className="min-w-0 flex-1 text-read font-bold leading-6 text-foreground">
          {r.title || "دورة بلا اسم في الكتالوج"}
        </h2>
        <Chip tone={r.tone} srPrefixAr="الحال">{r.labelAr}</Chip>
      </div>

      {q && (
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          النسخة {q.currentVersion} · من دوراتك منذ {fmtDate(q.qualifiedAt)}
        </p>
      )}

      {lead ? <OfferBody offer={lead} now={now} /> : null}
      {r.prep?.state === "declined" && !lead && r.prep.declineReasonAr && (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">سببك: {r.prep.declineReasonAr}</p>
      )}

      {/* ═══ أجلُ الإعداد — بعد القبول وحدَه ═══ */}
      {accepted?.prepDueAt && (
        <Inset
          tone={accepted.prepLapsedAt ? "warn" : "default"}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3"
        >
          <p className="text-sm leading-6">
            <CalendarClock className="ms-0 me-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
            {`أجل إعدادك ${accepted.prepDays} أيّام، وينتهي ${fmtDate(accepted.prepDueAt)}.`}
            {accepted.prepLapsedAt && " وقد انقضى — والإسناد قائم، وتنظر فيه الإدارة."}
          </p>
          <Button
            tone="confirm" size="sm" icon={ClipboardCheck} disabled={busy}
            onClick={() => run(() => apiPost(`/api/trainer/offers/${accepted.id}/prep-confirm`, {}), "سجّل إقرارك بالجاهزيّة")}
          >
            أقرّ بجاهزيّتي
          </Button>
        </Inset>
      )}

      {/* ═══ القرار — والزرّان بحجمٍ واحد ═══ */}
      {open && declining !== open.id && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            tone="confirm" size="sm" icon={Check} disabled={busy}
            onClick={() => run(() => apiPost(`/api/trainer/offers/${open.id}/accept`, {}), "قبلتها — وأسندت إليك")}
          >
            أوافق على تقديمها
          </Button>
          <Button tone="secondary" size="sm" icon={X} disabled={busy} onClick={() => onDeclineStart(open.id)}>
            أعتذر عنها
          </Button>
        </div>
      )}

      {open && declining === open.id && (
        <Inset className="mt-3 grid gap-3 p-3">
          <StaffField label="سبب اعتذارك" hint="سطر يكفي، ولا يحسب عليك">
            <input
              value={reason} maxLength={500} className={staffControlCls} autoFocus
              placeholder="مثلا: دمجتها مع دورة أخرى أدرّسها"
              onChange={(e) => onReason(e.target.value)}
            />
          </StaffField>
          <div className="flex flex-wrap gap-2">
            <Button
              tone="danger" size="sm" icon={X} disabled={busy || reason.trim().length < 5}
              onClick={() => run(
                () => apiPost(`/api/trainer/offers/${open.id}/decline`, { reasonAr: reason.trim() }),
                "وصل اعتذارك",
              )}
            >
              أرسل اعتذاري
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={onDeclineCancel}>تراجع</Button>
          </div>
        </Inset>
      )}

      {r.state === "requested" && r.request && (
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          {r.request.cohortTitle ? `طلبت الإدارة إسنادك إلى «${r.request.cohortTitle}»` : "طلبت الإدارة إسنادك إلى شعبة فيها"} — القرار لها، ويصلك خبره.
        </p>
      )}

      {/* ودورةُ الإعداد بقرارها — «اقبلها وابدأ إعدادها» أو الاعتذارُ بسبب */}
      {!open && r.prep?.state === "to_decide" && <PrepDecision row={r.prep} onChanged={onChanged} />}

      {preparing.map((c) => (
        <Inset key={c.id} className="mt-3 grid gap-2 p-3">
          <p className="text-read leading-6">
            <b className="text-foreground">{c.title}</b>
            {typeof c.done === "number" && typeof c.total === "number" && c.total > 0 && (
              <span className="text-muted-foreground"> · تجهيز {c.done} من {c.total}</span>
            )}
          </p>
          {c.next?.labelAr && (
            <p className="text-read leading-6 text-muted-foreground">
              {c.next.waiting ? c.next.labelAr : <><span className="font-bold text-foreground">التالي:</span> {c.next.labelAr}</>}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button as={Link} to={`/trainer/cohort/${c.id}`} size="sm" icon={PencilLine} tone="confirm">جهّزها</Button>
          </div>
          <CohortMoveBox cohortId={c.id} status={c.status} startsAt={c.startsAt ?? null} proposedStartsOn={c.proposedStartsOn ?? null}
            pending={moves.find((m) => m.cohortId === c.id && m.status === "pending") ?? null}
            onChange={onChanged} />
        </Inset>
      ))}

      {/* ═══ شعبُه فيها — تُفتح من صفّ دورتها ═══ */}
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {links.slice(0, 3).map((c) => (
            <Button key={c.id} as={Link} to={`/trainer/cohort/${c.id}`} size="sm" icon={Users} tone="secondary">
              {links.length === 1 ? "افتح شعبتها" : c.title ?? "افتح الشعبة"}
            </Button>
          ))}
          {links.length > 3 && (
            <Link to="/trainer/board" className="text-sm font-bold text-muted-foreground hover:text-foreground">
              وغيرها في «شعبي» ({links.length - 3})
            </Link>
          )}
        </div>
      )}

      {/* ── وما سبق من عروضٍ عليها — سجلٌّ يُفتح ولا يزاحم ── */}
      {earlier.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-fine font-bold text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
            عروض سابقة عليها ({earlier.length})
          </summary>
          <ul className="mt-2 grid gap-1.5 border-s border-white/10 ps-3">
            {earlier.map((o) => (
              <li key={o.id} className="text-read leading-6 text-muted-foreground">
                {fmtDate(o.offeredAt)}{o.cohort ? ` — «${o.cohort.title}»` : ""}: {offerSaidAr(o)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/** حالُ عرضٍ بجملةٍ واحدة — للسجلّ السابق */
function offerSaidAr(o: Offer): string {
  if (o.status === "accepted") return "قبلته";
  if (o.status === "declined") return `اعتذرت${o.declineReasonAr ? ` — ${o.declineReasonAr}` : ""}`;
  if (o.status === "withdrawn") return `سحبته الإدارة${o.withdrawReasonAr ? ` — ${o.withdrawReasonAr}` : ""}`;
  if (o.status === "lapsed") return "انقضت مهلته";
  return "ينتظر جوابك";
}

/** تفاصيلُ العرض الذي يحكم الحال — ما يُقرّر عليه، وما قيل فيه */
function OfferBody({ offer: o, now }: { offer: Offer; now: number }) {
  const open = o.status === "offered";
  const expired = open && new Date(o.expiresAt).getTime() <= now;
  const facts = [
    o.sessionsCount !== null ? { k: "الجلسات", v: String(o.sessionsCount) } : null,
    o.startsAt ? { k: "البداية", v: cohortDayAr(o.startsAt, DAY_NUMERIC) } : null,
    o.feeNoteAr ? { k: "الأجر", v: o.feeNoteAr } : null,
  ].filter((x): x is { k: string; v: string } => !!x);
  return (
    <>
      {facts.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {facts.map((f) => (
            <div key={f.k} className="flex gap-1.5">
              <dt className="text-muted-foreground">{f.k}:</dt>
              <dd className="font-bold">{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {o.noteAr && <Inset className="mt-2 p-2.5 text-sm leading-6">{o.noteAr}</Inset>}
      {open && !expired && (
        <p className="mt-2 text-sm font-bold text-gold-ink">
          مهلة الردّ تنتهي {fmtDate(o.expiresAt)} — {remainingAr(o.expiresAt, now)}.
        </p>
      )}
      {(o.status === "lapsed" || expired) && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          انقضت مهلة الردّ، ولا يحسب عليك. راسل الإدارة إن كنت ما زلت ترغب فيها.
        </p>
      )}
      {o.status === "withdrawn" && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          سحبتها الإدارة{o.withdrawReasonAr ? `: ${o.withdrawReasonAr}` : "."}
        </p>
      )}
      {o.status === "declined" && o.declineReasonAr && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">سبب اعتذارك: {o.declineReasonAr}</p>
      )}
    </>
  );
}
