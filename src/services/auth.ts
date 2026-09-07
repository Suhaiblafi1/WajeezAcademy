/* ─────────── خدمة المصادقة — مربوطة بخادم API الحقيقي ───────────
   الجلسة الحقيقية كوكي httpOnly يصدرها الخادم (POST /api/auth/login).
   نحتفظ محليا بنسخة عرض خفيفة (الاسم/البريد/الأدوار/الانتهاء) في localStorage
   لغرض واحد: إظهار اسم المستخدم وتوجيهه لبوابته دون انتظار — وهي ليست دليل
   دخول؛ كل مسار محمي يتحقق من الكوكي عند الخادم.
   مبادئ ثابتة:
   - خطأ الدخول عام ولا يكشف وجود الحساب (رسالة الخادم نفسها عامة).
   - القفل بعد المحاولات الفاشلة يفرضه الخادم (15 دقيقة) + تلميح محلي.
   - تسجيل الخروج يبطل الجلسة عند الخادم ثم يمسح النسخة المحلية. */

import { ApiError, apiGet, apiPost } from "./api";
import { syncPendingPlan } from "@/application/plan/adopted-plan";
import { HONEYPOT_FIELD } from "../components/HoneypotField";
import { safeGet, safeSet, safeRemove } from "./safe-storage";

export const OAUTH_READY = false; // أزرار قوقل ولينكدإن مخفية حتى يكتمل ربط OAuth الحقيقي

const USER_KEY = "wajeez_user";
const LOCK_KEY = "wajeez_auth_lock";

export interface Session {
  name: string;
  email: string;
  roles: string[];
  at: number;
  exp: number;
}

/** هوية الجلسة كما يعيدها الخادم */
interface ServerUser {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

/* ─────────── التوجيه حسب الدور — كل دور إلى بوابته ─────────── */

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin",
  academic_manager: "/admin",
  academic_coordinator: "/admin",
  diagnostic_manager: "/admin",
  operations_manager: "/admin",
  finance: "/admin",
  support: "/admin",
  advisor: "/advisor",
  trainer: "/trainer",
  /* متقدّمٌ للتدريب: لا بوّابةَ متعلّم ولا مدرّب — صفحةُ حالة طلبه */
  trainer_applicant: "/join-trainer/status",
};

/** مسار البوابة الأنسب لأقوى دور يحمله المستخدم — الافتراضي بوابة المتعلم.
   الأولوية بترتيب ROLE_HOME: أدوار الإدارة أولا، ثم المستشار، ثم المدرب */
export function homePathForRoles(roles: string[]): string {
  for (const role of Object.keys(ROLE_HOME)) {
    if (roles.includes(role)) return ROLE_HOME[role];
  }
  return "/student";
}

/* ─────────── نسخة العرض المحلية (للعرض فقط — ليست دليل دخول) ─────────── */

function writeSession(name: string, email: string, roles: string[], expiresAt?: string): void {
  const exp = expiresAt ? Date.parse(expiresAt) : Date.now() + 30 * 864e5;
  const s: Session = { name, email, roles, at: Date.now(), exp };
  safeSet(USER_KEY, JSON.stringify(s));
}

export function readSession(): Session | null {
  const raw = safeGet(USER_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.exp === "number" && Date.now() > s.exp) {
      safeRemove(USER_KEY);
      return null;
    }
    return {
      name: s.name ?? "متعلم وجيز",
      email: s.email ?? "",
      roles: Array.isArray(s.roles) ? s.roles : [],
      at: s.at ?? 0,
      exp: s.exp ?? 0,
    };
  } catch {
    safeRemove(USER_KEY);
    return null;
  }
}

export function readUserName(): string | null {
  return readSession()?.name ?? null;
}

/** أدوار نسخة العرض — لاختيار وجهة التنقل بعد الدخول */
export function readRoles(): string[] {
  return readSession()?.roles ?? [];
}

/** جوابُ الخادم عن «من أنت؟» — بثلاث حالات لا حالتين.

    كان `refreshSession` يعيد `Session | null`، ويسقط عند فشل الشبكة إلى
    النسخة المحلّية: `catch { return readSession() }`. وحارسُ الصلاحيات
    (`RequireRole`) يبني قرارَه على ما تعيده — فصار قرارُ صلاحيةٍ يُتّخذ على
    نسخةٍ في `localStorage` كلّما تعذّر النداء، وتعليقُ الحارس نفسِه يقول إنّه
    «يتحقق عند الخادم وليس من التخزين المحلي».

    وأثرُه في الاتّجاهين:

    · **نسخةٌ أقدم من الحقيقة** — حسابٌ صار `super_admin` بعد آخر مرّة كُتبت
      فيها النسخة (أو نسخةٌ من متصفّحٍ آخر) يهبط إلى بوابة المتعلّم. وهو ما
      يشكوه صاحب المنصّة: «أحيانا يأخذني لمنصّة طالب علما أني سوبر فقط».
    · **نسخةٌ أوسع من الحقيقة** — من سُحبت أدوارُه يمرّ الحارسَ ما دامت
      نسختُه في متصفّحه. وهذه أخطرُ، ولم تكن في الشكوى.

    فصارت الحالاتُ ثلاثا: `ok` و`anon` و`unreachable` — والثالثةُ **ليست
    جوابا**، فلا يُبنى عليها قرارُ صلاحية. والنسخةُ المحلّية لا تُقرأ هنا
    إطلاقا؛ موضعُها عرضُ الاسم لا فتحُ الباب. */
export type SessionCheck =
  | { status: "ok"; session: Session }
  | { status: "anon" }
  | { status: "unreachable" };

export async function verifySession(): Promise<SessionCheck> {
  try {
    const { user } = await apiGet<{ user: ServerUser | null }>("/api/auth/me");
    if (!user) {
      safeRemove(USER_KEY);
      return { status: "anon" };
    }
    writeSession(user.displayName, user.email, user.roles);
    const session = readSession();
    /* التخزينُ قد يكون ممنوعا (تصفّحٌ خاصّ) فتعود القراءةُ فارغة — والجوابُ
       من الخادم صحيحٌ على كلّ حال، فيُبنى منه لا من المخزَّن. */
    return {
      status: "ok",
      session: session ?? {
        name: user.displayName, email: user.email, roles: user.roles,
        at: Date.now(), exp: Date.now() + 30 * 864e5,
      },
    };
  } catch (e) {
    /* ٤٠١ جوابٌ صريح: لا جلسة. وما عداه تعذُّرُ وصولٍ لا جواب. */
    if (e instanceof ApiError && e.status === 401) {
      safeRemove(USER_KEY);
      return { status: "anon" };
    }
    return { status: "unreachable" };
  }
}

/* ─────────── قفل المحاولات (تلميح محلي — القفل الحقيقي عند الخادم) ─────────── */

interface LockState {
  fails: number;
  until: number;
}

const MAX_FAILS = 5;
const LOCK_MINUTES = 10;

function readLock(): LockState {
  try {
    return JSON.parse(safeGet(LOCK_KEY) ?? '{"fails":0,"until":0}') as LockState;
  } catch {
    return { fails: 0, until: 0 };
  }
}

/** دقائق القفل المتبقية — صفر يعني لا قفل */
export function lockedMinutes(): number {
  const { until } = readLock();
  const left = until - Date.now();
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

function recordFail(): void {
  const l = readLock();
  const fails = l.fails + 1;
  const until = fails >= MAX_FAILS ? Date.now() + LOCK_MINUTES * 60000 : 0;
  safeSet(LOCK_KEY, JSON.stringify({ fails: until ? 0 : fails, until }));
}

function clearFails(): void {
  safeRemove(LOCK_KEY);
}

/* ─────────── العمليات ─────────── */

export type AuthResult =
  /** `verificationSent` يقول هل خرجت رسالةُ التوثيق فعلا — وبها وحدَها تُعرض
      شاشةُ «تفقّد بريدك». وبدونها كانت تُعرض لكلّ من سجّل، فينتهي أوّلُ لقاءٍ
      لكلّ مستخدمٍ جديدٍ بانتظارِ رسالةٍ لن تصل. */
  | { ok: true; verificationSent?: boolean }
  | { ok: false; error: string };

const NETWORK_FAIL = "تعذر الاتصال بالخادم — تأكد أن خادم API يعمل ثم حاول مجددا";

function toMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message; // رسالة الخادم العربية جاهزة وآمنة
  return NETWORK_FAIL;
}

/** إنشاء حساب متعلم ثم دخوله مباشرة — الدور الافتراضي learner (لا تصعيد ذاتي) */
export async function signUp(
  name: string,
  email: string,
  pass: string,
  /* حقلُ الفخّ — يبقى فارغا عند الإنسان، ويردُّه الخادمُ إن جاء مملوءا */
  honeypot?: string,
): Promise<AuthResult> {
  let verificationSent = false;
  try {
    const res = await apiPost<{ verificationSent?: boolean }>("/api/auth/register", {
      email: email.trim().toLowerCase(),
      password: pass,
      displayName: name.trim(),
      ...(honeypot ? { [HONEYPOT_FIELD]: honeypot } : {}),
    });
    verificationSent = res?.verificationSent === true;
  } catch (e) {
    if (e instanceof ApiError && e.code === "email_taken") {
      return { ok: false, error: "لديك حساب بهذا البريد بالفعل — انتقل لتبويب «دخول»" };
    }
    return { ok: false, error: toMessage(e) };
  }
  // ندخل المستخدم فورا ليحفظ تشخيصه ومساره دون خطوة إضافية
  const login = await signIn(email, pass);
  return login.ok ? { ok: true, verificationSent } : login;
}

export async function signIn(email: string, pass: string): Promise<AuthResult> {
  if (lockedMinutes() > 0) {
    return { ok: false, error: `محاولات كثيرة — انتظر ${lockedMinutes()} دقائق ثم حاول مجددا` };
  }
  try {
    const { user, expiresAt } = await apiPost<{ user: ServerUser; expiresAt: string }>(
      "/api/auth/login",
      { email: email.trim().toLowerCase(), password: pass },
    );
    writeSession(user.displayName, user.email, user.roles, expiresAt);
    clearFails();
    /* الخطّةُ المعتمَدةُ قبل الحساب تُرفَع الآن — أوّلُ لحظةٍ يصير لها فيها بيت.
       ولا يُنتظَر ناتجُها ولا يُسقط الدخول: الرفعُ أفضلُ جهد، والمحلّيّةُ تبقى. */
    void syncPendingPlan().catch(() => undefined);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 429)) recordFail();
    return { ok: false, error: toMessage(e) };
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiPost("/api/auth/logout");
  } catch {
    // حتى لو تعذر النداء نمسح نسخة العرض — الكوكي منتهي الصلاحية عند الخادم
  }
  safeRemove(USER_KEY);
}

/** مسح نسخة العرض المحلية دون نداء خادم — تُستخدم بعد logout-all / deactivate
   اللذين أبطلا الجلسات عند الخادم أصلا */
export function clearLocalSession(): void {
  safeRemove(USER_KEY);
}

/** طلب استعادة كلمة المرور — رسالة الخادم آمنة ولا تكشف وجود الحساب */
export async function requestPasswordReset(
  email: string,
  honeypot?: string,
): Promise<{ message: string; devToken?: string }> {
  try {
    return await apiPost<{ message: string; devToken?: string }>("/api/auth/password/forgot", {
      email: email.trim().toLowerCase(),
      ...(honeypot ? { [HONEYPOT_FIELD]: honeypot } : {}),
    });
  } catch (e) {
    return { message: e instanceof ApiError ? e.message : NETWORK_FAIL };
  }
}

/** تعيين كلمة مرور جديدة برمز الاستعادة — يبطل الخادم كل الجلسات */
export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
  try {
    return await apiPost<{ ok: boolean; message: string }>("/api/auth/password/reset", { token: token.trim(), newPassword });
  } catch (e) {
    return { ok: false, message: e instanceof ApiError ? e.message : NETWORK_FAIL };
  }
}

/** إعادة إرسال رسالة التحقق — لا قناة بريد بعد في مرحلة التأسيس */
/** إعادةُ إرسال رابط التوثيق — نداءٌ حقيقيٌّ يردّ رسالةَ الخادم كما هي.

    كانت هذه الدالّةُ **لا تفعل شيئا** (`void email`)، والشاشةُ تقول بعدها
    «أُعيد إرسال الرسالة — تفقّد بريدك». فالوعدُ يُقطع مرّتين: رسالةٌ لم
    تُطلَب أصلا، وتأكيدٌ بأنّها أُرسلت.

    والمسارُ موجودٌ في الخادم منذ البداية (`/api/auth/email/verify/request`)
    ويردّ الحالةَ صادقةً: أُرسلت · أو القناةُ غيرُ مفعّلة · أو أخفق. */
export async function resendVerification(): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await apiPost<{ status: string; message: string }>("/api/auth/email/verify/request");
    return { ok: r.status === "sent" || r.status === "already_verified", message: r.message };
  } catch (e) {
    return { ok: false, message: toMessage(e) };
  }
}
