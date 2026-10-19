/* ما تقترحه الأكاديميّةُ على بطاقتك — تقبله أو تعدّله أو ترفضه (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «لم يكن هناك نقاطٌ لـ"لماذا نفتخر بك"! الأمرُ جديد! اطرحه له
   بطريقة "نريد إضافةَ كذا عنك" وامنحه التعديلَ والإضافة، وحدّد عددَ الكلمات للتناسق.
   أمّا تعديلُ النبذة فيكون قبل وبعد! وأعطه رابطا لصفحة المدرّبين ليلقي نظرةً أين تظهر».

   فهما بطاقتان بطريقين:
   · «لماذا نفتخر بك» **إضافة**: حقولٌ معبّأةٌ بما نقترح، يعدّلها ويضيف إليها بعدّادِ
     كلمات. وما قبله كما هو يظهر فورا، وما عدّله يعود إلينا فنعتمده (يقال له ذلك قبل أن يرسل).
   · النبذةُ **«قبل/بعد»** كبقيّة ما نقترحه عليه (`components/PlanEdits.tsx`): نبذتُه الآن
     والمقترحة، وزرّان.
   والطريقُ في `server/services/trainer-suggestion.service.ts`. */

import { useEffect, useState } from "react";
import { Check, ExternalLink, Plus, Send, Sparkles, X } from "lucide-react";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { countWords } from "@/application/trainer/public-text";
import {
  PITCH_MAX_LINES, PITCH_MAX_WORDS, cleanPitchLines, pitchHeadingAr, pitchProblemAr,
} from "@/application/trainer/pitch";

interface View { id: string; kind: "pitch" | "bio"; before: string[]; lines: string[]; editedLines: string[] }
interface Mine {
  profileId: string;
  fullName: string;
  pitch: { lines: string[]; pending: View | null; edited: View | null };
  bio: { current: string | null; pending: View | null };
}

const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** سطورٌ تُقرأ قائمة */
function Lines({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l} className="flex items-start gap-1.5 text-read leading-6">
          <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
          {l}
        </li>
      ))}
    </ul>
  );
}

/** رفضٌ بكلمةٍ اختياريّة — يظهر حقلُها حين يُضغط «ارفضها» */
function RejectButton({ busy, inputCls, onReject }: { busy: boolean; inputCls: string; onReject: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) return <Button tone="ghost" icon={X} disabled={busy} onClick={() => setOpen(true)}>ارفضها</Button>;
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <label className="min-w-56 flex-1">
        <span className="mb-1.5 block text-read font-bold text-muted-foreground">سبب الرفض (اختياري)</span>
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </label>
      <Button tone="danger" icon={X} loading={busy} onClick={() => onReject(note)}>أرسل الرفض</Button>
      <Button tone="ghost" disabled={busy} onClick={() => setOpen(false)}>رجوع</Button>
    </div>
  );
}

/* ═══ «لماذا نفتخر بك» — إضافةٌ يعدّلها ويضيف إليها ═══ */
function PitchPanel({ data, inputCls, onDone }: { data: Mine; inputCls: string; onDone: (m: Mine, msg: string) => void }) {
  const pending = data.pitch.pending;
  const [lines, setLines] = useState<string[]>(() => pending?.lines ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (data.pitch.edited) {
    return (
      <Inset tone="accent" className="mt-4 p-4">
        <p className="text-read font-black">أرسلت تعديلك — يظهر بعد مراجعتنا</p>
        <div className="mt-2"><Lines lines={data.pitch.edited.editedLines} /></div>
      </Inset>
    );
  }
  if (!pending) {
    return data.pitch.lines.length > 0 ? (
      <div className="mt-4">
        <p className="text-read font-black">يظهر الآن في بطاقتك</p>
        <div className="mt-1.5"><Lines lines={data.pitch.lines} /></div>
      </div>
    ) : null;
  }

  const clean = cleanPitchLines(lines);
  const problem = pitchProblemAr(clean);
  const changed = clean.join("\n") !== pending.lines.join("\n");
  const run = async (path: string, body: unknown, msg: string) => {
    setBusy(true); setErr("");
    try { onDone(await apiPost<Mine>(path, body), msg); }
    catch (e) { setErr(errText(e, "تعذّر الحفظ")); }
    finally { setBusy(false); }
  };

  return (
    <Inset tone="accent" className="mt-4 p-4">
      <p className="flex items-center gap-1.5 text-read font-black">
        <Sparkles className="h-4 w-4 shrink-0 text-teal-ink" aria-hidden="true" />
        نريد أن نضيف عنك هذا
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        يظهر في بطاقتك تحت عنوان «{pitchHeadingAr(data.fullName)}». عدّل ما شئت أو أضف سطرا: حتى {PITCH_MAX_LINES} أسطر، و{PITCH_MAX_WORDS} كلمة للسطر.
      </p>
      <div className="mt-3 grid gap-2">
        {lines.map((l, i) => {
          const words = countWords(l);
          return (
            <label key={i} className="block">
              <span className="sr-only">السطر {i + 1}</span>
              <input
                value={l}
                onChange={(e) => setLines((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                className={inputCls}
              />
              <span className={`mt-1 block text-read ${words > PITCH_MAX_WORDS ? "text-gold-ink" : "text-muted-foreground"}`}>
                {words} / {PITCH_MAX_WORDS} كلمة
              </span>
            </label>
          );
        })}
        {lines.length < PITCH_MAX_LINES && (
          <Button tone="ghost" icon={Plus} className="justify-self-start" onClick={() => setLines((cur) => [...cur, ""])}>
            أضف سطرا
          </Button>
        )}
      </div>
      {changed && !problem && (
        <p className="mt-2 text-read leading-6 text-muted-foreground">عدّلت السطور — ترسل لنا لنراجعها، ثم تظهر.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          tone="confirm" icon={changed ? Send : Check} loading={busy} disabled={Boolean(problem)}
          onClick={() => void run(`/api/trainer/suggestions/${pending.id}/accept`, changed ? { lines: clean } : {},
            changed ? "أرسلت تعديلك — يظهر بعد مراجعتنا." : "قبلتها — تظهر الآن في بطاقتك.")}
        >
          {changed ? "أرسل تعديلي للمراجعة" : "اقبلها كما هي"}
        </Button>
        <RejectButton busy={busy} inputCls={inputCls}
          onReject={(note) => void run(`/api/trainer/suggestions/${pending.id}/reject`, { noteAr: note.trim() || undefined }, "رفضتها — بقيت بطاقتك كما كانت.")} />
        {problem && <span className="text-read text-muted-foreground">{problem}</span>}
      </div>
      {err && <p role="alert" className="mt-2 text-read font-semibold text-red-300">{err}</p>}
    </Inset>
  );
}

/* ═══ النبذةُ بصياغتنا — «قبل/بعد» وزرّان ═══ */
function BioPanel({ data, inputCls, onDone }: { data: Mine; inputCls: string; onDone: (m: Mine, msg: string) => void }) {
  const pending = data.bio.pending;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!pending) return null;
  const run = async (path: string, body: unknown, msg: string) => {
    setBusy(true); setErr("");
    try { onDone(await apiPost<Mine>(path, body), msg); }
    catch (e) { setErr(errText(e, "تعذّر الحفظ")); }
    finally { setBusy(false); }
  };
  return (
    <Inset tone="accent" className="mt-4 p-4">
      <p className="text-read font-black">نقترح صياغة جديدة لنبذتك</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border/60 px-3 py-2 text-read leading-6">
          <span className="text-read font-black text-muted-foreground">قبل: </span>
          <span className="whitespace-pre-line text-muted-foreground">{pending.before[0] ?? "لا نبذة الآن"}</span>
        </div>
        <div className="rounded-md border border-border/60 px-3 py-2 text-read leading-6">
          <span className="text-read font-black text-muted-foreground">بعد: </span>
          <span className="whitespace-pre-line text-foreground">{pending.lines[0]}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="confirm" icon={Check} loading={busy}
          onClick={() => void run(`/api/trainer/suggestions/${pending.id}/accept`, {}, "قبلتها — صارت نبذتك في صفحة المدربين.")}>
          اقبلها
        </Button>
        <RejectButton busy={busy} inputCls={inputCls}
          onReject={(note) => void run(`/api/trainer/suggestions/${pending.id}/reject`, { noteAr: note.trim() || undefined }, "رفضتها — بقيت نبذتك كما كانت.")} />
      </div>
      {err && <p role="alert" className="mt-2 text-read font-semibold text-red-300">{err}</p>}
    </Inset>
  );
}

export default function ProfileSuggestions({ inputCls }: { inputCls: string }) {
  const [data, setData] = useState<Mine | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    apiGet<Mine>("/api/trainer/suggestions").then((d) => { if (alive) setData(d); }).catch(() => undefined);
    return () => { alive = false };
  }, []);

  /* لا اقتراحَ ولا شيءَ ظاهرٌ من «لماذا نفتخر بك»: لا قسمَ فارغا يُقرأ تقصيرا */
  if (!data) return null;
  const any = data.pitch.pending || data.pitch.edited || data.pitch.lines.length > 0 || data.bio.pending;
  if (!any) return null;
  const done = (m: Mine, text: string) => { setData(m); setMsg(text); };

  return (
    <Panel as="section" className="mt-6 md:p-8" aria-labelledby="suggestions-h">
      <h2 id="suggestions-h" className="text-base font-black">اقتراحاتنا لبطاقتك</h2>
      <p className="mt-2 max-w-3xl text-read leading-7 text-muted-foreground">
        نكتبها نحن من نبذتك، ولا يتغير شيء في بطاقتك قبل قرارك.
      </p>
      {/* «أعطه رابطا لصفحة المدرّبين ليلقي نظرةً أين تظهر» — إلى بطاقته بعينها */}
      <a
        href={`/trainers#trainer-${data.profileId}`} target="_blank" rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-read font-bold text-teal-light-ink underline underline-offset-4"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        شاهد بطاقتك في صفحة المدربين
      </a>
      <PitchPanel key={data.pitch.pending?.id ?? "none"} data={data} inputCls={inputCls} onDone={done} />
      <BioPanel data={data} inputCls={inputCls} onDone={done} />
      {msg && <p role="status" className="mt-3 text-read font-semibold text-teal-light-ink">{msg}</p>}
    </Panel>
  );
}
