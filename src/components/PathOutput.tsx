/* «تتخرّج بـ» في إطارٍ ناعمٍ خفيف — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «ألا يمكن أن يكون ما تتخرّج به
   في إطارٍ ناعمٍ خفيفٍ جدّا؟». فالمخرَجُ — ما يُشترى — يُقرأ وحدةً قائمةً لا سطرا بين سطور.

   والإطارُ درجةُ `Inset` من سلّم الأسطح لا صيغةٌ تُكتب باليد (`design-system.test.ts`): تفصيلٌ داخل
   بطاقة، غاطسٌ بلا حدّ، بنغمة `accent` الفيروزيّة الخافتة. والحبرُ يبقى فوق ٤٫٥:١ عليها — أسوؤها بطاقةُ
   الرئيسة الفيروزيّةُ تحتها: ٤٫٨:١ بحبر المظهر الليليّ الأفتح، والنهاريُّ أغمق.
   ومكوّنٌ واحدٌ لمواضعه الثلاثة، فلا يفترق إطارُ الرئيسة عن إطار الكتالوج. */

import { Target } from "lucide-react";
import { Inset } from "@/components/ui/Surface";

export default function PathOutput({ output, className = "", clamp = "" }: {
  output: string
  /** المسافةُ فوقه ومقاسُ الحرف — كلٌّ في موضعه */
  className?: string
  /** قصُّ الأسطر في البطاقة الضيّقة (`line-clamp-2`) */
  clamp?: string
}) {
  return (
    <Inset as="p" tone="accent" className={`flex items-start gap-1.5 px-3 py-2 text-teal-light-ink ${className}`}>
      <Target className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className={`min-w-0 ${clamp}`}>تتخرّج بـ: {output}</span>
    </Inset>
  );
}
