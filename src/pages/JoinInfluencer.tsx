/* «انضم كمؤثر» — اتّفاقُ المؤثّر في صفحةٍ قصيرة، والنموذجُ تحتها (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «جهّز رابطا لاتّفاقيّة المؤثّر بكلّ التفاصيل: كيف يفعّل منصّته، وماذا يجد فيها، والاتّفاقُ
   الماليّ. والاتّفاقُ لكلّ فصل، وضع الشروط. باختصارٍ ووضوحٍ شديد. ومنها يتقدّم». فأربعةُ أقسامٍ قصيرة ثمّ النموذج:
   ما هي، وكيف تفعّل حسابك، وما تجده فيه، والاتّفاقُ الماليّ لكلّ فصل — وعلامةُ قبوله شرطٌ للإرسال.

   **والأرقامُ تُقرأ من الخادم ولا تُكتب هنا** (`/api/v1/influencer-applications/deal`): نسبةُ الخصم وعددُ الدورات من
   إعدادات منحة المؤثّرين، والعمولةُ من المقترحة. ولا حسابَ يُنشأ من هنا: يُنشأ ساعةَ يُقبَل، ويختار كلمتَه من رابط
   تفعيله. والنصوصُ في `src/application/commerce/influencer-application.ts` يقرؤها الخادمُ نفسُه. */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { seoFor } from "@/application/site/public-pages";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { Card, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { ConsentRow, Field, FieldRow, FieldSet, controlCls, invalidProps } from "@/components/FormKit";
import { PhoneCodePicker } from "@/components/CountryPicker";
import { HONEYPOT_FIELD, useHoneypot } from "@/components/HoneypotField";
import { normalizeApplicantLink } from "@/application/trainer/applicant-link";
import { fmtNum } from "@/application/text/format-ar";
import {
  INFLUENCER_ACTIVATION_STEPS_AR, INFLUENCER_DEAL_PATH, INFLUENCER_PLATFORMS, INFLUENCER_PORTAL_AR, MAX_INFLUENCER_ACCOUNTS,
  influencerExampleAr, influencerReach, influencerTermsAr, influencerWhatAr, type InfluencerDealView,
} from "@/application/commerce/influencer-application";

const selectCls = `${controlCls} [&>option]:bg-surface`;
const codeSelectCls = `${controlCls.replace("w-full", "")} w-32 shrink-0 px-2`;
const rowGridCls = "grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_9rem_auto]";
const fullRowCls = "col-span-2 sm:col-span-1";

/** الأرقامُ العربيّة والفارسيّة تُقرأ أرقاما — ويسقط ما سواها */
const digitsOnly = (v: string, max = 15) => v
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[^\d]/g, "")
  .slice(0, max);

interface AccountRow { platform: string; url: string; followers: string }

const EMPTY = { fullName: "", email: "", phoneCountryCode: "+962", phone: "", pitchAr: "" };

export default function JoinInfluencer() {
  const [deal, setDeal] = useState<InfluencerDealView | null>(null);
  const [dealFailed, setDealFailed] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [accounts, setAccounts] = useState<AccountRow[]>([{ platform: "instagram", url: "", followers: "" }]);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const hp = useHoneypot();

  useEffect(() => {
    apiGet<InfluencerDealView>(INFLUENCER_DEAL_PATH).then(setDeal).catch(() => setDealFailed(true));
  }, []);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const err = (key: string) => errors[key] ?? null;

  const filled = accounts.filter((a) => a.url.trim() || a.followers.trim());
  const reach = influencerReach(filled.map((a) => ({ followers: Number(digitsOnly(a.followers)) || 0 })));

  const check = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = "اكتب اسمك الكامل";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "اكتب بريدا صحيحا";
    if (form.phone.length < 6) e.phone = "اكتب رقمك بلا رمز الدولة";
    if (filled.length === 0) e.accounts = "اكتب حسابا واحدا على الأقل";
    filled.forEach((a, i) => {
      const link = normalizeApplicantLink(a.url);
      if (!a.url.trim()) e[`account-${i}`] = "اكتب رابط الحساب";
      else if (!link.ok) e[`account-${i}`] = link.messageAr;
      else if (!digitsOnly(a.followers)) e[`account-${i}`] = "اكتب عدد المتابعين";
    });
    if (form.pitchAr.trim().length < 10) e.pitchAr = "اكتب سطرا عن ذلك";
    if (!terms) e.terms = "وافق على الاتفاق لترسل طلبك";
    return e;
  };

  const submit = async () => {
    const found = check();
    setErrors(found);
    setFailed(null);
    if (Object.keys(found).length > 0) {
      setFailed("راجع الحقول المعلمة باللون الأحمر.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ reference: string }>("/api/v1/influencer-applications", {
        fullName: form.fullName.trim(), email: form.email.trim(),
        phoneCountryCode: form.phoneCountryCode, phone: form.phone,
        accounts: filled.map((a) => ({ platform: a.platform, url: a.url.trim(), followers: Number(digitsOnly(a.followers)) })),
        pitchAr: form.pitchAr.trim(),
        termsAccepted: true,
        [HONEYPOT_FIELD]: hp.value,
      });
      setDone(res.reference);
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : "تعذر إرسال الطلب، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SiteShell>
        <SeoHead title="وصل طلبك" description="طلب انضمام مؤثر في أكاديمية وجيز" path="/join-influencer" />
        <div ref={doneRef} tabIndex={-1} className="mx-auto max-w-lg scroll-mt-24 py-14 text-center outline-none">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal/15">
            <CheckCircle2 className="h-8 w-8 text-teal-light-ink" />
          </span>
          <h1 className="mt-6 text-2xl font-black">وصل طلبك — شكرا لك</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            رقم طلبك <b dir="ltr" className="text-foreground">{done}</b>. نراجعه ونرد عليك بالبريد، وفيه رابط تفعيل حسابك إن قبلناه.
          </p>
          <Link to="/" className="mt-6 inline-block text-sm font-bold text-teal-light-ink underline">العودة إلى الرئيسية</Link>
        </div>
      </SiteShell>
    );
  }

  const termsList = deal ? influencerTermsAr(deal) : [];

  return (
    <SiteShell>
      <SeoHead {...seoFor("/join-influencer")} />
      <div className="mx-auto max-w-3xl">
        <span className="kicker">منحة مؤثرين وجيز</span>
        <h1 className="h-section mt-4">انضم كمؤثر</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-foreground">
          انشر كودك، ومتابعوك يتعلمون بخصم، ولك عمولة عن كل شراء. اقرأ الاتفاق ثم قدم طلبك.
        </p>

        {!deal && !dealFailed && <Card as="p" className="mt-8 text-read text-muted-foreground">نحمل أرقام الاتفاق…</Card>}
        {dealFailed && <Card as="p" role="alert" tone="danger" className="mt-8 text-read">تعذر تحميل أرقام الاتفاق. حدث الصفحة بعد قليل.</Card>}

        {deal && (
          <div className="mt-8 space-y-4">
            <Panel as="section" aria-labelledby="ji-what">
              <h2 id="ji-what" className="text-lg font-black">ما هي</h2>
              <ul className="mt-3 list-disc space-y-1 pr-5 text-read leading-7">
                {influencerWhatAr(deal).map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p className="mt-2 text-read text-muted-foreground">{influencerExampleAr(deal)}</p>
            </Panel>

            <Panel as="section" aria-labelledby="ji-steps">
              <h2 id="ji-steps" className="text-lg font-black">كيف تفعل حسابك</h2>
              <ol className="mt-3 list-decimal space-y-1 pr-5 text-read leading-7">
                {INFLUENCER_ACTIVATION_STEPS_AR.map((t) => <li key={t}>{t}</li>)}
              </ol>
            </Panel>

            <Panel as="section" aria-labelledby="ji-portal">
              <h2 id="ji-portal" className="text-lg font-black">ما تجده في حسابك</h2>
              <ul className="mt-3 list-disc space-y-1 pr-5 text-read leading-7">
                {INFLUENCER_PORTAL_AR.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </Panel>

            <Panel as="section" aria-labelledby="ji-terms">
              <h2 id="ji-terms" className="text-lg font-black">الاتفاق المالي — لكل فصل</h2>
              <ul className="mt-3 list-disc space-y-1 pr-5 text-read leading-7">
                {termsList.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </Panel>
          </div>
        )}

        <form className="mt-10 space-y-8" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {hp.field}

          <Panel as="section" aria-labelledby="ji-about">
            <h2 id="ji-about" className="text-lg font-black">قدم طلبك</h2>
            <div className="mt-5 space-y-7">
              <FieldRow>
                <Field label="الاسم الكامل" htmlFor="ji-name" required error={err("fullName")}>
                  <input id="ji-name" autoComplete="name" value={form.fullName} onChange={set("fullName")} {...invalidProps("ji-name-error", err("fullName"))} className={controlCls} />
                </Field>
                <Field label="البريد الإلكتروني" htmlFor="ji-email" required error={err("email")}>
                  <input id="ji-email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={set("email")} {...invalidProps("ji-email-error", err("email"))} className={`${controlCls} text-left`} />
                </Field>
                <Field label="رقم الجوال (واتساب)" htmlFor="ji-phone" required error={err("phone")}>
                  <div className="flex gap-2" dir="ltr">
                    <PhoneCodePicker id="ji-cc" value={form.phoneCountryCode} onChange={(dial) => setForm({ ...form, phoneCountryCode: dial })} className={codeSelectCls} />
                    <input
                      id="ji-phone" type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" placeholder="رقمك بلا رمز الدولة"
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
                      {...invalidProps("ji-phone-error", err("phone"))} className={`${controlCls} min-w-0 flex-1 text-left`}
                    />
                  </div>
                </Field>
              </FieldRow>

              <FieldSet legend="حساباتك" required hint="المنصة، ورابط الحساب، وعدد المتابعين" name="ji-accounts" error={err("accounts")}>
                <div className="space-y-3">
                  {accounts.map((a, i) => (
                    <div key={i}>
                      <div className={rowGridCls}>
                        <select aria-label={`منصة الحساب ${i + 1}`} value={a.platform} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))} className={`${selectCls} ${fullRowCls}`}>
                          {INFLUENCER_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <input aria-label={`رابط الحساب ${i + 1}`} dir="ltr" placeholder="instagram.com/..." value={a.url} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={`${controlCls} ${fullRowCls} text-left`} />
                        <input aria-label={`عدد متابعي الحساب ${i + 1}`} inputMode="numeric" placeholder="المتابعون" value={a.followers} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, followers: digitsOnly(e.target.value, 10) } : x)))} className={controlCls} />
                        <Button type="button" tone="ghost" size="sm" aria-label={`احذف الحساب ${i + 1}`} disabled={accounts.length === 1} onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {err(`account-${filled.indexOf(a)}`) && <p role="alert" className="mt-1 text-read font-bold text-red-300">{err(`account-${filled.indexOf(a)}`)}</p>}
                    </div>
                  ))}
                  {accounts.length < MAX_INFLUENCER_ACCOUNTS && (
                    <Button type="button" tone="secondary" size="sm" onClick={() => setAccounts([...accounts, { platform: "instagram", url: "", followers: "" }])}>
                      <Plus className="h-4 w-4" /> أضف حسابا
                    </Button>
                  )}
                  {reach > 0 && <p className="text-read text-muted-foreground">متابعوك كلهم: <b className="text-foreground">{fmtNum(reach)}</b>.</p>}
                </div>
              </FieldSet>

              <Field label="كيف ستنشر كودك؟" htmlFor="ji-pitch" required wide error={err("pitchAr")}>
                <input id="ji-pitch" placeholder="مثال: قصص أسبوعية عن التعلم، ومنشور مع كل فصل جديد" value={form.pitchAr} onChange={set("pitchAr")} maxLength={300} {...invalidProps("ji-pitch-error", err("pitchAr"))} className={controlCls} />
              </Field>
            </div>
          </Panel>

          <section aria-label="قبول الاتفاق" className="space-y-3">
            <ConsentRow checked={terms} onChange={(v) => { setTerms(v); if (v && errors.terms) { const rest = { ...errors }; delete rest.terms; setErrors(rest); } }}>
              قرأت الاتفاق وأوافق عليه.
            </ConsentRow>
            {err("terms") && <p role="alert" className="text-read font-bold text-red-300">{err("terms")}</p>}
          </section>

          {failed && <Card as="p" role="alert" tone="danger" className="text-sm font-bold text-red-300">{failed}</Card>}
          <Button type="submit" tone="confirm" size="lg" loading={busy} disabled={busy || !deal}>أرسل طلبي</Button>
        </form>
      </div>
    </SiteShell>
  );
}
