/* خطابُ توصيةٍ من الأكاديمية — صفحتُه العامّة برقمه (٢٢ أكتوبر ٢٠٢٦).

   يفتحها صاحبُ العمل من الرابط، ويطبعها صاحبُها ملفّا (PDF). ونصُّه من `endorsementBodyAr` لا يُكتب هنا، وأرقامُه
   لقطةُ يوم الإصدار من الخادم (`server/services/endorsement.service.ts`). وشهادةٌ مسحوبةٌ تجعله ملغى، يُقال ولا يُعرض.
   ولا تُفهرس: فيها حضورُ صاحبها، ورقمُها عشوائيٌّ لا يُخمَّن. */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, Loader2, Printer, ServerOff, ShieldX } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import SeoHead from "@/components/SeoHead";
import Button from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Surface";
import { fmtDateLong } from "@/application/text/format-ar";
import { endorsementBodyAr, endorsementPath } from "@/application/learning/endorsement";

interface Letter {
  number: string;
  issuedAt: string;
  learnerName: string;
  courseTitle: string;
  attendancePct: number;
  tasksDone: number;
  tasksTotal: number;
  skills: string[];
  totalHours: number | null;
  certificateNumber: string;
  status: string; // active | revoked
  revokedReason: string | null;
}

type State =
  | { kind: "loading" }
  | { kind: "found"; letter: Letter }
  | { kind: "not_found" }
  | { kind: "offline"; message: string };

export default function EndorsementLetter() {
  const { number = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const letter = await apiGet<Letter>(`/api/v1/letters/${encodeURIComponent(number)}`);
        if (!cancelled) setState({ kind: "found", letter });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "not_found") setState({ kind: "not_found" });
        else setState({ kind: "offline", message: err instanceof ApiError ? err.message : "تعذر الاتصال — حاول بعد قليل" });
      }
    })();
    return () => { cancelled = true; };
  }, [number]);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-paper text-foreground">
      <SeoHead title="خطاب توصية" description="خطاب توصية من أكاديمية وجيز." path={endorsementPath(number)} noindex />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 print:max-w-none print:p-0">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground transition hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> أكاديمية وجيز
          </Link>
          {state.kind === "found" && state.letter.status === "active" && (
            <Button tone="secondary" icon={Printer} onClick={() => window.print()}>اطبعه أو احفظه PDF</Button>
          )}
        </div>

        {state.kind === "loading" && (
          <div className="mt-16 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        {state.kind === "found" && state.letter.status === "active" && (
          <Panel className="mt-6 p-8 print:mt-0 print:border-0 print:p-0 print:shadow-none">
            {/* `div` لا `header`: قاعدةُ الطباعة العامّة تخفي كلَّ `header` (رأسَ الموقع) — فيخرج الخطابُ بلا اسم الأكاديمية ولا تاريخ */}
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-xl font-black">أكاديمية وجيز</p>
                <p className="text-read text-muted-foreground">wajeezacademy.com</p>
              </div>
              <p className="text-read text-muted-foreground">{fmtDateLong(new Date(state.letter.issuedAt))}</p>
            </div>
            <h1 className="mt-6 text-2xl font-black">خطاب توصية</h1>
            <p className="mt-4 font-bold">إلى من يهمه الأمر،</p>
            <div className="mt-3 space-y-3 leading-8">
              {endorsementBodyAr(state.letter).map((line) => <p key={line}>{line}</p>)}
            </div>
            {state.letter.skills.length > 0 && (
              <>
                <p className="mt-5 font-bold">ومن مهارات الدورة:</p>
                <ul className="mt-2 list-disc space-y-1 pr-6">
                  {state.letter.skills.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </>
            )}
            <p className="mt-8 font-black">أكاديمية وجيز</p>
            <div className="mt-8 border-t border-border pt-4 text-read leading-6 text-muted-foreground">
              <p>
                للتحقق من هذا الخطاب افتح: <bdi dir="ltr" className="font-mono">wajeezacademy.com{endorsementPath(state.letter.number)}</bdi>
              </p>
              <p>
                رقم الخطاب <bdi dir="ltr" className="font-mono">{state.letter.number}</bdi> · رقم الشهادة{" "}
                <bdi dir="ltr" className="font-mono">{state.letter.certificateNumber}</bdi>
              </p>
            </div>
          </Panel>
        )}

        {state.kind === "found" && state.letter.status !== "active" && (
          <Card tone="danger" className="mt-10 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 font-black text-red-300">هذا الخطاب ملغى مع شهادته</p>
            {state.letter.revokedReason && (
              <p className="mt-2 text-read leading-6 text-muted-foreground">سبب الإلغاء: {state.letter.revokedReason}</p>
            )}
          </Card>
        )}

        {state.kind === "not_found" && (
          <Card tone="danger" className="mt-10 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-3 font-black text-red-300">لا يوجد خطاب بهذا الرقم</p>
            <p className="mt-1.5 text-read leading-6 text-muted-foreground">تأكد من الرابط، أو راسلنا إن ظننت أن هناك خطأ.</p>
          </Card>
        )}

        {state.kind === "offline" && (
          <Card className="mt-10 text-center">
            <ServerOff className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">{state.message}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
