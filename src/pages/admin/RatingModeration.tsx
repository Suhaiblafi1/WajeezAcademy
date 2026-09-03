/* مراجعة تعليقات التقييم (١و).

   ما تحكمه هذه الشاشة هو **النصّ المكتوب وحده**: يُعتمد للنشر العلني أو
   يُحجب. أمّا الدرجة فتدخل المعدّل المعلَن في كل الأحوال — ولو اختارت الإدارة
   أيّ الدرجات تُحتسب لصار الرقم دعايةً لا قياسا، وهو ما أزلناه من المنصّة
   دفعةً بعد دفعة. والقائمة تصل مجهولةَ المُقيِّم حتى هنا: الحكم على النصّ. */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ServerOff, ShieldCheck, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";

interface QueueItem {
  id: string;
  subjectType: "trainer" | "advisor" | "course";
  subjectId: string;
  subjectNameAr?: string | null;
  score: number;
  commentAr: string;
  publishStatus: string;
  createdAt: string;
  moderationReason: string | null;
}

const KIND_AR: Record<QueueItem["subjectType"], string> = {
  trainer: "مدرّب", advisor: "مستشار", course: "دورة",
};
const TABS: { key: string; label: string }[] = [
  { key: "pending", label: "بانتظار المراجعة" },
  { key: "approved", label: "معتمَدة" },
  { key: "rejected", label: "محجوبة" },
];

export default function RatingModeration() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(null);
    try {
      setRows(await apiGet<QueueItem[]>(`/api/admin/ratings/queue?status=${status}`));
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, approve: boolean) => {
    if (busy) return;
    let reason: string | undefined;
    if (!approve) {
      const entered = window.prompt("سبب الحجب (يُسجَّل في التدقيق):")?.trim();
      if (!entered) return;
      reason = entered;
    }
    setBusy(id); setFlash("");
    try {
      await apiPost(`/api/admin/ratings/${id}/moderate`, { approve, ...(reason ? { reason } : {}) });
      setFlash(approve ? "اعتُمد التعليق للنشر" : "حُجب التعليق — ودرجته باقية في المعدّل");
      await load();
    } catch (e) {
      setFlash(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLayout title="مراجعة تعليقات التقييم">
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-teal/25 bg-teal/[0.05] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-light-ink" />
        <p className="text-[12px] leading-6 text-white/65">
          قرارك هنا يحكم <span className="font-black text-white/85">التعليق المكتوب</span> وحده:
          يُنشر علنا أو يُحجب. <span className="font-black text-white/85">الدرجة تدخل المعدّل في كل الأحوال</span> —
          فالرقم المعلَن يبقى قياسا لا اختيارا. والقائمة تصلك بلا اسم المُقيِّم عمدا: الحكم على النصّ.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              status === t.key ? "border-teal/60 bg-teal/15 text-teal-light-ink" : "border-white/10 text-white/55 hover:border-white/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {flash && <p role="status" className="mb-4 text-xs font-bold text-teal-light-ink">{flash}</p>}

      {offline && (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <ServerOff className="h-10 w-10 text-white/20" />
          <p className="mt-3 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      )}

      {!offline && loading && (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      )}

      {!offline && !loading && rows.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-white/50">
          لا تعليقات في هذه الحالة.
        </p>
      )}

      {!offline && !loading && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="rounded-full border border-white/10 px-2 py-0.5 font-bold text-white/45">{KIND_AR[r.subjectType]}</span>
                <span className="font-black text-gold">{r.score} ★</span>
                {r.subjectNameAr
                  ? <span className="font-bold text-white/70">{r.subjectNameAr}</span>
                  : <span dir="ltr" className="text-white/25">{r.subjectId}</span>}
              </div>
              <p className="mt-3 text-[13px] leading-7 text-white/75">{r.commentAr}</p>
              {r.moderationReason && (
                <p className="mt-2 text-[11px] text-white/40">سبب الحجب: {r.moderationReason}</p>
              )}
              {r.publishStatus === "pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void act(r.id, true)}
                    disabled={busy === r.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal-light disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> اعتمد للنشر
                  </button>
                  <button
                    onClick={() => void act(r.id, false)}
                    disabled={busy === r.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold text-white/65 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> احجب النصّ
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
