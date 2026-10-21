/* «الرسائل والتنبيهات» — بابُ المدرّب لما يصله منّا (٢١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: الجرسُ كان قائمةً صغيرةً من نصٍّ طويل، و«هو لا يقرؤها ولا يوجد فيها أكشن»،
   وعلى الهاتف تخرج عن حافّة الشاشة. فعُرضت عليه ثلاثةُ مواضعَ بالصور واختار «A»: صفحةٌ لها بندٌ في
   القائمة، والجرسُ يفتحها. ولها لسانان:
   · **التنبيهات** — ما يحتاج منه إجراءً في الأعلى، بطاقةً لها زرٌّ واحدٌ يقول ما سيفعل («افتح طابور
     التصحيح»)؛ ثمّ ما هو للعلم؛ ثمّ ما قرأه. والقسمةُ نقيّةٌ في `application/trainer/inbox.ts`.
   · **الرسائل** — إعلاناتُ الإدارة إليه، يعود إليها متى شاء فيقرؤها كاملة، ويردّ عليها بواتساب أو
     بالبريد وعنوانُها في الردّ. وهي الإعلاناتُ وحدَها باختياره: بريدُ المدرّب لا تُحفظ منه نسخة،
     وواتسابُه يُرسَل من الهواتف لا من المنصّة. */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight, Bell, BookCheck, Search, CalendarDays, CheckCheck, ClipboardCheck, FileSignature, FileText,
  Image as ImageIcon, Inbox as InboxIcon, Mail, Megaphone, MessageCircle, UserRound, Wallet,
  type LucideIcon,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, apiPost } from "@/services/api";
import { announceInboxRead } from "@/services/inbox-events";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { waHref } from "@/application/site/whatsapp";
import { notificationCtaAr, notificationHref } from "@/application/notifications/destinations";
import {
  TRAINER_REPLY_SPOT, isUnread, replyMailHref, replyWhatsAppTextAr, splitAlerts, type InboxAlert,
} from "@/application/trainer/inbox";
import { CONTACT } from "@/data/stories";
import { fmtDateAr, fmtDateTimeAr, fmtWhen } from "@/utils/format";
import { matchesQuery } from "@/application/text/search-ar";
import AnnouncementBody from "@/components/AnnouncementBody";
import EmptyState from "@/components/EmptyState";
import TabBar from "@/components/ui/TabBar";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { Card, Inset, Panel } from "@/components/ui/Surface";

interface Alert extends InboxAlert { data?: unknown }

/** إعلانٌ كما يردّه `GET /api/trainer/announcements` */
interface Announcement {
  id: string; titleAr: string; bodyAr: string; sentAt: string;
  seenAt: string | null; readAt: string | null;
}

type Tab = "alerts" | "messages";

/* الأيقونةُ من صنف الخبر — تُعرف البطاقةُ بنظرةٍ قبل أن تُقرأ */
function iconFor(key?: string | null): LucideIcon {
  const k = key ?? "";
  if (k.startsWith("submission")) return ClipboardCheck;
  if (k.startsWith("cohort.plan") || k.startsWith("cohort.assessment")) return FileText;
  if (k.includes("session") || k.includes("meeting")) return CalendarDays;
  if (k === "trainer_payout") return Wallet;
  if (k.includes("poster")) return ImageIcon;
  if (k.includes("contract")) return FileSignature;
  if (k.includes("suggestion") || k.includes("public_text") || k.includes("publish")) return UserRound;
  if (k.startsWith("trainer.")) return BookCheck;
  return Bell;
}

export default function TrainerInbox() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  /* `?m=` يفتح رسالةً بعينها — وهو ما يحمله زرُّ الإعلان في البريد والجرس (`destinations.ts`) */
  const openId = params.get("m");
  const tab: Tab = params.get("tab") === "messages" || openId ? "messages" : "alerts";

  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [anns, setAnns] = useState<Announcement[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<Alert[]>("/api/learner/notifications?audience=trainer")
      .then((r) => { if (alive) setAlerts(r); })
      .catch(() => { if (alive) { setAlerts([]); setFailed(true); } });
    apiGet<Announcement[]>("/api/trainer/announcements")
      .then((r) => { if (alive) setAnns(r); })
      .catch(() => { if (alive) { setAnns([]); setFailed(true); } });
    return () => { alive = false };
  }, []);

  const split = useMemo(() => splitAlerts(alerts ?? []), [alerts]);
  const unreadAnns = (anns ?? []).filter((a) => !a.readAt).length;
  const unreadAlerts = split.action.length + split.info.length;

  /* تبديلُ اللسان يُستبدل في التاريخ، وفتحُ رسالةٍ يُضاف إليه — فزرُّ الرجوع في الهاتف يعيد إلى القائمة */
  const go = (next: { tab?: string | null; m?: string | null }) => {
    const p = new URLSearchParams(params);
    for (const [key, v] of Object.entries(next)) { if (v) p.set(key, v); else p.delete(key); }
    setParams(p, { replace: !next.m });
  };

  /* ── التنبيهات ── */
  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    await Promise.allSettled(ids.map((id) => apiPost(`/api/learner/notifications/${id}/read`)));
    setAlerts((cur) => cur?.map((a) => (ids.includes(a.id) ? { ...a, status: "read" } : a)) ?? null);
    announceInboxRead();
  };
  const openAlert = async (a: Alert, href: string | null) => {
    if (isUnread(a)) await markRead([a.id]);
    if (href) navigate(href);
  };

  /* ── الرسائل ── */
  const selected = (anns ?? []).find((a) => a.id === openId) ?? null;
  const [readBusy, setReadBusy] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  useEffect(() => {
    /* فتحُها أوّلَ مرّةٍ «رآها» — كما تفعل نافذتُها — و«قرأته» فعلُه هو */
    if (!selected || selected.seenAt) return;
    void apiPost(`/api/trainer/announcements/${selected.id}/seen`).catch(() => undefined);
  }, [selected]);
  const confirmRead = async (a: Announcement) => {
    setReadBusy(true); setReadErr(null);
    try {
      const r = await apiPost<{ readAt: string }>(`/api/trainer/announcements/${a.id}/read`);
      setAnns((cur) => cur?.map((x) => (x.id === a.id ? { ...x, readAt: r.readAt, seenAt: x.seenAt ?? r.readAt } : x)) ?? null);
      announceInboxRead();
    } catch {
      setReadErr("لم يحفظ «قرأته». أعد المحاولة.");
    } finally { setReadBusy(false); }
  };

  const loading = alerts === null || anns === null;

  return (
    <TrainerLayout title="الرسائل والتنبيهات">
      <p className="-mt-3 mb-5 text-read leading-6 text-muted-foreground">
        ما يحتاج منك في الأعلى، وكل رسائلنا محفوظة هنا.
      </p>

      <TabBar<Tab>
        ariaLabel="الرسائل والتنبيهات"
        value={tab}
        onChange={(t) => go({ tab: t === "alerts" ? null : t, m: null })}
        items={[
          { id: "alerts", label: <span className="inline-flex items-center gap-1.5">التنبيهات{unreadAlerts > 0 && <Count n={unreadAlerts} />}</span> },
          { id: "messages", label: <span className="inline-flex items-center gap-1.5">الرسائل{unreadAnns > 0 && <Count n={unreadAnns} />}</span> },
        ]}
      />

      {failed && (
        <Inset as="p" tone="warn" role="alert" className="mt-4 px-4 py-2.5 text-read leading-6 text-gold-ink">
          تعذر تحميل بعض ما وصلك. أعد فتح الصفحة بعد قليل.
        </Inset>
      )}

      <div role="tabpanel" className="mt-6">
        {loading ? (
          <div aria-busy="true" aria-label="يحمّل" className="grid animate-pulse gap-3">
            <div className="h-24 rounded-2xl bg-white/5" />
            <div className="h-24 rounded-2xl bg-white/5" />
            <div className="h-24 rounded-2xl bg-white/5" />
          </div>
        ) : tab === "alerts" ? (
          <AlertsPanel split={split} onOpen={openAlert} onMarkRead={markRead} />
        ) : (
          <MessagesPanel
            anns={anns ?? []}
            selected={selected}
            onSelect={(id) => go({ tab: "messages", m: id })}
            onBack={() => go({ tab: "messages", m: null })}
            onRead={confirmRead}
            readBusy={readBusy}
            readErr={readErr}
          />
        )}
      </div>
    </TrainerLayout>
  );
}

function Count({ n }: { n: number }) {
  return <span className="grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-fine font-black text-on-gold">{n > 9 ? "9+" : n}</span>;
}

function GroupHead({ title, tone, action }: { title: string; tone: "gold" | "muted"; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span aria-hidden="true" className={`h-4 w-1 rounded-full ${tone === "gold" ? "bg-gold" : "bg-white/20"}`} />
      <h2 className="flex-1 text-sm font-black text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}

/* ═══ لسانُ التنبيهات ═══ */
function AlertsPanel({ split, onOpen, onMarkRead }: {
  split: ReturnType<typeof splitAlerts<Alert>>;
  onOpen: (a: Alert, href: string | null) => Promise<void>;
  onMarkRead: (ids: string[]) => Promise<void>;
}) {
  const [showRead, setShowRead] = useState(false);
  const { action, info, read } = split;

  if (action.length + info.length + read.length === 0) {
    return <EmptyState icon={InboxIcon} tone="done" titleAr="لا تنبيهات بعد" reasonAr="يصلك هنا كل جديد: تسليم ينتظر تصحيحك، أو قرار في خطة شعبتك، أو لقاء قريب." />;
  }
  const readShown = showRead ? read : read.slice(0, 5);

  return (
    <div className="grid gap-8">
      {action.length + info.length === 0 && (
        <Inset tone="positive" className="flex items-center gap-3 text-read leading-6">
          <CheckCheck className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
          لا شيء جديد. قرأت كل ما وصلك.
        </Inset>
      )}

      {action.length > 0 && (
        <section aria-label="يحتاج منك إجراء">
          <GroupHead title={`يحتاج منك إجراء · ${action.length}`} tone="gold" />
          <div className="grid gap-2.5">
            {action.map((a) => <AlertCard key={a.id} a={a} kind="action" onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {info.length > 0 && (
        <section aria-label="للعلم">
          <GroupHead title="للعلم" tone="muted" action={
            <Button tone="ghost" size="sm" icon={CheckCheck} onClick={() => void onMarkRead(info.map((a) => a.id))}>
              علّمها مقروءة
            </Button>
          } />
          <div className="grid gap-2.5">
            {info.map((a) => <AlertCard key={a.id} a={a} kind="info" onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {read.length > 0 && (
        <section aria-label="قرأتها">
          <GroupHead title="قرأتها" tone="muted" />
          <div className="grid gap-2.5">
            {readShown.map((a) => <AlertCard key={a.id} a={a} kind="read" onOpen={onOpen} />)}
          </div>
          {read.length > readShown.length && (
            <Button tone="ghost" size="sm" className="mt-2" onClick={() => setShowRead(true)}>
              اعرض الكل ({read.length})
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function AlertCard({ a, kind, onOpen }: { a: Alert; kind: "action" | "info" | "read"; onOpen: (a: Alert, href: string | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const href = notificationHref(a.templateKey, "trainer", a.data);
  const cta = notificationCtaAr(a.templateKey, "trainer", a.data);
  const Icon = iconFor(a.templateKey);
  const run = async () => { setBusy(true); try { await onOpen(a, href); } finally { setBusy(false); } };

  return (
    <Card tone={kind === "action" ? "warn" : "default"} className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap">
      <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${kind === "action" ? "bg-gold/15 text-gold-ink" : "bg-white/5 text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-2 text-sm font-black leading-6 ${kind === "read" ? "text-muted-foreground" : ""}`}>
          {kind !== "read" && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
          {a.title}
        </p>
        <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-read leading-6 text-muted-foreground">{a.body}</p>
        <p className="mt-1 text-read text-muted-foreground/80">{fmtWhen(a.sentAt ?? a.createdAt)}</p>
      </div>
      <div className="w-full shrink-0 sm:w-auto">
        {href && cta ? (
          <Button tone={kind === "action" ? "confirm" : "secondary"} loading={busy} onClick={() => void run()} className="w-full sm:w-auto">
            {cta} ←
          </Button>
        ) : kind !== "read" ? (
          <Button tone="ghost" size="sm" icon={CheckCheck} loading={busy} onClick={() => void run()}>علّمه مقروءا</Button>
        ) : null}
      </div>
    </Card>
  );
}

/* ═══ لسانُ الرسائل — قائمةٌ وقارئ، وعلى الهاتف واحدٌ بعد الآخر ═══ */
function MessagesPanel({ anns, selected, onSelect, onBack, onRead, readBusy, readErr }: {
  anns: Announcement[];
  selected: Announcement | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRead: (a: Announcement) => Promise<void>;
  readBusy: boolean;
  readErr: string | null;
}) {
  /* بحثٌ في العنوان والنصّ — الرسائلُ تتراكم فصلا بعد فصل، ومن يطلب «مواعيد الصرف» لا يمرّ عليها كلِّها */
  const [q, setQ] = useState("");
  if (anns.length === 0) {
    return <EmptyState icon={Megaphone} titleAr="لا رسائل بعد" reasonAr="إعلانات الإدارة إليك تحفظ هنا، فتعود إليها متى شئت وترد عليها." />;
  }
  const listed = anns.filter((a) => matchesQuery(q, [a.titleAr, a.bodyAr]));
  /* بلا اختيارٍ على الحاسوب يُفتح أحدثُها، وعلى الهاتف تُعرض القائمة */
  const shown = selected ?? anns[0];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Panel as="nav" aria-label="رسائلك" className={selected ? "hidden lg:block" : ""}>
        <label className="relative -mx-3 -mt-3 mb-3 block">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في رسائلك" aria-label="ابحث في رسائلك"
            className="w-full rounded-xl bg-paper/40 py-2.5 pr-9 pl-3 text-sm ring-1 ring-white/10 placeholder:text-muted-foreground/75 focus:outline-none focus:ring-2 focus:ring-teal"
          />
        </label>
        {listed.length === 0 && <p className="px-1 py-4 text-center text-read text-muted-foreground">لا رسالة فيها «{q.trim()}».</p>}
        <ul className="-mx-3 -mb-3 grid grid-cols-1 gap-1">
          {listed.map((a) => {
            const on = a.id === shown.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => onSelect(a.id)}
                  className={`block w-full rounded-xl px-3.5 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                    on ? "bg-teal/10" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className={`flex min-w-0 items-center gap-2 text-sm font-black leading-6 ${a.readAt ? "" : "text-foreground"}`}>
                      {!a.readAt && <span aria-label="غير مقروءة" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
                      <span className="truncate">{a.titleAr}</span>
                    </span>
                    <span className="shrink-0 text-fine text-muted-foreground">{fmtDateAr(a.sentAt)}</span>
                  </span>
                  <span className="mt-1 block truncate text-read text-muted-foreground">{a.bodyAr.replace(/\s+/g, " ")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel as="article" aria-labelledby="msg-h" className={selected ? "" : "hidden lg:block"}>
        <div className="border-b border-white/10 pb-5">
          <Button tone="ghost" size="sm" icon={ArrowRight} onClick={onBack} className="-ms-3 mb-2 lg:hidden">رسائلك</Button>
          <h2 id="msg-h" className="text-lg font-black leading-8">{shown.titleAr}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-read text-muted-foreground">
            <Chip tone="warn" icon={Megaphone}>إعلان من الإدارة</Chip>
            {fmtDateTimeAr(shown.sentAt)}
          </p>
        </div>
        <div className="py-6">
          {/* وروابطُه تُضغط — ويُفتح كلٌّ في لسانٍ آخر */}
          <AnnouncementBody text={shown.bodyAr} />
          <div className="mt-6">
            {shown.readAt ? (
              <p className="flex items-center gap-2 text-read text-muted-foreground">
                <CheckCheck className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                قرأتها في {fmtDateTimeAr(shown.readAt)}.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button tone="confirm" icon={CheckCheck} loading={readBusy} onClick={() => void onRead(shown)}>قرأته</Button>
                <span className="text-read text-muted-foreground">يعلم الإدارة أنها وصلتك.</span>
              </div>
            )}
            {readErr && <p role="alert" className="mt-2 text-read font-bold text-danger-ink">{readErr}</p>}
          </div>
        </div>
        <Reply title={shown.titleAr} />
      </Panel>
    </div>
  );
}

/* ═══ الردّ — واتساب أو البريد، وعنوانُ الرسالة فيه ═══ */
function Reply({ title }: { title: string }) {
  const numbers = useWhatsAppNumbers();
  const wa = waHref(numbers, TRAINER_REPLY_SPOT, CONTACT.whatsapp, replyWhatsAppTextAr(title));
  return (
    <div className="border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="me-1 text-sm font-black">رد علينا:</span>
        {wa && (
          <Button as="a" href={wa} target="_blank" rel="noopener noreferrer" tone="secondary" icon={MessageCircle} className="flex-1 sm:flex-none">
            واتساب
          </Button>
        )}
        <Button as="a" href={replyMailHref(title)} tone="secondary" icon={Mail} className="flex-1 sm:flex-none">
          البريد
        </Button>
      </div>
      <p className="mt-2 text-read leading-6 text-muted-foreground">يصلنا ردك وعنوان الرسالة فيه، فنعرف عن أي رسالة تسأل.</p>
    </div>
  );
}
