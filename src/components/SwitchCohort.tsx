/* تبديلُ الموعد بعد الشراء — ما دامت الشعبةُ لم تبدأ.

   قرارُ صاحب المنصّة: «لا يحقّ له تغيير مساره بعد الدفع. فقط التنقّل بين
   الشعب ما دامت لم تبدأ بالفعل».

   والشقُّ الأوّل مطبَّقٌ في الخادم لا هنا: `switchCohort` يرفض أيَّ شعبةٍ من
   دورةٍ أخرى — فلو كان القيدُ في هذه الشاشة وحدَها لكان نداءً واحدا يتجاوزه.
   وهذه الشاشةُ لا تعرض إلّا ما يقبله الخادم، فلا يرى المتعلّم خيارا يُرفض.

   ولا يظهر الزرُّ أصلا حين لا يكون ثمّة بديل: خيارٌ وحيدٌ هو الحاليّ يُقرأ
   دعوةً إلى لا شيء. */

import { useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { useCourseCohorts } from "@/services/cohort-prices";
import { fmtDateAr } from "@/utils/format";

import { Card } from "@/components/ui/Surface";
export default function SwitchCohort({
  enrollmentId,
  courseId,
  cohortId,
  startsAt,
  onSwitched,
}: {
  enrollmentId: string;
  courseId: string;
  cohortId: string;
  /** موعدُ شعبته الحالية — بعد بدئها لا تبديلَ ذاتيّ */
  startsAt: string | null;
  onSwitched: () => void;
}) {
  const { cohorts } = useCourseCohorts();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const started = startsAt !== null && new Date(startsAt).getTime() <= Date.now();

  /* البدائلُ: شعبُ الدورة نفسِها، غيرُ الحالية، ولم تبدأ. والقائمةُ من
     `/api/public/cohorts` وقد رُشّحت أصلا بالمقاعد والحالة. */
  const options = useMemo(() => {
    if (started) return [];
    const now = Date.now();
    return (cohorts.get(courseId) ?? []).filter(
      (c) => c.id !== cohortId && c.startsAt !== null && new Date(c.startsAt).getTime() > now,
    );
  }, [cohorts, courseId, cohortId, started]);

  if (started || options.length === 0) return null;

  const move = async (toId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/learner/enrollments/${enrollmentId}/switch-cohort`, { cohortId: toId });
      setOpen(false);
      onSwitched();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر تبديل الموعد — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2 text-right text-sm font-black text-foreground"
      >
        <CalendarClock className="h-4 w-4 shrink-0 text-teal-light-ink" />
        <span className="min-w-0 flex-1">غيّر موعدك — لم تبدأ شعبتك بعد</span>
        <span className="shrink-0 text-fine font-bold text-muted-foreground">{options.length} بديل</span>
      </button>
      {open && (
        <>
          <p className="mt-2 text-fine leading-5 text-muted-foreground">
            مواعيد الدورة نفسها. مقعدك ينتقل معك بلا دفعٍ جديد.
          </p>
          <ul className="mt-3 space-y-1.5">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => void move(o.id)}
                  disabled={busy}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-right transition hover:border-teal/50 disabled:opacity-50"
                >
                  <span className="min-w-0 text-xs font-bold text-foreground">
                    {o.startsAt ? fmtDateAr(o.startsAt) : "بلا موعد"}
                    {o.title && <span className="text-muted-foreground"> — {o.title}</span>}
                  </span>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="shrink-0 text-fine font-black text-teal-light-ink">انقلني</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="mt-2 text-fine leading-5 text-red-300">{error}</p>}
        </>
      )}
    </Card>
  );
}
