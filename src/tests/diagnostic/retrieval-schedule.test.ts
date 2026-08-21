import { describe, expect, it } from 'vitest'
import {
  DAY_MS, MAX_STEP, SPACING_DAYS,
  buildRetrievalSummary, buildReviewQueue, dueCards, nextDueAt, nextDueCard, nextStep, spacingLabelAr,
  type RetrievalCard,
} from '../../application/student/retrieval-schedule'
import { parseChecks } from '../../application/content/module-checks'

const NOW = new Date('2026-08-21T12:00:00.000Z')
const card = (over: Partial<RetrievalCard> = {}): RetrievalCard => ({
  moduleId: 'C-X-101-M1', checkIndex: 0, skillSlug: null, step: 0,
  dueAt: NOW.toISOString(), lastCorrect: null, correctCount: 0, wrongCount: 0, ...over,
})

describe('ح-٤ سلّم التباعد', () => {
  it('السلّم متباعد تصاعديا ولا يتراجع', () => {
    for (let i = 1; i < SPACING_DAYS.length; i++) expect(SPACING_DAYS[i]).toBeGreaterThan(SPACING_DAYS[i - 1])
  })

  it('الصحيح يتقدم خطوة واحدة ويتوقف عند القمة', () => {
    expect(nextStep(0, true)).toBe(1)
    expect(nextStep(3, true)).toBe(4)
    expect(nextStep(MAX_STEP, true)).toBe(MAX_STEP)
  })

  it('الخطأ يعيد إلى أول السلّم من أي موضع — بلا عقوبة أخرى', () => {
    expect(nextStep(0, false)).toBe(0)
    expect(nextStep(MAX_STEP, false)).toBe(0)
  })

  it('الموعد يُحسب من وقت مُمرَّر لا من ساعة النظام', () => {
    expect(nextDueAt(0, NOW).getTime() - NOW.getTime()).toBe(1 * DAY_MS)
    expect(nextDueAt(MAX_STEP, NOW).getTime() - NOW.getTime()).toBe(SPACING_DAYS[MAX_STEP] * DAY_MS)
  })

  it('الخطوة الخارجة عن السلّم تُقصّ ولا ترمي', () => {
    expect(nextDueAt(99, NOW).getTime()).toBe(nextDueAt(MAX_STEP, NOW).getTime())
    expect(nextDueAt(-5, NOW).getTime()).toBe(nextDueAt(0, NOW).getTime())
  })

  it('المدة تُقرأ بالعربية لا «بعد 1 يوم»', () => {
    expect(spacingLabelAr(0)).toBe('يوم')
    expect(spacingLabelAr(2)).toBe('أسبوع')
    expect(spacingLabelAr(MAX_STEP)).toBe('شهرين')
  })
})

describe('ح-٤ الاستحقاق — لا تقديم ولا اختلاق', () => {
  it('ما لم يحن موعده لا يظهر مستحقا', () => {
    const soon = new Date(NOW.getTime() + DAY_MS).toISOString()
    expect(dueCards([card({ dueAt: soon })], NOW)).toHaveLength(0)
  })

  it('المستحق يُرتَّب بالأقدم موعدا أولا', () => {
    const a = card({ checkIndex: 1, dueAt: new Date(NOW.getTime() - 5 * DAY_MS).toISOString() })
    const b = card({ checkIndex: 2, dueAt: new Date(NOW.getTime() - DAY_MS).toISOString() })
    expect(dueCards([b, a], NOW).map((c) => c.checkIndex)).toEqual([1, 2])
  })

  it('التاريخ المعطوب يُهمَل ولا يُعدّ مستحقا', () => {
    expect(dueCards([card({ dueAt: 'ليس تاريخا' })], NOW)).toHaveLength(0)
  })

  it('التالي هو أقرب غير مستحق — وnull إن استُحق الكل', () => {
    const future = card({ checkIndex: 9, dueAt: new Date(NOW.getTime() + 3 * DAY_MS).toISOString() })
    expect(nextDueCard([card(), future], NOW)?.checkIndex).toBe(9)
    expect(nextDueCard([card()], NOW)).toBeNull()
  })
})

describe('ح-٤ الملخص — بلا نقاط ولا سلاسل', () => {
  it('يعدّ المستحق والثابت والمُعاد، ولا يخترع مقياس إتقان', () => {
    const s = buildRetrievalSummary(
      [
        card({ checkIndex: 0 }),
        card({ checkIndex: 1, step: MAX_STEP, dueAt: new Date(NOW.getTime() + 10 * DAY_MS).toISOString() }),
        card({ checkIndex: 2, step: 0, wrongCount: 2 }),
      ],
      NOW,
    )
    expect(s.total).toBe(3)
    expect(s.due).toBe(2)
    expect(s.settled).toBe(1)
    expect(s.restarted).toBe(1)
    expect(s.nextDueAt).not.toBeNull()
    /* لا حقل نقاط ولا سلسلة أيام في الملخص أصلا */
    expect(Object.keys(s).sort()).toEqual(['due', 'nextDueAt', 'restarted', 'settled', 'total'])
  })

  it('بلا بطاقات: أصفار وnull لا أرقام مصطنعة', () => {
    const s = buildRetrievalSummary([], NOW)
    expect(s).toEqual({ total: 0, due: 0, nextDueAt: null, settled: 0, restarted: 0 })
  })
})

describe('ح-٤ طابور المراجعة', () => {
  const text = new Map([
    ['C-X-101-M1#0', { promptAr: 'سؤال؟', options: ['أ', 'ب'], correctIndex: 1, explainAr: 'لأن ب', moduleTitleAr: 'وحدة', courseTitleAr: 'دورة' }],
  ])

  it('يعلن المدّتين قبل الجواب: لو أصاب ولو أخطأ', () => {
    const q = buildReviewQueue([card({ step: 1 })], text, {})
    expect(q).toHaveLength(1)
    expect(q[0].nextIfCorrectAr).toBe(spacingLabelAr(2))
    expect(q[0].nextIfWrongAr).toBe(spacingLabelAr(0))
  })

  it('بطاقة حُذف سؤالها من الإصدار تُسقط ولا يُختلق لها بديل', () => {
    expect(buildReviewQueue([card({ checkIndex: 7 })], text, {})).toHaveLength(0)
  })

  it('اسم المهارة يُعرض إن رُبطت، وnull بلا ربط', () => {
    const bound = buildReviewQueue([card({ skillSlug: 'ai_workflow_design' })], text, { ai_workflow_design: 'تصميم سير عمل' })
    expect(bound[0].skillNameAr).toBe('تصميم سير عمل')
    expect(buildReviewQueue([card()], text, {})[0].skillNameAr).toBeNull()
  })
})

describe('ح-٤ ربط السؤال بمهارة في صيغة التمرين', () => {
  it('«م: slug» يُقرأ ولا يفسد بقية السؤال', () => {
    const r = parseChecks(['س: سؤال؟', 'م: ai_workflow_design', '- أ', '+ ب', 'ش: شرح'].join('\n'))
    expect(r.errorsAr).toHaveLength(0)
    expect(r.checks[0].skillSlug).toBe('ai_workflow_design')
    expect(r.checks[0].correctIndex).toBe(1)
    expect(r.checks[0].explainAr).toBe('شرح')
  })

  it('سؤال بلا ربط يبقى skillSlug=null لا شريحة مختلقة', () => {
    const r = parseChecks(['س: سؤال؟', '- أ', '+ ب'].join('\n'))
    expect(r.checks[0].skillSlug).toBeNull()
  })

  it('ربط قبل أي سؤال خطأ مقروء', () => {
    expect(parseChecks('م: ai_workflow_design').errorsAr[0]).toContain('قبل أي سؤال')
  })
})
