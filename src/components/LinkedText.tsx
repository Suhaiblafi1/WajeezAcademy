/* نصٌّ مكتوبٌ باليد بروابطَ تُضغط وتُقرأ — فقراتٌ تفصلها سطورٌ فارغة (١٠ أكتوبر ٢٠٢٦).

   كان لإعلانات المدرّبين وحدَها (`AnnouncementBody`)، وتسليمُ المتعلّم في «طابور التصحيح»
   حرفٌ ميّت: رابطٌ يُلصقه المتعلّمُ لعمله يصل المدرّبَ نصّا يُنسخ باليد، و«%D8%A7…» بدل
   حروفه. وقال صاحبُ المنصّة: «we should make the text readable on links for the trainers…
   solve it not limiting the trainers». فالقاعدةُ واحدةٌ لكلّ نصٍّ يكتبه إنسانٌ لإنسان:

   · **يُفتح في لسانٍ آخر**: من يصحّح أو يقرأ لا يخرج من شاشته.
   · **وباتّجاه نصّه** (`dir="ltr"`): لا تنقلب شرطتُه المائلة بين الكلام العربيّ.
   · **ويُقرأ بحروفه** (`readableUrl`)، والعنوانُ الذي يُفتح كما كُتب.
   · **ويلتفّ أينما كان**: رابطٌ طويلٌ لا يمدّ البطاقةَ على الهاتف.

   وما يُعدّ رابطا في `application/text/linkify.ts`. */

import { linkSegments, readableUrl } from "@/application/text/linkify";

export default function LinkedText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
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
                {readableUrl(s.text)}
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
