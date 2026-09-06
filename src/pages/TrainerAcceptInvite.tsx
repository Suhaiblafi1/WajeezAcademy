import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, ApiError } from "@/services/api";

import Button from "@/components/ui/Button";
const inputCls =
  "w-full rounded-xl border border-white/15 bg-paper/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

/** قبول دعوة المدرب — إنشاء الحساب عبر الرمز الآمن الذي أرسلته الإدارة بعد الاعتماد والعقد */
export default function TrainerAcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const valid = token.length >= 10 && password.length >= 8 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      await apiPost("/api/v1/trainer-invitations/consume", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تفعيل الحساب — الرابط قد يكون منتهيا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteShell>
      <SeoHead title="تفعيل حساب المدرب" description="إنشاء حساب المدرب عبر الدعوة الآمنة" path="/trainer/accept-invite" />
      <div className="mx-auto max-w-md py-14">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal/15">
          <KeyRound className="h-7 w-7 text-teal-light-ink" />
        </span>
        {done ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-teal-light-ink" />
            <h1 className="mt-4 text-2xl font-black">حسابك جاهز — أهلا بك مدربا في وجيز</h1>
            <p className="mt-3 text-sm leading-8 text-muted-foreground">سجّل الدخول الآن لتجد بوابتك ومهام تهيئتك.</p>
            <Link to="/auth" className="mt-6 inline-block rounded-full bg-gold px-7 py-3 font-black text-on-gold transition hover:bg-gold/90">
              تسجيل الدخول
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-center text-2xl font-black">تفعيل حسابك التدريبي</h1>
            <p className="mt-3 text-center text-sm leading-8 text-muted-foreground">
              هذه الدعوة صالحة ٧٢ ساعة وتُستخدم مرة واحدة. اختر كلمة مرورك لإنشاء الحساب.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div>
                <label htmlFor="ti-password" className="mb-1.5 block text-xs font-bold text-muted-foreground">كلمة المرور * — ٨ أحرف على الأقل</label>
                <input
                  id="ti-password" name="new-password" type={showPw ? "text" : "password"} autoComplete="new-password"
                  required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className={inputCls} dir="ltr"
                />
              </div>
              <div>
                <label htmlFor="ti-confirm" className="mb-1.5 block text-xs font-bold text-muted-foreground">تأكيد كلمة المرور *</label>
                <input
                  id="ti-confirm" name="confirm-password" type={showPw ? "text" : "password"} autoComplete="new-password"
                  required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls} dir="ltr"
                />
                {confirm && password !== confirm && <p className="mt-1.5 text-micro text-red-300">كلمتا المرور غير متطابقتين</p>}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="h-4 w-4 accent-teal" />
                إظهار كلمة المرور
              </label>
              {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200" role="alert">{error}</p>}
              <Button tone="primary" type="submit" disabled={!valid || busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                فعّل حسابي
              </Button>
            </form>
          </>
        )}
      </div>
    </SiteShell>
  );
}
