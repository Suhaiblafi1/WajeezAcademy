#!/usr/bin/env node
/* بوابة دين التلويم (البند ب-٣).

   المشكلة التي تحلّها: في المستودع اليوم ٦ أخطاء و٧ تحذيرات تلويم قائمة من قبل
   (react-hooks). تشغيل «eslint .» في CI بلا سياق يفشل دائما، وCI أحمرُ دائما
   يعلّم القارئ تجاهل الأحمر — فيصير أسوأ من لا CI.

   الحل: خط أساس ملتزم لكل قاعدة. البوابة تفشل إن ازداد عدد أي قاعدة أو ظهرت
   قاعدة جديدة، ولا تفشل إن نقص — بل تطلب شدّ الحزام. فيُمنع الدين الجديد بلا
   تجميد الإصلاح ولا تزييف الرقم بصفر لا وجود له.

   الاستعمال:
     npx tsx scripts/lint-baseline.ts            فحص (يُشغَّل في CI)
     npx tsx scripts/lint-baseline.ts --update   تحديث خط الأساس بعد إصلاح مقصود
*/

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BASELINE_PATH = 'lint-baseline.json'

interface Counts { errors: Record<string, number>; warnings: Record<string, number> }
interface EslintMessage { ruleId: string | null; severity: number }
interface EslintFile { messages: EslintMessage[] }

function runEslint(): Counts {
  let raw = ''
  try {
    raw = execFileSync('npx', ['eslint', '.', '-f', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    /* ملاحظة: الأداة تخرج بحالة 1 عند وجود أخطاء، والناتج على stdout كما هو.
       ⚠ لا تبدأ تعليقا بكلمة eslint: يُقرأ توجيه إعداد لا نصّا. */
    const out = (e as { stdout?: string }).stdout
    if (!out) throw e
    raw = out
  }
  const files = JSON.parse(raw) as EslintFile[]
  const errors: Record<string, number> = {}
  const warnings: Record<string, number> = {}
  for (const f of files) {
    for (const m of f.messages) {
      const rule = m.ruleId ?? '(بلا قاعدة — خطأ تحليل)'
      const bucket = m.severity === 2 ? errors : warnings
      bucket[rule] = (bucket[rule] ?? 0) + 1
    }
  }
  return { errors, warnings }
}

function total(c: Record<string, number>): number {
  return Object.values(c).reduce((a, b) => a + b, 0)
}

function sortKeys(c: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)))
}

const live = runEslint()
const normalized: Counts = { errors: sortKeys(live.errors), warnings: sortKeys(live.warnings) }

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(normalized, null, 2) + '\n', 'utf8')
  console.log(`✅ حُدّث خط الأساس: ${total(normalized.errors)} خطأ و${total(normalized.warnings)} تحذير.`)
  process.exit(0)
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`❌ لا خط أساس في ${BASELINE_PATH} — شغّل الأمر بـ--update والتزم الناتج.`)
  process.exit(1)
}

const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Counts
const grew: string[] = []
const shrank: string[] = []

for (const kind of ['errors', 'warnings'] as const) {
  const label = kind === 'errors' ? 'خطأ' : 'تحذير'
  const rules = new Set([...Object.keys(base[kind] ?? {}), ...Object.keys(normalized[kind])])
  for (const rule of [...rules].sort()) {
    const was = base[kind]?.[rule] ?? 0
    const now = normalized[kind][rule] ?? 0
    if (now > was) grew.push(`  ↑ ${rule}: ${was} ← ${now} ${label}`)
    else if (now < was) shrank.push(`  ↓ ${rule}: ${was} ← ${now} ${label}`)
  }
}

console.log(
  `خط الأساس: ${total(base.errors ?? {})} خطأ و${total(base.warnings ?? {})} تحذير · ` +
  `التشغيل الحيّ: ${total(normalized.errors)} خطأ و${total(normalized.warnings)} تحذير`,
)

if (grew.length > 0) {
  console.error('\n❌ دين تلويم جديد:')
  for (const line of grew) console.error(line)
  console.error(
    '\nأصلح ما أضفته. ولا تحدّث خط الأساس لتمرير الحاجز — الحاجز موضوع لهذا بعينه.',
  )
  process.exit(1)
}

if (shrank.length > 0) {
  console.log('\n✅ نقص الدين — شدّ الحزام بتحديث خط الأساس:')
  for (const line of shrank) console.log(line)
  console.log('  npx tsx scripts/lint-baseline.ts --update')
}

console.log('\n✅ لا دين تلويم جديد.')
