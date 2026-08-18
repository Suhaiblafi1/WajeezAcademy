/* محاكاة الشخصيات الحتمية V2 — ٧٥ شخصية × ٧ متغيرات = ٥٢٥ جلسة.
   يفحص ثوابت القرار الصارمة ويطبع توزيع المسارات والمجالات والثقة.
   الاستخدام: npx tsx scripts/simulate-v2-personas.ts */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPersonas, buildVariants, runSession, type SessionResult } from './v2/sim-lib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function summarize(results: SessionResult[]) {
  const byPathway = new Map<string, number>()
  const byDomain = new Map<string, number>()
  const byOutput = new Map<string, number>()
  const byKind = new Map<string, number>()
  let invalid = 0
  let unmeasured = 0
  let dupes = 0
  const questionCounts: number[] = []
  for (const r of results) {
    if (r.topPathwayId) byPathway.set(r.topPathwayId, (byPathway.get(r.topPathwayId) ?? 0) + 1)
    if (r.compositeTemplateId) byPathway.set(`template:${r.compositeTemplateId}`, (byPathway.get(`template:${r.compositeTemplateId}`) ?? 0) + 1)
    if (r.domainTop) byDomain.set(r.domainTop, (byDomain.get(r.domainTop) ?? 0) + 1)
    if (r.outputKind) byOutput.set(r.outputKind, (byOutput.get(r.outputKind) ?? 0) + 1)
    byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1)
    invalid += r.invalidPersonaQuestions.length
    unmeasured += r.unmeasuredInfluence.length
    dupes += r.duplicateQuestions.length
    questionCounts.push(r.answersCount)
  }
  questionCounts.sort((a, b) => a - b)
  const avg = questionCounts.reduce((a, b) => a + b, 0) / questionCounts.length
  return {
    sessions: results.length,
    questions: { avg: +avg.toFixed(2), min: questionCounts[0], max: questionCounts[questionCounts.length - 1] },
    pathwayDistribution: Object.fromEntries([...byPathway.entries()].sort((a, b) => b[1] - a[1])),
    domainDistribution: Object.fromEntries([...byDomain.entries()].sort((a, b) => b[1] - a[1])),
    outputKindDistribution: Object.fromEntries(byOutput),
    kindDistribution: Object.fromEntries(byKind),
    invariants: {
      invalidPersonaQuestions: invalid,
      unmeasuredSkillInfluence: unmeasured,
      duplicateQuestions: dupes,
    },
  }
}

const personas = buildPersonas()
const results: SessionResult[] = []
for (const p of personas) {
  const variants = buildVariants(p)
  variants.forEach((v, i) => results.push(runSession(v, `v${i}`)))
}

const summary = summarize(results)
const outDir = join(root, 'docs/diagnostic-v2')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'personas-report.json'), JSON.stringify({ summary, results }, null, 2))

console.log(`جلسات: ${summary.sessions} (شخصيات: ${personas.length})`)
console.log(`أسئلة: متوسط ${summary.questions.avg} | أدنى ${summary.questions.min} | أقصى ${summary.questions.max}`)
console.log('الثوابت الصارمة:', JSON.stringify(summary.invariants))
console.log('توزيع المسارات:', JSON.stringify(summary.pathwayDistribution, null, 1))
console.log('توزيع المخرجات:', JSON.stringify(summary.outputKindDistribution))
console.log('توزيع الأنواع:', JSON.stringify(summary.kindDistribution))
console.log('توزيع المجالات:', JSON.stringify(summary.domainDistribution))

/* فشل صريح عند كسر الثوابت */
const bad = summary.invariants
if (bad.invalidPersonaQuestions > 0 || bad.unmeasuredSkillInfluence > 0 || bad.duplicateQuestions > 0) {
  console.error('❌ كسر ثوابت صارمة — راجع personas-report.json')
  process.exit(1)
}
console.log('✅ كل الثوابت الصارمة = 0')
