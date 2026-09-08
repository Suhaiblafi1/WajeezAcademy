import { useCallback, useEffect, useState } from "react";
import { Banknote, CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateAr } from "@/utils/format";

import { Panel, Card } from "@/components/ui/Surface";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
const PAYOUT_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock3 }> = {
  pending: { label: "بانتظار الاعتماد", cls: "border-gold/40 text-gold-ink", icon: Clock3 },
  approved: { label: "معتمد — قيد الصرف", cls: "border-teal/40 text-teal-light-ink", icon: ShieldCheck },
  paid: { label: "مدفوع", cls: "border-emerald-400/40 text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "ملغى", cls: "border-white/20 text-muted-foreground", icon: XCircle },
};

interface RealPayout {
  id: string; period: string; status: string; total: string | number; currency: string;
  paidAt?: string | null;
  items: { id: string; description: string; amount: string | number; sourceRef?: string | null }[];
}
interface Rule {
  id: string; type: string; rate: string | number; currency: string; minSeats: number;
  courseId: string | null; cohortId: string | null; effectiveFrom: string; effectiveTo: string | null;
}
interface RealEarnings {
  payouts: RealPayout[];
  summary: { pending: number; approved: number; paid: number; currency: string };
  /* الاتفاقُ نفسُه — كان الكشفُ وحدَه يصل، فيقرأ المدرّبُ رقما لا يعرف أساسَه */
  agreement: Rule | null;
  rules: Rule[];
}

const fmt = (n: string | number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** كشف مستحقات حقيقي من الخادم — للمدرب المسجل بحساب فعلي */
function RealEarningsView() {
  const [data, setData] = useState<RealEarnings | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setData(await apiGet<RealEarnings>("/api/trainer/earnings")); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذر تحميل المستحقات"); }
  }, []);
  /* استدعاء غير متزامن: لا setState يجري قبل أول await، فالتصيير
     المتتالي الذي تحذّر منه القاعدة لا يقع هنا. القاعدة لا ترى عبر
     الحدّ غير المتزامن فتَعُدّ كل دالة تنتهي بـsetState متزامنة. */
  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState بعد await لا قبله
  useEffect(() => { void load(); }, [load]);

  if (err) {
    return (
      <TrainerLayout title="مستحقاتي">
        <Card as="p" tone="danger" className="text-center text-sm font-bold text-red-300" role="alert">{err}</Card>
      </TrainerLayout>
    );
  }
  if (!data) {
    return (
      <TrainerLayout title="مستحقاتي">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      </TrainerLayout>
    );
  }

  const { summary, payouts, agreement, rules } = data;
  const scoped = (rules ?? []).filter((r) => (r.cohortId || r.courseId) && !r.effectiveTo);
  return (
    <TrainerLayout title="مستحقاتي — كشف مبسط وشفاف">
      {/* ═══ اتفاقُك المسبق — قبل أيّ رقم ═══

          كانت الصفحةُ تعرض ما قُبض وما يُنتظر ولا تعرض على أيّ أساس. والاتفاقُ
          الذي أكّدته الإدارةُ حقُّ المدرّب أن يراه قبل أن يُحسب له شيء —
          وإلّا فكيف يتأكّد أنّ ما وصله هو ما اتُّفق عليه. */}
      <Panel as="section" tone="accent" className="mb-6">
        <p className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-teal-light-ink" /> اتفاقُك المسبق</p>
        {agreement ? (
          <>
            <p className="mt-2 text-lg font-black text-foreground">
              {RULE_TYPE_AR[agreement.type] ?? agreement.type} — <span dir="ltr" className="font-mono">{Number(agreement.rate)}</span> {agreement.currency}
              {agreement.type === "per_seat" && " عن كلّ متعلّم"}
              {agreement.type === "revenue_share" && " من إيراد الشعبة"}
            </p>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              {agreement.minSeats > 0 && <>يُحسب لك {agreement.minSeats} مقاعدَ على الأقلّ ولو سجّل أقلّ. </>}
              ساريةٌ منذ {fmtDateAr(agreement.effectiveFrom)}. وكلُّ كشفٍ أدناه يُحسب على هذا الأساس — فإن رأيت غيرَه فقل لنا.
            </p>
            {scoped.length > 0 && (
              <ul className="mt-3 space-y-1 text-read text-muted-foreground">
                {scoped.map((r) => (
                  <li key={r.id}>· اتفاقٌ خاصٌّ {r.cohortId ? "بشعبةٍ بعينها" : "بدورةٍ بعينها"}: {RULE_TYPE_AR[r.type] ?? r.type} — <span dir="ltr" className="font-mono">{Number(r.rate)}</span> {r.currency}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            لم تُسجَّل قاعدةُ أتعابٍ لك بعد — تحدّدها الإدارةُ قبل أوّل شعبة، وتظهر هنا فورَ حفظها. ولا يُحسب لك كشفٌ قبلها.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-3 gap-4">
        <Card tone="warn">
          <p className="text-read text-gold-ink">بانتظار الاعتماد</p>
          <p className="mt-2 text-2xl font-black text-gold-ink">{fmt(summary.pending)} <span className="text-xs">{summary.currency}</span></p>
        </Card>
        <Card tone="accent">
          <p className="text-read text-teal-light-ink">معتمدة للصرف</p>
          <p className="mt-2 text-2xl font-black text-teal-light-ink">{fmt(summary.approved)} <span className="text-xs">{summary.currency}</span></p>
        </Card>
        <Card>
          <p className="text-read text-muted-foreground">مدفوعة</p>
          <p className="mt-2 text-2xl font-black text-foreground">{fmt(summary.paid)} <span className="text-xs">{summary.currency}</span></p>
        </Card>
      </div>

      <div className="mt-6 space-y-3">
        {payouts.length === 0 && (
          <Panel className="grid place-items-center py-16 text-center">
            <Banknote className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
              لا كشوف بعد — عند اعتماد أول مستحقات لك من الإدارة المالية تظهر هنا تلقائياً ببنودها وحالتها.
            </p>
          </Panel>
        )}
        {payouts.map((p) => {
          const meta = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.pending;
          return (
            <Panel key={p.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">كشف فترة <span dir="ltr" className="font-mono text-sm">{p.period}</span></p>
                  {p.paidAt && <p className="mt-0.5 text-read text-muted-foreground">صُرف {fmtDateAr(p.paidAt)}</p>}
                </div>
                <div className="text-left">
                  <p className="text-xl font-black">{fmt(p.total)} <span className="text-xs text-muted-foreground">{p.currency}</span></p>
                  <p className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-fine font-bold ${meta.cls}`}>
                    <meta.icon className="h-3 w-3" /> {meta.label}
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
                {p.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 text-read text-muted-foreground">
                    <span>{i.description}</span>
                    <span dir="ltr" className="font-mono font-bold text-foreground">{fmt(i.amount)} {p.currency}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>

      <Card as="p" className="mt-8 px-5 py-4 text-center text-read leading-6 text-muted-foreground">
        الكشف يمر بثلاث مراحل: إنشاء من الإدارة المالية ← اعتماد ← صرف. كل بند مرتبط بمصدره لمنع الازدواج —
        ولأي استفسار عن بند تواصل مع منسقك قبل موعد الصرف.
      </Card>
    </TrainerLayout>
  );
}

/** مستحقات المدرب — جلسة حقيقية: من الخادم مباشرة. بلا جلسة (ديمو محلي): البيانات التوضيحية المحلية */
/* حُذف `DemoEarningsView`: مستحقاتٌ ومبالغُ وحالاتُ صرفٍ مولَّدة في المتصفّح
   وتُعرض للمدرّب كأنها مستحقاته. */
export default function Earnings() {
  return <RealEarningsView />;
}
