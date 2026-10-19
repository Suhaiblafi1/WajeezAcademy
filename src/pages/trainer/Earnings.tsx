import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Banknote, CheckCircle2, Clock3, Loader2, ShieldCheck, TicketPercent, XCircle } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import MyContract from "./MyContract";
import Referral from "./Referral";
import TabBar from "@/components/ui/TabBar";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateAr } from "@/utils/format";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import BankAccountPanel from "@/components/BankAccountPanel";
import { BANK_COPY } from "@/application/bank/panel-copy";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
import { payoutTimingNoteAr } from "@/application/trainer/notice-periods";
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
  id: string; type: string; rate: string | number; currency: string; minSeats: number; referralRate?: string | number | null;
  courseId: string | null; cohortId: string | null; effectiveFrom: string; effectiveTo: string | null;
}
interface RealEarnings {
  payouts: RealPayout[];
  summary: { pending: number; approved: number; paid: number; currency: string };
  /* الاتفاقُ نفسُه — كان الكشفُ وحدَه يصل، فيقرأ المدرّبُ رقما لا يعرف أساسَه */
  agreement: Rule | null;
  rules: Rule[];
  /* شعبةً شعبة: كم عامّا وكم عبر رابطك وبأيّ أجر — قبل أن يُولَّد الكشف */
  cohorts: { cohortId: string; title: string; status: string; general: number; referred: number; rate: number | null; referralRate: number | null; currency: string; ruleType: string | null; projected: number | null }[];
  /* وما أصدره هو من خصومٍ واستُعمل ولم يُحسم بعد — البند 4-10 */
  awaitingDiscounts: {
    total: number; currency: string;
    rows: { id: string; code: string; amount: number; currency: string; forWhomAr: string; usedAt: string | null }[];
    /** ما يُعاد إليه — شراءٌ بكوده رُدّ ثمنُه بعد أن حُسم */
    credits?: { id: string; code: string; amount: number; currency: string; forWhomAr: string; refundedAt: string | null }[];
  };
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
      <>
        <Card as="p" tone="danger" className="text-center text-sm font-bold text-red-300" role="alert">{err}</Card>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      </>
    );
  }

  const { summary, payouts, agreement, rules, cohorts, awaitingDiscounts } = data;
  const scoped = (rules ?? []).filter((r) => (r.cohortId || r.courseId) && !r.effectiveTo);
  return (
    <>
      {/* ═══ اتفاقُك المسبق — قبل أيّ رقم ═══

          كانت الصفحةُ تعرض ما قُبض وما يُنتظر ولا تعرض على أيّ أساس. والاتفاقُ
          الذي أكّدته الإدارةُ حقُّ المدرّب أن يراه قبل أن يُحسب له شيء —
          وإلّا فكيف يتأكّد أنّ ما وصله هو ما اتُّفق عليه. */}
      <Panel as="section" tone="accent" className="mb-6">
        <p className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-teal-light-ink" /> اتفاقك المسبق</p>
        {agreement ? (
          <>
            {/* ═══ والعامُّ أوّلا ثمّ ما عبر رابطك (٢٩ سبتمبر ٢٠٢٦) ═══

                كان «الأعلى أوّلا» بقرار ٢١ سبتمبر: سعرُ الرابط يتصدّر. ثمّ
                قال صاحبُ المنصّة: «اجعل عمودَ السعر العامّ أوّلا ومن رابطه»
                — فعاد العامُّ إلى الصدر هنا وفي جدول الشعب أدناه معا، كي لا
                يُقرأ الترتيبُ في موضعٍ ويُقرأ عكسُه في الآخر. */}
            <p className="mt-2 text-lg font-black text-foreground">
              {RULE_TYPE_AR[agreement.type] ?? agreement.type} —{" "}
              {agreement.type === "per_seat" && agreement.referralRate != null ? (
                <>
                  <span dir="ltr" className="font-mono">{Number(agreement.rate)}</span> {agreement.currency} عن كلّ متعلّم عامّ
                  {" · و"}<span dir="ltr" className="font-mono">{Number(agreement.referralRate)}</span> {agreement.currency} عن كلّ متعلّم جاء عبر رابطك
                </>
              ) : (
                <>
                  <span dir="ltr" className="font-mono">{Number(agreement.rate)}</span> {agreement.currency}
                  {agreement.type === "per_seat" && " عن كلّ متعلّم عامّ"}
                  {agreement.type === "revenue_share" && " من إيراد الشعبة"}
                </>
              )}
            </p>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              {agreement.minSeats > 0 && <>يحسب لك {agreement.minSeats} مقاعد على الأقلّ ولو سجّل أقلّ. </>}
              سارية منذ {fmtDateAr(agreement.effectiveFrom)}، وعليها تحسب كشوفك.
            </p>
            {scoped.length > 0 && (
              <ul className="mt-3 space-y-1 text-read text-muted-foreground">
                {scoped.map((r) => (
                  <li key={r.id}>· اتفاق خاصّ {r.cohortId ? "بشعبة بعينها" : "بدورة بعينها"}: {RULE_TYPE_AR[r.type] ?? r.type} — <span dir="ltr" className="font-mono">{Number(r.rate)}</span> {r.currency}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            لم تحدّد الإدارة أتعابك بعد، ولا يحسب كشف قبلها.
          </p>
        )}
      </Panel>

      {/* ═══ ووصلةُ «عقدي» ذهبت من هنا (٢٩ سبتمبر ٢٠٢٦) ═══

          كان هنا سطرٌ يدلّ على النسخة الموقَّعة. وقال صاحبُ المنصّة: «لا
          داعيَ لوجود العقد هنا لأنّ لديّ قسما للعقد» — و«عقدي» بندٌ في
          القائمة بجوار «مستحقّاتي» مباشرةً، فالسطرُ تكرارٌ لا دلالة. */}
      <BankAccountPanel endpoint="/api/trainer/bank-account" copy={BANK_COPY.trainer} />

      {/* ═══ شعبةً شعبة — من أين جاء طلابك وماذا يُحسب لك عنهم ═══ */}
      {(cohorts ?? []).length > 0 && (
        <Panel as="section" className="mb-6">
          <p className="text-sm font-black">شعبك — عامّ وعبر رابطك</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-read">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="pb-2 pl-3 font-bold">الشعبة</th>
                  {/* العامُّ أوّلا ثمّ عبر رابطك — بالقرار نفسِه (٢٩ سبتمبر ٢٠٢٦) */}
                  <th className="pb-2 pl-3 font-bold">عامّ</th>
                  <th className="pb-2 pl-3 font-bold">عبر رابطك</th>
                  <th className="pb-2 font-bold">المتوقّع</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohortId} className="border-t border-white/10">
                    <td className="py-2 pl-3 font-bold">{c.title}</td>
                    <td className="py-2 pl-3 tabular-nums">{c.general}{c.rate != null && <span className="text-muted-foreground"> × {c.rate}</span>}</td>
                    <td className="py-2 pl-3 tabular-nums">{c.referred}{c.referralRate != null && <span className="text-muted-foreground"> × {c.referralRate}</span>}</td>
                    <td className="py-2 tabular-nums" dir="ltr">{c.projected == null ? "—" : `${fmt(c.projected)} ${c.currency}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ═══ وخصومٌ أصدرتَها أنت تنتظر الحسم — البند 4-10 ═══

          تُقال هنا قبل أن تقع: الحسمُ يجري في «أوّل كشفٍ يُحرَّر بعد ذلك»،
          فمن لم يرَ ما ينتظره فُوجئ برقمٍ أصغرَ ممّا حسب. وهي أخت اللوحات
          التي قبلها: هذه الصفحةُ تقول الأساسَ قبل الرقم، وهذا رقمٌ سالبٌ
          فيلزمه أساسُه أكثر.

          ولا تُعرض حين لا شيءَ ينتظر: لوحةٌ بصفرٍ تُعلّم القارئَ تخطّيها. */}
      {(awaitingDiscounts?.rows.length ?? 0) > 0 && (
        <Panel as="section" tone="warn" className="mb-6">
          <p className="text-sm font-black text-gold-ink">أكواد وخصوم أصدرتها بنفسك — تحسم من كشفك القادم</p>
          <p className="mt-2 text-read leading-7 text-muted-foreground">
            ما منحته أكوادك وخصومك في مشتريات مدفوعة، يحسم من أوّل كشف لك. ولا يتجاوز الحسم قيمة
            الكشف، وما زاد يؤجّل إلى الذي يليه (البند 4-10).
          </p>
          <ul className="mt-3 space-y-1.5">
            {awaitingDiscounts.rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 text-read text-muted-foreground">
                <span>{d.forWhomAr} <span dir="ltr" className="font-mono text-fine">({d.code})</span>{d.usedAt && <> · استعمل {fmtDateAr(d.usedAt)}</>}</span>
                <span dir="ltr" className="font-mono font-bold text-gold-ink">−{fmt(d.amount)} {d.currency}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-read font-bold text-gold-ink">
            المجموع المنتظر حسمه: <span dir="ltr" className="font-mono">{fmt(awaitingDiscounts.total)}</span> {awaitingDiscounts.currency}
          </p>
        </Panel>
      )}

      {/* ═══ وما يُعاد إليك — شراءٌ رُدّ ثمنُه بعد أن حُسم ما منحه كودُك ═══

          البند 4-10 بصيغته الجديدة: «وما حسم زيادة على ذلك أعيد إلى المدرب في
          الكشف الذي يليه». فيُقال قبل أن يقع — كما يُقال الحسمُ قبل أن يقع —
          ولا تُعرض اللوحةُ حين لا شيءَ يُعاد. */}
      {(awaitingDiscounts?.credits?.length ?? 0) > 0 && (
        <Panel as="section" tone="accent" className="mb-6">
          <p className="text-sm font-black text-teal-light-ink">يعاد إليك في كشفك القادم</p>
          <p className="mt-2 text-read leading-7 text-muted-foreground">
            ردّ ثمن مشتريات بأكوادك بعد الحسم، فيعاد إليك ما حسم زيادة (البند 4-10).
          </p>
          <ul className="mt-3 space-y-1.5">
            {(awaitingDiscounts?.credits ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 text-read text-muted-foreground">
                <span>{d.forWhomAr} <span dir="ltr" className="font-mono text-fine">({d.code})</span>{d.refundedAt && <> · ردّ {fmtDateAr(d.refundedAt)}</>}</span>
                <span dir="ltr" className="font-mono font-bold text-teal-light-ink">+{fmt(d.amount)} {d.currency}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ═══ وأين تُصدَر — سطرٌ يبقى ولو لم يكن ثَمّ خصم ═══

          سأل صاحبُ المنصّة عن «الكود الذي يُنشئه في قسم مستحقّاته»، وموضعُ
          إصداره «دعوتي» بقراره في ٢١ سبتمبر — والبندُ 4-10 يحيل إليها
          بهذا الاسم. فالعلّةُ أنّ من بحث عنه هنا لم يجد ما يدلّه: اللوحةُ
          التي فوقَه لا تُعرَض إلّا حين ينتظر خصمٌ حسمَه، ومن لم يُصدر شيئا
          قطّ يرى صفحةً لا تذكره.

          فسطرٌ يبقى: يقول أين يُصدَر وأين يُحسَم، فيصل بين الشاشتين. ولا
          يُكرّر ما تقوله اللوحةُ حين تُعرَض — تلك تعدّد ما ينتظر، وهذا
          يدلّ على الباب. */}
      {/* وسطحٌ من سطوح المنصّة لا صيغٌ مكتوبةٌ بيدها: الحدُّ والانحناءُ
          والأرضيّةُ من `Inset`، وحلقةُ التركيز والتحويمُ من `interactive`
          — فلا يُعاد رسمُ ما رُسم، ولا يزيد دَينُ التلويم. */}
      <Inset
        as={Link}
        interactive
        to="/trainer/referral"
        className="mb-6 flex items-center gap-3 px-4 py-3 text-read text-muted-foreground"
      >
        <TicketPercent className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
        <span>
          أكوادك تدار في <b className="text-foreground">«دعوتي»</b>، وخصوماتها تحسم من كشفك هنا (البند 4-10).
        </span>
      </Inset>

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
              لا كشوف بعد — تظهر هنا حين تعتمد أوّل مستحقّاتك.
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
                  {p.paidAt && <p className="mt-0.5 text-read text-muted-foreground">صرف {fmtDateAr(p.paidAt)}</p>}
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
                    {/* والبندُ السالبُ يُرى سالبا: حسمٌ بلون الأتعاب يُقرأ زيادةً
                        في مسحةِ عينٍ سريعة، وهو ما يُقرأ به الكشفُ فعلا. */}
                    <span dir="ltr" className={`font-mono font-bold ${Number(i.amount) < 0 ? "text-gold-ink" : "text-foreground"}`}>
                      {fmt(i.amount)} {p.currency}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>

      <Card as="p" className="mt-8 px-5 py-4 text-center text-read leading-6 text-muted-foreground">
        مراحل الكشف: إنشاء ← اعتماد ← صرف.
        {' '}{payoutTimingNoteAr()}{' '}
        ولأيّ استفسار راسل منسّقك قبل موعد الصرف.
      </Card>
    </>
  );
}

/** مستحقات المدرب — جلسة حقيقية: من الخادم مباشرة. بلا جلسة (ديمو محلي): البيانات التوضيحية المحلية */
/* حُذف `DemoEarningsView`: مستحقاتٌ ومبالغُ وحالاتُ صرفٍ مولَّدة في المتصفّح
   وتُعرض للمدرّب كأنها مستحقاته. */
/* ═══ ثلاثةُ أقسامٍ في لسانٍ واحد (الخطوة G، ١٩ أكتوبر ٢٠٢٦) ═══
   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): القائمةُ من أربعة عشر لسانا إلى ثمانية.
   فدخلت «عقدي» و«دعوتي» هنا — وقرارُه قبلها (٢٥ سبتمبر ٢٠٢٦): «الملف يكون في منصته ضمن قسم المستحقات
   والعقد». ما يستحقّه، والوثيقةُ التي يستحقّه بها، والرابطُ الذي يزيده — بابٌ واحد. ومساراتُها القديمة
   تُحال إلى أقسامها (`App.tsx`). */
const SECTIONS = [
  { id: "earnings", label: "مستحقاتي" },
  { id: "contract", label: "عقدي" },
  { id: "referral", label: "دعوتي" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export default function Earnings() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const section: Section = SECTIONS.some((s) => s.id === asked) ? (asked as Section) : "earnings";
  return (
    <TrainerLayout title="مستحقاتي">
      <TabBar
        ariaLabel="أقسام مستحقاتي"
        className="mb-5"
        value={section}
        onChange={(id) => setParams(id === "earnings" ? {} : { tab: id }, { replace: true })}
        items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
      />
      {section === "earnings" && <RealEarningsView />}
      {section === "contract" && <MyContract />}
      {section === "referral" && <Referral />}
    </TrainerLayout>
  );
}
