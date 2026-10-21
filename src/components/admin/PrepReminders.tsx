/* ═══ «ما بقي من دوراتك» — يعاينها صاحبُ المنصّة ويرسلها مدرّبا مدرّبا (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُه: «حضّرها أنت وأنا أرسلها واحدةً واحدة» — لكلّ مدرّبٍ ما ينقصه وموعدٌ نهائيّ، والحملةُ التسويقيّةُ سببُ
   الاستعجال. ثمّ: «تظهر في صفحة المدرّبين لا في العقود» — فالموعدُ واحدٌ أعلى الصفحة (`ReminderDeadline`)،
   والسطرُ في بطاقة كلّ مدرّبٍ بقي عليه شيء (`PrepReminderRow`). والقائمةُ ونصُّ الرسالة من الخادم
   (`prep-reminder.service.ts`)، فما يُعاين هو ما يُرسَل. */

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { controlCls } from "@/components/FormKit";

/** ما تقوله الرسالة — يطابق `MailChoices` في الخادم */
export interface MailChoices { courses: "more" | "postpone" | "none"; cohorts: boolean; skip: string[]; due: "close" | "date" | "none" }
export interface ReminderRow {
  profileId: string; name: string; email: string; started: boolean; summaryAr: string;
  facts: { openCohorts: string[]; moved: { title: string; termAr: string }[] };
  tasks: { key: string; textAr: string }[];
  choices: MailChoices;
}
interface Preview { to: string; subject: string; text: string; html: string; key?: string }

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** الموعدُ النهائيّ — واحدٌ لكلّ الرسائل */
export function ReminderDeadline({ value, onChange, count }: { value: string; onChange: (v: string) => void; count: number }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-read font-bold">
      <Mail className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
      موعد الرسائل ({count} مدرب)
      <input type="date" value={value} min={inDays(1)} onChange={(e) => onChange(e.target.value)} className={`${controlCls} w-auto`} />
    </label>
  );
}

/* ═══ ما تقوله الرسالة — يختاره صاحبُ المنصّة (٢١ أكتوبر ٢٠٢٦) ═══
   «يجب أن يكون لديّ الخيارُ بأن أحدّد ما هي المحتوياتُ التي أوافق أن ترسلها». ولكلّ خيارٍ سطرٌ يقول ما يقع به،
   والمعاينةُ تتبعه — فما يُرى هو ما يُرسَل. والافتراضُ الرسالةُ كما كانت. */
function MailParts({ row, value, onChange }: { row: ReminderRow; value: MailChoices; onChange: (c: MailChoices) => void }) {
  const set = (patch: Partial<MailChoices>) => onChange({ ...value, ...patch });
  const courseOpts: { v: MailChoices["courses"]; label: string; hint: string }[] = [
    row.started
      ? { v: "more", label: "اسأله يضيف دورة", hint: "هل تضيف دورة أخرى هذا الموسم؟ وما لن تقدمه اعتذر عنه." }
      : { v: "more", label: "اطلب أن يبدأ بدورة", hint: "ابدأ بدورة واحدة: اقبلها وجهز خطتها." },
    { v: "postpone", label: "ذكره بنقلها لموسم قادم", hint: "لمن اتفقنا معه أن يؤجل: لا تنس أن تنقل دوراتك إلى موسم قادم." },
    { v: "none", label: "لا تذكر الدورات", hint: "لا كلمة عن الدورات. يبقى ما تختاره تحت." },
  ];
  /* وإغلاقُ الملفّ إنذارٌ بألّا يبدأ — فلا يُعرض إلّا لمن لم يبدأ ويُطلب منه أن يبدأ (والخادمُ يردّه موعدا وحدَه) */
  const canClose = !row.started && value.courses === "more";
  const dueOpts: { v: MailChoices["due"]; label: string; hint: string }[] = [
    ...(canClose ? [{ v: "close" as const, label: "موعد وإغلاق الملف", hint: "من لم يبدأ حتى الموعد يغلق ملفه — بلطف." }] : []),
    { v: "date", label: "موعد فقط", hint: "نرجو إكمال ذلك قبل الموعد. بلا إنذار." },
    { v: "none", label: "بلا موعد", hint: "لا تاريخ في الرسالة." },
  ];
  const due = value.due === "close" && !canClose ? "date" : value.due;
  const radio = "mt-1 shrink-0";
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2" role="group" aria-label="ما تقوله الرسالة">
      <fieldset>
        <legend className="font-bold">الدورات</legend>
        {courseOpts.map((o) => (
          <label key={o.v} className="mt-1 flex items-start gap-2">
            <input type="radio" className={radio} name={`courses-${row.profileId}`} checked={value.courses === o.v} onChange={() => set({ courses: o.v })} />
            <span><b>{o.label}</b><span className="block text-fine text-muted-foreground">{o.hint}</span></span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="font-bold">الموعد</legend>
        {dueOpts.map((o) => (
          <label key={o.v} className="mt-1 flex items-start gap-2">
            <input type="radio" className={radio} name={`due-${row.profileId}`} checked={due === o.v} onChange={() => set({ due: o.v })} />
            <span><b>{o.label}</b><span className="block text-fine text-muted-foreground">{o.hint}</span></span>
          </label>
        ))}
      </fieldset>
      {(row.started || row.tasks.length > 0) && (
        <fieldset className="sm:col-span-2">
          <legend className="font-bold">وما يذكر أيضا</legend>
          {row.started && (
            <label className="mt-1 flex items-start gap-2">
              <input type="checkbox" className={radio} checked={value.cohorts} onChange={(e) => set({ cohorts: e.target.checked })} />
              {row.facts.openCohorts.length > 0 || row.facts.moved.length > 0 ? "شعبه المفتوحة والمنقولة" : "وصلتنا خطة شعبته"}
            </label>
          )}
          {row.tasks.map((t) => (
            <label key={t.key} className="mt-1 flex items-start gap-2">
              <input type="checkbox" className={radio} checked={!value.skip.includes(t.key)}
                onChange={(e) => set({ skip: e.target.checked ? value.skip.filter((k) => k !== t.key) : [...value.skip, t.key] })} />
              {t.textAr}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** ما بقي على هذا المدرّب — يختار ما تقوله الرسالة، ويعاين ويرسل */
export default function PrepReminderRow({ row, deadline }: { row: ReminderRow; deadline: string }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Preview | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* ═══ وموعدٌ خاصٌّ لهذا المدرّب — اختياريّ (٢٠ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «دعني أغيّر الموعدَ لكلٍّ وحدَه خيارا، والرسالةُ تتغيّر معه». فارغا يتبع موعدَ الصفحة. */
  const [own, setOwn] = useState("");
  const due = own || deadline;
  const [choices, setChoices] = useState<MailChoices>(row.choices);
  /* والمعاينةُ لموعدها وخياراتها معا — فإن تغيّر أحدُهما أُعيدت ولا تُعرض قديمة */
  const key = JSON.stringify([due, choices]);

  useEffect(() => {
    if (!open || !due) return;
    let live = true;
    setErr(null);
    apiPost<Preview>(`/api/admin/prep-reminders/${row.profileId}/preview`, { deadline: due, choices })
      .then((p) => { if (live) setShown({ ...p, key }); })
      .catch((e) => { if (live) setErr(e instanceof ApiError ? e.message : "تعذرت المعاينة"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- المفتاحُ يجمع الموعدَ والخيارات
  }, [open, key, row.profileId]);

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await apiPost<{ sent: string; to: string }>(`/api/admin/prep-reminders/${row.profileId}/send`, { deadline: due, choices });
      setSent(r.sent === "sent" ? `أرسلت إلى ${r.to}` : "لم ترسل — البريد غير مهيأ");
      setOpen(false);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "تعذر الإرسال"); }
    finally { setBusy(false); }
  };

  return (
    <Inset tone="warn" className="mt-2.5 p-2.5 text-read leading-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-bold">
          {row.summaryAr} — رسالة قبل إطلاق الحملة
        </p>
        {sent ? (
          <span className="font-bold text-teal-light-ink">{sent}</span>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-fine font-bold text-muted-foreground">
              موعد خاص
              <input type="date" aria-label="موعد خاص لهذا المدرب" value={own} min={inDays(1)}
                onChange={(e) => setOwn(e.target.value)} className={`${controlCls} w-auto py-1`} />
            </label>
            <Button tone="secondary" size="sm" type="button" onClick={() => setOpen((o) => !o)}>
              {open ? "أخف" : "اختر وعاين"}
            </Button>
            <Button tone="confirm" size="sm" type="button" loading={busy} disabled={busy || !due} onClick={() => void send()}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> أرسل
            </Button>
          </>
        )}
      </div>
      {open && !sent && <MailParts row={row} value={choices} onChange={setChoices} />}
      {open && shown && shown.key === key && (
        <div className="mt-2">
          <p className="font-bold">إلى: {shown.to}</p>
          <p className="font-bold">العنوان: {shown.subject}</p>
          {/* البريدُ كما يصل المدرّبَ — بروابطه التي تُنقر — في إطارٍ معزول (`sandbox`) لا يشغّل شيئا */}
          <iframe title="معاينة الرسالة" srcDoc={shown.html} sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="mt-2 h-[32rem] w-full rounded-lg border border-white/10 bg-white" />
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-danger-ink">{err}</p>}
    </Inset>
  );
}
