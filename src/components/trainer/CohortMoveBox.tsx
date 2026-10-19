/* ═══ «انقلها إلى فصل آخر» — في بطاقة كلّ شعبة عند المدرّب (١٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: يطلب المدرّبُ تأجيلَ شعبته إلى فصلٍ قادم — أو إعادتَها إلى أقرب
   منه في حالاتٍ نادرة — ويظهر الطلبُ للإدارة لتوافق. فلا يتغيّر موعدٌ من هنا: الزرُّ
   يرسل طلبا، والطلبُ المعلَّقُ يُرى في البطاقة ويُسحب منها. والعلّةُ والحسابُ في
   `src/application/trainer/cohort-move.ts`، والأثرُ عند الاعتماد في `cohort-move.service.ts`. */

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { controlCls, areaCls } from "@/components/FormKit";
import { termOf } from "@/application/terms/season";
import {
  MOVABLE_STATUSES, MOVE_REASON_MIN, moveChoices, moveShiftMs, termLabelAr, type TermRef,
} from "@/application/trainer/cohort-move";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import type { TrainingSeason } from "@/application/trainer/application-options";

export interface MoveRequestRow { id: string; cohortId: string; status: string; toYear: number; toSeason: string }

export default function CohortMoveBox({ cohortId, status, startsAt, pending, onChange }: {
  cohortId: string;
  status: string;
  /** أوّلُ لقاءٍ في الشعبة — منه يُعرف فصلُها */
  startsAt: string | null;
  pending: MoveRequestRow | null;
  onChange: () => void;
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

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); setOpen(false); setReason(""); setPick(""); onChange(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر الإرسال — حاول مجددا"); }
    finally { setBusy(false); }
  };

  if (pending) {
    const to = termLabelAr({ year: pending.toYear, season: pending.toSeason as TrainingSeason });
    return (
      <Inset tone="warn" className="mt-3 px-3 py-2 text-read leading-6">
        <p className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
          <span>طلبت نقلها إلى <b>{to}</b> — ينتظر موافقة الإدارة.</span>
        </p>
        <Button tone="ghost" size="sm" type="button" disabled={busy} className="mt-1 px-0"
          onClick={() => void run(() => apiPost(`/api/trainer/cohort-moves/${pending.id}/withdraw`))}>
          اسحب الطلب
        </Button>
        {err && <p role="alert" className="text-danger-ink">{err}</p>}
      </Inset>
    );
  }

  const choices = moveChoices(now, start ? termOf(start) : null);
  const key = (t: TermRef) => `${t.season}:${t.year}`;
  const target = choices.find((t) => key(t) === pick) ?? null;
  /* وأوّلُ لقاءٍ بعد النقل يُقال قبل الإرسال — فلا يُختار موسمٌ بسنةٍ غير المقصودة (١٩ أكتوبر ٢٠٢٦) */
  const firstAfter = start && target ? new Date(start.getTime() + moveShiftMs(termOf(start), target)) : null;

  if (!open) {
    return (
      <Button tone="ghost" size="sm" type="button" className="mt-2 self-start px-0" onClick={() => setOpen(true)}>
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> انقلها إلى فصل آخر
      </Button>
    );
  }

  return (
    <Inset className="mt-3 grid gap-2 p-3">
      <p className="text-read leading-6 text-muted-foreground">
        اختر الفصل واكتب السبب. لا يتغيّر شيء حتّى توافق الإدارة، ثم تنتقل المواعيد كلّها ويصل المتعلّمين الموعد الجديد.
      </p>
      <select aria-label="الفصل" value={pick} onChange={(e) => setPick(e.target.value)} className={`${controlCls} [&>option]:bg-surface`}>
        <option value="">اختر الفصل…</option>
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
          disabled={busy || !target || reason.trim().length < MOVE_REASON_MIN}
          onClick={() => target && void run(() => apiPost(`/api/trainer/cohorts/${cohortId}/move-request`, {
            toYear: target.year, toSeason: target.season, reason: reason.trim(),
          }))}>
          أرسل للإدارة
        </Button>
        <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => { setOpen(false); setErr(null); }}>
          إلغاء
        </Button>
      </div>
      {err && <p role="alert" className="text-read text-danger-ink">{err}</p>}
    </Inset>
  );
}
