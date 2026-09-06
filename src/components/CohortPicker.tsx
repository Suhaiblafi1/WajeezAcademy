/* اختيار الشعبة — أقربُ موعدٍ ظاهر، والبقيّة عند الطلب.

   بقرار صاحب المنتج: «يجب أن يكون هناك تاريخ لأقرب شعبة لكلّ دورة، ويحقّ له
   اختيار الشعبة التي يريد بحسب المتوفّر وما يناسبه». وقبله كان اختيار الموعد
   يعيش في صفحةٍ مستقلّة («الشعب المفتوحة») بعيدةً عن الدورة التي يفكّر فيها —
   فيقرأ عن دورةٍ هنا ويبحث عن موعدها هناك.

   والمكوّن واحدٌ يُستعمل في ثلاثة مواضع — صفحة المسار العامّة، وصفحة الدورة،
   و«مساري» — فلا يفترق ما يراه الزائر عمّا يراه المشتري.

   والأقربُ وحده ظاهرٌ افتراضا: عرضُ ستّ شعبٍ لكلّ دورةٍ في قائمةٍ من ستّ
   دورات يعطي ستّا وثلاثين خيارا على شاشةٍ واحدة — وهو ما جعل الصفحة السابقة
   مبعثرة. الأقرب يكفي أكثر القرّاء، ومن أراد غيره طلبه. */

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, Users } from "lucide-react";
import type { CohortOption } from "@/services/cohort-prices";
import { daysLabelAr, fmtDateAr, untilLabelAr } from "@/utils/format";
import { UpcomingTermLine } from "@/components/UpcomingTermNote";

/** سطرُ موعدٍ واحد — التاريخ ثمّ بُعده ثمّ أيّامه */
function When({ c }: { c: CohortOption }) {
  const until = untilLabelAr(c.startsAt);
  const days = daysLabelAr(c.daysOfWeek);
  return (
    <span className="min-w-0 text-[11px] leading-5 text-muted-foreground">
      <span className="font-bold text-foreground">{fmtDateAr(c.startsAt)}</span>
      {until && <span className="text-muted-foreground"> · {until}</span>}
      {days && <span className="text-muted-foreground"> · {days}{c.startTime ? ` ${c.startTime}` : ""}</span>}
    </span>
  );
}

export default function CohortPicker({
  cohorts,
  selectedId,
  onSelect,
  compact = false,
}: {
  cohorts: CohortOption[];
  selectedId: string | null;
  /** يُنادى بمعرّف الشعبة المختارة — والاختيار يعيش عند صاحب الصفحة */
  onSelect: (cohortId: string) => void;
  /** في القوائم الطويلة: سطرٌ واحد بلا إطار */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  /* لا شعبة = لا تاريخ يُختلق — وهذا يبقى. لكنّ «يُعلن الموعد مع فتح الشعبة»
     صادقةٌ ولا تفيد: يقرؤها الزائرُ فلا يعرف أينتظر أسبوعا أم فصلا. فإن كان
     للفصل القادم كيانٌ بتواريخ قيلت التتمّة، وإلّا بقيت الجملةُ وحدَها.

     ونصُّ التتمّة في `UpcomingTermNote` لا هنا: هو نفسُه في الكتالوج وصفحة
     المسار وصفحة الدورة، وأربعُ نسخٍ منه تفترق عند أوّل تعديل. */
  if (cohorts.length === 0) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-bold text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <UpcomingTermLine fallback="يُعلن الموعد مع فتح الشعبة" />
      </span>
    );
  }

  const selected = cohorts.find((c) => c.id === selectedId) ?? cohorts[0];
  const others = cohorts.filter((c) => c.id !== selected.id);

  return (
    <div className={compact ? "" : "rounded-xl border border-white/10 bg-white/[0.03] p-3"}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
        <When c={selected} />
        {typeof selected.seatsLeft === "number" && selected.seatsLeft <= 5 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-micro font-black text-gold-ink">
            <Users className="h-3 w-3" />
            {selected.seatsLeft} مقاعد
          </span>
        )}
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-2.5 py-0.5 text-micro font-bold text-muted-foreground transition hover:border-white/35 hover:text-foreground"
          >
            موعد آخر ({others.length})
            <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && others.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {cohorts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onSelect(c.id); setOpen(false); }}
                aria-label={`ابدأ ${fmtDateAr(c.startsAt)}${c.title ? ` — ${c.title}` : ""}`}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-right transition ${
                  c.id === selected.id
                    ? "border-teal/50 bg-teal/10"
                    : "border-white/10 hover:border-white/30 hover:bg-white/[0.04]"
                }`}
              >
                {/* الاسمُ والمقاعدُ في الخيارات لا في السطر المطويّ:
                    شعبتان تبدآن في اليوم نفسِه (صباحيّةٌ ومسائيّة) كانتا سطرين
                    متطابقين حرفا بحرف — فالاختيارُ بينهما رجمٌ بالغيب. والمقاعدُ
                    هي «حسب التوفّر» عينُه: من يختار موعدا يحتاج أن يعرف أيُّها
                    يوشك أن يمتلئ قبل أن يقع اختيارُه عليه. */}
                <span className="min-w-0">
                  <When c={c} />
                  {c.title && <span className="mt-0.5 block truncate text-micro leading-4 text-muted-foreground">{c.title}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {typeof c.seatsLeft === "number" && c.seatsLeft <= 5 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-micro font-black text-gold-ink">
                      <Users className="h-2.5 w-2.5" />
                      {c.seatsLeft}
                    </span>
                  )}
                  {c.id === selected.id && <Check className="h-3.5 w-3.5 text-teal-light-ink" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
