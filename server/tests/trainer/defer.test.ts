/* التأجيلُ إلى الفصول القادمة — على قاعدةٍ حقيقيّة (٦ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/deferral.ts`: خيارٌ ثالثٌ بجانب القبول
   والرفض — «يؤجَّل حسابُك للفصول القادمة… ونتواصل معك بعد شهرين». وما يُحرَس هنا
   ما لا يُثبته إلّا قاعدةٌ تُقرأ بعد الكتابة:

   ① **القرارُ ينقل ويَعِد ويُبلِغ** — الحالةُ `deferred`، وموعدُ التواصل بعد شهرين
      في الطلب نفسِه، وسطرٌ في سجلّ الحالة، وأثرُ البريد بحاله والموعدِ نفسِه.
   ② **والموعدُ يُمحى حين يخرج الطلبُ من التأجيل** — بقرارٍ أو بسحبٍ من صاحبه.
   ③ **و«مؤجَّل» نتيجةُ مقابلةٍ تقبلها القاعدة** — ولا تنقل الطلبَ ولا تُرسل شيئا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { DEFERRED, deferredFollowUpAt } from '../../../src/application/trainer/deferral'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId: string

const base = {
  phoneCountryCode: '+962', phone: '771060000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة قيادة', specialties: ['القيادة'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function applicant(email: string, fullName: string) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { id: row.id, reference: res.reference, token: res.candidateToken }
}

const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('admin-defer@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 180_000)

describe('① القرارُ ينقل ويَعِد ويُبلِغ', () => {
  it('الحالةُ «مؤجَّل»، وموعدٌ بعد شهرين، وسطرٌ في السجلّ، وأثرُ البريد بالموعد نفسِه', async () => {
    const a = await applicant('defer-1@test.local', 'ريم المدرّبة')
    const before = new Date()
    const out = await review.decide(a.id, adminId, 'defer', 'نودّ أن تدرّسي «القيادة لأوّل مرّة» في الربيع')
    expect(out.emailDelivery, 'حالُ البريد لا يعود إلى الشاشة').toBeTruthy()

    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe(DEFERRED)
    expect(row.deferredFollowUpAt, 'لا موعدَ تواصلٍ في الطلب').not.toBeNull()
    const expected = deferredFollowUpAt(before).getTime()
    expect(Math.abs(row.deferredFollowUpAt!.getTime() - expected), 'الموعدُ ليس بعد شهرين').toBeLessThan(DAY)

    const history = await prisma.trainerStatusHistory.findFirst({
      where: { applicationId: a.id, toStatus: DEFERRED }, orderBy: { createdAt: 'desc' },
    })
    expect(history, 'لا سطرَ في سجلّ الحالة').not.toBeNull()

    const notified = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.deferral.notify', entityId: a.id }, orderBy: { createdAt: 'desc' },
    })
    expect(notified, 'لا أثرَ لبريد التأجيل').not.toBeNull()
    const meta = notified!.meta as { followUpAt?: string; emailDelivery?: string }
    expect(meta.followUpAt, 'البريدُ وعد بيومٍ غيرِ الذي في الطلب').toBe(row.deferredFollowUpAt!.toISOString())
    expect(meta.emailDelivery).toBe(out.emailDelivery)
  })

  it('ولا يُؤجَّل المؤجَّلُ ثانيةً — القرارُ لا يُعرض على من هو فيه', async () => {
    const a = await applicant('defer-2@test.local', 'هالة المدرّبة')
    await review.decide(a.id, adminId, 'defer')
    await expect(review.decide(a.id, adminId, 'defer')).rejects.toMatchObject({ status: 409 })
  })
})

describe('② والموعدُ يُمحى حين يخرج الطلبُ من التأجيل', () => {
  it('بقرارٍ يعيده إلى المراجعة', async () => {
    const a = await applicant('defer-3@test.local', 'نور المدرّبة')
    await review.decide(a.id, adminId, 'defer')
    await review.decide(a.id, adminId, 'move_to_review')
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe('under_review')
    expect(row.deferredFollowUpAt, 'بقي موعدٌ يَعِد بشيءٍ لم يعد قائما').toBeNull()
  })

  it('وبسحبٍ من صاحبه — لا بالقرار وحدَه', async () => {
    const a = await applicant('defer-4@test.local', 'ليلى المدرّبة')
    await review.decide(a.id, adminId, 'defer')
    await apps.withdraw(a.reference, a.token, 'وجدتُ عملا آخر')
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe('withdrawn')
    expect(row.deferredFollowUpAt).toBeNull()
  })
})

describe('③ و«مؤجَّل» نتيجةُ مقابلةٍ تقبلها القاعدة — ولا تنقل الطلب', () => {
  it('تُكتب نتيجةً للّقاء، ويبقى الطلبُ في حالته، ولا يُكتب بريدُ تأجيل', async () => {
    const a = await applicant('defer-5@test.local', 'سارة المدرّبة')
    await review.decide(a.id, adminId, 'move_to_review')
    const iv = await prisma.trainerInterview.create({
      data: { applicationId: a.id, scheduledAt: new Date(Date.now() - DAY) },
    })
    await review.recordInterviewOutcome(iv.id, adminId, DEFERRED)

    const saved = await prisma.trainerInterview.findUniqueOrThrow({ where: { id: iv.id } })
    expect(saved.outcome).toBe(DEFERRED)
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status, 'الحكمُ في التقييم نقل الطلبَ بلا قرار').toBe('under_review')
    expect(row.deferredFollowUpAt).toBeNull()
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.deferral.notify', entityId: a.id } }),
      'خرج بريدُ تأجيلٍ من حكمٍ في التقييم').toBe(0)
  })
})
