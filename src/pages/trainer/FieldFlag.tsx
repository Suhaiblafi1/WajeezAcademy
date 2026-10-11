/* ═══ الناقصُ يُعلَّم في موضعه — إطارٌ أحمرُ ونافذةٌ صغيرةٌ تقول ما ينقص (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «لم يعجبني الشريطُ الجانبيّ.. فقد أخذ حيّزا لا داعيَ له..
   اجعل تنبيهاتِ النواقص بإشارةٍ حمراءَ حول كلّ شيءٍ ناقص مع توضيح ما هو ناقصٌ
   ببوب أب! وليس من البداية.. فقط إذا دخل الخانةَ وخرج منها أو نقر على متابعة».

   فالإطارُ لا يُرسم حتّى يقول أبوه `shown` — وأبوه يقوله بعد أن يخرج المدرّبُ من
   الخانة (`onLeave` على `blur`) أو بعد «التالي» الذي لم ينقل. والشرحُ خلف علامة «i»
   صغيرة، يُقرأ سطرا قصيرا حين يُمرَّر عليها أو تُنقر. والإطارُ `outline`
   لا `border`: لا يزيح شيئا ممّا حوله حين يظهر. والنافذةُ تُفتح بالمرور على
   علامتها «!» أو نقرها (والنقرُ هو ما في الهاتف) — ولا تُفتح وهو يكتب في الخانة،
   فلا تغطّي ما تحتها وهو يكتب. */

import type { ReactNode } from "react";
import { Info } from "lucide-react";

export default function FieldFlag({ id, problem, shown, onLeave, as: Tag = "div", className, children }: {
  /** اسمُ الخانة — به يُعرف أنّه خرج منها */
  id: string;
  /** ما ينقص بجملة — أو `null` حين لا ينقص شيء */
  problem: string | null;
  /** أخرج منها أو نقر «التالي»؟ */
  shown: boolean;
  onLeave: (id: string) => void;
  as?: "div" | "li";
  className?: string;
  children: ReactNode;
}) {
  const on = Boolean(problem) && shown;
  return (
    <Tag
      data-flag={id}
      data-flagged={on ? "" : undefined}
      onBlurCapture={() => onLeave(id)}
      className={`relative min-w-0 ${on ? "rounded-lg outline outline-2 outline-offset-4 outline-red-500" : ""} ${className ?? ""}`}
    >
      {children}
      {on && (
        <>
          {/* علامةُ «معلومة» صغيرةٌ لا نافذةٌ حمراءُ كبيرة — قرارُ صاحب المنصّة (اليومَ نفسَه) */}
          <button
            type="button"
            data-flag-badge
            aria-label={`ما الناقص هنا: ${problem}`}
            className="peer absolute -top-2.5 end-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-surface text-red-400"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute end-0 top-4 z-20 hidden w-max max-w-[min(16rem,75vw)] rounded-md bg-surface px-2 py-1 text-fine leading-5 text-foreground shadow-md ring-1 ring-white/10 peer-hover:block peer-focus:block"
          >
            {problem}
          </span>
        </>
      )}
    </Tag>
  );
}
