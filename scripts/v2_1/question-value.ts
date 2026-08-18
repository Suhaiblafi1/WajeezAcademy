/* قيمة القرار لكل سؤال — V2.1 (البند: Question Decision Value Instrumentation)
   لكل سؤال نشط: كم مرة سُئل، كم مرة قلبت إجابته الفائز، وكم حرّكت هامش السباق
   (فارق صافي الملاءمة بين الأول والثاني) قبل/بعد الإجابة.
   القياس حتمي: بذرة ثابتة وجلسات مولدة من نفس مولد مونت كارلو في golden-suite.
   لا يغيّر أي سؤال ولا محرك — تقرير قياس فقط يغذي المراجعة الأكاديمية. */

import { writeFileSync } from 'node:fs'
import { createEngineV21 } from '../../src/domain/diagnostic/v2_1'
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import { questionPlanV21 } from '../../src/domain/diagnostic/v2_1/data'
import { questionById } from '../../src/domain/diagnostic/catalog'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

const STAGE_LABEL: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساري المهني',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل — أعمل لحسابي',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}
const ALL_STAGES = Object.keys(STAGE_LABEL) as CareerStage[]
const TIME_BY_ORDER = ['أقل من ساعتين أسبوعيًا', '٢–٤ ساعات', '٥–٧ ساعات', '٨ ساعات أو أكثر']
const MASTERY = ['أن أتقن مهارة أو تخصصًا واحدًا بعمق', 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف', 'غير متأكد']
const INTERESTS = ['تقنية', 'أعمال', 'تسويق', 'تعليم', 'صناعة محتوى', 'قيادة', 'حكومة/سياسات', 'مالية', 'لا أعرف']

interface QStat {
  asked: number
  flips: number
  sumAbsMarginDelta: number
  /** جلسات كان السؤال فيها ضمن آخر ثلاثة أسئلة قبل التوقف — مقاعد «ذروة الحسم» */
  lateSeat: number
}

function winnerOf(comp: { candidates: { entity: { entity_id: string }; netFit: number }[] }): string | null {
  return comp.candidates[0]?.entity.entity_id ?? null
}
function marginOf(comp: { candidates: { netFit: number }[] }): number {
  return comp.candidates.length >= 2 ? comp.candidates[0].netFit - comp.candidates[1].netFit : 1
}

function main() {
  const seed = Number(process.argv[2] ?? 20260818)
  const sessions = Number(process.argv[3] ?? 2000)
  const rng = mulberry32(seed)
  const stats = new Map<string, QStat>()
  const bump = (id: string): QStat => {
    const s = stats.get(id) ?? { asked: 0, flips: 0, sumAbsMarginDelta: 0, lateSeat: 0 }
    stats.set(id, s)
    return s
  }

  for (let i = 0; i < sessions; i++) {
    const stage = pick(rng, ALL_STAGES)
    const goals = GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
    const needs = NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
    const script = {
      stage,
      employment: pick(rng, ['أعمل لدى جهة', 'لا أعمل حاليًا', 'لدي مشروعي الخاص']),
      goal: pick(rng, goals).label_ar,
      need: pick(rng, needs).label_ar,
      time: pick(rng, TIME_BY_ORDER),
      mastery: pick(rng, MASTERY),
      interest: pick(rng, INTERESTS),
      skillLevel: 1 + Math.floor(rng() * 5),
      govSector: rng() < 0.15,
    }
    const engine = createEngineV21(`qv-${seed}-${i}`)
    const askedIds: string[] = []
    for (let step = 0; step < 20; step++) {
      const next = engine.nextQuestion()
      if (next.stop.shouldStop || !next.question) break
      const q = next.question
      const before = engine.competeSnapshot()
      const w0 = winnerOf(before)
      const m0 = marginOf(before)
      /* إجابة حتمية من نفس منطق runJourney */
      const byLabel = (l?: string) => (l ? q.options_ar.indexOf(l) : -1)
      let idx = -1
      if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[script.stage])
      else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(script.employment)
      else if (q.question_id === Q.GOAL) idx = byLabel(script.goal)
      else if (q.question_id === Q.NEED) idx = byLabel(script.need)
      else if (q.question_id === Q.TIME) idx = byLabel(script.time)
      else if (q.question_id === Q.MASTERY) idx = byLabel(script.mastery)
      else if (q.question_id === 'QB-M3E-002') idx = byLabel(script.interest)
      else if (q.question_id === 'QB-M3B-001' && script.govSector) idx = byLabel('حكومي')
      else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = script.skillLevel - 1
      else idx = 0
      if (idx < 0) idx = 0
      engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
      const after = engine.competeSnapshot()
      const s = bump(q.question_id)
      s.asked++
      if (winnerOf(after) !== w0) s.flips++
      s.sumAbsMarginDelta += Math.abs(marginOf(after) - m0)
      askedIds.push(q.question_id)
    }
    for (const id of askedIds.slice(-3)) bump(id).lateSeat++
  }

  /* كل سؤال active_b2c لم يُسأل إطلاقًا — مقعد نظري بلا استخدام فعلي */
  const activeNever = Object.entries(questionPlanV21)
    .filter(([id, p]) => p.final_status === 'active_b2c' && !stats.has(id))
    .map(([id]) => id)

  const rows = [...stats.entries()]
    .map(([id, s]) => ({
      id,
      text: questionById.get(id)?.text_ar?.slice(0, 60) ?? '—',
      asked: s.asked,
      rate: s.asked / sessions,
      flips: s.flips,
      flipRate: s.asked > 0 ? s.flips / s.asked : 0,
      avgMarginDelta: s.asked > 0 ? s.sumAbsMarginDelta / s.asked : 0,
      lateSeat: s.lateSeat,
    }))
    .sort((a, b) => b.flips - a.flips || b.avgMarginDelta - a.avgMarginDelta)

  const md: string[] = []
  md.push('# قيمة القرار لكل سؤال — تشخيص V2.1', '')
  md.push(`توليد: ${new Date().toISOString().slice(0, 10)} · بذرة ${seed} · ${sessions} جلسة مونت كارلو حتمية.`, '')
  md.push('## التعريفات', '')
  md.push('- **سُئل**: عدد الجلسات التي ظهر فيها السؤال فعلًا (التكيف يستبعد غير اللازم).')
  md.push('- **قلب الفائز**: عدد المرات التي تغيّر فيها المرشح الأول مباشرة بعد الإجابة.')
  md.push('- **متوسط تحريك الهامش**: متوسط |تغيّر فارق صافي الملاءمة بين الأول والثاني| بعد الإجابة — كلما كبر كان السؤال أشد فصلًا.')
  md.push('- **مقعد حسم**: ظهوره ضمن آخر ثلاثة أسئلة قبل التوقف.', '')
  md.push('## القراءة الأكاديمية', '')
  md.push('- سؤال يُسأل كثيرًا ولا يقلب ولا يحرك الهامش → مرشح نقل إلى جولة التأكيد أو التقاعد (قرار أكاديمي، لا يُنفذ من هذا التقرير).')
  md.push('- سؤال نادر الظهور لكنه قلّاب → فاصل حاسم يجب حمايته من إعادة الصياغة العشوائية.', '')
  md.push('## الجدول', '')
  md.push('| السؤال | النص (مختصر) | سُئل | نسبة الظهور | قلب الفائز | نسبة القلب | متوسط تحريك الهامش | مقعد حسم |')
  md.push('|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    md.push(
      `| \`${r.id}\` | ${r.text.replace(/\|/g, '\\|')} | ${r.asked} | ${(r.rate * 100).toFixed(1)}٪ | ${r.flips} | ${(r.flipRate * 100).toFixed(1)}٪ | ${r.avgMarginDelta.toFixed(3)} | ${r.lateSeat} |`,
    )
  }
  md.push('')
  md.push(`## أسئلة نشطة لم تُسأل إطلاقًا في ${sessions} جلسة (${activeNever.length})`, '')
  for (const id of activeNever) md.push(`- \`${id}\` — ${questionById.get(id)?.text_ar ?? '—'}`)
  md.push('')

  writeFileSync('docs/QUESTION_DECISION_VALUE_V2_1_AR.md', md.join('\n'))
  const totalAsked = rows.reduce((a, r) => a + r.asked, 0)
  const totalFlips = rows.reduce((a, r) => a + r.flips, 0)
  console.log(`📄 docs/QUESTION_DECISION_VALUE_V2_1_AR.md — ${rows.length} سؤالًا سُئل فعلًا · ${activeNever.length} نشطًا لم يُسأل`)
  console.log(`   إجمالي الإجابات: ${totalAsked} · قلب الفائز: ${totalFlips} (${((totalFlips / totalAsked) * 100).toFixed(1)}٪)`)
  console.log('   أعلى خمسة قلبًا:', rows.slice(0, 5).map((r) => `${r.id}(${r.flips})`).join(' '))
}
main()
