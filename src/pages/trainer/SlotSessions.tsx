/* لقاءاتُ موعدٍ واحد — المباشرُ والمسجَّلُ معا، مربوطةً بمحاوره.

   ═══ القرار (٢٧ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «بعدها اللقاءاتُ المسجّلة إن وُجدت، والتي يجب أن ترتبط
   بكلّ محور ويحدّد متى تظهر بحسب ربطها بأيّ محور لتظهر في مدّة المحور، ويحقّ
   له أكثرُ من فيديو مسجّل. بعدها اللقاءاتُ المباشرة التي يحدّدها المدرّبُ بفترة
   كلّ محور بحسب ربطه لأيّ محاورَ ستكون هذه الجلسة». ثمّ: «لا بأس أن جمعت بين
   اللقاءات المسجّلة واللقاءات المباشرة في واحدة لأنّهم نفسُ الأثر».

   فصارت خطوةُ اللقاءات بطاقةً لكلّ موعد: محاورُه، وهل لكلٍّ منها لقاءٌ مباشر،
   ولقاءاتُه بمحاورها، وزرٌّ يضيف لقاءً داخله، وجلساتُه المسجّلة. والقاعدةُ —
   لقاءٌ لكلّ محور، ولمحورٍ أو محورين، وداخلَ الموعد، وتنبيهٌ بعد يومه الثالث —
   من `application/trainer/axis-timeline.ts` نفسِها التي يحكم بها الخادم.

   ═══ ولماذا يُكتب الموعدُ بتوقيت عمّان صراحةً ═══

   حدودُ الموعد منتصفُ ليل يومه **في عمّان** (`cohort-period.ts`). ولو قُرئت
   الساعةُ من متصفّح المدرّب لصار لقاءُ الثامنة مساءً في دبيّ السابعةَ في
   عمّان — وقد يقع في يومٍ آخرَ من الموعد وهو لا يدري. فالساعةُ هنا ساعةُ
   الشعبة، ويُقال ذلك تحت الحقل. */

import { useMemo, useState } from "react";
import { CalendarPlus, Check, Film, TriangleAlert } from "lucide-react";
import { apiPatch, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateTimeAr } from "@/utils/format";
import { ACADEMY_ZONE, zonedDay, zonedInstant } from "@/application/trainer/cohort-period";
import {
  EARLY_DAYS, MAX_AXES_PER_SESSION, axesLabelAr, dayInSlot, dayLabelAr, type PlanSlot,
} from "@/application/trainer/axis-timeline";
import {
  SHORT_SESSION_AR, firstToFor, fromSlots, sessionTooShort, slotLabelAr, toMinutes, toSlotsFor,
} from "@/application/trainer/session-length";

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
  cohortId, slot, index, axisNo, sessions, recorded, locked, onDone,
  onAddRecorded, onPatchRecorded, onRemoveRecorded,
}: {
  cohortId: string;
  slot: PlanSlot;
  index: number;
  /** رقمُ كلّ محورٍ في الخطّة — «المحور ٣» */
  axisNo: ReadonlyMap<string, number>;
  /** لقاءاتُ المدرّب التي أوّلُ محاورها في هذا الموعد */
  sessions: SlotSession[];
  /** جلساتُه المسجّلة — بموضعها في مصادر الخطّة */
  recorded: { row: RecordedRow; i: number }[];
  locked: boolean;
  onDone: () => void;
  onAddRecorded: (row: RecordedRow) => void;
  onPatchRecorded: (i: number, patch: Partial<RecordedRow>) => void;
  onRemoveRecorded: (i: number) => void;
}) {
  const axes = slot.moduleIds;
  const label = axesLabelAr(axes, axisNo);
  const blank = useMemo(() => ({
    title: `اللقاء المباشر · ${label}`,
    date: slot.startsOn, from: "18:00", to: "20:00", noteAr: "",
    moduleIds: axes.slice(0, MAX_AXES_PER_SESSION),
  }), [label, slot.startsOn, axes]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const FROM = useMemo(() => fromSlots(), []);
  const TO = useMemo(() => toSlotsFor(form.from), [form.from]);

  const covered = new Set(sessions.flatMap((s) => s.moduleIds ?? []));
  const formDay = form.date ? dayInSlot(at(form.date, form.from), slot) : 1;
  const tooShort = sessionTooShort(at(form.date || slot.startsOn, form.from), at(form.date || slot.startsOn, form.to));

  /* ── ربطُ لقاءٍ قائمٍ بمحاوره ── واحدٌ أو اثنان، ولا يُترك بلا محور */
  const relink = async (s: SlotSession, id: string, on: boolean) => {
    const cur = s.moduleIds ?? [];
    const next = on ? [...cur, id] : cur.filter((x) => x !== id);
    if (next.length === 0 || next.length > MAX_AXES_PER_SESSION) return;
    setBusy(true);
    try {
      await apiPatch(`/api/trainer/sessions/${s.id}/axes`, { moduleIds: next });
      toast(`رُبط «${s.title}» بـ${axesLabelAr(next, axisNo)}`);
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
      await apiPost(`/api/trainer/cohorts/${cohortId}/sessions`, {
        title: form.title.trim(),
        startsAt: at(form.date, form.from),
        endsAt: at(form.date, form.to),
        moduleIds: form.moduleIds,
        noteAr: form.noteAr.trim() || null,
      });
      toast("أُرسل اللقاءُ للاعتماد — يصل المسجَّلين حين تعتمده الإدارة");
      setForm(blank);
      setOpen(false);
      onDone();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّرت إضافةُ اللقاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="li" className="grid gap-3">
      <div>
        <p className="text-read font-black text-teal-light-ink">
          الموعد {index + 1} <span className="font-bold text-foreground">· {label}</span>
        </p>
        <p className="mt-0.5 text-read text-muted-foreground">
          من {dayLabelAr(slot.startsOn)} إلى {dayLabelAr(slot.endsOn)} — والأصلُ أن يكون اللقاءُ في أوّل {EARLY_DAYS} أيّامٍ منه، فبعده تُفتح المهامّ.
        </p>
      </div>

      {/* ② لكلّ محورٍ لقاءٌ مباشر — يُرى محورا محورا قبل الإرسال لا بعد الردّ */}
      <ul className="flex flex-wrap gap-2" aria-label="لقاءُ كلّ محور">
        {axes.map((id) => (
          <li key={id}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-fine font-black ${
              covered.has(id) ? "bg-teal/15 text-teal-light-ink" : "bg-gold/15 text-gold-ink"
            }`}>
            {covered.has(id) ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
            المحور {axisNo.get(id)} — {covered.has(id) ? "له لقاءٌ مباشر" : "بلا لقاءٍ مباشر"}
          </li>
        ))}
      </ul>

      {sessions.length > 0 && (
        <ul className="grid gap-2">
          {sessions.map((s) => {
            const day = dayInSlot(s.startsAt, slot);
            const outside = zonedDay(s.startsAt) < slot.startsOn || zonedDay(s.startsAt) > slot.endsOn;
            const pending = s.approvalState === "pending";
            const choices = [...new Set([...axes, ...(s.moduleIds ?? [])])];
            return (
              <Inset as="li" key={s.id} className="grid gap-2">
                <div>
                  <p className="text-read font-bold text-foreground">{s.title}</p>
                  <p className="text-read text-muted-foreground">
                    {fmtDateTimeAr(s.startsAt)} · {pending ? "بانتظار اعتماد الإدارة" : "معتمَد"}
                  </p>
                  {outside
                    ? <p className="text-read font-bold text-gold-ink">خارجَ هذا الموعد — انقله إلى داخله من «اللقاءاتُ المجدولة» أسفلَ الصفحة.</p>
                    : day > EARLY_DAYS && <p className="text-read text-gold-ink">في اليوم {day} من موعده — والأصلُ في أوّل {EARLY_DAYS} أيّام.</p>}
                </div>
                {/* محورا اللقاء — يُضاف ثانٍ أو يُرفع، ولا يُترك بلا محور */}
                {choices.length > 1 && (
                  <fieldset className="flex flex-wrap gap-2" disabled={locked || busy}>
                    <legend className="sr-only">محاورُ «{s.title}»</legend>
                    {choices.map((id) => {
                      const on = (s.moduleIds ?? []).includes(id);
                      const full = !on && (s.moduleIds ?? []).length >= MAX_AXES_PER_SESSION;
                      const last = on && (s.moduleIds ?? []).length === 1;
                      return (
                        <label key={id} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-1.5 text-read ${on ? "bg-teal/15 font-black text-teal-light-ink" : "text-muted-foreground"} ${full || last ? "opacity-60" : "cursor-pointer"}`}>
                          <input type="checkbox" checked={on} disabled={full || last}
                            onChange={(e) => void relink(s, id, e.target.checked)}
                            className="h-4 w-4 accent-[var(--teal)]" />
                          المحور {axisNo.get(id) ?? "؟"}
                        </label>
                      );
                    })}
                  </fieldset>
                )}
              </Inset>
            );
          })}
        </ul>
      )}

      {/* ── لقاءٌ جديدٌ داخلَ الموعد ── */}
      {!open ? (
        <div>
          <Button tone="secondary" size="sm" icon={CalendarPlus} disabled={locked} onClick={() => { setForm(blank); setOpen(true); }}>
            + لقاءٌ مباشر
          </Button>
        </div>
      ) : (
        <Inset tone="accent" className="grid gap-3">
          <StaffField wide label="عنوانُ اللقاء" hint="ما يراه المتعلّم في تقويمه.">
            <input value={form.title} aria-label={`عنوانُ اللقاء في الموعد ${index + 1}`}
              onChange={(e) => setForm({ ...form, title: e.target.value })} className={staffControlCls} />
          </StaffField>
          <div className="grid gap-3 sm:grid-cols-3">
            <StaffField label="اليوم" hint="داخلَ هذا الموعد.">
              <input type="date" dir="ltr" value={form.date} min={slot.startsOn} max={slot.endsOn}
                aria-label={`يومُ اللقاء في الموعد ${index + 1}`}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={`${staffControlCls} text-left`} />
            </StaffField>
            <StaffField label="من الساعة" hint="بتوقيت الشعبة (عمّان).">
              <select value={form.from} aria-label={`ساعةُ بدء اللقاء في الموعد ${index + 1}`}
                onChange={(e) => {
                  const from = e.target.value;
                  setForm({ ...form, from, to: toSlotsFor(from).includes(form.to) ? form.to : firstToFor(from) });
                }}
                className={staffControlCls}>
                {FROM.map((c) => <option key={c} value={c}>{slotLabelAr(c)}</option>)}
              </select>
            </StaffField>
            <StaffField label="إلى الساعة" hint="ساعتان على الأقلّ.">
              <select value={form.to} aria-label={`ساعةُ انتهاء اللقاء في الموعد ${index + 1}`}
                onChange={(e) => setForm({ ...form, to: e.target.value })} className={staffControlCls}>
                {TO.map((c) => <option key={c} value={c}>{slotLabelAr(c)}</option>)}
              </select>
            </StaffField>
          </div>
          {axes.length > 1 && (
            <StaffField as="div" wide label="لأيّ محور؟" hint="محورٌ أو محوران من هذا الموعد — وبعد انتهاء اللقاء تُفتح مهامُّهما.">
              <div className="flex flex-wrap gap-2">
                {axes.map((id) => {
                  const on = form.moduleIds.includes(id);
                  const full = !on && form.moduleIds.length >= MAX_AXES_PER_SESSION;
                  return (
                    <label key={id} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-1.5 text-read ${on ? "bg-teal/15 font-black text-teal-light-ink" : "text-muted-foreground"} ${full ? "opacity-60" : "cursor-pointer"}`}>
                      <input type="checkbox" checked={on} disabled={full}
                        onChange={() => setForm({ ...form, moduleIds: on ? form.moduleIds.filter((x) => x !== id) : [...form.moduleIds, id] })}
                        className="h-4 w-4 accent-[var(--teal)]" />
                      المحور {axisNo.get(id)}
                    </label>
                  );
                })}
              </div>
            </StaffField>
          )}
          <StaffField wide label="ملاحظاتٌ عن اللقاء (اختياريّ)" hint="أيُسجَّل؟ أيلزمه شيءٌ يحضّره؟">
            <textarea rows={2} value={form.noteAr} aria-label={`ملاحظاتُ اللقاء في الموعد ${index + 1}`}
              onChange={(e) => setForm({ ...form, noteAr: e.target.value })} className={staffControlCls} />
          </StaffField>
          {formDay > EARLY_DAYS && (
            <p className="text-read text-gold-ink">هذا اليومُ {formDay} من الموعد — والأصلُ أن يكون اللقاءُ في أوّل {EARLY_DAYS} أيّام، فبعده تُفتح المهامّ. ولك أن تُبقيه.</p>
          )}
          {tooShort && <p className="text-read font-bold text-gold-ink">{SHORT_SESSION_AR}.</p>}
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" size="sm" loading={busy}
              disabled={busy || form.title.trim().length < 2 || !form.date || tooShort || form.moduleIds.length === 0}
              onClick={() => void add()}>
              أرسِلْه للاعتماد
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>أغلِق</Button>
          </div>
        </Inset>
      )}

      {/* ═══ الجلساتُ المسجّلة — «ويحقّ له أكثرُ من فيديو مسجّل» ═══
          تُحفظ مع الخطّة بزرّ الشريط، وتُفتح للمتعلّم في لحظتها داخلَ الموعد —
          ولحظةُ فتحها «انتهاؤها»: بعدها تُفتح مهامُّ محورها إن سبقت اللقاءَ المباشر. */}
      <div className="grid gap-2 border-t border-white/10 pt-3">
        <p className="flex items-center gap-2 text-read font-black text-foreground">
          <Film className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" /> جلساتٌ مسجّلة (اختياريّ)
        </p>
        {recorded.map(({ row, i }) => {
          const date = row.opensAt ? zonedDay(row.opensAt) : slot.startsOn;
          const clock = row.opensAt ? clockOf(row.opensAt) : "08:00";
          return (
            <Inset key={i} className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input value={row.title} disabled={locked} placeholder="اسمُ الجلسة — «التحليل العمليّ · مسجّل»"
                  aria-label={`اسمُ الجلسة المسجّلة ${i + 1}`}
                  onChange={(e) => onPatchRecorded(i, { title: e.target.value })} className={staffControlCls} />
                <input dir="ltr" value={row.url ?? ""} disabled={locked} placeholder="https://…"
                  aria-label={`رابطُ الجلسة المسجّلة ${i + 1}`}
                  onChange={(e) => onPatchRecorded(i, { url: e.target.value })} className={`${staffControlCls} text-left`} />
                <Button tone="ghost" size="sm" disabled={locked} onClick={() => onRemoveRecorded(i)}>أزل</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {axes.length > 1 && (
                  <select value={row.moduleId ?? ""} disabled={locked} aria-label={`محورُ الجلسة المسجّلة ${i + 1}`}
                    onChange={(e) => onPatchRecorded(i, { moduleId: e.target.value || null })} className={staffControlCls}>
                    {axes.map((id) => <option key={id} value={id}>المحور {axisNo.get(id)}</option>)}
                  </select>
                )}
                <input type="date" dir="ltr" value={date} min={slot.startsOn} max={slot.endsOn} disabled={locked}
                  aria-label={`يومُ فتح الجلسة المسجّلة ${i + 1}`}
                  onChange={(e) => e.target.value && onPatchRecorded(i, { opensAt: at(e.target.value, clock).toISOString() })}
                  className={`${staffControlCls} text-left`} />
                <select value={clock} disabled={locked} aria-label={`ساعةُ فتح الجلسة المسجّلة ${i + 1}`}
                  onChange={(e) => onPatchRecorded(i, { opensAt: at(date, e.target.value).toISOString() })}
                  className={staffControlCls}>
                  {FROM.map((c) => <option key={c} value={c}>{slotLabelAr(c)}</option>)}
                </select>
              </div>
            </Inset>
          );
        })}
        <div>
          <Button tone="ghost" size="sm" disabled={locked}
            onClick={() => onAddRecorded({
              title: "", url: "", moduleId: axes[0] ?? null,
              opensAt: at(slot.startsOn, "08:00").toISOString(),
            })}>
            + جلسةٌ مسجّلة
          </Button>
        </div>
      </div>
    </Card>
  );
}
