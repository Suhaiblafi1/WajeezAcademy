/* ─────────── خدمة المصادقة (واجهة تجريبية جاهزة للربط) ───────────
   اليوم: مخزن محلي يحاكي الخادم. عند النقل إلى Replit تُستبدل دوال
   signUp/signIn/resetPassword بنداءات API حقيقية دون تغيير الواجهة.
   مبادئ ثابتة حتى في النسخة التجريبية:
   - خطأ الدخول عام ولا يكشف وجود الحساب.
   - قفل مؤقت بعد خمس محاولات فاشلة.
   - جلسة بمدة انتهاء، وتسجيل خروج يمسحها كاملة.
   - كلمات المرور هنا بصيغة مبسطة للعرض فقط — في الإنتاج تُجزّأ في الخادم. */

export const OAUTH_READY = false; // أزرار قوقل ولينكدإن مخفية حتى يكتمل ربط OAuth الحقيقي

const USER_KEY = "wajeez_user";
const ACCOUNTS_KEY = "wajeez_accounts";
const LOCK_KEY = "wajeez_auth_lock";
const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MINUTES = 10;

export interface Session {
  name: string;
  email: string;
  at: number;
  exp: number;
}

interface Account {
  name: string;
  email: string;
  pass: string;
  verified: boolean;
}

function readAccounts(): Account[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Account[];
  } catch {
    return [];
  }
}

function writeAccounts(list: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

/* ─────────── الجلسة ─────────── */

export function readSession(): Session | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.exp === "number") {
      if (Date.now() > s.exp) {
        signOut();
        return null;
      }
      return { name: s.name ?? "متعلم وجيز", email: s.email ?? "", at: s.at ?? 0, exp: s.exp };
    }
    // صيغة قديمة بلا انتهاء — نمنحها جلسة جديدة المدة
    const legacy = { name: s.name ?? String(raw), email: s.email ?? "", at: Date.now(), exp: Date.now() + SESSION_DAYS * 864e5 };
    localStorage.setItem(USER_KEY, JSON.stringify(legacy));
    return legacy;
  } catch {
    return { name: raw, email: "", at: Date.now(), exp: Date.now() + SESSION_DAYS * 864e5 };
  }
}

export function readUserName(): string | null {
  return readSession()?.name ?? null;
}

function writeSession(name: string, email: string): void {
  const s: Session = { name, email, at: Date.now(), exp: Date.now() + SESSION_DAYS * 864e5 };
  localStorage.setItem(USER_KEY, JSON.stringify(s));
}

export function signOut(): void {
  localStorage.removeItem(USER_KEY);
}

/* ─────────── قفل المحاولات ─────────── */

interface LockState {
  fails: number;
  until: number;
}

function readLock(): LockState {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{"fails":0,"until":0}') as LockState;
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
  localStorage.setItem(LOCK_KEY, JSON.stringify({ fails: until ? 0 : fails, until }));
}

function clearFails(): void {
  localStorage.removeItem(LOCK_KEY);
}

/* ─────────── العمليات ─────────── */

export type AuthResult = { ok: true } | { ok: false; error: string };

export function signUp(name: string, email: string, pass: string): AuthResult {
  const accounts = readAccounts();
  const norm = email.trim().toLowerCase();
  if (accounts.some((a) => a.email === norm)) {
    return { ok: false, error: "لديك حساب بهذا البريد بالفعل — انتقل لتبويب «دخول»" };
  }
  accounts.push({ name: name.trim(), email: norm, pass, verified: false });
  writeAccounts(accounts);
  writeSession(name.trim(), norm);
  clearFails();
  return { ok: true };
}

export function signIn(email: string, pass: string): AuthResult {
  if (lockedMinutes() > 0) {
    return { ok: false, error: `محاولات كثيرة — انتظر ${lockedMinutes()} دقائق ثم حاول مجددا` };
  }
  const norm = email.trim().toLowerCase();
  const acc = readAccounts().find((a) => a.email === norm);
  if (!acc || acc.pass !== pass) {
    recordFail();
    // رسالة عامة لا تكشف هل البريد مسجل أم لا
    return { ok: false, error: "بيانات الدخول غير صحيحة — تأكد من البريد وكلمة المرور" };
  }
  writeSession(acc.name, acc.email);
  clearFails();
  return { ok: true };
}

/** طلب استعادة كلمة المرور — ينجح ظاهريا دائما حتى لا يكشف وجود الحساب */
export function requestPasswordReset(email: string): string {
  void email;
  return "إن كان هذا البريد مسجلا لدينا فستصله رسالة استعادة خلال دقائق";
}

/** إعادة إرسال رسالة التحقق — تجريبية، تعيد تأكيد الإرسال فقط */
export function resendVerification(email: string): void {
  void email; // في الإنتاج: POST /auth/resend-verification
}

export function markVerified(email: string): void {
  const accounts = readAccounts();
  const acc = accounts.find((a) => a.email === email.trim().toLowerCase());
  if (acc) {
    acc.verified = true;
    writeAccounts(accounts);
  }
}
