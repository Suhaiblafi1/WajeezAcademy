/* «لم يُفتح البابُ بعد» — ومعها موعد، لا اعتذارٌ وحدَه.

   ═══ قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦) ═══

   «أوقف أيَّ عمليّة تسجيلٍ الآن، وتظهر رسالةُ ‹لم يفتح باب التسجيل لموسم
   الشتاء بعد› عندما ينقر على الدفع. اطلب منه أن يترك إيميله ونبلّغه وقت فتح
   باب التسجيل».

   ═══ ولمَ مكوّنٌ واحدٌ لا ثلاثُ نسخٍ في ثلاث شاشات ═══

   للشراء ثلاثةُ أبوابٍ في هذا الموقع (لوحُ الشراء في صفحة المسار والدورة،
   و«اشترِ الآن» في صفحة الشعبة، ومرحلةُ العرض في الرحلة). ولو كُتبت الرسالةُ
   في كلٍّ منها لَافترقت جملتُها بعد أوّل تعديل، ولَبقي بابٌ يأخذ البريدَ
   وبابان يعتذران وحدَهما. والجملةُ نفسُها تأتي من الخادم أصلا — فلا تُكتب
   هنا ولا هناك.

   ═══ ولمَ يُطلَب البريدُ في موضع الردّ لا في صفحةٍ أخرى ═══

   من نقر «ادفع» أعلى ما يكون نيّةً في عمر زيارته. وإحالتُه إلى «تواصل معنا»
   تعني أن يبدأ من جديد — ونموذجُ تواصلٍ بعد ردٍّ لا يُملأ. فالحقلُ حيث وقع
   الردُّ بعينه، وحقلٌ واحدٌ لا نموذج: البريدُ وحدَه، لأنّ الوعدَ رسالةٌ
   واحدة ولا يُجمع لها اسمٌ ولا هاتف.

   ═══ وما لا يفعله هذا المكوّن ═══

   **لا يمنع شيئا.** المنعُ في `checkout` و`pay` في الخادم، وهذا وجهُه.
   ولو عُطّل هذا الملفُّ في متصفّحٍ لَما مرّت دفعةٌ واحدة. */

import { useState } from "react";
import { BellRing, CalendarClock, Check, Loader2 } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { controlCls } from "@/components/FormKit";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

/** من أيّ بابٍ تُرك البريد — يُرسَل كما هو إلى الخادم فتُقرأ الأبوابُ بعدُ */
export type InterestSource = "pathway" | "course" | "cohort" | "buy";

interface InterestResult {
  alreadyWaiting: boolean;
  seasonAr: string;
}

export default function RegistrationClosedNotice({
  messageAr,
  source = "buy",
  email: initialEmail = "",
  className = "",
}: {
  /** جملةُ الردّ — من الخادم لا مكتوبةٌ هنا: تُبدَّل من الشاشة بلا نشرِ واجهة */
  messageAr: string;
  source?: InterestSource;
  /** بريدُ من كان داخلا بحسابه — فلا يكتب ما نعرفه */
  email?: string;
  className?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<InterestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await apiPost<InterestResult>("/api/public/registration-interest", { email: value, source }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر حفظ بريدك — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tone="warn" className={className}>
      <p className="flex items-start gap-2 text-sm font-black leading-6 text-gold-ink">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {messageAr}
      </p>

      {done ? (
        /* والعائدُ يُقال له إنّه مسجَّلٌ من قبل لا يُشكَر شكرَ أوّلِ مرّة: من
           ترك بريدَه أمس ونسي يحتاج أن يعرف أنّه في القائمة، لا أن يشكّ
           فيتركه ثالثةً ورابعة. */
        <p className="mt-3 flex items-start gap-2 text-read leading-6 text-teal-light-ink">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {done.alreadyWaiting
            ? "بريدُك مسجَّلٌ عندنا من قبل — تصلك رسالةٌ واحدةٌ فور فتح الباب."
            : "حُفظ بريدُك — تصلك رسالةٌ واحدةٌ فور فتح الباب، ولا شيءَ غيرها."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            اترك بريدك ونُعلمك يوم يُفتح — رسالةٌ واحدة، ولا شيءَ غيرها.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">بريدك الإلكتروني</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                placeholder="name@example.com"
                dir="ltr"
                autoComplete="email"
                className={`${controlCls} text-left`}
              />
            </label>
            {/* `confirm` لا `primary`: الذهبيُّ فعلُ الصفحة، وهذا فعلُ قسمٍ
                داخلها. وهو يقع في لوح الشراء حيث زرُّ الدفع ذهبيّ — فذهبيّان
                في شاشةٍ واحدةٍ يُلغيان بعضَهما ولو لم يظهرا معا. */}
            <Button
              tone="confirm"
              onClick={() => void submit()}
              disabled={busy || email.trim() === ""}
              className="shrink-0 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              أبلغوني
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-read leading-5 text-red-300">{error}</p>
          )}
        </>
      )}
    </Card>
  );
}
