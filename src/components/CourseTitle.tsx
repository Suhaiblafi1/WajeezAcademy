/* عنوان دورة كما يُعرض: «دورة» قبله، والمصطلح الإنجليزي وسما تحته.
   وضعُ المصطلح داخل العنوان بين قوسين يُطيل السطر ويخلط اتجاهين في نصٍّ
   واحد؛ والسطر المستقلّ المعزول بـdir="ltr" يحفظ الشكل ويمنع انقلاب الأقواس
   والأرقام في العربية.

   ── ولمَ صار **وسما** لا سطرا عاريا (صاحب المنصّة، ١٥ سبتمبر ٢٠٢٦) ──

   «غيّر تصميم الجملة التي تكون بالإنجليزي لشيءٍ آخر داخل مربّعٍ شفّاف مثلا،
   لكي لا تكون مرميّةً هكذا».

   وهي كانت كذلك فعلا: سطرٌ لاتينيٌّ رماديٌّ معلَّقٌ تحت عنوانٍ عربيّ، بلا
   حدٍّ ولا أرضيّةٍ تقول ما هو — فيُقرأ بقيّةَ العنوان أو سهوا في التنضيد. وهو
   في الحقيقة **مصطلحُ السوق** لهذه الدورة: بيانٌ عن العنوان لا امتدادٌ له.

   فصار رقاقةً بأرضيّة السطح الافتراضيّة نفسِها (`border-white/10 bg-white/[0.03]`
   من سلّم الأسطح) — تحدّه فيُعرف أنّه شيءٌ آخر، وتبقى شفّافةً فلا تزاحم
   الاسمَ الذي فوقها. */

import { courseTitleAr, hasTermEn } from "@/application/catalog/course-title";

export default function CourseTitle({
  name,
  termEn,
  as: Tag = "h2",
  className = "",
  termClassName = "",
}: {
  name: string;
  termEn?: string | null;
  as?: "h1" | "h2" | "h3" | "h4" | "p";
  className?: string;
  termClassName?: string;
}) {
  return (
    <>
      <Tag className={className}>{courseTitleAr(name)}</Tag>
      {hasTermEn(termEn) && (
        <span
          dir="ltr"
          className={`mt-1.5 inline-block rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-fine tracking-wide text-muted-foreground ${termClassName}`}
        >
          {termEn}
        </span>
      )}
    </>
  );
}
