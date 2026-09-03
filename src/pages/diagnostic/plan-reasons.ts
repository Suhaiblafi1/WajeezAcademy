/* سببُ وجود المقرّر في الخطّة — بلغة المتعلّم لا بلغة المحرّك.

   دالّتان نقيّتان: نصٌّ داخلٌ في نصّ، لا حالةَ ولا رسمَ. وهما في ملفٍّ
   مستقلٍّ لا مع البطاقات، لأنّ قاعدةَ التلويم في هذا المستودع تمنع أن يصدّر
   ملفُّ مكوّناتٍ دوالَّ عاديّةً معها — والسببُ عمليّ: تحديثُ React السريع
   يعيد بناءَ الملفّ كلِّه إن اختلط النوعان.

   وتُقرآن من موضعَين: بطاقاتُ النتيجة، وصفحةُ التشخيص نفسُها. */

import { skillNamesAr, courseById as catalogCourseById } from "@/domain/diagnostic/catalog";
import { type ComposedCourseView } from "@/components/ComposedPlanCard";

/* ═══════════ رحلة الدورات القابلة للتخصيص — «ماذا ستحقق من خلال خطتك؟» ═══════════ */

/* سبب وجود المقرر في خطة مركّبة من المقررات — بلغة المتعلم لا بلغة المحرك.

   كان السطر «يسدّ ٤ من فجواتك المقيسة · في صميم مجالك الأول» — ويظهر بنصّه هذا
   حرفيا تحت كل دورة في الخطة. عددٌ متساوٍ ووصفٌ ثابت لا يفرّقان دورة عن أخرى،
   فسؤال «لماذا هذه بالذات؟» يبقى بلا جواب رغم وجود سطر يدّعي أنه جوابه.
   والمحرك يعرف أيّ الفجوات تسدّها كلٌّ منها بالاسم (closesGaps رموزُ مهارات)،
   فتُسمّى. وتُذكر الصفة الثابتة «في صميم مجالك» فقط حين تنتفي — أي حين يخرج
   المقرر عن مجاله الأول — لأن ذلك وحده ما قد يفاجئ القارئ. */
export function composedReason(c: ComposedCourseView): string {
  const bits: string[] = [];
  const names = skillNamesAr(c.closesGaps);
  if (names.length > 0) {
    const shown = names.slice(0, 3).join('، ');
    const rest = names.length - 3;
    bits.push(
      names.length === 1
        ? `يسدّ فجوتك في ${shown}`
        : `يسدّ فجواتك في ${shown}${rest > 0 ? ` و${rest === 1 ? 'واحدة' : `${rest}`} غيرها` : ''}`,
    );
  }
  if (!c.onAnchor) bits.push('من خارج مجالك الأول — أُدرج لفجوة قوية');
  return bits.length > 0 ? `${bits.join(' · ')}.` : 'يبني الأساس الذي تقوم عليه بقية خطتك.';
}

/* سبب وجود المقرر في خطة قالب مركّب.

   القالب يعطي كل مقرر وصفَ دوره فقط: «مقرر أساسي في هذه الخطة» — وهو نصّ واحد
   يتكرر تحت ستة مقررات، فيسأل القارئ «ولماذا هذا بالذات؟» ولا يجد جوابا.
   الجواب موجود على جهازه أصلا: مهارات المقرر تتقاطع مع فجواته المقاسة، والفارق
   بين مقرر وآخر هو أيّ فجوة يسدّ. فإن عُرف التقاطع سُمّي، وإلا بقي وصف الدور
   كما هو — لا نخترع سببا حيث لا دليل. */
export function templateCourseReason(courseId: string, gapSlugs: Set<string>, fallbackAr: string): string {
  const skills = catalogCourseById.get(courseId)?.skill_slugs ?? [];
  const named = skillNamesAr(skills.filter((s) => gapSlugs.has(s)));
  if (named.length === 0) return fallbackAr;
  const shown = named.slice(0, 3).join("، ");
  const rest = named.length - 3;
  const head =
    named.length === 1
      ? `يسدّ فجوتك في ${shown}`
      : `يسدّ فجواتك في ${shown}${rest > 0 ? ` و${rest === 1 ? "واحدة" : rest} غيرها` : ""}`;
  /* وصف الدور يبقى فقط حين يضيف معنى — الشرطي والجسري يفسّران سبب الإدراج،
     أما «أساسي» فهو حال الأغلب فلا يفرّق. */
  const roleAdds = !fallbackAr.startsWith("مقرر أساسي");
  return roleAdds ? `${head} · ${fallbackAr}` : `${head}.`;
}
