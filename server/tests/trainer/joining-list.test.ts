/* طابورُ الانضمام يعرف من عبر إلى «المدربون» وما عقدُ من لم يعبر (٢٤ أكتوبر ٢٠٢٦، `joining.ts`).

   ① من اعتمدنا توقيعَه، أو نشط، يُعلَّم «عبر» — بالبوّابة نفسِها التي يقرؤها «المدربون» (`OPERATING_TRAINER_WHERE`).
   ② ومن لم يعبر يحمل آخرَ عقدٍ له غيرَ مُزاح، باسمَي مطابقة التوقيع — فتقول محطّةُ «الاتفاقية» خطوتَه.
   ③ ومن لا ملفَّ له لا عقدَ له ولم يعبر.
   ④ وملفُّه يقول ما يقوله صفُّه (`getApplication().joining`) — فلا يقول الصفُّ «منه: يحجز موعده» والملفُّ غيرَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { INVITATION_ACTION } from '../../../src/application/trainer/interview-invitation'

let prisma: PrismaClient
let review: TrainerReviewService
let seq = 0

/** طلبٌ بحالته، وملفٌّ وعقودٌ إن طُلبت */
async function applicant(status: string, contracts: string[] = [], legalNameAr: string | null = null) {
  const n = ++seq
  const email = `joining-${n}-${Date.now()}@test.local`
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-JOIN-${Date.now()}-${n}`, fullName: `متقدم ${n}`, email, status },
  })
  if (contracts.length > 0 || legalNameAr) {
    const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id, legalNameAr } })
    for (const [i, s] of contracts.entries()) {
      await prisma.trainerContract.create({
        data: { profileId: profile.id, title: 'اتفاقية', status: s, createdAt: new Date(Date.now() + i * 1000), signerLegalName: s === 'signed' ? 'الاسم الموقع' : null },
      })
    }
  }
  return app.id
}

const rowOf = async (id: string) => (await review.listApplications()).find((r) => r.id === id)!

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
}, 240_000)

describe('① من عبر', () => {
  it('⚠️ من اعتمدنا توقيعه أو نشط — عبر إلى «المدربون»', async () => {
    expect((await rowOf(await applicant('contract_pending', ['signature_approved']))).operating).toBe(true)
    expect((await rowOf(await applicant('active', ['countersigned']))).operating).toBe(true)
  })

  it('⚠️ ومن وقع ولم نعتمد توقيعه لم يعبر', async () => {
    expect((await rowOf(await applicant('contract_pending', ['signed']))).operating).toBe(false)
  })
})

describe('② وعقد من لم يعبر', () => {
  /* والمُزاحُ هنا أحدثُ إنشاءً: عقدٌ أُنشئ بعد غيره فخُتم قبله، ثمّ أزاحه خَتمُ الأقدم (`supersedePriorLive`) —
     ولو كان أقدمَ لَخضرّ الفحصُ بلا شرط «غير مزاح» أصلا. */
  it('⚠️ آخر عقد غير مزاح — باسمي مطابقة التوقيع', async () => {
    const row = await rowOf(await applicant('contract_pending', ['signed', 'superseded'], 'الاسم في الوثيقة'))
    expect(row.contract).toMatchObject({ status: 'signed', documentNameAr: 'الاسم في الوثيقة', signedNameAr: 'الاسم الموقع' })
  })

  it('والاسم في الوثيقة اسم الطلب إن لم يكتب اسم قانوني', async () => {
    const id = await applicant('contract_pending', ['sent'])
    const row = await rowOf(id)
    expect(row.contract?.documentNameAr).toBe(row.fullName)
  })
})

describe('③ ومن لا ملف له', () => {
  it('لا عقد له ولم يعبر', async () => {
    const row = await rowOf(await applicant('submitted'))
    expect(row.contract).toBeNull()
    expect(row.operating).toBe(false)
  })
})

describe('④ وملفه يقول ما يقوله صفه', () => {
  it('⚠️ حقائق الانضمام في الملف هي حقائق الصف — عقدا ولقاءات ودعوة وعبورا', async () => {
    const day = 86_400_000
    const signed = await applicant('contract_pending', ['signed', 'superseded'], 'الاسم في الوثيقة')
    const crossed = await applicant('contract_pending', ['signature_approved'])
    const fresh = await applicant('submitted')
    /* وله لقاءٌ مضى بنتيجته، وغيابٌ، وموعدٌ قادم — ومن كلٍّ يُقرأ شيء: النتيجةُ والعددُ والمعلَّق */
    const met = await applicant('interview_scheduled')
    await prisma.trainerInterview.createMany({ data: [
      { applicationId: met, scheduledAt: new Date(Date.now() - 6 * day), outcome: 'no_show' },
      { applicationId: met, scheduledAt: new Date(Date.now() - 3 * day), outcome: 'passed' },
      { applicationId: met, scheduledAt: new Date(Date.now() + 2 * day) },
      { applicationId: met, scheduledAt: new Date(Date.now() + 5 * day), canceledAt: new Date() },
    ] })
    /* ومن دعوناه إلى الحجز ولم يحجز — ودعوتُه في الأثر لا في عمود */
    const invited = await applicant('under_review')
    await prisma.auditEvent.create({ data: { action: INVITATION_ACTION, entityType: 'trainer_application', entityId: invited } })

    for (const id of [signed, crossed, fresh, met, invited]) {
      const row = await rowOf(id)
      const { joining } = await review.getApplication(id)
      expect(joining, id).toEqual({
        operating: row.operating, interviewsCount: row.interviewsCount, interviewInvitedAt: row.interviewInvitedAt,
        pendingInterviewAt: row.pendingInterviewAt, interviewOutcome: row.interviewOutcome, contract: row.contract,
      })
    }
    /* وشرطُ صحّة الفحص: الحقائقُ ليست فارغةً كلُّها — وإلّا تطابق فراغان */
    const metRow = await rowOf(met)
    expect(metRow.interviewOutcome).toBe('passed')
    expect(metRow.interviewsCount).toBe(2)
    expect(metRow.pendingInterviewAt).not.toBeNull()
    expect((await rowOf(invited)).interviewInvitedAt).not.toBeNull()
  })
})
