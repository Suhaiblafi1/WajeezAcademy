import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, ChevronDown, Compass, Copy,
  FileUp, Loader2, MailCheck, Mic2, RefreshCcw, Search, Send, Sparkles, Users,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, apiGet, ApiError } from "@/services/api";
import { TRAINING_SPECIALIZATIONS } from "@/data/trainer-contracts";
import TeachableCoursePicker from "@/components/TeachableCoursePicker";

/* صفحة انضمام المدربين.

   كانت نموذجا واحدا طويلا: اثنتا عشرة خانة وأربع مجموعات وقوائم متعددة الاختيار
   على شاشة واحدة، يقرؤها المتقدم كلها قبل أن يعرف إن كان الطلب يعنيه أصلا.
   صارت ثلاث خطوات قصيرة لكل منها سؤال واحد واضح — من أنت، ماذا تُتقن، كيف تدرّب —
   بمؤشر تقدّم وتحقق لكل خطوة على حدة، فلا يُرمى الخطأ كله في وجهه عند الإرسال.
   لا حقل حُذف ولا أُضيف: نفس البيانات، مرتّبة بترتيب يُسأل به الإنسان.

   وأُصلح فيها انقطاع حقيقي: رمز المرشح الذي يصدره تحقق البريد كان يُهمَل في
   الرد (`await apiPost(...)` بلا قراءة)، وهو الرمز الوحيد الذي يفتح المرحلة
   الثانية ورفع الوثائق والسحب. فكان `/join-trainer/complete` صفحة لا يملك أحد
   مفتاحها. يُعرض الآن مع رابطه جاهزا. */

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

const EMPLOYMENT_STATUS = [
  { value: "employed", label: "موظف — أعمل لدى جهة" },
  { value: "own_business", label: "لدي عملي الخاص" },
  { value: "full_time_training", label: "متفرغ للتدريب" },
];

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
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none";

/* أربعة أقسام في نموذج واحد لا مرحلتان بينهما بريد.

   كان الطلب يُقسم مرحلتين: مرحلة أولى تُرسَل، ثم رابطٌ يصل بالبريد يفتح مرحلة
   ثانية. وكلفة ذلك أن كل متقدّم يعبر بابين لا بابا، وأن قناة البريد صارت
   شرطا لإكمال الطلب — من لم تصله الرسالة توقف طلبه عند نصفه.
   والقسمان الأخيران يحتاجان مرجع الطلب (لرفع الملفات)، فيُرسَل القسمان
   الأولان في الخلفية عند الانتقال إلى الثالث — والمتقدّم يرى نموذجا واحدا. */
/* حدّ الدافع: ١٥٠ حرفا لا عشرة. «أحب التدريب» جوابٌ كان يمرّ ولا يُقرأ منه
   شيء ولا يفاضل بين طلبين. والسقف ٥٠٠ يمنع سيرةً ذاتية ثانية في حقل نصّ.
   الرقمان هنا مطابقان لما يفرضه الخادم — والعدّاد يقرأ منهما. */
export const MOTIVATION_MIN = 150;
export const MOTIVATION_MAX = 500;

const DOC_KINDS = [
  { kind: "cv", label: "السيرة الذاتية", hint: "PDF · حتى ١٠MB", accept: "application/pdf", required: true },
  { kind: "evidence", label: "ملف أعمال أو نماذج تدريب سابقة", hint: "PDF أو رابط في الحقول أدناه · حتى ٢٠MB", accept: "application/pdf,image/*", required: false },
  { kind: "training_video", label: "فيديو تدريبي", hint: "حتى ٣٠٠MB — أو ضع رابط قناتك أدناه", accept: "video/*", required: false },
  { kind: "certificate", label: "شهادات واعتمادات", hint: "PDF أو صورة · حتى ٢٠MB", accept: "application/pdf,image/*", required: false },
] as const;

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

interface UploadState { status: "idle" | "registering" | "uploading" | "done" | "error"; name?: string; error?: string }

const STEPS = [
  { n: 1, title: "معلوماتك وخبرتك", hint: "من أنت وماذا تُتقن" },
  { n: 2, title: "ما يمكنك تدريسه", hint: "من الكتالوج، بمجاله ومستواه" },
  { n: 3, title: "نماذجك وأدلتك", hint: "سيرتك ودوراتك السابقة" },
  { n: 4, title: "مراجعة وإرسال", hint: "ما سيقرؤه المراجع عنك" },
] as const;

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
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-teal-light-ink transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-labelledby={id} aria-multiselectable="true"
          className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-white/15 bg-surface p-1.5 shadow-xl shadow-black/40">
          {options.map((o) => {
            const checked = selected.includes(o);
            return (
              <label key={o} role="option" aria-selected={checked}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-white/5 ${checked ? "text-teal-light-ink" : "text-white/70"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleValue(o)} className="h-3.5 w-3.5 shrink-0 accent-teal" />
                {o}
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal-light-ink">
              {s}
              <button type="button" onClick={() => toggleValue(s)} aria-label={`أزل ${s}`} className="cursor-pointer text-white/50 transition hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** أوسمة اختيار متعددة — بديل مريح للقوائم حين تكون الخيارات قليلة ومقروءة */
function Chips({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            type="button" key={o} onClick={() => onToggle(o)} aria-pressed={on}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
              on ? "border-teal bg-teal/15 text-teal-light-ink" : "border-white/15 text-white/55 hover:border-white/35"
            }`}
          >
            {on && <Check aria-hidden="true" className="ml-1 inline h-3 w-3" />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** صندوق نصّ قابل للنسخ — للرمز والرابط اللذين يحتاجهما المرشح لاحقا */
function CopyBox({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => setDone(true)).catch(() => setDone(false));
  };
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-[11px] font-bold text-white/45">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code dir="ltr" className={`min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] text-white/80 ${mono ? "font-mono" : ""}`}>
          {value}
        </code>
        <button
          type="button" onClick={copy} aria-label={`انسخ ${label}`}
          className="shrink-0 cursor-pointer rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white/70 transition hover:border-teal/50 hover:text-teal-light-ink"
        >
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

interface SubmitResponse {
  reference: string;
  status: string;
  emailDelivery?: "sent" | "not_configured" | "failed";
  /** يصدر حين تتعذّر قناة البريد فيمضي الطلب بلا بوابة بريدية */
  candidateToken?: string;
  devVerificationToken?: string;
}

/** صفحة انضمام المدربين — المرحلة الأولى على API حقيقي: تقديم، تحقق بريد، متابعة حالة */
export default function JoinTrainer() {
  const [step, setStep] = useState(1);
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
  /* رمز المرشح — من رد التحقق أو من رد التقديم حين تتعذّر قناة البريد */
  const [candidateToken, setCandidateToken] = useState("");

  /* الأقسام 2–4 — كانت في صفحة مستقلة تُفتح برابط بريد، وصارت أقساما هنا */
  const [teachable, setTeachable] = useState<string[]>([]);
  const [prevCourses, setPrevCourses] = useState([
    { title: "", org: "", year: "", link: "" },
    { title: "", org: "", year: "", link: "" },
    { title: "", org: "", year: "", link: "" },
  ]);
  const [days, setDays] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [demoConsent, setDemoConsent] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [phase2Done, setPhase2Done] = useState(false);

  /* متابعة حالة طلب سابق */
  const [lookup, setLookup] = useState({ reference: "", email: "" });
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [resent, setResent] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ candidateToken: "", reason: "" });
  const [withdrawMsg, setWithdrawMsg] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const toggle = (list: string[], v: string, fn: (x: string[]) => void) =>
    fn(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  /* تحقق لكل قسم على حدة — الخطأ يظهر عند بابه لا كله عند الإرسال.

     والقسم الأول يحمل كل ما تطلبه المرحلة الأولى في الخادم، لأنه هو الذي
     يُرسَل عند الانتقال إلى الثاني: قسمٌ ناقص يعني طلبا مرفوضا في الخلفية
     والمتقدّم يظن أنه مضى. */
  const motivationLen = form.motivation.trim().length;
  const stepValid = useMemo(() => ({
    1:
      form.fullName.trim().length >= 3 && /.+@.+\..+/.test(form.email) && Boolean(form.employmentStatus) &&
      specialties.length > 0 && Boolean(form.domainYears) && Boolean(form.trainingYears) &&
      languages.length > 0 && Boolean(form.deliveryMode) &&
      motivationLen >= MOTIVATION_MIN && motivationLen <= MOTIVATION_MAX && form.privacyConsent,
    2: teachable.length > 0 && demoConsent,
    3: uploads.cv?.status === "done" && prevCourses.some((c) => c.title.trim().length >= 2),
    4: true,
  }), [form, specialties, languages, motivationLen, teachable, demoConsent, uploads, prevCourses]);

  const valid = stepValid[1] && stepValid[2] && stepValid[3];

  /* الإرسال النهائي — الأقسام 2–4. القسم الأول أُرسل عند المضيّ منه. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy || !result || !candidateToken) return;
    setBusy(true); setError("");
    try {
      await apiPost(`/api/v1/trainer-applications/${encodeURIComponent(result.reference)}/phase-2`, {
        candidateToken,
        previousCourses: prevCourses
          .filter((c) => c.title.trim().length >= 2)
          .map((c) => ({
            title: c.title.trim(),
            org: c.org.trim() || undefined,
            year: c.year ? Number(c.year) : undefined,
            link: c.link.trim() || undefined,
          })),
        teachableCourseIds: teachable,
        availability: {
          days: days.length ? days : undefined,
          hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
          startFrom: startFrom || undefined,
        },
        demoConsent,
      });
      setPhase2Done(true);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر إرسال الطلب — تحقق من اتصالك وحاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  /* رفع مستند — يُسجَّل عند الخادم ثم يُرفع، وكل حالة تُعرض باسمها.
     والخطأ يبقى مع صاحبه (لكل نوع حالته) وبزر إعادة، لا رسالة عامة أعلى
     الصفحة تجعل المتقدّم يخمّن أيّ ملف سقط. */
  const uploadFile = async (kind: string, file: File) => {
    if (!result) return;
    setUploads((u) => ({ ...u, [kind]: { status: "registering", name: file.name } }));
    try {
      const reg = await apiPost<{ uploadUrl: string }>(
        `/api/v1/trainer-applications/${encodeURIComponent(result.reference)}/documents`,
        { candidateToken, kind, originalName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size },
      );
      setUploads((u) => ({ ...u, [kind]: { status: "uploading", name: file.name } }));
      const res = await fetch(reg.uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error("upload failed");
      setUploads((u) => ({ ...u, [kind]: { status: "done", name: file.name } }));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "تعذّر الرفع — جرّب مجددا";
      setUploads((u) => ({ ...u, [kind]: { status: "error", name: file.name, error: msg } }));
    }
  };

  /* المضيّ من القسم الأول: يُرسَل الطلب في الخلفية كي يوجد له مرجعٌ ترفع عليه
     الملفات. المتقدّم يرى «التالي» لا «إرسال» — والنموذج واحد عنده. */
  const startApplication = async () => {
    if (result || busy) return true;
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
        motivation: form.motivation.trim(), privacyConsent: form.privacyConsent,
      });
      setResult(res);
      if (res.candidateToken) { setCandidateToken(res.candidateToken); setVerified(true); }
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر بدء الطلب — تحقق من اتصالك وحاول مجددا");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!result || verifyBusy || verifyTokenInput.trim().length < 10) return;
    setVerifyBusy(true); setVerifyError("");
    try {
      /* الرد يحمل رمز المرشح — وكان يُهمَل، فتُغلق المرحلة الثانية على صاحبها */
      const res = await apiPost<{ candidateToken?: string }>("/api/v1/trainer-applications/verify-email", {
        reference: result.reference, token: verifyTokenInput.trim(),
      });
      if (res.candidateToken) setCandidateToken(res.candidateToken);
      setVerified(true);
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : "تعذر التحقق — راجع الرمز وحاول مجددا");
    } finally {
      setVerifyBusy(false);
    }
  };

  const resendVerify = async () => {
    if (resent) return;
    try {
      const res = await apiPost<{ ok: boolean; devVerificationToken?: string }>(
        "/api/v1/trainer-applications/resend-verification", { email: form.email.trim().toLowerCase() }
      );
      if (res.devVerificationToken) setVerifyTokenInput(res.devVerificationToken);
      setResent(true);
    } catch {
      setVerifyError("تعذرت إعادة الإرسال — حاول بعد قليل");
    }
  };

  const withdrawApplication = async () => {
    setWithdrawMsg("");
    try {
      await apiPost(`/api/v1/trainer-applications/${encodeURIComponent(lookup.reference.trim())}/withdraw`, {
        candidateToken: withdrawForm.candidateToken.trim(),
        reason: withdrawForm.reason.trim() || undefined,
      });
      setWithdrawMsg("سُحب طلبك — شكرا لاهتمامك، وتبقى أهلا بك متى ما عدت");
      setLookupResult(null);
    } catch (err) {
      setWithdrawMsg(err instanceof ApiError ? err.message : "تعذر السحب — تحقق من رمز المرشح");
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

  /* ── شاشة ما بعد الإرسال ── تظهر بعد اكتمال الأقسام الأربعة لا بعد الأول:
     بدء الطلب في الخلفية تفصيلٌ تقني، وإظهار شاشة النجاح عنده يوهم المتقدّم
     أنه انتهى وقد بقي نصف طلبه. */
  if (result && phase2Done) {
    const mailUnavailable = result.emailDelivery && result.emailDelivery !== "sent";
    return (
      <SiteShell>
        <SeoHead title="طلبك وصل" description="طلب انضمام مدرب في أكاديمية وجيز" path="/join-trainer" />
        <div className="mx-auto max-w-lg py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal/15">
            {verified ? <CheckCircle2 className="h-8 w-8 text-teal-light-ink" /> : <MailCheck className="h-8 w-8 text-teal-light-ink" />}
          </span>
          <h1 className="mt-6 text-2xl font-black">
            {verified ? "طلبك قيد المراجعة" : "طلبك محفوظ — بقيت خطوة التحقق"}
          </h1>
          <p className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4">
            <span className="text-xs text-white/50">رقمك المرجعي — احفظه لمتابعة طلبك</span>
            <span className="mt-1 block font-mono text-xl font-black tracking-wide text-gold-ink" dir="ltr">{result.reference}</span>
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
                  className="shrink-0 cursor-pointer rounded-xl bg-teal px-5 text-sm font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40"
                >
                  {verifyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحقق"}
                </button>
              </div>
              {verifyError && <p className="mt-2 text-xs text-red-300" role="alert">{verifyError}</p>}
              <button
                type="button" onClick={resendVerify} disabled={resent}
                className="mt-3 cursor-pointer text-xs font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 transition hover:text-teal-ink disabled:cursor-default disabled:text-white/40 disabled:no-underline"
              >
                {resent ? "أُعيد الإرسال — راجع بريدك مجددا" : "لم يصلك الرمز؟ أعد الإرسال"}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4 text-right">
              {mailUnavailable && (
                <p className="rounded-xl border border-gold/30 bg-gold/[0.07] p-4 text-xs leading-6 text-gold-ink">
                  تعذّر إرسال بريد التأكيد الآن، فسجّلنا طلبك مباشرة بلا خطوة التحقق البريدي — واحفظ رمز
                  المتابعة أدناه لأنه لن يصلك بالبريد.
                </p>
              )}
              <p className="text-sm leading-8 text-white/60">
                وصلنا طلبك كاملا — بأقسامه الأربعة ومستنداتك. سيقرؤه فريقنا ثم نراسلك بالخطوة التالية:
                مقابلة ودرس تجريبي قصير. احفظ رقمك المرجعي ورمز المرشح أدناه — بهما تتابع حالتك أو تسحب طلبك.
              </p>

              {candidateToken && (
                <div className="rounded-2xl border border-teal/30 bg-teal/[0.05] p-5">
                  <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
                    <BadgeCheck className="h-4 w-4" /> مفتاح متابعة طلبك
                  </p>
                  <CopyBox label="رمز المرشح — لمتابعة الحالة أو سحب الطلب" value={candidateToken} />
                </div>
              )}
            </div>
          )}
          <div>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-teal-light-ink transition hover:text-teal-ink">
              العودة للرئيسية <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SiteShell>
    );
  }

  /* المضيّ من القسم الأول يبدأ الطلب في الخادم أولا — فبدونه لا مرجع تُرفع
     عليه مستنداتُ القسم الثالث. وإن أخفق البدء بقي المتقدّم مكانه مع الخطأ،
     ولم يمضِ إلى قسمٍ لا يعمل. */
  const next = async () => {
    if (step === 1 && !result) {
      const ok = await startApplication();
      if (!ok) return;
    }
    setStep((n) => Math.min(4, n + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => { setStep((n) => Math.max(1, n - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <SiteShell>
      <SeoHead
        title="انضم مدربا"
        description="درّب في أكاديمية وجيز — عبّئ طلب الانضمام الأولي وسيراجعه فريقنا الأكاديمي."
        path="/join-trainer"
      />
      <div className="mx-auto max-w-3xl">
        <span className="kicker">انضم إلى نخبة المدربين</span>
        <h1 className="h-section mt-4">درّب ما تتقنه — وأثرّ في مسارات حقيقية</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">
          مدربو وجيز لا يلقون دروسا مسجلة فحسب — يراجعون واجبات، ويرافقون طلابا، ويقيمون مشاريع تخرج.
          نموذج واحد بأربعة أقسام — يُحفظ تقدّمك كلما مضيت، ولا ينتظرك بريد بينها.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Compass, text: "مسارات مبنية بمنهجية موثقة لا بمزاج" },
            { icon: Users, text: "طلاب جادون وصلوا عبر تشخيص" },
            { icon: Mic2, text: "مقابلة ودرس تجريبي قبل الاعتماد" },
          ].map((f) => (
            <div key={f.text} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <f.icon className="h-5 w-5 text-teal-light-ink" />
              <p className="mt-3 text-xs font-bold leading-6 text-white/85">{f.text}</p>
            </div>
          ))}
        </div>

        {/* مؤشر الخطوات — ثلاث محطات قصيرة بدل جدار واحد */}
        <ol className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="أقسام الطلب">
          {STEPS.map((s) => {
            const state = s.n === step ? "current" : s.n < step ? "done" : "todo";
            return (
              <li key={s.n} aria-current={state === "current" ? "step" : undefined}>
                <div
                  className={`rounded-2xl border p-3 transition-colors ${
                    state === "current" ? "border-gold/50 bg-gold/[0.07]"
                      : state === "done" ? "border-teal/35 bg-teal/[0.05]" : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-black ${
                        state === "current" ? "bg-gold text-on-gold"
                          : state === "done" ? "bg-teal/20 text-teal-light-ink" : "bg-white/10 text-white/45"
                      }`}
                      dir="ltr"
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : s.n}
                    </span>
                    <span className={`text-xs font-black ${state === "todo" ? "text-white/45" : "text-white"}`}>{s.title}</span>
                  </span>
                  <span className="mt-1.5 block text-[10.5px] leading-relaxed text-white/40">{s.hint}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <form onSubmit={submit} className="mt-5 space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-9">
          {/* ══ ١) من أنت ══ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
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
                    <select id="jt-cc" value={form.phoneCountryCode} onChange={set("phoneCountryCode")} className={`${inputCls} [&>option]:bg-surface`} dir="ltr">
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
                  <select id="jt-country" value={form.country} onChange={set("country")} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="" disabled>اختر دولتك</option>
                    {ARAB_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="jt-employment" className="mb-1.5 block text-xs font-bold text-white/60">حالتك المهنية الحالية *</label>
                  <select id="jt-employment" value={form.employmentStatus} onChange={set("employmentStatus")} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="" disabled>اختر الأقرب لواقعك</option>
                    {EMPLOYMENT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="jt-role" className="mb-1.5 block text-xs font-bold text-white/60">المسمى المهني الحالي</label>
                  <input id="jt-role" name="role" placeholder="مثال: مدير تحليل بيانات" value={form.jobTitle} onChange={set("jobTitle")} className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="jt-bio" className="mb-1.5 block text-xs font-bold text-white/60">نبذة مختصرة عنك</label>
                <textarea id="jt-bio" rows={2} value={form.bio} onChange={set("bio")} className={inputCls} />
              </div>

              <fieldset className="border-t border-white/5 pt-6">
                <legend className="mb-1 text-xs font-bold text-white/60">تخصصاتك التدريبية *</legend>
                <p className="mb-3 text-[11px] text-white/40">اختر ما تتقنه فعلا — الكثرة هنا لا تُحسب لك، والدقة تُحسب.</p>
                <Chips options={TRAINING_SPECIALIZATIONS} selected={specialties} onToggle={(v) => toggle(specialties, v, setSpecialties)} />
              </fieldset>

              <div className="grid gap-5 border-t border-white/5 pt-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="jt-years" className="mb-1.5 block text-xs font-bold text-white/60">سنوات الخبرة المهنية في المجال *</label>
                  <select id="jt-years" value={form.domainYears} onChange={set("domainYears")} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="" disabled>اختر نطاق الخبرة</option>
                    {DOMAIN_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="jt-training" className="mb-1.5 block text-xs font-bold text-white/60">خبرة التدريب تحديدا *</label>
                  <select id="jt-training" value={form.trainingYears} onChange={set("trainingYears")} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="" disabled>اختر الأقرب لواقعك</option>
                    {TRAINING_YEARS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="-mt-3 text-[11px] text-white/40">إتقان المجال شيء والقدرة على تدريبه شيء آخر — نقرؤهما منفصلين.</p>

              <div className="space-y-5 border-t border-white/5 pt-6">
                <p className="text-xs font-bold text-white/60">أدلتك — اختيارية كلها، لكنها ما يقرؤه المراجع قبل غيره</p>
                <p className="-mt-3 text-[11px] leading-relaxed text-white/45">
                  كل دليل واضح وموثوق يساعدنا على فهم خبرتك بسرعة ودقة. تُمنح الأولوية للطلبات التي تعرض خبرة
                  قابلة للتحقق ونماذج حقيقية من العمل أو التدريب.
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="jt-links" className="mb-1.5 block text-xs font-bold text-white/60">لينكدإن أو ملف أعمال</label>
                    <input id="jt-links" name="links" dir="ltr" placeholder="https://linkedin.com/in/..." value={form.linkedinUrl} onChange={set("linkedinUrl")} className={`${inputCls} text-left`} />
                  </div>
                  <div>
                    <label htmlFor="jt-youtube" className="mb-1.5 block text-xs font-bold text-white/60">فيديو تدريبي أو قناة</label>
                    <input id="jt-youtube" dir="ltr" placeholder="https://youtube.com/@..." value={form.youtubeUrl} onChange={set("youtubeUrl")} className={`${inputCls} text-left`} />
                  </div>
                  <div>
                    <label htmlFor="jt-instagram" className="mb-1.5 block text-xs font-bold text-white/60">حساب إنستغرام المهني</label>
                    <input id="jt-instagram" dir="ltr" placeholder="https://instagram.com/..." value={form.instagramUrl} onChange={set("instagramUrl")} className={`${inputCls} text-left`} />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox" checked={form.hasAccreditation}
                      onChange={(e) => setForm({ ...form, hasAccreditation: e.target.checked, accreditationDetails: e.target.checked ? form.accreditationDetails : "" })}
                      className="mt-0.5 h-4 w-4 accent-teal"
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
              </div>

              <div className="grid gap-5 border-t border-white/5 pt-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="jt-target-countries" className="mb-1.5 block text-xs font-bold text-white/60">الدول التي تستهدفها بتدريبك</label>
                  <MultiPick id="jt-target-countries" label="اختر من القائمة" options={[ALL_ARAB, ...ARAB_COUNTRIES]} selected={targetCountries} onChange={setTargetCountries} />
                </div>
                <div>
                  <label htmlFor="jt-target-audiences" className="mb-1.5 block text-xs font-bold text-white/60">الفئات التي تستهدفها</label>
                  <MultiPick id="jt-target-audiences" label="اختر من القائمة" options={TARGET_AUDIENCES} selected={targetAudiences} onChange={setTargetAudiences} />
                </div>
              </div>

              <div className="grid gap-5 border-t border-white/5 pt-6 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-bold text-white/60">لغات التدريب *</legend>
                  <Chips options={LANGUAGES} selected={languages} onToggle={(v) => toggle(languages, v, setLanguages)} />
                </fieldset>
                <div>
                  <label htmlFor="jt-mode" className="mb-1.5 block text-xs font-bold text-white/60">نمط التدريب *</label>
                  <select id="jt-mode" value={form.deliveryMode} onChange={set("deliveryMode")} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="" disabled>اختر</option>
                    <option value="remote">عن بعد</option>
                    <option value="in_person">حضوري</option>
                    <option value="both">كلاهما</option>
                  </select>
                </div>
              </div>

              {/* عدّادٌ مباشر لا رسالةَ رفضٍ بعد الضغط: من كتب ٤٠ حرفا يجب أن يرى
                  كم بقي وهو يكتب، لا أن يُردّ عند الإرسال. */}
              <div className="border-t border-white/5 pt-6">
                <label htmlFor="jt-why" className="mb-1.5 block text-xs font-bold text-white/60">لماذا تريد الانضمام إلى وجيز تحديدا؟ *</label>
                <textarea
                  id="jt-why" rows={4} value={form.motivation} onChange={set("motivation")}
                  maxLength={MOTIVATION_MAX}
                  aria-describedby="jt-why-count"
                  className={`${inputCls} ${motivationLen > 0 && motivationLen < MOTIVATION_MIN ? "border-gold/50" : ""}`}
                />
                <p id="jt-why-count" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className={motivationLen < MOTIVATION_MIN ? "text-gold-ink" : "text-white/40"}>
                    {motivationLen < MOTIVATION_MIN
                      ? `اكتب ${MOTIVATION_MIN} حرفا على الأقل. أضف مثالا يوضّح القيمة التي ستقدّمها للمتعلمين في وجيز.`
                      : "نقرؤها فعلا — وهي أول ما يقرؤه المراجع."}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/45" dir="ltr">
                    {motivationLen} / {MOTIVATION_MAX}
                  </span>
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
                <input
                  type="checkbox" checked={form.privacyConsent}
                  onChange={(e) => setForm({ ...form, privacyConsent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-teal"
                />
                <span className="text-xs leading-6 text-white/60">
                  أوافق على أن تُستخدم بياناتي لإدارة طلب الانضمام والتواصل بشأنه فقط، وفق{" "}
                  <Link to="/p/privacy" className="text-teal-light-ink underline">سياسة الخصوصية</Link>. *
                </span>
              </label>

            </div>
          )}

          {/* ══ ٢) ما يمكنك تدريسه ══ */}
          {step === 2 && (
            <div className="space-y-6">
              <fieldset>
                <legend className="text-sm font-black">الدورات التي تستطيع تدريسها الآن *</legend>
                <p className="mb-4 mt-1 text-[11px] leading-relaxed text-white/40">
                  من كتالوج وجيز نفسه لا بنصّ حرّ — لأن المراجع يقارن عناوين، والربط بالمقرر بعد الاعتماد يحتاج
                  المقرر نفسه لا وصفه.
                </p>
                <TeachableCoursePicker selected={teachable} onChange={setTeachable} />
              </fieldset>

              <div className="grid gap-5 border-t border-white/5 pt-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="jt-hours" className="mb-1.5 block text-xs font-bold text-white/60">ساعات أسبوعيا تستطيع تخصيصها</label>
                  <input id="jt-hours" type="number" min={1} max={80} dir="ltr" value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)} className={`${inputCls} text-left`} />
                </div>
                <div>
                  <label htmlFor="jt-start" className="mb-1.5 block text-xs font-bold text-white/60">يمكنك البدء من</label>
                  <input id="jt-start" type="date" dir="ltr" value={startFrom}
                    onChange={(e) => setStartFrom(e.target.value)} className={`${inputCls} text-left`} />
                </div>
              </div>

              <fieldset className="border-t border-white/5 pt-6">
                <legend className="mb-2.5 text-xs font-bold text-white/60">أيامك المتاحة</legend>
                <Chips options={DAYS} selected={days} onToggle={(v) => toggle(days, v, setDays)} />
              </fieldset>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
                <input type="checkbox" checked={demoConsent} onChange={(e) => setDemoConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal" />
                <span className="text-xs leading-6 text-white/60">
                  أوافق على تقديم درس تجريبي قصير (Demo) ومقابلة قبل الاعتماد. *
                </span>
              </label>
            </div>
          )}

          {/* ══ ٣) نماذجك وأدلتك ══ */}
          {step === 3 && (
            <div className="space-y-6">
              <fieldset>
                <legend className="text-sm font-black">مستنداتك</legend>
                <p className="mb-4 mt-1 text-[11px] leading-relaxed text-white/40">
                  السيرة الذاتية مطلوبة، وما عداها موصى به بشدة. لكل ملف نوعه وحدّه — ولو تعثّر رفعٌ بقي خطؤه
                  عنده بزر إعادة، لا رسالة عامة تجعلك تخمّن أيّها سقط.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DOC_KINDS.map((d) => {
                    const st = uploads[d.kind];
                    return (
                      <div key={d.kind} className={`rounded-xl border p-3.5 ${
                        st?.status === "done" ? "border-teal/45 bg-teal/[0.06]"
                          : st?.status === "error" ? "border-gold/50 bg-gold/[0.06]" : "border-white/12 bg-black/25"
                      }`}>
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                            {st?.status === "done" ? <CheckCircle2 className="h-4 w-4 text-teal-light-ink" />
                              : st?.status === "registering" || st?.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                              : <FileUp className="h-4 w-4 text-white/45" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-xs text-white/85">{d.label}{d.required ? " *" : ""}</b>
                            <span className="mt-0.5 block text-[10.5px] text-white/40">{d.hint}</span>
                            {st?.name && <span className="mt-1 block truncate text-[10.5px] text-white/55">{st.name}</span>}
                          </span>
                          <input type="file" accept={d.accept} className="sr-only"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(d.kind, f); }} />
                        </label>
                        {st?.status === "error" && (
                          <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-gold-ink">
                            <RefreshCcw className="h-3 w-3" /> {st.error ?? "تعذّر الرفع"} — اختر الملف مجددا
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="border-t border-white/5 pt-6">
                <legend className="text-sm font-black">أبرز ثلاث دورات قدّمتها عبر الإنترنت *</legend>
                <p className="mb-4 mt-1 text-[11px] leading-relaxed text-white/40">
                  اذكر اسم الدورة، والجهة أو المنصة التي قدّمتها من خلالها، ورابطا أو نموذجا مختصرا إن توفّر.
                </p>
                <div className="space-y-3">
                  {prevCourses.map((c, i) => (
                    <div key={i} className="grid gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-4">
                      <input placeholder={`عنوان الدورة ${i + 1}`} aria-label={`عنوان الدورة ${i + 1}`} value={c.title}
                        onChange={(e) => setPrevCourses(prevCourses.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                        className={`${inputCls} sm:col-span-2`} />
                      <input placeholder="الجهة أو المنصة" aria-label={`الجهة للدورة ${i + 1}`} value={c.org}
                        onChange={(e) => setPrevCourses(prevCourses.map((x, j) => (j === i ? { ...x, org: e.target.value } : x)))}
                        className={inputCls} />
                      <input placeholder="السنة" dir="ltr" inputMode="numeric" aria-label={`سنة الدورة ${i + 1}`} value={c.year}
                        onChange={(e) => setPrevCourses(prevCourses.map((x, j) => (j === i ? { ...x, year: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)))}
                        className={`${inputCls} text-left`} />
                      <input placeholder="رابط أو نموذج (اختياري)" dir="ltr" aria-label={`رابط الدورة ${i + 1}`} value={c.link}
                        onChange={(e) => setPrevCourses(prevCourses.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))}
                        className={`${inputCls} text-left sm:col-span-4`} />
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* ══ ٤) مراجعة وإرسال ══ */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-teal/30 bg-teal/[0.05] p-5">
                <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
                  <BadgeCheck className="h-4 w-4" /> طلبك محفوظ برقمه المرجعي
                </p>
                <p className="mt-2 text-[11.5px] leading-6 text-white/60">
                  رقمك: <b className="font-mono text-white/85" dir="ltr">{result?.reference ?? "—"}</b> — به وحده تتابع
                  حالة طلبك وتستأنف مسودتك. احفظه، ولا تشاركه.
                </p>
              </div>

              {/* ملخّص ما سيصل المراجع — بلا مفاجآت */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="flex items-center gap-2 text-xs font-black text-white/75">
                  <Sparkles className="h-3.5 w-3.5 text-teal-light-ink" /> ما سيقرؤه المراجع عنك
                </p>
                <ul className="mt-3 space-y-1.5 text-[11.5px] leading-6 text-white/60">
                  <li>{form.fullName.trim() || "—"} · {specialties.length} تخصصا · {DOMAIN_YEARS.find((y) => y.value === form.domainYears)?.label ?? "—"} في المجال</li>
                  <li>{teachable.length} دورة تستطيع تدريسها من الكتالوج</li>
                  <li>{prevCourses.filter((c) => c.title.trim()).length} دورة سابقة عبر الإنترنت</li>
                  <li>{Object.values(uploads).filter((u) => u.status === "done").length} مستندا مرفوعا</li>
                  <li>دافعك: {motivationLen} حرفا</li>
                </ul>
              </div>
            </div>
          )}

          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200" role="alert">{error}</p>}

          {/* التنقل — «التالي» معطّل حتى تكتمل الخطوة، لا حتى يكتمل النموذج كله */}
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-6">
            {step > 1 ? (
              <button type="button" onClick={back} className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/70 transition hover:border-white/35">
                <ArrowRight className="h-4 w-4" /> السابق
              </button>
            ) : <span />}

            {step < 4 ? (
              <button
                type="button" onClick={next} disabled={!stepValid[step as 1 | 2 | 3] || busy}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-7 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "نحفظ قسمك الأول…" : "التالي"}
                {!busy && <ArrowLeft className="h-4 w-4" />}
              </button>
            ) : (
              <button
                type="submit" disabled={!valid || busy}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-gold px-8 py-3 font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "جاري الإرسال…" : "أرسل طلب الانضمام"}
              </button>
            )}
          </div>
        </form>

        {/* متابعة طلب سابق — قسم ثانوي مطوي ليبقى التركيز على الطلب الجديد */}
        <details className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-black">
            <Search className="h-4 w-4 text-teal-light-ink" /> قدّمت سابقا؟ تابع حالة طلبك
          </summary>
          <div className="mt-5 grid gap-3 border-t border-white/5 pt-5 sm:grid-cols-2">
            <input dir="ltr" placeholder="WJ-TR-2026-00001" aria-label="الرقم المرجعي" value={lookup.reference}
              onChange={(e) => setLookup({ ...lookup, reference: e.target.value })} className={`${inputCls} text-left font-mono`} />
            <input dir="ltr" type="email" placeholder="بريدك المستخدم في الطلب" aria-label="البريد" value={lookup.email}
              onChange={(e) => setLookup({ ...lookup, email: e.target.value })} className={`${inputCls} text-left`} />
          </div>
          <button
            onClick={checkStatus} disabled={!lookup.reference.trim() || !lookup.email.trim()}
            className="mt-3 cursor-pointer rounded-full border border-teal/50 px-5 py-2 text-xs font-bold text-teal-light-ink transition hover:bg-teal/10 disabled:opacity-40"
          >
            اعرض الحالة
          </button>
          {lookupResult && <p className="mt-3 rounded-xl border border-teal/30 bg-teal/5 p-3 text-xs font-bold text-teal-light-ink">{lookupResult}</p>}
          {lookupError && <p className="mt-3 text-xs text-red-300" role="alert">{lookupError}</p>}

          {/* سحب الطلب — برمز المرشح الذي عُرض عليه عند التحقق */}
          <div className="mt-5 border-t border-white/5 pt-5">
            <p className="text-xs font-bold text-white/55">غيّرت رأيك؟ يمكنك سحب طلبك نهائيا من هنا.</p>
            <p className="mt-1 text-[11px] leading-6 text-white/40">
              رمز المرشح هو الذي عُرض عليك بعد إتمام طلبك. إن فقدته فراسلنا بالرقم
              المرجعي وبريدك.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                dir="ltr" placeholder="رمز المرشح" aria-label="رمز المرشح"
                value={withdrawForm.candidateToken}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, candidateToken: e.target.value })}
                className={`${inputCls} text-left font-mono`}
              />
              <input
                placeholder="سبب الانسحاب (اختياري)" aria-label="سبب الانسحاب"
                value={withdrawForm.reason}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                className={inputCls}
              />
            </div>
            <button
              onClick={withdrawApplication}
              disabled={!lookup.reference.trim() || !withdrawForm.candidateToken.trim()}
              className="mt-3 cursor-pointer rounded-full border border-red-400/40 px-5 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
            >
              اسحب طلبي نهائيا
            </button>
            {withdrawMsg && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/75">{withdrawMsg}</p>}
            <p className="mt-2 text-[11px] text-white/35">السحب نهائي لهذه النسخة من الطلب — يمكنك التقديم من جديد متى شئت.</p>
          </div>
        </details>
      </div>
    </SiteShell>
  );
}
