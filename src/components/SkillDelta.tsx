/* فرق المهارة قبل الدورة وبعدها (البند ح-٧).

   قواعد التصميم المطبَّقة:
   - الشكل يحمل المعنى قبل اللون: مقياسان متجاوران وسهم بينهما، والرقم بإشارته.
     من يقرأ بلا لون يقرأ «٢ ← ٤ · +٢» كاملة.
   - التراجع لا يُخفى ولا يُلوَّن أحمر صارخا: سهم لأسفل ورقم سالب — واقعة تُقرأ.
   - «قياس أول» ليس صفرا: بلا مرجع قبليّ لا نرسم مقياسا فارغا يوهم بأنه كان صفرا.
   - العدد بخط جدولي (tabular-nums) فلا ترتجف الأعمدة بين الصفوف.
   - الرقم المُوقَّع في وعاء dir="ltr": بلا ذلك يقلب المحرك ثنائي الاتجاه «+2»
     إلى «2+» فيُقرأ خطأ في سياق عربي. */

import { ArrowLeft, TrendingDown, TrendingUp, Minus, Sparkles } from "lucide-react";
import SkillMeter from "@/components/SkillMeter";
import { levelLabelAr } from "@/application/student/skills-profile";
import type { SkillGrowth } from "@/application/student/skill-growth";

/** شارة الفرق — نص ورمز، فلا تعتمد على اللون وحده */
export function DeltaBadge({ g, className = "" }: { g: SkillGrowth; className?: string }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums";
  if (g.direction === "first") {
    return (
      <span className={`${base} border-gold/40 text-gold-ink ${className}`}>
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        قياس أول
      </span>
    );
  }
  if (g.direction === "up") {
    return (
      <span className={`${base} border-teal/50 text-teal-light-ink ${className}`}>
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        <span dir="ltr">+{g.delta}</span>
      </span>
    );
  }
  if (g.direction === "down") {
    return (
      <span className={`${base} border-white/25 text-foreground ${className}`}>
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
        <span dir="ltr">{g.delta}</span>
      </span>
    );
  }
  return (
    <span className={`${base} border-white/15 text-muted-foreground ${className}`}>
      <Minus className="h-3 w-3" aria-hidden="true" />
      بلا تغيّر
    </span>
  );
}

/** صف مهارة واحدة: الاسم · قبل ← بعد · الفرق */
export default function SkillDelta({ g }: { g: SkillGrowth }) {
  return (
    <li className="grid grid-cols-1 gap-2 border-t border-white/5 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{g.nameAr}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {g.beforeLevel === null
            ? `قِيست أول مرة بعد الدورة: ${levelLabelAr(g.afterLevel)}`
            : `${levelLabelAr(g.beforeLevel)} ← ${levelLabelAr(g.afterLevel)}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {g.beforeLevel === null ? (
          <span className="text-[11px] text-white/40">لا قياس قبليّ</span>
        ) : (
          <>
            <span className="w-20">
              <SkillMeter level={g.beforeLevel} className="opacity-45" />
            </span>
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
          </>
        )}
        <span className="w-20">
          <SkillMeter level={g.afterLevel} />
        </span>
      </div>

      <DeltaBadge g={g} />
    </li>
  );
}
