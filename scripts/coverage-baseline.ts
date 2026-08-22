#!/usr/bin/env tsx
/* موجة ٦ · أ-٤ — حاجز تغطية القياس: لا تنقص، ولا يزيد المعلَّق على سطح B2C.

   لماذا حاجزٌ لا تقريرٌ فقط: الرقم كان يُبلَّغ منذ البند ب-٤ ولم يتحسّن. وحاجزٌ
   يفشل على الحال القائم يُعتاد تجاهله (درس د-١)، فهذا يقيس **الاتجاه** لا
   القيمة: يفشل عند التراجع فقط، ويطلب تحديث خط الأساس عند التحسّن.

   شغّل: npm run ci:coverage-baseline           للفحص
         npx tsx scripts/coverage-baseline.ts --update   بعد تحسّن مقصود */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCoverageReport, coverageHeadlineAr } from '../src/application/catalog/measurement-coverage'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(root, 'coverage-baseline.json')
const UPDATE = process.argv.includes('--update')

interface Baseline {
  /** مسارات وزنُ فجوة المهارة فيها خامل تماما — لا تزيد */
  pathwaysZeroCoverage: number
  /** مهارات مسجَّلة نشطة يقيسها سؤال — لا تنقص */
  measuredSkills: number
  /** أسئلة قياس على سطح B2C تقيس مفتاحا غير مسجَّل — لا تزيد */
  orphansOnB2cSurface: number
}

const r = buildCoverageReport()
const live: Baseline = {
  pathwaysZeroCoverage: r.totals.pathwaysZeroCoverage,
  measuredSkills: r.totals.measuredSkills,
  orphansOnB2cSurface: r.orphanQuestions.filter((q) => q.onB2cSurface).length,
}

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify(live, null, 2) + '\n')
  console.log('✍️  حُدِّث خط أساس التغطية:', JSON.stringify(live))
  process.exit(0)
}

let base: Baseline
try {
  base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
} catch {
  writeFileSync(BASELINE, JSON.stringify(live, null, 2) + '\n')
  console.log('✍️  أُنشئ خط أساس التغطية أول مرة:', JSON.stringify(live))
  process.exit(0)
}

console.log(coverageHeadlineAr(r))
console.log(
  `خط الأساس: ${base.pathwaysZeroCoverage} مسارا خاملا · ${base.measuredSkills} مهارة مقيسة · ` +
  `${base.orphansOnB2cSurface} سؤالا معلَّقا على السطح`,
)

const failures: string[] = []
const gains: string[] = []

if (live.pathwaysZeroCoverage > base.pathwaysZeroCoverage) {
  failures.push(
    `المسارات الخاملة زادت من ${base.pathwaysZeroCoverage} إلى ${live.pathwaysZeroCoverage} — ` +
    'مسارٌ فقد آخر مهارة مقيسة له، أو أُضيف مسار بلا قياس.',
  )
} else if (live.pathwaysZeroCoverage < base.pathwaysZeroCoverage) {
  gains.push(`المسارات الخاملة نقصت إلى ${live.pathwaysZeroCoverage}`)
}

if (live.measuredSkills < base.measuredSkills) {
  failures.push(
    `المهارات المقيسة نقصت من ${base.measuredSkills} إلى ${live.measuredSkills} — ` +
    'سؤال قياس أُوقف أو خرج من سطح B2C.',
  )
} else if (live.measuredSkills > base.measuredSkills) {
  gains.push(`المهارات المقيسة صارت ${live.measuredSkills}`)
}

if (live.orphansOnB2cSurface > base.orphansOnB2cSurface) {
  failures.push(
    `الأسئلة المعلَّقة على السطح زادت من ${base.orphansOnB2cSurface} إلى ${live.orphansOnB2cSurface} — ` +
    'سؤال يقيس مفتاحا غير مسجَّل: يُسأل المتعلم ويُهمَل جوابه.',
  )
} else if (live.orphansOnB2cSurface < base.orphansOnB2cSurface) {
  gains.push(`المعلَّق على السطح نقص إلى ${live.orphansOnB2cSurface}`)
}

if (failures.length > 0) {
  console.error('\n✗ تراجع في تغطية القياس:')
  for (const f of failures) console.error(`  · ${f}`)
  console.error('\n  إن كان التراجع مقصودا فوثّقه وحدّث خط الأساس:')
  console.error('  npx tsx scripts/coverage-baseline.ts --update')
  process.exit(1)
}

if (gains.length > 0) {
  console.log(`\n✅ تحسّن — ${gains.join(' · ')}.`)
  console.log('   حدّث خط الأساس كي يُحفَظ المكسب: npx tsx scripts/coverage-baseline.ts --update')
} else {
  console.log('\n✅ لا تراجع في تغطية القياس.')
}
