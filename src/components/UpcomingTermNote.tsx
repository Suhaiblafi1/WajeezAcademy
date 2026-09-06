/* «الفصل القادم» — جوابُ «متى تبدأ؟» في موضعٍ واحدٍ لا خمسة (البند ٥٢).

   ─────────── ما كان ───────────

   صفحتا `/courses` و`/pathways` **لا تعرضان تاريخا إطلاقا**. وفي صفحة المسار
   وصفحة الدورة، الجوابُ الصادقُ الوحيدُ عن «متى تبدأ؟» هو **«يُعلن الموعدُ مع
   فتح الشعبة»** — وهو صادقٌ ولا يفيد: يقرؤه الزائرُ فلا يعرف أينتظر أسبوعا
   أم فصلا، فيغلق الصفحةَ ولا يترك أثرا. ودعواتُ الرئيسة كلُّها بلا تاريخ،
   ودعوةٌ بلا تاريخٍ تُقرأ لافتةً لا نداء.

   ─────────── ولماذا مكوّنٌ واحدٌ لا خمسُ جملٍ ───────────

   الجملةُ تُقال في خمسة أسطح: الكتالوج، وصفحةُ المسار، وصفحةُ الدورة، ومنتقي
   الشعب حين لا شعبةَ له، ودعوةُ الرئيسة. وخمسُ نسخٍ من جملةٍ فيها تاريخٌ
   ونافذةٌ وعدُّ أيّامٍ تفترق عند أوّل تعديل — وقد رأينا ذلك في هذا المستودَع
   أكثرَ من مرّة.

   فالنصُّ في `application/terms/upcoming-text` وحدَه، وهذا الملفّ شكلُه.

   ─────────── وما لا يُقال ───────────

   · **ما لم يُنشأ فصلٌ بعدُ لا يُخترع موعد**: يعود `null` فيبقى ما كان.
   · **ولا يُقال «التسجيل مفتوح» إلّا حين يكون مفتوحا فعلا** — والحسابُ من
     الخادم لا من مقارنةِ تواريخَ في المتصفّح (ساعةُ الزائر ليست ساعتَنا). */

import { CalendarDays } from 'lucide-react'
import { useUpcomingTerm } from '@/services/upcoming-term'
import { termMonthsAr, termUrgencyAr } from '@/application/terms/upcoming-text'

/* ─────────── الأشكالُ الثلاثة ─────────── */


/** سطرٌ داخل نصٍّ قائم — يستبدل «يُعلن الموعد مع فتح الشعبة» ولا يزيحها.

    و`fallback` هو ما يُقال حين لا فصلَ بعد: الجملةُ القديمةُ حيث كانت
    جملةً قائمة، ولا شيءَ حيث كان الموضعُ فارغا أصلا. */
export function UpcomingTermLine({
  prefix = 'تُفتح في',
  fallback = null,
}: {
  prefix?: string
  fallback?: React.ReactNode
}) {
  const term = useUpcomingTerm()
  if (!term) return <>{fallback}</>
  const urgency = termUrgencyAr(term)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span>
        {prefix} <span className="font-black text-teal-light-ink">{term.titleAr}</span>
      </span>
      <span className="font-normal text-muted-foreground">({termMonthsAr(term)})</span>
      {urgency && <span className="font-normal text-teal-light-ink">{urgency}</span>}
    </span>
  )
}

/** لوحٌ فوق نتائج الكتالوج — الصفحتان اللتان لا تعرضان تاريخا إطلاقا */
export function UpcomingTermBanner({ className = '' }: { className?: string }) {
  const term = useUpcomingTerm()
  if (!term) return null
  const urgency = termUrgencyAr(term)
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-teal/25 bg-teal/[0.06] px-4 py-3 ${className}`}
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
      <span className="text-sm font-black text-foreground">
        الفصلُ القادم: <span className="text-teal-light-ink">{term.titleAr}</span>
      </span>
      <span className="text-xs text-muted-foreground">{termMonthsAr(term)}</span>
      {urgency && <span className="text-xs font-bold text-teal-light-ink">{urgency}</span>}
      {term.calendarPublished && (
        <a
          href="/calendar"
          className="ms-auto text-xs font-bold text-teal-light-ink underline underline-offset-4 hover:text-teal-ink"
        >
          تصفّح تقويم الفصل
        </a>
      )}
    </div>
  )
}
