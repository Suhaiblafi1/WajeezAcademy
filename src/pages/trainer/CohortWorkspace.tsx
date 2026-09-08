/* صفحةُ الشعبة — ملكُ مدرّبها، بمرحلتين: التجهيزُ ثمّ التشغيل.

   ═══ ما كان ═══

   للمدرّب أن **يقترح** تعديلا من صفحة «اقتراحاتي»، فينتظر في طابورٍ عند
   الإدارة. ثمّ صارت «ورشةً» يعدّل فيها كلَّ شيءٍ عدا السعر ويرسلها للاعتماد
   (٨ سبتمبر ٢٠٢٦) — لكنّ تشغيلَها (الحضورُ والموادُّ والتكاليفُ والرسائل)
   بقي في شاشة «شعبي»، فسأل صاحبُ المنصّة: «أين المصادر وأين تفاصيل
   الواجبات؟ أرى فقط عنوانا».

   ═══ القرار (٨ سبتمبر ٢٠٢٦) ═══

   صفحةٌ واحدةٌ للشعبة، ومراحلُ ينجزها المدرّبُ واحدةً بعد الأخرى على خطٍّ
   يمتلئ — لا قائمةُ تحقّقٍ مسطّحة:

     التجهيز:  ① الاسمُ والمواعيد → ② المحاور → ③ المصادر → ④ اللقاءات
               → ⑤ التكاليف → ⑥ الاعتماد
     التشغيل:  الحضورُ والاجتماعُ والتسجيلاتُ والرسائلُ والموادُّ والتسليمات

   والحلقةُ في الرأس تقول كم أُنجز، والمرحلةُ التالية مضاءةٌ بالذهبيّ،
   والمكتملةُ بعلامة، وباعتماد الإدارة تستقرّ شارةُ «شعبةٌ معتمَدة» بحركةٍ
   واحدةٍ هادئة. أسلوبٌ مؤسّسيّ: لا نقاطَ ولا أوسمةَ ولا مقارنةَ بغيره —
   الشعبةُ نفسُها هي اللعبة، وإتمامُها هو الفوز.

   ═══ ثلاثةُ حرّاسٍ تحكم الشكل ═══

   • `staff-surface`: المتنُ أربعةَ عشر — `text-read` لا `text-xs` في فقرة.
   • `design-system`: لا سطحَ مكتوبا بيده — `Panel` و`Card` و`Inset` وحدَها.
   • `one-primary-per-screen`: ذهبيٌّ واحد — «أرسلها للاعتماد». */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight, BookOpen, CalendarDays, Check, ClipboardCheck, ClipboardList, FileText, Link2, Loader2, Lock, Send, Sparkles, Video,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import TrainerSchedule from "./TrainerSchedule";
import CohortOps from "./CohortOps";
import { apiGet, apiPatch, apiPost, apiPut, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import ProgressRing from "@/components/ui/ProgressRing";
import { controlCls, areaCls } from "@/components/FormKit";
import DayOfWeekPicker from "@/components/DayOfWeekPicker";
import { daysLabelAr, fmtDateAr, fmtDateTimeAr } from "@/utils/format";

/* ─────────── ما يصل من الخادم ─────────── */

interface PlanModule { moduleId: string; titleAr: string; outcomeAr?: string | null; activityAr?: string | null; artifactAr?: string | null; bodyAr?: string | null }
interface PlanResource { title: string; url: string; noteAr?: string | null }
interface PlanContent { kind: "trainer"; summaryAr?: string | null; modules: PlanModule[]; resources: PlanResource[]; liveNoteAr?: string | null }
interface Workspace {
  role: string;
  trainer: { name: string };
  cohort: {
    id: string; title: string; status: string; startsAt: string | null; endsAt: string | null; daysOfWeek: string[];
    startTime: string | null; timezone: string | null; language: string; deliveryMode: string;
    readOnly: { price: number | null; currency: string; capacity: number | null };
  };
  course: { id: string; titleAr: string; baseModules: PlanModule[] };
  plan: {
    id: string; status: string; content: PlanContent | null; reviewerNote: string | null;
    submittedAt: string | null; trainerConfirmedAt: string | null; reviewedAt: string | null;
  } | null;
  sessions: { id: string; title: string; startsAt: string; endsAt: string | null; status: string; joinUrl: string | null; recordings: { id: string; title: string; externalUrl: string | null; readUrl: string | null }[] }[];
  materials: { id: string; title: string; kind: string; externalUrl: string | null; readUrl: string | null }[];
  learners: { enrollmentId: string; name: string; status: string; progress: number; referredByMe: boolean }[];
  assessments: { id: string; title: string; type: string; maxScore: number; dueAt: string | null; status: string; submissions: number }[];
  checklist: { key: string; labelAr: string; done: boolean; optional: boolean }[];
}

const PLAN_STATUS_AR: Record<string, { label: string; tone: "default" | "accent" | "positive" | "warn" }> = {
  draft: { label: "مسودّة — لم تُرسَل بعد", tone: "default" },
  submitted: { label: "بانتظار اعتماد الإدارة", tone: "accent" },
  changes_requested: { label: "طُلبت تعديلات — راجع الملاحظة وأعد الإرسال", tone: "warn" },
  approved: { label: "معتمَدة — الشعبة جاهزة", tone: "positive" },
  published: { label: "منشورة", tone: "positive" },
  superseded: { label: "نسخةٌ قديمة", tone: "default" },
};

/* المراحلُ الستّ — بترتيبها على الخطّ. ومفاتيحُها مفاتيحُ قائمة الخادم، فحالةُ
   كلٍّ (تمّ / لم يتمّ) تُقرأ من هناك لا تُخمَّن هنا. و«التسجيلات» الاختياريّةُ
   تُطوى داخل «اللقاءات»: مرحلةٌ واحدةٌ لهما. */
type Stage = "identity" | "modules" | "resources" | "sessions" | "assignments" | "approval";
const STAGES: { key: Stage; label: string; icon: typeof BookOpen }[] = [
  { key: "identity", label: "الاسم والمواعيد", icon: ClipboardList },
  { key: "modules", label: "المحاور", icon: BookOpen },
  { key: "resources", label: "المصادر", icon: FileText },
  { key: "sessions", label: "اللقاءات", icon: CalendarDays },
  { key: "assignments", label: "التكاليف", icon: ClipboardCheck },
  { key: "approval", label: "الاعتماد", icon: Send },
];
type Phase = "prepare" | "run";
const ASSESSMENT_TYPES: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع تخرج" };

/** التاريخُ كما يقبله `<input type="date">` */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function CohortWorkspace() {
  const { id } = useParams();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState<Phase>("prepare");
  const [stage, setStage] = useState<Stage>("identity");
  const [busy, setBusy] = useState(false);

  /* النسخةُ التي يحرّرها — تبدأ من الخطّة إن كانت، وإلّا من محاور الكتالوج */
  const [content, setContent] = useState<PlanContent | null>(null);
  const [identity, setIdentity] = useState({ title: "", startsAt: "", endsAt: "", daysOfWeek: [] as string[], startTime: "", language: "", deliveryMode: "remote" });
  const [confirm, setConfirm] = useState(false);
  const [recLink, setRecLink] = useState<Record<string, { title: string; url: string }>>({});
  const [taskForm, setTaskForm] = useState({ title: "", type: "assignment", maxScore: 100, dueAt: "" });
  /* رابطُ دعوتي لهذه الشعبة — يُنشأ مرّةً عند أوّل طلبٍ ويبقى */
  const [referral, setReferral] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (first = false) => {
    if (!id) return;
    try {
      const w = await apiGet<Workspace>(`/api/trainer/cohorts/${id}/workspace`);
      setWs(w);
      apiGet<{ code: string; url: string }>(`/api/trainer/cohorts/${id}/referral-link`).then(setReferral).catch(() => setReferral(null));
      setContent(w.plan?.content ?? { kind: "trainer", summaryAr: "", modules: w.course.baseModules, resources: [], liveNoteAr: "" });
      setIdentity({
        title: w.cohort.title, startsAt: toDateInput(w.cohort.startsAt), endsAt: toDateInput(w.cohort.endsAt),
        daysOfWeek: w.cohort.daysOfWeek, startTime: w.cohort.startTime ?? "", language: w.cohort.language, deliveryMode: w.cohort.deliveryMode,
      });
      /* أوّلُ فتح: المعتمَدةُ تُفتح على التشغيل، وغيرُها على أوّل مرحلةٍ لم تتمّ */
      if (first) {
        const status = w.plan?.status ?? "draft";
        if (status === "approved" || status === "published") setPhase("run");
        else {
          const next = w.checklist.find((c) => !c.done && !c.optional && STAGES.some((s) => s.key === c.key));
          setStage((next?.key as Stage) ?? "identity");
        }
      }
    } catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر فتح صفحة الشعبة"); }
  }, [id]);
  useEffect(() => { void load(true); }, [load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(done); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  };

  if (err) {
    return (
      <TrainerLayout title="صفحة الشعبة">
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
        <Link to="/trainer/board" className="mt-4 inline-flex items-center gap-2 text-read font-bold text-teal-light-ink"><ArrowRight className="h-4 w-4" /> إلى شعبي</Link>
      </TrainerLayout>
    );
  }
  if (!ws || !content) {
    return (
      <TrainerLayout title="صفحة الشعبة">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>
      </TrainerLayout>
    );
  }

  const planStatus = ws.plan?.status ?? "draft";
  const st = PLAN_STATUS_AR[planStatus] ?? PLAN_STATUS_AR.draft;
  const locked = planStatus === "submitted";
  const approved = planStatus === "approved" || planStatus === "published";
  /* حالةُ كلّ مرحلةٍ من قائمة الخادم — والمفتاحُ واحدٌ هنا وهناك */
  const byKey = new Map(ws.checklist.map((c) => [c.key, c]));
  const required = ws.checklist.filter((c) => !c.optional);
  const doneCount = required.filter((c) => c.done).length;
  const remaining = required.length - doneCount;
  const ready = required.length ? Math.round((doneCount / required.length) * 100) : 0;
  const nextStage = STAGES.find((s) => { const c = byKey.get(s.key); return c && !c.done && !c.optional; }) ?? null;
  const recordingsDone = byKey.get("recordings")?.done ?? false;

  const openStage = (s: Stage) => { setPhase("prepare"); setStage(s); };
  const savePlan = () => act(() => apiPut(`/api/trainer/cohorts/${ws.cohort.id}/plan`, content), "حُفظت مسودّتك");
  const saveIdentity = () => act(() => apiPatch(`/api/trainer/cohorts/${ws.cohort.id}`, {
    title: identity.title.trim(),
    startsAt: identity.startsAt ? new Date(identity.startsAt).toISOString() : undefined,
    endsAt: identity.endsAt ? new Date(identity.endsAt).toISOString() : undefined,
    daysOfWeek: identity.daysOfWeek, startTime: identity.startTime || undefined,
    language: identity.language, deliveryMode: identity.deliveryMode,
  }), "حُفظت بياناتُ الشعبة");
  const submit = () => act(() => apiPost(`/api/trainer/cohorts/${ws.cohort.id}/plan/submit`, { confirm }), "أُرسلت للاعتماد — يصلك القرار هنا وبالبريد");
  const createAssessment = () => act(async () => {
    await apiPost(`/api/trainer/cohorts/${ws.cohort.id}/assessments`, {
      title: taskForm.title.trim(), type: taskForm.type, maxScore: taskForm.maxScore,
      ...(taskForm.dueAt ? { dueAt: new Date(taskForm.dueAt).toISOString() } : {}),
    });
    setTaskForm({ title: "", type: "assignment", maxScore: 100, dueAt: "" });
  }, "أُنشئ التكليف — يظهر للمسجلين ويعود إليك تسليمهم في طابور المراجعة");

  const setModule = (i: number, patch: Partial<PlanModule>) =>
    setContent({ ...content, modules: content.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const whenLine = [
    ws.cohort.startsAt ? `تبدأ ${fmtDateAr(ws.cohort.startsAt)}` : "بلا موعدِ بدءٍ بعد",
    daysLabelAr(ws.cohort.daysOfWeek) || null,
    ws.cohort.startTime ? `الساعة ${ws.cohort.startTime}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <TrainerLayout title={`شعبة «${ws.cohort.title}»`}>
      <style>{`
        @keyframes stage-seal { 0% { opacity: 0; transform: scale(.85) } 60% { opacity: 1; transform: scale(1.04) } 100% { opacity: 1; transform: scale(1) } }
        .stage-seal { animation: stage-seal .7s cubic-bezier(.2,.9,.3,1.2) both; }
        .stage-fill { transition: width .8s cubic-bezier(.22,1,.36,1); }
      `}</style>

      <Link to="/trainer/board" className="mb-4 inline-flex items-center gap-2 text-read font-bold text-teal-light-ink hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> شعبي
      </Link>

      {/* ═══ الرأس: أين وصلت الشعبة ═══ */}
      <Panel as="section" tone={st.tone} className="mb-5">
        <div className="flex flex-wrap items-start gap-5">
          <ProgressRing value={ready} label={`${doneCount}/${required.length}`} caption="تجهيز" size={76} />
          <div className="min-w-0 flex-1">
            <p className="text-read font-bold text-muted-foreground">{ws.course.titleAr}</p>
            <h2 className="mt-0.5 text-xl font-black leading-snug">{ws.cohort.title}</h2>
            <p className="mt-1 text-read text-muted-foreground">{whenLine} · {ws.learners.length} التحقوا · {ws.sessions.length} لقاء</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {approved ? (
                <span className="stage-seal inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-read font-black text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> شعبةٌ معتمَدة
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-read font-bold text-foreground">{st.label}</span>
              )}
              {!approved && nextStage && (
                <Button tone="secondary" size="sm" type="button" onClick={() => openStage(nextStage.key)}>
                  التالي: {nextStage.label}
                </Button>
              )}
            </div>
          </div>
        </div>
        {ws.plan?.reviewerNote && planStatus === "changes_requested" && (
          <Inset tone="warn" className="mt-4">
            <p className="text-read font-black text-gold-ink">ملاحظةُ الإدارة</p>
            <p className="mt-1 whitespace-pre-line text-read leading-7 text-foreground">{ws.plan.reviewerNote}</p>
          </Inset>
        )}

        {/* ═══ خطُّ المراحل — يمتلئ بقدر ما أُنجز، والمرحلةُ التالية مضاءة ═══ */}
        <div className="relative mt-5">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8.3%] top-5 hidden h-1 rounded-full bg-white/10 md:block">
            <div className="stage-fill h-full rounded-full bg-teal" style={{ width: `${ready}%` }} />
          </div>
          <ol className="grid gap-2 md:grid-cols-6">
            {STAGES.map((s, i) => {
              const item = byKey.get(s.key);
              const done = item?.done ?? false;
              const optional = item?.optional ?? false;
              const isNext = nextStage?.key === s.key;
              const selected = phase === "prepare" && stage === s.key;
              return (
                <li key={s.key} className="relative">
                  <button
                    type="button"
                    onClick={() => openStage(s.key)}
                    aria-current={selected ? "step" : undefined}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-start transition md:flex-col md:items-center md:gap-2 md:text-center ${selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-sm font-black transition ${
                      done ? "border-teal bg-teal text-on-teal"
                        : isNext ? "border-gold bg-gold/15 text-gold-ink shadow-[0_0_0_4px_rgba(250,188,5,0.15)]"
                        : "border-white/15 bg-surface text-muted-foreground"
                    }`}>
                      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-read font-bold leading-5 ${done || isNext || selected ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                      <span className="block text-fine leading-4 text-muted-foreground">
                        {done ? "تمّ" : isNext ? "التالي" : optional ? "اختياريّ" : "لم يتمّ بعد"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Panel>

      {/* ═══ المرحلتان ═══ */}
      <TabBar
        ariaLabel="مرحلتا الشعبة"
        className="mb-5"
        items={[
          { id: "prepare", label: <span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden="true" />التجهيز</span> },
          { id: "run", label: <span className="inline-flex items-center gap-2"><Video className="h-4 w-4" aria-hidden="true" />التشغيل</span> },
        ]}
        value={phase}
        onChange={setPhase}
      />

      {phase === "prepare" && locked && stage !== "approval" && (
        <Inset tone="accent" className="mb-4 flex items-start gap-2 text-read leading-6">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          خطّتك بانتظار الاعتماد — لا تُعدَّل حتّى يصل القرار. ولو أردت تعديلها الآن، اطلب من الإدارة ردَّها إليك.
        </Inset>
      )}

      {/* ─────────── ① الاسم والمواعيد ─────────── */}
      {phase === "prepare" && stage === "identity" && (
        <Panel as="section">
          <h3 className="flex items-center gap-2 text-sm font-black"><ClipboardList className="h-4 w-4 text-teal-light-ink" /> اسمُ الشعبة ومواعيدُها</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">اسم الشعبة</span>
              <input value={identity.title} onChange={(e) => setIdentity({ ...identity, title: e.target.value })} disabled={locked} className={controlCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">تبدأ في</span>
              <input type="date" dir="ltr" value={identity.startsAt} onChange={(e) => { setIdentity({ ...identity, startsAt: e.target.value }); e.target.blur(); }} disabled={locked} className={`${controlCls} text-left`} />
            </label>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">تنتهي في</span>
              <input type="date" dir="ltr" value={identity.endsAt} onChange={(e) => { setIdentity({ ...identity, endsAt: e.target.value }); e.target.blur(); }} disabled={locked} className={`${controlCls} text-left`} />
            </label>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">أيّام اللقاءات</span>
              <DayOfWeekPicker value={identity.daysOfWeek} onChange={(daysOfWeek) => setIdentity({ ...identity, daysOfWeek })} />
            </div>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">وقت البدء</span>
              <input type="time" dir="ltr" value={identity.startTime} onChange={(e) => setIdentity({ ...identity, startTime: e.target.value })} disabled={locked} className={`${controlCls} text-left`} />
            </label>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">نمط التقديم</span>
              <select value={identity.deliveryMode} onChange={(e) => setIdentity({ ...identity, deliveryMode: e.target.value })} disabled={locked} className={`${controlCls} [&>option]:bg-surface`}>
                <option value="remote">عن بُعد</option>
                <option value="in_person">حضوريّ</option>
                <option value="hybrid">مدمج</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">لغة التدريب</span>
              <input value={identity.language} onChange={(e) => setIdentity({ ...identity, language: e.target.value })} disabled={locked} className={controlCls} />
            </label>
          </div>
          {/* السعرُ يُقرأ ولا يُكتب — ويُقال لماذا، لا يُخفى */}
          <Inset className="mt-4 flex items-start gap-2 text-read leading-6 text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              السعرُ والسعةُ بيد الإدارة: {ws.cohort.readOnly.price === null ? "لم يُحدَّد بعد" : <b dir="ltr" className="font-mono text-foreground">{ws.cohort.readOnly.price} {ws.cohort.readOnly.currency}</b>}
              {ws.cohort.readOnly.capacity ? <> · السعة {ws.cohort.readOnly.capacity}</> : null}. وما تقبضه عن كلّ متعلّم في «مستحقاتي».
            </span>
          </Inset>
          <Button tone="confirm" disabled={busy || locked || identity.title.trim().length < 3} onClick={saveIdentity} className="mt-4">احفظ البيانات</Button>
        </Panel>
      )}

      {/* ─────────── ② المحاور والتطبيق ─────────── */}
      {phase === "prepare" && stage === "modules" && (
        <Panel as="section">
          <h3 className="flex items-center gap-2 text-sm font-black"><BookOpen className="h-4 w-4 text-teal-light-ink" /> المحاور والتطبيق العمليّ</h3>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            تبدأ من محاور الكتالوج وتعدّلها كما تراها لهذه الشعبة — العنوان، والمخرج، والتطبيق العمليّ، وما يُسلّمه المتعلّم، والمتن. ولا تمسّ الكتالوجَ نفسَه.
          </p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-read font-bold text-muted-foreground">وصفٌ موجزٌ للشعبة (يقرؤه المتعلّم)</span>
            <textarea rows={2} value={content.summaryAr ?? ""} onChange={(e) => setContent({ ...content, summaryAr: e.target.value })} disabled={locked} className={areaCls} />
          </label>
          {content.modules.length === 0 && (
            <Inset tone="warn" className="mt-4 text-read leading-6 text-gold-ink">لا محاورَ لهذه الدورة في الكتالوج بعد — أضف محورا أدناه وابدأ منه.</Inset>
          )}
          <ol className="mt-4 space-y-3">
            {content.modules.map((m, i) => (
              <Card as="li" key={m.moduleId}>
                <p className="text-read font-black text-teal-light-ink">المحور {i + 1} <span className="font-mono text-muted-foreground">{m.moduleId}</span></p>
                <div className="mt-3 grid gap-3">
                  <input value={m.titleAr} onChange={(e) => setModule(i, { titleAr: e.target.value })} disabled={locked} placeholder="عنوان المحور" aria-label={`عنوان المحور ${i + 1}`} className={controlCls} />
                  <textarea rows={2} value={m.outcomeAr ?? ""} onChange={(e) => setModule(i, { outcomeAr: e.target.value })} disabled={locked} placeholder="ما يخرج به المتعلّم من هذا المحور" aria-label={`مخرج المحور ${i + 1}`} className={areaCls} />
                  <textarea rows={2} value={m.activityAr ?? ""} onChange={(e) => setModule(i, { activityAr: e.target.value })} disabled={locked} placeholder="التطبيق العمليّ — ماذا يفعل المتعلّم بيده" aria-label={`تطبيق المحور ${i + 1}`} className={areaCls} />
                  <input value={m.artifactAr ?? ""} onChange={(e) => setModule(i, { artifactAr: e.target.value })} disabled={locked} placeholder="ما يُسلّمه المتعلّم (اختياريّ)" aria-label={`مُسلَّم المحور ${i + 1}`} className={controlCls} />
                  <textarea rows={3} value={m.bodyAr ?? ""} onChange={(e) => setModule(i, { bodyAr: e.target.value })} disabled={locked} placeholder="متن المحور (اختياريّ)" aria-label={`متن المحور ${i + 1}`} className={areaCls} />
                </div>
              </Card>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="secondary" disabled={locked} onClick={() => setContent({ ...content, modules: [...content.modules, { moduleId: `${ws.course.id}-T${content.modules.length + 1}`, titleAr: "" }] })}>+ محور</Button>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-read font-bold text-muted-foreground">ملاحظاتٌ عن اللقاءات المباشرة (اختياريّ)</span>
            <textarea rows={2} value={content.liveNoteAr ?? ""} onChange={(e) => setContent({ ...content, liveNoteAr: e.target.value })} disabled={locked} className={areaCls} />
          </label>
          <Button tone="confirm" disabled={busy || locked || content.modules.some((m) => m.titleAr.trim().length < 2)} onClick={savePlan} className="mt-4">احفظ المحاور</Button>
        </Panel>
      )}

      {/* ─────────── ③ المصادر ─────────── */}
      {phase === "prepare" && stage === "resources" && (
        <Panel as="section">
          <h3 className="flex items-center gap-2 text-sm font-black"><FileText className="h-4 w-4 text-teal-light-ink" /> المصادر</h3>
          <p className="mt-1 text-read leading-6 text-muted-foreground">روابطُ ما يحتاجه المتعلّم — كرّاسة، أو مقال، أو فيديو. وما ترفعه ملفّا من «التشغيل» يظهر تحتها.</p>
          <ul className="mt-4 space-y-3">
            {content.resources.map((r, i) => (
              <Card as="li" key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input value={r.title} onChange={(e) => setContent({ ...content, resources: content.resources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} disabled={locked} placeholder="اسم المصدر" aria-label={`اسم المصدر ${i + 1}`} className={controlCls} />
                <input dir="ltr" value={r.url} onChange={(e) => setContent({ ...content, resources: content.resources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} disabled={locked} placeholder="https://…" aria-label={`رابط المصدر ${i + 1}`} className={`${controlCls} text-left`} />
                <Button tone="ghost" size="sm" disabled={locked} onClick={() => setContent({ ...content, resources: content.resources.filter((_, j) => j !== i) })}>أزل</Button>
              </Card>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="secondary" disabled={locked} onClick={() => setContent({ ...content, resources: [...content.resources, { title: "", url: "" }] })}>+ مصدر</Button>
            <Button tone="confirm" disabled={busy || locked || content.resources.some((r) => !r.title.trim() || !/^https?:\/\//.test(r.url))} onClick={savePlan}>احفظ المصادر</Button>
          </div>
          {ws.materials.length > 0 && (
            <ul className="mt-5 space-y-1.5 text-read">
              {ws.materials.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <a href={m.readUrl ?? m.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="text-teal-light-ink underline decoration-dotted underline-offset-4">{m.title}</a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* ─────────── ④ اللقاءات والتسجيلات ─────────── */}
      {phase === "prepare" && stage === "sessions" && (
        <div className="space-y-5">
          {/* الجدولةُ بيده داخلَ نافذة الإدارة */}
          <TrainerSchedule cohortId={ws.cohort.id} onDone={() => void load()} />
          <Panel as="section">
            <h3 className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-light-ink" /> الجلسات المسجّلة — من رابط <span className="text-read font-bold text-muted-foreground">({recordingsDone ? "أُضيفت" : "اختياريّ"})</span></h3>
            <p className="mt-1 text-read leading-6 text-muted-foreground">ألصق رابطَ التسجيل (يوتيوب، أو درايف، أو زووم) على لقائه — لا حاجةَ لرفع ملفّ.</p>
            {ws.sessions.length === 0 ? (
              <p className="mt-3 text-read text-muted-foreground">لا لقاءاتٍ بعد — أضفها أعلاه أوّلا.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {ws.sessions.map((s) => {
                  const form = recLink[s.id] ?? { title: "", url: "" };
                  return (
                    <Card as="li" key={s.id}>
                      <p className="text-read font-black">{s.title} <span className="font-normal text-muted-foreground">· {fmtDateTimeAr(s.startsAt)}</span></p>
                      {s.recordings.length > 0 && (
                        <ul className="mt-2 space-y-1 text-read">
                          {s.recordings.map((r) => (
                            <li key={r.id}><a href={r.readUrl ?? r.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="text-teal-light-ink underline decoration-dotted underline-offset-4">{r.title}</a></li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input value={form.title} onChange={(e) => setRecLink({ ...recLink, [s.id]: { ...form, title: e.target.value } })} placeholder="اسم التسجيل" aria-label={`اسم تسجيل ${s.title}`} className={controlCls} />
                        <input dir="ltr" value={form.url} onChange={(e) => setRecLink({ ...recLink, [s.id]: { ...form, url: e.target.value } })} placeholder="https://…" aria-label={`رابط تسجيل ${s.title}`} className={`${controlCls} text-left`} />
                        <Button tone="secondary" size="sm" disabled={busy || form.title.trim().length < 2 || !/^https?:\/\//.test(form.url)}
                          onClick={() => act(() => apiPost(`/api/trainer/sessions/${s.id}/recording-link`, { title: form.title.trim(), url: form.url.trim() }).then(() => setRecLink({ ...recLink, [s.id]: { title: "", url: "" } })), "أُضيف التسجيل")}>
                          أضف
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* ─────────── ⑤ التكاليف ─────────── */}
      {phase === "prepare" && stage === "assignments" && (
        <Panel as="section">
          <h3 className="flex items-center gap-2 text-sm font-black"><ClipboardCheck className="h-4 w-4 text-gold-ink" /> تكاليفُ الشعبة — واجباتُها ومشروعُها</h3>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            ما تؤلّفه هنا يصل المسجّلين، ويعود إليك تسليمُهم في طابور المراجعة. مرحلةٌ اختياريّةٌ عند الإرسال — وتُنصح بواحدٍ على الأقلّ يُسلَّم.
          </p>
          {ws.assessments.length === 0 ? (
            <p className="mt-3 text-read text-muted-foreground">لا تكليفَ في هذه الشعبة بعد — وما تؤلّفه أدناه يظهر هنا.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {ws.assessments.map((a) => (
                <Inset as="li" key={a.id} className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-read font-bold text-foreground">{a.title}</p>
                  <p className="shrink-0 text-read text-muted-foreground">
                    {ASSESSMENT_TYPES[a.type] ?? a.type} · من {a.maxScore}
                    {a.dueAt && <> · يُسلَّم قبل {fmtDateTimeAr(a.dueAt)}</>}
                    {" · "}سلّم {a.submissions}
                  </p>
                </Inset>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto_auto_auto]">
            <input aria-label="عنوان التكليف" placeholder="عنوان الواجب أو المشروع" value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className={controlCls} />
            <select aria-label="نوع التكليف" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })} className={`${controlCls} [&>option]:bg-surface`}>
              {Object.entries(ASSESSMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" dir="ltr" aria-label="آخر موعد للتسليم" value={taskForm.dueAt} onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} className={`${controlCls} text-left`} />
            <Button tone="confirm" disabled={busy || taskForm.title.trim().length < 3} onClick={createAssessment}>أنشئ التكليف</Button>
          </div>
        </Panel>
      )}

      {/* ─────────── ⑥ الاعتماد ─────────── */}
      {phase === "prepare" && stage === "approval" && (
        <Panel as="section" tone={st.tone}>
          <h3 className="flex items-center gap-2 text-sm font-black"><Send className="h-4 w-4 text-teal-light-ink" /> الموافقة والإرسال للاعتماد</h3>
          <p className="mt-2 text-read leading-7 text-foreground">
            بإرسالك تقرّ أنّك راجعتَ كلَّ ما في الشعبة ووافقتَ عليه: اسمَها ومواعيدَها، ومحاورَها وتطبيقَها العمليّ، ومصادرَها، ومواعيدَ لقاءاتها المباشرة، وتكاليفَها، وجلساتِها المسجّلة إن وُجدت. ثمّ يعتمدها المديرُ الأكاديميُّ أو المديرُ الأعلى — ويصلك القرارُ هنا وبالبريد.
          </p>
          {ws.plan?.submittedAt && <p className="mt-2 text-read text-muted-foreground">آخرُ إرسال: {fmtDateTimeAr(ws.plan.submittedAt)}{ws.plan.reviewedAt ? ` · آخرُ قرار: ${fmtDateTimeAr(ws.plan.reviewedAt)}` : ""}</p>}
          {remaining > 0 && !approved && (
            <Inset tone="warn" className="mt-3 text-read leading-6 text-gold-ink">بقي {remaining} من المراحل قبل الإرسال — المضاءةُ بالذهبيّ على الخطّ أعلاه هي التالية.</Inset>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-read leading-6">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={locked || approved} className="mt-1 h-4 w-4 accent-teal" />
            <span>أوافق على كلّ ما في هذه الشعبة — مواعيدَها ومحاورَها ومصادرَها ولقاءاتِها وتكاليفَها وتسجيلاتِها — وأتحمّل تقديمَها كما هي.</span>
          </label>
          <Button tone="primary" disabled={busy || locked || !confirm || remaining > 0 || approved} onClick={submit} className="mt-4">
            <Send className="h-4 w-4" /> أرسلها للاعتماد
          </Button>
        </Panel>
      )}

      {/* ═══ التشغيل ═══ */}
      {phase === "run" && (
        <div className="space-y-5">
          {/* رابطُ دعوتك — لهذه الشعبة وحدَك: تنشره في صفحاتك، وكلُّ من سجّل منه
              يُحسب لك بأجر الإحالة، وتراه بعلامة «عبر رابطك» عند اسمه. */}
          {referral && (
            <Panel as="section">
              <p className="flex items-center gap-2 text-sm font-black"><Link2 className="h-4 w-4 text-teal-light-ink" /> رابطُ دعوتك لهذه الشعبة</p>
              <p className="mt-1 text-read leading-6 text-muted-foreground">انشره حيث شئت — كلُّ من سجّل منه يُحسب لك، وتراه بعلامة «عبر رابطك» عند اسمه وفي «مستحقاتي».</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input readOnly dir="ltr" value={referral.url} aria-label="رابط الدعوة" onFocus={(e) => e.currentTarget.select()} className={`${controlCls} min-w-0 flex-1 text-left font-mono`} />
                <Button tone="secondary" onClick={() => { void navigator.clipboard?.writeText(referral.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>
                  {copied ? "نُسخ" : "انسخ الرابط"}
                </Button>
              </div>
            </Panel>
          )}
          <CohortOps cohortId={ws.cohort.id} onAuthorAssignment={() => openStage("assignments")} />
        </div>
      )}
    </TrainerLayout>
  );
}
