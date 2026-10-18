/* ═══ «انتقل إلى هذا الموسم» — معاينةٌ ثمّ تأكيدٌ واحد (١٨ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `server/services/season-switch.service.ts`. والزرُّ لا ينفّذ: يعرض
   ما سيقع بأسمائه — ما يُفتح وما لا تتمّ شروطُه، وما يُلغى، وما فيه متعلّمون فلا يُمسّ، وأيُّ المواسم
   يُغلق — ثمّ «نفّذ» يفعله كلَّه. */

import { useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";

interface Preview {
  term: { id: string; titleAr: string; status: string };
  toOpen: { id: string; title: string; ready: boolean; missing: string[] }[];
  toCancel: { id: string; title: string; termAr: string | null }[];
  withLearners: { id: string; title: string; termAr: string | null; learners: number }[];
  termsToClose: { id: string; titleAr: string; status: string }[];
}

interface Result { opened: number; failed: { title: string; reason: string }[]; cancelled: number; closedTerms: number }

export default function SeasonSwitch({ termId, onDone }: { termId: string; onDone: () => void }) {
  const [p, setP] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const load = async () => {
    setBusy(true); setErr(null); setResult(null);
    try { setP(await apiGet<Preview>(`/api/admin/terms/${termId}/switch`)); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّرت المعاينة"); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setErr(null);
    try { setResult(await apiPost<Result>(`/api/admin/terms/${termId}/switch`)); setP(null); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر التنفيذ"); }
    finally { setBusy(false); }
  };

  const ready = p?.toOpen.filter((c) => c.ready) ?? [];
  const blocked = p?.toOpen.filter((c) => !c.ready) ?? [];

  return (
    <div className="mt-3">
      {!p && (
        <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => void load()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />}
          انتقل إلى هذا الموسم
        </Button>
      )}
      {p && (
        <Inset className="grid gap-3 p-4 text-read leading-6">
          <p className="font-bold">هذا ما سيحدث عند التنفيذ:</p>
          <div>
            <p className="font-bold text-teal-light-ink">تفتح للتسجيل ({ready.length})</p>
            {ready.length === 0 ? <p className="text-muted-foreground">لا شعب معتمدة جاهزة في هذا الموسم.</p>
              : <ul className="list-disc ps-5">{ready.map((c) => <li key={c.id}>{c.title}</li>)}</ul>}
          </div>
          {blocked.length > 0 && (
            <div>
              <p className="font-bold text-gold-ink">معتمدة لكن لا تفتح الآن ({blocked.length})</p>
              <ul className="list-disc ps-5">{blocked.map((c) => <li key={c.id}>{c.title} — {c.missing.join("، ")}</li>)}</ul>
            </div>
          )}
          <div>
            <p className="font-bold text-danger-ink">تغلق — شعب تجربة بلا متعلمين ({p.toCancel.length})</p>
            {p.toCancel.length === 0 ? <p className="text-muted-foreground">لا شيء.</p>
              : <ul className="list-disc ps-5">{p.toCancel.map((c) => <li key={c.id}>{c.title}{c.termAr ? ` · ${c.termAr}` : ""}</li>)}</ul>}
          </div>
          {p.withLearners.length > 0 && (
            <div>
              <p className="font-bold">لا تمس — فيها متعلمون، قرر فيها بنفسك ({p.withLearners.length})</p>
              <ul className="list-disc ps-5">{p.withLearners.map((c) => <li key={c.id}>{c.title} · {c.learners} متعلم{c.termAr ? ` · ${c.termAr}` : ""}</li>)}</ul>
            </div>
          )}
          <div>
            <p className="font-bold">المواسم</p>
            <ul className="list-disc ps-5">
              {p.term.status === "planned" && <li>يفتح «{p.term.titleAr}» للتسجيل.</li>}
              {p.termsToClose.map((t) => <li key={t.id}>ينتهي «{t.titleAr}».</li>)}
              {p.term.status !== "planned" && p.termsToClose.length === 0 && <li>لا تغيير.</li>}
            </ul>
          </div>
          <p className="text-muted-foreground">لا يحذف شيء: الشعب الملغاة والمواسم المنتهية تبقى في السجل.</p>
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" size="sm" type="button" loading={busy} disabled={busy} onClick={() => void apply()}>نفّذ</Button>
            <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => setP(null)}>إلغاء</Button>
          </div>
        </Inset>
      )}
      {result && (
        <p role="status" className="mt-2 text-read leading-6">
          فتحت {result.opened} شعبة، وأغلقت {result.cancelled}، وانتهى {result.closedTerms} موسم.
          {result.failed.length > 0 && <> لم تفتح: {result.failed.map((f) => `${f.title} (${f.reason})`).join("، ")}.</>}
        </p>
      )}
      {err && <p role="alert" className="mt-2 text-read text-danger-ink">{err}</p>}
    </div>
  );
}
