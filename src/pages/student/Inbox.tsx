/* «الرسائل والتنبيهات» (البند ص-١) — صندوق تواصل موحّد يجمع ما يخصّ المتعلم في مكان واحد:
   الإشعارات · تعليقات مدربه على تسليماته · ملاحظات المراجعة · ردود الدعم.

   من نقاط نهاية قائمة فقط. والقراءة تبقى للإشعارات وحدها — ولا نصطنع «مقروء»
   لما لا يملك حالة قراءة في القاعدة.

   ─────────── وصار البابَ الوحيد (٢٠ أكتوبر ٢٠٢٦، الخطوة ي) ───────────

   كانت بجانبه «إشعاراتي»: صفحةٌ بلا بندٍ في القائمة تعرض الإشعاراتِ نفسَها، وإليها يقود كلُّ إشعارٍ لا
   وجهةَ له — فيدور المتعلّمُ في حلقة — وفي ذيلها تفضيلاتُ الرسائل. فصار مسارُها تحويلا إلى هنا،
   والتفضيلاتُ في «الملف الشخصي»، ولكلّ بندٍ هنا فعلٌ واحد: يفتح وجهتَه ويقول ما سيجد («افتح شهادتك»)،
   أو — إن كان خبرُه كلُّه في نصّه — يُعلَّم مقروءا بنقرته. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Bell, CheckCheck, Inbox as InboxIcon, LifeBuoy, Loader2, MessageSquare, ScrollText, Settings2 } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtWhen } from "@/utils/format";
import { buildInbox, KIND_LABEL_AR, type InboxItem, type InboxKind } from "@/application/student/inbox";
import { announceInboxRead } from "@/services/inbox-events";
import EmptyState from "@/components/EmptyState";
import { countAr } from "@/application/text/count-ar";

import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
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
  }, [user?.userId]);

  /* المرشّحاتُ لما فيه شيءٌ فقط — ومن صندوقُه صنفٌ واحدٌ لا يُعرض عليه اختيار */
  const kinds = useMemo(() => new Set((items ?? []).map((i) => i.kind)), [items]);
  const filters = FILTERS.filter((f) => f.key === "all" || kinds.has(f.key));
  const shown = useMemo(
    () => (items ?? []).filter((i) => filter === "all" || i.kind === filter),
    [items, filter],
  );
  const unread = (items ?? []).filter((i) => i.unread);

  /* والإشعارُ يُعلَّم مقروءا حين يُفتح — والجرسُ يُخبَر فيُنقص شارتَه الآن لا بعد دقيقة */
  const markOne = (i: InboxItem) => {
    if (i.kind !== "notification" || !i.unread) return;
    setItems((prev) => (prev ?? []).map((x) => (x.id === i.id ? { ...x, unread: false } : x)));
    void apiPost(`/api/learner/notifications/${i.id.replace(/^n:/, "")}/read`)
      .then(announceInboxRead).catch(() => undefined);
  };

  const markAll = async () => {
    setItems((prev) => (prev ?? []).map((i) => ({ ...i, unread: false })));
    await Promise.allSettled(
      unread.map((i) => apiPost(`/api/learner/notifications/${i.id.replace(/^n:/, "")}/read`)),
    );
    announceInboxRead();
  };

  return (
    <PortalLayout title="الرسائل والتنبيهات">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {unread.length > 0 ? (
          <Button tone="confirm" onClick={() => void markAll()} className="min-h-11 text-teal-light-ink">
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> علّم الكل مقروءا ({unread.length})
          </Button>
        ) : <span />}
        {/* وما يصله منها يُضبط في ملفّه — كان في ذيل «إشعاراتي» */}
        <Button as={Link} tone="ghost" icon={Settings2} to="/student/account#notifications" className="min-h-11">
          ما يصلني من إشعارات
        </Button>
      </div>

      {filters.length > 2 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {filters.map((f) => {
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
      )}

      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      {items === null ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جار التحميل" /></div>
      ) : shown.length === 0 ? (
        /* ط-٤ · فراغُ مرشّح ليس فراغَ صندوق: الأول يُحلّ بإزالة المرشّح لا ببداية
           جديدة. وحين يكون الصندوق نفسه فارغا فالتوجيه إلى ما يُنشئ الرسائل. */
        filter === "all" ? (
          <EmptyState
            icon={InboxIcon}
            titleAr="صندوقك فارغ"
            reasonAr="لم يصل شيء بعد — قرارات التسجيل وتعليقات مدربك وردود الدعم تصل هنا."
            actions={[
              { to: "/student/learning", labelAr: "افتح مسارك", hintAr: "أول قرار تسجيل يصلك هنا" },
              { to: "/student/support", labelAr: "افتح تذكرة دعم", hintAr: "إن كان لديك سؤال" },
            ]}
          />
        ) : (
          <EmptyState
            icon={InboxIcon}
            tone="filter"
            titleAr="لا شيء في هذا التصنيف"
            reasonAr={`لا شيء في هذا التصنيف — وفي صندوقك ${countAr(items.length, MSG_FORMS)}.`}
            actions={[{ onClick: () => setFilter("all"), labelAr: "اعرض كل الرسائل", hintAr: "إزالة المرشّح" }]}
          />
        )
      ) : (
        <ul className="space-y-2">
          {shown.map((i) => <InboxRow key={i.id} item={i} onOpen={() => markOne(i)} />)}
        </ul>
      )}
    </PortalLayout>
  );
}

/* البندُ كلُّه يُنقر: ما له وجهةٌ رابطٌ إليها بفعلٍ يقول ما سيجد، وما خبرُه كلُّه في نصّه زرٌّ يعلّمه
   مقروءا — لا رابطَ إلى صفحةٍ تعرضه ثانية. وما قُرئ ولا وجهةَ له نصٌّ يُقرأ لا زرّ. */
function InboxRow({ item: i, onOpen }: { item: InboxItem; onOpen: () => void }) {
  const Icon = ICON[i.kind];
  const body = (
    <>
      <p className="flex flex-wrap items-center gap-2 text-sm font-black">
        {i.unread && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
        <Icon className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
        {i.titleAr}
        {/* الصنفُ يُقال حين يفرق — والإشعارُ أكثرُ البنود فلا يُوسم */}
        {i.kind !== "notification" && (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-fine font-bold text-muted-foreground">
            {KIND_LABEL_AR[i.kind]}
          </span>
        )}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-read leading-6 text-foreground">{i.bodyAr}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-read text-muted-foreground">
        {fmtWhen(i.at)}
        {i.href && i.ctaAr && (
          <span className="inline-flex items-center gap-1 font-bold text-teal-light-ink">
            {i.ctaAr} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </p>
    </>
  );
  const tone = i.unread ? "accent" : "default";
  const look = `block w-full text-right transition ${i.unread ? "bg-teal-ink/[0.06] hover:border-teal/50" : "hover:border-white/25"}`;
  return (
    <li>
      {i.href ? (
        <Card as={Link} tone={tone} interactive to={i.href} onClick={onOpen} className={look}>{body}</Card>
      ) : i.unread ? (
        <Card as="button" type="button" tone={tone} interactive onClick={onOpen} className={look}>{body}</Card>
      ) : (
        /* مقروءٌ بلا وجهة: لا نقرةَ بلا أثر — يُقرأ ولا يوهم بزرّ */
        <Card tone={tone}>{body}</Card>
      )}
    </li>
  );
}
