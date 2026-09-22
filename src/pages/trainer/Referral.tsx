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
import { staffControlCls, staffAreaCls, StaffField } from "@/components/FormKit";
import { countAr } from "@/application/text/count-ar";
import { fmtDateAr } from "@/utils/format";
import {
  MAX_ISSUED_DISCOUNT, MIN_ISSUED_DISCOUNT, issueBlockerAr, type DiscountBudget,
} from "@/application/trainer/issued-discount";

interface MyReferral { code: string; slug: string; url: string; publicReady: boolean; registered: number }
/** خصمٌ أصدره المدرّبُ — كما يرسله `TrainerDiscountService.listFor` */
interface IssuedDiscount {
  id: string; code: string; status: string; statusAr: string;
  amount: number; currency: string; forWhomAr: string; noteAr: string | null;
  expiresAt: string | null; usedAt: string | null; settledAt: string | null;
  revokedAt: string | null; createdAt: string;
}
interface DiscountsState { budget: DiscountBudget; discounts: IssuedDiscount[] }
/** رابطُ شعبةٍ بعينها — يُنشَر وحدَه لمن يدعو إلى دفعةٍ لا إلى كلّ ما يدرّب */
interface CohortLink {
  cohortId: string; title: string; termTitleAr: string | null; status: string
  registrationOpen: boolean; learners: number; code: string; url: string
}
const REGISTERED_FORMS = { one: "متعلّمٌ واحد", two: "متعلّمان", few: "متعلّمين", many: "متعلّما" } as const;


/* ═══ خصومي — مبلغٌ من حسابي لشخصٍ أسمّيه ═══

   قرارُ صاحب المنصّة (٢١ سبتمبر ٢٠٢٦): «يحقّ له إصدارُ خصمٍ بقيمةٍ ماديّةٍ
   معيّنةٍ وليست نسبة… لتُخصم من حسابه في مستحقّاتي لاحقا». وموضعُها «دعوتي»
   بنصّ القرار — وهي أخت الرابط: كلاهما شيءٌ ينشره باسمه.

   ─────────── وثلاثةٌ تُقال قبل أن يُكتب الرقم ───────────

   · **أنّه من حسابه هو** — لا من الأكاديميّة. ومن لم يقرأها قبل أن يُصدر
     قرأها في كشفه بعد شهر، وذاك أسوأُ مواضع القراءة.
   · **ورصيدُه** — فلا يكتب رقما ثمّ يُردّ. والحدُّ يُحسب في الخادم ويُعرض
     هنا، ويُقرأ من قواعدَ واحدةٍ (`issue-blocker`) فلا تقول الشاشةُ شيئا
     ويقول الخادمُ غيرَه.
   · **وأنّ خصومنا نحن لا تمسّه** — البند 4-9. وهي الجملةُ التي تمنع أن
     يُقرأ هذا البابُ على أنّه «الخصومُ كلُّها صارت عليّ».

   ولا خانةَ للنسبة: ما لا بابَ له لا يُطلَب، ولا يُقال «النسبةُ غير متاحة». */
function MyDiscounts() {
  const [state, setState] = useState<DiscountsState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", forWhomAr: "", noteAr: "" });
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<DiscountsState>("/api/trainer/me/discounts")
      .then((d) => { setState(d); setErr(""); })
      .catch((e) => setErr(permissionMessage(e, "تعذّر تحميلُ خصومك")));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state) return null;
  const { budget, discounts } = state;

  const amount = Number(form.amount);
  /* الحاجزُ من قواعدَ يقرؤها الخادمُ نفسُه — لا نصٌّ ثانٍ يُكتب هنا */
  const blocker = form.amount.trim() === "" ? null : issueBlockerAr(amount, budget);
  const ready = form.amount.trim() !== "" && blocker === null && form.forWhomAr.trim().length >= 2;

  const issue = async () => {
    setBusy(true); setErr("");
    try {
      await apiPost("/api/trainer/me/discounts", {
        amount,
        forWhomAr: form.forWhomAr.trim(),
        ...(form.noteAr.trim() ? { noteAr: form.noteAr.trim() } : {}),
      });
      setForm({ amount: "", forWhomAr: "", noteAr: "" });
      setOpen(false);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر إصدارُ الخصم");
    } finally { setBusy(false); }
  };

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-black">
          <TicketPercent className="h-4 w-4 text-gold-ink" aria-hidden="true" /> خصمٌ أصدره بنفسي
        </p>
        <span className="text-read font-bold text-teal-light-ink" dir="rtl">
          رصيدُك القابل للخصم: <span dir="ltr" className="font-mono">{budget.remaining}</span> {budget.currency}
        </span>
      </div>

      <p className="mt-2 text-read leading-7 text-muted-foreground">
        لك أن تعطيَ شخصا بعينه خصما <b className="text-foreground">بمبلغٍ تحدّده أنت</b> على ما يشتريه من الأكاديميّة.
        وهذا الخصمُ <b className="text-foreground">من مستحقّاتك أنت</b>: إن استُعمل في شراءٍ دُفع، ظهر بندا باسمه
        في أوّل كشفٍ يُحرَّر لك ثمّ حُسم منه (البند 4-10 من عقدك). وما لم يُستعمَل لا يُحسم، ولك إلغاؤه ما دام كذلك.
      </p>
      <p className="mt-2 text-read leading-7 text-muted-foreground">
        وما تطرحه الأكاديميّةُ من خصومها هي — خصمُ الباقة والحملاتُ وأكوادُنا — لا يُنقص أتعابَك بشيء (البند 4-9).
      </p>

      {err && <Inset as="p" tone="danger" className="mt-3 px-4 py-3 text-read leading-6 text-red-200">{err}</Inset>}

      {!open ? (
        <Button
          tone="secondary" size="sm" className="mt-3"
          disabled={budget.remaining < MIN_ISSUED_DISCOUNT}
          onClick={() => setOpen(true)}
        >
          أصدِرْ خصما
        </Button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StaffField
            label={`المبلغ (${budget.currency})`}
            hint={`بين ${MIN_ISSUED_DISCOUNT} و${Math.min(MAX_ISSUED_DISCOUNT, budget.remaining)} — مبلغٌ لا نسبة.`}
          >
            <input
              type="number" inputMode="decimal" dir="ltr" min={MIN_ISSUED_DISCOUNT} step="0.01"
              value={form.amount} disabled={busy}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={`${staffControlCls} text-left`}
            />
          </StaffField>
          <StaffField label="لمن؟" hint="اسمٌ تعرفه به — يُطبع في كشفك لتعرف بعد شهرين عمّن حُسم.">
            <input
              value={form.forWhomAr} disabled={busy} maxLength={200}
              onChange={(e) => setForm({ ...form, forWhomAr: e.target.value })}
              className={staffControlCls}
            />
          </StaffField>
          <StaffField label="ملاحظة (اختيارية)" wide>
            <textarea
              rows={2} value={form.noteAr} disabled={busy} maxLength={500}
              onChange={(e) => setForm({ ...form, noteAr: e.target.value })}
              className={staffAreaCls}
            />
          </StaffField>
          {blocker && (
            <Inset as="p" tone="danger" className="px-4 py-3 text-read leading-6 text-red-200 sm:col-span-2">{blocker}</Inset>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button tone="confirm" size="sm" loading={busy} disabled={!ready} onClick={() => void issue()}>
              أصدِرْ ويُحسم منّي
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => { setOpen(false); setForm({ amount: "", forWhomAr: "", noteAr: "" }); }}>
              تراجعْ
            </Button>
          </div>
        </div>
      )}

      {discounts.length > 0 && (
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
      )}
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

          <MyDiscounts />

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
