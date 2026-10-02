/* «مؤهّلاتي» — كلُّ دورةٍ لي، وحالُها، وقراري فيها. صفحةٌ واحدةٌ لا ثلاث.

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
import { Link } from "react-router";
import { Award, CalendarClock, Check, ChevronDown, ClipboardCheck, Loader2, PencilLine, ServerOff, Users, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import CourseMaterialsPanel, { type MaterialsRow } from "./CourseMaterialsPanel";
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

interface Proposal {
  id: string;
  titleAr: string;
  status: string;
  courseId: string | null;
  decisionNoteAr: string | null;
  decidedAt: string | null;
  course: { id: string; status: string; titleAr: string | null } | null;
}

const fmtDate = fmtDateLong;

/* ═══ الحالُ — مفتاحٌ واحدٌ لكلّ صفّ، وبه يُرشَّح ═══ */
type StateKey = "open" | "added" | "merged" | "catalog" | "withdrawn" | "declined" | "lapsed" | "idle";

const STATE: Record<StateKey, { label: string; tone: ChipTone }> = {
  open: { label: "متاحةٌ لك — قرّر", tone: "warn" },
  added: { label: "أُضيفت إلى دوراتك", tone: "positive" },
  merged: { label: "دُمجت بدورةٍ قائمة", tone: "accent" },
  catalog: { label: "أُضيفت إلى الكتالوج", tone: "accent" },
  withdrawn: { label: "سُحبت", tone: "danger" },
  declined: { label: "اعتذرتَ عنها", tone: "neutral" },
  lapsed: { label: "انقضت مهلتُها", tone: "neutral" },
  idle: { label: "مؤهَّلٌ — لا عرضَ بعد", tone: "neutral" },
};

type Filter = "all" | "open" | "added" | "merged" | "withdrawn";
const FILTERS: { id: Filter; label: string; keys: StateKey[] }[] = [
  { id: "all", label: "الكلّ", keys: [] },
  { id: "open", label: "متاحة", keys: ["open"] },
  { id: "added", label: "أُضيفت", keys: ["added", "catalog"] },
  { id: "merged", label: "دُمجت", keys: ["merged"] },
  { id: "withdrawn", label: "سُحبت أو اعتذرتَ", keys: ["withdrawn", "declined", "lapsed"] },
];

interface Row {
  courseId: string;
  title: string;
  qual: Qualification | null;
  /** الأحدثُ أوّلا */
  offers: Offer[];
  origin: Proposal | null;
  state: StateKey;
}

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

function stateOf(offer: Offer | undefined, origin: Proposal | null, now: number): StateKey {
  if (offer) {
    if (offer.status === "offered") return new Date(offer.expiresAt).getTime() > now ? "open" : "lapsed";
    if (offer.status === "accepted") return "added";
    if (offer.status === "withdrawn") return "withdrawn";
    if (offer.status === "declined") return "declined";
    if (offer.status === "lapsed") return "lapsed";
  }
  if (origin?.status === "linked") return "merged";
  if (origin?.status === "became_course") return "catalog";
  return "idle";
}

/** صفٌّ لكلّ دورة — من المؤهَّل والعروض والاقتراحات المبتوتة معا */
function buildRows(quals: Qualification[], offers: Offer[], proposals: Proposal[], now: number): Row[] {
  const byCourse = new Map<string, Omit<Row, "state">>();
  const touch = (courseId: string, title: string) => {
    const r = byCourse.get(courseId) ?? { courseId, title, qual: null, offers: [], origin: null };
    if (!r.title && title) r.title = title;
    byCourse.set(courseId, r);
    return r;
  };
  for (const q of quals) touch(q.courseId, q.title).qual = q;
  for (const o of offers) touch(o.courseId, o.courseTitleAr).offers.push(o);
  for (const p of proposals) {
    if (!p.courseId || (p.status !== "linked" && p.status !== "became_course")) continue;
    touch(p.courseId, p.course?.titleAr ?? "").origin = p;
  }
  const order: Record<StateKey, number> = { open: 0, added: 1, idle: 2, merged: 3, catalog: 3, withdrawn: 4, declined: 5, lapsed: 5 };
  return [...byCourse.values()]
    .map((r) => {
      r.offers.sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));
      /* العرضُ المفتوحُ يحكم ولو سبقه في الترتيب عرضٌ أحدثُ بُتّ فيه */
      const lead = r.offers.find((o) => o.status === "offered" && new Date(o.expiresAt).getTime() > now) ?? r.offers[0];
      return { ...r, state: stateOf(lead, r.origin, now) };
    })
    .sort((a, b) => order[a.state] - order[b.state] || a.title.localeCompare(b.title, "ar"));
}

export default function TrainerQualifications() {
  const [quals, setQuals] = useState<Qualification[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [materials, setMaterials] = useState<{ courses: MaterialsRow[]; underReview: boolean }>({ courses: [], underReview: false });
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  /* محرّرُ اعتذارٍ واحدٌ في كلّ وقت — والسببُ يُكتب قبل الإرسال لا بعده */
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());

  /* والكتابةُ في ردّ النداء لا في جسم الأثر (`react-hooks/set-state-in-effect`).
     والمؤهّلاتُ وحدَها تُسقط الشاشةَ إن غابت؛ العروضُ والاقتراحاتُ تكميلٌ —
     غيابُها يُفقِد الحالَ تفصيلَها ولا يُخفي ما أُهِّل له. */
  const load = useCallback(() =>
    Promise.all([
      apiGet<Qualification[]>("/api/trainer/me/qualifications"),
      apiGet<Offer[]>("/api/trainer/offers").catch(() => [] as Offer[]),
      apiGet<Proposal[]>("/api/trainer/course-proposals").catch(() => [] as Proposal[]),
      apiGet<{ courses: MaterialsRow[]; underReview: boolean }>("/api/trainer/materials")
        .catch(() => ({ courses: [] as MaterialsRow[], underReview: false })),
    ])
      .then(([qs, os, ps, ms]) => { setQuals(qs); setOffers(os); setProposals(ps); setMaterials(ms); setDown(false); })
      .catch(() => setDown(true)), []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => buildRows(quals ?? [], offers, proposals, now), [quals, offers, proposals, now]);
  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    for (const f of FILTERS) c[f.id] = f.keys.length === 0 ? rows.length : rows.filter((r) => f.keys.includes(r.state)).length;
    return c;
  }, [rows]);
  const view = useMemo(() => {
    const keys = FILTERS.find((f) => f.id === filter)?.keys ?? [];
    return paginate(
      rows
        .filter((r) => keys.length === 0 || keys.includes(r.state))
        .filter((r) => matchesQuery(q, [r.title, STATE[r.state].label, ...r.offers.map((o) => o.cohort?.title)])),
      page, 20,
    );
  }, [rows, filter, q, page]);

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

  if (down) {
    return (
      <TrainerLayout title="مؤهّلاتي">
        <EmptyState
          icon={ServerOff}
          titleAr="تعذّر الوصول إلى الخادم"
          reasonAr="لم يُجب الخادمُ على طلب مؤهّلاتك. تحقّق من اتصالك ثمّ أعد التحميل."
          actions={[{ labelAr: "أعد المحاولة", onClick: () => void load() }]}
        />
      </TrainerLayout>
    );
  }

  if (!quals) {
    return (
      <TrainerLayout title="مؤهّلاتي">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title="مؤهّلاتي">
      <p className="mb-5 max-w-3xl text-sm leading-7 text-muted-foreground">
        كلُّ دورةٍ أُهِّلتَ لها وحالُها: ما يُعرض عليك الآن فتقبله أو تعتذر عنه بسببٍ تكتبه، وما أُضيف إلى
        دوراتك، وما دُمج بدورةٍ قائمةٍ أو سُحب. والتأهيلُ للدورة لا للشعبة، والعرضُ دعوةٌ لا توجيه —
        والاعتذارُ جوابٌ مشروعٌ لا يُحسَب عليك.
      </p>

      <CourseMaterialsPanel rows={materials.courses} underReview={materials.underReview} onSaved={() => void load()} />

      {rows.length === 0 ? (
        /* وكانت تقول «تُؤهَّل تلقائيّا لكلّ دورةٍ ذكرتَها» — ودوراتُ طلبه قيد
           الإعداد لا مؤهَّلة، فكان النصُّ يَعِد بما لا يراه. فصار يقول أين هي. */
        materials.courses.some((c) => c.status === "pending") ? (
          <p className="text-sm leading-7 text-muted-foreground">
            تظهر دوراتُك هنا بعروضها وحالها حين نعتمد موادَّها — وحتّى ذلك الحين فهي في «موادُّ دوراتك» أعلاه.
          </p>
        ) : (
          <EmptyState
            icon={Award}
            titleAr="لا تأهيلَ بعد"
            reasonAr="تظهر هنا كلُّ دورةٍ نعتمد موادَّها لك. فإن كانت عندك دورةٌ تتقنها ولا تجدها في كتالوجنا، فاقترحها."
            actions={[{ to: "/trainer/course-proposals", labelAr: "دوراتي المقترحة", hintAr: "اقترح دورةً تقدر عليها" }]}
          />
        )
      ) : (
        <>
          {/* ═══ أين يُعدَّل محتوى الدورة بعد اعتمادها (٢ أكتوبر ٢٠٢٦) ═══

              بلاغُ صاحب المنصّة: «المدرّبُ يقول لا يستطيع تعديلَ دوراته من
              مؤهّلاتي». وكان ذلك بالتصميم ولا يقوله شيء: المحرّرُ يغيب حين
              تُعتمَد الموادّ، وجملةُ الخادم التي تدلّ على مساحة الشعبة لا تُرى
              لأنّ الزرَّ الذي يستدعيها غاب قبلها.

              وقرارُه: لا موضعَ ثانٍ للتعبئة — «المدرّبُ يعبّئ في شعبي، وهناك
              يتمّم الأمرَ قبل موافقة الأكاديميّة». فهذا السطرُ يقول ذلك ويدلّ
              عليه، ولا يفتح محرّرا هنا. */}
          <Inset tone="accent" className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-read leading-7">
              <PencilLine className="mt-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                هذه القائمةُ للقراءة والقرار. ومحتوى الدورة بعد اعتمادها — محاورُها ومواعيدُها وكرّاستُها
                ولقاءاتُها ومهامُّها ومصادرُها — تعبّئه في «شعبي» لكلّ شعبةٍ أُسندت إليك، ثمّ تُرسله
                لاعتمادنا.
              </span>
            </p>
            <Button as={Link} to="/trainer/board" size="sm" icon={Users}>افتح «شعبي»</Button>
          </Inset>
          <TabBar
            ariaLabel="حالُ مؤهّلاتي"
            className="mb-4"
            value={filter}
            onChange={(f) => { setFilter(f); setPage(1); }}
            items={FILTERS.map((f) => ({
              id: f.id,
              label: <>{f.label} <span className="tabular-nums opacity-70">({counts[f.id]})</span></>,
            }))}
          />
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="دورة"
            placeholder="ابحث باسم الدورة أو شعبتها…" />

          {view.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا دورةَ في هذا الباب.</p>
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
                />
              ))}
            </ul>
          )}
        </>
      )}
    </TrainerLayout>
  );
}

function CourseRow({
  row: r, now, busy, declining, reason, onDeclineStart, onDeclineCancel, onReason, run,
}: {
  row: Row; now: number; busy: boolean; declining: string | null; reason: string;
  onDeclineStart: (offerId: string) => void; onDeclineCancel: () => void; onReason: (v: string) => void;
  run: (work: () => Promise<unknown>, okAr: string) => Promise<void>;
}) {
  const st = STATE[r.state];
  const q = r.qual;
  const lead = r.offers.find((o) => o.status === "offered" && new Date(o.expiresAt).getTime() > now) ?? r.offers[0];
  const earlier = r.offers.filter((o) => o !== lead);
  const open = r.state === "open" && lead ? lead : null;

  return (
    /* ═══ ولماذا لا رمزَ للدورة في الصفّ ═══

       شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أسماءُ الدورات بدل رموزها».
       والرمزُ حُذف لا استُبدل — الاسمُ فوقه أصلا. وحين لا اسمَ في الكتالوج
       يُقال إنّ الاسمَ غائب، لا يُطبع الرمزُ بديلا. */
    <Card as="li" className={`p-4 ${open ? "border-gold/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <h2 className="min-w-0 flex-1 text-read font-bold leading-6 text-foreground">
          {r.title || "دورةٌ بلا اسمٍ في الكتالوج"}
        </h2>
        <Chip tone={st.tone} srPrefixAr="الحال">{st.label}</Chip>
      </div>

      <p className="mt-1 text-read leading-6 text-muted-foreground">
        {q ? <>النسخة {q.currentVersion} · أُهِّلت {fmtDate(q.qualifiedAt)}</> : "لا تأهيلَ قائمٌ لها الآن"}
        {lead?.cohort ? <> · شعبةُ «{lead.cohort.title}»{lead.cohort.startsAt ? ` تبدأ ${fmtDate(lead.cohort.startsAt)}` : ""}</> : null}
      </p>

      {/* ── أصلُ الدورة: اقتراحٌ دُمج أو أُضيف ── */}
      {r.origin && !lead ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {r.origin.status === "linked"
            ? `اقترحتَ «${r.origin.titleAr}» فدُمجت بهذه الدورة القائمة — فتصير نسختَك منها لا دورةً ثانية.`
            : `اقترحتَ «${r.origin.titleAr}» فأُضيفت إلى الكتالوج بهذا الاسم${r.origin.course?.status === "published" ? " وهي منشورة" : " ولمّا تُنشر بعدُ"}.`}
          {r.origin.decisionNoteAr ? ` ملحوظةُ الإدارة: ${r.origin.decisionNoteAr}` : ""}
        </p>
      ) : null}

      {lead ? <OfferBody offer={lead} now={now} /> : null}

      {/* ═══ أجلُ الإعداد — بعد القبول وحدَه ═══ */}
      {lead?.status === "accepted" && lead.prepDueAt && (
        <Inset
          tone={lead.prepConfirmedAt ? "positive" : lead.prepLapsedAt ? "warn" : "default"}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3"
        >
          <p className="text-sm leading-6">
            <CalendarClock className="ms-0 me-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
            {lead.prepConfirmedAt
              ? `أقررتَ بجاهزيّتك ${fmtDate(lead.prepConfirmedAt)}.`
              : `أجلُ إعدادك ${lead.prepDays} أيّام، وينتهي ${fmtDate(lead.prepDueAt)}.`}
            {!lead.prepConfirmedAt && lead.prepLapsedAt && " وقد انقضى — والإسنادُ قائمٌ كما هو، وتنظر فيه الإدارة."}
          </p>
          {!lead.prepConfirmedAt && (
            <Button
              tone="confirm" size="sm" icon={ClipboardCheck} disabled={busy}
              onClick={() => run(() => apiPost(`/api/trainer/offers/${lead.id}/prep-confirm`, {}), "سُجّل إقرارُك بالجاهزيّة")}
            >
              أقِرّ بجاهزيّتي
            </Button>
          )}
        </Inset>
      )}

      {/* ═══ القرار — والزرّان بحجمٍ واحد ═══ */}
      {open && declining !== open.id && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            tone="confirm" size="sm" icon={Check} disabled={busy}
            onClick={() => run(() => apiPost(`/api/trainer/offers/${open.id}/accept`, {}), "قبِلتَها — وأُسنِدت إليك")}
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
          <StaffField label="سببُ اعتذارك" hint="سطرٌ واحدٌ يكفي — يساعدنا أن نرتّب، ولا يُحسَب عليك">
            <input
              value={reason} maxLength={500} className={staffControlCls} autoFocus
              placeholder="مثلا: دمجتُها مع دورةٍ أخرى أدرّسها"
              onChange={(e) => onReason(e.target.value)}
            />
          </StaffField>
          <div className="flex flex-wrap gap-2">
            <Button
              tone="danger" size="sm" icon={X} disabled={busy || reason.trim().length < 5}
              onClick={() => run(
                () => apiPost(`/api/trainer/offers/${open.id}/decline`, { reasonAr: reason.trim() }),
                "وصل اعتذارُك",
              )}
            >
              أرسِل اعتذاري
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={onDeclineCancel}>تراجعْ</Button>
          </div>
        </Inset>
      )}

      {/* ── وما سبق من عروضٍ عليها — سجلٌّ يُفتح ولا يزاحم ── */}
      {earlier.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-fine font-bold text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
            عروضٌ سابقةٌ عليها ({earlier.length})
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
  if (o.status === "accepted") return "قبِلتَه";
  if (o.status === "declined") return `اعتذرتَ${o.declineReasonAr ? ` — ${o.declineReasonAr}` : ""}`;
  if (o.status === "withdrawn") return `سحبته الإدارة${o.withdrawReasonAr ? ` — ${o.withdrawReasonAr}` : ""}`;
  if (o.status === "lapsed") return "انقضت مهلتُه";
  return "ينتظر جوابك";
}

/** تفاصيلُ العرض الذي يحكم الحال — ما يُقرّر عليه، وما قيل فيه */
function OfferBody({ offer: o, now }: { offer: Offer; now: number }) {
  const open = o.status === "offered";
  const expired = open && new Date(o.expiresAt).getTime() <= now;
  const facts = [
    o.sessionsCount !== null ? { k: "الجلسات", v: String(o.sessionsCount) } : null,
    o.startsAt ? { k: "البداية", v: fmtDate(o.startsAt) } : null,
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
          مهلةُ الردّ تنتهي {fmtDate(o.expiresAt)} — {remainingAr(o.expiresAt, now)}.
        </p>
      )}
      {(o.status === "lapsed" || expired) && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          انقضت مهلةُ الردّ فأُغلق العرض. وهو ليس مأخذا عليك — راسِلِ الإدارةَ إن كنت ما زلت ترغب فيه.
        </p>
      )}
      {o.status === "withdrawn" && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          سحبتها الإدارة{o.withdrawReasonAr ? `: ${o.withdrawReasonAr}` : "."}
        </p>
      )}
      {o.status === "declined" && o.declineReasonAr && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">سببُ اعتذارك: {o.declineReasonAr}</p>
      )}
    </>
  );
}
