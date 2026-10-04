/* ═══ «إعلاناتٌ للمدرّبين» — يُكتب، ويُرى كما سيصل، ثمّ يُرسَل بيدك (٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا». وعُرضت
   عليه ثلاثةُ خياراتٍ بفروقها فاختار الأوّل: نافذةٌ في بوّابة المدرّب فيها «قرأتُه»،
   وإشعارٌ في الجرس، وقائمةٌ بمن قرأ — وهذه الشاشةُ ثلثُها الأخير وبابُ الأوّلَين.

   ── ولا شيءَ يُرسَل بلا سؤال ──

   «Do not force me to do any action. Do always give me options» (قرارُه، ٢ أكتوبر).
   فالنصُّ المقترحُ يملأ النموذجَ ويُعدَّل كلُّه، ويُرى تحته كما سيراه المدرّب، ثمّ
   «أرسِل…» تسأل «أترسله الآن؟» وتحت خياريها ما يقع بكلٍّ منهما. وإن كان أُرسل
   إعلانٌ بالعنوان نفسِه قيل ذلك قبل أن يُرسَل ثانيةً — ولا يُمنع.

   ── والقائمةُ تفرّق ثلاثة ──

   قرأه · رآه ولم يضغط «قرأتُه» · لم يفتح بوّابتَه منذ أُرسل. ومن لم يقرأ أوّلا: هو
   من يُتابَع. والعلّةُ كاملةً في `server/services/trainer-announcement.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Megaphone, Send, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import Modal from "@/components/Modal";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { matchesQuery } from "@/application/text/search-ar";
import { fmtDateTimeAr } from "@/utils/format";
import { countAr } from "@/application/text/count-ar";
import {
  ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_DRAFT, ANNOUNCEMENT_TITLE_MAX, RECIPIENT_STATE_AR, recipientState,
} from "@/application/trainer/announcement";

/** ما أُرسل — كما يردّه `TrainerAnnouncementService.list` */
interface SentAnnouncement {
  id: string;
  titleAr: string;
  bodyAr: string;
  sentAt: string;
  total: number;
  read: number;
  seen: number;
}

interface Recipient {
  userId: string;
  name: string | null;
  email: string;
  seenAt: string | null;
  readAt: string | null;
}

const TRAINER_FORMS = { one: "مدرّب", two: "مدرّبَين", few: "مدرّبين", many: "مدرّبا" };

/** «مدرّبٌ واحد» و«مدرّبان» لا «1 مدرّب» — والعددُ يُقرأ لا يُحسب */
function trainersAr(n: number): string {
  if (n === 1) return "مدرّبٌ واحد";
  if (n === 2) return "مدرّبان";
  return countAr(n, TRAINER_FORMS);
}

const field = "w-full rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-read text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

const STATE_TONE = {
  read: "text-teal-light-ink",
  seen: "text-gold-ink",
  unseen: "text-muted-foreground",
} as const;

/** نصُّ الإعلان كما تعرضه النافذة — فقراتٌ تفصلها سطورٌ فارغة */
function Body({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-read leading-7">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">{para}</p>
      ))}
    </div>
  );
}

function SentRow({ a }: { a: SentAnnouncement }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Recipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* ومدرّبٌ بعينه يُبلَغ باسمه أو بريده — المستقبِلون كلُّ مدرّبي المنصّة، والقائمةُ تطول بطولها */
  const [q, setQ] = useState("");

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || rows) return;
    try {
      const r = await apiGet<{ recipients: Recipient[] }>(`/api/admin/trainer-announcements/${a.id}`);
      setRows(r.recipients);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر جلبُ القائمة");
    }
  };
  const unseen = a.total - a.read - a.seen;

  return (
    <Card as="li" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-read font-black">{a.titleAr}</p>
          <p className="mt-1 text-read text-muted-foreground">أُرسل في {fmtDateTimeAr(a.sentAt)} إلى {trainersAr(a.total)}</p>
        </div>
        <Button size="sm" tone="secondary" aria-expanded={open} onClick={() => void toggle()}
          icon={open ? ChevronUp : ChevronDown}>
          من قرأ ومن لم يقرأ
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-read">
        <span className="font-black text-teal-light-ink">قرأه {a.read} من {a.total}</span>
        {a.seen > 0 && <span className="text-gold-ink">رآه ولم يؤكّد: {a.seen}</span>}
        {unseen > 0 && <span className="text-muted-foreground">لم يفتح بوّابتَه بعد: {unseen}</span>}
      </div>
      {open && (
        <div className="mt-3">
          {error && <p role="alert" className="text-read font-bold text-danger-ink">{error}</p>}
          {!rows && !error && <p className="text-read text-muted-foreground">يُحمَّل…</p>}
          {rows && rows.length > 8 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المدرّب أو بريده"
              aria-label="ابحث في من أُرسل إليه الإعلان" className={`${field} mb-2 max-w-sm`} />
          )}
          {rows && (
            <ul className="divide-y divide-white/5">
              {rows.filter((r) => matchesQuery(q, [r.name ?? "", r.email])).map((r) => {
                const st = recipientState(r);
                return (
                  <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="text-read font-bold">{r.name ?? r.email}</span>{" "}
                      <span className="text-fine text-muted-foreground" dir="ltr">{r.email}</span>
                    </span>
                    <span className={`text-fine font-bold ${STATE_TONE[st]}`}>
                      {RECIPIENT_STATE_AR[st]}
                      {st === "read" && r.readAt ? ` · ${fmtDateTimeAr(r.readAt)}` : ""}
                      {st === "seen" && r.seenAt ? ` · رآه ${fmtDateTimeAr(r.seenAt)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export default function TrainerAnnouncements() {
  const { user } = useRealSession();
  const canAnnounce = user?.permissions.includes("staff.notify") ?? false;
  const [data, setData] = useState<{ audience: number; items: SentAnnouncement[] } | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(ANNOUNCEMENT_DRAFT.titleAr);
  const [body, setBody] = useState<string>(ANNOUNCEMENT_DRAFT.bodyAr);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ title: string; recipients: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ audience: number; items: SentAnnouncement[] }>("/api/admin/trainer-announcements");
      setData(r);
      setOffline(null);
      /* والنصُّ المقترحُ لمرّةٍ واحدة: إن أُرسل بعنوانه فلا يُعرض ثانيةً كأنّه لم يُرسَل —
         ما لم يُمسّ منه حرفٌ في النموذج يُفرَغ، وما عُدّل يبقى كما كُتب */
      if (r.items.some((a) => a.titleAr === ANNOUNCEMENT_DRAFT.titleAr)) {
        setTitle((v) => (v === ANNOUNCEMENT_DRAFT.titleAr ? "" : v));
        setBody((v) => (v === ANNOUNCEMENT_DRAFT.bodyAr ? "" : v));
      }
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const t = title.trim();
  const b = body.trim();
  const ready = t.length >= 3 && b.length >= 10 && t.length <= ANNOUNCEMENT_TITLE_MAX && b.length <= ANNOUNCEMENT_BODY_MAX;
  const audience = data?.audience ?? null;
  const sameTitle = data?.items.find((a) => a.titleAr === t) ?? null;

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      const r = await apiPost<{ id: string; recipients: number }>("/api/admin/trainer-announcements", { titleAr: t, bodyAr: b });
      setSent({ title: t, recipients: r.recipients });
      setAsking(false);
      setTitle("");
      setBody("");
      await load();
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : "لم يُرسَل — تحقّق من اتّصالك وأعِد المحاولة");
    } finally {
      setSending(false);
    }
  };

  if (offline) {
    return (
      <AdminLayout title="إعلاناتٌ للمدرّبين">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-read leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إعلاناتٌ للمدرّبين">
      <p className="mb-4 max-w-3xl text-read leading-7 text-muted-foreground">
        إعلانٌ يصل كلَّ مدرّبٍ نشط: نافذةٌ في بوّابته حين يفتحها حتّى يضغط «قرأتُه» — ويستطيع أن يؤجّلها فلا تمنعه من عمله —
        وإشعارٌ في جرسه. ولا بريد. وتحت كلِّ ما أُرسل: من قرأ، ومن رآه ولم يؤكّد، ومن لم يفتح بوّابتَه بعد.
      </p>

      {sent && (
        <Inset tone="positive" role="status" className="mb-4 px-4 py-3 text-read">
          أُرسل «{sent.title}» إلى {trainersAr(sent.recipients)}. تابِع من قرأه في «ما أُرسل» أدناه.
        </Inset>
      )}

      {canAnnounce && (
        <Panel as="section" aria-labelledby="new-announcement">
          <h2 id="new-announcement" className="flex items-center gap-2 text-sm font-black">
            <Megaphone className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> إعلانٌ جديد
          </h2>
          <p className="mt-1 text-read text-muted-foreground">
            {title === ANNOUNCEMENT_DRAFT.titleAr
              ? "فيه النصُّ المقترحُ عن موعد بدء الشُّعب — عدّل فيه ما شئت، أو امسحه واكتب غيرَه."
              : "اكتب العنوانَ والنصّ، وتراه تحتهما كما سيراه المدرّب."}
          </p>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-fine font-bold text-muted-foreground">
              العنوان
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ANNOUNCEMENT_TITLE_MAX}
                aria-label="عنوانُ الإعلان" className={field} />
            </label>
            <label className="grid gap-1 text-fine font-bold text-muted-foreground">
              النصّ — سطرٌ فارغٌ بين الفقرات
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={ANNOUNCEMENT_BODY_MAX}
                aria-label="نصُّ الإعلان" className={`${field} leading-7`} />
            </label>
            <p className="text-read text-muted-foreground">{b.length} / {ANNOUNCEMENT_BODY_MAX} حرفا</p>
          </div>

          {(t || b) && (
            <div className="mt-4">
              <p className="text-read font-bold text-muted-foreground">هكذا يراه المدرّب في نافذته:</p>
              <Inset tone="solid" className="mt-2 sm:p-6">
                <p className="flex items-center gap-2 text-read font-bold text-teal-light-ink">
                  <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" /> من إدارة الأكاديمية
                </p>
                <p className="mt-2 text-lg font-black leading-8">{t || "—"}</p>
                <div className="mt-4"><Body text={b} /></div>
                <p className="mt-6 text-read text-muted-foreground">وتحته زرّان: «قرأتُه» و«ذكّرني لاحقا».</p>
              </Inset>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button tone="primary" icon={Send} disabled={!ready || !audience} onClick={() => { setSendError(null); setAsking(true); }}>
              أرسِل…
            </Button>
            <p className="text-read text-muted-foreground">
              {audience === null ? "يُحسب من يصله…"
                : audience === 0 ? "لا مدرّبَ نشطا يصله الآن."
                : `يصله الآن ${trainersAr(audience)} — كلُّ مدرّبٍ نشطٍ له بوّابة.`}
            </p>
          </div>
        </Panel>
      )}

      <Panel as="section" aria-labelledby="sent-announcements" className="mt-6">
        <h2 id="sent-announcements" className="text-sm font-black">ما أُرسل</h2>
        {!data && <p className="mt-3 text-read text-muted-foreground">يُحمَّل…</p>}
        {data?.items.length === 0 && (
          <p className="mt-3 text-read text-muted-foreground">لم يُرسَل إعلانٌ بعد — ما ترسله يظهر هنا ومعه من قرأه.</p>
        )}
        {data && data.items.length > 0 && (
          <ul className="mt-3 grid gap-3">
            {data.items.map((a) => <SentRow key={a.id} a={a} />)}
          </ul>
        )}
      </Panel>

      {asking && audience !== null && (
        <Modal onClose={() => setAsking(false)} label="أترسل الإعلانَ الآن؟" panelClassName="w-full max-w-lg">
          <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
            <h2 className="text-sm font-black">أترسل «{t}» الآن إلى {trainersAr(audience)}؟</h2>
            {sameTitle && (
              <p className="mt-2 text-read leading-6 text-gold-ink">
                أرسلتَ إعلانا بهذا العنوان في {fmtDateTimeAr(sameTitle.sentAt)}، وقرأه {sameTitle.read} من {sameTitle.total}.
                إرسالُه ثانيةً يُظهره لهم من جديد.
              </p>
            )}
            <div className="mt-4 grid gap-3">
              <div>
                <Button tone="confirm" loading={sending} onClick={() => void send()}>أرسِله الآن</Button>
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  يصل الآن: نافذةٌ في بوّابة كلٍّ منهم حين يفتحها، وإشعارٌ في جرسه. ولا يُسحب بعد أن يُرسَل.
                </p>
              </div>
              <div>
                <Button tone="secondary" disabled={sending} onClick={() => setAsking(false)}>ليس الآن</Button>
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  لا يصل أحدا، ويبقى النصُّ هنا كما كتبتَه.
                </p>
              </div>
            </div>
            {sendError && <p role="alert" className="mt-3 text-read font-bold text-danger-ink">{sendError}</p>}
          </Inset>
        </Modal>
      )}
    </AdminLayout>
  );
}
