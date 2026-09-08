/* جدولةُ لقاءاتِ المدرّب — داخلَ النافذة التي تفتحها الإدارة.

   ولماذا ملفٌّ على حدة: `CohortBoard` لوحُ تشغيلٍ يحمل الحضورَ والموادَّ
   والمخاطبة، وحارسُ `src/tests/staff-screens.test.ts` يمنع أن يعود يحمل
   ما ليس له — «الكثافةُ هي العلّة لا المحتوى». وقد أمسك هذا الحارسُ إضافةَ
   الجدولة إليه فعلا، **فخرجت ولم يُرفَع خطُّه**. */

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

/* ═══ الحدُّ يُقرأ قبل المحاولة لا بعد الرفض ═══

   والحدُّ يُقرأ **قبل** المحاولة لا بعد الرفض: المدى وما بقي من السقف
   معروضان، والنموذجُ لا يظهر أصلا إن كانت النافذةُ مغلقة. وهي القاعدةُ
   نفسُها التي تعمل بها بقيّةُ الشاشة: «الغيابُ يُقال أوّلا لأنّه مانع». */
interface ScheduleWindow {
  mine: boolean; open: boolean;
  start: string | null; end: string | null;
  maxSessions: number | null; used: number; remaining: number;
}

export default function TrainerSchedule({ cohortId, onDone }: { cohortId: string; onDone: () => void }) {
  const [win, setWin] = useState<ScheduleWindow | null>(null);
  const [form, setForm] = useState({ title: "", date: "", time: "18:00", hours: "2", withZoom: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<ScheduleWindow>(`/api/trainer/cohorts/${cohortId}/schedule-window`)
      .then(setWin)
      .catch(() => setWin(null));
  }, [cohortId]);
  useEffect(() => { load(); }, [load]);

  if (!win) return null;

  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

  if (!win.open) {
    return (
      <Inset as="p" className="text-read leading-6 text-muted-foreground">
        جدولةُ اللقاءات لهذه الشعبة بيد الإدارة — لم تُفتح لك نافذةُ جدولةٍ بعد.
        ويمكنك اقتراحُ تأجيلِ لقاءٍ قائمٍ من زرّ «اقترح تأجيلا» بجواره.
      </Inset>
    );
  }

  const full = win.remaining <= 0;

  return (
    <Card tone="accent">
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <CalendarPlus className="h-4 w-4 shrink-0 text-teal-light-ink" /> أضِف لقاءً — الجدولةُ بيدك
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        فتحت الإدارةُ لك المدى من <b className="text-foreground">{day(win.start)}</b> إلى{" "}
        <b className="text-foreground">{day(win.end)}</b>، بسقف{" "}
        <b className="text-foreground">{win.maxSessions}</b> لقاءً — استُهلك {win.used}،
        وبقي <b className="text-foreground">{win.remaining}</b>.
        {" "}وما يقع خارجَ هذا المدى يبقى اقتراحا يُرفع إلى الإدارة.
      </p>

      {full ? (
        <p className="mt-3 text-read font-bold text-gold-ink">
          بلغتَ السقفَ — احذف لقاءً أو راجع الإدارةَ لتوسيع نافذتك.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            aria-label="عنوانُ اللقاء" placeholder="عنوانُ اللقاء"
            className={`${staffControlCls} sm:col-span-2`} />
          <input type="date" value={form.date} min={day(win.start)} max={day(win.end)}
            aria-label="تاريخُ اللقاء"
            onChange={(e) => setForm({ ...form, date: e.target.value })} className={staffControlCls} />
          <input type="time" value={form.time} aria-label="وقتُ اللقاء"
            onChange={(e) => setForm({ ...form, time: e.target.value })} className={staffControlCls} />
          <Button tone="confirm" loading={busy}
            disabled={busy || form.title.trim().length < 2 || !form.date}
            onClick={async () => {
              setBusy(true);
              try {
                const startsAt = new Date(`${form.date}T${form.time}:00`);
                const endsAt = new Date(startsAt.getTime() + Number(form.hours || 2) * 3600_000);
                const r = await apiPost<{ notified: number; zoom: { joinUrl: string } | null }>(
                  `/api/trainer/cohorts/${cohortId}/sessions`,
                  { title: form.title.trim(), startsAt, endsAt, withZoom: form.withZoom },
                );
                setForm({ title: "", date: "", time: "18:00", hours: "2", withZoom: form.withZoom });
                /* العددُ يُقال لا يُخمَّن: من جدول لقاءً يريد أن يعرف أنّ طلبتَه عرفوا */
                toast(r.zoom
                  ? `أُضيف اللقاء واجتماعُه — وبُلِّغ ${r.notified} متعلّما`
                  : `أُضيف اللقاء — وبُلِّغ ${r.notified} متعلّما`);
                load();
                onDone();
              } catch (e) {
                toastError(e instanceof ApiError ? e.message : "تعذّرت إضافةُ اللقاء");
              } finally {
                setBusy(false);
              }
            }}>
            أضِف
          </Button>
          {/* المدرّبُ ينشئ اجتماعَه بنفسه — لا ينتظر مديرا يفتح Zoom ويلصق رابطا */}
          <label className="flex items-start gap-2 text-read leading-5 text-muted-foreground sm:col-span-4">
            <input type="checkbox" checked={form.withZoom}
              onChange={(e) => setForm({ ...form, withZoom: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-teal" />
            <span>
              <b className="text-foreground">أنشئ اجتماعَ Zoom وبلّغ طلبتي</b> — يصل الرابطُ كلَّ مسجَّلٍ
              في هذه الشعبة داخل المنصّة. وأطفئه للّقاء الحضوريّ.
            </span>
          </label>
        </div>
      )}
    </Card>
  );
}
