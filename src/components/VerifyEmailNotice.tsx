/* شريط توثيق البريد (١هـ).

   قاعدتان تحكمانه:
   ١) لا يظهر لمن وثّق بريده — شريطٌ دائم يُقرأ ديكورا فيُتجاوَز حين يهمّ.
   ٢) يقول ما يُحجب بالضبط: «وثّق بريدك» وحدها تبدو تعقيدا بلا سبب. أمّا
      «الشراء والشهادة موقوفان حتى تُوثّقه» فسببٌ يُقنع ويُتصرّف عليه.

   ولا يَعِد بما لا يقع: حين تكون قناة البريد غير مفعّلة يقول ذلك صراحةً بدل
   «أُرسلت الرسالة» التي تُبقي المستخدم ينتظر ما لن يصل.

   ─────────── ٣) ويُطوى بعد قراءته، ولا يُخفى ───────────

   كان يتصدّر الصفحةَ في كلّ زيارة بحجمه الكامل، فوق رحلة المتعلّم نفسِها —
   وصاحبُ المنصّة رآه أوّلَ ما رأى في شاشته. والطرفانِ كلاهما خطأ: تركُه
   يتصدّر يُزاحم ما جاء المتعلّمُ من أجله، وإخفاؤه يكتم حدّا حقيقيّا (الشراءُ
   والشهادةُ موقوفان فعلا).

   فالوسَط: يُقرأ كاملا أوّلَ مرّة، ثمّ يُطوى — بطلبه — إلى **سطرٍ واحدٍ
   يبقى ظاهرا** ومعه زرُّ الإرسال. والطيُّ محفوظٌ لعنوانه وحدَه، فتغييرُ
   البريد يُعيد البلاغَ كاملا. ويزول البلاغُ نهائيّا بالتوثيق لا بالطيّ. */

import { useState } from "react";
import { ChevronDown, ChevronUp, MailCheck, MailWarning } from "lucide-react";
import { apiPost, permissionMessage } from "@/services/api";
import { safeGet, safeSet } from "@/services/safe-storage";

type Result = { tone: "ok" | "warn"; text: string };

const FOLD_KEY = "wajeez_verify_notice_folded";

export default function VerifyEmailNotice({ email, className = "" }: { email: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  /* الطيُّ مخزَّنٌ بالعنوان: من غيّر بريده يقرأ البلاغَ كاملا من جديد */
  const [folded, setFolded] = useState(() => safeGet(FOLD_KEY) === email);

  const fold = (next: boolean) => {
    setFolded(next);
    safeSet(FOLD_KEY, next ? email : "");
  };

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

  const sendButton = (
    <button
      onClick={send}
      disabled={busy}
      className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-[#FABC05] px-4 text-xs font-black text-on-gold transition hover:brightness-110 disabled:opacity-60"
    >
      <MailCheck className="h-3.5 w-3.5" />
      {busy ? "يُرسَل…" : "أرسل لي رابط التوثيق"}
    </button>
  );

  /* المطويُّ سطرٌ واحد: الحدُّ ما زال معلَنا، والصفحةُ صارت لصاحبها */
  if (folded) {
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[#FABC05]/25 bg-[#FABC05]/[0.04] px-4 py-2.5 ${className}`}>
        <MailWarning className="h-4 w-4 shrink-0 text-[#FABC05]" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[12px] leading-6">
          <span className="font-bold">بريدك غير موثَّق</span>
          <span className="text-muted-foreground"> — الشراءُ والشهادةُ موقوفان حتّى تُوثّقه.</span>
        </p>
        {sendButton}
        <button
          type="button"
          onClick={() => fold(false)}
          aria-expanded={false}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-[#FABC05]/30 px-3 text-micro font-bold text-muted-foreground transition hover:text-foreground"
        >
          التفصيل <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
        {result && (
          <p role="status" className={`w-full text-[11px] leading-6 ${result.tone === "ok" ? "text-emerald-300" : "text-[#FABC05]"}`}>
            {result.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/[0.06] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FABC05]/15 text-[#FABC05]">
          <MailWarning className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black">بريدك غير موثَّق</p>
            <button
              type="button"
              onClick={() => fold(true)}
              aria-expanded
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-[#FABC05]/30 px-3 text-micro font-bold text-muted-foreground transition hover:text-foreground"
            >
              اطوِه <ChevronUp className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          {/* ترتيب الجملة مقصود: النقطتان بعد نصّ عربيّ، والعنوان اللاتيني في
              آخرها. كان العنوان قبلهما فتقع النقطتان على يساره في سياق RTL
              فتُقرأ الجملة معكوسة: «‪…@test.local : شراء الشعب‬». */}
          <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
            الدخول والتصفّح والتشخيص مفتوحة كلها. الموقوف شيئان فقط:
            <span className="font-bold text-foreground"> شراء الشعب</span> و<span className="font-bold text-foreground">استلام الشهادة</span>،
            حتى تُوثّق عنوانك
            <span dir="ltr" className="mx-1 inline-block font-bold text-foreground">{email}</span>
          </p>
          <div className="mt-3">{sendButton}</div>
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
