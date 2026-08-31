import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, ChevronDown, Compass, Copy,
  FileUp, Loader2, MailCheck, Mic2, RefreshCcw, Search, Send, Sparkles, Users,
} from "lucide-react";
import {
  areaCls, ChoiceGrid, ConsentRow, controlCls, Field, FieldRow, FieldSet, Question,
} from "@/components/FormKit";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, apiGet, ApiError } from "@/services/api";
import { TRAINING_SPECIALIZATIONS } from "@/data/trainer-contracts";
import { countAr } from "@/application/text/count-ar";
import TeachableCoursePicker from "@/components/TeachableCoursePicker";
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "@/application/trainer/application-draft";

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

/* جهات الاعتماد الرسمية في الوطن العربي — قائمةٌ تُختار لا حقل نصٍّ حرّ.

   «اسم الجهة» مكتوبا بالأيدي يصل المراجعَ بعشر صيغ للجهة الواحدة (ETEC،
   «هيئة تقويم»، «تقويم التعليم والتدريب»)، فلا يُفرز ولا يُحصى ولا يُتحقّق
   منه. والقائمة هنا وطنية حكومية — وهي ما يملكه المتقدّم العربي فعلا — و«أخرى»
   تبقى مفتوحة لمن اعتمادُه دوليٌّ أو خاصّ فيكتبه كما هو. */
const ACCREDITATION_BODIES: { country: string; bodies: string[] }[] = [
  { country: "السعودية", bodies: [
    "هيئة تقويم التعليم والتدريب (ETEC)",
    "المؤسسة العامة للتدريب التقني والمهني (TVTC)",
  ] },
  { country: "الأردن", bodies: [
    "هيئة تنمية وتطوير المهارات المهنية والتقنية (TVSDC)",
    "هيئة الاعتماد وضمان الجودة للمؤسسات التعليمية",
  ] },
  { country: "الإمارات", bodies: [
    "المركز الوطني للتأهيل المؤسسي والمهني (NQA)",
    "هيئة المعرفة والتنمية البشرية — دبي (KHDA)",
  ] },
  { country: "مصر", bodies: [
    "الهيئة القومية لضمان جودة التعليم والاعتماد",
    "الأكاديمية المهنية للمعلمين",
  ] },
  { country: "قطر", bodies: ["وزارة التربية والتعليم والتعليم العالي — إدارة التدريب"] },
  { country: "الكويت", bodies: ["الهيئة العامة للتعليم التطبيقي والتدريب"] },
  { country: "عُمان", bodies: ["الهيئة العُمانية للاعتماد الأكاديمي وضمان جودة التعليم"] },
  { country: "البحرين", bodies: ["هيئة جودة التعليم والتدريب (BQA)"] },
  { country: "العراق", bodies: ["وزارة التعليم العالي والبحث العلمي — جهاز الإشراف والتقويم"] },
  { country: "فلسطين", bodies: ["هيئة الاعتماد والجودة لمؤسسات التعليم العالي"] },
  { country: "لبنان", bodies: ["المديرية العامة للتعليم المهني والتقني"] },
  { country: "المغرب", bodies: ["مكتب التكوين المهني وإنعاش الشغل (OFPPT)"] },
  { country: "تونس", bodies: ["الوكالة التونسية للتكوين المهني"] },
  { country: "الجزائر", bodies: ["وزارة التكوين والتعليم المهنيين"] },
  { country: "ليبيا", bodies: ["المركز الوطني لضمان جودة واعتماد المؤسسات التعليمية والتدريبية"] },
  { country: "السودان", bodies: ["المجلس القومي للتدريب المهني والتلمذة"] },
  { country: "اليمن", bodies: ["وزارة التعليم الفني والتدريب المهني"] },
];
const ACCREDITATION_OTHER = "أخرى — أكتبها بنفسي";

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

/* «بقي 2 أشياء» عربيةٌ مكسورة يقرؤها المتقدّم في أول احتكاك به */
const MISSING_FORMS = { one: "بند", two: "بندان", few: "بنود", many: "بندا" } as const;
const CHAR_FORMS = { one: "حرف", two: "حرفان", few: "أحرف", many: "حرفا" } as const;

/* ثلاثة أقسام في نموذج واحد لا مرحلتان بينهما بريد.

   كان الطلب يُقسم مرحلتين: مرحلة أولى تُرسَل، ثم رابطٌ يصل بالبريد يفتح مرحلة
   ثانية. وكلفة ذلك أن كل متقدّم يعبر بابين لا بابا، وأن قناة البريد صارت
   شرطا لإكمال الطلب — من لم تصله الرسالة توقف طلبه عند نصفه.
   والقسمان الأخيران يحتاجان مرجع الطلب (لرفع الملفات)، فيُرسَل القسم
   الأول في الخلفية عند الانتقال إلى الثاني — والمتقدّم يرى نموذجا واحدا. */
/* حدّ الدافع: ٧٥ حرفا. كان ١٥٠ فصار سطرين يُكتبان لا فقرةً تُستدرّ — والعشرة
   الأولى («أحب التدريب») هي ما أُغلق، لا الإيجاز. والسقف ٥٠٠ يمنع سيرةً ذاتية
   ثانية في حقل نصّ. الرقمان هنا مطابقان لما يفرضه الخادم — والعدّاد يقرأ منهما. */
export const MOTIVATION_MIN = 75;
export const MOTIVATION_MAX = 500;

/* سقفٌ واحدٌ معلومٌ يُوفى: ٤MB. وكان المكتوب ١٠ و٢٠ و٣٠٠، وكلّها أرقام في
   النصّ لا في الواقع — الدالة السحابية لا تستقبل جسما أكبر من ٤٫٥MB، فالفيديو
   يُردّ قبل أن يبلغ الخادم. والفيديو صار رابطا في حقله أعلاه لا ملفّا. */
export const MAX_DOC_BYTES = 4 * 1024 * 1024;

const DOC_KINDS = [
  { kind: "cv", label: "السيرة الذاتية", hint: "PDF · حتى ٤MB", accept: "application/pdf", required: true },
  { kind: "evidence", label: "ملف أعمال أو نماذج تدريب سابقة", hint: "PDF أو صورة · حتى ٤MB", accept: "application/pdf,image/*", required: false },
  { kind: "certificate", label: "شهادات واعتمادات", hint: "PDF أو صورة · حتى ٤MB", accept: "application/pdf,image/*", required: false },
] as const;

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const PERIODS = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
] as const;

interface UploadState { status: "idle" | "registering" | "uploading" | "done" | "error"; name?: string; error?: string }

/* ثلاث خطوات لا أربع. حُذف قسم «ما يمكنك تدريسه»: كان يطلب من المتقدّم أن
   يفتح كتالوج وجيز ويختار منه دورات قبل أن يعرف أنّنا قبلناه أصلا — وإسنادُ
   المقرر قرارُ الإدارة بعد الاعتماد لا إقرارُ المتقدّم قبله. وما كان معه في
   الخطوة ممّا يخصّ المتقدّم نفسه — توفّره وموافقته على الدرس التجريبي — بقي
   وانتقل إلى خطوة أدلته. */
const STEPS = [
  { n: 1, title: "معلوماتك وخبرتك", hint: "من أنت وماذا تُتقن" },
  { n: 2, title: "نماذجك وأدلتك", hint: "سيرتك ودوراتك وتوفّرك" },
  { n: 3, title: "حسابك وتقدّمك", hint: "يحفظ طلبك ومسودتك وحالته" },
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
        className={`${controlCls} flex cursor-pointer items-center justify-between text-right ${selected.length ? "text-white" : "text-white/40"}`}
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
    youtubeUrl: "", instagramUrl: "", hasAccreditation: false,
    accreditationBody: "", accreditationOther: "", accreditationRef: "",
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

  /* القسمان 2–3 — كانا في صفحة مستقلة تُفتح برابط بريد، وصارا قسمين هنا */
  const [teachable, setTeachable] = useState<string[]>([]);
  const [teachableOther, setTeachableOther] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [demoConsent, setDemoConsent] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [phase2Done, setPhase2Done] = useState(false);
  /* حساب المتقدّم — اختياري لكنه الوسيلة الوحيدة لمتابعة الطلب بلا رمز يُنسخ */
  const [accountPassword, setAccountPassword] = useState("");
  const [accountState, setAccountState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [accountError, setAccountError] = useState("");

  /* متابعة حالة طلب سابق */
  const [lookup, setLookup] = useState({ reference: "", email: "" });
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [resent, setResent] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ candidateToken: "", reason: "" });
  const [withdrawMsg, setWithdrawMsg] = useState("");

  /* المسودّة: تُقرأ مرّة عند الفتح، وتُكتب مع كل تغيير */
  const [resumed, setResumed] = useState(false);
  const draftLoaded = useRef(false);

  /* ── المسودّة ──
     الاستعادة مرّةً واحدة (StrictMode يشغّل الأثر مرّتين، والمرجع يمنع الثانية)،
     ثم الحفظ عند كل تغيير. ولا يُحفظ ما بعد الإرسال: الطلب صار عند الخادم. */
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    const d = loadDraft();
    if (!d || !draftHasContent(d)) return;
    setForm((f) => ({ ...f, ...d.form }));
    setSpecialties(d.specialties ?? []);
    setLanguages(d.languages?.length ? d.languages : ["العربية"]);
    setTargetCountries(d.targetCountries ?? []);
    setTargetAudiences(d.targetAudiences ?? []);
    setTeachable(d.teachable ?? []);
    setTeachableOther(d.teachableOther ?? "");
    setDays(d.days ?? []);
    setPeriods(d.periods ?? []);
    setHoursPerWeek(d.hoursPerWeek ?? "");
    setStartFrom(d.startFrom ?? "");
    setDemoConsent(Boolean(d.demoConsent));
    /* المرجع والرمز يعودان معا أو لا يعودان: بلا الرمز لا يُكمَل الطلب */
    if (d.reference && d.candidateToken) {
      setResult({ reference: d.reference, status: "submitted", candidateToken: d.candidateToken });
      setCandidateToken(d.candidateToken);
      setVerified(true);
      setStep(Math.min(Math.max(d.step ?? 1, 1), 3));
    }
    setResumed(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded.current || phase2Done) return;
    saveDraft({
      step, form, specialties, languages, targetCountries, targetAudiences,
      teachable, teachableOther, days, periods, hoursPerWeek, startFrom, demoConsent,
      reference: result?.reference, candidateToken: candidateToken || undefined,
    });
  }, [step, form, specialties, languages, targetCountries, targetAudiences,
      teachable, teachableOther, days, periods, hoursPerWeek, startFrom, demoConsent,
      result, candidateToken, phase2Done]);

  const startOver = () => {
    clearDraft();
    window.location.reload();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const toggle = (list: string[], v: string, fn: (x: string[]) => void) =>
    fn(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  /* تحقق لكل قسم على حدة — الخطأ يظهر عند بابه لا كله عند الإرسال.

     والقسم الأول يحمل كل ما تطلبه المرحلة الأولى في الخادم، لأنه هو الذي
     يُرسَل عند الانتقال إلى الثاني: قسمٌ ناقص يعني طلبا مرفوضا في الخلفية
     والمتقدّم يظن أنه مضى. */
  const motivationLen = form.motivation.trim().length;

  /* الاعتماد يُركَّب من قائمةٍ ورقمٍ اختياريّ، ويصل الخادمَ سطرا واحدا كما كان */
  const accreditationName =
    form.accreditationBody === ACCREDITATION_OTHER ? form.accreditationOther.trim() : form.accreditationBody;
  const accreditationDetails = [accreditationName, form.accreditationRef.trim()].filter(Boolean).join(" — ").slice(0, 300);
  /* من رفع العلامة يلزمه أن يسمّي الجهة — وإلّا فهي علامةٌ بلا خبر */
  const accreditationReady = !form.hasAccreditation || accreditationName.length >= 3;

  /* ما ينقص الخطوة، بالاسم لا بزرٍّ مطفأ.

     كان «التالي» يُطفأ ولا يقول لماذا: أربعة عشر شرطا في تعبير واحد، والمتقدّم
     يمسح النموذج بعينه يبحث عن النجمة التي فاتته. فصارت الشروط قائمةَ نقصٍ
     تُقرأ — وكلُّ عنصرٍ فيها بصيغة ما يُفعل لا ما يَنقص. */
  const missing = useMemo(() => {
    const m: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
    if (form.fullName.trim().length < 3) m[1].push("اسمك الكامل");
    if (!/.+@.+\..+/.test(form.email)) m[1].push("بريد إلكتروني صحيح");
    if (!form.employmentStatus) m[1].push("حالتك المهنية");
    if (specialties.length === 0) m[1].push("تخصص تدريبي واحد على الأقل");
    if (!form.domainYears) m[1].push("سنوات خبرتك في المجال");
    if (!form.trainingYears) m[1].push("خبرتك في التدريب");
    if (!accreditationReady) m[1].push("جهة الاعتماد التي أشرت إليها");
    if (languages.length === 0) m[1].push("لغة تدريب واحدة على الأقل");
    if (!form.deliveryMode) m[1].push("نمط التدريب");
    if (motivationLen < MOTIVATION_MIN) m[1].push(`دافعك — بقي ${countAr(MOTIVATION_MIN - motivationLen, CHAR_FORMS)}`);
    if (!form.privacyConsent) m[1].push("الموافقة على سياسة الخصوصية");
    if (uploads.cv?.status !== "done") m[2].push("رفع سيرتك الذاتية");
    /* دورةٌ من الكتالوج أو سطرٌ يكتبه بنفسه — أحدهما يكفي، فالكتالوج ليس
       نهاية ما يُتقنه أحد. */
    if (teachable.length === 0 && teachableOther.trim().length < 10) {
      m[2].push("دورة واحدة تستطيع تقديمها — من القائمة أو بقلمك");
    }
    if (!demoConsent) m[2].push("الموافقة على الدرس التجريبي والمقابلة");
    return m;
  }, [form, specialties, languages, motivationLen, accreditationReady, uploads, teachable, teachableOther, demoConsent]);

  const stepValid = useMemo(() => ({
    1: missing[1].length === 0 && motivationLen <= MOTIVATION_MAX,
    2: missing[2].length === 0,
    3: true,
  }), [missing, motivationLen]);

  const valid = stepValid[1] && stepValid[2];

  /* الإرسال النهائي — القسمان 2–3. القسم الأول أُرسل عند المضيّ منه. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    /* حزامٌ ثانٍ مع المفتاحين: النموذج يلتقط Enter من أي حقل في أي خطوة،
       وإرسالٌ من خطوةٍ غير خطوته يقفز بالمتقدّم فوق شاشة حسابه. */
    if (step !== 3) return;
    if (!valid || busy || !result || !candidateToken) return;
    setBusy(true); setError("");
    try {
      await apiPost(`/api/v1/trainer-applications/${encodeURIComponent(result.reference)}/phase-2`, {
        candidateToken,
        teachableCourseIds: teachable,
        teachableOther: teachableOther.trim() || undefined,
        availability: {
          days: days.length ? days : undefined,
          hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
          startFrom: startFrom || undefined,
          periods: periods.length ? periods : undefined,
        },
        demoConsent,
      });
      setPhase2Done(true);
      clearDraft();
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
    /* الحدّ يُقال قبل الرفع لا بعده: من اختار ملفا كبيرا لا ينتظر رحلته
       كاملةً ليُردّ — ولا يرى «تعذّر الرفع» وهو لا يعرف السبب. */
    if (file.size > MAX_DOC_BYTES) {
      setUploads((u) => ({
        ...u,
        [kind]: { status: "error", name: file.name, error: `الملف ${(file.size / 1024 / 1024).toFixed(1)}MB — والحدّ ٤MB` },
      }));
      return;
    }
    setUploads((u) => ({ ...u, [kind]: { status: "registering", name: file.name } }));
    try {
      const reg = await apiPost<{ uploadUrl: string }>(
        `/api/v1/trainer-applications/${encodeURIComponent(result.reference)}/documents`,
        { candidateToken, kind, originalName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size },
      );
      setUploads((u) => ({ ...u, [kind]: { status: "uploading", name: file.name } }));
      const res = await fetch(reg.uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: file });
      if (!res.ok) {
        /* الخادم يقول ما وقع — فلا تُبتلع رسالته وتُستبدل بـ«حاول مجددا» */
        const body = (await res.json().catch(() => null)) as { error?: { message_ar?: string } } | null;
        throw new Error(body?.error?.message_ar ?? `تعذّر الرفع (${res.status})`);
      }
      setUploads((u) => ({ ...u, [kind]: { status: "done", name: file.name } }));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message
        : err instanceof Error && err.message ? err.message
        : "تعذّر الرفع — جرّب مجددا";
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
        accreditationDetails: form.hasAccreditation ? accreditationDetails || undefined : undefined,
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

  const createAccount = async () => {
    if (!result || !candidateToken || accountState === "busy") return;
    if (accountPassword.length < 8) { setAccountError("كلمة المرور 8 أحرف على الأقل"); return; }
    setAccountState("busy"); setAccountError("");
    try {
      await apiPost(`/api/v1/trainer-applications/${encodeURIComponent(result.reference)}/account`, {
        candidateToken, password: accountPassword,
      });
      setAccountState("done");
      setAccountPassword("");
    } catch (err) {
      setAccountState("error");
      setAccountError(err instanceof ApiError ? err.message : "تعذّر إنشاء الحساب — حاول مجددا");
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

  /* ── شاشة ما بعد الإرسال ── تظهر بعد اكتمال الأقسام الثلاثة لا بعد الأول:
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
                  className={`${controlCls} text-left font-mono`}
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
                وصلنا طلبك كاملا — بأقسامه الثلاثة ومستنداتك. سيقرؤه فريقنا ثم نراسلك بالخطوة التالية:
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
          نموذج واحد بثلاثة أقسام — يُحفظ تقدّمك كلما مضيت، ولا ينتظرك بريد بينها.
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
        <ol className="mt-10 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="أقسام الطلب">
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

        {/* الاستئناف يُقال ولا يُفترض: من يرى حقولا مملوءة ولا يعرف من ملأها
            يرتاب. والباب مفتوح للبدء من جديد بضغطة. */}
        {resumed && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal/[0.06] px-5 py-3.5">
            <p className="flex items-center gap-2 text-xs font-bold text-teal-light-ink">
              <RefreshCcw className="h-3.5 w-3.5" />
              أكملنا من حيث توقّفت — إجاباتك محفوظة في هذا المتصفّح.
            </p>
            <button
              type="button" onClick={startOver}
              className="cursor-pointer rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-white/40 hover:text-white/85"
            >
              ابدأ من جديد
            </button>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-9">
          {/* ══ ١) من أنت ══ */}
          {step === 1 && (
            <div className="space-y-4">
              <Question n={1} title="من أنت؟" hint="نتواصل معك على هذين — فراجعهما قبل المضيّ.">
                <FieldRow>
                  <Field label="الاسم الكامل" htmlFor="jt-name" required>
                    <input id="jt-name" name="name" autoComplete="name" required value={form.fullName} onChange={set("fullName")} className={controlCls} />
                  </Field>
                  <Field label="البريد الإلكتروني" htmlFor="jt-email" required>
                    <input id="jt-email" name="email" type="email" autoComplete="email" required dir="ltr" value={form.email} onChange={set("email")} className={`${controlCls} text-left`} />
                  </Field>
                  <Field label="رقم الجوال (واتساب)" htmlFor="jt-phone">
                    <div className="flex gap-2">
                      <select id="jt-cc" aria-label="رمز الدولة" value={form.phoneCountryCode} onChange={set("phoneCountryCode")} className={`${controlCls} w-24 shrink-0 px-2 [&>option]:bg-surface`} dir="ltr">
                        {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input id="jt-phone" name="tel" type="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={set("phone")} className={`${controlCls} min-w-0 flex-1 text-left`} />
                    </div>
                  </Field>
                  <Field label="دولة الإقامة" htmlFor="jt-country">
                    <select id="jt-country" value={form.country} onChange={set("country")} className={`${controlCls} [&>option]:bg-surface`}>
                      <option value="" disabled>اختر دولتك</option>
                      {ARAB_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="أخرى">أخرى</option>
                    </select>
                  </Field>
                </FieldRow>
              </Question>

              {/* «نبذة عنك» سؤالٌ مفتوح يُجاب بسطرٍ عامّ («مدرب شغوف بالتطوير»)
                  ما لم يُقل ماذا يُكتب فيه — فالتلميح يسمّي الثلاثة التي
                  يقرؤها المراجع. */}
              <Question n={2} title="عملك اليوم" hint="ما تعمله الآن يقول لنا أيّ الدورات أقرب إليك.">
                <FieldRow>
                  <Field label="حالتك المهنية الحالية" htmlFor="jt-employment" required>
                    <select id="jt-employment" value={form.employmentStatus} onChange={set("employmentStatus")} className={`${controlCls} [&>option]:bg-surface`}>
                      <option value="" disabled>اختر الأقرب لواقعك</option>
                      {EMPLOYMENT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Field>
                  <Field label="المسمى المهني الحالي" htmlFor="jt-role">
                    <input id="jt-role" name="role" placeholder="مثال: مدير تحليل بيانات" value={form.jobTitle} onChange={set("jobTitle")} className={controlCls} />
                  </Field>
                  <Field
                    label="نبذة مختصرة عنك"
                    htmlFor="jt-bio"
                    wide
                    hint="ثلاثة أسطر تكفي: أين تعمل اليوم وماذا تُتقن، وأبرز ما أنجزته في مجالك، ولمن دربت من قبل."
                  >
                    <textarea
                      id="jt-bio" rows={3} value={form.bio} onChange={set("bio")} className={areaCls}
                      placeholder="مثال: أعمل مديرا لتحليل البيانات في شركة اتصالات منذ ٦ سنوات، بنيت فيها وحدة التقارير من الصفر. دربت أكثر من ٢٠٠ موظف على Power BI داخل الشركة وفي ورش خارجية."
                    />
                  </Field>
                </FieldRow>
              </Question>

              <Question n={3} title="ما الذي تُتقن تدريبه؟" required hint="اختر ما تتقنه فعلا — الكثرة هنا لا تُحسب لك، والدقة تُحسب.">
                <ChoiceGrid options={TRAINING_SPECIALIZATIONS} selected={specialties} onToggle={(v) => toggle(specialties, v, setSpecialties)} cols={2} name="تخصصاتك التدريبية" />
              </Question>

              {/* الاعتماد مع الخبرة لا مع الروابط: مؤهّلٌ رسميّ يُقرأ مع سنوات
                  الخبرة ويُقارن بها، لا رابطٌ يُلصق. */}
              <Question n={4} title="خبرتك" hint="إتقان المجال شيء والقدرة على تدريبه شيء آخر — نقرؤهما منفصلين.">
                <FieldRow>
                  <Field label="سنوات الخبرة المهنية في المجال" htmlFor="jt-years" required>
                    <select id="jt-years" value={form.domainYears} onChange={set("domainYears")} className={`${controlCls} [&>option]:bg-surface`}>
                      <option value="" disabled>اختر نطاق الخبرة</option>
                      {DOMAIN_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
                    </select>
                  </Field>
                  <Field label="خبرة التدريب تحديدا" htmlFor="jt-training" required>
                    <select id="jt-training" value={form.trainingYears} onChange={set("trainingYears")} className={`${controlCls} [&>option]:bg-surface`}>
                      <option value="" disabled>اختر الأقرب لواقعك</option>
                      {TRAINING_YEARS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                </FieldRow>

                <div className="mt-5">
                  <ConsentRow
                    checked={form.hasAccreditation}
                    onChange={(v) => setForm(v
                      ? { ...form, hasAccreditation: true }
                      : { ...form, hasAccreditation: false, accreditationBody: "", accreditationOther: "", accreditationRef: "" })}
                  >
                    لدي اعتماد أو ترخيص رسمي من جهة أو هيئة تدريب معترف بها
                  </ConsentRow>
                  {form.hasAccreditation && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <FieldRow>
                        <Field label="جهة الاعتماد" htmlFor="jt-accred-body" required>
                          <select
                            id="jt-accred-body" value={form.accreditationBody} onChange={set("accreditationBody")}
                            className={`${controlCls} [&>option]:bg-surface [&>optgroup]:bg-surface`}
                          >
                            <option value="" disabled>اختر الجهة</option>
                            {ACCREDITATION_BODIES.map((g) => (
                              <optgroup key={g.country} label={g.country}>
                                {g.bodies.map((b) => <option key={b} value={b}>{b}</option>)}
                              </optgroup>
                            ))}
                            <option value={ACCREDITATION_OTHER}>{ACCREDITATION_OTHER}</option>
                          </select>
                        </Field>
                        <Field label="رقم الاعتماد أو تاريخه" htmlFor="jt-accred-ref">
                          <input
                            id="jt-accred-ref" placeholder="اختياري — مثال: TR-2023-4471"
                            value={form.accreditationRef} onChange={set("accreditationRef")} className={controlCls}
                          />
                        </Field>
                        {form.accreditationBody === ACCREDITATION_OTHER && (
                          <Field label="اكتب اسم الجهة كما هو في وثيقتك" htmlFor="jt-accred-other" required wide>
                            <input
                              id="jt-accred-other" placeholder="مثال: Chartered Institute of Personnel and Development (CIPD)"
                              value={form.accreditationOther} onChange={set("accreditationOther")} className={controlCls}
                            />
                          </Field>
                        )}
                      </FieldRow>
                      <p className="mt-4 text-[11px] leading-6 text-white/40">
                        نطلب وثيقة الاعتماد لاحقا في خطوة المستندات — والمذكور هنا لا يُنشر ولا يُعرض للمتعلمين قبل توثيقه.
                      </p>
                    </div>
                  )}
                </div>
              </Question>

              <Question n={5} title="لغة تدريبك ونمطه" required>
                <FieldRow>
                  <FieldSet legend="لغات التدريب" required>
                    <ChoiceGrid options={LANGUAGES} selected={languages} onToggle={(v) => toggle(languages, v, setLanguages)} cols={3} name="لغات التدريب" />
                  </FieldSet>
                  <Field label="نمط التدريب" htmlFor="jt-mode" required>
                    <select id="jt-mode" value={form.deliveryMode} onChange={set("deliveryMode")} className={`${controlCls} [&>option]:bg-surface`}>
                      <option value="" disabled>اختر</option>
                      <option value="remote">عن بعد</option>
                      <option value="in_person">حضوري</option>
                      <option value="both">كلاهما</option>
                    </select>
                  </Field>
                </FieldRow>
              </Question>

              <Question n={6} title="من تستهدف بتدريبك؟" hint="اختياريّ — ويساعدنا على ترشيحك لشعبةٍ تناسبك.">
                <FieldRow>
                  <Field label="الدول التي تستهدفها بتدريبك" htmlFor="jt-target-countries">
                    <MultiPick id="jt-target-countries" label="اختر من القائمة" options={[ALL_ARAB, ...ARAB_COUNTRIES]} selected={targetCountries} onChange={setTargetCountries} />
                  </Field>
                  <Field label="الفئات التي تستهدفها" htmlFor="jt-target-audiences">
                    <MultiPick id="jt-target-audiences" label="اختر من القائمة" options={TARGET_AUDIENCES} selected={targetAudiences} onChange={setTargetAudiences} />
                  </Field>
                </FieldRow>
              </Question>

              <Question
                n={7}
                title="أدلتك"
                hint="اختيارية كلها، لكنها ما يقرؤه المراجع قبل غيره. تُمنح الأولوية للطلبات التي تعرض خبرة قابلة للتحقق ونماذج حقيقية من العمل أو التدريب."
              >
                <FieldRow>
                  <Field label="لينكدإن أو ملف أعمال" htmlFor="jt-links">
                    <input id="jt-links" name="links" dir="ltr" placeholder="https://linkedin.com/in/..." value={form.linkedinUrl} onChange={set("linkedinUrl")} className={`${controlCls} text-left`} />
                  </Field>
                  <Field label="فيديو تدريبي أو قناة" htmlFor="jt-youtube">
                    <input id="jt-youtube" dir="ltr" placeholder="https://youtube.com/@..." value={form.youtubeUrl} onChange={set("youtubeUrl")} className={`${controlCls} text-left`} />
                  </Field>
                  <Field label="حساب إنستغرام المهني" htmlFor="jt-instagram">
                    <input id="jt-instagram" dir="ltr" placeholder="https://instagram.com/..." value={form.instagramUrl} onChange={set("instagramUrl")} className={`${controlCls} text-left`} />
                  </Field>
                </FieldRow>
              </Question>

              {/* عدّادٌ مباشر لا رسالةَ رفضٍ بعد الضغط: من كتب ٤٠ حرفا يجب أن يرى
                  كم بقي وهو يكتب، لا أن يُردّ عند الإرسال. */}
              <Question n={8} title="لماذا تريد الانضمام إلى وجيز تحديدا؟" required hint="نقرؤها فعلا — وهي أول ما يقرؤه المراجع.">
                <textarea
                  id="jt-why" rows={4} value={form.motivation} onChange={set("motivation")}
                  maxLength={MOTIVATION_MAX}
                  aria-label="لماذا تريد الانضمام إلى وجيز تحديدا؟"
                  aria-describedby="jt-why-count"
                  className={`${areaCls} ${motivationLen > 0 && motivationLen < MOTIVATION_MIN ? "border-gold/50" : ""}`}
                />
                <p id="jt-why-count" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className={motivationLen < MOTIVATION_MIN ? "text-gold-ink" : "text-white/40"}>
                    {motivationLen < MOTIVATION_MIN
                      ? `اكتب ${MOTIVATION_MIN} حرفا على الأقل. أضف مثالا يوضّح القيمة التي ستقدّمها للمتعلمين في وجيز.`
                      : "شكرا — هذا يكفي."}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/45" dir="ltr">
                    {motivationLen} / {MOTIVATION_MAX}
                  </span>
                </p>
              </Question>

              <ConsentRow checked={form.privacyConsent} onChange={(v) => setForm({ ...form, privacyConsent: v })}>
                أوافق على أن تُستخدم بياناتي لإدارة طلب الانضمام والتواصل بشأنه فقط، وفق{" "}
                <Link to="/p/privacy" className="text-teal-light-ink underline">سياسة الخصوصية</Link>. *
              </ConsentRow>
            </div>
          )}

          {/* ══ ٢) نماذجك وأدلتك وتوفّرك ══ */}
          {step === 2 && (
            <div className="space-y-4">
              <Question
                n={1}
                title="مستنداتك"
                hint="السيرة الذاتية مطلوبة، وما عداها موصى به بشدة. الحدّ ٤MB لكل ملف. والفيديو التدريبي لا يُرفع من هنا — ضع رابطه في «فيديو تدريبي أو قناة» في الخطوة الأولى."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {DOC_KINDS.map((d) => {
                    const st = uploads[d.kind];
                    return (
                      <div key={d.kind} className={`rounded-xl border p-4 ${
                        st?.status === "done" ? "border-teal/45 bg-teal/[0.06]"
                          : st?.status === "error" ? "border-gold/50 bg-gold/[0.06]" : "border-white/12 bg-black/25"
                      }`}>
                        <label className="flex cursor-pointer items-start gap-3">
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                            {st?.status === "done" ? <CheckCircle2 className="h-4 w-4 text-teal-light-ink" />
                              : st?.status === "registering" || st?.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                              : <FileUp className="h-4 w-4 text-white/45" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[12.5px] leading-6 text-white/85">{d.label}{d.required ? " *" : ""}</b>
                            <span className="mt-0.5 block text-[11px] text-white/40">{d.hint}</span>
                            {st?.name && <span className="mt-1 block truncate text-[11px] text-white/55">{st.name}</span>}
                          </span>
                          <input type="file" accept={d.accept} className="sr-only"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(d.kind, f); }} />
                        </label>
                        {st?.status === "error" && (
                          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gold-ink">
                            <RefreshCcw className="h-3 w-3" /> {st.error ?? "تعذّر الرفع"} — اختر الملف مجددا
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Question>

              {/* ما يستطيع تقديمه — لا ما قدّمه.

                  كان السؤال «أبرز ثلاث دورات قدّمتها»: ماضٍ يُروى نصّا حرّا، لا
                  يُقارَن ولا يُربط بمقرر ولا يقول ماذا نسند إليه غدا. فصار
                  السؤال عن القادم: مجالٌ يقصّ الكتالوج، ودوراتُه تُختار
                  بمعرّفاتها، ونصٌّ حرّ لما ليس عندنا بعد. */}
              <Question
                n={2}
                title="ما الدورات التي تستطيع تقديمها؟"
                required
                hint="اختر مجالك ثم دوراته التي تُتقنها — ولك أكثر من مجال وأكثر من دورة. واختيارك هنا يسهّل تعيينك على شعبة بعد الاعتماد، ولا يُلزمك بها."
              >
                <TeachableCoursePicker selected={teachable} onChange={setTeachable} />

                <div className="mt-5 border-t border-white/10 pt-5">
                  <Field
                    label="دورات تستطيع تقديمها ولم نذكرها"
                    htmlFor="jt-other-courses"
                    hint="كتالوجنا ليس نهاية المعرفة. اكتب ما تُتقنه ولا تجده أعلاه — عنوانا لكل سطر، ولمن هو."
                  >
                    <textarea
                      id="jt-other-courses" rows={3} maxLength={1000}
                      value={teachableOther} onChange={(e) => setTeachableOther(e.target.value)}
                      placeholder="مثال: تحليل تكلفة الاستحواذ للمتاجر الإلكترونية — لمدراء التسويق"
                      className={areaCls}
                    />
                  </Field>
                </div>
              </Question>

              {/* اليومُ وحده لا يقول متى هو متفرّغ فيه: من يعمل نهارا لا يدرّب
                  إلا مساء، والشعبةُ تُجدوَل بالساعة لا باليوم. */}
              <Question n={3} title="متى تستطيع أن تُدرّب؟" hint="الشعبة تُجدوَل بالساعة لا باليوم — فقل متى من اليوم، لا اليوم وحده.">
                <FieldRow>
                  <Field label="ساعات أسبوعيا تستطيع تخصيصها" htmlFor="jt-hours">
                    <input id="jt-hours" type="number" min={1} max={80} dir="ltr" value={hoursPerWeek}
                      onChange={(e) => setHoursPerWeek(e.target.value)} className={`${controlCls} text-left`} />
                  </Field>
                  <Field label="يمكنك البدء من" htmlFor="jt-start">
                    <input id="jt-start" type="date" dir="ltr" value={startFrom}
                      onChange={(e) => setStartFrom(e.target.value)} className={`${controlCls} text-left`} />
                  </Field>
                  <FieldSet legend="أيامك المتاحة" wide>
                    <ChoiceGrid options={DAYS} selected={days} onToggle={(v) => toggle(days, v, setDays)} cols={3} name="أيامك المتاحة" />
                  </FieldSet>
                  <FieldSet legend="وفي أي وقت منها؟" wide>
                    <ChoiceGrid
                      options={PERIODS.map((p) => p.label)}
                      selected={periods.map((v) => PERIODS.find((p) => p.value === v)?.label ?? v)}
                      onToggle={(label) => {
                        const v = PERIODS.find((p) => p.label === label)?.value
                        if (v) toggle(periods, v, setPeriods)
                      }}
                      cols={2}
                      name="وقت التدريب"
                    />
                  </FieldSet>
                </FieldRow>
              </Question>

              <ConsentRow checked={demoConsent} onChange={setDemoConsent}>
                أوافق على تقديم درس تجريبي قصير (Demo) ومقابلة قبل الاعتماد. *
              </ConsentRow>
            </div>
          )}

          {/* ══ ٣) مراجعة وإرسال ══ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* الحساب اختياري ومفيد: بدونه يتابع طلبه برقم ورمز ينسخهما من
                  الشاشة — ومن فقدهما فقد طلبه. وهو حساب «متقدّم مدرب» لا حساب
                  متعلم: لا يفتح بوابة الطالب ولا بوابة المدرب، ولا يرى إلا
                  طلبه هو. ويصير مدربا بالدعوة بعد الاعتماد لا بالتسجيل. */}
              <div className={`rounded-2xl border p-5 ${accountState === "done" ? "border-teal/45 bg-teal/[0.07]" : "border-teal/30 bg-teal/[0.05]"}`}>
                <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
                  <BadgeCheck className="h-4 w-4" />
                  {accountState === "done" ? "حسابك جاهز" : "أنشئ حساب متقدّم — يحفظ طلبك عنك"}
                </p>
                {accountState === "done" ? (
                  <p className="mt-2 text-[11.5px] leading-6 text-white/65">
                    سجّل الدخول ببريدك <b dir="ltr" className="text-white/85">{form.email.trim()}</b> لترى حالة طلبك
                    ومستنداتك متى شئت. حسابك حساب تقديم فقط — تصير مدربا بدعوة منّا بعد الاعتماد.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-[11.5px] leading-6 text-white/60">
                      بدونه تتابع طلبك برقمه المرجعي ورمز المرشح — ومن فقدهما فقد طريقه إلى طلبه.
                      الحساب ببريد طلبك <b dir="ltr" className="text-white/80">{form.email.trim() || "—"}</b>، ولا يفتح
                      بوابة متعلم ولا بوابة مدرب.
                    </p>
                    {/* على الهاتف يُضغط الحقلُ والزرُّ في سطرٍ واحد فلا يتّسع أيّهما — فيُكدَّسان */}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="password" autoComplete="new-password" placeholder="كلمة مرور — 8 أحرف على الأقل"
                        aria-label="كلمة مرور حساب المتقدّم"
                        value={accountPassword}
                        onChange={(e) => { setAccountPassword(e.target.value); setAccountError(""); }}
                        className={`${controlCls} min-w-0 flex-1`}
                      />
                      <button
                        type="button" onClick={createAccount}
                        disabled={accountPassword.length < 8 || accountState === "busy" || !candidateToken}
                        className="flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-teal/50 px-5 text-xs font-black text-teal-light-ink transition hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {accountState === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        أنشئ الحساب
                      </button>
                    </div>
                    {accountError && <p className="mt-2 text-[11px] text-gold-ink">{accountError}</p>}
                  </>
                )}
                <p className="mt-3 border-t border-white/10 pt-3 text-[11.5px] leading-6 text-white/50">
                  ورقمك المرجعي: <b className="font-mono text-white/80" dir="ltr">{result?.reference ?? "—"}</b> — احفظه ولا تشاركه.
                </p>
              </div>

              {/* ملخّص ما سيصل المراجع — بلا مفاجآت */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="flex items-center gap-2 text-xs font-black text-white/75">
                  <Sparkles className="h-3.5 w-3.5 text-teal-light-ink" /> ما سيقرؤه المراجع عنك
                </p>
                <ul className="mt-3 space-y-1.5 text-[11.5px] leading-6 text-white/60">
                  <li>{form.fullName.trim() || "—"} · {specialties.length} تخصصا · {DOMAIN_YEARS.find((y) => y.value === form.domainYears)?.label ?? "—"} في المجال</li>
                  <li>{teachable.length} دورة من الكتالوج تستطيع تدريسها{teachableOther.trim() ? " · وأخرى بقلمك" : ""}</li>
                  <li>{Object.values(uploads).filter((u) => u.status === "done").length} مستندا مرفوعا</li>
                  <li>دافعك: {motivationLen} حرفا</li>
                </ul>
              </div>
            </div>
          )}

          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200" role="alert">{error}</p>}

          {/* ما ينقص، بالاسم. زرٌّ مطفأ بلا سبب يجعل المتقدّم يفتّش النموذج
              بعينه؛ وهذه قائمةٌ تُقرأ في سطرين وتختفي حين تكتمل الخطوة.
              aria-live كي يسمعها قارئ الشاشة وهي تتناقص. */}
          {step < 3 && missing[step as 1 | 2].length > 0 && (
            <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-4" aria-live="polite">
              <p className="text-xs font-black text-gold-ink">
                بقي {countAr(missing[step as 1 | 2].length, MISSING_FORMS)} قبل «التالي»
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] leading-6 text-white/65">
                {missing[step as 1 | 2].map((m) => (
                  <li key={m} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-gold-ink" /> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* التنقل — «التالي» معطّل حتى تكتمل الخطوة، لا حتى يكتمل النموذج كله */}
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-6">
            {step > 1 ? (
              <button type="button" onClick={back} className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/70 transition hover:border-white/35">
                <ArrowRight className="h-4 w-4" /> السابق
              </button>
            ) : <span />}

            {/* مفتاحان مختلفان لا زرٌّ واحد يتبدّل نوعه.

                بلا المفتاح يرى React زرّا واحدا في الموضع نفسه فيبدّل خاصيّته
                من button إلى submit على العنصر ذاته — ونقرةُ «التالي» التي
                نقلتنا إلى الخطوة الأخيرة يقع فعلُها الافتراضيّ بعد ذلك على
                الزرّ وقد صار submit، فيُرسَل الطلبُ فورا وتُقفز الخطوة الثالثة
                كلها. عطبٌ صامت: المتقدّم لا يرى شاشة حسابه أصلا. */}
            {step < 3 ? (
              <button
                key="next"
                type="button" onClick={next} disabled={!stepValid[step as 1 | 2 | 3] || busy}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-7 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "نحفظ قسمك الأول…" : "التالي"}
                {!busy && <ArrowLeft className="h-4 w-4" />}
              </button>
            ) : (
              <button
                key="send"
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
              onChange={(e) => setLookup({ ...lookup, reference: e.target.value })} className={`${controlCls} text-left font-mono`} />
            <input dir="ltr" type="email" placeholder="بريدك المستخدم في الطلب" aria-label="البريد" value={lookup.email}
              onChange={(e) => setLookup({ ...lookup, email: e.target.value })} className={`${controlCls} text-left`} />
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
                className={`${controlCls} text-left font-mono`}
              />
              <input
                placeholder="سبب الانسحاب (اختياري)" aria-label="سبب الانسحاب"
                value={withdrawForm.reason}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                className={controlCls}
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
