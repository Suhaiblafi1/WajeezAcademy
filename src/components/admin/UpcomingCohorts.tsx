/* «تبدأ قريبا» — ما يُقرَّر فيه قبل أن يبدأ (٢٢ أكتوبر ٢٠٢٦).

   «كيف أعلم أيّ الدورات قريبة وكم فيها تسجيل لأقرّر إيقافها وإبلاغ المدرّب بأنّنا ألغيناها، كي لا
   نتحمّل أيّ كلفة؟» — واختار صاحبُ المنصّة: قائمةٌ بما يبدأ خلال أيّام، بتاريخ البدء وعدد المسجّلين،
   وبجانبها الحدُّ الأدنى للمدرّب وما حُصّل، والإلغاءُ في السطر نفسِه.

   والأقربُ أوّلا، وما ينقص مالُه يُرى بشارته — والقرارُ لمن يقرأ. */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Chip from "@/components/ui/Chip";
import { apiGet } from "@/services/api";
import { Card, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import { fmtDateTimeAr, untilLabelAr } from "@/utils/format";
import { UPCOMING_DAY_CHOICES, UPCOMING_MAX_DAYS, isUpcoming } from "@/application/learning/upcoming-cohorts";
import { CohortMoneyLine, VerdictChip, type CohortMoneyView } from "./CohortMoney";
import CancelCohortBox from "./CancelCohortBox";
import PostponeMonthBox from "./PostponeMonthBox";

interface UpcomingRow {
  id: string; title: string; courseTitle: string; status: string; firstAt: string; capacity: number | null;
  money: CohortMoneyView;
  trainerSuspended?: boolean;
}

const STATUS_AR: Record<string, string> = { draft: "مسودة", open: "مفتوحة", full: "ممتلئة" };

export default function UpcomingCohorts({ onOpen, onChanged, onFlash }: {
  /** افتح بطاقتها في «كل الشعب» */
  onOpen: (id: string) => void;
  onChanged: () => void;
  onFlash: (f: { kind: "ok" | "error"; text: string }) => void;
}) {
  const [rows, setRows] = useState<UpcomingRow[] | null>(null);
  const [days, setDays] = useState<number>(30);
  const [shortOnly, setShortOnly] = useState(false);

  const load = useCallback(() => {
    apiGet<UpcomingRow[]>(`/api/admin/cohorts/upcoming?days=${UPCOMING_MAX_DAYS}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (rows === null) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-ink" /></div>;

  const now = new Date();
  const shown = rows
    .filter((r) => isUpcoming(r, now, days))
    .filter((r) => !shortOnly || r.money.verdict === "short");

  return (
    <div className="space-y-3">
      {/* تأجيلُ شعب شهرٍ كاملٍ بموافقة مدرّبيها — أو تتوقّف (٢٤ أكتوبر ٢٠٢٦) */}
      <PostponeMonthBox onChanged={() => { load(); onChanged(); }} onFlash={onFlash} />
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <TabBar ariaLabel="المدى" value={String(days)} onChange={(v) => setDays(Number(v))}
          items={UPCOMING_DAY_CHOICES.map((d) => ({ id: String(d), label: `${d} يوما` }))} />
        <label className="flex cursor-pointer items-center gap-2 text-read text-muted-foreground">
          <input type="checkbox" checked={shortOnly} onChange={(e) => setShortOnly(e.target.checked)} className="accent-teal" />
          التي لم تغط حق المدرب فقط
        </label>
      </Panel>

      {shown.length === 0 ? (
        <Panel as="p" className="py-12 text-center text-sm text-muted-foreground">
          {shortOnly ? "كل ما يبدأ في هذا المدى غطى حق مدربه." : "لا شعبة تبدأ في هذا المدى."}
        </Panel>
      ) : shown.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-72">
              <p className="font-black">{r.title}</p>
              <p className="mt-0.5 text-read text-muted-foreground">
                {r.courseTitle} · {r.money.trainerName ?? "بلا مدرب"} · {STATUS_AR[r.status] ?? r.status}
              </p>
              <p className="mt-1 text-read">
                تبدأ <b>{fmtDateTimeAr(r.firstAt)}</b> <span className="text-muted-foreground">({untilLabelAr(r.firstAt)})</span>
                {" · "}المسجلون <b>{r.money.enrolled}/{r.capacity ?? "—"}</b>
              </p>
              <p className="mt-1"><CohortMoneyLine m={r.money} /></p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* أُوقف مدرّبُها وأُبقيت لبديل — لا تُنسى «مفتوحة» تُباع بلا مدرّب (٢٤ أكتوبر ٢٠٢٦) */}
              {r.trainerSuspended && <Chip tone="danger">مدربها موقوف — أسند بديلا أو ألغها</Chip>}
              <VerdictChip m={r.money} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <Button tone="secondary" size="sm" onClick={() => onOpen(r.id)}>افتح بطاقتها</Button>
            <CancelCohortBox compact cohortId={r.id} title={r.title} learners={r.money.enrolled}
              started={r.money.started} hasTrainer={r.money.trainerName !== null}
              onDone={(text) => { onFlash({ kind: "ok", text }); load(); onChanged(); }}
              onError={(text) => onFlash({ kind: "error", text })} />
          </div>
        </Card>
      ))}
    </div>
  );
}
