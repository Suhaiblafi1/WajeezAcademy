/* دعوتي — رابطُ المدرّب إلى كلّ ما يدرّسه (ب-٥ · ف-١).

   كان الرابطُ بطاقةً في «الرئيسية» بين طابور العمل وجلساتِه القادمة، فيراه
   مرّةً يومَ أُسندت إليه شعبتُه ثمّ لا يعود إليه. وقرارُ صاحب المنصّة (١٣
   سبتمبر ٢٠٢٦): تبويبٌ خاصٌّ به بعد «ما قيل عنّي» مباشرةً.

   والصفحةُ تُفتتح بسؤالٍ لا بشرح (ف-١): ما الذي يريد أن يوصي به من يتابعه؟
   ثمّ تعطيه الرابطَ وتقول له ما يُكسبه — وتحيل الرقمَ إلى «مستحقاتي» حيث
   يُعرض أجرُ الإحالة بعينه لكلّ شعبة، فلا يُخترع هنا رقمٌ ولا يُنسخ فيفترق
   عن مصدره.

   ─────────── وما فيها: روابطُ الدعوة وحدَها ───────────

   رابطُ ملفّه الكامل، ورابطٌ منفصلٌ لكلّ شعبةٍ مفتوحةٍ يدرّبها (١٥ سبتمبر
   ٢٠٢٦) — خرجت روابطُ الشعب من «مركز التواصل» داخلَ كلّ شعبةٍ وجُمعت هنا،
   فمن أراد أن يدعو إلى ثلاثِ دفعاتٍ لا يفتح ثلاثَ شاشات.

   **ولا مساراتٍ هنا.** كان في الصفحة قسمٌ يعرض ما نشره في «مساراتي»، فقال
   صاحبُ المنصّة: «لا داعيَ لهذه في صفحة دعوتي لأنّها موجودةٌ في خانة
   مساري». ولوحتان تعرضان مساراتِه في تبويبين تفترقان: تلك كانت تقرأ
   المنشورَ وحدَه، و«مساراتي» تقرؤها كلَّها وتبنيها وتُرسلها للاعتماد —
   فمن رآها هنا ناقصةً ظنَّ ما بناه ضاع.

   والرابطُ يبلغ مساراتِه على كلّ حال: صفحتُه العامّةُ تعرضها (ن-٨)، وذاك
   لا يتوقّف على عرضها في هذه الصفحة.

   ــ وما زال قائما: **لا يُبنى مسارٌ هنا**. صفحتان تبنيان مسارا تفترقان
   يوما، والمسارُ عقدٌ على متعلّمٍ لا شاشةُ عرض. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Link2, Loader2, TicketPercent, UserPlus, Wallet } from "lucide-react";
import PortalFrame from "../PortalFrame";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { countAr } from "@/application/text/count-ar";
import { fmtDateAr } from "@/utils/format";
import {
  MAX_TRAINER_CODE_PERCENT, MIN_TRAINER_CODE_PERCENT, codeBlockerAr,
} from "@/application/trainer/trainer-code";

interface MyReferral { code: string; slug: string; url: string; publicReady: boolean; registered: number }
/** خصمٌ أصدره المدرّبُ — كما يرسله `TrainerDiscountService.listFor` */
interface IssuedDiscount {
  id: string; code: string; status: string; statusAr: string;
  amount: number; currency: string; forWhomAr: string; noteAr: string | null;
  expiresAt: string | null; usedAt: string | null; settledAt: string | null;
  revokedAt: string | null; createdAt: string;
}
interface DiscountsState { discounts: IssuedDiscount[] }
/** كودٌ أصدره المدرّب — كما يرسله `TrainerCodeService.listFor` */
interface TrainerCodeRow {
  id: string; code: string; percentOff: number; labelAr: string; status: string;
  state: "live" | "paused" | "revoked" | "expired" | "exhausted"; stateAr: string;
  maxUses: number | null; usedCount: number; expiresAt: string | null; createdAt: string;
  uses: { paid: number; held: number; refunded: number };
  owed: number; pending: number; currency: string;
}
/** قبولُه البندَ 4-10 بصيغته الجديدة — ونصُّه كما يُطبع في العقد */
interface CodeTerms { accepted: boolean; via: "contract" | "consent" | null; acceptedAt: string | null; version: string; clauseAr: string }
/** رصيدُ أكواده — ما له عندنا ناقصا ما التزم به ولم يُحسم (`trainer-code-budget.ts`) */
interface CodeBudget { allowance: number; committed: number; remaining: number; currency: string }
interface CodesState { terms: CodeTerms; codes: TrainerCodeRow[]; budget: CodeBudget }
const EMPTY_CODE_FORM = { percentOff: "", labelAr: "", maxUses: "", expiresAt: "" };
const PURCHASE_FORMS = { one: "شراءٍ مدفوع", two: "شراءين مدفوعين", few: "مشترياتٍ مدفوعة", many: "شراءً مدفوعا" } as const;
const USE_FORMS = { one: "استعمال", two: "استعمالين", few: "استعمالات", many: "استعمالا" } as const;
/** رابطُ شعبةٍ بعينها — يُنشَر وحدَه لمن يدعو إلى دفعةٍ لا إلى كلّ ما يدرّب */
interface CohortLink {
  cohortId: string; title: string; termTitleAr: string | null; status: string
  registrationOpen: boolean; learners: number; code: string; url: string
}
const REGISTERED_FORMS = { one: "متعلّمٌ واحد", two: "متعلّمان", few: "متعلّمين", many: "متعلّما" } as const;


/* ═══ أكوادُ خصمي — نسبةٌ على دوراتي، من مستحقّاتي ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اصدار كود وليس خصم مباشر، والخصم
   يكون نسبة وليس رقما، ويعطي الخصم لمن يريد ليضعه في خانة الكودات» — وسقفُه
   على دوراته وحدَها. وموضعُه «دعوتي» كأخيه القديم: كلاهما شيءٌ ينشره باسمه.

   ─────────── وثلاثةٌ تُقال قبل أن يُصدَر ───────────

   · **أنّه من مستحقّاته هو** — وبقدر ما مُنح فعلا في كلّ شراء، لا بقدر النسبة
     من سعر القائمة: الكودُ يقع بعد خصوم الأكاديميّة.
   · **وأنّه على دوراته وحدَها** — من اشترى معها دورةَ غيره لا يُحسم منه عنها.
   · **وأنّ خصومَنا نحن لا تمسّه** — البند 4-9.

   والنسبةُ والأمثلةُ من الثوابت لا من أرقامٍ تُكتب هنا: `referral-tab` يمنع
   رقما بجانب «٪» في هذه الصفحة، وهو يحرس أن لا يُنسَخ رقمٌ عن مصدره. */
function MyCodes() {
  const [state, setState] = useState<CodesState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [form, setForm] = useState(EMPTY_CODE_FORM);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<CodesState>("/api/trainer/me/codes")
      .then((d) => { setState(d); setErr(""); })
      .catch((e) => setErr(permissionMessage(e, "تعذّر تحميلُ أكوادك")));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state) return err ? <Inset as="p" tone="danger" className="mb-6 px-4 py-3 text-read leading-6 text-red-200">{err}</Inset> : null;
  const { terms, codes, budget } = state;

  const pct = Number(form.percentOff);
  const input = {
    percentOff: pct,
    labelAr: form.labelAr,
    maxUses: form.maxUses.trim() === "" ? null : Number(form.maxUses),
    expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`) : null,
  };
  /* الحاجزُ من القواعد نفسِها التي يردّ بها الخادم — لا نصٌّ ثانٍ هنا */
  const blocker = form.percentOff.trim() === "" ? null : codeBlockerAr(input);
  const ready = form.percentOff.trim() !== "" && blocker === null && form.labelAr.trim().length >= 2;

  const act = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true); setErr("");
    try { await fn(); load(); return true; }
    catch (e) { setErr(e instanceof ApiError ? e.message : fallback); return false; }
    finally { setBusy(false); }
  };

  const create = async () => {
    const ok = await act(() => apiPost("/api/trainer/me/codes", {
      percentOff: input.percentOff,
      labelAr: input.labelAr.trim(),
      ...(input.maxUses != null ? { maxUses: input.maxUses } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
    }), "تعذّر إصدارُ الكود");
    if (ok) { setForm(EMPTY_CODE_FORM); setOpen(false); }
  };

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    });
  };

  return (
    <Panel as="section" className="mb-6">
      <p className="flex items-center gap-2 text-sm font-black">
        <TicketPercent className="h-4 w-4 text-gold-ink" aria-hidden="true" /> أكوادُ خصمٍ أصدرها بنفسي
      </p>

      <p className="mt-2 text-read leading-7 text-muted-foreground">
        لك أن تُصدر كودَ خصمٍ <b className="text-foreground">بنسبةٍ تحدّدها أنت حتّى {MAX_TRAINER_CODE_PERCENT}٪</b> وتنشره
        لمن تشاء، فيكتبه المتعلّمُ في خانة الكود حين يشتري. ويقع على <b className="text-foreground">دوراتك أنت وحدَها</b> —
        لا على ما يشتريه معها من دوراتِ غيرك — بعد خصوم الأكاديميّة، ومرّةً واحدةً لكلّ متعلّم.
      </p>
      <p className="mt-2 text-read leading-7 text-muted-foreground">
        وما يمنحه الكودُ <b className="text-foreground">من مستحقّاتك أنت</b>: في كلّ شراءٍ دُفع يُدرج ما مُنح فعلا بندا في أوّل
        كشفٍ يُحرَّر لك ثمّ يُحسم منه، وإن رُدّ الثمنُ نقص الحسمُ بقدره (البند 4-10 من عقدك). وما تطرحه الأكاديميّةُ من
        خصومها هي لا يُنقص أتعابَك بشيء (البند 4-9).
      </p>

      {/* ═══ ورصيدُه — يُسقَف بما له عندنا (٢٨ سبتمبر ٢٠٢٦) ═══

          يُقرأ قبل أن يُفاجأ بكودٍ لم يقع: المشتري يرى «بلغ حدَّه الآن» ولا يرى
          السبب — فالسببُ يُقال لصاحبه هنا. والرقمُ قبل أيّ شراء، وكلُّ شراءٍ
          يزيده بأجر مقعده؛ فهو أدنى ما يسعه كودُه لا أقصاه. */}
      {terms.accepted && (
        <Inset as="p" className="mt-3 px-4 py-3 text-read leading-7 text-muted-foreground">
          رصيدُ أكوادك الآن: <b dir="ltr" className="font-mono text-foreground">{budget.remaining} {budget.currency}</b> —
          ما لك عندنا (كشوفٌ لم تُصرف، وما يُتوقَّع لك من شعبك المفتوحة) ناقصا ما منحته أكوادُك ولم يُحسم بعد.
          ويقع الكودُ على شراءٍ ما وسع هذا الرصيدُ خصمَه، ومعه أجرُ المقعد الذي يأتي به الشراءُ نفسُه؛ وإلّا قيل للمشتري
          إنّ الكودَ بلغ حدَّه الآن، فأكمل بدونه — ولا يُحسم منك شيء.
        </Inset>
      )}

      {err && <Inset as="p" tone="danger" className="mt-3 px-4 py-3 text-read leading-6 text-red-200">{err}</Inset>}

      {/* ═══ من وقّع على «المبلغ» يقبل الصيغةَ الجديدة مرّةً واحدة ═══

          بنصّ البند كما يُطبع في العقد — من الخادم، من الثابت نفسِه الذي
          يُطبع في المتن. فلا يقرأ هنا غيرَ ما يُحسم به منه. */}
      {!terms.accepted ? (
        <Inset className="mt-4 px-4 py-4">
          <p className="text-read font-black text-foreground">البندُ 4-10 بصيغته الجديدة — اقبله مرّةً واحدة</p>
          <p className="mt-1 text-read leading-7 text-muted-foreground">
            وقّعتَ عقدك على خصمٍ <b className="text-foreground">بمبلغٍ معلوم</b>. والكودُ بالنسبة يُحسم من مستحقّاتك بصيغةٍ
            جديدةٍ للبند نفسِه، فلا يُصدَر حتّى تقبلها. هذا نصُّها كما في العقد:
          </p>
          <blockquote className="mt-3 border-s-2 border-gold/50 ps-3 text-read leading-7 text-foreground">{terms.clauseAr}</blockquote>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-read leading-6 text-foreground">
            <input type="checkbox" checked={agree} disabled={busy} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            قرأتُ البندَ 4-10 بصيغته هذه، وأقبل أن يُحسم من مستحقّاتي ما تمنحه أكوادي على هذا النحو.
          </label>
          <Button tone="confirm" size="sm" className="mt-3" loading={busy} disabled={!agree}
            onClick={() => void act(() => apiPost("/api/trainer/me/codes/terms/accept"), "تعذّر حفظُ قبولك")}>
            أقبل البندَ بصيغته الجديدة
          </Button>
        </Inset>
      ) : !open ? (
        <Button tone="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>أصدِرْ كودا</Button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StaffField label="النسبة" hint={`عددٌ صحيحٌ بين ${MIN_TRAINER_CODE_PERCENT} و${MAX_TRAINER_CODE_PERCENT}.`}>
            <input
              type="number" inputMode="numeric" dir="ltr" min={MIN_TRAINER_CODE_PERCENT} max={MAX_TRAINER_CODE_PERCENT} step="1"
              value={form.percentOff} disabled={busy}
              onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
              className={`${staffControlCls} text-left`}
            />
          </StaffField>
          <StaffField label="لمن أو أين تنشره؟" hint="اسمٌ تعرفه به — يُطبع في كشفك لتعرف بعد شهرين عمّ حُسم.">
            <input
              value={form.labelAr} disabled={busy} maxLength={100}
              onChange={(e) => setForm({ ...form, labelAr: e.target.value })}
              className={staffControlCls}
            />
          </StaffField>
          <StaffField label="أقصى عددٍ من الاستعمالات (اختياري)" hint="فارغٌ يعني بلا حدّ — ولك إيقافُه متى شئت.">
            <input
              type="number" inputMode="numeric" dir="ltr" min={1} step="1"
              value={form.maxUses} disabled={busy}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              className={`${staffControlCls} text-left`}
            />
          </StaffField>
          <StaffField label="ينتهي في (اختياري)">
            <input
              type="date" dir="ltr"
              value={form.expiresAt} disabled={busy}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className={`${staffControlCls} text-left`}
            />
          </StaffField>
          {/* مثالٌ من النسبة التي كتبها — لا رقمٌ ثابت: «ما يُحسم منك» يُقرأ قبل
              أن يُصدَر، على أبسط شراءٍ بلا خصمٍ آخر */}
          {blocker === null && pct > 0 && (
            <Inset as="p" className="px-4 py-3 text-read leading-6 text-muted-foreground sm:col-span-2">
              مثال: دورةٌ من دوراتك بمئة، بلا خصمٍ آخر — يدفع المتعلّم <b className="text-foreground">{100 - pct}</b>،
              ويُحسم منك <b className="text-gold-ink">{pct}</b>. وإن كان في الطلب خصمُ باقةٍ من الأكاديميّة وقع الكودُ على ما بقي بعده، فيقلّ ما يُحسم منك.
            </Inset>
          )}
          {blocker && (
            <Inset as="p" tone="danger" className="px-4 py-3 text-read leading-6 text-red-200 sm:col-span-2">{blocker}</Inset>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button tone="confirm" size="sm" loading={busy} disabled={!ready} onClick={() => void create()}>
              أصدِرْ ويُحسم منّي
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => { setOpen(false); setForm(EMPTY_CODE_FORM); }}>
              تراجعْ
            </Button>
          </div>
        </div>
      )}

      {codes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {codes.map((c) => {
            const deducted = Math.round((c.owed - c.pending) * 100) / 100;
            return (
              <Inset as="li" key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-read font-bold text-foreground">
                    <span dir="ltr" className="font-mono">{c.percentOff}٪</span> — {c.labelAr}
                  </span>
                  <span className="text-read text-muted-foreground">{c.stateAr}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    readOnly dir="ltr" value={c.code} aria-label={`كودُ ${c.labelAr}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`${staffControlCls} min-w-0 flex-1 text-left font-mono`}
                  />
                  <Button tone="secondary" size="sm" onClick={() => copy(c.code)}>
                    {copied === c.code ? "نُسخ" : "انسخ الكود"}
                  </Button>
                  {c.status === "live" && (
                    <Button tone="ghost" size="sm" disabled={busy}
                      onClick={() => void act(() => apiPost(`/api/trainer/me/codes/${c.id}/pause`), "تعذّر إيقافُ الكود")}>أوقِفْه</Button>
                  )}
                  {c.status === "paused" && (
                    <Button tone="secondary" size="sm" disabled={busy}
                      onClick={() => void act(() => apiPost(`/api/trainer/me/codes/${c.id}/resume`), "تعذّر استئنافُ الكود")}>استأنِفْه</Button>
                  )}
                  {c.status !== "revoked" && (
                    <Button tone="danger" size="sm" disabled={busy}
                      onClick={() => void act(() => apiPost(`/api/trainer/me/codes/${c.id}/revoke`), "تعذّر إلغاءُ الكود")}>ألغِه</Button>
                  )}
                </div>
                <p className="mt-2 text-read leading-6 text-muted-foreground">
                  {c.uses.paid === 0
                    ? "لم يُستعمل في شراءٍ مدفوعٍ بعد"
                    : <>استُعمل في {countAr(c.uses.paid, PURCHASE_FORMS)}</>}
                  {c.maxUses != null && <> · حدُّه {countAr(c.maxUses, USE_FORMS)}</>}
                  {c.expiresAt && <> · ينتهي {fmtDateAr(c.expiresAt)}</>}
                  {deducted > 0 && <> · حُسم منك <span dir="ltr" className="font-mono">{deducted} {c.currency}</span></>}
                  {c.pending > 0 && <> · ينتظر الحسمَ <span dir="ltr" className="font-mono">{c.pending} {c.currency}</span></>}
                  {c.pending < 0 && <> · يُعاد إليك <span dir="ltr" className="font-mono">{-c.pending} {c.currency}</span></>}
                </p>
              </Inset>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ═══ خصومي القديمةُ بالمبلغ — تُقرأ وتُلغى، ولا يُصدَر جديدٌ منها ═══

   ما أصدره قبل الكود يبقى على شروطه حتّى يُستعمل أو ينتهي أو يُلغى (ذيلُ البند
   4-10 بصيغته الجديدة). فتُعرض هنا ما بقيت، ويُلغى منها ما لم يُستعمَل — ولا
   بابَ لإصدار جديدٍ منها. ولا تُعرض اللوحةُ لمن لا خصمَ قديمَ له: لوحةٌ فارغةٌ
   عن أمرٍ انتهى تُعلّم القارئَ أنّه ما زال قائما. */
function LegacyDiscounts() {
  const [discounts, setDiscounts] = useState<IssuedDiscount[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<DiscountsState>("/api/trainer/me/discounts")
      .then((d) => { setDiscounts(d.discounts); setErr(""); })
      .catch((e) => setErr(permissionMessage(e, "تعذّر تحميلُ خصومك القديمة")));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!discounts || discounts.length === 0) return null;

  const revoke = async (id: string) => {
    setBusy(true); setErr("");
    try {
      await apiPost(`/api/trainer/me/discounts/${id}/revoke`);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر إلغاءُ الخصم");
    } finally { setBusy(false); }
  };

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    });
  };

  return (
    <Panel as="section" className="mb-6">
      <p className="text-sm font-black">خصومٌ أصدرتَها بالمبلغ قبل الأكواد</p>
      <p className="mt-2 text-read leading-7 text-muted-foreground">
        تبقى على شروطها التي صدرت بها حتّى تُستعمل أو تنتهي أو تُلغيها — ولا يُصدَر جديدٌ منها؛ فالخصمُ اليومَ كودٌ بالنسبة أعلاه.
      </p>
      {err && <Inset as="p" tone="danger" className="mt-3 px-4 py-3 text-read leading-6 text-red-200">{err}</Inset>}
      <ul className="mt-4 space-y-3">
        {discounts.map((d) => (
          <Inset as="li" key={d.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-read font-bold text-foreground">
                <span dir="ltr" className="font-mono">{d.amount} {d.currency}</span> — {d.forWhomAr}
              </span>
              <span className="text-read text-muted-foreground">{d.statusAr}</span>
            </div>
            {d.noteAr && <p className="mt-1 text-read leading-6 text-muted-foreground">{d.noteAr}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                readOnly dir="ltr" value={d.code} aria-label={`رمزُ خصمِ ${d.forWhomAr}`}
                onFocus={(e) => e.currentTarget.select()}
                className={`${staffControlCls} min-w-0 flex-1 text-left font-mono`}
              />
              <Button tone="secondary" size="sm" onClick={() => copy(d.code)}>
                {copied === d.code ? "نُسخ" : "انسخ الرمز"}
              </Button>
              {d.status === "live" && (
                <Button tone="danger" size="sm" disabled={busy} onClick={() => void revoke(d.id)}>ألغِه</Button>
              )}
            </div>
            {/* والتواريخُ تُقال حين تقع: «استُعمل» بلا متى خبرٌ ناقص */}
            {(d.usedAt || d.settledAt) && (
              <p className="mt-2 text-read leading-6 text-muted-foreground">
                {d.usedAt && <>استُعمل {fmtDateAr(d.usedAt)}</>}
                {d.settledAt && <> · حُسم من كشفك {fmtDateAr(d.settledAt)}</>}
              </p>
            )}
          </Inset>
        ))}
      </ul>
    </Panel>
  );
}

export default function Referral() {
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cohortLinks, setCohortLinks] = useState<CohortLink[] | null>(null);
  /* المنسوخُ يُعلَّم بمفتاحه لا برايةٍ واحدة: رايةٌ واحدةٌ لروابطَ كثيرةٍ
     تُضيء «نُسخ» تحت كلّ زرٍّ معا، فلا يدري أيَّها نسخ. */
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, url: string) => {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  };

  useEffect(() => {
    let alive = true;
    void apiGet<MyReferral>("/api/trainer/me/referral")
      .then((r) => { if (alive) setReferral(r); })
      .catch((e) => { if (alive) setError(permissionMessage(e, "تعذّر الوصول إلى الخادم")); });
    /* وروابطُ شعبه: إخفاقُها لا يُعطّل الرابطَ العامّ — ذاك هو البند */
    void apiGet<CohortLink[]>("/api/trainer/me/referral-links")
      .then((r) => { if (alive) setCohortLinks(r); })
      .catch(() => { if (alive) setCohortLinks([]); });
    return () => { alive = false };
  }, []);

  return (
    <PortalFrame title="دعوتي">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}

      {/* ف-١: تُفتتح بسؤالٍ عمّا يوصي به، لا بشرحِ آليّةِ الرابط */}
      <Panel as="section" className="mb-6">
        <h2 className="text-lg font-black">ما الذي توصي به من يتابعك؟</h2>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          لك صفحةٌ باسمك تعرض كلَّ شعبك المفتوحة — رابطٌ واحدٌ لها جميعا. ولكلّ شعبةٍ مفتوحةٍ رابطٌ منفصلٌ
          يقود إليها وحدَها، أدناه. انشر أيَّهما شئت حيث تكتب وحيث يسمعك الناس، فمن سجّل من أيٍّ منهما
          يصلك باسمك لا رقما: تراه بعلامة «عبر رابطك» عند اسمه في طلبتك، وبأجر الإحالة في «مستحقاتي».
        </p>
      </Panel>

      {/* ═══ ومساراتُه خرجت من هنا (١٥ سبتمبر ٢٠٢٦) ═══

          كانت لوحةً تعرض ما نشره في «مساراتي» وتقول له إن لم ينشر شيئا.
          وقال صاحبُ المنصّة: «لا داعيَ لهذه في صفحة دعوتي لأنّها موجودةٌ
          في خانة مساري».

          ولوحتان تعرضان مساراتِه في تبويبين تفترقان: هذه كانت تقرأ
          المنشورَ وحدَه، و«مساراتي» تقرؤها كلَّها وتبنيها وتُرسلها
          للاعتماد — فمن رآها هنا ناقصةً ظنَّ ما بناه ضاع.

          والرابطُ يبلغها على كلّ حال: صفحتُه العامّةُ تعرض مساراتِه
          (ن-٨)، وذاك لا يتوقّف على عرضها هنا. */}
      {!referral && !error && (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      )}

      {referral && (
        <>
          <Panel as="section" className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-black">
                <Link2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رابطي العامّ
              </p>
              <span className="flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {referral.registered > 0 ? `سجّل عبره ${countAr(referral.registered, REGISTERED_FORMS)}` : "لم يسجّل أحدٌ عبره بعد"}
              </span>
            </div>
            {/* الرابطُ يُعرض كما يُقرأ: `referral.service` لا يرمّز المسارَ،
                فاسمُه العربيُّ يبقى عربيّا في خانة النسخ كما في العنوان. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly dir="ltr" value={referral.url} aria-label="رابطي العامّ"
                onFocus={(e) => e.currentTarget.select()}
                className={`${staffControlCls} min-w-0 flex-1 text-left`}
              />
              <Button tone="secondary" onClick={() => copy("wide", referral.url)}>
                {copied === "wide" ? "نُسخ" : "انسخ الرابط"}
              </Button>
              <a href={referral.url} target="_blank" rel="noreferrer" className="text-read font-bold text-teal-light-ink hover:text-foreground">عايِنْها</a>
            </div>
            {/* البوّابةُ تُقال لا تُخفى: من لم يُعتمد نشرُ ملفّه رابطُه لا يفتح
                بعد — فيُقال له لمَ ومَن يرفعه، لا يُعطى رابطا يردّ ٤٠٤. */}
            {!referral.publicReady && (
              <Inset as="p" className="mt-3 px-4 py-3 text-read leading-6 text-muted-foreground">
                صفحتُك لا تفتح للعامّة بعد: لا يُعرض اسمُ مدرّبٍ قبل اعتماد الإدارة نشرَ ملفّه. راجِع الإدارة لاعتماده، ثمّ يعمل الرابطُ نفسُه بلا تغيير.
              </Inset>
            )}
          </Panel>

          {/* ═══ رابطٌ لكلّ شعبةٍ مفتوحة — نُقل إلى هنا (١٥ سبتمبر ٢٠٢٦) ═══

              كان داخلَ الشعبة في «مركز التواصل»: يفتح المدرّبُ شعبةً فيجد
              رابطَها، ولا يجد روابطَ شعبه الأخرى إلّا بفتح كلِّ واحدةٍ على
              حدة. ومن أراد أن يدعو إلى ثلاثِ دفعاتٍ فتح ثلاثَ شاشات.

              وقرارُ صاحب المنصّة: تُجمع في «دعوتي» خارجَ الشعب، إلى جانب
              رابط ملفّه الكامل — «إمّا أن يحصل على رابطٍ لملفّه الكامل كما
              هو موجودٌ حاليّا، أو أن يقوم بدعوة جمهوره لكلّ شعبةٍ مفتوحةٍ
              برابطٍ منفصل».

              والمفتوحةُ وحدَها: رابطٌ إلى مسودّةٍ أو إلى شعبةٍ انتهت يُحرج
              ناشرَه ويردّ من فتحه إلى صفحةٍ لا تقبل تسجيلا. */}
          {cohortLinks !== null && (
            <Panel as="section" className="mb-6">
              <p className="flex items-center gap-2 text-sm font-black">
                <Link2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رابطٌ لكلّ شعبة
              </p>
              {cohortLinks.length === 0 ? (
                <p className="mt-2 text-read leading-7 text-muted-foreground">
                  لا شعبةَ مفتوحةً لك الآن. وحين تُفتح لك شعبةٌ يظهر رابطُها هنا — ورابطُك العامُّ أعلاه
                  يبلغها من يومها بلا أن تنشر شيئا جديدا.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-read leading-7 text-muted-foreground">
                    كلُّ رابطٍ يقود إلى شعبته وحدَها — انشره لمن تدعوه إلى هذه الدفعة بعينها. وحسابُ من سجّل
                    منه حسابُ رابطك العامّ نفسُه: يُحسب لك بأجر الإحالة.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {cohortLinks.map((c) => (
                      <Inset as="li" key={c.cohortId} className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-read font-bold text-foreground">{c.title}</span>
                          <span className="text-read text-muted-foreground">
                            {c.termTitleAr ? `${c.termTitleAr} · ` : ""}
                            {c.learners > 0 ? countAr(c.learners, REGISTERED_FORMS) : "لم يسجّل أحدٌ بعد"}
                          </span>
                        </div>
                        {/* وحالةُ التسجيل تُقال: رابطٌ إلى شعبةٍ أُغلق تسجيلُها
                            يعمل ولا يُسجَّل منه أحد، فيُظنُّ الرابطُ عاطلا. */}
                        {!c.registrationOpen && (
                          <p className="mt-1 text-read leading-6 text-gold-ink">
                            تسجيلُ هذه الشعبة مغلقٌ الآن — الرابطُ يعمل، ولا يُسجَّل منه حتّى تفتحه الإدارة.
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            readOnly dir="ltr" value={c.url} aria-label={`رابط دعوتي إلى ${c.title}`}
                            onFocus={(e) => e.currentTarget.select()}
                            className={`${staffControlCls} min-w-0 flex-1 text-left`}
                          />
                          <Button tone="secondary" size="sm" onClick={() => copy(c.cohortId, c.url)}>
                            {copied === c.cohortId ? "نُسخ" : "انسخ الرابط"}
                          </Button>
                        </div>
                      </Inset>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

          <MyCodes />
          <LegacyDiscounts />

          {/* ف-١: يُقال إنّ الإحالةَ أعلى، ولا يُكتب رقمُها هنا — مصدرُه
              «مستحقاتي» حيث يُعرض أجرُ الإحالة لكلّ شعبةٍ بعينها. ورقمٌ
              منسوخٌ في صفحتين يفترق عن أصله يوما، ويُقرأ وعدا لا يُوفى. */}
          <Panel as="section">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Wallet className="h-4 w-4 text-gold-ink" aria-hidden="true" /> ولمَ يعنيك أن يسجّلوا من رابطك
            </h2>
            <p className="mt-2 text-read leading-7 text-muted-foreground">
              أجرُك عن متعلّمٍ جاء عبر رابطك أعلى من أجرك عن متعلّمٍ سجّل عامّا — وهو مكتوبٌ لكلّ شعبةٍ بعينها في
              «مستحقاتي»، فانظره هناك بالرقم لا بالوعد.
            </p>
            <Button as={Link} to="/trainer/earnings" tone="secondary" size="sm" className="mt-3">
              افتح مستحقاتي
            </Button>
          </Panel>
        </>
      )}
    </PortalFrame>
  );
}
