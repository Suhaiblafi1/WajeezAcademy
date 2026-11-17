/* صفحةُ منحة الشريك — جامعةٌ أو شركةٌ وأكاديمية وجيز (١٥ نوفمبر ٢٠٢٦). والقراراتُ في رأس
   `src/application/commerce/partner-grant.ts`، والخادمُ `server/services/partner-grant.service.ts`.

   · **بشعارين متجاورين**: شعارُ الشريك وشعارُ وجيز، وفوق العنوان «شراكة بين … وأكاديمية وجيز»، والعنوانُ «منح تصل إلى
     75٪ لطلاب الجامعة» من نسبة الشريك. وحتّى يرفع المديرُ شعارَه يُكتب اسمُه في مكانه — لا شعارٌ يُجلب من خارج المنصّة.
   · **وثلاثُ خطوات**: بريدُ الجامعة، ثمّ فتحُ الرابط، ثمّ اختيارُ الدورات. فالنموذجُ اسمٌ وبريدٌ جامعيّ، وواتساب اختياريّ.
     والجوابُ بعده واحدٌ لكلّ بريد — «أرسلنا رابطا إلى…» — لا يقول أأخذ صاحبُه المنحةَ من قبل.
   · **والرابطُ يفتح `/grant/p/<رابطه>/confirm?token=…`**: يُمحى الرمزُ من العنوان أوّلَ ما يُقرأ، ثمّ يُرسَل مرّةً، فيظهر
     الكودُ ويُحفظ على الجهاز، وتُختار الدوراتُ ويُدفع من لوح الشراء بكوده.
   · **ودوراتُ الشريك بسعرها قبل المنحة وبعدها**، ومدرّبُها باسمه وصورته من بوّابة النشر في الخادم وحدَها.
   · **والأسئلة**: من يستحقّ، وكم دورة، وكيف يُتحقّق منه، ومن لا بريدَ جامعيّا له — يتواصل معنا على واتساب. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { CalendarDays, Check, ChevronDown, Copy, GraduationCap, Loader2, Mail, MailCheck, MessageCircle, UserRound, Video } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { syncPageTheme } from "@/services/theme";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { useHoneypot } from "@/components/HoneypotField";
import { toast, toastError } from "@/components/Toast";
import Modal from "@/components/Modal";
import AuthGate from "@/components/AuthGate";
import BuyPanel from "@/components/BuyPanel";
import SeoHead from "@/components/SeoHead";
import { controlCls } from "@/components/FormKit";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { PhoneCodePicker } from "@/components/CountryPicker";
import { GRANT_PHONE_REQUIRED_AR, intlPhone } from "@/application/advisor/guest-contact";
import { fmtDateLong, fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { GRANT_CLOSED_AR, GRANT_SOLD_OUT_AR, grantPrice } from "@/application/commerce/grant";
import { campaignParams, grantSessionsAr, GRANT_ACADEMY_LINE_AR, seatsLeftAr, toggleCourse } from "@/application/commerce/grant-landing";
import {
  PARTNER_CONSENT_AR, PARTNER_TYPE_AR, partnerFaqAr, partnerHeadlineAr, partnerOfferAr, partnerPagePath, partnerStepsAr,
  emailMatchesDomains, partnerBadEmailAr, type PartnerType,
} from "@/application/commerce/partner-grant";
import { mediaSrc } from "@/services/signed-upload";
import { readStoredPartnerGrant, saveStoredPartnerGrant, type StoredPartnerGrant } from "@/services/partner-grant";
import { waHref } from "@/application/site/whatsapp";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { CONTACT } from "@/data/stories";

interface PartnerCourse {
  courseId: string; titleAr: string; cohortId: string; startsAt: string | null; seatsLeft?: number | null; price: number;
  trainer?: { id: string; name: string; photoUrl: string | null } | null;
  summary?: { aboutAr?: string | null } | null;
  sessions?: { startsAt: string; endsAt: string | null }[];
}
interface View {
  partner: { slug: string; nameAr: string; nameEn: string | null; type: PartnerType; domains: string[]; logoUrl: string | null };
  campaign: { open: boolean; percentOff: number; maxCourses: number; closesAt: string | null; soldOut?: boolean };
  termAr: string | null;
  openCourses: PartnerCourse[];
}
interface Confirmed extends View {
  ref: string; name: string; email: string;
  grant: { code: string; percentOff: number } | null;
  reasonAr: string | null;
}

const USD = "USD";
const money = (n: number) => fmtMoney(n, USD);
const BUY_TITLE_AR = "دورات منحتك";
const PICKS_SAVE_DELAY_MS = 800;

/** الشعاران متجاوران — والشريكُ باسمه حتّى يُرفع شعارُه */
function CoBrand({ partner }: { partner: View["partner"] }) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6" data-testid="partner-cobrand">
      <span className="grid h-20 min-w-20 max-w-[11rem] place-items-center rounded-2xl bg-white px-3 shadow-sm ring-1 ring-black/10 sm:h-24">
        {partner.logoUrl
          ? <img src={mediaSrc(partner.logoUrl)} alt={`شعار ${partner.nameAr}`} className="max-h-16 w-auto object-contain sm:max-h-20" />
          : (
            <span className="text-center leading-5 text-teal-deep">
              <span className="block text-sm font-black">{partner.nameAr}</span>
              {partner.nameEn && <span dir="ltr" className="mt-0.5 block text-fine text-slate-500">{partner.nameEn}</span>}
            </span>
          )}
      </span>
      <span aria-hidden="true" className="h-12 w-px bg-border" />
      <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/10 sm:h-24 sm:w-24">
        <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
      </span>
    </div>
  );
}

export default function PartnerGrantPage() {
  const params = useParams();
  const slug = (params.slug ?? "").toLowerCase();
  const location = useLocation();
  const confirming = location.pathname.endsWith("/confirm");
  const base = partnerPagePath(slug);

  /* المنحُ نهاريّة ما لم يختر الليليَّ بيده (`syncPageTheme`) */
  useEffect(() => {
    syncPageTheme();
    return () => { setTimeout(syncPageTheme, 0); };
  }, []);

  const { user: session } = useRealSession();
  const [signedIn, setSignedIn] = useState(false);
  const authed = !!session || signedIn;
  const hp = useHoneypot();
  const numbers = useWhatsAppNumbers();
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredPartnerGrant | null>(() => readStoredPartnerGrant(slug));
  const [form, setForm] = useState({ fullName: stored?.name ?? "", email: stored?.email ?? "", phone: "" });
  /* وواتسابُ لازمٌ برمز دولته يُختار ولا يُكتب (١٧ نوفمبر ٢٠٢٦، `intlPhone`) */
  const [dial, setDial] = useState("+962");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [reasonAr, setReasonAr] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(() => stored?.picks ?? []);
  const [touched, setTouched] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const load = useCallback(async () => {
    try { setView(await apiGet<View>(`/api/public/grant/p/${encodeURIComponent(slug)}`)); }
    catch (e) { setFailed(e instanceof ApiError ? e.message : "تعذر تحميل الصفحة"); }
  }, [slug]);

  /* رابطُ البريد: يُقرأ رمزُه ويُمحى من العنوان قبل أيّ شيء (بلا تنقّلٍ يعيد بناء الصفحة)، ثمّ يُرسَل مرّةً واحدة */
  const confirmedOnce = useRef(false);
  useEffect(() => {
    if (!confirming) { void load(); return; }
    if (confirmedOnce.current) return;
    confirmedOnce.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    window.history.replaceState(window.history.state, "", base);
    if (!token) { setLinkError("الرابط ناقص. اطلب رابطا جديدا من هذه الصفحة."); void load(); return; }
    apiPost<Confirmed>(`/api/public/grant/p/${encodeURIComponent(slug)}/confirm`, { token })
      .then((out) => {
        const was = readStoredPartnerGrant(slug);
        const row = saveStoredPartnerGrant(slug, {
          ref: out.ref, code: out.grant?.code ?? null, percentOff: out.grant?.percentOff ?? null,
          name: out.name, email: out.email, picks: was?.ref === out.ref ? was.picks : [],
        });
        setStored(row);
        setPicked(row.picks);
        setReasonAr(out.reasonAr);
        setView(out);
      })
      .catch((e) => { setLinkError(e instanceof ApiError ? e.message : "تعذر تأكيد الرابط"); void load(); });
  }, [confirming, slug, base, load]);

  const code = stored?.code ?? null;
  const c = view?.campaign;
  const grantOn = !!c?.open && !!code;
  const pct = grantOn ? stored?.percentOff ?? c?.percentOff ?? 0 : 0;
  const max = c?.maxCourses ?? 4;
  const chosen = useMemo(
    () => picked.map((id) => view?.openCourses.find((x) => x.courseId === id)).filter((x): x is PartnerCourse => !!x).slice(0, max),
    [picked, view, max],
  );
  const listTotal = chosen.reduce((s, x) => s + x.price, 0);
  const payTotal = grantPrice(listTotal, pct);
  const toggle = (id: string) => { setTouched(true); setPicked((p) => toggleCourse(p, id, max)); };

  /* ما اختاره على جهازه في الحال، وفي ملفّه بمهلة — فيراه المستشار (`savePicks`) */
  const ref = stored?.ref;
  useEffect(() => {
    if (!touched) return;
    setStored((was) => (was ? saveStoredPartnerGrant(slug, { ...was, picks: picked }) : was));
  }, [touched, picked, slug]);
  useEffect(() => {
    if (!touched || !ref) return;
    const t = setTimeout(() => { void apiPut("/api/public/grant/picks", { ref, courseIds: picked }).catch(() => {}); }, PICKS_SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [touched, ref, picked]);

  if (failed) return <Shell><Card as="p" className="text-read">{failed}</Card></Shell>;
  if (!view || !c) {
    return <Shell><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div></Shell>;
  }

  const p = view.partner;
  const t = PARTNER_TYPE_AR[p.type];
  const lastDayAr = c.closesAt ? fmtDateLong(new Date(new Date(c.closesAt).getTime() - 1)) : null;
  const faq = partnerFaqAr({ nameAr: p.nameAr, type: p.type, percentOff: c.percentOff, maxCourses: c.maxCourses, domains: p.domains, lastDayAr });
  const steps = partnerStepsAr(p.type);
  const shell = {
    title: `منحة ${p.nameAr}`,
    path: base,
    description: `${partnerHeadlineAr(p.nameAr)}: ${partnerOfferAr(c.percentOff, p.type)} في دورات مباشرة على Zoom.`,
  };
  const helpHref = waHref(numbers, "grant_advisor", CONTACT.whatsapp, `مرحبا، أريد منحة ${p.nameAr} وليس لدي ${t.email}.`);
  const closedNote = !c.open ? GRANT_CLOSED_AR : c.soldOut && !code ? GRANT_SOLD_OUT_AR : null;
  const emailOk = emailMatchesDomains(form.email, p.domains);
  const phoneIntl = intlPhone(dial, form.phone);
  const ready = form.fullName.trim().length >= 2 && emailOk && phoneIntl !== null;

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOk) { toastError(partnerBadEmailAr(p.type, p.domains)); return; }
    setBusy(true);
    try {
      const out = await apiPost<{ sentTo: string; messageAr: string }>(`/api/public/grant/p/${encodeURIComponent(slug)}/link`, {
        fullName: form.fullName.trim(), email: form.email.trim(), phone: phoneIntl,
        ...campaignParams(window.location.search), website: hp.value,
      });
      setSent(out.messageAr);
      setLinkError(null);
    } catch (err) { toastError(err instanceof ApiError ? err.message : "تعذر الإرسال، أعد المحاولة"); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); toast("نسخ الكود"); } catch { /* الكودُ ظاهرٌ يُنسخ باليد */ }
  };
  const pay = () => {
    if (chosen.length === 0) return;
    if (!authed) { setAuthOpen(true); return; }
    setBuyOpen(true);
  };

  return (
    <Shell {...shell}>
      {/* ─── الرأس: الشعاران والشراكةُ والمنحة ─── */}
      <section className="text-center" aria-labelledby="partner-title">
        <CoBrand partner={p} />
        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-read font-bold text-teal-light-ink">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />{partnerHeadlineAr(p.nameAr)}
        </p>
        <h1 id="partner-title" className="mx-auto mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
          {partnerOfferAr(c.percentOff, p.type)}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-read leading-7 text-muted-foreground">
          دورات مباشرة على Zoom مع مدربين معتمدين. حتى {c.maxCourses} دورات بخصم {c.percentOff}٪{lastDayAr ? `، وآخر يوم ${lastDayAr}` : ""}.
        </p>
      </section>

      {closedNote && <Card as="p" tone="warn" className="mt-6 text-center text-read font-bold">{closedNote}</Card>}

      {/* ─── الكودُ إن أخذه، وإلّا النموذج ─── */}
      {code ? (
        <Panel className="mt-8 text-center" data-testid="partner-code">
          <p className="inline-flex items-center gap-1.5 text-read font-bold text-teal-light-ink"><MailCheck className="h-4 w-4" aria-hidden="true" />أكدنا بريدك</p>
          <p className="mt-2 text-read text-muted-foreground">كود منحتك — أرسلناه إلى بريدك أيضا</p>
          <p className="mt-2 flex items-center justify-center gap-3">
            <Inset as="bdi" tone="accent" dir="ltr" className="font-mono text-2xl font-black tracking-wider">{code}</Inset>
            <Button size="sm" tone="ghost" icon={Copy} onClick={() => void copy()}>انسخ</Button>
          </p>
          <p className="mt-3 text-read text-muted-foreground">اختر حتى {c.maxCourses} دورات من القائمة، وادفع السعر بعد المنحة.</p>
        </Panel>
      ) : (
        <Card as="form" onSubmit={requestLink} className="mx-auto mt-8 grid max-w-md gap-3" id="partner-claim" data-testid="partner-claim">
          {linkError && <Inset tone="warn" as="p" className="text-read font-bold">{linkError}</Inset>}
          {sent ? (
            <div className="grid gap-3 text-center" role="status">
              <Mail className="mx-auto h-10 w-10 text-teal-light-ink" aria-hidden="true" />
              <p className="font-bold leading-7">{sent}</p>
              <p className="text-read text-muted-foreground">لم يصلك؟ انظر في الرسائل غير المرغوبة، أو اطلبه مرة أخرى.</p>
              <Button tone="secondary" onClick={() => setSent(null)}>اطلب رابطا جديدا</Button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-black">احجز منحتك</h2>
              <label className="grid gap-1 text-read font-bold">اسمك
                <input className={controlCls} value={form.fullName} autoComplete="name" required minLength={2} maxLength={120}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="الاسم كما تحب أن يظهر في شهادتك" />
              </label>
              <label className="grid gap-1 text-read font-bold">{t.email}
                <input className={controlCls} type="email" dir="ltr" value={form.email} autoComplete="email" required maxLength={200}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={`name@${p.domains[0] ?? ""}`} />
                <span className="font-normal text-muted-foreground">{t.emailHint}، وينتهي بـ<bdi dir="ltr">{p.domains.join(" / ")}</bdi></span>
              </label>
              <div className="grid gap-1 text-read font-bold">
                <label htmlFor="pg-phone">رقم واتساب</label>
                <div className="flex gap-2" dir="ltr">
                  <PhoneCodePicker id="pg-cc" value={dial} onChange={setDial} className={`${controlCls.replace("w-full", "")} w-32 shrink-0 px-2`} />
                  <input id="pg-phone" className={`${controlCls} min-w-0 flex-1`} type="tel" dir="ltr" value={form.phone} autoComplete="tel-national" required maxLength={30}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="7X XXX XXXX" />
                </div>
                {form.phone.trim() !== "" && phoneIntl === null && <span className="font-normal text-red-300">{GRANT_PHONE_REQUIRED_AR}</span>}
              </div>
              {hp.field}
              <Button type="submit" tone="confirm" size="lg" className="w-full" loading={busy} disabled={!ready || !c.open}>أرسل رابط التأكيد</Button>
              <p className="text-read leading-6 text-muted-foreground">{PARTNER_CONSENT_AR}</p>
            </>
          )}
        </Card>
      )}
      {reasonAr && <Card as="p" tone="warn" className="mt-4 text-center text-read font-bold">{reasonAr}</Card>}

      {/* ─── كيف تعمل: ثلاثُ خطوات ─── */}
      <section aria-labelledby="partner-steps" className="mt-12">
        <h2 id="partner-steps" className="text-center text-xl font-black">كيف تحصل على منحتك؟</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Inset as="li" key={s.title} className="text-center">
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-teal text-sm font-black text-on-teal">{i + 1}</span>
              <span className="mt-2 block font-bold">{s.title}</span>
              <span className="mt-0.5 block text-read leading-6 text-muted-foreground">{s.body}</span>
            </Inset>
          ))}
        </ol>
      </section>

      {/* ─── الدورات بسعرها قبل المنحة وبعدها ─── */}
      <section aria-labelledby="partner-courses" className="mt-12">
        <h2 id="partner-courses" className="text-xl font-black">دورات المنحة{view.termAr ? ` · ${view.termAr}` : ""}</h2>
        <p className="mt-1 text-read text-muted-foreground">
          {code ? `اختر حتى ${c.maxCourses} دورات.` : "أكد بريدك لتختار منها."} كل دورة لقاءات مباشرة على Zoom.
        </p>
        {view.openCourses.length === 0 ? (
          <Card as="p" className="mt-4 text-read text-muted-foreground">نعلن الدورات قريبا.</Card>
        ) : (
          <ul className="mt-4 grid gap-3">
            {view.openCourses.map((x) => {
              const on = picked.includes(x.courseId);
              const full = !on && chosen.length >= max;
              const after = grantPrice(x.price, code ? pct : c.percentOff);
              const seats = seatsLeftAr(x.seatsLeft);
              const meetings = x.sessions?.length ?? 0;
              const body = (
                <>
                  <span className="relative shrink-0">
                    {x.trainer?.photoUrl
                      ? <img src={x.trainer.photoUrl} alt="" loading="lazy" className="h-20 w-20 rounded-2xl object-cover shadow sm:h-24 sm:w-24" />
                      : <span className="grid h-20 w-20 place-items-center rounded-2xl bg-teal/10 text-teal-light-ink sm:h-24 sm:w-24"><UserRound className="h-9 w-9" aria-hidden="true" /></span>}
                    {code && <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(x.courseId)} aria-label={x.titleAr} className="absolute start-2 top-2 h-5 w-5 shadow" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {seats && <span className="block text-read font-bold text-danger-ink">{seats}</span>}
                    <span className="block font-bold leading-6">{x.titleAr}</span>
                    {x.trainer && <span className="mt-0.5 block text-read font-bold text-teal-light-ink">مع {x.trainer.name}</span>}
                    {x.summary?.aboutAr && (
                      <span className="mt-1 flex items-start gap-1.5 text-read leading-6">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />{x.summary.aboutAr}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 text-read text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />تبدأ {cohortDayAr(x.startsAt)}</span>
                      <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" aria-hidden="true" />{meetings > 0 ? grantSessionsAr(meetings) : "مباشرة على Zoom"}</span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
                      <bdi dir="ltr" className="text-read text-muted-foreground line-through">{money(x.price)}</bdi>
                      <bdi dir="ltr" className="text-lg font-black">{money(after)}</bdi>
                      <span className="text-read text-muted-foreground">بعد المنحة</span>
                    </span>
                  </span>
                </>
              );
              return (
                <Inset as="li" key={x.courseId} tone={on ? "accent" : "default"} className={full ? "opacity-50" : ""}>
                  {code ? <label className="flex cursor-pointer items-start gap-4">{body}</label> : <div className="flex items-start gap-4">{body}</div>}
                </Inset>
              );
            })}
          </ul>
        )}
        {code && chosen.length > 0 && (
          <Card tone="solid" className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <span>
              <span className="block font-black">تدفع <bdi dir="ltr">{money(payTotal)}</bdi> بدل <bdi dir="ltr" className="line-through">{money(listTotal)}</bdi></span>
              <span className="block text-read text-muted-foreground">{chosen.length} من {max} دورات</span>
            </span>
            <Button tone="confirm" onClick={pay} disabled={!grantOn}>ادفع الآن</Button>
          </Card>
        )}
        {!code && c.open && (
          <p className="mt-4 text-center">
            <Button tone="secondary" onClick={() => document.getElementById("partner-claim")?.scrollIntoView({ behavior: "smooth", block: "center" })}>احجز منحتك ببريدك</Button>
          </p>
        )}
      </section>

      {/* ─── الأسئلة ─── */}
      <section aria-labelledby="partner-faq" className="mx-auto mt-12 max-w-xl">
        <h2 id="partner-faq" className="mb-2 text-center font-bold">أسئلة سريعة</h2>
        <div className="space-y-1.5">
          {faq.map((f) => (
            <Inset as="details" key={f.q} className="group px-3.5 py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-read font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-1.5 text-read leading-6 text-muted-foreground">{f.a}</p>
            </Inset>
          ))}
        </div>
        {helpHref && (
          <p className="mt-4 text-center">
            <Button as="a" href={helpHref} target="_blank" rel="noreferrer" tone="ghost" icon={MessageCircle}>تواصل معنا على واتساب</Button>
          </p>
        )}
      </section>
      <p className="mt-8 text-center text-read text-muted-foreground">{GRANT_ACADEMY_LINE_AR}</p>

      {authOpen && stored && (
        <Modal onClose={() => setAuthOpen(false)} label="أنشئ حسابك لتدفع" panelClassName="w-full max-w-md">
          <AuthGate
            initialMode="signup" source="partner_grant_checkout" verifyLater
            message="أنشئ حسابك لتدفع. فيه تجد دوراتك ومواعيدها."
            prefill={{ name: stored.name, email: stored.email }}
            onDone={() => { setSignedIn(true); setAuthOpen(false); setBuyOpen(true); }}
          />
        </Modal>
      )}
      {buyOpen && stored && (
        <BuyPanel
          title={BUY_TITLE_AR}
          email={session?.email ?? stored.email}
          kind="courses"
          initialCoupon={code ?? ""}
          grantPayTotal={grantOn ? payTotal : undefined}
          lines={chosen.map((x) => ({ courseId: x.courseId, name: x.titleAr, cohortId: x.cohortId }))}
          onClose={() => setBuyOpen(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children, title = "منحة الشركاء", path = "/grant/p", description = "منح أكاديمية وجيز لطلاب الجامعات وموظفي الشركات الشريكة." }: {
  children: React.ReactNode; title?: string; path?: string; description?: string;
}) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead title={title} description={description} path={path} />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-5">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <img src="/logo-mark.png" alt="" className="h-7 w-7 object-contain" />أكاديمية وجيز
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-5">{children}</main>
    </div>
  );
}
