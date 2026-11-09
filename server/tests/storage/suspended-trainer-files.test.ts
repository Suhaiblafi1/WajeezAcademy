/* المدرّبُ الموقوفُ لا يفتح ملفّات شعبته (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `CohortFileService.assertCanRead`
   و`AssessmentService.assertCanReadSubmissionFile`.

   كلُّ فعلٍ للمدرّب في شعبته يُردّ بإيقافه (`assertCohortTrainer`) — التصحيحُ والحضورُ والجدولة. وكان بابا الملفّات يسألان عن
   الإسناد وحدَه: فيفتح الموقوفُ عملَ متعلّميه المسلَّم وملفّاتِ الشعبة ما دام مسنَدا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortFileService } from '../../services/cohort-file.service'
import { AssessmentService } from '../../services/assessment.service'

let prisma: PrismaClient
let trainerUserId = ''
let profileId = ''
let fileKey = ''
let submissionKey = ''
const STAMP = Date.now()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  trainerUserId = (await auth.register(`stf-${STAMP}@test.local`, 'Trainer#12345', 'مدرب الشعبة')).userId
  const application = await prisma.trainerApplication.create({
    data: { reference: `TR-STF-${STAMP}`, fullName: 'مدرب الشعبة', email: `stf-${STAMP}@test.local`, phone: '0790000097', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: trainerUserId, isVerified: true } })).id
  const cohortId = (await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبة الملفات', status: 'active', capacity: 10 } as never })).id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead' } })

  fileKey = `cf-stf-${STAMP}-0000000000000000.pdf`
  await prisma.cohortFile.create({ data: { cohortId, purpose: 'module_body', refId: 'M1', storageKey: fileKey, originalName: 'محور.pdf', mime: 'application/pdf' } })

  const learner = (await auth.register(`stf-l-${STAMP}@test.local`, 'Learner#12345', 'متعلم')).userId
  const enrollmentId = (await prisma.enrollment.create({ data: { userId: learner, cohortId, status: 'enrolled' } })).id
  const assessmentId = (await prisma.cohortAssessment.create({ data: { cohortId, type: 'assignment', title: 'مهمة', maxScore: 10 } })).id
  submissionKey = `sub-stf-${STAMP}-000000000000000.pdf`
  await prisma.assignmentSubmission.create({ data: { assessmentId, enrollmentId, storageKey: submissionKey, fileName: 'عملي.pdf' } })
}, 240_000)

const asTrainer = () => ({ userId: trainerUserId, permissions: [] as string[] })

describe('المدرب الموقوف لا يفتح ملفات شعبته', () => {
  it('وقبل الإيقاف يفتحها', async () => {
    await expect(new CohortFileService(prisma).assertCanRead(fileKey, asTrainer())).resolves.toBeTruthy()
    await expect(new AssessmentService(prisma).assertCanReadSubmissionFile(submissionKey, asTrainer())).resolves.toBeTruthy()
  })

  it('⚠️ وبعد الإيقاف: لا ملف شعبة ولا عمل متعلم', async () => {
    await prisma.trainerProfile.update({ where: { id: profileId }, data: { suspendedAt: new Date() } })
    await expect(new CohortFileService(prisma).assertCanRead(fileKey, asTrainer()), 'فتح الموقوف ملف الشعبة').rejects.toMatchObject({ code: 'not_found' })
    await expect(new AssessmentService(prisma).assertCanReadSubmissionFile(submissionKey, asTrainer()), 'فتح الموقوف عمل متعلم').rejects.toMatchObject({ code: 'not_found' })
  })
})
