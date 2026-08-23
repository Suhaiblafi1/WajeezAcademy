import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, BadgeCheck, Loader2, Search, ServerOff, ShieldX } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";

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
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 py-16 text-white">
      <Link to="/" className="flex items-center gap-2 text-white/60 transition hover:text-white">
        <ArrowRight className="h-4 w-4" /> أكاديمية وجيز
      </Link>
      <div className="mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-center text-2xl font-black">التحقق من شهادة</h1>
        <p className="mt-2 text-center text-xs leading-6 text-white/50">
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
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none"
          />
          <button
            type="submit"
            disabled={state.kind === "loading"}
            className="cursor-pointer rounded-xl bg-teal px-5 text-on-teal transition hover:bg-teal-light disabled:opacity-50"
            aria-label="تحقق"
          >
            {state.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {state.kind === "found" && state.cert.status === "active" && (
          <div className="mt-6 rounded-2xl border border-teal/40 bg-teal/10 p-5 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-teal-ink" />
            <p className="mt-3 font-black text-teal-light-ink">شهادة صحيحة ومعتمدة</p>
            <div className="mt-3 space-y-1 text-sm text-white/75">
              <p className="font-bold">{state.cert.learnerName}</p>
              <p>{state.cert.courseTitle}</p>
              <p className="text-xs text-white/50">إصدار المنهج: {state.cert.courseVersion}</p>
              <p className="text-xs text-white/50">
                تاريخ الإصدار: {new Date(state.cert.issuedAt).toLocaleDateString("ar-JO", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="font-mono text-xs text-white/40">{state.cert.number}</p>
            </div>
          </div>
        )}

        {state.kind === "found" && state.cert.status === "revoked" && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 font-black text-red-300">شهادة ملغاة</p>
            <div className="mt-3 space-y-1 text-sm text-white/75">
              <p className="font-bold">{state.cert.learnerName}</p>
              <p>{state.cert.courseTitle}</p>
              <p className="font-mono text-xs text-white/40">{state.cert.number}</p>
              {state.cert.revokedReason && (
                <p className="mt-2 rounded-xl bg-black/30 px-3 py-2 text-xs leading-6 text-red-200/80">
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
            <p className="mt-1.5 text-xs text-white/50">تأكد من الرقم، أو راسلنا إن ظننت أن هناك خطأ.</p>
          </div>
        )}

        {state.kind === "offline" && (
          <div className="mt-6 rounded-2xl border border-white/15 bg-white/[0.03] p-5 text-center">
            <ServerOff className="mx-auto h-10 w-10 text-white/30" />
            <p className="mt-3 text-sm font-bold text-white/70">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
