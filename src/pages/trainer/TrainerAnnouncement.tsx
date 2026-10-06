/* ═══ نافذةُ إعلان الإدارة في بوّابة المدرّب (٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا». فالنافذةُ
   تظهر في أيّ شاشةٍ من بوّابته (`TrainerLayout`) حتّى يضغط «قرأتُه»، وفيها خياران
   وما يقع بكلٍّ منهما مكتوبٌ تحتهما — لا زرٌّ واحدٌ يُلزمه:

   · **«قرأتُه»** — يُعلم الإدارةَ أنّه وصله (`readAt`)، ولا تعود.
   · **«ذكّرني لاحقا»** — تُغلق الآن وتعود في زيارته التالية (جلسةُ المتصفّح،
     `laterKey`). وكذلك Escape والنقرُ خارجها: إغلاقٌ لا قراءة.

   ومن فتحها من الجرس (`?announcement=`) رآها ولو قرأها من قبل، ومعها متى قرأها.
   وما يُختار عرضُه في `announcementToShow`، والعلّةُ كاملةً في
   `server/services/trainer-announcement.service.ts`. */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Megaphone } from "lucide-react";
import Modal from "@/components/Modal";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import AnnouncementBody from "@/components/AnnouncementBody";
import { apiGet, apiPost } from "@/services/api";
import { fmtDateAr, fmtDateTimeAr } from "@/utils/format";
import { announcementToShow, laterKey } from "@/application/trainer/announcement";

/** إعلانٌ كما يردّه `GET /api/trainer/announcements` */
interface Announcement {
  id: string;
  titleAr: string;
  bodyAr: string;
  sentAt: string;
  seenAt: string | null;
  readAt: string | null;
}

/* «ذكّرني لاحقا» في جلسة المتصفّح — والتخزينُ قد يُمنع (نافذةٌ خاصّة)، فتعود
   النافذةُ في الشاشة التالية: إزعاجٌ صغيرٌ خيرٌ من إعلانٍ لا يُقرأ */
function deferredInSession(id: string): boolean {
  try { return window.sessionStorage.getItem(laterKey(id)) === "1"; } catch { return false; }
}
function deferInSession(id: string) {
  try { window.sessionStorage.setItem(laterKey(id), "1"); } catch { /* يبقى الإغلاقُ لهذه الشاشة وحدَها */ }
}

export default function TrainerAnnouncement() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const asked = params.get("announcement");

  /* ويُعاد الجلبُ حين يُطلب إعلانٌ من الجرس: قد يكون أُرسل بعد أن فُتحت الشاشة */
  useEffect(() => {
    let alive = true;
    void apiGet<Announcement[]>("/api/trainer/announcements")
      .then((r) => { if (alive) setItems(r); })
      .catch(() => { /* لا نافذةَ خيرٌ من نافذةٍ تسقط — والإعلانُ في الجرس كذلك */ });
    return () => { alive = false };
  }, [asked]);

  const shown = items
    ? announcementToShow(items, {
      wanted: asked && !closed.has(asked) ? asked : null,
      deferred: (id) => closed.has(id) || deferredInSession(id),
    })
    : null;

  /* ظهرت له — يُكتب أوّلَ مرّة، فتفرّق القائمةُ عند الإدارة «رآه ولم يؤكّد» عمّن لم يفتح بوّابتَه */
  const seenTarget = shown && !shown.readAt && !shown.seenAt ? shown.id : null;
  useEffect(() => {
    if (!seenTarget) return;
    void apiPost(`/api/trainer/announcements/${seenTarget}/seen`).catch(() => undefined);
  }, [seenTarget]);

  if (!shown) return null;

  const close = () => {
    setClosed((s) => new Set(s).add(shown.id));
    if (asked) {
      const next = new URLSearchParams(params);
      next.delete("announcement");
      setParams(next, { replace: true });
    }
  };
  const later = () => {
    if (!shown.readAt) deferInSession(shown.id);
    close();
  };
  const confirmRead = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ readAt: string }>(`/api/trainer/announcements/${shown.id}/read`);
      setItems((prev) => prev?.map((a) => (a.id === shown.id ? { ...a, readAt: r.readAt } : a)) ?? null);
      close();
    } catch {
      setError("لم يُحفظ «قرأتُه» — تحقّق من اتّصالك وأعِد المحاولة، أو اختر «ذكّرني لاحقا» فتعود لك.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={later} label={shown.titleAr} panelClassName="w-full max-w-xl">
      <Inset dir="rtl" tone="solid" className="max-h-[86vh] overflow-y-auto text-foreground sm:p-6">
        <p className="flex items-center gap-2 text-fine font-bold text-teal-light-ink">
          <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          من إدارة الأكاديمية · {fmtDateAr(shown.sentAt)}
        </p>
        <h2 className="mt-2 text-lg font-black leading-8">{shown.titleAr}</h2>
        {/* وروابطُه تُضغط — ويُفتح كلٌّ في لسانٍ آخر، فتبقى النافذةُ حتّى «قرأتُه» */}
        <AnnouncementBody text={shown.bodyAr} className="mt-4" />
        {error && <p role="alert" className="mt-4 text-read font-bold text-danger-ink">{error}</p>}
        {shown.readAt ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-read text-muted-foreground">قرأتَه في {fmtDateTimeAr(shown.readAt)}.</p>
            <Button tone="secondary" onClick={close}>أغلِق</Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Button tone="confirm" loading={busy} onClick={() => void confirmRead()}>قرأتُه</Button>
              <Button tone="secondary" disabled={busy} onClick={later}>ذكّرني لاحقا</Button>
            </div>
            <p className="text-read leading-6 text-muted-foreground">
              «قرأتُه» يُعلم الإدارةَ أنّه وصلك فلا يعود. و«ذكّرني لاحقا» يغلقه الآن ويعود في زيارتك التالية —
              ولا يتوقّف شيءٌ في عملك بأيٍّ منهما.
            </p>
          </div>
        )}
      </Inset>
    </Modal>
  );
}
