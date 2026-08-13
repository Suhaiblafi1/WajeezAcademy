import { useState } from "react";
import { Linkedin, Lock, UserRound } from "lucide-react";

/** بوابة التسجيل/الدخول — تسجيل دخول تجريبي يُحفظ في localStorage */
export default function AuthGate({ onDone, message }: { onDone: () => void; message?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (name.trim().length < 2) return setErr("أدخل اسم مستخدم صحيحًا");
    if (pass.length < 4) return setErr("كلمة المرور ٤ أحرف على الأقل");
    localStorage.setItem("wajeez_user", JSON.stringify({ name: name.trim(), at: Date.now() }));
    onDone();
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[#151515] p-8">
      <div className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-white">
        <Lock className="h-6 w-6 text-[#38A7B4]" />
        {mode === "signup" ? "أنشئ حسابك" : "تسجيل الدخول"}
      </div>
      <p className="mb-6 text-center text-sm text-white/55">
        {message ?? "سجّل ليُحفظ مسارك وتشخيصك في حسابك"}
      </p>
      <div className="space-y-3">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/80 transition hover:bg-white/10"
          onClick={() => {
            localStorage.setItem("wajeez_user", JSON.stringify({ name: "ضيف Google", at: Date.now() }));
            onDone();
          }}
        >
          <span className="font-bold text-[#FABC05]">G</span> المتابعة عبر Google
        </button>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/80 transition hover:bg-white/10"
          onClick={() => {
            localStorage.setItem("wajeez_user", JSON.stringify({ name: "ضيف LinkedIn", at: Date.now() }));
            onDone();
          }}
        >
          <Linkedin className="h-4 w-4 text-[#0A66C2]" /> المتابعة عبر LinkedIn
        </button>
        <div className="flex items-center gap-3 text-xs text-white/35">
          <span className="h-px flex-1 bg-white/10" /> أو <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="relative">
          <UserRound className="absolute right-3 top-3 h-4 w-4 text-white/35" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المستخدم"
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
          />
        </div>
        <div className="relative">
          <Lock className="absolute right-3 top-3 h-4 w-4 text-white/35" />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
          />
        </div>
        {err && <p className="text-center text-xs text-red-400">{err}</p>}
        <button
          onClick={submit}
          className="w-full rounded-xl bg-[#38A7B4] py-3 font-semibold text-[#0D0D0D] transition hover:bg-[#6EC7D1]"
        >
          {mode === "signup" ? "إنشاء الحساب والمتابعة" : "دخول"}
        </button>
        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="w-full text-center text-xs text-white/50 hover:text-white/80"
        >
          {mode === "signup" ? "لديك حساب؟ سجّل الدخول" : "جديد هنا؟ أنشئ حسابًا"}
        </button>
      </div>
    </div>
  );
}
