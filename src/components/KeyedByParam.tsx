/* ═══ صفحةٌ تُبنى من جديد لكلّ معرّف — لا تحمل ما في يدها من صفحةٍ إلى أخرى (٢٤ أكتوبر ٢٠٢٦) ═══

   الموجِّهُ يُبقي المكوّنَ نفسَه حين يتغيّر المعرّفُ وحدَه في الرابط (`/trainer/cohort/:id`). فمن انتقل
   من شعبةٍ إلى أخرى بالجرس أو بزرّ الرجوع بقيت في يده خطّةُ الأولى حتّى تصل الثانية — وحفظٌ تلقائيٌّ في
   تلك اللحظة، أو رفعٌ انتهى بعد الانتقال، كتب ملفَّ الأولى في خطّة الثانية (`cohort-file-adopt.ts`).
   فالمفتاحُ هنا هو المعرّف: تغيّرُه يهدم الصفحةَ ويبنيها — فيحفظ خروجُها ما في يدها لشعبتها هي
   (`leaveSave`)، وتبدأ الأخرى فارغة اليد. */

import { Fragment, type ReactNode } from "react";
import { useParams } from "react-router";

export function KeyedByParam({ param = "id", children }: { param?: string; children: ReactNode }) {
  const params = useParams();
  return <Fragment key={params[param] ?? ""}>{children}</Fragment>;
}
