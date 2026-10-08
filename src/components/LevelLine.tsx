/* سطرُ المستوى — ما فهمناه عنك، وسببُه، وبابُ تعديله.

   قرارُ صاحب المنصّة (٨ أكتوبر ٢٠٢٦): «المستوى + السبب + التعديل». فيُقرأ هنا
   المستوى كما فهمناه، والجوابُ الذي بُني عليه بنصّه، وتحتهما «ليس دقيقا؟ غيّر
   مستواي». والتعديلُ رابطٌ يعود إلى التشخيص بالسؤال والخيار فيعيد بناءَ النتيجة
   من الجهاز (`level-summary.ts`) — لا إعادةَ أسئلة، ولا حكمَ نهائيٌّ عليه. */

import { useState } from "react";
import { Link } from "react-router";
import { Gauge } from "lucide-react";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { levelLineText, reviseLevelHref, type LevelSummary } from "@/application/diagnostic/level-summary";

export default function LevelLine({ summary, className = "" }: { summary: LevelSummary; className?: string }) {
  const [open, setOpen] = useState(false);
  const { level_ar, why_ar } = levelLineText(summary);
  const others = summary.options.filter((o) => o.option_id !== summary.current_option_id);
  return (
    <Inset className={`px-4 py-3 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <Gauge className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
        {level_ar}
      </p>
      <p className="mt-1 text-read leading-5 text-muted-foreground">{why_ar}</p>
      <Button tone="ghost" size="sm" className="mt-1 -mr-4" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        ليس دقيقا؟ غيّر مستواي
      </Button>
      {open && (
        <div className="mt-2">
          <p className="text-read leading-5 text-muted-foreground">
            اختر الوصفَ الأقرب إليك — نعيد بناء خطّتك به، بلا إعادة الأسئلة.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {others.map((o) => (
              <li key={o.option_id}>
                <Button as={Link} to={reviseLevelHref(summary.question_id, o.option_id)} tone="secondary" size="sm" className="w-full justify-start text-right">
                  <span className="font-black">{o.name_ar}</span>
                  <span className="text-muted-foreground">— {o.label_ar}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Inset>
  );
}
