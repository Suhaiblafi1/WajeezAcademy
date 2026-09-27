/* ما يُفتح للمتعلّم يُقال له حين يُفتح — القاعدةُ المحضة (٢(ب-٣)).

   ثلاثةُ أخبار من الخطّ نفسِه (`timeline-events.ts`): فُتح موعد، وفُتحت
   مهامُّ محور، وآخرُ موعد مهمّةٍ خلال يوم. وأثرُها في الدورة الحقيقيّة — من
   يصله الخبرُ ومرّةً واحدة — في `server/tests/worker/notify-timeline.test.ts`. */

import { describe, expect, it } from 'vitest'
import { learnerGate } from '@/application/learning/cohort-gate'
import { DUE_SOON_MS, TIMELINE_LOOKBACK_MS, timelineEvents, type TimelineAssessment } from '@/application/learning/timeline-events'

const content = {
  kind: 'trainer', startsOn: '2027-02-07', endsOn: '2027-03-13',
  modules: ['M1', 'M2', 'M3', 'M4'].map((moduleId) => ({ moduleId, titleAr: moduleId })),
  slots: [
    { startsOn: '2027-02-07', endsOn: '2027-02-13', moduleIds: ['M1'] },
    { startsOn: '2027-02-14', endsOn: '2027-02-20', moduleIds: ['M2'] },
    { startsOn: '2027-02-21', endsOn: '2027-02-27', moduleIds: ['M3'] },
    { startsOn: '2027-02-28', endsOn: '2027-03-13', moduleIds: ['M4'] },
  ],
}
/* لقاءُ الثاني ينتهي الإثنين ١٥ فبراير ٢٠:٠٠ بعمّان — والرابعُ بلا لقاء */
const sessions = [
  { startsAt: '2027-02-08T15:00:00.000Z', endsAt: '2027-02-08T17:00:00.000Z', moduleIds: ['M1'] },
  { startsAt: '2027-02-15T15:00:00.000Z', endsAt: '2027-02-15T17:00:00.000Z', moduleIds: ['M2'] },
  { startsAt: '2027-02-22T15:00:00.000Z', endsAt: '2027-02-22T17:00:00.000Z', moduleIds: ['M3'] },
]
const tasks: TimelineAssessment[] = [
  { id: 'a2', title: 'مهمّةُ الثاني', moduleId: 'M2', dueAt: new Date('2027-02-20T20:59:59.999Z') },
  { id: 'a3', title: 'مهمّةُ الثالث', moduleId: 'M3', dueAt: new Date('2027-02-27T20:59:59.999Z') },
  { id: 'a4', title: 'مهمّةُ الرابع', moduleId: 'M4', dueAt: null },
  { id: 'loose', title: 'بلا محور', moduleId: null, dueAt: new Date('2027-02-16T12:00:00.000Z') },
]
const at = (iso: string, over: { content?: unknown } = {}) => {
  const now = new Date(iso)
  const gate = learnerGate({ content: over.content ?? content, cohort: {}, sessions, now })
  return timelineEvents({ cohortId: 'c1', gate, assessments: tasks, now })
}
const kinds = (list: ReturnType<typeof at>) => list.map((e) => `${e.kind}:${'moduleIds' in e ? e.moduleIds.join('+') : 'moduleId' in e ? e.moduleId : e.assessmentId}`)

describe('فُتح موعد', () => {
  it('⚠️ يُقال حين يُفتح الموعد — منتصفَ ليل يومه الأوّل بعمّان', () => {
    /* الأحد ١٤ فبراير يبدأ ٢١:٠٠ بغرينتش يومَ ١٣ */
    expect(kinds(at('2027-02-13T20:59:00.000Z'))).not.toContain('slot_opened:M2')
    expect(kinds(at('2027-02-13T21:00:00.000Z'))).toContain('slot_opened:M2')
  })

  it('⚠️ ولا يُحيا خبرٌ قديم — ما فُتح قبل يومٍ لا يُقال اليوم', () => {
    const opened = new Date('2027-02-13T21:00:00.000Z').getTime()
    expect(kinds(at(new Date(opened + TIMELINE_LOOKBACK_MS - 1).toISOString()))).toContain('slot_opened:M2')
    expect(kinds(at(new Date(opened + TIMELINE_LOOKBACK_MS).toISOString()))).not.toContain('slot_opened:M2')
  })

  it('ومفتاحُه ثابتٌ بموعده — فالدورةُ لا تُكرّره', () => {
    const ev = at('2027-02-14T01:00:00.000Z').find((e) => e.kind === 'slot_opened')!
    expect(ev.dedupe).toBe('c1:slot:2027-02-14')
  })
})

describe('فُتحت مهامُّ محور', () => {
  it('⚠️ حين ينتهي أوّلُ لقاءٍ للمحور — لا حين يُفتح الموعد', () => {
    expect(kinds(at('2027-02-15T16:59:00.000Z'))).not.toContain('tasks_opened:M2')
    const after = at('2027-02-15T17:00:00.000Z')
    expect(kinds(after)).toContain('tasks_opened:M2')
    expect(after.find((e) => e.kind === 'tasks_opened')).toMatchObject({ assessmentIds: ['a2'], dedupe: 'c1:tasks:M2' })
  })

  it('⚠️ ومحورٌ بلا لقاءٍ تُفتح مهامُّه مع موعده — فيُقال الخبران معا', () => {
    const list = kinds(at('2027-02-27T21:00:00.000Z'))
    expect(list).toContain('slot_opened:M4')
    expect(list).toContain('tasks_opened:M4')
  })

  it('ومحورٌ لا مهمّةَ عليه لا خبرَ مهامٍّ له', () => {
    expect(kinds(at('2027-02-08T17:30:00.000Z'))).not.toContain('tasks_opened:M1')
  })
})

describe('آخرُ موعدٍ خلال يوم', () => {
  it('⚠️ لمهمّةٍ مفتوحةٍ آخرُ موعدها خلال يوم — لا قبله ولا بعد فواته', () => {
    const due = new Date('2027-02-20T20:59:59.999Z').getTime()
    expect(kinds(at(new Date(due - DUE_SOON_MS - 1).toISOString()))).not.toContain('due_soon:a2')
    expect(kinds(at(new Date(due - DUE_SOON_MS).toISOString()))).toContain('due_soon:a2')
    expect(kinds(at(new Date(due).toISOString()))).not.toContain('due_soon:a2')
  })

  it('⚠️ ومهمّةٌ لم تُفتح بعد لا يُقال عنها «غدا» — يُقال حين تُفتح', () => {
    /* موعدٌ مبكّرٌ على مهمّة الثالث ولقاؤه لم ينعقد */
    const early: TimelineAssessment[] = [{ id: 'a3', title: 'x', moduleId: 'M3', dueAt: new Date('2027-02-22T12:00:00.000Z') }]
    const now = new Date('2027-02-22T00:00:00.000Z')
    const gate = learnerGate({ content, cohort: {}, sessions, now })
    expect(timelineEvents({ cohortId: 'c1', gate, assessments: early, now }).map((e) => e.kind)).not.toContain('due_soon')
  })

  it('وما لا محورَ له يُذكَّر به كذلك — مفتوحٌ للشعبة كلِّها', () => {
    expect(kinds(at('2027-02-16T00:00:00.000Z'))).toContain('due_soon:loose')
  })
})

describe('ولا أخبارَ خطٍّ لما لا خطَّ له', () => {
  it('⚠️ ما اعتُمد بلا مواعيدَ يمضي كما بدأ', () => {
    expect(at('2027-02-15T17:00:00.000Z', { content: { ...content, slots: [] } })).toEqual([])
  })

  it('⚠️ وبعد انتهاء الشعبة لا «فُتح» ولا «غدا» — وإن وقع موعدُ مهمّةٍ بعدها بساعات', () => {
    /* آخرُ موعدٍ بعد انتهاء الشعبة باثنتي عشرةَ ساعة: لولا حالُ الوصول لقيل «غدا»
       عن تسليمٍ لم يعد يُقبل */
    const now = new Date('2027-03-14T00:00:00.000Z')
    const gate = learnerGate({ content, cohort: {}, sessions, now })
    const late: TimelineAssessment[] = [{ id: 'after', title: 'بعد الانتهاء', moduleId: null, dueAt: new Date('2027-03-14T12:00:00.000Z') }]
    expect(timelineEvents({ cohortId: 'c1', gate, assessments: late, now })).toEqual([])
  })
})
