/* الهاتف أوّلا — وما يُقاس فيه لا يُترك للتقدير.

   ثلاثةُ أعطابٍ ظهرت في استعمالٍ حقيقيّ على هاتف، ومصدرُها واحد: أساسٌ
   ينقصه سطران، وحقلٌ يسمّي شيئا ويعرض غيرَه. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { courseDomain } from "@/data/courses";
import { pathwayCategory } from "@/data/pathways";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("ثبات الصفحة على الهاتف", () => {
  const css = read("src/index.css");

  it("١) الخطّ لا يُضخَّم من تلقاء المتصفّح", () => {
    /* كروم على أندرويد يرفع حجم الخطّ في الأعمدة الضيّقة (font boosting)،
       فيخرج العنوان بحجمٍ غير الذي ضُبط ويكسر السُّلَّم الطباعيّ — ولا يظهر
       في أيّ محاكاة على الحاسوب. */
    expect(css).toMatch(/-webkit-text-size-adjust:\s*100%/);
    expect(css).toMatch(/[^-]text-size-adjust:\s*100%/);
  });

  it("٢) ولا انحرافَ أفقيّا — والترويسةُ اللاصقة تبقى لاصقة", () => {
    /* زخارفُ الخلفية دوائرُ مطلقة عرضُها ٤٠٠–٤٨٠px تمتدّ خارج الشاشة عمدا،
       فتصير على ٣٩٠px امتدادا يُمسك بالإصبع. و`clip` تقصّها بلا أن تُنشئ
       سياق تمرير — بخلاف `hidden` التي تكسر `sticky` في الأبناء. */
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(css).not.toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it("٣) والهيرو ينتهي حيث ينتهي محتواه — لا بحشوٍ ثابت", () => {
    const home = read("src/pages/Home.tsx");
    /* كانت `pt-28` (١١٢px) والترويسةُ ٦٤px — نحوُ ٥٠px فراغا ميتا */
    expect(home).not.toMatch(/id="top"[^>]*\bpt-28\b/);
    expect(home).toMatch(/id="top"[^>]*\bpt-20\b/);
    /* وقسمُ التشخيص لا يدفع زرَّه تحت الحافّة */
    expect(home).not.toMatch(/id="diagnostic"[^>]*className="relative py-20/);
  });
});

describe("«المجال» مجالٌ معرفيّ لا فئةٌ مستهدفة", () => {
  it("٤) دورةُ الأمن السيبرانيّ مجالُها الأمن لا «موظفون»", () => {
    /* كان الحقل يسمّي نفسَه «المجال» ويُملأ بـ`pathwayCategory` — وتلك
       تُعيد جمهورا. فمن يُتقن الأمن السيبرانيّ لا يجده في القائمة. */
    expect(courseDomain("C-CYB-101")).toBe("الأمن السيبراني");
    expect(courseDomain("C-AI-101")).toBe("الذكاء الاصطناعي");
    expect(courseDomain("C-FINM-101")).toBe("المالية والمحاسبة");
    /* وهذه هي الفئة المستهدفة — شيءٌ آخر تماما */
    expect(pathwayCategory("PW-EMP-001")).toBe("موظفون ومختصون");
  });

  it("٥) ولا عائلةَ تختفي بصمت — ما لم يُسمَّ يقع في «أخرى»", () => {
    expect(courseDomain("C-ZZZ-999")).toBe("أخرى");
    expect(courseDomain("")).toBe("أخرى");
  });

  it("٦) والمنتقي يقرأ المجال من معرّف الدورة لا من جمهور مسارها", () => {
    const picker = read("src/components/TeachableCoursePicker.tsx")
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
    expect(picker).toContain("courseDomain");
    expect(picker).not.toContain("pathwayCategory");
  });
});
