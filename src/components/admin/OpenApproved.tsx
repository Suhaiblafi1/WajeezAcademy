/* ═══ «افتح المعتمدة كلها» — معاينةٌ ثمّ تأكيدٌ واحد (١٩ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `server/services/open-approved.service.ts`. والزرُّ لا ينفّذ: يعرض ما
   سيُفتح بأسمائه، وما لا تتمّ شروطُه وسببَه، وما نُقل إلى موسمٍ آخر فيبقى — ثمّ «نفّذ» يفتحه. */

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { movedLabelAr } from "@/application/trainer/cohort-move";
import { fmtDate } from "@/application/text/format-ar";

interface Preview {
  toOpen: { id: string; title: string; ready: boolean; missing: string[] }[];
  moved: { id: string; title: string; toYear: number; toSeason: string }[];
}

interface Result { opened: number; failed: { title: string; reason: string }[]; moved: number }

export default function OpenApproved({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const load = async () => {
    setBusy(true); setErr(null); setResult(null);
    try { setP(await apiGet<Preview>("/api/admin/cohorts/open-approved")); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذرت المعاينة"); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setErr(null);
    try { setResult(await apiPost<Result>("/api/admin/cohorts/open-approved")); setP(null); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذر التنفيذ"); }
    finally { setBusy(false); }
  };

  const ready = p?.toOpen.filter((c) => c.ready) ?? [];
  const blocked = p?.toOpen.filter((c) => !c.ready) ?? [];

  return (
    <div className="mb-4">
      {!p && (
        <Button tone="confirm" size="sm" type="button" disabled={busy} onClick={() => void load()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
          افتح المعتمدة كلها
        </Button>
      )}
      {p && (
        <Inset className="grid gap-3 p-4 text-read leading-6">
          <p className="font-bold">هذا ما سيحدث عند التنفيذ:</p>
          <div>
            <p className="font-bold text-teal-light-ink">تفتح للتسجيل ({ready.length})</p>
            {ready.length === 0 ? <p className="text-muted-foreground">لا شعبة معتمدة جاهزة الآن.</p>
              : <ul className="list-disc ps-5">{ready.map((c) => <li key={c.id}>{c.title}</li>)}</ul>}
          </div>
          {blocked.length > 0 && (
            <div>
              <p className="font-bold text-gold-ink">معتمدة لكن لا تفتح الآن ({blocked.length})</p>
              <ul className="list-disc ps-5">{blocked.map((c) => <li key={c.id}>{c.title} — {c.missing.join("، ")}</li>)}</ul>
            </div>
          )}
          {p.moved.length > 0 && (
            <div>
              <p className="font-bold">تبقى — نقلت إلى موسم آخر ({p.moved.length})</p>
              <ul className="list-disc ps-5">
                {p.moved.map((c) => <li key={c.id}>{c.title} · {movedLabelAr({ toYear: c.toYear, toSeason: c.toSeason, firstAt: null }, fmtDate)}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" size="sm" type="button" loading={busy} disabled={busy || ready.length === 0} onClick={() => void apply()}>نفّذ</Button>
            <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => setP(null)}>إلغاء</Button>
          </div>
        </Inset>
      )}
      {result && (
        <p role="status" className="mt-2 text-read leading-6">
          فتحت {result.opened} شعبة.
          {result.failed.length > 0 && <> لم تفتح: {result.failed.map((f) => `${f.title} (${f.reason})`).join("، ")}.</>}
        </p>
      )}
      {err && <p role="alert" className="mt-2 text-read text-danger-ink">{err}</p>}
    </div>
  );
}
