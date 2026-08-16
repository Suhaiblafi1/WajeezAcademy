import { useCallback, useEffect, useState } from "react";
import { GitPullRequest, Loader2, Plus, ServerOff, Undo2 } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";

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

/** اقتراحات تعديل الدورات — المدرب يقترح فقط على دورة مؤهل لها، ولا يُطبَّق شيء قبل اعتماد الإدارة */
export default function TrainerProposals() {
  const [mine, setMine] = useState<ChangeRequest[]>([]);
  const [quals, setQuals] = useState<Qualification[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: "", reason: "", changeType: "module_title_edit", targetKey: "", newValue: "" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !form.courseId || form.reason.trim().length < 10) return;
    setBusy(true); setFlash("");
    try {
      await apiPost("/api/trainer/change-requests", {
        courseId: form.courseId, scope: "catalog", reason: form.reason,
        items: [{
          changeType: form.changeType,
          targetKey: form.targetKey || undefined,
          afterValue: form.changeType === "module_title_edit" ? { titleAr: form.newValue }
            : form.changeType === "duration_propose" ? { totalHours: Number(form.newValue) || undefined }
            : { text: form.newValue },
        }],
      });
      setFlash("أُرسل اقتراحك للمراجعة الأكاديمية — لن يُطبَّق قبل الاعتماد");
      setShowForm(false);
      setForm({ courseId: "", reason: "", changeType: "module_title_edit", targetKey: "", newValue: "" });
      await load();
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر إرسال الاقتراح");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await apiPost(`/api/trainer/change-requests/${id}/withdraw`);
      await load();
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر السحب");
    }
  };

  if (offline) {
    return (
      <TrainerLayout title="اقتراحات التعديل">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title="اقتراحات تعديل دوراتي">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs leading-6 text-white/50">
          تقترح هنا على الدورات المؤهل لها فقط. كل اقتراح يمر بمراجعة أكاديمية — لا تعديل مباشرا على المنشور،
          والسعر وقواعد التشخيص والمهارات الأساسية والمخرجات الإلزامية ليست ضمن صلاحية المدرب.
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] transition hover:bg-[#38A7B4]/90"
        >
          <Plus className="h-3.5 w-3.5" /> اقتراح جديد
        </button>
      </div>

      {flash && <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/80" role="status">{flash}</p>}

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-4 rounded-3xl border border-[#38A7B4]/25 bg-[#38A7B4]/[0.04] p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tp-course" className="mb-1.5 block text-xs font-bold text-white/60">الدورة * — من دوراتك المؤهلة</label>
              <select id="tp-course" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white [&>option]:bg-[#121B1D]">
                <option value="" disabled>اختر الدورة</option>
                {quals.map((q) => <option key={q.courseId} value={q.courseId}>{q.title} ({q.courseId})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tp-type" className="mb-1.5 block text-xs font-bold text-white/60">نوع التعديل *</label>
              <select id="tp-type" value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white [&>option]:bg-[#121B1D]">
                {Object.entries(CHANGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tp-target" className="mb-1.5 block text-xs font-bold text-white/60">المحور المستهدف (معرفه) — اختياري</label>
              <input id="tp-target" dir="ltr" placeholder="C-BIZ-101-M2" value={form.targetKey} onChange={(e) => setForm({ ...form, targetKey: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-left font-mono text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
            </div>
            <div>
              <label htmlFor="tp-value" className="mb-1.5 block text-xs font-bold text-white/60">القيمة المقترحة *</label>
              <input id="tp-value" required value={form.newValue} onChange={(e) => setForm({ ...form, newValue: e.target.value })}
                placeholder="العنوان الجديد أو النص أو الساعات"
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="tp-reason" className="mb-1.5 block text-xs font-bold text-white/60">سبب التعديل * — لماذا يخدم المتعلم؟</label>
            <textarea id="tp-reason" required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
          </div>
          <button type="submit" disabled={busy || form.reason.trim().length < 10 || !form.courseId || !form.newValue.trim()}
            className="cursor-pointer rounded-full bg-[#FABC05] px-6 py-2.5 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:opacity-40">
            {busy ? "جاري الإرسال…" : "أرسل للمراجعة"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : mine.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <GitPullRequest className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا اقتراحات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">حين ترى تحسينا يخدم طلابك في دورة مؤهل لها — اقترحه هنا وسيراجعه المسؤول الأكاديمي.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mine.map((r) => (
            <article key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{r.course.versions[0]?.titleAr ?? r.courseId} <span className="text-[10px] text-white/35" dir="ltr">{r.courseId}</span></p>
                  <p className="mt-1 text-xs text-white/55">{r.reason}</p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {r.items.map((i) => CHANGE_TYPE_LABELS[i.changeType] ?? i.changeType).join(" · ")} — نطاق: {r.scope === "cohort" ? "شعبة" : "الكتالوج"}
                  </p>
                  {r.reviewerComment && (
                    <p className="mt-2 rounded-lg border border-[#FABC05]/25 bg-[#FABC05]/5 p-2 text-[11px] text-[#FABC05]">تعليق المراجع: {r.reviewerComment}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#38A7B4]/40 px-3 py-1 text-[11px] font-bold text-[#6EC7D1]">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  {["draft", "submitted", "under_review", "changes_requested"].includes(r.status) && (
                    <button onClick={() => void withdraw(r.id)} title="سحب الاقتراح"
                      className="cursor-pointer rounded-full border border-white/15 p-2 text-white/50 transition hover:border-red-400/40 hover:text-red-300">
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}
