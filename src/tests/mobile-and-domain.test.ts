/* الهاتف أوّلا — وما يُقاس فيه لا يُترك للتقدير.

   ثلاثةُ أعطابٍ ظهرت في استعمالٍ حقيقيّ على هاتف، ومصدرُها واحد: أساسٌ
   ينقصه سطران، وحقلٌ يسمّي شيئا ويعرض غيرَه. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COURSE_DOMAIN_FAMILIES, courseDomain, courseDomainByFamily,
} from "@/data/courses";
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

/* ── شريطُ البوّابات ──

   رصدت جولةُ ٢٠٢٦-٠٩ في بوّابة المدرّب تسعةَ رموزٍ **بلا كلمة** بعرض ٣٩٠:
   النصُّ `hidden sm:inline`، فيصير كلُّ عنصرٍ ٣٨×٤٤ بكسلا يُميَّز بالرمز
   وحدَه. والعرضُ فوق ٢٤ التي تشترطها WCAG 2.5.8 فليس مخالفةً — لكنّ تسعةَ
   أهدافٍ متشابهةٍ بلا اسمٍ ليست تنقّلا.

   ووجد إصلاحُه ما لم يره التقرير: **امتدادٌ أفقيٌّ في المقاسات الثلاثة
   جميعا** — التسعةُ بأسمائها ٨٦٧ بكسلا في صفٍّ مع الشعار والأدوات. ويشتدّ
   على الحاسوب بمعامل التكبير ١٫٣ (`#80`): إطارُ ١٤٤٠ يصير ١١٠٨ فعليّا.

   ── وما قِيس بالمتصفّح (قبل ← بعد) ──

     · ٣٩٠ — أسماءٌ مرئيّة ٠ ← ٩ · هدفٌ ٣٨×٤٤ ← ٧١–١٢٠×٤٤ · امتدادٌ نعم ← لا
     · ٨٢٠ — أسماءٌ ٩ ← ٩ · امتدادٌ نعم ← لا
     · ١٤٤٠ — أسماءٌ ٩ ← ٩ · امتدادٌ نعم ← لا · والتسعةُ في السطر بلا تمرير

   ── ثمّ خمسةٌ ثابتة، ثمّ ما وسعه الشريط ──

   صار أحدَ عشرَ ثمّ ثلاثةَ عشرَ تبويبا، فصارت خمسةٌ تُرى والباقي خلف «المزيد»
   (١٨ سبتمبر ٢٠٢٦) — على كلّ شاشة، حتّى العريضةِ التي يبقى فيها نصفُ الشريط
   فارغا. ثمّ قرّر صاحبُ المنصّة (٢٧ سبتمبر ٢٠٢٦): «اجعل قائمةَ العناوين
   مكتملةً ليست داخلَ المزيد، إلّا إذا استُخدم الهاتفُ والشاشةُ صغيرة — هناك
   نستخدم المزيدَ لمن لا يظهر». فصار الشريطُ يقيس ويعرض ما وسعه، وسقطت
   الرموزُ منه كي تسع الثلاثةَ عشرَ سطرَها (والتعليلُ بأرقامه في `ui/PortalTabs`).

   وقِيس بالمتصفّح وخطُّ IBM Plex Sans Arabic محمَّلٌ فعلا. وأوّلُ قياسٍ جرى
   بخطٍّ بديلٍ لم يصل خطُّ الويب إلى متصفّحه، فجاءت نصوصُه أعرضَ بأكثرَ من
   الربع — فلا يُبنى على رقمٍ لم يُقَس بالخطّ نفسِه. ما يُرى (قبل ← بعد):

     · ٣٩٠  — ٣ و٢ مقصوصان خلف تمريرٍ و٨ في «المزيد» ← ٣ و١٠ في «المزيد» · لا قَصّ
     · ٨٢٠  — ٥ و٨ في «المزيد» ← ٩ و٤
     · ١٠٢٤ — ٥ و٨ ← ٨ و٥ (بدءُ معامل التكبير ١٫٣)
     · ١٢٨٠ — ٥ و٨ ← ١٣ بلا «المزيد»
     · ١٤٤٠ و١٧٢٨ — ٥ و٨ ← ١٣ بلا «المزيد»
     · ولا امتدادَ أفقيّا في أيٍّ منها، ولا تبويبٌ مقصوصُ الطرف

   ── ثمّ «طبّق نفس الشيء على بوابة المستشار والطالب» (٢٧ سبتمبر) ──

   فصار الشريطُ مكوّنا واحدا (`ui/PortalTabs`) تركّبه البوّاباتُ الثلاث، وقِيس
   ما كان قبله في الاثنتين الأخريين:

     · المستشار — ٣٢٠–٤٣٠: أربعةُ رموزٍ بلا اسم، وزرُّ الحساب مقصوصٌ عند الحافّة
       (وعلى ٣٢٠ زرُّ الثيم معه). ٧٦٨ و١٠٢٤: «ما قيل عنّي» في ثلاثة أسطرٍ داخل
       حبّته، وزرّا الثيم والحساب خارجَ الشاشة. ١٢٨٠: الانطواءُ وحدَه.
       ← بعده: الأربعةُ بأسمائها من ٣٢٠ فما فوق، ولا قَصّ ولا انطواء.
     · المتعلّم، صفحاتُ «خزانتي» — ٣٢٠–٣٩٠: الخامسةُ خلف تمريرٍ لا علامةَ عليه.
       ← بعده: ٢–٣ و«المزيد»، والخمسُ من ٤٣٠.
     · المتعلّم، الأقسام — ثلاثةٌ تسع كلَّ شاشة. ومتى نُشرت «المكتبة» (قِيس بلقطة
       الكتالوج المنشورة ومادّةٍ واحدة): على ٧٦٨ لصق الشريطُ الشعارَ وخرج زرُّ
       الحساب عن الشاشة. ← بعده: الأربعةُ على ٧٦٨ وزرُّ الحساب في مكانه.

   ── وحدُّ هذا الحارس ──

   يقرأ البنيةَ لا الصفحةَ المصيَّرة: فحصُ الإتاحة في CI للصفحات العامّة،
   وهذه خلف جلساتٍ. فالأرقامُ أعلاه قِيست بيدٍ ولا يُعيدها شيءٌ آليّا — ومن
   غيّر الشريطَ أعادها. وقرارُ «كم يُعرض» نفسُه يُحرَس بأرقامٍ في
   `trainer/nav-fit.test.ts`، فهو دالّةٌ نقيّةٌ لا تحتاج متصفّحا. */

/* التعليقاتُ تُمحى أوّلا. وهذه ليست احتياطا نظريّا: أوّلُ صياغةٍ لهذا
   الحارس **مرّت خضراءَ على نقضِها** — نُزعت `min-h-11` و`shrink-0` من
   `className` فبقي التعليقُ الذي يشرحهما داخلَ الكتلة، فطابقهما الحارسُ
   في شرحِهما. وهي مصيدةُ `CLAUDE.md` بنصّها: الفحصُ على البنية لا على
   ورودِ حرفٍ في ملفّ. */
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("شريطُ البوّابات يُقرأ لا يُخمَّن", () => {
  const bar = code("src/components/ui/PortalTabs.tsx");
  /* المكوّنُ وحدَه — ما قبله `MoreTabs` وقائمتُه، ولها حارسُها في ١٢ */
  const comp = bar.slice(bar.indexOf("export function PortalTabs"));
  /* ═══ والحبّةُ درجةٌ في السلّم — فالفحصُ يتبعها ═══

     صارت صيغةُ الحبّة درجةً في `ui/NavPill.tsx` لأنّ الشريط احتاج **زرّا**
     إلى جانب روابطه («المزيد»)، والزرُّ المكتوبُ بيده يزيد عدّادَ
     `design-system.test.ts` — وقاعدتُه: «من احتاج صيغةً لا يغطّيها السلّم
     فالنقصُ في السلّم». فيُفحص الموضعان: القاعدةُ في موضعها، وأنّ الشريطَ
     يستعملها — وإلّا حرسنا قاعدةً لا تحرس الشريط. */
  const pill = code("src/components/ui/NavPill.tsx");
  /* ═══ والصفُّ المرئيُّ يُعرَف بموضعه لا بصنفه ═══

     في الشريط صفّان يقصّان: المرئيُّ، وحاويةُ الأشباح التي يُقاس بها. فمن
     بحث عن `overflow-hidden` في الكتلة وجده في الأشباح ولو نُزع من المرئيّ —
     حارسٌ أخضرُ لسببٍ خاطئ. فالمرئيُّ هو الوسمُ الذي يفتح قبل أوّل حبّةٍ
     حقيقيّة (`<NavPill ` لا `<NavPillGhost`)، وينغلق قبل أيّ شيءٍ بعدها. */
  const firstPill = comp.search(/<NavPill\s/);
  const rowOpen = comp.lastIndexOf("<div", firstPill);
  const tagAt = (i: number) => (i > -1 ? comp.slice(i, comp.indexOf(">", i) + 1) : "");
  const rowTag = tagAt(rowOpen);
  const rowClose = comp.indexOf("</div>", firstPill);

  it("٧) الاسمُ مرئيٌّ على الهاتف — لا رمزٌ يُخمَّن معناه", () => {
    /* والبوّاباتُ الثلاث معه: كان شريطُ المستشار يُخفي أسماءه تحت `sm` حتّى
       ٢٧ سبتمبر — أربعةُ رموزٍ على الهاتف لا يُعرف أيُّها «عمولتي». */
    for (const [name, src] of [
      ["الشريط", bar + pill],
      ["المدرّب", code("src/pages/trainer/TrainerLayout.tsx")],
      ["المستشار", code("src/pages/advisor/AdvisorLayout.tsx")],
      ["المتعلّم", code("src/pages/student/PortalLayout.tsx")],
    ] as const) {
      expect(
        /hidden\s+sm:inline/.test(src),
        `${name}: نصُّ التبويب مخفيٌّ تحت \`sm\`، فيصير الشريطُ رموزا متشابهةً `
        + "بعرض ٣٨ بكسلا — والمراجعُ توصي بخمسةٍ فأقلَّ في شريطٍ أوّل بلا أسماء.",
      ).toBe(false);
    }
  });

  it("٨) والصفُّ يقصّ ولا يُمرِّر — وحلقةُ التركيز لا تُقَصّ معه", () => {
    expect(firstPill, "لا حبّةَ في الشريط أصلا").toBeGreaterThan(-1);
    expect(rowTag, "لا صفَّ يحمل الحبّات").not.toBe("");
    /* القصُّ لا التمرير: ما لم يسعه الشريطُ يُبلَغ من «المزيد»، وقياسٌ بائتٌ
       لإطارٍ واحدٍ يُخفي طرفَ حبّةٍ ولا يمدّ الصفحة */
    expect(
      rowTag,
      "الصفُّ المرئيُّ لا يقصّ — فأوّلُ إطارٍ يسبق فيه الرسمُ القياسَ يمدّ الصفحةَ عرضا.",
    ).toMatch(/\boverflow-hidden\b/);
    /* وحشوُه يسبق قصَّه: حلقةُ التركيز ترتسم خارج الحبّة بأربعة بكسلات، وصفٌّ
       يقصّ عند حدّ حبّاته يقطعها من فوقُ ومن تحتُ في كلّ تبويب */
    expect(rowTag, "الصفُّ يقصّ عند حدّ حبّاته — فتُقطَع حلقةُ التركيز").toMatch(/(^|\s|`)-m-1\s[^`]*\bp-1\b/);
    expect(
      /overflow-x-auto|scrollbar-hide/.test(bar),
      "عاد التمريرُ الخفيّ — والتبويبُ بعد الحافّة موجودٌ ولا شيءَ يقول إنّه هناك "
      + "(قرارُ ١٨ سبتمبر ٢٠٢٦: نقرةٌ معلومةٌ خيرٌ من تمريرٍ مقدَّر).",
    ).toBe(false);
  });

  it("٩) وهدفُ اللمس مريحٌ لا مجرّدَ مطابقٍ للحدّ الأدنى", () => {
    /* ⚠ والفحصُ على **صيغة الحبّة** لا على الملفّ: نُزعت `shrink-0` من
       `PILL` فبقي الحارسُ أخضرَ — طابقها في `className` أيقونةٍ داخلَ
       الحبّة. وهي مصيدةُ `CLAUDE.md` بعينها، وقد وقع فيها هذا الحارسُ
       نفسُه مرّةً قبلها في تعليقٍ لا في أيقونة. والرقاقةُ مثلُها. */
    for (const name of ["PILL", "CHIP"]) {
      const cls = new RegExp(`const ${name} = '([^']*)'`).exec(pill)?.[1] ?? "";
      expect(cls, `لا صيغةَ ${name} في السلّم أصلا`).not.toBe("");
      expect(cls, `${name}: بلا \`min-h-11\` يصير الهدفُ ٢٨ بكسلا ارتفاعا`).toContain("min-h-11");
      /* و`shrink-0` كي يُرسم ما قيس: الشبحُ يقيس العرضَ الطبيعيّ، فحبّةٌ
         تنضغط تُرسم أضيقَ ممّا حُسب لها */
      expect(cls, `${name}: بلا \`shrink-0\` تنضغط الحبّةُ فيُرسم غيرُ ما قاسه الشبح`).toContain("shrink-0");
    }
    expect(comp, "الشريطُ لا يستعمل الحبّةَ — فالقاعدةُ فوقه لا تحرسه").toContain("<NavPill");
  });

  /* ═══ لا سقفَ على ما يُرى — قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) ═══

     كان هنا سقفٌ على `primary` بخمسة (قرارُ ١٨ سبتمبر). ونُسخ: الشريطُ يعرض
     ما وسعه، و«المزيد» لما لم يسعه وحدَه، ولا يظهر حين يسع الكلّ. فالمحروسُ
     الآن أنّ العددَ **يُقاس** — لا يعود رقما مكتوبا يُبقي الحاسوبَ على خمسة. */
  it("⚠️ ١٠) ولا سقفَ على ما يُرى — يُقاس، و«المزيد» لما لم يسعه وحدَه", () => {
    expect(code("src/pages/trainer/TrainerLayout.tsx"), "عاد تصنيفٌ ثابتٌ لما يُرى — فيبقى الحاسوبُ العريضُ على بعضها").not.toMatch(/\bprimary\s*:/);
    expect(comp, "عاد عددٌ مكتوبٌ لما يُرى").not.toMatch(/\.slice\(0,\s*\d+\)/);
    /* المرئيُّ أوّلُ ما قيس، و«المزيد» يأخذ الباقي نفسَه — فلا تبويبٌ في الموضعين
       ولا تبويبٌ في أيٍّ منهما */
    expect(comp, "المرئيُّ ليس أوّلَ ما قيس").toMatch(/\{tabs\.slice\(0, shown\)\.map\(/);
    expect(comp, "«المزيد» لا يأخذ ما بعد المقيس").toMatch(/<MoreTabs key=\{pathname\} items=\{tabs\.slice\(shown\)\}/);
    /* ولا يظهر حين يسع الكلّ — وهو نصُّ القرار: «ليست داخلَ المزيد» */
    expect(comp, "«المزيد» يظهر ولو وسع الشريطُ كلَّ التبويبات").toMatch(/\{shown < tabs\.length && <MoreTabs /);
    /* والعددُ من القياس: من `fitCount` في مراقب الحجم، لا من غيره */
    expect(comp, "العددُ لا يأتي من دالّة القياس").toMatch(/const next = fitCount\(/);
    expect(comp).toMatch(/flushSync\(\(\) => setShown\(next\)\)/);
  });

  it("⚠️ ١١) وزرُّ «المزيد» خارجَ الصفّ القاصّ — وإلّا قُصَّت قائمتُه عند الحافّة", () => {
    /* `overflow-hidden` يقصُّ كلَّ `absolute` في داخله. فلو وُضع الزرُّ داخلَ
       الصفّ القاصّ لانفتحت القائمةُ مقصوصةً — عطبٌ يُرى ولا يُفهَم سببُه. */
    const more = comp.indexOf("<MoreTabs");
    expect(rowClose, "لم يُغلَق الصفُّ المرئيّ").toBeGreaterThan(firstPill);
    expect(more, "لا زرَّ «المزيد»").toBeGreaterThan(-1);
    expect(more, "الزرُّ داخلَ الصفّ القاصّ — فقائمتُه تُقَصُّ عند حافّته").toBeGreaterThan(rowClose);
  });

  it("⚠️ ١٢) والقائمةُ تُغلَق بالمفتاح وبالنقر خارجَها — ولا ستارةَ `fixed`", () => {
    /* الترويسةُ تحمل `backdrop-blur`، و`backdrop-filter` يجعل حاملَه كتلةً
       حاضنةً لكلّ `fixed` في ذرّيّته — فالستارةُ تمتدّ على الترويسة وحدَها
       ولا تغلق شيئا. وهي علّةٌ وقعت في ترويسة المدرّب بعينها مع
       `StaffAccountMenu`، فلا تُعاد. */
    const menu = bar.slice(bar.indexOf("function MoreTabs"), bar.indexOf("export function PortalTabs"));
    expect(menu, "لا مكوّنَ قائمةٍ أصلا").not.toBe("");
    expect(menu, "لا مستمعَ نقرٍ على المستند").toMatch(/document\.addEventListener\(['"]mousedown['"]/);
    expect(menu, "لا تُغلَق بـ`Escape`").toMatch(/e\.key === ['"]Escape['"]/);
    expect(bar, "ستارةٌ `fixed` — وهي لا تغطّي شيئا تحت `backdrop-blur`").not.toMatch(/fixed\s+inset-0/);
    /* والزرُّ يقول لقارئ الشاشة إنّه يفتح قائمةً وهل هي مفتوحة */
    expect(pill, "الزرُّ لا يُعلن أنّه يفتح قائمة").toContain('aria-haspopup="menu"');
    expect(pill, "لا يُعلن حالتَه مفتوحةً أو مغلقة").toContain("aria-expanded={expanded}");
  });

  /* ═══ وصفُّ القياس يُقاس ولا يُرى ولا يُقرأ ═══

     صفٌّ ثانٍ يحمل كلَّ التبويبات بعرضها الطبيعيّ كي يُعرف متى يعود ما خرج.
     فإن رُئي تكرّر الشريطُ على الشاشة، وإن قُرئ سمع قارئُ الشاشة كلَّ تبويبٍ
     مرّتين، وإن حمل روابطَ صار في الصفحة ثلاثةَ عشرَ هدفا لا يُرى تمرّ بها
     لوحةُ المفاتيح. وإن حمل بعضَها قاس المرئيَّ وحدَه فلا يعود ما خرج أبدا. */
  it("⚠️ ١٣) وصفُّ القياس لا يُرى ولا يُقرأ ولا يُركَّز — ويحمل الكلَّ لا المرئيَّ وحدَه", () => {
    const ghostAt = comp.search(/<NavPillGhost\s/);
    expect(ghostAt, "لا أشباحَ يُقاس بها").toBeGreaterThan(-1);
    /* وسمان يفتحان قبل أوّل شبح: الصفُّ المقيس، وقبله الغلافُ الذي يُخفيه */
    const measured = comp.lastIndexOf("<div", ghostAt);
    const wrapper = comp.lastIndexOf("<div", measured - 1);
    expect(wrapper, "الأشباحُ بلا غلاف").toBeGreaterThan(rowClose);
    expect(tagAt(wrapper), "الغلافُ يُقرأ لقارئ الشاشة").toContain('aria-hidden="true"');
    expect(tagAt(wrapper), "الغلافُ يُرى").toMatch(/\binvisible\b/);
    expect(tagAt(wrapper), "الغلافُ في مجرى الشريط — فيدفع الصفَّ المرئيّ").toMatch(/\babsolute\b/);
    expect(tagAt(measured), "الصفُّ المقيسُ لا يُمسَك به").toContain("ref={ghostRef}");
    expect(tagAt(measured), "الصفُّ المقيسُ يضيق فتنضغط أشباحُه").toMatch(/\bw-max\b/);
    /* الكلُّ لا المرئيّ: شبحُ ما خرج هو الذي يقول متى يعود — ثمّ شبحُ «المزيد» */
    expect(comp.slice(measured, ghostAt), "الأشباحُ لبعض التبويبات لا لكلّها").toContain("{tabs.map((t) => (");
    expect(comp.slice(ghostAt), "لا شبحَ لـ«المزيد» — فلا يُحجَز له مكان").toMatch(/<NavPillGhost look=\{look\} label="المزيد">/);
    /* والشارةُ في الأشباح محجوزةٌ قبل وصول عددها: العدّادُ يصل بعد التركيب،
       فشبحٌ بلا شارته يُدخل التبويبَ الشريطَ ثمّ يُخرجه حين يصل — في كلّ انتقال */
    expect(comp.slice(ghostAt), "شبحُ التبويب يُقاس بلا شارته حتّى يصل عددُها").toContain("<CountBadge count={reservedCount(t.count)} label={countLabel} />");
    expect(comp.slice(ghostAt), "شبحُ «المزيد» يُقاس بلا شارته حتّى يصل عددُها").toContain("<CountBadge count={reservedCount(waitingAll)} label={countLabel} />");
    /* والشبحُ وسمٌ صامت: لا رابطَ ولا زرّ */
    const ghostFn = pill.slice(pill.indexOf("export function NavPillGhost"), pill.indexOf("export interface NavPillMenuItemProps"));
    expect(ghostFn, "لا مكوّنَ للشبح في السلّم").not.toBe("");
    expect(ghostFn, "الشبحُ ليس وسما صامتا بصيغة الحبّة").toMatch(/return \(\s*<span className=\{pillCls\(false, look\)\}>/);
    expect(ghostFn, "الشبحُ رابطٌ أو زرٌّ — فيُركَّز ويُنقَر وهو لا يُرى").not.toMatch(/<NavLink|<Link|<button|<a\s/);
    /* والجسمُ واحدٌ في الأشكال الثلاثة — والرابطُ اثنان منها (بمطابقة المسار
       وبنشاطٍ يقرّره الإطار) — وإلّا قاس الشبحُ غيرَ ما يُرسم */
    const shapes = pill.slice(0, pill.indexOf("export interface NavPillMenuItemProps"));
    expect(shapes.match(/<PillBody /g) ?? [], "شكلٌ يرسم جسمَه بيده").toHaveLength(4);
  });

  /* ═══ والفسحةُ تُقاس لا الشريط، والحاشيةُ من الأشباح ═══

     الشريطُ الملتفُّ على حبّاته (أقسامُ المتعلّم) عرضُه عرضُ ما فيه، فلو قيس
     هو لما اتّسع بعد أن ضاق: يُخرج تبويبا فيضيق فلا يرى مكانا لما خرج. فتُقاس
     الفسحةُ التي هو فيها. وللشريط حدٌّ وحشوٌ يأكلان منها، ورقمٌ يُكتب لهما
     يصير غيرَه تحت معامل التكبير — فيحملهما صفُّ الأشباح نفسُه ويُقرآن منه. */
  it("⚠️ ١٤) والمقيسُ الفسحةُ لا الشريط — وحاشيتُه تُقرأ من الأشباح لا تُكتب", () => {
    expect(comp, "المقيسُ ليس الغلافَ الخارجيّ").toMatch(/return \(\s*<div ref=\{slotRef\}/);
    expect(comp, "الشريطُ نفسُه مقيس — فالملتفُّ لا يتّسع بعد أن يضيق").not.toMatch(/<nav[^>]*\bref=/);
    expect(comp, "لا مراقبَ على الفسحة والأشباح").toMatch(/ro\.observe\(slot\)\s*\n\s*ro\.observe\(ghost\)/);
    expect(comp, "المتاحُ لا يُنقَص منه ما تأكله الحاشية").toMatch(/slot\.getBoundingClientRect\(\)\.width - chrome/);
    /* والحاشيةُ نفسُها على الشريط وعلى صفّ الأشباح — والفرقُ بينهما هو ما يُطرح */
    const navTag = tagAt(comp.indexOf("<nav "));
    const ghostRowTag = tagAt(comp.lastIndexOf("<div", comp.search(/<NavPillGhost\s/)));
    expect(navTag, "الشريطُ بلا حاشيته").toContain("${chrome}");
    expect(ghostRowTag, "صفُّ الأشباح بلا حاشية الشريط — فتُطرح حاشيةٌ لا يعرفها").toContain("${chrome}");
    expect(comp, "الحاشيةُ عددٌ مكتوب").toMatch(/const chrome = Math\.max\(0, ghost\.getBoundingClientRect\(\)\.width - span\)/);
  });
});

/* ── والبوّاباتُ الثلاث تركّبه — لا نسخةَ تفترق ──

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «طبّق نفس الشيء على بوابة المستشار
   والطالب». ونسخُ الشريط في كلّ بوّابةٍ يُعيد العلّةَ التي جاء السلّمُ لرفعها:
   ثلاثُ نسخٍ تفترق أوّلَ يومٍ يُبدَّل فيه أحدُها. فالمحروسُ هنا التركيبُ:
   أنّ كلَّ شريطٍ هو `PortalTabs`، وأنّ النسخَ القديمة لا تعود. */
describe("والبوّاباتُ الثلاث تركّبه — لا نسخةَ تفترق", () => {
  const trainer = code("src/pages/trainer/TrainerLayout.tsx");
  const advisor = code("src/pages/advisor/AdvisorLayout.tsx");
  const student = code("src/pages/student/PortalLayout.tsx");
  const navs = (src: string) => src.match(/<nav\b/g)?.length ?? 0;
  /* كلُّ `<PortalTabs … />` كاملا: خصائصُه قد تحمل `=>` فلا يوقفها `[^>]` */
  const uses = (src: string) =>
    [...src.matchAll(/<PortalTabs\b/g)].map((m) => src.slice(m.index, src.indexOf("/>", m.index) + 2));

  it("⚠️ ١٥) المدرّب: الشريطُ في سطره، وعدّادُه يُقرأ — ولا نسخةَ محلّيّة", () => {
    const [bar, ...extra] = uses(trainer);
    expect(extra, "شريطان في إطار المدرّب").toHaveLength(0);
    expect(bar ?? "", "لا شريطَ مشتركا، أو ليس في سطره").toContain('className="order-last w-full"');
    expect(bar ?? "", "العدّادُ بلا ما يُقرأ قبله").toContain('countLabel="ينتظر تصحيحَك: "');
    expect(navs(trainer), "شريطٌ مكتوبٌ باليد عاد إلى الإطار").toBe(0);
    for (const fn of ["TabsBar", "MoreTabs", "CountBadge"]) {
      expect(trainer, `نسخةٌ محلّيّةٌ من ${fn} — تفترق عن المشتركة`).not.toMatch(new RegExp(`function ${fn}\\b`));
    }
  });

  it("⚠️ ١٦) المستشار: الشريطُ سطرٌ تحت الأدوات بلونه — لا حبّاتٌ تقتسم سطرَها", () => {
    /* كان يقتسم سطرَ الترويسة مع الشعار والأدوات: على ٧٦٨ انطوى «ما قيل عنّي»
       ثلاثةَ أسطرٍ وخرج زرُّ الحساب عن الشاشة */
    const [bar, ...extra] = uses(advisor);
    expect(extra, "شريطان في إطار المستشار").toHaveLength(0);
    expect(bar ?? "", "الشريطُ بغير لون البوّابة").toContain('look="gold"');
    expect(bar ?? "", "الشريطُ ليس في سطره — فيعود يزاحم الأدوات").toContain('className="order-last w-full"');
    expect(advisor, "الترويسةُ سطرٌ واحدٌ لا ينطوي — فيعود الشريطُ يزاحم الأدوات").toMatch(/className="mx-auto flex max-w-6xl flex-wrap /);
    expect(navs(advisor), "شريطٌ مكتوبٌ باليد عاد إلى الإطار").toBe(0);
  });

  it("⚠️ ١٧) المتعلّم: الأقسامُ ملتفّةٌ بنشاطها، والصفحاتُ رقائق — والترويسةُ سطرٌ واحد", () => {
    const bars = uses(student);
    const sections = bars.find((b) => b.includes('label="أقسام المنصة"')) ?? "";
    const pages = bars.find((b) => b.includes("tabs={activeSection.items}")) ?? "";
    expect(bars, "شريطٌ ثالثٌ أو ناقص").toHaveLength(2);
    expect(sections, "الأقسامُ ليست الشريطَ المشترك").not.toBe("");
    expect(sections, "الأقسامُ تمتدّ بين الشعار والأدوات — لا تلتفّ على حبّاتها").toContain("fill={false}");
    /* النشاطُ من القسم لا من المسار: «تعلّمي» نشِطٌ في `/student/review` */
    expect(sections, "نشاطُ القسم يعود إلى مطابقة المسار").toContain("active: activeSection?.id === sec.id");
    expect(pages, "صفحاتُ القسم ليست الشريطَ المشترك").not.toBe("");
    expect(pages, "صفحاتُ القسم بغير صيغة الرقائق").toContain('look="chip"');
    expect(student, "عاد التمريرُ الخفيّ إلى صفحات القسم").not.toMatch(/<nav[^>]*overflow-x-auto/);
    /* وشريطٌ مكتوبٌ باليد واحدٌ فقط: السفليُّ على الهاتف، وهو نسقٌ آخر */
    expect(navs(student), "شريطٌ مكتوبٌ باليد غيرُ السفليّ").toBe(1);
    expect(student).toMatch(/<nav aria-label="أقسام المنصة" className=\{`fixed inset-x-0 bottom-0/);
    /* والترويسةُ لا تطول: `ModuleStudy` يُلصِق خطواتِه تحتها بـ`top-16`، فسطرٌ
       ثانٍ فيها يُغطّي أوّلَ الخطوات */
    expect(student, "ترويسةُ المتعلّم صارت سطرين").toMatch(/className="mx-auto flex h-16 max-w-6xl /);
    expect(code("src/pages/student/ModuleStudy.tsx"), "تغيّر ما تُلصَق به خطواتُ الوحدة — فراجِع ارتفاعَ الترويسة").toMatch(/sticky top-16/);
  });
});

describe("«المجال» مجالٌ معرفيّ لا فئةٌ مستهدفة", () => {
  it("٤) دورةُ الأمن السيبرانيّ مجالُها الأمن لا «موظفون»", () => {
    /* كان الحقل يسمّي نفسَه «المجال» ويُملأ بـ`pathwayCategory` — وتلك
       تُعيد جمهورا. فمن يُتقن الأمن السيبرانيّ لا يجده في القائمة. */
    expect(courseDomain("C-CYB-101")).toBe("الأمن السيبراني وحماية البيانات");
    expect(courseDomain("C-AI-101")).toBe("الذكاء الاصطناعي وتطبيقاته");
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

  /* ═══ والعنوانُ مقطعان يحملان ما في المجال (١٧ سبتمبر ٢٠٢٦) ═══

     كان الاسمُ كلمةً عاريةً («التسويق») لا تقول ماذا خلفها، فأُلحق به ذيلٌ
     من أربع كلماتٍ مفتاحيّةٍ وعددُ دوراته — فبلغ السطرُ ثمانيةً وتسعين حرفا
     في المتوسّط ومئةً وتسعةً وعشرين في أطوله. وشكا صاحبُ المنصّة: «كبيرة
     جدا وعشوائية».

     وردُّ الكلمةِ العاريةِ هو الشكوى الأولى بعينها. فالقرار: «يجب أن يكون
     من مقطعين، وكلُّ مقطعٍ انعكاسٌ لأهمّ ما جاء ضمن هذا المجال» — والاسمُ
     يحمل ما كان الذيلُ يحمله.

     والفحصُ على **بنية العنوان** لا على ورودِ كلمةٍ بعينها: عنوانٌ واحدٌ
     بمقطعٍ واحدٍ يكفي لتعود الشكوى في بابه. */
  it("⚠️ ٧) ولكلّ مجالٍ عنوانٌ من مقطعين — لا كلمةٌ عاريةٌ ولا ثلاثة", () => {
    expect(COURSE_DOMAIN_FAMILIES.length, "لا مجالاتِ أصلا").toBeGreaterThan(15);
    for (const family of COURSE_DOMAIN_FAMILIES) {
      const title = courseDomainByFamily(family);
      expect(title, `مجالٌ بلا عنوان: ${family}`).toBeTruthy();
      /* المقطعان تصلهما واوٌ مبتدئةٌ كلمةً — فواحدةٌ لا أكثر: اثنتان ثلاثةُ
         مقاطعَ لا مقطعان، وصفرٌ كلمةٌ عاريةٌ كالتي شُكي منها. */
      const joins = title.match(/\sو/g)?.length ?? 0;
      expect(joins, `عنوانُ ${family} ليس مقطعين: «${title}»`).toBe(1);
      const [first, second] = title.split(/\sو/);
      expect(first?.trim().length, `مقطعٌ أوّلُ فارغٌ في ${family}`).toBeGreaterThan(2);
      expect(second?.trim().length, `مقطعٌ ثانٍ فارغٌ في ${family}`).toBeGreaterThan(2);
      /* ولا رقمَ في العنوان: «لا داعي لوجود رقم ٤ في العنوان» */
      expect(title, `رقمٌ في عنوان ${family}: «${title}»`).not.toMatch(/[0-9٠-٩]/);
    }
  });

  it("⚠️ ٨) وسقفُ العنوان يمنع عودةَ السطر الطويل بصمت", () => {
    /* أطولُ عنوانٍ اليوم واحدٌ وثلاثون حرفا. والسقفُ أربعةٌ وثلاثون: يتّسع
       لعنوانٍ جديدٍ يُكتب بالقاعدة نفسِها، ويسقط على أوّل ذيلٍ يعود. */
    for (const family of COURSE_DOMAIN_FAMILIES) {
      const title = courseDomainByFamily(family);
      expect(title.length, `عنوانُ ${family} تجاوز السقف: «${title}»`).toBeLessThanOrEqual(34);
    }
  });

  it("⚠️ ٩) والقائمةُ تعرض العنوانَ عاريا — والعددُ بعد الاختيار لا قبله", () => {
    const picker = read("src/components/TeachableCoursePicker.tsx")
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
    /* لا ذيلَ ولا عدد: `<option>` يحمل الاسمَ وحدَه */
    expect(picker, "عاد ذيلُ الكلمات إلى القائمة").not.toContain("courseDomainLabel");
    expect(picker, "عاد العددُ إلى كلّ سطرٍ من خمسةٍ وعشرين").not.toContain("count");
    /* والعددُ لم يُفقد — يُقال بعد فتح المجال حيث يعني شيئا */
    expect(picker, "العددُ لا يُقال في موضعه أيضا").toContain("inDomain.length");
  });
});
