import { createEngineV21, assessDomainsV21, derivePersonaV21 } from './src/domain/diagnostic/v2_1'
import { buildSkillStates } from './src/domain/diagnostic/v2/skills'
import { composePath } from './src/domain/diagnostic/v2_1/compose-path'
import { familiesForCourses, familyIndex } from './src/domain/diagnostic/v2_1/skill-families'
import { catalogCourses } from './src/domain/diagnostic/catalog'
import type { Answer } from './src/domain/diagnostic/types'

function ctxFor(script: Record<string,string>, id: string) {
  const e = createEngineV21(id)
  for (let i=0;i<25;i++){ const n=e.nextQuestion(); if(!n.question) break
    const q=n.question; const w=script[q.question_id]
    let v: Answer['value']
    if (w!==undefined){ const k=q.options_ar.indexOf(w); v = k>=0?q.options_ar[k]:(q.options_ar[0]??'لا ينطبق') }
    else v=q.options_ar.length?q.options_ar[0]:'لا ينطبق'
    e.answer({questionId:q.question_id,value:v}) }
  const st=e.getState()
  return { ctx:{facts:st.facts,persona:derivePersonaV21(st.facts),domains:assessDomainsV21(st.facts,st.interestVector),skillStates:buildSkillStates(st.skillVector)}, rec:e.recommend() as any }
}

const GRAD_AI = {'QC-S1-001':'خريج حديث','QC-S1-002':'أبحث عن عمل','QC-G2-001':'استخدام الذكاء الاصطناعي بفعالية أكبر','QC-N3-001':'الذكاء الاصطناعي وتطبيقاته العملية','QB-M2-005':'واضح','QC-F7-001':'٥–٧ ساعات','QB-M2-015':'عالية'}
const { ctx, rec } = ctxFor(GRAD_AI, 'cp-grad')
console.log('المسار الذي يختاره المحرك اليوم:', rec.primaryPathway?.pathwayId)
console.log('مجال المرساة:', ctx.domains.top)

// العائلات التي يحتاج المتعلم تقييمها (مقررات الفائز)
const winnerCourses = catalogCourses.filter(c=>c.pathway_id===rec.primaryPathway?.pathwayId).map(c=>c.course_id)
const fams = familiesForCourses(winnerCourses)
const idx = familyIndex()
console.log('\nالعائلات التي تلزم تقييما (', fams.length, '):')
for (const f of fams) console.log(`   ${f.family.padEnd(8)} ${String(f.skills.length).padStart(2)} مهارة · ${f.courseCount} مقررا · ${idx.labelOf.get(f.family)??''}`)

// سيناريو: المتعلم يقيّم عائلاته — ضعيف في AI وCOG، متوسط فيما عدا
const ratings: Record<string,number> = {}
for (const f of fams) ratings[f.family] = (f.family==='AI'||f.family==='COG') ? 1 : 3

console.log('\n--- الخطة المركّبة من الفجوات ---')
const plan = composePath(ctx, ratings)
console.log('ساعات', plan.totalHours, '| ملاءمة', plan.meanFit.toFixed(3), '| يطابق مسارا:', plan.matchesPathwayId ?? 'لا — خطة مركّبة')
for (const c of plan.courses) console.log(`   ${c.courseId.padEnd(11)} ${c.title_ar.slice(0,30).padEnd(32)} ${c.total.toFixed(2)} | ${c.pathwayId} | ${c.why_ar}`)
console.log('غطّت', plan.coveredGaps.length, 'فجوة · بقيت', plan.uncoveredGaps.length)
plan.reasons_ar.forEach(r=>console.log('  •', r))
