/* التنقّلُ بين الشعب — بابٌ واحد، وقيداه هما نصُّ القرار.

   قرارُ صاحب المنصّة: «لا يحقّ له تغيير مساره بعد الدفع. فقط التنقّل بين
   الشعب ما دامت لم تبدأ بالفعل».

   وشقّاه يقعان في هذا الباب لا في شاشة:

   ١) **الدورةُ نفسُها.** لو جاز الانتقالُ إلى شعبة دورةٍ أخرى لصار «تبديلُ
      شعبة» بابا خلفيّا لتبديل المسار كلِّه — دورةً دورة، بلا فاتورةٍ ولا
      فرقِ سعر. فالقيدُ هنا ليس تفصيلا في التبديل، بل هو المنعُ نفسُه.

   ٢) **قبل البدء** — ويُقاس بالشعبة المغادَرة أيضا، وبأثرِ المتعلّم فيها:
      الحضورُ والتسليماتُ معلَّقةٌ بالتسجيل لا بالشعبة، فمن حضر ثمّ انتقل
      حمل أثرَه إلى شعبةٍ لم تُعقد جلساتُها.

   وثالثةٌ لم يقلها القرار ويقتضيها المال: شعبةٌ أغلى ممّا دُفع تُرفض
   برسالةٍ تقول لماذا — لا تُقبَل فتُؤخذ قيمةٌ لم تُدفع. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'

const POOL: string[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
  ) as { courses: { course_id: string }[] }
).courses.map((c) => c.course_id)

const COURSE = POOL[60]
const OTHER_COURSE = POOL[61]
const DAY = 86_400_000

let prisma: PrismaClient
let enrollments: EnrollmentService
let learnerId = ''

const mkCohort = async (over: Record<string, unknown> = {}) =>
  prisma.cohort.create({
    data: {
      courseId: COURSE, title: 'شعبة', status: 'open',
      registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 40 * DAY),
      ...over,
    },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  enrollments = new EnrollmentService(prisma)
  const auth = new AuthService(prisma)
  learnerId = (await auth.register('switcher@test.local', 'Learner#12345', 'متنقّل')).userId
}, 180_000)

/** تسجيلٌ طازج في شعبةٍ طازجة لكلّ اختبار — فلا يرث حالةَ ما قبله */
async function fresh(overFrom: Record<string, unknown> = {}) {
  await prisma.enrollment.deleteMany({ where: { userId: learnerId } })
  await prisma.enrollmentRequest.deleteMany({ where: { userId: learnerId } })
  const from = await mkCohort({ title: 'شعبتي الأولى', ...overFrom })
  const e = await enrollments.enroll(from.id, learnerId, null, {})
  return { from, enrollmentId: e.id }
}

describe('الشعبةُ تُبدَّل والدورةُ لا', () => {
  it('ينتقل إلى شعبةٍ أخرى من الدورة نفسِها لم تبدأ', async () => {
    const { enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'شعبتي الثانية', startsAt: new Date(Date.now() + 70 * DAY) })
    const moved = await enrollments.switchCohort(learnerId, enrollmentId, to.id)
    expect(moved.cohortId).toBe(to.id)
    expect(moved.status).toBe('enrolled')
  })

  it('ولا ينتقل إلى شعبة دورةٍ أخرى — وإلّا صار تبديلُ المسار من هذا الباب', async () => {
    const { enrollmentId } = await fresh()
    const other = await mkCohort({ courseId: OTHER_COURSE, title: 'دورةٌ أخرى' })
    await expect(
      enrollments.switchCohort(learnerId, enrollmentId, other.id),
      'انتقل إلى دورةٍ لم يشترِها',
    ).rejects.toThrow(/الدورة نفسها|لا يُغيَّر المسار/)
  })

  it('ولا يبدّل تسجيلَ غيره', async () => {
    const { enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'وجهة' })
    const auth = new AuthService(prisma)
    const stranger = (await auth.register(`nosy-${Date.now()}@test.local`, 'Nosy#12345', 'أجنبيّ')).userId
    await expect(enrollments.switchCohort(stranger, enrollmentId, to.id)).rejects.toThrow(/ليس لك/)
  })
})

describe('«ما دامت لم تبدأ بالفعل»', () => {
  it('شعبتُه بدأت — فلا تبديلَ ذاتيّ', async () => {
    const { enrollmentId } = await fresh({ startsAt: new Date(Date.now() - DAY), status: 'active' })
    const to = await mkCohort({ title: 'وجهة' })
    await expect(enrollments.switchCohort(learnerId, enrollmentId, to.id)).rejects.toThrow(/بدأت/)
  })

  it('والوجهةُ بدأت — فلا يُلتحق بمنتصفها', async () => {
    const { enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'وجهةٌ جارية', startsAt: new Date(Date.now() - DAY), status: 'open' })
    await expect(enrollments.switchCohort(learnerId, enrollmentId, to.id)).rejects.toThrow(/بدأت/)
  })

  it('وأثرٌ مسجَّل يمنع — الحضورُ معلَّقٌ بالتسجيل فينتقل معه', async () => {
    const { from, enrollmentId } = await fresh()
    const session = await prisma.cohortSession.create({
      data: {
        cohortId: from.id, title: 'جلسة مبكّرة',
        startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + DAY + 3_600_000),
      },
    })
    await prisma.attendance.create({ data: { sessionId: session.id, enrollmentId, status: 'present' } })
    const to = await mkCohort({ title: 'وجهة' })
    await expect(enrollments.switchCohort(learnerId, enrollmentId, to.id)).rejects.toThrow(/نشاطٌ مسجَّل/)
  })
})

describe('ولا تُؤخذ قيمةٌ لم تُدفع', () => {
  it('شعبةٌ أعلى سعرا تُرفض برسالةٍ تقول لماذا', async () => {
    const { enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'أغلى', price: 150 })
    await expect(enrollments.switchCohort(learnerId, enrollmentId, to.id)).rejects.toThrow(/أعلى سعرا/)
  })

  it('والأرخصُ يُقبَل — الدورةُ هي هي، والفرقُ تاريخُ تسعير الشعبة', async () => {
    const { enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'أرخص', price: 80 })
    expect((await enrollments.switchCohort(learnerId, enrollmentId, to.id)).cohortId).toBe(to.id)
  })

  it('ولا مقعدَ في ممتلئة', async () => {
    const { enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'ممتلئة', capacity: 1 })
    const auth = new AuthService(prisma)
    const filler = (await auth.register(`filler-${Date.now()}@test.local`, 'Fill#12345', 'شاغل')).userId
    await enrollments.enroll(to.id, filler, null, {})
    await expect(enrollments.switchCohort(learnerId, enrollmentId, to.id)).rejects.toThrow(/لا مقاعد متاحة/)
  })
})

describe('المقعدُ يُنقل ولا يُترك خلفه', () => {
  it('سجلُّ الحجز ينتقل — وإلّا حُسبت المغادَرةُ ممتلئةً بمقعدٍ فارغ', async () => {
    const { from, enrollmentId } = await fresh()
    await prisma.enrollmentRequest.create({
      data: { userId: learnerId, cohortId: from.id, status: 'converted', decidedAt: new Date() },
    })
    const to = await mkCohort({ title: 'وجهة' })
    await enrollments.switchCohort(learnerId, enrollmentId, to.id)

    expect(await prisma.enrollmentRequest.count({ where: { userId: learnerId, cohortId: from.id } })).toBe(0)
    expect(await prisma.enrollmentRequest.count({ where: { userId: learnerId, cohortId: to.id } })).toBe(1)
    expect(await prisma.enrollment.count({ where: { userId: learnerId, cohortId: from.id } })).toBe(0)
  })

  it('ويُسجَّل الانتقالُ بطرفيه — فمن سأل «أين مقعدي؟» وُجد جوابُه', async () => {
    const { from, enrollmentId } = await fresh()
    const to = await mkCohort({ title: 'وجهة موثَّقة' })
    await enrollments.switchCohort(learnerId, enrollmentId, to.id)
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'enrollment.switch_cohort', entityId: enrollmentId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit, 'الانتقال بلا أثر').toBeTruthy()
    expect(audit!.meta).toMatchObject({ from: from.id, to: to.id, courseId: COURSE })
  })
})
