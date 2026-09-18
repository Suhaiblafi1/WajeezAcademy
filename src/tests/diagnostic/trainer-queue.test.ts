import { describe, expect, it } from 'vitest'
import {
  buildWorkQueue,
  NOW_WINDOW_BEFORE,
  SOON_WINDOW,
} from '../../application/trainer/work-queue'
import {
  findAtRisk,
  ABSENCE_THRESHOLD,
  PACE_GAP_POINTS,
  MIN_SESSIONS_FOR_PACE,
  RISK_RULE_AR,
} from '../../application/trainer/at-risk'

const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const HOUR = 3600_000
const DAY = 24 * HOUR

function cohort(over: Partial<Record<string, unknown>> = {}) {
  return {
    role: 'lead',
    cohort: {
      id: 'CO-1',
      title: 'شعبة تجريبية',
      sessions: [],
      enrollments: [],
      assessments: [],
      ...over,
    },
  }
}

describe('طابور عمل المدرب — ف-١', () => {
  it('رد غير مصفوفة أو فارغ لا يُنتج بندا ولا يرمي', () => {
    expect(buildWorkQueue(null, 0, NOW)).toEqual([])
    expect(buildWorkQueue([], 0, NOW)).toEqual([])
    expect(buildWorkQueue([{ cohort: null }], 0, NOW)).toEqual([])
  })

  it('جلسة جارية تسبق كل شيء، ورابطها خارجي حين يوجد', () => {
    const items = buildWorkQueue(
      [cohort({
        sessions: [{ id: 'S1', title: 'جلسة أولى', startsAt: iso(-10 * 60_000), endsAt: iso(HOUR), status: 'scheduled', zoom: { joinUrl: 'https://zoom.test/x' }, recordings: [] }],
        enrollments: [{ id: 'E1', status: 'enrolled', attendance: [], user: { displayName: 'أحمد' } }],
      })],
      5,
      NOW,
    )
    expect(items[0].kind).toBe('session_now')
    expect(items[0].external).toBe(true)
    expect(items[0].href).toBe('https://zoom.test/x')
  })

  it('جلسة بلا رابط تقود إلى صفحة شعبتها داخليا لا لرابط فارغ', () => {
    const items = buildWorkQueue(
      [cohort({ sessions: [{ id: 'S1', title: 'ج', startsAt: iso(-5 * 60_000), endsAt: iso(HOUR), status: 'scheduled', zoom: null, recordings: [] }], enrollments: [{ id: 'E1', status: 'enrolled' }] })],
      0, NOW,
    )
    const s = items.find((i) => i.kind === 'session_now')!
    expect(s.external).toBe(false)
    expect(s.href).toBe('/trainer/cohort/CO-1')
  })

  it('جلسة خارج نافذة ٢٤ ساعة لا تظهر', () => {
    const items = buildWorkQueue(
      [cohort({ sessions: [{ id: 'S1', title: 'ج', startsAt: iso(SOON_WINDOW + HOUR), status: 'scheduled', zoom: null, recordings: [] }], enrollments: [{ id: 'E1', status: 'enrolled' }] })],
      0, NOW,
    )
    expect(items.filter((i) => i.kind === 'session_soon' || i.kind === 'session_now')).toHaveLength(0)
  })

  it('الحضور غير المسجَّل يُقرأ من حضور التسجيلات لا من الجلسة — ولا ينبّه عن جلسة مسجَّلة', () => {
    const past = { id: 'S1', title: 'ماضية', startsAt: iso(-3 * DAY), endsAt: iso(-3 * DAY + HOUR), status: 'done', zoom: null, recordings: [{}] }
    const unmarked = buildWorkQueue(
      [cohort({ sessions: [past], enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }] })],
      0, NOW,
    )
    expect(unmarked.some((i) => i.kind === 'attendance_missing')).toBe(true)

    const marked = buildWorkQueue(
      [cohort({ sessions: [past], enrollments: [{ id: 'E1', status: 'enrolled', attendance: [{ sessionId: 'S1', status: 'present' }] }] })],
      0, NOW,
    )
    expect(marked.some((i) => i.kind === 'attendance_missing')).toBe(false)
  })

  it('«لم يسلّموا» يُحسب على التقييمات المستحقة المنشورة فقط', () => {
    const base = {
      sessions: [],
      enrollments: [{ id: 'E1', status: 'enrolled' }, { id: 'E2', status: 'enrolled' }],
    }
    const dueOpen = buildWorkQueue(
      [cohort({ ...base, assessments: [{ id: 'A1', title: 'واجب', dueAt: iso(-DAY), status: 'published', submissions: [{ enrollmentId: 'E1', status: 'submitted' }] }] })],
      0, NOW,
    )
    const item = dueOpen.find((i) => i.kind === 'not_submitted')!
    expect(item.count).toBe(1)

    /* لم يستحق بعد */
    expect(buildWorkQueue([cohort({ ...base, assessments: [{ id: 'A1', title: 'واجب', dueAt: iso(DAY), status: 'published', submissions: [] }] })], 0, NOW)
      .some((i) => i.kind === 'not_submitted')).toBe(false)
    /* مسودة لا تُحاسب */
    expect(buildWorkQueue([cohort({ ...base, assessments: [{ id: 'A1', title: 'واجب', dueAt: iso(-DAY), status: 'draft', submissions: [] }] })], 0, NOW)
      .some((i) => i.kind === 'not_submitted')).toBe(false)
    /* بلا تاريخ استحقاق لا حكم */
    expect(buildWorkQueue([cohort({ ...base, assessments: [{ id: 'A1', title: 'واجب', dueAt: null, status: 'published', submissions: [] }] })], 0, NOW)
      .some((i) => i.kind === 'not_submitted')).toBe(false)
  })

  it('التسليمات المعلّقة بند واحد مجمّع، ولا تظهر عند الصفر', () => {
    expect(buildWorkQueue([cohort()], 3, NOW).find((i) => i.kind === 'grading_pending')?.count).toBe(3)
    expect(buildWorkQueue([cohort()], 0, NOW).some((i) => i.kind === 'grading_pending')).toBe(false)
  })

  it('جلسة ملغاة لا تُنتج بندا إطلاقا', () => {
    const items = buildWorkQueue(
      [cohort({ sessions: [{ id: 'S1', title: 'ملغاة', startsAt: iso(-NOW_WINDOW_BEFORE / 2), endsAt: iso(HOUR), status: 'cancelled', zoom: { joinUrl: 'x' }, recordings: [] }], enrollments: [{ id: 'E1', status: 'enrolled' }] })],
      0, NOW,
    )
    expect(items).toHaveLength(0)
  })

  it('الترتيب بالإلحاح: الجارية ثم الحضور ثم التقييم', () => {
    const items = buildWorkQueue(
      [cohort({
        sessions: [
          { id: 'S1', title: 'الآن', startsAt: iso(-5 * 60_000), endsAt: iso(HOUR), status: 'scheduled', zoom: { joinUrl: 'x' }, recordings: [] },
          { id: 'S2', title: 'ماضية', startsAt: iso(-3 * DAY), endsAt: iso(-3 * DAY + HOUR), status: 'done', zoom: null, recordings: [{}] },
        ],
        enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }],
      })],
      2, NOW,
    )
    expect(items.map((i) => i.kind).slice(0, 3)).toEqual(['session_now', 'attendance_missing', 'grading_pending'])
  })

  /* ═══ اللقاءُ المردود — وهو ملغًى في الحالة ═══

     ردُّ الإدارة يكتب `approvalState: 'rejected'` ومعه `status: 'cancelled'`.
     والاختبارُ فوق يثبت أنّ الملغى لا يُنتج بندا — فلو قُرئ المردودُ بعد ذلك
     الشرط لَسقط، وهو أوّلُ ما على المدرّب أن يعرفه. */
  it('⚠️ لقاءٌ رُدَّ يُنتج بندَه — ولو كتبت معه الإدارةُ `cancelled`', () => {
    const items = buildWorkQueue(
      [cohort({
        sessions: [{ id: 'S1', title: 'اللقاء الثالث', startsAt: iso(3 * DAY), endsAt: iso(3 * DAY + HOUR), status: 'cancelled', approvalState: 'rejected', reviewNote: 'الموعدُ يصادف إجازة', zoom: null, recordings: [] }],
        enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }],
      })],
      0, NOW,
    )
    const it0 = items.find((i) => i.kind === 'session_rejected')
    expect(it0, 'المردودُ سقط مع الملغى').toBeTruthy()
    expect(it0!.titleAr).toContain('اللقاء الثالث')
    expect(it0!.detailAr, 'ملاحظةُ الإدارة لم تصل صاحبَها').toContain('الموعدُ يصادف إجازة')
    expect(it0!.href).toBe('/trainer/cohort/CO-1')
    expect(it0!.external).toBe(false)
  })

  it('ومردودٌ مضى موعدُه يبقى — فالدرسُ لم يُعقَد وما زال يحتاج موعدا', () => {
    const items = buildWorkQueue(
      [cohort({ sessions: [{ id: 'S1', title: 'ماضٍ مردود', startsAt: iso(-9 * DAY), endsAt: iso(-9 * DAY + HOUR), status: 'cancelled', approvalState: 'rejected', reviewNote: null, zoom: null, recordings: [] }], enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }] })],
      0, NOW,
    )
    expect(items.map((i) => i.kind)).toEqual(['session_rejected'])
    /* ولا يُنسَب إلى الإدارة صمتٌ لم تقله ولا كلامٌ لم تكتبه */
    expect(items[0].detailAr).toContain('بلا ملاحظةٍ من الإدارة')
  })

  it('واللقاءُ المنتظِرُ ليس مردودا — لا بندَ ردٍّ له', () => {
    const items = buildWorkQueue(
      [cohort({ sessions: [{ id: 'S1', title: 'منتظِرة', startsAt: iso(3 * DAY), endsAt: iso(3 * DAY + HOUR), status: 'scheduled', approvalState: 'pending', zoom: null, recordings: [] }], enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }] })],
      0, NOW,
    )
    expect(items.some((i) => i.kind === 'session_rejected')).toBe(false)
  })
})

/* ═══ تجهيزُ الشعبة في الطابور — بعد أن كان حبّةَ عددٍ في الرأس ═══

   كان اللوحُ يقول «شعبتان تنتظران إرسالَك» رقما لا يقول أيَّ شعبةٍ ولا ما
   ينقصها. فصارت بنودا، ولكلِّ موقفٍ بندُه. */
describe('بنودُ التجهيز في طابور المدرّب', () => {
  const plan = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'CO-9', title: 'الدفعة الأولى', courseTitle: 'تحرير النصوص', planStatus: 'draft',
    done: 4, total: 4, next: null, ...over,
  })

  it('لا موجزَ ولا مصفوفة: لا بندَ ولا رمي', () => {
    expect(buildWorkQueue([], 0, NOW)).toEqual([])
    expect(buildWorkQueue([], 0, NOW, null)).toEqual([])
    expect(buildWorkQueue([], 0, NOW, [{ id: '', planStatus: '' }])).toEqual([])
  })

  it('⚠️ شعبةٌ رُدَّت إليه تسبق كلَّ تجهيز — الإدارةُ قرّرت وتنتظره', () => {
    const items = buildWorkQueue([], 0, NOW, [plan({ planStatus: 'changes_requested', done: 2 })])
    expect(items.map((i) => i.kind)).toEqual(['plan_returned'])
    expect(items[0].titleAr).toContain('الدفعة الأولى')
    expect(items[0].href).toBe('/trainer/cohort/CO-9')
  })

  it('⚠️ وتجهيزٌ تمَّ ولا مانع: بندُ إرسالٍ باسم شعبته', () => {
    const items = buildWorkQueue([], 0, NOW, [plan()])
    expect(items.map((i) => i.kind)).toEqual(['plan_ready_unsent'])
    expect(items[0].actionAr).toBe('أرسِلها للاعتماد')
  })

  it('⚠️ وتجهيزٌ تمَّ ومانعُه بيد الإدارة: لا بند — بندٌ بلا إجراءٍ خبرٌ لا عمل', () => {
    /* `next` أوّلُ ما يمنع الإرسال ولو لم يكن بيده: تسميةُ الفصل بيد الإدارة.
       فزرُّ «أرسِلها» هنا كذبٌ — يُضغَط فلا يُرسِل. وموضعُ الخبر سطرُ التحيّة. */
    const items = buildWorkQueue([], 0, NOW, [plan({ next: { key: 'term', labelAr: 'تسمّي الإدارةُ فصلَ الشعبة' } })])
    expect(items).toEqual([])
  })

  it('وتجهيزٌ لم يكتمل: بندُ إكمالٍ يسمّي الخطوةَ التالية وما بقي', () => {
    const items = buildWorkQueue([], 0, NOW, [plan({ done: 1, total: 4, next: { key: 'sessions', labelAr: 'اجدوِل لقاءاتِ الشعبة' } })])
    expect(items.map((i) => i.kind)).toEqual(['plan_incomplete'])
    expect(items[0].detailAr).toContain('1 من 4')
    expect(items[0].detailAr).toContain('اجدوِل لقاءاتِ الشعبة')
    expect(items[0].count, 'الشارةُ لا تقول كم بقي').toBe(3)
  })

  it('والمرسَلُ والمعتمَدُ والمنشورُ لا شيءَ عليه فيها', () => {
    for (const planStatus of ['submitted', 'approved', 'published', 'superseded']) {
      expect(buildWorkQueue([], 0, NOW, [plan({ planStatus })]), planStatus).toEqual([])
    }
  })

  it('⚠️ والمردودةُ بعد الجارية وقبل التسجيل المنسيّ — وبينهما يُقاس الترتيب', () => {
    /* والجلسةُ الماضيةُ بلا حضورٍ مسجَّلٍ هنا قصدا: بندان فقط لا يكشفان
       ترتيبا — يبقيان على حالهما مهما تغيّر الإلحاح. فلا بدّ من ثالثٍ
       **بينهما** كي يكون للحارس ما يسقط به. */
    const items = buildWorkQueue(
      [cohort({
        sessions: [
          { id: 'S1', title: 'الآن', startsAt: iso(-5 * 60_000), endsAt: iso(HOUR), status: 'scheduled', zoom: { joinUrl: 'x' }, recordings: [] },
          { id: 'S2', title: 'ماضية', startsAt: iso(-3 * DAY), endsAt: iso(-3 * DAY + HOUR), status: 'done', zoom: null, recordings: [{}] },
        ],
        enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }],
      })],
      0, NOW,
      [plan({ planStatus: 'changes_requested' })],
    )
    expect(items.map((i) => i.kind)).toEqual(['session_now', 'plan_returned', 'attendance_missing'])
  })

  it('⚠️ و«أرسِلها» بعد الجلسة القريبة وقبل «لم يسلّموا» — خطوةٌ واحدةٌ لا تُلحّ كجلسة', () => {
    const items = buildWorkQueue(
      [cohort({
        sessions: [{ id: 'S1', title: 'غدا', startsAt: iso(6 * HOUR), endsAt: iso(7 * HOUR), status: 'scheduled', zoom: null, recordings: [] }],
        enrollments: [{ id: 'E1', status: 'enrolled', attendance: [] }],
        assessments: [{ id: 'A1', title: 'واجب', dueAt: iso(-DAY), status: 'published', submissions: [] }],
      })],
      0, NOW,
      [plan()],
    )
    expect(items.map((i) => i.kind)).toEqual(['session_soon', 'plan_ready_unsent', 'not_submitted'])
  })
})

describe('إنذار المتعثرين — ف-٢', () => {
  const sessions = [
    { id: 'S1', startsAt: iso(-5 * DAY), endsAt: iso(-5 * DAY + HOUR), status: 'done' },
    { id: 'S2', startsAt: iso(-3 * DAY), endsAt: iso(-3 * DAY + HOUR), status: 'done' },
    { id: 'S3', startsAt: iso(DAY), endsAt: iso(DAY + HOUR), status: 'scheduled' },
    { id: 'S4', startsAt: iso(3 * DAY), endsAt: iso(3 * DAY + HOUR), status: 'scheduled' },
  ]

  it('لا متعثر بلا سبب مقيس', () => {
    const rows = [cohort({ sessions, enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 50 }, attendance: [{ sessionId: 'S1', status: 'present' }, { sessionId: 'S2', status: 'present' }], user: { displayName: 'سالم', email: 's@x.co' } }] })]
    expect(findAtRisk(rows, NOW)).toEqual([])
  })

  it('الغياب يُرصد عند الحد المُعلن لا قبله', () => {
    const mk = (n: number) => [cohort({
      sessions,
      enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 50 }, attendance: sessions.slice(0, n).map((s) => ({ sessionId: s.id, status: 'absent' })), user: { displayName: 'سالم' } }],
    })]
    expect(findAtRisk(mk(ABSENCE_THRESHOLD - 1), NOW).some((l) => l.reasons.some((r) => r.kind === 'absences'))).toBe(false)
    const hit = findAtRisk(mk(ABSENCE_THRESHOLD), NOW)
    expect(hit[0].reasons.find((r) => r.kind === 'absences')!.value).toBe(ABSENCE_THRESHOLD)
  })

  it('التأخر عن الوتيرة يُذكر بالرقمين ولا يُحكم قبل جلستين منتهيتين', () => {
    /* جلستان من أربع انتهتا ⇒ المتوقع ٥٠٪ */
    const rows = [cohort({ sessions, enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 50 - PACE_GAP_POINTS }, attendance: [], user: { displayName: 'سالم' } }] })]
    const r = findAtRisk(rows, NOW)[0].reasons.find((x) => x.kind === 'behind_pace')!
    expect(r.textAr).toContain('٪')
    expect(r.value).toBe(PACE_GAP_POINTS)

    /* شعبة لم تبدأ: لا جلسة منتهية ⇒ لا حكم على الوتيرة */
    const notStarted = [cohort({ sessions: sessions.slice(2), enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 0 }, attendance: [], user: { displayName: 'سالم' } }] })]
    expect(findAtRisk(notStarted, NOW).some((l) => l.reasons.some((x) => x.kind === 'behind_pace'))).toBe(false)
  })

  it('«لا حضور ولا تسليم» يُرصد بعد بدء الشعبة فقط', () => {
    const rows = [cohort({ sessions, enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 0 }, attendance: [], user: { displayName: 'سالم' } }] })]
    expect(findAtRisk(rows, NOW)[0].reasons.some((r) => r.kind === 'no_activity')).toBe(true)
    expect(MIN_SESSIONS_FOR_PACE).toBeGreaterThan(0)
  })

  it('التقييم المستحق بلا تسليم سبب، وبتسليم ليس سببا', () => {
    const mk = (subs: { enrollmentId: string; status: string }[]) => [cohort({
      sessions,
      enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 50 }, attendance: [{ sessionId: 'S1', status: 'present' }, { sessionId: 'S2', status: 'present' }], user: { displayName: 'سالم' } }],
      assessments: [{ id: 'A1', title: 'واجب أول', dueAt: iso(-DAY), status: 'published', submissions: subs }],
    })]
    expect(findAtRisk(mk([]), NOW)[0].reasons.some((r) => r.kind === 'overdue')).toBe(true)
    expect(findAtRisk(mk([{ enrollmentId: 'E1', status: 'submitted' }]), NOW)).toEqual([])
  })

  it('المنسحب والمنتظر لا يُرصدان', () => {
    for (const status of ['dropped', 'waitlisted']) {
      const rows = [cohort({ sessions, enrollments: [{ id: 'E1', status, courseProgress: { percent: 0 }, attendance: [], user: { displayName: 'سالم' } }] })]
      expect(findAtRisk(rows, NOW)).toEqual([])
    }
  })

  it('كل سبب يحمل نصا مقروءا — ولا تُعرض درجة خطر', () => {
    const rows = [cohort({ sessions, enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 0 }, attendance: [{ sessionId: 'S1', status: 'absent' }, { sessionId: 'S2', status: 'absent' }], user: { displayName: 'سالم' } }] })]
    const l = findAtRisk(rows, NOW)[0]
    expect(l.reasons.length).toBeGreaterThanOrEqual(2)
    for (const r of l.reasons) expect(r.textAr.length).toBeGreaterThan(5)
    expect(RISK_RULE_AR).toContain(String(ABSENCE_THRESHOLD))
  })

  it('اسم بديل حين لا اسم معروض — ولا يُترك فراغا', () => {
    const rows = [cohort({ sessions, enrollments: [{ id: 'E1', status: 'enrolled', courseProgress: { percent: 0 }, attendance: [], user: { displayName: '   ' } }] })]
    expect(findAtRisk(rows, NOW)[0].nameAr).toBe('متعلم بلا اسم معروض')
  })

  it('الأشد أسبابا أولا', () => {
    const rows = [cohort({
      sessions,
      enrollments: [
        { id: 'E1', status: 'enrolled', courseProgress: { percent: 20 }, attendance: [{ sessionId: 'S1', status: 'absent' }, { sessionId: 'S2', status: 'absent' }], user: { displayName: 'كثير الأسباب' } },
        { id: 'E2', status: 'enrolled', courseProgress: { percent: 50 }, attendance: [{ sessionId: 'S1', status: 'absent' }, { sessionId: 'S2', status: 'absent' }], user: { displayName: 'سبب واحد' } },
      ],
    })]
    const list = findAtRisk(rows, NOW)
    expect(list[0].nameAr).toBe('كثير الأسباب')
  })
})
