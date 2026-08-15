import { describe, expect, it } from 'vitest'
import { DEEPENING_MAX_QUESTIONS } from '../../domain/diagnostic/engine'
import { GOV_EMPLOYEE, STUDENT_LOST, runSession, type Script } from './helpers'

/** يشغل جلسة كاملة ثم جولة تدقيق كاملة ويعيد كل شيء */
function runWithDeepening(script: Script) {
  const { engine, recommendation: before, askedOrder } = runSession(script)
  const opened = engine.startDeepening()
  const deepAsked: string[] = []
  const deepReasons: (string | null)[] = []
  if (opened) {
    for (let i = 0; i < DEEPENING_MAX_QUESTIONS + 3; i++) {
      const next = engine.nextQuestion()
      if (!next.question) break
      deepAsked.push(next.question.question_id)
      deepReasons.push(engine.deepeningStatus()?.currentReason_ar ?? null)
      const q = next.question
      const scripted = script[q.question_id]
      const value =
        scripted !== undefined
          ? scripted
          : q.options_ar.length > 0
            ? q.answer_type === 'multi_choice' || q.answer_type === 'rank_top3'
              ? [q.options_ar[0]]
              : q.options_ar[0]
            : 'لا ينطبق'
      engine.answer({ questionId: q.question_id, value })
    }
  }
  const finished = opened ? engine.finishDeepening() : null
  return { engine, before, askedOrder, opened, deepAsked, deepReasons, finished }
}

describe('جولة تدقيق الخطة (التعميق)', () => {
  it('تُفتح الجولة بسبب عربي واضح وخطة لا تتجاوز السقف', () => {
    const { opened } = runWithDeepening(STUDENT_LOST)
    expect(opened).not.toBeNull()
    expect(opened!.reason_ar.length).toBeGreaterThan(10)
    expect(opened!.plan.length).toBeLessThanOrEqual(DEEPENING_MAX_QUESTIONS)
    expect(opened!.plan.length).toBeGreaterThan(0)
  })

  it('كل سؤال في الخطة يستهدف منطقة عدم يقين معروفة وله سبب يُعرض للمستخدم', () => {
    const { opened } = runWithDeepening(GOV_EMPLOYEE)
    const KNOWN = new Set(['tie', 'weak_skill', 'missing_constraint', 'goal_unclear', 'contradiction', 'coverage'])
    for (const item of opened!.plan) {
      expect(item.targets.length).toBeGreaterThan(0)
      for (const t of item.targets) expect(KNOWN.has(t)).toBe(true)
      expect(item.reason_ar.length).toBeGreaterThan(10)
    }
  })

  it('لا سؤال يتكرر: لا مع الجولة الأولى ولا داخل جولة التدقيق', () => {
    const { askedOrder, deepAsked } = runWithDeepening(STUDENT_LOST)
    const all = [...askedOrder, ...deepAsked]
    expect(new Set(all).size).toBe(all.length)
  })

  it('سقف الجولة 8 أسئلة مهما كانت الحالة', () => {
    const { deepAsked } = runWithDeepening(GOV_EMPLOYEE)
    expect(deepAsked.length).toBeLessThanOrEqual(DEEPENING_MAX_QUESTIONS)
  })

  it('كل سؤال معروض أثناء الجولة يحمل سببا يفسر لماذا سُئل', () => {
    const { deepAsked, deepReasons } = runWithDeepening(STUDENT_LOST)
    expect(deepReasons.length).toBe(deepAsked.length)
    for (const r of deepReasons) expect(r && r.length > 10).toBe(true)
  })

  it('الختام يوثق المقارنة قبل/بعد برسالة التغيير أو الثبات ويحدث أثر القرار', () => {
    const { finished, engine } = runWithDeepening(GOV_EMPLOYEE)
    expect(finished).not.toBeNull()
    const cmp = finished!.comparison
    const expected = cmp.changed
      ? 'ظهرت معلومات إضافية جعلت هذا الاختيار أكثر ملاءمة.'
      : 'دعمت إجاباتك الإضافية التوصية الحالية.'
    expect(cmp.note_ar).toBe(expected)
    expect(cmp.reasons_ar.length).toBeGreaterThan(0)
    expect(cmp.before.topId).toBeTruthy()
    expect(cmp.after.topId).toBeTruthy()
    const traceKinds = engine.getState().trace.map((t) => t.kind)
    expect(traceKinds).toContain('deepening_started')
    expect(traceKinds).toContain('deepening_completed')
  })

  it('الحتمية: نفس الإجابات تعطي نفس خطة التدقيق ونفس المقارنة', () => {
    const a = runWithDeepening(FOUNDER_SCRIPT)
    const b = runWithDeepening(FOUNDER_SCRIPT)
    expect(a.opened!.plan.map((p) => p.questionId)).toEqual(b.opened!.plan.map((p) => p.questionId))
    expect(a.finished!.comparison.changed).toBe(b.finished!.comparison.changed)
    expect(a.finished!.comparison.after.topId).toBe(b.finished!.comparison.after.topId)
  })

  it('لا جولة ثانية بعد الختم — startDeepening يعيد null', () => {
    const { engine } = runWithDeepening(STUDENT_LOST)
    expect(engine.startDeepening()).toBeNull()
  })

  it('جولة بلا أسئلة نافعة لا تُفتح أصلا', () => {
    // جلسة كاملة عميقة قد لا يتبقى فيها شيء نافع — إن فُتحت فيجب أن تسأل شيئا حقا
    const { engine } = runSession(GOV_EMPLOYEE, 'deep')
    const opened = engine.startDeepening()
    if (opened) {
      const next = engine.nextQuestion()
      expect(next.question).not.toBeNull()
    }
  })
})

/* سيناريو إضافي لاختبار الحتمية */
const FOUNDER_SCRIPT: Script = {
  'QB-M0-001': 'أنا المتعلم',
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M0-006': 'نعم',
  'QB-M0-008': 'لا',
  'QB-M1-001': 'رائد أعمال/مستقل',
  'QB-M1-003': 'صاحب مشروع',
  'QB-M2-001': 'مشروع أو دخل',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'حاسمة',
  'QB-M3C-001': 'عندي فكرة ولم أبدأ بعد',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}
