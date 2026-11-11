/* إلغاءُ الاشتراك في رسائل التسويق — الصفحةُ التي يفتحها سطرُ التذييل في البريد (١١ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أضف رابط إلغاء الاشتراك للبريد». والعلّةُ في `server/services/mail-optout.service.ts`.

   · **بزرٍّ لا بفتح الرابط**: فاحصو الروابط في صناديق البريد يفتحون كلَّ رابطٍ قبل صاحبه، فلو أُلغي بالفتح لأُلغي
     اشتراكُ من لم يطلب. والإلغاءُ من صندوق الوارد نفسِه (رأسُ الرسالة) بنقرةٍ واحدة بلا هذه الصفحة.
   · **ويقال ما يتوقّف وما يبقى**: رسائلُ المنح والإعلانات تتوقّف، ورسائلُ حسابه ودوراته باقية — فلا يظنّ أنّه لن يصله
     إيصالُه ولا رابطُ لقائه. */

import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, MailX, MailWarning } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import Button from "@/components/ui/Button";
import { apiPost, permissionMessage } from "@/services/api";

type State = { kind: "ask" } | { kind: "done"; email: string | null } | { kind: "error"; message: string };

export const UNSUBSCRIBE_ASK_AR = "هل تريد ألا تصلك رسائل المنح والإعلانات؟";
export const UNSUBSCRIBE_KEEP_AR = "رسائل حسابك ودوراتك ودفعك تبقى كما هي.";
export const UNSUBSCRIBE_DONE_AR = "ألغينا اشتراكك";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>(() =>
    token ? { kind: "ask" } : { kind: "error", message: "الرابط ناقص. افتحه من الرسالة كما وصلتك." },
  );
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const out = await apiPost<{ ok: boolean; email?: string }>("/api/public/unsubscribe", { t: token });
      setState({ kind: "done", email: out.email ?? null });
    } catch (e) {
      setState({ kind: "error", message: permissionMessage(e, "تعذر الإلغاء الآن. أعد المحاولة بعد قليل.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteShell>
      <SeoHead title="إلغاء الاشتراك" description="إلغاء الاشتراك في رسائل المنح والإعلانات من أكاديمية وجيز." path="/unsubscribe" noindex />
      <div className="mx-auto max-w-lg px-5 py-4 text-center">
        {state.kind === "ask" && (
          <>
            <MailX className="mx-auto h-12 w-12 text-teal-light-ink" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-black">{UNSUBSCRIBE_ASK_AR}</h1>
            <p className="mt-3 text-read leading-7 text-muted-foreground">{UNSUBSCRIBE_KEEP_AR}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button tone="confirm" loading={busy} onClick={() => void confirm()}>ألغ الاشتراك</Button>
              <Button as={Link} to="/" tone="secondary">أبق اشتراكي</Button>
            </div>
          </>
        )}

        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-black">{UNSUBSCRIBE_DONE_AR}</h1>
            <p className="mt-3 text-read leading-7 text-muted-foreground">
              لن تصل {state.email ? <span dir="ltr">{state.email}</span> : "بريدك"} رسائل المنح والإعلانات بعد اليوم. {UNSUBSCRIBE_KEEP_AR}
            </p>
            <div className="mt-8">
              <Button as={Link} to="/" tone="secondary">إلى الصفحة الرئيسية</Button>
            </div>
          </>
        )}

        {state.kind === "error" && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-gold-ink" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-black">لم نلغ الاشتراك</h1>
            <p className="mt-3 text-read leading-7 text-muted-foreground">{state.message}</p>
          </>
        )}
      </div>
    </SiteShell>
  );
}
