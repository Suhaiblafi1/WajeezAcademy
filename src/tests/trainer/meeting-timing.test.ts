/* مواعيدُ المحاور من لقاءاتها — لا تُكتب مرّتين (١٧ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «خذ التوقيتَ من اللقاءات». فلا «يبدأ / وينتهي» لكلّ محور: المحورُ
   يُفتح بعد آخرِ لقاءٍ لما قبله، وتُسلَّم مهامُّه قبل أوّلِ لقاءٍ لما بعده. والقاعدةُ وعلّتُها
   في `src/application/trainer/axis-timeline.ts` (`slotsFromMeetings`).

   ① الاشتقاق: بدءُ كلّ محورٍ ونهايتُه، والجمعُ بأوّل لقاءٍ مشترك، ومحورٌ بلا لقاء، ويومٌ واحدٌ للقاءين.
   ② وما يُقرأ: المكتوبُ لما اعتُمد بمواعيد، والمشتقُّ لما عُلّم `timing` — في بوّابة المتعلّم أيضا.
   ③ وما يمنع الإرسال: محورٌ بلا لقاء، ولقاءٌ بلا محورٍ أو خارجَ المدّة، والترتيبُ، والحدُّ الأدنى.
   ④ وما يردّه الخادمُ لحظةَ الإضافة: لقاءٌ في غير ترتيب محاوره.
   ⑤ وقائمةُ التجهيز: لا مواعيدَ تُطلب في خطوة المحاور، والترتيبُ يمنع خطوةَ اللقاءات. */

import { describe, expect, it } from 'vitest'
import {
  MEETINGS_TIMING, meetingOrderProblem, meetingProblems, planSlots, slotsFromMeetings, timedByMeetings,
} from '@/application/trainer/axis-timeline'
import { periodBounds } from '@/application/trainer/cohort-period'
import { learnerGate } from '@/application/learning/cohort-gate'
import { buildChecklist } from '../../../server/services/cohort-plan.service'

const PERIOD = { startsOn: '2027-02-07', endsOn: '2027-03-06' }
const IDS = ['M1', 'M2', 'M3', 'M4']
/** الثامنةُ مساءً بعمّان (الخامسةُ بغرينتش) يومَ `day` — ساعتان */
const meet = (day: string, ...moduleIds: string[]) => ({ startsAt: `${day}T17:00:00.000Z`, endsAt: `${day}T19:00:00.000Z`, moduleIds })
/* لقاءٌ كلَّ اثنين: ٨ و١٥ و٢٢ فبراير و١ مارس */
const WEEKLY = [meet('2027-02-08', 'M1'), meet('2027-02-15', 'M2'), meet('2027-02-22', 'M3'), meet('2027-03-01', 'M4')]
const span = (s: { startsOn: string; endsOn: string; moduleIds: string[] }) => [s.startsOn, s.endsOn, s.moduleIds.join('+')]

describe('① الاشتقاق من اللقاءات', () => {
  it('⚠️ يفتح المحور بعد آخر لقاء لما قبله، وينتهي قبل أوّل لقاء لما بعده', () => {
    expect(slotsFromMeetings(IDS, WEEKLY, PERIOD).map(span)).toEqual([
      ['2027-02-07', '2027-02-14', 'M1'],
      ['2027-02-09', '2027-02-21', 'M2'],
      ['2027-02-16', '2027-02-28', 'M3'],
      ['2027-02-23', '2027-03-06', 'M4'],
    ])
  })

  it('⚠️ ومتجاوران يبدآن باللقاء نفسه موعد واحد', () => {
    const shared = [meet('2027-02-08', 'M1'), meet('2027-02-15', 'M2', 'M3'), meet('2027-03-01', 'M4')]
    expect(slotsFromMeetings(IDS, shared, PERIOD).map(span)).toEqual([
      ['2027-02-07', '2027-02-14', 'M1'],
      ['2027-02-09', '2027-02-28', 'M2+M3'],
      ['2027-02-16', '2027-03-06', 'M4'],
    ])
  })

  it('ومحور بلا لقاء يلحق بما قبله — وفي أوّلها بما بعده', () => {
    const noM3 = [meet('2027-02-08', 'M1'), meet('2027-02-15', 'M2'), meet('2027-03-01', 'M4')]
    expect(slotsFromMeetings(IDS, noM3, PERIOD).map((s) => s.moduleIds.join('+'))).toEqual(['M1', 'M2+M3', 'M4'])
    const noM1 = [meet('2027-02-15', 'M2'), meet('2027-02-22', 'M3'), meet('2027-03-01', 'M4')]
    expect(slotsFromMeetings(IDS, noM1, PERIOD).map((s) => s.moduleIds.join('+'))).toEqual(['M1+M2', 'M3', 'M4'])
  })

  it('⚠️ ولقاءان في يوم واحد: لا يفتح المحور بعد لقائه، ولا ينتهي ما قبله قبل لقائه', () => {
    const sameDay = [
      { startsAt: '2027-02-08T08:00:00.000Z', endsAt: '2027-02-08T10:00:00.000Z', moduleIds: ['M1'] },
      meet('2027-02-08', 'M2'), meet('2027-02-22', 'M3'), meet('2027-03-01', 'M4'),
    ]
    const [g1, g2] = slotsFromMeetings(IDS, sameDay, PERIOD)
    expect(g1.endsOn, 'انتهى المحور الأوّل قبل لقائه').toBe('2027-02-08')
    expect(g2.startsOn, 'فتح المحور الثاني بعد لقائه').toBe('2027-02-08')
  })

  it('وبلا لقاءات لا مواعيد', () => {
    expect(slotsFromMeetings(IDS, [], PERIOD)).toEqual([])
  })
})

describe('② ما يُقرأ', () => {
  const stored = [{ startsOn: '2027-02-07', endsOn: '2027-02-20', moduleIds: IDS }]

  it('⚠️ ما اعتُمد بمواعيد يبقى عليها — والمعلَّمة تشتقّ وتترك المكتوب', () => {
    const modules = IDS.map((moduleId) => ({ moduleId }))
    expect(planSlots({ slots: stored, modules }, WEEKLY, PERIOD)).toEqual(stored)
    expect(timedByMeetings({ timing: MEETINGS_TIMING })).toBe(true)
    expect(planSlots({ slots: stored, modules, timing: MEETINGS_TIMING }, WEEKLY, PERIOD).map(span)[1])
      .toEqual(['2027-02-09', '2027-02-21', 'M2'])
  })

  it('⚠️ وبوّابة المتعلّم تفتح المحور وتسلّمه بالمشتقّ', () => {
    const gate = learnerGate({
      content: { kind: 'trainer', timing: MEETINGS_TIMING, ...PERIOD, modules: IDS.map((moduleId) => ({ moduleId })), resources: [] },
      cohort: {}, sessions: WEEKLY, now: new Date('2027-02-10T00:00:00.000Z'),
    })
    expect(gate.timeline, 'لا خطّ للخطّة المعلّمة').not.toBeNull()
    expect(gate.timeline!.theoryOpensAt('M2')?.toISOString()).toBe(periodBounds({ startsOn: '2027-02-09', endsOn: '2027-02-09' }).from.toISOString())
    expect(gate.timeline!.defaultDueAt('M1')?.toISOString()).toBe(periodBounds({ startsOn: '2027-02-14', endsOn: '2027-02-14' }).to.toISOString())
  })
})

describe('③ ما يمنع الإرسال', () => {
  const check = (sessions: ReturnType<typeof meet>[], ids = IDS) =>
    meetingProblems({ moduleIds: ids, sessions, period: PERIOD }).blocking

  it('لقاءات بترتيب المحاور لا يمنعها شيء', () => {
    expect(check(WEEKLY)).toEqual([])
  })

  it('⚠️ أوّل لقاء لمحور قبل آخر لقاء لما قبله — يسمّي الاثنين', () => {
    const swapped = [meet('2027-02-08', 'M1'), meet('2027-02-22', 'M2'), meet('2027-02-15', 'M3'), meet('2027-03-01', 'M4')]
    expect(check(swapped).join(' | ')).toContain('أوّل لقاء في المحور 3 قبل آخر لقاء في المحور 2')
  })

  it('⚠️ ومحور بلا لقاء، ولقاء بلا محور، ولقاء خارج المدّة', () => {
    const out = check([meet('2027-02-08', 'M1'), meet('2027-02-15', 'M2'), meet('2027-02-22'), meet('2027-04-01', 'M3')])
    expect(out.join(' | ')).toContain('بلا لقاء مباشر: المحور 4')
    expect(out.join(' | ')).toContain('غير مربوط بمحور')
    expect(out.join(' | ')).toContain('خارج مدّة الشعبة')
  })

  it('⚠️ وأربعة مواعيد على الأقلّ — فلا يجمع لقاء أوّل محورين في دورة من أربعة', () => {
    const merged = [meet('2027-02-08', 'M1', 'M2'), meet('2027-02-22', 'M3'), meet('2027-03-01', 'M4')]
    expect(check(merged).join(' | ')).toContain('لكلّ محور أوّل لقاء خاصّ به')
    const six = ['A', 'B', 'C', 'D', 'E', 'F']
    const three = [meet('2027-02-08', 'A', 'B'), meet('2027-02-15', 'C', 'D'), meet('2027-02-22', 'E', 'F')]
    expect(check(three, six).join(' | ')).toContain('أقلّ ما تقسم عليه الدورة 4 مواعيد')
  })

  it('والجلسة المسجّلة بمحورها ويوم فتحها داخل المدّة', () => {
    const out = meetingProblems({
      moduleIds: IDS, sessions: WEEKLY, period: PERIOD,
      recordings: [{ title: 'بلا محور', moduleId: null, opensAt: null }, { title: 'بعد المدّة', moduleId: 'M1', opensAt: '2027-04-01T08:00:00.000Z' }],
    }).blocking.join(' | ')
    expect(out).toContain('«بلا محور» بلا محور')
    expect(out).toContain('«بعد المدّة» تفتح خارج مدّة الشعبة')
  })
})

describe('④ ما يردّه الخادم لحظة الإضافة', () => {
  const others = [meet('2027-02-08', 'M1'), meet('2027-02-22', 'M3')]

  it('⚠️ قبل لقاء لمحور سابق، أو بعد لقاء لمحور لاحق', () => {
    expect(meetingOrderProblem(IDS, others, meet('2027-02-05', 'M2'))).toContain('قبل لقاء في المحور 1')
    expect(meetingOrderProblem(IDS, others, meet('2027-02-25', 'M2'))).toContain('بعد لقاء في المحور 3')
  })

  it('وبين جاريه يقبل', () => {
    expect(meetingOrderProblem(IDS, others, meet('2027-02-15', 'M2'))).toBeNull()
  })
})

describe('⑤ قائمة التجهيز', () => {
  const content = {
    kind: 'trainer' as const, timing: MEETINGS_TIMING, ...PERIOD,
    modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `محور ${i}`, activityAr: 'تطبيق عمليّ قصير' })),
    resources: [{ title: 'مرجع', url: 'https://x.test/a' }],
  }
  const rows = (sessions: ReturnType<typeof meet>[]) => buildChecklist({
    cohort: { title: 'شعبة' }, period: PERIOD, content: content as never,
    sessions: sessions.map((s) => ({ ...s, recordings: [] })),
    assessmentsCount: 0, planStatus: 'draft', now: new Date('2027-01-01T00:00:00.000Z'),
  })
  const row = (sessions: ReturnType<typeof meet>[], key: string) => rows(sessions).find((c) => c.key === key)!

  it('⚠️ خطوة المحاور تتمّ بلا مواعيد مكتوبة', () => {
    expect(row(WEEKLY, 'modules').done, 'طلبت مواعيد للمحاور').toBe(true)
  })

  it('⚠️ وخطوة اللقاءات تتمّ بترتيبها — ويمنعها ما خالفه', () => {
    expect(row(WEEKLY, 'sessions').done).toBe(true)
    const swapped = [meet('2027-02-08', 'M1'), meet('2027-02-22', 'M2'), meet('2027-02-15', 'M3'), meet('2027-03-01', 'M4')]
    const s = row(swapped, 'sessions')
    expect(s.done, 'مرّ ترتيب مخالف').toBe(false)
    expect(s.labelAr).toContain('بترتيب المحاور')
  })
})
