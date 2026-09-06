import { useState } from "react";
import { Gauge, ArrowLeft, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
/* شبكة تقييم عائلات المهارات — شاشة واحدة لا أسئلة متتالية.

   لماذا شاشة واحدة: ست عائلات = ستة أسئلة لو فُرِّقت، وقد أمضينا الجهد كله في
   تقصير الجلسة. وشاشةٌ واحدة تُري المتعلم صورته كاملة فيقارن بين جوانبه بدل أن
   يحكم على كل جانب معزولا.

   ولماذا اختيارية: هي تحسّن الخطة ولا تشترطها. من تخطّاها يأخذ ما كان يأخذه
   قبل هذه الطبقة بلا نقص.

   ودقة يجب أن تُقال للنص المعروض: تركيب الخطة على مستوى المقرر (composePath)
   لا يجري إطلاقا ما لم تُقيَّم عائلة واحدة على الأقل — انظر engine.ts حيث
   composedPath مشروط بـ familyRatings غير الفارغة. فالتخطي لا «يعمّم الترتيب»
   فحسب، بل يُسقط الخطة المركّبة كخيار ويُبقي أقرب مسار جاهز. */

export interface FamilyToRate {
  family: string;
  label_ar: string;
  skills: string[];
  courseCount: number;
}

interface Props {
  families: FamilyToRate[];
  onDone: (ratings: Record<string, number>) => void;
  onSkip: () => void;
}

/* مقياس بلغة المتعلم لا بأرقام مجردة — «٣» لا تعني شيئا، و«أعرفها وطبقتها مرة» تعني */
const SCALE: { value: number; short: string; full: string }[] = [
  { value: 1, short: "لم أجرّبها", full: "لم أتعامل معها عمليا" },
  { value: 2, short: "سمعت عنها", full: "أعرف عنها نظريا فقط" },
  { value: 3, short: "طبّقتها مرة", full: "جرّبتها في موقف أو مهمة" },
  { value: 4, short: "أستخدمها", full: "أستخدمها في عملي بانتظام" },
  { value: 5, short: "أُتقنها", full: "أتقنها وأعلّمها غيري" },
];

export default function SkillFamilyGrid({ families, onDone, onSkip }: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const answered = Object.keys(ratings).length;

  if (families.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="sfg-title">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-4 py-1.5 text-xs font-bold text-teal-light-ink">
          <Gauge className="h-3.5 w-3.5" />
          خطوة أخيرة — نصف دقيقة
        </span>
        <h2 id="sfg-title" className="mt-4 text-2xl font-black md:text-3xl">
          أين أنت الآن من هذه الجوانب؟
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          إجابتك تحدد أي الدورات تبدأ بها وأيها تتخطاها — فلا نعطيك ما تعرفه أصلا،
          ولا ما هو أكبر من مستواك. اترك أي جانب لا تعرف موضعك منه.
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        {families.map((f) => {
          const cur = ratings[f.family];
          return (
            <Card as="li" key={f.family} className="md:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-base font-black">{f.label_ar}</h3>
                <span className="text-micro text-muted-foreground">
                  يظهر في {f.courseCount} من دوراتك المرشحة
                </span>
              </div>
              <div
                className="mt-3 grid grid-cols-5 gap-1.5"
                role="radiogroup"
                aria-label={f.label_ar}
              >
                {SCALE.map((s) => {
                  const on = cur === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={s.full}
                      onClick={() =>
                        setRatings((r) => {
                          /* الضغط على الاختيار نفسه يلغيه — فيعود الجانب مجهولا */
                          const next = { ...r };
                          if (next[f.family] === s.value) delete next[f.family];
                          else next[f.family] = s.value;
                          return next;
                        })
                      }
                      className={`rounded-xl border px-1 py-2.5 text-micro font-bold leading-tight transition md:text-xs ${
                        on
                          ? "border-teal bg-teal text-on-teal"
                          : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-teal/40 hover:text-foreground"
                      }`}
                    >
                      {s.short}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </ul>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          onClick={() => onDone(ratings)}
          className="h-12 rounded-full bg-teal px-8 font-black text-on-teal hover:bg-teal-deep"
        >
          {answered > 0 ? "اعرض خطتي" : "اعرض النتيجة"}
          <ArrowLeft className="mr-2 h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
        >
          <SkipForward className="h-3.5 w-3.5" />
          تخطَّ هذه الخطوة
        </button>
      </div>
      <p className="mt-3 text-center text-micro text-muted-foreground">
        {answered > 0
          ? `قيّمت ${answered} من ${families.length} — كل جانب تقيّمه يجعل خطتك أدق.`
          : "هذه الخطوة هي ما يحوّل الترشيح من مسار جاهز إلى خطة مبنية لك — وتخطّيها يعطيك أقرب مسار في الكتالوج."}
      </p>
    </section>
  );
}
