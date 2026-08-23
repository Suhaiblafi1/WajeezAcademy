import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";

interface InAppNotification {
  id: string; title: string; body: string; status: string;
  sentAt?: string | null; createdAt: string; readAt?: string | null;
}

/** جرس إشعارات داخل المنصة — يظهر فقط لمن له جلسة حقيقية.
   يحدّث العدّاد كل 30 ثانية، والقائمة تُجلب عند الفتح، والنقر يعلّم كمقروء. */
export default function NotificationBell() {
  const { user } = useRealSession();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const r = await apiGet<{ unread: number }>("/api/learner/notifications/unread-count");
      setUnread(r.unread);
    } catch { /* بلا جلسة أو خادم غير متاح — الجرس يبقى صامتاً */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshCount();
    const t = setInterval(() => void refreshCount(), 30_000);
    return () => clearInterval(t);
  }, [user, refreshCount]);

  /* إغلاق القائمة عند النقر خارجها */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try { setItems(await apiGet<InAppNotification[]>("/api/learner/notifications")); }
      catch { setItems([]); }
    }
  };

  const markRead = async (n: InAppNotification) => {
    if (n.status !== "sent") return;
    try {
      await apiPost(`/api/learner/notifications/${n.id}/read`);
      setItems((prev) => prev?.map((x) => x.id === n.id ? { ...x, status: "read" } : x) ?? null);
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* تبقى غير مقروءة — تُعاد المحاولة عند النقر التالي */ }
  };

  const markAll = async () => {
    const unreadOnes = (items ?? []).filter((n) => n.status === "sent");
    for (const n of unreadOnes) {
      try { await apiPost(`/api/learner/notifications/${n.id}/read`); } catch { /* تجاهل الفردي */ }
    }
    setItems((prev) => prev?.map((x) => ({ ...x, status: "read" })) ?? null);
    setUnread(0);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => void toggle()}
        aria-label={`الإشعارات — ${unread} غير مقروءة`}
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-white/30 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#FABC05] px-1 text-[9px] font-black text-[#0D0D0D]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-white/15 bg-surface shadow-2xl shadow-black/60 sm:w-96">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-black">الإشعارات</p>
            {items && items.some((n) => n.status === "sent") && (
              <button onClick={() => void markAll()}
                className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-[#6EC7D1] hover:text-white">
                <CheckCheck className="h-3 w-3" /> تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null && <p className="p-6 text-center text-xs text-white/40">يُحمَّل…</p>}
            {items?.length === 0 && <p className="p-6 text-center text-xs text-white/40">لا إشعارات بعد — تصلك هنا مستحقاتك وشعبك فور حدوثها.</p>}
            {items?.map((n) => (
              <button
                key={n.id}
                onClick={() => void markRead(n)}
                className={`block w-full cursor-pointer border-b border-white/5 px-4 py-3 text-right transition hover:bg-white/[0.04] ${
                  n.status === "sent" ? "bg-[#38A7B4]/[0.06]" : ""
                }`}
              >
                <p className="flex items-center gap-2 text-xs font-black">
                  {n.status === "sent" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FABC05]" />}
                  {n.title}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/55">{n.body}</p>
                <p className="mt-1 text-[9px] text-white/30">
                  {new Date(n.sentAt ?? n.createdAt).toLocaleString("ar")}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
