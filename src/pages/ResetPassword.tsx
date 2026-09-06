/* تعيين كلمة مرور جديدة (١هـ) — الصفحة التي يفتحها رابط رسالة الاستعادة.

   وُجدت لأن الرسالة صارت تُرسل فعلا: قبلها كان الرمز يُولَّد ويُسقَط، فلم يكن
   للصفحة ما تستقبله. ورابطٌ في بريد يفتح على صفحة غير موجودة أسوأ من لا رسالة. */

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, permissionMessage } from "@/services/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = token !== "" && password.length >= 8 && confirm === password && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/auth/password/reset", { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(permissionMessage(err, "تعذّر تعيين كلمة المرور."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteShell>
      <SeoHead title="تعيين كلمة مرور جديدة" description="تعيين كلمة مرور جديدة لحسابك في أكاديمية وجيز." path="/auth/reset" noindex />
      <div className="mx-auto max-w-md px-5 py-16">
        {done ? (
          <div className="text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-5 text-2xl font-black">عُيّنت كلمة المرور</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              أُخرجت من كل الأجهزة — سجّل الدخول بكلمتك الجديدة.
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="mt-8 cursor-pointer rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light"
            >
              تسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            <KeyRound className="h-10 w-10 text-[#FABC05]" />
            <h1 className="mt-4 text-2xl font-black">كلمة مرور جديدة</h1>
            {!token && (
              <p className="mt-3 rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 px-4 py-3 text-xs leading-6 text-muted-foreground">
                الرابط بلا رمز — افتحه من رسالة الاستعادة كما وصلتك، أو اطلب رسالة جديدة.
              </p>
            )}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-muted-foreground">كلمة المرور الجديدة</span>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" required
                  className="w-full rounded-2xl border border-white/10 bg-paper/20 px-4 py-3 text-sm outline-none focus:border-teal/60"
                />
                {tooShort && <span className="mt-1.5 block text-[11px] text-[#FABC05]">٨ أحرف على الأقل</span>}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-muted-foreground">أعدها للتأكيد</span>
                <input
                  type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password" required
                  className="w-full rounded-2xl border border-white/10 bg-paper/20 px-4 py-3 text-sm outline-none focus:border-teal/60"
                />
                {mismatch && <span className="mt-1.5 block text-[11px] text-[#FABC05]">الكلمتان غير متطابقتين</span>}
              </label>
              {error && (
                <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-xs leading-6 text-red-200">
                  {error}
                </p>
              )}
              <button
                type="submit" disabled={!ready}
                className="w-full cursor-pointer rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "يُعيَّن…" : "تعيين كلمة المرور"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                تعيين كلمة جديدة يُخرجك من كل الأجهزة. · <Link to="/auth" className="text-teal-light-ink hover:underline">تسجيل الدخول</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </SiteShell>
  );
}
