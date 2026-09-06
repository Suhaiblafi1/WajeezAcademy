import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft, ArrowRight, AtSign, BadgeCheck, Check, CheckCircle2, ChevronDown, Compass, Eye, EyeOff,
  FileUp, KeyRound, Loader2, Mail, MailCheck, MessageCircle, Mic2, Phone, RefreshCcw, Search, Send, Sparkles, Users,
} from "lucide-react";
import {
  areaCls, ChoiceGrid, ConsentRow, controlCls, Field, FieldRow, FieldSet, invalidProps, OptionGrid, Question,
} from "@/components/FormKit";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, apiGet, ApiError } from "@/services/api";
import { TRAINING_SPECIALIZATIONS } from "@/data/trainer-contracts";
import { countAr } from "@/application/text/count-ar";
import TeachableCoursePicker from "@/components/TeachableCoursePicker";
import BookInterview from "@/components/BookInterview";
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "@/application/trainer/application-draft";
import {
  APPLICANT_STATUS, CONTACT_CHANNELS, TRAINING_SEASONS, type ContactChannel,
} from "@/application/trainer/application-options";

/* صفحة انضمام المدربين.

   كانت نموذجا واحدا طويلا: اثنتا عشرة خانة وأربع مجموعات وقوائم متعددة الاختيار
   على شاشة واحدة، يقرؤها المتقدم كلها قبل أن يعرف إن كان الطلب يعنيه أصلا.
   صارت ثلاث خطوات قصيرة لكل منها سؤال واحد واضح — من أنت، ماذا تُتقن، كيف تدرّب —
   بمؤشر تقدّم وتحقق لكل خطوة على حدة، فلا يُرمى الخطأ كله في وجهه عند الإرسال.
   لا حقل حُذف ولا أُضيف: نفس البيانات، مرتّبة بترتيب يُسأل به الإنسان.

   وصار للمتقدّم حسابٌ من أوّل قسم: يختار كلمةَ مروره مع بريده، فيدخل بهما
   متى شاء ويرى حالةَ طلبه — لا رمزٌ يُنسخ من الشاشة فيُفقد. والقسمُ الأخير
   يسأله كيف نصل إليه للاجتماع التعريفيّ، ثمّ يصله بريدُ تأكيدٍ بتفاصيل طلبه
   ورقمه، وفي البريد رابطٌ يوثّق عنوانه. */

/* القوائمُ الثابتة (جهاتُ الاعتماد والدولُ ورموزُ الهاتف وصيغُ العدّ) في
   ملفٍّ بجانب هذا — بياناتٌ لا واجهة، ومئةٌ وعشرون سطرا كانت تقف بين
   قارئِ الصفحة وبين منطقِها. */
import {
  ACCREDITATION_BODIES,
  ACCREDITATION_OTHER,
  ALL_ARAB,
  ARAB_COUNTRIES,
  CHAR_FORMS,
  COUNTRY_CODES,
  COUNTRY_TIMEZONE,
  DAYS,
  DOC_KINDS,
  DOMAIN_YEARS,
  EMPLOYMENT_STATUS,
  LANGUAGES,
  MAX_DOC_BYTES,
  MISSING_FORMS,
  MOTIVATION_MAX,
  MOTIVATION_MIN,
  PERIODS,
  STEPS,
  TARGET_AUDIENCES,
  TRAINING_YEARS,
  type UploadState,
} from "./join-trainer/options";
import { HONEYPOT_FIELD, useHoneypot } from "@/components/HoneypotField";

import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
/* الحدّان يُعاد تصديرُهما من هنا: الاختبارُ يقرؤهما من هذا الملفّ حرسا
   لتطابقهما مع الخادم، وموضعُ التعريف انتقل لا الضمان. */
export { MAX_DOC_BYTES, MOTIVATION_MAX, MOTIVATION_MIN };

/** قائمة منسدلة متعددة الاختيار — مربع صح بجانب كل خيار، والمختار يظهر وسمًا صغيرًا قابلا للإزالة */
function MultiPick({ id, label, options, selected, onChange }: {
  id: string; label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleValue = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  /* القائمةُ تُغلق بالنقر خارجها وبـEscape — كانت تبقى مفتوحةً حتّى يُنقر
     زرُّها ثانية، فيُفتح المتقدّم قائمتين معا ولا يعرف كيف يطويهما. */
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button" id={id} aria-expanded={open} aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
        className={`${controlCls} flex cursor-pointer items-center justify-between text-right ${selected.length ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-teal-light-ink transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <Inset role="listbox" aria-labelledby={id} aria-multiselectable="true" className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto bg-surface p-1.5 shadow-xl shadow-black/40">
          {options.map((o) => {
            const checked = selected.includes(o);
            return (
              <label key={o} role="option" aria-selected={checked}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-white/5 ${checked ? "text-teal-light-ink" : "text-foreground"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleValue(o)} className="h-3.5 w-3.5 shrink-0 accent-teal" />
                {o}
              </label>
            );
          })}
        </Inset>
      )}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-fine font-bold text-teal-light-ink">
              {s}
              <button type="button" onClick={() => toggleValue(s)} aria-label={`أزل ${s}`} className="cursor-pointer text-muted-foreground transition hover:text-foreground">×</button>
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
  /** رمزُ المتابعة — به تُرفع الوثائق ويُكمَل الطلب في هذه الجلسة */
  candidateToken: string;
  resumed?: boolean;
}

interface CompleteResponse {
  status: string;
  emailDelivery: "sent" | "not_configured" | "failed" | null;
}

/** أرقامٌ لاتينية فقط: العربيّة الهنديّة تُحوَّل، وما سواها يسقط */
function normalizeDigits(v: string): string {
  return v
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\d]/g, "")
    .slice(0, 15);
}

/* رمزُ الدولة: `controlCls` يحمل `w-full`، وكان يُضاف إليه `w-24` فيفوز
   `w-full` (يأتي بعده في ورقة الأنماط) ويأخذ الرمزُ الصفَّ كلَّه — فيبقى
   لحقل الرقم ٣٤ بكسلا لا تُرى ولا تُنقر. وهذا ما وُصف بـ«إدخال الرقم لا
   يعمل، فقط رمز الدولة». الحلُّ صنفٌ بلا `w-full` أصلا. */
const codeSelectCls = `${controlCls.replace("w-full", "")} w-28 shrink-0 px-2 [&>option]:bg-surface`;

/** صفحة انضمام المدربين — على API حقيقي: قسمٌ أوّل يُنشئ الطلب والحساب، وقسمٌ أخير يُكمله */
export default function JoinTrainer() {
  const hp = useHoneypot();
  const [params] = useSearchParams();
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
  const [completion, setCompletion] = useState<CompleteResponse | null>(null);

  /* كلمةُ حسابه — لا تُحفظ في المسودّة أبدا */
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  /* رمزُ المتابعة — من ردّ القسم الأوّل، أو من رابط الاستئناف */
  const [candidateToken, setCandidateToken] = useState("");

  /* القسمان 2–3 — كانا في صفحة مستقلة تُفتح برابط بريد، وصارا قسمين هنا */
  const [teachable, setTeachable] = useState<string[]>([]);
  const [teachableOther, setTeachableOther] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [demoConsent, setDemoConsent] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [phase2Done, setPhase2Done] = useState(false);
  /* كيف نتواصل معه للاجتماع التعريفيّ */
  const [contactChannel, setContactChannel] = useState<ContactChannel | "">("");
  const [contactAltEmail, setContactAltEmail] = useState("");

  /* متابعة حالة طلب سابق — البريدُ يكفي، والرقمُ اختياريّ */
  const [lookup, setLookup] = useState({ reference: "", email: "" });
  const [lookupResult, setLookupResult] = useState<{ reference: string; label: string; explain: string } | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

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
    setSeasons(d.seasons ?? []);
    setHoursPerWeek(d.hoursPerWeek ?? "");
    setStartFrom(d.startFrom ?? "");
    setDemoConsent(Boolean(d.demoConsent));
    setContactChannel((d.contactChannel as ContactChannel | undefined) ?? "");
    setContactAltEmail(d.contactAltEmail ?? "");
    /* المرجع والرمز يعودان معا أو لا يعودان: بلا الرمز لا يُكمَل الطلب */
    if (d.reference && d.candidateToken) {
      setResult({ reference: d.reference, status: "draft", candidateToken: d.candidateToken });
      setCandidateToken(d.candidateToken);
      setStep(Math.min(Math.max(d.step ?? 1, 2), 3));
    }
    setResumed(true);
  }, []);

  /* استئنافٌ من صفحة الحالة: `?resume=REF&token=…` — الخادمُ عنده القسمُ
     الأوّل كاملا، فنبدأ من الثاني بمفتاحٍ جديد. */
  useEffect(() => {
    const ref = params.get("resume");
    const token = params.get("token");
    if (!ref || !token || token.length < 10) return;
    setResult({ reference: ref, status: "draft", candidateToken: token, resumed: true });
    setCandidateToken(token);
    setStep(2);
    setResumed(true);
    window.history.replaceState(null, "", "/join-trainer");
  }, [params]);

  useEffect(() => {
    if (!draftLoaded.current || phase2Done) return;
    saveDraft({
      step, form, specialties, languages, targetCountries, targetAudiences,
      teachable, teachableOther, days, periods, seasons, hoursPerWeek, startFrom, demoConsent,
      contactChannel: contactChannel || undefined, contactAltEmail: contactAltEmail || undefined,
      reference: result?.reference, candidateToken: candidateToken || undefined,
    });
  }, [step, form, specialties, languages, targetCountries, targetAudiences,
      teachable, teachableOther, days, periods, seasons, hoursPerWeek, startFrom, demoConsent,
      contactChannel, contactAltEmail, result, candidateToken, phase2Done]);

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

  /* ── الخطأُ عند الحقل، لا في ذيل النموذج وحدَه ──

     قائمةُ النقص أسفلَ النموذج تقول ما بقي، ولا تقول أين هو: من أخطأ في
     بريده يقرأ «بريد إلكتروني صحيح» ثمّ يصعد يمسح الحقولَ بعينه يبحث عن
     المقصود. فهذه رسالةٌ ثانية عند الحقل نفسِه، موصولةٌ به لقارئ الشاشة
     بـ`aria-invalid` و`aria-describedby`.

     وشرطُها أن تأتي **بعد أن يُلمس الحقل** — لأنّ رسالةَ خطأٍ على حقلٍ فارغٍ
     لم يُفتح بعد لومٌ لا إرشاد. فالحقلُ يُوسم «ملموسا» عند خروج المؤشّر منه
     (`onBlur`)، وعندها فقط تُقرأ رسالتُه. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const fieldErrors = useMemo<Record<string, string | null>>(() => ({
    name: form.fullName.trim().length >= 3 ? null : 'اكتب اسمك الكامل — ثلاثةُ أحرفٍ على الأقلّ',
    email: /.+@.+\..+/.test(form.email) ? null : 'بريدٌ بصيغةٍ صحيحة، مثل name@example.com',
    /* بعد إرسال القسم الأوّل الحسابُ قائم، فلا كلمةَ تُطلب ولا خطأَ يُقال */
    password: result || password.length >= 8
      ? null
      : password.length === 0
        ? 'كلمةُ مرورٍ لحسابك — ٨ أحرفٍ على الأقلّ'
        : `بقي ${countAr(8 - password.length, CHAR_FORMS)}`,
    password2: result || !passwordConfirm || passwordConfirm === password ? null : 'الكلمتان غير متطابقتين',
    accredBody: !form.hasAccreditation || form.accreditationBody ? null : 'اختر جهةَ الاعتماد التي أشرت إليها',
    accredOther: !form.hasAccreditation || form.accreditationBody !== ACCREDITATION_OTHER || accreditationName.length >= 3
      ? null
      : 'اكتب اسمَ الجهة كما هو في وثيقتك',
    altEmail: contactChannel !== 'other_email' || /.+@.+\..+/.test(contactAltEmail)
      ? null
      : 'بريدٌ آخرُ بصيغةٍ صحيحة، مثل name@example.com',
  }), [form.fullName, form.email, form.hasAccreditation, form.accreditationBody, accreditationName,
      password, passwordConfirm, result, contactChannel, contactAltEmail]);

  /** رسالةُ الحقل — تُكتم حتى يُلمس */
  const errOf = (k: string) => (touched[k] ? fieldErrors[k] ?? null : null);

  /* ما ينقص الخطوة، بالاسم لا بزرٍّ مطفأ.

     كان «التالي» يُطفأ ولا يقول لماذا: أربعة عشر شرطا في تعبير واحد، والمتقدّم
     يمسح النموذج بعينه يبحث عن النجمة التي فاتته. فصارت الشروط قائمةَ نقصٍ
     تُقرأ — وكلُّ عنصرٍ فيها بصيغة ما يُفعل لا ما يَنقص. */
  const missing = useMemo(() => {
    const m: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
    if (form.fullName.trim().length < 3) m[1].push("اسمك الكامل");
    if (!/.+@.+\..+/.test(form.email)) m[1].push("بريد إلكتروني صحيح");
    /* كلمةُ الحساب تُفحص قبل أن يُرسَل القسمُ الأوّل — فالحسابُ يُنشأ معه.
       وبعد الإرسال لا تُطلب ثانية: الحسابُ قائم. */
    if (!result) {
      if (password.length < 8) m[1].push(`كلمة مرور حسابك — ${password.length === 0 ? "٨ أحرف على الأقل" : `بقي ${countAr(8 - password.length, CHAR_FORMS)}`}`);
      else if (passwordConfirm !== password) m[1].push("تأكيد كلمة المرور مطابقا");
    }
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
    /* كيف نصل إليه — ووسيلةٌ تحتاج رقما بلا رقم لا تُقبل */
    const channel = CONTACT_CHANNELS.find((c) => c.value === contactChannel);
    if (!channel) m[3].push("وسيلة التواصل التي تفضّلها");
    else {
      if (channel.needsPhone && normalizeDigits(form.phone).length < 6) m[3].push("رقم جوالك في القسم الأول — أو اختر البريد");
      if (channel.needsAltEmail && !/.+@.+\..+/.test(contactAltEmail)) m[3].push("البريد الآخر بصيغة صحيحة");
    }
    return m;
  }, [form, specialties, languages, motivationLen, accreditationReady, uploads, teachable, teachableOther, demoConsent,
      password, passwordConfirm, result, contactChannel, contactAltEmail]);

  const stepValid = useMemo(() => ({
    1: missing[1].length === 0 && motivationLen <= MOTIVATION_MAX,
    2: missing[2].length === 0,
    3: missing[3].length === 0,
  }), [missing, motivationLen]);

  const valid = stepValid[1] && stepValid[2] && stepValid[3];

  /* الإرسال النهائي — القسمان 2–3. القسم الأول أُرسل عند المضيّ منه. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    /* حزامٌ ثانٍ مع المفتاحين: النموذج يلتقط Enter من أي حقل في أي خطوة،
       وإرسالٌ من خطوةٍ غير خطوته يقفز بالمتقدّم فوق شاشة حسابه. */
    if (step !== 3) return;
    if (!valid || busy || !result || !candidateToken || !contactChannel) return;
    setBusy(true); setError("");
    try {
      const res = await apiPost<CompleteResponse>(`/api/v1/trainer-applications/${encodeURIComponent(result.reference)}/phase-2`, {
        candidateToken,
        teachableCourseIds: teachable,
        teachableOther: teachableOther.trim() || undefined,
        availability: {
          days: days.length ? days : undefined,
          hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
          startFrom: startFrom || undefined,
          periods: periods.length ? periods : undefined,
          seasons: seasons.length ? seasons : undefined,
        },
        demoConsent,
        contact: {
          channel: contactChannel,
          altEmail: contactChannel === "other_email" ? contactAltEmail.trim().toLowerCase() : undefined,
        },
      });
      setCompletion(res);
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
        ...(hp.value ? { [HONEYPOT_FIELD]: hp.value } : {}),
        fullName: form.fullName, email: form.email.trim().toLowerCase(), password,
        phoneCountryCode: form.phone ? form.phoneCountryCode || undefined : undefined,
        phone: normalizeDigits(form.phone) || undefined,
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
      setCandidateToken(res.candidateToken);
      /* الكلمةُ أدّت عملها — لا تبقى في الذاكرة أطولَ من حاجتها */
      setPassword(""); setPasswordConfirm("");
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر بدء الطلب — تحقق من اتصالك وحاول مجددا");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    setLookupError(""); setLookupResult(null); setLookupBusy(true);
    try {
      const q = new URLSearchParams({ email: lookup.email.trim().toLowerCase() });
      if (lookup.reference.trim()) q.set("reference", lookup.reference.trim());
      const res = await apiGet<{ reference: string; status: string }>(`/api/v1/trainer-applications/status?${q.toString()}`);
      const st = APPLICANT_STATUS[res.status];
      setLookupResult({ reference: res.reference, label: st?.label ?? res.status, explain: st?.explain ?? "" });
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : "تعذر جلب الحالة");
    } finally {
      setLookupBusy(false);
    }
  };

  /* ── شاشة ما بعد الإرسال ── تظهر بعد اكتمال الأقسام الثلاثة لا بعد الأول:
     بدء الطلب في الخلفية تفصيلٌ تقني، وإظهار شاشة النجاح عنده يوهم المتقدّم
     أنه انتهى وقد بقي نصف طلبه. */
  if (result && phase2Done) {
    const mailSent = completion?.emailDelivery === "sent";
    const channel = CONTACT_CHANNELS.find((c) => c.value === contactChannel);
    const channelValue = contactChannel === "other_email" ? contactAltEmail.trim()
      : contactChannel === "email" ? form.email.trim()
      : `${form.phoneCountryCode}${normalizeDigits(form.phone)}`;
    return (
      <SiteShell>
        <SeoHead title="طلبك وصل" description="طلب انضمام مدرب في أكاديمية وجيز" path="/join-trainer" />
        <div className="mx-auto max-w-lg py-14 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal/15">
            <CheckCircle2 className="h-8 w-8 text-teal-light-ink" />
          </span>
          <h1 className="mt-6 text-2xl font-black">وصل طلبك كاملا — شكرا لك</h1>
          <Card as="p" tone="warn" className="mt-4">
            <span className="text-xs text-muted-foreground">رقم طلبك</span>
            <span className="mt-1 block font-mono text-xl font-black tracking-wide text-gold-ink" dir="ltr">{result.reference}</span>
          </Card>

          <div className="mt-6 space-y-4 text-right">
            {/* الحجزُ أوّلا لا الانتظار: كانت هذه البطاقةُ تَعِد بأن «نتواصل معك
                لتحديد موعد»، فيقف المتقدّمُ بلا شيءٍ بيده. والموعدُ صار بيده. */}
            <BookInterview name={form.fullName.trim()} email={form.email.trim()} reference={result.reference} />

            <Card>
              <p className="flex items-center gap-2 text-sm font-black">
                <BadgeCheck className="h-4 w-4 text-teal-light-ink" /> وفي أثناء ذلك
              </p>
              <p className="mt-2 text-sm leading-8 text-muted-foreground">
                يقرأ فريقنا الأكاديميُّ طلبك ومستنداتك. وإن احتجنا شيئا قبل الموعد
                {" "}<b className="text-foreground">نتواصل معك عبر {channel?.label ?? "البريد"}</b>
                {channelValue && <> على <b dir="ltr" className="text-foreground">{channelValue}</b></>}.
              </p>
            </Card>

            <div className={`rounded-2xl border p-5 ${mailSent ? "border-white/10 bg-white/[0.03]" : "border-gold/30 bg-gold/[0.07]"}`}>
              <p className="flex items-center gap-2 text-sm font-black">
                <MailCheck className="h-4 w-4 text-teal-light-ink" />
                {mailSent ? "أرسلنا بريد تأكيد إلى" : "تعذّر إرسال بريد التأكيد الآن"}
                {mailSent && <b dir="ltr" className="text-teal-light-ink">{form.email.trim()}</b>}
              </p>
              <p className="mt-2 text-xs leading-7 text-muted-foreground">
                {mailSent
                  ? "فيه رقم طلبك وتفاصيله والخطوة التالية — وفيه رابطٌ افتحه مرة واحدة ليُوثَّق بريدك. إن لم يصلك خلال دقائق راجع مجلد الرسائل غير المرغوبة، أو أعد إرساله من صفحة حالتك."
                  : "طلبك محفوظ ومقدَّم على أي حال. يمكنك طلب رسالة التأكيد مجددا من صفحة حالتك بعد الدخول."}
              </p>
            </div>

            <Card>
              <p className="flex items-center gap-2 text-sm font-black">
                <KeyRound className="h-4 w-4 text-teal-light-ink" /> تابع حالة طلبك من حسابك
              </p>
              <p className="mt-2 text-xs leading-7 text-muted-foreground">
                سجّل الدخول ببريدك <b dir="ltr" className="text-foreground">{form.email.trim()}</b> وكلمة المرور التي اختَرتها.
                سترى حالة طلبك في كل مرحلة، وإن اعتُمدت تُفتح لك بوابة المدربين من الحساب نفسه.
              </p>
              <Link
                to="/auth"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal/90"
              >
                سجّل الدخول <ArrowLeft className="h-4 w-4" />
              </Link>
            </Card>
          </div>
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
        <p className="mt-4 max-w-2xl text-base leading-8 text-foreground">
          مدربو وجيز لا يلقون دروسا مسجلة فحسب — يراجعون واجبات، ويرافقون طلابا، ويقيمون مشاريع تخرج.
          نموذج واحد بثلاثة أقسام — يُحفظ تقدّمك كلما مضيت، ولا ينتظرك بريد بينها.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Compass, text: "مسارات مبنية بمنهجية موثقة لا بمزاج" },
            { icon: Users, text: "طلاب جادون وصلوا عبر تشخيص" },
            { icon: Mic2, text: "مقابلة ودرس تجريبي قبل الاعتماد" },
          ].map((f) => (
            <Card key={f.text}>
              <f.icon className="h-5 w-5 text-teal-light-ink" />
              <p className="mt-3 text-xs font-bold leading-6 text-foreground">{f.text}</p>
            </Card>
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
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-fine font-black ${
                        state === "current" ? "bg-gold text-on-gold"
                          : state === "done" ? "bg-teal/20 text-teal-light-ink" : "bg-white/10 text-muted-foreground"
                      }`}
                      dir="ltr"
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : s.n}
                    </span>
                    <span className={`text-xs font-black ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}>{s.title}</span>
                  </span>
                  <span className="mt-1.5 block text-fine leading-relaxed text-muted-foreground">{s.hint}</span>
                </div>
              </li>
            );
          })}
        </ol>

        {/* الاستئناف يُقال ولا يُفترض: من يرى حقولا مملوءة ولا يعرف من ملأها
            يرتاب. والباب مفتوح للبدء من جديد بضغطة. */}
        {resumed && (
          <Card tone="accent" className="mt-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <p className="flex items-center gap-2 text-xs font-bold text-teal-light-ink">
              <RefreshCcw className="h-3.5 w-3.5" />
              أكملنا من حيث توقّفت — إجاباتك محفوظة في هذا المتصفّح.
            </p>
            <Button tone="secondary" size="sm" type="button" onClick={startOver}>
              ابدأ من جديد
            </Button>
          </Card>
        )}

        <form onSubmit={submit} className="mt-5 space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-9">
          {hp.field}
          {/* ══ ١) من أنت ══ */}
          {step === 1 && (
            <div className="space-y-4">
              <Question n={1} title="من أنت؟" hint="نتواصل معك على هذين — فراجعهما قبل المضيّ.">
                <FieldRow>
                  <Field label="الاسم الكامل" htmlFor="jt-name" required error={errOf("name")}>
                    <input id="jt-name" name="name" autoComplete="name" required value={form.fullName} onChange={set("fullName")} onBlur={touch("name")} {...invalidProps("jt-name-error", errOf("name"))} className={controlCls} />
                  </Field>
                  <Field label="البريد الإلكتروني" htmlFor="jt-email" required error={errOf("email")}>
                    <input id="jt-email" name="email" type="email" autoComplete="email" required dir="ltr" value={form.email} onChange={set("email")} onBlur={touch("email")} {...invalidProps("jt-email-error", errOf("email"))} className={`${controlCls} text-left`} />
                  </Field>
                  <Field label="رقم الجوال (واتساب)" htmlFor="jt-phone" hint="بلا رمز الدولة وبلا صفر البداية — مثال: 791234567">
                    <div className="flex gap-2" dir="ltr">
                      <select id="jt-cc" aria-label="رمز الدولة" value={form.phoneCountryCode} onChange={set("phoneCountryCode")} className={codeSelectCls}>
                        {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        id="jt-phone" name="tel" type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr"
                        placeholder="791234567"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: normalizeDigits(e.target.value) })}
                        className={`${controlCls} min-w-0 flex-1 text-left`}
                      />
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

                {/* الحسابُ مع البريد: كلمةٌ يختارها هنا يدخل بها لاحقا ليرى حالة
                    طلبه — ولا رمزٌ يُنسخ من الشاشة. وبعد إرسال القسم الأوّل
                    الحسابُ قائم فلا تُطلب ثانية. */}
                {!result ? (
                  <Card tone="accent" className="mt-5">
                    <p className="flex items-center gap-2 text-[12.5px] font-black text-teal-light-ink">
                      <KeyRound className="h-4 w-4" /> كلمة مرور لحسابك على المنصّة
                    </p>
                    <p className="mt-1 text-fine leading-6 text-muted-foreground">
                      تدخل بها ببريدك أعلاه لتتابع حالة طلبك في كل مرحلة — وإن اعتُمدت تُفتح لك بوابة المدربين من الحساب نفسه.
                      إن كان لك حساب على وجيز بهذا البريد فأدخل كلمتَه الحالية.
                    </p>
                    <FieldRow>
                      <Field label="كلمة المرور" htmlFor="jt-password" required hint="٨ أحرف على الأقل" error={errOf("password")}>
                        <div className="relative">
                          <input
                            id="jt-password" type={showPassword ? "text" : "password"} autoComplete="new-password" dir="ltr"
                            value={password} onChange={(e) => setPassword(e.target.value)} onBlur={touch("password")}
                            {...invalidProps("jt-password-error", errOf("password"))}
                            className={`${controlCls} pr-4 pl-11 text-left`}
                          />
                          <button
                            type="button" onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "أخفِ كلمة المرور" : "أظهر كلمة المرور"}
                            className="absolute left-1 top-1/2 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center text-muted-foreground transition hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>
                      <Field label="تأكيد كلمة المرور" htmlFor="jt-password2" required error={errOf("password2")}>
                        <input
                          id="jt-password2" type={showPassword ? "text" : "password"} autoComplete="new-password" dir="ltr"
                          value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} onBlur={touch("password2")}
                          {...invalidProps("jt-password2-error", errOf("password2"))}
                          className={`${controlCls} text-left ${passwordConfirm && passwordConfirm !== password ? "border-gold/60" : ""}`}
                        />
                      </Field>
                    </FieldRow>
                  </Card>
                ) : (
                  <Card as="p" tone="accent" className="mt-5 flex items-center gap-2 text-xs font-bold text-teal-light-ink">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    حسابك جاهز ببريدك <span dir="ltr" className="text-foreground">{form.email.trim()}</span> — تدخل به بعد الإرسال لمتابعة طلبك.
                  </Card>
                )}
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
                    <Card className="mt-3 bg-paper/20">
                      <FieldRow>
                        <Field label="جهة الاعتماد" htmlFor="jt-accred-body" required error={errOf("accredBody")}>
                          <select
                            id="jt-accred-body" value={form.accreditationBody} onChange={set("accreditationBody")} onBlur={touch("accredBody")}
                            {...invalidProps("jt-accred-body-error", errOf("accredBody"))}
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
                          <Field label="اكتب اسم الجهة كما هو في وثيقتك" htmlFor="jt-accred-other" required wide error={errOf("accredOther")}>
                            <input
                              id="jt-accred-other" placeholder="مثال: Chartered Institute of Personnel and Development (CIPD)"
                              value={form.accreditationOther} onChange={set("accreditationOther")} onBlur={touch("accredOther")}
                              {...invalidProps("jt-accred-other-error", errOf("accredOther"))} className={controlCls}
                            />
                          </Field>
                        )}
                      </FieldRow>
                      <p className="mt-4 text-fine leading-6 text-muted-foreground">
                        نطلب وثيقة الاعتماد لاحقا في خطوة المستندات — والمذكور هنا لا يُنشر ولا يُعرض للمتعلمين قبل توثيقه.
                      </p>
                    </Card>
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
                <p id="jt-why-count" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-fine">
                  <span className={motivationLen < MOTIVATION_MIN ? "text-gold-ink" : "text-muted-foreground"}>
                    {motivationLen < MOTIVATION_MIN
                      ? `اكتب ${MOTIVATION_MIN} حرفا على الأقل. أضف مثالا يوضّح القيمة التي ستقدّمها للمتعلمين في وجيز.`
                      : "شكرا — هذا يكفي."}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">
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
                          : st?.status === "error" ? "border-gold/50 bg-gold/[0.06]" : "border-white/12 bg-paper/25"
                      }`}>
                        <label className="flex cursor-pointer items-start gap-3">
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                            {st?.status === "done" ? <CheckCircle2 className="h-4 w-4 text-teal-light-ink" />
                              : st?.status === "registering" || st?.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              : <FileUp className="h-4 w-4 text-muted-foreground" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[12.5px] leading-6 text-foreground">{d.label}{d.required ? " *" : ""}</b>
                            <span className="mt-0.5 block text-fine text-muted-foreground">{d.hint}</span>
                            {st?.name && <span className="mt-1 block truncate text-fine text-muted-foreground">{st.name}</span>}
                          </span>
                          <input type="file" accept={d.accept} className="sr-only"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(d.kind, f); }} />
                        </label>
                        {st?.status === "error" && (
                          <p className="mt-2 flex items-center gap-1.5 text-fine text-gold-ink">
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
                  {/* الموسمُ: الشعبةُ تُفتح في موسمٍ، والمدرّبُ متفرّغٌ في بعضها
                      لا كلّها — فيختار ما يشاء منها، واحدا أو أكثر. */}
                  <FieldSet legend="وفي أي مواسم السنة؟" hint="اختر موسما أو أكثر — الشعب تُفتح في مواسم لا طول السنة." wide>
                    <OptionGrid
                      items={TRAINING_SEASONS.map((sn) => ({ value: sn.value, label: `${sn.label} · ${sn.months} (${sn.monthNums})` }))}
                      isOn={(v) => seasons.includes(v)}
                      onToggle={(v) => toggle(seasons, v, setSeasons)}
                      cols={2}
                      name="مواسم التدريب"
                    />
                  </FieldSet>
                </FieldRow>
              </Question>

              <ConsentRow checked={demoConsent} onChange={setDemoConsent}>
                أوافق على تقديم درس تجريبي قصير (Demo) ومقابلة قبل الاعتماد. *
              </ConsentRow>
            </div>
          )}

          {/* ══ ٣) التواصل والإرسال ══ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* بعد الإرسال نتواصل لاجتماعٍ تعريفيّ — فليختر هو كيف، لا أن
                  نتّصل بمن لا يجيب المجهول أو نراسل من لا يفتح بريده. */}
              <Question
                n={1}
                title="كيف نتواصل معك للاجتماع التعريفي؟"
                required
                hint="بعد قراءة طلبك نتواصل معك لتحديد موعد اجتماع تعريفي قصير — اختر الوسيلة الأنسب لك."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONTACT_CHANNELS.map((c) => {
                    const on = contactChannel === c.value;
                    const phoneShown = normalizeDigits(form.phone) ? `${form.phoneCountryCode}${normalizeDigits(form.phone)}` : "";
                    const Icon = c.value === "phone" ? Phone : c.value === "whatsapp" ? MessageCircle : c.value === "email" ? Mail : AtSign;
                    const sub = c.needsPhone
                      ? (phoneShown || "لم تذكر رقمك في القسم الأول")
                      : c.value === "email" ? form.email.trim() : "تكتبه أدناه";
                    return (
                      <button
                        type="button" key={c.value}
                        onClick={() => setContactChannel(c.value)}
                        aria-pressed={on}
                        className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-right transition-colors ${
                          on ? "border-teal bg-teal/[0.12]" : "border-white/12 bg-paper/25 hover:border-white/30"
                        }`}
                      >
                        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-teal/25 text-teal-light-ink" : "bg-white/[0.06] text-muted-foreground"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <b className={`block text-[12.5px] ${on ? "text-teal-light-ink" : "text-foreground"}`}>{c.label}</b>
                          <span className={`mt-0.5 block truncate text-fine ${c.needsPhone && !phoneShown ? "text-gold-ink" : "text-muted-foreground"}`} dir={c.value === "other_email" ? "rtl" : "ltr"}>
                            {sub}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {contactChannel === "other_email" && (
                  <div className="mt-4">
                    <Field label="البريد الآخر الذي تفضّله" htmlFor="jt-alt-email" required hint="يُحفظ في طلبك بجانب بريد حسابك — والدخول يبقى ببريد الحساب." error={errOf("altEmail")}>
                      <input
                        id="jt-alt-email" type="email" dir="ltr" autoComplete="email" placeholder="name@example.com"
                        value={contactAltEmail} onChange={(e) => setContactAltEmail(e.target.value)} onBlur={touch("altEmail")}
                        {...invalidProps("jt-alt-email-error", errOf("altEmail"))}
                        className={`${controlCls} text-left`}
                      />
                    </Field>
                  </div>
                )}
                {(contactChannel === "phone" || contactChannel === "whatsapp") && normalizeDigits(form.phone) && (
                  <Inset as="p" tone="accent" className="mt-4 flex items-center gap-2 text-fine leading-6 text-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-light-ink" />
                    سنتواصل على <b dir="ltr" className="text-foreground">{form.phoneCountryCode}{normalizeDigits(form.phone)}</b> — إن لم يكن رقمك، عد إلى القسم الأول وصحّحه.
                  </Inset>
                )}
                {(contactChannel === "phone" || contactChannel === "whatsapp") && !normalizeDigits(form.phone) && (
                  <Inset as="p" tone="warn" className="mt-4 text-fine leading-6 text-gold-ink">
                    لم تذكر رقم جوالك في القسم الأول. <button type="button" onClick={() => setStep(1)} className="cursor-pointer font-black underline">عد وأضفه</button> أو اختر البريد.
                  </Inset>
                )}
              </Question>

              {/* ملخّص ما سيصل المراجع — بلا مفاجآت */}
              <Card>
                <p className="flex items-center gap-2 text-xs font-black text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-teal-light-ink" /> ما سيقرؤه المراجع عنك
                </p>
                <ul className="mt-3 space-y-1.5 text-fine leading-6 text-muted-foreground">
                  <li>{form.fullName.trim() || "—"} · {specialties.length} تخصصا · {DOMAIN_YEARS.find((y) => y.value === form.domainYears)?.label ?? "—"} في المجال</li>
                  <li>{teachable.length} دورة من الكتالوج تستطيع تدريسها{teachableOther.trim() ? " · وأخرى بقلمك" : ""}</li>
                  <li>{Object.values(uploads).filter((u) => u.status === "done").length} مستندا مرفوعا</li>
                  {seasons.length > 0 && <li>{seasons.map((v) => TRAINING_SEASONS.find((x) => x.value === v)?.label ?? v).join(" · ")}</li>}
                  <li>دافعك: {motivationLen} حرفا</li>
                </ul>
                <p className="mt-3 border-t border-white/10 pt-3 text-fine leading-6 text-muted-foreground">
                  رقم طلبك: <b className="font-mono text-foreground" dir="ltr">{result?.reference ?? "—"}</b> — سيصلك في بريد التأكيد مع تفاصيل طلبك.
                </p>
              </Card>
            </div>
          )}

          {error && <Inset as="p" tone="danger" className="text-xs text-red-200" role="alert">{error}</Inset>}

          {/* ما ينقص، بالاسم. زرٌّ مطفأ بلا سبب يجعل المتقدّم يفتّش النموذج
              بعينه؛ وهذه قائمةٌ تُقرأ في سطرين وتختفي حين تكتمل الخطوة.
              aria-live كي يسمعها قارئ الشاشة وهي تتناقص. */}
          {missing[step as 1 | 2 | 3].length > 0 && (
            <Card tone="warn" aria-live="polite">
              <p className="text-xs font-black text-gold-ink">
                بقي {countAr(missing[step as 1 | 2 | 3].length, MISSING_FORMS)} قبل «{step < 3 ? "التالي" : "الإرسال"}»
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-fine leading-6 text-foreground">
                {missing[step as 1 | 2 | 3].map((m) => (
                  <li key={m} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-gold-ink" /> {m}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* التنقل — «التالي» معطّل حتى تكتمل الخطوة، لا حتى يكتمل النموذج كله */}
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-6">
            {step > 1 ? (
              <Button tone="secondary" type="button" onClick={back}>
                <ArrowRight className="h-4 w-4" /> السابق
              </Button>
            ) : <span />}

            {/* مفتاحان مختلفان لا زرٌّ واحد يتبدّل نوعه.

                بلا المفتاح يرى React زرّا واحدا في الموضع نفسه فيبدّل خاصيّته
                من button إلى submit على العنصر ذاته — ونقرةُ «التالي» التي
                نقلتنا إلى الخطوة الأخيرة يقع فعلُها الافتراضيّ بعد ذلك على
                الزرّ وقد صار submit، فيُرسَل الطلبُ فورا وتُقفز الخطوة الثالثة
                كلها. عطبٌ صامت: المتقدّم لا يرى شاشة حسابه أصلا. */}
            {step < 3 ? (
              <Button tone="confirm" key="next"
                type="button" onClick={next} disabled={!stepValid[step as 1 | 2 | 3] || busy} className="disabled:cursor-not-allowed">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "نحفظ قسمك الأول…" : "التالي"}
                {!busy && <ArrowLeft className="h-4 w-4" />}
              </Button>
            ) : (
              <Button tone="primary" key="send"
                type="submit" disabled={!valid || busy} className="disabled:cursor-not-allowed">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "جاري الإرسال…" : "أرسل طلب الانضمام"}
              </Button>
            )}
          </div>
        </form>

        {/* متابعة طلب سابق — قسم ثانوي مطوي ليبقى التركيز على الطلب الجديد.
            البريدُ يكفي؛ والرقمُ المرجعيّ اختياريّ لمن أراد تحديدا. ولمن أراد
            التفاصيلَ كلَّها — والسحبَ — حسابُه: يدخل ببريده وكلمته. */}
        <details className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-black">
            <Search className="h-4 w-4 text-teal-light-ink" /> قدّمت سابقا؟ تابع حالة طلبك
          </summary>
          <p className="mt-4 text-fine leading-6 text-muted-foreground">
            بريدك يكفي. ولتفاصيل أكثر — وسحب الطلب — <Link to="/auth" className="text-teal-light-ink underline">سجّل الدخول</Link> ببريدك وكلمة المرور التي اختَرتها عند التقديم.
          </p>
          <div className="mt-4 grid gap-3 border-t border-white/5 pt-5 sm:grid-cols-2">
            <input dir="ltr" type="email" placeholder="بريدك المستخدم في الطلب *" aria-label="البريد" value={lookup.email}
              onChange={(e) => setLookup({ ...lookup, email: e.target.value })} className={`${controlCls} text-left`} />
            <input dir="ltr" placeholder="رقم الطلب (اختياري) WJ-TR-…" aria-label="الرقم المرجعي (اختياري)" value={lookup.reference}
              onChange={(e) => setLookup({ ...lookup, reference: e.target.value })} className={`${controlCls} text-left font-mono`} />
          </div>
          <Button tone="confirm" onClick={checkStatus} disabled={!/.+@.+\..+/.test(lookup.email) || lookupBusy} className="mt-3 text-teal-light-ink">
            {lookupBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} اعرض الحالة
          </Button>
          {lookupResult && (
            <Inset tone="accent" className="mt-3">
              <p className="text-xs font-black text-teal-light-ink">{lookupResult.label}</p>
              <p className="mt-1 text-fine text-muted-foreground" dir="ltr">{lookupResult.reference}</p>
              {lookupResult.explain && <p className="mt-2 text-fine leading-6 text-foreground">{lookupResult.explain}</p>}
            </Inset>
          )}
          {lookupError && <p className="mt-3 text-xs text-red-300" role="alert">{lookupError}</p>}
        </details>
      </div>
    </SiteShell>
  );
}
