/* إجازتي — في رأس «حالاتي» (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «B» — تواريخُ إجازةٍ وغطاءٌ مؤقّت. فيها لا تُسند إليه حالاتٌ جديدة، ومن ينتظر
   أوّلَ تواصلٍ منه يُنقل لغيره، ومن تواصل معه يبقى عنده. والعلّةُ في `server/services/advisor-away.service.ts`.
   والتاريخان يومان كاملان بتوقيت جهازه: من أوّل يوم البداية إلى آخر يوم النهاية. */

import { useCallback, useEffect, useState } from "react";
import { CalendarOff } from "lucide-react";
import { apiDelete, apiGet, apiPut, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDate } from "@/application/text/format-ar";
import { awayLastDay, awayRange } from "@/application/advisor/away";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls } from "@/components/FormKit";
import ConfirmAction from "@/components/ConfirmAction";

interface Away { from: string; until: string; noteAr: string | null; now: boolean }

export default function AwayPanel() {
  const [away, setAway] = useState<Away | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try { setAway((await apiGet<{ away: Away | null }>("/api/advisor/away")).away); }
    catch { setAway(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const out = await apiPut<{ moved: number }>("/api/advisor/away", awayRange(from, until));
      toast(out.moved > 0 ? `سجلت إجازتك، ونقل ${out.moved} ممن ينتظرون أول تواصل منك` : "سجلت إجازتك");
      setOpen(false); setConfirm(false);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حفظ الإجازة"); }
    finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try { await apiDelete("/api/advisor/away"); toast("ألغيت إجازتك"); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر إلغاء الإجازة"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-read">
          <CalendarOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {away
            ? `${away.now ? "أنت في إجازة" : "إجازتك القادمة"}: من ${fmtDate(away.from)} إلى ${fmtDate(awayLastDay(away.until))}`
            : "لا إجازة مسجلة"}
        </p>
        <div className="flex flex-wrap gap-2">
          {!open && <Button size="sm" tone="secondary" onClick={() => setOpen(true)}>{away ? "غير الإجازة" : "سجل إجازة"}</Button>}
          {away && !open && <Button size="sm" tone="ghost" disabled={busy} onClick={() => void clear()}>ألغ الإجازة</Button>}
        </div>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-read">من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={staffControlCls} />
          </label>
          <label className="grid gap-1 text-read">إلى
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={staffControlCls} />
          </label>
          <Button size="sm" disabled={busy || !from || !until} onClick={() => setConfirm(true)}>احفظ</Button>
          <Button size="sm" tone="ghost" disabled={busy} onClick={() => setOpen(false)}>تراجع</Button>
        </div>
      )}
      {confirm && (
        <ConfirmAction
          tone="default" titleAr="تسجيل إجازتك" confirmLabelAr="سجل الإجازة" busy={busy}
          onCancel={() => setConfirm(false)} onConfirm={() => void save()}
        >
          لن تسند إليك حالات جديدة في إجازتك. ومن ينتظر أول تواصل منك ينقل لمستشار آخر حين تبدأ، ولا يعود إليك بعدها.
          ومن تواصلت معه يبقى عندك.
        </ConfirmAction>
      )}
    </Card>
  );
}
