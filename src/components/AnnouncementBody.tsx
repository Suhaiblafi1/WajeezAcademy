/* نصُّ إعلان الإدارة كما يراه المدرّب — فقراتٌ تفصلها سطورٌ فارغة، وروابطُ تُضغط
   (٦ أكتوبر ٢٠٢٦).

   تعرضه نافذةُ المدرّب (`pages/trainer/TrainerAnnouncement.tsx`) ومعاينةُ الإدارة
   (`pages/admin/TrainerAnnouncements.tsx`) من هنا معا — فما تراه الإدارةُ قبل الإرسال
   هو ما يصل، روابطُه كروابطه. والعرضُ نفسُه في `LinkedText` (١٠ أكتوبر ٢٠٢٦): به يُقرأ
   تسليمُ المتعلّم في «طابور التصحيح» كذلك، فلا تفترق القاعدتان.

   ═══ وصورةٌ في الرسالة (١٠ نوفمبر ٢٠٢٦) ═══

   «اجعلها سكرين شوت ضمن الرسالة ليس رابطا» (صاحب المنصّة). ففقرةٌ هي رابطُ صورةٍ من
   موقعنا وحدَه تُرسم صورةً تُفتح كاملةً بضغطة — والقاعدةُ واحدةٌ مع البريد
   (`announcementImage` في `application/trainer/announcement.ts`). */

import LinkedText from "@/components/LinkedText";
import { announcementImage } from "@/application/trainer/announcement";

export default function AnnouncementBody({ text, className = "" }: { text: string; className?: string }) {
  const site = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {text.split(/\n{2,}/).map((para, i) => {
        const src = site ? announcementImage(para, site) : null;
        return src ? (
          <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="block">
            <img src={src} alt="صورة من الإعلان" loading="lazy"
              className="w-full rounded-xl" />
          </a>
        ) : (
          <LinkedText key={i} text={para} className="text-read leading-7" />
        );
      })}
    </div>
  );
}
