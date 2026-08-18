/* توليد نتيجة «خطة مركبة مخصصة» حقيقية من محرك التشخيص — بذرة لفحص
   عرض النتيجة المركبة في المتصفح (scripts/verify-ui.mjs).
   لا واجهة ولا تخزين فعلي: يقود المحرك بشخصية رائد الأعمال الموثقة ثم يغلف
   النتيجة بمخطط التخزين الحالي (schema_version 2) لتزرع في localStorage.
   يعمل بـ: npx tsx scripts/seed-composite-result.ts */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSession, FOUNDER_IDEA } from '../src/tests/diagnostic/helpers'
import { recommendationToDiagResult } from '../src/application/diagnostic/view-model'
import { wrapResultForStorage } from '../src/application/diagnostic/result-schema'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const { recommendation, state } = runSession(FOUNDER_IDEA)
if (recommendation.kind !== 'composite_template') {
  console.error(`❌ فشل التوليد: شخصية رائد الأعمال أنتجت «${recommendation.kind}» لا خطة مركبة`)
  process.exit(1)
}

const result = recommendationToDiagResult(
  recommendation,
  state.skillVector,
  state.facts as unknown as Record<string, { value: unknown }>,
  state.factsRaw,
  state.interestVector,
)
result.resultJson.session_id = state.sessionId

mkdirSync(join(root, 'verification'), { recursive: true })
writeFileSync(join(root, 'verification', 'composite-result.seed.json'), wrapResultForStorage(result), 'utf8')
console.log(`✓ وُلدت نتيجة مركبة: ${recommendation.kind} — ${recommendation.composite?.templateId ?? ''} — ${recommendation.composite?.courses.length ?? 0} دورة`)
