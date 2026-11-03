/* أجراسُ الإدارة تصل السوبر أدمن ومديرَ الأكاديميّة (٣ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «تأكّد أنّه يصل السوبر أدمن ومديرَ الأكاديميّة أيضا». وكان مديرُ الأكاديميّة
   خارجَ جرس تذكرة الدعم ورسالة الموقع، ولم يكن للدفع جرسٌ عند أحدٍ من الإدارة أصلا.

   ونُقض كلُّ حارسٍ مرّةً: نزعُ `academic_manager` من التذكرة ثمّ من الرسالة أحمرَ كلّا منهما،
   ونزعُ جرس الدفع من `settleOrder` أحمرَ الأوّل. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { SupportService } from '../../services/support.service'
import { ContactService } from '../../services/contact.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
const ids: Record<string, string> = {}

const staff = async (role: string) => {
  const u = await auth.register(`alert-${role}@test.local`, 'Staff#12345', `موظّف ${role}`)
  await auth.setRoles(u.userId, [role])
  ids[role] = u.userId
}

const bellsOf = (role: string, templateKey: string) =>
  prisma.notification.count({ where: { userId: ids[role], templateKey, channel: 'in_app' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  for (const role of ['super_admin', 'academic_manager', 'finance', 'support', 'operations_manager']) await staff(role)
}, 240_000)

describe('أجراسُ الإدارة', () => {
  it('الدفعةُ تصل السوبر أدمن ومديرَ الأكاديميّة والماليّة — جرسا واحدا لكلٍّ', async () => {
    const commerce = new CommerceService(prisma)
    const learner = await auth.register('alert-learner@test.local', 'Learner#12345', 'متعلّم الدفعة')
    const cohort = await prisma.cohort.create({
      data: {
        plans: { create: await approvedTrainerPlan(prisma) },
        courseId: 'C-BIZ-101', title: 'شعبة جرس الدفع', status: 'open',
        registrationOpen: true, financialReady: true, price: 200, currency: 'JOD', capacity: 5,
      },
    })
    const req = await commerce.requestEnrollment(learner.userId, cohort.id)
    /* المزوّدُ اختباريّ: الموافقةُ تُسوّي الطلبَ فورا (`settleIfTestProvider`) */
    const order = await commerce.approveEnrollmentRequest(req.id, ids.academic_manager)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('paid')

    for (const role of ['super_admin', 'academic_manager', 'finance']) {
      expect(await bellsOf(role, 'admin.order_paid'), `لم يصل جرسُ الدفعة ${role}`).toBe(1)
    }
    expect(await bellsOf('support', 'admin.order_paid'), 'وصل جرسُ المال الدعمَ').toBe(0)
  })

  it('وتذكرةُ الدعم تصل مديرَ الأكاديميّة مع السوبر أدمن والدعم', async () => {
    const learner = await auth.register('alert-ticket@test.local', 'Learner#12345', 'صاحب التذكرة')
    await new SupportService(prisma).createTicket(learner.userId, { subject: 'سؤال', body: 'لا أرى شعبتي' })
    for (const role of ['super_admin', 'academic_manager', 'support']) {
      expect(await bellsOf(role, 'admin.support_ticket'), `لم تصل التذكرةُ ${role}`).toBe(1)
    }
  })

  it('ورسالةُ الموقع تصل مديرَ الأكاديميّة مع السوبر أدمن والدعم', async () => {
    await new ContactService(prisma).submit({
      name: 'زائر', email: 'visitor@test.local', entity: 'individual',
      topic: 'استفسار عن مسار أو تشخيص', message: 'أريد أن أعرف أيّ مسار يناسبني.',
    } as Parameters<ContactService['submit']>[0])
    for (const role of ['super_admin', 'academic_manager', 'support']) {
      expect(await bellsOf(role, 'admin.contact_message'), `لم تصل رسالةُ الموقع ${role}`).toBe(1)
    }
  })
})
