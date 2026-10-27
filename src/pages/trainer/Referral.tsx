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
import { Link, useSearchParams } from "react-router";
import { Copy, ExternalLink, Gift, Link2, Loader2, Share2, TicketPercent, UserPlus, Wallet } from "lucide-react";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { countAr } from "@/application/text/count-ar";
import { fmtDateAr } from "@/utils/format";
import ShareKit from "@/components/trainer/ShareKit";
import { previewFaceOf, previewLinksOf, syncLinkPreviews } from "@/components/trainer/link-preview";
import { bestCode } from "@/application/trainer/share-kit";
import { VIA_AR } from "@/application/links/share-via";
import {
  MAX_TRAINER_CODE_AMOUNT, MAX_TRAINER_CODE_PERCENT, MIN_TRAINER_CODE_PERCENT, codeBlockerAr, codeFaceAr,
  codeQuoteFor, codeValueRows, type CodePricingCourse,
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
  id: string; code: string; percentOff: number | null; amountOff: number | null; labelAr: string; status: string;
  state: "live" | "paused" | "revoked" | "expired" | "exhausted"; stateAr: string;
  maxUses: number | null; usedCount: number; expiresAt: string | null; createdAt: string;
  uses: { paid: number; held: number; refunded: number };
  owed: number; pending: number; currency: string;
}
/** قبولُه البندَ 4-10 بصيغته الجديدة — ونصُّه كما يُطبع في العقد */
interface CodeTerms { accepted: boolean; via: "contract" | "consent" | null; acceptedAt: string | null; version: string; clauseAr: string }
/** رصيدُ أكواده — ما له عندنا ناقصا ما التزم به ولم يُحسم (`trainer-code-budget.ts`) */
interface CodeBudget { allowance: number; committed: number; remaining: number; currency: string }
interface CodesState { terms: CodeTerms; codes: TrainerCodeRow[]; budget: CodeBudget; pricing: CodePricingCourse[] }
/** وجهُ الكود: نسبةٌ أو مبلغ — قرارُ ١ أكتوبر ٢٠٢٦ (البند 4-10) */
type CodeMode = "percent" | "amount";
const EMPTY_CODE_FORM = { mode: "percent" as CodeMode, percentOff: "", amountOff: "", labelAr: "", maxUses: "", expiresAt: "" };
/** دورةٌ بمئةٍ للمثال — حين لا دورةَ مفتوحةً له بعدُ يُقرأ جدولُها */
const EXAMPLE_PRICE = 100;
const PURCHASE_FORMS = { one: "شراء مدفوع", two: "شراءين مدفوعين", few: "مشتريات مدفوعة", many: "شراء مدفوعا" } as const;
const USE_FORMS = { one: "استعمال", two: "استعمالين", few: "استعمالات", many: "استعمالا" } as const;
/** «شارك دوراتك»: كودُنا على دوراته (لا يُحسم منه، `share-code.ts`)، ووجهُه وأكوادُه — لما يُصمَّم ويُنشر */
interface ShareKitData {
  code: string; percentOff: number; name: string; headline: string | null; photoUrl: string | null
  hisCodes: { code: string; percentOff: number | null }[]
  /** روابطُه قصيرةً لما يُنشر — وإن غاب رابطٌ قصيرٌ نُشر الطويل */
  short: { wide: string | null; cohorts: Record<string, string> }
  /** بصمةُ معاينة كلّ رابطٍ قصيرٍ برمزه — وما تغيّر يُرسم ويُرفع (`link-preview.ts`) */
  previews?: Record<string, string | null>
  /** ما بلغه كلُّ رابطٍ قصيرٍ برمزه — كم فتحه ومن أيّ منصّة، وكم سجّل منه (`link-opens.ts`) */
  reach?: Record<string, { opens: number; byVia: Record<string, number>; registered: number }>
  /** أتمّ شعبةً من قبل — فتُفتح لوحتُه على «دعوة لدوراتي» (`modeFor` في `share-kit.ts`) */
  taughtBefore?: boolean
}

/** رابطُ شعبةٍ بعينها — يُنشَر وحدَه لمن يدعو إلى دفعةٍ لا إلى كلّ ما يدرّب */
interface CohortLink {
  cohortId: string; title: string; termTitleAr: string | null; status: string
  registrationOpen: boolean; learners: number; code: string; url: string
  /** اسمُ الدورة وأوّلُ لقاء — لما يُنشر عنها */
  courseTitle: string; startsAt: string | null
}
const REGISTERED_FORMS = { one: "متعلّم واحد", two: "متعلّمان", few: "متعلّمين", many: "متعلّما" } as const;


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
      .catch((e) => setErr(permissionMessage(e, "تعذّر تحميل أكوادك")));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state) return err ? <Inset as="p" tone="danger" className="mb-6 px-4 py-3 text-read leading-6 text-red-200">{err}</Inset> : null;
  const { terms, codes, budget, pricing } = state;

  const byPercent = form.mode === "percent";
  const raw = byPercent ? form.percentOff : form.amountOff;
  const input = {
    percentOff: byPercent && raw.trim() !== "" ? Number(raw) : null,
    amountOff: !byPercent && raw.trim() !== "" ? Number(raw) : null,
    labelAr: form.labelAr,
    maxUses: form.maxUses.trim() === "" ? null : Number(form.maxUses),
    expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`) : null,
  };
  /* الحاجزُ من القواعد نفسِها التي يردّ بها الخادم — لا نصٌّ ثانٍ هنا */
  const blocker = raw.trim() === "" ? null : codeBlockerAr(input);
  const ready = raw.trim() !== "" && blocker === null && form.labelAr.trim().length >= 2;
  /* ═══ وقيمتُه بالدولار قبل أن يُصدَر (البند 4-10) ═══
     من `codeValueRows` و`codeQuoteFor` اللتين تحسبان بالسلّة نفسِها — فالرقمُ
     الذي يراه هو الذي يُحسم، وما يدفعه المتعلّمُ ما تقوله السلّة لا طرحٌ هنا.
     وحين لا دورةَ مفتوحةً له يُقرأ مثالٌ بمئة. */
  const face = { percentOff: input.percentOff, amountOff: input.amountOff };
  const rows = blocker === null && raw.trim() !== "" ? codeValueRows(face, pricing) : [];
  const example = blocker === null && raw.trim() !== "" ? codeQuoteFor(face, EXAMPLE_PRICE) : null;

  const act = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true); setErr("");
    try { await fn(); load(); return true; }
    catch (e) { setErr(e instanceof ApiError ? e.message : fallback); return false; }
    finally { setBusy(false); }
  };

  const create = async () => {
    const ok = await act(() => apiPost("/api/trainer/me/codes", {
      ...(input.percentOff != null ? { percentOff: input.percentOff } : { amountOff: input.amountOff }),
      labelAr: input.labelAr.trim(),
      ...(input.maxUses != null ? { maxUses: input.maxUses } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
    }), "تعذّر إصدار الكود");
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
        <TicketPercent className="h-4 w-4 text-gold-ink" aria-hidden="true" /> أكواد خصم أصدرها بنفسي
      </p>

      <p className="mt-2 text-read leading-7 text-muted-foreground">
        كود خصم <b className="text-foreground">بنسبة أو بمبلغ تحدّده</b> تنشره لمن تشاء. يقع على
        <b className="text-foreground"> دوراتك وحدها</b> بعد خصوم الأكاديميّة، مرّة لكلّ متعلّم، ولا يتجاوز
        <b className="text-foreground"> {MAX_TRAINER_CODE_PERCENT}٪ من سعر الدورة</b>. وترى قيمته بالدولار قبل إصداره.
        {" "}ما يمنحه فعلا في كلّ شراء مدفوع يحسم <b className="text-foreground">من مستحقّاتك</b> في أوّل كشف لك، وينقص
        الحسم بقدر ما ردّ من ثمن (البند 4-10). وخصوم الأكاديميّة لا تنقص أتعابك (البند 4-9).
      </p>

      {/* ═══ ورصيدُه — يُسقَف بما له عندنا (٢٨ سبتمبر ٢٠٢٦) ═══

          يُقرأ قبل أن يُفاجأ بكودٍ لم يقع: المشتري يرى «بلغ حدَّه الآن» ولا يرى
          السبب — فالسببُ يُقال لصاحبه هنا. والرقمُ قبل أيّ شراء، وكلُّ شراءٍ
          يزيده بأجر مقعده؛ فهو أدنى ما يسعه كودُه لا أقصاه. */}
      {terms.accepted && (
        <Inset as="p" className="mt-3 px-4 py-3 text-read leading-7 text-muted-foreground">
          رصيد أكوادك الآن: <b dir="ltr" className="font-mono text-foreground">{budget.remaining} {budget.currency}</b> —
          كشوفك غير المصروفة وما يتوقّع من شعبك المفتوحة، ناقصا ما منحته أكوادك ولم يحسم.
          يقع الكود ما وسع هذا الرصيد (مع أجر مقعد الشراء نفسه) خصمه؛ وإلّا أكمل المشتري بدونه ولا يحسم منك شيء.
        </Inset>
      )}

      {err && <Inset as="p" tone="danger" className="mt-3 px-4 py-3 text-read leading-6 text-red-200">{err}</Inset>}

      {/* ═══ من وقّع على «المبلغ» يقبل الصيغةَ الجديدة مرّةً واحدة ═══

          بنصّ البند كما يُطبع في العقد — من الخادم، من الثابت نفسِه الذي
          يُطبع في المتن. فلا يقرأ هنا غيرَ ما يُحسم به منه. */}
      {!terms.accepted ? (
        <Inset className="mt-4 px-4 py-4">
          <p className="text-read font-black text-foreground">البند 4-10 بصيغته الجديدة — اقبله مرّة واحدة</p>
          {/* ═══ ولا يُفترض ما وقّع عليه (١ أكتوبر ٢٠٢٦) ═══
              كانت الجملةُ «وقّعتَ عقدك على خصمٍ بمبلغٍ معلوم» — صادقةً حين كان
              السائلُ من وقّع قبل الجيل الثالث عشر. وصار يُسأل كذلك من قبل
              الصيغةَ الأولى للكود، وتلك ليست ما وقّع عليه. فتُقال الصيغةُ الجديدةُ
              بما صار فيها، لا بما ظُنّ أنّه كان عنده. */}
          <p className="mt-1 text-read leading-7 text-muted-foreground">
            تغيّرت صيغة البند: <b className="text-foreground">صار الكود نسبة أو مبلغا</b>، ولا يتجاوز
            {" "}{MAX_TRAINER_CODE_PERCENT}٪ من سعر الدورة. لا يصدر كود قبل قبولها. نصّها كما في العقد:
          </p>
          <blockquote className="mt-3 border-s-2 border-gold/50 ps-3 text-read leading-7 text-foreground">{terms.clauseAr}</blockquote>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-read leading-6 text-foreground">
            <input type="checkbox" checked={agree} disabled={busy} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            قرأت البند 4-10 بصيغته هذه، وأقبل أن يحسم من مستحقّاتي ما تمنحه أكوادي على هذا النحو.
          </label>
          <Button tone="confirm" size="sm" className="mt-3" loading={busy} disabled={!agree}
            onClick={() => void act(() => apiPost("/api/trainer/me/codes/terms/accept"), "تعذّر حفظ قبولك")}>
            أقبل البند بصيغته الجديدة
          </Button>
        </Inset>
      ) : !open ? (
        <Button tone="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>أصدر كودا</Button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* ═══ نسبةٌ أو مبلغ (١ أكتوبر ٢٠٢٦) ═══
              قرارُ صاحب المنصّة: «يحقّ للمدرّب أن يختار إمّا نسبةً أو رقما».
              والمبلغُ رقمٌ يقابله المدرّبُ برقم أتعابه، والنسبةُ تتبدّل بسعر كلّ دورة. */}
          <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="وجه الكود">
            <Button tone={byPercent ? "secondary" : "ghost"} size="sm" disabled={busy} aria-pressed={byPercent}
              onClick={() => setForm({ ...form, mode: "percent" })}>بنسبة</Button>
            <Button tone={byPercent ? "ghost" : "secondary"} size="sm" disabled={busy} aria-pressed={!byPercent}
              onClick={() => setForm({ ...form, mode: "amount" })}>بمبلغ</Button>
          </div>
          {byPercent ? (
            <StaffField label="النسبة" hint={`عدد صحيح بين ${MIN_TRAINER_CODE_PERCENT} و${MAX_TRAINER_CODE_PERCENT}.`}>
              <input
                type="number" inputMode="numeric" dir="ltr" min={MIN_TRAINER_CODE_PERCENT} max={MAX_TRAINER_CODE_PERCENT} step="1"
                value={form.percentOff} disabled={busy}
                onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
                className={`${staffControlCls} text-left`}
              />
            </StaffField>
          ) : (
            <StaffField label="المبلغ بالدولار"
              hint={`حتّى ${MAX_TRAINER_CODE_AMOUNT} — وما يمنح فعلا لا يتجاوز ${MAX_TRAINER_CODE_PERCENT}٪ من سعر الدورة.`}>
              <input
                type="number" inputMode="decimal" dir="ltr" min={1} max={MAX_TRAINER_CODE_AMOUNT} step="0.01"
                value={form.amountOff} disabled={busy}
                onChange={(e) => setForm({ ...form, amountOff: e.target.value })}
                className={`${staffControlCls} text-left`}
              />
            </StaffField>
          )}
          <StaffField label="لمن أو أين تنشره؟" hint="اسم تعرفه به، يطبع في كشفك.">
            <input
              value={form.labelAr} disabled={busy} maxLength={100}
              onChange={(e) => setForm({ ...form, labelAr: e.target.value })}
              className={staffControlCls}
            />
          </StaffField>
          <StaffField label="أقصى عدد من الاستعمالات (اختياري)" hint="فارغ = بلا حدّ.">
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
          {/* ═══ ما يمنحه كودُك على كلّ دورةٍ من دوراتك — قبل أن يُصدَر (البند 4-10) ═══

              شكوى المدرّب التي جاء بها هذا الجدول: «يأخذ ١٥ عن هذا الشخص ويعطيه
              خصما بعشرين، فيخسر فيه خمسة». فيرى لكلّ دورةٍ ما يُحسم منه، ويُنبَّه حين
              يزيد على أجر مقعده — والقرارُ له. والأرقامُ من `codeValueRows` التي
              تحسب بها السلّةُ نفسُها، على شراء الدورة وحدَها بلا خصمٍ آخر. */}
          {rows.length > 0 && (
            <Inset className="px-4 py-3 text-read leading-6 text-muted-foreground sm:col-span-2">
              <p className="font-bold text-foreground">ما يمنحه كودك على كلّ دورة — إن اشتريت وحدها</p>
              <ul className="mt-2 space-y-2">
                {rows.map((r) => (
                  <li key={r.cohortId}>
                    <span className="text-foreground">{r.titleAr}</span> — بسعر{" "}
                    <span dir="ltr" className="font-mono">{r.price} {r.currency}</span>: يدفع المتعلّم{" "}
                    <span dir="ltr" className="font-mono text-foreground">{r.pays} {r.currency}</span>، ويحسم منك{" "}
                    <b dir="ltr" className="font-mono text-gold-ink">{r.value} {r.currency}</b>
                    {r.capped && <> — سقفه {MAX_TRAINER_CODE_PERCENT}٪ من سعرها</>}
                    {r.exceedsSeatFee && r.seatFee !== null && (
                      <p className="mt-1 font-bold text-danger-ink">
                        انتبه: هذا أكثر من أجر المقعد العامّ هنا (<span dir="ltr" className="font-mono">{r.seatFee} {r.currency}</span>)
                        — من استعمله ولم يأت من رابطك ينقص كشفك بالفرق.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2">ومع خصم باقة من الأكاديميّة يقع الكود على ما بقي، فيقلّ ما يحسم منك.</p>
            </Inset>
          )}
          {rows.length === 0 && example !== null && example.value > 0 && (
            <Inset as="p" className="px-4 py-3 text-read leading-6 text-muted-foreground sm:col-span-2">
              مثال: دورة بمئة، بلا خصم آخر — يدفع المتعلّم <b className="text-foreground">{example.pays}</b>،
              ويحسم منك <b className="text-gold-ink">{example.value}</b>. وجدول دوراتك يظهر حين تفتح لك شعبة.
            </Inset>
          )}
          {blocker && (
            <Inset as="p" tone="danger" className="px-4 py-3 text-read leading-6 text-red-200 sm:col-span-2">{blocker}</Inset>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button tone="confirm" size="sm" loading={busy} disabled={!ready} onClick={() => void create()}>
              أصدر ويحسم منّي
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => { setOpen(false); setForm(EMPTY_CODE_FORM); }}>
              تراجع
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
                    <span dir="ltr" className="font-mono">{codeFaceAr(c, (a) => `${a} ${c.currency}`)}</span> — {c.labelAr}
                  </span>
                  <span className="text-read text-muted-foreground">{c.stateAr}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    readOnly dir="ltr" value={c.code} aria-label={`كود ${c.labelAr}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`${staffControlCls} min-w-0 flex-1 text-left font-mono`}
                  />
                  <Button tone="secondary" size="sm" onClick={() => copy(c.code)}>
                    {copied === c.code ? "نسخ" : "انسخ الكود"}
                  </Button>
                  {c.status === "live" && (
                    <Button tone="ghost" size="sm" disabled={busy}
                      onClick={() => void act(() => apiPost(`/api/trainer/me/codes/${c.id}/pause`), "تعذّر إيقاف الكود")}>أوقفه</Button>
                  )}
                  {c.status === "paused" && (
                    <Button tone="secondary" size="sm" disabled={busy}
                      onClick={() => void act(() => apiPost(`/api/trainer/me/codes/${c.id}/resume`), "تعذّر استئناف الكود")}>استأنفه</Button>
                  )}
                  {c.status !== "revoked" && (
                    <Button tone="danger" size="sm" disabled={busy}
                      onClick={() => void act(() => apiPost(`/api/trainer/me/codes/${c.id}/revoke`), "تعذّر إلغاء الكود")}>ألغه</Button>
                  )}
                </div>
                <p className="mt-2 text-read leading-6 text-muted-foreground">
                  {c.uses.paid === 0
                    ? "لم يستعمل في شراء مدفوع بعد"
                    : <>استعمل في {countAr(c.uses.paid, PURCHASE_FORMS)}</>}
                  {c.maxUses != null && <> · حدّه {countAr(c.maxUses, USE_FORMS)}</>}
                  {c.expiresAt && <> · ينتهي {fmtDateAr(c.expiresAt)}</>}
                  {deducted > 0 && <> · حسم منك <span dir="ltr" className="font-mono">{deducted} {c.currency}</span></>}
                  {c.pending > 0 && <> · ينتظر الحسم <span dir="ltr" className="font-mono">{c.pending} {c.currency}</span></>}
                  {c.pending < 0 && <> · يعاد إليك <span dir="ltr" className="font-mono">{-c.pending} {c.currency}</span></>}
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
      .catch((e) => setErr(permissionMessage(e, "تعذّر تحميل خصومك القديمة")));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!discounts || discounts.length === 0) return null;

  const revoke = async (id: string) => {
    setBusy(true); setErr("");
    try {
      await apiPost(`/api/trainer/me/discounts/${id}/revoke`);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر إلغاء الخصم");
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
      <p className="text-sm font-black">خصوم أصدرتها بالمبلغ قبل الأكواد</p>
      <p className="mt-2 text-read leading-7 text-muted-foreground">
        تبقى على شروطها حتّى تستعمل أو تنتهي أو تلغيها، ولا يصدر جديد منها.
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
                readOnly dir="ltr" value={d.code} aria-label={`رمز خصم ${d.forWhomAr}`}
                onFocus={(e) => e.currentTarget.select()}
                className={`${staffControlCls} min-w-0 flex-1 text-left font-mono`}
              />
              <Button tone="secondary" size="sm" onClick={() => copy(d.code)}>
                {copied === d.code ? "نسخ" : "انسخ الرمز"}
              </Button>
              {d.status === "live" && (
                <Button tone="danger" size="sm" disabled={busy} onClick={() => void revoke(d.id)}>ألغه</Button>
              )}
            </div>
            {/* والتواريخُ تُقال حين تقع: «استُعمل» بلا متى خبرٌ ناقص */}
            {(d.usedAt || d.settledAt) && (
              <p className="mt-2 text-read leading-6 text-muted-foreground">
                {d.usedAt && <>استعمل {fmtDateAr(d.usedAt)}</>}
                {d.settledAt && <> · حسم من كشفك {fmtDateAr(d.settledAt)}</>}
              </p>
            )}
          </Inset>
        ))}
      </ul>
    </Panel>
  );
}

/** الرابطُ كما يُعرض في خانته: بلا «https://» — فيسع آخرُه، وهو ما يميّزه، خانةَ الهاتف. وما يُنسخ بالزرّ الرابطُ كاملا */
const bare = (url: string) => url.replace(/^https?:\/\//, "");

const PEOPLE_FORMS = { one: "شخص", two: "شخصان", few: "أشخاص", many: "شخصا" } as const;

/* ═══ كم فتح رابطَه، ومن أين (٢٧ أكتوبر ٢٠٢٦) ═══
   «يرى المدرّبُ كم فتح رابطَه وكم سجّل منه، وأيُّ منصّةٍ تجلب» — اقترحه Claude فقال صاحبُ المنصّة: «كلّهم».
   سطرٌ تحت الرابط القصير: «فتحه 12 شخصا · سجل منه 2 — واتساب 8 · لينكدإن 4». والزاحفُ لا يُعدّ (`link-opens.ts`). */
function LinkReachLine({ url, reach, registered = true }: {
  url: string; reach: ShareKitData["reach"];
  /** ورابطُه العامُّ يقول مسجّليه في رأس بطاقته — فلا يُكرَّر بعددٍ آخر */
  registered?: boolean;
}) {
  const r = reach?.[url.split("/").pop() ?? ""];
  if (!r) return null;
  if (r.opens === 0) return <p className="mt-1.5 text-read text-muted-foreground">لم يفتحه أحد بعد.</p>;
  const vias = Object.entries(r.byVia).sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v === "direct" ? "نسخ مباشر" : VIA_AR[v] ?? v} ${n}`);
  return (
    <p className="mt-1.5 text-read text-muted-foreground">
      <b className="text-foreground">فتحه {countAr(r.opens, PEOPLE_FORMS)}</b>
      {registered && ` · سجل منه ${r.registered}`}
      {vias.length > 0 && ` — ${vias.join(" · ")}`}
    </p>
  );
}

/** الكودُ الذي يظهر في منشوره: أعلى الخصمين، وكودُه إن ساوى خصمَنا (`bestCode`) */
const shareCodeOf = (k: ShareKitData) => bestCode({ code: k.code, percentOff: k.percentOff }, k.hisCodes);

export default function Referral() {
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cohortLinks, setCohortLinks] = useState<CohortLink[] | null>(null);
  /* وإخفاقُها يُقال لا يُقرأ «لا شعبة مفتوحة» (٢٠ أكتوبر ٢٠٢٦) — من له شعبٌ مفتوحةٌ كان يُقال له إنّه لا شعبةَ له */
  const [linksDown, setLinksDown] = useState(false);
  const [kit, setKit] = useState<ShareKitData | null>(null);
  /* ═══ وإخفاقُه يُقال لا يُخفي اللوحة (٢٧ أكتوبر ٢٠٢٦) ═══
     سأل صاحبُ المنصّة: «أين قسم صمّم؟». كانت لوحةُ «صمم منشورك» وكودُنا يُرسمان على نجاح هذا النداء وحدَه، وإخفاقُه
     يُبتلع — فيختفي أهمُّ ما في الصفحة بلا كلمة. فاللوحةُ قائمةٌ دائما، وإن تعذّر قيل لمَ، وبجانبه «أعد المحاولة». */
  const [kitErr, setKitErr] = useState<string | null>(null);
  const loadKit = useCallback(() =>
    apiGet<ShareKitData>("/api/trainer/me/share-kit")
      .then((r) => { setKit(r); return true; })
      .catch((e) => { setKitErr(permissionMessage(e, "تعذّر تحميل منشورك")); return false; }), []);
  /* لوحةُ مشاركة الشعبة المفتوحة: معرّفُها — ولوحةُ دوراته كلِّها مفتوحةٌ دائما */
  /* ═══ والبريدُ يفتح لوحةَ الشعبة نفسِها (٢٧ أكتوبر ٢٠٢٦) ═══
     «انشر دورتك الآن» قبل البدء بأسبوع (`share-reminder.service.ts`) زرُّه `?share=<الشعبة>` — فيصل المدرّبُ إلى منشورها
     الجاهز لا إلى رأس الصفحة يبحث عنه */
  const [params] = useSearchParams();
  const [sharing, setSharing] = useState<string | null>(() => params.get("share"));
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
      .catch(() => { if (alive) { setCohortLinks([]); setLinksDown(true); } });
    /* وكودُنا على دوراته: إخفاقُه لا يُعطّل الروابط، ويُقال في لوحته */
    void loadKit();
    return () => { alive = false };
  }, [loadKit]);

  /* وتُنزل الصفحةُ إلى الشعبة التي جاء البريدُ بها حين تظهر */
  useEffect(() => {
    const id = params.get("share");
    if (id && kit && cohortLinks?.some((c) => c.cohortId === id)) {
      document.getElementById(`share-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [params, kit, cohortLinks]);

  /* ومعاينةُ روابطه حين تُلصق في واتساب وفيسبوك: تُرسم هنا وتُرفع إن تغيّر ما رُسمت منه (`link-preview.ts`) */
  useEffect(() => {
    if (!kit || !cohortLinks) return;
    void syncLinkPreviews(previewFaceOf(kit), previewLinksOf(kit, cohortLinks), kit.previews ?? {});
  }, [kit, cohortLinks]);

  return (
    /* قسمٌ في «مستحقاتي» لا شاشةٌ بلسانها (الخطوة G، ١٩ أكتوبر ٢٠٢٦) — والإطارُ إطارُها */
    <>
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}

      {/* ف-١: تُفتتح بسؤالٍ عمّا يوصي به، لا بشرحِ آليّةِ الرابط.
          ═══ وبلا لوحةٍ حولها (٢٦ أكتوبر ٢٠٢٦) ═══
          «المربّعات تأخذ حجما أكبر من قيمتها بالصفحة ولا نستغلّ المساحات» (صاحب المنصّة). فالسؤالُ عنوانُ الصفحة
          لا لوحةٌ بنفسها، ولوحةُ «ولم يعنيك أن يسجّلوا من رابطك» صارت سطرا تحته يحيل إلى «مستحقاتي» —
          يُقال إنّ الإحالةَ أعلى ولا يُكتب رقمُها هنا: رقمٌ منسوخٌ في صفحتين يفترق عن أصله يوما. */}
      <div className="mb-5">
        <h2 className="text-lg font-black">ما الذي توصي به من يتابعك؟</h2>
        <p className="mt-1 text-read leading-7 text-muted-foreground">
          من سجّل من رابطك تراه بعلامة «عبر رابطك» في طلبتك، وأجرك عنه أعلى —{" "}
          <Link to="/trainer/earnings" className="inline-flex items-center gap-1 font-bold text-teal-light-ink hover:text-foreground">
            <Wallet className="h-4 w-4" aria-hidden="true" /> رقمه في «مستحقاتي»
          </Link>
        </p>
      </div>

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
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
        </div>
      )}

      {referral && (
        <>
          {/* ═══ «صمّم منشورك» أوّلا، ومفتوحا للجميع (٢٦ أكتوبر ٢٠٢٦) ═══
              قال صاحبُ المنصّة: «صمّم منشورك هو الأهمّ، اتركها مفتوحة للجميع». فكانت زرّا يُفتح في لوحةٍ ثالثة،
              وصارت أوّلَ ما في الصفحة مفتوحةً بلا نقرة — بدوراته كلِّها ورابطه العامّ، وكاروسيلٌ بشريحةٍ لكلّ دورة.
              ومن لا شعبةَ مفتوحةً له يرى اللوحةَ ويُقال له متى يظهر منشوره: منشورٌ بلا دورةٍ لا يُرسم. */}
          <Panel as="section" className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Share2 className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> صمم منشورك
              </h2>
              <p className="text-read text-muted-foreground">صورة فيها صورتك ودوراتك والكود، ونص جاهز لكل منصة.</p>
            </div>
            {!kit && kitErr ? (
              <Inset tone="danger" className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3" role="alert">
                <p className="text-read leading-6 text-red-200">{kitErr}</p>
                <Button tone="secondary" size="sm" onClick={() => { setKitErr(null); void loadKit(); }}>أعد المحاولة</Button>
              </Inset>
            ) : !kit || cohortLinks === null ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
              </div>
            ) : cohortLinks.length > 0 ? (
              <ShareKit face={kit} fileStem="wajeez-courses" url={kit.short.wide ?? referral.url} code={shareCodeOf(kit)} taughtBefore={kit.taughtBefore}
                courses={cohortLinks.map((c) => ({ courseTitle: c.courseTitle, startsAt: c.startsAt, url: c.url }))} />
            ) : (
              <Inset as="p" className="mt-3 px-4 py-3 text-read leading-6 text-muted-foreground">
                {linksDown ? "تعذّر جلب شعبك الآن. أعد فتح الصفحة بعد قليل." : "يظهر منشورك هنا حين تفتح لك شعبة."}
              </Inset>
            )}
          </Panel>

          {/* ═══ الكودُ والرابطُ جنبا إلى جنب (٢٦ أكتوبر ٢٠٢٦) ═══
              كانا لوحتين بعرض الصفحة لسطرٍ واحدٍ في كلٍّ منهما. فصارا عمودين في صفٍّ واحد — وعلى الهاتف واحدا فوق الآخر. */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {/* ═══ كودُنا على دوراته (`share-code.ts`) ═══
                «نعطي خصومات للدورات التي يسوّقها المدرّبون ولا تنقص من حسابهم — بل فقط هذه منّا نحن». */}
            {kit && (
              <Card as="section" tone="accent">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-black">
                    <Gift className="h-4 w-4 text-gold-ink" aria-hidden="true" /> خصم منا لمتابعيك
                  </p>
                  <Chip tone="accent"><span dir="ltr">{kit.percentOff}%</span></Chip>
                </div>
                <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                  على دوراتك وحدها، <b className="text-foreground">ولا يحسم منك شيء</b>. ومن اشترى به يحسب لك بأجر الإحالة، ولو لم يدخل من رابطك.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    readOnly dir="ltr" value={kit.code} aria-label="كود الخصم لمتابعيك"
                    onFocus={(e) => e.currentTarget.select()}
                    className={`${staffControlCls} min-w-0 flex-1 text-center font-mono font-black tracking-wider`}
                  />
                  <Button tone="secondary" size="sm" icon={Copy} onClick={() => copy("share-code", kit.code)}>
                    {copied === "share-code" ? "نسخ" : "انسخ الكود"}
                  </Button>
                </div>
              </Card>
            )}

            <Card as="section" className={kit ? undefined : "lg:col-span-2"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-black">
                  <Link2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رابطي العامّ
                </p>
                <span className="flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  {referral.registered > 0 ? `سجّل عبره ${countAr(referral.registered, REGISTERED_FORMS)}` : "لم يسجّل أحد عبره بعد"}
                </span>
              </div>
              <p className="mt-1.5 text-read leading-6 text-muted-foreground">صفحتك بكلّ شعبك المفتوحة.</p>
              {/* الرابطُ يُعرض كما يُقرأ: `referral.service` لا يرمّز المسارَ،
                  فاسمُه العربيُّ يبقى عربيّا في خانة النسخ كما في العنوان. */}
              {/* ═══ والرابطُ سطرٌ بنفسه، والأزرارُ تحته (٢٦ أكتوبر ٢٠٢٦) ═══
                  في نصف العرض وعلى الهاتف كانت الخانةُ تضيق بجانب زرّيها فلا يُرى من الرابط إلّا أوّلُه
                  («https://www.waj…»)، وآخرُه هو ما يميّزه. فصارت الخانةُ بعرض البطاقة. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* والرابطُ المعروضُ قصيرٌ إن كان (٢٦ أكتوبر ٢٠٢٦): «هل يمكن أن تكون الروابطُ أقصرَ وأكثرَ احترافيّة؟» —
                    ‎/s/XXXXXX يحمل إلى الرابط نفسِه، فما يُنسخ هو ما يُنشر (`short` في `share-kit`) */}
                <input
                  readOnly dir="ltr" value={bare(kit?.short.wide ?? referral.url)} aria-label="رابطي العامّ"
                  onFocus={(e) => e.currentTarget.select()}
                  className={`${staffControlCls} min-w-0 basis-full text-left`}
                />
                <Button tone="secondary" size="sm" icon={Copy} onClick={() => copy("wide", kit?.short.wide ?? referral.url)}>
                  {copied === "wide" ? "نسخ" : "انسخ الرابط"}
                </Button>
                <a href={referral.url} target="_blank" rel="noreferrer" aria-label="عاين صفحتك"
                  className="inline-flex shrink-0 items-center gap-1 text-read font-bold text-teal-light-ink hover:text-foreground">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> عاينها
                </a>
              </div>
              {kit?.short.wide && <LinkReachLine url={kit.short.wide} reach={kit.reach} registered={false} />}
              {/* البوّابةُ تُقال لا تُخفى: من لم يُعتمد نشرُ ملفّه رابطُه لا يفتح
                  بعد — فيُقال له لمَ ومَن يرفعه، لا يُعطى رابطا يردّ ٤٠٤. */}
              {!referral.publicReady && (
                <Inset as="p" className="mt-3 px-4 py-3 text-read leading-6 text-muted-foreground">
                  صفحتك لا تفتح للعامّة بعد: تفتح حين تعتمد الإدارة نشر ملفّك وتكون لك دورة منشورة هذا الفصل. ثمّ يعمل الرابط نفسه.
                </Inset>
              )}
            </Card>
          </div>

          {/* ═══ رابطٌ لكلّ شعبةٍ مفتوحة — نُقل إلى هنا (١٥ سبتمبر ٢٠٢٦) ═══

              كان داخلَ الشعبة في «مركز التواصل»: يفتح المدرّبُ شعبةً فيجد
              رابطَها، ولا يجد روابطَ شعبه الأخرى إلّا بفتح كلِّ واحدةٍ على
              حدة. ومن أراد أن يدعو إلى ثلاثِ دفعاتٍ فتح ثلاثَ شاشات.

              وقرارُ صاحب المنصّة: تُجمع في «دعوتي» خارجَ الشعب، إلى جانب
              رابط ملفّه الكامل — «إمّا أن يحصل على رابطٍ لملفّه الكامل كما
              هو موجودٌ حاليّا، أو أن يقوم بدعوة جمهوره لكلّ شعبةٍ مفتوحةٍ
              برابطٍ منفصل».

              والمفتوحةُ وحدَها: رابطٌ إلى مسودّةٍ أو إلى شعبةٍ انتهت يُحرج
              ناشرَه ويردّ من فتحه إلى صفحةٍ لا تقبل تسجيلا.

              وصارت صفوفا تفصلها خطوطٌ لا صناديقَ داخل صندوق (٢٦ أكتوبر ٢٠٢٦): اسمُ الدورة وحالُها في سطر،
              والرابطُ وأزرارُه في سطرٍ تحته. */}
          {cohortLinks !== null && (
            <Panel as="section" className="mb-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex items-center gap-2 text-sm font-black">
                  <Link2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رابط لكلّ شعبة
                </p>
                {!linksDown && cohortLinks.length > 0 && (
                  <p className="text-read text-muted-foreground">كلّ رابط لشعبته وحدها، ومن سجّل منه يحسب لك بأجر الإحالة.</p>
                )}
              </div>
              {linksDown ? (
                <p className="mt-2 text-read leading-7 text-muted-foreground" role="status">
                  تعذّر جلب روابط شعبك الآن. أعد فتح الصفحة بعد قليل — ورابطك العامّ أعلاه يعمل.
                </p>
              ) : cohortLinks.length === 0 ? (
                <p className="mt-2 text-read leading-7 text-muted-foreground">
                  لا شعبة مفتوحة لك الآن. يظهر رابطها هنا حين تفتح، ورابطك العامّ يبلغها تلقائيّا.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-white/8">
                  {cohortLinks.map((c) => (
                    <li key={c.cohortId} id={`share-${c.cohortId}`} className="scroll-mt-24 py-3 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-read font-bold text-foreground">{c.courseTitle}</span>
                        <span className="text-read text-muted-foreground">
                          {c.termTitleAr ? `${c.termTitleAr} · ` : ""}
                          {c.learners > 0 ? countAr(c.learners, REGISTERED_FORMS) : "لم يسجّل أحد بعد"}
                        </span>
                      </div>
                      {/* وحالةُ التسجيل تُقال: رابطٌ إلى شعبةٍ أُغلق تسجيلُها
                          يعمل ولا يُسجَّل منه أحد، فيُظنُّ الرابطُ عاطلا. */}
                      {!c.registrationOpen && (
                        <p className="mt-1 text-read leading-6 text-gold-ink">
                          التسجيل مغلق حتّى تفتحه الإدارة — الرابط يعمل.
                        </p>
                      )}
                      {/* وعلى الهاتف سطرٌ بنفسه كالرابط العامّ — وعلى الشاشة الأعرض بجانب زرّيه */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          readOnly dir="ltr" value={bare(kit?.short.cohorts[c.cohortId] ?? c.url)} aria-label={`رابط دعوتي إلى ${c.title}`}
                          onFocus={(e) => e.currentTarget.select()}
                          className={`${staffControlCls} min-w-0 basis-full text-left sm:basis-0 sm:flex-1`}
                        />
                        <Button tone="secondary" size="sm" icon={Copy} onClick={() => copy(c.cohortId, kit?.short.cohorts[c.cohortId] ?? c.url)}>
                          {copied === c.cohortId ? "نسخ" : "انسخ الرابط"}
                        </Button>
                        {kit && (
                          <Button tone={sharing === c.cohortId ? "confirm" : "secondary"} size="sm" icon={Share2}
                            aria-expanded={sharing === c.cohortId}
                            onClick={() => setSharing((s) => (s === c.cohortId ? null : c.cohortId))}>
                            {sharing === c.cohortId ? "أخف" : "شارك"}
                          </Button>
                        )}
                      </div>
                      {kit?.short.cohorts[c.cohortId] && <LinkReachLine url={kit.short.cohorts[c.cohortId]} reach={kit.reach} />}
                      {kit && sharing === c.cohortId && (
                        <ShareKit face={kit} fileStem={`wajeez-${c.code}`} url={kit.short.cohorts[c.cohortId] ?? c.url} code={shareCodeOf(kit)} taughtBefore={kit.taughtBefore}
                          courses={[{ courseTitle: c.courseTitle, startsAt: c.startsAt, url: c.url }]} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <MyCodes />
          <LegacyDiscounts />
        </>
      )}
    </>
  );
}
