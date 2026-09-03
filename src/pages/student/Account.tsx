import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Award, BookOpen, CheckCircle2, FileText, Loader2, Lock, LogOut,
  Mail, MessageCircle, Route as RouteIcon, Save, ShieldAlert, User, X,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { clearLocalSession, readSession } from "@/services/auth";

/* ─────────── صفحة «حسابي» — الملف الشخصي الكامل للطالب ───────────
   وضعان صادقان:
   - خادم حقيقي: جلسة API فعّالة → قراءة وحفظ في قاعدة البيانات.
   - معاينة محلية: بلا جلسة خادم → حفظ محلي موسوم حتى يُربط الحساب. */

const LOCAL_KEY = "wajeez_profile";

const ARAB_COUNTRIES = [
  "الأردن", "السعودية", "الإمارات", "مصر", "الكويت", "قطر", "عُمان", "البحرين",
  "العراق", "فلسطين", "لبنان", "سوريا", "ليبيا", "تونس", "الجزائر", "المغرب", "السودان", "اليمن", "موريتانيا", "أخرى",
];
const EDUCATION_LEVELS = ["ثانوي", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه", "أخرى"];
const EXPERIENCE_RANGES = ["1-3", "4-7", "8-12", "12+"];
const LANGUAGES = ["العربية", "English", "الاثنان"];

interface ProfileForm {
  displayName: string;
  avatarUrl: string;
  phone: string;
  country: string;
  city: string;
  birthDate: string; // yyyy-mm-dd
  gender: "" | "male" | "female";
  preferredLanguage: string;
  education: string;
  university: string;
  major: string;
  jobTitle: string;
  company: string;
  experienceYears: string;
  careerGoal: string;
  goalAr: string;
  interests: string[];
}

const EMPTY: ProfileForm = {
  displayName: "", avatarUrl: "", phone: "", country: "", city: "",
  birthDate: "", gender: "", preferredLanguage: "", education: "",
  university: "", major: "", jobTitle: "", company: "",
  experienceYears: "", careerGoal: "", goalAr: "", interests: [],
};

interface ServerProfile {
  user: { email: string; displayName: string; createdAt: string };
  profile: Partial<Record<keyof ProfileForm, unknown>> & { interests?: unknown; birthDate?: string | null };
}

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none";
const labelCls = "mb-1.5 block text-xs font-bold text-white/60";

/* الخطأُ يُقال عند الحقل الذي رُفض، لا في ذيل الصفحة.

   كانت هذه الشاشة تُخبر بالرفض بعد الحفظ وفي موضعٍ واحدٍ أسفلَها، وبنصِّ
   الخادم كما جاء: من كتب رابط صورةٍ أطولَ من الحدّ يقرأ رسالةً عامّةً ثمّ
   يبحث بعينه عن الحقل. فصار لكلّ حقلٍ رسالتُه عنده، موصولةً به لقارئ
   الشاشة بـ`aria-describedby`، ولا تظهر قبل أن يُلمس الحقلُ. */
function Field({ label, hint, error, name, children }: {
  label: string;
  hint?: string;
  /** رسالةُ هذا الحقل — تُعرض تحته وتُوصَل به */
  error?: string | null;
  /** يُشتقّ منه معرّفُ الرسالة كي يصحّ `aria-describedby` */
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* label يلف الحقل — ارتباط ضمني صحيح لقارئ الشاشة وأدوات الفحص */}
      <label className="block">
        <span className={labelCls}>{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-[11px] text-white/50">{hint}</p>}
      {name && error && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-[11px] font-bold leading-5 text-red-300">{error}</p>
      )}
    </div>
  );
}

/** ما يُنثَر على الحقل ليُقرأ خطؤه — بلا معرّفٍ حين لا خطأ */
function bad(name: string, error?: string | null) {
  return error ? ({ "aria-invalid": true, "aria-describedby": `${name}-error` } as const) : ({} as Record<string, never>);
}

export default function StudentAccount() {
  const localSession = readSession();
  const [mode, setMode] = useState<"loading" | "server" | "local">("loading");
  const [email, setEmail] = useState(localSession?.email ?? "");
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [interestDraft, setInterestDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [err, setErr] = useState("");

  /* تحميل الملف: من الخادم عند وجود جلسة حقيقية، وإلا من المخزن المحلي الموسوم */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<ServerProfile>("/api/learner/profile");
        if (!alive) return;
        setEmail(data.user.email);
        setForm({
          ...EMPTY,
          displayName: data.user.displayName ?? "",
          avatarUrl: (data.profile.avatarUrl as string) ?? "",
          phone: (data.profile.phone as string) ?? "",
          country: (data.profile.country as string) ?? "",
          city: (data.profile.city as string) ?? "",
          birthDate: data.profile.birthDate ? String(data.profile.birthDate).slice(0, 10) : "",
          gender: (data.profile.gender as ProfileForm["gender"]) ?? "",
          preferredLanguage: (data.profile.preferredLanguage as string) ?? "",
          education: (data.profile.education as string) ?? "",
          university: (data.profile.university as string) ?? "",
          major: (data.profile.major as string) ?? "",
          jobTitle: (data.profile.jobTitle as string) ?? "",
          company: (data.profile.company as string) ?? "",
          experienceYears: (data.profile.experienceYears as string) ?? "",
          careerGoal: (data.profile.careerGoal as string) ?? "",
          goalAr: (data.profile.goalAr as string) ?? "",
          interests: Array.isArray(data.profile.interests) ? (data.profile.interests as string[]) : [],
        });
        setMode("server");
      } catch (e) {
        if (!alive) return;
        /* بلا جلسة خادم — نقرأ النسخة المحلية إن وجدت */
        try {
          const raw = localStorage.getItem(LOCAL_KEY);
          if (raw) setForm({ ...EMPTY, ...(JSON.parse(raw) as Partial<ProfileForm>) });
        } catch { /* تجاهل */ }
        if (!form.displayName && localSession?.name) {
          setForm((f) => ({ ...f, displayName: f.displayName || localSession.name }));
        }
        setMode("local");
        if (!(e instanceof ApiError && e.status === 401)) setErr("تعذر الوصول للخادم — سنعمل محليا مؤقتا");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  /* الإضافةُ كانت تُرفض بصمتٍ في ثلاث حالات: فارغٌ، ومكرّرٌ، وبعد الثاني
     عشر. فمن كتب اهتماما موجودا يضغط «أضف» فلا يحدث شيء — ولا يعرف أنّه
     مضافٌ أصلا. فصار لكلّ رفضٍ سببُه مكتوبا. */
  const [interestMsg, setInterestMsg] = useState("");
  const addInterest = () => {
    const v = interestDraft.trim();
    if (!v) { setInterestMsg("اكتب اهتماما أوّلا"); return; }
    if (v.length > 40) { setInterestMsg("٤٠ حرفا حدُّ الاهتمام الواحد"); return; }
    if (form.interests.includes(v)) { setInterestMsg(`«${v}» مضافٌ عندك بالفعل`); return; }
    if (form.interests.length >= 12) { setInterestMsg("اثنا عشر اهتماما هي الحدّ — احذف واحدا لتضيف غيره"); return; }
    set("interests", [...form.interests, v]);
    setInterestDraft("");
    setInterestMsg("");
  };

  /* ── حدودُ الخادم مقروءةً هنا ──

     الحدودُ في `patchSchema` على الخادم (الاسم ٢–٨٠، الرابط ٥٠٠، الهاتف ٢٤،
     الهدف ٣٠٠، الاهتمامات ١٢). ومن تجاوزها كان يضغط «حفظ» فيرجع بخطأٍ عامّ
     بعد نداءٍ ذهب هدرا. فصارت تُقاس هنا قبل الإرسال، وبالنصِّ الذي يقول
     الحدَّ لا الذي يقول «تعذّر الحفظ». */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const fieldErrors = useMemo<Record<string, string | null>>(() => {
    const name = form.displayName.trim();
    const url = form.avatarUrl.trim();
    return {
      displayName: name.length < 2 ? "اسمُك حرفان على الأقلّ" : name.length > 80 ? "الاسمُ أطولُ من ٨٠ حرفا" : null,
      /* الرابطُ يُعرض صورةً في حسابه وشهادته — فرابطٌ بلا بروتوكولٍ صورةٌ مكسورة */
      avatarUrl: !url ? null
        : url.length > 500 ? "الرابطُ أطولُ من ٥٠٠ حرف"
        : /^https?:\/\/\S+$/.test(url) ? null
        : "رابطٌ مباشرٌ للصورة يبدأ بـ https://",
      phone: form.phone.trim().length > 24 ? "الرقمُ أطولُ من ٢٤ خانة" : null,
      /* تاريخُ ميلادٍ في المستقبل يُقبله الخادم ويكسر حسابَ العمر في الشهادة */
      birthDate: form.birthDate && form.birthDate > new Date().toISOString().slice(0, 10)
        ? "تاريخٌ في المستقبل — راجع ما كتبت"
        : null,
      careerGoal: form.careerGoal.trim().length > 300 ? "٣٠٠ حرفٍ حدُّ هذا الحقل" : null,
      goalAr: form.goalAr.trim().length > 300 ? "٣٠٠ حرفٍ حدُّ هذا الحقل" : null,
    };
  }, [form.displayName, form.avatarUrl, form.phone, form.birthDate, form.careerGoal, form.goalAr]);

  /** رسالةُ الحقل — مكتومةٌ حتى يُلمس، ومعلَنةٌ بعد محاولةِ حفظٍ مرفوضة */
  const errOf = (k: string) => (touched[k] ? fieldErrors[k] ?? null : null);

  const canSave = useMemo(
    () => Object.values(fieldErrors).every((e) => !e),
    [fieldErrors],
  );

  const save = async () => {
    /* ضغطُ «حفظ» يُوسم كلَّ حقلٍ ملموسا — فمن لم يفتح الحقلَ المرفوض يراه الآن */
    if (!canSave) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(fieldErrors).map((k) => [k, true])) }));
      return;
    }
    if (busy) return;
    setBusy(true); setErr(""); setSavedMsg("");
    const payload = {
      ...form,
      birthDate: form.birthDate ? new Date(`${form.birthDate}T00:00:00.000Z`).toISOString() : null,
      gender: form.gender || null,
      interests: form.interests,
      /* الحقول الفارغة تُرسل null لتمسح القيمة القديمة بوعي */
      avatarUrl: form.avatarUrl || null, phone: form.phone || null,
      country: form.country || null, city: form.city || null,
      preferredLanguage: form.preferredLanguage || null,
      education: form.education || null, university: form.university || null, major: form.major || null,
      jobTitle: form.jobTitle || null, company: form.company || null,
      experienceYears: form.experienceYears || null,
      careerGoal: form.careerGoal || null, goalAr: form.goalAr || null,
    };
    try {
      if (mode === "server") {
        await apiPatch("/api/learner/profile", payload);
        setSavedMsg("حُفظت بياناتك في حسابك — تبقى معك على أي جهاز");
      } else {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(form));
        setSavedMsg("حُفظت محليا في هذه المعاينة — ستُنقل لحسابك الحقيقي عند الربط");
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذر الحفظ — حاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  /* ── الأمان والجلسات — تظهر فقط مع جلسة خادم حقيقية ── */
  const [secBusy, setSecBusy] = useState<"" | "logoutAll" | "deactivate">("");
  const [secMsg, setSecMsg] = useState("");
  const [secErr, setSecErr] = useState("");
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const logoutAll = async () => {
    if (secBusy) return;
    setSecBusy("logoutAll"); setSecErr(""); setSecMsg("");
    try {
      const { revoked } = await apiPost<{ ok: boolean; revoked: number }>("/api/auth/logout-all");
      clearLocalSession();
      setSecMsg(`أُنهيت ${revoked} جلسة — نحوّلك لتسجيل الدخول من جديد`);
      window.setTimeout(() => window.location.assign("/auth"), 1600);
    } catch (e) {
      setSecErr(e instanceof ApiError ? e.message : "تعذر إنهاء الجلسات — حاول مجددا");
      setSecBusy("");
    }
  };

  const deactivate = async () => {
    if (secBusy) return;
    setSecBusy("deactivate"); setSecErr(""); setSecMsg("");
    try {
      await apiPost("/api/auth/deactivate");
      clearLocalSession();
      setSecMsg("عُطّل حسابك — بياناتك محفوظة، وإعادة التفعيل عبر التواصل معنا");
      window.setTimeout(() => window.location.assign("/"), 2000);
    } catch (e) {
      setSecErr(e instanceof ApiError ? e.message : "تعذر تعطيل الحساب — حاول مجددا");
      setSecBusy("");
      setConfirmingDeactivate(false);
    }
  };

  if (mode === "loading") {
    return (
      <PortalLayout title="حسابي">
        {/* هيكل تحميل بنفس شكل البطاقات — أهدأ للعين من السبينر */}
        <div aria-busy="true" aria-label="جاري تحميل ملفك" className="animate-pulse space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 rounded-lg bg-white/10" />
                <div className="h-3 w-56 rounded-full bg-white/5" />
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="h-12 rounded-xl bg-white/5" />
              <div className="h-12 rounded-xl bg-white/5" />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="h-4 w-32 rounded-full bg-white/10" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="h-12 rounded-xl bg-white/5" />
              <div className="h-12 rounded-xl bg-white/5" />
              <div className="h-12 rounded-xl bg-white/5" />
              <div className="h-12 rounded-xl bg-white/5" />
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="حسابي وملفي الشخصي">
      {mode === "local" && (
        <p className="mb-5 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-4 py-2 text-center text-xs text-gold-ink">
          {"جلسة الخادم غير فعالة — الحفظ محلي مؤقتا."}
        </p>
      )}

      {/* بطاقة الهوية */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-4">
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt="صورتك الشخصية" className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal to-teal-deep text-2xl font-black text-white">
              {(form.displayName || "م").charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black">{form.displayName || "—"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50" dir="ltr">
              <Mail className="h-3.5 w-3.5" /> {email || "—"}
            </p>
          </div>
          {mode === "server" && (
            <span className="flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-[11px] font-bold text-teal-light-ink">
              <CheckCircle2 className="h-3.5 w-3.5" /> محفوظ في قاعدة البيانات
            </span>
          )}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل *" name="displayName" error={errOf("displayName")}>
            <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} onBlur={touch("displayName")} {...bad("displayName", errOf("displayName"))} className={inputCls} autoComplete="name" />
          </Field>
          <Field label="رابط الصورة الشخصية" hint="اختياري — رابط صورة مباشر يظهر في حسابك وشهاداتك" name="avatarUrl" error={errOf("avatarUrl")}>
            <input dir="ltr" value={form.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} onBlur={touch("avatarUrl")} {...bad("avatarUrl", errOf("avatarUrl"))} placeholder="https://…" className={`${inputCls} text-left`} />
          </Field>
        </div>
      </section>

      {/* المعلومات الشخصية */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base font-black"><User className="h-4 w-4 text-teal-light-ink" /> معلومات شخصية</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="رقم الهاتف (واتساب)" name="phone" error={errOf("phone")}>
            <input dir="ltr" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} onBlur={touch("phone")} {...bad("phone", errOf("phone"))} placeholder="+962…" className={`${inputCls} text-left`} />
          </Field>
          <Field label="الدولة">
            <select value={form.country} onChange={(e) => set("country", e.target.value)} className={`${inputCls} [&>option]:bg-surface`}>
              <option value="">اختر دولتك</option>
              {ARAB_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="المدينة">
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
          </Field>
          <Field label="تاريخ الميلاد" hint="اختياري — يستخدم لشهاداتك والفرص العمرية فقط" name="birthDate" error={errOf("birthDate")}>
            <input type="date" dir="ltr" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} onBlur={touch("birthDate")} {...bad("birthDate", errOf("birthDate"))} className={`${inputCls} text-left`} />
          </Field>
          <Field label="الجنس" hint="اختياري تماما">
            <select value={form.gender} onChange={(e) => set("gender", e.target.value as ProfileForm["gender"])} className={`${inputCls} [&>option]:bg-surface`}>
              <option value="">أفضّل عدم الذكر</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>
          <Field label="اللغة المفضلة للتعلم">
            <select value={form.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} className={`${inputCls} [&>option]:bg-surface`}>
              <option value="">اختر</option>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {/* التعليم */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base font-black"><BookOpen className="h-4 w-4 text-teal-light-ink" /> التعليم</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="المؤهل العلمي">
            <select value={form.education} onChange={(e) => set("education", e.target.value)} className={`${inputCls} [&>option]:bg-surface`}>
              <option value="">اختر</option>
              {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="الجامعة / المؤسسة التعليمية">
            <input value={form.university} onChange={(e) => set("university", e.target.value)} className={inputCls} />
          </Field>
          <Field label="التخصص">
            <input value={form.major} onChange={(e) => set("major", e.target.value)} className={inputCls} />
          </Field>
        </div>
      </section>

      {/* الحياة المهنية */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base font-black"><RouteIcon className="h-4 w-4 text-teal-light-ink" /> حياتك المهنية وهدفك</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="الوظيفة الحالية">
            <input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} className={inputCls} />
          </Field>
          <Field label="الشركة / الجهة">
            <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} />
          </Field>
          <Field label="سنوات الخبرة">
            <select value={form.experienceYears} onChange={(e) => set("experienceYears", e.target.value)} className={`${inputCls} [&>option]:bg-surface`}>
              <option value="">اختر النطاق</option>
              {EXPERIENCE_RANGES.map((r) => <option key={r} value={r}>{r === "12+" ? "أكثر من ١٢ سنة" : `${r} سنوات`}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="هدفك المهني" name="careerGoal" error={errOf("careerGoal")}>
            <textarea rows={2} maxLength={300} value={form.careerGoal} onChange={(e) => set("careerGoal", e.target.value)} onBlur={touch("careerGoal")} {...bad("careerGoal", errOf("careerGoal"))} placeholder="مثال: أن أقود فريق تسويق خلال سنتين" className={`${inputCls} resize-none`} />
          </Field>
          <Field label="هدفك التعلمي" hint="ما الذي تريد أن تتقنه في هذه المرحلة؟" name="goalAr" error={errOf("goalAr")}>
            <textarea rows={2} maxLength={300} value={form.goalAr} onChange={(e) => set("goalAr", e.target.value)} onBlur={touch("goalAr")} {...bad("goalAr", errOf("goalAr"))} className={`${inputCls} resize-none`} />
          </Field>
        </div>
        <div className="mt-4">
          <label className="block">
            <span className={labelCls}>اهتماماتك</span>
            <span className="flex gap-2">
              <input
                value={interestDraft}
                onChange={(e) => { setInterestDraft(e.target.value); setInterestMsg(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterest(); } }}
                placeholder="اكتب اهتماما ثم Enter — حتى 12"
                className={inputCls}
              />
              <button type="button" onClick={addInterest} className="shrink-0 cursor-pointer rounded-xl border border-teal/50 px-4 text-xs font-bold text-teal-light-ink hover:bg-teal/10">
                أضف
              </button>
            </span>
          </label>
          {interestMsg && (
            <p role="alert" className="mt-1.5 text-[11px] font-bold leading-5 text-red-300">{interestMsg}</p>
          )}
          {form.interests.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {form.interests.map((i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal-light-ink">
                  {i}
                  <button type="button" aria-label={`أزل ${i}`} onClick={() => set("interests", form.interests.filter((x) => x !== i))} className="cursor-pointer text-white/50 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* حفظ */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {err && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs font-semibold text-red-300">{err}</p>}
        {savedMsg && <p role="status" className="rounded-xl border border-teal/40 bg-teal/10 px-4 py-2.5 text-xs font-bold text-teal-light-ink">{savedMsg}</p>}
        {/* الزرُّ لا يُطفأ على حقلٍ مرفوض: كان مطفأً والسببُ في حقلٍ قد يكون
            خارج الشاشة، فتبقى الضغطةُ بلا جواب. فصار يُضغط، ويُظهر الرفضَ
            عند حقله، ولا يُرسل نداءً يعرف أنّه مردود. */}
        <button
          onClick={save} disabled={busy}
          className="flex h-12 cursor-pointer items-center gap-2 rounded-full bg-gold px-10 font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          احفظ ملفي
        </button>
      </div>

      {/* روابط بقية أقسام الملف */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base font-black"><FileText className="h-4 w-4 text-teal-light-ink" /> بقية ملفك — في مكانها الطبيعي</h2>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: "/student", icon: RouteIcon, t: "مساراتي وتقدمي", d: "مسارك النشط ونسبة إنجازه" },
            { to: "/student/learning", icon: BookOpen, t: "دوراتي وجلساتي", d: "الدورات المسجلة ومواعيدها" },
            { to: "/student/certificates", icon: Award, t: "شهاداتي", d: "شهادات الإتمام الموثقة وروابط التحقق" },
            { to: "/student/billing", icon: FileText, t: "فواتيري وطلباتي", d: "أرقام مرجعية وسجل دفعات ودفع اختباري" },
            { to: "/student/cv", icon: FileText, t: "سيرتي الذاتية", d: "رفع بموافقة صريحة وحذف موثق" },
            { to: "/diagnostic", icon: MessageCircle, t: "نتائج تشخيصي", d: "آخر نتيجة محفوظة وتقريرك الشخصي" },
          ].map((x) => (
            <Link key={x.t} to={x.to} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-teal/50">
              <x.icon className="h-4 w-4 text-teal-light-ink" />
              <p className="mt-2 text-sm font-black">{x.t}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">{x.d}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* بيانات الفوترة والطلبات */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-base font-black"><Lock className="h-4 w-4 text-teal-light-ink" /> الفوترة والطلبات</h2>
        <p className="mt-2 text-sm leading-7 text-white/55">
          فواتيرك وطلباتك ودفعاتك — بأرقامها المرجعية وسجل مدفوعاتها — في صفحة{" "}
          <Link to="/student/billing" className="font-bold text-teal-light-ink underline-offset-4 hover:underline">فواتيري</Link>.
          لأي طلب استرداد أو مراجعة فاتورة: <Link to="/contact" className="font-bold text-teal-light-ink underline-offset-4 hover:underline">صفحة التواصل</Link> — اختر «طلب استرداد».
        </p>
      </section>

      {/* الأمان والجلسات — إجراءات حقيقية على الخادم، تظهر فقط مع جلسة فعالة */}
      {mode === "server" && (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-base font-black"><ShieldAlert className="h-4 w-4 text-teal-light-ink" /> الأمان والجلسات</h2>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">الخروج من كل الأجهزة</p>
              <p className="mt-1 text-xs leading-6 text-white/50">
                سجّلت دخولك على جهاز آخر؟ أنهِ كل الجلسات دفعة واحدة — ستحتاج الدخول من جديد على هذا الجهاز أيضا.
              </p>
            </div>
            <button
              type="button" onClick={logoutAll} disabled={!!secBusy}
              className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-xs font-bold text-white/80 transition hover:border-teal/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {secBusy === "logoutAll" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              إنهاء كل الجلسات
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-300">تعطيل الحساب</p>
                <p className="mt-1 text-xs leading-6 text-white/50">
                  يوقف حسابك فورا ويبطل جلساتك — بياناتك وتقدمك محفوظة، وإعادة التفعيل عبر التواصل معنا.
                </p>
              </div>
              {!confirmingDeactivate ? (
                <button
                  type="button" onClick={() => setConfirmingDeactivate(true)} disabled={!!secBusy}
                  className="shrink-0 cursor-pointer rounded-full border border-red-400/40 px-5 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  تعطيل حسابي
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] font-bold text-red-300">متأكد؟ الإجراء فوري</span>
                  <button
                    type="button" onClick={deactivate} disabled={!!secBusy}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {secBusy === "deactivate" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    نعم، عطّل حسابي
                  </button>
                  <button
                    type="button" onClick={() => setConfirmingDeactivate(false)} disabled={!!secBusy}
                    className="cursor-pointer rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    تراجع
                  </button>
                </div>
              )}
            </div>
          </div>

          {secErr && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs font-semibold text-red-300">{secErr}</p>}
          {secMsg && <p role="status" className="mt-4 rounded-xl border border-teal/40 bg-teal/10 px-4 py-2.5 text-xs font-bold text-teal-light-ink">{secMsg}</p>}
        </section>
      )}
    </PortalLayout>
  );
}
