/* لقاءاتُ موعدٍ واحد — المباشرُ والمسجَّلُ معا، مربوطةً بمحاوره.

   ═══ القرار (٢٧ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «بعدها اللقاءاتُ المسجّلة إن وُجدت، والتي يجب أن ترتبط
   بكلّ محور ويحدّد متى تظهر بحسب ربطها بأيّ محور لتظهر في مدّة المحور، ويحقّ
   له أكثرُ من فيديو مسجّل. بعدها اللقاءاتُ المباشرة التي يحدّدها المدرّبُ بفترة
   كلّ محور بحسب ربطه لأيّ محاورَ ستكون هذه الجلسة». ثمّ: «لا بأس أن جمعت بين
   اللقاءات المسجّلة واللقاءات المباشرة في واحدة لأنّهم نفسُ الأثر».

   فصارت خطوةُ اللقاءات بطاقةً لكلّ موعد: محاورُه، وهل لكلٍّ منها لقاءٌ مباشر،
   ولقاءاتُه بمحاورها، وزرٌّ يضيف لقاءً داخله، وجلساتُه المسجّلة. والقاعدةُ —
   لقاءٌ لكلّ محور، وداخلَ الموعد، وتنبيهٌ بعد يومه الثالث — من
   `application/trainer/axis-timeline.ts` نفسِها التي يحكم بها الخادم.

   ═══ ثمّ صارت مرنةً بلا عدد (٤ أكتوبر ٢٠٢٦) ═══

   «يضيف ما شاء من اللقاءات المباشرة، ويربطها بمحورٍ أو اثنين أو أكثر — اجعلها
   مرنةً سهلة، يختارون ما شاؤوا، وقد تعطيهم نصائح… لكن لا تدعه يضع لقاءً لمحورٍ
   في غير وقته». فلا سقفَ على محاور اللقاء ولا على عدد اللقاءات، ويُختار للقاء
   الجديد ما لم يُغطَّ من محاور موعده؛ ووقتُه في وقتها حدٌّ يُقال قبل الإرسال
   ويردّه الخادمُ إن وصل (`sessionInsideSlot` و`assertAxesInTime`). ولا نصيحةَ
   تقلّل العدد: «ساعاتٌ أكثرُ جودةٌ أعلى» (صاحبُ المنصّة، اليومَ نفسَه).

   ═══ ثمّ صارا قائمةً واحدة، والمحورُ باسمه، واليومُ من أيّام الموعد (١١ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «اللقاءُ المباشرُ والجلسةُ المسجّلة يبدوان شيئين لمحورين مختلفين — اجعلهما
   واضحين: إن كانت عندك جلسةٌ مسجّلةٌ فضعها هنا، أو اصنع لقاءً مباشرا، أو الاثنين؛ لقاءين مباشرين إن
   شاء». ثمّ: «حين أختار اللقاءَ وأربطه بمحور أعطني قائمةَ المحاور أختار منها، لا أن أعود فأتذكّر ما كان
   محوري»، و«يومُ اللقاء ويومُ فتح المسجّلة داخلَ وقت المحور — اعرض لي المسموحَ به وحدَه». و«بكلماتٍ
   عربيّةٍ بسيطة».

   فالبطاقةُ: محاورُ الموعد بأسمائها وحالُ كلٍّ منها، ثمّ «لقاءاتُ هذا الموعد» قائمةً واحدةً فيها
   المباشرُ والمسجّلُ كلٌّ بوسمه، وزرّان متجاوران «+ لقاءٌ مباشر» و«+ جلسةٌ مسجّلة». والمحورُ يُختار
   من قائمةٍ بأسمائها (واحدا أو أكثر)، واليومُ من أيّام الموعد وحدَها (`SlotDaySelect`) — للجديد،
   ولتغيير موعد لقاءٍ قائم، وليوم فتح المسجّلة.

   ═══ ولماذا يُكتب الموعدُ بتوقيت عمّان صراحةً ═══

   حدودُ الموعد منتصفُ ليل يومه **في عمّان** (`cohort-period.ts`). ولو قُرئت
   الساعةُ من متصفّح المدرّب لصار لقاءُ الثامنة مساءً في دبيّ السابعةَ في
   عمّان — وقد يقع في يومٍ آخرَ من الموعد وهو لا يدري. فالساعةُ هنا ساعةُ
   الشعبة، ويُقال ذلك تحت الحقل. */

import { useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Check, Film, Lightbulb, TriangleAlert, Video } from "lucide-react";
import { apiPatch, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import SlotDaySelect from "./SlotDaySelect";
import { fmtDateTimeAr } from "@/utils/format";
import { ACADEMY_ZONE, zonedDay, zonedInstant } from "@/application/trainer/cohort-period";
import { SESSION_DAY_ADVICE_AR, sessionDayAdvice } from "@/application/trainer/start-advice";
import {
  EARLY_DAYS, axesLabelAr, dayInSlot, dayLabelAr, sessionInsideSlot, type PlanSlot,
} from "@/application/trainer/axis-timeline";
import {
  SHORT_SESSION_AR, fromSlots, sessionTooShort, slotLabelAr, toMinutes, toSlotsFor,
} from "@/application/trainer/session-length";
import {
  TO_LADDER_WHY_AR, dayNoteAr, fromClockNote, suggestedSessionTitle, toClockNote,
} from "@/application/trainer/session-picker";

/** لقاءٌ كما تعرضه الورشة */
export interface SlotSession {
  id: string; title: string; startsAt: string; endsAt: string | null; status: string;
  approvalState?: string; moduleIds?: string[];
}
/** جلسةٌ مسجّلةٌ في الخطّة — مصدرٌ صنفُه «مسجَّل» */
export interface RecordedRow {
  title: string; url?: string | null; noteAr?: string | null; moduleId?: string | null; opensAt?: string | null;
}

/** اللحظةُ من يومٍ وساعةٍ بتوقيت الشعبة */
const at = (date: string, clock: string) => {
  const m = toMinutes(clock) ?? 0;
  return zonedInstant(date, [Math.floor(m / 60), m % 60, 0, 0]);
};
/** ساعةُ لحظةٍ بتوقيت الشعبة — «18:30» */
const clockOf = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ACADEMY_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
};

export default function SlotSessions({
  cohortId, slot, index, axisNo, titles, sessions, recorded, locked, approvedOnce, onDone, beforeWrite,
  onAddRecorded, onPatchRecorded, onRemoveRecorded,
}: {
  cohortId: string;
  slot: PlanSlot;
  index: number;
  /** رقمُ كلّ محورٍ في الخطّة — «المحور ٣» */
  axisNo: ReadonlyMap<string, number>;
  /** عنوانُ كلّ محور — منه يُقترح عنوانُ اللقاء مثالا باهتا لا قيمةً مكتوبة */
  titles: ReadonlyMap<string, string>;
  /** لقاءاتُ المدرّب التي أوّلُ محاورها في هذا الموعد */
  sessions: SlotSession[];
  /** جلساتُه المسجّلة — بموضعها في مصادر الخطّة */
  recorded: { row: RecordedRow; i: number }[];
  locked: boolean;
  /** اعتُمدت خطّتُه من قبل — فيُقال له ما يسري لحظتَه وما ينتظر الإدارة */
  approvedOnce: boolean;
  onDone: () => void;
  /** يحفظ مواعيدَ المحاور إن عُدّلت ولم تُحفظ — فالخادمُ يحكم على وقت اللقاء بالمحفوظ */
  beforeWrite?: () => Promise<boolean>;
  onAddRecorded: (row: RecordedRow) => void;
  onPatchRecorded: (i: number, patch: Partial<RecordedRow>) => void;
  onRemoveRecorded: (i: number) => void;
}) {
  const axes = slot.moduleIds;
  const label = axesLabelAr(axes, axisNo);
  const covered = new Set(sessions.flatMap((s) => s.moduleIds ?? []));
  /* اللقاءُ الجديدُ لما لم يُغطَّ من محاور الموعد — كلِّها إن غُطّيت — وللمدرّب أن يغيّر */
  const uncovered = axes.filter((id) => !covered.has(id));
  /* ═══ نموذجٌ فارغٌ — المدرّبُ يكتب، والمنصّةُ تقترح (١١ أكتوبر ٢٠٢٦) ═══

     كان يُفتح على «اللقاء المباشر · المحور ٣» مكتوبا، ويومِ بدء الموعد، ومن
     السادسة إلى الثامنة مساءً — قيمٌ يمسحها المدرّبُ أوّلا، أو تُرسَل كما هي
     بموعدٍ لم يقصده (ملفُّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»). فصار كلُّ
     حقلٍ فارغا: العنوانُ مثالٌ باهتٌ من عناوين محاوره — وإن تُرك فارغا سُمّي به —
     واليومُ والساعتان لا يُحفظ اللقاءُ حتّى يُختارا. */
  const blank = () => ({
    title: "",
    date: "", from: "", to: "", noteAr: "",
    moduleIds: uncovered.length > 0 ? uncovered : [...axes],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const FROM = useMemo(() => fromSlots(), []);
  const TO = useMemo(() => toSlotsFor(form.from), [form.from]);

  const suggested = suggestedSessionTitle(form.moduleIds.length ? form.moduleIds : axes, titles, axisNo);
  const title = form.title.trim() || suggested;
  const timed = Boolean(form.date && form.from && form.to);
  const formDay = form.date ? dayInSlot(at(form.date, form.from || "00:00"), slot) : 1;
  const tooShort = timed && sessionTooShort(at(form.date, form.from), at(form.date, form.to));
  const dayNote = form.date ? dayNoteAr(form.date) : null;
  /* ═══ واللقاءُ في وقت محاوره — يُقال قبل الإرسال لا بعد ردّه (٤ أكتوبر ٢٠٢٦) ═══
     حدودُ الحقل (`min`/`max`) تُرشد ولا تمنع: اليومُ يُكتب باليد. فيُحكم بالقاعدة
     التي يحجب بها الإرسالُ ويردّ بها الخادم (`sessionInsideSlot`). */
  const outside = Boolean(form.date) && !sessionInsideSlot({ startsAt: at(form.date, form.from || "00:00"), endsAt: at(form.date, form.to || form.from || "00:00") }, slot);

  /** «المحور 3 · عنوانُه» — يُختار المحورُ باسمه، لا برقمه وحدَه */
  const axisNameAr = (id: string) => {
    const t = titles.get(id)?.trim();
    return `المحور ${axisNo.get(id) ?? "؟"}${t ? ` · ${t}` : ""}`;
  };

  /* ── تغييرُ موعد لقاءٍ قائم — من أيّام الموعد وحدَها ── */
  const [moving, setMoving] = useState<string | null>(null);
  const [move, setMove] = useState({ date: "", from: "", to: "" });
  const MOVE_TO = useMemo(() => toSlotsFor(move.from), [move.from]);
  const startMove = (s: SlotSession) => {
    setMoving(moving === s.id ? null : s.id);
    setMove({ date: "", from: "", to: "" });
  };
  const saveMove = async (s: SlotSession) => {
    setBusy(true);
    try {
      if (beforeWrite && !(await beforeWrite())) return;
      const moved = await apiPatch<{ approvalState?: string }>(`/api/trainer/sessions/${s.id}`, {
        startsAt: at(move.date, move.from), endsAt: at(move.date, move.to),
      });
      toast(moved?.approvalState === "approved"
        ? `غيّر موعد «${s.title}» وبقي معتمدا — ووصل متعلّميك موعده الجديد`
        : `غيّر موعد «${s.title}»`);
      setMoving(null);
      onDone();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تغيير الموعد");
    } finally {
      setBusy(false);
    }
  };

  /* ── ربطُ لقاءٍ قائمٍ بمحاوره ── محورٌ أو أكثر من موعده، ولا يُترك بلا محور */
  const relink = async (s: SlotSession, id: string, on: boolean) => {
    const cur = s.moduleIds ?? [];
    const next = on ? [...cur, id] : cur.filter((x) => x !== id);
    if (next.length === 0) return;
    setBusy(true);
    try {
      if (beforeWrite && !(await beforeWrite())) return;
      await apiPatch(`/api/trainer/sessions/${s.id}/axes`, { moduleIds: next });
      /* ويسري فورا بلا اعتماد، ولو بعد اعتماد الخطّة (٢٨ سبتمبر ٢٠٢٦): المعتمَدُ
         يبقى معتمَدا، ومتعلّموه يرون أثرَه في «متى تُفتح المهامّ» — فيُقال له */
      toast(s.approvalState === "approved"
        ? `ربط «${s.title}» بـ${axesLabelAr(next, axisNo)} — ويسري لمتعلّميك فورا بلا اعتماد`
        : `ربط «${s.title}» بـ${axesLabelAr(next, axisNo)}`);
      onDone();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الربط");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      if (beforeWrite && !(await beforeWrite())) return;
      await apiPost(`/api/trainer/cohorts/${cohortId}/sessions`, {
        title,
        startsAt: at(form.date, form.from),
        endsAt: at(form.date, form.to),
        moduleIds: form.moduleIds,
        noteAr: form.noteAr.trim() || null,
      });
      /* «احفظ اللقاء» لا «أرسِله للاعتماد»: الاعتمادُ يقع مع الخطّة كلِّها في خطوتها
         الأخيرة — والزرُّ في كلّ لقاءٍ كان يوحي بأنّ كلَّ لقاءٍ إرسالٌ نهائيّ */
      toast(approvedOnce
        ? "حفظ اللقاء — وينتظر اعتماد الإدارة قبل أن يراه المسجّلون"
        : "حفظ اللقاء — ويعتمد مع خطّتك حين ترسلها");
      setForm(blank());
      setOpen(false);
      onDone();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّرت إضافة اللقاء");
    } finally {
      setBusy(false);
    }
  };

  /* المحاورُ قائمةٌ تُختار — بأسمائها، واحدا أو أكثر، ولا يُترك اللقاءُ بلا محور */
  const axisPicker = (chosen: readonly string[], options: readonly string[], toggle: (id: string, on: boolean) => void, legend: string) => (
    <fieldset className="flex flex-wrap gap-2" disabled={locked || busy}>
      <legend className="sr-only">{legend}</legend>
      {options.map((id) => {
        const on = chosen.includes(id);
        const last = on && chosen.length === 1;
        return (
          <label key={id} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-1.5 text-read ${on ? "bg-teal/15 font-black text-teal-light-ink" : "bg-white/[0.04] text-muted-foreground"} ${last ? "opacity-80" : "cursor-pointer"}`}>
            <input type="checkbox" checked={on} disabled={last}
              onChange={(e) => toggle(id, e.target.checked)}
              className="h-4 w-4 accent-[var(--teal)]" />
            {axisNameAr(id)}
          </label>
        );
      })}
    </fieldset>
  );

  const count = sessions.length + recorded.length;

  return (
    <Card as="li" className="grid gap-4">
      <div>
        <p className="text-read font-black text-teal-light-ink">
          الموعد {index + 1} <span className="font-bold text-foreground">· {label}</span>
        </p>
        <p className="mt-0.5 text-read text-muted-foreground">
          من {dayLabelAr(slot.startsOn)} إلى {dayLabelAr(slot.endsOn)}. الأنسب أن يكون اللقاء في أوّل {EARLY_DAYS} أيّام، لأنّ المهامّ تفتح بعده.
        </p>
      </div>

      {/* ② محاورُ الموعد بأسمائها — ولكلٍّ لقاءٌ مباشر؟ يُرى قبل الإرسال لا بعد الردّ */}
      <ul className="grid gap-1.5" aria-label="لقاء كلّ محور">
        {axes.map((id) => (
          <li key={id} className="flex items-start gap-2 text-read">
            {covered.has(id)
              ? <Check className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              : <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />}
            <span>
              <b className="text-foreground">{axisNameAr(id)}</b>
              <span className={covered.has(id) ? "text-teal-light-ink" : "text-gold-ink"}> — {covered.has(id) ? "له لقاء مباشر" : "ليس له لقاء مباشر بعد"}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* ═══ لقاءاتُ هذا الموعد — المباشرُ والمسجّلُ في قائمةٍ واحدة ═══ */}
      <div className="grid gap-2 border-t border-white/10 pt-3">
        <p className="text-read font-black text-foreground">لقاءات هذا الموعد</p>
        <p className="text-read leading-6 text-muted-foreground">
          أضف لقاء مباشرا، أو جلسة مسجّلة، أو الاثنين — وما شئت من كلّ منهما، لمحور واحد أو أكثر.
        </p>
        {/* وبعد الاعتماد يُقال أيُّها يسري لحظتَه وأيُّها ينتظر (٢٨ سبتمبر ٢٠٢٦):
            الموضعُ — المحورُ ويومُ الفتح — يُكتب في المعتمَدة متى حفظ، والباقي مراجعة
            (`recorded-links.ts`) */}
        {approvedOnce && recorded.length > 0 && (
          <p className="text-read leading-6 text-muted-foreground">
            خطّتك معتمدة — في الجلسة المسجّلة: المحور ويوم الفتح يسريان فورا، وغيرهما تعتمده الإدارة.
          </p>
        )}
        {count === 0 && <p className="text-read text-muted-foreground">لا شيء بعد.</p>}

        {count > 0 && (
          <ul className="grid gap-2">
            {sessions.map((s) => {
              const day = dayInSlot(s.startsAt, slot);
              /* بالقاعدة التي يحجب بها الإرسال — بدؤه ونهايتُه بين حدّيه بعمّان */
              const outside = !sessionInsideSlot(s, slot);
              const pending = s.approvalState === "pending";
              const choices = [...new Set([...axes, ...(s.moduleIds ?? [])])];
              const moveTimed = Boolean(move.date && move.from && move.to);
              return (
                <Inset as="li" key={s.id} className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="info" icon={Video}>مباشر</Chip>
                    <span className="text-read font-bold text-foreground">{s.title}</span>
                  </div>
                  <p className="text-read text-muted-foreground">
                    {fmtDateTimeAr(s.startsAt)} · {pending ? "ينتظر اعتماد الإدارة" : "معتمد"}
                  </p>
                  {outside
                    ? <p className="text-read font-bold text-gold-ink">يومه خارج وقت هذا الموعد — غيّر موعده إلى يوم داخله.</p>
                    : day > EARLY_DAYS && <p className="text-read text-gold-ink">في اليوم {day} من الموعد — والأنسب أوّل {EARLY_DAYS} أيّام.</p>}
                  {/* محاورُ اللقاء — يُضاف ما شاء من محاور موعده أو يُرفع، ولا يُترك بلا محور */}
                  {axisPicker(s.moduleIds ?? [], choices, (id, on) => void relink(s, id, on), `محاور «${s.title}»`)}
                  <div>
                    <Button tone={outside ? "secondary" : "ghost"} size="sm" icon={CalendarClock} disabled={locked || busy}
                      onClick={() => startMove(s)}>
                      غيّر موعده
                    </Button>
                  </div>
                  {moving === s.id && (
                    <Inset tone="accent" className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <StaffField label="اليوم" hint="أيّام هذا الموعد فقط.">
                          <SlotDaySelect slot={slot} value={move.date} ariaLabel={`اليوم الجديد لـ«${s.title}»`}
                            onChange={(date) => setMove({ ...move, date })} />
                        </StaffField>
                        <StaffField label="من الساعة" hint="بتوقيت عمّان.">
                          <select value={move.from} aria-label={`ساعة البدء الجديدة لـ«${s.title}»`}
                            onChange={(e) => setMove({ ...move, from: e.target.value, to: toSlotsFor(e.target.value).includes(move.to) ? move.to : "" })}
                            className={staffControlCls}>
                            <option value="">اختر الساعة</option>
                            {FROM.map((c) => {
                              const note = move.date ? fromClockNote(move.date, c) : null;
                              return <option key={c} value={c}>{slotLabelAr(c)}{note ? ` · ${note}` : ""}</option>;
                            })}
                          </select>
                        </StaffField>
                        <StaffField label="إلى الساعة" hint={TO_LADDER_WHY_AR}>
                          <select value={move.to} disabled={!move.from} aria-label={`ساعة الانتهاء الجديدة لـ«${s.title}»`}
                            onChange={(e) => setMove({ ...move, to: e.target.value })} className={staffControlCls}>
                            <option value="">{move.from ? "اختر الساعة" : "اختر البدء أوّلا"}</option>
                            {MOVE_TO.map((c) => {
                              const note = toClockNote(c);
                              return <option key={c} value={c}>{slotLabelAr(c)}{note ? ` · ${note}` : ""}</option>;
                            })}
                          </select>
                        </StaffField>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button tone="confirm" size="sm" loading={busy} disabled={busy || !moveTimed} onClick={() => void saveMove(s)}>
                          احفظ الموعد الجديد
                        </Button>
                        <Button tone="ghost" size="sm" disabled={busy} onClick={() => setMoving(null)}>إلغاء</Button>
                      </div>
                    </Inset>
                  )}
                </Inset>
              );
            })}

            {/* ═══ الجلساتُ المسجّلة — «ويحقّ له أكثرُ من فيديو مسجّل» ═══
                تُحفظ مع الخطّة بزرّ الشريط، وتُفتح للمتعلّم في لحظتها داخلَ الموعد —
                ولحظةُ فتحها «انتهاؤها»: بعدها تُفتح مهامُّ محورها إن سبقت اللقاءَ المباشر. */}
            {recorded.map(({ row, i }) => {
              const date = row.opensAt ? zonedDay(row.opensAt) : "";
              const clock = row.opensAt ? clockOf(row.opensAt) : "08:00";
              const outside = date !== "" && (date < slot.startsOn || date > slot.endsOn);
              return (
                <Inset as="li" key={`r${i}`} className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="neutral" icon={Film}>مسجّلة</Chip>
                    <span className="text-read font-bold text-foreground">{row.title.trim() || "جلسة مسجّلة"}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input value={row.title} disabled={locked} placeholder="اسم الجلسة — مثال: «التحليل العمليّ»"
                      aria-label={`اسم الجلسة المسجّلة ${i + 1}`}
                      onChange={(e) => onPatchRecorded(i, { title: e.target.value })} className={staffControlCls} />
                    <input dir="ltr" value={row.url ?? ""} disabled={locked} placeholder="https://…"
                      aria-label={`رابط الجلسة المسجّلة ${i + 1}`}
                      onChange={(e) => onPatchRecorded(i, { url: e.target.value })} className={`${staffControlCls} text-left`} />
                    <Button tone="ghost" size="sm" disabled={locked} onClick={() => onRemoveRecorded(i)}>احذفها</Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <StaffField label="لأيّ محور؟">
                      <select value={row.moduleId ?? axes[0] ?? ""} disabled={locked} aria-label={`محور الجلسة المسجّلة ${i + 1}`}
                        onChange={(e) => onPatchRecorded(i, { moduleId: e.target.value || null })} className={staffControlCls}>
                        {axes.map((id) => <option key={id} value={id}>{axisNameAr(id)}</option>)}
                      </select>
                    </StaffField>
                    <StaffField label="تفتح للمتعلّم يوم" hint="أيّام هذا الموعد فقط.">
                      <SlotDaySelect slot={slot} value={date} disabled={locked} ariaLabel={`يوم فتح الجلسة المسجّلة ${i + 1}`}
                        onChange={(d) => onPatchRecorded(i, { opensAt: at(d, clock).toISOString() })} />
                    </StaffField>
                    <StaffField label="الساعة" hint="بتوقيت عمّان.">
                      <select value={clock} disabled={locked} aria-label={`ساعة فتح الجلسة المسجّلة ${i + 1}`}
                        onChange={(e) => date && onPatchRecorded(i, { opensAt: at(date, e.target.value).toISOString() })}
                        className={staffControlCls}>
                        {FROM.map((c) => <option key={c} value={c}>{slotLabelAr(c)}</option>)}
                      </select>
                    </StaffField>
                  </div>
                  {outside && <p className="text-read font-bold text-gold-ink">يوم فتحها خارج وقت هذا الموعد — اختر يوما من القائمة.</p>}
                </Inset>
              );
            })}
          </ul>
        )}

        {/* ── زرّان متجاوران: لقاءٌ مباشرٌ أو جلسةٌ مسجّلة — ما شاء منهما ── */}
        {!open && (
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" size="sm" icon={CalendarPlus} disabled={locked} onClick={() => { setForm(blank()); setOpen(true); }}>
              + لقاء مباشر
            </Button>
            <Button tone="secondary" size="sm" icon={Film} disabled={locked}
              onClick={() => onAddRecorded({
                title: "", url: "", moduleId: uncovered[0] ?? axes[0] ?? null,
                opensAt: at(slot.startsOn, "08:00").toISOString(),
              })}>
              + جلسة مسجّلة
            </Button>
          </div>
        )}
        {recorded.length > 0 && (
          <p className="text-read leading-6 text-muted-foreground">الجلسة المسجّلة تحفظ مع خطّتك بزرّ «احفظ» في أعلى الصفحة.</p>
        )}
      </div>

      {/* ── لقاءٌ مباشرٌ جديد: المحورُ أوّلا، ثمّ اليومُ من أيّام الموعد، ثمّ الساعة ── */}
      {open && (
        <Inset tone="accent" className="grid gap-3">
          <p className="flex items-center gap-2 text-read font-black text-foreground">
            <Video className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> لقاء مباشر جديد
          </p>
          <StaffField as="div" wide label="لأيّ محور؟" hint="اختر محورا أو أكثر — تفتح مهامّها بعد اللقاء.">
            {axisPicker(form.moduleIds, axes, (id, on) => setForm({ ...form, moduleIds: on ? [...form.moduleIds, id] : form.moduleIds.filter((x) => x !== id) }), `محاور اللقاء الجديد في الموعد ${index + 1}`)}
          </StaffField>
          <div className="grid gap-3 sm:grid-cols-3">
            <StaffField label="اليوم" hint={`أيّام هذا الموعد فقط: من ${dayLabelAr(slot.startsOn)} إلى ${dayLabelAr(slot.endsOn)}.`}>
              <SlotDaySelect slot={slot} value={form.date} ariaLabel={`يوم اللقاء في الموعد ${index + 1}`}
                onChange={(date) => setForm({ ...form, date })} />
            </StaffField>
            <StaffField label="من الساعة" hint="بتوقيت عمّان.">
              <select value={form.from} aria-label={`ساعة بدء اللقاء في الموعد ${index + 1}`}
                onChange={(e) => {
                  const from = e.target.value;
                  /* وما اختاره في «إلى» يبقى إن صلح — ولا يُملأ عنه إن لم يصلح */
                  setForm({ ...form, from, to: toSlotsFor(from).includes(form.to) ? form.to : "" });
                }}
                className={staffControlCls}>
                <option value="">اختر الساعة</option>
                {FROM.map((c) => {
                  const note = form.date ? fromClockNote(form.date, c) : null;
                  return <option key={c} value={c}>{slotLabelAr(c)}{note ? ` · ${note}` : ""}</option>;
                })}
              </select>
            </StaffField>
            <StaffField label="إلى الساعة" hint={TO_LADDER_WHY_AR}>
              <select value={form.to} disabled={!form.from} aria-label={`ساعة انتهاء اللقاء في الموعد ${index + 1}`}
                onChange={(e) => setForm({ ...form, to: e.target.value })} className={staffControlCls}>
                <option value="">{form.from ? "اختر الساعة" : "اختر البدء أوّلا"}</option>
                {TO.map((c) => {
                  const note = toClockNote(c);
                  return <option key={c} value={c}>{slotLabelAr(c)}{note ? ` · ${note}` : ""}</option>;
                })}
              </select>
            </StaffField>
          </div>
          <StaffField wide label="عنوان اللقاء (اختياريّ)" hint={`يراه المتعلّم في تقويمه. إن تركته فارغا سمّيناه «${suggested}».`}>
            <input value={form.title} placeholder={`مثال: ${suggested}`} aria-label={`عنوان اللقاء في الموعد ${index + 1}`}
              onChange={(e) => setForm({ ...form, title: e.target.value })} className={staffControlCls} />
          </StaffField>
          <StaffField wide label="ملاحظة عن اللقاء (اختياريّ)" hint="هل يسجّل؟ هل يحضّر المتعلّم شيئا قبله؟">
            <textarea rows={2} value={form.noteAr} aria-label={`ملاحظات اللقاء في الموعد ${index + 1}`}
              onChange={(e) => setForm({ ...form, noteAr: e.target.value })} className={staffControlCls} />
          </StaffField>
          {outside ? (
            <p className="text-read font-bold text-gold-ink">
              هذا اليوم خارج وقت {label} — اختر يوما من القائمة.
            </p>
          ) : formDay > EARLY_DAYS && (
            <p className="text-read text-gold-ink">هذا اليوم {formDay} من الموعد — الأنسب أوّل {EARLY_DAYS} أيّام، لأنّ المهامّ تفتح بعد اللقاء. ولك أن تبقيه.</p>
          )}
          {!outside && dayNote && (
            <p className="flex items-start gap-2 text-read leading-6 text-gold-ink">
              <Lightbulb className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{dayNote}</span>
            </p>
          )}
          {tooShort && <p className="text-read font-bold text-gold-ink">{SHORT_SESSION_AR}.</p>}
          {/* ونصيحةُ البدء حين يُختار يومٌ قبل أواخر نوفمبر — ودودةٌ لا تمنع (`start-advice.ts`) */}
          {!outside && sessionDayAdvice(form.date, zonedDay(new Date())) && (
            <p className="flex items-start gap-2 text-read leading-6 text-teal-light-ink">
              <Lightbulb className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{SESSION_DAY_ADVICE_AR}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" size="sm" loading={busy}
              disabled={busy || title.length < 2 || !timed || outside || tooShort || form.moduleIds.length === 0}
              onClick={() => void add()}>
              احفظ اللقاء
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </Inset>
      )}
    </Card>
  );
}
