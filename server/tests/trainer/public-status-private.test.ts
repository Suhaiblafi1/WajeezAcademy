/* المتابعةُ بالبريد لا تكشف موعدَ المقابلة ولا رابطَ إلغائها (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Email shows status only»).

   `getPublicStatus` يكفي فيه البريد. وكان يعيد موعدَ مقابلة المتقدّم ورابطَ Calendly الذي يعدّلها ويلغيها — فمن عرف
   بريدَ متقدّمٍ ألغى مقابلتَه. وجُرّب فمرّ. فصار يقول «لك موعد» وحدَها، والموعدُ ورابطُه في حسابه (`myApplication`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'

let prisma: PrismaClient
const STAMP = Date.now()
const RESCHEDULE = `https://calendly.com/reschedulings/secret-${STAMP}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

describe('المتابعة العامة لطلب المدرب', () => {
  it('⚠️ بالبريد وحده: الحالة و«لك موعد» — بلا موعد ولا رابط تعديل', async () => {
    const email = `psp-${STAMP}@test.local`
    const { userId } = await new AuthService(prisma).register(email, 'Applicant#12345', 'متقدم')
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-PSP-${STAMP}`, fullName: 'متقدم', email, userId, status: 'interview_scheduled',
        motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    await prisma.trainerInterview.create({
      data: { applicationId: app.id, scheduledAt: new Date(Date.now() + 86_400_000), provider: 'calendly', rescheduleUrl: RESCHEDULE },
    })
    const svc = new TrainerApplicationService(prisma)

    const pub = await svc.getPublicStatus(email)
    expect(pub.status).toBe('interview_scheduled')
    expect(pub.hasInterview).toBe(true)
    expect(pub.interviewRescheduleUrl, 'رابط إلغاء المقابلة لمن يعرف البريد').toBeNull()
    expect(pub.interviewAt, 'موعد المقابلة لمن يعرف البريد').toBeNull()
    expect(JSON.stringify(pub), 'الرابط في الرد بأي اسم').not.toContain(RESCHEDULE)

    /* وصاحبُه يقرؤهما في حسابه */
    const mine = await svc.myApplication(userId)
    expect(JSON.stringify(mine), 'لم يعد الرابط يصل صاحبه').toContain(RESCHEDULE)
  })
})
