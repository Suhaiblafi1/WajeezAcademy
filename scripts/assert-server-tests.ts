/* حاجزٌ لا يفشل ليس حاجزا.

   العطبُ الذي وُلد منه هذا الملفّ أخطرُ ما وُجد في هذا المستودع: **اختباراتُ
   الخادم كلُّها — ألفٌ وستُّ مئةٍ وثمانيةَ عشرَ اختبارا — لم تكن حاجزا.**

   `vitest run` يُرجع صفرا عند الفشل في إعداد الخادم، لأنّ `globalSetup` الذي
   يُشغّل PostgreSQL المدمجة يُبقي مقبضا مفتوحا فيخرج vitest خروجا قسريّا
   برمزٍ صفر. وأُثبت بالتجربة: اختبارٌ يفشل عمدا يُرجع **١** بإعداد الواجهة،
   و**صفرا** بإعداد الخادم — والفرقُ الوحيدُ بينهما `globalSetup`.

   وأثرُه أنّ خطوةَ «اختبارات الخادم بقاعدة حقيقية» في CI **كانت تُعلن النجاحَ
   دائما**. وقد وقع فعلا: التزامٌ في هذه الجولة كسر اختبارا في
   `document-storage.test.ts`، وسجلُّ CI يُظهر الفشلَ بنصّه، والخطوةُ خضراء.
   فكلُّ ضمانٍ يخصّ الأدوارَ والمالَ والشهاداتِ كان يُقال «تحرسه CI» وهو غيرُ
   محروس.

   والعلاجُ ألّا يُعتمد على رمز الخروج: vitest يكتب نتيجتَه ملفَّ JSON، وهذا
   الملفُّ يقرأه ويفشل إن كان فيه فشلٌ واحد. ويفشل كذلك إن **غاب** الملفُّ أو
   قدُم أو كان بلا اختبارات — فإخفاقُ vitest قبل أن يكتب شيئا لا يُقرأ نجاحا. */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = join(root, '.vitest-server-results.json')
/* الملفُّ من هذا التشغيل لا من تشغيلٍ قديمٍ نجح: عشرُ دقائقَ سقفُ عمره */
const MAX_AGE_MS = 10 * 60_000

interface Result {
  numTotalTests?: number
  numPassedTests?: number
  numFailedTests?: number
  numPendingTests?: number
  numFailedTestSuites?: number
  success?: boolean
  testResults?: { name?: string; status?: string; assertionResults?: { status?: string; fullName?: string }[] }[]
}

if (!existsSync(FILE)) {
  console.error('❌ لا ملفَّ نتائجَ لاختبارات الخادم — أخفق التشغيلُ قبل أن يكتب شيئا.')
  console.error('   وغيابُ النتيجة ليس نجاحا: راجع مخرَجَ vitest أعلاه.')
  process.exit(1)
}

const ageMs = Date.now() - statSync(FILE).mtimeMs
if (ageMs > MAX_AGE_MS) {
  console.error(`❌ ملفُّ النتائج عمرُه ${Math.round(ageMs / 60_000)} دقيقة — من تشغيلٍ سابق لا من هذا.`)
  process.exit(1)
}

let r: Result
try {
  r = JSON.parse(readFileSync(FILE, 'utf8')) as Result
} catch (e) {
  console.error(`❌ ملفُّ النتائج غيرُ مقروء: ${String(e).slice(0, 120)}`)
  process.exit(1)
}

const total = r.numTotalTests ?? 0
const failed = r.numFailedTests ?? 0
const failedSuites = r.numFailedTestSuites ?? 0
const passed = r.numPassedTests ?? 0

/* حدٌّ أدنى: لو انكسر الاستدعاءُ فلم يجمع vitest إلّا بعضَ الملفّات، لا
   يُقرأ «صفر فشل» نجاحا — فتشغيلٌ جزئيٌّ ليس اكتمالا.

   والعددُ اليومَ **٧٣٢** اختبارا في ٩٣ ملفّا. وكنتُ كتبتُ ١٤٠٠ ظنّا أنّ
   السويةَ ألفٌ وستُّ مئةٍ وثمانيةَ عشر — وذلك عددُ `vitest run` **بلا مسارٍ**
   في إعداد الخادم: يجمع `server/tests` و`src/tests` معا (٧٣٢ + ٨٨٦). فحاجزٌ
   بحدٍّ خاطئٍ يفشل دائما، وهو عطبٌ في الاتّجاه المقابل: يُنبّه بلا سبب حتّى
   يُهمَل أو يُلغى. */
const MIN_TESTS = 650
if (total < MIN_TESTS) {
  console.error(`❌ ${total} اختبارا فقط، والمتوقَّعُ ${MIN_TESTS} على الأقلّ — لم تُجمَع الاختباراتُ كلُّها.`)
  process.exit(1)
}

if (failed > 0 || failedSuites > 0 || r.success === false) {
  console.error(`❌ اختباراتُ الخادم: ${failed} فشلا في ${failedSuites} ملفّا (من ${total}).`)
  for (const f of r.testResults ?? []) {
    for (const a of f.assertionResults ?? []) {
      if (a.status === 'failed') console.error(`   · ${a.fullName ?? '(بلا اسم)'}`)
    }
  }
  console.error('\nورمزُ خروج vitest لا يُعتمد عليه في هذا الإعداد — انظر تعليقَ هذا الملفّ.')
  process.exit(1)
}

console.log(`✅ اختباراتُ الخادم: ${passed} نجاحا من ${total}، ولا فشلَ واحد.`)
