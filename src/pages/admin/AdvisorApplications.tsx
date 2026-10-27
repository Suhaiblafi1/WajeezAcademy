/* طلباتُ الانضمام مستشارا — طابورٌ يُقبَل منه في خطوةٍ أو يُعتذَر (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السابعة).

   قرارُ صاحب المنصّة («b»): لا اتّفاقيّةَ للمستشار. فالقبولُ هنا هو التفعيل: تُكتب نسبتُه — تُقترح ٥٪ وتُعدَّل
   قبل القبول — فيُنشأ حسابُه بدور «مستشار» (أو يُضاف الدورُ إلى حسابه القائم) ويصله رابطُ تفعيله. والاعتذارُ يصله
   بريدا، بسببه إن كُتب. وكلاهما في نافذةٍ تقول أثرَه قبل أن يقع («لا إجبارَ على فعل: الفرقُ والخياراتُ وأثرُ كلٍّ»).

   والطابورُ يُرتَّب بالأحدث أو بالأوسع وصولا: مجموعُ متابعي حساباته وأعضاءِ مجموعاته (`reachTotal`) — وهو ما طُلب
   له النموذجُ أصلا («A» مع المتابعين). وما تغيّر بعد القبول من نسبته فبابُه «المستشارون والعمولة». */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import ConfirmAction from "@/components/ConfirmAction";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import { fmtDate, fmtNum } from "@/application/text/format-ar";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import {
  ADVISOR_AUDIENCES, ADVISOR_COMMUNITY_KINDS, ADVISOR_DEFAULT_COMMISSION_PCT, ADVISOR_EMPLOYMENT, ADVISOR_EXPERIENCE,
  ADVISOR_HOURS, ADVISOR_PLATFORMS, labelOf, pctAr, reachLineAr, sortApplications,
  type AdvisorAccount, type AdvisorCommunity,
} from "@/application/advisor/application";

export interface ApplicationRow {
  id: string; reference: string; fullName: string; email: string; phone: string; country: string | null;
  employment: string; experienceYears: string; experienceAr: string; hoursPerWeek: string; audiences: string[];
  accounts: AdvisorAccount[]; communities: AdvisorCommunity[]; reachTotal: number;
  promotedBefore: boolean; promotedAr: string | null; motivationAr: string;
  status: "submitted" | "approved" | "rejected"; createdAt: string; decidedAt: string | null; decidedByName: string | null;
  commissionPct: number | null; decisionNoteAr: string | null; userId: string | null;
}

type Stage = ApplicationRow["status"];
const STAGE_AR: Record<Stage, string> = { submitted: "تنتظر قرارك", approved: "قبلناهم", rejected: "اعتذرنا لهم" };

export default function AdvisorApplications() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("submitted");
  const [sortBy, setSortBy] = useState<"recent" | "reach">("recent");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [rate, setRate] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ kind: "approve" | "reject"; row: ApplicationRow } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<ApplicationRow[]>("/api/admin/advisor-applications"));
    } catch (e) {
      setError(permissionMessage(e, "تعذر تحميل الطلبات"));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    submitted: rows.filter((r) => r.status === "submitted").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  }), [rows]);
  const matched = sortApplications(rows.filter((r) => r.status === stage), sortBy)
    .filter((r) => matchesQuery(q, [r.fullName, r.email, r.reference, r.country ?? "", r.phone]));
  const view = paginate(matched, page, 20);

  /** النسبةُ المكتوبةُ في الصفّ — أو المقترحةُ إن لم تُكتب */
  const rateOf = (id: string) => rate[id] ?? String(ADVISOR_DEFAULT_COMMISSION_PCT);
  const rateValid = (id: string) => {
    const n = Number(rateOf(id));
    return rateOf(id).trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
  };

  const decide = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(null); setDone(null);
    try { await fn(); setDone(message); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تنفيذ القرار"); }
    finally { setBusy(false); setPending(null); }
  };

  return (
    <AdminLayout title="طلبات انضمام المستشارين">
      {error && <Inset as="p" role="alert" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}
      {done && <Inset as="p" role="status" tone="positive" className="mb-4 px-4 py-3 text-sm text-teal-light-ink">{done}</Inset>}

      <TabBar
        ariaLabel="حال الطلبات"
        value={stage}
        onChange={(next) => { setStage(next); setPage(1); setOpen(null); }}
        items={(["submitted", "approved", "rejected"] as const).map((s) => ({ id: s, label: `${STAGE_AR[s]} (${counts[s]})` }))}
      />

      <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="طلبا" placeholder="ابحث بالاسم أو البريد أو رقم الطلب…" />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-read text-muted-foreground">
          رتب حسب
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "recent" | "reach")} className={staffSelectCls.replace("w-full", "w-auto")}>
            <option value="recent">الأحدث</option>
            <option value="reach">الأوسع وصولا</option>
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {view.rows.length === 0 && <Card className="text-read text-muted-foreground">لا طلبات هنا.</Card>}
        {view.rows.map((r) => (
          <Card key={r.id} as="article" aria-label={r.fullName}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 basis-72 flex-1">
                <p className="font-black">{r.fullName}</p>
                <p className="mt-0.5 text-read text-muted-foreground">
                  {[r.country, labelOf(ADVISOR_EMPLOYMENT, r.employment), labelOf(ADVISOR_HOURS, r.hoursPerWeek) + " أسبوعيا"].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-read font-bold text-foreground">{reachLineAr(r.accounts, r.communities)}</p>
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  {labelOf(ADVISOR_EXPERIENCE, r.experienceYears)} — {r.experienceAr}
                </p>
                <p className="mt-1 text-read text-muted-foreground">
                  <span dir="ltr">{r.reference}</span> · وصل {fmtDate(new Date(r.createdAt))}
                </p>
              </div>
              <Button type="button" tone="ghost" size="sm" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                {open === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} التفاصيل
              </Button>
            </div>

            {open === r.id && (
              <Inset className="mt-3 space-y-3 px-4 py-3 text-read leading-7">
                <p><b>التواصل:</b> <span dir="ltr">{r.email}</span> · <span dir="ltr">{r.phone}</span></p>
                <p><b>من يصل إليهم:</b> {r.audiences.map((a) => labelOf(ADVISOR_AUDIENCES, a)).join("، ") || "—"}</p>
                {r.accounts.length > 0 && (
                  <div>
                    <b>حساباته:</b>
                    <ul className="mt-1 space-y-1">
                      {r.accounts.map((a) => (
                        <li key={a.url}>
                          {labelOf(ADVISOR_PLATFORMS, a.platform)} · {fmtNum(a.followers)} متابع ·{" "}
                          <a href={a.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex items-center gap-1 text-teal-light-ink underline">
                            {a.url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.communities.length > 0 && (
                  <div>
                    <b>مجموعاته:</b>
                    <ul className="mt-1 space-y-1">
                      {r.communities.map((c) => (
                        <li key={`${c.kind}-${c.name}`}>{labelOf(ADVISOR_COMMUNITY_KINDS, c.kind)} · {c.name} · {fmtNum(c.members)} عضو</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p><b>روج من قبل:</b> {r.promotedBefore ? `نعم${r.promotedAr ? ` — ${r.promotedAr}` : ""}` : "لا"}</p>
                <p><b>لماذا وجيز:</b> {r.motivationAr}</p>
              </Inset>
            )}

            {r.status === "submitted" && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-read text-muted-foreground">
                  نسبة عمولته ٪
                  <input
                    type="number" min={0} max={100} step={0.5} inputMode="decimal" dir="ltr"
                    value={rateOf(r.id)} onChange={(e) => setRate({ ...rate, [r.id]: e.target.value })}
                    aria-label={`نسبة عمولة ${r.fullName}`} className={`${staffControlCls.replace("w-full", "w-28")} mt-1 block`}
                  />
                </label>
                <Button type="button" tone="confirm" disabled={busy || !rateValid(r.id)} onClick={() => setPending({ kind: "approve", row: r })}>
                  اقبله مستشارا
                </Button>
                <Button type="button" tone="danger" disabled={busy} onClick={() => setPending({ kind: "reject", row: r })}>
                  اعتذر له
                </Button>
              </div>
            )}
            {r.status === "approved" && (
              <p className="mt-3 text-read text-muted-foreground">
                قبلناه بنسبة {pctAr(r.commissionPct ?? 0)}{r.decidedByName ? ` · بيد ${r.decidedByName}` : ""}{r.decidedAt ? ` · ${fmtDate(new Date(r.decidedAt))}` : ""}.
                {" "}وتغيير نسبته من <Link to="/admin/advisors" className="font-bold text-teal-light-ink underline">المستشارون والعمولة</Link>.
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

      {pending?.kind === "approve" && (
        <ConfirmAction
          titleAr={`قبول ${pending.row.fullName} مستشارا`}
          confirmLabelAr="اقبله"
          tone="default"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const row = pending.row;
            const pct = Number(rateOf(row.id));
            void decide(
              () => apiPost(`/api/admin/advisor-applications/${row.id}/approve`, { commissionPct: pct }),
              `قبلت ${row.fullName} مستشارا بنسبة ${pctAr(pct)}، ووصله بريده.`,
            );
          }}
        >
          <p>نسبة عمولته <b className="text-foreground">{pctAr(Number(rateOf(pending.row.id)))}</b> مما يدفعه متعلموه.</p>
          <p>ينشأ له حساب بدور مستشار ويصله رابط تفعيله — أو يضاف الدور إلى حسابه إن كان له حساب بهذا البريد. ولا اتفاقية يوقعها: قبل الشروط في نموذجه.</p>
          <p>وتغير نسبته بعدها من «المستشارون والعمولة»، ويكتب في السجل من غيرها.</p>
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
              () => apiPost(`/api/admin/advisor-applications/${row.id}/reject`, why?.trim() ? { noteAr: why.trim() } : {}),
              `اعتذرت لـ${row.fullName}، ووصله بريد بذلك.`,
            );
          }}
        >
          <p>يصله بريد يقول إننا لن نقبل طلبه الآن، ويمكنه التقديم لاحقا. ولا ينشأ له حساب.</p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}
