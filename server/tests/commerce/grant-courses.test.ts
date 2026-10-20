/* دوراتُ المنحة (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant-courses.service.ts`.

   ① **لا دورةَ بلا شعبةٍ تُشترى** — مغلقةُ التسجيل، وبلا سعر، وممتلئة، وبلا خطّةٍ معتمدة: لا تُعرض، والمفتوحةُ تُعرض.
   ② **ولا دورةَ بلا مدرّبٍ منشور، ولا دورةَ غيرُ منشورة** — وما يُنشر بعدُ يظهر وحدَه.
   ③ **وأقربُ شعبةٍ لكلّ دورة** — بسعرها ويوم بدئها.
   ④ **ومن الفصل القادم القريب وحدَه** — بيوم بدء الشعبة في عمّان، وبلا شعبةٍ لم تبدأ يُعرض ما يُشترى كلُّه.

   وساعةُ الاختبار في ٢٠٩٩ (`NOW`): الفصلُ فصلُ أقرب شعبةٍ لم تبدأ في القاعدة كلِّها، وملفّاتٌ أخرى تُنشئ شعبا
   تبدأ بعد ساعةٍ أو يوم — فلو كانت الساعةُ ساعةَ التشغيل لاختارت تلك فصلا غيرَ فصلنا، ولتبع الاختبارُ يومَ
   تشغيله. وفي ٢٠٩٩ تكون تلك كلُّها قد بدأت، ولا يبقى «قادما» إلّا شعبُ هذا الملفّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantCoursesService } from '../../services/grant-courses.service'
import { approvedPlanBy } from '../helpers/approved-trainer'

let prisma: PrismaClient
let courses: GrantCoursesService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000
const NOW = new Date(Date.UTC(2099, 0, 20))

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function cohort(courseId: string, over: Record<string, unknown> = {}, withPlan = true) {
  const c = await prisma.cohort.create({
    data: {
      ...(withPlan ? { plans: { create: approvedPlanBy(profileId) } } : {}),
      courseId, title: `شعبة دورات المنحة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 200, currency: 'USD', capacity: 20, startsAt: new Date(NOW.getTime() + 30 * DAY),
      ...over,
    } as never,
  })
  if (withPlan) await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return c
}
const shownIds = async (now = NOW) => (await courses.openCourses(now)).courses.map((x) => x.courseId)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  courses = new GrantCoursesService(prisma)
  ownerId = (await auth.register(`gc-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const user = await prisma.user.create({ data: { email: `gc-tr-${STAMP}@wajeez.test`, displayName: 'مدرب المنحة', passwordHash: 'x' } })
  const app = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-GC-${STAMP}`, fullName: 'مدرب المنحة', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: app.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() } })).id
  /* من آخر القائمة — فلا تلتقي بدورات ملفّات الشراء التي تأخذ من أوّلها */
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id)
}, 240_000)

describe('① لا دورة بلا شعبة تشترى', () => {
  it('⚠️ مغلقة التسجيل، وبلا سعر، وممتلئة، وبلا خطة معتمدة — لا تعرض، والمفتوحة تعرض', async () => {
    const ok = nextCourse()
    await cohort(ok)
    const closed = nextCourse()
    await cohort(closed, { registrationOpen: false })
    const free = nextCourse()
    await cohort(free, { price: null })
    const noPlan = nextCourse()
    await cohort(noPlan, {}, false)
    /* وممتلئةٌ بمن حُجز لهم: سعتُها مقعدٌ واحدٌ محجوز */
    const full = nextCourse()
    const f = await cohort(full, { capacity: 1 })
    const buyer = await prisma.user.create({ data: { email: `gc-b-${STAMP}@test.local`, displayName: 'مشتر', passwordHash: 'x' } })
    await prisma.enrollmentRequest.create({ data: { userId: buyer.id, cohortId: f.id, status: 'seat_held' } })

    const ids = await shownIds()
    expect(ids).toContain(ok)
    for (const [name, id] of [['مغلقة التسجيل', closed], ['بلا سعر', free], ['بلا خطة معتمدة', noPlan], ['ممتلئة', full]]) {
      expect(ids, `عرضت دورة شعبتها ${name}`).not.toContain(id)
    }
  })
})

describe('② ولا دورة بلا مدرب منشور، ولا دورة غير منشورة', () => {
  it('⚠️ مدرب لم يعتمد نشره، ودورة غير منشورة — لا تعرض، وحين ينشر يظهر وحده', async () => {
    const u = await prisma.user.create({ data: { email: `gc-hidden-${STAMP}@wajeez.test`, displayName: 'مدرب لم ينشر', passwordHash: 'x' } })
    const app = await prisma.trainerApplication.create({ data: { reference: `WJ-TR-GCH-${STAMP}`, fullName: 'مدرب لم ينشر', email: u.email, status: 'active' } })
    const hidden = (await prisma.trainerProfile.create({ data: { userId: u.id, applicationId: app.id } })).id
    const a = nextCourse()
    const c = await prisma.cohort.create({
      data: {
        plans: { create: approvedPlanBy(hidden) }, courseId: a, title: `شعبة مدرب لم ينشر ${++seq}`,
        status: 'open', registrationOpen: true, financialReady: true, price: 150, currency: 'USD', capacity: 20,
        startsAt: new Date(NOW.getTime() + 30 * DAY),
      } as never,
    })
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: hidden, role: 'lead', assignedBy: ownerId } })
    expect(await shownIds(), 'ظهرت دورة مدربها لم ينشر').not.toContain(a)
    /* ويُعتمد نشرُه — فتظهر وحدَها بلا شيءٍ يُحفظ */
    await prisma.trainerProfile.update({ where: { id: hidden }, data: { publicVisibility: true, isVerified: true, publishApprovedAt: new Date() } })
    expect(await shownIds(), 'لم تظهر بعد نشر مدربها').toContain(a)

    const b = nextCourse()
    await cohort(b)
    await prisma.course.update({ where: { id: b }, data: { status: 'draft' } })
    try {
      expect(await shownIds(), 'ظهرت دورة غير منشورة').not.toContain(b)
    } finally {
      await prisma.course.update({ where: { id: b }, data: { status: 'published' } })
    }
  })
})

describe('③ وأقرب شعبة لكل دورة', () => {
  it('⚠️ لدورة شعبتان — تعرض الأقرب بسعرها', async () => {
    const a = nextCourse()
    await cohort(a, { price: 999, startsAt: new Date(NOW.getTime() + 60 * DAY) })
    const near = await cohort(a, { price: 150 })
    const row = (await courses.openCourses(NOW)).courses.find((x) => x.courseId === a)!
    expect(row.cohortId, 'لم تعرض أقرب شعبة').toBe(near.id)
    expect(row.price).toBe(150)
  })
})

describe('④ ومن الفصل القادم القريب وحده', () => {
  it('⚠️ فصل أقرب شعبة لم تبدأ بيومها في عمان — وما بعده لا يعرض، وبلا شعبة لم تبدأ يعرض ما يشترى كله', async () => {
    const [near, edge, late] = [nextCourse(), nextCourse(), nextCourse()]
    await cohort(near)
    /* آخرُ ساعةٍ من أبريل في عمّان، وأوّلُ ساعةٍ من مايو — وكلتاهما ٣٠ أبريل بتوقيت غرينتش */
    await cohort(edge, { startsAt: new Date(Date.UTC(2099, 3, 30, 20)) })
    await cohort(late, { startsAt: new Date(Date.UTC(2099, 3, 30, 21)) })

    const o = await courses.openCourses(NOW)
    expect(o.termAr).toBe('موسم الربيع 2099')
    const ids = o.courses.map((x) => x.courseId)
    expect(ids).toContain(near)
    expect(ids, 'أسقط شعبة من الفصل نفسه').toContain(edge)
    expect(ids, 'عرض شعبة من فصل بعده').not.toContain(late)

    /* وبعد أن تبدأ كلُّها: لا فصلَ قادم — فيُعرض ما يُشترى كلُّه لا صفحةٌ فارغة */
    const all = await courses.openCourses(new Date(Date.UTC(2100, 0, 1)))
    expect(all.termAr).toBeNull()
    expect(all.courses.map((x) => x.courseId)).toEqual(expect.arrayContaining([near, edge, late]))
  })
})
