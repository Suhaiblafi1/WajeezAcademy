/* ═══ «انقلها إلى موسم آخر» — تنقلها الإدارةُ بنفسها (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: الشعبةُ التي أُجّلت إلى موسمٍ غيرِ ما أراد تُنقل من صفّها هنا، بلا انتظار طلبٍ من مدرّبها.
   والنقلُ نفسُه الذي يمرّ به طلبُ المدرّب (`CohortMoveService.staffMove`): تُزاح المواعيدُ ولقاءاتُها، ويتحدّث Zoom
   والدعوات، ويُبلَّغ المتعلّمون ومدرّبُها. وأوّلُ لقاءٍ بعد النقل يُقال قبل التنفيذ — فلا يُختار موسمٌ بسنةٍ غير
   المقصودة (هكذا وقعت «شعبة ٤» في شتاء 2027). */

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { controlCls, areaCls } from "@/components/FormKit";
import { termOf } from "@/application/terms/season";
import { MOVABLE_STATUSES, MOVE_REASON_MIN, moveChoices, moveShiftMs, termLabelAr, type TermRef } from "@/application/trainer/cohort-move";
import { cohortDayAr } from "@/application/learning/cohort-gate";

export default function StaffMoveBox({ cohortId, status, startsAt, onDone }: {
  cohortId: string;
  status: string;
  /** بدءُ الشعبة — منه يُعرف موسمُها */
  startsAt: string | null;
  onDone: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = startsAt ? new Date(startsAt) : null;
  const now = new Date();
  /* ما بدأ أو انتهى لا يُنقل — والخادمُ يعيد الفحص */
  if (!(MOVABLE_STATUSES as readonly string[]).includes(status) || (start && start <= now)) return null;

  const choices = moveChoices(now, start ? termOf(start) : null);
  const key = (t: TermRef) => `${t.season}:${t.year}`;
  const target = choices.find((t) => key(t) === pick) ?? null;
  const firstAfter = start && target ? new Date(start.getTime() + moveShiftMs(termOf(start), target)) : null;

  if (!open) {
    return (
      <Button tone="secondary" size="sm" type="button" onClick={() => setOpen(true)}>
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> انقلها إلى موسم آخر
      </Button>
    );
  }

  const move = async () => {
    if (!target) return;
    setBusy(true); setErr(null);
    try {
      await apiPost(`/api/admin/cohorts/${cohortId}/move`, { toYear: target.year, toSeason: target.season, reason: reason.trim() });
      setOpen(false); setPick(""); setReason("");
      onDone(`نقلت إلى ${termLabelAr(target)}، ووصل المتعلمين ومدربها الموعد الجديد`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذر النقل — حاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Inset className="grid w-full gap-2 p-3">
      <p className="text-read leading-6 text-muted-foreground">
        تنتقل المواعيد كلها واللقاءات وروابطها، ويصل المتعلمين ومدربها الموعد الجديد.
      </p>
      <select aria-label="الموسم" value={pick} onChange={(e) => setPick(e.target.value)} className={`${controlCls} [&>option]:bg-surface`}>
        <option value="">اختر الموسم…</option>
        {choices.map((t) => <option key={key(t)} value={key(t)}>{termLabelAr(t)}</option>)}
      </select>
      {firstAfter && (
        <p className="text-read font-bold leading-6">
          أول لقاء بعد النقل: {cohortDayAr(firstAfter, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      <textarea aria-label="السبب" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="لماذا تنقلها؟" className={areaCls} />
      <div className="flex flex-wrap gap-2">
        <Button tone="confirm" size="sm" type="button" loading={busy}
          disabled={busy || !target || reason.trim().length < MOVE_REASON_MIN} onClick={() => void move()}>
          انقلها
        </Button>
        <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => { setOpen(false); setErr(null); }}>
          إلغاء
        </Button>
      </div>
      {err && <p role="alert" className="text-read text-danger-ink">{err}</p>}
    </Inset>
  );
}
