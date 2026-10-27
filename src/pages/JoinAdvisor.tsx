/* «انضم كمستشار» — نموذجٌ واحدٌ قصير (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السابعة).

   قراراتُ صاحب المنصّة: لا اتّفاقيّة («b») — يُقبَل الطلبُ بنسبة عمولةٍ فيُفعَّل حسابُه، والشروطُ يقبلها هنا
   (`ADVISOR_TERMS_AR`)؛ والنموذجُ («A» مع الوصول الرقميّ): بياناتُه وعملُه وخبرتُه وساعاتُه، ومن يصل إليهم،
   وحساباتُه بمتابعيها، ومجموعاتُه بأعضائها، وهل روّج لشيءٍ من قبل، ولماذا وجيز.

   ولا حسابَ يُنشأ من هنا ولا كلمةَ مرور: الحسابُ يُنشأ ساعةَ يُقبَل، ويختار كلمتَه من رابط تفعيله. والقيمُ والتحقّقُ
   من `src/application/advisor/application.ts` — يقرؤها الخادمُ نفسُه. */
import { useRef, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Megaphone, Plus, Trash2, Users, Wallet } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { seoFor } from "@/application/site/public-pages";
import { apiPost, ApiError } from "@/services/api";
import { Card, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { ConsentRow, Field, FieldRow, FieldSet, OptionGrid, areaCls, controlCls, invalidProps } from "@/components/FormKit";
import { CountryPicker, PhoneCodePicker } from "@/components/CountryPicker";
import { HONEYPOT_FIELD, useHoneypot } from "@/components/HoneypotField";
import { normalizeApplicantLink } from "@/application/trainer/applicant-link";
import { fmtNum } from "@/application/text/format-ar";
import {
  ADVISOR_AUDIENCES, ADVISOR_COMMUNITY_KINDS, ADVISOR_EMPLOYMENT, ADVISOR_EXPERIENCE, ADVISOR_HOURS, ADVISOR_PLATFORMS,
  ADVISOR_TERMS_AR, MAX_ADVISOR_ACCOUNTS, MAX_ADVISOR_COMMUNITIES, reachTotal,
} from "@/application/advisor/application";

const selectCls = `${controlCls} [&>option]:bg-surface`;
const codeSelectCls = `${controlCls.replace("w-full", "")} w-32 shrink-0 px-2`;
/* صفُّ الحساب أو المجموعة: أربعةُ أعمدةٍ على الشاشة الواسعة، وعلى الهاتف المنصّةُ ثمّ الرابطُ كلٌّ في سطره،
   والعددُ وزرُّ الحذف معا في الأخير — لا زرَّ وحيدا في سطرٍ فارغ */
const rowGridCls = "grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_9rem_auto]";
const fullRowCls = "col-span-2 sm:col-span-1";

/** الأرقامُ العربيّة والفارسيّة تُقرأ أرقاما — ويسقط ما سواها */
const digitsOnly = (v: string, max = 15) => v
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[^\d]/g, "")
  .slice(0, max);

interface AccountRow { platform: string; url: string; followers: string }
interface CommunityRow { kind: string; name: string; members: string }

const EMPTY = {
  fullName: "", email: "", phoneCountryCode: "+962", phone: "", country: "",
  employment: "", experienceYears: "", experienceAr: "", hoursPerWeek: "",
  promoted: "" as "" | "yes" | "no", promotedAr: "", motivationAr: "",
};

const YES_NO = [{ value: "yes", label: "نعم" }, { value: "no", label: "لا" }] as const;

export default function JoinAdvisor() {
  const [form, setForm] = useState(EMPTY);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([{ platform: "instagram", url: "", followers: "" }]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const hp = useHoneypot();

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const err = (key: string) => errors[key] ?? null;
  /* خطأٌ صُحّح يختفي ساعتَها — لا يبقى «وافق على الشروط» تحت مربّعٍ معلَّم حتّى الإرسال التالي */
  const clearError = (key: string) => {
    if (!errors[key]) return;
    const rest = { ...errors };
    delete rest[key];
    setErrors(rest);
    if (Object.keys(rest).length === 0) setFailed(null);
  };

  /* ما يُكتب من الحسابات والمجموعات — والصفُّ الفارغُ كلُّه لا يُحسب ولا يُردّ */
  const filledAccounts = accounts.filter((a) => a.url.trim() || a.followers.trim());
  const filledCommunities = communities.filter((c) => c.name.trim() || c.members.trim());
  const reach = reachTotal(
    filledAccounts.map((a) => ({ followers: Number(digitsOnly(a.followers)) || 0 })),
    filledCommunities.map((c) => ({ members: Number(digitsOnly(c.members)) || 0 })),
  );

  const check = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = "اكتب اسمك الكامل";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "اكتب بريدا صحيحا";
    if (form.phone.length < 6) e.phone = "اكتب رقمك بلا رمز الدولة";
    if (!form.employment) e.employment = "اختر حالتك المهنية";
    if (!form.experienceYears) e.experienceYears = "اختر سنوات خبرتك";
    if (form.experienceAr.trim().length < 10) e.experienceAr = "اكتب سطرا عن خبرتك";
    if (!form.hoursPerWeek) e.hoursPerWeek = "اختر ساعاتك في الأسبوع";
    if (audiences.length === 0) e.audiences = "اختر من تصل إليهم";
    filledAccounts.forEach((a, i) => {
      const link = normalizeApplicantLink(a.url);
      if (!a.url.trim()) e[`account-${i}`] = "اكتب رابط الحساب";
      else if (!link.ok) e[`account-${i}`] = link.messageAr;
      else if (!digitsOnly(a.followers)) e[`account-${i}`] = "اكتب عدد المتابعين";
    });
    filledCommunities.forEach((c, i) => {
      if (c.name.trim().length < 2) e[`community-${i}`] = "اكتب اسم المجموعة";
      else if (!digitsOnly(c.members)) e[`community-${i}`] = "اكتب عدد الأعضاء";
    });
    if (!form.promoted) e.promoted = "اختر نعم أو لا";
    if (form.motivationAr.trim().length < 40) e.motivationAr = "اكتب سطرين على الأقل";
    if (!terms) e.terms = "وافق على الشروط لترسل طلبك";
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
      const res = await apiPost<{ reference: string }>("/api/v1/advisor-applications", {
        fullName: form.fullName.trim(), email: form.email.trim(),
        phoneCountryCode: form.phoneCountryCode, phone: form.phone, country: form.country || undefined,
        employment: form.employment, experienceYears: form.experienceYears, experienceAr: form.experienceAr.trim(),
        hoursPerWeek: form.hoursPerWeek, audiences,
        accounts: filledAccounts.map((a) => ({ platform: a.platform, url: a.url.trim(), followers: Number(digitsOnly(a.followers)) })),
        communities: filledCommunities.map((c) => ({ kind: c.kind, name: c.name.trim(), members: Number(digitsOnly(c.members)) })),
        promotedBefore: form.promoted === "yes",
        promotedAr: form.promoted === "yes" ? form.promotedAr.trim() || undefined : undefined,
        motivationAr: form.motivationAr.trim(),
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
        <SeoHead title="وصل طلبك" description="طلب انضمام مستشار في أكاديمية وجيز" path="/join-advisor" />
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

  return (
    <SiteShell>
      <SeoHead {...seoFor("/join-advisor")} />
      <div className="mx-auto max-w-3xl">
        <span className="kicker">انضم إلى مستشاري وجيز</span>
        <h1 className="h-section mt-4">أرشد الناس إلى ما يفيدهم — وخذ عمولتك</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-foreground">
          مستشار وجيز يساعد من يعرفهم على اختيار المسار المناسب، ويأخذ نسبة مما يدفعون. نموذج واحد قصير، ونرد عليك بالبريد.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Users, text: "متعلمون يصلون إلى مسارهم عبر تشخيص" },
            { icon: Wallet, text: "عمولة شهرية عما يدفعه متعلموك" },
            { icon: Megaphone, text: "حساب واحد يجمع عملاءك وعمولتك" },
          ].map((f) => (
            <Card key={f.text}>
              <f.icon className="h-5 w-5 text-teal-light-ink" />
              <p className="mt-3 text-read font-bold leading-6 text-foreground">{f.text}</p>
            </Card>
          ))}
        </div>

        <form className="mt-10 space-y-8" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {hp.field}

          <Panel as="section" aria-labelledby="ja-about">
            <h2 id="ja-about" className="text-lg font-black">عنك</h2>
            <div className="mt-5">
              <FieldRow>
                <Field label="الاسم الكامل" htmlFor="ja-name" required error={err("fullName")}>
                  <input id="ja-name" autoComplete="name" value={form.fullName} onChange={set("fullName")} {...invalidProps("ja-name-error", err("fullName"))} className={controlCls} />
                </Field>
                <Field label="البريد الإلكتروني" htmlFor="ja-email" required error={err("email")}>
                  <input id="ja-email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={set("email")} {...invalidProps("ja-email-error", err("email"))} className={`${controlCls} text-left`} />
                </Field>
                <Field label="رقم الجوال (واتساب)" htmlFor="ja-phone" required error={err("phone")}>
                  <div className="flex gap-2" dir="ltr">
                    <PhoneCodePicker id="ja-cc" value={form.phoneCountryCode} onChange={(dial) => setForm({ ...form, phoneCountryCode: dial })} className={codeSelectCls} />
                    <input
                      id="ja-phone" type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" placeholder="رقمك بلا رمز الدولة"
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
                      {...invalidProps("ja-phone-error", err("phone"))} className={`${controlCls} min-w-0 flex-1 text-left`}
                    />
                  </div>
                </Field>
                <Field label="دولة الإقامة" htmlFor="ja-country">
                  <CountryPicker id="ja-country" value={form.country} onChange={(name) => setForm({ ...form, country: name })} />
                </Field>
              </FieldRow>
            </div>
          </Panel>

          <Panel as="section" aria-labelledby="ja-work">
            <h2 id="ja-work" className="text-lg font-black">عملك وخبرتك</h2>
            <div className="mt-5 space-y-6">
              <FieldRow>
                <Field label="حالتك المهنية الآن" htmlFor="ja-employment" required error={err("employment")}>
                  <select id="ja-employment" value={form.employment} onChange={set("employment")} className={selectCls}>
                    <option value="" disabled>اختر الأقرب لواقعك</option>
                    {ADVISOR_EMPLOYMENT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="خبرتك في الإرشاد أو المبيعات أو التعليم" htmlFor="ja-years" required error={err("experienceYears")}>
                  <select id="ja-years" value={form.experienceYears} onChange={set("experienceYears")} className={selectCls}>
                    <option value="" disabled>اختر سنوات خبرتك</option>
                    {ADVISOR_EXPERIENCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="سطر عن خبرتك" htmlFor="ja-exp" required wide error={err("experienceAr")}>
                  <input id="ja-exp" placeholder="مثال: أرشد طلاب الجامعة إلى دورات مهنية منذ ٣ سنوات" value={form.experienceAr} onChange={set("experienceAr")} maxLength={300} {...invalidProps("ja-exp-error", err("experienceAr"))} className={controlCls} />
                </Field>
                <Field label="ساعاتك في الأسبوع" htmlFor="ja-hours" required error={err("hoursPerWeek")}>
                  <select id="ja-hours" value={form.hoursPerWeek} onChange={set("hoursPerWeek")} className={selectCls}>
                    <option value="" disabled>اختر</option>
                    {ADVISOR_HOURS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </FieldRow>
            </div>
          </Panel>

          <Panel as="section" aria-labelledby="ja-reach">
            <h2 id="ja-reach" className="text-lg font-black">وصولك</h2>
            <p className="mt-1 text-read leading-6 text-muted-foreground">من تعرفهم وتصل إليهم، وحساباتك ومجموعاتك. اكتب ما عندك فقط.</p>
            <div className="mt-5 space-y-7">
              <FieldSet legend="من تصل إليهم" required name="ja-audiences" error={err("audiences")}>
                <OptionGrid
                  name="من تصل إليهم" cols={3} items={ADVISOR_AUDIENCES}
                  isOn={(v) => audiences.includes(v)}
                  onToggle={(v) => setAudiences(audiences.includes(v) ? audiences.filter((x) => x !== v) : [...audiences, v])}
                />
              </FieldSet>

              <FieldSet legend="حساباتك على وسائل التواصل" hint="المنصة، ورابط الحساب، وعدد المتابعين" name="ja-accounts">
                <div className="space-y-3">
                  {accounts.map((a, i) => (
                    <div key={i}>
                      <div className={rowGridCls}>
                        <select aria-label={`منصة الحساب ${i + 1}`} value={a.platform} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))} className={`${selectCls} ${fullRowCls}`}>
                          {ADVISOR_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <input aria-label={`رابط الحساب ${i + 1}`} dir="ltr" placeholder="instagram.com/..." value={a.url} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={`${controlCls} ${fullRowCls} text-left`} />
                        <input aria-label={`عدد متابعي الحساب ${i + 1}`} inputMode="numeric" placeholder="المتابعون" value={a.followers} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, followers: digitsOnly(e.target.value, 10) } : x)))} className={controlCls} />
                        <Button type="button" tone="ghost" size="sm" aria-label={`احذف الحساب ${i + 1}`} onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {err(`account-${filledAccounts.indexOf(a)}`) && <p role="alert" className="mt-1 text-read font-bold text-red-300">{err(`account-${filledAccounts.indexOf(a)}`)}</p>}
                    </div>
                  ))}
                  {accounts.length < MAX_ADVISOR_ACCOUNTS && (
                    <Button type="button" tone="secondary" size="sm" onClick={() => setAccounts([...accounts, { platform: "instagram", url: "", followers: "" }])}>
                      <Plus className="h-4 w-4" /> أضف حسابا
                    </Button>
                  )}
                </div>
              </FieldSet>

              <FieldSet legend="مجموعات تديرها" hint="واتساب أو تيليغرام أو غيرها، باسمها وعدد أعضائها" name="ja-communities">
                <div className="space-y-3">
                  {communities.map((c, i) => (
                    <div key={i}>
                      <div className={rowGridCls}>
                        <select aria-label={`نوع المجموعة ${i + 1}`} value={c.kind} onChange={(e) => setCommunities(communities.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} className={`${selectCls} ${fullRowCls}`}>
                          {ADVISOR_COMMUNITY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                        </select>
                        <input aria-label={`اسم المجموعة ${i + 1}`} placeholder="اسم المجموعة" value={c.name} maxLength={80} onChange={(e) => setCommunities(communities.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={`${controlCls} ${fullRowCls}`} />
                        <input aria-label={`عدد أعضاء المجموعة ${i + 1}`} inputMode="numeric" placeholder="الأعضاء" value={c.members} onChange={(e) => setCommunities(communities.map((x, j) => (j === i ? { ...x, members: digitsOnly(e.target.value, 9) } : x)))} className={controlCls} />
                        <Button type="button" tone="ghost" size="sm" aria-label={`احذف المجموعة ${i + 1}`} onClick={() => setCommunities(communities.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {err(`community-${filledCommunities.indexOf(c)}`) && <p role="alert" className="mt-1 text-read font-bold text-red-300">{err(`community-${filledCommunities.indexOf(c)}`)}</p>}
                    </div>
                  ))}
                  {communities.length < MAX_ADVISOR_COMMUNITIES && (
                    <Button type="button" tone="secondary" size="sm" onClick={() => setCommunities([...communities, { kind: "whatsapp", name: "", members: "" }])}>
                      <Plus className="h-4 w-4" /> أضف مجموعة
                    </Button>
                  )}
                </div>
              </FieldSet>

              {reach > 0 && (
                <p className="text-read text-muted-foreground">
                  وصولك كله: <b className="text-foreground">{fmtNum(reach)}</b> متابع وعضو.
                </p>
              )}

              <FieldSet legend="هل روجت لدورات أو منتجات على الإنترنت من قبل؟" required name="ja-promoted" error={err("promoted")}>
                <OptionGrid name="روجت من قبل" cols={2} items={YES_NO} isOn={(v) => form.promoted === v} onToggle={(v) => setForm({ ...form, promoted: v as "yes" | "no" })} />
                {form.promoted === "yes" && (
                  <input aria-label="كيف كان ذلك" placeholder="سطر عن ذلك: ماذا روجت وكيف كانت النتيجة" value={form.promotedAr} maxLength={300} onChange={set("promotedAr")} className={`${controlCls} mt-3`} />
                )}
              </FieldSet>
            </div>
          </Panel>

          <Panel as="section" aria-labelledby="ja-why">
            <h2 id="ja-why" className="text-lg font-black">لماذا وجيز؟</h2>
            <div className="mt-5">
              <Field label="سطران عما يجعلك تريد أن تكون مستشارا معنا" htmlFor="ja-motivation" required error={err("motivationAr")}>
                <textarea id="ja-motivation" rows={4} maxLength={500} value={form.motivationAr} onChange={set("motivationAr")} {...invalidProps("ja-motivation-error", err("motivationAr"))} className={areaCls} />
              </Field>
            </div>
          </Panel>

          <section aria-labelledby="ja-terms" className="space-y-3">
            <h2 id="ja-terms" className="text-lg font-black">شروط المستشار</h2>
            <ul className="list-disc space-y-1 pr-5 text-read leading-7 text-foreground">
              {ADVISOR_TERMS_AR.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <ConsentRow checked={terms} onChange={(v) => { setTerms(v); if (v) clearError("terms"); }}>قرأت الشروط وأوافق عليها.</ConsentRow>
            {err("terms") && <p role="alert" className="text-read font-bold text-red-300">{err("terms")}</p>}
          </section>

          {failed && <Card as="p" role="alert" tone="danger" className="text-sm font-bold text-red-300">{failed}</Card>}
          <Button type="submit" tone="confirm" size="lg" loading={busy} disabled={busy}>أرسل طلبي</Button>
        </form>
      </div>
    </SiteShell>
  );
}
