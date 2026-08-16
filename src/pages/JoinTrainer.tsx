import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, ChevronDown, Compass, Loader2, MailCheck, Mic2, Search, Send, Users } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, apiGet, ApiError } from "@/services/api";
import { TRAINING_SPECIALIZATIONS } from "@/data/trainer-contracts";

const DOMAIN_YEARS = [
  { value: "1-3", label: "١–٣ سنوات" },
  { value: "4-7", label: "٤–٧ سنوات" },
  { value: "8-12", label: "٨–١٢ سنة" },
  { value: "12+", label: "أكثر من ١٢ سنة" },
];

const TRAINING_YEARS = [
  { value: "none", label: "لم أدرّب بعد — لكني أتقن مجالي" },
  { value: "informal", label: "تدريب غير رسمي (زملاء / فريقي)" },
  { value: "workshops", label: "ورش ودورات قصيرة" },
  { value: "formal_teaching", label: "تدريب منهجي معتاد (دورات/شعب)" },
];

const LANGUAGES = ["العربية", "الإنجليزية", "الفرنسية"];
const COUNTRY_CODES = ["+962", "+966", "+971", "+20", "+965", "+974", "+968", "+973", "+964", "+218", "+249"];

/* دول الإقامة والاستهداف — خيارات جاهزة تسهّل التقييم والمطابقة مع الشعب */
const ARAB_COUNTRIES = [
  "الأردن", "السعودية", "الإمارات", "مصر", "الكويت", "قطر", "عُمان", "البحرين",
  "العراق", "فلسطين", "لبنان", "سوريا", "ليبيا", "تونس", "الجزائر", "المغرب", "السودان", "اليمن", "موريتانيا",
];
const ALL_ARAB = "كل الدول العربية";

/* المنطقة الزمنية تُشتق تلقائيا من دولة الإقامة — لا سؤال إضافي */
const COUNTRY_TIMEZONE: Record<string, string> = {
  "الأردن": "Asia/Amman", "السعودية": "Asia/Riyadh", "الإمارات": "Asia/Dubai", "مصر": "Africa/Cairo",
  "الكويت": "Asia/Kuwait", "قطر": "Asia/Qatar", "عُمان": "Asia/Muscat", "البحرين": "Asia/Bahrain",
  "العراق": "Asia/Baghdad", "فلسطين": "Asia/Hebron", "لبنان": "Asia/Beirut", "سوريا": "Asia/Damascus",
  "ليبيا": "Africa/Tripoli", "تونس": "Africa/Tunis", "الجزائر": "Africa/Algiers", "المغرب": "Africa/Casablanca",
  "السودان": "Africa/Khartoum", "اليمن": "Asia/Aden", "موريتانيا": "Africa/Nouakchott",
};

/* الحالة المهنية — تساعد على فهم تفرغ المتقدم ووقته للتدريب */
const EMPLOYMENT_STATUS = [
  { value: "employed", label: "موظف — أعمل لدى جهة" },
  { value: "own_business", label: "لدي عملي الخاص" },
  { value: "full_time_training", label: "متفرغ للتدريب" },
];

/* الفئات المستهدفة — تطابق شرائح مسارات الأكاديمية */
const TARGET_AUDIENCES = [
  "طلاب المدارس والجامعات", "خريجون جدد", "موظفو القطاع الخاص", "موظفو القطاع الحكومي",
  "رواد أعمال وأصحاب مشاريع", "قادة ومديرون", "مستقلون وأعمال حرة", "الباحثون عن عمل",
];

const STATUS_LABELS: Record<string, string> = {
  email_verification_pending: "بانتظار تحقق البريد",
  submitted: "قُدّم — بانتظار المراجعة",
  under_review: "قيد المراجعة",
  information_requested: "طُلبت معلومات إضافية — أكمل المرحلة الثانية",
  shortlisted: "مختار أولي — سنرتب مقابلة",
  interview_scheduled: "مقابلة مجدولة",
  demo_requested: "بانتظار الدرس التجريبي",
  academic_review: "مراجعة أكاديمية نهائية",
  conditionally_approved: "قبول مشروط — بانتظار العقد",
  contract_pending: "العقد قيد التوقيع",
  onboarding: "تهيئة الانضمام",
  active: "مدرب نشط",
  waitlisted: "قائمة الانتظار",
  rejected: "اعتذرنا هذه المرة",
  withdrawn: "مسحوب من قبلك",
  suspended: "موقوف",
};

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none";

/** قائمة منسدلة متعددة الاختيار — مربع صح بجانب كل خيار، والمختار يظهر وسمًا صغيرًا قابلا للإزالة */
function MultiPick({ id, label, options, selected, onChange }: {
  id: string; label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleValue = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="relative">
      <button
        type="button" id={id} aria-expanded={open} aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
        className={`${inputCls} flex cursor-pointer items-center justify-between text-right ${selected.length ? "text-white" : "text-white/40"}`}
      >
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-[#6EC7D1] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-labelledby={id} aria-multiselectable="true"
          className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#121B1D] p-1.5 shadow-xl shadow-black/40">
          {options.map((o) => {
            const checked = selected.includes(o);
            return (
              <label key={o} role="option" aria-selected={checked}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-white/5 ${checked ? "text-[#6EC7D1]" : "text-white/70"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleValue(o)} className="h-3.5 w-3.5 shrink-0 accent-[#38A7B4]" />
                {o}
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-2.5 py-1 text-[11px] font-bold text-[#6EC7D1]">
              {s}
              <button type="button" onClick={() => toggleValue(s)} aria-label={`أزل ${s}`} className="cursor-pointer text-white/50 transition hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface SubmitResponse {
  reference: string;
  status: string;
  devVerificationToken?: string;
}

/** صفحة انضمام المدربين — المرحلة الأولى على API حقيقي: تقديم، تحقق بريد، متابعة حالة */
export default function JoinTrainer() {
  const [form, setForm] = useState({
    fullName: "", email: "", phoneCountryCode: "+962", phone: "", country: "",
    jobTitle: "", employmentStatus: "", domainYears: "", trainingYears: "", bio: "", linkedinUrl: "",
    youtubeUrl: "", instagramUrl: "", accreditationDetails: "", hasAccreditation: false,
    deliveryMode: "", motivation: "", privacyConsent: false,
  });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["العربية"]);
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [targetAudiences, setTargetAudiences] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResponse | null>(null);

  /* تحقق البريد */
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  /* متابعة حالة طلب سابق */
  const [lookup, setLookup] = useState({ reference: "", email: "" });
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const toggle = (list: string[], v: string, fn: (x: string[]) => void) =>
    fn(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const valid =
    form.fullName.trim().length >= 3 && /.+@.+\..+/.test(form.email) &&
    specialties.length > 0 && form.employmentStatus && form.domainYears && form.trainingYears && form.deliveryMode &&
    form.motivation.trim().length >= 10 && form.privacyConsent;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const res = await apiPost<SubmitResponse>("/api/v1/trainer-applications", {
        fullName: form.fullName, email: form.email,
        phoneCountryCode: form.phoneCountryCode || undefined, phone: form.phone || undefined,
        country: form.country || undefined, timezone: COUNTRY_TIMEZONE[form.country] ?? undefined,
        employmentStatus: (form.employmentStatus || undefined) as "employed" | "own_business" | "full_time_training" | undefined,
        jobTitle: form.jobTitle || undefined,
        specialties, domainYears: form.domainYears, trainingYears: form.trainingYears,
        bio: form.bio || undefined, linkedinUrl: form.linkedinUrl || undefined,
        youtubeUrl: form.youtubeUrl || undefined, instagramUrl: form.instagramUrl || undefined,
        hasAccreditation: form.hasAccreditation,
        accreditationDetails: form.hasAccreditation ? form.accreditationDetails || undefined : undefined,
        targetCountries: targetCountries.length ? targetCountries : undefined,
        targetAudiences: targetAudiences.length ? targetAudiences : undefined,
        trainingLanguages: languages, deliveryMode: form.deliveryMode,
        motivation: form.motivation, privacyConsent: form.privacyConsent,
      });
      setResult(res);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر إرسال الطلب — تحقق من اتصالك وحاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!result || verifyBusy || verifyTokenInput.trim().length < 10) return;
    setVerifyBusy(true); setVerifyError("");
    try {
      await apiPost("/api/v1/trainer-applications/verify-email", {
        reference: result.reference, token: verifyTokenInput.trim(),
      });
      setVerified(true);
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : "تعذر التحقق — راجع الرمز وحاول مجددا");
    } finally {
      setVerifyBusy(false);
    }
  };

  const checkStatus = async () => {
    setLookupError(""); setLookupResult(null);
    try {
      const res = await apiGet<{ status: string }>(
        `/api/v1/trainer-applications/${encodeURIComponent(lookup.reference.trim())}/status?email=${encodeURIComponent(lookup.email.trim())}`
      );
      setLookupResult(STATUS_LABELS[res.status] ?? res.status);
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : "تعذر جلب الحالة");
    }
  };

  /* ── شاشة ما بعد الإرسال: الرقم المرجعي + تحقق البريد ── */
  if (result) {
    return (
      <SiteShell>
        <SeoHead title="طلبك وصل" description="طلب انضمام مدرب في أكاديمية وجيز" path="/join-trainer" />
        <div className="mx-auto max-w-lg py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#38A7B4]/15">
            {verified ? <CheckCircle2 className="h-8 w-8 text-[#6EC7D1]" /> : <MailCheck className="h-8 w-8 text-[#6EC7D1]" />}
          </span>
          <h1 className="mt-6 text-2xl font-black">{verified ? "بريدك متحقق — طلبك قيد المراجعة" : "طلبك محفوظ — بقيت خطوة التحقق"}</h1>
          <p className="mt-4 rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-4">
            <span className="text-xs text-white/50">رقمك المرجعي — احفظه لمتابعة طلبك</span>
            <span className="mt-1 block font-mono text-xl font-black tracking-wide text-[#FABC05]" dir="ltr">{result.reference}</span>
          </p>

          {!verified ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right">
              <p className="text-sm leading-7 text-white/65">
                أرسلنا رمز تحقق إلى بريدك <b className="text-white">{form.email}</b> — أدخله هنا ليصبح طلبك «مُقدَّما» رسميا:
              </p>
              {result.devVerificationToken && (
                <p className="mt-2 rounded-lg bg-black/40 p-2 font-mono text-[11px] text-white/45" dir="ltr">
                  بيئة التطوير — الرمز: {result.devVerificationToken}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  dir="ltr" value={verifyTokenInput} onChange={(e) => setVerifyTokenInput(e.target.value)}
                  placeholder="رمز التحقق" aria-label="رمز التحقق"
                  className={`${inputCls} text-left font-mono`}
                />
                <button
                  onClick={verify} disabled={verifyBusy || verifyTokenInput.trim().length < 10}
                  className="shrink-0 cursor-pointer rounded-xl bg-[#38A7B4] px-5 text-sm font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40"
                >
                  {verifyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحقق"}
                </button>
              </div>
              {verifyError && <p className="mt-2 text-xs text-red-300" role="alert">{verifyError}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-8 text-white/60">
              سيراجع فريقنا طلبك، وإن اختُرت أوليًا ستصلك دعوة لاستكمال ملفك المهني (المرحلة الثانية).
              تابع حالتك في أي وقت بالرقم المرجعي وبريدك من أسفل صفحة الانضمام.
            </p>
          )}
          <div>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#6EC7D1] transition hover:text-[#38A7B4]">
              العودة للرئيسية <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead
        title="انضم مدربا"
        description="درّب في أكاديمية وجيز — عبّئ طلب الانضمام الأولي وسيراجعه فريقنا الأكاديمي."
        path="/join-trainer"
      />
      <div className="mx-auto max-w-2xl">
        <span className="kicker">انضم إلى نخبة المدربين</span>
        <h1 className="h-section mt-4">درّب ما تتقنه — وأثرّ في مسارات حقيقية</h1>
        <p className="mt-3 text-sm leading-8 text-white/60">
          مدربو وجيز لا يلقون دروسا مسجلة فحسب — يراجعون واجبات، ويرافقون طلابا، ويقيمون مشاريع تخرج.
          الطلب يمر بمرحلتين: هذا الطلب الأولي، ثم ملف مهني يُفتح للمرشحين فقط.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Compass, text: "مسارات مبنية بمنهجية موثقة لا بمزاج" },
            { icon: Users, text: "طلاب جادون وصلوا عبر تشخيص" },
            { icon: Mic2, text: "مقابلة ودرس تجريبي قبل الاعتماد" },
          ].map((f) => (
            <div key={f.text} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <f.icon className="h-5 w-5 text-[#6EC7D1]" />
              <p className="mt-2 text-xs font-bold leading-6 text-white/85">{f.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jt-name" className="mb-1.5 block text-xs font-bold text-white/60">الاسم الكامل *</label>
              <input id="jt-name" name="name" autoComplete="name" required value={form.fullName} onChange={set("fullName")} className={inputCls} />
            </div>
            <div>
              <label htmlFor="jt-email" className="mb-1.5 block text-xs font-bold text-white/60">البريد الإلكتروني *</label>
              <input id="jt-email" name="email" type="email" autoComplete="email" required dir="ltr" value={form.email} onChange={set("email")} className={`${inputCls} text-left`} />
            </div>
            <div className="flex gap-2">
              <div className="w-24 shrink-0">
                <label htmlFor="jt-cc" className="mb-1.5 block text-xs font-bold text-white/60">الرمز</label>
                <select id="jt-cc" value={form.phoneCountryCode} onChange={set("phoneCountryCode")} className={`${inputCls} [&>option]:bg-[#121B1D]`} dir="ltr">
                  {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="jt-phone" className="mb-1.5 block text-xs font-bold text-white/60">رقم الجوال (واتساب)</label>
                <input id="jt-phone" name="tel" type="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={set("phone")} className={`${inputCls} text-left`} />
              </div>
            </div>
            <div>
              <label htmlFor="jt-country" className="mb-1.5 block text-xs font-bold text-white/60">دولة الإقامة</label>
              <select id="jt-country" value={form.country} onChange={set("country")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر دولتك</option>
                {ARAB_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div>
              <label htmlFor="jt-employment" className="mb-1.5 block text-xs font-bold text-white/60">حالتك المهنية الحالية *</label>
              <select id="jt-employment" required value={form.employmentStatus} onChange={set("employmentStatus")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر الأقرب لواقعك</option>
                {EMPLOYMENT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="jt-role" className="mb-1.5 block text-xs font-bold text-white/60">المسمى المهني الحالي</label>
              <input id="jt-role" name="role" placeholder="مثال: مدير تحليل بيانات" value={form.jobTitle} onChange={set("jobTitle")} className={inputCls} />
            </div>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-white/60">تخصصاتك التدريبية * — اختر كل ما تتقنه فعلا</legend>
            <div className="flex flex-wrap gap-2">
              {TRAINING_SPECIALIZATIONS.map((s) => (
                <button
                  type="button" key={s} onClick={() => toggle(specialties, s, setSpecialties)}
                  aria-pressed={specialties.includes(s)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    specialties.includes(s)
                      ? "border-[#38A7B4] bg-[#38A7B4]/15 text-[#6EC7D1]"
                      : "border-white/15 text-white/55 hover:border-white/35"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jt-years" className="mb-1.5 block text-xs font-bold text-white/60">سنوات الخبرة المهنية في المجال *</label>
              <select id="jt-years" required value={form.domainYears} onChange={set("domainYears")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر نطاق الخبرة</option>
                {DOMAIN_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="jt-training" className="mb-1.5 block text-xs font-bold text-white/60">سنوات/نوع خبرة التدريب تحديدا *</label>
              <select id="jt-training" required value={form.trainingYears} onChange={set("trainingYears")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر الأقرب لواقعك</option>
                {TRAINING_YEARS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-white/40">إتقان المجال شيء والقدرة على تدريبه شيء آخر — نقرؤهما منفصلين.</p>

          <div>
            <label htmlFor="jt-bio" className="mb-1.5 block text-xs font-bold text-white/60">نبذة مختصرة عنك</label>
            <textarea id="jt-bio" rows={2} value={form.bio} onChange={set("bio")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="jt-links" className="mb-1.5 block text-xs font-bold text-white/60">رابط لينكدإن أو ملف أعمال</label>
            <input id="jt-links" name="links" dir="ltr" placeholder="https://linkedin.com/in/..." value={form.linkedinUrl} onChange={set("linkedinUrl")} className={`${inputCls} text-left`} />
          </div>

          {/* حضور رقمي واعتماد — تساعد المراجعة الأكاديمية على تقييم المتقدم */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jt-youtube" className="mb-1.5 block text-xs font-bold text-white/60">قناة يوتيوب أو فيديو تدريبي لك</label>
              <input id="jt-youtube" dir="ltr" placeholder="https://youtube.com/@..." value={form.youtubeUrl} onChange={set("youtubeUrl")} className={`${inputCls} text-left`} />
            </div>
            <div>
              <label htmlFor="jt-instagram" className="mb-1.5 block text-xs font-bold text-white/60">حساب إنستغرام المهني</label>
              <input id="jt-instagram" dir="ltr" placeholder="https://instagram.com/..." value={form.instagramUrl} onChange={set("instagramUrl")} className={`${inputCls} text-left`} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox" checked={form.hasAccreditation}
                onChange={(e) => setForm({ ...form, hasAccreditation: e.target.checked, accreditationDetails: e.target.checked ? form.accreditationDetails : "" })}
                className="mt-0.5 h-4 w-4 accent-[#38A7B4]"
              />
              <span className="text-xs leading-6 text-white/60">
                لدي اعتماد أو ترخيص رسمي من جهة أو هيئة تدريب معترف بها
              </span>
            </label>
            {form.hasAccreditation && (
              <div className="mt-3">
                <label htmlFor="jt-accred" className="mb-1.5 block text-xs font-bold text-white/60">اسم الجهة وتفاصيل الاعتماد</label>
                <input id="jt-accred" placeholder="مثال: اعتماد هيئة تقويم التعليم والتدريب — رقم ..." value={form.accreditationDetails} onChange={set("accreditationDetails")} className={inputCls} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jt-target-countries" className="mb-1.5 block text-xs font-bold text-white/60">الدول التي تستهدفها بتدريبك</label>
              <MultiPick id="jt-target-countries" label="اختر من القائمة" options={[ALL_ARAB, ...ARAB_COUNTRIES]} selected={targetCountries} onChange={setTargetCountries} />
            </div>
            <div>
              <label htmlFor="jt-target-audiences" className="mb-1.5 block text-xs font-bold text-white/60">الفئات التي تستهدفها</label>
              <MultiPick id="jt-target-audiences" label="اختر من القائمة" options={TARGET_AUDIENCES} selected={targetAudiences} onChange={setTargetAudiences} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-1.5 text-xs font-bold text-white/60">لغات التدريب *</legend>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    type="button" key={l} onClick={() => toggle(languages, l, setLanguages)}
                    aria-pressed={languages.includes(l)}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      languages.includes(l) ? "border-[#38A7B4] bg-[#38A7B4]/15 text-[#6EC7D1]" : "border-white/15 text-white/55 hover:border-white/35"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="jt-mode" className="mb-1.5 block text-xs font-bold text-white/60">نمط التدريب *</label>
              <select id="jt-mode" required value={form.deliveryMode} onChange={set("deliveryMode")} className={`${inputCls} [&>option]:bg-[#121B1D]`}>
                <option value="" disabled>اختر</option>
                <option value="remote">عن بعد</option>
                <option value="in_person">حضوري</option>
                <option value="both">كلاهما</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="jt-why" className="mb-1.5 block text-xs font-bold text-white/60">لماذا تريد الانضمام إلى وجيز تحديدا؟ *</label>
            <textarea id="jt-why" rows={3} required value={form.motivation} onChange={set("motivation")} className={inputCls} />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
            <input
              type="checkbox" checked={form.privacyConsent}
              onChange={(e) => setForm({ ...form, privacyConsent: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[#38A7B4]"
            />
            <span className="text-xs leading-6 text-white/60">
              أوافق على أن تُستخدم بياناتي لإدارة طلب الانضمام والتواصل بشأنه فقط، وفق{" "}
              <Link to="/p/privacy" className="text-[#6EC7D1] underline">سياسة الخصوصية</Link>. *
            </span>
          </label>

          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200" role="alert">{error}</p>}

          <button
            type="submit" disabled={!valid || busy}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FABC05] py-3.5 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? "جاري الإرسال…" : "أرسل طلب الانضمام"}
          </button>
        </form>

        {/* متابعة طلب سابق */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="flex items-center gap-2 text-sm font-black"><Search className="h-4 w-4 text-[#6EC7D1]" /> قدّمت سابقا؟ تابع حالة طلبك</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input dir="ltr" placeholder="WJ-TR-2026-00001" aria-label="الرقم المرجعي" value={lookup.reference}
              onChange={(e) => setLookup({ ...lookup, reference: e.target.value })} className={`${inputCls} text-left font-mono`} />
            <input dir="ltr" type="email" placeholder="بريدك المستخدم في الطلب" aria-label="البريد" value={lookup.email}
              onChange={(e) => setLookup({ ...lookup, email: e.target.value })} className={`${inputCls} text-left`} />
          </div>
          <button
            onClick={checkStatus} disabled={!lookup.reference.trim() || !lookup.email.trim()}
            className="mt-3 cursor-pointer rounded-full border border-[#38A7B4]/50 px-5 py-2 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/10 disabled:opacity-40"
          >
            اعرض الحالة
          </button>
          {lookupResult && <p className="mt-3 rounded-xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-3 text-xs font-bold text-[#6EC7D1]">{lookupResult}</p>}
          {lookupError && <p className="mt-3 text-xs text-red-300" role="alert">{lookupError}</p>}
        </div>
      </div>
    </SiteShell>
  );
}
