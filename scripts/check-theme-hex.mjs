#!/usr/bin/env node
/**
 * حارس الثيم — يمنع عودة الألوان الداكنة الحرفية للأسطح.
 *
 * الخلفية: كل سطح متكيف مع الثيم يجب أن يستخدم الرموز السيميائية
 * (bg-paper / bg-surface / bg-surface3 / bg-panel / bg-paneldeep /
 *  bg-panelto / bg-warm / bg-warm2 / bg-warmglow) المعرفة في
 * src/index.css و tailwind.config.js. كتابة hex داكن حرفي للأسطح
 * كانت سبب 4 كسور متتالية في الوضع النهاري — هذا الفحص يجعل تكرارها
 * مستحيلا: يفشل CI فور ظهور أي واحد.
 *
 * المسموح عمدا (لا يُبلَّغ عنه):
 *   • ألوان العلامة (#38A7B4 / #FABC05 / #6EC7D1 …) — ثابتة في الوضعين
 *   • text-[#0D0D0D] و text-[#08272B] — حبر فوق أسطح العلامة، يعمل في الوضعين
 *   • الألوان الوظيفية (واتساب/قوقل/حالات) — لا تتبدل مع الثيم
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** hex أسطح داكنة محظورة — لها رمز سيميائي بديل */
const FORBIDDEN_HEX = [
  '0D0D0D', '121B1D', '141414', '101415', '151515', '0A0A0A',
  '12343B', '123B40', '12262A', '0E2225', '1A2E31',
  '161513', '241E0E', '2A2108', '101012', '1A1A1A', '1F1F1F',
];

/** مرافق الأسطح التي يجب ألا تحمل hex محظورا */
const SURFACE_UTILS = ['bg', 'from', 'via', 'to', 'fill', 'stroke', 'ring'];

/* ── حبرُ الحالات: التغطيةُ بالدرجة لا بالعائلة ──

   `text-red-200` و`text-red-300` لهما تجاوزٌ في `src/styles/light.css` منذ
   المهمّة ٢٠ (كانتا ١٫٢:‏١ على الورق في سبعةَ عشرةَ شاشة). و**`text-rose-*`
   لا تجاوزَ لها** — فكتابتُها تُعيد العطبَ نفسَه بلونٍ آخر. وهذا ما وقع
   فعلا في المهمّة ٧٢: كتبتُ `text-rose-200` في شاشةٍ جديدة، فقاسها فحصُ
   الإتاحة **١٫٢٩:‏١ في المظهر الفاتح** — وأمسكها لأنّ الشاشةَ كانت في
   مجموعة الفحص. ولو كانت شاشةً غيرَ مفحوصةٍ لَمَرّت.

   وكان هذا الحارسُ يمنع عائلةً واحدةً باسمها (`rose`)، فمرّ من جانبه ما هو
   أضيق: **درجةٌ** غيرُ مغطّاةٍ من عائلةٍ مغطّاة. `text-emerald-300` لها
   تجاوزٌ و`text-emerald-200` ليس لها، ولوحُ «تمّ» في `WorkHeader` يكتب
   الثانية — فاختفى نصُّه على الورق في **كلّ شاشةِ إدارة**، وبلّغ عنه صاحبُ
   المنصّة (١٥ سبتمبر ٢٠٢٦) لا فحصٌ آليّ. ومعه ثلاثٌ أخرياتٌ في المسح نفسِه.

   فالحارسُ الآن لا يحفظ أسماءَ عائلاتٍ ممنوعة: **يقرأ المغطّى من
   `light.css` نفسِه** ويقارنه بالمستعمَل في `src/`. فأيُّ درجةٍ تُكتب بلا
   تجاوزٍ تُسقطه — ولا يحتاج أحدٌ أن يتذكّر أيَّ عائلةٍ ناقصة. */

/** عائلاتُ Tailwind ذاتُ الدرجات — والرموزُ (`teal-ink`، `gold-ink`) خارجَها
    لأنّها بلا رقم، وهي المقصودةُ أصلا: تنقلب بالمتغيّر لا بتجاوزِ صنف. */
const INK_FAMILIES = [
  'red', 'rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink',
];
const INK_USE = new RegExp(`\\btext-(${INK_FAMILIES.join('|')})-(\\d{2,3})\\b`, 'g');

/* المغطّى يُقرأ من ورقة الفاتح: `.text-emerald-200 { … }` — وتُقبل الصيغةُ
   ذاتُ الشفافيّة (`.text-red-200\/80`) لأنّ الدرجةَ نفسَها هي المغطّاة. */
const LIGHT_CSS = readFileSync('src/styles/light.css', 'utf8');
const COVERED_INK = new Set(
  [...LIGHT_CSS.matchAll(new RegExp(`\\.text-(${INK_FAMILIES.join('|')})-(\\d{2,3})`, 'g'))]
    .map((m) => `${m[1]}-${m[2]}`)
);

const hexAlt = FORBIDDEN_HEX.join('|');
const utilAlt = SURFACE_UTILS.join('|');
const pattern = new RegExp(`(?:${utilAlt})-\\[#(?:${hexAlt})\\]`, 'gi');

const files = execSync(
  "git ls-files 'src/*.tsx' 'src/**/*.tsx' 'src/*.ts' 'src/**/*.ts'",
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let violations = 0;
const uncovered = new Map();

/* التعليقُ يُفرَّغ ولا يُحذف: مسافاتٌ بعدد حروفه فتبقى أرقامُ الأسطر صادقة.
   وهذا لازم — تعليقاتُ هذا المستودَع تشرح ما أُزيل فتذكر أسماءَ الأصناف،
   وحارسٌ يطابق نصًّا في تعليقٍ حارسٌ يخضرّ لسببٍ خاطئ. */
const blank = (m) => m.replace(/[^\n]/g, ' ');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const lines = stripComments(raw).split('\n');
  lines.forEach((line, i) => {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(line)) !== null) {
      violations++;
      console.error(`✗ ${file}:${i + 1} — ${m[0]}`);
    }
    INK_USE.lastIndex = 0;
    let ink;
    while ((ink = INK_USE.exec(line)) !== null) {
      const shade = `${ink[1]}-${ink[2]}`;
      if (COVERED_INK.has(shade)) continue;
      if (!uncovered.has(shade)) uncovered.set(shade, []);
      uncovered.get(shade).push(`${file}:${i + 1}`);
    }
  });
}

if (violations > 0) {
  console.error(`
❌ حارس الثيم: وُجد ${violations} لون سطح داكن حرفي.
   استخدم الرموز السيميائية بدلا منه (bg-paper / bg-surface / bg-panel …)
   — هي تتكيف مع الوضعين تلقائيا. التفاصيل في src/index.css.`);
}

const inkViolations = [...uncovered.values()].reduce((n, at) => n + at.length, 0);
if (inkViolations > 0) {
  console.error('');
  for (const [shade, at] of [...uncovered].sort()) {
    console.error(`✗ text-${shade} — ${at.length} موضعا، بلا تجاوزٍ على الورق:`);
    for (const where of at.slice(0, 6)) console.error(`    ${where}`);
    if (at.length > 6) console.error(`    … و${at.length - 6} غيرها`);
  }
  console.error(`
❌ حارس الثيم: ${inkViolations} موضعا يكتب درجةً لا تجاوزَ لها في المظهر الفاتح.
   درجاتُ Tailwind الفاتحة مصمَّمةٌ للداكن، فتقيس على الورق نحوَ ١٫٣:‏١ —
   أي نصٌّ موجودٌ غيرُ مرئيّ. والعلاجُ أحدُ اثنين:
     • رمزٌ ينقلب بالمتغيّر: text-danger-ink · text-gold-ink · text-teal-ink
     • أو تجاوزٌ مقيسٌ للدرجة في src/styles/light.css`);
}

if (violations + inkViolations > 0) process.exit(1);

console.log(`✅ حارس الثيم: ${files.length} ملف نظيف — لا أسطح داكنة حرفية، و${COVERED_INK.size} درجةَ حبرٍ مغطّاةٌ على الورق.`);
