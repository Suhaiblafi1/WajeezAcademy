/* طابورُ طلبات المتعلّمين — شهادةُ دورةٍ أو شهادةُ مسارٍ كاملا أو توصية.

   كانت الشهاداتُ تُصدَر من شاشة الشعبة وحدَها: الإداريّ يفتح شعبةً فيرى
   مرشَّحيها. فمن أنهى دورتَه في شعبةٍ لا أحدَ يفتحها بقي بلا شهادةٍ إلى أن
   يتذكّره أحد — ولا طابورَ يُقرأ ولا أحدَ يعرف كم منتظرٍ ومنذ متى.

   والطلبُ يصل من بوابة المتعلّم مستوفيا قواعدَ الإكمال (يفحصها الخادمُ قبل
   إنشائه)، فما في هذا الطابور مؤهَّلٌ بحساب النظام لا بدعوى صاحبه.

   والقرارُ فعلٌ يُسجَّل ويُبلَّغ صاحبَه: «أُنجز» بعد إصدار الشهادة أو كتابة
   التوصية، و«اعتذار» بسببٍ يُقرأ — لا صمتٌ يُبقيه منتظرا. وإصدارُ الشهادة
   نفسِها يبقى في شاشة الشعبة: هي التي تحمل قواعدَ الإصدار وحاجزَ البريد. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { Award, BadgeCheck, CheckCircle2, Clock, Eye, Loader2, ServerOff, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { courseById } from "@/data/courses";
import { pathwayById } from "@/data/pathways";
import { areaCls } from "@/components/FormKit";
import { fmtDateTimeAr } from "@/utils/format";

import { Panel } from "@/components/ui/Surface";
interface Row {
  id: string;
  kind: string;
  status: string;
  pathwayId: string | null;
  audienceAr: string | null;
  noteAr: string | null;
  createdAt: string;
  user: { id: string; displayName: string; email: string };
  enrollment: { id: string; cohort: { id: string; title: string; courseId: string } } | null;
}

const KIND_AR: Record<string, { label: string; icon: typeof Award }> = {
  course_certificate: { label: "شهادة دورة", icon: Award },
  pathway_certificate: { label: "شهادة مسار كامل", icon: Award },
  recommendation: { label: "توصية مهنيّة", icon: BadgeCheck },
};

const STATUS_AR: Record<string, string> = {
  pending: "بانتظار المراجعة",
  in_review: "قيد المراجعة",
};

/** أقلُّ سببٍ يُقرأ — مطابقٌ لما يفرضه الخادم عند الاعتذار */
const MIN_REASON = 5;

export default function LearnerRequests() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<Row[]>("/api/admin/learner-requests"));
      setOffline(null);
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, status: "in_review" | "fulfilled" | "declined") => {
    setBusy(id);
    try {
      await apiPost(`/api/admin/learner-requests/${id}/decide`, {
        status,
        decisionAr: note[id]?.trim() || undefined,
      });
      toast(
        status === "fulfilled"
          ? "سُجّل الإنجاز — ويصل الخبرُ إلى صاحب الطلب"
          : status === "declined"
            ? "سُجّل الاعتذار — ويصل سببُك إلى صاحب الطلب"
            : "صار الطلبُ قيد المراجعة",
      );
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy("");
    }
  };

  if (offline) {
    return (
      <AdminLayout title="طلبات المتعلّمين">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="طلبات المتعلّمين — شهادةٌ وتوصية">
      {rows === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-teal-light-ink/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبَ ينتظر قرارك</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            حين يُنهي متعلّمٌ دورتَه أو مسارَه ويطلب شهادتَه أو توصيةً يظهر هنا — مستوفيا قواعدَ الإكمال، فحسابُ
            الأهليّة يقع قبل الطلب لا بعده.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const meta = KIND_AR[r.kind] ?? { label: r.kind, icon: Award };
            const subject =
              r.enrollment
                ? (courseById(r.enrollment.cohort.courseId)?.name ?? r.enrollment.cohort.title)
                : r.pathwayId
                  ? (pathwayById(r.pathwayId)?.name ?? r.pathwayId)
                  : "—";
            const reason = note[r.id] ?? "";
            return (
              <Panel as="li" key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-black">
                      <meta.icon className="h-4 w-4 text-gold-ink" />
                      {meta.label}
                      <span className="font-normal text-foreground">— {subject}</span>
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      للمتعلّم <b className="text-foreground">{r.user.displayName}</b>
                      {" · "}
                      {/* الفاصلُ نصٌّ لا هامش: هامشُ عنصرٍ `dir=ltr` داخل سطرٍ
                          عربيّ يقع على الجهة المقابلة، فيلتصق البريدُ بالاسم. */}
                      <span dir="ltr" className="text-muted-foreground">{r.user.email}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <Clock className="mb-0.5 inline h-3 w-3" /> {fmtDateTimeAr(r.createdAt)}
                      {r.enrollment && <> · شعبة «{r.enrollment.cohort.title}»</>}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-muted-foreground">
                    {STATUS_AR[r.status] ?? r.status}
                  </span>
                </div>

                {/* جهةُ التوصية بكلام صاحبها — عليها تُكتب، فلا تُكتب عامّة */}
                {r.audienceAr && (
                  <p className="mt-3 rounded-xl border border-teal/25 bg-teal/[0.06] px-4 py-3 text-xs leading-7 text-foreground">
                    <span className="font-bold text-muted-foreground">الجهةُ التي يريدها: </span>{r.audienceAr}
                  </p>
                )}
                {r.noteAr && (
                  <p className="mt-2 rounded-xl border border-white/10 bg-paper/25 px-4 py-3 text-xs leading-7 text-foreground">
                    <span className="font-bold text-muted-foreground">ملاحظتُه: </span>{r.noteAr}
                  </p>
                )}

                <div className="mt-3">
                  <label htmlFor={`note-${r.id}`} className="mb-1.5 block text-[11px] font-bold text-muted-foreground">
                    ردُّك — إلزاميٌّ عند الاعتذار، يقرؤه المتعلّم في بوابته
                  </label>
                  <textarea
                    id={`note-${r.id}`}
                    rows={2}
                    value={reason}
                    onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="مثال: صدرت شهادتك ورقمها في «شهاداتي» — أو: نحتاج تسليمَ مشروع الدورة قبل الشهادة."
                    className={areaCls}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void decide(r.id, "fulfilled")}
                    disabled={busy === r.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40"
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    أُنجز
                  </button>
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => void decide(r.id, "in_review")}
                      disabled={busy === r.id}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-xs font-bold text-foreground transition hover:border-white/40 disabled:opacity-40"
                    >
                      <Eye className="h-3.5 w-3.5" /> قيد المراجعة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void decide(r.id, "declined")}
                    disabled={busy === r.id || reason.trim().length < MIN_REASON}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-red-400/40 px-6 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <XCircle className="h-3.5 w-3.5" /> اعتذر
                  </button>
                  {reason.trim().length < MIN_REASON && (
                    <span className="text-micro text-muted-foreground">الاعتذار يلزمه سببٌ لا يقلّ عن {MIN_REASON} أحرف</span>
                  )}
                </div>

                {/* إصدارُ الشهادة نفسِها في شاشة الشعبة — هي حاملةُ القواعد */}
                {r.enrollment && (
                  <p className="mt-2.5 text-micro leading-5 text-muted-foreground">
                    الإصدار من «الشعب» ← شعبة «{r.enrollment.cohort.title}» ← مرشَّحو الشهادة، ثمّ سجّل الإنجاز هنا.
                  </p>
                )}
              </Panel>
            );
          })}
        </ul>
      )}
    </AdminLayout>
  );
}
