/* بابُ البحث في البوّابات — ضربةُ Ctrl+K مرئيّةً.

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «شكل الsearch غبي». وكان زرّا نصّيّا
   صرفا: كلمةُ «بحث…» ثمّ `Ctrl K` بحرفٍ لاتينيٍّ بعدها. وعلّةُ قبحه ثلاثةٌ
   مجتمعة:

   · **لا عدسة.** بحثُ الزائر في الموقع العامّ له أيقونةٌ تقول ما هو من غير
     قراءة؛ وبحثُ البوّابات بلا شيء — فيُقرأ لصيقةً شاردةً لا زرّا.
   · **والمفتاحُ اللاتينيُّ بعد العربيّة** في شريطٍ يمينيٍّ يبدو تابعا لما
     يليه لا لما قبله، فينفصل عن كلمته.
   · **والنقاطُ الثلاث** بعد «بحث» تقول «نافذةٌ تُفتح»، ومع المفتاح تُقرأ
     نصّا مبتورا.

   والعلاجُ أن يبدو **حقلا** لا لصيقة: عدسةٌ في أوّله، ونصٌّ يقول أين يبحث،
   والمفتاحُ في طرفه الآخر — وهي الصورةُ التي يعرفها كلُّ من فتح محرّرا.
   وعرضٌ ثابتٌ يملأ موضعَه في الشريط بدل أن ينكمش على كلمتَين.

   ─────────── ولمَ مكوّنٌ واحدٌ لا نسختان ───────────

   كان الزرُّ مكتوبا بيده مرّتين: في `AdminLayout` وفي `TrainerLayout`. وهو
   فخُّ ع-٥ بعينه — تُصلح شاشةً فتعيدها التي بعدها. فصار واحدا يناديانه،
   ويحرس تطابقَهما `src/tests/site/search-chip.test.ts`. */
import { Search } from 'lucide-react'

export default function SearchChip({ hintAr, className = '' }: {
  /** أين يبحث — يختلف بين بوّابةٍ وأخرى، وهو نصفُ فائدة الحقل */
  hintAr: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('wajeez:open-search'))}
      aria-label={`${hintAr} — Ctrl+K`}
      title={`${hintAr} — Ctrl+K`}
      className={
        'group hidden min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-white/12 '
        + 'bg-white/[0.03] px-3 py-2 text-fine text-muted-foreground transition '
        + 'hover:border-teal/50 hover:text-foreground '
        + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal '
        + `focus-visible:ring-offset-2 focus-visible:ring-offset-paper md:flex ${className}`
      }
    >
      <Search className="h-3.5 w-3.5 shrink-0 transition group-hover:text-teal-light-ink" aria-hidden="true" />
      {/* لا `flex-1` ولا عرضٌ مفروض: الزرُّ بقَدرِ نصّه فلا يُبتر. ونصٌّ
          مبتورٌ في زرٍّ هو بعينه ما شُكي منه — «شكلٌ غبيّ» يبدأ من هنا. */}
      <span className="whitespace-nowrap text-start">{hintAr}</span>
      {/* المفتاحُ في الطرف الأقصى: لا يلتصق بالكلمة فيُقرأ امتدادا لها */}
      <kbd className="shrink-0 rounded border border-white/15 px-1.5 font-mono text-fine" dir="ltr">Ctrl K</kbd>
    </button>
  )
}
