/* عمليات إدارة المدربين المتقدمة — مقابلات ونتائجها، تقييم الديمو، مراجع مهنية،
   عقود وتوقيع، تأهيل وإسناد ونشر عام وإيقاف، ومراجعة اقتراحات تعديل الدورات.
   كلها API حقيقي من admin-trainer.routes. */
import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, BadgeCheck, Banknote, Briefcase, CalendarCheck, CheckCircle2, ChevronDown, FileSignature,
  Globe, Info, Loader2, Settings2, Star, UserCheck, XCircle, Zap,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { LEDGER_CURRENCY } from "@/application/commerce/presentment"

const inputCls = "w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-[#38A7B4] focus:outline-none";
const selectCls = `${inputCls} [&>option]:bg-surface`;

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

const CR_STATUS_AR: Record<string, string> = {
  submitted: "مُقدم", in_review: "قيد المراجعة", changes_requested: "مطلوب تعديل",
  approved_for_cohort: "معتمد للشعبة", approved_for_catalog: "معتمد للكتالوج",
  published: "منشور", rejected: "مرفوض", withdrawn: "مسحوب", scheduled: "مجدول للنشر",
};

function Card({ icon: Icon, title, children, defaultOpen = false }: {
  icon: typeof Star; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Panel as="article">
      <button onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center justify-between text-sm font-black">
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-teal-light-ink" /> {title}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </Panel>
  );
}

function RubricInput({ scores, onChange }: { scores: Record<string, number>; onChange: (s: Record<string, number>) => void }) {
  return (
    <div className="space-y-2">
      {RUBRIC_AXES.map((x) => (
        <div key={x.key} className="flex items-center justify-between gap-2">
          <span className="text-micro text-muted-foreground">{x.label}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={x.label}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} type="button" onClick={() => onChange({ ...scores, [x.key]: v })}
                aria-pressed={scores[x.key] === v}
                className={`grid h-6 w-6 cursor-pointer place-items-center rounded-md border text-micro font-bold transition ${
                  scores[x.key] === v ? "border-gold bg-gold text-on-gold" : "border-white/15 text-muted-foreground hover:border-white/40"
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** ملخّصُ المدرّب كما يحسبه الخادم — لا تُستنتج أرقامُه في الشاشة */
export interface TrainerSummary {
  qualifiedCourses: { courseId: string; titleAr: string }[];
  pendingQualifications: number;
  cohorts: {
    id: string; title: string; role: string; status: string;
    courseTitle: string; enrolled: number; startsAt: string | null;
  }[];
  nextSession: { title: string; startsAt: string; cohortTitle: string } | null;
  rating: number | null;
  ratingCount: number;
  publicVisibility: boolean;
  suspendedAt: string | null;
}

/** بطاقات التفاصيل المتقدمة لطلب مدرب — تُركب داخل صفحة التفاصيل */
export function TrainerDetailOps({ app, onAction }: {
  app: {
    id: string; status: string;
    interviews: { id: string; scheduledAt: string; outcome: string | null }[];
    profile: { id: string; userId: string | null } | null;
    summary?: TrainerSummary;
  };
  onAction: (fn: () => Promise<unknown>, doneMsg: string) => Promise<void>;
}) {
  const [interviewForm, setInterviewForm] = useState({ scheduledAt: "", mode: "remote", notes: "" });
  const [demoScores, setDemoScores] = useState<Record<string, number>>({});
  const [demoDecision, setDemoDecision] = useState("pass");
  const [demoNotes, setDemoNotes] = useState("");
  const [refForm, setRefForm] = useState({ name: "", relation: "", contact: "", note: "" });
  const [verifyId, setVerifyId] = useState("");
  const [contractForm, setContractForm] = useState({ title: "", terms: "" });
  const [lastContractId, setLastContractId] = useState("");

  const demoComplete = RUBRIC_AXES.every((x) => demoScores[x.key] >= 1);

  return (
    <>
      {/* المقابلات */}
      <Card icon={CalendarCheck} title={`المقابلات (${app.interviews.length})`}>
        <div className="space-y-3">
          {app.interviews.map((iv) => (
            <Inset key={iv.id} className="text-xs">
              <p className="font-bold">{fmtDateTime(new Date(iv.scheduledAt))} — {iv.outcome ?? "بلا نتيجة"}</p>
              {!iv.outcome && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([["passed", "ناجح"], ["hold", "تعليق"], ["failed", "راسب"]] as const).map(([o, label]) => (
                    <Button tone="secondary" size="sm" key={o} onClick={() => void onAction(
                      () => apiPost(`/api/admin/trainer-interviews/${iv.id}/outcome`, { outcome: o }),
                      "سُجلت نتيجة المقابلة",
                    )} className="text-micro">
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </Inset>
          ))}
          <div className="grid gap-2 sm:grid-cols-3">
            <input type="datetime-local" value={interviewForm.scheduledAt}
              onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })} className={inputCls} />
            <select value={interviewForm.mode} onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })} className={selectCls}>
              <option value="remote">عن بعد</option>
              <option value="in_person">حضوري</option>
            </select>
            <input value={interviewForm.notes} onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
              placeholder="ملاحظات (اختياري)" className={inputCls} />
          </div>
          <Button tone="confirm" size="sm" disabled={!interviewForm.scheduledAt}
            onClick={() => void onAction(
              () => apiPost(`/api/admin/trainer-applications/${app.id}/interviews`, {
                scheduledAt: new Date(interviewForm.scheduledAt), mode: interviewForm.mode, notes: interviewForm.notes || undefined,
              }),
              "جُدولت المقابلة وانتقل الطلب",
            )}>
            جدولة مقابلة
          </Button>
        </div>
      </Card>

      {/* تقييم الديمو */}
      <Card icon={Star} title="تقييم الدرس التجريبي (Demo)">
        <RubricInput scores={demoScores} onChange={setDemoScores} />
        <div className="mt-3 flex flex-wrap gap-2">
          {([["pass", "يجتاز"], ["retry", "يعيد"], ["fail", "لا يجتاز"]] as const).map(([d, label]) => (
            <button key={d} type="button" onClick={() => setDemoDecision(d)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-micro font-bold transition ${demoDecision === d ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <textarea value={demoNotes} onChange={(e) => setDemoNotes(e.target.value)} rows={2} placeholder="ملاحظات التقييم…" className={`${inputCls} mt-3`} />
        <Button tone="confirm" size="sm" disabled={!demoComplete}
          onClick={() => void onAction(
            () => apiPost(`/api/admin/trainer-applications/${app.id}/demo-evaluations`, {
              scores: demoScores, decision: demoDecision, notes: demoNotes || undefined,
            }),
            "سُجل تقييم الديمو",
          )} className="mt-3">
          سجّل تقييم الديمو
        </Button>
      </Card>

      {/* المراجع المهنية */}
      <Card icon={UserCheck} title="المراجع المهنية">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={refForm.name} onChange={(e) => setRefForm({ ...refForm, name: e.target.value })} placeholder="اسم المرجع" className={inputCls} />
          <input value={refForm.relation} onChange={(e) => setRefForm({ ...refForm, relation: e.target.value })} placeholder="العلاقة (مدير سابق…)" className={inputCls} />
          <input value={refForm.contact} onChange={(e) => setRefForm({ ...refForm, contact: e.target.value })} placeholder="وسيلة التواصل" className={inputCls} />
          <input value={refForm.note} onChange={(e) => setRefForm({ ...refForm, note: e.target.value })} placeholder="ملاحظة" className={inputCls} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button tone="confirm" size="sm" disabled={refForm.name.trim().length < 2}
            onClick={() => void onAction(
              () => apiPost(`/api/admin/trainer-applications/${app.id}/references`, {
                name: refForm.name, relation: refForm.relation || undefined,
                contact: refForm.contact || undefined, note: refForm.note || undefined,
              }),
              "أُضيف المرجع",
            )}>
            أضف مرجعا
          </Button>
          <input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} placeholder="معرف مرجع للتوثيق (UUID)" dir="ltr" className={`${inputCls} max-w-56 font-mono`} />
          <Button tone="secondary" size="sm" disabled={!verifyId.trim()}
            onClick={() => void onAction(() => apiPost(`/api/admin/trainer-references/${verifyId.trim()}/verify`), "وُثق المرجع")}>
            توثيق
          </Button>
        </div>
      </Card>

      {/* العقد */}
      <Card icon={FileSignature} title="العقد والتوقيع">
        <div className="flex flex-wrap gap-2">
          <input value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
            placeholder="عنوان العقد — عقد تدريب 2026" className={`${inputCls} flex-1`} />
          <Button tone="confirm" size="sm" disabled={contractForm.title.trim().length < 3}
            onClick={() => void onAction(async () => {
              const c = await apiPost<{ id: string }>(`/api/admin/trainer-applications/${app.id}/contracts`, { title: contractForm.title });
              setLastContractId(c.id);
            }, "أُنشئ العقد وأُرسل — الطلب في contract_pending")}>
            أنشئ وأرسل
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={lastContractId} onChange={(e) => setLastContractId(e.target.value)} placeholder="معرف العقد (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
          <Button tone="secondary" size="sm" disabled={!lastContractId.trim()}
            onClick={() => void onAction(() => apiPost(`/api/admin/trainer-contracts/${lastContractId.trim()}/sign`), "سُجل التوقيع — الطلب في التهيئة")}>
            سجّل التوقيع
          </Button>
        </div>
      </Card>

      {/* الشعبُ المؤهَّل لها — عرضٌ لا تحكّم.

          كانت هنا أربعةُ أفعال: تأهيلٌ وإسنادٌ ونشرٌ وإيقاف. وثلاثةٌ منها في
          غير موضعها:

          · **التأهيلُ والإسناد** انتقلا إلى الشعبة (`CohortOps`)، حيث يقع
            القرارُ فعلا. وكانا هنا بحقلَي «معرّف شعبة (UUID)» يُكتبان يدا —
            أي أنّ من يُسند يجب أن يعرف معرّفا لا اسما.
          · **النشرُ والإيقاف** انتقلا إلى شاشة الطلبات، حيث بقيّةُ قرارات
            دورة حياة المدرّب — فلا يُتّخذ قرارُ حالةٍ في مكانين.

          وما بقي هنا هو ما تُجيب عنه هذه الشاشة وحدَها: **لأيّ الدورات هو
          مؤهَّل**. وأمّا «مُسنَدٌ إلى ماذا» فيُقرأ من الشعبة نفسِها لا من
          ملفّه، فمصدرُ الإسناد هناك. */}
      {app.profile && (
        <Card icon={Briefcase} title="الدورات المؤهَّل لها" defaultOpen={app.status === "active"}>
          {(app.summary?.qualifiedCourses?.length ?? 0) === 0 ? (
            <p className="text-micro leading-6 text-muted-foreground">
              لا دورة مؤهَّلا لها بعد. التأهيل يُطلب من الشعبة التي يُراد إسنادُه إليها — وموافقة المدير
              الأكاديميّ تؤهّله وتُسنده في فعلٍ واحد.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {app.summary!.qualifiedCourses.map((c) => (
                <li key={c.courseId} className="rounded-full border border-teal/35 bg-teal/[0.08] px-3 py-1 text-micro font-bold text-teal-light-ink">
                  {c.titleAr}
                </li>
              ))}
            </ul>
          )}
          {(app.summary?.pendingQualifications ?? 0) > 0 && (
            <p className="mt-2.5 text-micro text-gold-ink">
              وله {app.summary!.pendingQualifications} طلبُ تأهيلٍ بانتظار القرار.
            </p>
          )}
        </Card>
      )}
    </>
  );
}

interface BlastRadius {
  pathways: { id: string; titleAr: string; roleAr: string }[];
  templates: { id: string; titleAr: string; roleAr: string }[];
  entityCount: number;
  cohorts: { total: number; live: number };
  learners: number;
}
interface TrainerChangeRequest {
  id: string; status: string; reason: string; scope: string; createdAt: string;
  course?: { id: string } | null; courseId?: string;
  items?: { changeType: string; note?: string | null }[];
  /* البند ب-١: من يصله التعديل — يأتي مع القائمة لا بنداء إضافي */
  blastRadius?: BlastRadius | null;
  blastRadiusSentenceAr?: string | null;
}

/* البند ب-١: دائرة الأثر فوق كل اقتراح. تُعرض قبل أزرار القرار لا بعدها —
   المعتمِد يقرأ من يصله التعديل ثم يقرر، لا يقرر ثم يكتشف. */
function BlastRadiusStrip({ r }: { r: TrainerChangeRequest }) {
  const b = r.blastRadius;
  if (!b) return null;
  const wide = b.entityCount > 0 || b.learners > 0;
  const entities = [...b.pathways, ...b.templates];
  return (
    <div className={`mt-3 rounded-2xl border px-4 py-3 ${wide ? "border-gold/35 bg-gold/[0.07]" : "border-white/10 bg-white/[0.02]"}`}>
      <p className="flex items-start gap-2 text-micro font-bold leading-6">
        {wide
          ? <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
          : <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className={wide ? "text-foreground" : "text-muted-foreground"}>{r.blastRadiusSentenceAr}</span>
      </p>
      {entities.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entities.map((e) => (
            <li key={e.id} className="rounded-full border border-white/12 bg-paper/20 px-2.5 py-0.5 text-micro text-foreground">
              <span dir="ltr" className="font-mono">{e.id}</span>
              <span className="text-muted-foreground"> · {e.roleAr}</span>
            </li>
          ))}
        </ul>
      )}
      {b.cohorts.total > b.cohorts.live && (
        <p className="mt-1.5 text-micro text-muted-foreground">
          ومن {b.cohorts.total} شعبة، {b.cohorts.total - b.cohorts.live} غير حيّة (مسودة أو منتهية) — لا يتأثر بها متعلم الآن.
        </p>
      )}
    </div>
  );
}

/** لوحة مراجعة اقتراحات تعديل الدورات من المدربين — maker-checker */
export function TrainerChangeRequests() {
  const [rows, setRows] = useState<TrainerChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await apiGet<TrainerChangeRequest[]>("/api/admin/trainer-change-requests")); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "تعذر تحميل الاقتراحات"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await fn(); setMsg(doneMsg); await load(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>;

  return (
    <div className="space-y-3">
      {msg && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-foreground" role="status">{msg}</p>}
      {rows.length === 0 && (
        <Panel className="grid place-items-center py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">لا اقتراحات من المدربين بعد — تصل من بوابة المدرب ← «اقتراحاتي».</p>
        </Panel>
      )}
      {rows.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">
                دورة <span dir="ltr" className="font-mono text-xs">{r.courseId ?? r.course?.id ?? "—"}</span>
                <span className="mr-2 text-micro font-bold text-muted-foreground">نطاق: {r.scope === "cohort" ? "شعبة" : "كتالوج"}</span>
              </p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{r.reason}</p>
              <p className="mt-1 text-micro text-muted-foreground">
                {fmtDateTime(new Date(r.createdAt))} · {r.items?.length ?? 0} بند تعديل
              </p>
            </div>
            <span className="rounded-full border border-teal/40 px-3 py-1 text-micro font-bold text-teal-light-ink">
              {CR_STATUS_AR[r.status] ?? r.status}
            </span>
          </div>
          <BlastRadiusStrip r={r} />
          {(r.status === "submitted" || r.status === "in_review") && (
            <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
              <input value={comment[r.id] ?? ""} onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })}
                placeholder="تعليق المراجع (اختياري)" className={inputCls} />
              <div className="flex flex-wrap gap-2">
                <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/trainer-change-requests/${r.id}/decision`, { action: "approve_for_cohort", comment: comment[r.id] || undefined }), "اعتُمد للشعبة")}>
                  <BadgeCheck className="h-3.5 w-3.5" /> اعتماد للشعبة
                </Button>
                <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/trainer-change-requests/${r.id}/decision`, { action: "approve_for_catalog", comment: comment[r.id] || undefined }), "اعتُمد للكتالوج")}>
                  <BadgeCheck className="h-3.5 w-3.5" /> اعتماد للكتالوج
                </Button>
                <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/trainer-change-requests/${r.id}/decision`, { action: "request_changes", comment: comment[r.id] || "راجع التفاصيل" }), "طُلب تعديل")}>
                  <XCircle className="h-3.5 w-3.5" /> طلب تعديل
                </Button>
                <Button tone="danger" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/trainer-change-requests/${r.id}/decision`, { action: "reject", comment: comment[r.id] || "مرفوض" }), "رُفض الاقتراح")}>
                  <XCircle className="h-3.5 w-3.5" /> رفض
                </Button>
              </div>
            </div>
          )}
          {(r.status === "approved_for_cohort" || r.status === "approved_for_catalog" || r.status === "scheduled") && (
            <ImpactGate
              requestId={r.id}
              needsImpact={r.scope === "catalog"}
              busy={busy}
              onPublish={() => act(() => apiPost(`/api/admin/trainer-change-requests/${r.id}/publish`), "نُشر الاقتراح في نطاقه")}
            />
          )}
        </Card>
      ))}
    </div>
  );
}


interface ImpactVerdict {
  verdictAr: string;
  touchesDiagnostic: boolean;
  changedWinners: { name: string; beforeTop: string | null; afterTop: string | null }[];
  changedConfidence: { name: string; before: number; after: number; delta: number }[];
  changedQuestions: { name: string; removed: string[]; added: string[]; reordered: boolean }[];
  totalPersonas: number;
}

/* البند ب-٢: لا يُنشر تغيير بنطاق الكتالوج قبل أن يرى المعتمِد أثره التشخيصي.
   الحاجز في الخادم أيضا (publish يرفض بلا فحص) — والشاشة تشرحه لا تحرسه وحدها.
   نطاق الشعبة معفى: لا يمس الكتالوج ولا التشخيص. */
function ImpactGate({
  requestId, needsImpact, busy, onPublish,
}: {
  requestId: string;
  needsImpact: boolean;
  busy: boolean;
  onPublish: () => void;
}) {
  const [checked, setChecked] = useState<boolean | null>(needsImpact ? null : true);
  const [verdict, setVerdict] = useState<ImpactVerdict | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!needsImpact) return;
    let alive = true;
    void (async () => {
      const r = await apiGet<{ checked: boolean }>(`/api/admin/trainer-change-requests/${requestId}/impact`).catch(() => null);
      if (alive) setChecked(r?.checked ?? false);
    })();
    return () => { alive = false; };
  }, [requestId, needsImpact]);

  const run = async () => {
    setRunning(true);
    const r = await apiPost<ImpactVerdict>(`/api/admin/trainer-change-requests/${requestId}/impact`).catch(() => null);
    setRunning(false);
    if (r) { setVerdict(r); setChecked(true); }
  };

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      {needsImpact && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="confirm" type="button"
              disabled={running}
              onClick={() => void run()} className="min-h-11 text-teal-light-ink">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              {running ? "يشغّل ١٢ شخصية…" : "افحص الأثر التشخيصي"}
            </Button>
            {checked === false && !verdict && (
              <span className="text-micro font-bold text-gold-ink">لم يُفحص بعد — النشر بنطاق الكتالوج موقوف حتى الفحص.</span>
            )}
            {checked === true && !verdict && (
              <span className="text-micro text-muted-foreground">فُحص الأثر بعد الاعتماد — يمكن النشر.</span>
            )}
          </div>

          {verdict && (
            <div className={`mt-2 rounded-2xl border px-4 py-3 text-micro leading-6 ${
              verdict.touchesDiagnostic ? "border-gold/35 bg-gold/[0.07]" : "border-teal/30 bg-teal-ink/[0.06]"
            }`}>
              <p className="font-bold text-foreground">{verdict.verdictAr}</p>
              {verdict.changedWinners.map((w) => (
                <p key={`w-${w.name}`} className="mt-1 text-foreground">
                  · {w.name}: الترشيح <span dir="ltr" className="font-mono">{w.beforeTop ?? "—"}</span> ← <span dir="ltr" className="font-mono">{w.afterTop ?? "—"}</span>
                </p>
              ))}
              {verdict.changedConfidence.map((c) => (
                <p key={`c-${c.name}`} className="mt-1 tabular-nums text-foreground">
                  · {c.name}: الثقة {(c.before * 100).toFixed(1)}٪ ← {(c.after * 100).toFixed(1)}٪
                </p>
              ))}
              {verdict.changedQuestions.map((q) => (
                <p key={`q-${q.name}`} className="mt-1 text-foreground">
                  · {q.name}: {q.removed.length > 0 && <>اختفى <span dir="ltr" className="font-mono">{q.removed.join(", ")}</span> </>}
                  {q.added.length > 0 && <>ظهر <span dir="ltr" className="font-mono">{q.added.join(", ")}</span> </>}
                  {q.reordered && <>ترتيب الأسئلة تغيّر</>}
                </p>
              ))}
              <p className="mt-2 text-micro text-muted-foreground">
                الفحص يقارن اللقطة المنشورة بالمنشور + كل ما اعتُمد ولم يُنشر — لا هذا الاقتراح وحده.
              </p>
            </div>
          )}
        </>
      )}

      <Button tone="primary" disabled={busy || (needsImpact && checked !== true)}
        onClick={onPublish} className="mt-2 min-h-11 disabled:cursor-not-allowed">
        <Globe className="h-3.5 w-3.5" /> نشر في النطاق
      </Button>
    </div>
  );
}

/* ── مستحقات المدربين — كشوف الصرف: إنشاء ← اعتماد ← صرف، أو إلغاء بسبب ── */

const PAYOUT_STATUS_AR: Record<string, string> = {
  pending: "بانتظار الاعتماد", approved: "معتمد", paid: "مدفوع", cancelled: "ملغى",
};
const PAYOUT_STATUS_CLS: Record<string, string> = {
  pending: "border-gold/40 text-gold-ink",
  approved: "border-teal/40 text-teal-light-ink",
  paid: "border-emerald-400/40 text-emerald-300",
  cancelled: "border-white/20 text-muted-foreground",
};

interface PayoutRow {
  id: string; period: string; status: string; total: string | number; currency: string;
  paidAt?: string | null; createdAt: string;
  items: { id: string; description: string; amount: string | number; sourceRef?: string | null }[];
  profile: { application?: { fullName: string; reference: string } | null };
}
interface ProfileOpt { id: string; fullName: string; reference: string }

const RULE_TYPE_AR: Record<string, string> = {
  per_seat: "لكل متعلم", fixed_per_cohort: "ثابت لكل شعبة", revenue_share: "نسبة من الإيراد",
};

interface RuleRow {
  id: string; profileId: string; type: string; rate: string | number; currency: string;
  minSeats: number; courseId?: string | null; cohortId?: string | null;
  effectiveFrom: string; effectiveTo?: string | null;
  profile: { application?: { fullName: string } | null };
}
interface CohortOpt { id: string; title: string; courseTitle: string; status: string; endsAt?: string | null }
interface CohortPreview {
  cohort: { id: string; title: string; status: string; courseTitle: string };
  profile: { id: string; fullName: string };
  rule: { type: string; rate: number; currency: string; minSeats: number; scope: string };
  items: { description: string; amount: number; sourceRef?: string }[];
  total: number;
}

/** إدارة كشوف مستحقات المدربين — إنشاء واعتماد وصرف وإلغاء، كلها API حقيقي */
export function TrainerPayouts() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [allCohorts, setAllCohorts] = useState<CohortOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  /* الكشوف الملغاة الصفرية ضجيج بصري — تُخفى افتراضيا وتظهر عند الطلب */
  const [showCancelledZero, setShowCancelledZero] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ profileId: "", period: "" });
  const [items, setItems] = useState<{ description: string; amount: string; sourceRef: string }[]>([
    { description: "", amount: "", sourceRef: "" },
  ]);
  /* قواعد الأتعاب والتوليد */
  const [ruleForm, setRuleForm] = useState({ profileId: "", type: "per_seat", rate: "", minSeats: "", cohortId: "" });
  const [genCohortId, setGenCohortId] = useState("");
  const [preview, setPreview] = useState<CohortPreview | null>(null);
  const [batchResult, setBatchResult] = useState<{ generated: { title: string; total: number }[]; skipped: { title: string; reason: string }[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, profs, r, cohorts] = await Promise.all([
        apiGet<PayoutRow[]>(`/api/admin/trainer-payouts${filter ? `?status=${filter}` : ""}`),
        apiGet<ProfileOpt[]>("/api/admin/trainer-profiles"),
        apiGet<RuleRow[]>("/api/admin/trainer-compensation-rules"),
        apiGet<CohortOpt[]>("/api/admin/cohorts"),
      ]);
      setRows(p); setProfiles(profs); setRules(r); setAllCohorts(cohorts);
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "تعذر تحميل الكشوف"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await fn(); setMsg(doneMsg); await load(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  const saveRule = () => act(async () => {
    await apiPost("/api/admin/trainer-compensation-rules", {
      profileId: ruleForm.profileId, type: ruleForm.type, rate: Number(ruleForm.rate),
      minSeats: ruleForm.type === "per_seat" && ruleForm.minSeats !== "" ? Number(ruleForm.minSeats) : undefined,
      cohortId: ruleForm.cohortId || undefined,
    });
    setRuleForm({ ...ruleForm, rate: "", minSeats: "", cohortId: "" });
  }, "حُفظت القاعدة — صارت سارية من الآن");

  const doPreview = async () => {
    setBusy(true); setMsg(""); setPreview(null); setBatchResult(null);
    try { setPreview(await apiGet<CohortPreview>(`/api/admin/trainer-payouts/preview-cohort/${genCohortId}`)); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "تعذرت المعاينة"); }
    finally { setBusy(false); }
  };

  const doGenerate = () => act(async () => {
    await apiPost("/api/admin/trainer-payouts/generate", { cohortId: genCohortId });
    setPreview(null); setGenCohortId("");
  }, "وُلّد الكشف — بانتظار الاعتماد");

  const doBatch = () => act(async () => {
    const res = await apiPost<{ generated: { title: string; total: number }[]; skipped: { title: string; reason: string }[] }>(
      "/api/admin/trainer-payouts/generate", { batch: true });
    setBatchResult(res); setPreview(null);
  }, "اكتمل التوليد الدفعي");

  const create = () => act(async () => {
    await apiPost("/api/admin/trainer-payouts", {
      profileId: form.profileId,
      period: form.period,
      items: items.map((i) => ({
        description: i.description, amount: Number(i.amount), sourceRef: i.sourceRef || undefined,
      })),
    });
    setShowCreate(false);
    setForm({ profileId: "", period: "" });
    setItems([{ description: "", amount: "", sourceRef: "" }]);
  }, "أُنشئ الكشف — بانتظار الاعتماد");

  const fmt = (n: string | number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="رشّح بالحالة" className={selectCls}>
          <option value="">كل الحالات</option>
          {Object.entries(PAYOUT_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-micro font-bold text-muted-foreground transition hover:border-white/30">
          <input type="checkbox" checked={showCancelledZero} onChange={(e) => setShowCancelledZero(e.target.checked)} className="accent-gold" />
          إظهار الملغاة الصفرية
        </label>
        <Button tone="primary" onClick={() => setShowCreate(!showCreate)}>
          <Banknote className="h-3.5 w-3.5" /> كشف يدوي جديد
        </Button>
        {msg && <span className="text-xs font-bold text-teal-light-ink" role="status">{msg}</span>}
      </div>

      {/* قاعدة الأتعاب — تحدد كيف تُحسب مستحقات كل مدرب تلقائياً */}
      <Card icon={Settings2} title="قواعد الأتعاب — كيف يُحسب أجر كل مدرب">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select value={ruleForm.profileId} onChange={(e) => setRuleForm({ ...ruleForm, profileId: e.target.value })} className={`${selectCls} flex-1`}>
              <option value="">اختر المدرب…</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.reference}</option>)}
            </select>
            <select value={ruleForm.type} onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })} className={`${selectCls} w-44`}>
              {Object.entries(RULE_TYPE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={ruleForm.rate} onChange={(e) => setRuleForm({ ...ruleForm, rate: e.target.value })}
              placeholder={ruleForm.type === "revenue_share" ? "النسبة ٪" : `المبلغ ${LEDGER_CURRENCY}`} dir="ltr" inputMode="decimal"
              className={`${inputCls} w-28 font-mono`} />
            {ruleForm.type === "per_seat" && (
              <input value={ruleForm.minSeats} onChange={(e) => setRuleForm({ ...ruleForm, minSeats: e.target.value })}
                placeholder="حد أدنى للمقاعد" dir="ltr" inputMode="numeric" title="يُحاسب المدرب على هذا العدد حتى لو قلّ التسجيل الفعلي"
                className={`${inputCls} w-32 font-mono`} />
            )}
            <select value={ruleForm.cohortId} onChange={(e) => setRuleForm({ ...ruleForm, cohortId: e.target.value })}
              title="اتركها «عامة» لتسري على كل الشعب، أو خصصها لشعبة واحدة" className={`${selectCls} w-48`}>
              <option value="">عامة — كل الشعب</option>
              {allCohorts.map((c) => <option key={c.id} value={c.id}>خاصة: {c.title}</option>)}
            </select>
            <Button tone="primary" size="sm" disabled={busy || !ruleForm.profileId || !(Number(ruleForm.rate) > 0)} onClick={saveRule}>
              حفظ القاعدة
            </Button>
          </div>
          {ruleForm.profileId && (() => {
            const active = rules.find((r) => r.profileId === ruleForm.profileId && !r.effectiveTo
              && !r.cohortId && !r.courseId && !ruleForm.cohortId)
              ?? rules.find((r) => r.profileId === ruleForm.profileId && !r.effectiveTo && r.cohortId === ruleForm.cohortId && ruleForm.cohortId);
            return (
              <p className="rounded-xl border border-white/10 bg-paper/20 px-3 py-2 text-micro text-muted-foreground">
                {active
                  ? <>القاعدة السارية{active.cohortId ? " لهذه الشعبة" : " (العامة)"}: <b className="text-foreground">{RULE_TYPE_AR[active.type]}</b> بمعدل <b dir="ltr" className="font-mono text-foreground">{Number(active.rate)}</b> {active.currency}
                      {active.type === "per_seat" && active.minSeats > 0 ? <> · حد أدنى <b className="text-foreground">{active.minSeats}</b> مقاعد</> : null}
                      {" "}— حفظ قاعدة جديدة بنفس النطاق يغلقها تلقائياً دون مسح تاريخها.</>
                  : "لا قاعدة سارية بهذا النطاق بعد — بدونها لن يُولَّد أي كشف تلقائي."}
              </p>
            );
          })()}
          <p className="text-micro leading-5 text-muted-foreground">
            قاعدة الشعبة المخصصة تغلب العامة عند الحساب. الحد الأدنى للمقاعد يعني: يُدفع للمدرب عن هذا العدد حتى لو سجّل أقل —
            مثال: معدل 40 وحد أدنى 5، سجّل 3 ← يُحتسب 5 × 40.
          </p>
        </div>
      </Card>

      {/* التوليد التلقائي من الشعب المكتملة */}
      <Card icon={Zap} title="توليد تلقائي من شعبة مكتملة">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select value={genCohortId} onChange={(e) => { setGenCohortId(e.target.value); setPreview(null); }} className={`${selectCls} flex-1`}>
              <option value="">اختر شعبة مكتملة…</option>
              {allCohorts.filter((c) => c.status === "completed").map((c) => <option key={c.id} value={c.id}>{c.title} — {c.courseTitle}</option>)}
            </select>
            <Button tone="secondary" size="sm" disabled={busy || !genCohortId} onClick={() => void doPreview()} className="text-teal-light-ink">
              معاينة الحساب
            </Button>
            <Button tone="secondary" size="sm" disabled={busy} onClick={doBatch} className="text-gold-ink">
              توليد كل المكتملة دفعة واحدة
            </Button>
          </div>
          {preview && (
            <Card tone="accent" className="space-y-2">
              <p className="text-xs font-black">
                {preview.profile.fullName} · قاعدة «{RULE_TYPE_AR[preview.rule.type]}»
                {preview.rule.scope !== "general" ? " (مخصصة لهذه الشعبة/الدورة)" : ""} بمعدل <span dir="ltr" className="font-mono">{preview.rule.rate}</span> {preview.rule.currency}
                {preview.rule.type === "per_seat" && preview.rule.minSeats > 0 ? ` · حد أدنى ${preview.rule.minSeats} مقاعد` : ""}
              </p>
              <ul className="space-y-1">
                {preview.items.map((i, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 text-xs text-foreground">
                    <span>{i.description}</span>
                    <span dir="ltr" className="font-mono font-bold">{i.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                <p className="text-sm font-black">الإجمالي: <span dir="ltr" className="font-mono">{preview.total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span> {preview.rule.currency}</p>
                <Button tone="ghost" size="sm" disabled={busy || preview.total <= 0} onClick={doGenerate} className="bg-emerald-500 text-white">
                  توليد الكشف — بانتظار الاعتماد
                </Button>
              </div>
            </Card>
          )}
          {batchResult && (
            <Card className="space-y-1 bg-paper/20 text-micro leading-6">
              <p className="font-black text-emerald-300">وُلّد {batchResult.generated.length} كشفاً</p>
              {batchResult.skipped.map((s, i) => (
                <p key={i} className="text-muted-foreground">تُركت «{s.title}»: {s.reason}</p>
              ))}
            </Card>
          )}
          <p className="text-micro leading-5 text-muted-foreground">
            اكتمال أي شعبة يولّد كشف مدربها تلقائياً إن كانت له قاعدة سارية — هذه الأدوات للتوليد اليدوي عند الحاجة،
            وكلها تمنع التكرار: شعبة واحدة لا تُولّد كشفين لنفس المدرب أبداً.
          </p>
        </div>
      </Card>

      {showCreate && (
        <Panel tone="warn" className="space-y-3">
          <p className="text-sm font-black">كشف مستحقات جديد <span className="text-micro font-bold text-muted-foreground">— يولد بحالة «بانتظار الاعتماد»</span></p>
          <div className="flex flex-wrap gap-2">
            <select value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })} className={`${selectCls} flex-1`}>
              <option value="">اختر المدرب…</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.reference}</option>)}
            </select>
            <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}
              placeholder="الفترة — 2026-08" dir="ltr" className={`${inputCls} w-32 font-mono`} />
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <input value={it.description} placeholder="وصف البند — تدريب شعبة القيادة"
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                className={`${inputCls} flex-1`} />
              <input value={it.amount} placeholder="المبلغ" dir="ltr" inputMode="decimal"
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                className={`${inputCls} w-24 font-mono`} />
              <input value={it.sourceRef} placeholder="مرجع (اختياري)" dir="ltr"
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, sourceRef: e.target.value } : x))}
                className={`${inputCls} w-32 font-mono`} />
              {items.length > 1 && (
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="cursor-pointer text-muted-foreground hover:text-red-400" aria-label="حذف البند">
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="secondary" size="sm" onClick={() => setItems([...items, { description: "", amount: "", sourceRef: "" }])}>
              + بند آخر
            </Button>
            <Button tone="primary" size="sm" disabled={busy || !form.profileId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.period) || items.some((i) => i.description.trim().length < 3 || !(Number(i.amount) > 0))}
              onClick={create}>
              إنشاء الكشف
            </Button>
          </div>
        </Panel>
      )}

      {(() => {
        const visibleRows = showCancelledZero ? rows : rows.filter((p) => !(p.status === "cancelled" && Number(p.total) === 0));
        const hiddenCount = rows.length - visibleRows.length;
        return (
          <>
            {hiddenCount > 0 && (
              <p className="text-micro text-muted-foreground">
                {hiddenCount} {hiddenCount === 1 ? "كشف ملغى صفري مخفي" : "كشوف ملغاة صفرية مخفية"} — فعّل «إظهار الملغاة الصفرية» لعرضها.
              </p>
            )}
            {visibleRows.length === 0 && (
              <Panel className="grid place-items-center py-16 text-center">
                <Banknote className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">لا كشوف بهذه الحالة — أنشئ أول كشف من زر «كشف جديد».</p>
              </Panel>
            )}
            {visibleRows.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">
                {p.profile.application?.fullName ?? "مدرب"} <span dir="ltr" className="font-mono text-micro text-muted-foreground">{p.profile.application?.reference}</span>
                <span className="mr-2 text-micro font-bold text-muted-foreground">فترة <span dir="ltr" className="font-mono">{p.period}</span></span>
              </p>
              <p className="mt-1 text-xl font-black">{fmt(p.total)} <span className="text-xs font-bold text-muted-foreground">{p.currency}</span></p>
              {p.paidAt && <p className="mt-0.5 text-micro text-muted-foreground">صُرف {fmtDateTime(new Date(p.paidAt))}</p>}
            </div>
            <span className={`rounded-full border px-3 py-1 text-micro font-bold ${PAYOUT_STATUS_CLS[p.status] ?? ""}`}>
              {PAYOUT_STATUS_AR[p.status] ?? p.status}
            </span>
          </div>
          <ul className="mt-3 space-y-1 border-t border-white/8 pt-3">
            {p.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{i.description}{i.sourceRef ? <span dir="ltr" className="mr-2 font-mono text-micro text-muted-foreground">{i.sourceRef}</span> : null}</span>
                <span dir="ltr" className="font-mono font-bold text-foreground">{fmt(i.amount)}</span>
              </li>
            ))}
          </ul>
          {(p.status === "pending" || p.status === "approved") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
              {p.status === "pending" && (
                <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/trainer-payouts/${p.id}/approve`), "اعتُمد الكشف")}>
                  <BadgeCheck className="h-3.5 w-3.5" /> اعتماد
                </Button>
              )}
              {p.status === "approved" && (
                <Button tone="ghost" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/trainer-payouts/${p.id}/pay`), "سُجل الصرف")} className="bg-emerald-500 text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" /> تأكيد الصرف
                </Button>
              )}
              <input value={cancelReason[p.id] ?? ""} onChange={(e) => setCancelReason({ ...cancelReason, [p.id]: e.target.value })}
                placeholder="سبب الإلغاء…" className={`${inputCls} max-w-48`} />
              <Button tone="danger" size="sm" disabled={busy || (cancelReason[p.id] ?? "").trim().length < 5}
                onClick={() => act(() => apiPost(`/api/admin/trainer-payouts/${p.id}/cancel`, { reason: cancelReason[p.id] }), "أُلغي الكشف")}>
                <XCircle className="h-3.5 w-3.5" /> إلغاء
              </Button>
            </div>
          )}
        </Card>
            ))}
          </>
        );
      })()}
    </div>
  );
}
