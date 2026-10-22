/* لافتةُ مال الشعبة — الحدُّ الأدنى للمدرّب، وما حُصّل، وأغطّى أحدُهما الآخر (٢٢ أكتوبر ٢٠٢٦).

   «قرارُ الحذف يُبنى على: هل غطّينا أتعابَ المدرّب، وهي الحدُّ الأدنى من المقاعد الذي وعدناه به»
   (صاحب المنصّة). فثلاثةُ أرقامٍ لا غير، والحكمُ بكلمة: «مغطاة» أو «ينقص X». والأرقامُ من الخادم
   بمعادلة الكشف نفسِها (`cohort-economics.ts`).

   ونسختان: سطرٌ في قائمة «تبدأ قريبا»، وبطاقةٌ في «نظرة عامة» تقول معها ما يلزمنا لو ألغينا. */

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { apiGet } from "@/services/api";
import { Inset } from "@/components/ui/Surface";

export interface CohortMoneyView {
  minimum: number | null;
  minimumBasisAr: string | null;
  costIfRun: number | null;
  collected: number;
  margin: number | null;
  verdict: "covered" | "short" | "no_trainer" | "no_rule";
  started: boolean;
  currency: string;
  trainerName: string | null;
  enrolled: number;
  counted: number;
}

const money = (n: number, cur: string) => `${Number.isInteger(n) ? n : n.toFixed(2)} ${cur}`;

/** الحكمُ بكلمة — ونبرتُها */
function verdictAr(m: CohortMoneyView): { label: string; tone: "ok" | "warn" | "muted" } {
  if (m.verdict === "no_trainer") return { label: "بلا مدرب — لا كلفة", tone: "muted" };
  if (m.verdict === "no_rule") return { label: "لا أجر محدد للمدرب", tone: "warn" };
  if (m.verdict === "covered") return { label: "مغطاة", tone: "ok" };
  return { label: `ينقص ${money(Math.abs(m.margin ?? 0), m.currency)}`, tone: "warn" };
}

const TONE_CLS = {
  ok: "border-teal/50 text-teal-light-ink",
  warn: "border-gold/50 text-gold-ink",
  muted: "border-white/20 text-muted-foreground",
};

export function VerdictChip({ m }: { m: CohortMoneyView }) {
  const v = verdictAr(m);
  return <span className={`rounded-full border px-3 py-1 text-fine font-bold ${TONE_CLS[v.tone]}`}>{v.label}</span>;
}

/** السطرُ المختصر — للقائمة */
export function CohortMoneyLine({ m }: { m: CohortMoneyView }) {
  return (
    <span className="text-read text-muted-foreground">
      الحد الأدنى للمدرب: <b className="text-foreground">{m.minimum === null ? "—" : money(m.minimum, m.currency)}</b>
      {" · "}حصلنا: <b className="text-foreground">{money(m.collected, m.currency)}</b>
    </span>
  );
}

/** البطاقةُ الكاملة — لنظرة الشعبة العامّة */
export default function CohortMoney({ cohortId, refresh }: { cohortId: string; refresh?: string }) {
  const [m, setM] = useState<CohortMoneyView | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    apiGet<CohortMoneyView>(`/api/admin/cohorts/${cohortId}/economics`)
      .then((r) => { if (alive) { setM(r); setErr(""); } })
      .catch(() => { if (alive) setErr("تعذر حساب مال الشعبة"); });
    return () => { alive = false; };
  }, [cohortId, refresh]);

  if (err) return <p className="text-read text-muted-foreground">{err}</p>;
  if (!m) return null;
  return (
    <Inset className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-read font-black text-foreground">
          <Wallet className="h-3.5 w-3.5 text-teal-ink" /> المال
        </p>
        <VerdictChip m={m} />
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-fine text-muted-foreground">الحد الأدنى للمدرب</dt>
          <dd className="mt-0.5 text-sm font-black">{m.minimum === null ? "—" : money(m.minimum, m.currency)}</dd>
          {m.minimumBasisAr && <dd className="text-fine text-muted-foreground">{m.minimumBasisAr}</dd>}
        </div>
        <div>
          <dt className="text-fine text-muted-foreground">لو انعقدت الآن ندفع له</dt>
          <dd className="mt-0.5 text-sm font-black">{m.costIfRun === null ? "—" : money(m.costIfRun, m.currency)}</dd>
          <dd className="text-fine text-muted-foreground">{m.counted} مقعدا يحتسب له</dd>
        </div>
        <div>
          <dt className="text-fine text-muted-foreground">حصلنا</dt>
          <dd className="mt-0.5 text-sm font-black">{money(m.collected, m.currency)}</dd>
          <dd className="text-fine text-muted-foreground">بعد الخصم وما رد</dd>
        </div>
      </dl>
      <p className="mt-3 text-read leading-6 text-muted-foreground">
        {m.started
          ? "بدأت الشعبة — حق المدرب قائم ولو ألغيتها الآن."
          : "لم تبدأ بعد — إلغاؤها الآن لا يلزمنا للمدرب بشيء. ومن دفع من المتعلمين يراسل الدعم للرد أو النقل."}
      </p>
    </Inset>
  );
}
