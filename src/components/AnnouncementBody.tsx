/* نصُّ إعلان الإدارة كما يراه المدرّب — فقراتٌ تفصلها سطورٌ فارغة، وروابطُ تُضغط
   (٦ أكتوبر ٢٠٢٦).

   تعرضه نافذةُ المدرّب (`pages/trainer/TrainerAnnouncement.tsx`) ومعاينةُ الإدارة
   (`pages/admin/TrainerAnnouncements.tsx`) من هنا معا — فما تراه الإدارةُ قبل الإرسال
   هو ما يصل، روابطُه كروابطه. وما يُعدّ رابطا في `application/text/linkify.ts`.

   · **يُفتح في لسانٍ آخر**: من يقرأ الإعلانَ في بوّابته لا يخرج منها، والنافذةُ باقيةٌ
     حتّى يضغط «قرأتُه».
   · **وباتّجاه نصّه** (`dir="ltr"`): لا تنقلب شرطتُه المائلة ولا تقفز نقطتُه بين
     الكلام العربيّ.
   · **ويلتفّ أينما كان**: رابطٌ طويلٌ لا يمدّ النافذةَ على الهاتف. */

import { linkSegments } from "@/application/text/linkify";

export default function AnnouncementBody({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 text-read leading-7 ${className}`}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">
          {linkSegments(para).map((s, j) =>
            s.kind === "link" ? (
              <a
                key={j}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="font-bold text-teal-light-ink underline underline-offset-4 [overflow-wrap:anywhere] hover:text-teal-ink"
              >
                {s.text}
              </a>
            ) : (
              s.text
            ),
          )}
        </p>
      ))}
    </div>
  );
}
