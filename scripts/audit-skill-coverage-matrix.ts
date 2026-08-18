/* تدقيق مصفوفة تغطية المهارات — Coverage Matrix كاملة من قاعدة البيانات الحية.
   لكل مهارة منشورة: من يقيسها (أسئلة)، من يغطيها (دورات)، من يطلبها (مسارات).
   التصنيف:
   - سليمة: تُقاس وتُغطى.
   - مخرج تعلم: لا تُقاس في التشخيص لكن دورات تبنيها — مقبول منهجيا.
   - مقاسة بلا تغطية: التشخيص يقيسها ولا دورة تغطيها — تحتاج قرارا.
   - فجوة متعمدة: لا تُقاس ولا تُغطى لكن مسار يطلبها — تظهر «مهارة لا نغطيها بعد».
   - ميتة: لا قياس ولا تغطية ولا مسار يطلبها — مرشحة حذف/دمج (قرار يُوثق).
   يفشل التدقيق عند: مهارة تُقاس فقط بأسئلة غير فعالة، أو سؤالان نشطان بنفس
   طقم المهارات تماما (ازدواج واضح)، أو مهارة مقاسة بأكثر من 3 أسئلة (قياس زائد).
   المخرجات: docs/SKILL_COVERAGE_MATRIX_AR.md + docs/skill-coverage-matrix.json */

import { writeFileSync } from 'node:fs'
import { getPrisma, disconnectPrisma } from '../server/db/client'
import questionPlanJson from '../src/data/catalog/v2_1/question-plan.v2_1.json'
import skillLayersJson from '../src/data/catalog/v2/skill-layers.v2.json'

/* حوكمة 2026-08-19: القياس «الحي» = سؤال فعال في قاعدة البيانات **و** سطحه في
   خطة V2.1 حي (b2c / post_recommendation). سؤال متقاعد في الخطة لا يُحسب قياسًا
   حيًا ولو بقي منشورًا في البنك. والمهارة المحكومة (academic_status ≠ approved_active)
   لا تُصنَّف «ميتة» ولا تُفشل فحص القياس — قرارها موثق سلفًا. */
const plan = (questionPlanJson as unknown as { plan: Record<string, { surface: string }> }).plan
const layers = (skillLayersJson as unknown as { skills: Record<string, { academic_status?: string }> }).skills
const LIVE_SURFACES = new Set(['b2c', 'post_recommendation'])
const liveQuestion = (qid: string) => {
  const p = plan[qid]
  return p !== undefined && LIVE_SURFACES.has(p.surface)
}
const governanceOf = (slug: string) => {
  const st = layers[slug]?.academic_status
  return st && st !== 'approved_active' ? st : null
}

let failures = 0
const fail = (msg: string) => { failures++; console.error(`✗ ${msg}`) }

const main = async () => {
  const prisma = await getPrisma()

  const skills = await prisma.skill.findMany({
    where: { status: 'published' },
    select: {
      id: true, slug: true, nameAr: true, familyId: true, domain: true,
      questionLinks: { select: { weight: true, question: { select: { id: true, active: true, status: true, weight: true } } } },
      courseLinks: { select: { courseId: true, targetLevel: true, weight: true } },
      pathwayReqs: { select: { pathwayId: true, requiredLevel: true, priority: true, weight: true } },
    },
    orderBy: { id: 'asc' },
  })

  interface Row {
    id: string; slug: string; nameAr: string; family: string
    measuredBy: { q: string; w: number; active: boolean }[]
    coveredBy: { c: string; level: number; w: number }[]
    requiredBy: { p: string; level: number; priority: string }[]
    kind: 'سليمة' | 'مخرج تعلم' | 'مقاسة بلا تغطية' | 'فجوة متعمدة' | 'ميتة'
    note: string
  }

  const rows: Row[] = skills.map((s) => {
    const measuredBy = s.questionLinks.map((l) => ({ q: l.question.id, w: l.weight, active: l.question.active && l.question.status === 'published' && liveQuestion(l.question.id) }))
    const coveredBy = s.courseLinks.map((l) => ({ c: l.courseId, level: l.targetLevel, w: l.weight }))
    const requiredBy = s.pathwayReqs.map((r) => ({ p: r.pathwayId, level: r.requiredLevel, priority: r.priority }))
    const measured = measuredBy.some((m) => m.active)
    const covered = coveredBy.length > 0
    const required = requiredBy.length > 0
    const governed = governanceOf(s.slug)
    let kind: Row['kind']
    let note = ''
    if (measured && covered) kind = 'سليمة'
    else if (!measured && covered) { kind = 'مخرج تعلم'; note = 'تبنيها الدورات — لا يلزم قياسها في التشخيص الأولي' }
    else if (measured && !covered) { kind = 'مقاسة بلا تغطية'; note = 'يقيسها التشخيص ولا دورة تغطيها — راجع الجدوى' }
    else if (required) { kind = 'فجوة متعمدة'; note = 'تظهر للطالب كمهارة لا نغطيها بعد — صدق مقصود' }
    else { kind = 'ميتة'; note = 'لا قياس ولا تغطية ولا مسار — مرشحة حذف أو دمج' }
    if (governed) note = `محكومة أكاديميًا (${governed}) — قرار 2026-08-19 موثق في مصفوفة القرار الأكاديمي؛ التفعيل صريح فقط`
    return { id: s.id, slug: s.slug, nameAr: s.nameAr, family: s.familyId ?? '—', measuredBy, coveredBy, requiredBy, kind, note }
  })

  /* فحوص مانعة — المهارات المحكومة أكاديميًا مستثناة: إيقاف قياسها قرار موثق لا خلل */
  for (const r of rows) {
    if (governanceOf(r.slug)) continue
    const activeQs = r.measuredBy.filter((m) => m.active)
    if (r.measuredBy.length > 0 && activeQs.length === 0)
      fail(`${r.id} (${r.nameAr}): مرتبطة بأسئلة لكنها كلها غير فعالة — عديمة القياس فعليا`)
    if (activeQs.length > 3)
      fail(`${r.id} (${r.nameAr}): قياس زائد — ${activeQs.length} أسئلة نشطة تقيسها`)
  }

  /* ازدواج الأسئلة: طقم مهارات مطابق تماما بين سؤالين نشطين */
  const bySkillSet = new Map<string, string[]>()
  const questionMap = new Map<string, string[]>()
  for (const s of skills) {
    for (const l of s.questionLinks) {
      if (!(l.question.active && l.question.status === 'published' && liveQuestion(l.question.id))) continue
      const arr = questionMap.get(l.question.id) ?? []
      arr.push(s.id)
      questionMap.set(l.question.id, arr)
    }
  }
  for (const [qid, set] of questionMap) {
    const key = [...set].sort().join('|')
    const dup = bySkillSet.get(key) ?? []
    dup.push(qid)
    bySkillSet.set(key, dup)
  }
  const duplicateQuestions: string[][] = []
  for (const [, qs] of bySkillSet) {
    if (qs.length > 1) {
      duplicateQuestions.push(qs)
      fail(`أسئلة بازدواج كامل في طقم المهارات: ${qs.join(' ↔ ')}`)
    }
  }

  /* فرص الدمج التكيفي: عائلة مهارات يقيسها أكثر من سؤالين مختلفين */
  const familyQuestions = new Map<string, Set<string>>()
  for (const s of skills) {
    const fam = s.familyId ?? '—'
    const set = familyQuestions.get(fam) ?? new Set<string>()
    for (const l of s.questionLinks) if (l.question.active && l.question.status === 'published' && liveQuestion(l.question.id)) set.add(l.question.id)
    familyQuestions.set(fam, set)
  }
  const adaptiveCandidates = [...familyQuestions.entries()]
    .filter(([, qs]) => qs.size > 2)
    .map(([fam, qs]) => ({ family: fam, questionCount: qs.size }))
    .sort((a, b) => b.questionCount - a.questionCount)

  /* الملخص */
  const counts = {
    total: rows.length,
    سليمة: rows.filter((r) => r.kind === 'سليمة').length,
    مخرجات: rows.filter((r) => r.kind === 'مخرج تعلم').length,
    مقاسة_بلا_تغطية: rows.filter((r) => r.kind === 'مقاسة بلا تغطية').length,
    فجوات_متعمدة: rows.filter((r) => r.kind === 'فجوة متعمدة').length,
    ميتة: rows.filter((r) => r.kind === 'ميتة' && !governanceOf(r.slug)).length,
    محكومة: rows.filter((r) => governanceOf(r.slug) !== null).length,
  }

  /* ── تقرير Markdown ── */
  const md: string[] = []
  md.push('# مصفوفة تغطية المهارات — أكاديمية وجيز', '')
  md.push(`توليد: ${new Date().toISOString().slice(0, 10)} — من قاعدة البيانات الحية (نسخة الكتالوج المحكومة المنشورة).`, '')
  md.push('## الملخص', '')
  md.push(`- إجمالي المهارات المنشورة: **${counts.total}**`)
  md.push(`- سليمة (تُقاس وتُغطى): **${counts.سليمة}**`)
  md.push(`- مخرجات تعلم (تُغطى بلا قياس — مقبول): **${counts.مخرجات}**`)
  md.push(`- مقاسة بلا تغطية دوراتية (تحتاج قرارا): **${counts.مقاسة_بلا_تغطية}**`)
  md.push(`- فجوات متعمدة (تظهر «لا نغطيها بعد»): **${counts.فجوات_متعمدة}**`)
  md.push(`- ميتة (مرشحة حذف/دمج — قرار مؤجل): **${counts.ميتة}**`)
  md.push(`- محكومة أكاديميًا (قرار 2026-08-19 — future_catalog_skill/merged/future_personalization_signal): **${counts.محكومة}**`)
  md.push('')
  md.push('## سلسلة القياس', '')
  md.push('Question → Signal → Skill → Skill Score → Track Fit → Recommendation', '')
  md.push('القاعدة: لا مهارة تؤثر في التوصية دون إشارة قابلة للتفسير.', '')

  const section = (title: string, list: Row[]) => {
    if (list.length === 0) return
    md.push(`## ${title} (${list.length})`, '')
    md.push('| المهارة | العائلة | تقيسها أسئلة | تغطيها دورات | تطلبها مسارات | ملاحظة |')
    md.push('|---|---|---|---|---|---|')
    for (const r of list) {
      md.push(`| ${r.nameAr} (\`${r.id}\`) | ${r.family} | ${r.measuredBy.filter((m) => m.active).length} | ${r.coveredBy.length} | ${r.requiredBy.length} | ${r.note} |`)
    }
    md.push('')
  }
  section('مقاسة بلا تغطية — تحتاج قرارا', rows.filter((r) => r.kind === 'مقاسة بلا تغطية'))
  section('فجوات متعمدة — صدق مقصود', rows.filter((r) => r.kind === 'فجوة متعمدة'))
  section('مهارات ميتة — مرشحة حذف أو دمج', rows.filter((r) => r.kind === 'ميتة'))
  section('سليمة', rows.filter((r) => r.kind === 'سليمة'))
  section('مخرجات تعلم', rows.filter((r) => r.kind === 'مخرج تعلم'))

  md.push('## فرص الدمج التكيفي (Adaptive)', '')
  if (adaptiveCandidates.length === 0) md.push('لا عائلة يقيسها أكثر من سؤالين — التوزيع رشيق.')
  for (const a of adaptiveCandidates) {
    md.push(`- عائلة \`${a.family}\`: يقيسها ${a.questionCount} أسئلة مختلفة — مرشحة لسؤال تكيفي واحد متفرع.`)
  }
  md.push('')
  md.push('## ازدواج الأسئلة', '')
  if (duplicateQuestions.length === 0) md.push('لا سؤالين نشطين بطقم مهارات مطابق تماما.')
  for (const d of duplicateQuestions) md.push(`- ${d.join(' ↔ ')}`)

  writeFileSync('docs/SKILL_COVERAGE_MATRIX_AR.md', md.join('\n'))
  writeFileSync('docs/skill-coverage-matrix.json', JSON.stringify({ generatedAt: new Date().toISOString(), counts, rows, adaptiveCandidates, duplicateQuestions }, null, 2))

  console.log(`📊 مهارات منشورة: ${counts.total} | سليمة ${counts.سليمة} | مخرجات ${counts.مخرجات} | مقاسة بلا تغطية ${counts.مقاسة_بلا_تغطية} | فجوات متعمدة ${counts.فجوات_متعمدة} | ميتة ${counts.ميتة} | محكومة ${counts.محكومة}`)
  console.log(`📄 docs/SKILL_COVERAGE_MATRIX_AR.md + docs/skill-coverage-matrix.json`)
  console.log(failures === 0 ? '✅ مصفوفة التغطية سليمة — لا مشاكل مانعة' : `✗ مشاكل مانعة: ${failures}`)

  await disconnectPrisma()
  process.exit(failures > 0 ? 1 : 0)
}
process.on('uncaughtException', (e) => { if (/terminat/i.test(String(e))) process.exit(process.exitCode ?? 0); throw e })
process.on('unhandledRejection', (e) => { if (/terminat/i.test(String(e))) process.exit(process.exitCode ?? 0); throw e })
main().catch((e) => { console.error(e); process.exit(1) })
