/* تدقيق قابلية التوصية — يفشل عند مرشح «ميت»:
   مسار أو قالب منشور لا يستطيع أي تركيبة إجابات معقولة الوصول إليه.
   الأسلوب: تشغيل الشخصيات الـ12 + فحص بنيوي (إشارات القالب تشير لحقائق معروفة). */

import { getPrisma, disconnectPrisma } from '../server/db/client'
import { buildSnapshotFromDb } from '../server/catalog/snapshot-builder'
import { installCatalogSnapshot, type CatalogSnapshotPayload } from '../src/domain/diagnostic/catalog'
import { runSession } from '../src/tests/diagnostic/helpers'
import { PERSONAS } from '../src/tests/diagnostic/personas'

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error(`✗ ${msg}`) }
}

const main = async () => {
  const prisma = await getPrisma()
  const snap = await buildSnapshotFromDb(prisma)
  installCatalogSnapshot(snap.payload as unknown as CatalogSnapshotPayload, 'audit-candidates')

  /* الشخصيات الـ12: كلها تصل لتوصية سليمة */
  const recommendedPathways = new Set<string>()
  const recommendedTemplates = new Set<string>()
  for (const [name, script] of PERSONAS) {
    const r = runSession(script)
    check(r.recommendation.kind.length > 0, `شخصية ${name} بلا توصية`)
    if (r.recommendation.primaryPathway) recommendedPathways.add(r.recommendation.primaryPathway.pathwayId)
    if (r.recommendation.composite) recommendedTemplates.add(r.recommendation.composite.templateId)
  }

  /* إشارات القوالب تشير لحقائق يستطيع المحرك إنتاجها:
     من آثار الخيارات + مصنفات الكلمات + مقاييس الأسئلة + حقائق مدمجة (هوية/موافقة) */
  interface CandidatesPayload {
    optionEffects: {
      option_effects: Record<string, Record<string, Record<string, string>>>
      keyword_classifiers: Record<string, { fact_key: string }>
    }
    questions: { questions: { measures?: string[] }[] }
    templates: { templates: unknown[] }
  }
  const payload = snap.payload as unknown as CandidatesPayload
  const optionEffects = payload.optionEffects.option_effects
  const classifiers = payload.optionEffects.keyword_classifiers
  const knownFacts = new Set<string>()
  for (const q of Object.values(optionEffects)) for (const o of Object.values(q)) for (const f of Object.keys(o)) knownFacts.add(f)
  for (const c of Object.values(classifiers)) knownFacts.add(c.fact_key)
  for (const q of payload.questions.questions) for (const m of q.measures ?? []) knownFacts.add(m)
  for (const f of ['diagnostic_consent', 'minor_flag', 'decision_owner', 'verified_mastery', 'primary_goal', 'goal_clarity']) knownFacts.add(f)

  const templates = payload.templates.templates as {
    template_id: string
    diagnostic?: { positive_signals?: { fact_key: string }[]; required_facts?: { fact_key: string }[] }
  }[]
  for (const t of templates) {
    for (const s of t.diagnostic?.positive_signals ?? []) {
      check(knownFacts.has(s.fact_key), `قالب ${t.template_id}: إشارة لحقيقة لا ينتجها أي سؤال: ${s.fact_key}`)
    }
    for (const f of t.diagnostic?.required_facts ?? []) {
      check(knownFacts.has(f.fact_key), `قالب ${t.template_id}: حقيقة مطلوبة لا ينتجها أي سؤال: ${f.fact_key}`)
    }
  }

  console.log(`\nالشخصيات أوصت بـ ${recommendedPathways.size} مسارا و${recommendedTemplates.size} قالبا من أصل 20 و16`)
  console.log(failures === 0 ? '✅ كل المرشحين قابلون للوصول بنيويا' : '✗ فشل')
  await disconnectPrisma()
  if (failures > 0) process.exit(1)
}
process.on('uncaughtException', (e) => { if (!/terminat/i.test(String(e))) throw e })
main().catch((e) => { console.error(e); process.exit(1) })
