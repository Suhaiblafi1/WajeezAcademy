/* حارسُ القسمة بين لوحتَي المدرّب.

   العطبُ الذي يُحرَس منه ليس خطأً في حساب، بل ازدواجٌ في العرض: جلسةٌ واحدةٌ
   تظهر في «ما ينتظرك الآن» وفي «جلساتي القادمة» معا، بزرّين مختلفين. فالحدُّ
   الفاصلُ واحدٌ (`SOON_WINDOW`) واللوحتان تقتسمانه: ما عنده فأدنى للطابور،
   وما بعده للتخطيط. ولا فجوةَ بينهما تبتلع جلسة.

   والفحصُ على البنية: `kind` من الطابور و`dayOffset` من اللوحة — لا على
   ورودِ نصٍّ في عنوان، فالعناوينُ تتغيّر ولا يتغيّر الحدّ. */

import { describe, expect, it } from 'vitest'
import { buildWorkQueue, SOON_WINDOW } from '@/application/trainer/work-queue'
import { buildUpcoming, UPCOMING_LIMIT } from '@/application/trainer/upcoming'

const NOW = new Date('2026-09-13T09:00:00Z').getTime()
const MINUTE = 60_000

/** شعبةٌ بجلسةٍ واحدةٍ تبدأ بعد `afterMs` من الآن */
function rowsWithSessionAt(afterMs: number, over: Partial<{ status: string; id: string; title: string }> = {}) {
  return [{
    role: 'trainer',
    cohort: {
      id: 'c1',
      title: 'شعبةُ التحرير',
      sessions: [{
        id: over.id ?? 's1',
        title: over.title ?? 'اللقاءُ الأوّل',
        startsAt: new Date(NOW + afterMs).toISOString(),
        endsAt: new Date(NOW + afterMs + 2 * 3600_000).toISOString(),
        status: over.status ?? 'scheduled',
        zoom: { joinUrl: 'https://zoom.example/j/1', learnerUrl: null },
        recordings: [],
      }],
      enrollments: [],
      assessments: [],
    },
  }]
}

/** بنودُ الجلسات في الطابور وحدَها — لا الحضورُ ولا التقييم */
function sessionItems(rows: unknown, now: number) {
  return buildWorkQueue(rows, 0, now).filter((i) => i.kind === 'session_now' || i.kind === 'session_soon')
}

describe('القسمةُ بين الطابور ولوحةِ التخطيط', () => {
  it('جلسةٌ عند الحدِّ تماما للطابورِ وحدَه — ولا تظهر في التخطيط', () => {
    const rows = rowsWithSessionAt(SOON_WINDOW)
    expect(sessionItems(rows, NOW).map((i) => i.kind)).toEqual(['session_soon'])
    expect(buildUpcoming(rows, NOW)).toEqual([])
  })

  it('وجلسةٌ بعد الحدِّ بدقيقةٍ للتخطيطِ وحدَه — ويخلو منها الطابور', () => {
    const rows = rowsWithSessionAt(SOON_WINDOW + MINUTE)
    expect(sessionItems(rows, NOW)).toEqual([])
    const days = buildUpcoming(rows, NOW)
    expect(days).toHaveLength(1)
    expect(days[0].sessions.map((s) => s.id)).toEqual(['s1'])
  })

  it('فلا جلسةَ تُعرض في اللوحتين معا مهما بَعُدت أو قَرُبت', () => {
    /* مسحٌ على مدى أسبوعٍ بخطوةِ نصفِ ساعة: كلُّ لحظةٍ إمّا هنا أو هناك */
    for (let after = 0; after <= 7 * 24 * 3600_000; after += 30 * MINUTE) {
      const rows = rowsWithSessionAt(after)
      const inQueue = sessionItems(rows, NOW).length > 0
      const inPlan = buildUpcoming(rows, NOW).length > 0
      expect(inQueue && inPlan, `ازدواجٌ عند ${after / 3600_000} ساعة`).toBe(false)
    }
  })
})

describe('لوحةُ التخطيط', () => {
  it('تجمع جلساتِ اليومِ الواحدِ تحت عنوانٍ واحدٍ من معجمِ المواعيد', () => {
    const far = 3 * 24 * 3600_000
    const rows = [{
      role: 'trainer',
      cohort: {
        id: 'c1',
        title: 'شعبةُ التحرير',
        sessions: [
          { id: 'a', title: 'الأولى', startsAt: new Date(NOW + far).toISOString(), status: 'scheduled' },
          { id: 'b', title: 'الثانية', startsAt: new Date(NOW + far + 3600_000).toISOString(), status: 'scheduled' },
          { id: 'c', title: 'الثالثة', startsAt: new Date(NOW + far + 24 * 3600_000).toISOString(), status: 'scheduled' },
        ],
      },
    }]
    const days = buildUpcoming(rows, NOW)
    expect(days).toHaveLength(2)
    expect(days[0].sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(days[1].sessions.map((s) => s.id)).toEqual(['c'])
    /* العنوانُ عربيٌّ صحيحُ الصيغة لا «بعد 3 يوم» */
    expect(days[0].labelAr).toBe('بعد 3 أيّام')
    expect(days[1].labelAr).toBe('بعد 4 أيّام')
    /* والأيّامُ مرتَّبةٌ صاعدةً بفرقِ اليوم لا بنصِّ العنوان */
    expect(days.map((d) => d.dayOffset)).toEqual([3, 4])
  })

  it('وتُسقط الملغاةَ والمنتهيةَ ولو كانت بعيدة', () => {
    const far = 5 * 24 * 3600_000
    expect(buildUpcoming(rowsWithSessionAt(far, { status: 'cancelled' }), NOW)).toEqual([])
    expect(buildUpcoming(rowsWithSessionAt(far, { status: 'done' }), NOW)).toEqual([])
  })

  it('وتقف عند سقفِها فلا تصير جدولا كاملا', () => {
    const sessions = Array.from({ length: UPCOMING_LIMIT + 4 }, (_, i) => ({
      id: `s${i}`,
      title: `جلسة ${i}`,
      startsAt: new Date(NOW + (3 + i) * 24 * 3600_000).toISOString(),
      status: 'scheduled',
    }))
    const days = buildUpcoming([{ role: 'trainer', cohort: { id: 'c1', title: 'شعبة', sessions } }], NOW)
    expect(days.reduce((n, d) => n + d.sessions.length, 0)).toBe(UPCOMING_LIMIT)
  })

  it('وتخلط شعبَه كلَّها مرتَّبةً بالوقت لا بالشعبة', () => {
    const rows = [
      { role: 'trainer', cohort: { id: 'c1', title: 'الأولى', sessions: [{ id: 'late', title: 'س', startsAt: new Date(NOW + 5 * 24 * 3600_000).toISOString(), status: 'scheduled' }] } },
      { role: 'trainer', cohort: { id: 'c2', title: 'الثانية', sessions: [{ id: 'early', title: 'ص', startsAt: new Date(NOW + 3 * 24 * 3600_000).toISOString(), status: 'scheduled' }] } },
    ]
    const flat = buildUpcoming(rows, NOW).flatMap((d) => d.sessions)
    expect(flat.map((s) => s.id)).toEqual(['early', 'late'])
    expect(flat.map((s) => s.cohortTitleAr)).toEqual(['الثانية', 'الأولى'])
  })
})
