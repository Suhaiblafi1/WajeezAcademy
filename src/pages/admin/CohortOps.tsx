/* عمليات الشعبة المتقدمة — تعيين مدرب، تعديل، مواد، تقييمات، إسقاط تسجيل،
   شهادات، نشر عام — إضافة إلى روبرك وقواعد الإكمال على مستوى الصفحة.
   كلها API حقيقي من admin-learning وadmin-trainer. */
import { useCallback, useEffect, useState } from "react";
import {
  Award, BadgeCheck, BookOpen, CalendarPlus, FilePlus2, Globe,
  Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus,
} from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import DayOfWeekPicker from "@/components/DayOfWeekPicker";
import { fmtDateTimeAr } from "@/utils/format";
import type { CohortTab } from "./cohort-tabs";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls as inputCls, staffSelectCls as selectCls } from "@/components/FormKit";

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
interface TrainerPlan {
  id: string; status: string; reviewerNote: string | null; trainerName: string | null;
  submittedAt: string | null; trainerConfirmedAt: string | null; reviewedAt: string | null;
  content: {
    summaryAr?: string | null; modules?: { moduleId: string; titleAr: string }[]; resources?: { title: string; url: string }[];
    proposals?: { courseTitleAr?: string | null; pathwayTitleAr?: string | null } | null;
  } | null;
}
const PLAN_AR: Record<string, string> = {
  draft: "مسودّةٌ عند المدرّب", submitted: "بانتظار اعتمادك", changes_requested: "رُدّت إليه بتعديلات",
  approved: "معتمَدة", published: "منشورة", superseded: "نسخةٌ قديمة",
};

/* ── من طيّةٍ تُفتح إلى قسمٍ يُرى ──

   كانت هذه `MiniCard` طيّةً: عنوانٌ وسهمٌ ومحتوًى مخبوء. وسبعٌ منها داخلَ
   بطاقةٍ هي نفسُها طيّةٌ داخلَ قائمةٍ — ثلاثةُ مستوياتٍ من الإخفاء، وأدناها
   لا شيءَ يقول إنّه موجود.

   والألسنةُ تكفلت بالكشف التدريجيّ: اللسانُ يخفي ما ليس من شغلِك الآن.
   فالطيُّ داخله إخفاءٌ ثانٍ بلا فائدة — وأقسامُ اللسان الواحد قليلةٌ تُرى
   معا وتُقرأ بالتمرير لا بالنقر. */
function Section({ icon: Icon, title, children }: {
  icon: typeof UserPlus; title: string; children: React.ReactNode;
}) {
  return (
    <Card className="bg-paper/20">
      <p className="flex items-center gap-1.5 text-read font-black text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-teal-ink" /> {title}
      </p>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function CohortOps({ cohort, tab, onDone }: { cohort: CohortLite; tab: CohortTab; onDone: Done }) {
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

  /* من يملك `trainer.qualify` — وهو المديرُ الأعلى والمديرُ الأكاديميّ معا —
     يقرّر من هنا. وكانت الشاشةُ تقول للمدير الأعلى «بانتظار قرار المدير
     الأكاديميّ» وهو يملك كلَّ صلاحيّةٍ فيها، فيظنّ أنّ عليه أن يحيل وينتظر. */
  const { user: viewer } = useRealSession();
  const canQualify = viewer?.permissions.includes("trainer.qualify") ?? false;
  /* خطّةُ المدرّب لهذه الشعبة — يعتمدها من يملك `cohort.plan.approve` (الأكاديميُّ
     والأعلى)، ويذكّره بها من يدير الشعبة. */
  const canApprovePlan = viewer?.permissions.includes("cohort.plan.approve") ?? false;
  /* ما يُقبل من اقتراحات المدرّب على الاسم — مختارٌ افتراضا، ويُلغى بنقرة */
  const [applyProposals, setApplyProposals] = useState({ courseTitle: true, pathwayTitle: true });
  const [trainerPlan, setTrainerPlan] = useState<TrainerPlan | null>(null);
  const loadPlan = useCallback(async () => {
    try { setTrainerPlan(await apiGet<TrainerPlan | null>(`/api/admin/cohorts/${cohort.id}/trainer-plan`)); }
    catch { setTrainerPlan(null); }
  }, [cohort.id]);
  useEffect(() => { void loadPlan(); }, [loadPlan]);
  const picked = trainers.find((t) => t.profileId === assignForm.profileId) ?? null;

  const act = useCallback(async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return;
    setBusy(true); setLocalMsg("");
    try { await fn(); setLocalMsg(msg); onDone(msg); }
    catch (e) { setLocalMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  }, [busy, onDone]);

  /* الشعبةُ المكتملةُ أو الملغاةُ لا تُعدَّل — والشرطُ كان يُكتب ثلاث مرّات */
  const editable = !["completed", "cancelled"].includes(cohort.status);

  return (
    <div className="space-y-3">
      {localMsg && <p className="text-read font-bold text-teal-light-ink" role="status">{localMsg}</p>}

      {/* تعيين مدرب — خطوةٌ واحدة للمؤهَّل، وطلبٌ واحد لغيره.

          كان الإسنادُ يفترض تأهيلا سابقا يُدار في شاشةٍ أخرى، والنصُّ أسفلَه
          يحيل إليها: «التأهيل يُدار من طلبات المدربين». فمن أراد مدرّبا
          لشعبةٍ مشى ثلاث خطوات في مكانين، ولو نسي الثانية بقي المدرّبُ
          مؤهَّلا بلا شعبة والشعبةُ بلا مدرّب.

          وبوّابةُ نزاهة التأهيل باقية: هذا الزرُّ **يطلب** ولا يقرّر. يبتّ
          فيه المديرُ الأكاديميّ، وموافقتُه تؤهّل وتُسند في فعلٍ واحد. */}
      {tab === "identity" && (
      <Section icon={UserPlus} title="مدرّب الشعبة — إسنادٌ مباشر للمؤهَّل، وطلبُ تأهيلٍ لغيره">
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
            <Button tone="confirm" disabled={busy}
              onClick={() => act(
                () => apiPost(`/api/admin/cohorts/${cohort.id}/trainers`, assignForm).then(loadTrainers),
                "عُيّن المدرب للشعبة",
              )}>
              أسنده
            </Button>
          ) : (
            <Button tone="primary" disabled={busy || !picked || picked.qualification === "pending"}
              onClick={() => act(
                () => apiPost(`/api/admin/cohorts/${cohort.id}/qualification-requests`, {
                  profileId: assignForm.profileId, courseId: cohort.courseId,
                }).then(loadTrainers),
                "رُفع طلبُ التأهيل — الموافقة تؤهّله وتُسنده معا",
              )}>
              أهّله وأسنده الآن
            </Button>
          )}
        </div>

        {/* الغيابُ يُقال أوّلا لأنّه **مانعٌ** لا تنبيه: الزرُّ سيُردّ بـ409،
            فمن حقّ المُسنِد أن يعرف قبل أن يضغط. والساعاتُ تنبيهٌ بعده. */}
        {picked?.onLeave && (
          <Inset as="p" tone="danger" className="mt-2 p-2 text-read font-bold leading-5 text-red-200" role="status">
            المدرّبُ أعلن غيابَه في مدّةٍ تقع فيها جلسةٌ من جلسات هذه الشعبة — الإسنادُ سيُردّ. اختر غيرَه، أو راجعه ليحدّث إتاحته.
          </Inset>
        )}
        {!picked?.onLeave && picked?.outsideDeclaredHours ? (
          <Inset as="p" tone="warn" className="mt-2 p-2 text-read font-bold leading-5 text-gold-ink" role="status">
            {picked.outsideDeclaredHours} من جلسات هذه الشعبة تقع خارجَ ساعاته المعلنة — الإسنادُ جائزٌ، والقرارُ لك.
          </Inset>
        ) : null}

        {picked && (
          <p className="mt-2 text-read leading-5 text-muted-foreground">
            {picked.qualification === "qualified"
              ? "مؤهَّل لهذه الدورة — الإسناد يقع الآن، ويُفحص تعارضُ جدوله قبل وقوعه."
              : picked.qualification === "pending"
                ? (canQualify ? "له طلبُ تأهيلٍ قائم على هذه الدورة — والقرارُ بيدك: أهّله فيُسنَد، أو رُدَّه بسبب." : "له طلبُ تأهيلٍ قائم على هذه الدورة — بانتظار من يملك التأهيل.")
                : picked.qualification === "rejected"
                  ? "سبق أن رُدَّ تأهيلُه لهذه الدورة. رفعُ طلبٍ جديد يُعيدها إلى طاولة القرار."
                  : (canQualify ? "غير مؤهَّل لهذه الدورة بعد — طلبُ التأهيل يعود إليك، وموافقتُك تؤهّله وتُسنده معا." : "غير مؤهَّل لهذه الدورة بعد — الطلب يذهب إلى من يملك التأهيل، وموافقتُه تؤهّله وتُسنده معا.")}
          </p>
        )}
        {/* القرارُ في موضعه: من يملك الصلاحيّةَ لا يُحال إلى شاشةٍ أخرى ولا ينتظر أحدا */}
        {picked?.qualification === "pending" && picked.qualificationId && canQualify && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button tone="confirm" size="sm" disabled={busy}
              onClick={() => act(
                () => apiPost(`/api/admin/qualification-requests/${picked.qualificationId}/decide`, { approve: true }).then(loadTrainers),
                "أُهِّل وأُسند للشعبة",
              )}>
              أهّله وأسنده الآن
            </Button>
            <Button tone="danger" size="sm" disabled={busy}
              onClick={() => {
                const note = window.prompt("سببُ الردّ — يُقرأ في ملفّ المدرّب:");
                if (!note?.trim()) return;
                void act(
                  () => apiPost(`/api/admin/qualification-requests/${picked.qualificationId}/decide`, { approve: false, note: note.trim() }).then(loadTrainers),
                  "رُدَّ طلبُ التأهيل",
                );
              }}>
              رُدَّه بسبب
            </Button>
          </div>
        )}
        {trainers.length === 0 && (
          <p className="mt-2 text-read text-muted-foreground">لا مدرّبين نشطين بعد — تُعتمد الطلبات من «طلبات المدربين».</p>
        )}
      </Section>
      )}

      {/* ── ما كان نموذجا واحدا صار ثلاثةً، كلٌّ في لسانه ──

          «تعديل الشعبة — جدولة وسعة وسعر وبوابات الفتح»: سبعةُ حقولٍ وزرُّ
          حفظٍ واحد. وهي **ثلاثةُ أعمالٍ لا تُعمل معا ولا يعملها الشخصُ
          نفسُه**: تسميةُ الشعبة قرارٌ أكاديميّ، وجدولُها قرارُ تقديم، وسعرُها
          وبوّابتاها قرارُ تسجيلٍ ومال. فمن جاء ليصحّح سعرا كان يمرّ على
          جدولٍ لا شأن له به، ويحفظ الكلَّ بزرٍّ واحد.

          والحفظُ الآن جزئيّ: كلُّ نموذجٍ يُرسل حقولَه وحدَها. */}

      {/* ① الاسم — الهُويّة */}
      {editable && tab === "identity" && (
        <Section icon={Pencil} title="اسمُ الشعبة">
          <div className="flex flex-wrap gap-2">
            <input value={editForm.title} aria-label="اسمُ الشعبة"
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              placeholder="اسمُ الشعبة" className={`${inputCls} flex-1`} />
            <Button tone="confirm" disabled={busy || editForm.title.trim().length < 3}
              onClick={() => act(() => apiPatch(`/api/admin/cohorts/${cohort.id}`, {
                title: editForm.title.trim(),
              }), "حُدث اسمُ الشعبة")}>
              احفظ الاسم
            </Button>
          </div>
        </Section>
      )}

      {/* ② الجدول الأسبوعيّ — منه تُولَّد اللقاءات */}
      {editable && tab === "schedule" && (
        <Section icon={Pencil} title="الجدول الأسبوعيّ — الأيّامُ والوقت">
          <p className="mb-3 text-read leading-6 text-muted-foreground">
            هذا جدولُ الشعبة لا لقاءاتُها. وتغييرُه لا ينقل اللقاءاتِ المولَّدةَ من قبل —
            بل يصير الأساسَ لما يُولَّد بعده.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <DayOfWeekPicker value={editForm.days} onChange={(days) => setEditForm({ ...editForm, days })} label="الأيّام" />
            <label className="text-fine text-muted-foreground">
              وقتُ البدء
              <input type="time" value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                className={`${inputCls} mt-1`} />
            </label>
          </div>
          <Button tone="confirm" disabled={busy || editForm.days.length === 0} className="mt-3"
            onClick={() => act(() => apiPatch(`/api/admin/cohorts/${cohort.id}`, {
              daysOfWeek: editForm.days,
              startTime: editForm.startTime || undefined,
            }), "حُدث جدولُ الشعبة")}>
            احفظ الجدول
          </Button>
        </Section>
      )}

      {/* ③ السعة والسعر وبوّابتا الفتح — التسجيل والمال */}
      {editable && tab === "enrollment" && (
        <Section icon={Pencil} title="السعة والسعر وبوّابتا الفتح">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-fine text-muted-foreground">
              السعة
              <input type="number" min={1} value={editForm.capacity}
                onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                placeholder="غير محددة" className={`${inputCls} mt-1`} />
            </label>
            <label className="text-fine text-muted-foreground">
              {`السعر (${cohort.currency})`}
              <input type="number" min={0} value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                placeholder="0" className={`${inputCls} mt-1`} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-fine text-muted-foreground">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={editForm.registrationOpen}
                onChange={(e) => setEditForm({ ...editForm, registrationOpen: e.target.checked })} className="accent-teal" />
              التسجيل مفتوح
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={editForm.financialReady}
                onChange={(e) => setEditForm({ ...editForm, financialReady: e.target.checked })} className="accent-teal" />
              جاهزة ماليا
            </label>
          </div>
          <Button tone="confirm" disabled={busy} className="mt-3"
            onClick={() => act(() => apiPatch(`/api/admin/cohorts/${cohort.id}`, {
              capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
              price: editForm.price ? Number(editForm.price) : undefined,
              registrationOpen: editForm.registrationOpen,
              financialReady: editForm.financialReady,
            }), "حُدثت السعةُ والسعرُ والبوّابتان")}>
            احفظ
          </Button>
        </Section>
      )}

      {/* مادة تعليمية */}
      {/* ═══ خطّةُ المدرّب — «ليس اقتراحا بل واجبٌ عليه» ═══

          قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): المدرّبُ يجهّز شعبتَه ويقول «أوافق»،
          والأكاديميُّ أو الأعلى يعتمد — أيُّهما سبق. وهنا يُقرأ ما أرسله ويُقرَّر
          فيه، ويُذكَّر إن تأخّر. */}
      {tab === "content" && (
      <Section icon={BookOpen} title="خطّةُ المدرّب — تجهيزُ الشعبة واعتمادُها">
        {!trainerPlan ? (
          <p className="text-read leading-6 text-muted-foreground">لم يبدأ المدرّبُ تجهيزَ الشعبة بعد.</p>
        ) : (
          <>
            <p className="text-read leading-6">
              <b>{PLAN_AR[trainerPlan.status] ?? trainerPlan.status}</b>
              {trainerPlan.trainerName ? <> · {trainerPlan.trainerName}</> : null}
              {trainerPlan.submittedAt ? <> · أُرسلت {fmtDateTimeAr(trainerPlan.submittedAt)}</> : null}
              {trainerPlan.trainerConfirmedAt ? <> · وأكّد موافقتَه على كلّ ما فيها</> : null}
            </p>
            {trainerPlan.content?.summaryAr && <p className="mt-2 text-read leading-6 text-muted-foreground">{trainerPlan.content.summaryAr}</p>}
            {(trainerPlan.content?.modules?.length ?? 0) > 0 && (
              <ol className="mt-2 space-y-1 text-read text-foreground">
                {trainerPlan.content!.modules!.map((m, i) => <li key={m.moduleId}>{i + 1}. {m.titleAr}</li>)}
              </ol>
            )}
            {(trainerPlan.content?.resources?.length ?? 0) > 0 && (
              <p className="mt-2 text-read text-muted-foreground">{trainerPlan.content!.resources!.length} مصدرا.</p>
            )}
            {trainerPlan.reviewerNote && <Inset tone="warn" className="mt-2 text-read leading-6">{trainerPlan.reviewerNote}</Inset>}
            {/* اقتراحُ المدرّب على الاسم — يُقرأ هنا ويُقبل بالاختيار لا بالاعتماد وحدَه (٨ سبتمبر ٢٠٢٦) */}
            {(trainerPlan.content?.proposals?.courseTitleAr?.trim() || trainerPlan.content?.proposals?.pathwayTitleAr?.trim()) && (
              <Inset tone="accent" className="mt-3">
                <p className="text-read font-black text-foreground">يقترح المدرّبُ اسما آخر — اختر ما تقبله مع الاعتماد:</p>
                {trainerPlan.content?.proposals?.courseTitleAr?.trim() && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-read leading-6">
                    <input type="checkbox" checked={applyProposals.courseTitle} onChange={(e) => setApplyProposals({ ...applyProposals, courseTitle: e.target.checked })} className="mt-1 h-4 w-4 accent-teal" disabled={trainerPlan.status !== "submitted"} />
                    <span>الدورة: <b>{trainerPlan.content.proposals.courseTitleAr}</b></span>
                  </label>
                )}
                {trainerPlan.content?.proposals?.pathwayTitleAr?.trim() && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-read leading-6">
                    <input type="checkbox" checked={applyProposals.pathwayTitle} onChange={(e) => setApplyProposals({ ...applyProposals, pathwayTitle: e.target.checked })} className="mt-1 h-4 w-4 accent-teal" disabled={trainerPlan.status !== "submitted"} />
                    <span>المسار: <b>{trainerPlan.content.proposals.pathwayTitleAr}</b></span>
                  </label>
                )}
              </Inset>
            )}
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {trainerPlan?.status === "submitted" && canApprovePlan && (
            <>
              <Button tone="confirm" size="sm" disabled={busy}
                onClick={() => act(() => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, { approve: true, applyProposals }).then(loadPlan), "اعتُمدت خطّةُ المدرّب — وأُخبر")}>
                اعتمدها
              </Button>
              <Button tone="danger" size="sm" disabled={busy}
                onClick={() => {
                  const note = window.prompt("ما الذي يُعدَّل؟ يصله بنصّه:");
                  if (!note?.trim()) return;
                  void act(() => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, { approve: false, note: note.trim() }).then(loadPlan), "رُدّت إليه بالتعديلات");
                }}>
                اطلب تعديلات
              </Button>
            </>
          )}
          {trainerPlan?.status !== "submitted" && trainerPlan?.status !== "approved" && (
            <Button tone="secondary" size="sm" disabled={busy}
              onClick={() => {
                const note = window.prompt("كلمةٌ تُضاف إلى التذكير (اختياريّ):") ?? "";
                void act(() => apiPost(`/api/admin/cohorts/${cohort.id}/remind-trainer`, { note: note.trim() || undefined }), "ذُكِّر المدرّب — جرسٌ وبريد");
              }}>
              ذكّر المدرّب بإكمال التجهيز
            </Button>
          )}
        </div>
      </Section>
      )}

      {tab === "content" && (
      <Section icon={FilePlus2} title="مادة تعليمية — رابط خارجي أو ملف خاص برفع موقَّع">
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
        <Button tone="confirm" className="mt-3"
          disabled={busy || materialForm.title.length < 2 || (materialForm.kind === "link" ? !/^https?:\/\/.+/.test(materialForm.externalUrl) : !materialForm.originalName || !materialForm.sizeBytes)}
          onClick={() => act(async () => {
            await apiPost(`/api/admin/cohorts/${cohort.id}/materials`, {
              title: materialForm.title, kind: materialForm.kind,
              externalUrl: materialForm.kind === "link" ? materialForm.externalUrl : undefined,
              file: materialForm.kind !== "link" && materialForm.originalName
                ? { originalName: materialForm.originalName, mime: materialForm.mime, sizeBytes: Number(materialForm.sizeBytes) } : undefined,
            });
            setMaterialForm({ title: "", kind: "link", externalUrl: "", originalName: "", mime: "application/pdf", sizeBytes: "" });
          }, "سُجلت المادة")}>
          سجّل المادة
        </Button>
      </Section>
      )}

      {/* تقييم جديد */}
      {editable && tab === "content" && (
        <Section icon={BookOpen} title="تقييم جديد — واجب / اختبار / مشروع مع بنود">
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
                  <Button tone="ghost" size="sm" type="button" aria-label={`احذف البند ${i + 1}`}
                    onClick={() => setItems(items.filter((_, j) => j !== i))} className="hover:text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button tone="secondary" size="sm" type="button" onClick={() => setItems([...items, { prompt: "", kind: "text", maxScore: "" }])} className="text-fine">
              <Plus className="h-3 w-3" /> بند
            </Button>
            <Button tone="confirm" disabled={busy || assessForm.title.length < 3}
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
              }, "أُنشئ التقييم وأتاح للمتعلمين")}>
              أنشئ التقييم
            </Button>
          </div>
        </Section>
      )}

      {/* ── «التسجيل والشهادات» كانا قسما واحدا، وهما عملان ──

          الإسقاطُ إخراجُ متعلّمٍ من شعبته — شأنُ التسجيل. وإصدارُ الشهادة
          إقرارٌ بأنّه أنهاها — شأنُ ما سُلِّم فيها. ولا يقع الفعلان في يومٍ
          واحدٍ ولا يعملهما الشخصُ نفسُه، فافترقا إلى لسانَيهما. */}

      {/* إسقاطُ تسجيل — التسجيلُ والمال */}
      {tab === "enrollment" && (
        <Section icon={UserMinus} title="إسقاطُ تسجيلِ متعلّم">
          <DropEnrollment cohortId={cohort.id} busy={busy} form={dropForm} onForm={setDropForm} act={act} />
        </Section>
      )}

      {/* الشهادات — المحتوى وما يُسلَّم */}
      {tab === "content" && (
        <Section icon={Award} title="الشهادات — إصدارٌ لمن أنهى، وإلغاءٌ بسببٍ يبقى">
          {/* ─────────── الشهادات: قائمةٌ لا معرّفاتٌ تُلصق ───────────

              كان الإصدارُ يطلب «معرّف التسجيل (UUID)» والإلغاءُ «معرّف
              الشهادة (UUID)» — يُكتبان يدا ولا شاشةَ تعرضهما. فمن أراد أن
              يُصدر شهادةً لطالبٍ أنهى دورتَه احتاج أن يستخرج معرّفا من مكانٍ
              آخر.

              وقرارُ صاحب المنصّة: «فلتر القائمة افتراضيا لمن أنهى فعلا».
              والأهليّةُ محسوبةٌ في الخادم بالقواعد نفسِها التي يفحصها
              الإصدار — فلا تقول القائمةُ «مؤهَّل» ثمّ يرفض الزرّ. */}
          <CertificateCandidates cohortId={cohort.id} busy={busy} act={act} />
        </Section>
      )}

      {/* تسجيلات الجلسات وأرشفة المحتوى */}
      {tab === "content" && (
      <Section icon={BookOpen} title="تسجيلات اللقاءات وأرشفة المحتوى — ملفات خاصة موقعة">
        <p className="mb-2 text-read font-bold text-muted-foreground">تسجيل تسجيل جلسة (يرتبط بالجلسة ووحدة اختيارية):</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <SessionSelect cohortId={cohort.id} value={recForm.sessionId}
            onChange={(sessionId) => setRecForm({ ...recForm, sessionId })} />
          <input value={recForm.title} onChange={(e) => setRecForm({ ...recForm, title: e.target.value })} placeholder="عنوان التسجيل" className={inputCls} />
          <input value={recForm.moduleId} onChange={(e) => setRecForm({ ...recForm, moduleId: e.target.value })}
            placeholder="معرف الوحدة (اختياري)" dir="ltr" className={`${inputCls} font-mono`} />
          <input value={recForm.mime} onChange={(e) => setRecForm({ ...recForm, mime: e.target.value })} placeholder="MIME" dir="ltr" className={inputCls} />
          <input type="number" min={1} value={recForm.sizeBytes} onChange={(e) => setRecForm({ ...recForm, sizeBytes: e.target.value })} placeholder="الحجم (بايت)" dir="ltr" className={inputCls} />
          <input type="number" min={1} value={recForm.durationSec} onChange={(e) => setRecForm({ ...recForm, durationSec: e.target.value })} placeholder="المدة (ثانية، اختياري)" dir="ltr" className={inputCls} />
        </div>
        <Button tone="confirm" className="mt-2" disabled={busy || !recForm.sessionId.trim() || recForm.title.length < 2 || !recForm.sizeBytes}
          onClick={() => act(async () => {
            await apiPost(`/api/admin/sessions/${recForm.sessionId.trim()}/recordings`, {
              title: recForm.title, mime: recForm.mime, sizeBytes: Number(recForm.sizeBytes),
              moduleId: recForm.moduleId.trim() || undefined,
              durationSec: recForm.durationSec ? Number(recForm.durationSec) : undefined,
            });
            setRecForm({ sessionId: "", title: "", moduleId: "", mime: "video/mp4", sizeBytes: "", durationSec: "" });
          }, "سُجل التسجيل وأُنشئ رابط رفعه الموقع")}>
          سجّل التسجيل
        </Button>

        <p className="mt-4 mb-2 border-t border-white/8 pt-3 text-read font-bold text-muted-foreground">أرشفة أو تعطيل مادة/تسجيل (لا حذف — أثر قانوني يبقى):</p>
        <div className="flex flex-wrap gap-2">
          <ContentSelect cohortId={cohort.id} value={contentForm.kind && contentForm.id ? `${contentForm.kind}:${contentForm.id}` : ""}
            onChange={(picked) => {
              const [kind, id] = picked.split(":");
              setContentForm({ ...contentForm, kind: kind || "material", id: id || "" });
            }} />
          <select value={contentForm.status} onChange={(e) => setContentForm({ ...contentForm, status: e.target.value })} className={selectCls}>
            <option value="active">نشط</option>
            <option value="archived">مؤرشف</option>
            <option value="disabled">معطل</option>
          </select>
          <Button tone="confirm" disabled={busy || !contentForm.id.trim()}
            onClick={() => act(() => apiPost(`/api/admin/content/${contentForm.kind}/${contentForm.id.trim()}/status`, { status: contentForm.status }), "حُدثت حالة المحتوى")}>
            طبّق الحالة
          </Button>
        </div>
      </Section>
      )}

      {/* نشر عام — فعلُ حالةٍ لا فعلُ محتوًى، فمكانُه لسانُ الهُويّة */}
      {tab === "identity" && cohort.status === "open" && (
        <Button tone="confirm" disabled={busy}
          onClick={() => act(() => apiPost(`/api/admin/cohorts/${cohort.id}/publish`), "نُشرت الشعبة — إسنادات المدربين ظاهرة للعامة")} className="text-gold-ink">
          <Globe className="h-3.5 w-3.5" /> نشر عام لإسنادات المدربين
        </Button>
      )}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />}
    </div>
  );
}

/* ═══════ ثلاثةُ منتقياتٍ تُزيل لصقَ المعرّفات ═══════

   كانت هذه البطاقةُ تطلب ثلاثةَ معرّفاتِ UUID: معرّفَ التسجيل للإسقاط،
   ومعرّفَ الجلسة للتسجيل، ومعرّفَ المحتوى للأرشفة. وثلاثتُها **قيمٌ لا تظهر
   على أيّ شاشةٍ في المنصّة** — فلا سبيلَ إلى تعبئتها إلّا بفتح قاعدة
   البيانات.

   وأخطرُها الأوّل: ستّةٌ وثلاثون حرفا تُلصق فوق زرٍّ أحمرَ اسمُه «إسقاط»،
   بلا اسمٍ يُراجَع. فخطأُ لصقٍ واحدٌ يُخرج الطالبَ الخطأ من شعبته.

   والنمطُ ليس جديدا على المنصّة: `LearnerSearchField` و`ZoomAttach`
   و`CertificateCandidates` تفعله منذ جولةٍ سابقة. وهذه تعميمُه على ما بقي. */

/** مسجَّلٌ في الشعبة — يُختار باسمه لا بمعرّفه */
interface RosterRow {
  enrollmentId: string; learnerName: string; email: string;
  status: string; enrolledAt: string;
}

const ROSTER_LABEL: Record<string, string> = { enrolled: "مسجَّل", waitlisted: "قائمةُ انتظار" };

/** إسقاطُ تسجيل — الاسمُ يُقرأ قبل الضغط، والمُسقَطُ يُسمّى في زرّه */
function DropEnrollment({ cohortId, busy, form, onForm, act }: {
  cohortId: string;
  busy: boolean;
  form: { enrollmentId: string; note: string };
  onForm: (v: { enrollmentId: string; note: string }) => void;
  act: (fn: () => Promise<unknown>, msg: string) => void;
}) {
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const load = useCallback(() => {
    apiGet<RosterRow[]>(`/api/admin/cohorts/${cohortId}/enrollments`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [cohortId]);
  useEffect(() => { load(); }, [load]);

  const picked = rows?.find((r) => r.enrollmentId === form.enrollmentId) ?? null;

  if (rows !== null && rows.length === 0) {
    return <p className="text-read text-muted-foreground">لا مسجَّلين في هذه الشعبة — لا شيءَ يُسقَط.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`drop-${cohortId}`}>المتعلّمُ المراد إسقاطُ تسجيله</label>
        <select id={`drop-${cohortId}`} value={form.enrollmentId} disabled={rows === null}
          onChange={(e) => onForm({ ...form, enrollmentId: e.target.value })}
          className={`${selectCls} flex-1`}>
          <option value="">{rows === null ? "يُقرأ المسجَّلون…" : "اختر المتعلّم…"}</option>
          {rows?.map((r) => (
            <option key={r.enrollmentId} value={r.enrollmentId}>
              {r.learnerName} — {r.email}{r.status !== "enrolled" ? ` · ${ROSTER_LABEL[r.status] ?? r.status}` : ""}
            </option>
          ))}
        </select>
        <input value={form.note} onChange={(e) => onForm({ ...form, note: e.target.value })}
          aria-label="ملاحظةُ الإسقاط" placeholder="ملاحظة (اختياري)" className={inputCls} />
      </div>

      {/* الزرُّ يسمّي من يُسقطه — فلا يُضغط «إسقاط» مجرَّدا على قائمةٍ فيها عشرون اسما */}
      <Button tone="danger" disabled={busy || !picked}
        onClick={() => act(
          () => apiPost(`/api/admin/enrollments/${form.enrollmentId}/drop`, { note: form.note || undefined })
            .then(() => { onForm({ enrollmentId: "", note: "" }); load(); }),
          `أُسقط تسجيلُ «${picked?.learnerName ?? ""}»`,
        )}>
        <UserMinus className="h-3.5 w-3.5" />
        {picked ? `أسقِط تسجيلَ ${picked.learnerName}` : "أسقِط التسجيل"}
      </Button>
    </div>
  );
}

interface SessionOpt { id: string; title: string; startsAt: string }

/** جلسةُ الشعبة تُختار بعنوانها وتاريخها — لا بمعرّفها */
function SessionSelect({ cohortId, value, onChange }: {
  cohortId: string; value: string; onChange: (id: string) => void;
}) {
  const [rows, setRows] = useState<SessionOpt[] | null>(null);
  useEffect(() => {
    apiGet<SessionOpt[]>(`/api/admin/cohorts/${cohortId}/sessions`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [cohortId]);

  return (
    <>
      <label className="sr-only" htmlFor={`rec-session-${cohortId}`}>الجلسة</label>
      <select id={`rec-session-${cohortId}`} value={value} disabled={rows === null}
        onChange={(e) => onChange(e.target.value)} className={selectCls}>
        <option value="">
          {rows === null ? "تُحمَّل الجلسات…" : rows.length === 0 ? "لا جلسات بعد" : "اختر الجلسة…"}
        </option>
        {rows?.map((sn) => (
          <option key={sn.id} value={sn.id}>{sn.title} — {fmtDateTimeAr(sn.startsAt)}</option>
        ))}
      </select>
    </>
  );
}

interface CohortContent {
  materials: { id: string; title: string; kind: string; status: string }[];
  recordings: { id: string; title: string; status: string; sessionTitle: string }[];
}

const CONTENT_STATUS: Record<string, string> = { active: "نشط", archived: "مؤرشف", disabled: "معطل" };

/** المحتوى يُختار بعنوانه، ونوعُه يُشتقّ من اختياره لا يُسأل عنه مرّتين */
function ContentSelect({ cohortId, value, onChange }: {
  cohortId: string; value: string; onChange: (picked: string) => void;
}) {
  const [data, setData] = useState<CohortContent | null>(null);
  useEffect(() => {
    apiGet<CohortContent>(`/api/admin/cohorts/${cohortId}/content`)
      .then(setData)
      .catch(() => setData({ materials: [], recordings: [] }));
  }, [cohortId]);

  const empty = data !== null && data.materials.length === 0 && data.recordings.length === 0;

  return (
    <>
      <label className="sr-only" htmlFor={`content-${cohortId}`}>المادّةُ أو التسجيل</label>
      <select id={`content-${cohortId}`} value={value} disabled={data === null || empty}
        onChange={(e) => onChange(e.target.value)} className={`${selectCls} flex-1`}>
        <option value="">
          {data === null ? "يُقرأ المحتوى…" : empty ? "لا محتوى في هذه الشعبة بعد" : "اختر المادّة أو التسجيل…"}
        </option>
        {data && data.materials.length > 0 && (
          <optgroup label="المواد">
            {data.materials.map((m) => (
              <option key={m.id} value={`material:${m.id}`}>
                {m.title} · {CONTENT_STATUS[m.status] ?? m.status}
              </option>
            ))}
          </optgroup>
        )}
        {data && data.recordings.length > 0 && (
          <optgroup label="التسجيلات">
            {data.recordings.map((r) => (
              <option key={r.id} value={`recording:${r.id}`}>
                {r.title} — {r.sessionTitle} · {CONTENT_STATUS[r.status] ?? r.status}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </>
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
                <Button tone="ghost" size="sm" type="button" aria-label={`احذف المعيار ${i + 1}`}
                  onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} className="shrink-0 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button tone="secondary" size="sm" type="button" onClick={() => setCriteria([...criteria, { title: "", maxScore: "10" }])} className="text-fine">
            <Plus className="h-3 w-3" /> معيار
          </Button>
          <Button tone="confirm" size="sm" disabled={busy || rubricTitle.length < 3 || criteria.some((c) => c.title.trim().length < 2)}
            onClick={() => act(async () => {
              await apiPost("/api/admin/rubrics", {
                title: rubricTitle,
                criteria: criteria.map((c) => ({ title: c.title, maxScore: Number(c.maxScore) || 1 })),
              });
              setRubricTitle(""); setCriteria([{ title: "", maxScore: "10" }]);
            }, "أُنشئ الروبرك")}>
            أنشئ الروبرك
          </Button>
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
        <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-fine text-muted-foreground">
          <input type="checkbox" checked={ruleForm.required} onChange={(e) => setRuleForm({ ...ruleForm, required: e.target.checked })} className="accent-teal" />
          قاعدة إلزامية للشهادة
        </label>
        <Button tone="confirm" size="sm" disabled={busy || !ruleForm.courseId || Number(ruleForm.threshold) < 1}
          onClick={() => act(() => apiPost("/api/admin/completion-rules", {
            courseId: ruleForm.courseId, cohortId: ruleForm.cohortId || undefined,
            type: ruleForm.type, threshold: Number(ruleForm.threshold), required: ruleForm.required,
          }), "حُفظت قاعدة الإكمال")} className="mt-3">
          احفظ القاعدة
        </Button>
      </Panel>
      {msg && <p className="text-read font-bold text-teal-light-ink lg:col-span-2" role="status">{msg}</p>}
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

  if (error) return <p className="text-read leading-6 text-muted-foreground">{error}</p>;
  if (!rows) return <p className="text-read text-muted-foreground">نقرأ المرشَّحين…</p>;
  if (rows.length === 0) return <p className="text-read text-muted-foreground">لا مسجَّلين في هذه الشعبة بعد.</p>;

  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <Inset as="li" key={r.enrollmentId} className="px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-xs font-bold text-foreground">{r.learnerName}</span>
              <span dir="ltr" className="block text-left text-fine text-muted-foreground">{r.email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-fine tabular-nums text-muted-foreground">{r.percent}٪</span>
              {r.certificate ? (
                <>
                  <span dir="ltr" className="rounded-full border border-teal/35 px-2 py-0.5 font-mono text-fine text-teal-light-ink">
                    {r.certificate.number}
                  </span>
                  <Button tone="danger" onClick={() => { setRevoking(revoking === r.certificate!.id ? null : r.certificate!.id); setReason(""); }} className="px-2.5 text-fine">
                    ألغِها
                  </Button>
                </>
              ) : r.eligible ? (
                <Button tone="confirm" disabled={busy}
                  onClick={() => act(
                    () => apiPost(`/api/admin/enrollments/${r.enrollmentId}/certificate`).then(load),
                    `أُصدرت شهادة «${r.learnerName}»`,
                  )} className="text-fine text-gold-ink">
                  <BadgeCheck className="h-3 w-3" /> أصدِر
                </Button>
              ) : (
                <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
                  لم يُنهِ بعد
                </span>
              )}
            </span>
          </div>

          {/* السببُ يُقال قبل الضغط لا بعده — فلا يُجرَّب زرٌّ ليُعرف لماذا رُفض */}
          {!r.eligible && !r.certificate && r.failures.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {r.failures.map((f, i) => (
                <li key={i} className="text-read leading-4 text-muted-foreground">— {f}</li>
              ))}
            </ul>
          )}

          {revoking === r.certificate?.id && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="سببُ الإلغاء — يبقى في السجلّ (٥ أحرف فأكثر)"
                className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-fine outline-none placeholder:text-muted-foreground/75 focus:border-red-400/50"
              />
              <Button tone="danger" size="sm"
                disabled={busy || reason.trim().length < 5}
                onClick={() => act(
                  () => apiPost(`/api/admin/certificates/${r.certificate!.id}/revoke`, { reason: reason.trim() })
                    .then(() => { setRevoking(null); setReason(""); load(); }),
                  "أُلغيت الشهادة ووُثّق السبب",
                )}
              >
                أكّد الإلغاء
              </Button>
            </div>
          )}
        </Inset>
      ))}
    </ul>
  );
}
