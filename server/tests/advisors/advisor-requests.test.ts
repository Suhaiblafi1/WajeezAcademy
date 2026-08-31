/* ما لا يملكه المستشار وحده — خصمٌ وتعديلُ خطّة.

   دورُ المستشار مبيعاتٌ في وجهه الأوّل ومتابعةٌ أكاديمية في الثاني. وفي
   الوجهين يصطدم بما لا يملكه: أن يُنزل سعرا ليُغلق بيعا، أو أن يضيف دورةً
   إلى خطّة طالبٍ أو يُلغيها. وكان ذلك يجري خارج المنصّة — برسالةٍ إلى
   الإدارة تُنسى ولا تُتتبَّع ولا تُدقَّق، ولا يعرف أحدٌ بعد شهرٍ كم خصما
   أُعطي ولا لماذا.

   فما يُحرَس هنا خمسة:
   ١) لا طلبَ إلّا على حالةٍ مسندةٍ إليه — كبقيّة تشغيله.
   ٢) لا طلبَ بلا سبب يُقرأ.
   ٣) الخصمُ نسبةٌ أو مبلغ، لا كلاهما ولا لا شيء.
   ٤) المستشار لا يبتّ في طلبه — ولا في طلب غيره.
   ٥) الاعتمادُ يُنتج كوبونا **مقصورا على ذلك العميل**، فلا يتسرّب رمزٌ
      أُعطي لواحدٍ فيستعمله مئة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { AdvisorRequestService } from '../../services/advisor-request.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let requests: AdvisorRequestService
let managerId: string
let advisorId: string
let otherAdvisorId: string
let learnerId: string
let caseId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  requests = new AdvisorRequestService(prisma)

  const m = await auth.register('req-manager@test.local', 'Manager#12345', 'مدير عمليات')
  managerId = m.userId
  await auth.setRoles(managerId, ['operations_manager'])

  const a = await auth.register('req-advisor@test.local', 'Advisor#12345', 'مستشارة')
  advisorId = a.userId
  await auth.setRoles(advisorId, ['advisor'])

  const o = await auth.register('req-other@test.local', 'Advisor#12345', 'مستشار آخر')
  otherAdvisorId = o.userId
  await auth.setRoles(otherAdvisorId, ['advisor'])

  const l = await auth.register('req-learner@test.local', 'Learner#12345', 'متعلّمة')
  learnerId = l.userId

  const attached = await advisors.attachDiagnostic(learnerId, { kind: 'pathway', pathwayId: 'PW-FND-003' })
  caseId = attached.case.id
  await advisors.assign(caseId, advisorId, managerId)
})

describe('طلبات المستشار', () => {
  it('١) لا طلبَ على حالةٍ غير مسندة إليه', async () => {
    await expect(
      requests.submit(otherAdvisorId, caseId, { kind: 'discount', percentOff: 10, reasonAr: 'سبب كافٍ للاختبار' }),
    ).rejects.toMatchObject({ code: 'not_assigned' })
  })

  it('٢) لا طلبَ بلا سبب يُقرأ', async () => {
    await expect(
      requests.submit(advisorId, caseId, { kind: 'discount', percentOff: 10, reasonAr: 'قصير' }),
    ).rejects.toMatchObject({ code: 'reason_required' })
  })

  it('٣) الخصم نسبةٌ أو مبلغ — لا كلاهما ولا لا شيء', async () => {
    await expect(
      requests.submit(advisorId, caseId, { kind: 'discount', reasonAr: 'العميلة موظفة حكومية وميزانيتها محدودة' }),
    ).rejects.toMatchObject({ code: 'amount_required' })
    await expect(
      requests.submit(advisorId, caseId, {
        kind: 'discount', percentOff: 10, amountOff: 20, currency: 'JOD',
        reasonAr: 'العميلة موظفة حكومية وميزانيتها محدودة',
      }),
    ).rejects.toMatchObject({ code: 'amount_ambiguous' })
  })

  it('٤) والنسبة بين ١ و٥٠ — ما فوقها قرارُ إدارةٍ لا طلبُ مستشار', async () => {
    await expect(
      requests.submit(advisorId, caseId, { kind: 'discount', percentOff: 90, reasonAr: 'العميلة تطلب خصما كبيرا جدا' }),
    ).rejects.toMatchObject({ code: 'percent_out_of_range' })
  })

  it('٥) طلبُ خصمٍ صحيح يُقبل ويبقى معلّقا', async () => {
    const r = await requests.submit(advisorId, caseId, {
      kind: 'discount', percentOff: 15,
      reasonAr: 'العميلة موظفة حكومية وميزانيتها محدودة، وأبدت جدّية بحضور جلسة تعريفية',
    })
    expect(r.status).toBe('pending')
    expect(r.percentOff).toBe(15)
  })

  it('٦) المستشار لا يبتّ في طلبه', async () => {
    const [r] = await requests.pending()
    await expect(
      requests.decide(r.id, advisorId, 'approved'),
    ).rejects.toMatchObject({ code: 'self_review' })
  })

  it('٧) الاعتماد يُنتج كوبونا مقصورا على العميل', async () => {
    const [r] = await requests.pending()
    const out = await requests.decide(r.id, managerId, 'approved', 'وافقنا — عميلة جادّة')
    expect(out.status).toBe('approved')
    expect(out.couponId).toBeTruthy()

    const coupon = await prisma.coupon.findUnique({ where: { id: out.couponId! } })
    expect(coupon?.percentOff).toBe(15)
    expect(coupon?.restrictedToUserId, 'الكوبون غير مقصور — يتسرّب لغير صاحبه').toBe(learnerId)
    expect(coupon?.maxUses, 'كوبونُ عميلٍ واحد يُستعمل مرّة').toBe(1)
  })

  it('٨) ولا يُبتّ في المبتوت مرّتين', async () => {
    const all = await requests.byCase(advisorId, caseId)
    const decided = all.find((x) => x.status === 'approved')!
    await expect(
      requests.decide(decided.id, managerId, 'rejected'),
    ).rejects.toMatchObject({ code: 'not_pending' })
  })

  it('٩) الرفض يلزمه سبب — فالمستشار يقرأ لماذا رُفض', async () => {
    const r = await requests.submit(advisorId, caseId, {
      kind: 'plan_add', courseId: 'C-MGR-101',
      reasonAr: 'العميلة رُقّيت حديثا وتحتاج أساسيّات الإدارة قبل غيرها',
    })
    await expect(requests.decide(r.id, managerId, 'rejected')).rejects.toMatchObject({ code: 'reason_required' })
    const out = await requests.decide(r.id, managerId, 'rejected', 'الدورة خارج ميزانية الخطة الحالية')
    expect(out.status).toBe('rejected')
    expect(out.decisionNoteAr).toContain('خارج ميزانية')
  })

  it('١٠) تعديلُ الخطة يلزمه معرّف دورة', async () => {
    await expect(
      requests.submit(advisorId, caseId, { kind: 'plan_add', reasonAr: 'أريد إضافة دورة لهذه العميلة الآن' }),
    ).rejects.toMatchObject({ code: 'course_required' })
  })

  it('١١) المستشار يسحب طلبه المعلّق ولا يسحب طلب غيره', async () => {
    const r = await requests.submit(advisorId, caseId, {
      kind: 'discount', amountOff: 25, currency: 'JOD',
      reasonAr: 'خصمٌ مقطوع بدل النسبة — العميلة تشتري دورةً واحدة',
    })
    await expect(requests.cancel(otherAdvisorId, r.id)).rejects.toMatchObject({ code: 'not_owner' })
    const out = await requests.cancel(advisorId, r.id)
    expect(out.status).toBe('cancelled')
  })

  it('١٢) وكلُّ قرارٍ يُدوَّن في سجلّ التدقيق', async () => {
    const rows = await prisma.auditEvent.findMany({ where: { entityType: 'advisor_request' } })
    expect(rows.length, 'لا أثرَ في التدقيق — فلا يُعرف بعد شهرٍ من خصم ولماذا').toBeGreaterThanOrEqual(3)
  })
})
