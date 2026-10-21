import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtDateTime } from "@/application/text/format-ar";
import { notificationCtaAr, notificationHref } from "@/application/notifications/destinations";
import { refreshUnread, useUnreadCount } from "@/services/unread-count";

import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface InAppNotification {
  id: string; title: string; body: string; status: string;
  sentAt?: string | null; createdAt: string; readAt?: string | null;
  /* ومفتاحُه وبياناتُه — منهما وجهتُه (`notificationHref`) */
  templateKey?: string | null; data?: unknown;
}

/** بوابة الجرس — لأنّ المكوّن واحد في أربع بوابات.

   كان الجرس يسأل نقطة النهاية بلا جمهور، فيعرض كلَّ ما لصاحب الحساب أينما
   وقف: من يحمل دورا إداريا يرى في «تعلّمي» طلبَ انضمام مدرّب. فصارت البوابة
   تُعلن جمهورَها، ولا يضيع إشعار — ينتقل إلى الجرس الذي يخصّه. */
export type BellAudience = "learner" | "trainer" | "staff";

/** جرس إشعارات داخل المنصة — يظهر فقط لمن له جلسة حقيقية.
   العدّادُ من مخزنٍ يشاركه بندُ القائمة (`unread-count.ts`)، والقائمة تُجلب عند الفتح، والنقر يعلّم كمقروء.

   و`href` يجعله بابا لا قائمة (٢١ أكتوبر ٢٠٢٦): للمدرّب صفحةُ «الرسائل والتنبيهات»، فالجرسُ يفتحها
   ولا يعرض نصّا في قائمةٍ صغيرة — شكا صاحبُ المنصّة أنّ المدرّب «لا يقرؤها ولا يوجد فيها أكشن»،
   وكانت على الهاتف تخرج عن حافّة الشاشة. */
export default function NotificationBell({ audience, href }: { audience: BellAudience; href?: string }) {
  const { user } = useRealSession();
  const navigate = useNavigate();
  const unread = useUnreadCount(audience, !!user);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

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

  const badge = unread > 0 && (
    <span className="absolute -top-1 -left-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-fine font-black text-on-gold">
      {unread > 9 ? "9+" : unread}
    </span>
  );

  if (href) {
    return (
      <Button as={Link} to={href} tone="secondary"
        aria-label={`الرسائل والتنبيهات — ${unread} غير مقروءة`} className="relative grid h-9 w-9 place-items-center bg-white/[0.03]">
        <Bell className="h-4 w-4" />
        {badge}
      </Button>
    );
  }

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try { setItems(await apiGet<InAppNotification[]>(`/api/learner/notifications?audience=${audience}`)); }
      catch { setItems([]); }
    }
  };

  const markRead = async (n: InAppNotification) => {
    if (n.status !== "sent") return;
    try {
      await apiPost(`/api/learner/notifications/${n.id}/read`);
      setItems((prev) => prev?.map((x) => x.id === n.id ? { ...x, status: "read" } : x) ?? null);
      void refreshUnread(audience);
    } catch { /* تبقى غير مقروءة — تُعاد المحاولة عند النقر التالي */ }
  };

  /* ═══ والبندُ يفتح خبرَه (٣ أكتوبر ٢٠٢٦) ═══
     كانت بنودُ الجرس نصّا يُعلَّم مقروءا ولا يُفتح: «خطّةُ شعبةٍ بانتظار
     اعتمادك» ثمّ يبحث قارئُها عنها بيده. فصار البندُ الذي له وجهةٌ رابطا إليها —
     والوجهةُ هي هي وجهةُ زرّ البريد (`destinations.ts`)، والخطّةُ تُفتح مبسوطةً
     في طابورها. وما لا وجهةَ له يبقى كما كان: يُعلَّم مقروءا ولا يُخترَع له باب. */
  const openItem = async (n: InAppNotification) => {
    const href = notificationHref(n.templateKey, audience, n.data);
    await markRead(n);
    if (href) { setOpen(false); navigate(href); }
  };

  const markAll = async () => {
    const unreadOnes = (items ?? []).filter((n) => n.status === "sent");
    for (const n of unreadOnes) {
      try { await apiPost(`/api/learner/notifications/${n.id}/read`); } catch { /* تجاهل الفردي */ }
    }
    setItems((prev) => prev?.map((x) => ({ ...x, status: "read" })) ?? null);
    void refreshUnread(audience);
  };

  return (
    <div ref={boxRef} className="relative">
      <Button tone="secondary" onClick={() => void toggle()}
        aria-label={`الإشعارات — ${unread} غير مقروءة`} className="relative grid h-9 w-9 place-items-center bg-white/[0.03]">
        <Bell className="h-4 w-4" />
        {badge}
      </Button>

      {open && (
        <Inset tone="solid" className="absolute left-0 top-11 z-50 w-80 overflow-hidden shadow-2xl shadow-black/60 sm:w-96">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-read font-black">الإشعارات</p>
            {items && items.some((n) => n.status === "sent") && (
              <button onClick={() => void markAll()}
                className="flex cursor-pointer items-center gap-1 text-fine font-bold text-teal-light-ink hover:text-foreground">
                <CheckCheck className="h-3 w-3" /> تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null && <p className="p-6 text-center text-read text-muted-foreground">يحمّل…</p>}
            {items?.length === 0 && <p className="p-6 text-center text-read text-muted-foreground">لا إشعارات بعد — تصلك هنا مستحقاتك وشعبك فور حدوثها.</p>}
            {items?.map((n) => (
              <button
                key={n.id}
                onClick={() => void openItem(n)}
                className={`block w-full cursor-pointer border-b border-white/5 px-4 py-3 text-right transition hover:bg-white/[0.04] ${
                  n.status === "sent" ? "bg-teal/[0.06]" : ""
                }`}
              >
                <p className="flex items-center gap-2 text-read font-black">
                  {n.status === "sent" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
                  {n.title}
                </p>
                {/* ثلاثةُ أسطرٍ على الأكثر — والخبرُ كلُّه في صفحته (١١ أكتوبر ٢٠٢٦، «فيها كلامٌ كثير») */}
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-read leading-5 text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-read text-muted-foreground">
                  {fmtDateTime(new Date(n.sentAt ?? n.createdAt))}
                  {/* واسمُ الباب فعلٌ يقول ما سيجد — كزرّ البريد */}
                  {notificationCtaAr(n.templateKey, audience, n.data) && (
                    <span className="mr-2 font-bold text-teal-light-ink">· {notificationCtaAr(n.templateKey, audience, n.data)} ←</span>
                  )}
                </p>
              </button>
            ))}
          </div>
        </Inset>
      )}
    </div>
  );
}
