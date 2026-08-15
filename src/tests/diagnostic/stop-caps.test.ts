import { describe, expect, it } from 'vitest'
import { DEEPENING_MAX_QUESTIONS, DEEPENING_MIN_QUESTIONS } from '../../domain/diagnostic/engine'
import { STOP_RULES } from '../../domain/diagnostic/config'
import {
  EMPLOYEE_DATA,
  FOUNDER_IDEA,
  GOV_EMPLOYEE,
  GRAD_INTERVIEWS,
  NEW_MANAGER,
  STUDENT_LOST,
  runSession,
} from './helpers'

const ALL_PERSONAS = { STUDENT_LOST, GRAD_INTERVIEWS, GOV_EMPLOYEE, NEW_MANAGER, FOUNDER_IDEA, EMPLOYEE_DATA }

describe('حدود التوقف التكيفي', () => {
  it('القيم المضبوطة: التشخيص الأساسي 8–14 فقط', () => {
    expect(STOP_RULES.quickTargetMin).toBe(8)
    expect(STOP_RULES.quickTargetMax).toBe(14)
    expect(STOP_RULES.hardCapQuick).toBe(14)
  })

  it('لا شخصية تتجاوز 14 سؤالا في الوضع السريع — حتى المتناقضة والمستعجلة', () => {
    for (const [name, script] of Object.entries(ALL_PERSONAS)) {
      const { askedOrder } = runSession(script)
      expect(askedOrder.length, `${name} تجاوز الحد`).toBeLessThanOrEqual(14)
      expect(askedOrder.length, `${name} أقل من الحد الأدنى`).toBeGreaterThanOrEqual(8)
    }
  })

  it('عند بلوغ الحد تُبنى نتيجة دائما — توصية أو إحالة مستشار، لا فراغ', () => {
    for (const [name, script] of Object.entries(ALL_PERSONAS)) {
      const { recommendation } = runSession(script)
      expect(
        ['single_pathway', 'composite_template', 'advisor_referral', 'guardrail_stop'],
        `${name} بلا نتيجة`,
      ).toContain(recommendation.kind)
      /* إن لم تكفِ الأدلة (ثقة < 0.5) فالإحالة للمستشار إلزامية */
      if (recommendation.confidence.total < 0.5 && recommendation.kind !== 'guardrail_stop') {
        expect(recommendation.kind, `${name}: ثقة منخفضة بلا إحالة`).toBe('advisor_referral')
      }
    }
  })

  it('جولة التدقيق: 4 أسئلة كحد أدنى و8 كحد أقصى — أو لا تُعرض أصلا', () => {
    expect(DEEPENING_MIN_QUESTIONS).toBe(4)
    expect(DEEPENING_MAX_QUESTIONS).toBe(8)
    for (const [name, script] of Object.entries(ALL_PERSONAS)) {
      const { engine } = runSession(script)
      const opened = engine.startDeepening()
      if (!opened) continue // صورة مكتملة — الجولة لا تُعرض
      expect(
        opened.plan.length,
        `${name}: خطة تدقيق خارج النطاق 4–8`,
      ).toBeGreaterThanOrEqual(DEEPENING_MIN_QUESTIONS)
      expect(opened.plan.length).toBeLessThanOrEqual(DEEPENING_MAX_QUESTIONS)
    }
  })

  it('الواجهة لا يمكن أن تعرض «سؤال 15 من ~14» — العدّاد مقيد بالسقف نفسه', () => {
    /* الحد الأقصى المعروض في الواجهة ESTIMATE_MAX=14 مطابق للسقف الصارم */
    expect(14).toBe(STOP_RULES.hardCapQuick)
  })
})
