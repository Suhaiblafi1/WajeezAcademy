import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Award, BookOpen, Camera, ChevronLeft, FileText, Loader2, Lock, LogOut,
  ImagePlus, Mail, MessageCircle, Route as RouteIcon, Save, ShieldAlert, KeyRound, User, X } from "lucide-react";
/* الإطارُ يتبع البوّابةَ التي فُتحت منها الصفحة — لا بوّابةَ المتعلّم دائما.
   والسببُ مشروحٌ في `pages/PortalFrame.tsx`. */
import PortalFrame from "../PortalFrame";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { fetchMe } from "@/services/me";
import { showsLearnerFields } from "@/application/site/account-fields";
import { portalPrefixFor } from "@/application/site/portal-paths";
import { clearLocalSession, readSession } from "@/services/auth";
import { ImageConditionError } from "@/lib/prepare-image";
import ImageFramer from "@/components/ImageFramer";
import { AvatarUploadError, uploadAccountAvatar } from "@/services/avatar-upload";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import DateField from "@/components/ui/DateField";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import SectionHead from "@/components/ui/SectionHead";
import PublicTextCard from "@/components/trainer/PublicTextCard";
import ProfileSuggestions from "@/components/trainer/ProfileSuggestions";
import NotificationPreferences from "@/components/NotificationPreferences";
/* ─────────── صفحة «حسابي» — الملف الشخصي الكامل للطالب ───────────
   وضعان صادقان:
   - خادم حقيقي: جلسة API فعّالة → قراءة وحفظ في قاعدة البيانات.
   - معاينة محلية: بلا جلسة خادم → حفظ محلي موسوم حتى يُربط الحساب. */

const LOCAL_KEY = "wajeez_profile";


/* أقدمُ سنةِ ميلادٍ في القائمة — ومن وُلد قبلها فحالٌ لا يُخدَم بقائمةٍ أطول:
   تطويلُها إلى ١٩٠٠ يزيد ثلاثين سطرا يمرّ عليها كلُّ متعلّمٍ ولا يختارها أحد. */
const BIRTH_YEAR_FLOOR = 1930;

const ARAB_COUNTRIES = [
  "الأردن", "السعودية", "الإمارات", "مصر", "الكويت", "قطر", "عمان", "البحرين",
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
  "w-full rounded-xl border border-white/15 bg-paper/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75 transition focus:border-teal focus:outline-none focus:ring-4 focus:ring-teal/10";
const labelCls = "mb-1.5 block text-xs font-bold text-muted-foreground";

/* الخطأُ يُقال عند الحقل الذي رُفض، لا في ذيل الصفحة.

   كانت هذه الشاشة تُخبر بالرفض بعد الحفظ وفي موضعٍ واحدٍ أسفلَها، وبنصِّ
   الخادم كما جاء: من كتب رابط صورةٍ أطولَ من الحدّ يقرأ رسالةً عامّةً ثمّ
   يبحث بعينه عن الحقل. فصار لكلّ حقلٍ رسالتُه عنده، موصولةً به لقارئ
   الشاشة بـ`aria-describedby`، ولا تظهر قبل أن يُلمس الحقلُ. */
function Field({ label, hint, error, name, wide, children }: {
  label: string;
  hint?: string;
  /** يأخذ السطرَ كلَّه في الشبكة — للاسم، وهو أوّلُ ما يُقرأ */
  wide?: boolean;
  /** رسالةُ هذا الحقل — تُعرض تحته وتُوصَل به */
  error?: string | null;
  /** يُشتقّ منه معرّفُ الرسالة كي يصحّ `aria-describedby` */
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      {/* label يلف الحقل — ارتباط ضمني صحيح لقارئ الشاشة وأدوات الفحص */}
      <label className="block">
        <span className={labelCls}>{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-read text-muted-foreground">{hint}</p>}
      {name && error && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-read font-bold leading-5 text-red-300">{error}</p>
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
  /* ما رُفع عندنا. ولا حقلَ رابطٍ بعد ٢١ أكتوبر ٢٠٢٦ («الصورُ ترفع دائما لا برابط»):
     `form.avatarUrl` يحمل الرابطَ القديمَ عند من كتبه فيُعرض ويُعاد كما هو حتى يرفع غيره */
  const [storedAvatar, setStoredAvatar] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  /* رسالةُ الرفع تسكن عند الزرّ لا عند زرّ الحفظ.
     كانت تُكتب في `err` وحدَه، وهو يُعرض قبل زرّ الحفظ — مئةً وخمسين
     سطرا أسفلَ منتقي الصورة. فكان الرفعُ يسقط، وتُكتب العلّةُ خارجَ
     الشاشة، ويرى صاحبُه زرّا لا يفعل شيئا. */
  const [photoMsg, setPhotoMsg] = useState<{ bad: boolean; text: string } | null>(null);
  /* الملفُّ المختارُ يُعرض في المؤطِّر أوّلا — فالإطارُ قرارُ صاحبه لا قصٌّ من الوسط */
  const [framing, setFraming] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* تحميل الملف: من الخادم عند وجود جلسة حقيقية، وإلا من المخزن المحلي الموسوم */
  /* ═══ ولماذا تعرف هذه الصفحةُ دورَ صاحبها ═══

     هي صفحةٌ واحدةٌ للبوّابات الأربع، ومكتوبةٌ بشكل المتعلّم: تنادي
     `/api/learner/profile` وتسأل عن المؤهّل والجامعة والوظيفة والاهتمامات.
     وتلك حقولُ **قياسٍ** يقرؤها مؤشّرُ وجيز ليوصي بمسار — فمن ليس متعلّما
     لا يُقاس بها. والقرارُ في `application/site/account-fields` فيُفحص.

     والأدوارُ من `fetchMe` لا من نداءٍ ثالث: هي مُخزَّنةٌ مشتركةٌ تُجاب من
     الذاكرة في أغلب الأحيان — وكانت الصفحاتُ تنادي `‎/api/auth/me‎` خمسَ
     مرّاتٍ في الفتحة الواحدة قبل أن تُوحَّد. */
  const [roles, setRoles] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchMe().then((m) => { if (alive) setRoles(m.user?.roles ?? []); }).catch(() => { if (alive) setRoles([]); });
    return () => { alive = false };
  }, []);
  /* ومن إعدادات المؤثّر (`/influencer/account`): بياناتُه وأمانُ حسابه وحدَها — لا أقسامُ المتعلّم ولا بطاقاتُ
     المدرّب، ولو كان حسابُه متعلّما أو مدرّبا أيضا: لكلّ وجهٍ إعداداتُه من بابه (٢٦ أكتوبر ٢٠٢٦) */
  const inInfluencer = portalPrefixFor(useLocation().pathname) === "/influencer";
  const learnerFields = !inInfluencer && showsLearnerFields(roles);
  /* رابطُ البريد «غيّر تفضيلات رسائلك» يحمل `#notifications` — والقسمُ يُرسم بعد تحميل الملفّ، فلا يجده
     المتصفّحُ ساعةَ الفتح. فيُقصد حين يُرسم */
  const { hash } = useLocation();
  useEffect(() => {
    if (mode !== "server" || !learnerFields || hash !== "#notifications") return;
    const t = window.setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(t);
  }, [mode, learnerFields, hash]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<ServerProfile>("/api/learner/profile");
        if (!alive) return;
        setEmail(data.user.email);
        const stored = ((data.profile.avatarUrl as string) ?? "");
        setStoredAvatar(stored.startsWith("/api/") ? stored : "");
        setForm({
          ...EMPTY,
          displayName: data.user.displayName ?? "",
          avatarUrl: ((data.profile.avatarUrl as string) ?? "").startsWith("/api/")
            ? "" : ((data.profile.avatarUrl as string) ?? ""),
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
        if (!(e instanceof ApiError && e.status === 401)) setErr("تعذّر الوصول للخادم — الحفظ محلي مؤقتا");
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
    if (v.length > 40) { setInterestMsg("٤٠ حرفا حدّ الاهتمام الواحد"); return; }
    if (form.interests.includes(v)) { setInterestMsg(`«${v}» مضاف عندك بالفعل`); return; }
    if (form.interests.length >= 12) { setInterestMsg("الحدّ ١٢ اهتماما — احذف واحدا أوّلا"); return; }
    set("interests", [...form.interests, v]);
    setInterestDraft("");
    setInterestMsg("");
  };

  /* ── حدودُ الخادم مقروءةً هنا ──

     الحدودُ في `patchSchema` على الخادم (الاسم ٢–٨٠، الهاتف ٢٤،
     الهدف ٣٠٠، الاهتمامات ١٢). ومن تجاوزها كان يضغط «حفظ» فيرجع بخطأٍ عامّ
     بعد نداءٍ ذهب هدرا. فصارت تُقاس هنا قبل الإرسال، وبالنصِّ الذي يقول
     الحدَّ لا الذي يقول «تعذّر الحفظ». */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  /* الرفعُ ثلاثُ خطوات: تجهيزٌ في المتصفّح يفرض الشروطَ ويُسقط EXIF، ثمّ
     رابطٌ موقّتٌ من الخادم، ثمّ البايتاتُ إليه مباشرةً لا في JSON.

     ومن كان مدرّبا فصورتُه تنتظر اعتمادَ الإدارة قبل صفحته العامّة — يقولها
     الخادمُ في `awaitingApproval`، وتُقال له هنا صراحةً لئلّا ينتظر ظهورا
     لا يأتي. */
  const uploadAvatar = async (blob: Blob) => {
    setErr(""); setSavedMsg(""); setPhotoMsg(null); setPhotoBusy(true);
    try {
      const r = await uploadAccountAvatar(blob);
      setStoredAvatar(r.avatarUrl);
      setFraming(null);
      setForm((f) => ({ ...f, avatarUrl: "" }));
      setPhotoMsg({ bad: false, text: r.awaitingApproval
        ? "رفعت صورتك — وتظهر للعامّة بعد اعتماد الإدارة."
        : "رفعت صورتك." });
    } catch (e) {
      setPhotoMsg({ bad: true, text: e instanceof ImageConditionError || e instanceof AvatarUploadError ? e.message
        : e instanceof ApiError ? e.message : "تعذّر رفع الصورة" });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fieldErrors = useMemo<Record<string, string | null>>(() => {
    const name = form.displayName.trim();
    return {
      displayName: name.length < 2 ? "اسمك حرفان على الأقلّ" : name.length > 80 ? "الاسم أطول من ٨٠ حرفا" : null,
      phone: form.phone.trim().length > 24 ? "الرقم أطول من ٢٤ خانة" : null,
      /* تاريخُ ميلادٍ في المستقبل يُقبله الخادم ويكسر حسابَ العمر في الشهادة */
      birthDate: form.birthDate && form.birthDate > new Date().toISOString().slice(0, 10)
        ? "تاريخ في المستقبل — راجع ما كتبت"
        : null,
      careerGoal: form.careerGoal.trim().length > 300 ? "٣٠٠ حرف حدّ هذا الحقل" : null,
      goalAr: form.goalAr.trim().length > 300 ? "٣٠٠ حرف حدّ هذا الحقل" : null,
    };
  }, [form.displayName, form.phone, form.birthDate, form.careerGoal, form.goalAr]);

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
      /* ما رُفع عندنا لا يمرّ في هذه الحمولة: الحقلُ يفرغ بعد الرفع بقصد،
         فإرسالُ `null` عنه يمحو صورةً لم يطلب أحدٌ محوَها. ولا يُرسل المحوُ
         إلّا إذا لم تكن هناك مرفوعةٌ أصلا — أي أنّ الفراغَ فراغُ صاحبه. */
      ...(form.avatarUrl.trim() || !storedAvatar ? { avatarUrl: form.avatarUrl || null } : {}),
      phone: form.phone || null,
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
        setSavedMsg("حفظت بياناتك");
      } else {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(form));
        setSavedMsg("حفظت محليا — تنقل لحسابك عند الربط");
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
      setSecMsg(`أنهيت ${revoked} جلسة — نحوّلك لتسجيل الدخول من جديد`);
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
      setSecMsg("عطّل حسابك — بياناتك محفوظة، وإعادة التفعيل عبر التواصل معنا");
      window.setTimeout(() => window.location.assign("/"), 2000);
    } catch (e) {
      setSecErr(e instanceof ApiError ? e.message : "تعذر تعطيل الحساب — حاول مجددا");
      setSecBusy("");
      setConfirmingDeactivate(false);
    }
  };

  /* ═══ هيئةُ الصفحة (٢١ أكتوبر ٢٠٢٦) ═══

     قال صاحبُ المنصّة: «ليست احترافيّةً ولا تمثّل أكاديميّةً عريقة.. اجعلها أسهلَ
     وأجمل، والصورُ ترفع دائما لا برابط». فصارت عمودين:
     · **بطاقةُ الهويّة** في الجانب — الصورةُ كبيرةً تُضغط لتُرفع، والاسمُ والبريد.
       وثبتت مع النزول، فما يراه الناسُ عنك أمامك وأنت تكتبه.
     · **الأقسامُ** في المتن، لكلٍّ رأسٌ واحدُ الهيئة (`ui/SectionHead`).
     وزرُّ الحفظ شريطٌ يلحق صاحبَه ما دام في الحقول التي يحفظها، لا زرٌّ يُبحث عنه
     تحت آخرها. وحقلُ رابط الصورة ذهب: الصورةُ تُرفع وتُؤطَّر، والرابطُ القديمُ
     عند من كتبه يبقى معروضا ومحفوظا كما هو حتى يرفع غيره. */
  const photo = storedAvatar || form.avatarUrl;
  const isTrainer = !inInfluencer && !!roles?.includes("trainer");
  const pickPhoto = () => fileRef.current?.click();

  if (mode === "loading") {
    return (
      <PortalFrame title="إعدادات الحساب">
        {/* هيكل تحميل بنفس شكل الصفحة — أهدأ للعين من السبينر */}
        <div aria-busy="true" aria-label="جاري تحميل ملفك" className="grid animate-pulse gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Panel className="flex flex-col items-center gap-3">
            <div className="h-28 w-28 rounded-3xl bg-white/10" />
            <div className="h-5 w-40 rounded-lg bg-white/10" />
            <div className="h-3 w-48 rounded-full bg-white/5" />
            <div className="mt-2 h-9 w-36 rounded-full bg-white/5" />
          </Panel>
          <Panel className="md:p-8">
            <div className="h-5 w-32 rounded-full bg-white/10" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="h-11 rounded-xl bg-white/5 sm:col-span-2" />
              <div className="h-11 rounded-xl bg-white/5" />
              <div className="h-11 rounded-xl bg-white/5" />
              <div className="h-11 rounded-xl bg-white/5" />
              <div className="h-11 rounded-xl bg-white/5" />
            </div>
          </Panel>
        </div>
      </PortalFrame>
    );
  }

  return (
    <PortalFrame title="إعدادات الحساب">
      {mode === "local" && (
        <Inset as="p" tone="warn" className="mb-5 border-dashed px-4 py-2 text-center text-read leading-5 text-gold-ink">
          {"جلسة الخادم غير فعالة — الحفظ محلي مؤقتا."}
        </Inset>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ═══ بطاقة الهويّة — الصورةُ تُضغط لتُرفع ═══ */}
        <aside className="lg:sticky lg:top-24">
          <Panel as="section" tone="solid" aria-label="صورتك وهويتك" className="relative overflow-hidden text-center">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-teal/15 to-transparent" />
            <div className="relative mx-auto mt-2 w-fit">
              <button
                type="button"
                onClick={pickPhoto}
                disabled={photoBusy}
                /* اختصارٌ للفأرة واللمس — والزرُّ المسمّى تحتها هو وقفةُ لوحة المفاتيح وقارئِ الشاشة،
                   فلا يُسمع الفعلُ الواحدُ مرّتين */
                tabIndex={-1}
                aria-hidden="true"
                className="group relative block h-28 w-28 overflow-hidden rounded-3xl shadow-lg shadow-black/10 ring-4 ring-paper transition disabled:cursor-wait"
              >
                {photo ? (
                  <img src={photo} alt="صورتك الشخصية" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-teal to-teal-deep text-4xl font-black text-on-teal">
                    {(form.displayName || "م").charAt(0)}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                  {photoBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                </span>
              </button>
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-1.5 -left-1.5 grid h-9 w-9 place-items-center rounded-full bg-teal text-on-teal shadow ring-4 ring-paper">
                <Camera className="h-4 w-4" />
              </span>
            </div>

            <p className="relative mt-4 text-lg font-black leading-7">{form.displayName || "—"}</p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-read leading-5 text-muted-foreground" dir="ltr">
              <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{email || "—"}</span>
            </p>
            {isTrainer && <Chip tone="accent" className="mt-3">مدرب في وجيز</Chip>}
            {inInfluencer && <Chip tone="accent" className="mt-3">مؤثر في وجيز</Chip>}

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhotoMsg(null); setFraming(f); } }}
            />
            <div className="mt-5 flex justify-center">
              <Button tone="secondary" size="sm" icon={photoBusy ? undefined : ImagePlus} loading={photoBusy} onClick={pickPhoto}>
                {photoBusy ? "جار الرفع…" : photo ? "غيّر الصورة" : "ارفع صورتك"}
              </Button>
            </div>
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              صورة واضحة لوجهك · ٤٠٠ بكسل على الأقل
              <br />
              JPEG أو PNG أو WebP · تظهر في حسابك وشهاداتك
            </p>
            {photoMsg && (
              <p
                role="alert"
                className={`mt-3 text-read leading-5 font-semibold ${photoMsg.bad ? "text-red-300" : "text-teal-light-ink"}`}
              >
                {photoMsg.text}
              </p>
            )}
            {framing && (
              <div className="text-start">
                <ImageFramer
                  file={framing}
                  onDone={uploadAvatar}
                  onCancel={() => {
                    setFraming(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
              </div>
            )}
          </Panel>
        </aside>

        <div className="min-w-0 space-y-6">
          {/* ═══ ما يحفظه «احفظ ملفي» — وشريطُه يلحق صاحبَه ما دام هنا ═══ */}
          <div className="space-y-6">
            <Panel as="section" aria-labelledby="basics-h" className="md:p-8">
              <SectionHead id="basics-h" icon={User} title="بياناتك" desc="اسمك كما يظهر في شهاداتك، وطرق التواصل معك." />
              <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field label="الاسم الكامل *" name="displayName" error={errOf("displayName")} wide>
                  <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} onBlur={touch("displayName")} {...bad("displayName", errOf("displayName"))} className={inputCls} autoComplete="name" />
                </Field>
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
                {/* ثلاثُ قوائمَ لا منتقي المتصفّح: العودةُ إلى سنةِ ميلادٍ فيه
                    تنقّلٌ شهرا شهرا — و`ui/DateField.tsx` يشرح لماذا. */}
                {/* حقلا قياسٍ لا حقلا حساب: يقرؤهما مؤشّرُ وجيز، فمن ليس
                    متعلّما لا يُسأل عنهما (ج-٢). والإخفاءُ لا يمسّ المخزون. */}
                {learnerFields && (<>
                <Field label="تاريخ الميلاد" hint="اختياري — للشهادات والفرص العمرية فقط" name="birthDate" error={errOf("birthDate")}>
                  <DateField
                    value={form.birthDate} onChange={(v) => set("birthDate", v)} onBlur={touch("birthDate")}
                    fromYear={BIRTH_YEAR_FLOOR} toYear={new Date().getFullYear()} yearOrder="desc"
                    selectClassName={inputCls} {...bad("birthDate", errOf("birthDate"))}
                  />
                </Field>
                <Field label="الجنس" hint="اختياري">
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value as ProfileForm["gender"])} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="">أفضّل عدم الذكر</option>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </Field>
                </>)}
                <Field label="اللغة المفضلة للتعلم">
                  <select value={form.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} className={`${inputCls} [&>option]:bg-surface`}>
                    <option value="">اختر</option>
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
              </div>
            </Panel>

            {/* ═══ قسمان يخصّان المتعلّمَ وحدَه (ج-٢) ═══

                التعليمُ والحياةُ المهنيّةُ والاهتماماتُ حقولُ **قياس**: يقرؤها
                مؤشّرُ وجيز ليوصي بمسار. فالمدرّبُ والمديرُ لا يُقاسان بها ولا
                معنى لسؤالهما عنها — وكانت تُعرض لهما لأنّ الصفحةَ واحدةٌ للبوّابات
                الأربع ومكتوبةٌ بشكل المتعلّم.

                وتُخفى ولا تُحذف: من حمل الدورَين يراها، والمخزونُ لا يُمسّ —
                الصفحةُ تحمّل الملفَّ كاملا وتعيده كاملا، فحقلٌ مخفيٌّ يُحفظ كما
                جاء. */}
            {learnerFields && (<>
            <Panel as="section" aria-labelledby="edu-h" className="md:p-8">
              <SectionHead id="edu-h" icon={BookOpen} title="التعليم" />
              <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-3">
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
            </Panel>

            <Panel as="section" aria-labelledby="career-h" className="md:p-8">
              <SectionHead id="career-h" icon={RouteIcon} title="حياتك المهنية وهدفك" />
              <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-3">
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
              <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field label="هدفك المهني" name="careerGoal" error={errOf("careerGoal")}>
                  <textarea rows={2} maxLength={300} value={form.careerGoal} onChange={(e) => set("careerGoal", e.target.value)} onBlur={touch("careerGoal")} {...bad("careerGoal", errOf("careerGoal"))} placeholder="مثال: أن أقود فريق تسويق خلال سنتين" className={`${inputCls} resize-none`} />
                </Field>
                <Field label="هدفك التعلمي" hint="ما تريد إتقانه الآن" name="goalAr" error={errOf("goalAr")}>
                  <textarea rows={2} maxLength={300} value={form.goalAr} onChange={(e) => set("goalAr", e.target.value)} onBlur={touch("goalAr")} {...bad("goalAr", errOf("goalAr"))} className={`${inputCls} resize-none`} />
                </Field>
              </div>
              <div className="mt-5">
                <label className="block">
                  <span className={labelCls}>اهتماماتك</span>
                  <span className="flex items-center gap-2">
                    <input
                      value={interestDraft}
                      onChange={(e) => { setInterestDraft(e.target.value); setInterestMsg(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterest(); } }}
                      placeholder="اكتب اهتماما ثم Enter — حتى 12"
                      className={inputCls}
                    />
                    <Button tone="secondary" type="button" onClick={addInterest} className="shrink-0">
                      أضف
                    </Button>
                  </span>
                </label>
                {interestMsg && (
                  <p role="alert" className="mt-1.5 text-read font-bold leading-5 text-red-300">{interestMsg}</p>
                )}
                {form.interests.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {form.interests.map((i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-fine font-bold text-teal-light-ink">
                        {i}
                        <Button tone="ghost" type="button" aria-label={`أزل ${i}`} onClick={() => set("interests", form.interests.filter((x) => x !== i))} className="grid h-8 w-8 shrink-0 place-items-center">
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
            </>)}

            {/* ═══ والحفظُ للأدوار كلِّها (٣٠ سبتمبر ٢٠٢٦) ═══
                كان الزرُّ داخلَ كتلة المتعلّم (ج-٢) فخرج معها: المدرّبُ يرى اسمَه
                وهاتفَه ودولتَه قابلةً للكتابة ولا زرَّ يحفظها. والحقولُ المشتركةُ
                للجميع، فزرُّها للجميع. */}
            <div className="sticky bottom-4 z-10">
              <Card tone="solid" className="flex flex-wrap items-center justify-between gap-3 py-3.5 shadow-xl shadow-black/10">
                <div className="min-w-0 flex-1 text-read leading-5">
                  {err ? <p role="alert" className="font-semibold text-red-300">{err}</p>
                    : savedMsg ? <p role="status" className="font-bold text-teal-light-ink">{savedMsg}</p>
                    : <p className="text-muted-foreground">احفظ بعد أي تعديل في بياناتك.</p>}
                </div>
                {/* الزرُّ لا يُطفأ على حقلٍ مرفوض: كان مطفأً والسببُ في حقلٍ قد يكون
                    خارج الشاشة، فتبقى الضغطةُ بلا جواب. فصار يُضغط، ويُظهر الرفضَ
                    عند حقله، ولا يُرسل نداءً يعرف أنّه مردود. */}
                <Button tone="primary" onClick={save} disabled={busy} className="shrink-0">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  احفظ ملفي
                </Button>
              </Card>
            </div>
          </div>

          {/* ═══ وللمدرّب: عنوانُه ونبذتُه في «المدربون» (٣ أكتوبر ٢٠٢٦) ═══
              بعد بياناته لا بين الصورة والحفظ: لهما زرُّ إرسالٍ للاعتماد غيرُ «احفظ ملفي»،
              فلا يجاور قسمٌ يُحفظ قسما يُرسَل. والعلّةُ في `PublicTextCard`. */}
          {mode === "server" && isTrainer && <PublicTextCard inputCls={inputCls} />}
          {/* واقتراحاتُنا لبطاقته تحتهما: «لماذا نفتخر بك» يعدّله، ونبذتُه بصياغتنا «قبل/بعد» (١٩ أكتوبر ٢٠٢٦) */}
          {mode === "server" && isTrainer && <ProfileSuggestions inputCls={inputCls} />}

          {learnerFields && (<>
          {/* روابط بقية أقسام الملف */}
          <Panel as="section" aria-labelledby="more-h" className="md:p-8">
            <SectionHead id="more-h" icon={FileText} title="بقية ملفك" />
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {[
                /* بأسمائها في الشريط (١٩ أكتوبر ٢٠٢٦): كانت «مساراتي وتقدمي» و«دوراتي وجلساتي» — ولا قسمَ بهذين الاسمين */
                { to: "/student", icon: RouteIcon, t: "الرئيسية", d: "مسارك النشط ونسبة إنجازه" },
                { to: "/student/learning", icon: BookOpen, t: "رحلتي", d: "دوراتك ومواعيدها" },
                { to: "/student/certificates", icon: Award, t: "شهاداتي", d: "شهاداتك وروابط التحقق" },
                { to: "/student/billing", icon: FileText, t: "فواتيري وطلباتي", d: "فواتيرك ودفعاتك" },
                { to: "/student/cv", icon: FileText, t: "سيرتي الذاتية", d: "رفع بموافقة صريحة وحذف موثق" },
                { to: "/diagnostic", icon: MessageCircle, t: "نتائج تشخيصي", d: "آخر نتيجة وتقريرك" },
              ].map((x) => (
                <Card as={Link} tone="accent" interactive key={x.t} to={x.to} className="group flex items-start gap-3">
                  <x.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{x.t}</span>
                    <span className="mt-1 block text-read leading-relaxed text-muted-foreground">{x.d}</span>
                  </span>
                  <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5" aria-hidden="true" />
                </Card>
              ))}
            </div>
          </Panel>

          {/* بيانات الفوترة والطلبات */}
          <Panel as="section" aria-labelledby="billing-h" className="md:p-8">
            <SectionHead id="billing-h" icon={Lock} title="الفوترة والطلبات" desc={<>
              فواتيرك ودفعاتك في{" "}
              <Link to="/student/billing" className="font-bold text-teal-light-ink underline-offset-4 hover:underline">فواتيري</Link>.
              وللاسترداد أو مراجعة فاتورة: <Link to="/student/support?topic=refund" className="font-bold text-teal-light-ink underline-offset-4 hover:underline">افتح تذكرة دعم</Link>.
            </>} />
          </Panel>
          </>)}

          {/* ═══ ما يصلني من رسائل (٢٠ أكتوبر ٢٠٢٦) ═══
              كان في ذيل «إشعاراتي» — صفحةٌ بلا بندٍ في القائمة صارت «الرسائل والتنبيهات». والتفضيلُ إعدادٌ
              من إعدادات حسابه فموضعُه هنا، وإليه يقود رابطُ «غيّر تفضيلات رسائلك» في البريد
              (`#notifications`). وللمتعلّم وحدَه: أصنافُه أصنافُ المتعلّم (`learner-categories.ts`). */}
          {learnerFields && mode === "server" && (
            <div id="notifications" className="scroll-mt-24">
              <NotificationPreferences />
            </div>
          )}

          {/* الأمان والجلسات — إجراءات حقيقية على الخادم، تظهر فقط مع جلسة فعالة */}
          {mode === "server" && (
            <Panel as="section" aria-labelledby="security-h" className="md:p-8">
              <SectionHead id="security-h" icon={ShieldAlert} title="الأمان والجلسات" />

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">الخروج من كل الأجهزة</p>
                    <p className="mt-1 text-read leading-6 text-muted-foreground">
                      ينهي كل جلساتك — وتدخل من جديد هنا أيضا.
                    </p>
                  </div>
                  <Button tone="secondary" type="button" onClick={logoutAll} disabled={!!secBusy} className="shrink-0">
                    {secBusy === "logoutAll" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                    إنهاء كل الجلسات
                  </Button>
                </div>

                {/* ═══ كلمةُ المرور (٣٠ سبتمبر ٢٠٢٦) ═══
                    قائمةُ الحساب تَعِد بها («الاسم وكلمة المرور والجلسات») ولم يكن
                    في الصفحة سطرٌ عنها. والتغييرُ يمرّ برابطٍ إلى البريد نفسِه —
                    مسارُ الاستعادة القائم — فلا تُغيَّر كلمةٌ من جهازٍ تُرك مفتوحا. */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">كلمة المرور</p>
                    <p className="mt-1 text-read leading-6 text-muted-foreground">
                      نرسل إلى بريدك رابطا تختار منه كلمة جديدة.
                    </p>
                  </div>
                  <Button tone="secondary" type="button" disabled={!!secBusy || !email} className="shrink-0"
                    onClick={async () => {
                      setSecErr(""); setSecMsg("");
                      try {
                        await apiPost("/api/auth/password/forgot", { email });
                        setSecMsg(`أرسلنا رابط تغيير كلمة المرور إلى ${email}`);
                      } catch (e) {
                        setSecErr(e instanceof ApiError ? e.message : "تعذّر الإرسال — حاول بعد قليل");
                      }
                    }}>
                    <KeyRound className="h-3.5 w-3.5" />
                    أرسل رابط تغييرها
                  </Button>
                </div>

                <div className="pt-5">
                  <Card tone="danger">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-red-300">تعطيل الحساب</p>
                        <p className="mt-1 text-read leading-6 text-muted-foreground">
                          يوقف حسابك وجلساتك فورا. بياناتك وتقدمك محفوظة، ويعاد التفعيل بالتواصل معنا.
                        </p>
                      </div>
                      {!confirmingDeactivate ? (
                        <Button tone="danger" type="button" onClick={() => setConfirmingDeactivate(true)} disabled={!!secBusy} className="shrink-0">
                          تعطيل حسابي
                        </Button>
                      ) : (
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className="text-fine font-bold text-red-300">متأكد؟ الإجراء فوري</span>
                          <Button tone="ghost" type="button" onClick={deactivate} disabled={!!secBusy} className="bg-red-500 text-white disabled:cursor-not-allowed">
                            {secBusy === "deactivate" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            نعم، عطّل حسابي
                          </Button>
                          <Button tone="secondary" type="button" onClick={() => setConfirmingDeactivate(false)} disabled={!!secBusy}>
                            تراجع
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>

              {secErr && <Inset as="p" tone="danger" role="alert" className="mt-4 px-4 py-2.5 text-read leading-5 font-semibold text-red-300">{secErr}</Inset>}
              {secMsg && <Inset as="p" tone="accent" role="status" className="mt-4 px-4 py-2.5 text-read leading-5 font-bold text-teal-light-ink">{secMsg}</Inset>}
            </Panel>
          )}
        </div>
      </div>
    </PortalFrame>
  );
}
