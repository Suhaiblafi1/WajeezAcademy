/* من الدقائق إلى الحكم — وما لا يُمسّ.

   هذه آخرُ حلقةٍ في السلسلة: الجلسةُ تنتهي، فيُقرأ تقريرُ Zoom ويُحتسب
   الحضور. وبها يسقط ألفٌ وأربعُمئةٍ وأربعون نقرةً في الفصل الواحد.

   ── وأربعةُ أعطابٍ تسقط صامتةً ──

   ١) **يُمحى حكمُ المدرّب.** وهو يعرف ما لا يعرفه العدّاد: من استأذن، ومن
      حضر بجهازٍ ثانٍ، ومن انقطعت شبكتُه. فلو داسه المشتقُّ لصار العدّادُ
      يُلغي قرارَ إنسانٍ في سجلٍّ أكاديميّ — ويقع ذلك **بعد** أن يكون
      المدرّبُ قد صحّح، فلا يراه أحد.

   ٢) **من انقطع مرّتَين يُقرأ اثنَين.** التقريرُ يعطي صفًّا لكلّ دخول، فمن
      انقطعت شبكتُه ثلاثا فيه ثلاثةُ صفوف — وجمعُ دقائقها هو حضورُه، لا
      ثلاثةَ أشخاصٍ ولا غيابٌ لأنّ كلَّ صفٍّ وحدَه دون النصف.

   ٣) **الغائبُ لا يُحكم له.** من لم يظهر في التقرير أصلا يبقى بلا صفّ، فلا
      يُقرأ غائبا بل «لم يُسجَّل بعد» — وشتّانَ بينهما في كشف الدرجات.

   ٤) **من لم يُطابَق يُنسب إلى أحد.** ضيفٌ أو المدرّبُ نفسُه أو من دخل
      ببريدٍ آخر: تُحفظ واقعتُه ولا يُصنع لها حكم.

   ولا شبكةَ هنا: `fetch` مُلتقَط، والقاعدةُ حقيقيّة. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ZoomEventService } from '../../services/zoom-events.service'
import { forgetZoomToken, encodeMeetingUuid } from '../../services/zoom.service'

const MEETING_ID = '5150515051'
const UUID = 'abc/dEf=='
const START = new Date('2027-01-10T09:00:00Z')

let prisma: PrismaClient
let events: ZoomEventService
let sessionId = ''
let steady = ''   // حضر كاملا
let flaky = ''    // انقطع مرّتَين
let latecomer = ''// دخل متأخّرا
let missing = ''  // لم يظهر أصلا
let excused = ''  // حكم المدرّب عليه بيده

/** ما يردّه تقريرُ Zoom — يُبدَّل في كلّ حالة */
let report: unknown[] = []

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  events = new ZoomEventService(prisma)
  const auth = new AuthService(prisma)

  await prisma.integrationSetting.upsert({
    where: { provider: 'zoom' },
    update: { enabled: true, config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: 'w' } },
    create: { provider: 'zoom', enabled: true, config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: 'w' } },
  })

  const cohort = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ الاحتساب', status: 'active', capacity: 20 },
  })
  const s = await prisma.cohortSession.create({
    data: { cohortId: cohort.id, title: 'لقاءُ الاحتساب', startsAt: START, status: 'scheduled' },
  })
  sessionId = s.id
  await prisma.zoomMeeting.create({
    data: { sessionId, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/5150515051', meetingId: MEETING_ID, durationMin: 90 },
  })

  const mk = async (email: string, name: string) => {
    const u = await auth.register(email, 'Learner#12345', name)
    const e = await prisma.enrollment.create({ data: { userId: u.userId, cohortId: cohort.id, status: 'enrolled' } })
    await prisma.sessionJoinLink.create({
      data: { sessionId, enrollmentId: e.id, registrantId: `r-${email}`, joinUrl: 'https://zoom.us/w/1' },
    })
    return e.id
  }
  steady = await mk('steady@wajeez.test', 'ثابتٌ حاضر')
  flaky = await mk('flaky@wajeez.test', 'منقطعٌ عائد')
  latecomer = await mk('late@wajeez.test', 'متأخّرٌ داخل')
  missing = await mk('missing@wajeez.test', 'غائبٌ تماما')
  excused = await mk('excused@wajeez.test', 'معذورٌ بحكم المدرّب')
}, 240_000)

beforeEach(() => {
  forgetZoomToken()
  globalThis.fetch = (async (url: string) => {
    const u = String(url)
    if (u.includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    }
    if (u.includes('/past_meetings/')) {
      return { ok: true, status: 200, json: async () => ({ participants: report }) }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  }) as unknown as typeof fetch
})

const P = (email: string, joinIso: string, seconds: number, name = 'مشارك') =>
  ({ name, user_email: email, join_time: joinIso, leave_time: joinIso, duration: seconds })

describe('الاحتسابُ من الدقائق', () => {
  it('يُشتقّ الحضورُ والتأخّرُ والغياب — ولا يُترك أحدٌ بلا حكم', async () => {
    report = [
      /* ٨٠ دقيقةً من ٩٠ — حاضر */
      P('steady@wajeez.test', '2027-01-10T09:00:00Z', 80 * 60, 'ثابت'),
      /* ثلاثةُ انقطاعاتٍ مجموعُها ٦٠ — حاضرٌ لا غائب */
      P('flaky@wajeez.test', '2027-01-10T09:02:00Z', 20 * 60, 'منقطع'),
      P('flaky@wajeez.test', '2027-01-10T09:30:00Z', 20 * 60, 'منقطع'),
      P('flaky@wajeez.test', '2027-01-10T10:00:00Z', 20 * 60, 'منقطع'),
      /* دخل بعد ٢٥ دقيقةً وبقي ٦٠ — متأخّر */
      P('late@wajeez.test', '2027-01-10T09:25:00Z', 60 * 60, 'متأخّر'),
      /* ضيفٌ لا يُطابَق بأحد */
      P('guest@elsewhere.test', '2027-01-10T09:05:00Z', 70 * 60, 'ضيفٌ غريب'),
    ]
    await events.handle('meeting.ended', { id: MEETING_ID, uuid: UUID, end_time: '2027-01-10T10:30:00Z', duration: 90 })

    const marks = await prisma.attendance.findMany({ where: { sessionId } })
    const by = new Map(marks.map((m) => [m.enrollmentId, m.status]))
    expect(by.get(steady)).toBe('present')
    expect(
      by.get(flaky),
      'من انقطع ثلاثا مجموعُه ٦٠ من ٩٠ — وكلُّ صفٍّ وحدَه دون النصف، فلو لم '
      + 'تُجمع دقائقُه لَقُرئ غائبا وهو أكثرُهم صبرا.',
    ).toBe('present')
    expect(by.get(latecomer)).toBe('late')
    expect(
      by.get(missing),
      'من لم يظهر في التقرير يبقى بلا صفّ — و«لم يُسجَّل» غيرُ «غائب» في كشف الدرجات.',
    ).toBe('absent')
  })

  it('والواقعةُ تُحفظ خامًّا — فيُرى على أيّ دقائقَ بُني الحكم', async () => {
    const rows = await prisma.sessionParticipation.findMany({ where: { sessionId } })
    expect(rows.length).toBe(6)
    const flakyRows = rows.filter((r) => r.email === 'flaky@wajeez.test')
    expect(flakyRows.length, 'دُمجت الصفوفُ فضاع أصلُ الحكم').toBe(3)
  })

  it('ومن لم يُطابَق يُحفظ بلا نسبةٍ إلى أحد', async () => {
    const guest = await prisma.sessionParticipation.findFirst({
      where: { sessionId, email: 'guest@elsewhere.test' },
    })
    expect(guest, 'ضاعت واقعةُ الضيف').toBeTruthy()
    expect(guest?.enrollmentId, 'نُسب الضيفُ إلى متعلّمٍ ليس هو').toBeNull()
  })

  it('والعددُ والحالةُ يُكتبان على الاجتماع', async () => {
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId } })
    expect(zoom?.participantCount).toBe(6)
    expect(zoom?.syncState).toBe('synced')
  })
})

describe('ويدُ المدرّب أعلى', () => {
  it('حكمٌ وضعه إنسانٌ لا يمسحه العدّاد', async () => {
    /* المدرّبُ عذر متعلّما — وهو يعرف ما لا يعرفه التقرير */
    await prisma.attendance.upsert({
      where: { sessionId_enrollmentId: { sessionId, enrollmentId: excused } },
      update: { status: 'excused', source: 'manual', note: 'استأذن مسبقا' },
      create: { sessionId, enrollmentId: excused, status: 'excused', source: 'manual', note: 'استأذن مسبقا' },
    })
    report = [P('steady@wajeez.test', '2027-01-10T09:00:00Z', 80 * 60)]
    await events.handle('meeting.ended', { id: MEETING_ID, uuid: UUID, end_time: '2027-01-10T10:30:00Z', duration: 90 })

    const mark = await prisma.attendance.findUnique({
      where: { sessionId_enrollmentId: { sessionId, enrollmentId: excused } },
    })
    expect(
      mark?.status,
      'داس العدّادُ قرارَ إنسانٍ في سجلٍّ أكاديميّ — ويقع ذلك بعد أن يكون '
      + 'المدرّبُ قد صحّح، فلا يراه أحد.',
    ).toBe('excused')
    expect(mark?.source).toBe('manual')
    expect(mark?.note).toBe('استأذن مسبقا')
  })

  it('وما كتبه العدّادُ يُحدّثه العدّادُ نفسُه', async () => {
    const mark = await prisma.attendance.findUnique({
      where: { sessionId_enrollmentId: { sessionId, enrollmentId: latecomer } },
    })
    /* في الجولة الثانية لم يظهر المتأخّرُ في التقرير — فصار غائبا */
    expect(mark?.source).toBe('zoom')
    expect(mark?.status).toBe('absent')
  })
})

/* ── وشرطُ Zoom في الترميز ──

   وثيقةُ Zoom تشترط ترميزا مزدوجا حين يبدأ المعرّفُ بشَرطةٍ مائلة **أو**
   يحوي `//` — لا عند كلّ شَرطة. والسببُ أنّ بعضَ الوسطاء يفكّون `%2F`
   قبل التوجيه، فيصير المعرّفُ مسارَين.

   وأوّلُ صياغةٍ لهذا الحارس اشترطت أكثرَ ممّا تشترطه الوثيقة — فسقط على
   شيفرةٍ صحيحة. والخطأُ كان في التوقّع لا في الكود، فصُحّح التوقّع. */
describe('ومعرّفُ اللقاء يُرمَّز كما يشترط Zoom', () => {
  it('البادئُ بشَرطةٍ أو الحاوي «//» يُرمَّز مرّتَين — وإلّا ردّ ٤٠٤ على لقاءٍ موجود', () => {
    expect(encodeMeetingUuid('/leading==')).toBe(encodeURIComponent(encodeURIComponent('/leading==')))
    expect(encodeMeetingUuid('ab//cd==')).toBe(encodeURIComponent(encodeURIComponent('ab//cd==')))
  })

  it('وما سواهما يُرمَّز مرّةً — والزيادةُ تُفسده كالنقص', () => {
    expect(encodeMeetingUuid('plainUuid==')).toBe(encodeURIComponent('plainUuid=='))
    /* شَرطةٌ واحدةٌ في الوسط تكفيها مرّةٌ: `%2F` تمرّ سليمةً في مقطع المسار */
    expect(encodeMeetingUuid('abc/dEf==')).toBe(encodeURIComponent('abc/dEf=='))
  })
})
