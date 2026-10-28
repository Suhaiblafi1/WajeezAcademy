/* مواعيدُ بلا تعارض — القاعدةُ والحلّ (`application/terms/schedule-clash.ts`، ٢٢ أكتوبر ٢٠٢٦).

   يحرس: أيُّ دورتين لا تتعارضان (المسارُ، أو الفئةُ بمستوى قريب)، وأنّ الحلّ ينقل أقلَّ ما يمكن — يبقى ما فيه
   طلبةٌ وما ثُبّت، وينتقل ما يتعارض مع أكثر — وأنّ ما رفضه المدرّبُ لا يُقترح ثانية. والبناءُ هنا مصنوعٌ يضع
   اللقاءَ على اليوم والساعة في أسبوعه بتوقيت عمّان، فالفحصُ على الحلّ لا على بانيه. */

import { describe, expect, it } from 'vitest'
import {
  candidateSlots, clashWhyAr, findClashes, hourSlots, levelRank, linkWhyAr, mainSlot, nearbyAt, nearbyOnDay, nearbySpanAr, nearbyWarnAr, planClashFree,
  rejectedScope, slotAr, weekdaysOf, withRejectReason, type NearbyTime,
  SCHEDULE_REJECT_REASONS, type BuildSchedule, type ClashCohort, type ClashCourse, type WeeklySlot,
} from '@/application/terms/schedule-clash'
import { clashBellBodyAr, clashBellTitleAr, clashMailAr, scheduleMovedBodyAr } from '@/application/terms/clash-message'
import { zonedAt, zonedDay } from '@/application/trainer/cohort-period'

const course = (courseId: string, o: Partial<ClashCourse> = {}): ClashCourse => ({
  courseId, titleAr: `دورة ${courseId}`, levelAr: 'تطبيقي', pathways: [], audiences: ['موظفون ومختصون'], ...o,
})

const HOUR = 3_600_000
/** لقاءاتٌ أسبوعيّةٌ من يومٍ بساعته بتوقيت عمّان */
const weekly = (first: string, clock: string, n = 4, minutes = 120) =>
  Array.from({ length: n }, (_, i) => {
    const at = zonedAt(first, clock).getTime() + i * 7 * 24 * HOUR
    return { startsAt: at, endsAt: at + minutes * 60_000 }
  })

const cohort = (cohortId: string, courseId: string, sessions: ClashCohort['sessions'], o: Partial<ClashCohort> = {}): ClashCohort => ({
  cohortId, title: `شعبة ${cohortId}`, courseId, trainerIds: [`t-${cohortId}`], learners: 0, sessions, fixedAr: null, ...o,
})

/** بانٍ مصنوع: كلُّ لقاءٍ إلى اليوم والساعة في أسبوعه (الأحد أوّلُه) */
function fakeBuild(cohorts: readonly ClashCohort[]): BuildSchedule<WeeklySlot> & { calls: { id: string; slot: WeeklySlot; why: string }[] } {
  const calls: { id: string; slot: WeeklySlot; why: string }[] = []
  const fn: BuildSchedule<WeeklySlot> = (id, slot, why) => {
    calls.push({ id, slot, why })
    const c = cohorts.find((x) => x.cohortId === id)!
    const sessions = c.sessions.map((s) => {
      const day = zonedDay(new Date(s.startsAt))
      const wd = new Date(`${day}T12:00:00Z`).getUTCDay()
      /* وساعةٌ في أيّامها نفسِها (`days`): اليومُ يبقى */
      const target = slot.days ? day : new Date(Date.parse(`${day}T12:00:00Z`) + (slot.weekday - wd) * 24 * HOUR).toISOString().slice(0, 10)
      const at = zonedAt(target, slot.clock).getTime()
      return { startsAt: at, endsAt: at + (s.endsAt - s.startsAt) }
    })
    return { ok: true as const, sessions, payload: slot }
  }
  return Object.assign(fn, { calls })
}

describe('أيّ دورتين لا تتعارضان', () => {
  it('المسار العامّ نفسه يربطهما — ولو اختلفت فئتاهما ومستواهما', () => {
    const a = course('A', { levelAr: 'تأسيسي', audiences: ['أفراد ومهن ناشئة'], pathways: [{ id: 'PP-CAR', titleAr: 'انطلاقتك المهنية' }] })
    const b = course('B', { levelAr: 'ممارس', audiences: ['قيادة وريادة الأعمال'], pathways: [{ id: 'PP-CAR', titleAr: 'انطلاقتك المهنية' }] })
    expect(linkWhyAr(a, b)).toBe('في مسار «انطلاقتك المهنية» نفسه')
  })

  it('والفئة نفسها بمستوى واحد أو متجاور تربطهما — وبمستوى بعيد لا', () => {
    expect(linkWhyAr(course('A', { levelAr: 'تأسيسي–تطبيقي' }), course('B', { levelAr: 'تطبيقي' })))
      .toBe('للفئة نفسها (موظفون ومختصون) وبمستوى قريب')
    expect(linkWhyAr(course('A', { levelAr: 'تأسيسي' }), course('B', { levelAr: 'تطبيقي' }))).toBeNull()
    expect(linkWhyAr(course('A', { levelAr: 'تأسيسي' }), course('B', { levelAr: 'ممارس' }))).toBeNull()
  })

  it('وفئتان مختلفتان بلا مسار مشترك لا تتعارضان — فلا يحمرّ التقويم كلّه', () => {
    expect(linkWhyAr(course('A'), course('B', { audiences: ['أفراد ومهن ناشئة'] }))).toBeNull()
  })

  it('وشعبتان من الدورة نفسها بديلان لا دورتان', () => {
    expect(linkWhyAr(course('A'), course('A'))).toBeNull()
  })

  it('والمستوى يقرأ بأيّ شرطة، والمجهول قريب من كلّ مستوى', () => {
    expect(levelRank('تأسيسي–تطبيقي')).toBe(1)
    expect(levelRank('تأسيسي - تطبيقي')).toBe(1)
    expect(levelRank('ممارس')).toBe(3)
    expect(linkWhyAr(course('A', { levelAr: null }), course('B', { levelAr: 'ممارس' }))).not.toBeNull()
  })
})

describe('التعارضات القائمة', () => {
  const courses = new Map([course('A'), course('B'), course('C', { audiences: ['أفراد ومهن ناشئة'] })].map((c) => [c.courseId, c]))

  it('دورتان مربوطتان تتداخل لقاءاتهما تعارض — بعدد ما تداخل', () => {
    const pairs = findClashes([cohort('1', 'A', weekly('2026-12-06', '19:00')), cohort('2', 'B', weekly('2026-12-06', '20:00'))], courses)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.count).toBe(4)
  })

  it('ولا تعارض بين غير المربوطتين، ولا بين شعبتي الدورة نفسها', () => {
    expect(findClashes([cohort('1', 'A', weekly('2026-12-06', '19:00')), cohort('2', 'C', weekly('2026-12-06', '19:00'))], courses)).toEqual([])
    expect(findClashes([cohort('1', 'A', weekly('2026-12-06', '19:00')), cohort('2', 'A', weekly('2026-12-06', '19:00'))], courses)).toEqual([])
  })

  it('واللقاءان المتتاليان بلا تداخل ليسا تعارضا', () => {
    expect(findClashes([cohort('1', 'A', weekly('2026-12-06', '17:00')), cohort('2', 'B', weekly('2026-12-06', '19:00'))], courses)).toEqual([])
  })
})

describe('الحلّ: أقلّ ما يمكن من تغيير', () => {
  const courses = new Map([course('A'), course('B'), course('C'), course('D')].map((c) => [c.courseId, c]))

  it('ما فيه طلبة يبقى، والآخر ينتقل إلى أقرب موعد لا يتعارض — في اليوم نفسه', () => {
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00')),
      cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 5 }),
    ]
    const build = fakeBuild(cohorts)
    const p = planClashFree({ cohorts, courses, build })
    const moved = p.rows.find((r) => r.cohortId === '1')!
    const kept = p.rows.find((r) => r.cohortId === '2')!
    expect(kept.action).toBe('keep')
    expect(moved.action).toBe('move')
    if (moved.action !== 'move') return
    expect(moved.to.weekday).toBe(0)
    expect(moved.to.clock).toBe('17:00')
    expect(build.calls[0]!.why).toContain('«دورة B»')
    /* وبعد النقل لا يبقى تعارض */
    const r = build('1', moved.to, '')
    if (!r.ok) throw new Error(r.reasonAr)
    expect(findClashes(cohorts.map((c) => (c.cohortId === '1' ? { ...c, sessions: r.sessions } : c)), courses)).toEqual([])
  })

  it('والشعبة التي تتعارض مع ثلاث هي التي تنتقل — نقلة واحدة لا ثلاث', () => {
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00')),
      cohort('2', 'B', weekly('2026-12-07', '19:00')),
      cohort('3', 'C', weekly('2026-12-08', '19:00')),
      /* لقاءٌ في كلّ أسبوع على يومٍ من أيّام الثلاث — فيقع على كلٍّ منها مرّة.
         ومعرّفُها آخرُ وأوّلُ لقاءاتها آخر — فلا يختارها للنقل شيءٌ قبل غيرها إلّا كثرةُ تعارضها */
      cohort('9', 'D', [...weekly('2026-12-13', '19:00', 1), ...weekly('2026-12-21', '19:00', 1), ...weekly('2026-12-29', '19:00', 1)]),
    ]
    const p = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) })
    expect(p.before).toHaveLength(3)
    expect(p.rows.filter((r) => r.action === 'move').map((r) => r.cohortId)).toEqual(['9'])
  })

  it('⚠️ وما اختير فلم يجد موعدا يبقى — وتنتقل التي تتعارض معه بدله', () => {
    /* «لا يوجد إيميلات سوى واحد.. أين الباقي؟» (٢٨ أكتوبر ٢٠٢٦): كانت الأكثرُ تعارضا تعلق وتعلق معها تعارضاتُها كلُّها */
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00')),
      cohort('2', 'B', weekly('2026-12-07', '19:00')),
      cohort('3', 'C', weekly('2026-12-08', '19:00')),
      cohort('9', 'D', [...weekly('2026-12-13', '19:00', 1), ...weekly('2026-12-21', '19:00', 1), ...weekly('2026-12-29', '19:00', 1)]),
    ]
    const ok = fakeBuild(cohorts)
    const build: BuildSchedule<WeeklySlot> = (id, slot, why) => (id === '9' ? { ok: false, reasonAr: 'لا يصلح' } : ok(id, slot, why))
    const rows = planClashFree({ cohorts, courses, build }).rows
    expect(rows.filter((r) => r.action === 'move').map((r) => r.cohortId)).toEqual(['1', '2', '3'])
    expect(rows.find((r) => r.cohortId === '9')!.action).toBe('keep')
  })

  it('والثابت لا ينتقل — يقال سببه، وينتقل غيره', () => {
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00'), { fixedAr: 'ثبتت الإدارة موعدها' }),
      cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 9 }),
    ]
    const p = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) })
    expect(p.rows.find((r) => r.cohortId === '1')!.action).toBe('keep')
    expect(p.rows.find((r) => r.cohortId === '2')!.action).toBe('move')
  })

  it('وثابتان يتعارضان يبقيان كلاهما — والتعارض يقال بسببه لا يحلّ بنقل ما ثبت', () => {
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00'), { fixedAr: 'بدأت لقاءاتها' }),
      cohort('2', 'B', weekly('2026-12-06', '19:00'), { fixedAr: 'ثبتت الإدارة موعدها' }),
    ]
    const p = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) })
    expect(p.rows.some((r) => r.action === 'move')).toBe(false)
    const stuck = p.rows.find((r) => r.action === 'stuck')
    expect(stuck && stuck.action === 'stuck' ? stuck.whyAr : null).toBe('ثبتت الإدارة موعدها')
  })

  it('واقتراح لم يقرر فيه يوضع على ما يقترحه — فلا يقترح غيره فوقه', () => {
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00'), { proposed: weekly('2026-12-08', '19:00') }),
      cohort('2', 'B', weekly('2026-12-08', '19:00')),
    ]
    const p = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) })
    expect(p.rows.find((r) => r.cohortId === '1')!.action).toBe('keep')
    expect(p.rows.find((r) => r.cohortId === '2')!.action).toBe('move')
  })

  it('وما رفضه المدرب لا يقترح ثانية — يومه كلّه إن قال اليوم', () => {
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00'), { rejected: [{ weekday: 0, clock: '17:00', scope: 'day' }] }),
      cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 5 }),
    ]
    const p = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) })
    const moved = p.rows.find((r) => r.cohortId === '1')!
    expect(moved.action).toBe('move')
    if (moved.action === 'move') expect(moved.to.weekday).not.toBe(0)
  })

  it('⚠️ وما يلتقي أكثر من مرّة في الأسبوع لا يضغط إلى يوم واحد — أيامه نفسها بساعة أخرى، وما فيه طلبة يبقى', () => {
    /* «لماذا ثلاث فقط وهي ثلاثون تعارضا؟» (٢٧ أكتوبر ٢٠٢٦): كان يعلق كلّه — واختار صاحب المنصّة «a» */
    const cohorts = [
      cohort('1', 'A', [...weekly('2026-12-06', '19:00'), ...weekly('2026-12-08', '19:00')]),
      cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 3 }),
    ]
    const build = fakeBuild(cohorts)
    const rows = planClashFree({ cohorts, courses, build }).rows
    const moved = rows.find((r) => r.cohortId === '1')!
    expect(rows.find((r) => r.cohortId === '2')!.action).toBe('keep')
    expect(moved.action).toBe('move')
    if (moved.action !== 'move') return
    expect(moved.to.days, 'ضغط إلى يوم واحد').toEqual([0, 2])
    expect(moved.to.clock).toBe('17:00')
    expect([slotAr(moved.from), slotAr(moved.to)]).toEqual(['الأحد والثلاثاء 19:00', 'الأحد والثلاثاء 17:00'])
  })

  it('⚠️ وشعبتان كلتاهما أكثر من مرّة في الأسبوع — تنتقل واحدة بساعتها، لا تعلقان', () => {
    const twice = (a: string, b: string) => [...weekly(a, '19:00'), ...weekly(b, '19:00')]
    const cohorts = [cohort('1', 'A', twice('2026-12-06', '2026-12-08')), cohort('2', 'B', twice('2026-12-06', '2026-12-09'))]
    const rows = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) }).rows
    expect(rows.filter((r) => r.action === 'stuck')).toEqual([])
    const moves = rows.filter((r) => r.action === 'move')
    expect(moves).toHaveLength(1)
    if (moves[0]!.action === 'move') expect(moves[0]!.to.days).toEqual(moves[0]!.cohortId === '1' ? [0, 2] : [0, 3])
  })

  it('وإن تساوتا فالتي تلتقي مرّة في الأسبوع تنتقل — يتغيّر فيها أقلّ', () => {
    const cohorts = [
      cohort('1', 'A', [...weekly('2026-12-06', '19:00'), ...weekly('2026-12-08', '19:00')]),
      cohort('2', 'B', weekly('2026-12-06', '19:00')),
    ]
    const rows = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) }).rows
    expect(rows.filter((r) => r.action === 'move').map((r) => r.cohortId)).toEqual(['2'])
  })

  it('⚠️ ونقلة واحدة تحلّ اثنتين خير من نقلتين — لا نقلة زائدة', () => {
    /* ٢ و٣ تلتقيان الأحد والاثنين، و١ تقع على أحدهما ثمّ على الآخر. واختيارُ الأقلّ طلبةً يبدأ بـ١،
       ثمّ لا يحلّ ٢–٤ و٣–٥ إلّا نقلُ ٢ و٣ — فيصير نقلُ ١ زائدا: لا يبقى له تعارضٌ حين يوضع */
    const cohorts = [
      cohort('1', 'A', [...weekly('2026-12-06', '19:00', 1), ...weekly('2026-12-14', '19:00', 1)]),
      cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 1 }),
      cohort('3', 'C', weekly('2026-12-07', '19:00'), { learners: 1 }),
      cohort('4', 'D', weekly('2026-12-13', '20:00', 3), { learners: 5 }),
      cohort('5', 'A', weekly('2026-12-21', '20:00', 2), { learners: 5 }),
    ]
    const p = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) })
    expect(p.before.map((x) => `${x.a}-${x.b}`).sort()).toEqual(['1-2', '1-3', '2-4', '3-5'])
    expect(p.rows.filter((r) => r.action === 'move').map((r) => r.cohortId)).toEqual(['2', '3'])
  })

  it('⚠️ ولا يطلب من مدرّب واحد أن ينقل شعبه — تغيير منه وآخر من غيره', () => {
    /* م مدرّبُ ١ و٣، و١ تتعارض مع ٢، و٣ مع ٤ — كلّها بلا طلبة. بالترتيب وحدَه ينتقل ١ و٣ كلاهما لمدرّبٍ واحد */
    const cohorts = [
      cohort('1', 'A', weekly('2026-12-06', '19:00'), { trainerIds: ['م'] }),
      cohort('2', 'B', weekly('2026-12-06', '19:00')),
      cohort('3', 'C', weekly('2026-12-08', '19:00'), { trainerIds: ['م'] }),
      cohort('4', 'D', weekly('2026-12-08', '19:00')),
    ]
    const moves = planClashFree({ cohorts, courses, build: fakeBuild(cohorts) }).rows.filter((r) => r.action === 'move').map((r) => r.cohortId)
    expect(moves).toEqual(['1', '4'])
  })

  it('⚠️ وإن صلحت مواعيد وتعارضت كلّها لا يقال سبب آخر ما لم يصلح', () => {
    /* كان يقال «لا الجمعة في موعد» — وهو سببُ أبعد موعدٍ جُرّب، لا سببُ العلوق */
    const cohorts = [cohort('1', 'A', weekly('2026-12-06', '19:00')), cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 1 })]
    const same: BuildSchedule<WeeklySlot> = (id, slot) => slot.weekday === 5
      ? { ok: false, reasonAr: 'لا الجمعة في موعد' }
      : { ok: true, sessions: cohorts.find((c) => c.cohortId === id)!.sessions, payload: slot }
    const row = planClashFree({ cohorts, courses, build: same }).rows.find((r) => r.cohortId === '1')!
    expect(row.action).toBe('stuck')
    if (row.action === 'stuck') expect(row.whyAr).toBe('لا موعد بلا تعارض يصلح لها')
  })

  it('وما لا يبنى له جدول يقال بسببه ولا يسقط صامتا', () => {
    const cohorts = [cohort('1', 'A', weekly('2026-12-06', '19:00')), cohort('2', 'B', weekly('2026-12-06', '19:00'), { learners: 1 })]
    const p = planClashFree({ cohorts, courses, build: () => ({ ok: false, reasonAr: 'لا يصلح' }) })
    const row = p.rows.find((r) => r.cohortId === '1')!
    expect(row.action).toBe('stuck')
    if (row.action === 'stuck') expect(row.whyAr).toContain('لا يصلح')
  })
})

describe('المواعيد المرشّحة', () => {
  it('لا ساعات عمل، ولا ما يمسّ صلاة الجمعة — والأقرب أوّلا', () => {
    const slots = candidateSlots({ weekday: 0, clock: '19:00' }, 120)
    expect(slots.some((s) => s.weekday === 1 && s.clock < '17:00')).toBe(false)
    expect(slots.some((s) => s.weekday === 5 && s.clock === '12:00')).toBe(false)
    expect(slots[0]).toEqual({ weekday: 0, clock: '19:00' })
    expect(slots[1]!.weekday).toBe(0)
  })

  it('والساعة المرفوضة تسقط من كلّ يوم', () => {
    const slots = candidateSlots({ weekday: 0, clock: '19:00' }, 120, [{ weekday: 0, clock: '19:00', scope: 'hour' }])
    expect(slots.some((s) => s.clock === '19:00')).toBe(false)
  })

  it('وفي أيامها نفسها: الساعات الأقرب، وما يصلح في كلّ يوم منها — والمرفوض يسقط', () => {
    const slots = hourSlots({ weekday: 1, clock: '19:00' }, [1, 3], 120, [{ weekday: 1, clock: '19:30', days: [1, 3], scope: 'slot' }])
    expect(slots.slice(0, 4).map((s) => s.clock)).toEqual(['19:00', '18:30', '18:00', '20:00'])
    expect(slots.some((s) => s.clock === '19:30'), 'اقترح ما رفضه').toBe(false)
    expect(slots.every((s) => s.clock >= '17:00' && s.clock <= '20:30')).toBe(true)
    expect(slots.every((s) => s.days?.join() === '1,3')).toBe(true)
    /* ومن رفض أيامها لا ساعة تحلّه — الأيام لا تتغيّر */
    expect(hourSlots({ weekday: 1, clock: '19:00' }, [1, 3], 120, [{ weekday: 1, clock: '19:00', days: [1, 3], scope: 'day' }])).toEqual([])
    expect(weekdaysOf([...weekly('2026-12-09', '19:00', 2), ...weekly('2026-12-07', '19:00', 2)])).toEqual([1, 3])
  })

  it('والموعد الغالب أكثر لقاءاتها تكرارا', () => {
    expect(mainSlot([...weekly('2026-12-08', '18:00', 3), ...weekly('2026-12-06', '20:00', 1)])).toEqual({ weekday: 2, clock: '18:00' })
  })
})

describe('سبب الرفض بنقرة', () => {
  it('اليوم أو الساعة أوّل السطر، وما كتبه بعده يبقى', () => {
    const day = SCHEDULE_REJECT_REASONS[0].labelAr
    const hour = SCHEDULE_REJECT_REASONS[1].labelAr
    expect(rejectedScope(`${day} — عندي عمل`)).toBe('day')
    expect(rejectedScope(hour)).toBe('hour')
    expect(rejectedScope('سبب آخر')).toBe('slot')
    expect(rejectedScope(null)).toBe('slot')
    expect(withRejectReason(`${day} — عندي عمل`, hour)).toBe(`${hour} — عندي عمل`)
    expect(withRejectReason('', day)).toBe(day)
  })
})

describe('رسالة المدرب', () => {
  const m = { cohortTitle: 'شعبة الشتاء', courseTitleAr: 'دورة التفاوض', fromAr: 'الأحد 19:00', toAr: 'الثلاثاء 19:00' }
  const mail = clashMailAr(m)
  const texts = [clashBellTitleAr(m), clashBellBodyAr(m), mail.subject, mail.heading, mail.reasonAr, mail.solutionAr, mail.nextAr, mail.ctaAr,
    clashWhyAr([{ courseTitleAr: 'دورة X', whyAr: 'في مسار «Y» نفسه' }])]

  it('السبب والحلّ وما بعده — والموعدان', () => {
    expect(mail.reasonAr).toContain('دورتين')
    expect(mail.facts.map((f) => f.value).join(' ')).toContain('الثلاثاء 19:00')
    expect(mail.nextAr).toContain('ارفضه واكتب لنا السبب')
  })

  it('بلا «عرضك»، وبلا تشكيل إلّا الشدّة، والزرّ يدلّ ولا يأمر', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/عرضك/)
      expect(t, t).not.toMatch(/[ً-ِْ]/)
    }
    expect(mail.ctaAr.startsWith('افتح')).toBe(true)
  })
})

describe('تنبيه المدرب وهو يختار موعد لقائه', () => {
  const iso = (day: string, clock: string) => zonedAt(day, clock).toISOString()
  const nearby: NearbyTime[] = [
    { startsAt: iso('2026-12-06', '19:00'), endsAt: iso('2026-12-06', '21:00'), courseTitleAr: 'دورة X', whyAr: 'في مسار «Y» نفسه' },
    { startsAt: iso('2026-12-08', '18:00'), endsAt: iso('2026-12-08', '20:00'), courseTitleAr: 'دورة Z', whyAr: 'للفئة نفسها (أ) وبمستوى قريب' },
    /* بعد منتصف الليل بعمّان — وهو أمسُه بغرينتش: فاليومُ يُقرأ بعمّان لا بأوّل عشرة أحرف */
    { startsAt: iso('2026-12-09', '00:30'), endsAt: iso('2026-12-09', '01:30'), courseTitleAr: 'دورة W', whyAr: 'في مسار «Y» نفسه' },
  ]

  it('ما يقع على الوقت المختار وحده — والمتتالي بلا تداخل لا ينبّه', () => {
    expect(nearbyAt(nearby, zonedAt('2026-12-06', '20:00'), zonedAt('2026-12-06', '22:00')).map((n) => n.courseTitleAr)).toEqual(['دورة X'])
    expect(nearbyAt(nearby, zonedAt('2026-12-06', '17:00'), zonedAt('2026-12-06', '19:00'))).toEqual([])
  })

  it('واليوم بتوقيت عمّان يقول ما فيه قبل أن تختار الساعة', () => {
    expect(nearbyOnDay(nearby, '2026-12-08').map(nearbySpanAr)).toEqual(['18:00–20:00 «دورة Z»'])
    expect(nearbyOnDay(nearby, '2026-12-07')).toEqual([])
  })

  it('والتنبيه يسمّي الدورة وسببها، وينصح ولا يمنع — بلا تشكيل', () => {
    expect(nearbyWarnAr([])).toBeNull()
    const t = nearbyWarnAr([nearby[0]!])!
    expect(t).toContain('«دورة X» في مسار «Y» نفسه')
    expect(t).toContain('ولك أن تحفظه كما هو')
    expect(t).not.toMatch(/[\u064B-\u0650\u0652]/)
  })
})

describe('رسالة المتعلّمين حين ينتقل الجدول — واحدة', () => {
  it('اليوم والساعة وأوّل لقاء، ورابط الانضمام نفسه — بلا تشكيل', () => {
    const t = scheduleMovedBodyAr({ weekday: 2, clock: '19:00', firstAtAr: 'الثلاثاء 8 ديسمبر 19:00', pending: 0 })
    expect(t).toBe('صارت لقاءات شعبتك الثلاثاء 19:00 كل أسبوع وأول لقاء بموعده الجديد الثلاثاء 8 ديسمبر 19:00. ورابط الانضمام نفسه.')
    expect(t).not.toMatch(/[\u064B-\u0650\u0652]/)
  })

  it('وشعبة تلتقي أكثر من مرّة في الأسبوع تذكر أيامها كلّها', () => {
    expect(scheduleMovedBodyAr({ weekday: 1, clock: '20:30', days: [1, 3, 6], firstAtAr: null, pending: 0 }))
      .toBe('صارت لقاءات شعبتك الاثنين، الأربعاء والسبت 20:30 كل أسبوع. ورابط الانضمام نفسه.')
  })

  it('وما رجع إلى مراجعة الإدارة يقال', () => {
    expect(scheduleMovedBodyAr({ weekday: 1, clock: '18:00', firstAtAr: null, pending: 1 })).toContain('ولقاء واحد منها يراجع عند الإدارة')
    expect(scheduleMovedBodyAr({ weekday: 1, clock: '18:00', firstAtAr: null, pending: 3 })).toContain('وبعضها يراجع عند الإدارة')
  })
})

