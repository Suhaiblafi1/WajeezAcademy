#!/usr/bin/env node
/* تدقيق المسارات القياسية (البند أ-٣) — يطبع حالة كل مسار وسببها.

   يفشل إن كان مسار واحد غير معتمد، لأن غير المعتمد لا يدخل المنافسة أصلا:
   فوجوده في الكتالوج بلا انتباه يعني مسارا لا يُرشَّح لأحد ولا يعلم أحدٌ لماذا.
   وضعف القياس يُحصى ويُطبع ولا يُفشِل — الحدّ مشروح في auditStandard. */

import { launchPathways } from '../src/domain/diagnostic/catalog'
import { auditStandard } from '../src/domain/diagnostic/v2_1/universe'

const audits = launchPathways.map((p) => auditStandard(p.id))
const blocked = audits.filter((a) => a.status !== 'approved_active')
const unmeasured = audits.filter((a) => a.metrics.measurable_skills === 0)

console.log('المسار | الحالة | دورات | مجالات | شخصيات | أهداف | مهارات | مقيسة')
for (const a of audits) {
  const m = a.metrics
  console.log(
    `${a.pathway_id} | ${a.status} | ${m.courses} | ${m.domains} | ${m.personas} | ${m.goals} | ${m.skills} | ${m.measurable_skills}`,
  )
  for (const r of a.reasons_ar) console.log(`    · ${r}`)
}

console.log(`\nالمجموع: ${audits.length} مسارا · ${blocked.length} غير معتمد · ${unmeasured.length} بلا مهارة مقيسة`)

if (unmeasured.length > 0) {
  console.warn(
    `⚠ ${unmeasured.length} مسارا بلا مهارة مقيسة واحدة: ${unmeasured.map((a) => a.pathway_id).join(' · ')}\n` +
    '  وزن المهارات لا يفرّقها عن منافسيها. العلاج إضافة أسئلة قياس (البند ب-٤) لا إسقاط المسارات.',
  )
}

if (blocked.length > 0) {
  console.error(`\n❌ ${blocked.length} مسارا لا يدخل المنافسة:`)
  for (const a of blocked) console.error(`  · ${a.pathway_id} (${a.status}): ${a.reasons_ar.join(' · ')}`)
  process.exit(1)
}

console.log('✅ كل المسارات معتمدة بنيويا.')
