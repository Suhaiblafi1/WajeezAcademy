/* تجميع معالج Vercel في ملف واحد — يحل مشكلة الاستيرادات النسبية بلا امتداد في ESM.

   ─────────── ولماذا صار له وضعُ فحص (`--check`) ───────────

   ⚠ **لم يعد كذلك بعد الانتقال إلى Cloudways**: الخادمُ هناك عمليّةُ Node
   تشغّل `server/index.ts` مباشرةً (`npm start`)، لا هذه الحزمة. وما دونه
   وصفُ الحال على Vercel، ويبقى الحارسُ نافعا لأنّ الحزمةَ متتبَّعةٌ في
   المستودَع: حزمةٌ باليةٌ تكذب على من يقرؤها.

   `api/index.js` **كان الخادمَ الذي يعمل على الإنتاج**، وهو ملفٌّ متتبَّعٌ في
   المستودع لا يُبنى عند النشر: يجب أن يُعاد بناؤه بيدٍ قبل كلّ دفعة. ولا شيءَ
   كان يذكّر بذلك.

   فبلي مرّتين. وفي الثانية بقي مسارُ `/api/leads/discount-email` — «بريدٌ
   مقابل كود الخصم» — غيرَ موجودٍ على الموقع الحيّ أسبوعا: الواجهةُ منشورةٌ
   (فـVercel يبنيها من جديدٍ كلَّ نشر) والزائرُ يكتب بريدَه فيُردّ بخطأ،
   والشيفرةُ سليمةٌ في المستودع فلا شيءَ يُنبّه.

   وهذا صنفُ العطب الذي لا تكشفه اختباراتٌ ولا مراجعة: كلُّ ما في الشيفرة
   صحيح، والمنشورُ وحدَه قديم. فالحارسُ هنا لا في الذاكرة. */

import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

const OUT = 'api/index.js'
const check = process.argv.includes('--check')

const result = await build({
  entryPoints: ['server/http/vercel-handler.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: true,
  packages: 'external',
  target: 'node22',
  /* في وضع الفحص لا نكتب على القرص: نقارن بما هو مرفوعٌ فعلا */
  write: !check,
  outfile: OUT,
  banner: { js: '// ملف مولّد تلقائيًا — لا تعدّله يدويًا (scripts/bundle-api.mjs)' },
})

if (!check) {
  console.log('✓ api/index.js bundled')
  process.exit(0)
}

const fresh = result.outputFiles?.[0]?.text ?? ''
const onDisk = await readFile(OUT, 'utf8').catch(() => null)

if (onDisk === null) {
  console.error('✘ لا وجودَ لـ api/index.js — شغّل: node scripts/bundle-api.mjs')
  process.exit(1)
}

if (onDisk === fresh) {
  console.log('✅ حزمةُ الخادم مطابقةٌ للشيفرة — ما في المستودع هو ما سيعمل على الإنتاج.')
  process.exit(0)
}

/* ولا يُقال «مختلفة» ويُسكَت: يُقال **ما** الذي لن يعمل. والمساراتُ نصوصٌ
   حرفيّة تنجو من التصغير، بخلاف أسماء الدوالّ — فالمقارنةُ عليها وحدَها. */
const routesOf = (src) => new Set([...src.matchAll(/["'`](\/api\/[a-zA-Z0-9/:_-]+)["'`]/g)].map((m) => m[1]))
const live = routesOf(onDisk)
const missing = [...routesOf(fresh)].filter((r) => !live.has(r)).sort()

console.error('✘ حزمةُ الخادم باليةٌ: `api/index.js` لا يطابق شيفرةَ الخادم.')
console.error('   وهو الملفُّ الذي يعمل على الإنتاج، ولا يُبنى عند النشر.')
if (missing.length > 0) {
  console.error(`\n   ${missing.length} مسارا في الشيفرة وميّتا على الإنتاج:`)
  for (const r of missing) console.error(`   · ${r}`)
} else {
  console.error('\n   لا مسارَ مفقود — الفرقُ في سلوكٍ داخليّ (رسالةٌ أو حارسٌ أو منطق).')
}
console.error('\n   الإصلاح: node scripts/bundle-api.mjs   ثمّ اضممه إلى الدفعة.')
process.exit(1)
