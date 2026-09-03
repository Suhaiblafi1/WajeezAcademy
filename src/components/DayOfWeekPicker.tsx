import { DAY_CODES } from "@/application/schedule/days";
import { dayLabelAr } from "@/utils/format";

/** منتقي أيّام الشعبة — رموزٌ تُنقر لا نصٌّ يُكتب.

    كانت الأيّام تُكتب نصّا حرّا في نموذجَي الإنشاء والتحرير، وتُشقّ على
    الفاصلة وتُخزَّن كما كُتبت. والمخزَّنُ في القاعدة رموزٌ إنجليزيّة
    (`sun`…`sat`) يعرّبها `dayLabelAr` عند العرض — فوقع عطبان:

    ١) النموذجُ يقترح «الأحد، الثلاثاء» فيُخزَّن النصُّ العربيُّ حرفيّا،
       و`dayLabelAr` يُرجع ما لا يعرفه كما هو فيبدو صحيحا على الشاشة —
       وقاعدةُ البيانات فيها تمثيلان ليومٍ واحد.
    ٢) ونموذجُ التحرير يُملأ بـ`daysOfWeek.join("، ")` فيرى المحرِّرُ
       «tue، thu» بالإنجليزيّة في شاشةٍ عربيّة، فإن أعاد كتابتَها بالعربيّة
       بدّل التمثيل من حيث لا يدري.

    والمنتقي يُغلق البابين معا: ما يُنقر رمزٌ، وما يُعرض عربيٌّ، والمصدر
    واحد (`DAY_CODES`). */
export default function DayOfWeekPicker({
  value, onChange, label = "أيّام الأسبوع",
}: { value: string[]; onChange: (next: string[]) => void; label?: string }) {
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((d) => d !== code) : [...DAY_CODES].filter((d) => d === code || value.includes(d)));

  return (
    <fieldset className="text-xs text-muted-foreground">
      <legend className="mb-1">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {DAY_CODES.map((code) => {
          const on = value.includes(code);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(code)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                on ? "border-teal bg-teal/15 text-teal-light-ink" : "border-white/15 text-muted-foreground hover:border-white/35"
              }`}
            >
              {dayLabelAr(code)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
