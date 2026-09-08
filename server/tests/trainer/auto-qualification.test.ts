/* التأهيلُ التلقائيُّ من طلب الانضمام.

   ═══ ما كان يقع ═══

   الاعتمادُ يُنشئ ملفَّ المدرّب بلا تأهيلٍ واحد. فيفتح المعتمَدُ بوّابتَه ويقرأ
   «لا تأهيلَ بعد — التأهيلُ يقع من الإدارة» — وهو قد كتب في طلبه الدوراتِ
   التي يستطيع تدريسَها، وقرأها المراجعُ واعتمده عليها. فيُسأل عنها ثانيةً في
   طابورِ طلباتِ تأهيلٍ تكرّر قرارا وقع.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): المعتمَدُ مؤهَّلٌ لكلّ ما ذكره في طلبه،
   وتضيف الإدارةُ فوقَه ما تراه.

   ═══ وما يحرسه هذا الملفّ ═══

   ١) الاعتمادُ بنقرةٍ يكتب التأهيلَ لكلّ دورةٍ في `teachableCourseIds`.
   ٢) والمطابقةُ تعمل على ما يُقبل: النداءُ الثاني لا يضيف شيئا ولا يكتب أثرا.
   ٣) ودورةٌ رُدّ تأهيلُه لها تبقى مردودة — القيدُ `(profileId, courseId)`
      يحفظ القرارَ اليدويّ من أن يُكتب فوقَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId = ''
let applicationId = ''
let profileId = ''

/* دورتان منشورتان في كتالوج الاختبار — تُستوردان في `setupTestDb` */
const TEACHABLE = ['C-BIZ-101', 'C-AI-101']

const phase1 = {
  fullName: 'مدرب مؤهل تلقائيا',
  email: 'trainer-auto-qualify@test.local',
  country: 'الأردن',
  timezone: 'Asia/Amman',
  phoneCountryCode: '+962',
  phone: '790000001',
  specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const,
  trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'],
  deliveryMode: 'both' as const,
  motivation:
    'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

describe('المعتمَدُ مؤهَّلٌ لما ذكره في طلبه', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    const auth = new AuthService(prisma)
    apps = new TrainerApplicationService(prisma)
    review = new TrainerReviewService(prisma)
    const admin = await auth.register('admin-auto-qualify@test.local', 'Admin#12345', 'المدير الأكاديمي')
    adminId = admin.userId
    await auth.setRoles(adminId, ['academic_manager'])

    const res = await apps.submitPhase1(phase1)
    await apps.completePhase2(res.reference, res.candidateToken, {
      previousCourses: [],
      teachableCourseIds: TEACHABLE,
      availability: { seasons: ['nov_jan'] } as AvailabilityInput,
      demoConsent: true as const,
      contact: { channel: 'email' },
    })
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
    applicationId = row.id
  })

  it('قبل الاعتماد لا تأهيلَ — وإلّا فما بعده لا يقيس شيئا', async () => {
    const count = await prisma.trainerCourseQualification.count({
      where: { profile: { applicationId } },
    })
    expect(count).toBe(0)
  })

  it('الاعتمادُ بنقرةٍ يؤهّله لكلّ دورةٍ ذكرها', async () => {
    await review.decide(applicationId, adminId, 'move_to_review')
    await review.decide(applicationId, adminId, 'approve')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId } })
    profileId = profile.id
    const quals = await prisma.trainerCourseQualification.findMany({ where: { profileId }, orderBy: { courseId: 'asc' } })
    expect(quals.map((q) => q.courseId)).toEqual([...TEACHABLE].sort())
    expect(quals.every((q) => q.status === 'qualified')).toBe(true)
    /* والأثرُ يقول من أين جاء التأهيل */
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.qualify.auto', entityType: 'trainer_profile', entityId: profileId },
    })
    expect(audit, 'لا أثرَ للتأهيل التلقائيّ').not.toBeNull()
  })

  it('والمطابقةُ الثانية لا تضيف شيئا ولا تكتب أثرا', async () => {
    const before = await prisma.auditEvent.count({ where: { action: 'trainer.qualify.auto', entityId: profileId } })
    const r = await review.syncQualificationsFromApplication(profileId, null)
    expect(r.added).toEqual([])
    const after = await prisma.auditEvent.count({ where: { action: 'trainer.qualify.auto', entityId: profileId } })
    expect(after).toBe(before)
  })

  it('ودورةٌ رُدّ تأهيلُه لها يدويّا تبقى مردودة — لا يُكتب فوقَ قرارٍ بشريّ', async () => {
    await prisma.trainerCourseQualification.update({
      where: { profileId_courseId: { profileId, courseId: 'C-AI-101' } },
      data: { status: 'rejected', note: 'ردٌّ يدويّ للاختبار' },
    })
    await review.syncQualificationsFromApplication(profileId, null)
    const row = await prisma.trainerCourseQualification.findUniqueOrThrow({
      where: { profileId_courseId: { profileId, courseId: 'C-AI-101' } },
    })
    expect(row.status).toBe('rejected')
  })
})
