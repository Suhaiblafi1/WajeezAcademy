import { describe, expect, it } from 'vitest'
import {
  KIND_LABEL_AR, NO_STREAK_NOTE, WINDOW_DAYS,
  buildMomentum, momentumFactsFrom, sinceLabelAr,
  type EvidenceEvent, type EvidenceKind,
} from '../../application/student/momentum'

const NOW = new Date('2026-08-21T12:00:00.000Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
const ev = (kind: EvidenceKind, days: number): EvidenceEvent => ({ kind, at: ago(days), labelAr: 'أثر' })

describe('ط-٥ الزخم — لا تلعيب', () => {
  it('لا حقل سلسلة ولا نقاط ولا ترتيب في المخرج', () => {
    const m = buildMomentum({ events: [ev('module', 1)], cohortPace: null }, NOW)
    const keys = Object.keys(m).sort()
    expect(keys).toEqual(['cohortPace', 'counted', 'countedTotal', 'daysSince', 'hasEvidence', 'last', 'recent', 'windowDays'])
    for (const forbidden of ['streak', 'points', 'score', 'rank', 'badge', 'level', 'goal']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('النصّ المعلن يشرح سبب غياب السلسلة — القاعدة مكتوبة للمتعلم لا للكود', () => {
    expect(NO_STREAK_NOTE).toContain('لا سلسلة أيام')
    expect(NO_STREAK_NOTE).toContain('للانسحاب')
  })

  it('كل أنواع الأثر معنونة بالعربية', () => {
    for (const [, label] of Object.entries(KIND_LABEL_AR)) expect(label.length).toBeGreaterThan(3)
  })
})

describe('ط-٥ الحساب', () => {
  it('بلا آثار: hasEvidence=false وdaysSince=null ولا أرقام مصطنعة', () => {
    const m = buildMomentum({ events: [], cohortPace: null }, NOW)
    expect(m.hasEvidence).toBe(false)
    expect(m.last).toBeNull()
    expect(m.daysSince).toBeNull()
    expect(m.countedTotal).toBe(0)
    expect(Object.values(m.counted).every((v) => v === 0)).toBe(true)
  })

  it('آخر أثر هو الأحدث، والأيام منذه محسوبة كاملة', () => {
    const m = buildMomentum({ events: [ev('module', 12), ev('session', 3), ev('retrieval', 30)], cohortPace: null }, NOW)
    expect(m.last!.kind).toBe('session')
    expect(m.daysSince).toBe(3)
  })

  it('النافذة ثلاثون يوما: ما خرج منها لا يُحتسب ولا يُخفى آخر أثر', () => {
    const m = buildMomentum({ events: [ev('module', WINDOW_DAYS + 5)], cohortPace: null }, NOW)
    expect(m.hasEvidence).toBe(true)
    expect(m.last).not.toBeNull()
    expect(m.countedTotal).toBe(0)
    expect(m.daysSince).toBe(WINDOW_DAYS + 5)
  })

  it('الأثر المستقبلي يُهمَل — جلسة لم تُعقد ليست أثرا', () => {
    const future = new Date(NOW.getTime() + 5 * DAY).toISOString()
    const m = buildMomentum({ events: [{ kind: 'session', at: future, labelAr: 'جلسة قادمة' }], cohortPace: null }, NOW)
    expect(m.hasEvidence).toBe(false)
  })

  it('التاريخ المعطوب يُطرح ولا يرمي', () => {
    const m = buildMomentum({ events: [{ kind: 'module', at: 'ليس تاريخا', labelAr: 'x' }, ev('module', 2)], cohortPace: null }, NOW)
    expect(m.countedTotal).toBe(1)
  })

  it('العدّ بالنوع، والأحدث ثلاثة فقط تُعرض', () => {
    const m = buildMomentum({
      events: [ev('retrieval', 1), ev('retrieval', 2), ev('module', 3), ev('session', 4), ev('submission', 5)],
      cohortPace: null,
    }, NOW)
    expect(m.counted.retrieval).toBe(2)
    expect(m.counted.scenario).toBe(0)
    expect(m.countedTotal).toBe(5)
    expect(m.recent).toHaveLength(3)
  })

  it('إيقاع الشعبة يُمرَّر كما هو — هدف وضعته الشعبة لا نحن', () => {
    const pace = { cohortTitle: 'شعبة', done: 5, total: 8 }
    expect(buildMomentum({ events: [], cohortPace: pace }, NOW).cohortPace).toEqual(pace)
  })
})

describe('ط-٥ نصّ المدة', () => {
  it('يقول واقعة بلا حكم', () => {
    expect(sinceLabelAr(null)).toBe('لا أثر مسجَّل بعد')
    expect(sinceLabelAr(0)).toBe('اليوم')
    expect(sinceLabelAr(1)).toBe('أمس')
    expect(sinceLabelAr(2)).toBe('قبل يومين')
    expect(sinceLabelAr(5)).toBe('قبل 5 أيام')
    expect(sinceLabelAr(40)).toBe('قبل 40 يوما')
  })
})

describe('ط-٥ استخراج الآثار من ردود الخادم', () => {
  const detail = {
    cohort: {
      title: 'شعبة الأتمتة',
      sessions: [
        { id: 's1', title: 'الجلسة الأولى', startsAt: ago(9), status: 'done' },
        { id: 's2', title: 'الجلسة الثانية', startsAt: ago(2), status: 'done' },
        { id: 's3', title: 'الجلسة الثالثة', startsAt: ago(-5), status: 'scheduled' },
      ],
    },
    /* الحضور سُجّل اليوم لجلسة قبل تسعة أيام — الأثر بتاريخ الجلسة لا بتاريخ التسجيل */
    attendance: [
      { sessionId: 's1', status: 'present', createdAt: ago(0) },
      { sessionId: 's2', status: 'absent', createdAt: ago(0) },
    ],
    moduleProgress: [
      { moduleId: 'C-X-M1', status: 'completed', completedAt: ago(4) },
      { moduleId: 'C-X-M2', status: 'in_progress', completedAt: null },
    ],
    submissions: [
      { status: 'accepted', submittedAt: ago(6), assessment: { title: 'خريطة عملية' } },
      { status: 'submitted', submittedAt: ago(1), assessment: { title: 'واجب معلّق' } },
    ],
    certificates: [{ status: 'active', issuedAt: ago(20) }],
  }

  it('يحتسب الأدلة فقط: حضور فعلي ووحدة مُقرّة وتسليم مقبول وشهادة', () => {
    const facts = momentumFactsFrom([detail])
    const kinds = facts.events.map((e) => e.kind).sort()
    expect(kinds).toEqual(['certificate', 'module', 'session', 'submission'])
    /* الغياب لا يُحتسب أثرا، والتسليم غير المقبول لا يُحتسب، والوحدة قيد التقدم لا */
    expect(facts.events).toHaveLength(4)
  })

  it('الحضور يؤرَّخ بجلسته لا بلحظة تسجيله', () => {
    const facts = momentumFactsFrom([detail])
    const session = facts.events.find((e) => e.kind === 'session')!
    expect(session.at).toBe(ago(9))
    expect(session.labelAr).toContain('الجلسة الأولى')
  })

  it('إيقاع الشعبة من جلساتها المنتهية — لا من نسبة مئوية مشتقة', () => {
    expect(momentumFactsFrom([detail]).cohortPace).toEqual({ cohortTitle: 'شعبة الأتمتة', done: 2, total: 3 })
  })

  it('يضم آثار الاسترجاع والسيناريو والقياس البعديّ', () => {
    const facts = momentumFactsFrom([detail], {
      retrievalCards: [{ lastAnswerAt: ago(1) }, { lastAnswerAt: null }],
      scenarioRuns: [{ endedAt: ago(2) }, { endedAt: null }],
      remeasures: [{ measuredAt: ago(3) }],
    })
    const m = buildMomentum(facts, NOW)
    expect(m.counted.retrieval).toBe(1)
    expect(m.counted.scenario).toBe(1)
    expect(m.counted.remeasure).toBe(1)
  })

  it('جلسة قياس واحدة لأربع مهارات أثر واحد لا أربعة', () => {
    const at = ago(3)
    const facts = momentumFactsFrom([], {
      remeasures: [
        { measuredAt: at, courseId: 'C-1' }, { measuredAt: at, courseId: 'C-1' },
        { measuredAt: at, courseId: 'C-1' }, { measuredAt: at, courseId: 'C-1' },
        /* دورة أخرى في اللحظة نفسها أثر مستقل */
        { measuredAt: at, courseId: 'C-2' },
      ],
    })
    expect(buildMomentum(facts, NOW).counted.remeasure).toBe(2)
  })

  it('إيقاع الشعبة الجارية يُقدَّم على المنتهية — «٤ من ٤» في شعبة أُغلقت تاريخ لا إيقاع', () => {
    const finished = {
      cohort: { title: 'شعبة منتهية', sessions: [
        { id: 'a', startsAt: ago(20), status: 'done' },
        { id: 'b', startsAt: ago(13), status: 'done' },
      ] },
    }
    const ongoing = {
      cohort: { title: 'شعبة جارية', sessions: [
        { id: 'c', startsAt: ago(7), status: 'done' },
        { id: 'd', startsAt: ago(-7), status: 'scheduled' },
      ] },
    }
    expect(momentumFactsFrom([finished, ongoing]).cohortPace)
      .toEqual({ cohortTitle: 'شعبة جارية', done: 1, total: 2 })
    /* وبلا شعبة جارية يُعرض ما هو موجود لا فراغ */
    expect(momentumFactsFrom([finished]).cohortPace)
      .toEqual({ cohortTitle: 'شعبة منتهية', done: 2, total: 2 })
  })

  it('تسجيل بلا شعبة ولا آثار لا يرمي ولا يخترع إيقاعا', () => {
    const facts = momentumFactsFrom([{}])
    expect(facts.events).toHaveLength(0)
    expect(facts.cohortPace).toBeNull()
  })
})
