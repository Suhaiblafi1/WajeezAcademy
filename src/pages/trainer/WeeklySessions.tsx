/* ═══ التكرارُ الأسبوعيّ — خيارٌ جانبيٌّ بجانب اليدويّ (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «يبقى الإدخالُ اليدويُّ هو
   الأساسَ كما هو اليوم: لكلّ محورٍ يومُه وساعتُه. ويُضاف خيارٌ جانبيٌّ اختياريٌّ
   لمن يريد إيقاعا ثابتا، دون أن يكون إلزاميّا… يختار يوما وساعةً مرّةً واحدةً
   فتُقترح كلُّ اللقاءات، ثمّ يعدّل أيَّ لقاءٍ منها يدويّا قبل الحفظ».

   فالاقتراحُ لا يُحفظ حتّى يحفظه: يُعرض صفًّا لكلّ موعدٍ فيه محاورُ بلا لقاء،
   ولكلّ صفٍّ يومُه وعنوانُه يعدّلهما أو يرفع الصفَّ. والحفظُ هو نداءُ اللقاء
   الواحد نفسُه (`POST …/sessions`) مرّةً لكلّ صفّ — فلا بابَ ثانيا يفترق عن
   الأوّل، وما يردّه الخادمُ لصفٍّ يُقال باسمه ويبقى صفُّه ليُصلَح. والقواعدُ
   والاقتراحُ في `application/trainer/session-picker.ts`. */

import { useMemo, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { zonedInstant } from "@/application/trainer/cohort-period";
import { axesLabelAr, dayLabelAr, sessionInsideSlot, type PlanSlot } from "@/application/trainer/axis-timeline";
import { fromSlots, slotLabelAr, toMinutes, toSlotsFor } from "@/application/trainer/session-length";
import {
  TO_LADDER_WHY_AR, dayNoteAr, fromClockNote, lateInSlot, suggestedSessionTitle, toClockNote, weeklyProposals, type Weekday,
} from "@/application/trainer/session-picker";
import { WEEKDAY_AR } from "@/application/trainer/plan-scorecard";
import SlotDaySelect from "./SlotDaySelect";

const at = (date: string, clock: string) => {
  const m = toMinutes(clock) ?? 0;
  return zonedInstant(date, [Math.floor(m / 60), m % 60, 0, 0]);
};

interface Row { slotIndex: number; date: string; title: string; moduleIds: string[] }

export default function WeeklySessions({
  cohortId, slots, covered, axisNo, titles, locked, approvedOnce, beforeWrite, onDone, weeks = false,
}: {
  cohortId: string;
  slots: readonly PlanSlot[];
  /** النوافذُ أسابيعُ مقترحةٌ لا مواعيدُ في الخطّة — حين تأخذ المحاورُ وقتَها من لقاءاتها
      (١٧ أكتوبر ٢٠٢٦): فتُسمّى «الأسبوع» ولا نصيحةَ «أوّل ثلاثة أيّام» */
  weeks?: boolean;
  /** محاورُ لها لقاءٌ مباشرٌ قائم — لا يُقترح لها شيء */
  covered: ReadonlySet<string>;
  axisNo: ReadonlyMap<string, number>;
  titles: ReadonlyMap<string, string>;
  locked: boolean;
  approvedOnce: boolean;
  beforeWrite?: () => Promise<boolean>;
  onDone: () => void;
}) {
  const unit = weeks ? "الأسبوع" : "الموعد";
  const [weekday, setWeekday] = useState<Weekday | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  /* الصفوفُ المقترحة — تُبنى حين يختار اليوم، ثمّ هي بيده */
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const FROM = useMemo(() => fromSlots(), []);
  const TO = useMemo(() => toSlotsFor(from), [from]);

  const propose = (d: Weekday) => {
    setWeekday(d);
    setRows(weeklyProposals(slots, covered, d).map((p) => ({
      slotIndex: p.slotIndex, date: p.date ?? "", title: "", moduleIds: p.moduleIds,
    })));
  };

  const problemOf = (r: Row): string | null => {
    if (!r.date) return `لا يقع هذا اليوم داخل ${unit} — اختر يوما`;
    if (!from || !to) return null;
    const slot = slots[r.slotIndex];
    if (slot && !sessionInsideSlot({ startsAt: at(r.date, from), endsAt: at(r.date, to) }, slot)) return `خارج ${unit}`;
    return null;
  };
  const ready = Boolean(rows && rows.length > 0 && from && to && rows.every((r) => problemOf(r) === null));

  const save = async () => {
    if (!rows || !ready) return;
    setBusy(true);
    try {
      if (beforeWrite && !(await beforeWrite())) return;
      const failed: Row[] = [];
      for (const r of rows) {
        const title = r.title.trim() || suggestedSessionTitle(r.moduleIds, titles, axisNo);
        try {
          await apiPost(`/api/trainer/cohorts/${cohortId}/sessions`, {
            title, startsAt: at(r.date, from), endsAt: at(r.date, to), moduleIds: r.moduleIds,
          });
        } catch (e) {
          failed.push(r);
          toastError(`«${title}»: ${e instanceof ApiError ? e.message : "تعذّر حفظه"}`);
        }
      }
      const saved = rows.length - failed.length;
      if (saved > 0) {
        toast(`حفظ ${saved === 1 ? "لقاء واحد" : `${saved} لقاءات`} — ${approvedOnce ? "وتنتظر اعتماد الإدارة" : "وتعتمد مع خطّتك حين ترسلها"}`);
      }
      setRows(failed.length ? failed : null);
      if (!failed.length) setWeekday(null);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  if (slots.every((s) => s.moduleIds.every((id) => covered.has(id)))) {
    return <p className="text-read leading-6 text-muted-foreground">لكلّ محور لقاء مباشر — وأضف المزيد من {weeks ? "بطاقة اللقاءات" : "بطاقة موعده"}.</p>;
  }

  return (
    <div className="grid gap-3">
      <p className="text-read leading-6 text-muted-foreground">
        اختر يوما وساعة، فيقترح لقاء لكلّ موعد. عدّل ما شئت ثمّ احفظ.
      </p>
      <fieldset disabled={locked || busy} className="grid min-w-0 gap-3 sm:grid-cols-3">
        <StaffField label="اليوم من كلّ أسبوع" hint="الجمعة والسبت، أو مساء يوم عمل.">
          <select value={weekday ?? ""} aria-label="يوم التكرار الأسبوعيّ" className={staffControlCls}
            onChange={(e) => (e.target.value === "" ? (setWeekday(null), setRows(null)) : propose(Number(e.target.value) as Weekday))}>
            <option value="">اختر اليوم</option>
            {WEEKDAY_AR.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </StaffField>
        <StaffField label="من الساعة" hint="بتوقيت الشعبة (عمّان).">
          <select value={from} aria-label="ساعة بدء اللقاءات الأسبوعيّة" className={staffControlCls}
            onChange={(e) => { const f = e.target.value; setFrom(f); if (!toSlotsFor(f).includes(to)) setTo(""); }}>
            <option value="">اختر الساعة</option>
            {FROM.map((c) => {
              /* يومُ عملٍ يُعلَّم وقتُ عمله — والعلامةُ من أوّل صفٍّ مقترح، فكلُّها اليومُ نفسُه */
              const note = rows?.[0]?.date ? fromClockNote(rows[0].date, c) : null;
              return <option key={c} value={c}>{slotLabelAr(c)}{note ? ` · ${note}` : ""}</option>;
            })}
          </select>
        </StaffField>
        <StaffField label="إلى الساعة" hint={TO_LADDER_WHY_AR}>
          <select value={to} disabled={!from} aria-label="ساعة انتهاء اللقاءات الأسبوعيّة" className={staffControlCls}
            onChange={(e) => setTo(e.target.value)}>
            <option value="">{from ? "اختر الساعة" : "اختر البدء أوّلا"}</option>
            {TO.map((c) => {
              const note = toClockNote(c);
              return <option key={c} value={c}>{slotLabelAr(c)}{note ? ` · ${note}` : ""}</option>;
            })}
          </select>
        </StaffField>
      </fieldset>

      {rows && rows.length > 0 && (
        <ol className="grid gap-2" aria-label="اللقاءات المقترحة">
          {rows.map((r, k) => {
            const slot = slots[r.slotIndex];
            const suggested = suggestedSessionTitle(r.moduleIds, titles, axisNo);
            const problem = problemOf(r);
            const note = r.date ? dayNoteAr(r.date) : null;
            const patch = (next: Partial<Row>) => setRows(rows.map((x, j) => (j === k ? { ...x, ...next } : x)));
            return (
              <Inset as="li" key={r.slotIndex} className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-read font-black text-teal-light-ink">
                    {unit} {r.slotIndex + 1} <span className="font-bold text-foreground">· {axesLabelAr(r.moduleIds, axisNo)}</span>
                    {slot && <span className="font-normal text-muted-foreground"> · {dayLabelAr(slot.startsOn)} – {dayLabelAr(slot.endsOn)}</span>}
                  </p>
                  <Button tone="ghost" size="sm" icon={X} disabled={locked || busy} aria-label={`ارفع اقتراح ${unit} ${r.slotIndex + 1}`}
                    onClick={() => setRows(rows.filter((_, j) => j !== k))}>ارفعه</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                  {/* من أيّام الموعد وحدَها — لا تقويمٌ مفتوح (١١ أكتوبر ٢٠٢٦، `SlotDaySelect`) */}
                  {slot ? (
                    <SlotDaySelect slot={slot} value={r.date} disabled={locked || busy}
                      ariaLabel={`يوم اللقاء المقترح في ${unit} ${r.slotIndex + 1}`}
                      onChange={(date) => patch({ date })} />
                  ) : <span className="text-read text-muted-foreground">—</span>}
                  <input value={r.title} placeholder={`مثال: ${suggested}`} disabled={locked || busy}
                    aria-label={`عنوان اللقاء المقترح في ${unit} ${r.slotIndex + 1}`}
                    onChange={(e) => patch({ title: e.target.value })} className={staffControlCls} />
                </div>
                {problem && <p className="text-read font-bold text-gold-ink">{problem}</p>}
                {!problem && note && (
                  <p className="flex items-start gap-2 text-read leading-6 text-gold-ink">
                    <Lightbulb className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /> <span>{note}</span>
                  </p>
                )}
                {!problem && !weeks && r.date && slot && lateInSlot(r.date, slot) && (
                  <p className="text-read leading-6 text-muted-foreground">بعد أوّل ثلاثة أيّام من الموعد — ولك أن تبقيه.</p>
                )}
              </Inset>
            );
          })}
        </ol>
      )}
      {rows && rows.length === 0 && (
        <p className="text-read leading-6 text-muted-foreground">لا اقتراح بقي — اختر يوما آخر، أو أضف من بطاقات المواعيد.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button tone="confirm" size="sm" loading={busy} disabled={locked || busy || !ready} onClick={() => void save()}>
            احفظ {rows.length === 1 ? "اللقاء" : `اللقاءات الـ${rows.length}`}
          </Button>
          {!ready && <span className="text-read text-muted-foreground">{!from || !to ? "اختر الساعتين أوّلا." : "أصلح ما علّم أعلاه."}</span>}
          {/* عنوانٌ فارغٌ يُسمّى بعناوين محاوره — يُقال قبل الحفظ */}
          <span className="text-read text-muted-foreground">والعنوان الفارغ يسمّى بالمثال.</span>
        </div>
      )}
    </div>
  );
}
