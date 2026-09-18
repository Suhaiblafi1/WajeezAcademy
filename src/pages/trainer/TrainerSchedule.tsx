/* إنشاءُ لقاءاتِ الشعبة — سلسلةً بالأصل، ومتفرّقةً عند الحاجة.

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

   ═══ ثمّ صارت سلسلةً (١٧–١٨ سبتمبر ٢٠٢٦) ═══

   · **المتكرّرُ هو المختارُ سلفا** والمتفرّقُ مخرج: شعبةٌ في فصلٍ ثابتٍ
     تجتمع سلسلةً — حقيقةُ نموذجنا لا تفضيلُ تصميم. ومدرّبةٌ عندها اثنا
     عشرَ لقاءً كانت تملأ النموذجَ اثنتَي عشرةَ مرّة.
   · **ومعاينةٌ تُرى قبل الإرسال**: كلُّ تاريخٍ يصير اجتماعَ زووم وصفَّ
     اعتمادٍ عند الإدارة، فقاعدةُ تكرارٍ تُطبَّق بلا أن تُرى تُنشئ اثني
     عشرَ اجتماعا على تواريخَ لم يقرأها أحد.
   · **وساعتان حدًّا أدنى** — في الشاشة وفي المسلك معا (`session-length.ts`).
   · **والساعاتُ قوائمُ لا حقلَ وقت**: `type="time"` يعرض «ص/م» حرفا واحدا
     يختلف رسمُه بالمتصفّح وبلغة النظام، فتُعتمَد جلسةٌ في السادسة صباحا
     وصاحبُها يظنّها السادسة مساءً.
   · **ونصيحةُ التباعد** تُقال ولا تُفرَض.

   ولماذا ملفٌّ على حدة: `CohortBoard` لوحُ تشغيلٍ يحمل الحضورَ والموادَّ
   والمخاطبة، وحارسُ `src/tests/staff-screens.test.ts` يمنع أن يعود يحمل
   ما ليس له — «الكثافةُ هي العلّة لا المحتوى». وقد أمسك هذا الحارسُ إضافةَ
   الجدولة إليه فعلا، **فخرجت ولم يُرفَع خطُّه**. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Trash2, Video } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ModuleBodyUpload from "@/components/ModuleBodyUpload";
import { capReached } from "@/application/trainer/schedule-window";
import {
  SHORT_SESSION_AR, firstToFor, fromSlots, sessionTooShort, slotLabelAr, toSlotsFor,
} from "@/application/trainer/session-length";
import {
  MAX_SERIES, SPACING_ADVICE_AR, WEEKDAYS_AR, buildSeries, tooTight,
} from "@/application/trainer/session-series";

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

/** صفٌّ في المعاينة — بعد أن صار قابلا للتعديل لم يبقَ مشتقّا وحدَه */
interface PreviewRow {
  key: string;
  date: string;
  title: string;
  outside: boolean;
  reasonAr: string;
}

const BLANK = { title: "", date: "", from: "18:00", to: "20:00", noteAr: "" };
/* الأحدُ والثلاثاءُ مبدئيّا — يومان متباعدان، وهو ما تنصح به الشاشةُ نفسُها */
const BLANK_RULE = { weekdays: [0, 2] as number[], count: 4, startDate: "" };

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
  /* «متكرّر» هو المختارُ سلفا — وهذه حقيقةُ نموذجنا لا تفضيلُ تصميم */
  const [mode, setMode] = useState<"series" | "single">("series");
  const [form, setForm] = useState(BLANK);
  const [rule, setRule] = useState(BLANK_RULE);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [attachment, setAttachment] = useState<Attachment>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<ScheduleWindow>(`/api/trainer/cohorts/${cohortId}/schedule-window`)
      .then(setWin)
      .catch(() => setWin(null));
  }, [cohortId]);
  useEffect(() => { load(); }, [load]);

  const FROM = useMemo(() => fromSlots(), []);
  const TO = useMemo(() => toSlotsFor(form.from), [form.from]);
  /* والنصيحةُ تُقاس على ما سيُرسَل فعلا — لا على ما شُطب منه */
  const keep = useMemo(() => rows.filter((r) => !r.outside), [rows]);
  const tight = useMemo(() => tooTight(keep.map((r) => r.date)), [keep]);

  if (!win) return null;

  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

  /* ═══ نافذةٌ مغلقةٌ تُخبِر ولا تأمر ═══

     كان يُقال: «اخترْه في خطوة الاسم والمواعيد» — أمرٌ بفعلٍ لا بابَ له
     في يده أصلا بعد أن صار الفصلُ يُسمَّى عند الإسناد (صاحب المنصّة،
     ١٧ سبتمبر ٢٠٢٦). ومن يُؤمَر بما لا يستطيع يدور في الخطوات يبحث عن
     زرٍّ لا وجودَ له، ثمّ يظنّ العطبَ في نفسه. فيُقال له ما يقع، ومن
     يفعله، ومتى يعلم أنّه وقع. */
  if (!win.open) {
    return (
      <Inset as="p" className="text-read leading-6 text-muted-foreground">
        لم تُفتَح هذه الشعبةُ بعد — تسمّي الإدارةُ فصلَها عند الإسناد، فتُفتح لك أشهرُه لتجدول
        فيها لقاءاتك. ويصلك إشعارٌ حين يُسمَّى.
      </Inset>
    );
  }

  const full = capReached(win.maxSessions, win.used);
  /* والناقصُ يُقال بعددِه لا بإشارة: من بقي عليه لقاءان يعرف أنّهما اثنان */
  const short = Math.max(0, minSessions - haveSessions);
  const tooShort = sessionTooShort(`${form.date || "2026-01-01"}T${form.from}:00`, `${form.date || "2026-01-01"}T${form.to}:00`);

  /** يُنشئ لقاءً واحدا — ويُعيد رسالةَ الخطإ أو `null` عند النجاح */
  const postOne = async (title: string, date: string, withAttachment: boolean): Promise<string | null> => {
    try {
      await apiPost(`/api/trainer/cohorts/${cohortId}/sessions`, {
        title: title.trim(),
        startsAt: new Date(`${date}T${form.from}:00`),
        endsAt: new Date(`${date}T${form.to}:00`),
        noteAr: form.noteAr.trim() || null,
        attachmentKey: withAttachment ? attachment.bodyFileKey ?? null : null,
        attachmentName: withAttachment ? attachment.bodyFileName ?? null : null,
        attachmentMime: withAttachment ? attachment.bodyFileMime ?? null : null,
      });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : "تعذّرت إضافةُ اللقاء";
    }
  };

  return (
    <Card tone="accent">
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <CalendarPlus className="h-4 w-4 shrink-0 text-teal-light-ink" /> لقاءاتُ الشعبة
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        تجدولها داخلَ أشهر فصلك: من <b className="text-foreground">{day(win.start)}</b> إلى{" "}
        <b className="text-foreground">{day(win.end)}</b>
        {win.maxSessions ? <> · استُهلك {win.used} من {win.maxSessions}</> : null}.
        {" "}وبعد إنشائها <b className="text-foreground">تعتمدها الإدارة</b>، فتُنشَر للمسجَّلين بتواريخها ويصلهم رابطُها بالبريد.
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
          {/* ═══ المتكرّرُ أوّلا والمتفرّقُ مخرج ═══
              والقسمةُ صفٌّ من زرَّين لا قائمةٌ منسدلة: خياران يُرى كلاهما. */}
          <StaffField as="div" wide label="كيف تجدولها؟" hint="شعبةٌ في فصلٍ ثابتٍ تجتمع سلسلةً — والمتفرّقةُ لمن يحتاجها.">
            <div className="flex flex-wrap gap-2">
              {([
                ["series", "جدولٌ متكرّر", "يوم أو أيّامٌ في الأسبوع، وعددُ اللقاءات"],
                ["single", "لقاءٌ متفرّق", "تاريخٌ واحدٌ بعينه"],
              ] as const).map(([v, label, hint]) => (
                <label key={v}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2 text-read transition ${
                    mode === v ? "bg-teal/15 font-black text-teal-light-ink" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <input type="radio" name="sched-mode" value={v} checked={mode === v}
                    onChange={() => { setMode(v); setRows([]); }}
                    className="h-4 w-4 accent-[var(--teal)]" />
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="block text-fine text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </StaffField>

          <StaffField wide label={mode === "series" ? "عنوانُ السلسلة" : "عنوانُ اللقاء"}
            hint={mode === "series"
              ? "يُرقَّم تلقائيّا: «التحليل العمليّ — اللقاء ١». ولك تعديلُ كلِّ عنوانٍ في المعاينة."
              : "ما يراه المتعلّم في تقويمه — «اللقاء الثاني · التحليل العمليّ»."}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              aria-label="عنوانُ اللقاء" placeholder="عنوانُ اللقاء" className={staffControlCls} />
          </StaffField>

          <div className="grid gap-4 sm:grid-cols-3">
            <StaffField label={mode === "series" ? "أوّلُ يومٍ يُنظَر فيه" : "التاريخ واليوم"} hint="داخلَ أشهر الفصل وحدَها.">
              <input type="date" dir="ltr"
                value={mode === "series" ? rule.startDate : form.date}
                min={day(win.start)} max={day(win.end)}
                aria-label="تاريخُ اللقاء"
                onChange={(e) => (mode === "series"
                  ? setRule({ ...rule, startDate: e.target.value })
                  : setForm({ ...form, date: e.target.value }))}
                className={`${staffControlCls} text-left`} />
            </StaffField>

            {/* ═══ ومن أيّ ساعةٍ إلى أيّ ساعة — قائمتان لا حقلا وقت ═══
                كانت المدّةُ ساعتين مفترضتين بلا حقل، ثمّ صارت حقلَي `time`
                يعرضان «ص/م» حرفا واحدا يختلف رسمُه بالمتصفّح — فتُعتمَد
                جلسةٌ في السادسة صباحا. والقائمةُ تكتب الفترةَ بحروفها،
                وسلّمُ «إلى» يبدأ من البداية زائدَ ساعتين فلا يُعبَّر عن
                الخطإ أصلا. */}
            <StaffField label="من الساعة" hint="بتوقيت الشعبة.">
              <select value={form.from} aria-label="ساعةُ بدء اللقاء"
                onChange={(e) => {
                  const from = e.target.value;
                  const to = toSlotsFor(from).includes(form.to) ? form.to : firstToFor(from);
                  setForm({ ...form, from, to });
                }}
                className={staffControlCls}>
                {FROM.map((c) => <option key={c} value={c}>{slotLabelAr(c)}</option>)}
              </select>
            </StaffField>
            <StaffField label="إلى الساعة" hint="ساعتان على الأقلّ — فالسلّمُ يبدأ منها.">
              <select value={form.to} aria-label="ساعةُ انتهاء اللقاء"
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                className={staffControlCls}>
                {TO.map((c) => <option key={c} value={c}>{slotLabelAr(c)}</option>)}
              </select>
            </StaffField>
          </div>

          {mode === "series" && (
            <>
              <StaffField as="div" wide label="أيّامُ الأسبوع" hint="اللقاءُ يتكرّر في هذه الأيّام حتّى يكتمل عددُه.">
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS_AR.map((name, i) => (
                    <label key={name}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-read transition ${
                        rule.weekdays.includes(i) ? "bg-teal/15 font-black text-teal-light-ink" : "text-muted-foreground hover:text-foreground"
                      }`}>
                      <input type="checkbox" checked={rule.weekdays.includes(i)}
                        onChange={() => setRule({
                          ...rule,
                          weekdays: rule.weekdays.includes(i)
                            ? rule.weekdays.filter((d) => d !== i)
                            : [...rule.weekdays, i].sort((a, b) => a - b),
                        })}
                        className="h-4 w-4 accent-[var(--teal)]" />
                      {name}
                    </label>
                  ))}
                </div>
              </StaffField>

              <div className="grid gap-4 sm:grid-cols-3">
                <StaffField label="عددُ اللقاءات" hint={`لكلّ محورٍ لقاءٌ على الأقلّ — وأكثرُها ${MAX_SERIES}.`}>
                  <input type="number" dir="ltr" min={1} max={MAX_SERIES} value={rule.count}
                    aria-label="عددُ اللقاءات"
                    onChange={(e) => setRule({ ...rule, count: Number(e.target.value) || 0 })}
                    className={`${staffControlCls} text-left`} />
                </StaffField>
                <div className="flex items-end sm:col-span-2">
                  {/* ═══ المعاينةُ تُطلَب فتُولَّد — ولا تُكتب في أثرٍ جانبيّ ═══
                      لأنّ الصفوفَ تُعدَّل بعد توليدها، فهي حالةٌ لا اشتقاق.
                      وإعادةُ التوليد تُعيدها إلى القاعدة — يُقال ذلك تحتها. */}
                  <Button tone="secondary"
                    disabled={!rule.startDate || rule.weekdays.length === 0 || rule.count < 1}
                    onClick={() => setRows(buildSeries({
                      startDate: rule.startDate, weekdays: rule.weekdays, count: rule.count,
                      termStart: day(win.start) || null, termEnd: day(win.end) || null,
                    }).map((r, i) => ({
                      key: `${r.date}-${i}`,
                      date: r.date,
                      title: `${form.title.trim() || "اللقاء"} — اللقاء ${i + 1}`,
                      outside: r.outside,
                      reasonAr: r.reasonAr,
                    })))}>
                    اعرِضِ المواعيد
                  </Button>
                </div>
              </div>

              {rows.length > 0 && (
                <Inset as="div" className="grid gap-2">
                  <p className="text-read leading-6 text-muted-foreground">
                    <b className="text-foreground">{keep.length} لقاءً ستُرسَل للاعتماد</b>
                    {rows.length > keep.length && <> · و{rows.length - keep.length} خارجَ الفصل لا تُرسَل</>}.
                    {" "}كلُّ تاريخٍ هنا يصير اجتماعَ زووم — فاقرأها قبل الإرسال. وإعادةُ العرض تُلغي تعديلاتِك.
                  </p>

                  {/* ═══ نصيحةُ التباعد — تُقال ولا تُفرَض ═══
                      «باعِدْ بين لقاءَين أسبوعا على الأقلّ» (١٧ سبتمبر ٢٠٢٦).
                      ودورةٌ مكثّفةٌ في أسبوعٍ قرارُ صاحبها، فالمنصّةُ تنصح. */}
                  {tight && (
                    <p className="text-read leading-6 text-gold-ink">{SPACING_ADVICE_AR}</p>
                  )}

                  <ul className="grid gap-2">
                    {rows.map((r, i) => (
                      <li key={r.key} className="flex flex-wrap items-center gap-2">
                        <span className={`w-6 shrink-0 text-fine font-black ${r.outside ? "text-muted-foreground" : "text-teal-light-ink"}`}>
                          {i + 1}
                        </span>
                        <input type="date" dir="ltr" value={r.date}
                          aria-label={`تاريخُ اللقاء ${i + 1}`}
                          onChange={(e) => {
                            const date = e.target.value;
                            const outside = Boolean(
                              (day(win.start) && date < day(win.start))
                              || (day(win.end) && date > day(win.end)),
                            );
                            setRows(rows.map((x) => (x.key === r.key
                              ? { ...x, date, outside, reasonAr: outside ? "خارج الفصل" : "" }
                              : x)));
                          }}
                          className={`${staffControlCls} w-auto shrink-0 text-left ${r.outside ? "line-through opacity-70" : ""}`} />
                        <input value={r.title}
                          aria-label={`عنوانُ اللقاء ${i + 1}`}
                          onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))}
                          className={`${staffControlCls} min-w-40 flex-1 ${r.outside ? "line-through opacity-70" : ""}`} />
                        {r.outside && <span className="shrink-0 text-fine font-black text-gold-ink">{r.reasonAr}</span>}
                        <Button tone="ghost" size="sm" icon={Trash2} aria-label={`احذف اللقاء ${i + 1}`}
                          onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                          أزِل
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Inset>
              )}
            </>
          )}

          {/* ملاحظاتُ هذا اللقاء — كانت واحدةً للشعبة كلِّها، فتُكتب عامّةً فلا تُقرأ */}
          <StaffField wide label={mode === "series" ? "ملاحظاتٌ تلحق كلَّ لقاءٍ في السلسلة (اختياريّ)" : "ملاحظاتٌ عن اللقاء (اختياريّ)"}
            hint="ما تودّ أن يعرفه المتعلّم قبله: أيُسجَّل؟ أيلزمه شيءٌ يحضّره؟ أتُطلب الكاميرا؟">
            <textarea rows={2} value={form.noteAr} aria-label="ملاحظاتٌ عن اللقاء"
              onChange={(e) => setForm({ ...form, noteAr: e.target.value })} className={staffControlCls} />
          </StaffField>

          {/* ═══ والمرفقُ للمتفرّق وحدَه ═══
              ملفٌّ واحدٌ يُنسخ على اثني عشرَ لقاءً يصير اثنتَي عشرةَ شريحةً
              متطابقةً في تقويم المتعلّم — وموضعُ ملفِّ كلِّ لقاءٍ صفحتُه بعد
              إنشائه، حيث يُقرأ مع سياقه. */}
          {mode === "single" && (
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
          )}

          {/* ═══ اجتماعُ Zoom حقيقةٌ تُقرأ لا سؤالٌ يُسأل ═══

              كانت هنا خانةُ اختيارٍ «أنشئ اجتماعَ Zoom». وسأل صاحبُ المنصّة
              (١٧ سبتمبر ٢٠٢٦): ما الذي يُسأل عنه المدرّبُ وأنت تعلم أنّ
              التدريبَ من خلال زووم خاصٍّ فينا؟ والجوابُ مكتوبٌ في الصفّ
              أصلا: `Cohort.deliveryMode`. فالخانةُ كانت تسأل عمّا تعرفه
              المنصّة.

              وضرَرُها لم يكن سؤالا زائدا فحسب: مدرّبةٌ تقرؤها إذنا ماليّا لا
              تملكه فتُطفئها، فتُعتمَد جلسةٌ بـ`wantsMeeting: false` — أي
              لقاءٌ مباشرٌ بلا اجتماعٍ أصلا، ولا شيءَ في الشاشة يقول ذلك. */}
          <Inset className="flex items-start gap-2 text-read leading-6 text-muted-foreground">
            <Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              يُنشأ اجتماعُ Zoom على حساب الأكاديميّة لحظةَ اعتماد الإدارة، ويصل رابطُه كلَّ مسجَّلٍ
              في الشعبة. <b className="text-foreground">لا حسابَ تملكه ولا رابطَ تلصقه.</b>
            </span>
          </Inset>

          <div>
            <Button tone="confirm" loading={busy}
              disabled={busy || form.title.trim().length < 2 || tooShort
                || (mode === "single" ? !form.date : keep.length === 0)}
              onClick={async () => {
                setBusy(true);
                try {
                  if (mode === "single") {
                    const err = await postOne(form.title, form.date, true);
                    if (err) { toastError(err); return; }
                    setForm({ ...BLANK, from: form.from, to: form.to });
                    setAttachment({});
                    /* ولا يُقال «بُلِّغ ٠ متعلّما»: لم يُبلَّغ أحدٌ بعد، والصدقُ
                       أن يُقال إلى أين ذهب — لا رقمٌ يُقرأ عطبا. */
                    toast("أُرسل اللقاءُ للاعتماد — يصل المسجَّلين حين تعتمده الإدارة");
                  } else {
                    /* ═══ تتابعٌ يقف عند أوّل رفض ═══
                       ما أُنشئ قبله لقاءاتٌ حقيقيّةٌ تُرى في القائمة وتُحذف،
                       فالصدقُ أن يُقال كم مضى وأين وقف — لا «تعذّر» عامّةً
                       تُخفي عشرةً أُنشئت. */
                    let made = 0;
                    let stopped: string | null = null;
                    for (const r of keep) {
                      const err = await postOne(r.title, r.date, false);
                      if (err) { stopped = err; break; }
                      made++;
                    }
                    setRows(stopped ? rows.slice(made) : []);
                    if (stopped) {
                      toastError(`أُنشئ ${made} من ${keep.length} ثمّ توقّف: ${stopped}`);
                    } else {
                      toast(`أُرسلت ${made} لقاءاتٍ للاعتماد — تصل المسجَّلين حين تعتمدها الإدارة`);
                      setForm({ ...BLANK, from: form.from, to: form.to });
                      setRule({ ...BLANK_RULE, startDate: rule.startDate });
                    }
                  }
                  load();
                  onDone();
                } finally {
                  setBusy(false);
                }
              }}>
              {mode === "single" ? "أرسِلْه للاعتماد" : `أرسِلْها للاعتماد (${keep.length})`}
            </Button>
            {/* والشرطُ يُقال قبل النقر لا بعد الرفض */}
            {tooShort && <p className="mt-2 text-read font-bold text-gold-ink">{SHORT_SESSION_AR}.</p>}
            {mode === "series" && rows.length === 0 && (
              <p className="mt-2 text-read text-muted-foreground">اعرِضِ المواعيدَ أوّلا — لا يُرسَل ما لم يُقرَأ.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
