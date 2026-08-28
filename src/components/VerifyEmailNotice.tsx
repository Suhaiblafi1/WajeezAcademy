/* شريط توثيق البريد (١هـ).

   قاعدتان تحكمانه:
   ١) لا يظهر لمن وثّق بريده — شريطٌ دائم يُقرأ ديكورا فيُتجاوَز حين يهمّ.
   ٢) يقول ما يُحجب بالضبط: «وثّق بريدك» وحدها تبدو تعقيدا بلا سبب. أمّا
      «الشراء والشهادة موقوفان حتى تُوثّقه» فسببٌ يُقنع ويُتصرّف عليه.

   ولا يَعِد بما لا يقع: حين تكون قناة البريد غير مفعّلة يقول ذلك صراحةً بدل
   «أُرسلت الرسالة» التي تُبقي المستخدم ينتظر ما لن يصل. */

import { useState } from "react";
import { MailCheck, MailWarning } from "lucide-react";
import { apiPost, permissionMessage } from "@/services/api";

type Result = { tone: "ok" | "warn"; text: string };

export default function VerifyEmailNotice({ email, className = "" }: { email: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await apiPost<{ status: string; message: string }>("/api/auth/email/verify/request");
      setResult({ tone: r.status === "sent" || r.status === "already_verified" ? "ok" : "warn", text: r.message });
    } catch (e) {
      setResult({ tone: "warn", text: permissionMessage(e, "تعذّر إرسال الرابط الآن — أعد المحاولة بعد قليل.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/[0.06] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FABC05]/15 text-[#FABC05]">
          <MailWarning className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">بريدك غير موثَّق</p>
          {/* ترتيب الجملة مقصود: النقطتان بعد نصّ عربيّ، والعنوان اللاتيني في
              آخرها. كان العنوان قبلهما فتقع النقطتان على يساره في سياق RTL
              فتُقرأ الجملة معكوسة: «‪…@test.local : شراء الشعب‬». */}
          <p className="mt-1 text-[12px] leading-6 text-white/60">
            الدخول والتصفّح والتشخيص مفتوحة كلها. الموقوف شيئان فقط:
            <span className="font-bold text-white/75"> شراء الشعب</span> و<span className="font-bold text-white/75">استلام الشهادة</span>،
            حتى تُوثّق عنوانك
            <span dir="ltr" className="mx-1 inline-block font-bold text-white/75">{email}</span>
          </p>
          <button
            onClick={send}
            disabled={busy}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#FABC05] px-4 py-2 text-xs font-black text-on-gold transition hover:brightness-110 disabled:opacity-60"
          >
            <MailCheck className="h-3.5 w-3.5" />
            {busy ? "يُرسَل…" : "أرسل لي رابط التوثيق"}
          </button>
          {result && (
            <p role="status" className={`mt-2.5 text-[11px] leading-6 ${result.tone === "ok" ? "text-emerald-300" : "text-[#FABC05]"}`}>
              {result.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
