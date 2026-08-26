/* ثلاثون رحلة بشرية مصممة — إغلاق منطق V2.1 (البند 8: Human-Designed Journeys)
   12 شخصية + 14 مجال احتياج + 4 حالات حدية. كل رحلة تُقفل:
   - نوع نتيجة صالحًا وفائزًا داخل الفضاء النشط (20 قياسي + 15 مركب)
   - عدد أسئلة ضمن 6–14 (لا خامس عشر أبدًا)
   - حتمية تامة: التشغيل الثاني يطابق الأول أسئلةً ونتيجةً وثقةً
   الحالات الحدية الأربع لها أقفال سلوكية إضافية موثقة عند كل اختبار */

import { describe, expect, it } from 'vitest'
import { createEngineV21, type RecommendationV21 } from '../../../domain/diagnostic/v2_1'
import { Q, NEEDS_V21, type CareerStage } from '../../../domain/diagnostic/v2_1/maps'
import { recommendationUniverse } from '../../../domain/diagnostic/v2_1/universe'

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

interface Journey {
  stage: CareerStage
  employment?: string
  goal?: string
  need?: string
  time?: string
  mastery?: string
  interest?: string
  answers?: Record<string, string>
  skillLevel?: number
}

function runJourney(name: string, script: Journey): { asked: string[]; rec: RecommendationV21 } {
  const engine = createEngineV21(`hj-${name}`)
  const asked: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    const byLabel = (l?: string): number => (l ? q.options_ar.indexOf(l) : -1)
    let idx = -1
    const explicit = script.answers?.[q.question_id]
    if (explicit !== undefined) idx = byLabel(explicit)
    if (idx < 0) {
      if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[script.stage])
      else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(script.employment ?? 'أعمل لدى جهة')
      else if (q.question_id === Q.GOAL) idx = byLabel(script.goal ?? '')
      else if (q.question_id === Q.NEED) idx = byLabel(script.need ?? '')
      else if (q.question_id === Q.TIME) idx = byLabel(script.time ?? '٢–٤ ساعات')
      else if (q.question_id === Q.MASTERY) idx = byLabel(script.mastery ?? 'غير متأكد')
      else if (q.question_id === 'QB-M3E-002') idx = byLabel(script.interest ?? 'لا أعرف')
      else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = (script.skillLevel ?? 3) - 1
      else idx = 0
      if (idx < 0) idx = 0
    }
    engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return { asked, rec: engine.recommend() }
}

const needLabel = (code: string): string => NEEDS_V21.find((n) => n.code === code)!.label_ar

const ACTIVE_IDS = new Set(recommendationUniverse().active.map((e) => e.entity_id))
const VALID_KINDS = ['single_pathway', 'composite_template', 'exploratory_direction', 'advisor_referral']

/* 12 شخصية تمثل جمهور الأكاديمية */
const PERSONAS: [string, Journey][] = [
  ['طالب', { stage: 'university_student', employment: 'لا أعمل حاليًا', goal: 'الحصول على أول وظيفة', need: needLabel('need_employability'), skillLevel: 2 }],
  ['خريج', { stage: 'fresh_graduate', employment: 'لا أعمل حاليًا', goal: 'الحصول على أول وظيفة', need: needLabel('need_employability'), skillLevel: 2 }],
  ['مبتدئ', { stage: 'early_career', goal: 'بناء مهارات عملية يطلبها سوق العمل', need: needLabel('need_ai'), skillLevel: 3 }],
  ['خبير', { stage: 'experienced', goal: 'التقدم أو الترقية في عملي', need: needLabel('need_projects'), skillLevel: 4 }],
  ['مدير', { stage: 'manager', goal: 'الاستعداد لدور قيادي', need: needLabel('need_leadership'), skillLevel: 4 }],
  ['تنفيذي', { stage: 'senior_manager', goal: 'الاستعداد لدور قيادي', need: needLabel('need_leadership'), skillLevel: 4 }],
  ['مؤسس', { stage: 'founder', employment: 'لدي مشروعي الخاص', goal: 'بدء مشروع أو مصدر دخل مستقل', need: needLabel('need_business'), skillLevel: 3 }],
  ['مستقل', { stage: 'freelancer', employment: 'أعمل لحسابي (عمل حر)', goal: 'زيادة دخلي وعملائي في العمل الحر', need: needLabel('need_sales'), skillLevel: 3 }],
  ['مدرب', { stage: 'trainer_ld', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_learning_design'), skillLevel: 4 }],
  ['غير-محسوم', { stage: 'other_unsure', employment: 'لا أعمل حاليًا', goal: 'غير متأكد — أريد أن يساعدني التشخيص', need: needLabel('need_unsure'), interest: 'لا أعرف', skillLevel: 2 }],
  ['محوّل-مسار', { stage: 'experienced', goal: 'تغيير مساري المهني', need: needLabel('need_data'), skillLevel: 2 }],
  ['حكومي', { stage: 'experienced', goal: 'التقدم أو الترقية في عملي', need: needLabel('need_operations'), answers: { 'QB-M3B-001': 'القطاع العام / الحكومي' }, skillLevel: 3 }],
]

/* 14 مجال احتياج — كل مجال معلن في NEEDS_V21 يجب أن يجد توصية صالحة */
const DOMAIN_JOURNEYS: [string, Journey][] = [
  ['مجال-بيانات', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_data'), skillLevel: 3 }],
  ['مجال-مشاريع', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_projects'), skillLevel: 3 }],
  ['مجال-قيادة', { stage: 'manager', goal: 'الاستعداد لدور قيادي', need: needLabel('need_leadership'), skillLevel: 4 }],
  ['مجال-تواصل', { stage: 'early_career', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_communication'), skillLevel: 3 }],
  ['مجال-ذكاء', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_ai'), skillLevel: 2 }],
  ['مجال-عمليات', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_operations'), skillLevel: 3 }],
  ['مجال-تجربة-عميل', { stage: 'manager', goal: 'تحسين أدائي في عملي الحالي', need: needLabel('need_customer_experience'), skillLevel: 3 }],
  ['مجال-مبيعات', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_sales'), skillLevel: 3 }],
  ['مجال-تسويق', { stage: 'early_career', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_marketing'), skillLevel: 3 }],
  ['مجال-تفاوض', { stage: 'manager', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_negotiation'), skillLevel: 3 }],
  ['مجال-منتج', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_product'), skillLevel: 3 }],
  ['مجال-سيبراني', { stage: 'manager', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_cyber'), skillLevel: 3 }],
  ['مجال-إمداد', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_supply'), skillLevel: 3 }],
  ['مجال-مالية', { stage: 'experienced', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_finance'), skillLevel: 3 }],
]

function expectHealthyJourney(name: string, a: { asked: string[]; rec: RecommendationV21 }, b: { asked: string[]; rec: RecommendationV21 }): void {
  expect(VALID_KINDS, `${name}: نوع نتيجة غير صالح ${a.rec.kind}`).toContain(a.rec.kind)
  const winner = a.rec.composite?.templateId ?? a.rec.primaryPathway?.pathwayId ?? null
  if (a.rec.kind !== 'exploratory_direction') {
    expect(winner, `${name}: لا فائز رغم نوع ${a.rec.kind}`).not.toBeNull()
    expect(ACTIVE_IDS.has(winner!), `${name}: فائز خارج الفضاء النشط: ${winner}`).toBe(true)
  }
  expect(a.asked.length, `${name}: ${a.asked.length} سؤالًا خارج 6–14`).toBeGreaterThanOrEqual(6)
  expect(a.asked.length, `${name}: ${a.asked.length} سؤالًا — تجاوز السقف`).toBeLessThanOrEqual(14)
  /* الحتمية: نفس الإجابات مرتين = نفس الأسئلة والنتيجة والثقة */
  expect(b.asked, `${name}: الحتمية كسرت في الأسئلة`).toEqual(a.asked)
  expect(b.rec.kind, `${name}: الحتمية كسرت في النوع`).toBe(a.rec.kind)
  expect(b.rec.confidence.total, `${name}: الحتمية كسرت في الثقة`).toBe(a.rec.confidence.total)
}

describe('الرحلات البشرية المصممة الثلاثون — إغلاق منطق V2.1', () => {
  for (const [name, j] of [...PERSONAS, ...DOMAIN_JOURNEYS]) {
    it(`رحلة ${name}: توصية صالحة داخل الفضاء وحتمية`, () => {
      expectHealthyJourney(name, runJourney(name, j), runJourney(`${name}-ب`, j))
    })
  }

  it('حافة ١ — سباق حي بلا أي حاسمة مقاسة → وسم مستشار مع خطة مرفقة (لا صمت)', () => {
    /* مؤسس غير محسوم الهدف يحتاج التفاوض: السباق يبقى حيًا حتى السقف وتفوز
       PW-NEG-001 بلا قياس حاسمتها — الحارس المُحكَّم يوسم بمراجعة مستشار
       والمسار يبقى مرفقًا (الفائز يُقرأ من الكيان المرفق لا من النوع) */
    const j: Journey = {
      stage: 'founder', employment: 'لدي مشروعي الخاص',
      goal: 'غير متأكد — أريد أن يساعدني التشخيص',
      need: needLabel('need_negotiation'), time: '٥–٧ ساعات', skillLevel: 3,
    }
    const a = runJourney('حافة-سباق-حي', j)
    /* قياس 2026-08-26: لم تعد هذه الرحلة تُجسّد «بلا أي حاسمة مقاسة». حواسم
       PW-NEG-001 ثلاث — active_listening وnegotiation وpersuasion — وصارت
       الثلاث مقيسة: الأولى بسؤال جديد (QB-M4-027)، والثالثة بإعادة توجيه
       QB-M4-012 من مفتاح غير مسجَّل إلى مهارته. فحُسم السباق دليليا ونال
       المتعلم مسارا محددا بدل تحويله إلى مستشار — وهو المقصود من القياس.
       عقد «لا صمت عند غياب الحواسم» لم يسقط: يحرسه stop-caps.test.ts
       («ثقة منخفضة بلا إحالة») وcompletion-v2.test.ts على حالة تُجسّده فعلا. */
    expect(a.rec.kind).toBe('single_pathway')
    expect(a.rec.primaryPathway?.pathwayId).toBe('PW-NEG-001')
    expectHealthyJourney('حافة-سباق-حي', a, runJourney('حافة-سباق-حي-ب', j))
  })

  it('حافة ٢ — استكشاف نقي → اتجاه استكشافي بلا أسئلة مهارات M4', () => {
    const j: Journey = {
      stage: 'other_unsure', employment: 'لا أعمل حاليًا',
      goal: 'غير متأكد — أريد أن يساعدني التشخيص',
      need: needLabel('need_unsure'), interest: 'لا أعرف', skillLevel: 1,
    }
    const a = runJourney('حافة-استكشاف', j)
    expect(a.rec.kind).toBe('exploratory_direction')
    for (const id of a.asked) expect(id.startsWith('QB-M4-'), `سؤال مهارة ${id} تسلل لرحلة استكشاف`).toBe(false)
    expectHealthyJourney('حافة-استكشاف', a, runJourney('حافة-استكشاف-ب', j))
  })

  it('حافة ٣ — طالب يطلب تواصلًا: لا قيادة ولا مؤسسي في النتيجة (استبعاد صلب)', () => {
    const j: Journey = {
      stage: 'university_student', employment: 'لا أعمل حاليًا',
      goal: 'بناء مهارات عملية يطلبها سوق العمل', need: needLabel('need_communication'), skillLevel: 2,
    }
    const a = runJourney('حافة-طالب', j)
    expect(a.rec.kind).toBe('single_pathway')
    expect(a.rec.primaryPathway?.pathwayId?.startsWith('PW-STU')).toBe(true)
    expectHealthyJourney('حافة-طالب', a, runJourney('حافة-طالب-ب', j))
  })

  it('حافة ٤ — وقت شحيح (أقل من ساعتين) لقيادي أول: توصية صالحة تحترم العبء', () => {
    const j: Journey = {
      stage: 'senior_manager', goal: 'تطوير مهارة محددة أعرفها',
      need: needLabel('need_leadership'), time: 'أقل من ساعتين', skillLevel: 4,
    }
    const a = runJourney('حافة-وقت', j)
    expect(['single_pathway', 'composite_template', 'advisor_referral']).toContain(a.rec.kind)
    expectHealthyJourney('حافة-وقت', a, runJourney('حافة-وقت-ب', j))
  })
})
