import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import {
  CalendarCheck, CheckCircle2, ChevronLeft, ClipboardList, FileText, KeyRound,
  Loader2, MailCheck, RefreshCw, ServerOff, Star, UserPlus, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import BulkBar from "@/components/admin/BulkBar";
import { bulkMessage, runBulk } from "@/application/admin/bulk";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, apiDelete, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { TrainerDetailOps, TrainerChangeRequests, TrainerPayouts, type TrainerSummary } from "./TrainerOps";
import ApplicationDossier, { type Dossier } from "./ApplicationDossier";
import { fmtDateTime } from "@/application/text/format-ar";
import ConfirmAction from "@/components/ConfirmAction";
import { ONE_CLICK_APPROVABLE_STATUSES } from "@/application/trainer/approval";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — لم يُكمل", email_verification_pending: "بانتظار تحقق البريد",
  submitted: "مُقدَّم", under_review: "قيد المراجعة",
  information_requested: "بانتظار معلومات المرشح", shortlisted: "مختار أولي",
  interview_scheduled: "مقابلة مجدولة", demo_requested: "بانتظار الديمو",
  academic_review: "مراجعة أكاديمية", conditionally_approved: "قبول مشروط",
  contract_pending: "عقد قيد التوقيع", onboarding: "تهيئة", active: "نشط",
  waitlisted: "انتظار", rejected: "مرفوض", withdrawn: "مسحوب", suspended: "موقوف",
};

const RUBRIC_AXES: { key: string; label: string }[] = [
  { key: "domain_expertise", label: "خبرة المجال" },
  { key: "evidence_of_expertise", label: "أدلة الخبرة" },
  { key: "explanation_facilitation", label: "الشرح والتيسير" },
  { key: "demo_quality", label: "جودة الديمو" },
  { key: "activity_assessment_design", label: "تصميم الأنشطة والتقييمات" },
  { key: "feedback_skill", label: "التغذية الراجعة" },
  { key: "digital_training", label: "التدريب الرقمي" },
  { key: "values_fit", label: "التوافق مع قيم وجيز" },
  { key: "availability", label: "التوفر" },
];

/* ما يصلح جماعيّا: قراراتُ الفرز التي تتكرّر على عشراتٍ في جلسةٍ واحدة.
   وما بعدها (المقابلة والدرس التجريبيّ والعقد) قرارٌ فرديّ بملفٍّ يُقرأ —
   لا يُجمَّع، ولو جُمّع لصار الاعتمادُ ختما لا مراجعة. */
const BULK_ACTIONS = ["move_to_review", "waitlist", "reject"];

/* القراران اللذان يُتَّخذان فعلا — وما عداهما توثيقٌ اختياريّ.

   كان الاعتمادُ ثمانَ نقراتٍ لا تُتّخذ إلا بالترتيب، وكلُّ واحدةٍ تُنسى.
   وبقرار صاحب المنصّة صار الاعتمادُ نقرةً واحدةً من أيّ حالة، وما عداه
   يجري خارج المنصّة. فهذان بارزان، والسلسلةُ التفصيليّةُ خلف مطويّة —
   لم يُحذف منها زرّ. */
const PRIMARY_ACTIONS = ["approve", "reject"];

const DECISIONS: { action: string; label: string; from: string[]; tone: "main" | "warn" | "danger" }[] = [
  { action: "approve", label: "اعتمِدْه مدرّبا — بنقرة", from: [...ONE_CLICK_APPROVABLE_STATUSES], tone: "main" },
  { action: "move_to_review", label: "بدء المراجعة", from: ["submitted", "waitlisted"], tone: "main" },
  { action: "request_info", label: "اطلب معلومات إضافية", from: ["under_review"], tone: "warn" },
  { action: "shortlist", label: "اختصار أولي", from: ["under_review"], tone: "main" },
  { action: "request_demo", label: "اطلب درسا تجريبيا", from: ["shortlisted", "interview_scheduled"], tone: "warn" },
  { action: "academic_review", label: "مراجعة أكاديمية", from: ["demo_requested"], tone: "main" },
  { action: "conditionally_approve", label: "قبول مشروط", from: ["academic_review"], tone: "main" },
  { action: "waitlist", label: "قائمة الانتظار", from: ["submitted", "under_review", "shortlisted", "interview_scheduled", "academic_review"], tone: "warn" },
  { action: "reject", label: "رفض بلطف", from: ["submitted", "under_review", "information_requested", "shortlisted", "interview_scheduled", "demo_requested", "academic_review", "conditionally_approved", "contract_pending", "waitlisted"], tone: "danger" },
  /* ─────────── آخرُ السلسلة — كان مفقودا ───────────

     كانت المصفوفةُ تنتهي عند «قبول مشروط»، فمن اجتاز المراجعةَ الأكاديميّة
     يبقى معلَّقا إلى الأبد ما لم يُنشئ حسابَه بنفسه من رابط الدعوة — أي أنّ
     آخرَ قرارٍ في مسار المدرّب لم يكن بيد الإدارة أصلا.

     والسلسلةُ الآن مكتملة: المديرُ الأكاديميّ يقيّم ويرفع، والاعتمادُ النهائيّ
     يجعله مدرّبا نشطا. والتفعيلُ يشترط حسابا — «نشطٌ» لا يستطيع الدخول حالةٌ
     تكذب على من يقرؤها. */
  { action: "start_onboarding", label: "ابدأ التهيئة", from: ["contract_pending"], tone: "main" },
  { action: "activate", label: "فعّله مدرّبا نشطا", from: ["onboarding"], tone: "main" },
  { action: "reinstate", label: "ارفع الإيقاف", from: ["suspended"], tone: "main" },
];

/** تبويبا الملفّ: من هو، وماذا يُدرّس — لا شاشةٌ واحدة تُقرأ عمودا طويلا */
type DetailTab = "dossier" | "courses";

interface AppRow {
  id: string; reference: string; status: string; fullName: string; email: string;
  country: string | null; jobTitle: string | null; domainYears: string | null; trainingYears: string | null;
  specialties: string[]; createdAt: string; emailVerified: boolean; phase2Done: boolean;
  documentsCount: number; reviewsCount: number; interviewsCount: number;
}

interface AppDetail extends Record<string, unknown> {
  id: string; reference: string; status: string; fullName: string; email: string;
  jobTitle: string | null; country: string | null;
  motivation: string | null; bio: string | null; linkedinUrl: string | null;
  documents: { id: string; kind: string; originalName: string; storageKey: string }[];
  documentUrls: Record<string, string>;
  reviews: { id: string; scores: Record<string, number>; overallNote: string | null; createdAt: string }[];
  interviews: { id: string; scheduledAt: string; outcome: string | null }[];
  statusHistory: { fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  profile: { id: string; userId: string | null } | null;
  /** حسابُ المتقدّم — يُنشأ مع القسم الأوّل */
  userId: string | null;
  summary?: TrainerSummary;
}

/* لوحُ الملخّص وتبويبُ الدورات.

   قرارُ صاحب المنصّة: «أضف لوحةَ ملخّص على ملفّ المدرب تعرض: الدورات المحالة
   له، تقييمات الطلبة له، شعبه الحالية، وأقرب جلسة قادمة».

   وأرقامُه من الخادم لا من الشاشة (`getApplication#summary`): من يبتّ في حالةٍ
   ينظر إلى أثرها — من له ثلاثُ شعبٍ جارية ليس كمن لا شعبةَ له، والقرارُ فيهما
   ليس واحدا. وحسابُها هنا يعني رقمين لشيءٍ واحد. */
function TrainerCoursesTab({ summary }: { summary?: TrainerSummary }) {
  if (!summary) {
    return (
      <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-xs leading-6 text-muted-foreground">
        لا ملفَّ مدرّبٍ بعد — الملفُّ يُنشأ مع «القبول المشروط»، وقبله لا دورات ولا شعب.
      </article>
    );
  }
  const stat = (label: string, value: string) => (
    <div className="rounded-2xl border border-white/10 bg-paper/20 p-3.5">
      <p className="text-micro font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-foreground">{value}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h4 className="flex items-center gap-2 text-sm font-black">
          <Star className="h-4 w-4 text-teal-light-ink" /> ملخّص المدرّب
        </h4>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
          {stat("دورات مؤهَّل لها", String(summary.qualifiedCourses.length))}
          {stat("شعبٌ حاليّة", String(summary.cohorts.length))}
          {stat("متعلّمون", String(summary.cohorts.reduce((n, c) => n + c.enrolled, 0)))}
          {/* لا يُعرض صفرٌ مكان «لا تقييم بعد» — الصفرُ حكمٌ والغيابُ ليس حكما */}
          {stat("تقييم الطلبة", summary.ratingCount > 0 && summary.rating !== null
            ? `${summary.rating.toFixed(1)} · ${summary.ratingCount}`
            : "—")}
        </div>
        {summary.nextSession && (
          <p className="mt-3 rounded-xl border border-teal/30 bg-teal/[0.07] px-3.5 py-2.5 text-[11.5px] leading-6 text-teal-light-ink">
            أقرب جلسة: <b>{summary.nextSession.title}</b> — شعبة «{summary.nextSession.cohortTitle}» ·{" "}
            {fmtDateTime(new Date(summary.nextSession.startsAt))}
          </p>
        )}
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h4 className="text-sm font-black">الدورات المؤهَّل لها</h4>
        {summary.qualifiedCourses.length === 0 ? (
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            لا دورة بعد. التأهيل يُطلب من الشعبة التي يُراد إسنادُه إليها، وموافقةُ المدير الأكاديميّ
            تؤهّله وتُسنده في فعلٍ واحد.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {summary.qualifiedCourses.map((c) => (
              <li key={c.courseId} className="rounded-full border border-teal/35 bg-teal/[0.08] px-3 py-1 text-[11px] font-bold text-teal-light-ink">
                {c.titleAr}
              </li>
            ))}
          </ul>
        )}
        {summary.pendingQualifications > 0 && (
          <p className="mt-3 text-[11px] text-gold-ink">
            وله {summary.pendingQualifications} طلبُ تأهيلٍ بانتظار القرار.
          </p>
        )}
      </article>

      <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h4 className="text-sm font-black">شعبُه الحاليّة</h4>
        {/* «المُسنَدُ له فعليّا» يُقرأ من كائن الشعبة لا من ملفّ المدرّب:
            مصدرُ الإسناد هناك، وقراءتُه من هنا تُنشئ مصدرا ثانيا يشيخ. */}
        {summary.cohorts.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">لا شعبة مُسنَدة إليه الآن.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.cohorts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-paper/20 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold text-foreground">{c.title}</span>
                  <span className="text-micro text-muted-foreground">
                    {c.courseTitle} · {c.role === "lead" ? "رئيسي" : "مساعد"} · {c.enrolled} متعلّم
                  </span>
                </span>
                <span className="shrink-0 text-micro text-muted-foreground">
                  {c.startsAt ? fmtDateTime(new Date(c.startsAt)) : "بلا موعد"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

/** إدارة طلبات انضمام المدربين — API حقيقي: مراجعة بشرية، قرارات، عقد، دعوة آمنة */
export default function TrainerApplications() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  /* التحديدُ يبقى عبر الصفحات والبحث — والشريطُ يقول على كم يقع، فلا يُنفَّذ
     على صفٍّ غاب عن العين بلا علمِ صاحب القرار. */
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState("");
  /* رفضٌ أو انتظارٌ على دفعةٍ: كلاهما يصل صاحبَ الطلب، فسببُه يُكتب أوّلا */
  const [bulkDecision, setBulkDecision] = useState<{ action: string; labelAr: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppDetail | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeReason, setPurgeReason] = useState("");
  const [tab, setTab] = useState<DetailTab>("dossier");
  const { user } = useRealSession();
  /* رابط الدعوة بعد إنشائها — يُعرض للمسؤول ليسلّمه حين لا يصل البريد */
  const [invite, setInvite] = useState<{ url: string; delivery: string } | null>(null);
  const [mode, setMode] = useState<"apps" | "changes" | "payouts">("apps");

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setOffline(null); }
    try {
      const rows = await apiGet<AppRow[]>(`/api/admin/trainer-applications${filter ? `?status=${filter}` : ""}`);
      setApps(rows);
    } catch (err) {
      if (!silent) setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — شغّل واجهة API أولا");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  /* نبض صامت كل دقيقة — طلبات الترشح الجديدة تظهر دون تحديث يدوي */
  const silentReload = useCallback(() => { void load(true); }, [load]);
  useAutoRefresh(silentReload, 60_000);

  const openDetail = async (id: string) => {
    try {
      const detail = await apiGet<AppDetail>(`/api/admin/trainer-applications/${id}`);
      setSelected(detail);
      setScores({}); setNote("");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر فتح الطلب");
    }
  };

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast(doneMsg);
      if (selected) await openDetail(selected.id);
      await load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  };

  /* الحالةُ تُرشَّح في الخادم، والبحثُ هنا على ما وصل */
  const view = paginate(
    apps.filter((a) => matchesQuery(q, [a.fullName, a.email, a.reference, a.jobTitle, ...a.specialties])),
    page, 20);

  const toggleSel = (id: string) => setSel((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /* لا يُعرض إلّا ما يصلح للمحدَّد **كلِّه**: إجراءٌ يصلح لبعضه يُنتج إخفاقا
     جزئيّا لا سببَ له إلّا أنّا عرضناه. */
  const selectedRows = apps.filter((a) => sel.has(a.id));
  const commonActions = selectedRows.length === 0 ? [] :
    DECISIONS.filter((d) => BULK_ACTIONS.includes(d.action) && selectedRows.every((a) => d.from.includes(a.status)));

  /* السببُ يأتي من نافذة التأكيد لا من حوار متصفّح — و**لا يُقرأ من حالة
     الصفحة**: `note` أعلاه هو نصُّ مراجعةِ طلبٍ واحدٍ في نموذجٍ آخر، وخلطُه
     بالقرار الجماعيّ يُرسل ملاحظةَ مراجعٍ إلى عشراتٍ لم تُكتب لهم. */
  const bulkDecide = async (action: string, labelAr: string, decisionNote?: string) => {
    if (busy || sel.size === 0) return;
    setBusy(true); setBulkProgress("");
    const outcome = await runBulk(
      [...sel],
      (id) => apiPost(`/api/admin/trainer-applications/${id}/decision`, { action, note: decisionNote }),
      (done, total) => setBulkProgress(`${done} من ${total}`),
    );
    setBulkProgress("");
    setSel(new Set(outcome.failed.map((f) => f.id)));
    toast(bulkMessage(outcome, `نُفّذ «${labelAr}»`));
    setBusy(false);
    await load();
  };

  if (offline) {
    return (
      <AdminLayout title="طلبات انضمام المدربين">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-foreground hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  /* ── عرض التفاصيل ── */
  if (selected) {
    const a = selected;
    const available = DECISIONS.filter((d) => d.from.includes(a.status));
    const primary = available.filter((d) => PRIMARY_ACTIONS.includes(d.action));
    const detailed = available.filter((d) => !PRIMARY_ACTIONS.includes(d.action));
    const decisionButton = (d: (typeof DECISIONS)[number]) => (
      <button
        key={d.action} disabled={busy}
        onClick={() => void act(
          () => apiPost(`/api/admin/trainer-applications/${a.id}/decision`, { action: d.action, note: note || undefined }),
          "نُفذ القرار وسُجل في الأثر",
        )}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-2.5 text-xs font-black transition disabled:opacity-40 ${
          d.tone === "main" ? "bg-gold text-on-gold hover:bg-gold/90"
            : d.tone === "warn" ? "border border-gold/50 text-gold-ink hover:bg-gold/10"
            : "border border-white/15 text-muted-foreground hover:border-red-400/40 hover:text-red-300"
        }`}
      >
        {d.tone === "danger" ? <XCircle className="h-3.5 w-3.5" /> : d.action === "request_demo" ? <CalendarCheck className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {d.label}
      </button>
    );
    const rubricComplete = RUBRIC_AXES.every((x) => scores[x.key] >= 1);
    return (
      <AdminLayout title={`الطلب ${a.reference}`}>
        <button onClick={() => setSelected(null)} className="mb-4 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-teal-light-ink hover:text-teal-ink">
          <ChevronLeft className="h-4 w-4" /> كل الطلبات
        </button>


        {/* ── الحذف النهائيّ ──

            الطلبُ المنتهي كان يبقى في القاعدة أبدا، فبقيت طلباتُ الاختبار
            في الإنتاج بلا سبيلٍ إلى إزالتها. والحبّةُ منفصلة عن المراجعة:
            من يراجع ليس بالضرورة من يمحو. */}
        {(user?.permissions.includes("trainer.applications.purge") ?? false)
          && ["draft", "email_verification_pending", "rejected", "withdrawn"].includes(a.status) && (
          <details className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-4">
            <summary className="cursor-pointer text-xs font-black text-red-300">حذفٌ نهائيّ لهذا الطلب</summary>
            <p className="mt-2 text-[11.5px] leading-6 text-foreground">
              يُحذف الطلبُ ومستنداتُه ومراجعاتُه ولا يُستردّ. ويبقى أثرُ الحذف في سجلّ
              التدقيق: من حذف، ومتى، ولماذا. ولا يُحذف طلبُ من صار مدرّبا.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={purgeReason}
                onChange={(e) => setPurgeReason(e.target.value)}
                placeholder="سبب الحذف (مطلوب)"
                aria-label="سبب الحذف النهائي"
                className="min-w-[18rem] flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/75 focus:border-red-500/50"
              />
              <button
                type="button"
                disabled={purging || purgeReason.trim().length < 5}
                onClick={async () => {
                  setPurging(true);
                  try {
                    await apiDelete(`/api/admin/trainer-applications/${encodeURIComponent(a.reference)}`, { reasonAr: purgeReason.trim() });
                    setPurgeReason("");
                    setSelected(null);
                    toast(`حُذف الطلب ${a.reference} نهائيّا.`);
                    await load();
                  } catch (e) {
                    toastError(e instanceof ApiError ? e.message : "تعذّر الحذف");
                  } finally {
                    setPurging(false);
                  }
                }}
                className="rounded-lg bg-red-500/85 px-4 py-1.5 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-40"
              >
                {purging ? "يُحذف…" : "احذفه نهائيّا"}
              </button>
            </div>
          </details>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* تبويبان لا عمودٌ طويل.

                قرارُ صاحب المنصّة: «أعد بناء الصفحة كتبويبين: (أ) الملفّ
                والمعلومات — بيانات المتقدّم والمقابلة والدرس التجريبيّ
                والمراجع. (ب) الدورات — الدورات المرشَّح لها».

                وسببُه ظاهرٌ في الشاشة: من يبتّ يقرأ سبعةَ صناديق متتالية
                ليجد ما يخصّ سؤاله، وأكثرُها لا يخصّه. */}
            <div className="flex gap-1.5" role="tablist" aria-label="أقسام الملفّ">
              {([["dossier", "الملفّ والمعلومات"], ["courses", "الدورات والشعب"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition ${
                    tab === key ? "bg-gold text-on-gold" : "border border-white/12 text-muted-foreground hover:border-white/30 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "courses" ? (
              <TrainerCoursesTab summary={a.summary} />
            ) : (
            <>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{a.fullName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.jobTitle ?? "—"} · {a.country ?? "—"}
                    {(() => {
                      const labels: Record<string, string> = { employed: "موظف", own_business: "عمل خاص", full_time_training: "متفرغ للتدريب" };
                      const emp = labels[(a as Record<string, unknown>).employmentStatus as string];
                      return emp ? ` · ${emp}` : "";
                    })()}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{a.email}</p>
                </div>
                <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
              {a.bio && <p className="mt-4 text-xs leading-6 text-foreground">{a.bio}</p>}
              {a.motivation && (
                <p className="mt-3 rounded-xl border border-white/5 bg-paper/20 p-3 text-xs leading-6 text-foreground">
                  <span className="font-bold text-muted-foreground">لماذا وجيز؟ </span>{a.motivation}
                </p>
              )}

              {/* الملفّ كاملا — كان المراجع يقرّر على نصف الطلب.

                  الخادمُ يُرسل كلَّ ما ملأه المتقدّم؛ الشاشةُ وحدها كانت
                  تُسقط الهاتفَ وحالتَه المهنيّة وخبرةَ التدريب والدوراتِ
                  التي يستطيع تدريسها وتوفّرَه وموافقتَه على الدرس
                  التجريبيّ ولغاتِ تدريبه ونمطَه. */}
              <div className="mt-5">
                <ApplicationDossier a={a as unknown as Dossier} />
              </div>
            </article>

            {/* الوثائق الخاصة */}
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h4 className="flex items-center gap-2 text-sm font-black"><FileText className="h-4 w-4 text-teal-light-ink" /> الوثائق — روابط موقعة تنتهي خلال دقائق</h4>
              {a.documents.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">لم يرفع المرشح وثائق بعد.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {a.documents.map((d) => (
                    <li key={d.id}>
                      <a href={a.documentUrls[d.storageKey]} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-paper/20 p-3 text-xs text-foreground transition hover:border-teal/40">
                        <FileText className="h-4 w-4 text-teal-light-ink" />
                        <span className="font-bold">{d.kind}</span>
                        <span dir="ltr" className="text-muted-foreground">{d.originalName}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {/* سجل الحالات */}
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h4 className="flex items-center gap-2 text-sm font-black"><ClipboardList className="h-4 w-4 text-teal-light-ink" /> سجل الحالة</h4>
              <ol className="mt-3 space-y-2">
                {a.statusHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                    <b className="text-foreground">{STATUS_LABELS[h.toStatus] ?? h.toStatus}</b>
                    {h.note && <span>— {h.note}</span>}
                    <span className="mr-auto text-muted-foreground/50">{fmtDateTime(new Date(h.createdAt))}</span>
                  </li>
                ))}
              </ol>
            </article>

            {/* عمليات متقدمة: مقابلات، ديمو، مراجع، عقود */}
            <TrainerDetailOps app={a} onAction={act} />
            </>
            )}
          </div>

          {/* عمود القرارات والروبرك */}
          <div className="space-y-4">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">الروبرك — تسعة محاور (١–٥)</h4>
              <div className="mt-3 space-y-2">
                {RUBRIC_AXES.map((x) => (
                  <div key={x.key} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{x.label}</span>
                    <div className="flex gap-1" role="radiogroup" aria-label={x.label}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v} type="button" onClick={() => setScores({ ...scores, [x.key]: v })}
                          aria-pressed={scores[x.key] === v}
                          className={`grid h-7 w-7 cursor-pointer place-items-center rounded-lg border text-[11px] font-bold transition ${
                            scores[x.key] === v ? "border-gold bg-gold text-on-gold" : "border-white/15 text-muted-foreground hover:border-white/40"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ملاحظة المراجع…"
                aria-label="ملاحظة المراجع"
                className="mt-3 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
              />
              <button
                disabled={!rubricComplete || busy}
                onClick={() => void act(() => apiPost(`/api/admin/trainer-applications/${a.id}/reviews`, { scores, overallNote: note || undefined }), "سُجل التقييم")}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-teal py-2.5 text-xs font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40"
              >
                <Star className="h-3.5 w-3.5" /> سجّل التقييم
              </button>
              <p className="mt-2 text-center text-micro text-muted-foreground">{a.reviews.length} تقييم مسجل</p>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">القرار — بشري بالكامل</h4>
              <div className="mt-3 space-y-2">
                {available.length === 0 && <p className="text-xs text-muted-foreground">لا إجراءات متاحة في هذه الحالة.</p>}
                {primary.map((d) => decisionButton(d))}
                {primary.some((d) => d.action === "approve") && (
                  <p className="pt-0.5 text-center text-micro leading-5 text-muted-foreground">
                    الاعتمادُ ينشئ ملفَّه، ويفتح بوّابتَه بحسابه نفسِه، ويُعلمه بالبريد.
                  </p>
                )}
              </div>

              {/* السلسلةُ التفصيليّة — لمن أراد توثيقَ مقابلةٍ أو عقد.
                  مطويّةٌ لا محذوفة: الطلباتُ العالقةُ في منتصفها تُكمَل منها. */}
              {detailed.length > 0 && (
                <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <summary className="cursor-pointer text-[11.5px] font-black text-muted-foreground">
                    خطواتٌ تفصيليّة ({detailed.length}) — اختياريّة
                  </summary>
                  <p className="mt-2 text-micro leading-5 text-muted-foreground">
                    لا يلزم شيءٌ منها للاعتماد. تُستعمل حين تريد أن يبقى أثرُ المقابلة
                    أو الدرس التجريبيّ أو العقد في سجلّ الطلب.
                  </p>
                  <div className="mt-3 space-y-2">{detailed.map((d) => decisionButton(d))}</div>
                </details>
              )}

              {/* للمتقدّم حسابٌ منذ تقديمه: التفعيلُ يربطه — فلا زرَّ دعوةٍ له */}
              {a.status === "onboarding" && !a.profile?.userId && a.userId && (
                <p className="mt-3 rounded-xl border border-teal/30 bg-teal/[0.05] p-3 text-[11px] leading-6 text-foreground">
                  للمتقدّم حسابٌ منذ تقديمه — «فعّله مدرّبا نشطا» يربط حسابه بملفّه ويفتح له بوّابة المدربين مباشرة.
                </p>
              )}
              {a.status === "onboarding" && !a.profile?.userId && !a.userId && (
                <button
                  disabled={busy}
                  onClick={() => void act(async () => {
                    /* الرابط يُعرض للمسؤول دائما لا في التطوير وحده: كان يُحجب في
                       الإنتاج انتظارا لقناة بريد لا وجود لها، فتُنشأ الدعوة ولا
                       يملك رمزَها أحد — أي أن الحساب لا يُفتح أبدا. البريد يُرسل
                       الآن، وهذه نسخة تُسلَّم باليد حين لا تصل الرسالة. */
                    const r = await apiPost<{ expiresAt: string; acceptUrl: string; emailDelivery: string; invitationToken: string }>(
                      `/api/admin/trainer-applications/${a.id}/invitations`,
                    );
                    setInvite({ url: r.acceptUrl, delivery: r.emailDelivery });
                  }, "أُنشئت الدعوة الآمنة")}
                  className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-teal/50 py-2.5 text-xs font-black text-teal-light-ink transition hover:bg-teal/10 disabled:opacity-40"
                >
                  <KeyRound className="h-3.5 w-3.5" /> أرسل دعوة إنشاء الحساب
                </button>
              )}
              {invite && a.status === "onboarding" && !a.profile?.userId && !a.userId && (
                <div className="mt-3 rounded-xl border border-teal/35 bg-teal/[0.06] p-3">
                  <p className="text-[11px] font-black text-teal-light-ink">
                    {invite.delivery === "sent"
                      ? "أُرسلت الدعوة إلى بريد المدرب — وهذه نسخة الرابط إن لم تصله"
                      : invite.delivery === "not_configured"
                        ? "قناة البريد غير مفعّلة — سلّم هذا الرابط للمدرب بنفسك"
                        : "تعذّر إرسال البريد — سلّم هذا الرابط للمدرب بنفسك"}
                  </p>
                  <code dir="ltr" className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-paper/40 p-2 font-mono text-micro text-foreground">
                    {invite.url}
                  </code>
                  <p className="mt-1.5 text-micro text-muted-foreground">يُستخدم مرة واحدة ويسقط بعد ٧٢ ساعة.</p>
                </div>
              )}
              {a.profile?.userId && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-teal-light-ink">
                  <MailCheck className="h-3.5 w-3.5" /> الحساب مُنشأ ومرتبط بالملف
                </p>
              )}
            </article>
          </div>
        </div>
      </AdminLayout>
    );
  }

  /* ── القائمة ── */
  return (
    <AdminLayout title="طلبات انضمام المدربين">
      <FlowSteps steps={[
        { label: "تقديم الطلب", actor: "المدرب" },
        { label: "فرز أولي", actor: "أنت هنا" },
        { label: "مقابلة", actor: "اللجنة الأكاديمية" },
        { label: "درس تجريبي وتقييمه", actor: "اللجنة الأكاديمية" },
        { label: "اعتماد أو اعتذار", actor: "أنت — ويُبلَّغ تلقائياً" },
      ]} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-white/15 p-1">
          {([["apps", "الطلبات"], ["changes", "اقتراحات تعديل الدورات"], ["payouts", "مستحقات المدربين"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition ${mode === k ? "bg-gold text-on-gold" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        {mode === "apps" && (
          <>
            <select
              value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="رشّح بالحالة"
              className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground [&>option]:bg-surface"
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-muted-foreground hover:border-white/40">
              <RefreshCw className="h-3.5 w-3.5" /> تحديث
            </button>
          </>
        )}
      </div>

      {mode === "changes" && <TrainerChangeRequests />}
      {mode === "payouts" && <TrainerPayouts />}
      {mode === "apps" && (loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : apps.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <UserPlus className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بهذه الحالة</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            طلبات نموذج «انضم مدربا» تصل هنا مباشرة عبر قاعدة البيانات فور إرسالها.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="طلبا"
            placeholder="ابحث باسمٍ أو بريدٍ أو رقمِ طلبٍ أو تخصّص…" />
          <BulkBar count={sel.size} busy={busy} progress={bulkProgress} onClear={() => setSel(new Set())}>
            {commonActions.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">
                لا إجراءَ يصلح للمحدَّد كلِّه — الحالاتُ مختلفة، فاختر ما يتّحد حالُه.
              </span>
            ) : commonActions.map((d) => (
              <button key={d.action}
                onClick={() => (d.action === "reject" || d.action === "waitlist"
                  ? setBulkDecision({ action: d.action, labelAr: d.label })
                  : void bulkDecide(d.action, d.label))}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-black transition ${
                  d.tone === "danger" ? "border border-red-400/40 text-red-300 hover:bg-red-400/10" : "bg-gold text-on-gold hover:bg-gold/90"
                }`}>
                {d.label} — على {sel.size}
              </button>
            ))}
          </BulkBar>
          {view.total === 0 && (
            <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">
              لا طلب يطابق «{q.trim()}».
            </p>
          )}
          {view.rows.map((a) => (
            <div key={a.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white/[0.03] p-5 transition ${sel.has(a.id) ? "border-gold/45" : "border-white/10 hover:border-teal/40"}`}
            >
              {/* المربّعُ خارج الزرّ لا داخله: زرٌّ في زرّ لا يصحّ، ونقرةٌ
                  على التحديد كانت تفتح الملفّ. */}
              {/* الوسمُ حولَه هو الهدف: مربّعٌ بستّةَ عشرَ بكسلا يُخطئه الإصبع،
                  والوسمُ يمنحه ٣٢×٣٢ بلا أن يُكبَّر المربّعُ نفسُه. */}
              <label className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center">
                <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggleSel(a.id)}
                  aria-label={`حدّد طلب ${a.fullName}`} className="h-4 w-4 shrink-0 cursor-pointer accent-gold" />
              </label>
            <button
              onClick={() => void openDetail(a.id)}
              className="flex flex-1 cursor-pointer flex-wrap items-center justify-between gap-3 text-right"
            >
              <div>
                <p className="font-black">{a.fullName} <span className="mr-2 font-mono text-micro text-muted-foreground" dir="ltr">{a.reference}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.specialties.join(" · ") || "—"} · خبرة مجال {a.domainYears ?? "—"} · {a.jobTitle ?? "—"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {a.emailVerified ? "بريد متحقق ✓" : "بريد غير متحقق"} · {a.documentsCount} وثيقة · {a.reviewsCount} تقييم · {a.interviewsCount} مقابلة
                  {a.phase2Done ? " · أكمل المرحلة الثانية" : ""}
                </p>
              </div>
              <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">
                {STATUS_LABELS[a.status] ?? a.status}
              </span>
            </button>
            </div>
          ))}
        </div>
      ))}

      {bulkDecision && (
        <ConfirmAction
          titleAr={`«${bulkDecision.labelAr}» على ${sel.size} طلبَ انضمام`}
          confirmLabelAr={`${bulkDecision.labelAr} — على ${sel.size}`}
          busy={busy}
          reason={{ labelAr: "السببُ — يصل صاحبَ كلّ طلبٍ كما تكتبه، ويبقى في الأثر", minLength: 5 }}
          onCancel={() => setBulkDecision(null)}
          onConfirm={(reason) => {
            const target = bulkDecision;
            setBulkDecision(null);
            void bulkDecide(target.action, target.labelAr, reason);
          }}
        >
          <p>يُطبَّق القرارُ على المحدَّد كلِّه، ويُخبَر أصحابُه. والسببُ واحدٌ للجميع — فاكتبه عامّا يصلح لكلّ من يقرؤه.</p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}
