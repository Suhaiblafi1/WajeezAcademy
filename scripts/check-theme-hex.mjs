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

const hexAlt = FORBIDDEN_HEX.join('|');
const utilAlt = SURFACE_UTILS.join('|');
const pattern = new RegExp(`(?:${utilAlt})-\\[#(?:${hexAlt})\\]`, 'gi');

const files = execSync(
  "git ls-files 'src/*.tsx' 'src/**/*.tsx' 'src/*.ts' 'src/**/*.ts'",
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let violations = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(line)) !== null) {
      violations++;
      console.error(`✗ ${file}:${i + 1} — ${m[0]}`);
    }
  });
}

if (violations > 0) {
  console.error(`
❌ حارس الثيم: وُجد ${violations} لون سطح داكن حرفي.
   استخدم الرموز السيميائية بدلا منه (bg-paper / bg-surface / bg-panel …)
   — هي تتكيف مع الوضعين تلقائيا. التفاصيل في src/index.css.`);
  process.exit(1);
}

console.log(`✅ حارس الثيم: ${files.length} ملف نظيف — لا أسطح داكنة حرفية.`);
