import { useCallback, useEffect, useState } from "react";
import { Banknote, CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDateAr } from "@/utils/format";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls, StaffField } from "@/components/FormKit";
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
  };
}

interface MaskedBank {
  id: string; maskedAr: string; tail4: string; countryCode: string;
  holderName: string; bankNameAr: string; branchAr: string | null; swiftBic: string | null;
  outcome: string; outcomeScore: number; outcomeSaidAr: string;
  createdAt: string; lastRevealAt: string | null;
}
interface BankState { enabled: boolean; account: MaskedBank | null; contractNameAr: string | null }

const fmt = (n: string | number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/* ═══ حسابي البنكيّ — يكتبه هنا، والبندُ ٤-٤ يقول إنّ موضعَه هنا ═══

   «في بوابته على المنصة تحت «مستحقاتي» بعد تفعيل حسابه» — نصُّ العقد الذي
   وقّعه، فأيُّ موضعٍ آخر يناقض وثيقةً بيده.

   ولا يُعاد إليه الرقمُ بعد حفظه: يرى طرفَه الأخيرَ ليطمئنّ أنّه حسابُه،
   ومن أراد تبديلَه كتبه كاملا. وهو نمطُ `integrations.service` نفسُه —
   القيمةُ المقنَّعةُ لا تُكتب فوق السرّ الحقيقيّ. */
function BankAccountPanel() {
  const [state, setState] = useState<BankState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ iban: "", holderName: "", bankNameAr: "", branchAr: "", swiftBic: "" });

  const load = useCallback(() => {
    apiGet<BankState>("/api/trainer/bank-account")
      .then((d) => { setState(d); setErr(""); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل حسابك البنكيّ"));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state) return null;

  /* ولا تُعرَض خانةٌ لا تُحفظ: بلا مفتاحِ تعميةٍ على الخادم يُردُّ الحفظُ،
     فيكتب المدرّبُ رقمَه ثمّ يُقال له «غيرُ مهيّأة». والصمتُ هنا أصدق. */
  if (!state.enabled) {
    return (
      <Panel as="section" className="mb-6">
        <p className="text-sm font-black">حسابي البنكيّ</p>
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          خانةُ الحسابات البنكيّة غيرُ مهيّأةٍ على الخادم بعد — راسِلِ الإدارةَ لتسليم حسابك.
        </p>
      </Panel>
    );
  }

  const a = state.account;
  const save = async () => {
    setBusy(true); setErr("");
    try {
      await apiPut("/api/trainer/bank-account", {
        iban: form.iban.trim(),
        holderName: form.holderName.trim(),
        bankNameAr: form.bankNameAr.trim(),
        branchAr: form.branchAr.trim() || null,
        swiftBic: form.swiftBic.trim() || null,
      });
      setOpen(false);
      setForm({ iban: "", holderName: "", bankNameAr: "", branchAr: "", swiftBic: "" });
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر حفظُ الحساب");
    } finally { setBusy(false); }
  };

  return (
    <Panel as="section" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black">حسابي البنكيّ — إليه تُحوَّل مستحقّاتُك</p>
        {!open && (
          <Button size="sm" icon={Banknote} onClick={() => {
            setOpen(true);
            setForm((f) => ({
              ...f,
              holderName: a?.holderName ?? state.contractNameAr ?? "",
              bankNameAr: a?.bankNameAr ?? "",
              branchAr: a?.branchAr ?? "",
              swiftBic: a?.swiftBic ?? "",
            }));
          }}>
            {a ? "بدّلْه" : "أدخِلْ حسابك"}
          </Button>
        )}
      </div>

      {err && <Inset tone="danger" className="mt-3 p-3 text-read">{err}</Inset>}

      {a && !open && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">الرقم:</dt>
            <dd dir="ltr" className="font-mono font-bold">{a.maskedAr}</dd>
          </div>
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">صاحبُ الحساب:</dt>
            <dd className="font-bold">{a.holderName}</dd>
          </div>
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">المصرف:</dt>
            <dd className="font-bold">{a.bankNameAr}{a.branchAr ? ` — ${a.branchAr}` : ""}</dd>
          </div>
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">سُجّل:</dt>
            <dd className="font-bold">{fmtDateAr(a.createdAt)}</dd>
          </div>
          {a.outcome === "differs" && (
            <p className="mt-2 text-read leading-6 text-gold-ink sm:col-span-2">
              ⚠️ {a.outcomeSaidAr} — وليس هذا منعا، لكنّ الماليّةَ تسأل عنه قبل أوّل حوالة.
            </p>
          )}
        </dl>
      )}

      {!a && !open && (
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          لم تُدخِلْ حسابَك بعد — ولا يُصرَف مستحقٌّ قبله. يُكتب مرّةً ويبقى.
        </p>
      )}

      {open && (
        <Inset className="mt-3 grid gap-3 p-3">
          <p className="text-read leading-6 text-muted-foreground">
            يُحفَظ رقمُك معمّى، ولا يُعرض عليك بعدها إلّا بطرفه الأخير، ولا يظهر في أيّ عقدٍ
            ولا في أيّ رسالةٍ منّا. ولا يُفتح إلّا لحظةَ تحويلِ مستحقٍّ معتمَد.
          </p>
          <StaffField label="رقمُ الحساب / IBAN" hint="كاملا بلا مسافات">
            <input dir="ltr" className={staffControlCls} value={form.iban} maxLength={42}
              placeholder="JO00XXXX0000000000000000000000"
              onChange={(e) => setForm({ ...form, iban: e.target.value })} />
          </StaffField>
          <StaffField
            label="اسمُ صاحب الحساب"
            hint={state.contractNameAr
              ? `كما يطبعه المصرف. واسمُك في العقد: ${state.contractNameAr}`
              : "كما يطبعه المصرف"}
          >
            <input className={staffControlCls} value={form.holderName} maxLength={160}
              onChange={(e) => setForm({ ...form, holderName: e.target.value })} />
          </StaffField>
          <div className="grid gap-3 sm:grid-cols-2">
            <StaffField label="المصرف">
              <input className={staffControlCls} value={form.bankNameAr} maxLength={120}
                onChange={(e) => setForm({ ...form, bankNameAr: e.target.value })} />
            </StaffField>
            <StaffField label="الفرع" hint="لا يلزم">
              <input className={staffControlCls} value={form.branchAr} maxLength={120}
                onChange={(e) => setForm({ ...form, branchAr: e.target.value })} />
            </StaffField>
          </div>
          <StaffField label="SWIFT / BIC" hint="لا يلزم — للحوالات من خارج الأردن">
            <input dir="ltr" className={staffControlCls} value={form.swiftBic} maxLength={16}
              onChange={(e) => setForm({ ...form, swiftBic: e.target.value })} />
          </StaffField>
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" icon={Banknote} loading={busy}
              disabled={form.iban.trim().length < 15 || form.holderName.trim().length < 4 || form.bankNameAr.trim().length < 2}
              onClick={() => void save()}>
              احفظْ حسابي
            </Button>
            <Button tone="ghost" disabled={busy} onClick={() => { setOpen(false); setErr(""); }}>تراجعْ</Button>
          </div>
        </Inset>
      )}
    </Panel>
  );
}

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

  const { summary, payouts, agreement, rules, cohorts, awaitingDiscounts } = data;
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
            {/* ═══ والأعلى يُذكَر أوّلا (٢١ سبتمبر ٢٠٢٦) ═══

                قرارُ صاحب المنصّة: «ابدأ بالأعلى وهو رابط الإحالة الخاص به
                وبعدها نذكر السعر الاعتيادي». وكان العامُّ يتصدّر فيقرأ
                المدرّبُ الأصغرَ أوّلا ويثبت في ذهنه، ويأتيه سعرُ رابطه
                ذيلا مسبوقا بنقطة. والرقمان كلاهما مكتوبان — الترتيبُ
                وحدَه انقلب.

                ولا يُقلَب حيث لا «أعلى»: بلا `referralRate` يبقى السعرُ
                العامُّ وحدَه في صدر السطر كما كان. */}
            <p className="mt-2 text-lg font-black text-foreground">
              {RULE_TYPE_AR[agreement.type] ?? agreement.type} —{" "}
              {agreement.type === "per_seat" && agreement.referralRate != null ? (
                <>
                  <span dir="ltr" className="font-mono">{Number(agreement.referralRate)}</span> {agreement.currency} عن كلّ متعلّمٍ جاء عبر رابطك
                  {" · و"}<span dir="ltr" className="font-mono">{Number(agreement.rate)}</span> {agreement.currency} عن كلّ متعلّمٍ عامّ
                </>
              ) : (
                <>
                  <span dir="ltr" className="font-mono">{Number(agreement.rate)}</span> {agreement.currency}
                  {agreement.type === "per_seat" && " عن كلّ متعلّمٍ عامّ"}
                  {agreement.type === "revenue_share" && " من إيراد الشعبة"}
                </>
              )}
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

      <BankAccountPanel />

      {/* ═══ شعبةً شعبة — من أين جاء طلابك وماذا يُحسب لك عنهم ═══ */}
      {(cohorts ?? []).length > 0 && (
        <Panel as="section" className="mb-6">
          <p className="text-sm font-black">شعبك — عبر رابطك وعامٌّ</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-read">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="pb-2 pl-3 font-bold">الشعبة</th>
                  {/* الأعلى أوّلا — العمودُ قبل العمود، بالقرار نفسِه */}
                  <th className="pb-2 pl-3 font-bold">عبر رابطك</th>
                  <th className="pb-2 pl-3 font-bold">عامّ</th>
                  <th className="pb-2 font-bold">المتوقَّع</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohortId} className="border-t border-white/10">
                    <td className="py-2 pl-3 font-bold">{c.title}</td>
                    <td className="py-2 pl-3 tabular-nums">{c.referred}{c.referralRate != null && <span className="text-muted-foreground"> × {c.referralRate}</span>}</td>
                    <td className="py-2 pl-3 tabular-nums">{c.general}{c.rate != null && <span className="text-muted-foreground"> × {c.rate}</span>}</td>
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
          <p className="text-sm font-black text-gold-ink">خصومٌ أصدرتَها بنفسك — تُحسم من كشفك القادم</p>
          <p className="mt-2 text-read leading-7 text-muted-foreground">
            هذه خصومٌ أصدرتَها من «دعوتي» واستُعملت في مشترياتٍ دُفعت. تُدرج بندا باسمها في أوّل كشفٍ يُحرَّر لك
            وتُحسم منه، ولا يتجاوز ما يُحسم في كشفٍ واحدٍ قيمتَه — وما زاد يُؤجَّل إلى الذي يليه (البند 4-10 من عقدك).
          </p>
          <ul className="mt-3 space-y-1.5">
            {awaitingDiscounts.rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 text-read text-muted-foreground">
                <span>{d.forWhomAr} <span dir="ltr" className="font-mono text-fine">({d.code})</span>{d.usedAt && <> · استُعمل {fmtDateAr(d.usedAt)}</>}</span>
                <span dir="ltr" className="font-mono font-bold text-gold-ink">−{fmt(d.amount)} {d.currency}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-read font-bold text-gold-ink">
            المجموع المنتظَر حسمُه: <span dir="ltr" className="font-mono">{fmt(awaitingDiscounts.total)}</span> {awaitingDiscounts.currency}
          </p>
        </Panel>
      )}

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
        الكشف يمر بثلاث مراحل: إنشاء من الإدارة المالية ← اعتماد ← صرف. كل بند مرتبط بمصدره لمنع الازدواج.
        {' '}{payoutTimingNoteAr()}{' '}
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
