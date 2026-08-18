import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, Send, ServerOff, Users } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";

interface OpenCohort {
  id: string; title: string; status: string; courseId: string; courseTitle: string;
  startsAt: string | null; endsAt: string | null; daysOfWeek: string[] | null; startTime: string | null;
  timezone: string | null; price: number | null; currency: string | null; language: string | null;
  deliveryMode: string | null; seatsLeft: number | null; trainers: string[];
  nextSession: { startsAt: string; endsAt: string; title: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = { open: "مفتوحة", full: "مكتملة العدد", active: "جارية" };
const DELIVERY_LABELS: Record<string, string> = { online: "عن بعد", in_person: "حضوري", hybrid: "هجين" };

function fmtDate(d: string | null) {
  if (!d) return "يُعلن قريبا";
  return new Date(d).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

/** الشعب المفتوحة للتسجيل — الطالب يطلب مقعدا والإدارة توافق فتُحجز المقاعد وتُنشأ الفاتورة */
export default function OpenCohorts() {
  const [rows, setRows] = useState<OpenCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(null);
    try {
      setRows(await apiGet<OpenCohort[]>("/api/public/cohorts"));
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const requestSeat = async (cohortId: string) => {
    if (busy) return;
    setBusy(true);
    setFlash("");
    try {
      await apiPost("/api/learner/enrollment-requests", { cohortId, ...(note.trim() ? { note: note.trim() } : {}) });
      setRequested((prev) => new Set(prev).add(cohortId));
      setNoteFor(null);
      setNote("");
      setFlash("أُرسل طلبك — ستراجعه الإدارة وتصلك الفاتورة عند الموافقة");
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر إرسال الطلب");
    } finally {
      setBusy(false);
    }
  };

  if (offline) {
    return (
      <PortalLayout title="الشعب المفتوحة">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="الشعب المفتوحة للتسجيل">
      <p className="mb-5 text-xs leading-6 text-white/50">
        اختر شعبتك واطلب مقعدا — الموافقة من الإدارة تحجز مقعدك وتنشئ فاتورتك تلقائيا، وتجدها بعدها في «فواتيري».
      </p>

      {flash && <p role="status" className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/80">{flash}</p>}

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <CalendarDays className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا شعب مفتوحة حاليا</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">تُفتح الشعب دوريا — فعّل إشعاراتك ليصلك الجديد أولا.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((c) => (
            <article key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[#6EC7D1]">{c.courseTitle} <span dir="ltr" className="text-white/50">({c.courseId})</span></p>
                  <h2 className="mt-1 font-black">{c.title}</h2>
                </div>
                <span className="shrink-0 rounded-full border border-[#38A7B4]/40 px-3 py-1 text-[10px] font-bold text-[#6EC7D1]">
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>

              <dl className="mt-3 space-y-1.5 text-xs text-white/65">
                <div className="flex gap-2"><dt className="text-white/50">البدء:</dt><dd>{fmtDate(c.startsAt)}</dd></div>
                {c.daysOfWeek && c.daysOfWeek.length > 0 && (
                  <div className="flex gap-2"><dt className="text-white/50">الأيام:</dt><dd>{c.daysOfWeek.join("، ")}{c.startTime ? ` — ${c.startTime}` : ""}</dd></div>
                )}
                {c.deliveryMode && <div className="flex gap-2"><dt className="text-white/50">النمط:</dt><dd>{DELIVERY_LABELS[c.deliveryMode] ?? c.deliveryMode}</dd></div>}
                {c.trainers.length > 0 && <div className="flex gap-2"><dt className="text-white/50">المدرب:</dt><dd>{c.trainers.join("، ")}</dd></div>}
                {c.nextSession && <div className="flex gap-2"><dt className="text-white/50">أقرب جلسة:</dt><dd>{c.nextSession.title ?? "جلسة"} — {fmtDate(c.nextSession.startsAt)}</dd></div>}
              </dl>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[#FABC05]">
                  {c.price != null ? `${c.price} ${c.currency === "USD" ? "$" : (c.currency ?? "")}` : "السعر عند الموافقة"}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-white/50">
                  <Users className="h-3.5 w-3.5" />
                  {c.seatsLeft != null ? (c.seatsLeft > 0 ? `${c.seatsLeft} مقعد متبقٍ` : "اكتمل العدد") : "مقاعد متاحة"}
                </p>
              </div>

              {requested.has(c.id) ? (
                <p className="mt-3 rounded-xl border border-[#34A853]/30 bg-[#34A853]/10 p-2.5 text-center text-xs font-bold text-[#34A853]">
                  طلبك قيد المراجعة لدى الإدارة
                </p>
              ) : noteFor === c.id ? (
                <div className="mt-3 space-y-2">
                  <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظة للإدارة (اختياري) — مثال: أحتاج موعدا مسائيا"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => void requestSeat(c.id)} disabled={busy || c.seatsLeft === 0}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#FABC05] px-4 py-2 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:opacity-40">
                      <Send className="h-3.5 w-3.5" /> {busy ? "جارٍ الإرسال…" : "تأكيد الطلب"}
                    </button>
                    <button onClick={() => { setNoteFor(null); setNote(""); }}
                      className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 transition hover:text-white">
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNoteFor(c.id)} disabled={c.seatsLeft === 0}
                  className="mt-3 w-full cursor-pointer rounded-full bg-[#38A7B4] px-4 py-2.5 text-xs font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:cursor-not-allowed disabled:opacity-40">
                  {c.seatsLeft === 0 ? "اكتمل العدد" : "اطلب مقعدا في هذه الشعبة"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
