/* نصُّ إعلان الإدارة كما يراه المدرّب — فقراتٌ تفصلها سطورٌ فارغة، وروابطُ تُضغط
   (٦ أكتوبر ٢٠٢٦).

   تعرضه نافذةُ المدرّب (`pages/trainer/TrainerAnnouncement.tsx`) ومعاينةُ الإدارة
   (`pages/admin/TrainerAnnouncements.tsx`) من هنا معا — فما تراه الإدارةُ قبل الإرسال
   هو ما يصل، روابطُه كروابطه. والعرضُ نفسُه في `LinkedText` (١٠ أكتوبر ٢٠٢٦): به يُقرأ
   تسليمُ المتعلّم في «طابور التصحيح» كذلك، فلا تفترق القاعدتان. */

import LinkedText from "@/components/LinkedText";

export default function AnnouncementBody({ text, className = "" }: { text: string; className?: string }) {
  return <LinkedText text={text} className={`text-read leading-7 ${className}`} />;
}
