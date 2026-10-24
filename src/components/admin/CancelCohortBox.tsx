/* إلغاءُ الشعبة — بسببٍ يصل المدرّب، وبما يقع قبل أن يقع (٢٢ أكتوبر ٢٠٢٦).

   «أقرّر إيقافَها وأبلغ المدرّب بأنّنا ألغيناها كي لا نتحمّل أيّ كلفة» (صاحب المنصّة). وكان الزرُّ
   «إلغاء» يقع بضغطةٍ واحدة، ولا يصل المدرّبَ شيء. فصار خطوتين: يُختار السبب ويُقرأ ما سيقع، ثمّ يؤكَّد.
   والسببُ خيارٌ لا نصٌّ يُكتب في كلّ مرّة — وأوّلُه ما يُلغى له أكثرُ الشعب.

   ═══ ويُحرَّر قبل أن يُرسَل (٢٤ أكتوبر ٢٠٢٦) ═══
   سأل صاحبُ المنصّة: «إذا أردتُ أن ألغي شعبة، هل أستطيع تحريرَ السبب؟». وكان النصُّ يُكتب في «سبب آخر»
   وحدَه، والسببان الآخران ثابتان. فصار كلُّ خيارٍ يملأ صندوقَ النصّ، والصندوقُ يُحرَّر دائما — وما فيه هو
   ما يصل المدرّب. و«سبب آخر» يفرغه ليُكتب من أوّله. */

import { useState } from "react";
import { Ban } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls } from "@/components/FormKit";

const CANCEL_REASONS = [
  { id: "low", label: "قلة التسجيل — لم يكتمل الحد الأدنى" },
  { id: "trainer", label: "بطلب المدرب" },
  { id: "other", label: "سبب آخر" },
] as const;

type ReasonId = (typeof CANCEL_REASONS)[number]["id"];

export default function CancelCohortBox({ cohortId, title, learners, started, hasTrainer, onDone, onError, compact = false }: {
  cohortId: string;
  title: string;
  learners: number;
  started: boolean;
  hasTrainer: boolean;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  /** زرٌّ صغيرٌ في سطر قائمة — والصندوقُ ينبسط تحته */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonId>("low");
  const [text, setText] = useState<string>(CANCEL_REASONS[0].label);
  const [busy, setBusy] = useState(false);

  const reasonAr = text.trim();
  const pick = (id: ReasonId) => {
    setReason(id);
    setText(id === "other" ? "" : CANCEL_REASONS.find((r) => r.id === id)!.label);
  };

  const cancel = async () => {
    if (busy || !reasonAr) return;
    setBusy(true);
    try {
      await apiPost(`/api/admin/cohorts/${cohortId}/transition`, { to: "cancelled", note: "إلغاء من لوحة الإدارة", reasonAr });
      setOpen(false);
      onDone(hasTrainer ? `ألغيت «${title}» — ووصل المدرب والمتعلمين الخبر` : `ألغيت «${title}» — ووصل المتعلمين الخبر`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "تعذر الإلغاء");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button tone="danger" size={compact ? "sm" : "md"} icon={Ban} onClick={() => setOpen(true)}>
        {hasTrainer ? "ألغها وأبلغ المدرب" : "ألغها"}
      </Button>
    );
  }
  return (
    <Inset tone="danger" className="w-full px-4 py-3">
      <p className="text-read font-black text-foreground">إلغاء «{title}»</p>
      <fieldset className="mt-2 space-y-1.5">
        <legend className="text-fine text-muted-foreground">السبب — اختر ثم عدله كما تشاء، ويصل المدرب كما تكتبه</legend>
        {CANCEL_REASONS.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-2 text-read">
            <input type="radio" name={`reason-${cohortId}`} checked={reason === r.id} onChange={() => pick(r.id)} className="accent-teal" />
            {r.label}
          </label>
        ))}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2}
          aria-label="نص السبب" placeholder="اكتب السبب" className={`${staffControlCls} mt-1`} />
      </fieldset>
      <ul className="mt-3 list-disc space-y-1 pr-5 text-read leading-6 text-muted-foreground">
        <li>تختفي من الموقع ولا تقبل تسجيلا.</li>
        <li>{learners > 0 ? `يصل ${learners} متعلما خبر الإلغاء، ويراسلون الدعم للرد أو النقل.` : "لا متعلمين فيها."}</li>
        {hasTrainer && <li>يصل المدرب جرس وبريد بالإلغاء وسببه.</li>}
        <li>{started ? "بدأت الشعبة — حق المدرب قائم ولو ألغيت." : "لم تبدأ — لا يلزمنا للمدرب شيء."}</li>
        <li>لا رجوع عن الإلغاء. وبعده تستطيع حذفها إن لم يبق فيها متعلم.</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button tone="danger" disabled={busy || !reasonAr} loading={busy} onClick={() => void cancel()}>أكد الإلغاء</Button>
        <Button tone="ghost" disabled={busy} onClick={() => setOpen(false)}>تراجع</Button>
      </div>
    </Inset>
  );
}
