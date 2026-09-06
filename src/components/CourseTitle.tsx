/* عنوان دورة كما يُعرض: «دورة» قبله، والمصطلح الإنجليزي سطرا ثانويا تحته.
   وضعُ المصطلح داخل العنوان بين قوسين يُطيل السطر ويخلط اتجاهين في نصٍّ
   واحد؛ والسطر المستقلّ المعزول بـdir="ltr" يحفظ الشكل ويمنع انقلاب الأقواس
   والأرقام في العربية. */

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
        <span dir="ltr" className={`mt-0.5 block text-fine tracking-wide text-muted-foreground ${termClassName}`}>
          {termEn}
        </span>
      )}
    </>
  );
}
