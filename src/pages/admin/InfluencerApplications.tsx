/* طلباتُ الانضمام مؤثّرا — طابورٌ في «منحة مؤثرين وجيز» يُقبَل منه بكودٍ وعمولة أو يُعتذَر (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «ومنها يتقدّم، فيظهر في قائمة المتقدّمين باسمه وبريده وحسابٍ ينتظر تفعيلي». فهنا: الاسمُ
   والبريدُ والهاتفُ والحساباتُ بمتابعيها والتاريخ، الأوسعُ وصولا أوّلا. و«قبول» يفتح نموذجا صغيرا: الكودُ (يُقترح من
   بريده ويُعدَّل) والعمولةُ (تبدأ بالمقترحة) — ثمّ نافذةٌ تقول أثرَه قبل أن يقع («لا إجبارَ على فعل: الفرقُ والخياراتُ
   وأثرُ كلٍّ»): يُنشأ المؤثّرُ بكوده وحسابُه بدعوة. و«رفض» يصله بريدا بسببه إن كُتب.
   والقواعدُ في `server/services/influencer-application.service.ts`. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import ConfirmAction from "@/components/ConfirmAction";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import { staffControlCls } from "@/components/FormKit";
import { fmtDate, fmtNum } from "@/application/text/format-ar";
import { labelOf } from "@/application/advisor/application";
import { INFLUENCER_PLATFORMS, byReach, suggestInfluencerCode, type InfluencerAccount } from "@/application/commerce/influencer-application";
import { INFLUENCER_CODE_FORMAT_AR, INFLUENCER_COMMISSION_DEFAULT, normalizeInfluencerCode } from "@/application/commerce/influencer";

export interface InfluencerApplicationRow {
  id: string; reference: string; fullName: string; email: string; phone: string;
  accounts: InfluencerAccount[]; reachTotal: number; pitchAr: string; termsAr: string[];
  status: "submitted" | "approved" | "rejected"; createdAt: string; decidedAt: string | null; decidedByName: string | null;
  decisionNoteAr: string | null; code: string | null; commissionPercent: number | null;
}

type Stage = InfluencerApplicationRow["status"];
const STAGE_AR: Record<Stage, string> = { submitted: "تنتظر قرارك", approved: "قبلناهم", rejected: "اعتذرنا لهم" };

export default function InfluencerApplications({ onApproved }: { onApproved: () => Promise<void> }) {
  const [rows, setRows] = useState<InfluencerApplicationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("submitted");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ id: string; code: string; commission: string } | null>(null);
  const [pending, setPending] = useState<{ kind: "approve" | "reject"; row: InfluencerApplicationRow } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await apiGet<InfluencerApplicationRow[]>("/api/admin/influencer-applications")); }
    catch (e) { setError(permissionMessage(e, "تعذر تحميل الطلبات")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    submitted: rows.filter((r) => r.status === "submitted").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  }), [rows]);
  const shown = byReach(rows.filter((r) => r.status === stage));
  const view = paginate(shown.filter((r) => matchesQuery(q, [r.fullName, r.email, r.reference, r.phone])), page, 20);

  const code = form ? normalizeInfluencerCode(form.code) : null;
  const commission = Number(form?.commission);
  const commissionOk = form !== null && form.commission.trim() !== "" && Number.isInteger(commission) && commission >= 0 && commission <= 100;

  const decide = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(null); setDone(null);
    try { await fn(); setDone(message); setForm(null); await load(); await onApproved(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تنفيذ القرار"); }
    finally { setBusy(false); setPending(null); }
  };

  return (
    <section aria-labelledby="inf-apps" className="mt-6">
      <h2 id="inf-apps" className="text-lg font-black">طلبات الانضمام</h2>
      <p className="mt-1 text-read text-muted-foreground">
        من تقدم من صفحة «انضم كمؤثر»، الأوسع وصولا أولا. اقبله بكوده وعمولته فينشأ حسابه، أو اعتذر له.
      </p>
      {error && <Inset as="p" role="alert" tone="danger" className="mt-3 px-4 py-3 text-read">{error}</Inset>}
      {done && <Inset as="p" role="status" tone="positive" className="mt-3 px-4 py-3 text-read">{done}</Inset>}

      <TabBar
        className="mt-3"
        ariaLabel="حال طلبات المؤثرين"
        value={stage}
        onChange={(next) => { setStage(next); setPage(1); setForm(null); }}
        items={(["submitted", "approved", "rejected"] as const).map((s) => ({ id: s, label: `${STAGE_AR[s]} (${counts[s]})` }))}
      />

      <div className="mt-3">
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="طلبا" placeholder="ابحث بالاسم أو البريد أو رقم الطلب" />
      </div>
      <div className="mt-3 space-y-3">
        {view.rows.length === 0 && <Card as="p" className="text-read text-muted-foreground">لا طلبات هنا.</Card>}
        {view.rows.map((r) => (
          <Card key={r.id} as="article" aria-label={r.fullName}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 basis-72 flex-1">
                <p className="font-black">{r.fullName}</p>
                <p className="mt-0.5 text-read text-muted-foreground"><bdi dir="ltr">{r.email}</bdi> · <bdi dir="ltr">{r.phone}</bdi></p>
                <p className="mt-1 text-read font-bold">{fmtNum(r.reachTotal)} متابع</p>
                <ul className="mt-1 space-y-0.5 text-read">
                  {r.accounts.map((a) => (
                    <li key={a.url}>
                      {labelOf(INFLUENCER_PLATFORMS, a.platform)} · {fmtNum(a.followers)} متابع ·{" "}
                      <a href={a.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex items-center gap-1 text-teal-light-ink underline">
                        {a.url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-read leading-6 text-muted-foreground">{r.pitchAr}</p>
                <p className="mt-1 text-read text-muted-foreground"><bdi dir="ltr">{r.reference}</bdi> · وصل {fmtDate(new Date(r.createdAt))}</p>
              </div>
              {r.status === "submitted" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" tone="confirm" disabled={busy}
                    onClick={() => setForm(form?.id === r.id ? null : { id: r.id, code: suggestInfluencerCode(r.email), commission: String(INFLUENCER_COMMISSION_DEFAULT) })}>
                    قبول
                  </Button>
                  <Button size="sm" tone="danger" disabled={busy} onClick={() => setPending({ kind: "reject", row: r })}>رفض</Button>
                </div>
              )}
            </div>

            {form?.id === r.id && (
              <Inset className="mt-3 flex flex-wrap items-end gap-3 px-4 py-3">
                <label className="grid gap-1 text-read">الكود
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} dir="ltr" placeholder="SARA"
                    aria-label={`كود ${r.fullName}`} className={staffControlCls} />
                </label>
                <label className="grid gap-1 text-read">العمولة %
                  <input type="number" min={0} max={100} value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })}
                    aria-label={`عمولة ${r.fullName}`} className={staffControlCls} />
                </label>
                <Button size="sm" tone="confirm" disabled={busy || code === null || !commissionOk} onClick={() => setPending({ kind: "approve", row: r })}>
                  اقبله مؤثرا
                </Button>
                {form.code.trim() !== "" && code === null && <p className="w-full text-read text-danger-ink">{INFLUENCER_CODE_FORMAT_AR}</p>}
              </Inset>
            )}

            {r.status === "approved" && (
              <p className="mt-3 text-read text-muted-foreground">
                قبلناه بالكود <bdi dir="ltr">{r.code ?? "—"}</bdi> وعمولة {r.commissionPercent ?? "—"}%
                {r.decidedByName ? ` · بيد ${r.decidedByName}` : ""}{r.decidedAt ? ` · ${fmtDate(new Date(r.decidedAt))}` : ""}.
              </p>
            )}
            {r.status === "rejected" && (
              <p className="mt-3 text-read text-muted-foreground">
                اعتذرنا له{r.decidedByName ? ` · بيد ${r.decidedByName}` : ""}{r.decidedAt ? ` · ${fmtDate(new Date(r.decidedAt))}` : ""}{r.decisionNoteAr ? ` — ${r.decisionNoteAr}` : ""}.
              </p>
            )}
          </Card>
        ))}
      </div>

      {pending?.kind === "approve" && form && code && (
        <ConfirmAction
          titleAr={`قبول ${pending.row.fullName} مؤثرا`}
          confirmLabelAr="اقبله"
          tone="default"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const row = pending.row;
            void decide(
              () => apiPost(`/api/admin/influencer-applications/${row.id}/approve`, { code, commissionPercent: commission }),
              `قبلت ${row.fullName} بالكود ${code}، ووصله بريده.`,
            );
          }}
        >
          <p>كوده <b dir="ltr" className="text-foreground">{code}</b> وعمولته <b className="text-foreground">{commission}%</b> من سعر الدورات قبل الخصم.</p>
          <p>ينشأ له حساب بدور مؤثر ويصله رابط تفعيله، أو يضاف الدور إلى حسابه إن كان له حساب بهذا البريد.</p>
          <p>والكود لا يتغير بعدها. والعمولة تغير من صفه في قائمة المؤثرين.</p>
        </ConfirmAction>
      )}

      {pending?.kind === "reject" && (
        <ConfirmAction
          titleAr={`الاعتذار لـ${pending.row.fullName}`}
          confirmLabelAr="اعتذر له"
          busy={busy}
          reason={{ labelAr: "سبب يصله في رسالته (اختياري)", minLength: 0 }}
          onCancel={() => setPending(null)}
          onConfirm={(why) => {
            const row = pending.row;
            void decide(
              () => apiPost(`/api/admin/influencer-applications/${row.id}/reject`, why?.trim() ? { noteAr: why.trim() } : {}),
              `اعتذرت لـ${row.fullName}، ووصله بريد بذلك.`,
            );
          }}
        >
          <p>يصله بريد يقول إننا لن نقبل طلبه الآن، ويمكنه التقديم في فصل قادم. ولا ينشأ له حساب.</p>
        </ConfirmAction>
      )}
    </section>
  );
}
