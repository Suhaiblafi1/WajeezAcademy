/* إشعارات الطالب — API حقيقي: صندوق in_app، تعليم كمقروء، شارة غير المقروء */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import NotificationPreferences from "@/components/NotificationPreferences";
import { fmtWhen } from "@/utils/format";
import { notificationCtaAr, notificationHref } from "@/application/notifications/destinations";

import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface Notif {
  id: string; title: string; body: string; status: string; sentAt: string | null; queuedAt: string;
  templateKey?: string | null; data?: unknown;
}

export default function Notifications() {
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await apiGet<Notif[]>("/api/learner/notifications?audience=learner")); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تحميل الإشعارات"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (n: Notif) => {
    if (n.status === "read") return;
    setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: "read" } : x)));
    try { await apiPost(`/api/learner/notifications/${n.id}/read`); } catch { /* التفاؤلية تكفي */ }
  };

  /* والبندُ يفتح خبرَه — كجرس البوّابة (١٩ أكتوبر ٢٠٢٦، `destinations.ts`) */
  const navigate = useNavigate();
  const openRow = (n: Notif) => {
    void markRead(n);
    const href = notificationHref(n.templateKey, "learner", n.data);
    if (href) navigate(href);
  };

  const markAll = async () => {
    const unread = rows.filter((n) => n.status !== "read");
    setRows((prev) => prev.map((x) => ({ ...x, status: "read" })));
    await Promise.allSettled(unread.map((n) => apiPost(`/api/learner/notifications/${n.id}/read`)));
  };

  return (
    <PortalLayout title="إشعاراتي">
      <div className="mb-4 flex items-center gap-3">
        <Button tone="secondary" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
        {rows.some((n) => n.status !== "read") && (
          <Button tone="confirm" onClick={() => void markAll()} className="text-teal-light-ink">
            <CheckCheck className="h-3.5 w-3.5" /> تعليم الكل كمقروء
          </Button>
        )}
      </div>

      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">لا إشعارات بعد.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <button key={n.id} onClick={() => openRow(n)}
              className={`w-full cursor-pointer rounded-2xl border p-4 text-right transition ${
                n.status === "read" ? "border-white/5 bg-white/[0.01] text-muted-foreground" : "border-teal/25 bg-teal/5 hover:border-teal/50"
              }`}>
              <p className="flex items-center gap-2 text-sm font-black">
                {n.status !== "read" && <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
                {n.title}
              </p>
              <p className="mt-1 text-read leading-6">{n.body}</p>
              <p className="mt-1 text-read text-muted-foreground">
                {fmtWhen(n.sentAt ?? n.queuedAt)}
                {notificationCtaAr(n.templateKey, "learner", n.data) && (
                  <span className="mr-2 font-bold text-teal-light-ink">· {notificationCtaAr(n.templateKey, "learner", n.data)} ←</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* تفضيلاتي — في الشاشة نفسِها التي أقرأ فيها إشعاراتي (المهمّة ٧٢).
          ومن كتَم صنفا يجد هنا سببَ ما لا يُكتَم بدل أن يبحث عنه. */}
      <div className="mt-8">
        <NotificationPreferences />
      </div>
    </PortalLayout>
  );
}
