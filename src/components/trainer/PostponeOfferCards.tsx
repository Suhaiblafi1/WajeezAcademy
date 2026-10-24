/* ═══ اقتراحُ تأجيل شعبته — بطاقةُ «قبل/بعد» يقبلها أو لا (٢٤ أكتوبر ٢٠٢٦) ═══

   قاعدةُ المستودَع: ما يُطلب من المدرّب بطاقةٌ جاهزةٌ يقبلها أو يرفضها، لا طلبٌ يعمله بنفسه. فالبطاقةُ تقول أوّلَ
   لقاءٍ الآن وبعد التأجيل، والسببَ، والمهلةَ، وما يقع بكلّ خيار — ثمّ زرّان. وعدمُ القبول يوقف الشعبة، فيُسأل مرّةً
   ثانيةً قبل أن يقع. والأثرُ في `server/services/cohort-postpone.service.ts`.

   وفي رأس «شعبي» لا في بطاقة الشعبة: شعبةُ الإعداد تُرى في «دوراتي» لا هنا (`board-place.ts`)، والجرسُ يفتح هذه
   الصفحة — فلا يصل إليها ولا يجد ما جاء له. */

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateTimeAr, untilLabelAr } from "@/utils/format";

interface Offer {
  id: string; cohortId: string; title: string; reasonAr: string;
  fromFirstAt: string; toFirstAt: string; deadlineAt: string;
}

export default function PostponeOfferCards({ onDecided }: { onDecided: () => void }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Offer[]>("/api/trainer/cohort-postpones").then(setOffers).catch(() => setOffers([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (o: Offer, action: "accept" | "decline") => {
    setBusy(true); setErr(null);
    try {
      await apiPost(`/api/trainer/cohort-postpones/${o.id}/decide`, { action });
      setDone(action === "accept"
        ? `أجلنا «${o.title}» — أول لقاء فيها ${fmtDateTimeAr(o.toFirstAt)}.`
        : `أوقفنا «${o.title}»، ووصل متعلميها الخبر.`);
      setAsking(null);
      load(); onDecided();
    } catch (e) {
      setErr({ id: o.id, text: e instanceof ApiError ? e.message : "تعذر الإرسال — حاول مجددا" });
    } finally {
      setBusy(false);
    }
  };

  if (offers.length === 0 && !done) return null;

  return (
    <div className="mb-5 space-y-3">
      {done && <Panel as="p" tone="positive" role="status" className="text-read font-bold">{done}</Panel>}
      {offers.map((o) => (
        <Panel key={o.id} as="section" tone="warn" aria-labelledby={`postpone-${o.id}`}>
          <h2 id={`postpone-${o.id}`} className="flex items-center gap-2 font-black">
            <CalendarClock className="h-4 w-4 text-gold-ink" aria-hidden="true" />
            نقترح تأجيل «{o.title}»
          </h2>
          <p className="mt-1 text-read text-muted-foreground">السبب: {o.reasonAr}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Inset>
              <p className="text-read text-muted-foreground">أول لقاء الآن</p>
              <p className="font-bold line-through decoration-white/40">{fmtDateTimeAr(o.fromFirstAt)}</p>
            </Inset>
            <Inset tone="accent">
              <p className="text-read text-muted-foreground">بعد التأجيل</p>
              <p className="font-black">{fmtDateTimeAr(o.toFirstAt)}</p>
            </Inset>
          </div>

          <ul className="mt-3 space-y-1 text-read">
            <li>نفس اليوم والساعة، وتتحرك كل مواعيد الشعبة معه.</li>
            <li>رد قبل <b>{fmtDateTimeAr(o.deadlineAt)}</b> <span className="text-muted-foreground">({untilLabelAr(o.deadlineAt)})</span>. إن لم ترد حتى هذا الموعد تتوقف الشعبة تلقائيا.</li>
          </ul>

          {err?.id === o.id && <p className="mt-2 text-read text-danger-ink" role="alert">{err.text}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {asking === o.id ? (
              <>
                <span className="text-read font-bold">تتوقف الشعبة الآن ولا تعقد لقاءاتها. متأكد؟</span>
                <Button tone="danger" loading={busy} onClick={() => void decide(o, "decline")}>نعم، أوقفوها</Button>
                <Button tone="secondary" disabled={busy} onClick={() => setAsking(null)}>تراجع</Button>
              </>
            ) : (
              <>
                <Button tone="primary" loading={busy} onClick={() => void decide(o, "accept")}>اقبل التأجيل</Button>
                <Button tone="secondary" disabled={busy} onClick={() => { setErr(null); setAsking(o.id); }}>لا أريد التأجيل</Button>
              </>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}
