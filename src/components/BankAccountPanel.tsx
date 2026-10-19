/* حسابي البنكيّ — خانةُ من تُحوَّل إليه أموالُه: المدرّبُ لمستحقّاته، والمستشارُ لعمولته.

   كانت في «مستحقّاتي» عند المدرّب وحدَه، وصار للمستشار حسابُه كذلك (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب
   المنصّة: «A»، حسابُه في المنصّة كالمدرّب. فالخانةُ واحدةٌ والبابُ يُمرَّر (`endpoint`)، وما يختلف
   كلماتُه (`BANK_COPY` في `application/bank/panel-copy.ts`): ما يُصرف له، وأين يُعرف اسمُه. */

import { useCallback, useEffect, useState } from "react";
import { Banknote, Lock, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDateAr } from "@/utils/format";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { ConsentRow, OptionGrid, staffControlCls, staffSelectCls, StaffField } from "@/components/FormKit";
import { COUNTRIES_SORTED, flagOf } from "@/data/countries";
import { ibanChecksumOk, isIbanCountry, normalizeAccount, routingOf, swiftOk } from "@/application/trainer/bank-formats";
import type { BankPanelCopy } from "@/application/bank/panel-copy";

interface MaskedBank {
  id: string; maskedAr: string; tail4: string; countryCode: string;
  holderName: string; bankNameAr: string; branchAr: string | null; swiftBic: string | null;
  accountKind: string; routingCode: string | null;
  outcome: string; outcomeScore: number; outcomeSaidAr: string;
  createdAt: string; lastRevealAt: string | null;
}
interface BankState {
  enabled: boolean; account: MaskedBank | null; writeProblemAr?: string | null;
  /** اسمُ صاحبه حيث يُعرف — في العقد للمدرّب، وفي المنصّة للمستشار */
  contractNameAr?: string | null; nameAr?: string | null;
}

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

export default function BankAccountPanel({ endpoint, copy }: { endpoint: string; copy: BankPanelCopy }) {
  const [state, setState] = useState<BankState | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(EMPTY_BANK);

  const load = useCallback(() => {
    apiGet<BankState>(endpoint)
      .then((d) => { setState(d); setErr(""); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل حسابك البنكيّ"));
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  if (!state) return null;

  /* ولا تُعرَض خانةٌ لا تُحفظ: بلا مفتاحِ تعميةٍ على الخادم يُردُّ الحفظُ،
     فيكتب المدرّبُ رقمَه ثمّ يُقال له «غيرُ مهيّأة». والصمتُ هنا أصدق. */
  if (!state.enabled) {
    return (
      <Panel as="section" className="mb-6">
        <p className="text-sm font-black">حسابي البنكيّ</p>
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          حفظ الحسابات البنكيّة غير مهيّأ بعد — راسل الإدارة.
        </p>
      </Panel>
    );
  }

  /* ولا خانةَ يُردّ حفظُها: في طور التهيئة يُقال ما يمنعها بدلها (١٩ أكتوبر ٢٠٢٦) */
  if (state.writeProblemAr && !state.account) {
    return (
      <Panel as="section" className="mb-6">
        <p className="text-sm font-black">حسابي البنكيّ</p>
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          {state.writeProblemAr}
        </p>
      </Panel>
    );
  }

  const a = state.account;
  const knownName = state.contractNameAr ?? state.nameAr ?? null;
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
      holderName: a?.holderName ?? knownName ?? "",
      bankNameAr: a?.bankNameAr ?? "",
      branchAr: a?.branchAr ?? "",
      swiftBic: a?.swiftBic ?? "",
      routingCode: a?.routingCode ?? "",
    });
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await apiPut(endpoint, {
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
      setErr(e instanceof ApiError ? e.message : "تعذّر حفظ الحساب");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr("");
    try {
      await apiDelete(endpoint);
      setConfirmRemove(false);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر إلغاء الحساب");
    } finally { setBusy(false); }
  };

  return (
    <Panel as="section" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">حسابي البنكيّ — إليه تحوّل {copy.moneyAr}</p>
          <p className="mt-1 flex items-center gap-1.5 text-read text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
            سرّيّ ومعمّى، لا يعرض لأحد.
          </p>
        </div>
        {!open && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={a ? RefreshCw : Banknote} onClick={startEdit}>
              {a ? "بدّله" : "أدخل حسابك"}
            </Button>
            {a && !confirmRemove && (
              <Button size="sm" tone="ghost" icon={Trash2} onClick={() => setConfirmRemove(true)}>ألغه</Button>
            )}
          </div>
        )}
      </div>

      {err && <Inset tone="danger" className="mt-3 p-3 text-read">{err}</Inset>}

      {a && !open && confirmRemove && (
        <Inset tone="warn" className="mt-3 grid gap-3 p-3">
          <p className="text-read leading-6">
            يلغى الحساب المنتهي بـ<span dir="ltr" className="font-mono">{a.tail4}</span>، {copy.noneUntilAr}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" tone="danger" icon={Trash2} loading={busy} onClick={() => void remove()}>نعم، ألغ الحساب</Button>
            <Button size="sm" tone="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>تراجع</Button>
          </div>
        </Inset>
      )}

      {a && !open && (
        <dl className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">{a.accountKind === "local" ? "رقم الحساب:" : "IBAN:"}</dt>
            <dd dir="ltr" className="font-mono font-bold">{a.maskedAr}</dd>
          </div>
          <div className="flex gap-2 text-read">
            <dt className="text-muted-foreground">صاحب الحساب:</dt>
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
            <dt className="text-muted-foreground">سجّل:</dt>
            <dd className="font-bold">{fmtDateAr(a.createdAt)}</dd>
          </div>
          {a.outcome === "differs" && (
            <p className="mt-2 text-read leading-6 text-gold-ink sm:col-span-2">
              ⚠️ {a.outcomeSaidAr} — ويشترط أن يكون الحساب باسمك الشخصيّ.
            </p>
          )}
        </dl>
      )}

      {!a && !open && (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          {copy.emptyAr}
        </p>
      )}

      {open && (
        <Inset className="mt-4 grid gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StaffField label="دولة المصرف">
              <select className={staffSelectCls} value={form.countryCode} onChange={(e) => pickCountry(e.target.value)}>
                <option value="">اختر الدولة…</option>
                {COUNTRIES_SORTED.map((c) => <option key={c.iso2} value={c.iso2}>{flagOf(c.iso2)} {c.ar}</option>)}
              </select>
            </StaffField>
            <StaffField as="div" label="نوع الرقم">
              <OptionGrid
                cols={2} name="نوع الرقم"
                items={[{ value: "iban", label: "IBAN" }, { value: "local", label: "رقم حساب محلّيّ" }]}
                isOn={(v) => form.accountKind === v}
                onToggle={(v) => setForm({ ...form, accountKind: v === "local" ? "local" : "iban" })}
              />
            </StaffField>
          </div>

          <StaffField
            label="اسم صاحب الحساب — اسمك أنت"
            hint={knownName
              ? `كما يطبعه المصرف، باسمك الشخصيّ. واسمك ${copy.nameWhereAr}: ${knownName}`
              : "كما يطبعه المصرف، باسمك الشخصيّ"}
          >
            <input className={staffControlCls} value={form.holderName} maxLength={160} autoComplete="name"
              onChange={(e) => setForm({ ...form, holderName: e.target.value })} />
          </StaffField>

          <div className="grid gap-3 sm:grid-cols-2">
            <StaffField label="اسم المصرف">
              <input className={staffControlCls} value={form.bankNameAr} maxLength={120}
                onChange={(e) => setForm({ ...form, bankNameAr: e.target.value })} />
            </StaffField>
            <StaffField label="الفرع" hint="لا يلزم">
              <input className={staffControlCls} value={form.branchAr} maxLength={120}
                onChange={(e) => setForm({ ...form, branchAr: e.target.value })} />
            </StaffField>
          </div>

          <StaffField
            label={form.accountKind === "iban" ? "رقم IBAN" : "رقم الحساب"}
            hint={form.accountKind === "iban"
              ? `كاملا — يبدأ برمز الدولة${country ? ` (${country.iso2})` : ""} ثمّ رقمين. والمسافات لا تضرّ`
              : "كما في كشف حسابك — أرقام وحروف بلا مسافات"}
          >
            <input dir="ltr" className={`${staffControlCls} font-mono`} value={form.iban} maxLength={42}
              autoComplete="off" spellCheck={false} inputMode={form.accountKind === "iban" ? "text" : "numeric"}
              placeholder={form.accountKind === "iban" ? `${form.countryCode || "JO"}00 0000 0000 0000 0000 00` : "000123456789"}
              aria-invalid={ibanBad || ibanCountryBad || undefined}
              onChange={(e) => setForm({ ...form, iban: e.target.value })} />
            {ibanCountryBad && <span className="mt-1.5 block text-fine font-bold text-red-300">الـIBAN يبدأ بـ{form.countryCode} لحساب في {country?.ar} — تحقّق من الدولة أو الرقم.</span>}
            {!ibanCountryBad && ibanBad && <span className="mt-1.5 block text-fine font-bold text-red-300">الرقم لا يطابق صيغة IBAN.</span>}
          </StaffField>

          <div className="grid gap-3 sm:grid-cols-2">
            {form.accountKind === "local" && (
              <StaffField label={routing.labelAr} hint="يطلبه مصرفك للحوالة إليه">
                <input dir="ltr" className={`${staffControlCls} font-mono`} value={form.routingCode} maxLength={34}
                  placeholder={routing.example} autoComplete="off"
                  onChange={(e) => setForm({ ...form, routingCode: e.target.value })} />
              </StaffField>
            )}
            <StaffField label="SWIFT / BIC" hint={form.countryCode === "JO" ? "لا يلزم داخل الأردن" : "يلزم للحوالات الدوليّة — ثماني خانات أو إحدى عشرة"}>
              <input dir="ltr" className={`${staffControlCls} font-mono`} value={form.swiftBic} maxLength={16}
                placeholder="ARABJOAX" autoComplete="off" aria-invalid={swiftBad || undefined}
                onChange={(e) => setForm({ ...form, swiftBic: e.target.value })} />
              {swiftBad && <span className="mt-1.5 block text-fine font-bold text-red-300">رمز SWIFT ثماني خانات أو إحدى عشرة.</span>}
            </StaffField>
          </div>

          <ConsentRow checked={form.ownName} onChange={(v) => setForm({ ...form, ownName: v })}>
            أقرّ أنّ هذا الحساب <b>باسمي الشخصيّ</b> — لا باسم قريب ولا شريك ولا شركة. {copy.consentTailAr}
          </ConsentRow>

          <p className="flex items-start gap-2 text-read leading-6 text-muted-foreground">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            يحفظ معمّى ويظهر بطرفه الأخير فقط، {copy.sealedAr}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" icon={Banknote} loading={busy} disabled={!canSave} onClick={() => void save()}>
              احفظ حسابي
            </Button>
            <Button tone="ghost" disabled={busy} onClick={() => { setOpen(false); setErr(""); }}>تراجع</Button>
          </div>
        </Inset>
      )}
    </Panel>
  );
}
