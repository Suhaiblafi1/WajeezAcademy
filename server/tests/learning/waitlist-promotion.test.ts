/* المقعدُ الشاغرُ يُملأ من الطابور — وبأقدميّة الانتظار.

   كانت قائمةُ الانتظار تنتظر فعلا: ينسحب متعلّمٌ فيبقى مقعدُه خاليا، وتبقى
   الشعبةُ موسومةً «ممتلئة» وإن شغرت — فلا هي تُشترى ولا هي تُرقّي. ومن
   انتظر شهرا لا يعلم أنّ مكانَه فرغ.

   وهذا الملفّ يحرس أربعة:
   ١) الترقيةُ تقع، وبأقدميّة الانتظار لا بشيءٍ آخر.
   ٢) ولا تتجاوز السعة: انسحابٌ واحد يرقّي واحدا لا اثنين.
   ٣) وحالُ الشعبة تتبع الواقع: تبقى ممتلئةً إن مُلئ المقعد، وتعود مفتوحةً
      إن لم يكن في الطابور أحد.
   ٤) والمرقَّى يُخبَر — فمن رُقّي وهو لا يعلم يظنّ نفسَه منتظِرا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'

let prisma: PrismaClient
let auth: AuthService
let enrollments: EnrollmentService
let adminId = ''

const COURSE = 'C-BIZ-101'

async function learner(tag: string) {
  const u = await auth.register(`wl-${tag}@test.local`, 'Learn#12345', `متعلّم ${tag}`)
  await auth.setRoles(u.userId, ['learner'])
  return u.userId
}

/** شعبةٌ مفتوحةٌ بسعةٍ محدَّدة */
async function cohortWithCapacity(title: string, capacity: number) {
  return prisma.cohort.create({
    data: {
      courseId: COURSE, title, status: 'open', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  enrollments = new EnrollmentService(prisma)
  const admin = await auth.register('wl-admin@test.local', 'Admin#12345', 'مدير')
  await auth.setRoles(admin.userId, ['operations_manager'])
  adminId = admin.userId
}, 240_000)

describe('الترقيةُ التلقائيّة من قائمة الانتظار', () => {
  it('ترقّي أقدمَ منتظِرٍ وحدَه، وتُبقي الشعبةَ ممتلئة، وتُخبره', async () => {
    const c = await cohortWithCapacity('شعبةُ الطابور', 1)
    const inside = await learner('inside-1')
    const first = await learner('queue-first')
    const second = await learner('queue-second')

    const held = await enrollments.enroll(c.id, inside, adminId)
    expect(held.status).toBe('enrolled')
    expect((await enrollments.enroll(c.id, first, adminId)).status, 'الأوّلُ لم يُوضع في الطابور').toBe('waitlisted')
    expect((await enrollments.enroll(c.id, second, adminId)).status).toBe('waitlisted')
    expect((await prisma.cohort.findUnique({ where: { id: c.id } }))?.status).toBe('full')

    await enrollments.drop(held.id, adminId, 'انسحاب للاختبار')

    const firstRow = await prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId: c.id, userId: first } } })
    const secondRow = await prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId: c.id, userId: second } } })
    expect(firstRow?.status, 'أقدمُ منتظِرٍ لم يُرقَّ').toBe('enrolled')
    expect(secondRow?.status, 'رُقّي اثنان على مقعدٍ واحد').toBe('waitlisted')

    /* السعةُ واحد، والمقعدُ مُلئ: تبقى ممتلئة */
    expect((await prisma.cohort.findUnique({ where: { id: c.id } }))?.status).toBe('full')

    /* وسجلُّ التقدّم يُجهَّز للمرقَّى — وإلّا دخل شعبةً بلا سجلّ */
    expect(await prisma.courseProgress.findUnique({ where: { enrollmentId: firstRow!.id } })).not.toBeNull()

    const note = await prisma.notification.findFirst({
      where: { userId: first, templateKey: 'enrollment.waitlist.promoted' },
    })
    expect(note, 'المرقَّى لم يُخبَر').not.toBeNull()
    expect(note?.title).toContain('شعبةُ الطابور')

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'enrollment.waitlist.promote', entityId: firstRow!.id },
    })
    expect(audit, 'الترقيةُ لم تُسجَّل في الأثر').not.toBeNull()
  })

  it('ولا منتظِرَ: المقعدُ الشاغر يُعيد الشعبةَ مفتوحةً — لا ممتلئةً على الورق', async () => {
    const c = await cohortWithCapacity('شعبةٌ بلا طابور', 1)
    const only = await learner('alone')
    const e = await enrollments.enroll(c.id, only, adminId)
    expect((await prisma.cohort.findUnique({ where: { id: c.id } }))?.status).toBe('full')

    await enrollments.drop(e.id, adminId)
    expect((await prisma.cohort.findUnique({ where: { id: c.id } }))?.status, 'بقيت ممتلئةً ومقعدُها شاغر').toBe('open')
  })

  it('وسعةٌ بلا حدّ لا طابورَ لها — والانسحابُ لا يُحدث شيئا', async () => {
    const c = await prisma.cohort.create({
      data: {
        courseId: COURSE, title: 'شعبةٌ بلا سقف', status: 'open', registrationOpen: true,
        financialReady: true, price: 100, currency: 'USD', capacity: null,
        startsAt: new Date(Date.now() + 30 * 86_400_000),
      },
    })
    const a = await learner('nocap-a')
    const b = await learner('nocap-b')
    const ea = await enrollments.enroll(c.id, a, adminId)
    expect((await enrollments.enroll(c.id, b, adminId)).status).toBe('enrolled')
    await enrollments.drop(ea.id, adminId)
    expect((await prisma.cohort.findUnique({ where: { id: c.id } }))?.status).toBe('open')
    const bRow = await prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId: c.id, userId: b } } })
    expect(bRow?.status).toBe('enrolled')
  })
})
