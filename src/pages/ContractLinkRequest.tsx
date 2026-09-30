import { useState } from "react";
import { Loader2, MailCheck, Send } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, ApiError } from "@/services/api";
import { Panel } from "@/components/ui/Surface";

/* من فقد رابطَ عرضه يطلبه من هنا.

   رمزُ التوقيع لا يُحفَظ نصّا — `tokenHash` وحدَه في الجدول، وهو صواب:
   الرمزُ بطاقةُ دخولٍ لمن حملها. فإذا ضاع من صاحبه لم نستطع أن نعيده إليه
   كما كان، ولا أن نضعه في رسالةٍ تاليةٍ نرسلها. ولذلك خلت رسالةُ «حُدّث
   نصُّ عرضك» من زرٍّ يفتح العرضَ، وصار زرُّها يقصد هذه الصفحة.

   ── وما يُقال هنا صراحةً ──

   الطلبُ يسكّ رمزا جديدا، فيموت القديمُ. ومن ضغط الزرَّ وهو يملك رابطَه
   يظنّه استعادةً بلا ثمن، ثمّ يفتح القديمَ فيُقال له «انتهى هذا الرابط» —
   وهو بعينه ما شكاه صاحبُ المنصّة أوّلا. فيُقال قبل الضغط لا بعده.

   ── ولا يُكشَف وجودُ عقدٍ من عدمه ──

   الجوابُ واحدٌ لمن له عرضٌ ولمن لا عرضَ له. ولولا ذلك لَصارت هذه الصفحةُ
   بابا يُسأل به «أهذا البريدُ لمدرّبٍ عندكم؟» عن ألفِ بريدٍ في دقيقة. */

/* وصيغةُ الحقل في ثابتٍ كما في `Contact.tsx`: لا مكوّنَ حقلٍ في نظام
   التصميم، وسقفُ `surface` يعدّ الصيغَ المكتوبةَ في `className` نفسِه. */
const FIELD =
  'w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-start text-sm outline-none transition focus:border-teal'

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export default function ContractLinkRequest() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      await apiPost("/api/c/request-link", { email: email.trim() });
      setState({ kind: "sent" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof ApiError
          ? err.message
          : "تعذّر إرسال الطلب الآن. أعِدْ المحاولة بعد قليل، أو راسِلْنا على Academy@wajeez.co.",
      });
    }
  }

  return (
    <SiteShell>
      <SeoHead
        title="طلب رابط عرض التعاقد"
        description="من فقد رابط عرضه طلبه ببريده"
        path="/contract-link"
        noindex
      />
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-black">فقدتَ رابط عرضك؟</h1>

        {state.kind === "sent" ? (
          <Panel tone="positive" className="mt-6">
            <p className="flex items-start gap-2 font-bold">
              <MailCheck className="mt-0.5 shrink-0" size={20} aria-hidden />
              <span>إن كان لديك عرضٌ مفتوحٌ بهذا البريد، فرابطٌ جديدٌ في طريقه إليه الآن.</span>
            </p>
            {/* ولا يُقال «أرسلناه» قطعا: الجوابُ لا يكشف أنّ للبريد عرضا */}
            <p className="mt-3 text-sm">
              افتحْ بريدك وابحث عن رسالةٍ من أكاديمية وجيز. وإن لم تصلك خلال دقائق فتحقّقْ من
              مجلّد البريد غير المرغوب، ثمّ راسِلْنا على Academy@wajeez.co.
            </p>
            <p className="mt-3 text-sm font-bold">
              وانتبهْ: رابطُك السابق توقّف — استعملِ الجديدَ وحدَه.
            </p>
          </Panel>
        ) : (
          <>
            <p className="mt-3 text-sm leading-7">
              اكتبْ بريدك الذي أرسلنا العرضَ إليه، ويصلك رابطٌ جديدٌ تفتح به عرضَك وتقرؤه
              وتوقّعه.
            </p>
            {/* ═══ ويُقال الثمنُ قبل الضغط ═══
                من ظنّها استعادةً بلا ثمنٍ فتح القديمَ بعدها فقيل له «انتهى هذا الرابط». */}
            <p className="mt-2 text-sm leading-7">
              وطلبُك يوقف رابطك السابق، فإن كان لا يزال عندك فاستعملْه ولا حاجةَ بك إلى هذا.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <label className="block text-sm font-bold" htmlFor="contract-link-email">
                بريدك
              </label>
              <input
                id="contract-link-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                className={FIELD}
                placeholder="name@example.com"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
              {/* ═══ ورمزٌ ينقلب بالمتغيّر لا درجةُ Tailwind ═══

                  `text-rose-700` مصمَّمةٌ للمظهر الداكن، فتقيس على الورق نحوَ
                  ١٫٣:‏١ — أي رسالةُ خطإٍ **موجودةٌ وغيرُ مرئيّة**، وصاحبُها
                  يضغط الزرَّ ولا يدري لِمَ لا يمضي. ويحرسه `check:theme`. */}
              {state.kind === "error" && (
                <p className="text-sm font-bold text-danger-ink" role="alert">{state.message}</p>
              )}
              <button
                type="submit"
                disabled={!valid || state.kind === "sending"}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 font-black text-ink disabled:opacity-50"
              >
                {state.kind === "sending"
                  ? <><Loader2 className="animate-spin" size={18} aria-hidden /> جارٍ الإرسال…</>
                  : <><Send size={18} aria-hidden /> أرسلْ لي رابطي</>}
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-read leading-6 opacity-70">
          ومن وقّع عرضَه فعلا فرابطُه باقٍ يفتح نسخته الموقَّعة، ولا يحتاج هذه الصفحة.
        </p>
      </div>
    </SiteShell>
  );
}
