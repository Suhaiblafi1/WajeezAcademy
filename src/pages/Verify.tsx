import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, BadgeCheck, Loader2, Search, ServerOff, ShieldX } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateLong } from "@/application/text/format-ar";

import { Panel, Card } from "@/components/ui/Surface";
interface VerifyResult {
  number: string;
  learnerName: string;
  courseTitle: string;
  courseVersion: number;
  issuedAt: string;
  status: string; // active | revoked
  revokedReason: string | null;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; cert: VerifyResult }
  | { kind: "not_found" }
  | { kind: "offline"; message: string };

/** صفحة تحقق عامة من الشهادات — API حقيقي: /api/v1/certificates/verify/:number
    تعرض الحد الأدنى من البيانات، وتُبرز الإلغاء وسببه عند وجوده */
export default function Verify() {
  const { number } = useParams();
  const [input, setInput] = useState(number ?? "");
  /* رقم في العنوان يبدأ التحقق فورا — الحالة الابتدائية تحمل ذلك دون تأثير متزامن */
  const [state, setState] = useState<State>(() => (number ? { kind: "loading" } : { kind: "idle" }));

  const check = useCallback(async (num: string) => {
    const cleaned = num.trim();
    if (!cleaned) return;
    setState({ kind: "loading" });
    try {
      const cert = await apiGet<VerifyResult>(`/api/v1/certificates/verify/${encodeURIComponent(cleaned)}`);
      setState({ kind: "found", cert });
    } catch (err) {
      if (err instanceof ApiError && err.code === "not_found") setState({ kind: "not_found" });
      else setState({ kind: "offline", message: err instanceof ApiError ? err.message : "تعذر الاتصال بخدمة التحقق — حاول بعد قليل" });
    }
  }, []);

  /* التحقق التلقائي من رقم العنوان — الجلب غير متزامن فلا يخالف قواعد التأثيرات */
  useEffect(() => {
    if (!number) return;
    let cancelled = false;
    (async () => {
      try {
        const cert = await apiGet<VerifyResult>(`/api/v1/certificates/verify/${encodeURIComponent(number)}`);
        if (!cancelled) setState({ kind: "found", cert });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "not_found") setState({ kind: "not_found" });
        else setState({ kind: "offline", message: err instanceof ApiError ? err.message : "تعذر الاتصال بخدمة التحقق — حاول بعد قليل" });
      }
    })();
    return () => { cancelled = true; };
  }, [number]);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 py-16 text-foreground">
      <Link to="/" className="flex items-center gap-2 text-muted-foreground transition hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> أكاديمية وجيز
      </Link>
      <Panel className="mt-8 w-full max-w-md p-8">
        <h1 className="text-center text-2xl font-black">التحقق من شهادة</h1>
        <p className="mt-2 text-center text-xs leading-6 text-muted-foreground">
          أدخل رقم الشهادة (مثال: WJ-CERT-2026-00001) للتأكد من صحتها — دون كشف بيانات شخصية زائدة.
        </p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); void check(input); }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="WJ-CERT-2026-…"
            dir="ltr"
            aria-label="رقم الشهادة"
            /* min-w-0: عنصر flex لا ينكمش دون عرض محتواه ما لم يُسمح له،
               وحقل النص هنا كان يدفع زر البحث خارج الشاشة الضيقة. */
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-paper/30 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
          />
          <button
            type="submit"
            disabled={state.kind === "loading"}
            className="grid shrink-0 place-items-center rounded-xl bg-teal px-5 py-3 text-on-teal transition hover:bg-teal-light disabled:opacity-50"
            aria-label="تحقق"
          >
            {state.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {state.kind === "found" && state.cert.status === "active" && (
          <div className="mt-6 rounded-2xl border border-teal/40 bg-teal/10 p-5 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-teal-ink" />
            <p className="mt-3 font-black text-teal-light-ink">شهادة صحيحة ومعتمدة</p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="font-bold">{state.cert.learnerName}</p>
              <p>{state.cert.courseTitle}</p>
              <p className="text-xs text-muted-foreground">إصدار المنهج: {state.cert.courseVersion}</p>
              <p className="text-xs text-muted-foreground">
                تاريخ الإصدار: {fmtDateLong(new Date(state.cert.issuedAt))}
              </p>
              <p className="font-mono text-xs text-muted-foreground">{state.cert.number}</p>
            </div>
          </div>
        )}

        {state.kind === "found" && state.cert.status === "revoked" && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 font-black text-red-300">شهادة ملغاة</p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="font-bold">{state.cert.learnerName}</p>
              <p>{state.cert.courseTitle}</p>
              <p className="font-mono text-xs text-muted-foreground">{state.cert.number}</p>
              {state.cert.revokedReason && (
                <p className="mt-2 rounded-xl bg-paper/30 px-3 py-2 text-xs leading-6 text-red-200/80">
                  سبب الإلغاء: {state.cert.revokedReason}
                </p>
              )}
            </div>
          </div>
        )}

        {state.kind === "not_found" && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 font-black text-red-300">لا توجد شهادة بهذا الرقم</p>
            <p className="mt-1.5 text-xs text-muted-foreground">تأكد من الرقم، أو راسلنا إن ظننت أن هناك خطأ.</p>
          </div>
        )}

        {state.kind === "offline" && (
          <Card className="mt-6 text-center">
            <ServerOff className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">{state.message}</p>
          </Card>
        )}
      </Panel>
    </div>
  );
}
