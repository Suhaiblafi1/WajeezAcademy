/* عمليات الشعبة المتقدمة — تعيين مدرب، تعديل، مواد، تقييمات، إسقاط تسجيل،
   شهادات، نشر عام — إضافة إلى روبرك وقواعد الإكمال على مستوى الصفحة.
   كلها API حقيقي من admin-learning وadmin-trainer. */
import { useCallback, useEffect, useState } from "react";
import {
  Award, BadgeCheck, BookOpen, CalendarPlus, ChevronDown, FilePlus2, Globe,
  Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus,
} from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import DayOfWeekPicker from "@/components/DayOfWeekPicker";

import { Panel, Card } from "@/components/ui/Surface";
const inputCls = "w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-[#38A7B4] focus:outline-none";
const selectCls = `${inputCls} [&>option]:bg-surface`;

interface CohortLite {
  id: string; title: string; status: string; courseId: string; daysOfWeek: string[];
  startTime: string | null; capacity: number | null; price: string | null; currency: string;
  registrationOpen: boolean; financialReady: boolean;
}

/** مدرّبٌ محتمَل لهذه الشعبة — بحال تأهيله لدورتها */
interface EligibleTrainer {
  profileId: string;
  name: string;
  qualification: "qualified" | "pending" | "rejected" | "retired" | "none";
  qualificationId: string | null;
  assignedRole: string | null;
  /* إشارتا الإتاحة (المهمّة ٧١) — تُقرآن قبل النقر لا بعد الرفض */
  onLeave: boolean;
  /** `null` = لم يُعلن ساعاته · رقمٌ = جلساتٌ خارجها. والصفرُ معلومةٌ لا غياب */
  outsideDeclaredHours: number | null;
}

const QUALIFICATION_LABEL: Record<EligibleTrainer["qualification"], string> = {
  qualified: "مؤهَّل",
  pending: "طلبٌ قائم",
  rejected: "رُدَّ سابقا",
  retired: "تأهيلٌ مسحوب",
  none: "غير مؤهَّل",
};

type Done = (msg: string) => void;

function MiniCard({ icon: Icon, title, children, defaultOpen = false }: {
  icon: typeof UserPlus; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-paper/20">
      <button onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center justify-between text-xs font-black text-muted-foreground">
        <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}

export function CohortOps({ cohort, onDone }: { cohort: CohortLite; onDone: Done }) {
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState("");
  /* المدرّبون بحالِ تأهيل كلٍّ منهم لدورة **هذه الشعبة** — لا قائمةُ المعلَنين.

     كانت القائمةُ من `/api/trainers/public` بلا أيّ ذكرٍ للتأهيل، فيُختار
     مدرّبٌ ويُضغط «عيّن» ويُردّ بـ409 «غير مؤهل». والفرقُ بين «أسنده» و«أهّله
     وأسنده» قرارٌ يُتّخذ قبل النقر لا بعده. */
  const [trainers, setTrainers] = useState<EligibleTrainer[]>([]);
  const [assignForm, setAssignForm] = useState({ profileId: "", role: "lead" });
  const [editForm, setEditForm] = useState({
    title: cohort.title, days: cohort.daysOfWeek, startTime: cohort.startTime ?? "18:00",
    capacity: cohort.capacity?.toString() ?? "", price: cohort.price ?? "",
    registrationOpen: cohort.registrationOpen, financialReady: cohort.financialReady,
  });
  const [materialForm, setMaterialForm] = useState({ title: "", kind: "link", externalUrl: "", originalName: "", mime: "application/pdf", sizeBytes: "" });
  const [assessForm, setAssessForm] = useState({ title: "", type: "assignment", maxScore: "100", passScore: "", dueAt: "" });
  const [items, setItems] = useState([{ prompt: "", kind: "text", maxScore: "" }]);
  const [dropForm, setDropForm] = useState({ enrollmentId: "", note: "" });
  const [recForm, setRecForm] = useState({ sessionId: "", title: "", moduleId: "", mime: "video/mp4", sizeBytes: "", durationSec: "" });
  const [contentForm, setContentForm] = useState({ kind: "material", id: "", status: "archived" });

  const loadTrainers = useCallback(() => {
    apiGet<EligibleTrainer[]>(`/api/admin/cohorts/${cohort.id}/eligible-trainers`)
      .then(setTrainers)
      .catch(() => setTrainers([]));
  }, [cohort.id]);
  useEffect(() => { loadTrainers(); }, [loadTrainers]);

  const picked = trainers.find((t) => t.profileId === assignForm.profileId) ?? null;

  const act = useCallback(async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return;
    setBusy(true); setLocalMsg("");
    try { await fn(); setLocalMsg(msg); onDone(msg); }
    catch (e) { setLocalMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  }, [busy, onDone]);

  return (
    <div className="space-y-3">
      {localMsg && <p className="text-[11px] font-bold text-teal-light-ink" role="status">{localMsg}</p>}

      {/* تعيين مدرب — خطوةٌ واحدة للمؤهَّل، وطلبٌ واحد لغيره.

          كان الإسنادُ يفترض تأهيلا سابقا يُدار في شاشةٍ أخرى، والنصُّ أسفلَه
          يحيل إليها: «التأهيل يُدار من طلبات المدربين». فمن أراد مدرّبا
          لشعبةٍ مشى ثلاث خطوات في مكانين، ولو نسي الثانية بقي المدرّبُ
          مؤهَّلا بلا شعبة والشعبةُ بلا مدرّب.

          وبوّابةُ نزاهة التأهيل باقية: هذا الزرُّ **يطلب** ولا يقرّر. يبتّ
          فيه المديرُ الأكاديميّ، وموافقتُه تؤهّل وتُسند في فعلٍ واحد. */}
      <MiniCard icon={UserPlus} title="مدرّب الشعبة — إسنادٌ مباشر للمؤهَّل، وطلبُ تأهيلٍ لغيره">
        <div className="flex flex-wrap gap-2">
          <select value={assignForm.profileId} onChange={(e) => setAssignForm({ ...assignForm, profileId: e.target.value })} className={`${selectCls} flex-1`}>
            <option value="">اختر مدربا…</option>
            {trainers.map((t) => (
              <option key={t.profileId} value={t.profileId}>
                {t.name} — {QUALIFICATION_LABEL[t.qualification]}{t.assignedRole ? " · مُسنَد" : ""}
                {t.onLeave ? " · غائب في هذه المدّة" : ""}
                {t.outsideDeclaredHours ? ` · ${t.outsideDeclaredHours} جلسة خارج ساعاته` : ""}
              </option>
            ))}
          </select>
          <select value={assignForm.role} onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })} className={selectCls}>
            <option value="lead">رئيسي</option>
            <option value="assistant">مساعد</option>
          </select>
          {picked?.qualification === "qualified" ? (
            <button disabled={busy}
              onClick={() => act(
                () => apiPost(`/api/admin/cohorts/${cohort.id}/trainers`, assignForm).then(loadTrainers),
                "عُيّن المدرب للشعبة",
              )}
              className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground hover:bg-white/15 disabled:opacity-40">
              أسنده
            </button>
          ) : (
            <button disabled={busy || !picked || picked.qualification === "pending"}
              onClick={() => act(
                () => apiPost(`/api/admin/cohorts/${cohort.id}/qualification-requests`, {
                  profileId: assignForm.profileId, courseId: cohort.courseId,
                }).then(loadTrainers),
                "رُفع طلبُ التأهيل — الموافقة تؤهّله وتُسنده معا",
              )}
              className="cursor-pointer rounded-xl bg-gold/85 px-4 py-2 text-xs font-black text-on-gold hover:bg-gold disabled:opacity-40">
              أهّله وأسنده الآن
            </button>
          )}
        </div>

        {/* الغيابُ يُقال أوّلا لأنّه **مانعٌ** لا تنبيه: الزرُّ سيُردّ بـ409،
            فمن حقّ المُسنِد أن يعرف قبل أن يضغط. والساعاتُ تنبيهٌ بعده. */}
        {picked?.onLeave && (
          <p className="mt-2 rounded-xl border border-red-400/30 bg-red-400/[0.06] p-2 text-micro font-bold leading-5 text-red-200" role="status">
            المدرّبُ أعلن غيابَه في مدّةٍ تقع فيها جلسةٌ من جلسات هذه الشعبة — الإسنادُ سيُردّ. اختر غيرَه، أو راجعه ليحدّث إتاحته.
          </p>
        )}
        {!picked?.onLeave && picked?.outsideDeclaredHours ? (
          <p className="mt-2 rounded-xl border border-gold/30 bg-gold/[0.06] p-2 text-micro font-bold leading-5 text-gold-ink" role="status">
            {picked.outsideDeclaredHours} من جلسات هذه الشعبة تقع خارجَ ساعاته المعلنة — الإسنادُ جائزٌ، والقرارُ لك.
          </p>
        ) : null}

        {picked && (
          <p className="mt-2 text-micro leading-5 text-muted-foreground">
            {picked.qualification === "qualified"
              ? "مؤهَّل لهذه الدورة — الإسناد يقع الآن، ويُفحص تعارضُ جدوله قبل وقوعه."
              : picked.qualification === "pending"
                ? "له طلبُ تأهيلٍ قائم على هذه الدورة — بانتظار قرار المدير الأكاديميّ."
                : picked.qualification === "rejected"
                  ? "سبق أن رُدَّ تأهيلُه لهذه الدورة. رفعُ طلبٍ جديد يُعيدها إلى طاولة القرار."
                  : "غير مؤهَّل لهذه الدورة بعد — الطلب يذهب إلى المدير الأكاديميّ، وموافقتُه تؤهّله وتُسنده معا."}
          </p>
        )}
        {trainers.length === 0 && (
          <p className="mt-2 text-micro text-muted-foreground">لا مدرّبين نشطين بعد — تُعتمد الطلبات من «طلبات المدربين».</p>
        )}
      </MiniCard>

      {/* تعديل الشعبة */}
      {!["completed", "cancelled"].includes(cohort.status) && (
        <MiniCard icon={Pencil} title="تعديل الشعبة — جدولة وسعة وسعر وبوابات الفتح">
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="العنوان" className={inputCls} />
            <DayOfWeekPicker value={editForm.days} onChange={(days) => setEditForm({ ...editForm, days })} label="الأيّام" />
            <input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} className={inputCls} />
            <input type="number" min={1} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} placeholder="السعة" className={inputCls} />
            <input type="number" min={0} value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder={`السعر (${cohort.currency})`} className={inputCls} />
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={editForm.registrationOpen} onChange={(e) => setEditForm({ ...editForm, registrationOpen: e.target.checked })} className="accent-teal" />
                التسجيل مفتوح
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={editForm.financialReady} onChange={(e) => setEditForm({ ...editForm, financialReady: e.target.checked })} className="accent-teal" />
                جاهزة ماليا
              </label>
            </div>
          </div>
          <button disabled={busy || editForm.title.length < 3}
            onClick={() => act(() => apiPatch(`/api/admin/cohorts/${cohort.id}`, {
              title: editForm.title,
              daysOfWeek: editForm.days,
              startTime: editForm.startTime || undefined,
              capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
              price: editForm.price ? Number(editForm.price) : undefined,
              registrationOpen: editForm.registrationOpen,
              financialReady: editForm.financialReady,
            }), "حُدثت الشعبة")}
            className="mt-3 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground hover:bg-white/15 disabled:opacity-40">
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
          className="mt-3 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground hover:bg-white/15 disabled:opacity-40">
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
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="cursor-pointer text-muted-foreground hover:text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setItems([...items, { prompt: "", kind: "text", maxScore: "" }])}
              className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-micro font-bold text-muted-foreground hover:border-white/40">
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
              className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground hover:bg-white/15 disabled:opacity-40">
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
          {/* ─────────── الشهادات: قائمةٌ لا معرّفاتٌ تُلصق ───────────

              كان الإصدارُ يطلب «معرّف التسجيل (UUID)» والإلغاءُ «معرّف
              الشهادة (UUID)» — يُكتبان يدا ولا شاشةَ تعرضهما. فمن أراد أن
              يُصدر شهادةً لطالبٍ أنهى دورتَه احتاج أن يستخرج معرّفا من مكانٍ
              آخر.

              وقرارُ صاحب المنصّة: «فلتر القائمة افتراضيا لمن أنهى فعلا».
              والأهليّةُ محسوبةٌ في الخادم بالقواعد نفسِها التي يفحصها
              الإصدار — فلا تقول القائمةُ «مؤهَّل» ثمّ يرفض الزرّ. */}
          <CertificateCandidates cohortId={cohort.id} busy={busy} act={act} />
        </div>
      </MiniCard>

      {/* تسجيلات الجلسات وأرشفة المحتوى */}
      <MiniCard icon={BookOpen} title="تسجيلات الجلسات وأرشفة المحتوى — ملفات خاصة موقعة">
        <p className="mb-2 text-micro font-bold text-muted-foreground">تسجيل تسجيل جلسة (يرتبط بالجلسة ووحدة اختيارية):</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={recForm.sessionId} onChange={(e) => setRecForm({ ...recForm, sessionId: e.target.value })}
            placeholder="معرف الجلسة (UUID)" dir="ltr" className={`${inputCls} font-mono`} />
          <input value={recForm.title} onChange={(e) => setRecForm({ ...recForm, title: e.target.value })} placeholder="عنوان التسجيل" className={inputCls} />
          <input value={recForm.moduleId} onChange={(e) => setRecForm({ ...recForm, moduleId: e.target.value })}
            placeholder="معرف الوحدة (اختياري)" dir="ltr" className={`${inputCls} font-mono`} />
          <input value={recForm.mime} onChange={(e) => setRecForm({ ...recForm, mime: e.target.value })} placeholder="MIME" dir="ltr" className={inputCls} />
          <input type="number" min={1} value={recForm.sizeBytes} onChange={(e) => setRecForm({ ...recForm, sizeBytes: e.target.value })} placeholder="الحجم (بايت)" dir="ltr" className={inputCls} />
          <input type="number" min={1} value={recForm.durationSec} onChange={(e) => setRecForm({ ...recForm, durationSec: e.target.value })} placeholder="المدة (ثانية، اختياري)" dir="ltr" className={inputCls} />
        </div>
        <button disabled={busy || !recForm.sessionId.trim() || recForm.title.length < 2 || !recForm.sizeBytes}
          onClick={() => act(async () => {
            await apiPost(`/api/admin/sessions/${recForm.sessionId.trim()}/recordings`, {
              title: recForm.title, mime: recForm.mime, sizeBytes: Number(recForm.sizeBytes),
              moduleId: recForm.moduleId.trim() || undefined,
              durationSec: recForm.durationSec ? Number(recForm.durationSec) : undefined,
            });
            setRecForm({ sessionId: "", title: "", moduleId: "", mime: "video/mp4", sizeBytes: "", durationSec: "" });
          }, "سُجل التسجيل وأُنشئ رابط رفعه الموقع")}
          className="mt-2 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground hover:bg-white/15 disabled:opacity-40">
          سجّل التسجيل
        </button>

        <p className="mt-4 mb-2 border-t border-white/8 pt-3 text-micro font-bold text-muted-foreground">أرشفة أو تعطيل مادة/تسجيل (لا حذف — أثر قانوني يبقى):</p>
        <div className="flex flex-wrap gap-2">
          <select value={contentForm.kind} onChange={(e) => setContentForm({ ...contentForm, kind: e.target.value })} className={selectCls}>
            <option value="material">مادة</option>
            <option value="recording">تسجيل</option>
          </select>
          <input value={contentForm.id} onChange={(e) => setContentForm({ ...contentForm, id: e.target.value })}
            placeholder="معرف المحتوى (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
          <select value={contentForm.status} onChange={(e) => setContentForm({ ...contentForm, status: e.target.value })} className={selectCls}>
            <option value="active">نشط</option>
            <option value="archived">مؤرشف</option>
            <option value="disabled">معطل</option>
          </select>
          <button disabled={busy || !contentForm.id.trim()}
            onClick={() => act(() => apiPost(`/api/admin/content/${contentForm.kind}/${contentForm.id.trim()}/status`, { status: contentForm.status }), "حُدثت حالة المحتوى")}
            className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground hover:bg-white/15 disabled:opacity-40">
            طبّق الحالة
          </button>
        </div>
      </MiniCard>

      {/* نشر عام */}
      {cohort.status === "open" && (
        <button disabled={busy}
          onClick={() => act(() => apiPost(`/api/admin/cohorts/${cohort.id}/publish`), "نُشرت الشعبة — إسنادات المدربين ظاهرة للعامة")}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gold/40 px-4 py-2 text-xs font-bold text-gold-ink transition hover:bg-gold/10 disabled:opacity-40">
          <Globe className="h-3.5 w-3.5" /> نشر عام لإسنادات المدربين
        </button>
      )}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />}
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
      <Panel>
        <h3 className="flex items-center gap-2 text-sm font-black"><CalendarPlus className="h-4 w-4 text-teal-ink" /> روبرك تقييم جديد — قابل لإعادة الاستخدام</h3>
        <input value={rubricTitle} aria-label="عنوان الروبرك" onChange={(e) => setRubricTitle(e.target.value)} placeholder="عنوان الروبرك" className={`${inputCls} mt-3`} />
        <div className="mt-2 space-y-2">
          {criteria.map((c, i) => (
            /* ثلاثةُ عناصرَ في صفٍّ واحد تنضغط على الهاتف: القياسُ على ٣٩٠
               بكسلا وجد حقلَ العنوان بستّةٍ وعشرين بكسلَ عرضٍ — لا يُكتب
               فيه شيء. فيلتفّ الصفُّ الآن، والعنوانُ يأخذ سطرَه وحدَه. */
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input value={c.title} aria-label={`عنوانُ المعيار ${i + 1}`}
                onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder={`المعيار ${i + 1}`} className={`${inputCls} min-w-0 basis-full sm:flex-1 sm:basis-auto`} />
              {/* الدرجةُ العليا كانت حقلا بلا اسمٍ ولا نصٍّ نائب: قارئُ الشاشة
                  يقول «حقلٌ رقميّ» ولا يقول ماذا يُكتب فيه — كشفه فحصُ
                  الإتاحة بعد توسيعه إلى شاشات الفريق. */}
              <input type="number" min={1} value={c.maxScore}
                aria-label={`الدرجةُ العليا للمعيار ${i + 1}`}
                onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, maxScore: e.target.value } : x)))}
                className={`${inputCls} w-20`} />
              {criteria.length > 1 && (
                <button type="button" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}
                  aria-label={`احذف المعيار ${i + 1}`}
                  className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-red-400/10 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setCriteria([...criteria, { title: "", maxScore: "10" }])}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-micro font-bold text-muted-foreground hover:border-white/40">
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
            className="cursor-pointer rounded-full bg-teal px-4 py-1.5 text-xs font-black text-on-teal hover:bg-teal-light disabled:opacity-40">
            أنشئ الروبرك
          </button>
        </div>
      </Panel>

      <Panel>
        <h3 className="flex items-center gap-2 text-sm font-black"><BadgeCheck className="h-4 w-4 text-teal-ink" /> قاعدة إكمال — لدورة عامة أو لشعبة محددة</h3>
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
          <input type="number" min={1} value={ruleForm.threshold} aria-label="عتبةُ القاعدة"
            onChange={(e) => setRuleForm({ ...ruleForm, threshold: e.target.value })}
            placeholder="العتبة" className={inputCls} />
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={ruleForm.required} onChange={(e) => setRuleForm({ ...ruleForm, required: e.target.checked })} className="accent-teal" />
          قاعدة إلزامية للشهادة
        </label>
        <button disabled={busy || !ruleForm.courseId || Number(ruleForm.threshold) < 1}
          onClick={() => act(() => apiPost("/api/admin/completion-rules", {
            courseId: ruleForm.courseId, cohortId: ruleForm.cohortId || undefined,
            type: ruleForm.type, threshold: Number(ruleForm.threshold), required: ruleForm.required,
          }), "حُفظت قاعدة الإكمال")}
          className="mt-3 cursor-pointer rounded-full bg-teal px-4 py-1.5 text-xs font-black text-on-teal hover:bg-teal-light disabled:opacity-40">
          احفظ القاعدة
        </button>
      </Panel>
      {msg && <p className="text-xs font-bold text-teal-light-ink lg:col-span-2" role="status">{msg}</p>}
    </section>
  );
}

/* مرشَّحو الشهادة في الشعبة — مَن أنهى فعلا أوّلا، ومن تعثّر بسببه مكتوبا.

   والقائمةُ تقرأ الأهليّةَ من الخادم لا تحسبها: القواعدُ هناك (`evaluateCompletion`)
   وحاجزُ توثيق البريد كذلك، وحسابُهما هنا يُنشئ مصدرا ثانيا يفترق عن الأوّل
   فتقول الشاشةُ «مؤهَّل» ويرفض الزرّ. */
interface CertCandidate {
  enrollmentId: string;
  learnerName: string;
  email: string;
  percent: number;
  eligible: boolean;
  failures: string[];
  certificate: { id: string; number: string; issuedAt: string } | null;
}

function CertificateCandidates({ cohortId, busy, act }: {
  cohortId: string;
  busy: boolean;
  act: (fn: () => Promise<unknown>, msg: string) => void;
}) {
  const [rows, setRows] = useState<CertCandidate[] | null>(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    apiGet<CertCandidate[]>(`/api/admin/cohorts/${cohortId}/certificate-candidates`)
      .then((r) => { setRows(r); setError(""); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "تعذّر قراءة المرشَّحين"));
  }, [cohortId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-[11px] leading-6 text-muted-foreground">{error}</p>;
  if (!rows) return <p className="text-[11px] text-muted-foreground">نقرأ المرشَّحين…</p>;
  if (rows.length === 0) return <p className="text-[11px] text-muted-foreground">لا مسجَّلين في هذه الشعبة بعد.</p>;

  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.enrollmentId} className="rounded-xl border border-white/8 bg-paper/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-foreground">{r.learnerName}</span>
              <span dir="ltr" className="block text-left text-micro text-muted-foreground">{r.email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-micro tabular-nums text-muted-foreground">{r.percent}٪</span>
              {r.certificate ? (
                <>
                  <span dir="ltr" className="rounded-full border border-teal/35 px-2 py-0.5 font-mono text-micro text-teal-light-ink">
                    {r.certificate.number}
                  </span>
                  <button
                    onClick={() => { setRevoking(revoking === r.certificate!.id ? null : r.certificate!.id); setReason(""); }}
                    className="cursor-pointer rounded-full border border-red-400/30 px-2.5 py-0.5 text-micro font-bold text-red-300 hover:bg-red-400/10"
                  >
                    ألغِها
                  </button>
                </>
              ) : r.eligible ? (
                <button
                  disabled={busy}
                  onClick={() => act(
                    () => apiPost(`/api/admin/enrollments/${r.enrollmentId}/certificate`).then(load),
                    `أُصدرت شهادة «${r.learnerName}»`,
                  )}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-gold/40 px-3 py-0.5 text-micro font-black text-gold-ink hover:bg-gold/10 disabled:opacity-40"
                >
                  <BadgeCheck className="h-3 w-3" /> أصدِر
                </button>
              ) : (
                <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-micro font-bold text-muted-foreground">
                  لم يُنهِ بعد
                </span>
              )}
            </span>
          </div>

          {/* السببُ يُقال قبل الضغط لا بعده — فلا يُجرَّب زرٌّ ليُعرف لماذا رُفض */}
          {!r.eligible && !r.certificate && r.failures.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {r.failures.map((f, i) => (
                <li key={i} className="text-micro leading-4 text-muted-foreground">— {f}</li>
              ))}
            </ul>
          )}

          {revoking === r.certificate?.id && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="سببُ الإلغاء — يبقى في السجلّ (٥ أحرف فأكثر)"
                className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[11px] outline-none placeholder:text-muted-foreground/75 focus:border-red-400/50"
              />
              <button
                disabled={busy || reason.trim().length < 5}
                onClick={() => act(
                  () => apiPost(`/api/admin/certificates/${r.certificate!.id}/revoke`, { reason: reason.trim() })
                    .then(() => { setRevoking(null); setReason(""); load(); }),
                  "أُلغيت الشهادة ووُثّق السبب",
                )}
                className="cursor-pointer rounded-lg border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40"
              >
                أكّد الإلغاء
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
