/* دليلُ الشاشات — «ما الذي أملكه، وأين أجده؟»
 *
 * ── العطبُ الذي وُلد منه، مقيسا ──
 *
 * في اللوحة **ثمانٍ وعشرون شاشة**، والموضعُ الوحيدُ الذي يعدّها كلَّها هو
 * الشريطُ الجانبيّ — و`hidden lg:block` يخفيه دون ألفٍ وأربعةٍ وعشرين بكسلا.
 * فصاحبُ المنصّة على هاتفه لا يرى إلّا قائمةً منسدلةً يفتحها فيقرأ ثمانيةً
 * وعشرين سطرا، أو لا يفتحها فلا يعرف ما عنده أصلا.
 *
 * وقالها (١٦ سبتمبر ٢٠٢٦): «أستطيع معرفة ما هي الخانات المتاحة لدي».
 *
 * ── ولماذا دليلٌ لا قائمةٌ ثانية ──
 *
 * القائمةُ تُجيب «خُذني إلى ما أعرف اسمَه». والدليلُ يجيب سؤالا آخر: **ما
 * الذي يقع تحت كلِّ عنوان؟** فلكلّ شاشةٍ هنا سطرٌ يقول ما تفعله — وهو
 * الفرقُ بين «طلبات المتعلّمين» و«الطلبة المسجَّلون»، وبين «الكتالوج»
 * و«تأليف المتون». ومن لا يُقال له الفرقُ يفتح الاثنتين ليعرفه.
 *
 * ── والمصدرُ واحد ──
 *
 * المجموعاتُ والسطورُ من `sectionsFor` نفسِها التي يقرؤها الشريط — فلا
 * يعِد الدليلُ بشاشةٍ لا بابَ لها في القائمة، ولا تظهر في القائمة شاشةٌ
 * لا يعرفها الدليل. ولا يُعرض ما لا يملك صاحبُ الجلسة صلاحيّتَه.
 */

import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { sectionsFor } from "@/pages/admin/nav-map";
import { useRealSession } from "@/services/session";
import { Card, Inset } from "@/components/ui/Surface";

export default function ScreenDirectory({ className = "" }: { className?: string }) {
  const { user } = useRealSession();
  const sections = sectionsFor(user?.permissions);
  if (sections.length === 0) return null;

  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <section className={className} aria-labelledby="screen-directory">
      <h2 id="screen-directory" className="text-lg font-black">كلّ الشاشات</h2>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        {/* العددُ يُقال لأنّه جوابُ «ما الذي عندي» — والمعروضُ ما تملكه أنت لا ما في المنصّة */}
        <span className="tabular-nums">{total}</span> شاشةً تملكها، موزّعةً على{" "}
        <span className="tabular-nums">{sections.length}</span> مجموعات — وما لا تملكه لا يُعرض.
      </p>

      {/* ═══ ولماذا عمودان لا ثلاثة ═══

          السطرُ تحت كلّ اسمٍ جملةٌ لا كلمة، وثلاثةُ أعمدةٍ تقصّها إلى سطرين
          وثلاثة فتصير البطاقةُ كتلةً رماديّة. فعمودان على الواسع وعمودٌ على
          الهاتف — والقراءةُ هي المقصودة، لا حشرُ أكبرِ عددٍ في أقلّ ارتفاع. */}
      {/* `items-start`: المجموعاتُ مختلفةُ الطول («ابدأ من هنا» شاشتان
          و«الكتالوج» خمس)، وبلا هذا تتمدّد القصيرةُ لتساوي جارتَها فيبقى
          في ذيلها فراغٌ لا يحمل شيئا. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title} as="section" className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-read font-black text-foreground">
              <s.icon className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
              {s.title}
              <span className="ms-auto shrink-0 tabular-nums text-fine font-bold text-muted-foreground">
                {s.items.length}
              </span>
            </h3>
            <div className="grid gap-2">
              {s.items.map((t) => (
                <Inset
                  key={t.to}
                  as={Link}
                  interactive
                  to={t.to}
                  className="group flex items-start gap-2.5 px-3 py-2.5"
                >
                  <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-read font-bold text-foreground">{t.label}</span>
                    <span className="mt-0.5 block text-fine leading-5 text-muted-foreground">{t.descAr}</span>
                  </span>
                  <ChevronLeft
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5 group-hover:text-teal-light-ink"
                    aria-hidden="true"
                  />
                </Inset>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
