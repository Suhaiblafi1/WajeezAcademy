/* جاهزيّة العرض — فتحُ الشعب ومحاذاةُ أسعارها بزرّ.

   السعر لا يُقرأ من الكتالوج بل من الشعب: رقمٌ لا تسنده شعبةٌ قابلة للتسجيل
   وعدٌ يفترق عن الفاتورة. فما لا شعبةَ له لا سعرَ له — والعلاج فتحُ الشعب.

   وكانت العمليّتان في `scripts/` وحدهما، فلا تُنفَّذان إلّا من طرفيّةٍ تملك
   وصولا إلى قاعدة الإنتاج. فبقيت دوراتٌ معروضةٌ بلا سعر لأنّ أحدا لم يفتح
   طرفيّة — وهذا ثمنٌ باهظ لعمليّةٍ تستغرق ثانية.

   والعرضُ يسبق التنفيذ دائما: لا زرَّ ينفّذ قبل أن تُعرض النتيجة، لأنّه
   يكتب في قاعدةٍ حيّة فيها مدفوعات. */

import { useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, PlayCircle, Tags, Wallet } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";

import { Card, Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface OpenResult {
  applied: boolean; publishedCourses: number; opened: number; prepared: number; alreadyLive: number;
  skippedNoListPrice: number; startsAt: string;
  rows: { courseId: string; titleAr: string; price: number; currency: string; reason?: string; blocked?: string[] }[];
}
interface AlignResult {
  applied: boolean; cohorts: number; changed: number; alreadyAligned: number;
  skippedNoListPrice: number; skippedCommitted: number;
  rows: { cohortId: string; courseId: string; title: string; from: string; to: string; blocked?: string }[];
}

/** حالاتُ الشعبة بالعربيّة — الرموزُ في القاعدة، والعرضُ للناس */
const STATUS_AR: Record<string, string> = {
  draft: "مسودّة", open: "مفتوحة", full: "ممتلئة", active: "جارية", completed: "منتهية", cancelled: "ملغاة",
};

interface SyncResult {
  applied: boolean; changed: number;
  changes: { cohortId: string; title: string; from: string; to: string; reason: string }[];
}

export default function CohortReadiness({ onApplied }: { onApplied?: () => void }) {
  const [open, setOpen] = useState<OpenResult | null>(null);
  const [align, setAlign] = useState<AlignResult | null>(null);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (
    what: "open" | "align" | "sync",
    apply: boolean,
  ) => {
    setBusy(`${what}-${apply ? "apply" : "preview"}`);
    setError("");
    try {
      if (what === "open") {
        setOpen(await apiPost<OpenResult>("/api/admin/cohorts/open-all", { apply }));
      } else if (what === "align") {
        setAlign(await apiPost<AlignResult>("/api/admin/cohorts/align-prices", { apply }));
      } else {
        setSync(await apiPost<SyncResult>("/api/admin/cohorts/sync-statuses", { apply }));
      }
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
        السعر يُقرأ من الشعب لا من الكتالوج، فما لا شعبةَ مفتوحةً له لا يظهر له سعر —
        وهذا مقصود: رقمٌ لا تسنده شعبةٌ قابلة للتسجيل وعدٌ يفترق عن الفاتورة.
        اعرض أوّلا لترى ما سيتغيّر، ثمّ نفّذ.
      </p>

      {error && (
        <Inset as="p" tone="danger" className="mt-3 flex items-center gap-2 px-3 py-2 text-read text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </Inset>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ── فتح الشعب ── */}
        <Card className="bg-paper/25">
          <p className="flex items-center gap-1.5 text-read font-black">
            <PlayCircle className="h-3.5 w-3.5 text-teal" /> فتحُ شعبةٍ لكلّ دورة بلا شعبة
          </p>
          <p className="mt-1 text-read leading-5 text-muted-foreground">
            تبدأ من مبدأ الفصل (٤ أكتوبر ٢٠٢٦) أو بعد أسبوعين، أيّهما أبعد · ستّةُ مواعيدَ
            تتناوب: يومٌ واحدٌ لكلّ شعبة، ٦ أو ٨ مساءً بتوقيت عمّان (الأحد–الخميس) ·
            ٣ أو ٤ جلساتٍ مباشرة بينها أسبوعان · سعة ٢٠ · بسعر قائمة دورتها.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="secondary" size="sm" type="button"
              onClick={() => void run("open", false)}
              disabled={busy !== ""} loading={busy === "open-preview"}>
              اعرض ما سيتغيّر
            </Button>
            {open && !open.applied && open.opened > 0 && (
              <Button tone="confirm" size="sm" type="button"
                onClick={() => void run("open", true)}
                disabled={busy !== ""} loading={busy === "open-apply"}>
                {`هيّئ ${open.opened} شعبة`}
              </Button>
            )}
          </div>

          {open && (
            <Inset className="mt-3">
              <p className="text-read leading-6 text-foreground">
                دورات منشورة <b className="tabular-nums">{open.publishedCourses}</b> ·{" "}
                {open.applied ? "هُيّئت" : "ستُهيّأ"} <b className="tabular-nums">{open.applied ? open.opened + open.prepared : open.opened}</b>
                {open.applied && (
                  <> · <span className="text-teal-light-ink">فُتحت <b className="tabular-nums">{open.opened}</b></span></>
                )}
                {" "}· لها شعبةٌ أصلا <b className="tabular-nums">{open.alreadyLive}</b>
                {open.skippedNoListPrice > 0 && (
                  <> · <span className="text-gold">بلا سعر قائمة {open.skippedNoListPrice}</span></>
                )}
              </p>
              {open.applied && open.opened > 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                  <CheckCircle2 className="h-3 w-3" /> ظهرت أسعارُها الآن في الموقع.
                </p>
              )}

              {/* ما هُيّئ ولم يُفتح — والسببُ يُقال لا يُخفى.

                  كان هذا الزرُّ ينشئ الشعبةَ **مفتوحةً للبيع مباشرةً**
                  متخطّيا شروطَ الفتح الستّة: بلا مدرّبٍ ولا جدولٍ ولا خطّة.
                  فصار يمرّ بالبوّابة نفسِها، وما نقصه شيءٌ يبقى مسوّدةً
                  ونقصُه مكتوب. */}
              {open.applied && open.prepared > 0 && (
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-fine font-bold text-gold">
                    هُيّئت ولم تُفتح ({open.prepared}) — وما ينقصها
                  </summary>
                  <p className="mt-1.5 text-read leading-5 text-muted-foreground">
                    أُنشئت بجلساتها وخطّةِ تقديمها وسعرها، ولم تُفتح لأنّ شرطا نقص.
                    وأكثرُه مدرّبٌ مؤهَّل — يُسنَد من «المدربون ← التأهيل والإسناد».
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {open.rows.filter((r) => r.blocked?.length).slice(0, 40).map((r) => (
                      <li key={r.courseId} className="text-read leading-5 text-muted-foreground">
                        {r.titleAr} — <span className="text-gold">{r.blocked!.join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {open.rows.some((r) => r.reason) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-fine text-gold">
                    دوراتٌ لم تُفتح ({open.rows.filter((r) => r.reason).length}) — ولماذا
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {open.rows.filter((r) => r.reason).map((r) => (
                      <li key={r.courseId} className="text-read leading-5 text-muted-foreground">
                        {r.titleAr} — {r.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Inset>
          )}
        </Card>

        {/* ── محاذاة الأسعار ── */}
        <Card className="bg-paper/25">
          <p className="flex items-center gap-1.5 text-read font-black">
            <Tags className="h-3.5 w-3.5 text-gold" /> توحيدُ أسعار الشعب على سعر القائمة
          </p>
          <p className="mt-1 text-read leading-5 text-muted-foreground">
            شعبةٌ سعرُها يخالف كتالوجها تقول للصفحة رقما وتُطالب الفاتورة بغيره.
            والمقعدُ المحجوز أو المدفوع لا يُعاد تسعيره.
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
                {align.applied ? "وُحّدت" : "ستُوحَّد"} <b className="tabular-nums text-gold">{align.changed}</b> ·{" "}
                مطابقة أصلا <b className="tabular-nums">{align.alreadyAligned}</b>
              </p>
              {align.skippedCommitted > 0 && (
                <p className="mt-1.5 text-read leading-5 text-gold">
                  {align.skippedCommitted} شعبةً فيها مقاعدُ محجوزة أو مدفوعة — تُركت عمدا، عالجها يدويا.
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
        {/* ── الحالةُ تتبع التواريخ ── */}
        <Card className="bg-paper/25 lg:col-span-2">
          <p className="flex items-center gap-1.5 text-read font-black">
            <CalendarCheck className="h-3.5 w-3.5 text-teal" /> حالاتٌ متأخّرةٌ عن تواريخها
          </p>
          <p className="mt-1 text-read leading-5 text-muted-foreground">
            شعبةٌ بدأت جلساتُها تصير «جارية»، وشعبةٌ انتهت آخرُ جلساتها تصير «منتهية» — ومستحقّاتُ
            مدرّبها تُولَّد عند الإكمال، فتأخّرُ الحالة يؤخّرها. ولا تُفتح شعبةٌ آليّا: الفتحُ يمرّ بشروطه وبقرارك.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="secondary" size="sm" type="button"
              onClick={() => void run("sync", false)}
              disabled={busy !== ""} loading={busy === "sync-preview"}>
              اعرض ما سيتغيّر
            </Button>
            {sync && !sync.applied && sync.changes.length > 0 && (
              <Button tone="confirm" size="sm" type="button"
                onClick={() => void run("sync", true)}
                disabled={busy !== ""} loading={busy === "sync-apply"}>
                {`حرّك ${sync.changes.length} شعبة`}
              </Button>
            )}
          </div>
          {sync && (
            <Inset className="mt-3">
              {sync.changes.length === 0 ? (
                <p className="flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                  <CheckCircle2 className="h-3 w-3" /> كلُّ الحالات مطابقةٌ لتواريخها.
                </p>
              ) : (
                <>
                  <p className="text-read text-foreground">
                    {sync.applied ? "حُرّكت" : "ستُحرَّك"} <b className="tabular-nums text-teal-light-ink">{sync.applied ? sync.changed : sync.changes.length}</b> شعبة
                  </p>
                  <ul className="mt-2 space-y-1">
                    {sync.changes.slice(0, 12).map((ch) => (
                      <li key={ch.cohortId} className="text-read leading-5 text-muted-foreground">
                        <b className="text-foreground">{ch.title}</b> — {STATUS_AR[ch.from] ?? ch.from} ← {STATUS_AR[ch.to] ?? ch.to} · {ch.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Inset>
          )}
        </Card>
      </div>
    </Panel>
  );
}
