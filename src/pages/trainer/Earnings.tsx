import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Banknote, CheckCircle2, Clock3, Loader2, Lock, RefreshCw, ShieldCheck, TicketPercent, Trash2, XCircle } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiDelete, apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDateAr } from "@/utils/format";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { ConsentRow, OptionGrid, staffControlCls, staffSelectCls, StaffField } from "@/components/FormKit";
import { COUNTRIES_SORTED, flagOf } from "@/data/countries";
import { ibanChecksumOk, isIbanCountry, normalizeAccount, routingOf, swiftOk } from "@/application/trainer/bank-formats";
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

interface MaskedBank {
  id: string; maskedAr: string; tail4: string; countryCode: string;
  holderName: string; bankNameAr: string; branchAr: string | null; swiftBic: string | null;
  accountKind: string; routingCode: string | null;
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
   القيمةُ المقنَّعةُ لا تُكتب فوق السرّ الحقيقيّ.

   ═══ ولكلّ الدول، وسرّيٌّ، وباسمه، ويُلغى (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «تأكّد أنّ الفورمَ احترافيٌّ لكلّ الدول، ويُقال
   للمدرّب إنّه سرّيٌّ لا يُنشر لأحد، واسمح له بإلغائه أو تبديله، ويُشترط
   باسمه الخاصّ». فالدولةُ تُختار أوّلا ومنها نوعُ الحساب ورمزُ التوجيه
   (`bank-formats.ts`)، والـIBAN يُتحقَّق منه قبل الإرسال، والإقرارُ بأنّه
   باسمه شرطٌ في الخادم لا في الشاشة وحدَها. */
const EMPTY_BANK = {
  countryCode: "", accountKind: "iban" as "iban" | "local", iban: "", holderName: "",
  bankNameAr: "", branchAr: "", swiftBic: "", routingCode: "", ownName: false,
};

function BankAccountPanel() {
  const [state, setState] = useState<BankState | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(EMPTY_BANK);

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
  const country = COUNTRIES_SORTED.find((c) => c.iso2 === form.countryCode);
  const routing = routingOf(form.countryCode);
  const acct = normalizeAccount(form.iban);
  const ibanBad = form.accountKind === "iban" && acct.length >= 15 && !ibanChecksumOk(acct);
  const ibanCountryBad = form.accountKind === "iban" && acct.length >= 2 && !!form.countryCode && acct.slice(0, 2) !== form.countryCode;
  const swiftBad = form.swiftBic.trim().length > 0 && !swiftOk(form.swiftBic);
  const canSave =
    !!form.countryCode && form.ownName && !ibanBad && !ibanCountryBad && !swiftBad
    && acct.length >= (form.accountKind === "iban" ? 15 : 6)
    && form.holderName.trim().length >= 4 && form.bankNameAr.trim().length >= 2;

  const pickCountry = (iso2: string) =>
    setForm((f) => ({ ...f, countryCode: iso2, accountKind: iso2 && !isIbanCountry(iso2) ? "local" : "iban" }));

  const startEdit = () => {
    setOpen(true); setConfirmRemove(false); setErr("");
    const cc = a?.countryCode ?? "";
    setForm({
      ...EMPTY_BANK,
      countryCode: cc,
      accountKind: a?.accountKind === "local" ? "local" : cc && !isIbanCountry(cc) ? "local" : "iban",
      holderName: a?.holderName ?? state.contractNameAr ?? "",
      bankNameAr: a?.bankNameAr ?? "",
      branchAr: a?.branchAr ?? "",
      swiftBic: a?.swiftBic ?? "",
      routingCode: a?.routingCode ?? "",
    });
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await apiPut("/api/trainer/bank-account", {
        accountKind: form.accountKind,
        countryCode: form.countryCode,
        iban: acct,
        holderName: form.holderName.trim(),
        bankNameAr: form.bankNameAr.trim(),
        branchAr: form.branchAr.trim() || null,
        swiftBic: form.swiftBic.trim() || null,
        routingCode: form.accountKind === "local" ? form.routingCode.trim() || null : null,
        ownNameConfirmed: form.ownName,
      });
      setOpen(false);
      setForm(EMPTY_BANK);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر حفظُ الحساب");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr("");
    try {
      await apiDelete("/api/trainer/bank-account");
      setConfirmRemove(false);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر إلغاءُ الحساب");
    } finally { setBusy(false); }
  };

  return (
    <Panel as="section" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">حسابي البنكيّ — إليه تُحوَّل مستحقّاتُك</p>
          <p className="mt-1 flex items-center gap-1.5 text-read text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
            سرّيٌّ: يُحفظ معمّى، ولا يُنشر ولا يُعرض لأحد — لا في عقدٍ ولا في رسالة.
          </p>
        </div>
        {!open && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={a ? RefreshCw : Banknote} onClick={startEdit}>
              {a ? "بدّلْه" : "أدخِلْ حسابك"}
            </Button>
            {a && !confirmRemove && (
              <Button size="sm" tone="ghost" icon={Trash2} onClick={() => setConfirmRemove(true)}>ألغِه</Button>
            )}
          </div>
        )}
      </div>

      {err && <Inset tone="danger" className="mt-3 p-3 text-read">{err}</Inset>}

      {a && !open && confirmRemove && (
        <Inset tone="warn" className="mt-3 grid gap-3 p-3">
          <p className="text-read leading-6">
            يُلغى الحسابُ المنتهي بـ<span dir="ltr" className="font-mono">{a.tail4}</span>، ولا يُصرَف لك مستحقٌّ حتّى تُدخل حسابا غيرَه.
            ويصلك بريدٌ بالإلغاء.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" tone="danger" icon={Trash2} loading={busy} onClick={() => void remove()}>نعم، ألغِ الحساب</Button>
            <Button size="sm" tone="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>تراجعْ</Button>
          </div>
        </Inset>
      )}

      {a && !open && (
        <dl className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">{a.accountKind === "local" ? "رقمُ الحساب:" : "IBAN:"}</dt>
            <dd dir="ltr" className="font-mono font-bold">{a.maskedAr}</dd>
          </div>
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">صاحبُ الحساب:</dt>
            <dd className="font-bold">{a.holderName}</dd>
          </div>
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">المصرف:</dt>
            <dd className="font-bold">
              {a.bankNameAr}{a.branchAr ? ` — ${a.branchAr}` : ""}
              {COUNTRIES_SORTED.find((c) => c.iso2 === a.countryCode) ? ` · ${COUNTRIES_SORTED.find((c) => c.iso2 === a.countryCode)!.ar}` : ""}
            </dd>
          </div>
          {a.swiftBic && (
            <div className="flex gap-2 text-read">
              <dt className="text-muted-foreground">SWIFT:</dt>
              <dd dir="ltr" className="font-mono font-bold">{a.swiftBic}</dd>
            </div>
          )}
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">سُجّل:</dt>
            <dd className="font-bold">{fmtDateAr(a.createdAt)}</dd>
          </div>
          {a.outcome === "differs" && (
            <p className="mt-2 text-read leading-6 text-gold-ink sm:col-span-2">
              ⚠️ {a.outcomeSaidAr} — والحسابُ يُشترط باسمك الشخصيّ، فالماليّةُ تسأل عنه قبل أوّل حوالة.
            </p>
          )}
        </dl>
      )}

      {!a && !open && (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          لم تُدخِلْ حسابَك بعد — ولا يُصرَف مستحقٌّ قبله. يُكتب مرّةً ويبقى، وتبدّله أو تلغيه متى شئت.
        </p>
      )}

      {open && (
        <Inset className="mt-4 grid gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StaffField label="دولةُ المصرف">
              <select className={staffSelectCls} value={form.countryCode} onChange={(e) => pickCountry(e.target.value)}>
                <option value="">اختر الدولة…</option>
                {COUNTRIES_SORTED.map((c) => <option key={c.iso2} value={c.iso2}>{flagOf(c.iso2)} {c.ar}</option>)}
              </select>
            </StaffField>
            <StaffField as="div" label="نوعُ الرقم">
              <OptionGrid
                cols={2} name="نوعُ الرقم"
                items={[{ value: "iban", label: "IBAN" }, { value: "local", label: "رقمُ حسابٍ محلّيّ" }]}
                isOn={(v) => form.accountKind === v}
                onToggle={(v) => setForm({ ...form, accountKind: v === "local" ? "local" : "iban" })}
              />
            </StaffField>
          </div>

          <StaffField
            label="اسمُ صاحب الحساب — اسمُك أنت"
            hint={state.contractNameAr
              ? `كما يطبعه المصرف، باسمك الشخصيّ. واسمُك في العقد: ${state.contractNameAr}`
              : "كما يطبعه المصرف، باسمك الشخصيّ"}
          >
            <input className={staffControlCls} value={form.holderName} maxLength={160} autoComplete="name"
              onChange={(e) => setForm({ ...form, holderName: e.target.value })} />
          </StaffField>

          <div className="grid gap-3 sm:grid-cols-2">
            <StaffField label="اسمُ المصرف">
              <input className={staffControlCls} value={form.bankNameAr} maxLength={120}
                onChange={(e) => setForm({ ...form, bankNameAr: e.target.value })} />
            </StaffField>
            <StaffField label="الفرع" hint="لا يلزم">
              <input className={staffControlCls} value={form.branchAr} maxLength={120}
                onChange={(e) => setForm({ ...form, branchAr: e.target.value })} />
            </StaffField>
          </div>

          <StaffField
            label={form.accountKind === "iban" ? "رقمُ IBAN" : "رقمُ الحساب"}
            hint={form.accountKind === "iban"
              ? `كاملا — يبدأ برمز الدولة${country ? ` (${country.iso2})` : ""} ثمّ رقمين. والمسافاتُ لا تضرّ`
              : "كما في كشف حسابك — أرقامٌ وحروفٌ بلا مسافات"}
          >
            <input dir="ltr" className={`${staffControlCls} font-mono`} value={form.iban} maxLength={42}
              autoComplete="off" spellCheck={false} inputMode={form.accountKind === "iban" ? "text" : "numeric"}
              placeholder={form.accountKind === "iban" ? `${form.countryCode || "JO"}00 0000 0000 0000 0000 00` : "000123456789"}
              aria-invalid={ibanBad || ibanCountryBad || undefined}
              onChange={(e) => setForm({ ...form, iban: e.target.value })} />
            {ibanCountryBad && <span className="mt-1.5 block text-fine font-bold text-red-300">الـIBAN يبدأ بـ{form.countryCode} لحسابٍ في {country?.ar} — تحقّق من الدولة أو الرقم.</span>}
            {!ibanCountryBad && ibanBad && <span className="mt-1.5 block text-fine font-bold text-red-300">هذا الرقمُ لا يطابق صيغةَ IBAN — راجِعْ خانةً خانة.</span>}
          </StaffField>

          <div className="grid gap-3 sm:grid-cols-2">
            {form.accountKind === "local" && (
              <StaffField label={routing.labelAr} hint="يطلبه مصرفُك للحوالة إليه">
                <input dir="ltr" className={`${staffControlCls} font-mono`} value={form.routingCode} maxLength={34}
                  placeholder={routing.example} autoComplete="off"
                  onChange={(e) => setForm({ ...form, routingCode: e.target.value })} />
              </StaffField>
            )}
            <StaffField label="SWIFT / BIC" hint={form.countryCode === "JO" ? "لا يلزم داخلَ الأردن" : "يلزم للحوالات الدوليّة — ثماني خاناتٍ أو إحدى عشرة"}>
              <input dir="ltr" className={`${staffControlCls} font-mono`} value={form.swiftBic} maxLength={16}
                placeholder="ARABJOAX" autoComplete="off" aria-invalid={swiftBad || undefined}
                onChange={(e) => setForm({ ...form, swiftBic: e.target.value })} />
              {swiftBad && <span className="mt-1.5 block text-fine font-bold text-red-300">رمزُ SWIFT ثماني خاناتٍ أو إحدى عشرة.</span>}
            </StaffField>
          </div>

          <ConsentRow checked={form.ownName} onChange={(v) => setForm({ ...form, ownName: v })}>
            أُقرّ أنّ هذا الحسابَ <b>باسمي الشخصيّ</b> — لا باسم قريبٍ ولا شريكٍ ولا شركة. ولا تُحوَّل المستحقّاتُ إلى حسابِ غيري.
          </ConsentRow>

          <p className="flex items-start gap-2 text-read leading-6 text-muted-foreground">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            يُحفظ رقمُك معمّى، ولا يُعرض عليك بعدها إلّا بطرفه الأخير، ولا يراه أحدٌ ولا يظهر في عقدٍ ولا رسالة.
            ولا يُفتح إلّا لحظةَ تحويلِ مستحقٍّ معتمَد، ويُسجَّل كلُّ فتح. ويصلك بريدٌ عند كلّ تبديلٍ أو إلغاء.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" icon={Banknote} loading={busy} disabled={!canSave} onClick={() => void save()}>
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
            {/* ═══ والعامُّ أوّلا ثمّ ما عبر رابطك (٢٩ سبتمبر ٢٠٢٦) ═══

                كان «الأعلى أوّلا» بقرار ٢١ سبتمبر: سعرُ الرابط يتصدّر. ثمّ
                قال صاحبُ المنصّة: «اجعل عمودَ السعر العامّ أوّلا ومن رابطه»
                — فعاد العامُّ إلى الصدر هنا وفي جدول الشعب أدناه معا، كي لا
                يُقرأ الترتيبُ في موضعٍ ويُقرأ عكسُه في الآخر. */}
            <p className="mt-2 text-lg font-black text-foreground">
              {RULE_TYPE_AR[agreement.type] ?? agreement.type} —{" "}
              {agreement.type === "per_seat" && agreement.referralRate != null ? (
                <>
                  <span dir="ltr" className="font-mono">{Number(agreement.rate)}</span> {agreement.currency} عن كلّ متعلّمٍ عامّ
                  {" · و"}<span dir="ltr" className="font-mono">{Number(agreement.referralRate)}</span> {agreement.currency} عن كلّ متعلّمٍ جاء عبر رابطك
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

      {/* ═══ ووصلةُ «عقدي» ذهبت من هنا (٢٩ سبتمبر ٢٠٢٦) ═══

          كان هنا سطرٌ يدلّ على النسخة الموقَّعة. وقال صاحبُ المنصّة: «لا
          داعيَ لوجود العقد هنا لأنّ لديّ قسما للعقد» — و«عقدي» بندٌ في
          القائمة بجوار «مستحقّاتي» مباشرةً، فالسطرُ تكرارٌ لا دلالة. */}
      <BankAccountPanel />

      {/* ═══ شعبةً شعبة — من أين جاء طلابك وماذا يُحسب لك عنهم ═══ */}
      {(cohorts ?? []).length > 0 && (
        <Panel as="section" className="mb-6">
          <p className="text-sm font-black">شعبك — عامٌّ وعبر رابطك</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-read">
              <thead>
                <tr className="text-right text-muted-foreground">
                  <th className="pb-2 pl-3 font-bold">الشعبة</th>
                  {/* العامُّ أوّلا ثمّ عبر رابطك — بالقرار نفسِه (٢٩ سبتمبر ٢٠٢٦) */}
                  <th className="pb-2 pl-3 font-bold">عامّ</th>
                  <th className="pb-2 pl-3 font-bold">عبر رابطك</th>
                  <th className="pb-2 font-bold">المتوقَّع</th>
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
          <p className="text-sm font-black text-gold-ink">أكوادٌ وخصومٌ أصدرتَها بنفسك — تُحسم من كشفك القادم</p>
          <p className="mt-2 text-read leading-7 text-muted-foreground">
            هذا ما منحته أكوادُك (وخصومُك القديمةُ بالمبلغ) في مشترياتٍ دُفعت. يُدرج بندا باسمه في أوّل كشفٍ يُحرَّر لك
            ويُحسم منه، ولا يتجاوز ما يُحسم في كشفٍ واحدٍ قيمتَه — وما زاد يُؤجَّل إلى الذي يليه (البند 4-10 من عقدك).
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

      {/* ═══ وما يُعاد إليك — شراءٌ رُدّ ثمنُه بعد أن حُسم ما منحه كودُك ═══

          البند 4-10 بصيغته الجديدة: «وما حسم زيادة على ذلك أعيد إلى المدرب في
          الكشف الذي يليه». فيُقال قبل أن يقع — كما يُقال الحسمُ قبل أن يقع —
          ولا تُعرض اللوحةُ حين لا شيءَ يُعاد. */}
      {(awaitingDiscounts?.credits?.length ?? 0) > 0 && (
        <Panel as="section" tone="accent" className="mb-6">
          <p className="text-sm font-black text-teal-light-ink">يُعاد إليك في كشفك القادم</p>
          <p className="mt-2 text-read leading-7 text-muted-foreground">
            رُدّ ثمنُ مشترياتٍ بأكوادك بعد أن حُسم ما منحته، فيُعاد إليك ما حُسم زيادةً بندا موجبا (البند 4-10 من عقدك).
          </p>
          <ul className="mt-3 space-y-1.5">
            {(awaitingDiscounts?.credits ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 text-read text-muted-foreground">
                <span>{d.forWhomAr} <span dir="ltr" className="font-mono text-fine">({d.code})</span>{d.refundedAt && <> · رُدّ {fmtDateAr(d.refundedAt)}</>}</span>
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
          أكوادُ الخصم التي تُصدرها بنفسك تُدار في <b className="text-foreground">«دعوتي»</b> — وخصوماتُها تُحسم من كشفك هنا (البند 4-10).
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
