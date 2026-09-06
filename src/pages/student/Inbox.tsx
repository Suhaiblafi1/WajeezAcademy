/* صندوقي (البند ص-١) — صندوق تواصل موحّد يجمع ما يخصّ المتعلم في مكان واحد:
   الإشعارات · تعليقات مدربه على تسليماته · ملاحظات المراجعة · ردود الدعم.

   من نقاط نهاية قائمة فقط. والقراءة تبقى للإشعارات وحدها — ولا نصطنع «مقروء»
   لما لا يملك حالة قراءة في القاعدة. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bell, CheckCheck, Inbox as InboxIcon, LifeBuoy, Loader2, MessageSquare, RefreshCw, ScrollText } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtWhen } from "@/utils/format";
import { buildInbox, KIND_LABEL_AR, type InboxItem, type InboxKind } from "@/application/student/inbox";
import EmptyState from "@/components/EmptyState";
import { countAr } from "@/application/text/count-ar";

import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
const ICON: Record<InboxKind, typeof Bell> = {
  notification: Bell,
  trainer_feedback: MessageSquare,
  review_note: ScrollText,
  support_reply: LifeBuoy,
};

const FILTERS: { key: InboxKind | "all"; labelAr: string }[] = [
  { key: "all", labelAr: "الكل" },
  { key: "notification", labelAr: "إشعارات" },
  { key: "trainer_feedback", labelAr: "تعليقات مدربك" },
  { key: "review_note", labelAr: "ملاحظات التسليم" },
  { key: "support_reply", labelAr: "ردود الدعم" },
];

const MSG_FORMS = { one: "رسالة", two: "رسالتان", few: "رسائل", many: "رسالة" };

export default function Inbox() {
  const { user } = useRealSession();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxKind | "all">("all");

  /* عدّاد تحديث يدوي — بديل عن useCallback لا يستطيع المُصرِّف الحفاظ عليه،
     وكل ضبط حالة يقع بعد await فلا setState متزامن داخل الأثر. */
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const safe = async <T,>(pr: Promise<T>): Promise<T | null> => pr.then((v) => v).catch(() => null);
      const [notifs, tickets, enrollList] = await Promise.all([
        safe(apiGet<unknown>("/api/learner/notifications?audience=learner")),
        safe(apiGet<unknown>("/api/learner/support/tickets")),
        safe(apiGet<{ id: string }[]>("/api/learner/my-learning")),
      ]);
      /* تفاصيل كل تسجيل تحمل التسليمات وتعليقاتها — تُجلب بالتوازي */
      const details = await Promise.all(
        (Array.isArray(enrollList) ? enrollList : []).map((e) => safe(apiGet<unknown>(`/api/learner/enrollments/${e.id}`))),
      );
      if (!alive) return;
      const anyOk = notifs !== null || tickets !== null || enrollList !== null;
      setError(anyOk ? null : "تعذر الوصول للخادم — حدّث الصفحة");
      setItems(buildInbox(notifs, tickets, details.filter(Boolean), user?.userId ?? null));
    })();
    return () => { alive = false; };
  }, [user?.userId, reload]);

  const shown = useMemo(
    () => (items ?? []).filter((i) => filter === "all" || i.kind === filter),
    [items, filter],
  );
  const unread = (items ?? []).filter((i) => i.unread);

  const markAll = async () => {
    setItems((prev) => (prev ?? []).map((i) => ({ ...i, unread: false })));
    await Promise.allSettled(
      unread.map((i) => apiPost(`/api/learner/notifications/${i.id.replace(/^n:/, "")}/read`)),
    );
  };

  return (
    <PortalLayout title="الرسائل والتنبيهات">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button tone="secondary" onClick={() => { setItems(null); setReload((n) => n + 1); }} className="min-h-11">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> تحديث
        </Button>
        {unread.length > 0 && (
          <Button tone="confirm" onClick={() => void markAll()} className="min-h-11 text-teal-light-ink">
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> تعليم الإشعارات كمقروءة ({unread.length})
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = f.key === "all" ? (items ?? []).length : (items ?? []).filter((i) => i.kind === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`min-h-11 cursor-pointer rounded-full border px-3.5 text-xs font-bold transition ${
                filter === f.key ? "border-teal bg-teal-ink/10 text-teal-light-ink" : "border-white/10 text-muted-foreground hover:border-white/30"
              }`}
            >
              {f.labelAr}
              <span className="ms-1.5 tabular-nums text-muted-foreground">{n}</span>
            </button>
          );
        })}
      </div>

      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      {items === null ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ التحميل" /></div>
      ) : shown.length === 0 ? (
        /* ط-٤ · فراغُ مرشّح ليس فراغَ صندوق: الأول يُحلّ بإزالة المرشّح لا ببداية
           جديدة. وحين يكون الصندوق نفسه فارغا فالتوجيه إلى ما يُنشئ الرسائل. */
        filter === "all" ? (
          <EmptyState
            icon={InboxIcon}
            titleAr="صندوقك فارغ"
            reasonAr="قرارات التسجيل والجلسات وتعليقات مدربك وردود الدعم تصل هنا كلها في مكان واحد — ولم يصل شيء بعد."
            actions={[
              { to: "/student/pathway", labelAr: "افتح مسارك", hintAr: "أول قرار تسجيل يصلك هنا" },
              { to: "/student/support", labelAr: "افتح تذكرة دعم", hintAr: "إن كان لديك سؤال" },
            ]}
          />
        ) : (
          <EmptyState
            icon={InboxIcon}
            tone="filter"
            titleAr="لا شيء في هذا التصنيف"
            reasonAr={`صندوقك ليس فارغا — فيه ${countAr(items.length, MSG_FORMS)}، لكن لا شيء منها في هذا التصنيف.`}
            actions={[{ onClick: () => setFilter("all"), labelAr: "اعرض كل الرسائل", hintAr: "إزالة المرشّح" }]}
          />
        )
      ) : (
        <ul className="space-y-2">
          {shown.map((i) => {
            const Icon = ICON[i.kind];
            return (
              <li key={i.id}>
                <Link
                  to={i.href}
                  className={`block rounded-2xl border p-4 transition ${
                    i.unread ? "border-teal/25 bg-teal-ink/[0.06] hover:border-teal/50" : "border-white/8 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <p className="flex flex-wrap items-center gap-2 text-sm font-black">
                    {i.unread && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                    {i.titleAr}
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-micro font-bold text-muted-foreground">
                      {KIND_LABEL_AR[i.kind]}
                    </span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-xs leading-6 text-foreground">{i.bodyAr}</p>
                  <p className="mt-1.5 text-micro text-muted-foreground">{fmtWhen(i.at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PortalLayout>
  );
}
