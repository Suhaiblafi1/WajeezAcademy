/* عمليات الشعبة المتقدمة — تعيين مدرب، تعديل، مواد، تقييمات، إسقاط تسجيل،
   شهادات، نشر عام — إضافة إلى روبرك وقواعد الإكمال على مستوى الصفحة.
   كلها API حقيقي من admin-learning وadmin-trainer. */
import { useCallback, useEffect, useState } from "react";
import {
  Award, BadgeCheck, BookOpen, CalendarPlus, ChevronDown, FilePlus2, Globe,
  Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus,
} from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";

const inputCls = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none";
const selectCls = `${inputCls} [&>option]:bg-[#121B1D]`;

interface CohortLite {
  id: string; title: string; status: string; courseId: string; daysOfWeek: string[];
  startTime: string | null; capacity: number | null; price: string | null;
  registrationOpen: boolean; financialReady: boolean;
}

type Done = (msg: string) => void;

function MiniCard({ icon: Icon, title, children, defaultOpen = false }: {
  icon: typeof UserPlus; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center justify-between text-xs font-black text-white/60">
        <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function CohortOps({ cohort, onDone }: { cohort: CohortLite; onDone: Done }) {
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState("");
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  const [assignForm, setAssignForm] = useState({ profileId: "", role: "lead" });
  const [editForm, setEditForm] = useState({
    title: cohort.title, days: cohort.daysOfWeek.join("، "), startTime: cohort.startTime ?? "18:00",
    capacity: cohort.capacity?.toString() ?? "", price: cohort.price ?? "",
    registrationOpen: cohort.registrationOpen, financialReady: cohort.financialReady,
  });
  const [materialForm, setMaterialForm] = useState({ title: "", kind: "link", externalUrl: "", originalName: "", mime: "application/pdf", sizeBytes: "" });
  const [assessForm, setAssessForm] = useState({ title: "", type: "assignment", maxScore: "100", passScore: "", dueAt: "" });
  const [items, setItems] = useState([{ prompt: "", kind: "text", maxScore: "" }]);
  const [dropForm, setDropForm] = useState({ enrollmentId: "", note: "" });
  const [certId, setCertId] = useState("");
  const [revokeForm, setRevokeForm] = useState({ certificateId: "", reason: "" });

  useEffect(() => {
    apiGet<{ id: string; name: string }[]>("/api/trainers/public").then(setTrainers).catch(() => setTrainers([]));
  }, []);

  const act = useCallback(async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return;
    setBusy(true); setLocalMsg("");
    try { await fn(); setLocalMsg(msg); onDone(msg); }
    catch (e) { setLocalMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  }, [busy, onDone]);

  return (
    <div className="space-y-3">
      {localMsg && <p className="text-[11px] font-bold text-[#6EC7D1]" role="status">{localMsg}</p>}

      {/* تعيين مدرب */}
      <MiniCard icon={UserPlus} title="تعيين مدرب — يتطلب تأهيلا قائما ويفحص تعارض الجدول">
        <div className="flex flex-wrap gap-2">
          <select value={assignForm.profileId} onChange={(e) => setAssignForm({ ...assignForm, profileId: e.target.value })} className={`${selectCls} flex-1`}>
            <option value="">اختر مدربا معلنا…</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={assignForm.role} onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })} className={selectCls}>
            <option value="lead">رئيسي</option>
            <option value="assistant">مساعد</option>
          </select>
          <button disabled={busy || !assignForm.profileId}
            onClick={() => act(() => apiPost(`/api/admin/cohorts/${cohort.id}/trainers`, assignForm), "عُين المدرب للشعبة")}
            className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15 disabled:opacity-40">
            عيّن
          </button>
        </div>
        {trainers.length === 0 && (
          <p className="mt-2 text-[10px] text-white/40">لا مدربون معلنون — أدخل معرف الملف يدويا:</p>
        )}
        {trainers.length === 0 && (
          <div className="mt-2 flex gap-2">
            <input value={assignForm.profileId} onChange={(e) => setAssignForm({ ...assignForm, profileId: e.target.value })}
              placeholder="معرف ملف المدرب (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
          </div>
        )}
        <p className="mt-2 text-[10px] text-white/40">التأهيل يُدار من «طلبات المدربين» — ملف المدرب ← تأهيل لدورة.</p>
      </MiniCard>

      {/* تعديل الشعبة */}
      {!["completed", "cancelled"].includes(cohort.status) && (
        <MiniCard icon={Pencil} title="تعديل الشعبة — جدولة وسعة وسعر وبوابات الفتح">
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="العنوان" className={inputCls} />
            <input value={editForm.days} onChange={(e) => setEditForm({ ...editForm, days: e.target.value })} placeholder="الأيام — الأحد، الثلاثاء" className={inputCls} />
            <input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} className={inputCls} />
            <input type="number" min={1} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} placeholder="السعة" className={inputCls} />
            <input type="number" min={0} value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="السعر (د.أ)" className={inputCls} />
            <div className="flex items-center gap-4 text-[11px] text-white/60">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={editForm.registrationOpen} onChange={(e) => setEditForm({ ...editForm, registrationOpen: e.target.checked })} className="accent-[#38A7B4]" />
                التسجيل مفتوح
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={editForm.financialReady} onChange={(e) => setEditForm({ ...editForm, financialReady: e.target.checked })} className="accent-[#38A7B4]" />
                جاهزة ماليا
              </label>
            </div>
          </div>
          <button disabled={busy || editForm.title.length < 3}
            onClick={() => act(() => apiPatch(`/api/admin/cohorts/${cohort.id}`, {
              title: editForm.title,
              daysOfWeek: editForm.days ? editForm.days.split(/[،,]/).map((d) => d.trim()).filter(Boolean) : undefined,
              startTime: editForm.startTime || undefined,
              capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
              price: editForm.price ? Number(editForm.price) : undefined,
              registrationOpen: editForm.registrationOpen,
              financialReady: editForm.financialReady,
            }), "حُدثت الشعبة")}
            className="mt-3 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15 disabled:opacity-40">
            احفظ التعديل
          </button>
        </MiniCard>
      )}

      {/* مادة تعليمية */}
      <MiniCard icon={FilePlus2} title="مادة تعليمية — رابط خارجي أو ملف خاص برفع موقَّع">
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={materialForm.title} onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })} placeholder="عنوان المادة" className={inputCls} />
          <select value={materialForm.kind} onChange={(e) => setMaterialForm({ ...materialForm, kind: e.target.value })} className={selectCls}>
            <option value="link">رابط</option>
            <option value="file">ملف</option>
            <option value="summary_audio">ملخص صوتي</option>
            <option value="summary_text">ملخص نصي</option>
          </select>
          {materialForm.kind === "link" ? (
            <input value={materialForm.externalUrl} onChange={(e) => setMaterialForm({ ...materialForm, externalUrl: e.target.value })}
              placeholder="https://…" dir="ltr" className={`${inputCls} sm:col-span-2`} />
          ) : (
            <>
              <input value={materialForm.originalName} onChange={(e) => setMaterialForm({ ...materialForm, originalName: e.target.value })} placeholder="اسم الملف" dir="ltr" className={inputCls} />
              <input type="number" min={1} value={materialForm.sizeBytes} onChange={(e) => setMaterialForm({ ...materialForm, sizeBytes: e.target.value })} placeholder="الحجم (بايت)" dir="ltr" className={inputCls} />
            </>
          )}
        </div>
        <button
          disabled={busy || materialForm.title.length < 2 || (materialForm.kind === "link" ? !/^https?:\/\/.+/.test(materialForm.externalUrl) : !materialForm.originalName || !materialForm.sizeBytes)}
          onClick={() => act(async () => {
            await apiPost(`/api/admin/cohorts/${cohort.id}/materials`, {
              title: materialForm.title, kind: materialForm.kind,
              externalUrl: materialForm.kind === "link" ? materialForm.externalUrl : undefined,
              file: materialForm.kind !== "link" && materialForm.originalName
                ? { originalName: materialForm.originalName, mime: materialForm.mime, sizeBytes: Number(materialForm.sizeBytes) } : undefined,
            });
            setMaterialForm({ title: "", kind: "link", externalUrl: "", originalName: "", mime: "application/pdf", sizeBytes: "" });
          }, "سُجلت المادة")}
          className="mt-3 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15 disabled:opacity-40">
          سجّل المادة
        </button>
      </MiniCard>

      {/* تقييم جديد */}
      {!["completed", "cancelled"].includes(cohort.status) && (
        <MiniCard icon={BookOpen} title="تقييم جديد — واجب / اختبار / مشروع مع بنود">
          <div className="grid gap-2 sm:grid-cols-5">
            <input value={assessForm.title} onChange={(e) => setAssessForm({ ...assessForm, title: e.target.value })} placeholder="عنوان التقييم" className={`${inputCls} sm:col-span-2`} />
            <select value={assessForm.type} onChange={(e) => setAssessForm({ ...assessForm, type: e.target.value })} className={selectCls}>
              <option value="assignment">واجب</option>
              <option value="quiz">اختبار</option>
              <option value="project">مشروع</option>
            </select>
            <input type="number" min={1} value={assessForm.maxScore} onChange={(e) => setAssessForm({ ...assessForm, maxScore: e.target.value })} placeholder="الدرجة القصوى" className={inputCls} />
            <input type="datetime-local" value={assessForm.dueAt} onChange={(e) => setAssessForm({ ...assessForm, dueAt: e.target.value })} className={inputCls} />
          </div>
          <div className="mt-2 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input value={it.prompt} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))}
                  placeholder={`البند ${i + 1} — نص السؤال/المطلوب`} className={`${inputCls} flex-1`} />
                <select value={it.kind} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} className={selectCls}>
                  <option value="text">نصي</option>
                  <option value="choice">اختياري</option>
                  <option value="file">ملف</option>
                </select>
                <input type="number" min={1} value={it.maxScore} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, maxScore: e.target.value } : x)))}
                  placeholder="درجة" className={`${inputCls} w-20`} />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="cursor-pointer text-white/40 hover:text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setItems([...items, { prompt: "", kind: "text", maxScore: "" }])}
              className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-white/55 hover:border-white/40">
              <Plus className="h-3 w-3" /> بند
            </button>
            <button disabled={busy || assessForm.title.length < 3}
              onClick={() => act(async () => {
                await apiPost(`/api/admin/cohorts/${cohort.id}/assessments`, {
                  title: assessForm.title, type: assessForm.type,
                  maxScore: Number(assessForm.maxScore) || undefined,
                  dueAt: assessForm.dueAt ? new Date(assessForm.dueAt) : undefined,
                  items: items.filter((i) => i.prompt.trim().length >= 2).map((i) => ({
                    prompt: i.prompt, kind: i.kind, maxScore: i.maxScore ? Number(i.maxScore) : undefined,
                  })),
                });
                setAssessForm({ title: "", type: "assignment", maxScore: "100", passScore: "", dueAt: "" });
                setItems([{ prompt: "", kind: "text", maxScore: "" }]);
              }, "أُنشئ التقييم وأتاح للمتعلمين")}
              className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15 disabled:opacity-40">
              أنشئ التقييم
            </button>
          </div>
        </MiniCard>
      )}

      {/* التسجيل والشهادات */}
      <MiniCard icon={Award} title="التسجيل والشهادات — إسقاط / إصدار / إلغاء">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input value={dropForm.enrollmentId} onChange={(e) => setDropForm({ ...dropForm, enrollmentId: e.target.value })}
              placeholder="معرف التسجيل للإسقاط (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
            <input value={dropForm.note} onChange={(e) => setDropForm({ ...dropForm, note: e.target.value })} placeholder="ملاحظة (اختياري)" className={inputCls} />
            <button disabled={busy || !dropForm.enrollmentId.trim()}
              onClick={() => act(() => apiPost(`/api/admin/enrollments/${dropForm.enrollmentId.trim()}/drop`, { note: dropForm.note || undefined }), "أُسقط التسجيل")}
              className="flex cursor-pointer items-center gap-1 rounded-xl border border-red-500/40 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40">
              <UserMinus className="h-3.5 w-3.5" /> إسقاط
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={certId} onChange={(e) => setCertId(e.target.value)}
              placeholder="معرف التسجيل لإصدار شهادة (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
            <button disabled={busy || !certId.trim()}
              onClick={() => act(() => apiPost(`/api/admin/enrollments/${certId.trim()}/certificate`), "أُصدرت الشهادة — أو رُفضت بقائمة القواعد غير المحققة")}
              className="flex cursor-pointer items-center gap-1 rounded-xl border border-[#FABC05]/40 px-4 py-2 text-xs font-bold text-[#FABC05] hover:bg-[#FABC05]/10 disabled:opacity-40">
              <BadgeCheck className="h-3.5 w-3.5" /> إصدار شهادة
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={revokeForm.certificateId} onChange={(e) => setRevokeForm({ ...revokeForm, certificateId: e.target.value })}
              placeholder="معرف الشهادة للإلغاء (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
            <input value={revokeForm.reason} onChange={(e) => setRevokeForm({ ...revokeForm, reason: e.target.value })} placeholder="السبب الموثق (5+ أحرف)" className={inputCls} />
            <button disabled={busy || revokeForm.reason.length < 5 || !revokeForm.certificateId.trim()}
              onClick={() => act(() => apiPost(`/api/admin/certificates/${revokeForm.certificateId.trim()}/revoke`, { reason: revokeForm.reason }), "أُلغيت الشهادة ووُثق السبب")}
              className="cursor-pointer rounded-xl border border-red-500/40 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40">
              إلغاء شهادة
            </button>
          </div>
        </div>
      </MiniCard>

      {/* نشر عام */}
      {cohort.status === "open" && (
        <button disabled={busy}
          onClick={() => act(() => apiPost(`/api/admin/cohorts/${cohort.id}/publish`), "نُشرت الشعبة — إسنادات المدربين ظاهرة للعامة")}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#FABC05]/40 px-4 py-2 text-xs font-bold text-[#FABC05] transition hover:bg-[#FABC05]/10 disabled:opacity-40">
          <Globe className="h-3.5 w-3.5" /> نشر عام لإسنادات المدربين
        </button>
      )}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-white/30" />}
    </div>
  );
}

/** روبرك وقواعد إكمال — على مستوى الصفحة لأنهما يخدمان كل الشعب */
export function LearningSettings({ courses, cohorts, onDone }: {
  courses: { id: string; title: string }[];
  cohorts: { id: string; title: string }[];
  onDone: Done;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [rubricTitle, setRubricTitle] = useState("");
  const [criteria, setCriteria] = useState([{ title: "", maxScore: "10" }]);
  const [ruleForm, setRuleForm] = useState({ courseId: "", cohortId: "", type: "attendance_pct", threshold: "80", required: true });

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await fn(); setMsg(doneMsg); onDone(doneMsg); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-sm font-black"><CalendarPlus className="h-4 w-4 text-[#38A7B4]" /> روبرك تقييم جديد — قابل لإعادة الاستخدام</h3>
        <input value={rubricTitle} onChange={(e) => setRubricTitle(e.target.value)} placeholder="عنوان الروبرك" className={`${inputCls} mt-3`} />
        <div className="mt-2 space-y-2">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={c.title} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder={`المعيار ${i + 1}`} className={`${inputCls} flex-1`} />
              <input type="number" min={1} value={c.maxScore} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, maxScore: e.target.value } : x)))}
                className={`${inputCls} w-20`} />
              {criteria.length > 1 && (
                <button type="button" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} className="cursor-pointer text-white/40 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setCriteria([...criteria, { title: "", maxScore: "10" }])}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-white/55 hover:border-white/40">
            <Plus className="h-3 w-3" /> معيار
          </button>
          <button disabled={busy || rubricTitle.length < 3 || criteria.some((c) => c.title.trim().length < 2)}
            onClick={() => act(async () => {
              await apiPost("/api/admin/rubrics", {
                title: rubricTitle,
                criteria: criteria.map((c) => ({ title: c.title, maxScore: Number(c.maxScore) || 1 })),
              });
              setRubricTitle(""); setCriteria([{ title: "", maxScore: "10" }]);
            }, "أُنشئ الروبرك")}
            className="cursor-pointer rounded-full bg-[#38A7B4] px-4 py-1.5 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1] disabled:opacity-40">
            أنشئ الروبرك
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-sm font-black"><BadgeCheck className="h-4 w-4 text-[#38A7B4]" /> قاعدة إكمال — لدورة عامة أو لشعبة محددة</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select value={ruleForm.courseId} onChange={(e) => setRuleForm({ ...ruleForm, courseId: e.target.value })} className={selectCls}>
            <option value="">الدورة…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select value={ruleForm.cohortId} onChange={(e) => setRuleForm({ ...ruleForm, cohortId: e.target.value })} className={selectCls}>
            <option value="">كل الشعب (عامة)</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select value={ruleForm.type} onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })} className={selectCls}>
            <option value="attendance_pct">نسبة حضور %</option>
            <option value="modules_completed">وحدات مكتملة</option>
            <option value="assignment_accepted">واجب مقبول</option>
            <option value="project_accepted">مشروع مقبول</option>
            <option value="assessment_passed">تقييم مجتاز</option>
          </select>
          <input type="number" min={1} value={ruleForm.threshold} onChange={(e) => setRuleForm({ ...ruleForm, threshold: e.target.value })}
            placeholder="العتبة" className={inputCls} />
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-white/60">
          <input type="checkbox" checked={ruleForm.required} onChange={(e) => setRuleForm({ ...ruleForm, required: e.target.checked })} className="accent-[#38A7B4]" />
          قاعدة إلزامية للشهادة
        </label>
        <button disabled={busy || !ruleForm.courseId || Number(ruleForm.threshold) < 1}
          onClick={() => act(() => apiPost("/api/admin/completion-rules", {
            courseId: ruleForm.courseId, cohortId: ruleForm.cohortId || undefined,
            type: ruleForm.type, threshold: Number(ruleForm.threshold), required: ruleForm.required,
          }), "حُفظت قاعدة الإكمال")}
          className="mt-3 cursor-pointer rounded-full bg-[#38A7B4] px-4 py-1.5 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1] disabled:opacity-40">
          احفظ القاعدة
        </button>
      </div>
      {msg && <p className="text-xs font-bold text-[#6EC7D1] lg:col-span-2" role="status">{msg}</p>}
    </section>
  );
}
