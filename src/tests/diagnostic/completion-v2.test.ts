/* الاختبارات الإلزامية لإكمال محرك التشخيص — تغطي البنود العشرين من ملف المهمة:
   ثبات القرار بمعرف الخيار، السؤال الفاصل، المرشحات الصارمة، سقف الساعات، الحذف الموثق،
   جسر المؤشر، وسم الخطة المركبة، أثر القرار، المستودع، وحارس المحرك القديم. */

import { describe, expect, it } from 'vitest'
import { optionIdFromText, questionById, courseById } from '../../domain/diagnostic/catalog'
import { buildCoursePlan, scoreTemplates } from '../../domain/diagnostic/composite'
import { TEMPLATE_THRESHOLDS } from '../../domain/diagnostic/config'
import { createEngine, DiagnosticEngine } from '../../domain/diagnostic/engine'
import { mirrorAnswersToFacts } from '../../domain/diagnostic/teaser-bridge'
import { compositeTemplates } from '../../domain/diagnostic/catalog'
import { recommendationToDiagResult } from '../../application/diagnostic/view-model'
import { LocalDiagnosticSessionRepository } from '../../application/diagnostic/session-repository'
import type { FactBag, FactValue, PlanVariant } from '../../domain/diagnostic/types'
import * as diagContracts from '../../data/diagnostic'
import { FOUNDER_IDEA, GRAD_INTERVIEWS, runSession } from './helpers'

const F = (v: string | number, q = 'probe'): FactValue => ({ value: v, sourceQuestionId: q, evidenceQuality: 0.9 })

/** حقائق تجعل قالبي المشروع والعمل الحر متقاربين (<0.08) — مثبتة بالاستكشاف */
const closeFacts = (): FactBag => ({
  persona_type: F('freelancer'),
  primary_goal: F('first_customer'),
  goal_clarity: F('medium'),
  business_stage: F('idea'),
  offer_clarity: F('partial'),
  revenue_signal: F('none'),
  weekly_load: F('5_6'),
  application_readiness: F('high'),
  sales_negotiation: F(2),
  business_finance: F(2),
})

/** حقائق رائد فكرة يرفض التطبيق الميداني — تطلق مرشح advisor_handoff */
const handoffFacts = (): FactBag => ({
  persona_type: F('founder'),
  primary_goal: F('business_launch'),
  goal_clarity: F('high'),
  business_stage: F('idea'),
  offer_clarity: F('partial'),
  revenue_signal: F('none'),
  weekly_load: F('5_6'),
  application_readiness: F('low'),
  customer_discovery: F(1),
})

function runScripted(engine: DiagnosticEngine, script: Record<string, string>) {
  const asked: string[] = []
  for (let i = 0; i < 40; i++) {
    const n = engine.nextQuestion()
    if (!n.question) break
    asked.push(n.question.question_id)
    const scripted = script[n.question.question_id]
    engine.answer({ questionId: n.question.question_id, value: scripted ?? n.question.options_ar[0] ?? 'لا ينطبق' })
  }
  return asked
}

describe('ثبات القرار بمعرف الخيار (option_id)', () => {
  it('تغيير نص الخيار العربي لا يغير الحقيقة الناتجة — المعرف أساس القرار', () => {
    const q = questionById.get('QB-M2-001')!
    const oid = optionIdFromText(q, 'مشروع أو دخل')!
    expect(oid).toMatch(/^o\d+$/)

    const byText = createEngine('oid-1')
    byText.answer({ questionId: 'QB-M2-001', value: 'مشروع أو دخل' })

    const byId = createEngine('oid-2')
    // نص معروض مختلف تماما (كأن الإدارة عدّلت الصياغة) مع نفس المعرف الثابت
    byId.answer({ questionId: 'QB-M2-001', value: 'إطلاق مشروعي الخاص أو دخل إضافي', optionIds: [oid] })

    expect(byId.getState().facts['primary_goal']?.value).toBe(byText.getState().facts['primary_goal']?.value)
  })

  it('الجلسة الكاملة بالمعرفات تنتج نفس توصية الجلسة بالنصوص', () => {
    const byText = runSession(FOUNDER_IDEA)
    const engine = createEngine('oid-3')
    for (let i = 0; i < 40; i++) {
      const n = engine.nextQuestion()
      if (!n.question) break
      const scripted = (FOUNDER_IDEA as Record<string, string | string[]>)[n.question.question_id]
      const firstText = Array.isArray(scripted) ? scripted[0] : scripted
      const oid = firstText ? optionIdFromText(n.question, firstText) : null
      engine.answer({
        questionId: n.question.question_id,
        value: firstText ?? 'لا ينطبق',
        optionIds: oid ? [oid] : undefined,
      })
    }
    const byId = engine.recommend()
    expect(byId.kind).toBe(byText.recommendation.kind)
    expect(byId.primaryPathway?.pathwayId).toBe(byText.recommendation.primaryPathway?.pathwayId)
    expect(byId.composite?.templateId).toBe(byText.recommendation.composite?.templateId)
  })
})

describe('السؤال الفاصل بين خطتين متقاربتين', () => {
  it('تقارب < 8٪ مع فاصل غير مسؤول: يُطرح الفاصل قبل أي توقف', () => {
    const engine = createEngine('diff-1')
    engine.seedFacts(closeFacts(), 'اختبار')
    const next = engine.nextQuestion()
    expect(next.question?.question_id).toBe('QB-M3C-011')
    expect(next.stop.shouldStop).toBe(false)
    const trace = engine.getState().trace.find((t) => t.kind === 'question_selected')
    expect(trace?.data?.differentiator).toBe(true)
    expect((trace?.data?.margin as number) < TEMPLATE_THRESHOLDS.top_two_margin).toBe(true)
  })

  it('بعد إجابة الفاصل يُحسم القرار أو يتابع — لا توقف قبله', () => {
    const engine = createEngine('diff-2')
    engine.seedFacts(closeFacts(), 'اختبار')
    const first = engine.nextQuestion()
    expect(first.question?.question_id).toBe('QB-M3C-011')
    engine.answer({ questionId: 'QB-M3C-011', value: 'أعمل وحدي' })
    // بعد الفاصل: لا يجوز أن يعود نفس السؤال الفاصل
    const second = engine.nextQuestion()
    expect(second.question?.question_id).not.toBe('QB-M3C-011')
  })
})

describe('المرشحات الصارمة للقوالب (hard_filters)', () => {
  it('recommend_bridge يستبعد قالب العمل الحر عند عرض غير واضح', () => {
    const { state } = runSession(FOUNDER_IDEA) // أجاب «غير واضح» عن عرض القيمة
    const scored = scoreTemplates(state.facts, [])
    const freelance = scored.find((s) => s.template.template_id === 'TPL-FREELANCE-001')!
    expect(freelance.hardFilter?.action).toBe('recommend_bridge')
    // ولذلك فاز قالب المشروع رغم أن العمل الحر كان الأعلى نقاطا قبل التصحيح
    expect(runSession(FOUNDER_IDEA).recommendation.composite?.templateId).toBe('TPL-VENTURE-001')
  })

  it('advisor_handoff يحيل التوصية لمستشار مع سبب موثق', () => {
    const engine = createEngine('handoff-1')
    engine.seedFacts(handoffFacts(), 'اختبار')
    const rec = engine.recommend()
    expect(rec.kind).toBe('advisor_referral')
    expect(rec.composite?.advisorHandoff?.filterId).toBe('VENTURE-NO-PRACTICE')
    expect(rec.composite?.advisorHandoff?.rationale_ar.length ?? 0).toBeGreaterThan(0)
  })

  it('exclude يمنع قالب المدير الجديد لمن يعمل منفردا', () => {
    const facts: FactBag = { team_context: F('solo') }
    const scored = scoreTemplates(facts, [])
    const mgr = scored.find((s) => s.template.template_id === 'TPL-NEW-MANAGER-001')
    expect(mgr?.hardFilter?.action).toBe('exclude')
  })
})

describe('بناء خطة الدورات', () => {
  it('كل قالب وكل نسخة تحترم سقف 80 ساعة أو تُحال لمستشار', () => {
    for (const tpl of compositeTemplates) {
      for (const variant of ['starter', 'full', 'extended'] as PlanVariant[]) {
        const plan = buildCoursePlan(tpl, variant, [])
        const total = plan.items.reduce((s, c) => s + c.hours, 0)
        if (!plan.requiredOverflow) {
          expect(total).toBeLessThanOrEqual(TEMPLATE_THRESHOLDS.max_plan_hours)
        } else {
          expect(plan.items.length).toBe(0) // التجاوز لا يُصدر خطة آليا
        }
      }
    }
  })

  it('لا حذف لأي دورة بتقييم ذاتي — الحذف يتطلب إتقانا موثقا', () => {
    const tpl = compositeTemplates.find((t) => t.template_id === 'TPL-VENTURE-001')!
    const plan = buildCoursePlan(tpl, 'full', [])
    expect(plan.removed.length).toBe(0)
    expect(plan.items.length).toBeGreaterThan(0)
  })

  it('الإتقان الموثق يحذف الدورة مع سبب عربي ولا يكررها', () => {
    const tpl = compositeTemplates.find((t) => t.template_id === 'TPL-VENTURE-001')!
    const first = tpl.required_courses[0]
    const course = courseById.get(first.course_id)!
    // إتقان موثق لكل مهارات الدورة الأولى — يبيح حذفها وحدها
    const plan = buildCoursePlan(tpl, 'full', course.skill_slugs)
    expect(plan.removed.some((r) => r.courseId === first.course_id)).toBe(true)
    expect(plan.removed[0].reason_ar.length).toBeGreaterThan(0)
    expect(plan.items.some((i) => i.courseId === first.course_id)).toBe(false)
  })
})

describe('جسر مؤشر وجيز التمهيدي', () => {
  it('يحوّل إجابة m4 إلى حقيقة goal_clarity موثقة المصدر فقط — بلا اختراع', () => {
    const facts = mirrorAnswersToFacts({
      m1: 'مرة أو مرتين',
      m4: 'ضبابية — وهذا يقلقني أحيانا',
      m5: 'لا أعرف من أين أبدأ',
    })
    expect(facts['goal_clarity']?.value).toBe('low')
    expect(facts['goal_clarity']?.sourceQuestionId).toBe('TEASER-m4')
    expect(Object.keys(facts).length).toBe(1) // لا حقيقة بلا تطابق واضح
  })

  it('الحقيقة المزروعة تمنع إعادة سؤالها وتُوثق في أثر القرار', () => {
    // بدون بذر: الخريج يُسأل QB-M2-005 (مثبت بالاستكشاف)
    const plain = createEngine('mirror-1')
    expect(runScripted(plain, GRAD_INTERVIEWS as Record<string, string>)).toContain('QB-M2-005')

    // مع بذر المؤشر: لا يُسأل مجددا
    const seeded = createEngine('mirror-2')
    seeded.seedFacts(mirrorAnswersToFacts({ m4: 'واضحة ومكتوبة' }), 'مؤشر وجيز التمهيدي')
    const asked = runScripted(seeded, GRAD_INTERVIEWS as Record<string, string>)
    expect(asked).not.toContain('QB-M2-005')
    expect(seeded.getState().facts['goal_clarity']?.sourceQuestionId).toBe('TEASER-m4')
    expect(seeded.getState().trace.some((t) => t.kind === 'facts_seeded')).toBe(true)
  })
})

describe('صفحة النتيجة — بيانات العرض', () => {
  it('الخطة المركبة تحمل وسم «خطة مركبة مخصصة» وكل حقول العرض', () => {
    const { engine, recommendation } = runSession(FOUNDER_IDEA)
    expect(recommendation.kind).toBe('composite_template')
    const state = engine.getState()
    const result = recommendationToDiagResult(
      recommendation,
      state.skillVector,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    const composite = result.resultJson.composite as Record<string, unknown>
    expect(composite.label_ar).toBe('خطة مركبة مخصصة')
    expect(Array.isArray(composite.courses)).toBe(true)
    expect(Array.isArray(composite.removed_courses)).toBe(true)
    expect(Array.isArray(composite.represented_pathway_ids)).toBe(true)
    expect((composite.represented_pathway_ids as string[]).length).toBeGreaterThan(0)
    expect(typeof composite.capstone_ar).toBe('string')
    expect(typeof composite.success_metric_ar).toBe('string')
  })

  it('قوة الأدلة تُعرض بتقريب للأسفل — لا 79.6 تتحول 80', () => {
    const { engine, recommendation } = runSession(FOUNDER_IDEA)
    const state = engine.getState()
    const result = recommendationToDiagResult(
      recommendation,
      state.skillVector,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    expect(result.confidence).toBe(Math.floor(recommendation.confidence.total * 100))
  })

  it('مكونات ملاءمة المسار الأول الخمسة متاحة للعرض', () => {
    const { engine, recommendation } = runSession(FOUNDER_IDEA)
    const state = engine.getState()
    const result = recommendationToDiagResult(
      recommendation,
      state.skillVector,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    const fit = result.resultJson.primary_fit as Record<string, number>
    for (const k of ['persona', 'goal', 'skill_gap', 'feasibility', 'motivation', 'total']) {
      expect(typeof fit[k]).toBe('number')
    }
  })
})

describe('أثر القرار (decision_trace)', () => {
  it('كل سؤال مختار يوثق أفضل 3 بدائل ومكونات النفع وسبب الفوز', () => {
    const { engine } = runSession(FOUNDER_IDEA)
    const entries = engine.getState().trace.filter((t) => t.kind === 'question_selected')
    expect(entries.length).toBeGreaterThan(0)
    const first = entries.find((e) => e.data?.top3 !== undefined)!
    expect(Array.isArray(first.data?.top3)).toBe(true)
    expect((first.data?.top3 as unknown[]).length).toBeGreaterThan(0)
    expect(first.data?.utilityComponents).toBeDefined()
    expect(typeof first.data?.winnerReason_ar).toBe('string')
  })

  it('طبقة القوالب توثق التفعيل والمرشحين والمستبعدين بالمرشحات الصارمة', () => {
    const { engine } = runSession(FOUNDER_IDEA)
    const layer = engine.getState().trace.find((t) => t.kind === 'template_layer')
    expect(layer).toBeDefined()
    expect(layer?.data?.active).toBe(true)
    const excluded = layer?.data?.excludedByHardFilter as { templateId: string }[]
    expect(excluded.some((x) => x.templateId === 'TPL-FREELANCE-001')).toBe(true)
  })

  it('مطابقة المدرب موثقة في الأثر — unassigned بلا ملفات موثقة', () => {
    const { engine, recommendation } = runSession(FOUNDER_IDEA)
    expect(recommendation.trainer.status).toBe('unassigned')
    const tm = engine.getState().trace.find((t) => t.kind === 'trainer_match')
    expect(tm?.data?.status).toBe('unassigned')
  })
})

describe('مستودع الجلسات', () => {
  const memoryStorage = () => {
    const map = new Map<string, string>()
    return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
  }

  it('دورة حياة كاملة: إنشاء → إجابة → تعديل → قرار → إحالة', async () => {
    const repo = new LocalDiagnosticSessionRepository(memoryStorage())
    const s = await repo.createSession()
    expect(s.status).toBe('active')
    expect(s.marketingConsent).toBe(false) // الموافقة التسويقية منفصلة ولا تُفترض
    expect(s.catalogVersion.length).toBeGreaterThan(0)
    expect(s.rulesVersion.length).toBeGreaterThan(0)
    expect(s.decisionVersion.length).toBeGreaterThan(0)

    await repo.saveAnswer(s.sessionId, { questionId: 'QB-M1-001', value: 'موظف', optionIds: ['o2'] })
    await repo.reviseAnswer(s.sessionId, { questionId: 'QB-M1-001', value: 'طالب جامعة', optionIds: ['o1'] })
    const loaded = await repo.loadSession(s.sessionId)
    expect(loaded?.answers.length).toBe(1)
    expect(loaded?.answers[0].value).toBe('طالب جامعة')

    await repo.saveDecision(s.sessionId, { kind: 'single_pathway' })
    const decision = await repo.loadDecision(s.sessionId)
    expect(decision?.resultJson.kind).toBe('single_pathway')
    expect(decision?.decisionVersion.length).toBeGreaterThan(0)

    await repo.setMarketingConsent(s.sessionId, true)
    expect((await repo.loadSession(s.sessionId))?.marketingConsent).toBe(true)

    await repo.abandonSession(s.sessionId)
    expect((await repo.loadSession(s.sessionId))?.status).toBe('abandoned')
  })

  it('المستودع الخادمي بلا baseUrl معطل برسالة واضحة — الحفظ الخادمي مانع إنتاج', async () => {
    const { HttpDiagnosticSessionRepository } = await import('../../application/diagnostic/session-repository')
    const repo = new HttpDiagnosticSessionRepository(null)
    await expect(repo.createSession()).rejects.toThrow('غير موصول')
  })
})

describe('حارس المحرك القديم', () => {
  it('دوال المحرك v4 المحذوفة لا تُعاد — العقود وحدها تبقى', () => {
    const mod = diagContracts as Record<string, unknown>
    for (const gone of ['computeResult', 'rankPathways', 'nextQuestion', 'buildState', 'estimateTotal', 'scenarioLevels']) {
      expect(mod[gone]).toBeUndefined()
    }
    // العقود الحية باقية
    expect(mod['GOAL_LABELS']).toBeDefined()
    expect(mod['GAP_LABELS']).toBeDefined()
    expect(mod['OBSTACLE_TO_GAP']).toBeDefined()
  })
})
