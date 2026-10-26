/* جاهزيّة العرض — محاذاةُ أسعار الشعب، بزرّ.

   السعر لا يُقرأ من الكتالوج بل من الشعب: رقمٌ لا تسنده شعبةٌ قابلة للتسجيل
   وعدٌ يفترق عن الفاتورة. فما لا شعبةَ له لا سعرَ له.

   وكانت هنا بطاقةُ «فتحُ شعبةٍ لكلّ دورة بلا شعبة» — وتقاعدت (١٢ أكتوبر ٢٠٢٦):
   لا تُعرض شعبةٌ ولا تُباع إلّا باعتماد خطّة مدرّبها، فزرٌّ يفتح شعبا بلا مدرّبٍ
   لم يعد يفتح شيئا. والسببُ في رأس `catalog-readiness.service.ts`.

   وكان معها «حالات متأخّرة عن تواريخها» بزرّ — وذهبت (٢٦ أكتوبر ٢٠٢٦، المرحلة السادسة): العاملُ يُجريها
   كلَّ ربع ساعة (`cohort_status_sync`)، فالزرُّ يعيد ما فُعل.

   والعرضُ يسبق التنفيذ دائما: لا زرَّ ينفّذ قبل أن تُعرض النتيجة، لأنّه
   يكتب في قاعدةٍ حيّة فيها مدفوعات. */

import { useState } from "react";
import { AlertTriangle, Tags, Wallet } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";

import { Card, Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface AlignResult {
  applied: boolean; cohorts: number; changed: number; alreadyAligned: number;
  skippedNoListPrice: number; skippedCommitted: number;
  rows: { cohortId: string; courseId: string; title: string; from: string; to: string; blocked?: string }[];
}

export default function CohortReadiness({ onApplied }: { onApplied?: () => void }) {
  const [align, setAlign] = useState<AlignResult | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (what: "align", apply: boolean) => {
    setBusy(`${what}-${apply ? "apply" : "preview"}`);
    setError("");
    try {
      setAlign(await apiPost<AlignResult>("/api/admin/cohorts/align-prices", { apply }));
      if (apply) onApplied?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء");
    } finally {
      setBusy("");
    }
  };

  return (
    <Panel as="section" tone="accent" className="mb-6">
      <h2 className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
        <Wallet className="h-4 w-4" /> جاهزيّة العرض — لماذا لا تظهر بعض الأسعار
      </h2>
      <p className="mt-2 max-w-3xl text-read leading-6 text-muted-foreground">
        السعر يؤخذ من الشعب المفتوحة لا من الكتالوج، فالدورة بلا شعبة مفتوحة لا يظهر لها سعر.
        وتظهر الشعبة وتباع حين تعتمد خطّة مدرّبها وتفتحها من بطاقتها.
        عاين أوّلا ما سيتغيّر، ثمّ نفّذ.
      </p>

      {error && (
        <Inset as="p" tone="danger" className="mt-3 flex items-center gap-2 px-3 py-2 text-read text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </Inset>
      )}

      <div className="mt-4">
        {/* ── محاذاة الأسعار ── */}
        <Card className="bg-paper/25">
          <p className="flex items-center gap-1.5 text-read font-black">
            <Tags className="h-3.5 w-3.5 text-gold" /> توحيد أسعار الشعب على سعر القائمة
          </p>
          <p className="mt-1 text-read leading-5 text-muted-foreground">
            إن خالف سعر الشعبة سعر الكتالوج اختلف سعر الصفحة عن الفاتورة.
            ولا يتغيّر سعر مقعد محجوز أو مدفوع.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="secondary" size="sm" type="button"
              onClick={() => void run("align", false)}
              disabled={busy !== ""} loading={busy === "align-preview"}>
              اعرض ما سيتغيّر
            </Button>
            {align && !align.applied && align.changed > 0 && (
              <Button tone="confirm" size="sm" type="button"
                onClick={() => void run("align", true)}
                disabled={busy !== ""} loading={busy === "align-apply"}>
                {`وحّد ${align.changed} شعبة`}
              </Button>
            )}
          </div>

          {align && (
            <Inset className="mt-3">
              <p className="text-read leading-6 text-foreground">
                شعب <b className="tabular-nums">{align.cohorts}</b> ·{" "}
                {align.applied ? "وحّدت" : "ستوحّد"} <b className="tabular-nums text-gold">{align.changed}</b> ·{" "}
                مطابقة أصلا <b className="tabular-nums">{align.alreadyAligned}</b>
              </p>
              {align.skippedCommitted > 0 && (
                <p className="mt-1.5 text-read leading-5 text-gold">
                  {align.skippedCommitted} شعبة فيها مقاعد محجوزة أو مدفوعة — لم تتغيّر، عالجها يدويّا.
                </p>
              )}
              {align.rows.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-fine text-muted-foreground">التفصيل ({align.rows.length})</summary>
                  <ul className="mt-1.5 space-y-1">
                    {align.rows.slice(0, 40).map((r) => (
                      <li key={r.cohortId} className="text-read leading-5 text-muted-foreground">
                        {r.title} — {r.blocked ? <span className="text-gold">{r.blocked}</span> : <>{r.from} ← <b>{r.to}</b></>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Inset>
          )}
        </Card>
      </div>
    </Panel>
  );
}
