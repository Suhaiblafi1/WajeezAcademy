/* ═══ «ما بقي من دوراتك» — يعاينها صاحبُ المنصّة ويرسلها مدرّبا مدرّبا (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُه: «حضّرها أنت وأنا أرسلها واحدةً واحدة» — لكلّ مدرّبٍ ما ينقصه وموعدٌ نهائيّ، والحملةُ التسويقيّةُ سببُ
   الاستعجال. ثمّ: «تظهر في صفحة المدرّبين لا في العقود» — فالموعدُ واحدٌ أعلى الصفحة (`ReminderDeadline`)،
   والسطرُ في بطاقة كلّ مدرّبٍ بقي عليه شيء (`PrepReminderRow`). والقائمةُ ونصُّ الرسالة من الخادم
   (`prep-reminder.service.ts`)، فما يُعاين هو ما يُرسَل. */

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { controlCls } from "@/components/FormKit";

export interface ReminderRow { profileId: string; name: string; email: string; started: boolean; summaryAr: string }
interface Preview { to: string; subject: string; text: string; html: string; due?: string }

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

/** ما بقي على هذا المدرّب — يعاين ويرسل */
export default function PrepReminderRow({ row, deadline }: { row: ReminderRow; deadline: string }) {
  const [shown, setShown] = useState<Preview | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* ═══ وموعدٌ خاصٌّ لهذا المدرّب — اختياريّ (٢٠ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «دعني أغيّر الموعدَ لكلٍّ وحدَه خيارا، والرسالةُ تتغيّر معه». فارغا يتبع موعدَ الصفحة. */
  const [own, setOwn] = useState("");
  const due = own || deadline;

  const preview = async () => {
    if (shown && shown.due === due) { setShown(null); return; }
    setBusy(true); setErr(null);
    try { setShown({ ...(await apiPost<Preview>(`/api/admin/prep-reminders/${row.profileId}/preview`, { deadline: due })), due }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذرت المعاينة"); }
    finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await apiPost<{ sent: string; to: string }>(`/api/admin/prep-reminders/${row.profileId}/send`, { deadline: due });
      setSent(r.sent === "sent" ? `أرسلت إلى ${r.to}` : "لم ترسل — البريد غير مهيأ");
      setShown(null);
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
              <input type="date" aria-label="موعد خاص لهذا المدرب" value={own} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                onChange={(e) => { setOwn(e.target.value); setShown(null); }} className={`${controlCls} w-auto py-1`} />
            </label>
            <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => void preview()}>
              {shown && shown.due === due ? "أخف" : "عاين الرسالة"}
            </Button>
            <Button tone="confirm" size="sm" type="button" loading={busy} disabled={busy || !due} onClick={() => void send()}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> أرسل
            </Button>
          </>
        )}
      </div>
      {/* والمعاينةُ لموعدها — إن تغيّر موعدُ الصفحة أو موعدُه الخاصّ بعدها لا تُعرض قديمة */}
      {shown && shown.due === due && (
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
