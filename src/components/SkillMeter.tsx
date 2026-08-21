/* مقياس مستوى مهارة — خمس خطوات منفصلة لأن سلّم الإجابة خمس درجات لا مقدار متصل.
   قواعد التصميم المطبَّقة:
   - لون واحد للتعبئة (--teal-ink): طول المقياس يحمل المستوى، فلا يُعاد ترميزه بلون.
     يمرّ التباين في الوضعين: 6.13:1 على السطح الداكن و5.91:1 على الأبيض.
   - المسار غير المعبّأ درجة أفتح من الرامب نفسه (teal-ink/15) فيقرأ في الوضعين.
   - فراغ ٢ بكسل بلون السطح يفصل الخطوات — لا حدود مرسومة حول التعبئة.
   - المستهدف يُذكر نصا في عنوان القسم، فلا حِبر زائد على المقياس نفسه.
   - القيمة تُقرأ نصا بجانب المقياس ومن aria-label، فلا تعتمد على اللون وحده. */

import { LEVEL_MAX, levelLabelAr } from "@/application/student/skills-profile";

export default function SkillMeter({ level, className = "" }: { level: number; className?: string }) {
  const filled = Math.max(0, Math.min(LEVEL_MAX, Math.round(level)));
  return (
    <span
      role="img"
      aria-label={`المستوى ${filled} من ${LEVEL_MAX} — ${levelLabelAr(filled)}`}
      className={`flex items-center gap-[2px] ${className}`.trim()}
    >
      {Array.from({ length: LEVEL_MAX }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2.5 flex-1 rounded-sm ${i < filled ? "bg-teal-ink" : "bg-teal-ink/15"}`}
        />
      ))}
    </span>
  );
}
