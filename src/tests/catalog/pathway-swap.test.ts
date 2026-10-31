/* استبدالُ دورةٍ في المسار الجاهز — وأوّلُها التي تتعارض (٣١ أكتوبر ٢٠٢٦).

   القاعدةُ في `application/catalog/pathway-swap.ts`. وهنا ما يُحرس:
   · الدورةُ العالقةُ: شعبتُها تتعارض ولا شعبةَ لها لا تتعارض — ولا عالقةَ إن كان لها موعدٌ آخر.
   · والبدائلُ: خارج المسار، ولها شعبةٌ في فصله، وما لا يتعارض أوّلا بشعبته التي لا تتعارض.
   · وأنّ صفحةَ المسار تمنح الاستبدالَ للمسار الجاهز لا للخطّة المعتمَدة وحدَها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { chosenCohorts, restoredSwaps, stuckInClash, swapCandidates, type SwapCohortOption } from '@/application/catalog/pathway-swap'

const WINTER = '2026-nov_jan'
/** شعبةٌ بلقاءاتٍ أسبوعيّة — يومُ البدء وساعةُ اللقاء بتوقيت عمّان (+3) */
const cohort = (id: string, startDay: string, hour: number | null, weeks = 3): SwapCohortOption => ({
  id,
  startsAt: `${startDay}T00:00:00+03:00`,
  sessions: hour === null ? [] : Array.from({ length: weeks }, (_, w) => {
    const d = new Date(`${startDay}T${String(hour).padStart(2, '0')}:00:00+03:00`)
    d.setUTCDate(d.getUTCDate() + 7 * w)
    return { startsAt: d.toISOString(), endsAt: new Date(d.getTime() + 2 * 3_600_000).toISOString() }
  }),
})

const COHORTS: Record<string, SwapCohortOption[]> = {
  A: [cohort('a1', '2026-12-01', 18)],
  /* «ب» على ساعة «أ» نفسِها، ولا شعبةَ لها غيرُها — عالقة */
  B: [cohort('b1', '2026-12-01', 18)],
  /* «ج» على ساعة «أ»، ولها موعدٌ آخر — ليست عالقة */
  C: [cohort('c1', '2026-12-01', 18), cohort('c2', '2026-12-01', 20)],
  /* البدائل */
  X: [cohort('x1', '2026-12-01', 18), cohort('x2', '2026-12-03', 18)],
  Y: [cohort('y1', '2026-12-01', 18)],
  Z: [cohort('z1', '2026-12-05', null)],
  /* في الربيع وحدَه — خارج فصل المسار */
  S: [cohort('s1', '2027-03-01', 10)],
  /* لا شعبةَ لها */
  N: [],
}
const cohortsOf = (id: string) => COHORTS[id] ?? []
const titleOf = (id: string) => `دورة ${id}`
const ranked = ['S', 'N', 'Y', 'Z', 'X', 'A'].map((courseId) => ({ courseId, reason_ar: 'قريبة' }))

describe('الدورةُ العالقةُ في تعارض', () => {
  const chosen = chosenCohorts(['A', 'B', 'C'], cohortsOf, {}, titleOf)

  it('⚠️ شعبتُها تتعارض ولا موعدَ آخرَ لها — عالقة', () => {
    expect(stuckInClash('B', chosen, cohortsOf)).toBe(true)
  })

  it('⚠️ ولها موعدٌ آخرُ لا يتعارض — ليست عالقة: تبدّل شعبتَها لا الدورة', () => {
    expect(stuckInClash('C', chosen, cohortsOf)).toBe(false)
  })

  it('ولا تعارضَ — ليست عالقة', () => {
    const calm = chosenCohorts(['A', 'C'], cohortsOf, { C: 'c2' }, titleOf)
    expect(stuckInClash('A', calm, cohortsOf)).toBe(false)
  })
})

describe('بدائلُ الدورة', () => {
  const swap = (courseId: string, season: string | null = WINTER) =>
    swapCandidates({ courseId, courseIds: ['A', 'B'], ranked, cohortsOf, picked: {}, titleOf, season })

  it('⚠️ ما لا يتعارض أوّلا، بشعبته التي لا تتعارض — ثمّ ما لم يُعلن جدولُه، ثمّ ما يتعارض بسببه', () => {
    const out = swap('B')
    expect(out.map((c) => [c.courseId, c.fit, c.cohortId])).toEqual([
      ['X', 'free', 'x2'],
      ['Z', 'unknown', 'z1'],
      ['Y', 'clash', 'y1'],
    ])
    expect(out[2].noteAr).toContain('«دورة A»')
  })

  it('⚠️ لا دورةَ من المسار، ولا ما لا شعبةَ له، ولا ما شعبتُه خارج فصل المسار', () => {
    const ids = swap('B').map((c) => c.courseId)
    expect(ids).not.toContain('A')
    expect(ids).not.toContain('N')
    expect(ids).not.toContain('S')
  })

  it('والمسارُ الذي لا يسمّي فصلا يقبل كلَّ فصل', () => {
    expect(swap('B', null).map((c) => c.courseId)).toContain('S')
  })

  it('وأربعةٌ على الأكثر', () => {
    const many = Array.from({ length: 9 }, (_, i) => `M${i}`)
    for (const id of many) COHORTS[id] = [cohort(`${id}1`, '2026-12-02', 10)]
    const out = swapCandidates({
      courseId: 'B', courseIds: ['A', 'B'], ranked: many.map((courseId) => ({ courseId, reason_ar: 'قريبة' })),
      cohortsOf, picked: {}, titleOf, season: WINTER,
    })
    expect(out).toHaveLength(4)
  })
})

describe('صفحةُ المسار', () => {
  const src = readFileSync(new URL('../../pages/Pathway.tsx', import.meta.url), 'utf8')

  it('⚠️ المسارُ الجاهزُ يُستبدل فيه — لا «edit» للخطّة المعتمَدة وحدَها', () => {
    expect(src).toMatch(/swapOnly: true,\s*\n\s*swapForId,\s*\n\s*pool: swapChoices\.map/)
  })

  it('والبديلةُ على شعبتها التي لا تتعارض', () => {
    expect(src).toMatch(/setPickedCohorts\(\(prev\) => \(\{ \.\.\.prev, \[newId\]: cohortId \}\)\)/)
  })
})

/* ═══ ومن خرج قبل الدفع وعاد يجد ما استبدله (٣١ أكتوبر ٢٠٢٦) ═══ */
describe('العائدُ إلى المسار', () => {
  it('⚠️ يجد دوراته بعد الاستبدال، والإضافةُ الواحدةُ آخرُها', () => {
    expect(restoredSwaps(['A', 'X', 'C', 'D'], 4)).toEqual({ base: ['A', 'X', 'C', 'D'], extra: null })
    expect(restoredSwaps(['A', 'X', 'C', 'D', 'E'], 4)).toEqual({ base: ['A', 'X', 'C', 'D'], extra: 'E' })
  })

  it('وما لا يطابق عددَ المسار لا يُستعاد — ولا المكرَّر، ولا مسارٌ لم يُعرف بعد', () => {
    expect(restoredSwaps(['A', 'B'], 4)).toBeNull()
    expect(restoredSwaps(['A', 'B', 'C', 'D', 'E', 'F'], 4)).toBeNull()
    expect(restoredSwaps(['A', 'A', 'C', 'D'], 4)).toBeNull()
    expect(restoredSwaps(['A'], 0)).toBeNull()
  })

  const page = readFileSync(new URL('../../pages/Pathway.tsx', import.meta.url), 'utf8')
  it('⚠️ والصفحةُ تستعيدها من الشراء المحفوظ، والخطّةُ تُرفع بما في اللوح', () => {
    expect(page).toMatch(/restoredSwaps\(resumed\.intent\.courseIds, readyPathwayCourseIds\(pathway\.id\)\.length\)/)
    expect(page).toMatch(/edits\?\.courseIds \?\? custom\?\.chosenIds \?\? restored\?\.base \?\?/)
    expect(page).toMatch(/extraPicked === undefined \? restored\?\.extra \?\? null : extraPicked/)
    expect(page).toMatch(/courseIds: intent\.courseIds \?\? courseIds,/)
  })
})
