/* ═══ ما يُفتح للمتعلّم يُقال له — مرّةً، ولمن يعنيه (٢(ب-٣)) ═══

   القاعدةُ المحضة (أيُّ خبرٍ في أيّ لحظة) في `src/tests/learning/timeline-events.test.ts`،
   وهنا أثرُ الدورة الحقيقيّ (`notifyTimeline` في `server/worker/jobs.ts`):
   ① يصل المسجَّلَ وحدَه — لا المنتظرَ ولا المنسحبَ ولا من أكمل.
   ② و«غدا» لمن لم يسلّم وحدَه.
   ③ ومن كتم الصنفَ لا يصله شيء.
   ④ ودورةٌ ثانيةٌ بلا أثر.
   ⑤ وما اعتُمد بلا مواعيدَ لا أخبارَ خطٍّ له. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { notifyTimeline } from '../../worker/jobs'

let prisma: PrismaClient
/* الأحد ١٤ فبراير ٢٠٢٧، التاسعةُ مساءً بعمّان: فُتح الموعدُ الثاني منتصفَ ليل
   اليوم، وانتهى لقاؤه قبل ساعة، وآخرُ موعد مهمّة الأوّل ظهرَ الغد */
const NOW = new Date('2027-02-14T18:00:00.000Z')
const users: Record<string, string> = {}
let timelineCohort = ''
let legacyCohort = ''
let firstTask = ''
let profileId = ''

const PLAN = {
  kind: 'trainer', startsOn: '2027-02-07', endsOn: '2027-03-13',
  modules: [
    { moduleId: 'NM1', titleAr: 'رسمُ العمليّة' },
    { moduleId: 'NM2', titleAr: 'قياسُ الهدر' },
    { moduleId: 'NM3', titleAr: 'اختيارُ الأداة' },
    { moduleId: 'NM4', titleAr: 'خطّةُ التنفيذ' },
  ],
  slots: [
    { startsOn: '2027-02-07', endsOn: '2027-02-13', moduleIds: ['NM1'] },
    { startsOn: '2027-02-14', endsOn: '2027-02-20', moduleIds: ['NM2'] },
    { startsOn: '2027-02-21', endsOn: '2027-02-27', moduleIds: ['NM3'] },
    { startsOn: '2027-02-28', endsOn: '2027-03-13', moduleIds: ['NM4'] },
  ],
}

async function cohortWith(title: string, content: Record<string, unknown>) {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const c = await prisma.cohort.create({
    data: { courseId: course.id, title, status: 'active', capacity: 30, startsAt: new Date('2027-02-06T21:00:00Z'), endsAt: new Date('2027-03-13T12:00:00Z') },
  })
  await prisma.cohortDeliveryPlan.create({ data: { cohortId: c.id, trainerId: profileId, status: 'approved', content: content as never } })
  const s = (startsAt: string, endsAt: string, m: string) => prisma.cohortSession.create({
    data: { cohortId: c.id, title: `لقاءُ ${m}`, startsAt: new Date(startsAt), endsAt: new Date(endsAt), moduleId: m, moduleIds: [m] },
  })
  await s('2027-02-08T15:00:00Z', '2027-02-08T17:00:00Z', 'NM1')
  await s('2027-02-14T15:00:00Z', '2027-02-14T17:00:00Z', 'NM2')
  await s('2027-02-22T15:00:00Z', '2027-02-22T17:00:00Z', 'NM3')
  const a1 = await prisma.cohortAssessment.create({
    data: { cohortId: c.id, moduleId: 'NM1', type: 'assignment', title: 'خريطةُ عمليّتك', maxScore: 10, status: 'published', dueAt: new Date('2027-02-15T12:00:00Z') },
  })
  await prisma.cohortAssessment.create({
    data: { cohortId: c.id, moduleId: 'NM2', type: 'assignment', title: 'جدولُ الهدر', maxScore: 10, status: 'published', dueAt: new Date('2027-02-20T20:59:59.999Z') },
  })
  return { id: c.id, firstTask: a1.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const app = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-NT-${Date.now()}`, email: 'nt-trainer@test.local', fullName: 'مدرّبُ الأخبار', phoneCountryCode: '+962', phone: '779000333', country: 'الأردن', status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id } })).id

  const t = await cohortWith('شعبةٌ على الخطّ', PLAN)
  timelineCohort = t.id
  firstTask = t.firstTask
  legacyCohort = (await cohortWith('شعبةٌ قبل المواعيد', { ...PLAN, slots: [] })).id

  const enroll = async (key: string, status: string, cohortId = timelineCohort) => {
    const u = await prisma.user.create({ data: { email: `nt-${key}-${Date.now()}@test.local`, displayName: key, passwordHash: 'x' } })
    users[key] = u.id
    return prisma.enrollment.create({ data: { cohortId, userId: u.id, status } })
  }
  const submitted = await enroll('submitted', 'enrolled')
  await enroll('pending', 'enrolled')
  await enroll('waitlisted', 'waitlisted')
  await enroll('dropped', 'dropped')
  await enroll('completed', 'completed')
  await enroll('silenced', 'enrolled')
  await enroll('legacy', 'enrolled', legacyCohort)
  await prisma.assignmentSubmission.create({ data: { assessmentId: firstTask, enrollmentId: submitted.id, textAnswer: 'سلّمتُها' } })
  await prisma.notificationPreference.create({ data: { userId: users.silenced, category: 'cohort_timeline', channel: 'in_app', enabled: false } })
})

const mine = (key: string) => prisma.notification.findMany({ where: { userId: users[key] }, orderBy: { templateKey: 'asc' } })

describe('الدورةُ الأولى', () => {
  it('⚠️ خمسةُ أخبار: موعدٌ فُتح ومهامُّ فُتحت لكلّ مسجَّل، و«غدا» لمن لم يسلّم', async () => {
    const out = await notifyTimeline(prisma, NOW)
    expect(out.failed).toBe(0)
    expect(out.done, out.summaryAr).toBe(5)
  })

  it('⚠️ من سلّم يصله ما فُتح — ولا يُطالَب بما سلّمه', async () => {
    expect((await mine('submitted')).map((n) => n.templateKey)).toEqual(['timeline.slot_opened', 'timeline.tasks_opened'])
  })

  it('⚠️ ومن لم يسلّم يصله «غدا» — بعنوان المهمّة وموعدها', async () => {
    const list = await mine('pending')
    expect(list.map((n) => n.templateKey)).toEqual(['timeline.due_soon', 'timeline.slot_opened', 'timeline.tasks_opened'])
    expect(list[0].title).toContain('خريطةُ عمليّتك')
  })

  it('⚠️ والخبرُ يسمّي المحورَ كما في الخطّة، ولقاءَه القادمَ إن كان', async () => {
    const [, opened, tasks] = await mine('pending')
    expect(opened.body).toContain('المحور 2: قياسُ الهدر')
    expect(tasks.title).toBe('فُتحت مهامُّ المحور 2: قياسُ الهدر')
    expect(tasks.body).toContain('«جدولُ الهدر»')
  })

  it('⚠️ ولا يصل المنتظرَ ولا المنسحبَ ولا من أكمل — ولا من كتم الصنف', async () => {
    for (const key of ['waitlisted', 'dropped', 'completed', 'silenced']) {
      expect(await mine(key), `${key} وصله خبرُ خطّ`).toEqual([])
    }
  })

  it('⚠️ وما اعتُمد بلا مواعيدَ لا أخبارَ خطٍّ له', async () => {
    expect(await mine('legacy')).toEqual([])
  })
})

describe('الدورةُ الثانية', () => {
  it('⚠️ لا تُعيد خبرا — والمفتاحُ مفتاحُ الخبر لا ساعتُه', async () => {
    const again = await notifyTimeline(prisma, new Date(NOW.getTime() + 15 * 60_000))
    expect(again.done, again.summaryAr).toBe(0)
    expect(await prisma.notification.count({ where: { userId: users.pending } })).toBe(3)
  })
})
