/* شاشة التأليف — حارسٌ على ما يسهل أن ينزلق منها.

   ثلاثةُ أشياء تُفقد بلا أن يسقط تحقّقُ النوع ولا التلويم:

   ١) **المعاينة بعارض المتعلّم نفسِه.** لو استُبدل `LessonBody` بـ`<pre>`
      أو بمعاينةٍ «تقريبيّة»، لبدت الشاشة سليمة — ولصار ما يُكتب غيرَ ما
      يُقرأ، ولا يُكتشف إلّا بعد النشر.

   ٢) **الحكمُ بالمحلّلات نفسها.** الخادم يردّ ٤٢٢ بـ`validateChecks`
      و`validateScenario` و`validateVideo`. فلو حكمت الشاشة بقاعدةٍ من
      عندها لاختلف الحكمان، وكُتبت صفحةٌ ثمّ رُدّت.

   ٣) **لا اسمَ كاتبٍ على الشاشة.** الاتّفاق أن يُنشر المحتوى **باسم
      الأكاديمية**. والسجلُّ يعيد `hasAuthor` لا معرّفا ولا اسما — فلا
      يجوز أن تعرض الشاشة حقلا لا تملكه، ولا أن يُضاف لاحقا بلا انتباه. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/pages/admin/Authoring.tsx"), "utf8");
/* يُجرَّد التعليق كي لا يحرس الحارسُ شرحَه هو */
const CODE = SRC.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/\/\/[^\n]*/g, "");

describe("شاشة تأليف المتون", () => {
  it("١) تعاين بعارض المتعلّم نفسِه — لا بنسخةٍ تقريبيّة", () => {
    for (const c of ["LessonBody", "ModuleCheck", "ModuleVideo", "DecisionScenario"]) {
      expect(CODE).toContain(`@/components/${c}`);
      expect(CODE).toContain(`<${c}`);
    }
  });

  it("٢) وتحكم بالمحلّلات التي يحكم بها الخادم", () => {
    expect(CODE).toContain("validateChecks");
    expect(CODE).toContain("validateScenario");
    expect(CODE).toContain("validateVideo");
    /* من `@/application/content` — المصدر نفسه الذي يستورده الخادم */
    expect(CODE).toMatch(/@\/application\/content\/module-checks/);
    expect(CODE).toMatch(/@\/application\/content\/scenario/);
    expect(CODE).toMatch(/@\/application\/content\/module-video/);
  });

  it("٣) ولا تعرض اسم كاتبٍ ولا معرّفه", () => {
    for (const forbidden of ["createdBy", "reviewedBy", "authorName", "authorId"]) {
      expect(CODE).not.toContain(forbidden);
    }
    /* وتقول للكاتب صراحةً أنّ النشر باسم الأكاديمية */
    expect(SRC).toContain("باسم الأكاديمية");
  });

  it("٤) وتفصل الكتابة عن النشر كما يفصلهما الخادم", () => {
    expect(CODE).toContain("catalog.course.publish");
    /* زرّا القرار خلف الصلاحية، لا ظاهران للجميع */
    expect(CODE).toMatch(/isReview && canDecide/);
  });

  it("٥) ولا تسمح برفع وحدةٍ بلا متن — كما يمنعه الخادم", () => {
    expect(CODE).toMatch(/disabled=\{[^}]*!draft\.bodyAr\?\.trim\(\)/);
  });

  it("٦) وتُظهر التاريخ بوحدة التاريخ الواحدة لا بـtoLocaleString مباشرة", () => {
    expect(CODE).toContain("fmtShortDateTimeAr");
    expect(CODE).not.toMatch(/toLocaleString\(\s*["']ar-SA/);
    expect(CODE).not.toMatch(/toLocaleDateString\(/);
  });
});

describe("تسجيل الشاشة في اللوحة", () => {
  const LAYOUT = readFileSync(join(process.cwd(), "src/pages/admin/AdminLayout.tsx"), "utf8");
  const APP = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

  it("لها مسارٌ وتبويبٌ مشروطٌ بصلاحيّة الكتابة", () => {
    expect(APP).toContain('path="/admin/authoring"');
    expect(LAYOUT).toContain('to: "/admin/authoring"');
    expect(LAYOUT).toMatch(/\/admin\/authoring[\s\S]{0,120}catalog\.course\.edit/);
  });
});
