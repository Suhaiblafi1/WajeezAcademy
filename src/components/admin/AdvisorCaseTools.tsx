/* أداتا تغيير المستشار — لأيّ حالةٍ مفتوحة، ولكلّ حالات مستشارٍ غادر (١٩ أكتوبر ٢٠٢٦).

   ═══ لماذا ═══

   شاشةُ «حالات بلا مستشار» كانت تغيّر مستشارَ ما لا مستشارَ له وما أسنده النظامُ في
   ثلاثين يوما. فما أسنده إداريٌّ بيده، أو ما قدُم، لا بابَ لتغييره — ومن غادر من
   المستشارين أو أُثقل بقيت حالاتُه عنده، والعميلُ ينتظر من لن يكلّمه.

   فأداتان: بحثٌ في كلّ حالةٍ مفتوحةٍ مسندة باسم صاحبها أو بريده أو رقمه، يُغيَّر منه
   مستشارُها بالباب نفسِه؛ ونقلُ كلِّ حالات مستشارٍ المفتوحة إلى أقلّ الآخرين حالاتٍ
   بضغطة — بقاعدة الإسناد التلقائيّ نفسِها (`AdvisorService#redistribute`). */

import { useEffect, useState } from "react";
import { Search, Shuffle, UserPlus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDate } from "@/application/text/format-ar";
import { countAr } from "@/application/text/count-ar";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import ConfirmAction from "@/components/ConfirmAction";

const OPEN_CASES = { one: "حالة مفتوحة", two: "حالتان مفتوحتان", few: "حالات مفتوحة", many: "حالة مفتوحة" };

interface FoundCase {
  id: string;
  lead: { fullName?: string | null; email?: string | null; phone?: string | null } | null;
  client: { displayName: string; email: string } | null;
  assignments: { advisorId: string; assignedAt: string; advisor: { displayName: string } }[];
}
interface AdvisorLoad { id: string; displayName: string; email: string; status: string; openCases: number }
interface AdvisorOption { id: string; displayName: string; email: string }

export default function AdvisorCaseTools({
  advisors,
  onChanged,
}: {
  /** المستشارون النشطون — من يُنقل إليه */
  advisors: AdvisorOption[];
  /** بعد كلّ تغيير — تعيد الشاشةُ قراءةَ قوائمها */
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<FoundCase[] | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loads, setLoads] = useState<AdvisorLoad[]>([]);
  const [from, setFrom] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loadLoads = async () => {
    try { setLoads(await apiGet<AdvisorLoad[]>("/api/admin/advisor-cases/advisor-loads")); }
    catch { setLoads([]); }
  };
  useEffect(() => { void loadLoads(); }, []);

  const search = async () => {
    const term = q.trim();
    if (term.length < 2) return;
    setBusy(true);
    try { setFound(await apiGet<FoundCase[]>(`/api/admin/advisor-cases/search?q=${encodeURIComponent(term)}`)); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر البحث"); }
    finally { setBusy(false); }
  };

  const change = async (caseId: string) => {
    const advisorId = pick[caseId] ?? "";
    if (!advisorId || busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/admin/advisor-cases/${caseId}/assign`, { advisorId });
      toast("تغيّر المستشار — تاريخ الإسناد محفوظ");
      await search();
      await loadLoads();
      onChanged();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر التغيير"); }
    finally { setBusy(false); }
  };

  const source = loads.find((l) => l.id === from) ?? null;
  const redistribute = async () => {
    setConfirming(false);
    if (!source) return;
    setBusy(true);
    try {
      const r = await apiPost<{ moved: number; stayed: number }>("/api/admin/advisor-cases/redistribute", { fromAdvisorId: source.id });
      toast(r.stayed > 0
        ? `نقلت ${countAr(r.moved, OPEN_CASES)} — وبقيت ${r.stayed} لا مستشار آخر نشط لها`
        : `نقلت ${countAr(r.moved, OPEN_CASES)}`);
      setFrom("");
      await loadLoads();
      onChanged();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر النقل"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <section className="mt-10">
        <h2 className="text-base font-black">غيّر مستشار أي حالة</h2>
        <p className="mt-1 text-read text-muted-foreground">ابحث باسم العميل أو بريده أو رقمه.</p>
        <form
          onSubmit={(e) => { e.preventDefault(); void search(); }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <label className="sr-only" htmlFor="advisor-case-search">بحث في الحالات</label>
          <input
            id="advisor-case-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اسم أو بريد أو رقم…"
            className={`${staffControlCls} max-w-72`}
          />
          <Button tone="secondary" type="submit" disabled={busy || q.trim().length < 2}>
            <Search className="h-3.5 w-3.5" /> ابحث
          </Button>
        </form>

        {found && found.length === 0 && (
          <p className="mt-3 text-read text-muted-foreground">لا حالة مفتوحة تطابق بحثك.</p>
        )}
        {found && found.length > 0 && (
          <div className="mt-4 space-y-3">
            {found.map((c) => {
              const current = c.assignments[0];
              const choice = pick[c.id] ?? "";
              return (
                <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{c.client?.displayName ?? c.lead?.fullName ?? "—"}</p>
                    <p className="mt-1 text-read text-muted-foreground" dir="ltr">
                      {[c.client?.email ?? c.lead?.email, c.lead?.phone].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-read text-muted-foreground">
                      عند: {current?.advisor.displayName ?? "—"}
                      {current ? ` · منذ ${fmtDate(new Date(current.assignedAt))}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`advisor-any-${c.id}`}>غيّر المستشار</label>
                    <select id={`advisor-any-${c.id}`} value={choice}
                      onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })} className={`${staffSelectCls} max-w-64`}>
                      <option value="">اختر مستشارا آخر…</option>
                      {advisors.filter((a) => a.id !== current?.advisorId).map((a) => (
                        <option key={a.id} value={a.id}>{a.displayName} ({a.email})</option>
                      ))}
                    </select>
                    <Button tone="secondary" disabled={busy || !choice} onClick={() => void change(c.id)}>
                      <UserPlus className="h-3.5 w-3.5" /> غيّر
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-black">انقل حالات مستشار</h2>
        <p className="mt-1 text-read text-muted-foreground">
          لمستشار غادر أو عنده حالات كثيرة: تنتقل حالاته المفتوحة إلى أقل المستشارين الآخرين حالات.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="advisor-redistribute-from">المستشار</label>
          <select id="advisor-redistribute-from" value={from} onChange={(e) => setFrom(e.target.value)}
            className={`${staffSelectCls} max-w-80`}>
            <option value="">اختر المستشار…</option>
            {loads.filter((l) => l.openCases > 0).map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName} — {countAr(l.openCases, OPEN_CASES)}{l.status !== "active" ? " (موقوف)" : ""}
              </option>
            ))}
          </select>
          <Button tone="secondary" disabled={busy || !source} onClick={() => setConfirming(true)}>
            <Shuffle className="h-3.5 w-3.5" /> وزّع حالاته
          </Button>
        </div>
      </section>

      {confirming && source && (
        <ConfirmAction
          tone="default"
          titleAr={`توزيع حالات «${source.displayName}»`}
          confirmLabelAr="وزّع"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void redistribute()}
        >
          تنتقل {countAr(source.openCases, OPEN_CASES)} إلى أقل المستشارين الآخرين حالات. الحالات المغلقة تبقى له،
          وعمولة المستشار الجديد تبدأ من أول تواصل يسجله.
        </ConfirmAction>
      )}
    </>
  );
}
