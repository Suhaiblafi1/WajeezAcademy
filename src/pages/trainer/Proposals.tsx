import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { BookOpen, GitPullRequest, Loader2, Lock, Plus, ServerOff, Undo2, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";

import { Panel, Card } from "@/components/ui/Surface";
const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة", submitted: "مُقدَّم", under_review: "قيد المراجعة",
  changes_requested: "طُلبت تعديلات", approved_for_cohort: "معتمد للشعبة",
  approved_for_catalog: "معتمد للكتالوج", rejected: "مرفوض", withdrawn: "مسحوب",
  published: "منشور", superseded: "حلّ محله أحدث",
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  module_title_edit: "تعديل عنوان محور", module_add: "إضافة محور", module_reorder: "إعادة ترتيب",
  explanation_improve: "تحسين شرح", material_add: "إضافة مادة", activity_add: "إضافة نشاط",
  assignment_add: "إضافة واجب", assessment_improve: "تحسين تقييم", examples_update: "تحديث أمثلة",
  duration_propose: "اقتراح مدة", project_propose: "اقتراح مشروع/مخرج", outcome_propose: "اقتراح مخرج",
};

interface ChangeRequest {
  id: string; courseId: string; scope: string; status: string; reason: string;
  reviewerComment: string | null; createdAt: string;
  items: { id: string; changeType: string; targetKey: string | null; afterValue: unknown }[];
  course: { versions: { titleAr: string }[] };
}

interface Qualification { courseId: string; title: string; currentVersion: number }

interface ScopeGate { allowed: boolean; basis: 'earned' | 'granted' | 'none'; reasonAr: string }
interface MyCohort { role: string; cohort: { id: string; title: string; courseId: string; status: string } }

/* البند هـ-٣: دليل المدرب في مكانه لا في صفحة مساعدة. ثلاثة أسطر تجيب ثلاثة
   أسئلة يسألها كل مدرب جديد: ما أغيّره بحرية · ما يحتاج مراجعة · ما لا أستطيع
   لمسه ولماذا. السياق في مكانه يمنع أسئلة كثيرة ويمنع اقتراحا مرفوضا سلفا. */
const GUIDE = [
  {
    titleAr: 'ما تغيّره بحرية في شعبتك',
    bodyAr: 'الأمثلة والشروح والأنشطة والواجبات وترتيب المحاور وعناوينها — نطاق الشعبة يُطبَّق على شعبتك وحدها بعد الاعتماد، ولا يمسّ متعلما في شعبة غيرك.',
  },
  {
    titleAr: 'ما يحتاج مراجعة أوسع',
    bodyAr: 'نطاق الكتالوج يصل إلى كل مسار وقالب وشعبة تستخدم الدورة، فيُراجَع مع دائرة أثره وفحص أثره التشخيصي قبل النشر.',
  },
  {
    titleAr: 'ما لا تستطيع لمسه ولماذا',
    bodyAr: 'السعر والمهارات الأساسية وقواعد التشخيص والمخرجات الإلزامية وربط المسارات. المهارات مدخلات محرك الترشيح: تغييرها يغيّر ترشيح كل من يخوض التشخيص، لا محتوى دورتك وحدها.',
  },
] as const

interface Blueprint {
  id: string;
  versions: {
    titleAr: string; totalHours: number; weeklyHours: number | null; levelAr: string | null;
    descriptionAr: string | null; version: number;
    objectives: { sequence: number; textAr: string }[];
    outcomes: { sequence: number; textAr: string }[];
    project: { descriptionAr: string } | null;
    assessments: { kind: string; specAr: string | null }[];
  }[];
  modules: {
    id: string;
    versions: { sequence: number; titleAr: string; hours: number; outcomeAr: string | null }[];
  }[];
  skillLinks: { skillId: string; targetLevel: number; weight: number }[];
}

const ASSESSMENT_KIND_LABELS: Record<string, string> = {
  summative: "ختامي", formative: "تكويني", project_review: "مراجعة مشروع",
};

/** اقتراحات تعديل الدورات — المدرب يقترح فقط على دورة مؤهل لها، ولا يُطبَّق شيء قبل اعتماد الإدارة */
export default function TrainerProposals() {
  const [mine, setMine] = useState<ChangeRequest[]>([]);
  const [quals, setQuals] = useState<Qualification[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    courseId: "", reason: "", changeType: "module_title_edit", targetKey: "", newValue: "",
    /* البند هـ-١: الافتراضي نطاق الشعبة — يجرّب المدرب فيه بلا مخاطرة على أحد */
    scope: "cohort" as "cohort" | "catalog", cohortId: "",
  });
  const [busy, setBusy] = useState(false);
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [bpErr, setBpErr] = useState("");
  const [bpBusy, setBpBusy] = useState("");

  const viewBlueprint = async (courseId: string) => {
    if (bpBusy) return;
    setBpBusy(courseId);
    setBpErr("");
    try {
      const res = await apiGet<Blueprint | { error: { code: string; message_ar: string } }>(
        `/api/trainer/courses/${courseId}/blueprint`
      );
      if ("error" in res && res.error) {
        setBp(null);
        setBpErr(res.error.message_ar ?? "لا يمكنك عرض هذا المخطط");
        return;
      }
      setBp(res as Blueprint);
    } catch (err) {
      setBp(null);
      setBpErr(err instanceof ApiError ? err.message : "تعذر تحميل المخطط");
    } finally {
      setBpBusy("");
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [reqs, qs] = await Promise.all([
        apiGet<ChangeRequest[]>("/api/trainer/change-requests"),
        apiGet<Qualification[]>("/api/trainer/me/qualifications"),
      ]);
      setMine(reqs); setQuals(qs);
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب جلسة مدرب حقيقية عبر API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* البند هـ-١: النطاق يُقرأ قبل الكتابة — لا يُفاجأ المدرب برفض بعد أن كتب */
  const [scopeGate, setScopeGate] = useState<ScopeGate | null>(null);
  const [cohorts, setCohorts] = useState<MyCohort[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const safe = async <T,>(pr: Promise<T>): Promise<T | null> => pr.then((v) => v).catch(() => null);
      const [g, c] = await Promise.all([
        safe(apiGet<ScopeGate>("/api/trainer/catalog-scope")),
        safe(apiGet<MyCohort[]>("/api/trainer/my-cohorts")),
      ]);
      if (!alive) return;
      setScopeGate(g);
      setCohorts(c ?? []);
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !form.courseId || form.reason.trim().length < 10) return;
    setBusy(true);
    try {
      await apiPost("/api/trainer/change-requests", {
        courseId: form.courseId,
        scope: form.scope,
        cohortId: form.scope === "cohort" ? form.cohortId : undefined,
        reason: form.reason,
        items: [{
          changeType: form.changeType,
          targetKey: form.targetKey || undefined,
          afterValue: form.changeType === "module_title_edit" ? { titleAr: form.newValue }
            : form.changeType === "duration_propose" ? { totalHours: Number(form.newValue) || undefined }
            : { text: form.newValue },
        }],
      });
      toast("أُرسل اقتراحك للمراجعة الأكاديمية — لن يُطبَّق قبل الاعتماد");
      setShowForm(false);
      setForm({ courseId: "", reason: "", changeType: "module_title_edit", targetKey: "", newValue: "", scope: "cohort", cohortId: "" });
      await load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر إرسال الاقتراح");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await apiPost(`/api/trainer/change-requests/${id}/withdraw`);
      await load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر السحب");
    }
  };

  if (offline) {
    return (
      <TrainerLayout title="اقتراحات التعديل">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title="اقتراحات تعديل دوراتي">
      {/* البند هـ-٣: الدليل في مكانه — ثلاثة أسطر قبل أول اقتراح */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {GUIDE.map((g, i) => (
          <div key={g.titleAr} className={`rounded-2xl border p-4 ${
            i === 0 ? "border-teal/30 bg-teal-ink/[0.06]" : i === 1 ? "border-gold/30 bg-gold/[0.06]" : "border-white/12 bg-white/[0.03]"
          }`}>
            <p className="flex items-center gap-1.5 text-xs font-black">
              {i === 0 ? <BookOpen className="h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" />
                : i === 1 ? <GitPullRequest className="h-3.5 w-3.5 text-gold-ink" aria-hidden="true" />
                : <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
              {g.titleAr}
            </p>
            <p className="mt-1.5 text-[11px] leading-6 text-foreground">{g.bodyAr}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs leading-6 text-muted-foreground">
          تقترح هنا على الدورات المؤهل لها فقط. كل اقتراح يمرّ بمراجعة أكاديمية — لا تعديل مباشرا على المنشور.
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal/90"
        >
          <Plus className="h-3.5 w-3.5" /> اقتراح جديد
        </button>
      </div>


      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-4 rounded-3xl border border-teal/25 bg-teal/[0.04] p-6">
          {/* البند هـ-١: النطاق أول اختيار — والافتراضي شعبتك */}
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-muted-foreground">نطاق الاقتراح *</legend>
            <div className="flex flex-wrap gap-2">
              <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs ${
                form.scope === "cohort" ? "border-teal bg-teal-ink/15 font-bold" : "border-white/12 text-foreground"
              }`}>
                <input type="radio" name="tp-scope" checked={form.scope === "cohort"}
                  onChange={() => setForm({ ...form, scope: "cohort" })} className="h-4 w-4 accent-teal" />
                شعبتي — يُطبَّق على شعبتك وحدها
              </label>
              <label className={`flex min-h-11 items-center gap-2 rounded-2xl border px-4 text-xs ${
                scopeGate?.allowed === false ? "cursor-not-allowed border-white/10 text-muted-foreground"
                  : form.scope === "catalog" ? "cursor-pointer border-gold bg-gold/15 font-bold" : "cursor-pointer border-white/12 text-foreground"
              }`}>
                <input type="radio" name="tp-scope" disabled={scopeGate?.allowed === false}
                  checked={form.scope === "catalog"}
                  onChange={() => setForm({ ...form, scope: "catalog", cohortId: "" })} className="h-4 w-4 accent-teal" />
                الكتالوج — يصل كل مسار وقالب وشعبة
              </label>
            </div>
            {scopeGate && (
              <p className={`mt-2 text-[11px] leading-6 ${scopeGate.allowed ? "text-muted-foreground" : "text-gold-ink"}`}>
                {scopeGate.reasonAr}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tp-course" className="mb-1.5 block text-xs font-bold text-muted-foreground">الدورة * — من دوراتك المؤهلة</label>
              <select id="tp-course" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground [&>option]:bg-surface">
                <option value="" disabled>اختر الدورة</option>
                {quals.map((q) => <option key={q.courseId} value={q.courseId}>{q.title} ({q.courseId})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tp-type" className="mb-1.5 block text-xs font-bold text-muted-foreground">نوع التعديل *</label>
              <select id="tp-type" value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground [&>option]:bg-surface">
                {Object.entries(CHANGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {form.scope === "cohort" && (
            <div>
              <label htmlFor="tp-cohort" className="mb-1.5 block text-xs font-bold text-muted-foreground">الشعبة * — من شعبك التي تدرّبها</label>
              <select id="tp-cohort" required value={form.cohortId} onChange={(e) => setForm({ ...form, cohortId: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground [&>option]:bg-surface">
                <option value="" disabled>اختر الشعبة</option>
                {cohorts
                  .filter((c) => !form.courseId || c.cohort.courseId === form.courseId)
                  .map((c) => <option key={c.cohort.id} value={c.cohort.id}>{c.cohort.title}</option>)}
              </select>
              {cohorts.filter((c) => !form.courseId || c.cohort.courseId === form.courseId).length === 0 && (
                <p className="mt-1.5 text-[11px] text-gold-ink">
                  لا شعبة لك في هذه الدورة — اختر دورة تدرّبها، أو اقترح بنطاق الكتالوج إن كان مفتوحا لك.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tp-target" className="mb-1.5 block text-xs font-bold text-muted-foreground">المحور المستهدف (معرفه) — اختياري</label>
              <input id="tp-target" dir="ltr" placeholder="C-BIZ-101-M2" value={form.targetKey} onChange={(e) => setForm({ ...form, targetKey: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-left font-mono text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
            </div>
            <div>
              <label htmlFor="tp-value" className="mb-1.5 block text-xs font-bold text-muted-foreground">القيمة المقترحة *</label>
              <input id="tp-value" required value={form.newValue} onChange={(e) => setForm({ ...form, newValue: e.target.value })}
                placeholder="العنوان الجديد أو النص أو الساعات"
                className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="tp-reason" className="mb-1.5 block text-xs font-bold text-muted-foreground">سبب التعديل * — لماذا يخدم المتعلم؟</label>
            <textarea id="tp-reason" required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
          </div>
          <button type="submit" disabled={busy || form.reason.trim().length < 10 || !form.courseId || !form.newValue.trim()}
            className="cursor-pointer rounded-full bg-gold px-6 py-2.5 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-40">
            {busy ? "جاري الإرسال…" : "أرسل للمراجعة"}
          </button>
        </form>
      )}

      {quals.length > 0 && (
        <Panel as="section" className="mb-6">
          <h2 className="mb-3 text-sm font-black text-foreground">مخططات دوراتك المؤهلة — اطلع على البنية قبل أن تقترح</h2>
          <div className="flex flex-wrap gap-2">
            {quals.map((q) => (
              <button key={q.courseId} onClick={() => void viewBlueprint(q.courseId)} disabled={bpBusy === q.courseId}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/40 px-4 py-2 text-xs font-bold text-teal-light-ink transition hover:bg-teal/10 disabled:opacity-50">
                {bpBusy === q.courseId ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                {q.title} — المخطط
              </button>
            ))}
          </div>
          {bpErr && <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs font-semibold text-red-300">{bpErr}</p>}
        </Panel>
      )}

      {bp && bp.versions[0] && (
        <section className="mb-6 rounded-3xl border border-teal/25 bg-teal/[0.04] p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-foreground">{bp.versions[0].titleAr}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                <span dir="ltr">{bp.id}</span> · {bp.versions[0].totalHours} ساعة
                {bp.versions[0].weeklyHours ? ` (${bp.versions[0].weeklyHours} أسبوعيا)` : ""}
                {bp.versions[0].levelAr ? ` · المستوى: ${bp.versions[0].levelAr}` : ""} · إصدار {bp.versions[0].version}
              </p>
            </div>
            <button onClick={() => setBp(null)} aria-label="إغلاق المخطط"
              className="cursor-pointer rounded-full border border-white/15 p-2 text-muted-foreground transition hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {bp.versions[0].descriptionAr && <p className="mb-4 text-xs leading-6 text-foreground">{bp.versions[0].descriptionAr}</p>}

          <div className="grid gap-4 lg:grid-cols-2">
            {bp.versions[0].objectives.length > 0 && (
              <Card className="bg-paper/20">
                <h3 className="mb-2 text-xs font-black text-teal-light-ink">الأهداف التعليمية</h3>
                <ol className="list-decimal space-y-1 pr-4 text-xs leading-6 text-foreground">
                  {[...bp.versions[0].objectives].sort((a, b) => a.sequence - b.sequence).map((o, i) => <li key={i}>{o.textAr}</li>)}
                </ol>
              </Card>
            )}
            {bp.versions[0].outcomes.length > 0 && (
              <Card className="bg-paper/20">
                <h3 className="mb-2 text-xs font-black text-teal-light-ink">المخرجات</h3>
                <ol className="list-decimal space-y-1 pr-4 text-xs leading-6 text-foreground">
                  {[...bp.versions[0].outcomes].sort((a, b) => a.sequence - b.sequence).map((o, i) => <li key={i}>{o.textAr}</li>)}
                </ol>
              </Card>
            )}
          </div>

          {bp.modules.length > 0 && (
            <Card className="mt-4 bg-paper/20">
              <h3 className="mb-2 text-xs font-black text-teal-light-ink">المحاور</h3>
              <div className="space-y-2">
                {[...bp.modules]
                  .sort((a, b) => (a.versions[0]?.sequence ?? 0) - (b.versions[0]?.sequence ?? 0))
                  .map((m) => m.versions[0] && (
                    <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{m.versions[0].sequence}. {m.versions[0].titleAr}</p>
                        {m.versions[0].outcomeAr && <p className="mt-0.5 text-[11px] text-muted-foreground">{m.versions[0].outcomeAr}</p>}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{m.versions[0].hours} س · <span dir="ltr">{m.id}</span></span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {bp.versions[0].project && (
            <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/5 p-4">
              <h3 className="mb-1 text-xs font-black text-gold-ink">المشروع التطبيقي</h3>
              <p className="text-xs leading-6 text-foreground">{bp.versions[0].project.descriptionAr}</p>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {bp.versions[0].assessments.length > 0 && (
              <Card className="bg-paper/20">
                <h3 className="mb-2 text-xs font-black text-teal-light-ink">التقييمات</h3>
                <ul className="space-y-1.5 text-xs leading-6 text-foreground">
                  {bp.versions[0].assessments.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-micro text-muted-foreground">
                        {ASSESSMENT_KIND_LABELS[a.kind] ?? a.kind}
                      </span>
                      <span>{a.specAr ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {bp.skillLinks.length > 0 && (
              <Card className="bg-paper/20">
                <h3 className="mb-2 text-xs font-black text-teal-light-ink">المهارات المستهدفة</h3>
                <div className="flex flex-wrap gap-1.5">
                  {bp.skillLinks.map((s) => (
                    <span key={s.skillId} className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-micro text-foreground">
                      <span dir="ltr">{s.skillId}</span> · مستوى {s.targetLevel}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : mine.length === 0 ? (
        <Panel className="grid place-items-center py-16 text-center">
          <GitPullRequest className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا اقتراحات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">حين ترى تحسينا يخدم طلابك في دورة مؤهل لها — اقترحه هنا وسيراجعه المسؤول الأكاديمي.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {mine.map((r) => (
            <Card as="article" key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{r.course.versions[0]?.titleAr ?? r.courseId} <span className="text-micro text-muted-foreground" dir="ltr">{r.courseId}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.items.map((i) => CHANGE_TYPE_LABELS[i.changeType] ?? i.changeType).join(" · ")} — نطاق: {r.scope === "cohort" ? "شعبة" : "الكتالوج"}
                  </p>
                  {r.reviewerComment && (
                    <p className="mt-2 rounded-lg border border-gold/25 bg-gold/5 p-2 text-[11px] text-gold-ink">تعليق المراجع: {r.reviewerComment}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  {["draft", "submitted", "under_review", "changes_requested"].includes(r.status) && (
                    <button onClick={() => void withdraw(r.id)} title="سحب الاقتراح"
                      className="cursor-pointer rounded-full border border-white/15 p-2 text-muted-foreground transition hover:border-red-400/40 hover:text-red-300">
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}
