/* إنشاءُ اجتماعٍ جديد — يجدوله المدرّبُ داخلَ فصله، وتعتمده الإدارة.

   ═══ ما كان ═══

   ثلاثةُ حقولٍ في صفّ: عنوانٌ وتاريخٌ وساعةُ بدء. والمدّةُ ساعتان **لا
   يُسأل عنها** — رقمٌ في حالة النموذج بلا حقلٍ يعدّله، يُقفَل به اجتماعُ
   Zoom على الناس وهم فيه. ولا نبذةَ عن اللقاء ولا ملفَّ يُرفق به.

   وأخطرُ ما فيه أنّه كان **يُعلن لحظتَه**: يُنشأ الاجتماعُ ويُبلَّغ
   المسجَّلون في النداء نفسِه. فخطأٌ في تاريخٍ يصل عشرين إنسانا قبل أن
   يُقرأ، ولا سبيلَ إلى سحبه.

   ═══ القرار (١٥ سبتمبر ٢٠٢٦) ═══

   نصُّ صاحب المنصّة: «يُعطى خيارَ إنشاء جلساتٍ مباشرةٍ من خلال إنشاء اجتماعٍ
   جديدٍ مربوطٍ بحساب زووم الخاصّ بنا، ويحدّد أيَّ ساعةٍ وإلى أيّ ساعةٍ
   والتاريخَ واليوم، ويحدّد نبذةً عنه، ويرفق أيَّ ملفٍّ يريد اختياريّ.
   وبعدها الإدارةُ توافق، ويصبح هناك جلسةُ زووم لايف تُنشَر في منصّة الطلبة
   بتاريخها، ويُرسَل إيميلٌ للطلاب بالاجتماع وللإدارة».

   والنافذةُ صارت أشهرَ الفصل: من اختار فصلا فتحت له حدودُه (`setTerm`)،
   فلا يقف منتظرا إذنا لا يعرف متى يصل.

   ولماذا ملفٌّ على حدة: `CohortBoard` لوحُ تشغيلٍ يحمل الحضورَ والموادَّ
   والمخاطبة، وحارسُ `src/tests/staff-screens.test.ts` يمنع أن يعود يحمل
   ما ليس له — «الكثافةُ هي العلّة لا المحتوى». وقد أمسك هذا الحارسُ إضافةَ
   الجدولة إليه فعلا، **فخرجت ولم يُرفَع خطُّه**. */

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ModuleBodyUpload from "@/components/ModuleBodyUpload";
import { capReached } from "@/application/trainer/schedule-window";

/* ═══ الحدُّ يُقرأ قبل المحاولة لا بعد الرفض ═══

   والحدُّ يُقرأ **قبل** المحاولة لا بعد الرفض: المدى وما بقي من السقف
   معروضان، والنموذجُ لا يظهر أصلا إن كانت النافذةُ مغلقة. وهي القاعدةُ
   نفسُها التي تعمل بها بقيّةُ الشاشة: «الغيابُ يُقال أوّلا لأنّه مانع». */
interface ScheduleWindow {
  mine: boolean; open: boolean;
  start: string | null; end: string | null;
  /* `remaining: null` تعني **بلا سقفٍ معلَن** — لا «نفد». وكان الصفرُ يحمل
     المعنيَين فقيل لشعبةٍ فارغةٍ إنّها بلغت سقفَها. */
  maxSessions: number | null; used: number; remaining: number | null;
}

/** ما يُرفَق باللقاء — الشكلُ الذي يفهمه `ModuleBodyUpload` */
interface Attachment {
  bodyFileKey?: string | null;
  bodyFileName?: string | null;
  bodyFileMime?: string | null;
}

const BLANK = { title: "", date: "", from: "18:00", to: "20:00", noteAr: "", withZoom: true };

export default function TrainerSchedule({
  cohortId, onDone, minSessions, haveSessions,
}: {
  cohortId: string;
  onDone: () => void;
  /** الحدُّ الأدنى: لقاءٌ لكلّ محورٍ على الأقلّ — يُقال قبل أن يُردّ الاعتماد */
  minSessions: number;
  haveSessions: number;
}) {
  const [win, setWin] = useState<ScheduleWindow | null>(null);
  const [form, setForm] = useState(BLANK);
  const [attachment, setAttachment] = useState<Attachment>({});
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
        لم يُحدَّد فصلُ هذه الشعبة بعد — اختره في خطوة «الاسم والمواعيد»، فتُفتح لك أشهرُه لتجدول فيها لقاءاتك.
      </Inset>
    );
  }

  const full = capReached(win.maxSessions, win.used);
  /* والناقصُ يُقال بعددِه لا بإشارة: من بقي عليه لقاءان يعرف أنّهما اثنان */
  const short = Math.max(0, minSessions - haveSessions);

  return (
    <Card tone="accent">
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <CalendarPlus className="h-4 w-4 shrink-0 text-teal-light-ink" /> إنشاءُ اجتماعٍ جديد
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        تجدوله داخلَ أشهر فصلك: من <b className="text-foreground">{day(win.start)}</b> إلى{" "}
        <b className="text-foreground">{day(win.end)}</b>
        {win.maxSessions ? <> · استُهلك {win.used} من {win.maxSessions}</> : null}.
        {" "}وبعد إنشائه <b className="text-foreground">تعتمده الإدارة</b>، فيُنشَر للمسجَّلين بتاريخه ويصلهم رابطُه بالبريد.
      </p>

      {/* ═══ لقاءٌ لكلّ محورٍ على الأقلّ — يُقال هنا لا عند ردّ الاعتماد ═══
          «عددُ الجلسات يجب أن يكون بحدٍّ أدنى لا يقلّ عن عدد المحاور، ويحقّ
          له الزيادةُ كما يشاء موزّعةً على الفصل كاملا» (١٥ سبتمبر ٢٠٢٦). */}
      {short > 0 && (
        <Inset tone="warn" className="mt-3 text-read leading-6 text-gold-ink">
          بقي عليك {short === 1 ? "لقاءٌ واحد" : `${short} لقاءات`} — لكلّ محورٍ لقاءٌ على الأقلّ ({haveSessions}/{minSessions}).
          ولك أن تزيد عليها ما شئت موزّعا على الفصل.
        </Inset>
      )}

      {full ? (
        <p className="mt-3 text-read font-bold text-gold-ink">
          بلغتَ سقفَ اللقاءات الذي وضعته الإدارة — احذف لقاءً أو راجعها لتوسيعه.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          <StaffField wide label="عنوانُ اللقاء" hint="ما يراه المتعلّم في تقويمه — «اللقاء الثاني · التحليل العمليّ».">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              aria-label="عنوانُ اللقاء" placeholder="عنوانُ اللقاء" className={staffControlCls} />
          </StaffField>

          <div className="grid gap-4 sm:grid-cols-3">
            <StaffField label="التاريخ واليوم" hint="داخلَ أشهر الفصل وحدَها.">
              <input type="date" dir="ltr" value={form.date} min={day(win.start)} max={day(win.end)}
                aria-label="تاريخُ اللقاء"
                onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${staffControlCls} text-left`} />
            </StaffField>
            {/* ═══ ومن أيّ ساعةٍ إلى أيّ ساعة ═══
                كانت المدّةُ ساعتين مفترضتين بلا حقل، فيُقفَل اجتماعُ Zoom
                على الناس وهم فيه — أو يبقى مفتوحا ساعةً بعد انصرافهم. */}
            <StaffField label="من الساعة" hint="بتوقيت الشعبة.">
              <input type="time" dir="ltr" value={form.from} aria-label="ساعةُ بدء اللقاء"
                onChange={(e) => setForm({ ...form, from: e.target.value })} className={`${staffControlCls} text-left`} />
            </StaffField>
            <StaffField label="إلى الساعة" hint="عليها تُضبط مدّةُ الاجتماع — لا تُفترض افتراضا.">
              <input type="time" dir="ltr" value={form.to} aria-label="ساعةُ انتهاء اللقاء"
                onChange={(e) => setForm({ ...form, to: e.target.value })} className={`${staffControlCls} text-left`} />
            </StaffField>
          </div>

          {/* ملاحظاتُ هذا اللقاء — كانت واحدةً للشعبة كلِّها، فتُكتب عامّةً فلا تُقرأ */}
          <StaffField wide label="ملاحظاتٌ عن اللقاء (اختياريّ)" hint="ما تودّ أن يعرفه المتعلّم قبله: أيُسجَّل؟ أيلزمه شيءٌ يحضّره؟ أتُطلب الكاميرا؟">
            <textarea rows={2} value={form.noteAr} aria-label="ملاحظاتٌ عن اللقاء"
              onChange={(e) => setForm({ ...form, noteAr: e.target.value })} className={staffControlCls} />
          </StaffField>

          <StaffField as="div" wide label="ملفٌّ يُرفق باللقاء (اختياريّ)" hint="شرائحُ أو كرّاسةٌ يفتحها المتعلّم مع موعده.">
            <ModuleBodyUpload
              cohortId={cohortId}
              purpose="plan_resource"
              refId={`session-${form.date || "new"}`}
              value={attachment}
              onChange={(next) => setAttachment({ ...attachment, ...next })}
              label="ارفع ملفّا"
              hint="PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ وجداولُ تُنزَّل."
            />
          </StaffField>

          {/* المدرّبُ ينشئ اجتماعَه بنفسه — لا ينتظر مديرا يفتح Zoom ويلصق رابطا */}
          <label className="flex items-start gap-2 text-read leading-5 text-muted-foreground">
            <input type="checkbox" checked={form.withZoom}
              onChange={(e) => setForm({ ...form, withZoom: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-teal" />
            <span>
              <b className="text-foreground">أنشئ اجتماعَ Zoom على حساب المنصّة</b> — يُنشأ لحظةَ اعتماد الإدارة،
              ويصل رابطُه كلَّ مسجَّلٍ في الشعبة. وأطفئه للّقاء الحضوريّ.
            </span>
          </label>

          <div>
            <Button tone="confirm" loading={busy}
              disabled={busy || form.title.trim().length < 2 || !form.date || form.to <= form.from}
              onClick={async () => {
                setBusy(true);
                try {
                  const startsAt = new Date(`${form.date}T${form.from}:00`);
                  const endsAt = new Date(`${form.date}T${form.to}:00`);
                  await apiPost(`/api/trainer/cohorts/${cohortId}/sessions`, {
                    title: form.title.trim(), startsAt, endsAt,
                    noteAr: form.noteAr.trim() || null,
                    attachmentKey: attachment.bodyFileKey ?? null,
                    attachmentName: attachment.bodyFileName ?? null,
                    attachmentMime: attachment.bodyFileMime ?? null,
                    withZoom: form.withZoom,
                  });
                  setForm({ ...BLANK, from: form.from, to: form.to, withZoom: form.withZoom });
                  setAttachment({});
                  /* ولا يُقال «بُلِّغ ٠ متعلّما»: لم يُبلَّغ أحدٌ بعد، والصدقُ
                     أن يُقال إلى أين ذهب — لا رقمٌ يُقرأ عطبا. */
                  toast("أُرسل اللقاءُ للاعتماد — يصل المسجَّلين حين تعتمده الإدارة");
                  load();
                  onDone();
                } catch (e) {
                  toastError(e instanceof ApiError ? e.message : "تعذّرت إضافةُ اللقاء");
                } finally {
                  setBusy(false);
                }
              }}>
              أرسِلْه للاعتماد
            </Button>
            {/* والشرطُ يُقال قبل النقر لا بعد الرفض */}
            {form.to <= form.from && (
              <p className="mt-2 text-read font-bold text-gold-ink">ساعةُ الانتهاء قبل ساعة البدء.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
