/* «لماذا نفتخر بك» — سطورٌ كتبناها عنك، تقبلها أو ترفضها (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أضف كلماتٍ تشجّع الناس لهذا المدرّب، والمدرّب يوافق أو
   يرفض التعديل». فهي بطاقةُ «قبل/بعد» كبقيّة ما نقترحه على المدرّب
   (`components/PlanEdits.tsx`): ما يظهر الآن، وما نقترح، وزرّان. ولا يُطلب منه أن
   يكتب شيئا — وكلمةُ الرفض اختياريّة. والطريقُ في
   `server/services/trainer-pitch.service.ts`. */

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { apiGet, apiPost, ApiError } from "@/services/api";

interface MyPitch {
  lines: string[];
  pending: { id: string; before: string[]; lines: string[]; createdAt: string } | null;
}

/** سطورٌ تُقرأ قائمة — أو «لا شيء» حين تكون فارغة */
function Lines({ label, lines, muted }: { label: string; lines: string[]; muted?: boolean }) {
  return (
    <div className="rounded-md border border-border/60 px-3 py-2 text-read leading-6">
      <span className="text-read font-black text-muted-foreground">{label}:</span>
      {lines.length === 0 ? (
        <span className="ms-1 text-muted-foreground">لا شيء الآن</span>
      ) : (
        <ul className="mt-1 space-y-1">
          {lines.map((l) => (
            <li key={l} className={`flex items-start gap-1.5 ${muted ? "text-muted-foreground" : "text-foreground"}`}>
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PitchCard({ inputCls }: { inputCls: string }) {
  const [data, setData] = useState<MyPitch | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<MyPitch>("/api/trainer/pitch").then((d) => { if (alive) setData(d); }).catch(() => undefined);
    return () => { alive = false };
  }, []);

  /* لا شيءَ قُبل ولا شيءَ ينتظر: البطاقةُ لا تُصيَّر — لا قسمَ فارغا يُقرأ تقصيرا */
  if (!data || (!data.pending && data.lines.length === 0)) return null;

  const decide = async (accept: boolean) => {
    if (!data.pending) return;
    setBusy(true); setMsg(null);
    try {
      const path = `/api/trainer/pitch/${data.pending.id}/${accept ? "accept" : "reject"}`;
      setData(await apiPost<MyPitch>(path, accept ? {} : { noteAr: note.trim() || undefined }));
      setRejecting(false); setNote("");
      setMsg({ bad: false, text: accept ? "قبلتها — تظهر الآن في بطاقتك." : "رفضتها — بقيت بطاقتك كما كانت." });
    } catch (e) {
      setMsg({ bad: true, text: e instanceof ApiError ? e.message : "تعذّر الحفظ" });
    } finally { setBusy(false); }
  };

  return (
    <Panel as="section" className="mt-6 md:p-8" aria-labelledby="pitch-h">
      <h2 id="pitch-h" className="text-base font-black">«لماذا نفتخر بك» في بطاقتك</h2>
      <p className="mt-2 max-w-3xl text-read leading-7 text-muted-foreground">
        سطور قصيرة نكتبها نحن عنك من نبذتك، تظهر في بطاقتك بصفحة المدربين. لا تظهر إلا بقبولك.
      </p>

      {data.pending ? (
        <Inset tone="accent" className="mt-4 p-4">
          <p className="text-read font-black">اقتراح ينتظر قرارك</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Lines label="قبل" lines={data.pending.before} muted />
            <Lines label="بعد" lines={data.pending.lines} />
          </div>
          {rejecting && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-read font-bold text-muted-foreground">سبب الرفض (اختياري)</span>
              <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </label>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {rejecting ? (
              <>
                <Button tone="danger" icon={X} loading={busy} onClick={() => void decide(false)}>أرسل الرفض</Button>
                <Button tone="ghost" disabled={busy} onClick={() => setRejecting(false)}>رجوع</Button>
              </>
            ) : (
              <>
                <Button tone="confirm" icon={Check} loading={busy} onClick={() => void decide(true)}>اقبلها</Button>
                <Button tone="ghost" icon={X} disabled={busy} onClick={() => setRejecting(true)}>ارفضها</Button>
              </>
            )}
          </div>
        </Inset>
      ) : (
        <div className="mt-4">
          <Lines label="يظهر الآن" lines={data.lines} />
        </div>
      )}
      {msg && (
        <p role="alert" className={`mt-2 text-read font-semibold ${msg.bad ? "text-red-300" : "text-teal-light-ink"}`}>{msg.text}</p>
      )}
    </Panel>
  );
}
